import { log } from "@core/logger";
import { saveData, loadData } from "@core/storage";
import {
  BURROW_SPAWN_OFFSET_X,
  FALLBACK_SPAWN,
  FALLBACK_SCENE,
  JOIN_TIMEOUT_MS,
} from "@features/players/data/burrow-database";

export interface OwnBurrow {
  id: string;
  template: string;
  [key: string]: unknown;
}

export function visitBurrow(burrowId: string, template: string, ownerId: string): { success: boolean; message: string } {
  const globals = window.__gameGlobals;
  if (globals?.signal) {
    log("BURROW", "Visiting burrow via signal: id=" + burrowId + " template=" + template + " owner=" + ownerId);
    globals.signal.emit("visitBurrow", { burrowId, template, ownerId });
    return { success: true, message: "Joining burrow..." };
  }

  const app = window.__gameApp;
  if (!app?.loadScene) {
    return { success: false, message: "gameApp not captured" };
  }

  const cached = window.__sceneCache?.get(template);
  const scene = cached || { name: template, ...FALLBACK_SCENE };
  const spawn = scene.fastTravelSpawnPosition || FALLBACK_SPAWN;

  log("BURROW", "Visiting burrow via loadScene: id=" + burrowId + " template=" + template);

  app.loadScene({
    scene,
    burrow: { id: burrowId, subRoom: 0 },
    position: { x: spawn.x + BURROW_SPAWN_OFFSET_X, y: spawn.y, direction: spawn.direction },
  });

  const expectedRoom = "burrow:" + burrowId + ":0";
  const timeout = setTimeout(() => {
    if (app.currentServerRoomId !== expectedRoom) {
      log("BURROW", "Burrow visit timeout (current=" + app.currentServerRoomId + ")");
      if (app.backToMainScene) app.backToMainScene();
    }
  }, JOIN_TIMEOUT_MS);

  const ws = window.__gameWS;
  if (ws) {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data === "string" && e.data.includes(expectedRoom)) {
        clearTimeout(timeout);
        ws.removeEventListener("message", onMsg);
      }
    };
    ws.addEventListener("message", onMsg);
  }

  return { success: true, message: "Joining burrow..." };
}

// --- Own burrow helpers ---

export function getOwnBurrows(): OwnBurrow[] {
  const store = window.__stores?.useUserData;
  if (!store) return [];
  const state = store.getState();
  const burrows = state?.burrows;
  if (!Array.isArray(burrows)) return [];
  return burrows.filter((b: any) => {
    if (!b?.id) return false;
    const tmpl = b.template || b.templateId;
    return !!tmpl;
  }).map((b: any) => ({ ...b, template: b.template || b.templateId }));
}

export function getPreferredBurrowId(): string | null {
  return loadData<string | null>("preferredBurrow", null);
}

export function setPreferredBurrowId(id: string): void {
  saveData("preferredBurrow", id);
}

function resolveTargetBurrow(burrows: OwnBurrow[], burrowId?: string): OwnBurrow {
  if (burrowId) {
    const match = burrows.find(b => b.id === burrowId);
    if (match) return match;
  }

  const preferredId = getPreferredBurrowId();
  if (preferredId) {
    const match = burrows.find(b => b.id === preferredId);
    if (match) return match;
  }

  const activeId = window.__stores?.useUserData?.getState()?.activeBurrow;
  if (activeId) {
    const match = burrows.find(b => b.id === activeId);
    if (match) return match;
  }

  return burrows[0];
}

export function visitOwnBurrow(burrowId?: string): { success: boolean; message: string } {
  const burrows = getOwnBurrows();
  if (burrows.length === 0) {
    return { success: false, message: "No burrows found" };
  }

  const burrow = resolveTargetBurrow(burrows, burrowId);
  const ownerId = window.__localPlayerId || window.__stores?.useUserData?.getState()?.uid;
  if (!ownerId) {
    return { success: false, message: "Player ID unknown" };
  }

  const result = visitBurrow(burrow.id, burrow.template, ownerId);
  if (result.success) {
    setPreferredBurrowId(burrow.id);
    result.message = "Going home...";
  }
  return result;
}
