import { calculateGold, getRarity } from "./fish-rarity";
import { queueFishForSale, flushSellQueue, updateAutoSellHUD } from "./auto-sell";
import { saveData } from "@core/storage";
import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";

let fishingLoopRunning = false;

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

export function stopFishingLoop(): void {
  fishingLoopRunning = false;
  clearStatus("fishing-bot");
  log("BOT", "=== FISHING LOOP STOPPED ===");

  // Clean up FishingManager state to avoid getting stuck
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
    // Dismiss any result card that might be showing
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    fm.input?.stopInput?.(false, "fishing");
    fm.input?.stopInput?.(false, "waiting-for-result");
  } catch (e) {
    log("BOT", "Cleanup error: " + (e as Error).message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function updateHUD(): void {
  const st = window.__fishStats;
  const el = (id: string) => document.getElementById(id);
  if (!el("lt-total")) return;
  el("lt-total")!.textContent = String(st.total);
  el("lt-gold")!.textContent = (st.gold as number).toLocaleString();
  el("lt-common")!.textContent = String(st.common);
  el("lt-uncommon")!.textContent = String(st.uncommon);
  el("lt-rare")!.textContent = String(st.rare);
  el("lt-epic")!.textContent = String(st.epic);
  el("lt-legendary")!.textContent = String(st.legendary);
  el("lt-secret")!.textContent = String(st.secret);
  el("lt-event")!.textContent = String(st.event);
  if (st.last_fish && el("lt-last")) {
    el("lt-last")!.textContent = st.last_fish;
  }
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

// ── Step 2: Wait for fish bite ──
// Two paths since the 2026-03-15 update:
//   Normal mode:  fishCaught → reelButton visible → player does minigame
//   Focus mode:   fishCaught → game auto-solves challenge, no reel/minigame → canCatchFish resets to true
type BiteResult = "reel" | "focus" | false;

async function waitForBite(): Promise<BiteResult> {
  const fm = getFishingManager();
  if (!fm) return false;
  const start = Date.now();
  log("BOT", "[2] Waiting for fish bite...");

  // Snapshot canCatchFish — it starts true after cast, goes false on fishCaught,
  // then either reelButton shows (normal) or canCatchFish goes back to true (focus auto-solve)
  let sawCatchFishDrop = false;

  while (fishingLoopRunning && !window.__botPaused) {
    // Normal path: reel button appears
    if (fm.reelButton?.sprite?.visible) {
      log("BOT", "[2] Fish bite! " + (fm.currentFish?.name || "unknown"));
      return "reel";
    }

    // Track when canCatchFish drops to false (= fishCaught received)
    if (!fm.canCatchFish) {
      sawCatchFishDrop = true;
    }

    // Focus path: canCatchFish dropped then came back = game auto-solved
    if (sawCatchFishDrop && fm.canCatchFish) {
      log("BOT", "[2] Focus mode auto-catch detected (" + (fm.currentFish?.name || "unknown") + ")");
      return "focus";
    }

    if (!fm.isFishing) {
      log("BOT", "[2] Stopped fishing unexpectedly");
      return false;
    }
    if (Date.now() - start > 90000) {
      log("BOT", "[2] TIMEOUT 90s waiting for bite");
      return false;
    }
    await sleep(100);
  }
  return false;
}

// ── Step 3: Start and auto-play the minigame ──
async function playMinigame(): Promise<boolean> {
  const fm = getFishingManager();
  if (!fm) return false;

  // Launch the minigame
  fm.miniGame();
  log("BOT", "[3] Minigame started");

  // Wait for playingMiniGame to become true (animation delay)
  await sleep(600);

  let clickCount = 0;
  const start = Date.now();

  while (fishingLoopRunning && fm.fishingUI?.visible) {
    if (fm.disableMinigameInput) {
      await sleep(30);
      continue;
    }

    // Check if arrow (fixed at arrowAngle) is inside the rotating triangle zone
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
      // Brief cooldown to avoid double-clicking on the same pass
      await sleep(150);
      continue;
    }

    // Safety timeout
    if (Date.now() - start > 30000) {
      log("BOT", "[3] Minigame TIMEOUT 30s");
      return false;
    }

    await sleep(20);
  }

  log("BOT", "[3] Minigame ended after " + clickCount + " clicks, fishLevel=" + fm.fishLevel);
  return true;
}

// ── Step 3b: Wait for focus auto-catch result (no minigame, no modal) ──
async function waitForFocusResult(): Promise<{ id: string; name: string; weight: number; isShiny: boolean } | null> {
  const start = Date.now();
  log("BOT", "[3b] Focus mode — waiting for fishing-result...");

  while (fishingLoopRunning) {
    if (window.__lastFish) break;
    if (Date.now() - start > 15000) {
      log("BOT", "[3b] TIMEOUT waiting for focus fishing-result");
      break;
    }
    await sleep(100);
  }

  const fishData = window.__lastFish;
  window.__lastFish = null;

  if (!fishData) {
    log("BOT", "[3b] No fish data received");
    return null;
  }

  log("BOT", "[3b] Focus fish: " + fishData.name + " " + fishData.weight + "kg shiny=" + fishData.isShiny);
  return { id: String(fishData.id || ""), name: fishData.name || "", weight: fishData.weight || 0, isShiny: fishData.isShiny || false };
}

// ── Step 4: Wait for result and dismiss modal (normal mode) ──
async function waitAndDismissResult(): Promise<{ id: string; name: string; weight: number; isShiny: boolean } | null> {
  const fm = getFishingManager();
  if (!fm) return null;
  const start = Date.now();
  log("BOT", "[4] Waiting for result...");

  // Wait for the fishing-result WS event (sets __lastFish)
  while (fishingLoopRunning) {
    if (window.__lastFish) break;
    if (Date.now() - start > 15000) {
      log("BOT", "[4] TIMEOUT waiting for fishing-result");
      break;
    }
    await sleep(100);
  }

  const fishData = window.__lastFish;
  window.__lastFish = null;

  // Dismiss the result card via Space after the card animation (~917ms)
  if (fishData) {
    await sleep(1000);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    log("BOT", "[4] Result card dismissed");
    await sleep(300);
  }

  if (!fishData) {
    log("BOT", "[4] No fish data received");
    return null;
  }

  log("BOT", "[4] Fish result: " + fishData.name + " " + fishData.weight + "kg shiny=" + fishData.isShiny);
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
    const biteResult = await waitForBite();
    if (!biteResult) continue;

    let result: { id: string; name: string; weight: number; isShiny: boolean } | null;

    if (biteResult === "focus") {
      // ── Focus path: game already auto-solved, just wait for __lastFish ──
      result = await waitForFocusResult();
    } else {
      // ── Normal path: minigame → result modal ──
      const minigameOk = await playMinigame();
      if (!minigameOk) {
        await sleep(1000);
        continue;
      }
      result = await waitAndDismissResult();
    }

    // ── 5. Process fish stats ──
    if (result) {
      const rarity = getRarity(result.name);
      let statKey = rarity;
      if (rarity === "halloween" || rarity === "christmas") statKey = "event";
      const goldEarned = calculateGold(result.name, result.weight, result.isShiny);

      const st = window.__fishStats;
      if (st[statKey] !== undefined) (st[statKey] as number)++;
      else st.unknown++;
      st.total++;
      (st.gold as number) += goldEarned;

      const shinyTag = result.isShiny ? " SHINY!" : "";
      const goldStr = goldEarned ? " +" + goldEarned + "g" : "";
      st.last_fish = result.name + " (" + rarity + ") " + result.weight + "kg" + shinyTag + goldStr;

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

    // Brief pause before next cast
    await sleep(500 + Math.random() * 500);
  }
}
