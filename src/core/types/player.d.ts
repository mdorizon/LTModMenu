export interface PlayerPos {
  x: number;
  y: number;
  direction: string;
}

export interface Waypoint {
  name: string;
  x: number;
  y: number;
  direction: string;
  map?: string;
}

export interface LocalPlayer {
  currentPos: { x: number; y: number };
  parent: { x: number; y: number };
  serverPos?: { x: number; y: number };
  oldPos?: { x: number; y: number };
  direction: string;
  currentSeatId: string;
  sitAnimation?: string;
  fishingMinigame?: { destroy?: () => void } | null;
  minigame?: { destroy?: () => void } | null;
  character: {
    takeOutFishingRod?: (direction: string) => void;
    removeFishingRod?: () => void;
  };
  isInGoKart?: boolean;
  kartVariant?: string;
  enterGoKart?: (variant?: string) => void;
  exitGoKart?: () => void;
  sit: (pose: string) => void;
  unsit?: (opts: { withCooldown: boolean; emitUnsit: boolean }) => void;
  setSitAnimation?: (anim: string) => void;
  changeAnimationState: (state: string, force?: boolean) => void;
}

import type { GameScene } from "./global";

export interface OtherPlayer {
  id: string;
  currentPos: { x: number; y: number };
  direction: string;
  isBot: boolean;
  isLocal: boolean;
  currentSeatId?: string;
  sitAnimation?: string;
}

export interface ActiveBurrow {
  id: string;
  privacyLevel: string;
  template: string;
}

export interface PlayerProfile {
  displayName: string;
  username: string;
  activeBurrow?: ActiveBurrow | null;
}

export interface FriendPresence {
  online: boolean;
  lobby: string;
  displayName: string;
  username: string;
}

export interface InputManager {
  disableInputEvents: Set<string>;
  disableTouchInput: boolean;
  movement: { x: number; y: number };
  keyboardMovement: { x: number; y: number };
  touchMovement: { x: number; y: number };
  stopInput: (freeze: boolean, reason: string) => void;
  isFrozen: () => boolean;
  isMoving: () => boolean;
}

export interface GameApp {
  localPlayer: LocalPlayer;
  players: Record<string, OtherPlayer>;
  currentCamera: {
    moveCameraToPlayer: (instant: boolean) => void;
  };
  input?: InputManager;
  currentScene?: GameScene;
  currentServerRoomId?: string;
  interactables?: Record<string, { onInteract?: () => void }>;
  loadScene?: (opts: {
    scene: GameScene;
    burrow?: { id: string; subRoom: number };
    position?: { x: number; y: number; direction: string };
    doNotGetMapData?: boolean;
  }) => void;
  backToMainScene?: () => void;
  isFirstLoad?: boolean;
  hasInitiallyJoinedRoom?: boolean;
  loadingScene?: boolean;
}
