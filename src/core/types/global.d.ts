import type { FishStats, FishBiteData, FishResultData } from "./fish.d";
import type { PlayerPos, Waypoint, GameApp, PlayerProfile, FriendPresence } from "./player";

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
    __playerPos: PlayerPos | null;
    __botPaused: boolean;
    __waypoints: Waypoint[];
    __fishStats: FishStats;
    __solveFishingChallenge: (challenge: string) => string;
    __sceneCache: Map<string, GameScene>;
    __wpRequire?: (id: number) => any;
    __ltSpyRetry?: () => boolean;
    __localPlayerId: string | null;
    __playerProfiles: Map<string, PlayerProfile>;
    __friendIds: Map<string, FriendPresence>;
    __currentLobby: string | null;
    __wsAuthToken: string | null;
    __lobbyOverride: string | null;
    __lobbySwitching: boolean;
    __playerRooms: Map<string, string>;
    __ltModMenuLoaded?: boolean;
    webpackChunk_N_E: unknown[];
  }
}
