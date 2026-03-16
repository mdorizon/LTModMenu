// Blocks the game's Play button until the mod is fully initialized
// (webpack spy has captured gameApp). Identifies the button by DOM structure
// (sibling of img[alt="lofi.town"]) rather than text content, so it works
// even with browser translators that rewrite visible text.

import { log } from "@core/logger";

let locked = false;
let observer: MutationObserver | null = null;
let playButton: HTMLElement | null = null;

const LOCK_STYLE = "pointer-events: none !important; opacity: 0.4 !important; cursor: not-allowed !important;";

function isPlayButton(el: HTMLElement): boolean {
  if (el.tagName !== "DIV" || !el.classList.contains("cursor-pointer")) return false;
  // The Play button is a sibling of img[alt="lofi.town"] — stable across translations
  const sibling = el.previousElementSibling;
  return sibling?.tagName === "IMG" && sibling.getAttribute("alt") === "lofi.town";
}

function lockElement(el: HTMLElement): void {
  playButton = el;
  el.setAttribute("style", (el.getAttribute("style") || "") + LOCK_STYLE);
  el.setAttribute("data-lt-locked", "1");
  el.title = "Waiting for mod initialization...";
  log("PLAY-GATE", "Play button locked");
}

function scanAndLock(root: Node): void {
  if (!locked) return;
  const divs = (root as Element).querySelectorAll?.("div.cursor-pointer");
  if (!divs) return;
  for (const div of divs) {
    if (isPlayButton(div as HTMLElement) && !div.hasAttribute("data-lt-locked")) {
      lockElement(div as HTMLElement);
    }
  }
}

export function lockPlayButton(): void {
  if (locked) return;
  locked = true;
  log("PLAY-GATE", "Locking Play button (waiting for gameApp)");

  // Scan existing DOM
  scanAndLock(document);

  // Watch for the button to appear (React renders it async)
  observer = new MutationObserver((mutations) => {
    if (!locked) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as HTMLElement;
        if (isPlayButton(el)) {
          lockElement(el);
        } else {
          scanAndLock(el);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function unlockPlayButton(): void {
  if (!locked) return;
  locked = false;

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (playButton) {
    playButton.removeAttribute("data-lt-locked");
    playButton.title = "";
    // Remove only our injected styles, preserve any existing inline style
    const style = playButton.getAttribute("style") || "";
    playButton.setAttribute(
      "style",
      style
        .replace(/pointer-events:\s*none\s*!important;?/g, "")
        .replace(/opacity:\s*0\.4\s*!important;?/g, "")
        .replace(/cursor:\s*not-allowed\s*!important;?/g, "")
        .trim(),
    );
    log("PLAY-GATE", "Play button unlocked");
  } else {
    log("PLAY-GATE", "Unlocked (button was never found in DOM)");
  }

  playButton = null;
}
