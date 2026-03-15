// Suppresses console output originating from the game's bundled scripts
// (Next.js /_next/ chunks) while preserving output from our userscript.

const GAME_SCRIPT = /\/_next\//;
const STORAGE_KEY = "ltmod_consoleFilter";

let filterEnabled = true;
try {
  filterEnabled = localStorage.getItem(STORAGE_KEY) !== "false";
} catch (_e) {
  // ignore
}

export function isConsoleFilterEnabled(): boolean {
  return filterEnabled;
}

export function setConsoleFilterEnabled(enabled: boolean): void {
  filterEnabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (_e) {
    // ignore
  }
}

function isFromGameScript(): boolean {
  const stack = new Error().stack;
  if (!stack) return false;
  // Stack: 0=Error, 1=isFromGameScript, 2=console override, 3=actual caller
  const caller = stack.split("\n")[3];
  return caller ? GAME_SCRIPT.test(caller) : false;
}

const NOISE_PATTERNS = [
  /AbortError.*play\(\) request was interrupted/i,
  /video-only background media was paused/i,
];

function isNoisyMessage(args: unknown[]): boolean {
  const msg = args[0];
  if (typeof msg !== "string" && !(msg instanceof Error)) return false;
  const text = String(msg);
  return NOISE_PATTERNS.some(p => p.test(text));
}

const _log = console.log;
const _warn = console.warn;
const _error = console.error;

console.log = (...args: unknown[]) => {
  if (filterEnabled && isFromGameScript()) return;
  _log.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  if (filterEnabled && isFromGameScript()) return;
  _warn.apply(console, args);
};

console.error = (...args: unknown[]) => {
  if (filterEnabled && isNoisyMessage(args)) return;
  _error.apply(console, args);
};
