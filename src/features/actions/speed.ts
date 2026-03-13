import { log } from "@core/logger";
import { saveData, loadData } from "@core/storage";
import { setStatus, clearStatus } from "@ui/status-bar";

let origSpeed: number | null = null;
let multiplier: number = loadData<number>("speedMultiplier", 1);
let lastPlayerRef: any = null;
let watcherId: ReturnType<typeof setInterval> | null = null;

export function getSpeedMultiplier(): number {
  return multiplier;
}

function applySpeed(): void {
  const lp = window.__gameApp?.localPlayer as any;
  if (!lp) return;

  if (lp !== lastPlayerRef) {
    origSpeed = null;
    lastPlayerRef = lp;
  }

  if (origSpeed === null) {
    origSpeed = lp.speed;
  }

  lp.speed = origSpeed! * multiplier;
}

export function setSpeedMultiplier(value: number): { multiplier: number; error?: string } {
  const lp = window.__gameApp?.localPlayer as any;
  if (!lp) return { multiplier: 1, error: "gameApp not captured" };

  multiplier = value;
  saveData("speedMultiplier", multiplier);
  applySpeed();
  if (multiplier > 1) {
    setStatus("speed", { label: "SPEED x" + multiplier, color: "#50c8c8", bg: "#102a2a" });
  } else {
    clearStatus("speed");
  }
  log("SPEED", "x" + multiplier + " (speed=" + lp.speed + ")");
  return { multiplier };
}

export function initSpeedWatcher(): void {
  if (watcherId !== null) return;
  if (multiplier > 1) {
    setStatus("speed", { label: "SPEED x" + multiplier, color: "#50c8c8", bg: "#102a2a" });
  }
  watcherId = setInterval(() => {
    if (multiplier <= 1) return;
    const lp = window.__gameApp?.localPlayer as any;
    if (!lp) return;

    if (lp !== lastPlayerRef || lp.speed !== (origSpeed ?? lp.speed) * multiplier) {
      applySpeed();
      log("SPEED", "Re-applied x" + multiplier + " after map change");
    }
  }, 2000);
}
