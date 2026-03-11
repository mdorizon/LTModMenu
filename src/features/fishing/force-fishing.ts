import { wsSend } from "@core/game";
import { log } from "@core/logger";

let fishingCleanupInterval: ReturnType<typeof setInterval> | null = null;

export function cleanupFishingRod(): void {
  const app = window.__gameApp;
  if (app?.localPlayer?.character?.removeFishingRod) {
    app.localPlayer.character.removeFishingRod();
  }
  if (fishingCleanupInterval) {
    clearInterval(fishingCleanupInterval);
    fishingCleanupInterval = null;
  }
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

export function renderForceFishing(): string {
  return '<button class="lt-action lt-primary" id="lt-fish-here">Force Fishing</button>';
}

export function bindForceFishing(): void {
  document.getElementById("lt-fish-here")!.onclick = () => {
    log("ACTION", "FISH HERE button clicked");
    const app = window.__gameApp;
    if (!app?.localPlayer) return;

    const lp = app.localPlayer;
    const dir = lp.direction || "down";
    lp.sit("portable-" + dir);
    setTimeout(() => {
      if (lp.setSitAnimation) lp.setSitAnimation("fishing");
      wsSend("updateSitAnimation", "fishing");

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
      watchForUnsit();

      const status = document.getElementById("lt-fish-status");
      if (status) {
        status.textContent = "Fishing forced";
        status.style.color = "#5a9af0";
      }
    }, 500);
  };
}
