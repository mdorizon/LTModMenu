import { wsSend } from "@core/game";
import type { GameScene } from "@core/types/global";
import { log } from "@core/logger";
import { extractBurrowTemplates } from "@core/webpack-spy";

export function doTP(x: number, y: number, dir: string): boolean {
  log("TP", "doTP called: " + x + ", " + y + ", " + dir);
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
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
      log("TP", "Camera moved");
    } catch (e) {
      log("TP", "Camera move failed: " + (e as Error).message);
    }
    log("TP", "TP done to: " + x + ", " + y);
    return true;
  }
  log("TP", "doTP FAILED: no gameApp or localPlayer");
  return false;
}

// Webpack module IDs for scene definitions (same as game's Fast Travel)
const SCENE_WEBPACK_IDS: Record<string, { moduleId: number; exportName: string }> = {
  fishing: { moduleId: 43445, exportName: "fishingScene" },
  main: { moduleId: 46670, exportName: "mainScene" },
};

// Sub-maps that require navigating to a parent map first
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

  if (app.currentScene && app.currentScene.name) {
    window.__sceneCache.set(app.currentScene.name, app.currentScene);
    log("SCENE", "Scene cached (current): " + app.currentScene.name);
  }

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

  extractBurrowTemplates();

  log("SCENE", "Scene cache initialized: " + Array.from(window.__sceneCache.keys()).join(", "));
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
        log("SCENE", "Scene export not found: " + wpInfo.exportName);
      }
    })
    .catch((e: Error) => {
      log("SCENE", "Async scene load failed: " + e.message);
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
  log("SCENE", "Scene probe done, cached: " + Array.from(window.__sceneCache.keys()).join(", "));
}

export function doInterMapTP(
  x: number,
  y: number,
  dir: string,
  targetMap?: string,
): { success: boolean; message: string } {
  const currentMap = window.__gameApp?.currentScene?.name || "unknown";

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

  const parentMap = SUB_MAP_ROUTES[targetMap];
  if (parentMap) {
    const parentWp = SCENE_WEBPACK_IDS[parentMap];
    if (parentWp) {
      loadSceneFromWebpack(req, parentWp).then(() => {
        setTimeout(() => {
          probeInteractableScenes();
          const subScene = window.__sceneCache?.get(targetMap);
          if (subScene && app.loadScene) {
            app.loadScene({ scene: subScene });
            setTimeout(() => doTP(x, y, dir), 2000);
          } else {
            log("SCENE", "Sub-map not found after probe: " + targetMap);
          }
        }, 3000);
      });
      return { success: true, message: "Routing via " + parentMap + " → " + targetMap + "..." };
    }
  }

  const wpInfo = SCENE_WEBPACK_IDS[targetMap];
  if (wpInfo) {
    loadSceneFromWebpack(req, wpInfo).then(() => {
      setTimeout(() => doTP(x, y, dir), 2000);
    });
    return { success: true, message: "Switching to " + targetMap + "..." };
  }

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
