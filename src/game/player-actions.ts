import { solveFishingChallenge } from "./challenge-solver";
import type { PlayerPos, GameScene } from "../types/global";

export function wsSend(ev: string, data: unknown): boolean {
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    window.__gameWS.send("42" + JSON.stringify([ev, data]));
    console.log("[LTModMenu] wsSend:", ev);
    return true;
  }
  console.log("[LTModMenu] wsSend FAILED:", ev, "- WS not ready");
  return false;
}

export function gameClick(x: number, y: number): void {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.log("[LTModMenu] gameClick: no canvas found");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const opts: MouseEventInit = {
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

export function doTP(x: number, y: number, dir: string): boolean {
  console.log("[LTModMenu] doTP called:", x, y, dir);
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
    console.log("[LTModMenu] localPlayer found, current pos:", lp.currentPos.x, lp.currentPos.y);
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
    wsSend("clientUpdatePosition", { x, y, direction: dir || "down" });
    try {
      app.currentCamera.moveCameraToPlayer(true);
      console.log("[LTModMenu] Camera moved");
    } catch (e) {
      console.log("[LTModMenu] Camera move failed:", (e as Error).message);
    }
    console.log("[LTModMenu] TP done to:", x, y);
    return true;
  }
  console.log("[LTModMenu] doTP FAILED: no gameApp or localPlayer");
  return false;
}

export function getPos(): PlayerPos | null {
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
    return {
      x: Math.round(lp.currentPos.x),
      y: Math.round(lp.currentPos.y),
      direction: lp.direction || "down",
    };
  }
  return window.__playerPos || null;
}

export function autoSolveChallenge(challenge: string): boolean {
  console.log("[LTModMenu] autoSolveChallenge called");
  const response = solveFishingChallenge(challenge);
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    const msg = "42" + JSON.stringify(["getFishingResult", { result: "success", response }]);
    console.log("[LTModMenu] Sending auto-solve via WS:", msg.substring(0, 100));
    window.__gameWS.send(msg);
    return true;
  }
  console.log(
    "[LTModMenu] autoSolve FAILED: WS not ready, readyState:",
    window.__gameWS ? window.__gameWS.readyState : "no WS",
  );
  return false;
}

export function forceEndMinigame(): boolean {
  console.log("[LTModMenu] forceEndMinigame called");
  try {
    const app = window.__gameApp;
    if (app && app.localPlayer) {
      const lp = app.localPlayer;
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
    console.log("[LTModMenu] forceEndMinigame error:", (e as Error).message);
  }
  return false;
}

export function getCurrentMap(): string {
  const app = window.__gameApp;
  if (app && app.currentScene && app.currentScene.name) {
    return app.currentScene.name;
  }
  return "unknown";
}

// Webpack module IDs for scene definitions (same as game's Fast Travel)
const SCENE_WEBPACK_IDS: Record<string, { moduleId: number; exportName: string }> = {
  fishing: { moduleId: 43445, exportName: "fishingScene" },
  main: { moduleId: 46670, exportName: "mainScene" },
};

// Sub-maps that require navigating to a parent map first
// parentMap is loaded via webpack, then after it loads, the sub-map scene is
// available in the scene cache (populated by interactable probe)
const SUB_MAP_ROUTES: Record<string, string> = {
  "fishing-shop": "fishing",
  "coffee-shop": "main",
};

export function initSceneCache(): void {
  if (!window.__sceneCache) {
    window.__sceneCache = new Map<string, GameScene>();
  }
  const app = window.__gameApp;
  if (!app) return;

  // Cache the current scene immediately
  if (app.currentScene && app.currentScene.name) {
    window.__sceneCache.set(app.currentScene.name, app.currentScene);
    console.log("[LTModMenu] Scene cached (current):", app.currentScene.name);
  }

  // Load scenes from webpack module cache (sync, for already-loaded modules)
  const req = window.__wpRequire;
  if (req) {
    try {
      const cache = (req as any).c;
      if (cache) {
        for (const mod of Object.values(cache) as any[]) {
          if (!mod?.exports) continue;
          for (const val of Object.values(mod.exports) as any[]) {
            if (
              val &&
              typeof val === "object" &&
              typeof val.name === "string" &&
              val.fastTravelSpawnPosition
            ) {
              window.__sceneCache.set(val.name, val as GameScene);
            }
          }
        }
      }
    } catch (_e) {
      /* ignore */
    }
  }

  console.log(
    "[LTModMenu] Scene cache initialized:",
    Array.from(window.__sceneCache.keys()).join(", "),
  );
}

function loadSceneFromWebpack(
  req: (id: number) => any,
  wpInfo: { moduleId: number; exportName: string },
): Promise<void> {
  const app = window.__gameApp;
  return Promise.resolve()
    .then(() => req(wpInfo.moduleId))
    .then((mod: any) => {
      const scene = mod[wpInfo.exportName];
      if (scene && app && app.loadScene) {
        app.loadScene({ scene });
      } else {
        console.log("[LTModMenu] Scene export not found:", wpInfo.exportName);
      }
    })
    .catch((e: Error) => {
      console.log("[LTModMenu] Async scene load failed:", e.message);
    });
}

function probeInteractableScenes(): void {
  const app = window.__gameApp;
  if (!app || !app.interactables) return;

  const proto = Object.getPrototypeOf(app);
  if (!proto || typeof proto.loadScene !== "function") return;

  const currentLoadScene = proto.loadScene;
  proto.loadScene = function (_opts: { scene: GameScene }) {
    if (_opts.scene && _opts.scene.name) {
      window.__sceneCache.set(_opts.scene.name, _opts.scene);
    }
  };

  for (const inter of Object.values(
    app.interactables as Record<string, { onInteract?: () => void }>,
  )) {
    if (inter.onInteract) {
      try {
        inter.onInteract();
      } catch (_e) {
        /* ignore */
      }
    }
  }

  proto.loadScene = currentLoadScene;
  console.log(
    "[LTModMenu] Scene probe done, cached:",
    Array.from(window.__sceneCache.keys()).join(", "),
  );
}

export function doInterMapTP(
  x: number,
  y: number,
  dir: string,
  targetMap?: string,
): { success: boolean; message: string } {
  const currentMap = getCurrentMap();

  // Same map or no map specified: standard TP
  if (!targetMap || targetMap === "unknown" || targetMap === currentMap) {
    const ok = doTP(x, y, dir);
    return {
      success: ok,
      message: ok ? "Teleported" : "Error: gameApp not captured",
    };
  }

  const app = window.__gameApp;
  if (!app) {
    return { success: false, message: "Error: gameApp not available" };
  }

  const req = window.__wpRequire;
  if (!req) {
    return { success: false, message: "Error: webpack require not available" };
  }

  // Check if target is a sub-map that needs a parent loaded first
  const parentMap = SUB_MAP_ROUTES[targetMap];
  if (parentMap) {
    const parentWp = SCENE_WEBPACK_IDS[parentMap];
    if (parentWp) {
      // 2-step TP: load parent map via webpack, then load sub-map from cache
      loadSceneFromWebpack(req, parentWp).then(() => {
        // After parent loads, probe interactables to populate sub-map scenes
        setTimeout(() => {
          probeInteractableScenes();
          const subScene = window.__sceneCache?.get(targetMap);
          if (subScene && app.loadScene) {
            app.loadScene({ scene: subScene });
            setTimeout(() => doTP(x, y, dir), 2000);
          } else {
            console.log("[LTModMenu] Sub-map not found in cache after probe:", targetMap);
          }
        }, 3000);
      });
      return { success: true, message: "Routing via " + parentMap + " → " + targetMap + "..." };
    }
  }

  // Direct webpack import (same as game's Fast Travel button)
  const wpInfo = SCENE_WEBPACK_IDS[targetMap];
  if (wpInfo) {
    loadSceneFromWebpack(req, wpInfo).then(() => {
      setTimeout(() => doTP(x, y, dir), 2000);
    });
    return { success: true, message: "Switching to " + targetMap + "..." };
  }

  // Fallback: try scene cache
  const cachedScene = window.__sceneCache?.get(targetMap);
  if (cachedScene && app.loadScene) {
    app.loadScene({ scene: cachedScene });
    setTimeout(() => doTP(x, y, dir), 2000);
    return { success: true, message: "Switching to " + targetMap + "..." };
  }

  return {
    success: false,
    message: 'Map "' + targetMap + '" not available.',
  };
}

export function setupPlayerActions(): void {
  window.__autoSolveChallenge = autoSolveChallenge;
  window.__forceEndMinigame = forceEndMinigame;
}
