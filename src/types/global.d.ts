export interface FishStats {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  secret: number;
  event: number;
  unknown: number;
  total: number;
  gold: number;
  last_fish: string;
  [key: string]: number | string;
}

export interface Waypoint {
  name: string;
  x: number;
  y: number;
  direction: string;
  map?: string;
}

export interface GameScene {
  name: string;
  fastTravelSpawnPosition?: { x: number; y: number; direction: string };
  [key: string]: unknown;
}

export interface PlayerPos {
  x: number;
  y: number;
  direction: string;
}

export interface FishBiteData {
  challenge?: string;
  [key: string]: unknown;
}

export interface FishResultData {
  name?: string;
  weight?: number;
  isShiny?: boolean;
  [key: string]: unknown;
}

export interface LocalPlayer {
  currentPos: { x: number; y: number };
  parent: { x: number; y: number };
  serverPos?: { x: number; y: number };
  oldPos?: { x: number; y: number };
  direction: string;
  fishingMinigame?: { destroy?: () => void } | null;
  minigame?: { destroy?: () => void } | null;
  sit: (pose: string) => void;
  unsit?: (opts: { withCooldown: boolean; emitUnsit: boolean }) => void;
  setSitAnimation?: (anim: string) => void;
}

export interface GameApp {
  localPlayer: LocalPlayer;
  currentCamera: {
    moveCameraToPlayer: (instant: boolean) => void;
  };
  currentScene?: GameScene;
  currentServerRoomId?: string;
  interactables?: Record<string, { onInteract?: () => void }>;
  loadScene?: (opts: { scene: GameScene }) => void;
  backToMainScene?: () => void;
}

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
    __sceneCache: Map<string, GameScene>;
    __wpRequire?: (id: number) => any;
    __ltSpyRetry?: () => boolean;
    webpackChunk_N_E: unknown[];
  }
}
