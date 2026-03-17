import { calculateGold, getRarity } from "./fish-rarity";
import { queueFishForSale, flushSellQueue, updateAutoSellHUD } from "./auto-sell";
import { saveData, loadData } from "@core/storage";
import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";
import { mkCoin } from "@ui/components";

const RARITY_COLORS: Record<string, string> = {
  common: "#8a8a9a", uncommon: "#5ad85a", rare: "#5a9af0",
  epic: "#b06ad8", legendary: "#f0a030", secret: "#f05050",
  halloween: "#f08030", christmas: "#60c0f0", unknown: "#6a6a9a",
};

let fishingLoopRunning = false;
let skipMinigame = loadData<boolean>("skipMinigame", false);
let lastSolvedChallenge = "";

export function getSkipMinigame(): boolean { return skipMinigame; }
export function setSkipMinigame(v: boolean): void {
  skipMinigame = v;
  saveData("skipMinigame", v);
}

function getFishingManager(): any {
  const gameObjects = (window.__gameApp as any)?.gameObjects;
  if (!gameObjects) return null;
  for (let i = 0; i < gameObjects.length; i++) {
    if (gameObjects[i]?.name === "FishingManager") return gameObjects[i];
  }
  return null;
}

export function isFishingLoopRunning(): boolean {
  return fishingLoopRunning;
}

export function tryAutoResumeFishing(): void {
  if (!window.__botPaused && !fishingLoopRunning) {
    log("BOT", "Auto-resuming fishing loop from saved state");
    fishingLoop();
  }
}

export function stopFishingLoop(): void {
  fishingLoopRunning = false;
  clearStatus("fishing-bot");
  log("BOT", "=== FISHING LOOP STOPPED ===");

  const fm = getFishingManager();
  if (!fm || (!fm.isFishing && !fm.fishingUI?.visible)) return;
  try {
    if (fm.fishingUI?.visible) {
      fm.stopMiniGame();
      log("BOT", "Cleaned up: stopped minigame");
    }
    if (fm.isFishing) {
      fm.stopFishing();
      log("BOT", "Cleaned up: stopped fishing");
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    fm.input?.stopInput?.(false, "fishing");
    fm.input?.stopInput?.(false, "waiting-for-result");
  } catch (e) {
    log("BOT", "Cleanup error: " + (e as Error).message);
  }
}

// ── Background-safe timer ──
// Web Worker timer avoids setTimeout throttling in background tabs.
let timerWorker: Worker | null = null;
const timerCallbacks = new Map<number, () => void>();
let timerIdCounter = 0;

function initTimerWorker(): void {
  try {
    const blob = new Blob([
      "const t=new Map();onmessage=e=>{if(e.data.c===\"s\"){const i=e.data.i;const h=setTimeout(()=>{postMessage(i);t.delete(i)},e.data.ms);t.set(i,h)}else if(e.data.c===\"x\"){clearTimeout(t.get(e.data.i));t.delete(e.data.i)}}"
    ], { type: "application/javascript" });
    timerWorker = new Worker(URL.createObjectURL(blob));
    timerWorker.onmessage = (e) => {
      const cb = timerCallbacks.get(e.data);
      if (cb) { timerCallbacks.delete(e.data); cb(); }
    };
    log("BOT", "Timer Worker initialized");
  } catch (_) {
    timerWorker = null;
  }
}

function sleep(ms: number): Promise<void> {
  if (!timerWorker) initTimerWorker();
  if (timerWorker) {
    return new Promise((resolve) => {
      const id = timerIdCounter++;
      timerCallbacks.set(id, resolve);
      timerWorker!.postMessage({ c: "s", i: id, ms });
    });
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function updateHUD(): void {
  const st = window.__fishStats;
  const el = (id: string) => document.getElementById(id);
  if (!el("lt-total")) return;
  el("lt-total")!.textContent = String(st.total);
  el("lt-gold")!.innerHTML = mkCoin(st.gold as number);
  el("lt-common")!.textContent = String(st.common);
  el("lt-uncommon")!.textContent = String(st.uncommon);
  el("lt-rare")!.textContent = String(st.rare);
  el("lt-epic")!.textContent = String(st.epic);
  el("lt-legendary")!.textContent = String(st.legendary);
  el("lt-secret")!.textContent = String(st.secret);
  const shinyEl = el("lt-shiny");
  if (shinyEl) shinyEl.textContent = String(st.shiny);
  const eventRow = el("lt-event-row");
  if (eventRow) {
    eventRow.style.display = st.event > 0 ? "" : "none";
  }
  const eventEl = el("lt-event");
  if (eventEl) eventEl.textContent = String(st.event);
  const lastEl = el("lt-last");
  if (lastEl) {
    const lf = st.last_fish;
    if (lf && typeof lf === "object") {
      const color = RARITY_COLORS[lf.rarity] || RARITY_COLORS.unknown;
      const shiny = lf.isShiny ? ' <span style="color:#f0e060;">SHINY</span>' : "";
      lastEl.style.color = color;
      lastEl.innerHTML =
        '<span>' + lf.name + shiny + '</span>' +
        '<span>' + lf.weight + 'kg</span>' +
        '<span>' + mkCoin(lf.gold) + '</span>';
      lastEl.style.display = "";
      const sep = el("lt-last-sep");
      if (sep) sep.style.display = "";
    } else {
      lastEl.style.display = "none";
      const sep = el("lt-last-sep");
      if (sep) sep.style.display = "none";
    }
  }
}

function destroyOrphanedResultCards(): void {
  const fm = getFishingManager();
  const uic = (fm?.fishingUI as any)?.parent;
  const kids: any[] = uic?.children ?? uic?._children ?? [];
  const orphans = kids.filter((c: any) => c.zIndex === 11 && c.cursor === "pointer");
  for (const card of orphans) {
    try { card.destroy(); } catch (_) {}
  }
  if (orphans.length > 0) log("BOT", "Destroyed " + orphans.length + " orphaned result cards");
}

function isLocalPlayerSeated(): boolean {
  const lp = window.__gameApp?.localPlayer;
  if (!lp) return false;
  return !!lp.currentSeatId;
}

// ── Step 1: Cast the line via FishingManager.startFishing() ──
function castLine(): boolean {
  const fm = getFishingManager();
  if (!fm) {
    log("BOT", "[1] FishingManager not found");
    return false;
  }
  if (fm.isFishing) {
    log("BOT", "[1] Already fishing");
    return true;
  }
  fm.startFishing();
  log("BOT", "[1] Line cast via startFishing()");
  return true;
}

// ── Step 2: Wait for fish bite (event-driven — no timer dependency) ──
// Uses lt:fish-caught DOM event dispatched by websocket-hook on fishCaught WS message.
// Fallback watchdog runs every 3s (throttled in background is fine — it's only for
// cancellation detection, not for detecting the bite itself).
function waitForBite(): Promise<boolean> {
  const fm = getFishingManager();
  if (!fm) return Promise.resolve(false);
  log("BOT", "[2] Waiting for fish bite...");

  if (fm.reelButton?.sprite?.visible && fm.currentChallenge !== lastSolvedChallenge) {
    log("BOT", "[2] Fish bite! " + (fm.currentFish?.name || "unknown"));
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (val: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("lt:fish-caught", onBite as EventListener);
      clearInterval(watchdog);
      resolve(val);
    };

    const onBite = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.challenge && detail.challenge === lastSolvedChallenge) {
        log("BOT", "[2] Duplicate fishCaught ignored (challenge already solved)");
        return;
      }
      log("BOT", "[2] Fish bite! " + (detail?.fish?.name || "unknown"));
      settle(true);
    };

    document.addEventListener("lt:fish-caught", onBite as EventListener);

    const start = Date.now();
    const watchdog = setInterval(() => {
      if (!fishingLoopRunning || window.__botPaused) { settle(false); return; }
      if (!fm.isFishing) { log("BOT", "[2] Stopped fishing unexpectedly"); settle(false); return; }
      if (Date.now() - start > 90000) { log("BOT", "[2] TIMEOUT 90s waiting for bite"); settle(false); return; }
    }, 3000);
  });
}

function isBackground(): boolean {
  return document.hidden || !document.hasFocus();
}

// ── Step 3: Solve the minigame ──
// Foreground: plays the visual minigame (rotation/click cycle) for natural behavior.
// Background: bypasses via fm.win() since GSAP tweens freeze when RAF is paused.
async function playMinigame(): Promise<boolean> {
  const fm = getFishingManager();
  if (!fm) return false;

  if (!fm.currentChallenge) {
    log("BOT", "[3] No challenge available");
    return false;
  }

  if (skipMinigame || isBackground()) {
    return playMinigameBackground(fm);
  }
  return playMinigameForeground(fm);
}

async function playMinigameBackground(fm: any): Promise<boolean> {
  fm.hideReelButton();

  // Delay before solving — the server may reject instant solutions.
  const delay = 2000 + Math.random() * 2000;
  log("BOT", "[3] Bypass minigame, solving in " + (delay / 1000).toFixed(1) + "s...");
  await sleep(delay);

  if (!fishingLoopRunning) return false;

  // Call win() to use the game's own solver and socket, but temporarily
  // disable stopFishing() to prevent sending updateSitAnimation("none")
  // in the same tick as getFishingResult. The server can race between
  // the two messages and discard the result. We defer stopFishing()
  // until after fishing-result arrives (in waitAndDismissResult).
  lastSolvedChallenge = fm.currentChallenge || "";
  const origStopFishing = fm.stopFishing;
  fm.stopFishing = () => {};
  fm.win();
  fm.stopFishing = origStopFishing;

  log("BOT", "[3] Challenge solved (stopFishing deferred)");

  if (fm.castButton?.hide) fm.castButton.hide();
  if (fm.fishingUI) fm.fishingUI.visible = false;

  return true;
}

async function playMinigameForeground(fm: any): Promise<boolean> {
  fm.miniGame();
  log("BOT", "[3] Minigame started (foreground)");

  // Wait for the entry animation before the minigame logic starts
  await sleep(600);

  let clickCount = 0;
  const start = Date.now();

  while (fishingLoopRunning && fm.fishingUI?.visible) {
    // If the tab goes to background mid-minigame, bail out and win directly
    if (isBackground()) {
      log("BOT", "[3] Tab went to background mid-minigame, finishing via win()");
      fm.win();
      if (fm.fishingUI) fm.fishingUI.visible = false;
      return true;
    }

    if (fm.disableMinigameInput) {
      await sleep(30);
      continue;
    }

    const triStart = ((180 * fm.rotatingTriangle.rotation / Math.PI) % 360 + 360) % 360;
    const triEnd = (triStart + fm.triangleThickness) % 360;
    const arrow = ((fm.arrowAngle % 360) + 360) % 360;

    let inZone: boolean;
    if (triStart <= triEnd) {
      inZone = arrow >= triStart && arrow <= triEnd;
    } else {
      inZone = arrow >= triStart || arrow <= triEnd;
    }

    if (inZone) {
      fm.handleMinigameClick();
      clickCount++;
      await sleep(150);
      continue;
    }

    if (Date.now() - start > 30000) {
      log("BOT", "[3] Minigame TIMEOUT 30s");
      return false;
    }

    await sleep(20);
  }

  log("BOT", "[3] Minigame ended after " + clickCount + " clicks, fishLevel=" + fm.fishLevel);
  return true;
}

// ── Step 4: Wait for result and dismiss the result card ──
// Event-driven via lt:fishing-result DOM event (dispatched by websocket-hook on fishing-result WS message).
async function waitAndDismissResult(): Promise<{ id: string; name: string; weight: number; isShiny: boolean } | null> {
  log("BOT", "[4] Waiting for result...");

  // Already received before we got here
  if (window.__lastFish) {
    const quick = window.__lastFish;
    window.__lastFish = null;
    // fall through to dismiss logic below
    return finishResult(quick);
  }

  const fishData = await new Promise<any>((resolve) => {
    let settled = false;
    const settle = (val: any) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("lt:fishing-result", onResult as EventListener);
      clearInterval(watchdog);
      resolve(val);
    };

    const onResult = (e: Event) => {
      const data = (e as CustomEvent).detail;
      window.__lastFish = null;
      settle(data);
    };

    document.addEventListener("lt:fishing-result", onResult as EventListener);

    const start = Date.now();
    const watchdog = setInterval(() => {
      if (!fishingLoopRunning) { settle(null); return; }
      if (Date.now() - start > 30000) {
        log("BOT", "[4] TIMEOUT waiting for fishing-result");
        settle(null);
      }
    }, 3000);
  });

  window.__lastFish = null;
  return finishResult(fishData);
}

async function finishResult(fishData: any): Promise<{ id: string; name: string; weight: number; isShiny: boolean } | null> {

  // Clean up fishing state now that the server has responded.
  // In background bypass, stopFishing() was deferred to avoid a race condition.
  // In foreground, win() already called it so isFishing is false — this is a no-op.
  const fm = getFishingManager();
  if (fm?.isFishing) {
    fm.stopFishing();
    if (fm.castButton?.hide) fm.castButton.hide();
  }
  // Force-hide reel button: GSAP animations are frozen in background, so
  // reelButton.hide() may not run. Without this, the next waitForBite() fallback
  // check sees visible=true and immediately re-uses a stale challenge.
  if (fm?.reelButton?.sprite) fm.reelButton.sprite.visible = false;

  // Dismiss the result card.
  // In foreground: dispatch Space 3x (game installs listener after ~917ms animation).
  // In background: skip Space (its setTimeout is throttled to 1/min after 5min, adding 3min delay).
  //   Instead, register a visibilitychange listener to destroy orphaned PixiJS card containers on return.
  if (fishData) {
    if (!isBackground()) {
      for (let i = 0; i < 3; i++) {
        await sleep(500);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
      }
    } else {
      const app = window.__gameApp as any;
      if (app?.hideBlackOverlay) app.hideBlackOverlay();
      fm?.input?.stopInput?.(false, "waiting-for-result");
      const onVisible = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVisible);
          destroyOrphanedResultCards();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
    }

    log("BOT", "[4] Result card dismissed");
  }

  if (!fishData) {
    log("BOT", "[4] No fish data received");
    return null;
  }

  log("BOT", "[4] Fish: " + fishData.name + " " + fishData.weight + "kg shiny=" + fishData.isShiny);
  return { id: String(fishData.id || ""), name: fishData.name || "", weight: fishData.weight || 0, isShiny: fishData.isShiny || false };
}

// ── Main fishing loop ──
export async function fishingLoop(): Promise<void> {
  if (fishingLoopRunning) {
    log("BOT", "fishingLoop already running, skipping");
    return;
  }
  fishingLoopRunning = true;
  setStatus("fishing-bot", { label: "FISHING", color: "#6abe6a", bg: "#1a3a1a" });
  log("BOT", "=== FISHING LOOP STARTED ===");

  while (fishingLoopRunning) {
    if (window.__botPaused) {
      await sleep(300);
      continue;
    }

    // ── Wait until player is seated on a fishing spot ──
    if (!isLocalPlayerSeated()) {
      log("BOT", "[0] Waiting for player to sit on a fishing spot...");
      while (!isLocalPlayerSeated() && fishingLoopRunning && !window.__botPaused) {
        await sleep(500);
      }
      if (!fishingLoopRunning || window.__botPaused) continue;
      log("BOT", "[0] Player is seated!");
    }

    // ── 1. Cast the line ──
    if (!castLine()) {
      await sleep(1000);
      continue;
    }

    // ── 2. Wait for fish bite ──
    const gotBite = await waitForBite();
    if (!gotBite) continue;

    // ── 3. Solve the minigame ──
    const minigameOk = await playMinigame();
    if (!minigameOk) {
      await sleep(1000);
      continue;
    }

    // ── 4. Wait for result and dismiss card ──
    const result = await waitAndDismissResult();

    // ── 5. Process fish stats ──
    if (result) {
      const rarity = getRarity(result.name);
      let statKey = rarity;
      if (rarity === "halloween" || rarity === "christmas") statKey = "event";
      const goldEarned = calculateGold(result.name, result.weight, result.isShiny);

      const st = window.__fishStats;
      if (st[statKey] !== undefined) (st[statKey] as number)++;
      else st.unknown++;
      if (result.isShiny) st.shiny++;
      st.total++;
      (st.gold as number) += goldEarned;

      st.last_fish = { name: result.name, rarity, weight: result.weight, gold: goldEarned, isShiny: result.isShiny };
      const shinyTag = result.isShiny ? " SHINY!" : "";

      updateHUD();
      saveData("fishStats", window.__fishStats);

      log("BOT", "=== FISH #" + st.total + ": " + result.name + " [" + rarity.toUpperCase() + "] " + result.weight + "kg" + shinyTag + " | +" + goldEarned + "g (total: " + st.gold + "g) ===");

      // ── 6. Auto-sell ──
      if (result.id) {
        if (queueFishForSale(result.id, result.name, result.isShiny)) {
          const sellResult = await flushSellQueue();
          if (sellResult) updateAutoSellHUD();
        }
      }
    } else {
      log("BOT", "[5] No fish data, skipping stats");
    }

    // Brief pause before next cast (shorter during Fishing Frenzy)
    await sleep(window.__fishingFrenzyActive ? 100 + Math.random() * 100 : 500 + Math.random() * 500);
  }
}
