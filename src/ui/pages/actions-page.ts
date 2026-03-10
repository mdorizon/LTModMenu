import { mkHeader, bindNav, type RenderFn } from "../components";
import { wsSend } from "../../game/player-actions";

export function renderActions(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  hud.innerHTML =
    mkHeader("Player Actions", true) +
    '<div class="lt-body">' +
    '<button class="lt-action lt-primary" id="lt-sit">Sit Down</button>' +
    '<button class="lt-action lt-primary" id="lt-fish-here">Force Fishing</button>' +
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
      console.log('[LTModMenu] Calling sit("portable-' + (lp.direction || "down") + '")');
      lp.sit("portable-" + (lp.direction || "down"));
      document.getElementById("lt-act-status")!.textContent = "Sitting";
      document.getElementById("lt-act-status")!.style.color = "#5ad85a";
    } else {
      console.log("[LTModMenu] SIT failed: no gameApp/localPlayer");
      document.getElementById("lt-act-status")!.textContent = "Error: gameApp not captured";
      document.getElementById("lt-act-status")!.style.color = "#f05050";
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
        document.getElementById("lt-act-status")!.textContent = "Fishing forced";
        document.getElementById("lt-act-status")!.style.color = "#5a9af0";
      }, 500);
    }
  };

  document.getElementById("lt-unsit")!.onclick = () => {
    console.log("[LTModMenu] UNSIT button clicked");
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      app.localPlayer.unsit?.({ withCooldown: false, emitUnsit: true });
      document.getElementById("lt-act-status")!.textContent = "Standing";
      document.getElementById("lt-act-status")!.style.color = "#6a6a9a";
    }
  };
}
