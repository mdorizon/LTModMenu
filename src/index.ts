// ══════════════════════════════════════════════
//  LTModMenu - Entry Point
//  Import order matters: webpack spy and WS hook
//  must be installed before the game loads.
// ══════════════════════════════════════════════

console.log("[LTModMenu] >>> Script executing in PAGE context <<<");
console.log("[LTModMenu] document.readyState:", document.readyState);
console.log("[LTModMenu] window.WebSocket exists:", typeof window.WebSocket);
console.log("[LTModMenu] window.location:", window.location.href);

// 1. Initialize global state (load persisted data)
import { initGlobalState } from "./storage/storage";
initGlobalState();

// 2. Load fish database
import "./data/fish-database";

// 3. Setup challenge solver on window
import { setupChallengeSolver } from "./game/challenge-solver";
setupChallengeSolver();

// 4. Hook webpack chunks (must be before game loads)
import "./game/webpack-spy";

// 5. Hook WebSocket constructor (must be before game connects)
import "./game/websocket-hook";

// 6. Setup player action globals
import { setupPlayerActions } from "./game/player-actions";
setupPlayerActions();

// 7. Init HUD when DOM is ready
import { tryInit } from "./ui/hud";

console.log("[LTModMenu] Setting up init, readyState:", document.readyState);

if (document.readyState === "complete" || document.readyState === "interactive") {
  console.log("[LTModMenu] Page already loaded/interactive, init now");
  tryInit();
} else {
  console.log("[LTModMenu] Page still loading, adding DOMContentLoaded listener");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[LTModMenu] DOMContentLoaded fired");
    tryInit();
  });
  window.addEventListener("load", () => {
    console.log("[LTModMenu] window.load fired");
    if (!document.getElementById("lt-hud")) {
      console.log("[LTModMenu] HUD not found on window.load, forcing init");
      tryInit();
    }
  });
}

console.log("[LTModMenu] Init setup complete, waiting for page...");
