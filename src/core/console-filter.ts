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

const _log = console.log;
const _warn = console.warn;

console.log = (...args: unknown[]) => {
  if (filterEnabled && isFromGameScript()) return;
  _log.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  if (filterEnabled && isFromGameScript()) return;
  _warn.apply(console, args);
};
