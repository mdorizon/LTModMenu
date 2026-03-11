import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { toggleSit, isSitting } from "./sit";

export function renderActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  hud.innerHTML =
    mkHeader("Actions", true) +
    '<div class="lt-body">' +
    '<button class="lt-action ' + (isSitting() ? "lt-muted" : "lt-primary") + '" id="lt-sit-toggle">' +
    (isSitting() ? "Stand Up" : "Sit Down") +
    "</button>" +
    "</div>" +
    '<div class="lt-status" id="lt-act-status"></div>' +
    '<div class="lt-warn">These actions are detectable by the server</div>';
  bindNav(renderMainFn, pages);

  document.getElementById("lt-sit-toggle")!.onclick = () => {
    const result = toggleSit();
    const toggleBtn = document.getElementById("lt-sit-toggle")!;
    const st = document.getElementById("lt-act-status")!;
    if (result.error) {
      st.textContent = result.error;
      st.style.color = "#f05050";
      return;
    }
    if (result.sitting) {
      toggleBtn.textContent = "Stand Up";
      toggleBtn.className = "lt-action lt-muted";
      st.textContent = "Sitting";
      st.style.color = "#5ad85a";
    } else {
      toggleBtn.textContent = "Sit Down";
      toggleBtn.className = "lt-action lt-primary";
      st.textContent = "Standing";
      st.style.color = "#6a6a9a";
    }
  };
}
