import { log } from "../../core/logger";

export function solveFishingChallenge(e: string): string {
  log("CHALLENGE", "Solving challenge, length: " + e.length);

  const a = [114, 51, 97, 108, 109, 115];
  let t = 0x811c9dc5;
  const i: number[] = [];

  for (let o = 0; o < e.length; o++) {
    t ^= e.charCodeAt(o) ^ a[o % a.length];
    t = Math.imul(t, 0x1000193);
    i.push((t >>> 0) & 255);
  }

  const result = i.map((e) => e.toString(16).padStart(2, "0")).join("");
  log("CHALLENGE", "Challenge solved, response length: " + result.length);
  return result;
}

export function autoSolveChallenge(challenge: string): boolean {
  log("ACTION", "autoSolveChallenge called");
  const response = solveFishingChallenge(challenge);
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    const msg = "42" + JSON.stringify(["getFishingResult", { result: "success", response }]);
    log("ACTION", "Sending auto-solve via WS");
    window.__gameWS.send(msg);
    return true;
  }
  log("ACTION", "autoSolve FAILED: WS not ready");
  return false;
}

export function forceEndMinigame(): boolean {
  log("ACTION", "forceEndMinigame called");
  try {
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
      if (lp.fishingMinigame) {
        log("ACTION", "Found fishingMinigame, destroying...");
        if (lp.fishingMinigame.destroy) lp.fishingMinigame.destroy();
        lp.fishingMinigame = null;
        return true;
      }
      if (lp.minigame) {
        log("ACTION", "Found minigame, destroying...");
        if (lp.minigame.destroy) lp.minigame.destroy();
        lp.minigame = null;
        return true;
      }
      log("ACTION", "No minigame found on localPlayer");
    } else {
      log("ACTION", "No gameApp or localPlayer");
    }
  } catch (e) {
    log("ACTION", "forceEndMinigame error: " + (e as Error).message);
  }
  return false;
}

export function setupFishingGlobals(): void {
  window.__solveFishingChallenge = solveFishingChallenge;
  window.__autoSolveChallenge = autoSolveChallenge;
  window.__forceEndMinigame = forceEndMinigame;
}
