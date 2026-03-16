import type { FishStats, FishBiteData, FishResultData } from "./fish.d";
import type { PlayerPos, Waypoint, GameApp, PlayerProfile, FriendPresence } from "./player";

export interface GameScene {
  name: string;
  fastTravelSpawnPosition?: { x: number; y: number; direction: string };
  [key: string]: unknown;
}

export interface ZustandStore<T = any> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
}

export interface LTStores {
  useUserData?: ZustandStore;
  useSettings?: ZustandStore;
  useUsersStore?: ZustandStore;
  useLobbyStore?: ZustandStore;
  useMissionStore?: ZustandStore;
  useFocusSession?: ZustandStore;
  useFishingStats?: ZustandStore;
  useModalStore?: ZustandStore;
  useFishingFrenzy?: ZustandStore;
  useFriendPresence?: ZustandStore;
}

export interface GameGlobals {
  signal: {
    emit: (event: string, ...args: any[]) => void;
    on: (event: string, listener: (...args: any[]) => void) => void;
    off: (event: string, listener: (...args: any[]) => void) => void;
  };
  manualCameraControl: boolean;
  dragCameraMode: boolean;
  progressMission: (key: string, amount?: number) => void;
  isHidden: () => boolean;
  minimapMarkerRefs: Record<string, any>;
  playerHUDRefs: Record<string, any>;
}

export interface SocketClient {
  socket?: any;
  _socket?: any;
  listeners: Record<string, any>;
  sessionId: string | null;
  emit?: (event: string, data?: any) => void;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  off?: (event: string, callback?: (...args: any[]) => void) => void;
  awaitEvent?: (event: string) => Promise<any>;
  [key: string]: any;
}

declare global {
  const __DEV__: boolean;
  const __VERSION__: string;


  class Howl {
    _src?: string;
    _ltName?: string;
    play(id?: number): number;
    rate(rate?: number): this | number;
    volume(vol?: number): this | number;
  }

  const Howler: {
    _howls: Howl[];
  };

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

    __localPlayerId: string | null;
    __playerProfiles: Map<string, PlayerProfile>;
    __friendIds: Map<string, FriendPresence>;
    __currentLobby: string | null;
    __wsAuthToken: string | null;
    __lobbyOverride: string | null;
    __lobbySwitching: boolean;
    __playerRooms: Map<string, string>;
    __ltModMenuLoaded?: boolean;
    __stores: LTStores;
    __gameGlobals: GameGlobals | null;
    __socketClient: SocketClient | null;
    __fishingFrenzyActive: boolean;
    webpackChunk_N_E: unknown[];
  }
}
