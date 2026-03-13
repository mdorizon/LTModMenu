import { log } from "@core/logger";
import { doTP } from "@features/teleport/teleport";
import { setStatus, clearStatus } from "@ui/status-bar";

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
    setStatus("noclip", { label: "NOCLIP", color: "#f07070", bg: "#3a1a1a" });
    log("NOCLIP", "Enabled");
  } else {
    const x = Math.round(lp.currentPos.x);
    const y = Math.round(lp.currentPos.y);
    const dir = lp.direction || "down";
    if (origHandleCollisions) lp.handleCollisions = origHandleCollisions;
    doTP(x, y, dir);
    enabled = false;
    clearStatus("noclip");
    log("NOCLIP", "Disabled, anchored at " + x + "," + y);
  }

  return { enabled };
}
