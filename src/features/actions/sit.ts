import { cleanupFishingRod } from "@features/fishing/force-fishing";
import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";

let sitting = false;

export function isSitting(): boolean {
  return sitting;
}

export function toggleSit(): { sitting: boolean; error?: string } {
  const app = window.__gameApp;
  if (!app || !app.localPlayer) {
    log("ACTION", "SIT TOGGLE failed: no gameApp/localPlayer");
    return { sitting, error: "Error: gameApp not captured" };
  }
  const lp = app.localPlayer;
  if (!sitting) {
    log("ACTION", "SIT");
    lp.sit("portable-" + (lp.direction || "down"));
    sitting = true;
    setStatus("sit", { label: "SIT", color: "#9ac4ff", bg: "#1a2a40" });
  } else {
    log("ACTION", "UNSIT");
    cleanupFishingRod();
    lp.unsit?.({ withCooldown: false, emitUnsit: true });
    sitting = false;
    clearStatus("sit");
  }
  return { sitting };
}
