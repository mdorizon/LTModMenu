// Side-effect module: hooks webpackChunk_N_E.push to capture gameApp

import { log } from "../utils/logger";

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
                      }
                    },
                    configurable: true,
                  });
                  if (_real && _real.localPlayer !== undefined) {
                    window.__gameApp = _real;
                    log("WEBPACK", "gameApp captured immediately (already instantiated)");
                    inspectLocalPlayerForId(_real);
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
                      const inst = AppClass._instance;
                      if (inst && inst.localPlayer !== undefined) {
                        window.__gameApp = inst;
                        log("WEBPACK", "gameApp captured via retry (polling)");
                        inspectLocalPlayerForId(inst);
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

export {};
