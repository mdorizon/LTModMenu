import { mkHeader, bindNav, type RenderFn } from "../components";
import { wsSend } from "../../game/player-actions";

export function renderActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  hud.innerHTML =
    mkHeader("Actions", true) +
    '<div class="lt-body">' +
    '<button class="lt-action lt-primary" id="lt-sit-toggle">Sit Down</button>' +
    '<button class="lt-action lt-primary" id="lt-fish-here">Force Fishing</button>' +
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
      lp.unsit?.({ withCooldown: false, emitUnsit: true });
      isSitting = false;
      toggleBtn.textContent = "Sit Down";
      toggleBtn.className = "lt-action lt-primary";
      document.getElementById("lt-act-status")!.textContent = "Standing";
      document.getElementById("lt-act-status")!.style.color = "#6a6a9a";
    }
  };

  document.getElementById("lt-fish-here")!.onclick = () => {
    console.log("[LTModMenu] FISH HERE button clicked");
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
      lp.sit("portable-" + (lp.direction || "down"));
      setTimeout(() => {
        if (lp.setSitAnimation) lp.setSitAnimation("fishing");
        wsSend("updateSitAnimation", "fishing");
        document.getElementById("lt-act-status")!.textContent =
          "Fishing forced";
        document.getElementById("lt-act-status")!.style.color = "#5a9af0";
      }, 500);
    }
  };

}
