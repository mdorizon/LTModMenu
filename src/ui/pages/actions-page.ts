import { mkHeader, bindNav, type RenderFn } from "../components";
import {
  renderForceFishing,
  bindForceFishing,
  cleanupFishingRod,
} from "../actions/force-fishing";

export function renderActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  hud.innerHTML =
    mkHeader("Actions", true) +
    '<div class="lt-body">' +
    '<button class="lt-action lt-primary" id="lt-sit-toggle">Sit Down</button>' +
    renderForceFishing() +
    "</div>" +
    '<div class="lt-status" id="lt-act-status"></div>' +
    '<div class="lt-warn">These actions are detectable by the server</div>';
  bindNav(renderMainFn, pages);

  let isSitting = false;
  const toggleBtn = document.getElementById("lt-sit-toggle")!;
  toggleBtn.onclick = () => {
    const app = window.__gameApp;
    if (!app || !app.localPlayer) {
      console.log("[LTModMenu] SIT TOGGLE failed: no gameApp/localPlayer");
      document.getElementById("lt-act-status")!.textContent =
        "Error: gameApp not captured";
      document.getElementById("lt-act-status")!.style.color = "#f05050";
      return;
    }
    const lp = app.localPlayer;
    if (!isSitting) {
      console.log("[LTModMenu] SIT button clicked");
      lp.sit("portable-" + (lp.direction || "down"));
      isSitting = true;
      toggleBtn.textContent = "Stand Up";
      toggleBtn.className = "lt-action lt-muted";
      document.getElementById("lt-act-status")!.textContent = "Sitting";
      document.getElementById("lt-act-status")!.style.color = "#5ad85a";
    } else {
      console.log("[LTModMenu] UNSIT button clicked");
      cleanupFishingRod();
      lp.unsit?.({ withCooldown: false, emitUnsit: true });
      isSitting = false;
      toggleBtn.textContent = "Sit Down";
      toggleBtn.className = "lt-action lt-primary";
      document.getElementById("lt-act-status")!.textContent = "Standing";
      document.getElementById("lt-act-status")!.style.color = "#6a6a9a";
    }
  };

  bindForceFishing();
}
