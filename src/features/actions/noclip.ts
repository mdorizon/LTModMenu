import { log } from "@core/logger";
import { doTP } from "@features/teleport/teleport";

let enabled = false;
let origHandleCollisions: ((delta: { x: number; y: number }) => { x: number; y: number }) | null = null;

export function isNoclip(): boolean {
  return enabled;
}

export function toggleNoclip(): { enabled: boolean; error?: string } {
  const lp = window.__gameApp?.localPlayer as any;
  if (!lp) return { enabled: false, error: "gameApp not captured" };

  if (!enabled) {
    if (!origHandleCollisions) {
      origHandleCollisions = lp.handleCollisions;
    }
    lp.handleCollisions = (delta: { x: number; y: number }) => delta;
    enabled = true;
    log("NOCLIP", "Enabled");
  } else {
    const x = Math.round(lp.currentPos.x);
    const y = Math.round(lp.currentPos.y);
    const dir = lp.direction || "down";
    if (origHandleCollisions) lp.handleCollisions = origHandleCollisions;
    doTP(x, y, dir);
    enabled = false;
    log("NOCLIP", "Disabled, anchored at " + x + "," + y);
  }

  return { enabled };
}
