import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { notify } from "@ui/status-bar";
import { toggleSit, isSitting } from "../sit";
import { toggleNoclip, isNoclip } from "../noclip";
import { getSpeedMultiplier, setSpeedMultiplier } from "../speed";
import { toggleFreeCam, isFreeCam } from "../free-camera";
import { toggleHitboxes, isHitboxes } from "../hitboxes";

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
    (isNoclip() ? "Disable Noclip" : "Enable Noclip") +
    "</button>" +
    '<button class="lt-action ' + (isFreeCam() ? "lt-danger" : "lt-primary") + '" id="lt-freecam-toggle">' +
    (isFreeCam() ? "Disable Free Camera" : "Enable Free Camera") +
    "</button>" +
    '<button class="lt-action ' + (isHitboxes() ? "lt-danger" : "lt-primary") + '" id="lt-hitboxes-toggle">' +
    (isHitboxes() ? "Hide Hitboxes" : "Show Hitboxes") +
    "</button>" +
    '<div class="lt-speed-row">' +
    '<span class="lt-speed-label">Speed: x<span id="lt-speed-val">' + speed + '</span></span>' +
    '<input type="range" class="lt-slider" id="lt-speed-slider" min="1" max="10" step="1" value="' + speed + '" />' +
    "</div>" +
    "</div>" +
    '<div class="lt-warn">These actions are detectable by the server</div>';
  bindNav(renderMainFn, pages);

  const showError = (msg: string) => notify(msg, "error");

  document.getElementById("lt-sit-toggle")!.onclick = () => {
    const result = toggleSit();
    if (result.error) return showError(result.error);
    const btn = document.getElementById("lt-sit-toggle")!;
    btn.textContent = result.sitting ? "Stand Up" : "Sit Down";
    btn.className = "lt-action " + (result.sitting ? "lt-muted" : "lt-primary");
  };

  document.getElementById("lt-noclip-toggle")!.onclick = () => {
    const result = toggleNoclip();
    if (result.error) return showError(result.error);
    const btn = document.getElementById("lt-noclip-toggle")!;
    btn.textContent = result.enabled ? "Disable Noclip" : "Enable Noclip";
    btn.className = "lt-action " + (result.enabled ? "lt-danger" : "lt-primary");
  };

  document.getElementById("lt-freecam-toggle")!.onclick = () => {
    const result = toggleFreeCam();
    if (result.error) return showError(result.error);
    const btn = document.getElementById("lt-freecam-toggle")!;
    btn.textContent = result.enabled ? "Disable Free Camera" : "Enable Free Camera";
    btn.className = "lt-action " + (result.enabled ? "lt-danger" : "lt-primary");
  };

  document.getElementById("lt-hitboxes-toggle")!.onclick = () => {
    const result = toggleHitboxes();
    if (result.error) return showError(result.error);
    const btn = document.getElementById("lt-hitboxes-toggle")!;
    btn.textContent = result.enabled ? "Hide Hitboxes" : "Show Hitboxes";
    btn.className = "lt-action " + (result.enabled ? "lt-danger" : "lt-primary");
  };

  const slider = document.getElementById("lt-speed-slider") as HTMLInputElement;
  const valLabel = document.getElementById("lt-speed-val")!;
  slider.oninput = () => {
    const val = Number(slider.value);
    valLabel.textContent = String(val);
    const result = setSpeedMultiplier(val);
    if (result.error) showError(result.error);
  };

}
