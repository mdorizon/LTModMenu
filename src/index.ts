// ══════════════════════════════════════════════
//  LTModMenu - Entry Point
//  Import order matters: webpack spy and WS hook
//  must be installed before the game loads.
// ══════════════════════════════════════════════

// Silence console output from the game's scripts (auto-detected via stack trace)
import "@core/console-filter";

import { log } from "@core/logger";

// 0. Lock Play button until mod is ready (must be before game renders)
import { lockPlayButton } from "@ui/play-gate";
lockPlayButton();

log("INIT", ">>> Script executing in PAGE context <<<");
log("INIT", "document.readyState: " + document.readyState);
log("INIT", "window.WebSocket exists: " + typeof window.WebSocket);
log("INIT", "window.location: " + window.location.href);

// 1. Initialize global state (load persisted data)
import { initGlobalState } from "@core/storage";
initGlobalState();

// 2. Load fish database
import "@features/fishing/data/fish-database";

// 3. Setup fishing globals on window (challenge solver, auto-solve, force end)
import { setupFishingGlobals } from "@features/fishing/challenge-solver";
setupFishingGlobals();

// 4. Start speed watcher (persisted multiplier, re-applies after map change)
import { initSpeedWatcher } from "@features/actions/speed";
initSpeedWatcher();

// 5. Hook webpack chunks (must be before game loads)
import "@core/webpack-spy";

// 5b. Sound hook (patches Howl.prototype.play, retries until ready)
import { initSoundHook, initMusicPauseHook } from "@features/sounds/sounds";
initMusicPauseHook();
initSoundHook();

// 6. Hook WebSocket constructor (must be before game connects)
import "@core/websocket-hook";

// 7. Init HUD when DOM is ready
import { tryInit } from "@ui/hud";

log("INIT", "Setting up init, readyState: " + document.readyState);

if (document.readyState === "complete" || document.readyState === "interactive") {
  log("INIT", "Page already loaded/interactive, init now");
  tryInit();
} else {
  log("INIT", "Page still loading, adding DOMContentLoaded listener");
  document.addEventListener("DOMContentLoaded", () => {
    log("INIT", "DOMContentLoaded fired");
    tryInit();
  });
  window.addEventListener("load", () => {
    log("INIT", "window.load fired");
    if (!document.getElementById("lt-hud")) {
      log("INIT", "HUD not found on window.load, forcing init");
      tryInit();
    }
  });
}

log("INIT", "Init setup complete, waiting for page...");
