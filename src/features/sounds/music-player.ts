import { log } from "@core/logger";

export interface QueuedSong {
  title: string;
  artist: string;
  artistLink: string;
  audioId: string;
  imageId: string;
  duration: number;
}

const AUDIO_BASE = "https://utfs.io/a/3c8oj5o1o1/";
const IMAGE_BASE = "https://utfs.io/a/3c8oj5o1o1/";
const QUEUE_BUILD_SIZE = 20;
const PREFETCH_AHEAD = 3;
const DB_NAME = "ltmod_music";
const DB_VER = 1;

let queue: QueuedSong[] = [];
let currentIndex = 0;
let localAudio: HTMLAudioElement | null = null;
let active = false;
let playing = false;
let pauseMoment = 0; // absolute sync timestamp (seconds) at time of pause
let pendingPosition = 0; // position to resume from on first play after entering local mode
const blobUrls = new Map<string, string>();
let volumeUnsub: (() => void) | null = null;

// ── IndexedDB ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio");
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function idbDelete(store: string, key: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

// ── Audio caching ──

async function getAudioUrl(audioId: string): Promise<string> {
  const existing = blobUrls.get(audioId);
  if (existing) return existing;

  const cached = await idbGet<Blob>("audio", audioId);
  if (cached) {
    const url = URL.createObjectURL(cached);
    blobUrls.set(audioId, url);
    return url;
  }

  const res = await fetch(AUDIO_BASE + audioId);
  const blob = await res.blob();
  await idbPut("audio", audioId, blob);
  const url = URL.createObjectURL(blob);
  blobUrls.set(audioId, url);
  log("SOUND", "Cached: " + audioId.slice(-10));
  return url;
}

async function prefetchUpcoming(): Promise<void> {
  for (let i = 1; i <= PREFETCH_AHEAD; i++) {
    const idx = currentIndex + i;
    if (idx >= queue.length) break;
    const song = queue[idx];
    if (blobUrls.has(song.audioId)) continue;
    try {
      await getAudioUrl(song.audioId);
      log("SOUND", "Pre-fetched: " + song.title);
    } catch { /* network error, skip */ }
  }
}

// ── Queue building ──

function parseSong(song: any): QueuedSong {
  const parts = song.time.split(":");
  return {
    title: song.title,
    artist: song.artists?.[0]?.name ?? "Unknown",
    artistLink: song.artists?.[0]?.link ?? "",
    audioId: song.audioId,
    imageId: song.imageId,
    duration: parseInt(parts[0]) * 60 + parseInt(parts[1]),
  };
}

function getSyncFn(): ((td: number, legacy: boolean, streamer: boolean) => any) | null {
  try {
    const mod = window.__wpRequire?.(68532);
    return mod?.I ?? null;
  } catch { return null; }
}

function getSettings(): { td: number; legacy: boolean; streamer: boolean } {
  const state = window.__stores?.useSettings?.getState();
  return {
    td: state?.timeDifference ?? 0,
    legacy: state?.settings?.legacyMode ?? false,
    streamer: state?.settings?.streamerMode ?? false,
  };
}

function buildQueueFromMoment(syncTime: number, count: number): QueuedSong[] {
  const syncFn = getSyncFn();
  if (!syncFn) return [];
  const { legacy, streamer } = getSettings();
  const songs: QueuedSong[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    // Adjust td so sync function evaluates at (syncTime + offset)
    const fakeTd = (syncTime + offset) * 1000 - Date.now();
    const data = syncFn(fakeTd, legacy, streamer);
    if (!data?.song) break;
    songs.push(parseSong(data.song));
    offset += data.nextSongStartIn + 1;
  }
  return songs;
}

function extendQueue(): void {
  // Compute the sync timestamp for the end of current queue
  let accumulated = 0;
  for (let i = currentIndex; i < queue.length; i++) {
    accumulated += queue[i].duration;
  }
  const songs = buildQueueFromMoment(pauseMoment + accumulated, QUEUE_BUILD_SIZE);
  // Avoid duplicates at the boundary
  const lastId = queue[queue.length - 1]?.audioId;
  const start = songs.findIndex(s => s.audioId !== lastId);
  if (start > 0) songs.splice(0, start);
  queue.push(...songs);
  log("SOUND", "Queue extended to " + queue.length + " songs");
}

// ── Playback ──

// Game uses exponential volume curve (module 1989): (e^(v/100*3)-1)/(e^3-1)
const EXP3_INV = 1 / (Math.exp(3) - 1);
function volumeCurve(v: number): number {
  if (v <= 0) return 0;
  return (Math.exp(v / 100 * 3) - 1) * EXP3_INV;
}

function getStoreVolume(): number {
  const store = window.__stores?.useSettings;
  return store?.getState()?.settings?.playlistVolume ?? 50;
}

function applyVolume(): void {
  if (localAudio) localAudio.volume = volumeCurve(getStoreVolume());
}

function startVolumeSync(): void {
  stopVolumeSync();
  const store = window.__stores?.useSettings;
  if (!store) return;
  volumeUnsub = store.subscribe(() => {
    if (active && localAudio) applyVolume();
  });
}

function stopVolumeSync(): void {
  if (volumeUnsub) { volumeUnsub(); volumeUnsub = null; }
}

function ensureAudio(): HTMLAudioElement {
  if (!localAudio) {
    localAudio = new Audio();
    (localAudio as any).__ltLocal = true;
    localAudio.addEventListener("ended", () => playNext());
    localAudio.volume = volumeCurve(getStoreVolume());
  }
  return localAudio;
}

async function playCurrent(position?: number): Promise<void> {
  if (currentIndex >= queue.length) {
    extendQueue();
    if (currentIndex >= queue.length) {
      log("SOUND", "Queue empty, stopping local mode");
      playing = false;
      return;
    }
  }
  const song = queue[currentIndex];
  const audio = ensureAudio();
  try {
    const url = await getAudioUrl(song.audioId);
    audio.src = url;
    if (position !== undefined && position > 0) {
      audio.currentTime = position;
    }
    await audio.play();
    playing = true;
    log("SOUND", "Local: " + song.title + (position ? " @" + position.toFixed(0) + "s" : ""));
    prefetchUpcoming();
    persistState();
  } catch (e) {
    playing = false;
    log("SOUND", "Local play failed: " + (e as Error).message);
  }
}

function playNext(): void {
  currentIndex++;
  if (currentIndex >= queue.length - 2) extendQueue();
  playCurrent();
}

function persistState(): void {
  idbPut("state", "player", {
    queue, currentIndex, pauseMoment,
    position: localAudio?.currentTime ?? 0,
    active: true,
  }).catch(() => {});
}

// ── Public API ──

export function isLocalMode(): boolean {
  return active;
}

export function isLocalPlaying(): boolean {
  return active && playing;
}

export function enterLocalMode(currentPosition: number): void {
  const syncFn = getSyncFn();
  if (!syncFn) return;
  const { td, legacy, streamer } = getSettings();

  // Capture absolute sync time
  pauseMoment = Math.floor((Date.now() + td) / 1000);

  // Current song
  const data = syncFn(td, legacy, streamer);
  if (!data?.song) return;
  queue = [parseSong(data.song)];

  // Build upcoming queue from just after current song ends
  let offset = data.nextSongStartIn + 1;
  for (let i = 1; i < QUEUE_BUILD_SIZE; i++) {
    const fakeTd = (pauseMoment + offset) * 1000 - Date.now();
    const d = syncFn(fakeTd, legacy, streamer);
    if (!d?.song) break;
    queue.push(parseSong(d.song));
    offset += d.nextSongStartIn + 1;
  }

  currentIndex = 0;
  active = true;
  playing = false;
  pendingPosition = currentPosition;

  log("SOUND", "Local mode: " + queue.length + " songs queued from " + data.song.title + " @" + currentPosition.toFixed(0) + "s");

  // Pre-load current song at the saved position (don't play yet)
  getAudioUrl(queue[0].audioId).then(url => {
    const audio = ensureAudio();
    audio.src = url;
    audio.currentTime = currentPosition;
    persistState();
  });
  startVolumeSync();
  prefetchUpcoming();
}

export function resumeLocal(): void {
  if (!active || queue.length === 0) return;
  const pos = localAudio?.currentTime && localAudio.currentTime > 0
    ? localAudio.currentTime
    : pendingPosition;
  playing = true; // optimistic — render sees ❚❚ immediately
  playCurrent(pos > 0 ? pos : undefined);
}

export function pauseLocal(): void {
  if (localAudio && !localAudio.paused) {
    localAudio.pause();
    playing = false;
    persistState();
    log("SOUND", "Local paused at " + localAudio.currentTime.toFixed(1) + "s");
  }
}

export function skipNext(): void {
  if (!active) return;
  playNext();
}

export function exitLocalMode(): void {
  stopVolumeSync();
  if (localAudio) {
    localAudio.pause();
    localAudio.src = "";
    localAudio = null;
  }
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
  queue = [];
  currentIndex = 0;
  active = false;
  playing = false;
  idbDelete("state", "player").catch(() => {});
  log("SOUND", "Local mode exited, resyncing to server");
}

export function getLocalSongInfo(): {
  title: string; artist: string; artistLink: string;
  imageUrl: string; position: number; duration: number;
} | null {
  if (!active || currentIndex >= queue.length) return null;
  const song = queue[currentIndex];
  return {
    title: song.title,
    artist: song.artist,
    artistLink: song.artistLink,
    imageUrl: IMAGE_BASE + song.imageId,
    position: localAudio && localAudio.currentTime > 0 ? Math.floor(localAudio.currentTime) : Math.floor(pendingPosition),
    duration: localAudio && isFinite(localAudio.duration) ? Math.floor(localAudio.duration) : song.duration,
  };
}

export function getLocalQueueRemaining(): number {
  return Math.max(0, queue.length - currentIndex - 1);
}

export function setLocalVolume(vol: number): void {
  if (localAudio) localAudio.volume = volumeCurve(vol);
}

// ── Restore on reload ──

export async function tryRestoreLocalMode(): Promise<boolean> {
  try {
    const saved = await idbGet<any>("state", "player");
    if (!saved?.active || !saved.queue?.length) return false;
    queue = saved.queue;
    currentIndex = saved.currentIndex;
    pauseMoment = saved.pauseMoment;
    active = true;
    playing = false;

    // Pre-fetch current song so play is instant
    getAudioUrl(queue[currentIndex].audioId).then(() => {
      const audio = ensureAudio();
      getAudioUrl(queue[currentIndex].audioId).then(url => {
        audio.src = url;
        if (saved.position > 0) audio.currentTime = saved.position;
        // Don't auto-play — user clicks play
      });
    });
    startVolumeSync();
    prefetchUpcoming();
    log("SOUND", "Restored local mode: " + queue[currentIndex].title + " @" + saved.position.toFixed(0) + "s");
    return true;
  } catch {
    return false;
  }
}
