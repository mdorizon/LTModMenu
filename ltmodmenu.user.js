// ==UserScript==
// @name         LTModMenu - Lofi Town Mod Menu
// @namespace    ltmodmenu
// @version      2.2
// @author       mdorizon
// @description  Mod menu pour Lofi Town
// @match        https://app.lofi.town/*
// @match        https://lofi.town/*
// @grant        none
// @inject-into  page
// @run-at       document-start
// ==/UserScript==

// On injecte un <script> dans la page pour etre SUR d'etre dans le contexte page
// (Tampermonkey sandbox empeche l'acces au vrai window.WebSocket sinon)
(function () {
  console.log("[LTModMenu] Userscript loaded, injecting into page context...");

  var script = document.createElement("script");
  script.textContent =
    "(" +
    function () {
      // ══════════════════════════════════════════════
      //  BOOTSTRAP
      // ══════════════════════════════════════════════
      console.log("[LTModMenu] >>> Script executing in PAGE context <<<");
      console.log("[LTModMenu] document.readyState:", document.readyState);
      console.log(
        "[LTModMenu] window.WebSocket exists:",
        typeof window.WebSocket,
      );
      console.log("[LTModMenu] window.location:", window.location.href);

      // ══════════════════════════════════════════════
      //  VARIABLES GLOBALES
      // ══════════════════════════════════════════════

      // ══════════════════════════════════════════════
      //  STOCKAGE LOCAL (localStorage)
      // ══════════════════════════════════════════════

      var STORAGE_PREFIX = "ltmod_";

      function saveData(key, value) {
        try {
          localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
          console.log("[LTModMenu] Saved to localStorage:", key);
        } catch (e) {
          console.log("[LTModMenu] localStorage save error:", e.message);
        }
      }

      function loadData(key, defaultValue) {
        try {
          var raw = localStorage.getItem(STORAGE_PREFIX + key);
          if (raw === null) {
            console.log(
              "[LTModMenu] No saved data for:",
              key,
              "- using default",
            );
            return defaultValue;
          }
          var parsed = JSON.parse(raw);
          console.log("[LTModMenu] Loaded from localStorage:", key);
          return parsed;
        } catch (e) {
          console.log("[LTModMenu] localStorage load error:", e.message);
          return defaultValue;
        }
      }

      // Sauvegarde auto toutes les 30s
      function startAutoSave() {
        setInterval(function () {
          saveData("waypoints", window.__waypoints);
          saveData("fishStats", window.__fishStats);
          console.log("[LTModMenu] Auto-save done");
        }, 30000);
        console.log("[LTModMenu] Auto-save started (every 30s)");
      }

      // ══════════════════════════════════════════════

      window.__lastFish = null;
      window.__fishBite = null;
      window.__gameWS = null;
      window.__blockFishingFail = false;
      window.__playerPos = null;
      window.__gameApp = null;
      window.__botPaused = true;

      // Charger les donnees persistantes
      window.__waypoints = loadData("waypoints", []);
      window.__fishStats = loadData("fishStats", {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        secret: 0,
        event: 0,
        unknown: 0,
        total: 0,
        gold: 0,
        last_fish: "",
      });

      console.log("[LTModMenu] Global variables initialized");
      console.log("[LTModMenu] Loaded waypoints:", window.__waypoints.length);
      console.log(
        "[LTModMenu] Loaded stats: total=" +
          window.__fishStats.total +
          " gold=" +
          window.__fishStats.gold,
      );

      // ══════════════════════════════════════════════
      //  BASE DE DONNEES POISSONS
      // ══════════════════════════════════════════════

      var FISH_DATA = {
        bass: { rarity: "common", minWeight: 1, maxWeight: 8, baseGold: 8 },
        cod: { rarity: "common", minWeight: 2, maxWeight: 15, baseGold: 10 },
        shrimp: {
          rarity: "common",
          minWeight: 0.1,
          maxWeight: 0.5,
          baseGold: 5,
        },
        sardine: {
          rarity: "common",
          minWeight: 0.2,
          maxWeight: 1,
          baseGold: 6,
        },
        anchovy: {
          rarity: "common",
          minWeight: 0.1,
          maxWeight: 0.3,
          baseGold: 5,
        },
        flounder: { rarity: "common", minWeight: 1, maxWeight: 5, baseGold: 7 },
        "star fish": {
          rarity: "common",
          minWeight: 0.2,
          maxWeight: 2,
          baseGold: 6,
        },
        "sea urchin": {
          rarity: "common",
          minWeight: 0.5,
          maxWeight: 3,
          baseGold: 8,
        },
        catfish: {
          rarity: "common",
          minWeight: 2,
          maxWeight: 20,
          baseGold: 12,
        },
        herring: {
          rarity: "common",
          minWeight: 0.5,
          maxWeight: 2,
          baseGold: 7,
        },
        mackerel: { rarity: "common", minWeight: 1, maxWeight: 4, baseGold: 9 },
        lobster: {
          rarity: "common",
          minWeight: 0.45,
          maxWeight: 5,
          baseGold: 8,
        },
        "puffer fish": {
          rarity: "uncommon",
          minWeight: 0.5,
          maxWeight: 3,
          baseGold: 18,
        },
        trevally: {
          rarity: "uncommon",
          minWeight: 3,
          maxWeight: 25,
          baseGold: 22,
        },
        oyster: {
          rarity: "uncommon",
          minWeight: 0.3,
          maxWeight: 2,
          baseGold: 15,
        },
        tetra: {
          rarity: "uncommon",
          minWeight: 0.1,
          maxWeight: 0.5,
          baseGold: 16,
        },
        tuna: {
          rarity: "uncommon",
          minWeight: 20,
          maxWeight: 400,
          baseGold: 35,
        },
        eel: { rarity: "uncommon", minWeight: 2, maxWeight: 25, baseGold: 25 },
        "moorish idol": {
          rarity: "uncommon",
          minWeight: 0.5,
          maxWeight: 2,
          baseGold: 20,
        },
        salmon: {
          rarity: "uncommon",
          minWeight: 5,
          maxWeight: 30,
          baseGold: 28,
        },
        seahorse: {
          rarity: "uncommon",
          minWeight: 0.1,
          maxWeight: 1,
          baseGold: 17,
        },
        "clown fish": {
          rarity: "uncommon",
          minWeight: 0.2,
          maxWeight: 1,
          baseGold: 19,
        },
        squid: {
          rarity: "uncommon",
          minWeight: 1,
          maxWeight: 15,
          baseGold: 24,
        },
        goldfish: {
          rarity: "rare",
          minWeight: 0.5,
          maxWeight: 2,
          baseGold: 45,
        },
        "koi carp": {
          rarity: "rare",
          minWeight: 2,
          maxWeight: 35,
          baseGold: 55,
        },
        "ribbon moray": {
          rarity: "rare",
          minWeight: 5,
          maxWeight: 40,
          baseGold: 60,
        },
        blobfish: { rarity: "rare", minWeight: 2, maxWeight: 20, baseGold: 50 },
        "flying fish": {
          rarity: "rare",
          minWeight: 1,
          maxWeight: 5,
          baseGold: 42,
        },
        coelacanth: {
          rarity: "rare",
          minWeight: 15,
          maxWeight: 180,
          baseGold: 75,
        },
        stingray: {
          rarity: "rare",
          minWeight: 10,
          maxWeight: 800,
          baseGold: 65,
        },
        "blue lobster": {
          rarity: "epic",
          minWeight: 1,
          maxWeight: 9,
          baseGold: 120,
        },
        "fried egg jellyfish": {
          rarity: "epic",
          minWeight: 5,
          maxWeight: 35,
          baseGold: 95,
        },
        "tiger shark": {
          rarity: "epic",
          minWeight: 200,
          maxWeight: 1400,
          baseGold: 180,
        },
        "manta ray": {
          rarity: "epic",
          minWeight: 600,
          maxWeight: 5000,
          baseGold: 200,
        },
        marlin: {
          rarity: "epic",
          minWeight: 100,
          maxWeight: 1800,
          baseGold: 175,
        },
        octopus: {
          rarity: "epic",
          minWeight: 5,
          maxWeight: 150,
          baseGold: 110,
        },
        "hammer shark": {
          rarity: "epic",
          minWeight: 500,
          maxWeight: 1200,
          baseGold: 165,
        },
        "whale shark": {
          rarity: "epic",
          minWeight: 15000,
          maxWeight: 40000,
          baseGold: 220,
        },
        "lion fish": {
          rarity: "epic",
          minWeight: 1,
          maxWeight: 5,
          baseGold: 85,
        },
        "sun fish": {
          rarity: "epic",
          minWeight: 500,
          maxWeight: 5000,
          baseGold: 190,
        },
        "horseshoe crab": {
          rarity: "epic",
          minWeight: 2,
          maxWeight: 10,
          baseGold: 100,
        },
        "white lobster": {
          rarity: "legendary",
          minWeight: 1,
          maxWeight: 15,
          baseGold: 400,
        },
        "golden goldfish": {
          rarity: "legendary",
          minWeight: 2,
          maxWeight: 8,
          baseGold: 500,
        },
        "phantom jellyfish": {
          rarity: "legendary",
          minWeight: 10,
          maxWeight: 100,
          baseGold: 500,
        },
        "ocean man": {
          rarity: "legendary",
          minWeight: 150,
          maxWeight: 250,
          baseGold: 750,
        },
        "sperm whale": {
          rarity: "legendary",
          minWeight: 25000,
          maxWeight: 125000,
          baseGold: 800,
        },
        "mermaid?": {
          rarity: "legendary",
          minWeight: 100,
          maxWeight: 180,
          baseGold: 800,
        },
        cthulhu: {
          rarity: "legendary",
          minWeight: 50000,
          maxWeight: 200000,
          baseGold: 1000,
        },
        mermaid: {
          rarity: "legendary",
          minWeight: 110,
          maxWeight: 170,
          baseGold: 900,
        },
        megalodon: {
          rarity: "legendary",
          minWeight: 50000,
          maxWeight: 120000,
          baseGold: 900,
        },
        "giant squid": {
          rarity: "legendary",
          minWeight: 600,
          maxWeight: 1500,
          baseGold: 750,
        },
        "red handfish": {
          rarity: "secret",
          minWeight: 0.04,
          maxWeight: 0.1,
          baseGold: 1500,
        },
        "goblin shark": {
          rarity: "secret",
          minWeight: 23,
          maxWeight: 210,
          baseGold: 1500,
        },
        "ghost shark": {
          rarity: "secret",
          minWeight: 1,
          maxWeight: 16,
          baseGold: 1750,
        },
        "black seadevil anglerfish": {
          rarity: "secret",
          minWeight: 0.05,
          maxWeight: 1,
          baseGold: 1500,
        },
        "devil's hole pupfish": {
          rarity: "secret",
          minWeight: 0.01,
          maxWeight: 0.02,
          baseGold: 2000,
        },
        "barreleye fish": {
          rarity: "secret",
          minWeight: 1,
          maxWeight: 5,
          baseGold: 1500,
        },
        "gulper eel": {
          rarity: "secret",
          minWeight: 2,
          maxWeight: 10,
          baseGold: 1500,
        },
        "vampire squid": {
          rarity: "halloween",
          minWeight: 5,
          maxWeight: 30,
          baseGold: 75,
        },
        "bobbit worm": {
          rarity: "halloween",
          minWeight: 10,
          maxWeight: 100,
          baseGold: 100,
        },
        siren: {
          rarity: "halloween",
          minWeight: 100,
          maxWeight: 200,
          baseGold: 150,
        },
        nessie: {
          rarity: "halloween",
          minWeight: 1000,
          maxWeight: 10000,
          baseGold: 180,
        },
        "skeleton fish": {
          rarity: "halloween",
          minWeight: 1,
          maxWeight: 10,
          baseGold: 60,
        },
        "the great angler": {
          rarity: "halloween",
          minWeight: 500,
          maxWeight: 5000,
          baseGold: 200,
        },
        "pinecone fish": {
          rarity: "christmas",
          minWeight: 1,
          maxWeight: 5,
          baseGold: 75,
        },
        "garden eel": {
          rarity: "christmas",
          minWeight: 2,
          maxWeight: 15,
          baseGold: 100,
        },
        "ornated jelly fish": {
          rarity: "christmas",
          minWeight: 5,
          maxWeight: 30,
          baseGold: 150,
        },
        "fish-deer": {
          rarity: "christmas",
          minWeight: 50,
          maxWeight: 200,
          baseGold: 180,
        },
        walrus: {
          rarity: "christmas",
          minWeight: 500,
          maxWeight: 1500,
          baseGold: 200,
        },
        narwhal: {
          rarity: "christmas",
          minWeight: 800,
          maxWeight: 3500,
          baseGold: 250,
        },
      };
      console.log(
        "[LTModMenu] Fish database loaded:",
        Object.keys(FISH_DATA).length,
        "fish",
      );

      function calculateGold(name, weight, isShiny) {
        var info = FISH_DATA[name.toLowerCase()];
        if (!info) return 0;
        var ratio =
          info.maxWeight === info.minWeight
            ? 0
            : Math.max(
                0,
                Math.min(
                  1,
                  (weight - info.minWeight) / (info.maxWeight - info.minWeight),
                ),
              );
        var gold = Math.round(info.baseGold * (0.8 + ratio * 0.7));
        if (isShiny) gold *= 50;
        return gold;
      }

      function getRarity(name) {
        var info = FISH_DATA[name.toLowerCase()];
        return info ? info.rarity : "unknown";
      }

      // ══════════════════════════════════════════════
      //  SOLVE FISHING CHALLENGE
      // ══════════════════════════════════════════════

      window.__solveFishingChallenge = function (e) {
        console.log("[LTModMenu] Solving challenge, length:", e.length);
        var a = [114, 51, 97, 108, 109, 115];
        var t = 0x811c9dc5;
        var i = [];
        for (var o = 0; o < e.length; o++) {
          t ^= e.charCodeAt(o) ^ a[o % a.length];
          i.push(((t = Math.imul(t, 0x1000193)) >>> 0) & 255);
        }
        var result = i
          .map(function (e) {
            return e.toString(16).padStart(2, "0");
          })
          .join("");
        console.log(
          "[LTModMenu] Challenge solved, response length:",
          result.length,
        );
        return result;
      };

      // ══════════════════════════════════════════════
      //  WEBPACK SPY - Capturer gameApp
      // ══════════════════════════════════════════════

      console.log("[LTModMenu] Setting up webpack spy...");
      console.log(
        "[LTModMenu] Current webpackChunk_N_E:",
        typeof self.webpackChunk_N_E,
        Array.isArray(self.webpackChunk_N_E)
          ? "length=" + self.webpackChunk_N_E.length
          : "not array",
      );

      (function () {
        var chunks = (self.webpackChunk_N_E = self.webpackChunk_N_E || []);
        var _origPush = chunks.push;
        var hooked = false;
        var pushCount = 0;

        console.log(
          "[LTModMenu] Webpack chunks array initialized, original push:",
          typeof _origPush,
        );

        chunks.push = function (chunk) {
          pushCount++;
          console.log(
            "[LTModMenu] webpackChunk.push called #" +
              pushCount +
              ", chunk IDs:",
            Array.isArray(chunk) && chunk[0]
              ? JSON.stringify(chunk[0])
              : "unknown",
          );

          var result = _origPush.call(chunks, chunk);

          if (!hooked) {
            hooked = true;
            console.log(
              "[LTModMenu] First real webpack push detected, injecting spy module...",
            );
            try {
              _origPush.call(chunks, [
                ["lt-spy"],
                {
                  "lt-spy-mod": function (module, exports, require) {
                    console.log(
                      "[LTModMenu] Spy module executing, require available:",
                      typeof require,
                    );
                    try {
                      console.log("[LTModMenu] Trying require(20493)...");
                      var appModule = require(20493);
                      console.log(
                        "[LTModMenu] require(20493) result:",
                        typeof appModule,
                        appModule ? Object.keys(appModule).join(",") : "null",
                      );
                      if (appModule && appModule.App) {
                        var AppClass = appModule.App;
                        console.log(
                          "[LTModMenu] AppClass found, _instance:",
                          typeof AppClass._instance,
                        );
                        var _real = AppClass._instance;
                        Object.defineProperty(AppClass, "_instance", {
                          get: function () {
                            return _real;
                          },
                          set: function (v) {
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
                          console.log(
                            "[LTModMenu] gameApp captured immediately (already instantiated)",
                          );
                        } else {
                          console.log(
                            "[LTModMenu] gameApp not yet instantiated, waiting for setter...",
                          );
                        }
                      } else {
                        console.log(
                          "[LTModMenu] App class not found in module 20493",
                        );
                      }
                    } catch (e) {
                      console.log(
                        "[LTModMenu] require(20493) failed:",
                        e.message,
                        "- setting up retry",
                      );
                      window.__ltSpyRetry = function () {
                        try {
                          var appModule = require(20493);
                          if (appModule && appModule.App) {
                            var AppClass = appModule.App;
                            var _real = AppClass._instance;
                            Object.defineProperty(AppClass, "_instance", {
                              get: function () {
                                return _real;
                              },
                              set: function (v) {
                                _real = v;
                                if (v && v.localPlayer !== undefined) {
                                  window.__gameApp = v;
                                  console.log(
                                    "[LTModMenu] gameApp CAPTURED via retry!",
                                  );
                                }
                              },
                              configurable: true,
                            });
                            if (_real) {
                              window.__gameApp = _real;
                              console.log(
                                "[LTModMenu] gameApp captured via retry (immediate)",
                              );
                            }
                            return true;
                          }
                        } catch (e2) {
                          console.log("[LTModMenu] Retry failed:", e2.message);
                        }
                        return false;
                      };
                    }
                  },
                },
                function (require) {
                  console.log("[LTModMenu] Spy init function called");
                  require("lt-spy-mod");
                },
              ]);
              console.log("[LTModMenu] Spy module injected successfully");
            } catch (e) {
              console.error(
                "[LTModMenu] Failed to inject spy module:",
                e.message,
              );
            }
          }
          return result;
        };
        console.log("[LTModMenu] webpackChunk.push hooked");
      })();

      // ══════════════════════════════════════════════
      //  WEBSOCKET HOOK
      // ══════════════════════════════════════════════

      console.log("[LTModMenu] Setting up WebSocket hook...");
      var OrigWS = window.WebSocket;
      console.log("[LTModMenu] Original WebSocket:", typeof OrigWS);

      window.WebSocket = function () {
        var args = Array.prototype.slice.call(arguments);
        var url = args[0] || "";
        console.log("[LTModMenu] new WebSocket() called, url:", url);

        var ws = new (Function.prototype.bind.apply(
          OrigWS,
          [null].concat(args),
        ))();
        console.log(
          "[LTModMenu] WebSocket created, readyState:",
          ws.readyState,
        );

        if (typeof url === "string") {
          window.__gameWS = ws;
          console.log("[LTModMenu] Stored as __gameWS");

          // Hook send
          var _origSend = ws.send.bind(ws);
          ws.send = function (data) {
            if (typeof data === "string") {
              // Log tous les messages envoyes (tronques)
              if (!data.includes("clientUpdatePosition")) {
                console.log("[LTModMenu] WS SEND:", data.substring(0, 120));
              }

              // Tracker position
              if (data.includes("clientUpdatePosition")) {
                try {
                  var jsonStr = data.substring(data.indexOf("["));
                  var parsed = JSON.parse(jsonStr);
                  if (parsed[0] === "clientUpdatePosition" && parsed[1]) {
                    window.__playerPos = parsed[1];
                  }
                } catch (e) {}
              }
              // Bloquer les fail
              if (
                window.__blockFishingFail &&
                data.includes("getFishingResult") &&
                data.includes('"fail"')
              ) {
                console.log("[LTModMenu] BLOCKED fail message!");
                return;
              }
            }
            return _origSend(data);
          };
          console.log("[LTModMenu] WS send() hooked");
        }

        ws.addEventListener("open", function () {
          console.log("[LTModMenu] WS OPEN, url:", url);
        });

        ws.addEventListener("close", function (e) {
          console.log(
            "[LTModMenu] WS CLOSE, code:",
            e.code,
            "reason:",
            e.reason,
          );
        });

        ws.addEventListener("error", function (e) {
          console.log("[LTModMenu] WS ERROR:", e);
        });

        ws.addEventListener("message", function (e) {
          try {
            var data = typeof e.data === "string" ? e.data : "";

            // Log les messages importants (pas le spam de position)
            if (
              data.length > 0 &&
              !data.includes("playerMoved") &&
              !data.includes("updatePosition") &&
              data.length < 500
            ) {
              console.log("[LTModMenu] WS RECV:", data.substring(0, 200));
            }

            if (data.includes("fishCaught")) {
              console.log("[LTModMenu] >>> FISH CAUGHT EVENT <<<");
              var jsonStr = data.substring(data.indexOf("["));
              var parsed = JSON.parse(jsonStr);
              if (parsed[0] === "fishCaught" && parsed[1]) {
                window.__fishBite = parsed[1];
                console.log(
                  "[LTModMenu] Fish bite data:",
                  JSON.stringify(parsed[1]).substring(0, 200),
                );
              }
            }
            if (data.includes("fishing-result")) {
              console.log("[LTModMenu] >>> FISHING RESULT EVENT <<<");
              var jsonStr2 = data.substring(data.indexOf("["));
              var parsed2 = JSON.parse(jsonStr2);
              if (parsed2[0] === "fishing-result" && parsed2[1]) {
                window.__lastFish = parsed2[1];
                console.log(
                  "[LTModMenu] Fish result:",
                  JSON.stringify(parsed2[1]).substring(0, 200),
                );
              }
            }
          } catch (err) {
            console.log("[LTModMenu] WS message parse error:", err.message);
          }
        });

        return ws;
      };
      window.WebSocket.prototype = OrigWS.prototype;
      Object.defineProperty(window.WebSocket, "CONNECTING", { value: 0 });
      Object.defineProperty(window.WebSocket, "OPEN", { value: 1 });
      Object.defineProperty(window.WebSocket, "CLOSING", { value: 2 });
      Object.defineProperty(window.WebSocket, "CLOSED", { value: 3 });
      console.log("[LTModMenu] WebSocket constructor hooked");

      // ══════════════════════════════════════════════
      //  FONCTIONS UTILITAIRES
      // ══════════════════════════════════════════════

      window.__autoSolveChallenge = function (challenge) {
        console.log("[LTModMenu] autoSolveChallenge called");
        var response = window.__solveFishingChallenge(challenge);
        if (window.__gameWS && window.__gameWS.readyState === 1) {
          var msg =
            "42" +
            JSON.stringify([
              "getFishingResult",
              { result: "success", response: response },
            ]);
          console.log(
            "[LTModMenu] Sending auto-solve via WS:",
            msg.substring(0, 100),
          );
          window.__gameWS.send(msg);
          return true;
        }
        console.log(
          "[LTModMenu] autoSolve FAILED: WS not ready, readyState:",
          window.__gameWS ? window.__gameWS.readyState : "no WS",
        );
        return false;
      };

      window.__forceEndMinigame = function () {
        console.log("[LTModMenu] forceEndMinigame called");
        try {
          var app = window.__gameApp;
          if (app && app.localPlayer) {
            var lp = app.localPlayer;
            console.log(
              "[LTModMenu] localPlayer keys:",
              Object.keys(lp)
                .filter(function (k) {
                  return (
                    k.includes("mini") ||
                    k.includes("fish") ||
                    k.includes("game")
                  );
                })
                .join(","),
            );
            if (lp.fishingMinigame) {
              console.log("[LTModMenu] Found fishingMinigame, destroying...");
              if (lp.fishingMinigame.destroy) lp.fishingMinigame.destroy();
              lp.fishingMinigame = null;
              return true;
            }
            if (lp.minigame) {
              console.log("[LTModMenu] Found minigame, destroying...");
              if (lp.minigame.destroy) lp.minigame.destroy();
              lp.minigame = null;
              return true;
            }
            console.log("[LTModMenu] No minigame found on localPlayer");
          } else {
            console.log("[LTModMenu] No gameApp or localPlayer");
          }
        } catch (e) {
          console.log("[LTModMenu] forceEndMinigame error:", e.message);
        }
        return false;
      };

      // ══════════════════════════════════════════════
      //  BOUCLE DE PECHE (pure JS)
      // ══════════════════════════════════════════════

      var fishingLoopRunning = false;

      function sleep(ms) {
        return new Promise(function (resolve) {
          setTimeout(resolve, ms);
        });
      }

      function wsSend(ev, data) {
        if (window.__gameWS && window.__gameWS.readyState === 1) {
          window.__gameWS.send("42" + JSON.stringify([ev, data]));
          console.log("[LTModMenu] wsSend:", ev);
          return true;
        }
        console.log("[LTModMenu] wsSend FAILED:", ev, "- WS not ready");
        return false;
      }

      function gameClick(x, y) {
        var canvas = document.querySelector("canvas");
        if (!canvas) {
          console.log("[LTModMenu] gameClick: no canvas found");
          return;
        }
        var rect = canvas.getBoundingClientRect();
        var opts = {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          button: 0,
        };
        canvas.dispatchEvent(new MouseEvent("mousedown", opts));
        canvas.dispatchEvent(new MouseEvent("mouseup", opts));
        canvas.dispatchEvent(new MouseEvent("click", opts));
        console.log("[LTModMenu] gameClick at:", x, y);
      }

      function isCastVisible() {
        // Chercher dans le DOM
        var castBtn = document.getElementById("cast-button");
        if (castBtn && castBtn.offsetParent !== null) {
          console.log("[LTModMenu] CAST found by ID");
          return castBtn;
        }

        // Chercher par classe
        var byClass = document.querySelector('[class*="cast" i]');
        if (byClass && byClass.offsetParent !== null) {
          console.log("[LTModMenu] CAST found by class:", byClass.className);
          return byClass;
        }

        // Chercher par texte
        var buttons = document.querySelectorAll(
          'button, div[role="button"], [onclick]',
        );
        for (var i = 0; i < buttons.length; i++) {
          var txt = (buttons[i].textContent || "").trim().toLowerCase();
          if (txt.includes("cast")) {
            console.log("[LTModMenu] CAST found by text:", txt);
            return buttons[i];
          }
        }

        // Chercher des images avec alt "cast"
        var imgs = document.querySelectorAll(
          'img[alt*="cast" i], img[src*="cast" i]',
        );
        if (imgs.length > 0) {
          console.log("[LTModMenu] CAST found by img");
          return imgs[0].closest("button") || imgs[0].parentElement;
        }

        return null;
      }

      function isReelVisible() {
        var reelBtn = document.getElementById("reel-button");
        if (reelBtn && reelBtn.offsetParent !== null) {
          console.log("[LTModMenu] REEL found by ID");
          return reelBtn;
        }

        var byClass = document.querySelector('[class*="reel" i]');
        if (byClass && byClass.offsetParent !== null) {
          console.log("[LTModMenu] REEL found by class:", byClass.className);
          return byClass;
        }

        var buttons = document.querySelectorAll(
          'button, div[role="button"], [onclick]',
        );
        for (var i = 0; i < buttons.length; i++) {
          var txt = (buttons[i].textContent || "").trim().toLowerCase();
          if (txt.includes("reel")) {
            console.log("[LTModMenu] REEL found by text:", txt);
            return buttons[i];
          }
        }
        return null;
      }

      function updateHUD() {
        var st = window.__fishStats;
        var el = function (id) {
          return document.getElementById(id);
        };
        if (!el("lt-total")) return;
        el("lt-total").textContent = st.total;
        el("lt-gold").textContent = st.gold.toLocaleString();
        el("lt-common").textContent = st.common;
        el("lt-uncommon").textContent = st.uncommon;
        el("lt-rare").textContent = st.rare;
        el("lt-epic").textContent = st.epic;
        el("lt-legendary").textContent = st.legendary;
        el("lt-secret").textContent = st.secret;
        el("lt-event").textContent = st.event;
        if (st.last_fish && el("lt-last"))
          el("lt-last").textContent = st.last_fish;
      }

      async function fishingLoop() {
        if (fishingLoopRunning) {
          console.log("[LTModMenu] fishingLoop already running, skipping");
          return;
        }
        fishingLoopRunning = true;
        console.log("[LTModMenu] === FISHING LOOP STARTED ===");

        while (true) {
          if (window.__botPaused) {
            await sleep(300);
            continue;
          }

          // ── 1. CAST ──
          console.log("[LTModMenu] [1] Searching for CAST button...");
          var castFound = false;
          var castSearchStart = Date.now();
          while (!castFound) {
            if (window.__botPaused) {
              await sleep(300);
              continue;
            }

            var castEl = isCastVisible();
            if (castEl) {
              await sleep(100 + Math.random() * 200);
              console.log(
                "[LTModMenu] [1] Clicking CAST button:",
                castEl.tagName,
                castEl.className || castEl.id || "",
              );
              castEl.click();
              console.log("[LTModMenu] [1] CAST CLICKED!");
              await sleep(1000);
              castFound = true;
            } else {
              if ((Date.now() - castSearchStart) % 5000 < 150) {
                console.log(
                  "[LTModMenu] [1] Still searching for CAST... (" +
                    Math.round((Date.now() - castSearchStart) / 1000) +
                    "s)",
                );
              }
            }
            await sleep(100);
          }

          // ── 2. Attente poisson ──
          console.log(
            "[LTModMenu] [2] Waiting for fish bite (fishCaught WS event)...",
          );
          var biteData = null;
          var start = Date.now();
          while (!biteData) {
            if (window.__botPaused) {
              await sleep(300);
              continue;
            }
            var b = window.__fishBite;
            if (b) {
              window.__fishBite = null;
              biteData = b;
              console.log(
                "[LTModMenu] [2] FISH BITE detected! Data:",
                JSON.stringify(b).substring(0, 150),
              );
              break;
            }
            if (Date.now() - start > 45000) {
              console.log("[LTModMenu] [2] TIMEOUT 45s, retrying cycle...");
              break;
            }
            await sleep(100);
          }

          if (!biteData) {
            console.log("[LTModMenu] [2] No bite data, restarting cycle");
            continue;
          }

          // ── 3. REEL + Auto-solve ──
          var challenge =
            biteData && biteData.challenge ? biteData.challenge : "";
          console.log(
            "[LTModMenu] [3] Challenge present:",
            !!challenge,
            challenge ? "length=" + challenge.length : "",
          );

          await sleep(100 + Math.random() * 200);
          var reelEl = isReelVisible();
          if (reelEl) {
            console.log(
              "[LTModMenu] [3] Clicking REEL:",
              reelEl.tagName,
              reelEl.className || reelEl.id || "",
            );
            reelEl.click();
            console.log("[LTModMenu] [3] REEL CLICKED!");
          } else {
            console.log("[LTModMenu] [3] WARNING: REEL button not found!");
          }

          if (challenge) {
            console.log("[LTModMenu] [3] Waiting 500ms before auto-solve...");
            await sleep(500);
            window.__blockFishingFail = true;
            console.log("[LTModMenu] [3] Fail blocking ON");
            var solved = window.__autoSolveChallenge(challenge);
            console.log("[LTModMenu] [3] Auto-solve result:", solved);
          }

          // ── 4. Attente fishing-result ──
          console.log("[LTModMenu] [4] Waiting for fishing-result WS event...");
          var fishData = null;
          start = Date.now();
          while (!fishData) {
            fishData = window.__lastFish;
            if (fishData) {
              console.log(
                "[LTModMenu] [4] FISH RESULT received:",
                JSON.stringify(fishData).substring(0, 150),
              );
              break;
            }
            if (Date.now() - start > 10000) {
              console.log("[LTModMenu] [4] TIMEOUT 10s waiting for result");
              break;
            }
            await sleep(200);
          }

          // Forcer fermeture minijeu
          if (challenge && fishData) {
            console.log("[LTModMenu] [4] Force ending minigame...");
            window.__forceEndMinigame();
            await sleep(300);
            window.__blockFishingFail = false;
            console.log("[LTModMenu] [4] Fail blocking OFF");
          }

          // ── 5. Traiter le poisson ──
          await sleep(500);
          if (!fishData) fishData = window.__lastFish;
          window.__lastFish = null;

          if (!fishData) {
            console.log("[LTModMenu] [5] No fish data at all, skipping");
            await sleep(300);
            var closeBtn = document.querySelector('[class*="close" i]');
            if (closeBtn) {
              console.log("[LTModMenu] [5] Clicking close button");
              closeBtn.click();
            }
            continue;
          }

          var fishName = fishData.name || "";
          var weight = fishData.weight || 0;
          var isShiny = fishData.isShiny || false;
          var rarity = getRarity(fishName);
          var statKey = rarity;
          if (rarity === "halloween" || rarity === "christmas")
            statKey = "event";
          var goldEarned = calculateGold(fishName, weight, isShiny);

          console.log(
            "[LTModMenu] [5] Fish: " +
              fishName +
              " | " +
              rarity +
              " | " +
              weight +
              "kg | shiny=" +
              isShiny +
              " | gold=" +
              goldEarned,
          );

          var st = window.__fishStats;
          if (st[statKey] !== undefined) st[statKey]++;
          else st.unknown++;
          st.total++;
          st.gold += goldEarned;

          var shinyTag = isShiny ? " SHINY!" : "";
          var goldStr = goldEarned ? " +" + goldEarned + "g" : "";
          st.last_fish =
            fishName +
            " (" +
            rarity +
            ") " +
            weight +
            "kg" +
            shinyTag +
            goldStr;

          updateHUD();
          saveData("fishStats", window.__fishStats);

          // Fermer popup
          console.log("[LTModMenu] [5] Closing popup...");
          await sleep(300);
          var closeBtn = document.querySelector('[class*="close" i]');
          if (closeBtn) {
            console.log(
              "[LTModMenu] [5] Found close button:",
              closeBtn.tagName,
              closeBtn.className,
            );
            closeBtn.click();
          } else {
            console.log(
              "[LTModMenu] [5] No close button found, clicking center of screen",
            );
            gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
          }
          await sleep(150);
          gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
          await sleep(300 + Math.random() * 300);

          console.log(
            "[LTModMenu] === FISH #" +
              st.total +
              ": " +
              fishName +
              " [" +
              rarity.toUpperCase() +
              "] " +
              weight +
              "kg" +
              shinyTag +
              " | +" +
              goldEarned +
              "g (total: " +
              st.gold +
              "g) ===",
          );
        }
      }

      // ══════════════════════════════════════════════
      //  HUD - MOD MENU
      // ══════════════════════════════════════════════

      function initHUD() {
        console.log("[LTModMenu] initHUD() called");
        console.log("[LTModMenu] document.body exists:", !!document.body);
        console.log(
          "[LTModMenu] Existing HUD:",
          !!document.getElementById("lt-hud"),
        );

        if (document.getElementById("lt-hud")) {
          console.log("[LTModMenu] HUD already exists, skipping");
          return;
        }

        if (!document.body) {
          console.log("[LTModMenu] No document.body yet, retrying in 500ms...");
          setTimeout(initHUD, 500);
          return;
        }

        // ── Lofi Town style CSS (dark navy + lavender accents) ──
        var style = document.createElement("style");
        style.textContent = [
          '@font-face { font-family:"HabitSmall"; src:url("https://app.lofi.town/fonts/habit_small.ttf") format("truetype"); }',
          "#lt-hud { position:fixed;left:10px;top:50%;transform:translateY(-50%);z-index:999999;",
          '  background:#1e1e3a;color:#c8c0e0;font-family:"HabitSmall",monospace;',
          "  width:280px;user-select:none;overflow:hidden;",
          "  border:3px solid #3a3a6a;border-radius:12px;",
          "  box-shadow:0 4px 20px rgba(0,0,0,0.5);",
          "  image-rendering:pixelated; }",
          "#lt-hud .lt-header { padding:12px 14px;background:#2a2a50;",
          "  border-bottom:2px solid #3a3a6a;display:flex;align-items:center;cursor:grab;",
          "  border-radius:9px 9px 0 0; }",
          "#lt-hud .lt-header span.lt-title { font-size:22px;flex:1;color:#b8b0d8;letter-spacing:0.5px; }",
          "#lt-hud .lt-header span.lt-ver { font-size:14px;color:#6a6a9a; }",
          "#lt-hud .lt-header button.lt-back-btn { border:none;background:none;color:#8a8abe;",
          "  cursor:pointer;font-size:22px;padding:0 10px 0 0;font-family:inherit; }",
          "#lt-hud .lt-header button.lt-back-btn:hover { color:#c8c0e0; }",
          "#lt-hud .lt-body { padding:6px 0; }",
          "#lt-hud .lt-item { display:flex;align-items:center;justify-content:space-between;",
          "  padding:10px 14px;cursor:pointer;border:none;background:none;color:#c8c0e0;",
          "  width:100%;font-size:18px;font-family:inherit;text-align:left; }",
          "#lt-hud .lt-item:hover { background:#2a2a50; }",
          "#lt-hud .lt-item .lt-arrow { color:#6a6a9a;font-size:16px; }",
          "#lt-hud .lt-item .lt-tag { font-size:13px;color:#8a8abe;margin-left:8px;",
          "  background:#2a2a50;padding:2px 6px;border:1px solid #4a4a7a;border-radius:4px; }",
          "#lt-hud .lt-item .lt-sub { font-size:14px;color:#6a6a9a; }",
          "#lt-hud .lt-sep { border-top:2px solid #2a2a50;margin:4px 12px; }",
          "#lt-hud .lt-action { display:block;width:calc(100% - 24px);margin:5px 12px;padding:10px 0;",
          "  border:2px solid #4a4a7a;cursor:pointer;font-size:17px;color:#c8c0e0;",
          "  text-align:center;font-family:inherit;background:#2a2a50;border-radius:6px; }",
          "#lt-hud .lt-action:hover { background:#3a3a6a;color:#e0d8f0; }",
          "#lt-hud .lt-action.lt-primary { background:#2a2a50; }",
          "#lt-hud .lt-action.lt-success { background:#1a3a1a;border-color:#2a6a2a;color:#6abe6a; }",
          "#lt-hud .lt-action.lt-success:hover { background:#2a4a2a; }",
          "#lt-hud .lt-action.lt-danger { background:#3a1a1a;border-color:#6a2a2a;color:#be6a6a; }",
          "#lt-hud .lt-action.lt-danger:hover { background:#4a2a2a; }",
          "#lt-hud .lt-action.lt-muted { background:#1e1e3a;border-color:#3a3a6a;color:#6a6a9a;font-size:15px; }",
          "#lt-hud .lt-status { font-size:15px;color:#6a6a9a;text-align:center;padding:6px 14px;min-height:18px; }",
          "#lt-hud .lt-input { background:#14142a;border:2px solid #3a3a6a;border-radius:6px;",
          "  color:#c8c0e0;font-size:16px;padding:8px 10px;width:calc(100% - 24px);margin:5px 12px;",
          "  box-sizing:border-box;outline:none;font-family:inherit; }",
          "#lt-hud .lt-input:focus { border-color:#6a6abe;background:#1a1a30; }",
          "#lt-hud .lt-stat-row { display:flex;justify-content:space-between;padding:4px 14px;font-size:17px; }",
          "#lt-hud .lt-warn { font-size:13px;color:#5a5a8a;text-align:center;padding:6px 14px; }",
          "#lt-hud .lt-wp-row { display:flex;align-items:center;gap:0; }",
          "#lt-hud .lt-wp-row .lt-item { flex:1; }",
          "#lt-hud .lt-wp-row .lt-del { border:none;background:none;color:#be6a6a;",
          "  cursor:pointer;padding:10px 12px;font-size:17px;font-family:inherit; }",
          "#lt-hud .lt-wp-row .lt-del:hover { color:#e07070;background:#3a1a1a; }",
        ].join(" ");
        document.head.appendChild(style);

        var hud = document.createElement("div");
        hud.id = "lt-hud";
        document.body.appendChild(hud);
        console.log("[LTModMenu] HUD div created and appended to body");

        var currentPage = "main";

        function doTP(x, y, dir) {
          console.log("[LTModMenu] doTP called:", x, y, dir);
          var app = window.__gameApp;
          if (app && app.localPlayer) {
            var lp = app.localPlayer;
            console.log(
              "[LTModMenu] localPlayer found, current pos:",
              lp.currentPos.x,
              lp.currentPos.y,
            );
            lp.currentPos.x = x;
            lp.currentPos.y = y;
            lp.parent.x = x;
            lp.parent.y = y;
            if (lp.serverPos) {
              lp.serverPos.x = x;
              lp.serverPos.y = y;
            }
            if (lp.oldPos) {
              lp.oldPos.x = x;
              lp.oldPos.y = y;
            }
            if (dir) lp.direction = dir;
            wsSend("clientUpdatePosition", {
              x: x,
              y: y,
              direction: dir || "down",
            });
            try {
              app.currentCamera.moveCameraToPlayer(true);
              console.log("[LTModMenu] Camera moved");
            } catch (e) {
              console.log("[LTModMenu] Camera move failed:", e.message);
            }
            console.log("[LTModMenu] TP done to:", x, y);
            return true;
          }
          console.log("[LTModMenu] doTP FAILED: no gameApp or localPlayer");
          return false;
        }

        function getPos() {
          var app = window.__gameApp;
          if (app && app.localPlayer) {
            var lp = app.localPlayer;
            return {
              x: Math.round(lp.currentPos.x),
              y: Math.round(lp.currentPos.y),
              direction: lp.direction || "down",
            };
          }
          return window.__playerPos || null;
        }

        function render() {
          console.log("[LTModMenu] render() page:", currentPage);
          var pages = {
            main: renderMain,
            poi: renderPOI,
            tp: renderTP,
            actions: renderActions,
            fish: renderFish,
          };
          (pages[currentPage] || renderMain)();
        }

        function mkHeader(title, hasBack) {
          return (
            '<div class="lt-header" id="lt-header">' +
            (hasBack
              ? '<button class="lt-back-btn" id="lt-back">&lt;</button>'
              : "") +
            '<span class="lt-title">' +
            title +
            "</span>" +
            '<span class="lt-ver">v2.2</span>' +
            "</div>"
          );
        }

        function mkItem(id, label, right) {
          return (
            '<button class="lt-item" id="' +
            id +
            '">' +
            "<span>" +
            label +
            "</span>" +
            '<span class="lt-arrow">' +
            (right || "&gt;&gt;&gt;") +
            "</span>" +
            "</button>"
          );
        }

        function mkItemTag(id, label, tag) {
          return (
            '<button class="lt-item" id="' +
            id +
            '">' +
            "<span>" +
            label +
            '<span class="lt-tag">' +
            tag +
            "</span></span>" +
            '<span class="lt-arrow">&gt;&gt;&gt;</span>' +
            "</button>"
          );
        }

        function bindNav() {
          var back = document.getElementById("lt-back");
          if (back)
            back.onclick = function () {
              currentPage = "main";
              render();
            };
          var go = {
            poi: "lt-go-poi",
            tp: "lt-go-tp",
            actions: "lt-go-actions",
            fish: "lt-go-fish",
          };
          for (var p in go) {
            (function (page) {
              var el = document.getElementById(go[page]);
              if (el)
                el.onclick = function () {
                  currentPage = page;
                  render();
                };
            })(p);
          }
        }

        // ── PAGE: Main ──
        function renderMain() {
          hud.innerHTML =
            mkHeader("LTModMenu") +
            '<div class="lt-body">' +
            mkItemTag("lt-go-poi", "Saved Locations", "DETECT") +
            mkItemTag("lt-go-tp", "Teleport Options", "DETECT") +
            mkItemTag("lt-go-actions", "Player Actions", "DETECT") +
            mkItem("lt-go-fish", "Auto Fishing") +
            "</div>";
          bindNav();
        }

        // ── PAGE: POI ──
        var POI = [
          { name: "Fishing Spot", x: 860, y: 380 },
          { name: "Merchant", x: 793, y: 198 },
        ];

        function renderPOI() {
          var items = POI.map(function (p, i) {
            return mkItem(
              "lt-poi-" + i,
              p.name,
              '<span class="lt-sub">' + p.x + ", " + p.y + "</span>",
            );
          }).join("");
          hud.innerHTML =
            mkHeader("Saved Locations", true) +
            '<div class="lt-body">' +
            items +
            "</div>" +
            '<div class="lt-status" id="lt-poi-status"></div>';
          bindNav();
          POI.forEach(function (p, i) {
            document.getElementById("lt-poi-" + i).onclick = function () {
              var ok = doTP(p.x, p.y, "down");
              var st = document.getElementById("lt-poi-status");
              st.textContent = ok
                ? "Teleported to " + p.name
                : "Error: gameApp not captured";
              st.style.color = ok ? "#5ad85a" : "#f05050";
            };
          });
        }

        // ── PAGE: TP ──
        function renderTP() {
          var wps = window.__waypoints || [];
          var wpList = wps
            .map(function (w, i) {
              return (
                '<div class="lt-wp-row">' +
                '<button class="lt-item" id="lt-wtp-' +
                i +
                '">' +
                "<span>" +
                w.name +
                "</span>" +
                '<span class="lt-sub">' +
                w.x +
                ", " +
                w.y +
                "</span>" +
                "</button>" +
                '<button class="lt-del" id="lt-wdel-' +
                i +
                '">X</button>' +
                "</div>"
              );
            })
            .join("");

          hud.innerHTML =
            mkHeader("Teleport Options", true) +
            '<div class="lt-body">' +
            (wpList || '<div class="lt-status">No waypoints saved</div>') +
            "</div>" +
            '<div class="lt-sep"></div>' +
            '<input class="lt-input" id="lt-wp-name" placeholder="Waypoint name...">' +
            '<button class="lt-action lt-primary" id="lt-wp-add">Save Current Position</button>' +
            '<div class="lt-status" id="lt-tp-status"></div>';
          bindNav();

          wps.forEach(function (w, i) {
            document.getElementById("lt-wtp-" + i).onclick = function () {
              var ok = doTP(w.x, w.y, w.direction || "down");
              var st = document.getElementById("lt-tp-status");
              st.textContent = ok
                ? "Teleported to " + w.name
                : "Error: gameApp not captured";
              st.style.color = ok ? "#5ad85a" : "#f05050";
            };
            document.getElementById("lt-wdel-" + i).onclick = function () {
              window.__waypoints.splice(i, 1);
              saveData("waypoints", window.__waypoints);
              renderTP();
            };
          });

          document.getElementById("lt-wp-add").onclick = function () {
            var pos = getPos();
            var nameEl = document.getElementById("lt-wp-name");
            var name = (nameEl.value || "").trim() || "WP " + (wps.length + 1);
            var st = document.getElementById("lt-tp-status");
            if (pos) {
              window.__waypoints.push({
                name: name,
                x: pos.x,
                y: pos.y,
                direction: pos.direction || "down",
              });
              saveData("waypoints", window.__waypoints);
              console.log("[LTModMenu] Waypoint saved:", name, pos.x, pos.y);
              renderTP();
            } else {
              st.textContent = "Error: position unknown";
              st.style.color = "#e74c3c";
            }
          };
        }

        // ── PAGE: Actions ──
        function renderActions() {
          hud.innerHTML =
            mkHeader("Player Actions", true) +
            '<div class="lt-body">' +
            '<button class="lt-action lt-primary" id="lt-sit">Sit Down</button>' +
            '<button class="lt-action lt-primary" id="lt-fish-here">Force Fishing</button>' +
            '<button class="lt-action lt-muted" id="lt-unsit">Stand Up</button>' +
            "</div>" +
            '<div class="lt-status" id="lt-act-status"></div>' +
            '<div class="lt-warn">These actions are detectable by the server</div>';
          bindNav();

          document.getElementById("lt-sit").onclick = function () {
            console.log("[LTModMenu] SIT button clicked");
            var app = window.__gameApp;
            if (app && app.localPlayer) {
              var lp = app.localPlayer;
              console.log(
                '[LTModMenu] Calling sit("portable-' +
                  (lp.direction || "down") +
                  '")',
              );
              lp.sit("portable-" + (lp.direction || "down"));
              document.getElementById("lt-act-status").textContent = "Sitting";
              document.getElementById("lt-act-status").style.color = "#5ad85a";
            } else {
              console.log("[LTModMenu] SIT failed: no gameApp/localPlayer");
              document.getElementById("lt-act-status").textContent =
                "Error: gameApp not captured";
              document.getElementById("lt-act-status").style.color = "#f05050";
            }
          };
          document.getElementById("lt-fish-here").onclick = function () {
            console.log("[LTModMenu] FISH HERE button clicked");
            var app = window.__gameApp;
            if (app && app.localPlayer) {
              var lp = app.localPlayer;
              lp.sit("portable-" + (lp.direction || "down"));
              setTimeout(function () {
                if (lp.setSitAnimation) lp.setSitAnimation("fishing");
                wsSend("updateSitAnimation", "fishing");
                document.getElementById("lt-act-status").textContent =
                  "Fishing forced";
                document.getElementById("lt-act-status").style.color =
                  "#5a9af0";
              }, 500);
            }
          };
          document.getElementById("lt-unsit").onclick = function () {
            console.log("[LTModMenu] UNSIT button clicked");
            var app = window.__gameApp;
            if (app && app.localPlayer) {
              app.localPlayer.unsit &&
                app.localPlayer.unsit({ withCooldown: false, emitUnsit: true });
              document.getElementById("lt-act-status").textContent = "Standing";
              document.getElementById("lt-act-status").style.color = "#6a6a9a";
            }
          };
        }

        // ── PAGE: Peche ──
        function renderFish() {
          var paused = window.__botPaused;
          hud.innerHTML =
            mkHeader("Auto Fishing", true) +
            '<div class="lt-body" style="padding:4px 0;">' +
            '<div class="lt-stat-row" style="padding:10px 14px;">' +
            '<span style="color:#6a6a9a;font-size:16px;">Session <span id="lt-time">00:00:00</span></span>' +
            '<button class="lt-action ' +
            (paused ? "lt-success" : "lt-danger") +
            '" id="lt-toggle" style="width:auto;margin:0;padding:6px 18px;font-size:16px;">' +
            (paused ? "START" : "STOP") +
            "</button>" +
            "</div>" +
            '<div class="lt-sep"></div>' +
            '<div class="lt-stat-row" style="font-size:20px;font-weight:700;padding:8px 14px;color:#e0d8f0;">' +
            '<span>Total</span><span id="lt-total">0</span></div>' +
            '<div class="lt-stat-row" style="color:#f0c040;font-weight:600;font-size:18px;">' +
            '<span>Gold</span><span id="lt-gold">0</span></div>' +
            '<div class="lt-sep"></div>' +
            '<div class="lt-stat-row" style="color:#8a8a9a;"><span>Common</span><span id="lt-common">0</span></div>' +
            '<div class="lt-stat-row" style="color:#5ad85a;"><span>Uncommon</span><span id="lt-uncommon">0</span></div>' +
            '<div class="lt-stat-row" style="color:#5a9af0;"><span>Rare</span><span id="lt-rare">0</span></div>' +
            '<div class="lt-stat-row" style="color:#b06ad8;"><span>Epic</span><span id="lt-epic">0</span></div>' +
            '<div class="lt-stat-row" style="color:#f0a030;"><span>Legendary</span><span id="lt-legendary">0</span></div>' +
            '<div class="lt-stat-row" style="color:#f05050;"><span>Secret</span><span id="lt-secret">0</span></div>' +
            '<div class="lt-stat-row" style="color:#6a6a9a;"><span>Event</span><span id="lt-event">0</span></div>' +
            '<div class="lt-sep"></div>' +
            '<div class="lt-status" id="lt-last" style="font-size:14px;"></div>' +
            '<button class="lt-action lt-muted" id="lt-reset">Reset Stats</button>' +
            "</div>";
          bindNav();

          document.getElementById("lt-toggle").onclick = function () {
            window.__botPaused = !window.__botPaused;
            console.log(
              "[LTModMenu] Toggle pause:",
              window.__botPaused ? "PAUSED" : "RUNNING",
            );
            if (!window.__botPaused && !fishingLoopRunning) {
              fishingLoop();
            }
            renderFish();
          };

          document.getElementById("lt-reset").onclick = function () {
            if (!confirm("Reset all fishing stats?")) return;
            window.__fishStats = {
              common: 0,
              uncommon: 0,
              rare: 0,
              epic: 0,
              legendary: 0,
              secret: 0,
              event: 0,
              unknown: 0,
              total: 0,
              gold: 0,
              last_fish: "",
            };
            saveData("fishStats", window.__fishStats);
            console.log("[LTModMenu] Stats reset");
            renderFish();
          };

          var st = window.__fishStats;
          if (st) updateHUD();
        }

        // ── Drag ──
        var dragging = false,
          dx = 0,
          dy = 0;
        hud.addEventListener("mousedown", function (e) {
          if (
            e.target.id === "lt-header" ||
            (e.target.parentElement &&
              e.target.parentElement.id === "lt-header")
          ) {
            dragging = true;
            dx = e.clientX - hud.offsetLeft;
            dy = e.clientY - hud.offsetTop;
            hud.style.transform = "none";
          }
        });
        document.addEventListener("mousemove", function (e) {
          if (!dragging) return;
          hud.style.left = e.clientX - dx + "px";
          hud.style.top = e.clientY - dy + "px";
        });
        document.addEventListener("mouseup", function () {
          dragging = false;
        });

        // ── Timer ──
        var startTime = Date.now();
        setInterval(function () {
          var el = document.getElementById("lt-time");
          if (!el) return;
          var s = Math.floor((Date.now() - startTime) / 1000);
          el.textContent =
            String(Math.floor(s / 3600)).padStart(2, "0") +
            ":" +
            String(Math.floor((s % 3600) / 60)).padStart(2, "0") +
            ":" +
            String(s % 60).padStart(2, "0");
        }, 1000);

        // ── Retry gameApp capture ──
        var retryCount = 0;
        var retryInterval = setInterval(function () {
          retryCount++;
          if (window.__gameApp) {
            console.log(
              "[LTModMenu] gameApp ready! (after " + retryCount + " checks)",
            );
            clearInterval(retryInterval);
            return;
          }
          if (window.__ltSpyRetry) {
            var ok = window.__ltSpyRetry();
            console.log(
              "[LTModMenu] Spy retry #" + retryCount + ":",
              ok ? "SUCCESS" : "waiting...",
            );
            if (ok) clearInterval(retryInterval);
          } else {
            if (retryCount % 5 === 0)
              console.log(
                "[LTModMenu] Waiting for spy retry function... (check #" +
                  retryCount +
                  ")",
              );
          }
        }, 1000);

        render();
        console.log("[LTModMenu] ========================================");
        console.log("[LTModMenu] HUD INJECTED AND RENDERED SUCCESSFULLY!");
        console.log("[LTModMenu] ========================================");

        // Lancer la sauvegarde auto
        startAutoSave();
      }

      // ══════════════════════════════════════════════
      //  INIT - Attendre que la page soit chargee
      // ══════════════════════════════════════════════

      console.log(
        "[LTModMenu] Setting up init, readyState:",
        document.readyState,
      );

      function tryInit() {
        console.log(
          "[LTModMenu] tryInit(), body:",
          !!document.body,
          "readyState:",
          document.readyState,
        );
        if (document.body) {
          // Attendre un peu que le jeu charge
          console.log("[LTModMenu] Body found, waiting 3s for game to load...");
          setTimeout(function () {
            console.log("[LTModMenu] 3s elapsed, initializing HUD...");
            initHUD();
          }, 3000);
        } else {
          console.log("[LTModMenu] No body yet, observing DOM...");
          var observer = new MutationObserver(function (mutations, obs) {
            if (document.body) {
              console.log("[LTModMenu] Body appeared via MutationObserver");
              obs.disconnect();
              setTimeout(function () {
                console.log("[LTModMenu] Delayed init after body appeared...");
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

      if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
      ) {
        console.log("[LTModMenu] Page already loaded/interactive, init now");
        tryInit();
      } else {
        console.log(
          "[LTModMenu] Page still loading, adding DOMContentLoaded listener",
        );
        document.addEventListener("DOMContentLoaded", function () {
          console.log("[LTModMenu] DOMContentLoaded fired");
          tryInit();
        });
        // Fallback au cas ou DOMContentLoaded est rate
        window.addEventListener("load", function () {
          console.log("[LTModMenu] window.load fired");
          if (!document.getElementById("lt-hud")) {
            console.log(
              "[LTModMenu] HUD not found on window.load, forcing init",
            );
            tryInit();
          }
        });
      }

      console.log("[LTModMenu] Init setup complete, waiting for page...");
    } +
    ")();";

  // Injecter le script dans la page
  if (document.documentElement) {
    document.documentElement.appendChild(script);
    console.log("[LTModMenu] Script tag injected into documentElement");
  } else {
    // Fallback si documentElement pas encore pret
    document.addEventListener("DOMContentLoaded", function () {
      document.documentElement.appendChild(script);
      console.log("[LTModMenu] Script tag injected (deferred)");
    });
  }
  script.remove(); // Nettoyage
  console.log("[LTModMenu] Script tag cleaned up");
})();
