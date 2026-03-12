// Side-effect module: hooks webpackChunk_N_E.push to capture gameApp,
// Zustand stores, GameGlobals signal bus, and Socket.IO client wrapper

import { log } from "./logger";
import type { LTStores } from "./types/global.d";

// [storeName, moduleId, exportKey]
// Export keys come from minified webpack output — may change between game builds
const STORE_DEFS: [keyof LTStores, number, string][] = [
  ["useUserData", 92764, "useUserData"],
  ["useSettings", 29546, "useSettings"],
  ["useUsersStore", 62021, "k"],
  ["useLobbyStore", 65749, "G"],
  ["useMissionStore", 79165, "I"],
  ["useFocusSession", 59740, "useFocusSession"],
  ["useFishingStats", 20079, "useFishingStats"],
  ["useModalStore", 9192, "h"],
  ["useFishingFrenzy", 79709, "useFishingFrenzy"],
  ["useFriendPresence", 8626, "useFriendPresence"],
];

function findZustandStore(moduleExports: any, expectedKey: string): any {
  const candidate = moduleExports[expectedKey];
  if (candidate && typeof candidate.getState === "function") return candidate;
  for (const key of Object.keys(moduleExports)) {
    const val = moduleExports[key];
    if (val && typeof val.getState === "function" && typeof val.setState === "function") {
      return val;
    }
  }
  return null;
}

function captureStoresAndGlobals(require: (id: number) => any): void {
  if (!window.__stores) window.__stores = {} as LTStores;

  function attemptCapture(): boolean {
    for (const [name, moduleId, exportKey] of STORE_DEFS) {
      if (window.__stores[name]) continue;
      try {
        const mod = require(moduleId);
        const store = findZustandStore(mod, exportKey);
        if (store) {
          (window.__stores as any)[name] = store;
          log("WEBPACK", `Captured store: ${name} (module ${moduleId})`);
        }
      } catch (_e) { /* module not loaded yet */ }
    }

    if (!window.__gameGlobals) {
      try {
        const mod = require(20993);
        if (mod.A?.signal) {
          window.__gameGlobals = mod.A;
          log("WEBPACK", "Captured GameGlobals (module 20993)");
        }
      } catch (_e) { /* not loaded */ }
    }

    if (!window.__socketClient) {
      try {
        const mod = require(51496);
        if (mod.A && (mod.A.socket || typeof mod.A.emit === "function")) {
          window.__socketClient = mod.A;
          log("WEBPACK", "Captured SocketClient (module 51496)");
        }
      } catch (_e) { /* not loaded */ }
    }

    const missing = STORE_DEFS.filter(([name]) => !window.__stores[name]);
    return missing.length === 0 && !!window.__gameGlobals && !!window.__socketClient;
  }

  if (attemptCapture()) {
    log("WEBPACK", "All stores and globals captured immediately");
    return;
  }

  let retries = 0;
  const interval = setInterval(() => {
    retries++;
    if (attemptCapture()) {
      clearInterval(interval);
      log("WEBPACK", `All stores and globals captured (retry #${retries})`);
    } else if (retries >= 30) {
      clearInterval(interval);
      const missing = STORE_DEFS.filter(([name]) => !window.__stores[name]);
      if (missing.length > 0)
        log("WEBPACK", "Missing stores after 30 retries: " + missing.map(s => s[0]).join(", "));
      if (!window.__gameGlobals) log("WEBPACK", "GameGlobals not captured after 30 retries");
      if (!window.__socketClient) log("WEBPACK", "SocketClient not captured after 30 retries");
    }
  }, 1000);
}

function extractBurrowTemplates(): void {
  try {
    const chunks = (self as any).webpackChunk_N_E;
    if (!chunks) return;
    if (!window.__sceneCache) window.__sceneCache = new Map();

    for (const chunk of chunks) {
      const fn = chunk[1]?.["20493"];
      if (!fn) continue;

      const src = fn.toString();
      const idx = src.indexOf("ik={");
      if (idx === -1) continue;

      let depth = 0;
      let end = idx;
      for (let i = idx; i < src.length; i++) {
        if (src[i] === "{") depth++;
        if (src[i] === "}") {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }

      let ikStr = src.substring(idx + 3, end);
      // Replace variable references (e.g. ta.mainScene, th, iT) with null
      ikStr = ikStr.replace(/:([a-zA-Z_]\w*(?:\.\w+)?)\s*([,}])/g, (_m: string, val: string, sep: string) => {
        if (val === "true" || val === "false" || val === "null") return ":" + val + sep;
        return ":null" + sep;
      });
      ikStr = ikStr.replace(/!1/g, "false").replace(/!0/g, "true");

      try {
        const ikObj = new Function("return " + ikStr)();
        let count = 0;
        for (const [name, scene] of Object.entries(ikObj)) {
          if (scene && typeof scene === "object" && (scene as any).name && (scene as any).fastTravelSpawnPosition) {
            window.__sceneCache.set(name, scene as any);
            count++;
          }
        }
        log("SCENE", "Extracted " + count + " burrow templates from game source");
      } catch (e: any) {
        log("SCENE", "Failed to parse ik: " + e.message);
      }
      break;
    }
  } catch (_e) {
    // ignore
  }
}

function inspectLocalPlayerForId(gameApp: any): void {
  try {
    const lp = gameApp.localPlayer;
    if (!lp) return;

    // Look for ID-like properties on localPlayer
    const idKeys = ["id", "playerId", "userId", "uid", "sid", "sessionId", "name", "username"];
    for (const key of idKeys) {
      if (lp[key] !== undefined) {
        log("PLAYER", `Found localPlayer.${key}: ${lp[key]}`);
        if (!window.__localPlayerId && (key === "id" || key === "playerId" || key === "userId" || key === "uid")) {
          window.__localPlayerId = String(lp[key]);
          log("PLAYER", "Local player ID set: " + lp[key]);
        }
      }
    }

    // Dump all enumerable keys for discovery
    const allKeys = Object.keys(lp);
    log("PLAYER", "localPlayer keys: " + allKeys.join(", "));
  } catch (e: any) {
    log("PLAYER", "inspectLocalPlayer error: " + e.message);
  }
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
              captureStoresAndGlobals(require);
              try {
                log("WEBPACK", "Trying require(20493)...");
                const appModule = require(20493);
                log(
                  "WEBPACK",
                  "require(20493) result: " +
                    typeof appModule + " " +
                    (appModule ? Object.keys(appModule).join(",") : "null"),
                );
                if (appModule && appModule.App) {
                  const AppClass = appModule.App;
                  log("WEBPACK", "AppClass found, _instance: " + typeof AppClass._instance);

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

                  let _real = AppClass._instance;
                  Object.defineProperty(AppClass, "_instance", {
                    get() {
                      return _real;
                    },
                    set(v: any) {
                      _real = v;
                      log(
                        "WEBPACK",
                        "AppClass._instance SET, has localPlayer: " +
                          (v ? v.localPlayer !== undefined : false),
                      );
                      if (v && v.localPlayer !== undefined) {
                        window.__gameApp = v;
                        log("WEBPACK", "gameApp CAPTURED!");
                        inspectLocalPlayerForId(v);
                        extractBurrowTemplates();
                      }
                    },
                    configurable: true,
                  });
                  if (_real && _real.localPlayer !== undefined) {
                    window.__gameApp = _real;
                    log("WEBPACK", "gameApp captured immediately (already instantiated)");
                    inspectLocalPlayerForId(_real);
                    extractBurrowTemplates();
                  } else {
                    log("WEBPACK", "gameApp not yet instantiated, waiting for setter...");
                  }
                } else {
                  log("WEBPACK", "App class not found in module 20493");
                }
              } catch (e: any) {
                log("WEBPACK", "require(20493) failed: " + e.message + " - setting up retry");
                let retrySetterInstalled = false;
                window.__ltSpyRetry = function () {
                  try {
                    const appModule = require(20493);
                    if (appModule && appModule.App) {
                      const AppClass = appModule.App;

                      // Direct polling: check _instance right now
                      // Hook loadScene on prototype (once)
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
                        log("WEBPACK", "loadScene prototype hook installed (retry path)");
                      }

                      const inst = AppClass._instance;
                      if (inst && inst.localPlayer !== undefined) {
                        window.__gameApp = inst;
                        log("WEBPACK", "gameApp captured via retry (polling)");
                        inspectLocalPlayerForId(inst);
                        extractBurrowTemplates();
                        return true;
                      }

                      // Install setter only once for future assignments
                      if (!retrySetterInstalled) {
                        retrySetterInstalled = true;
                        let _real = inst;
                        Object.defineProperty(AppClass, "_instance", {
                          get() {
                            return _real;
                          },
                          set(v: any) {
                            _real = v;
                            if (v && v.localPlayer !== undefined) {
                              window.__gameApp = v;
                              log("WEBPACK", "gameApp CAPTURED via setter!");
                              inspectLocalPlayerForId(v);
                              extractBurrowTemplates();
                            }
                          },
                          configurable: true,
                        });
                        log("WEBPACK", "Retry setter installed, polling continues...");
                      }

                      // Not captured yet, keep retrying
                      return false;
                    }
                  } catch (e2: any) {
                    log("WEBPACK", "Retry failed: " + e2.message);
                  }
                  return false;
                };
              }
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

export { extractBurrowTemplates };
