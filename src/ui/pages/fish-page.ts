import { mkHeader, bindNav, type RenderFn } from "../components";
import { fishingLoop, isFishingLoopRunning, updateHUD } from "../../bot/fishing-loop";
import { saveData } from "../../storage/storage";

export function renderFish(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  const paused = window.__botPaused;
  hud.innerHTML =
    mkHeader("Auto Fishing", true) +
    '<div class="lt-body" style="padding:4px 0;">' +
    '<div class="lt-stat-row" style="padding:10px 14px;">' +
    '<span style="color:#6a6a9a;font-size:16px;">Session <span id="lt-time">00:00:00</span></span>' +
    '<button class="lt-action ' +
    (paused ? "lt-success" : "lt-danger") +
    '" id="lt-toggle" style="width:auto;margin:0;padding:6px 18px;font-size:16px;">' +
    (paused ? "START" : "STOP") +
    "</button>" +
    "</div>" +
    '<div class="lt-sep"></div>' +
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
    '<button class="lt-action lt-danger" id="lt-reset">Reset Stats</button>' +
    "</div>";
  bindNav(renderMainFn, pages);

  document.getElementById("lt-toggle")!.onclick = () => {
    window.__botPaused = !window.__botPaused;
    console.log("[LTModMenu] Toggle pause:", window.__botPaused ? "PAUSED" : "RUNNING");
    if (!window.__botPaused && !isFishingLoopRunning()) {
      fishingLoop();
    }
    renderFish(hud, renderMainFn, pages);
  };

  document.getElementById("lt-reset")!.onclick = () => {
    const overlay = document.createElement("div");
    overlay.id = "lt-modal-overlay";
    overlay.innerHTML =
      '<div id="lt-modal">' +
      '<div id="lt-modal-title">Reset Stats</div>' +
      '<div id="lt-modal-msg">Reset all fishing stats? This action cannot be undone.</div>' +
      '<div id="lt-modal-actions">' +
      '<button id="lt-modal-cancel">Cancel</button>' +
      '<button id="lt-modal-confirm">Reset</button>' +
      "</div></div>";
    document.body.appendChild(overlay);

    const close = () => document.body.removeChild(overlay);

    document.getElementById("lt-modal-cancel")!.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    document.getElementById("lt-modal-confirm")!.onclick = () => {
      close();
      window.__fishStats = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        secret: 0,
        event: 0,
        unknown: 0,
        total: 0,
        gold: 0,
        last_fish: "",
      };
      saveData("fishStats", window.__fishStats);
      console.log("[LTModMenu] Stats reset");
      renderFish(hud, renderMainFn, pages);
    };
  };

  if (window.__fishStats) updateHUD();
}
