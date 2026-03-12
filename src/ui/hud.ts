import { CSS } from "./styles";
import type { RenderFn } from "./components";
import { renderMain } from "./main-view";
import { renderPOI } from "@features/teleport/ui/poi-view";
import { renderWaypoints } from "@features/teleport/ui/waypoints-view";
import { renderActions } from "@features/actions/ui/actions-view";
import { renderFishing } from "@features/fishing/ui/fishing-view";
import { renderPlayers } from "@features/players/ui/players-view";
import { startAutoSave } from "@core/storage";
import { initSceneCache } from "@features/teleport/teleport";
import { initThemeSync } from "./theme";
import { log } from "@core/logger";

export function initHUD(): void {
  log("HUD", "initHUD() called");
  log("HUD", "document.body exists: " + !!document.body);
  log("HUD", "Existing HUD: " + !!document.getElementById("lt-hud"));

  if (document.getElementById("lt-hud")) {
    log("HUD", "HUD already exists, skipping");
    return;
  }

  if (!document.body) {
    log("HUD", "No document.body yet, retrying in 500ms...");
    setTimeout(initHUD, 500);
    return;
  }

  // ── Inject CSS ──
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Create HUD element ──
  const hud = document.createElement("div");
  hud.id = "lt-hud";
  document.body.appendChild(hud);
  log("HUD", "HUD div created and appended to body");

  // ── Page rendering ──
  const renderMainFn: RenderFn = () => renderMain(hud, pages);

  const pages: Record<string, RenderFn> = {
    poi: () => renderPOI(hud, renderMainFn, pages),
    tp: () => renderWaypoints(hud, renderMainFn, pages),
    actions: () => renderActions(hud, renderMainFn, pages),
    fish: () => renderFishing(hud, renderMainFn, pages),
    players: () => renderPlayers(hud, renderMainFn, pages),
  };

  // ── Drag ──
  let dragging = false;
  let dx = 0;
  let dy = 0;

  hud.addEventListener("mousedown", (e) => {
    if (
      (e.target as HTMLElement).id === "lt-header" ||
      ((e.target as HTMLElement).parentElement &&
        (e.target as HTMLElement).parentElement!.id === "lt-header")
    ) {
      dragging = true;
      const rect = hud.getBoundingClientRect();
      hud.style.top = rect.top + "px";
      hud.style.transform = "none";
      dx = e.clientX - rect.left;
      dy = e.clientY - rect.top;
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    hud.style.left = e.clientX - dx + "px";
    hud.style.top = e.clientY - dy + "px";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });

  // ── Session timer ──
  const startTime = Date.now();
  setInterval(() => {
    const el = document.getElementById("lt-time");
    if (!el) return;
    const s = Math.floor((Date.now() - startTime) / 1000);
    el.textContent =
      String(Math.floor(s / 3600)).padStart(2, "0") +
      ":" +
      String(Math.floor((s % 3600) / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0");
  }, 1000);

  // ── Retry gameApp capture ──
  let retryCount = 0;
  const retryInterval = setInterval(() => {
    retryCount++;
    if (window.__gameApp) {
      log("HUD", "gameApp ready! (after " + retryCount + " checks)");
      setTimeout(() => initSceneCache(), 5000);
      clearInterval(retryInterval);
      return;
    }

    // Direct polling fallback: try to grab App._instance via wpRequire
    if (window.__wpRequire) {
      try {
        const appModule = window.__wpRequire(20493);
        if (appModule?.App?._instance?.localPlayer !== undefined) {
          window.__gameApp = appModule.App._instance;
          log("HUD", "gameApp captured via direct polling (retry #" + retryCount + ")");
          setTimeout(() => initSceneCache(), 5000);
          clearInterval(retryInterval);
          return;
        }
      } catch (_e) {
        // Module not ready yet
      }
    }

    if (window.__ltSpyRetry) {
      const ok = window.__ltSpyRetry();
      log("HUD", "Spy retry #" + retryCount + ": " + (ok ? "SUCCESS" : "waiting..."));
      if (ok) {
        setTimeout(() => initSceneCache(), 5000);
        clearInterval(retryInterval);
      }
    } else {
      if (retryCount % 5 === 0) {
        log("HUD", "Waiting for spy retry function... (check #" + retryCount + ")");
      }
    }
  }, 1000);

  // ── Keyboard shortcuts ──
  let kbIndex = -1;

  function getNavigableItems(): HTMLElement[] {
    return Array.from(hud.querySelectorAll<HTMLElement>(".lt-item, .lt-action"));
  }

  function clearKbFocus(): void {
    hud.querySelectorAll(".lt-kb-focus").forEach((el) => el.classList.remove("lt-kb-focus"));
  }

  function setKbFocus(index: number): void {
    const items = getNavigableItems();
    if (items.length === 0) return;
    clearKbFocus();
    kbIndex = ((index % items.length) + items.length) % items.length;
    items[kbIndex].classList.add("lt-kb-focus");
    items[kbIndex].scrollIntoView({ block: "nearest" });
  }

  let restoreIndex = -1;
  const observer2 = new MutationObserver(() => {
    if (restoreIndex >= 0) {
      const idx = restoreIndex;
      restoreIndex = -1;
      setKbFocus(idx);
    } else {
      kbIndex = -1;
    }
  });
  observer2.observe(hud, { childList: true, subtree: true });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

    if (e.key === "1") {
      const isHidden = hud.style.display === "none";
      hud.style.display = isHidden ? "" : "none";
      if (!isHidden) {
        kbIndex = -1;
        clearKbFocus();
      }
      return;
    }

    if (hud.style.display === "none") return;

    switch (e.key) {
      case "2":
        setKbFocus(kbIndex <= 0 ? getNavigableItems().length - 1 : kbIndex - 1);
        break;
      case "3":
        setKbFocus(kbIndex + 1);
        break;
      case "4": {
        const items = getNavigableItems();
        if (kbIndex >= 0 && kbIndex < items.length) {
          items[kbIndex].click();
        }
        break;
      }
      case "5": {
        const back = document.getElementById("lt-back");
        if (back) {
          restoreIndex = kbIndex;
          back.click();
        }
        break;
      }
    }
  });

  // ── Theme sync ──
  initThemeSync();

  // ── Render main page ──
  renderMainFn();
  log("HUD", "========================================");
  log("HUD", "HUD INJECTED AND RENDERED SUCCESSFULLY!");
  log("HUD", "========================================");

  // ── Start auto-save ──
  startAutoSave();
}

export function tryInit(): void {
  log("HUD", "tryInit(), body: " + !!document.body + " readyState: " + document.readyState);
  if (document.body) {
    log("HUD", "Body found, waiting 3s for game to load...");
    setTimeout(() => {
      log("HUD", "3s elapsed, initializing HUD...");
      initHUD();
    }, 3000);
  } else {
    log("HUD", "No body yet, observing DOM...");
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.body) {
        log("HUD", "Body appeared via MutationObserver");
        obs.disconnect();
        setTimeout(() => {
          log("HUD", "Delayed init after body appeared...");
          initHUD();
        }, 3000);
      }
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }
}
