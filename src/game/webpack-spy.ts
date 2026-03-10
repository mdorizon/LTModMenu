// Side-effect module: hooks webpackChunk_N_E.push to capture gameApp

console.log("[LTModMenu] Setting up webpack spy...");
console.log(
  "[LTModMenu] Current webpackChunk_N_E:",
  typeof (self as any).webpackChunk_N_E,
  Array.isArray((self as any).webpackChunk_N_E)
    ? "length=" + (self as any).webpackChunk_N_E.length
    : "not array",
);

(function () {
  const chunks = ((self as any).webpackChunk_N_E = (self as any).webpackChunk_N_E || []);
  const _origPush = chunks.push;
  let hooked = false;
  let pushCount = 0;

  console.log("[LTModMenu] Webpack chunks array initialized, original push:", typeof _origPush);

  chunks.push = function (chunk: any) {
    pushCount++;
    console.log(
      "[LTModMenu] webpackChunk.push called #" + pushCount + ", chunk IDs:",
      Array.isArray(chunk) && chunk[0] ? JSON.stringify(chunk[0]) : "unknown",
    );

    const result = _origPush.call(chunks, chunk);

    if (!hooked) {
      hooked = true;
      console.log("[LTModMenu] First real webpack push detected, injecting spy module...");
      try {
        // Use the current chunks.push (which is now the game's webpack
        // jsonp callback) so the spy chunk actually gets processed by
        // the game's webpack runtime, not just appended to the array.
        chunks.push([
          ["lt-spy"],
          {
            "lt-spy-mod": function (_module: any, _exports: any, require: any) {
              console.log("[LTModMenu] Spy module executing, require available:", typeof require);
              try {
                console.log("[LTModMenu] Trying require(20493)...");
                const appModule = require(20493);
                console.log(
                  "[LTModMenu] require(20493) result:",
                  typeof appModule,
                  appModule ? Object.keys(appModule).join(",") : "null",
                );
                if (appModule && appModule.App) {
                  const AppClass = appModule.App;
                  console.log(
                    "[LTModMenu] AppClass found, _instance:",
                    typeof AppClass._instance,
                  );
                  let _real = AppClass._instance;
                  Object.defineProperty(AppClass, "_instance", {
                    get() {
                      return _real;
                    },
                    set(v: any) {
                      _real = v;
                      console.log(
                        "[LTModMenu] AppClass._instance SET, has localPlayer:",
                        v ? v.localPlayer !== undefined : false,
                      );
                      if (v && v.localPlayer !== undefined) {
                        window.__gameApp = v;
                        console.log("[LTModMenu] gameApp CAPTURED!");
                      }
                    },
                    configurable: true,
                  });
                  if (_real && _real.localPlayer !== undefined) {
                    window.__gameApp = _real;
                    console.log("[LTModMenu] gameApp captured immediately (already instantiated)");
                  } else {
                    console.log("[LTModMenu] gameApp not yet instantiated, waiting for setter...");
                  }
                } else {
                  console.log("[LTModMenu] App class not found in module 20493");
                }
              } catch (e: any) {
                console.log(
                  "[LTModMenu] require(20493) failed:",
                  e.message,
                  "- setting up retry",
                );
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
                        console.log("[LTModMenu] gameApp captured via retry (polling)");
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
                              console.log("[LTModMenu] gameApp CAPTURED via setter!");
                            }
                          },
                          configurable: true,
                        });
                        console.log("[LTModMenu] Retry setter installed, polling continues...");
                      }

                      // Not captured yet, keep retrying
                      return false;
                    }
                  } catch (e2: any) {
                    console.log("[LTModMenu] Retry failed:", e2.message);
                  }
                  return false;
                };
              }
            },
          },
          function (require: any) {
            console.log("[LTModMenu] Spy init function called");
            require("lt-spy-mod");
          },
        ]);
        console.log("[LTModMenu] Spy module injected successfully");
      } catch (e: any) {
        console.error("[LTModMenu] Failed to inject spy module:", e.message);
      }
    }
    return result;
  };
  console.log("[LTModMenu] webpackChunk.push hooked");
})();

export {};
