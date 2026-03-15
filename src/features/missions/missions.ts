import { log } from "@core/logger";
import { findMissionDatabase } from "@core/module-resolver";
import { MISSION_DB, type MissionDef } from "./data/mission-database";

export type { MissionDef };

export interface Mission {
  key: string;
  title: string;
  requiredAmount: number;
  pointsReward: number;
  progressKey: string;
}

// Try game's own mission DB first, fall back to local copy
let gameMissionDB: Record<string, MissionDef> | null = null;

function getGameMissionDB(): Record<string, MissionDef> | null {
  if (gameMissionDB) return gameMissionDB;
  if (!window.__wpRequire) return null;
  gameMissionDB = findMissionDatabase(window.__wpRequire) as Record<string, MissionDef> | null;
  if (gameMissionDB) log("MISSIONS", "Loaded " + Object.keys(gameMissionDB).length + " missions from game");
  return gameMissionDB;
}

function formatTitle(key: string): string {
  return key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function resolveMission(key: string): Mission {
  const gameDB = getGameMissionDB();
  const def = gameDB?.[key] ?? MISSION_DB[key];
  if (def) return { key, ...def };
  return { key, title: formatTitle(key), requiredAmount: 1, pointsReward: 0, progressKey: key };
}

interface MissionSetRaw {
  id: string;
  type: "DAILY" | "WEEKLY";
  startDate: string;
  endDate: string;
  missions: string[];
}

interface MissionStateRaw {
  dailyMissions: MissionSetRaw;
  weeklyMissions: MissionSetRaw;
  dailyMissionProgress: Record<string, number>;
  weeklyMissionProgress: Record<string, number>;
  progressMission: (key: string, amount?: number) => void;
}

function getMissionState(): MissionStateRaw | null {
  const store = window.__stores?.useMissionStore;
  if (!store) return null;
  return store.getState() as MissionStateRaw;
}

export function getDailyMissions(): { mission: Mission; current: number }[] {
  const state = getMissionState();
  if (!state) return [];
  const keys = state.dailyMissions?.missions ?? [];
  return keys.map((key) => {
    const mission = resolveMission(key);
    return { mission, current: state.dailyMissionProgress[key] ?? 0 };
  });
}

export function getWeeklyMissions(): { mission: Mission; current: number }[] {
  const state = getMissionState();
  if (!state) return [];
  const keys = state.weeklyMissions?.missions ?? [];
  return keys.map((key) => {
    const mission = resolveMission(key);
    return { mission, current: state.weeklyMissionProgress[key] ?? 0 };
  });
}

function isMissionComplete(mission: Mission, current: number): boolean {
  return current >= mission.requiredAmount;
}

function fireConfetti(): void {
  window.__gameGlobals?.signal.emit("confetti");
}

function completeSingle(mission: Mission, current: number): boolean {
  if (isMissionComplete(mission, current)) return false;
  const remaining = mission.requiredAmount - current;
  const state = getMissionState();
  if (!state) return false;
  state.progressMission(mission.progressKey, remaining);
  log("MISSIONS", "Completed: " + mission.key + " (+" + remaining + " " + mission.progressKey + ")");
  return true;
}

export function completeAllDailies(): number {
  const dailies = getDailyMissions();
  let completed = 0;
  for (const { mission, current } of dailies) {
    if (completeSingle(mission, current)) completed++;
  }
  if (completed > 0) fireConfetti();
  log("MISSIONS", "Auto-completed " + completed + " daily missions");
  return completed;
}

export function completeAllWeeklies(): number {
  const weeklies = getWeeklyMissions();
  let completed = 0;
  for (const { mission, current } of weeklies) {
    if (completeSingle(mission, current)) completed++;
  }
  if (completed > 0) fireConfetti();
  log("MISSIONS", "Auto-completed " + completed + " weekly missions");
  return completed;
}

export function completeMission(mission: Mission, current: number): boolean {
  const ok = completeSingle(mission, current);
  if (ok) fireConfetti();
  return ok;
}

export function isMissionStoreReady(): boolean {
  return !!window.__stores?.useMissionStore;
}

export function getMissionResetTimes(): { daily: string | null; weekly: string | null } {
  const state = getMissionState();
  return {
    daily: state?.dailyMissions?.endDate ?? null,
    weekly: state?.weeklyMissions?.endDate ?? null,
  };
}
