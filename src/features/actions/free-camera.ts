import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";

let enabled = false;

export function isFreeCam(): boolean {
  return enabled;
}

export function toggleFreeCam(): { enabled: boolean; error?: string } {
  const globals = window.__gameGlobals;
  if (!globals) return { enabled: false, error: "GameGlobals not captured" };

  if (!enabled) {
    globals.manualCameraControl = true;
    globals.dragCameraMode = true;
    enabled = true;
    setStatus("freecam", { label: "FREE CAM", color: "#b080e0", bg: "#2a1a3a" });
    log("CAMERA", "Free camera enabled");
  } else {
    globals.manualCameraControl = false;
    globals.dragCameraMode = false;
    const cam = window.__gameApp?.currentCamera;
    if (cam?.moveCameraToPlayer) cam.moveCameraToPlayer(true);
    enabled = false;
    clearStatus("freecam");
    log("CAMERA", "Free camera disabled");
  }

  return { enabled };
}
