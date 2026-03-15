import { log } from "@core/logger";
import { saveData, loadData } from "@core/storage";
import { restoreGameTimerHide } from "./game-timer-hide";

const SETTINGS = {
  focusLengthMinutes: 25,
  breakLengthMinutes: 5,
  cycles: 1,
  isStopwatch: true,
};

const DAILY_CAP = 3000;
const INPUT_UNLOCK_INTERVAL = 2000;

export type FocusPhase = "idle" | "creating" | "focus" | "break" | "ending";

let running = false;
let phase: FocusPhase = "idle";
let sessionStart: number | null = null;
let inputUnlockTimer: ReturnType<typeof setInterval> | null = null;
let rejoinObserver: MutationObserver | null = null;
let storeUnsub: (() => void) | null = null;

export const isFocusBotRunning = (): boolean => running;
export const getFocusPhase = (): FocusPhase => phase;
export const getSessionStartTime = (): number | null => sessionStart;

export function getDailyEarnings(): number {
  return window.__stores?.useFocusSession?.getState()?.dailyEarnings ?? 0;
}

export function getDailyCap(): number {
  return DAILY_CAP;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getSocket(): any | null {
  const sc = window.__socketClient;
  return sc?.socket ?? sc?._socket ?? null;
}

function getFocusStore(): any | null {
  return window.__stores?.useFocusSession ?? null;
}

function isInSession(): boolean {
  const s = getFocusStore()?.getState();
  if (!s) return false;
  return s.sessionState === "active" || s.sessionState === "waiting";
}

function resetSessionStore(): void {
  const store = getFocusStore();
  if (!store) return;
  store.setState({
    currentSessionId: null,
    sessionState: null,
    focusInProgress: false,
    breakInProgress: false,
    seatedInFocusSeat: false,
  });
  log("FOCUS", "Store reset");
}

function ensureFocusSeatState(): void {
  const store = getFocusStore();
  if (!store) return;
  store.setState({ seatedInFocusSeat: true });

  const lp = window.__gameApp?.localPlayer;
  if (lp && !lp.currentSeatId) {
    lp.sit("portable-down");
    log("FOCUS", "Auto-sat player (portable)");
  }
}

function lockInput(): void {
  const signal = window.__gameGlobals?.signal;
  if (!signal) return;
  signal.emit("stopAcceptingInput", "focus-session");
}

function unlockInput(): void {
  const signal = window.__gameGlobals?.signal;
  if (signal) {
    signal.emit("startAcceptingInput", "focus-session");
    signal.emit("startAcceptingInput", "panel");
  }

  const input = window.__gameApp?.input;
  if (input?.disableInputEvents?.size) {
    log("FOCUS", "Clearing InputManager.disableInputEvents: " + [...input.disableInputEvents].join(", "));
    input.disableInputEvents.clear();
  }
}

function freePlayer(): void {
  // Unsit the player
  const lp = window.__gameApp?.localPlayer;
  if (lp?.currentSeatId) {
    lp.unsit?.({ withCooldown: false, emitUnsit: true });
    log("FOCUS", "Player unsit");
  }

  // Unlock input blocked by focus commitment
  unlockInput();
  log("FOCUS", "Input unlocked");
}

function startInputUnlockWatchdog(): void {
  stopInputUnlockWatchdog();

  unlockInput();

  inputUnlockTimer = setInterval(() => {
    if (!running || !isInSession()) {
      stopInputUnlockWatchdog();
      return;
    }
    unlockInput();
  }, INPUT_UNLOCK_INTERVAL);

  const store = getFocusStore();
  if (store?.subscribe) {
    storeUnsub = store.subscribe(() => {
      if (running) unlockInput();
    });
  }
}

function stopInputUnlockWatchdog(): void {
  if (inputUnlockTimer) {
    clearInterval(inputUnlockTimer);
    inputUnlockTimer = null;
  }
  if (storeUnsub) {
    storeUnsub();
    storeUnsub = null;
  }
}

async function pollUntil(pred: () => boolean, timeout: number): Promise<boolean> {
  const t0 = Date.now();
  while (running && Date.now() - t0 < timeout) {
    if (pred()) return true;
    await sleep(500);
  }
  return false;
}

function saveBotState(): void {
  const lobbyCode = getFocusStore()?.getState()?.lobbyCode;
  if (!lobbyCode) return;
  saveData("focusBotActive", true);
  saveData("focusLobbyCode", lobbyCode);
  log("FOCUS", "Bot state saved (lobbyCode=" + lobbyCode + ")");
}

function clearBotState(): void {
  saveData("focusBotActive", false);
  saveData("focusLobbyCode", "");
}

function hideRejoinModal(): void {
  const modals = document.querySelectorAll("main.fixed.inset-0");
  for (const modal of modals) {
    modal.remove();
    log("FOCUS", "REJOIN modal removed");
  }
}

function logStoreState(label: string): void {
  const s = getFocusStore()?.getState();
  if (!s) { log("FOCUS", label + " — store unavailable"); return; }
  log("FOCUS", label + " — state=" + s.sessionState
    + " id=" + (s.currentSessionId ?? "null")
    + " seated=" + s.seatedInFocusSeat
    + " focus=" + s.focusInProgress
    + " break=" + s.breakInProgress
    + " stopwatch=" + s.stopwatchState
    + " daily=" + (s.dailyEarnings ?? 0));
}

export async function startFocusBot(): Promise<void> {
  if (running) return;
  running = true;
  phase = "idle";
  log("FOCUS", "=== FOCUS BOT STARTED (stopwatch mode) ===");

  const sock = getSocket();
  if (!sock) {
    log("FOCUS", "No socketClient, waiting...");
    while (running && !getSocket()) await sleep(2000);
    if (!running) { cleanup(); return; }
  }

  logStoreState("Initial state");

  // If already in a session, just monitor it
  if (isInSession()) {
    log("FOCUS", "Existing session detected, monitoring...");
    sessionStart = sessionStart || Date.now();
    phase = "focus";
    saveBotState();
    freePlayer();
    startInputUnlockWatchdog();
    await monitorDailyCap();
    leaveSession();
    cleanup();
    return;
  }

  // Lock input during setup so the player can't move and break the flow
  lockInput();

  // Clean slate
  resetSessionStore();
  await sleep(500);

  // Sit + fake focus seat state for session creation
  ensureFocusSeatState();
  await sleep(500);

  // Create stopwatch session
  phase = "creating";
  log("FOCUS", "Creating stopwatch session...");
  getSocket()!.emit("createFocusSession", SETTINGS);

  const created = await pollUntil(() => {
    const s = getFocusStore()?.getState();
    return !!s?.currentSessionId && s.sessionState !== null;
  }, 15000);
  logStoreState("After create");
  if (!running || !created) {
    log("FOCUS", "Session creation failed");
    unlockInput();
    cleanup();
    return;
  }

  // Start session
  log("FOCUS", "Starting session...");
  getSocket()!.emit("startFocusSession", {});

  const started = await pollUntil(() => {
    const s = getFocusStore()?.getState();
    return s?.sessionState === "active";
  }, 15000);
  logStoreState("After start");
  if (!running || !started) {
    log("FOCUS", "Session start failed, cleaning up...");
    getSocket()?.emit("leaveFocusSession", {});
    unlockInput();
    cleanup();
    return;
  }

  sessionStart = Date.now();
  phase = "focus";
  log("FOCUS", "Stopwatch session active — earning 6 coins/min");
  saveBotState();

  // Free the player: unsit + unlock input
  startInputUnlockWatchdog();
  await sleep(1000);
  freePlayer();

  // Monitor until daily cap or user stop
  await monitorDailyCap();

  // Done
  leaveSession();
  cleanup();
  log("FOCUS", "=== FOCUS BOT STOPPED ===");
}

async function monitorDailyCap(): Promise<void> {
  while (running) {
    const earnings = getDailyEarnings();
    if (earnings >= DAILY_CAP) {
      log("FOCUS", "Daily cap reached (" + earnings + "/" + DAILY_CAP + ")");
      break;
    }

    // Check session is still alive
    if (!isInSession()) {
      log("FOCUS", "Session ended unexpectedly");
      break;
    }

    // Update phase from store (stopwatch can toggle focus/break)
    const s = getFocusStore()?.getState();
    if (s) {
      if (s.focusInProgress && phase !== "focus") phase = "focus";
      else if (s.breakInProgress && phase !== "break") phase = "break";
    }

    await sleep(5000);
  }
}

function leaveSession(): void {
  const sock = getSocket();
  if (sock && isInSession()) {
    phase = "ending";
    log("FOCUS", "Leaving session...");
    sock.emit("leaveFocusSession", {});
  }
  resetSessionStore();
}

export function stopFocusBot(): void {
  if (!running) return;
  running = false;
  log("FOCUS", "Stop requested");
  stopInputUnlockWatchdog();
  leaveSession();
  unlockInput();
  cleanup();
}

function stopRejoinModalWatcher(): void {
  if (rejoinObserver) {
    rejoinObserver.disconnect();
    rejoinObserver = null;
  }
}

function cleanup(): void {
  running = false;
  phase = "idle";
  sessionStart = null;
  stopInputUnlockWatchdog();
  stopRejoinModalWatcher();
  clearBotState();
}

export async function tryAutoRejoin(): Promise<void> {
  const wasActive = loadData("focusBotActive", false);
  if (!wasActive) return;

  const lobbyCode = loadData("focusLobbyCode", "");
  if (!lobbyCode) {
    clearBotState();
    return;
  }

  log("FOCUS", "Auto-rejoin: previous session detected, lobbyCode=" + lobbyCode);

  while (!getSocket() || !getFocusStore()) await sleep(2000);

  running = true;
  phase = "creating";

  hideRejoinModal();
  stopRejoinModalWatcher();
  rejoinObserver = new MutationObserver(() => hideRejoinModal());
  rejoinObserver.observe(document.body, { childList: true, subtree: true });

  log("FOCUS", "Emitting joinFocusSession lobbyCode=" + lobbyCode);
  getSocket()!.emit("joinFocusSession", { lobbyCode });

  const joined = await pollUntil(() => isInSession(), 15000);

  if (!joined) {
    log("FOCUS", "Auto-rejoin failed");
    cleanup();
    return;
  }

  sessionStart = Date.now();
  phase = "focus";
  log("FOCUS", "Auto-rejoin successful, monitoring...");

  saveBotState();
  restoreGameTimerHide();

  const store = getFocusStore();
  if (store) {
    store.setState({ focusCommitted: true, seatedInFocusSeat: true });
  }

  startInputUnlockWatchdog();
  await sleep(1000);
  freePlayer();

  await monitorDailyCap();

  leaveSession();
  cleanup();
  log("FOCUS", "=== FOCUS BOT STOPPED (auto-rejoin) ===");
}
