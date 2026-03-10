import { solveFishingChallenge } from "./challenge-solver";
import type { PlayerPos } from "../types/player";

export function wsSend(ev: string, data: unknown): boolean {
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    window.__gameWS.send("42" + JSON.stringify([ev, data]));
    console.log("[LTModMenu] wsSend:", ev);
    return true;
  }
  console.log("[LTModMenu] wsSend FAILED:", ev, "- WS not ready");
  return false;
}

export function gameClick(x: number, y: number): void {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.log("[LTModMenu] gameClick: no canvas found");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
    button: 0,
  };
  canvas.dispatchEvent(new MouseEvent("mousedown", opts));
  canvas.dispatchEvent(new MouseEvent("mouseup", opts));
  canvas.dispatchEvent(new MouseEvent("click", opts));
  console.log("[LTModMenu] gameClick at:", x, y);
}

export function doTP(x: number, y: number, dir: string): boolean {
  console.log("[LTModMenu] doTP called:", x, y, dir);
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
    console.log("[LTModMenu] localPlayer found, current pos:", lp.currentPos.x, lp.currentPos.y);
    lp.currentPos.x = x;
    lp.currentPos.y = y;
    lp.parent.x = x;
    lp.parent.y = y;
    if (lp.serverPos) {
      lp.serverPos.x = x;
      lp.serverPos.y = y;
    }
    if (lp.oldPos) {
      lp.oldPos.x = x;
      lp.oldPos.y = y;
    }
    if (dir) lp.direction = dir;
    wsSend("clientUpdatePosition", { x, y, direction: dir || "down" });
    try {
      app.currentCamera.moveCameraToPlayer(true);
      console.log("[LTModMenu] Camera moved");
    } catch (e) {
      console.log("[LTModMenu] Camera move failed:", (e as Error).message);
    }
    console.log("[LTModMenu] TP done to:", x, y);
    return true;
  }
  console.log("[LTModMenu] doTP FAILED: no gameApp or localPlayer");
  return false;
}

export function getPos(): PlayerPos | null {
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
    return {
      x: Math.round(lp.currentPos.x),
      y: Math.round(lp.currentPos.y),
      direction: lp.direction || "down",
    };
  }
  return window.__playerPos || null;
}

export function autoSolveChallenge(challenge: string): boolean {
  console.log("[LTModMenu] autoSolveChallenge called");
  const response = solveFishingChallenge(challenge);
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    const msg = "42" + JSON.stringify(["getFishingResult", { result: "success", response }]);
    console.log("[LTModMenu] Sending auto-solve via WS:", msg.substring(0, 100));
    window.__gameWS.send(msg);
    return true;
  }
  console.log(
    "[LTModMenu] autoSolve FAILED: WS not ready, readyState:",
    window.__gameWS ? window.__gameWS.readyState : "no WS",
  );
  return false;
}

export function forceEndMinigame(): boolean {
  console.log("[LTModMenu] forceEndMinigame called");
  try {
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
      if (lp.fishingMinigame) {
        console.log("[LTModMenu] Found fishingMinigame, destroying...");
        if (lp.fishingMinigame.destroy) lp.fishingMinigame.destroy();
        lp.fishingMinigame = null;
        return true;
      }
      if (lp.minigame) {
        console.log("[LTModMenu] Found minigame, destroying...");
        if (lp.minigame.destroy) lp.minigame.destroy();
        lp.minigame = null;
        return true;
      }
      console.log("[LTModMenu] No minigame found on localPlayer");
    } else {
      console.log("[LTModMenu] No gameApp or localPlayer");
    }
  } catch (e) {
    console.log("[LTModMenu] forceEndMinigame error:", (e as Error).message);
  }
  return false;
}

export function setupPlayerActions(): void {
  window.__autoSolveChallenge = autoSolveChallenge;
  window.__forceEndMinigame = forceEndMinigame;
}
