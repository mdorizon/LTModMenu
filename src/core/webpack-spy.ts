// Side-effect module: hooks webpackChunk_N_E.push to capture gameApp

import { log } from "./logger";

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

  chunks.push = function (chunk: any) {
    pushCount++;
    log(
      "WEBPACK",
      "push #" + pushCount + ", chunk IDs: " +
        (Array.isArray(chunk) && chunk[0] ? JSON.stringify(chunk[0]) : "unknown"),
    );

    const result = _origPush.call(chunks, chunk);

    if (!hooked) {
      hooked = true;
      log("WEBPACK", "First real webpack push detected, injecting spy module...");
      try {
        chunks.push([
          ["lt-spy"],
          {
            "lt-spy-mod": function (_module: any, _exports: any, require: any) {
              log("WEBPACK", "Spy module executing, require available: " + typeof require);
              window.__wpRequire = require;
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
    return result;
  };
  log("WEBPACK", "webpackChunk.push hooked");
})();

export { extractBurrowTemplates };
