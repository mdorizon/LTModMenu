import { wsSend, getCurrentMap } from "@core/game";
import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";
import { FISHING_SEAT_IDS } from "./data/fishing-seats";

function pickFishingSeat(): string {
  const seats = (window.__gameApp as any)?.seats;
  if (seats) {
    const free = FISHING_SEAT_IDS.filter((id: string) => seats[id] && !seats[id].occupied);
    if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  }
  return FISHING_SEAT_IDS[Math.floor(Math.random() * FISHING_SEAT_IDS.length)];
}

function getFishingManager(): any {
  const gameObjects = (window.__gameApp as any)?.gameObjects;
  if (!gameObjects) return null;
  for (let i = 0; i < gameObjects.length; i++) {
    if (gameObjects[i]?.name === "FishingManager") return gameObjects[i];
  }
  return null;
}

let fishingCleanupInterval: ReturnType<typeof setInterval> | null = null;
let forceFishingActive = false;

function syncButton(): void {
  const btn = document.getElementById("lt-fish-here") as HTMLButtonElement | null;
  if (!btn) return;
  if (forceFishingActive) {
    btn.textContent = "Stop Fishing";
    btn.className = "lt-action lt-danger";
  } else {
    btn.textContent = "Force Fishing";
    btn.className = "lt-action lt-primary";
  }
}

function deactivate(): void {
  const lp = window.__gameApp?.localPlayer as any;
  if (lp?.stand) {
    try { lp.stand(); } catch (_) {}
  }
  cleanupFishingRod();
}

export function cleanupFishingRod(): void {
  const app = window.__gameApp;
  if (app?.localPlayer?.character?.removeFishingRod) {
    app.localPlayer.character.removeFishingRod();
  }
  if (fishingCleanupInterval) {
    clearInterval(fishingCleanupInterval);
    fishingCleanupInterval = null;
  }
  forceFishingActive = false;
  clearStatus("force-fishing");
  syncButton();
}

function watchForUnsit(): void {
  if (fishingCleanupInterval) clearInterval(fishingCleanupInterval);
  fishingCleanupInterval = setInterval(() => {
    const lp = window.__gameApp?.localPlayer;
    if (!lp || !lp.currentSeatId) {
      cleanupFishingRod();
    }
  }, 200);
}

function activate(): void {
  log("ACTION", "FISH HERE button clicked");
  const app = window.__gameApp;
  if (!app?.localPlayer) return;

  forceFishingActive = true;
  setStatus("force-fishing", { label: "FORCE FISH", color: "#e070b0", bg: "#3a1a2a" });
  syncButton();

  const lp = app.localPlayer;
  const dir = lp.direction || "down";

  lp.sit("portable-" + dir);
  setTimeout(() => {
    if (lp.setSitAnimation) lp.setSitAnimation("fishing");

    const animDir = dir === "right" || dir === "left" ? "side" : dir;
    log("ACTION", "Force fishing: dir=" + dir + " animDir=" + animDir);

    try {
      lp.changeAnimationState("fishing_" + animDir);
    } catch (e) {
      log("ACTION", "changeAnimationState failed: " + (e as Error).message);
    }

    if (lp.character) {
      try {
        if (lp.character.removeFishingRod) lp.character.removeFishingRod();
        if (lp.character.takeOutFishingRod) lp.character.takeOutFishingRod(dir);
      } catch (e) {
        log("ACTION", "Failed to show fishing rod sprite: " + (e as Error).message);
      }
    }

    wsSend("sit", pickFishingSeat());
    setTimeout(() => {
      const fm = getFishingManager();
      if (fm) {
        fm.startFishing();
        log("ACTION", "Force fishing: FM.startFishing()");
      } else {
        log("ACTION", "Force fishing: FishingManager not found");
      }
      watchForUnsit();
    }, 300);
  }, 500);
}

export function renderForceFishing(): string {
  if (getCurrentMap() !== "fishing") return "";
  const cls = forceFishingActive ? "lt-action lt-danger" : "lt-action lt-primary";
  const label = forceFishingActive ? "Stop Fishing" : "Force Fishing";
  return '<button class="' + cls + '" id="lt-fish-here">' + label + "</button>";
}

export function bindForceFishing(): void {
  const btn = document.getElementById("lt-fish-here");
  if (!btn) return;

  btn.onclick = () => {
    if (forceFishingActive) {
      deactivate();
    } else {
      activate();
    }
  };
}
