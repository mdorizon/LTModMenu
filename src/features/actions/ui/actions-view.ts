import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { toggleSit, isSitting } from "../sit";
import { toggleNoclip, isNoclip } from "../noclip";
import { getSpeedMultiplier, setSpeedMultiplier } from "../speed";
import { toggleFreeCam, isFreeCam } from "../free-camera";
import { toggleDebugGizmos, isDebugGizmos } from "../debug-gizmos";

export function renderActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const speed = getSpeedMultiplier();
  hud.innerHTML =
    mkHeader("Actions", true) +
    '<div class="lt-body">' +
    '<button class="lt-action ' + (isSitting() ? "lt-muted" : "lt-primary") + '" id="lt-sit-toggle">' +
    (isSitting() ? "Stand Up" : "Sit Down") +
    "</button>" +
    '<button class="lt-action ' + (isNoclip() ? "lt-danger" : "lt-primary") + '" id="lt-noclip-toggle">' +
    (isNoclip() ? "Noclip ON" : "Noclip OFF") +
    "</button>" +
    '<button class="lt-action ' + (isFreeCam() ? "lt-danger" : "lt-primary") + '" id="lt-freecam-toggle">' +
    (isFreeCam() ? "Free Camera ON" : "Free Camera OFF") +
    "</button>" +
    '<button class="lt-action ' + (isDebugGizmos() ? "lt-danger" : "lt-primary") + '" id="lt-gizmos-toggle">' +
    (isDebugGizmos() ? "Show Hitboxes ON" : "Show Hitboxes OFF") +
    "</button>" +
    '<div class="lt-speed-row">' +
    '<span class="lt-speed-label">Speed: x<span id="lt-speed-val">' + speed + '</span></span>' +
    '<input type="range" class="lt-slider" id="lt-speed-slider" min="1" max="10" step="1" value="' + speed + '" />' +
    "</div>" +
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

  document.getElementById("lt-noclip-toggle")!.onclick = () => {
    const result = toggleNoclip();
    const btn = document.getElementById("lt-noclip-toggle")!;
    const st = document.getElementById("lt-act-status")!;
    if (result.error) {
      st.textContent = result.error;
      st.style.color = "#f05050";
      return;
    }
    if (result.enabled) {
      btn.textContent = "Noclip ON";
      btn.className = "lt-action lt-danger";
      st.textContent = "Noclip enabled - walk through everything";
      st.style.color = "#be6a6a";
    } else {
      btn.textContent = "Noclip OFF";
      btn.className = "lt-action lt-primary";
      st.textContent = "Collisions restored";
      st.style.color = "#6a6a9a";
    }
  };

  document.getElementById("lt-freecam-toggle")!.onclick = () => {
    const result = toggleFreeCam();
    const btn = document.getElementById("lt-freecam-toggle")!;
    const st = document.getElementById("lt-act-status")!;
    if (result.error) {
      st.textContent = result.error;
      st.style.color = "#f05050";
      return;
    }
    if (result.enabled) {
      btn.textContent = "Free Camera ON";
      btn.className = "lt-action lt-danger";
      st.textContent = "Drag to explore - player stays in place";
      st.style.color = "#be6a6a";
    } else {
      btn.textContent = "Free Camera OFF";
      btn.className = "lt-action lt-primary";
      st.textContent = "Camera reattached to player";
      st.style.color = "#6a6a9a";
    }
  };

  document.getElementById("lt-gizmos-toggle")!.onclick = () => {
    const result = toggleDebugGizmos();
    const btn = document.getElementById("lt-gizmos-toggle")!;
    const st = document.getElementById("lt-act-status")!;
    if (result.error) {
      st.textContent = result.error;
      st.style.color = "#f05050";
      return;
    }
    if (result.enabled) {
      btn.textContent = "Show Hitboxes ON";
      btn.className = "lt-action lt-danger";
      st.textContent = "Hitboxes visible";
      st.style.color = "#be6a6a";
    } else {
      btn.textContent = "Show Hitboxes OFF";
      btn.className = "lt-action lt-primary";
      st.textContent = "Hitboxes hidden";
      st.style.color = "#6a6a9a";
    }
  };

  const slider = document.getElementById("lt-speed-slider") as HTMLInputElement;
  const valLabel = document.getElementById("lt-speed-val")!;
  slider.oninput = () => {
    const val = Number(slider.value);
    valLabel.textContent = String(val);
    const result = setSpeedMultiplier(val);
    const st = document.getElementById("lt-act-status")!;
    if (result.error) {
      st.textContent = result.error;
      st.style.color = "#f05050";
    } else {
      st.textContent = "Speed x" + result.multiplier;
      st.style.color = result.multiplier > 1 ? "#be6a6a" : "#6a6a9a";
    }
  };
}
