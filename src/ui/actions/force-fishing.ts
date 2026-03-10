import { wsSend } from "../../game/player-actions";

let fishingCleanupInterval: ReturnType<typeof setInterval> | null = null;

function cleanupFishingRod(): void {
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
    console.log("[LTModMenu] FISH HERE button clicked");
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
      const dir = lp.direction || "down";
      lp.sit("portable-" + dir);
      setTimeout(() => {
        if (lp.setSitAnimation) lp.setSitAnimation("fishing");
        wsSend("updateSitAnimation", "fishing");

        // Client-side: show fishing animation + rod sprite
        const animDir = dir === "right" || dir === "left" ? "side" : dir;
        console.log("[LTModMenu] Force fishing: dir=" + dir + " animDir=" + animDir);

        try {
          console.log("[LTModMenu] Calling changeAnimationState('fishing_" + animDir + "')");
          lp.changeAnimationState("fishing_" + animDir);
          console.log("[LTModMenu] changeAnimationState OK");
        } catch (e) {
          console.warn("[LTModMenu] changeAnimationState failed:", e);
        }

        if (lp.character) {
          try {
            console.log("[LTModMenu] character: removeFishingRod=" + !!lp.character.removeFishingRod + " takeOutFishingRod=" + !!lp.character.takeOutFishingRod);
            if (lp.character.removeFishingRod) lp.character.removeFishingRod();
            if (lp.character.takeOutFishingRod) lp.character.takeOutFishingRod(dir);
            console.log("[LTModMenu] Fishing rod sprite OK");
          } catch (e) {
            console.warn("[LTModMenu] Failed to show fishing rod sprite:", e);
          }
        } else {
          console.warn("[LTModMenu] lp.character is null/undefined!");
        }
        watchForUnsit();

        document.getElementById("lt-act-status")!.textContent =
          "Fishing forced";
        document.getElementById("lt-act-status")!.style.color = "#5a9af0";
      }, 500);
    }
  };
}

/** Clean up fishing rod sprite (call before unsit) */
export { cleanupFishingRod };
