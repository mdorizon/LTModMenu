import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { fishingLoop, isFishingLoopRunning, stopFishingLoop, updateHUD, getSkipMinigame, setSkipMinigame } from "../fishing-loop";
import { renderForceFishing, bindForceFishing } from "../force-fishing";
import { renderFishShop, bindFishShop } from "../fish-shop";
import { renderAutoSell, bindAutoSell } from "../auto-sell";
import { showModal } from "@ui/modal";
import { saveData } from "@core/storage";
import { log } from "@core/logger";
import { getCurrentMap } from "@core/game";

let mapWatchInterval: ReturnType<typeof setInterval> | null = null;

function startMapWatch(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  if (mapWatchInterval) clearInterval(mapWatchInterval);
  let lastMap = getCurrentMap();
  mapWatchInterval = setInterval(() => {
    if (!document.getElementById("lt-toggle")) {
      clearInterval(mapWatchInterval!);
      mapWatchInterval = null;
      return;
    }
    const map = getCurrentMap();
    if (map !== lastMap) {
      lastMap = map;
      renderFishing(hud, renderMainFn, pages);
    }
  }, 500);
}

export function renderFishing(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  hud.innerHTML =
    mkHeader("Fishing", true) +
    '<div class="lt-body" style="padding:4px 0;">' +
    '<div class="lt-stat-row" style="font-size:20px;font-weight:700;padding:8px 14px;color:#e0d8f0;">' +
    '<span>Total Caught</span><span id="lt-total">0</span></div>' +
    '<div class="lt-stat-row" style="color:#f0c040;font-weight:600;font-size:18px;">' +
    '<span>Gold Earned</span><span id="lt-gold">0</span></div>' +
    '<div class="lt-sep"></div>' +
    '<div class="lt-stat-row" style="color:#8a8a9a;"><span>Common</span><span id="lt-common">0</span></div>' +
    '<div class="lt-stat-row" style="color:#5ad85a;"><span>Uncommon</span><span id="lt-uncommon">0</span></div>' +
    '<div class="lt-stat-row" style="color:#5a9af0;"><span>Rare</span><span id="lt-rare">0</span></div>' +
    '<div class="lt-stat-row" style="color:#b06ad8;"><span>Epic</span><span id="lt-epic">0</span></div>' +
    '<div class="lt-stat-row" style="color:#f0a030;"><span>Legendary</span><span id="lt-legendary">0</span></div>' +
    '<div class="lt-stat-row" style="color:#f05050;"><span>Secret</span><span id="lt-secret">0</span></div>' +
    '<div class="lt-stat-row" style="color:#6a6a9a;"><span>Event</span><span id="lt-event">0</span></div>' +
    '<div class="lt-sep"></div>' +
    '<div class="lt-status" id="lt-last" style="font-size:14px;"></div>' +
    '<button class="lt-action ' + (window.__botPaused ? "lt-success" : "lt-danger") + '" id="lt-toggle">' +
    (window.__botPaused ? "START" : "STOP") +
    '</button>' +
    '<button class="lt-action ' + (getSkipMinigame() ? 'lt-success' : 'lt-muted') + '" id="lt-skip-minigame">' +
    'SKIP MINIGAME: ' + (getSkipMinigame() ? 'ON' : 'OFF') + '</button>' +
    '<button class="lt-action lt-danger" id="lt-reset">Reset Stats</button>' +
    renderAutoSell() +
    renderForceFishing() +
    renderFishShop() +
    "</div>";
  bindNav(renderMainFn, pages);

  document.getElementById("lt-toggle")!.onclick = () => {
    window.__botPaused = !window.__botPaused;
    log("UI", "Toggle pause: " + (window.__botPaused ? "PAUSED" : "RUNNING"));
    if (window.__botPaused) {
      stopFishingLoop();
    } else if (!isFishingLoopRunning()) {
      fishingLoop();
    }
    renderFishing(hud, renderMainFn, pages);
  };

  document.getElementById("lt-skip-minigame")!.onclick = () => {
    const next = !getSkipMinigame();
    setSkipMinigame(next);
    const btn = document.getElementById("lt-skip-minigame")!;
    btn.textContent = "SKIP MINIGAME: " + (next ? "ON" : "OFF");
    btn.className = "lt-action " + (next ? "lt-success" : "lt-muted");
    log("UI", "Skip minigame " + (next ? "enabled" : "disabled"));
  };

  document.getElementById("lt-reset")!.onclick = () => {
    showModal({
      title: "Reset Stats",
      message: "Reset all fishing stats? This action cannot be undone.",
      style: "danger",
      buttons: [
        { label: "Cancel", style: "default", onClick: () => {} },
        {
          label: "Reset",
          style: "danger",
          onClick: () => {
            window.__fishStats = {
              common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0,
              secret: 0, event: 0, unknown: 0, total: 0, gold: 0, last_fish: "",
            };
            saveData("fishStats", window.__fishStats);
            log("UI", "Stats reset");
            renderFishing(hud, renderMainFn, pages);
          },
        },
      ],
    });
  };

  bindForceFishing();

  bindFishShop();
  bindAutoSell();

  if (window.__fishStats) updateHUD();
  startMapWatch(hud, renderMainFn, pages);
}
