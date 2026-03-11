import type { PlayerPos } from "./types/player";
import { log } from "./logger";

export function wsSend(ev: string, data: unknown): boolean {
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    window.__gameWS.send("42" + JSON.stringify([ev, data]));
    log("ACTION", "wsSend: " + ev);
    return true;
  }
  log("ACTION", "wsSend FAILED: " + ev + " - WS not ready");
  return false;
}

export function gameClick(x: number, y: number): void {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    log("ACTION", "gameClick: no canvas found");
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
  log("ACTION", "gameClick at: " + x + ", " + y);
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

export function getCurrentMap(): string {
  const app = window.__gameApp;
  if (app && app.currentScene && app.currentScene.name) {
    return app.currentScene.name;
  }
  return "unknown";
}
