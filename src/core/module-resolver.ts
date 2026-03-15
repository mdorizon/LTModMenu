// Signature-based webpack module detection.
// Finds modules by inspecting exports shape instead of relying on IDs
// that change every game build.

import { log } from "./logger";
import type { LTStores } from "./types/global.d";

// ── Store signatures ──
// Each entry: [storeName, predicate on getState() result]
// Uses 2+ domain-specific keys to avoid false positives.
// These keys are runtime strings in Zustand state — minification doesn't touch them.

export const STORE_SIGNATURES: [keyof LTStores, (s: any) => boolean][] = [
  ["useUserData",      (s) => "accessToken" in s && "fishInventory" in s],
  ["useSettings",      (s) => !!s.settings && "playlistVolume" in s.settings && "timeDifference" in s],
  ["useUsersStore",    (s) => "users" in s && "userCount" in s],
  ["useLobbyStore",    (s) => Array.isArray(s.lobbies) && "currentLobby" in s],
  ["useMissionStore",  (s) => "dailyMissions" in s && "weeklyMissions" in s],
  ["useFocusSession",  (s) => "focusInProgress" in s && "sessionSettings" in s],
  ["useFishingStats",  (s) => "totalFishCaught" in s && "totalGoldEarned" in s],
  ["useModalStore",    (s) => "modal" in s && "inspectedPlayerId" in s],
  ["useFishingFrenzy", (s) => "communityGoalPoppedOut" in s && "status" in s],
  ["useFriendPresence",(s) => "presences" in s && typeof s.setPresence === "function"],
];

// ── Module scanning ──
// Webpack doesn't always expose a module cache at require.c.
// Instead, we iterate require.m (module definitions) and call require(id)
// to get the exports. We wrap in try/catch since some modules may not be ready.

function* iterateModules(require: any): Generator<[string, any]> {
  // Try require.c (module cache with instantiated modules)
  const cache = require?.c;
  if (cache && typeof cache === "object") {
    for (const id in cache) {
      const exports = cache[id]?.exports;
      if (exports) yield [id, exports];
    }
    return;
  }

  // Fallback: use the webpack chunk registry to find already-loaded modules.
  // We CANNOT blindly require() all modules — some trigger async side effects
  // (dynamic imports, PixiJS init, etc.) that break the game.
  // Instead, iterate chunks and only require modules whose factory is a plain
  // synchronous function (skip arrow functions with dynamic import patterns).
  const chunks = (self as any).webpackChunk_N_E;
  if (!chunks || !Array.isArray(chunks)) return;

  const seen = new Set<string>();
  for (const chunk of chunks) {
    const modules = chunk[1];
    if (!modules || typeof modules !== "object") continue;
    for (const id in modules) {
      if (seen.has(id)) continue;
      seen.add(id);

      // Skip modules that are likely async loaders (very short functions
      // or functions containing dynamic import patterns)
      const fn = modules[id];
      if (typeof fn === "function") {
        const src = fn.toString();
        // Skip async loader stubs: they only contain Promise.resolve().then(n.t.bind(...))
        // These trigger side effects (dynamic imports) when require()'d
        if (src.length < 500 && /Promise\.resolve\(\)\.then\(/.test(src)) continue;
      }

      const _w = console.warn;
      console.warn = () => {};
      try {
        const exports = require(Number(id));
        console.warn = _w;
        if (exports) yield [id, exports];
      } catch (_) {
        console.warn = _w;
      }
    }
  }
}

// Safe property access that suppresses PixiJS Proxy deprecation warnings.
// PixiJS v8 exports DRAW_MODES as a Proxy — any property access on it
// triggers a console.warn via its internal deprecation() function.

// PixiJS v8 exports deprecated objects (DRAW_MODES, etc.) as Proxies with
// get traps that call an internal warn() — NOT console.warn. We cannot
// suppress these warnings by patching console. Instead, we must avoid
// accessing properties on these Proxy objects entirely.
// Strategy: read Object.keys first, then skip any key whose value is a
// known PixiJS deprecation Proxy (detected by checking Object.keys on
// the value — Proxies with get traps return empty keys).

const PIXI_PROXY_KEYS = new Set([
  "DRAW_MODES", "BLEND_MODES", "WRAP_MODES", "SCALE_MODES",
  "TYPES", "TARGETS", "FORMATS", "SAMPLER_TYPES", "ALPHA_MODES",
  "BUFFER_BITS", "BUFFER_TYPE", "MIPMAP_MODES", "GC_MODES",
  "MSAA_QUALITY", "PRECISION", "MASK_TYPES", "COLOR_MASK_BITS",
  "ENV", "RENDERER_TYPE",
]);

function safeKeys(obj: any): [string, any][] {
  const keys = Object.keys(obj);
  const result: [string, any][] = [];
  for (const k of keys) {
    if (PIXI_PROXY_KEYS.has(k)) continue;
    try { result.push([k, obj[k]]); } catch { /* skip */ }
  }
  return result;
}

export function findStoreInExports(
  exports: any,
  stateCheck: (s: any) => boolean,
): any | null {
  if (!exports || typeof exports !== "object") return null;
  for (const [, val] of safeKeys(exports)) {
    if (!val || typeof val.getState !== "function" || typeof val.setState !== "function") continue;
    try {
      if (stateCheck(val.getState())) return val;
    } catch (_) { /* state not ready */ }
  }
  return null;
}

export function findAppClass(exports: any): any | null {
  if (!exports || typeof exports !== "object") return null;
  for (const [, cls] of safeKeys(exports)) {
    if (
      cls &&
      typeof cls === "function" &&
      cls.prototype &&
      typeof cls.prototype.loadScene === "function" &&
      ("_instance" in cls || cls.instance !== undefined)
    ) {
      return cls;
    }
  }
  return null;
}

export function findGameGlobals(exports: any): any | null {
  if (!exports || typeof exports !== "object") return null;
  for (const [, val] of safeKeys(exports)) {
    if (
      val &&
      typeof val === "object" &&
      val.signal &&
      typeof val.signal.emit === "function" &&
      typeof val.signal.on === "function" &&
      "manualCameraControl" in val &&
      "dragCameraMode" in val
    ) {
      return val;
    }
  }
  return null;
}

export function findSocketClient(exports: any): any | null {
  if (!exports || typeof exports !== "object") return null;
  for (const [, val] of safeKeys(exports)) {
    if (!val || typeof val !== "object") continue;
    // Socket.IO wrapper: has _socket or socket, plus listeners map and sessionId
    if (
      ("_socket" in val || "socket" in val) &&
      "listeners" in val &&
      "sessionId" in val
    ) {
      return val;
    }
  }
  return null;
}

export function findMissionDatabase(require: any): Record<string, any> | null {
  for (const [, exp] of iterateModules(require)) {
    if (!exp || typeof exp !== "object") continue;
    for (const [, val] of safeKeys(exp)) {
      if (!val || typeof val !== "object") continue;
      // The mission DB is an object with keys like "catch-10-fish"
      // where each value has requiredAmount + pointsReward + progressKey
      if (val["catch-10-fish"]?.requiredAmount && val["catch-10-fish"]?.pointsReward) {
        return val;
      }
    }
  }
  return null;
}

export function findPixiGraphics(require: any): any | null {
  for (const [, exp] of iterateModules(require)) {
    if (exp?.Graphics?.prototype?.rect) return exp.Graphics;
  }
  return null;
}

export function findPlaySoundFn(require: any): ((name: string) => void) | null {
  const _w = console.warn;
  console.warn = () => {};
  try { return _findPlaySoundFn(require); } finally { console.warn = _w; }
}

function _findPlaySoundFn(require: any): ((name: string) => void) | null {
  for (const [, exp] of iterateModules(require)) {
    if (!exp || typeof exp !== "object") continue;
    let hasSfxMap = false;
    let fn: ((name: string) => void) | null = null;
    for (const [, val] of safeKeys(exp)) {
      if (typeof val === "object" && val && val.Sell && val.Cast && val.Reel) {
        hasSfxMap = true;
      }
      if (typeof val === "function" && val.length === 1 && !fn) {
        fn = val;
      }
    }
    if (hasSfxMap && fn) return fn;
  }
  return null;
}

// ── Batch capture ──
// Scans the cache once for all targets, O(modules) not O(modules * targets).

export interface CaptureResult {
  allStores: boolean;
  hasGlobals: boolean;
  hasSocket: boolean;
  appClass: any | null;
}

export function captureAll(require: any): CaptureResult {
  if (!window.__stores) window.__stores = {} as LTStores;

  // Suppress console.warn during scan — requiring modules can trigger
  // PixiJS deprecation warnings (DRAW_MODES.Sell, etc.)
  const _warn = console.warn;
  console.warn = () => {};

  const result: CaptureResult = {
    allStores: false,
    hasGlobals: !!window.__gameGlobals,
    hasSocket: !!window.__socketClient,
    appClass: null,
  };

  const pendingStores = STORE_SIGNATURES.filter(([name]) => !window.__stores[name]);
  let needGlobals = !window.__gameGlobals;
  let needSocket = !window.__socketClient;
  let needApp = true;

  for (const [id, exports] of iterateModules(require)) {
    if (pendingStores.length === 0 && !needGlobals && !needSocket && !needApp) break;

    // Stores
    if (pendingStores.length > 0) {
      for (let i = pendingStores.length - 1; i >= 0; i--) {
        const [name, check] = pendingStores[i];
        const store = findStoreInExports(exports, check);
        if (store) {
          (window.__stores as any)[name] = store;
          log("WEBPACK", "Captured store: " + name + " (module " + id + ")");
          pendingStores.splice(i, 1);
          break;
        }
      }
    }

    // GameGlobals
    if (needGlobals) {
      const gg = findGameGlobals(exports);
      if (gg) {
        window.__gameGlobals = gg;
        needGlobals = false;
        log("WEBPACK", "Captured GameGlobals (module " + id + ")");
      }
    }

    // SocketClient
    if (needSocket) {
      const sc = findSocketClient(exports);
      if (sc) {
        window.__socketClient = sc;
        needSocket = false;
        log("WEBPACK", "Captured SocketClient (module " + id + ")");
      }
    }

    // App class
    if (needApp) {
      const cls = findAppClass(exports);
      if (cls) {
        result.appClass = cls;
        needApp = false;
        log("WEBPACK", "Found App class (module " + id + ")");
      }
    }
  }

  console.warn = _warn;

  result.allStores = pendingStores.length === 0;
  result.hasGlobals = !!window.__gameGlobals;
  result.hasSocket = !!window.__socketClient;

  return result;
}

// ── Burrow template extraction (generic, no hardcoded variable name) ──

export function extractBurrowTemplatesGeneric(): void {
  try {
    const chunks = (self as any).webpackChunk_N_E;
    if (!chunks || !window.__sceneCache) return;

    for (const chunk of chunks) {
      const modules = chunk[1];
      if (!modules) continue;

      for (const moduleId in modules) {
        const fn = modules[moduleId];
        if (typeof fn !== "function") continue;
        const src = fn.toString();
        if (!src.includes("fastTravelSpawnPosition")) continue;

        // Found a module with scene templates. Backtrack from
        // fastTravelSpawnPosition to find the containing object literal.
        const marker = "fastTravelSpawnPosition";
        const markerIdx = src.indexOf(marker);
        if (markerIdx === -1) continue;

        // Scan backwards to find `=\s*{` pattern (the assignment)
        let braceStart = -1;
        for (let i = markerIdx; i >= 2; i--) {
          if (src[i] === "{") {
            const before = src.substring(Math.max(0, i - 3), i).trimEnd();
            if (before.endsWith("=")) {
              braceStart = i;
              break;
            }
          }
        }
        if (braceStart === -1) continue;

        // Find matching closing brace
        let depth = 0;
        let end = braceStart;
        for (let i = braceStart; i < src.length; i++) {
          if (src[i] === "{") depth++;
          if (src[i] === "}") {
            depth--;
            if (depth === 0) { end = i + 1; break; }
          }
        }

        let objStr = src.substring(braceStart, end);
        // Replace variable refs with null to make it parseable
        objStr = objStr.replace(
          /:([a-zA-Z_]\w*(?:\.\w+)?)\s*([,}])/g,
          (_m: string, val: string, sep: string) => {
            if (val === "true" || val === "false" || val === "null") return ":" + val + sep;
            return ":null" + sep;
          },
        );
        objStr = objStr.replace(/!1/g, "false").replace(/!0/g, "true");

        try {
          const obj = new Function("return " + objStr)();
          let count = 0;
          for (const [name, scene] of Object.entries(obj)) {
            if (
              scene &&
              typeof scene === "object" &&
              (scene as any).name &&
              (scene as any).fastTravelSpawnPosition
            ) {
              window.__sceneCache.set(name, scene as any);
              count++;
            }
          }
          if (count > 0) {
            log("SCENE", "Extracted " + count + " burrow templates (generic scan)");
            return;
          }
        } catch (e: any) {
          log("SCENE", "Failed to parse templates: " + e.message);
        }
      }
    }
  } catch (_e) {
    // ignore
  }
}
