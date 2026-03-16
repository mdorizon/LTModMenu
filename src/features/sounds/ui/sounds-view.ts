import {
  CATEGORIES,
  isMuted,
  toggleSound,
  isCategoryMuted,
  toggleCategory,
  applyPreset,
  isHooked,
  isMusicMuted,
  toggleMusic,
  isMusicPaused,
  blockGameMusic,
  unblockGameMusic,
  getMusicVolume,
  setMusicVolume,
  isAllMuted,
  previewSound,
} from "../sounds";
import {
  isLocalMode,
  isLocalPlaying,
  enterLocalMode,
  resumeLocal,
  pauseLocal,
  exitLocalMode,
  setLocalVolume,
} from "../music-player";
import {
  getCurrentSong,
  getDisplaySong,
  formatTime,
} from "../music-info";
import { syncTheme } from "@ui/theme";

const SHORT: Record<string, string> = {
  "Cast-Impact": "Impact",
  "Reel-Notification": "Reel Notif",
  "Common-Fish": "Common",
  "Uncommon-Fish": "Uncommon",
  "Rare-Fish": "Rare",
  "Epic-Fish": "Epic",
  "Legendary-Fish": "Legend",
  "Secret-Fish": "Secret",
  "Halloween-Fish": "Hallow",
  "Christmas-Fish": "Xmas",
  "Minigame-Hit": "Hit",
  "Fail-Press": "Fail",
  "Fail-Press-2": "Fail 2",
  "Minigame-Fail": "Game Fail",
  "Drum-Roll": "Drum Roll",
  "Cartoon-Plop": "Plop",
  "Whoosh-Thick-1": "Whoosh",
  "Wooden-Click": "Click",
  "Reel-Click": "Reel Clk",
};

import { iconPlay, iconPause, iconVolume, iconMute } from "@ui/icons";
const ICON_PLAY = iconPlay();
const ICON_PAUSE = iconPause();
const ICON_PLAY_SM = iconPlay(10);
const ICON_VOL = iconVolume();
const ICON_MUTE = iconMute();

function buildMusicCard(local: boolean, paused: boolean, musicMuted: boolean, musicVol: number): string {
  let html = '<div class="lt-sm-music-card">';

  const song = getDisplaySong();
  if (song) {
    html += '<div class="lt-sm-np">' +
      '<img class="lt-sm-np-art" id="lt-sp-art" src="' + song.imageUrl + '" />' +
      '<div class="lt-sm-np-info">' +
      '<div class="lt-sm-np-title">' + song.title + '</div>' +
      '<div class="lt-sm-np-artist"><span>' + song.artist + '</span>' +
      '<button class="lt-sm-resync-inline" id="lt-sp-resync"' +
      (local || paused ? "" : " disabled") + '>Resync to lobby</button>' +
      '</div></div>' +
      '<div class="lt-sm-np-time" id="lt-sp-time">' + formatTime(song.position) + " / " + formatTime(song.duration) + '</div>' +
      '</div>';
    const pct = song.duration > 0 ? (song.position / song.duration * 100).toFixed(1) : "0";
    html += '<div class="lt-sm-np-progress"><div class="lt-sm-np-bar" id="lt-sp-bar" style="width:' + pct + '%"></div></div>';
  }

  // Controls row
  html += '<div class="lt-sm-controls">' +
    '<span class="lt-sm-music-label">Music</span>' +
    '<input type="range" min="0" max="100" value="' + musicVol + '" class="lt-sm-slider" id="lt-sp-vol">' +
    '<span class="lt-sm-vol-val" id="lt-sp-vol-val">' + musicVol + '</span>' +
    '<button class="lt-sm-btn lt-sm-icon' + (paused ? " lt-sm-on" : "") +
    '" id="lt-sp-pause">' + (paused ? ICON_PLAY : ICON_PAUSE) + '</button>' +
    '<button class="lt-sm-btn lt-sm-icon' + (musicMuted ? " lt-sm-off" : "") +
    '" id="lt-sp-music">' + (musicMuted ? ICON_MUTE : ICON_VOL) + '</button>' +
    "</div></div>";

  return html;
}

function buildBody(testMode: boolean): string {
  let html = "";

  if (!isHooked()) {
    html += '<div class="lt-sm-warn">Waiting for sound hook...</div>';
  }

  const local = isLocalMode();
  const localPlaying = isLocalPlaying();
  const paused = local ? !localPlaying : isMusicPaused();
  const musicMuted = isMusicMuted();
  const musicVol = getMusicVolume();

  html += buildMusicCard(local, paused, musicMuted, musicVol);

  // Separator
  html += '<div class="lt-sm-sep"></div>';

  // Category toggles + mute-all + preview
  const allMuted = isAllMuted();
  html += '<div class="lt-sm-toggles">';
  for (const cat of Object.keys(CATEGORIES)) {
    const catMuted = isCategoryMuted(cat);
    html += '<button class="lt-sm-btn' + (catMuted ? " lt-sm-off" : "") +
      '" data-cat="' + cat + '">' + cat + '</button>';
  }
  html += '<button class="lt-sm-btn lt-sm-icon' + (allMuted ? " lt-sm-off" : "") +
    '" id="lt-sp-all">' + (allMuted ? ICON_MUTE : ICON_VOL) + '</button>';
  html += '<button class="lt-sm-btn lt-sm-test' + (testMode ? "" : " lt-sm-off") +
    '" id="lt-sp-test">' + ICON_PLAY_SM + ' Preview</button>';
  html += "</div>";

  // Sound grids
  html += '<div class="lt-sm-sections">';
  for (const [cat, sounds] of Object.entries(CATEGORIES)) {
    html += '<div class="lt-sm-section">';
    html += '<div class="lt-sm-cat"><span>' + cat + '</span></div>';
    html += '<div class="lt-sm-grid">';
    for (const name of sounds) {
      const display = SHORT[name] || name;
      const muted = isMuted(name);
      html += '<button class="lt-sm-cell' + (muted ? " lt-sm-muted" : "") +
        '" data-sound="' + name + '">' + display + "</button>";
    }
    html += "</div></div>";
  }
  html += "</div>";

  return html;
}

export function openSoundsModal(): void {
  const existing = document.getElementById("lt-sounds-modal");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "lt-sounds-modal";
  document.body.appendChild(overlay);
  syncTheme(overlay);

  let currentTitle = "";
  let currentPaused = false;
  let testMode = false;

  function render(): void {
    const song = getDisplaySong();
    currentTitle = song?.title ?? "";
    const local = isLocalMode();
    currentPaused = local ? !isLocalPlaying() : isMusicPaused();

    overlay.innerHTML =
      '<div class="lt-sm-box">' +
      '<div class="lt-sm-header">' +
      '<span class="lt-sm-title">Sound Controls</span>' +
      '<button class="lt-sm-close" id="lt-sm-close">\u00d7</button>' +
      "</div>" +
      '<div class="lt-sm-body">' + buildBody(testMode) + "</div>" +
      "</div>";

    document.getElementById("lt-sm-close")!.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Art fallback — hide broken image, keep bg color
    const art = document.getElementById("lt-sp-art") as HTMLImageElement | null;
    if (art) art.onerror = () => { art.style.visibility = "hidden"; };

    // ── Play / Pause ──
    document.getElementById("lt-sp-pause")!.onclick = () => {
      if (isLocalMode()) {
        if (isLocalPlaying()) { pauseLocal(); }
        else { resumeLocal(); }
      } else if (isMusicPaused()) {
        // External pause (keyboard/media key) — just resume game music
        unblockGameMusic();
      } else {
        const song = getCurrentSong();
        const pos = song?.position ?? 0;
        blockGameMusic();
        enterLocalMode(pos);
      }
      render();
    };

    // ── Music mute ──
    document.getElementById("lt-sp-music")!.onclick = () => { toggleMusic(); render(); };

    // ── Resync ──
    const resyncBtn = document.getElementById("lt-sp-resync");
    if (resyncBtn) {
      resyncBtn.onclick = () => {
        if (isLocalMode()) exitLocalMode();
        unblockGameMusic();
        render();
      };
    }

    // ── Volume slider (auto-unmutes if muted) ──
    const volSlider = document.getElementById("lt-sp-vol") as HTMLInputElement;
    const volVal = document.getElementById("lt-sp-vol-val")!;
    volSlider.oninput = () => {
      const v = Number(volSlider.value);
      volVal.textContent = String(v);
      setMusicVolume(v);
      if (isLocalMode()) setLocalVolume(v);
      // Sync mute button when volume changes unmute state
      const muteBtn = document.getElementById("lt-sp-music");
      if (muteBtn) {
        const muted = isMusicMuted();
        muteBtn.innerHTML = muted ? ICON_MUTE : ICON_VOL;
        muteBtn.classList.toggle("lt-sm-off", muted);
      }
    };

    // ── Mute all SFX ──
    document.getElementById("lt-sp-all")!.onclick = () => {
      applyPreset(isAllMuted() ? "unmute-all" : "mute-all");
      render();
    };

    // ── Test mode ──
    document.getElementById("lt-sp-test")!.onclick = () => { testMode = !testMode; render(); };

    // ── Category toggles ──
    for (const btn of overlay.querySelectorAll<HTMLElement>(".lt-sm-toggles [data-cat]")) {
      btn.onclick = () => { toggleCategory(btn.dataset.cat!); render(); };
    }

    // ── Sound cells: toggle mute, or preview in test mode ──
    for (const cell of overlay.querySelectorAll<HTMLElement>(".lt-sm-cell")) {
      cell.onclick = () => {
        if (testMode) {
          previewSound(cell.dataset.sound!);
        } else {
          toggleSound(cell.dataset.sound!);
          render();
        }
      };
    }
  }

  // Live timer
  const timer = setInterval(() => {
    if (!document.getElementById("lt-sounds-modal")) {
      clearInterval(timer);
      return;
    }

    // Detect external pause/resume state changes → re-render button
    const nowPaused = isLocalMode() ? !isLocalPlaying() : isMusicPaused();
    if (nowPaused !== currentPaused) { render(); return; }

    if (nowPaused) return;

    const song = getDisplaySong();
    if (!song) return;
    const timeEl = document.getElementById("lt-sp-time");
    const barEl = document.getElementById("lt-sp-bar") as HTMLElement | null;
    if (timeEl) timeEl.textContent = formatTime(song.position) + " / " + formatTime(song.duration);
    if (barEl) barEl.style.width = (song.position / song.duration * 100).toFixed(1) + "%";
    if (song.title !== currentTitle) render();
  }, 1000);

  render();
}
