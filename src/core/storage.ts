import type { FishStats } from "./types/fish.d";
import type { Waypoint } from "./types/player";
import { log } from "./logger";

const STORAGE_PREFIX = "ltmod_";

export function saveData(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    log("STORAGE", "Saved: " + key);
  } catch (e) {
    log("STORAGE", "Save error: " + (e as Error).message);
  }
}

export function loadData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) {
      log("STORAGE", "No saved data for: " + key + " - using default");
      return defaultValue;
    }
    const parsed = JSON.parse(raw) as T;
    log("STORAGE", "Loaded: " + key);
    return parsed;
  } catch (e) {
    log("STORAGE", "Load error: " + (e as Error).message);
    return defaultValue;
  }
}

export function startAutoSave(): void {
  setInterval(() => {
    saveData("waypoints", window.__waypoints);
    saveData("fishStats", window.__fishStats);
    log("STORAGE", "Auto-save done");
  }, 30000);
  log("STORAGE", "Auto-save started (every 30s)");
}

export function initGlobalState(): void {
  window.__lastFish = null;
  window.__fishBite = null;
  window.__gameWS = null;
  window.__blockFishingFail = false;
  window.__playerPos = null;
  window.__gameApp = null;
  window.__localPlayerId = null;
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

  log("STORAGE", "Global variables initialized");
  log("STORAGE", "Loaded waypoints: " + window.__waypoints.length);
  log("STORAGE", "Loaded stats: total=" + window.__fishStats.total + " gold=" + window.__fishStats.gold);
}
