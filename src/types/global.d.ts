import type { FishStats, FishBiteData, FishResultData } from "./fish";
import type { PlayerPos, Waypoint, GameApp } from "./player";

declare global {
  interface Window {
    __gameWS: WebSocket | null;
    __gameApp: GameApp | null;
    __fishBite: FishBiteData | null;
    __lastFish: FishResultData | null;
    __blockFishingFail: boolean;
    __playerPos: PlayerPos | null;
    __botPaused: boolean;
    __waypoints: Waypoint[];
    __fishStats: FishStats;
    __solveFishingChallenge: (challenge: string) => string;
    __autoSolveChallenge: (challenge: string) => boolean;
    __forceEndMinigame: () => boolean;
    __ltSpyRetry?: () => boolean;
    __ltModMenuLoaded?: boolean;
    webpackChunk_N_E: unknown[];
  }
}
