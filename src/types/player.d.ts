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
}

export interface LocalPlayer {
  currentPos: { x: number; y: number };
  parent: { x: number; y: number };
  serverPos?: { x: number; y: number };
  oldPos?: { x: number; y: number };
  direction: string;
  currentSeatId: string;
  fishingMinigame?: { destroy?: () => void } | null;
  minigame?: { destroy?: () => void } | null;
  character: {
    takeOutFishingRod?: (direction: string) => void;
    removeFishingRod?: () => void;
  };
  sit: (pose: string) => void;
  unsit?: (opts: { withCooldown: boolean; emitUnsit: boolean }) => void;
  setSitAnimation?: (anim: string) => void;
  changeAnimationState: (state: string, force?: boolean) => void;
}

export interface GameApp {
  localPlayer: LocalPlayer;
  currentCamera: {
    moveCameraToPlayer: (instant: boolean) => void;
  };
}
