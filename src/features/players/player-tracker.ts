import type { ActiveBurrow, OtherPlayer, PlayerProfile } from "@core/types/player";

export interface TrackedPlayer {
  id: string;
  displayName: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  isBot: boolean;
  isFriend: boolean;
  activeBurrow: ActiveBurrow | null;
}

export function getTrackedPlayers(): TrackedPlayer[] {
  const app = window.__gameApp;
  if (!app?.players) return [];

  const profiles = window.__playerProfiles;
  const friends = window.__friendIds;

  return Object.values(app.players as Record<string, OtherPlayer>)
    .filter((p) => !p.isLocal && !p.isBot)
    .map((p) => {
      const profile: PlayerProfile | undefined = profiles.get(p.id);
      return {
        id: p.id,
        displayName: profile?.displayName || p.id.slice(0, 8) + "...",
        username: profile?.username || "",
        x: Math.round(p.currentPos.x),
        y: Math.round(p.currentPos.y),
        direction: p.direction,
        isBot: p.isBot,
        isFriend: friends.has(p.id),
        activeBurrow: profile?.activeBurrow || null,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
