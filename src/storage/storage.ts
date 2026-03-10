import type { FishStats } from "../types/fish";
import type { Waypoint } from "../types/player";

const STORAGE_PREFIX = "ltmod_";

export function saveData(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    console.log("[LTModMenu] Saved to localStorage:", key);
  } catch (e) {
    console.log("[LTModMenu] localStorage save error:", (e as Error).message);
  }
}

export function loadData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) {
      console.log("[LTModMenu] No saved data for:", key, "- using default");
      return defaultValue;
    }
    const parsed = JSON.parse(raw) as T;
    console.log("[LTModMenu] Loaded from localStorage:", key);
    return parsed;
  } catch (e) {
    console.log("[LTModMenu] localStorage load error:", (e as Error).message);
    return defaultValue;
  }
}

export function startAutoSave(): void {
  setInterval(() => {
    saveData("waypoints", window.__waypoints);
    saveData("fishStats", window.__fishStats);
    console.log("[LTModMenu] Auto-save done");
  }, 30000);
  console.log("[LTModMenu] Auto-save started (every 30s)");
}

export function initGlobalState(): void {
  window.__lastFish = null;
  window.__fishBite = null;
  window.__gameWS = null;
  window.__blockFishingFail = false;
  window.__playerPos = null;
  window.__gameApp = null;
  window.__botPaused = true;
  window.__sceneCache = new Map();

  window.__waypoints = loadData<Waypoint[]>("waypoints", []);
  window.__fishStats = loadData<FishStats>("fishStats", {
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
    "[LTModMenu] Loaded stats: total=" + window.__fishStats.total + " gold=" + window.__fishStats.gold,
  );
}
