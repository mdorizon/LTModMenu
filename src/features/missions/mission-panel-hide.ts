import { saveData, loadData } from "@core/storage";

let hiddenStyleEl: HTMLStyleElement | null = null;
let hidden = false;

function applyStyle(): void {
  if (!hiddenStyleEl) {
    hiddenStyleEl = document.createElement("style");
    document.head.appendChild(hiddenStyleEl);
  }
  hiddenStyleEl.textContent = hidden
    ? "#mission-log, #missions-button { display: none !important; }"
    : "";
}

export function isMissionPanelHidden(): boolean {
  return hidden;
}

export function toggleMissionPanelHide(): void {
  hidden = !hidden;
  saveData("missionHidePanel", hidden);
  applyStyle();
}

export function restoreMissionPanelHide(): void {
  hidden = loadData("missionHidePanel", false);
  if (hidden) applyStyle();
}
