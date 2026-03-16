export const PRIVACY_PUBLIC = "PUBLIC";
export const PRIVACY_FRIENDS = "FRIENDS_ONLY";
export const PRIVACY_OWNER = "OWNER_ONLY";

export const BURROW_SPAWN_OFFSET_X = -10;

export const FALLBACK_SPAWN = { x: 200, y: 200, direction: "left" as const };

export const FALLBACK_SCENE = {
  fastTravelSpawnPosition: FALLBACK_SPAWN,
  showMinimap: false,
  objects: [{ name: "Camera" }],
};

export const JOIN_TIMEOUT_MS = 5000;
