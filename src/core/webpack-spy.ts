// Side-effect module: hooks webpackChunk_N_E.push to capture gameApp,
// Zustand stores, GameGlobals signal bus, and Socket.IO client wrapper.
// Uses signature-based detection (module-resolver) instead of hardcoded
// module IDs — resilient to game rebuilds.

import { log } from "./logger";
import { captureAll, findAppClass, extractBurrowTemplatesGeneric } from "./module-resolver";

function inspectLocalPlayerForId(gameApp: any): void {
  try {
    const lp = gameApp.localPlayer;
    if (!lp) return;

    const idKeys = ["id", "playerId", "userId", "uid", "sid", "sessionId", "name", "username"];
    for (const key of idKeys) {
      if (lp[key] !== undefined) {
        log("PLAYER", "Found localPlayer." + key + ": " + lp[key]);
        if (!window.__localPlayerId && (key === "id" || key === "playerId" || key === "userId" || key === "uid")) {
          window.__localPlayerId = String(lp[key]);
          log("PLAYER", "Local player ID set: " + lp[key]);
        }
      }
    }

    const allKeys = Object.keys(lp);
    log("PLAYER", "localPlayer keys: " + allKeys.join(", "));
  } catch (e: any) {
    log("PLAYER", "inspectLocalPlayer error: " + e.message);
  }
}

function hookAppClass(AppClass: any): void {
  // Hook loadScene on prototype to capture scene templates
  const origLoadScene = AppClass.prototype.loadScene;
  if (origLoadScene && !AppClass.prototype.__ltLoadSceneHooked) {
    AppClass.prototype.__ltLoadSceneHooked = true;
    AppClass.prototype.loadScene = function (opts: any) {
      if (opts?.scene?.name) {
        if (!window.__sceneCache) window.__sceneCache = new Map();
        window.__sceneCache.set(opts.scene.name, opts.scene);
        log("SCENE", "Captured via loadScene hook: " + opts.scene.name);
      }
      return origLoadScene.call(this, opts);
    };
    log("WEBPACK", "loadScene prototype hook installed");
  }

  function onGameAppReady(instance: any): void {
    if (window.__gameApp) return;
    window.__gameApp = instance;
    log("WEBPACK", "gameApp CAPTURED!");
    inspectLocalPlayerForId(instance);
    extractBurrowTemplatesGeneric();
  }

  function waitForLocalPlayer(instance: any): void {
    if (instance.localPlayer !== undefined) {
      onGameAppReady(instance);
      return;
    }
    // localPlayer is assigned after _instance — poll until it appears
    let polls = 0;
    const timer = setInterval(() => {
      polls++;
      if (instance.localPlayer !== undefined) {
        clearInterval(timer);
        onGameAppReady(instance);
      } else if (polls >= 60) {
        clearInterval(timer);
        // Capture anyway — localPlayer may be set later during scene load
        onGameAppReady(instance);
        log("WEBPACK", "gameApp captured without localPlayer (timeout)");
      }
    }, 500);
  }

  // Hook _instance setter to capture gameApp when it's instantiated
  let _real = AppClass._instance;
  Object.defineProperty(AppClass, "_instance", {
    get() { return _real; },
    set(v: any) {
      _real = v;
      if (v && !window.__gameApp) {
        waitForLocalPlayer(v);
      }
    },
    configurable: true,
  });

  if (_real) {
    waitForLocalPlayer(_real);
  } else {
    log("WEBPACK", "gameApp not yet instantiated, waiting for setter...");
  }
}

let appClassHooked = false;

function runCapture(require: any): boolean {
  const result = captureAll(require);

  if (result.appClass && !appClassHooked) {
    appClassHooked = true;
    hookAppClass(result.appClass);
  }

  return result.allStores && result.hasGlobals && result.hasSocket && appClassHooked;
}

log("WEBPACK", "Setting up webpack spy...");
log(
  "WEBPACK",
  "Current webpackChunk_N_E: " +
    typeof (self as any).webpackChunk_N_E +
    (Array.isArray((self as any).webpackChunk_N_E)
      ? " length=" + (self as any).webpackChunk_N_E.length
      : " not array"),
);

(function () {
  const chunks = ((self as any).webpackChunk_N_E = (self as any).webpackChunk_N_E || []);
  const _origPush = chunks.push;
  let hooked = false;
  let pushCount = 0;

  log("WEBPACK", "Chunks array initialized, original push: " + typeof _origPush);

  function injectSpyModule(): void {
    if (hooked) return;
    hooked = true;
    try {
      chunks.push([
        ["lt-spy"],
        {
          "lt-spy-mod": function (_module: any, _exports: any, require: any) {
            log("WEBPACK", "Spy module executing, require available: " + typeof require);
            window.__wpRequire = require;

            if (runCapture(require)) {
              log("WEBPACK", "All targets captured immediately");
              return;
            }

            // Retry: some modules aren't loaded yet
            let retries = 0;
            const interval = setInterval(() => {
              retries++;
              if (runCapture(require)) {
                clearInterval(interval);
                log("WEBPACK", "All targets captured (retry #" + retries + ")");
              } else if (retries >= 30) {
                clearInterval(interval);
                const missing = [];
                if (!window.__gameApp) missing.push("gameApp");
                if (!window.__gameGlobals) missing.push("GameGlobals");
                if (!window.__socketClient) missing.push("SocketClient");
                const stores = window.__stores || {};
                for (const k of ["useUserData", "useSettings", "useUsersStore", "useLobbyStore",
                  "useMissionStore", "useFocusSession", "useFishingStats", "useModalStore",
                  "useFishingFrenzy", "useFriendPresence"] as const) {
                  if (!stores[k]) missing.push(k);
                }
                if (missing.length > 0) {
                  log("WEBPACK", "Missing after 30 retries: " + missing.join(", "));
                }
              }
            }, 1000);
          },
        },
        function (require: any) {
          log("WEBPACK", "Spy init function called");
          require("lt-spy-mod");
        },
      ]);
      log("WEBPACK", "Spy module injected successfully");
    } catch (e: any) {
      log("WEBPACK", "Failed to inject spy module: " + e.message);
    }
  }

  chunks.push = function (...args: any[]) {
    pushCount++;
    log("WEBPACK", "push #" + pushCount + " intercepted");
    const result = _origPush.apply(chunks, args);
    injectSpyModule();
    return result;
  };

  // Fallback: if all chunks were already loaded before userscript, no push fires
  setTimeout(() => {
    if (!hooked) {
      log("WEBPACK", "No push detected after 2s, injecting spy module directly...");
      injectSpyModule();
    }
  }, 2000);

  log("WEBPACK", "webpackChunk.push hooked");
})();

export { extractBurrowTemplatesGeneric as extractBurrowTemplates };
