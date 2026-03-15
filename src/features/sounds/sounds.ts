import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";

// ── Music pause (Audio.prototype.play interception) ──

let musicEl: HTMLAudioElement | null = null;
let musicPaused = false;
let everPlayed = false;

export function initMusicPauseHook(): void {
  const origPlay = Audio.prototype.play;
  Audio.prototype.play = function (this: HTMLAudioElement): Promise<void> {
    if (this.src && !(this as any).__ltLocal) {
      if (!musicEl || !musicEl.src) musicEl = this;
    }
    if (this === musicEl) {
      if (musicPaused) return Promise.resolve();
      // External pause: element was playing before, now it's paused but we didn't do it
      if (everPlayed && this.paused) {
        musicPaused = true;
        log("SOUND", "External pause detected, blocking sync");
        return Promise.resolve();
      }
      everPlayed = true;
    }
    return origPlay.call(this);
  };
  log("SOUND", "Music pause hook installed");
}

export function isMusicPaused(): boolean {
  return musicPaused;
}

export function getMusicPlaybackTime(): number {
  return musicEl ? musicEl.currentTime : -1;
}

export function getMusicPlaybackDuration(): number {
  return musicEl && isFinite(musicEl.duration) ? musicEl.duration : -1;
}

export function blockGameMusic(): void {
  if (!musicPaused) {
    musicPaused = true;
    everPlayed = false;
    if (musicEl) musicEl.pause();
  }
}

export function unblockGameMusic(): void {
  if (musicPaused) {
    musicPaused = false;
    everPlayed = false;
    if (musicEl) musicEl.play();
  }
}

export function toggleMusicPause(): boolean {
  if (musicPaused) {
    musicPaused = false;
    everPlayed = false;
    if (musicEl) musicEl.play();
    log("SOUND", "Music resumed");
    return false;
  }
  musicPaused = true;
  everPlayed = false;
  if (musicEl) musicEl.pause();
  log("SOUND", "Music paused");
  return true;
}

// ── Music volume (via Zustand useSettings store) ──

let savedVolume: number = loadData<number>("musicVolumeBefore", -1);

function getSettingsStore(): any {
  return window.__stores?.useSettings;
}

function getPlaylistVolume(): number {
  const store = getSettingsStore();
  if (!store) return -1;
  return store.getState()?.settings?.playlistVolume ?? -1;
}

export function isMusicMuted(): boolean {
  return getPlaylistVolume() === 0 && savedVolume >= 0;
}

export function getMusicVolume(): number {
  const v = getPlaylistVolume();
  return v >= 0 ? v : 0;
}

export function setMusicVolume(vol: number): void {
  const store = getSettingsStore();
  if (!store) return;
  const clamped = Math.max(0, Math.min(100, Math.round(vol)));
  store.getState().setSettings({ playlistVolume: clamped });
  if (clamped > 0) {
    savedVolume = -1;
    saveData("musicVolumeBefore", -1);
  }
}

export function toggleMusic(): boolean {
  const store = getSettingsStore();
  if (!store) return false;
  const current = getPlaylistVolume();
  if (current > 0) {
    savedVolume = current;
    saveData("musicVolumeBefore", current);
    store.getState().setSettings({ playlistVolume: 0 });
    log("SOUND", "Music muted (was " + current + ")");
    return true;
  } else {
    const restore = savedVolume > 0 ? savedVolume : 50;
    savedVolume = -1;
    saveData("musicVolumeBefore", -1);
    store.getState().setSettings({ playlistVolume: restore });
    log("SOUND", "Music unmuted (restored to " + restore + ")");
    return false;
  }
}

const SFX_NAMES = [
  "Sell", "Reel", "Swing", "Cast", "Wooden-Click", "Cast-Impact", "Reel-Notification",
  "Common-Fish", "Uncommon-Fish", "Rare-Fish", "Epic-Fish", "Legendary-Fish",
  "Secret-Fish", "Halloween-Fish", "Christmas-Fish", "Minigame-Hit", "Oof",
  "Fail-Press", "Minigame-Fail", "Win", "Drum-Roll", "Cartoon-Plop", "Transition",
  "Frenzy1", "Frenzy2", "Whoosh-Thick-1", "Button1", "Reel-Click", "Fail-Press-2",
];

export const CATEGORIES: Record<string, string[]> = {
  Fishing: ["Cast", "Cast-Impact", "Swing", "Reel", "Reel-Click", "Reel-Notification", "Sell"],
  Minigame: ["Minigame-Hit", "Fail-Press", "Fail-Press-2", "Minigame-Fail", "Win", "Drum-Roll"],
  Catch: ["Common-Fish", "Uncommon-Fish", "Rare-Fish", "Epic-Fish", "Legendary-Fish", "Secret-Fish", "Halloween-Fish", "Christmas-Fish"],
  Frenzy: ["Frenzy1", "Frenzy2"],
  UI: ["Button1", "Wooden-Click", "Cartoon-Plop", "Oof", "Transition", "Whoosh-Thick-1"],
};

const mutedSounds: Set<string> = new Set(loadData<string[]>("mutedSounds", []));
let hooked = false;
let playSoundFn: ((name: string) => void) | null = null;

export function initSoundHook(): void {
  if (hooked) return;

  function tryHook(): boolean {
    if (!window.__wpRequire || typeof Howl === "undefined") return false;

    let playSound: (name: string) => void;
    try {
      const mod = window.__wpRequire(88390);
      if (typeof mod?.U !== "function") return false;
      playSound = mod.U;
    } catch { return false; }

    const origPlay = Howl.prototype.play;

    // Phase 1: tag each Howl instance with its sound name (silently)
    let currentName: string | null = null;
    Howl.prototype.play = function () {
      if (currentName) (this as any)._ltName = currentName;
      return 0;
    };

    let tagged = 0;
    for (const name of SFX_NAMES) {
      currentName = name;
      try { playSound(name); tagged++; } catch (_e) { /* not loaded */ }
    }
    currentName = null;

    if (tagged === 0) {
      Howl.prototype.play = origPlay;
      return false;
    }

    // Phase 2: permanent play filter
    Howl.prototype.play = function (this: any, id?: number) {
      if (this._ltName && mutedSounds.has(this._ltName)) return 0;
      return origPlay.call(this, id);
    };

    hooked = true;
    playSoundFn = playSound;
    log("SOUND", "Hook installed, tagged " + tagged + "/" + SFX_NAMES.length);
    updateBadge();
    return true;
  }

  if (tryHook()) return;

  let retries = 0;
  const interval = setInterval(() => {
    retries++;
    if (tryHook() || retries >= 30) {
      clearInterval(interval);
      if (!hooked) log("SOUND", "Failed to hook after 30 retries");
    }
  }, 1000);
}

export function isMuted(name: string): boolean {
  return mutedSounds.has(name);
}

export function toggleSound(name: string): boolean {
  if (mutedSounds.has(name)) mutedSounds.delete(name);
  else mutedSounds.add(name);
  persist();
  updateBadge();
  return mutedSounds.has(name);
}

export function isCategoryMuted(cat: string): boolean {
  const sounds = CATEGORIES[cat];
  return sounds ? sounds.every(s => mutedSounds.has(s)) : false;
}

export function toggleCategory(cat: string): boolean {
  const sounds = CATEGORIES[cat];
  if (!sounds) return false;
  const allMuted = isCategoryMuted(cat);
  for (const s of sounds) {
    if (allMuted) mutedSounds.delete(s);
    else mutedSounds.add(s);
  }
  persist();
  updateBadge();
  return !allMuted;
}

export type Preset = "mute-fishing" | "unmute-fishing" | "mute-all" | "only-frenzy" | "unmute-all";

export function applyPreset(preset: Preset): void {
  switch (preset) {
    case "mute-fishing":
      for (const s of [...CATEGORIES.Fishing, ...CATEGORIES.Minigame, ...CATEGORIES.Catch]) mutedSounds.add(s);
      break;
    case "unmute-fishing":
      for (const s of [...CATEGORIES.Fishing, ...CATEGORIES.Minigame, ...CATEGORIES.Catch]) mutedSounds.delete(s);
      break;
    case "mute-all":
      for (const s of SFX_NAMES) mutedSounds.add(s);
      break;
    case "only-frenzy":
      for (const s of SFX_NAMES) mutedSounds.add(s);
      for (const s of CATEGORIES.Frenzy) mutedSounds.delete(s);
      break;
    case "unmute-all":
      mutedSounds.clear();
      break;
  }
  persist();
  updateBadge();
}

export function getMutedCount(): number {
  return mutedSounds.size;
}

export function isAllMuted(): boolean {
  return SFX_NAMES.every(s => mutedSounds.has(s));
}

export function isFishingMuted(): boolean {
  return [...CATEGORIES.Fishing, ...CATEGORIES.Minigame, ...CATEGORIES.Catch].every(s => mutedSounds.has(s));
}

export function previewSound(name: string): void {
  if (!playSoundFn) return;
  const wasMuted = mutedSounds.has(name);
  if (wasMuted) mutedSounds.delete(name);
  try { playSoundFn(name); } catch { /* ignore */ }
  if (wasMuted) mutedSounds.add(name);
}

export function isHooked(): boolean {
  return hooked;
}

function persist(): void {
  saveData("mutedSounds", Array.from(mutedSounds));
}

function updateBadge(): void {
  if (mutedSounds.size > 0) {
    setStatus("sounds", { label: "MUTED " + mutedSounds.size, color: "#e0a050", bg: "#2a2010" });
  } else {
    clearStatus("sounds");
  }
}
