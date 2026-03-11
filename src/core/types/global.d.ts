import type { FishStats, FishBiteData, FishResultData } from "../../features/fishing/types/fish.d";
import type { PlayerPos, Waypoint, GameApp } from "./player";

export interface GameScene {
  name: string;
  fastTravelSpawnPosition?: { x: number; y: number; direction: string };
  [key: string]: unknown;
}

declare global {
  const __DEV__: boolean;

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
    __sceneCache: Map<string, GameScene>;
    __wpRequire?: (id: number) => any;
    __ltSpyRetry?: () => boolean;
    __localPlayerId: string | null;
    __ltModMenuLoaded?: boolean;
    webpackChunk_N_E: unknown[];
  }
}
