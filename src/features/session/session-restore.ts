import { log } from "@core/logger";
import { saveData, loadData } from "@core/storage";
import { getPos, getCurrentMap, switchLobby, lobbyLabel } from "@core/game";
import { doTP, doInterMapTP } from "@features/teleport/teleport";
import { visitBurrow } from "@features/teleport/burrow-visit";
import { notify } from "@ui/status-bar";

interface SessionSnapshot {
  lobby: string;
  map: string;
  roomId: string;
  x: number;
  y: number;
  direction: string;
  seatId: string;
  timestamp: number;
}

const STORAGE_KEY = "session";
const ENABLED_KEY = "sessionRestoreEnabled";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVE_INTERVAL_MS = 10_000;
const THEME_VARS = [
  "--lt-bg", "--lt-bg-secondary", "--lt-border", "--lt-border-light",
  "--lt-text", "--lt-text-muted", "--lt-text-title", "--lt-accent", "--lt-shadow",
];

let saveTimer: ReturnType<typeof setInterval> | null = null;
let cancelled = false;

// ── Public API (shared with actions-view) ──

export function isSessionRestoreEnabled(): boolean {
  return loadData<boolean>(ENABLED_KEY, true);
}

export function setSessionRestoreEnabled(enabled: boolean): void {
  saveData(ENABLED_KEY, enabled);
  if (enabled) {
    startSessionSaver();
  } else {
    stopSessionSaver();
  }
  syncAllToggleButtons(enabled);
  log("SESSION", "Session restore " + (enabled ? "enabled" : "disabled"));
}

// ── Toggle button sync ──

const toggleButtons = new Set<HTMLButtonElement>();

export function registerToggleButton(btn: HTMLButtonElement): void {
  toggleButtons.add(btn);
  applyToggleStyle(btn, isSessionRestoreEnabled());
}

export function unregisterToggleButton(btn: HTMLButtonElement): void {
  toggleButtons.delete(btn);
}

function applyToggleStyle(btn: HTMLButtonElement, on: boolean): void {
  btn.textContent = "Session Restore: " + (on ? "ON" : "OFF");
  btn.className = "lt-action " + (on ? "lt-success" : "lt-muted");
}

function syncAllToggleButtons(on: boolean): void {
  for (const btn of toggleButtons) {
    applyToggleStyle(btn, on);
  }
}

// ── Burrow helpers ──

function parseBurrowRoom(roomId: string): { burrowId: string; subRoom: number } | null {
  const m = roomId.match(/^burrow:([^:]+):(\d+)$/);
  if (!m) return null;
  return { burrowId: m[1], subRoom: Number(m[2]) };
}

function isBurrowSession(saved: SessionSnapshot): boolean {
  return saved.roomId.startsWith("burrow:");
}

// ── Session save ──

function captureSnapshot(): SessionSnapshot | null {
  const lobby = window.__currentLobby;
  const map = getCurrentMap();
  const pos = getPos();
  const app = window.__gameApp;
  if (!lobby || map === "unknown" || !pos || !app) return null;
  return {
    lobby,
    map,
    roomId: app.currentServerRoomId || map,
    x: pos.x,
    y: pos.y,
    direction: pos.direction,
    seatId: app.localPlayer?.currentSeatId || "",
    timestamp: Date.now(),
  };
}

function saveSession(): void {
  const snap = captureSnapshot();
  if (snap) saveData(STORAGE_KEY, snap);
}

export function startSessionSaver(): void {
  if (saveTimer || !isSessionRestoreEnabled()) return;
  saveTimer = setInterval(saveSession, SAVE_INTERVAL_MS);
  window.addEventListener("beforeunload", saveSession);
  log("SESSION", "Saver started (every 10s + beforeunload)");
}

function stopSessionSaver(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  window.removeEventListener("beforeunload", saveSession);
  log("SESSION", "Saver stopped");
}

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForInitialLoad(): Promise<void> {
  return new Promise((resolve) => {
    const listen = (sig: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void }): void => {
      const onReady = (): void => {
        sig.off("initial-load-complete", onReady);
        resolve();
      };
      sig.on("initial-load-complete", onReady);
    };

    const signal = window.__gameGlobals?.signal;
    if (signal) {
      listen(signal);
    } else {
      const poll = setInterval(() => {
        const sig = window.__gameGlobals?.signal;
        if (sig) {
          clearInterval(poll);
          listen(sig);
        }
      }, 500);
    }
  });
}

function waitForReady(): Promise<void> {
  return new Promise((resolve) => {
    const check = (): void => {
      if (window.__gameApp?.localPlayer && window.__currentLobby && !window.__lobbySwitching) {
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

function restorePlayerState(saved: SessionSnapshot): void {
  if (!saved.seatId) return;
  const lp = window.__gameApp?.localPlayer;
  if (!lp) return;
  lp.sit(saved.seatId);
  log("SESSION", "Restored seat: " + saved.seatId);
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "min";
  const h = Math.floor(m / 60);
  return h + "h" + (m % 60) + "min";
}

// ── Restore modal ──

function syncTheme(el: HTMLElement): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;
  const s = getComputedStyle(hud);
  for (const v of THEME_VARS) {
    const val = s.getPropertyValue(v).trim();
    if (val) el.style.setProperty(v, val);
  }
}

interface RestoreOverlay {
  setStatus: (msg: string) => void;
  close: () => void;
}

function showRestoreOverlay(saved: SessionSnapshot): RestoreOverlay {
  const age = formatAge(Date.now() - saved.timestamp);
  const burrow = parseBurrowRoom(saved.roomId);
  const lobbyName = lobbyLabel(saved.lobby);
  const location = burrow
    ? lobbyName + " / burrow"
    : lobbyName + " / " + saved.map;
  const detail = location + " (" + saved.x + ", " + saved.y + ")";

  const overlay = document.createElement("div");
  overlay.id = "lt-modal-overlay";
  syncTheme(overlay);

  overlay.innerHTML =
    '<div id="lt-modal">' +
    '<div id="lt-modal-title">Restoring session</div>' +
    '<div id="lt-modal-msg">' +
      '<span style="font-size:16px;color:var(--lt-accent,#8a8abe);">' + detail + "</span>" +
    "</div>" +
    '<div id="lt-modal-status" style="font-size:15px;color:var(--lt-text-muted,#6a6a9a);margin-bottom:14px;">Loading... (' + age + ' ago)</div>' +
    '<div id="lt-modal-actions"><button id="lt-modal-toggle" class="lt-action lt-success" ' +
      'style="flex:1;margin:0;">Session Restore: ON</button></div>' +
    "</div>";

  document.body.appendChild(overlay);

  const toggleBtn = overlay.querySelector<HTMLButtonElement>("#lt-modal-toggle")!;
  registerToggleButton(toggleBtn);

  toggleBtn.onclick = () => {
    const now = !isSessionRestoreEnabled();
    setSessionRestoreEnabled(now);
    if (!now) cancelled = true;
  };

  const statusEl = overlay.querySelector<HTMLElement>("#lt-modal-status")!;

  return {
    setStatus(msg: string) {
      statusEl.textContent = msg;
    },
    close() {
      unregisterToggleButton(toggleBtn);
      if (overlay.parentNode) overlay.remove();
    },
  };
}

// ── Main restore flow ──

export async function trySessionRestore(): Promise<void> {
  if (!isSessionRestoreEnabled()) return;

  const saved = loadData<SessionSnapshot | null>(STORAGE_KEY, null);
  if (!saved || Date.now() - saved.timestamp > MAX_AGE_MS) return;

  log("SESSION", "Found session: lobby=" + saved.lobby + " map=" + saved.map
    + " roomId=" + saved.roomId + " pos=(" + saved.x + "," + saved.y + ")");

  await waitForInitialLoad();
  log("SESSION", "Game loaded, starting restore...");

  cancelled = false;
  const ui = showRestoreOverlay(saved);

  // Step 1: lobby
  if (saved.lobby !== window.__currentLobby) {
    ui.setStatus("Switching to " + lobbyLabel(saved.lobby) + "...");
    log("SESSION", "Lobby: " + window.__currentLobby + " -> " + saved.lobby);

    if (!switchLobby(saved.lobby)) {
      ui.setStatus("Lobby switch failed");
      log("SESSION", "Lobby switch failed");
      await sleep(2000);
      ui.close();
      return;
    }

    await sleep(2000);
    if (cancelled) { ui.close(); log("SESSION", "Cancelled"); return; }

    await waitForReady();
    if (cancelled) { ui.close(); log("SESSION", "Cancelled"); return; }

    if (window.__currentLobby !== saved.lobby) {
      ui.setStatus("Lobby switch failed");
      log("SESSION", "Lobby switch incomplete");
      await sleep(2000);
      ui.close();
      return;
    }

    ui.setStatus("Lobby OK");
    log("SESSION", "Lobby switch complete");
  }

  // Step 2: map + position
  await sleep(500);
  if (cancelled) { ui.close(); log("SESSION", "Cancelled"); return; }

  // Burrow restore
  if (isBurrowSession(saved)) {
    ui.setStatus("Joining burrow...");
    const burrow = parseBurrowRoom(saved.roomId)!;
    const ownerId = window.__localPlayerId || "";

    log("SESSION", "Burrow restore: id=" + burrow.burrowId + " template=" + saved.map + " owner=" + ownerId);

    const result = visitBurrow(burrow.burrowId, saved.map, ownerId);
    if (!result.success) {
      ui.setStatus("Burrow unavailable");
      log("SESSION", "Burrow restore failed: " + result.message);
      await sleep(2000);
      ui.close();
      return;
    }

    // Wait for burrow scene to load, then TP to exact position
    await sleep(3000);
    if (cancelled) { ui.close(); log("SESSION", "Cancelled"); return; }
    doTP(saved.x, saved.y, saved.direction);
    await sleep(500);
    restorePlayerState(saved);

    ui.setStatus("Done");
    log("SESSION", "Burrow restore complete");
    await sleep(1200);
    ui.close();
    notify("Session restored", "success", 2000);
    return;
  }

  // Regular map restore
  const currentMap = getCurrentMap();

  if (saved.map !== currentMap && saved.map !== "unknown") {
    ui.setStatus("Loading map...");
    log("SESSION", "Map: " + currentMap + " -> " + saved.map);

    const result = doInterMapTP(saved.x, saved.y, saved.direction, saved.map);
    if (!result.success) {
      ui.setStatus("Map unavailable");
      log("SESSION", "Map switch failed: " + result.message);
      await sleep(2000);
      ui.close();
      return;
    }
    log("SESSION", "Map switch: " + result.message);
    // doInterMapTP schedules doTP after ~2s internally, wait for scene + seat data
    await sleep(3000);
    restorePlayerState(saved);
  } else {
    doTP(saved.x, saved.y, saved.direction);
    await sleep(500);
    restorePlayerState(saved);
  }

  ui.setStatus("Done");
  log("SESSION", "Restore complete");
  await sleep(1200);
  ui.close();
  notify("Session restored", "success", 2000);
}
