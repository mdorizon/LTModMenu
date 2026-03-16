import { saveData, loadData } from "@core/storage";

const GAME_FOCUS_SELECTOR = 'div[aria-roledescription="draggable"][style*="z-index: 110"]';

let hiddenStyleEl: HTMLStyleElement | null = null;
let hidden = false;

function applyStyle(): void {
  if (!hiddenStyleEl) {
    hiddenStyleEl = document.createElement("style");
    document.head.appendChild(hiddenStyleEl);
  }
  hiddenStyleEl.textContent = hidden
    ? GAME_FOCUS_SELECTOR + " { display: none !important; }"
    : "";
}

export function isGameTimerHidden(): boolean {
  return hidden;
}

export function toggleGameTimerHide(): void {
  hidden = !hidden;
  saveData("focusHideGameTimer", hidden);
  applyStyle();
}

export function restoreGameTimerHide(): void {
  hidden = loadData("focusHideGameTimer", false);
  if (hidden) applyStyle();
}
