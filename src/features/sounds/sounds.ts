import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";

import { findPlaySoundFn } from "@core/module-resolver";

// ── Howler-based sound hook ──
// In v2, the webpack sound map is inside an inaccessible closure.
// We hook Howl.prototype.play directly and identify sounds by URL.
// A persistent URL→name map (localStorage) survives page reloads.
// findPlaySoundFn is still attempted as a best-effort tagger.

// ── Music pause (Audio.prototype.play interception) ──

let musicEl: HTMLAudioElement | null = null;
let musicPaused = false;
let lastSrc = "";

export function initMusicPauseHook(): void {
  const origPlay = Audio.prototype.play;
  Audio.prototype.play = function (this: HTMLAudioElement): Promise<void> {
    if (this.src && !(this as any).__ltLocal) {
      if (!musicEl || !musicEl.src) musicEl = this;
    }
    if (this === musicEl) {
      // New song — src changed, reset pause state
      if (this.src !== lastSrc) {
        lastSrc = this.src;
        if (!musicPaused) return origPlay.call(this);
      }
      if (musicPaused) return Promise.resolve();
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

    if (musicEl) musicEl.pause();
  }
}

export function unblockGameMusic(): void {
  if (musicPaused) {
    musicPaused = false;

    if (musicEl) musicEl.play();
  }
}

export function toggleMusicPause(): boolean {
  if (musicPaused) {
    musicPaused = false;

    if (musicEl) musicEl.play();
    log("SOUND", "Music resumed");
    return false;
  }
  musicPaused = true;
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
const urlToName: Map<string, string> = new Map(
  Object.entries(loadData<Record<string, string>>("soundUrlMap", {})),
);

let hooked = false;
let tagged = false;
let origPlay: ((id?: number) => number) | null = null;
let taggingName: string | null = null;

function getSrc(howl: any): string {
  const s = howl._src;
  return Array.isArray(s) ? s[0] || "" : s || "";
}

export function initSoundHook(): void {
  if (hooked) return;

  function tryHook(): boolean {
    if (typeof Howl === "undefined") return false;

    origPlay = Howl.prototype.play;

    Howl.prototype.play = function (this: any, id?: number): number {
      // Tagging phase: record name→URL, suppress actual play
      if (taggingName) {
        this._ltName = taggingName;
        const src = getSrc(this);
        if (src) urlToName.set(src, taggingName);
        return 0;
      }

      // Normal phase: resolve name and check mute
      const src = getSrc(this);
      const name = this._ltName || (src ? urlToName.get(src) : null);
      if (name) {
        if (!this._ltName) this._ltName = name;
        if (mutedSounds.has(name)) return 0;
      }

      return origPlay!.call(this, id);
    };

    hooked = true;
    tagged = urlToName.size >= SFX_NAMES.length;
    log("SOUND", "Hook installed" + (urlToName.size > 0
      ? " (" + urlToName.size + " sounds from cache)"
      : ""));
    // Try tagging via findPlaySoundFn in background
    scheduleTagging();
    return true;
  }

  if (tryHook()) return;

  let retries = 0;
  const interval = setInterval(() => {
    retries++;
    if (tryHook() || retries >= 30) {
      clearInterval(interval);
      if (!hooked) log("SOUND", "Failed to hook Howl after 30 retries");
    }
  }, 1000);
}

function scheduleTagging(): void {
  // If already fully tagged from cache, skip
  if (tagged) return;

  let retries = 0;
  const interval = setInterval(() => {
    retries++;
    if (!window.__wpRequire) {
      if (retries >= 30) {
        clearInterval(interval);
        log("SOUND", "wpRequire unavailable — using cached map (" + urlToName.size + " entries)");
      }
      return;
    }

    const playSound = findPlaySoundFn(window.__wpRequire);
    if (!playSound) {
      if (retries >= 30) {
        clearInterval(interval);
        log("SOUND", "findPlaySoundFn failed — using cached map (" + urlToName.size + " entries)");
      }
      return;
    }

    clearInterval(interval);
    runTagging(playSound);
  }, 1000);
}

function runTagging(playSound: (name: string) => void): void {
  const _warn = console.warn;
  console.warn = () => {};
  let count = 0;
  for (const name of SFX_NAMES) {
    taggingName = name;
    try { playSound(name); count++; } catch { /* not loaded */ }
  }
  taggingName = null;
  console.warn = _warn;

  if (count > 0) {
    tagged = true;
    const map: Record<string, string> = {};
    urlToName.forEach((v, k) => { map[k] = v; });
    saveData("soundUrlMap", map);
    log("SOUND", "Tagged " + count + "/" + SFX_NAMES.length + " sounds");
  }
}

export function isMuted(name: string): boolean {
  return mutedSounds.has(name);
}

export function toggleSound(name: string): boolean {
  if (mutedSounds.has(name)) mutedSounds.delete(name);
  else mutedSounds.add(name);
  persist();
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
  if (!origPlay) return;
  const howl = findHowlByName(name);
  if (!howl) return;
  origPlay.call(howl);
}

function findHowlByName(name: string): any | null {
  const howls = (Howler as any)?._howls;
  if (!howls || !Array.isArray(howls)) return null;

  // By _ltName tag
  for (const h of howls) {
    if (h._ltName === name) return h;
  }

  // By URL→name map
  for (const [url, n] of urlToName) {
    if (n !== name) continue;
    for (const h of howls) {
      if (getSrc(h) === url) return h;
    }
  }

  return null;
}

export function isHooked(): boolean {
  return hooked;
}

export function isTagged(): boolean {
  return tagged;
}

function persist(): void {
  saveData("mutedSounds", Array.from(mutedSounds));
}

