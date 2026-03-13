import { getMusicPlaybackTime, getMusicPlaybackDuration } from "./sounds";
import { isLocalMode, getLocalSongInfo } from "./music-player";

export interface SongInfo {
  title: string;
  artist: string;
  artistLink: string;
  imageUrl: string;
  position: number;
  duration: number;
}

const IMAGE_BASE = "https://utfs.io/a/3c8oj5o1o1/";

export function getDisplaySong(): SongInfo | null {
  // Local mode takes priority — shows what you actually hear
  if (isLocalMode()) return getLocalSongInfo();
  return getCurrentSong();
}

export function getCurrentSong(): SongInfo | null {
  try {
    const mod = window.__wpRequire?.(68532);
    if (!mod?.I) return null;
    const state = window.__stores?.useSettings?.getState();
    const td = state?.timeDifference ?? 0;
    const legacy = state?.settings?.legacyMode ?? false;
    const streamer = state?.settings?.streamerMode ?? false;
    const data = mod.I(td, legacy, streamer);
    if (!data?.song) return null;
    const song = data.song;
    const artist = song.artists?.[0];
    const parts = song.time.split(":");
    const syncDuration = parseInt(parts[0]) * 60 + parseInt(parts[1]);

    const elTime = getMusicPlaybackTime();
    const elDur = getMusicPlaybackDuration();

    return {
      title: song.title,
      artist: artist?.name ?? "Unknown",
      artistLink: artist?.link ?? "",
      imageUrl: IMAGE_BASE + song.imageId,
      position: elTime >= 0 ? Math.floor(elTime) : Math.min(data.positionInSeconds, syncDuration),
      duration: elDur > 0 ? Math.floor(elDur) : syncDuration,
    };
  } catch {
    return null;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}
