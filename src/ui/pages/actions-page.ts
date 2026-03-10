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
    '<button class="lt-action lt-primary" id="lt-sit">Sit Down</button>' +
    renderForceFishing() +
    '<button class="lt-action lt-muted" id="lt-unsit">Stand Up</button>' +
    "</div>" +
    '<div class="lt-status" id="lt-act-status"></div>' +
    '<div class="lt-warn">These actions are detectable by the server</div>';
  bindNav(renderMainFn, pages);

  document.getElementById("lt-sit")!.onclick = () => {
    console.log("[LTModMenu] SIT button clicked");
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
      console.log(
        '[LTModMenu] Calling sit("portable-' + (lp.direction || "down") + '")',
      );
      lp.sit("portable-" + (lp.direction || "down"));
      document.getElementById("lt-act-status")!.textContent = "Sitting";
      document.getElementById("lt-act-status")!.style.color = "#5ad85a";
    } else {
      console.log("[LTModMenu] SIT failed: no gameApp/localPlayer");
      document.getElementById("lt-act-status")!.textContent =
        "Error: gameApp not captured";
      document.getElementById("lt-act-status")!.style.color = "#f05050";
    }
  };

  bindForceFishing();

  document.getElementById("lt-unsit")!.onclick = () => {
    console.log("[LTModMenu] UNSIT button clicked");
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      cleanupFishingRod();
      app.localPlayer.unsit?.({ withCooldown: false, emitUnsit: true });
      document.getElementById("lt-act-status")!.textContent = "Standing";
      document.getElementById("lt-act-status")!.style.color = "#6a6a9a";
    }
  };
}
