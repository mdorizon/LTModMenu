import { calculateGold, getRarity } from "./fish-utils";
import { gameClick } from "@core/game";
import { saveData } from "@core/storage";
import { log } from "@core/logger";

let fishingLoopRunning = false;

export function isFishingLoopRunning(): boolean {
  return fishingLoopRunning;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isCastVisible(): HTMLElement | null {
  const castBtn = document.getElementById("cast-button");
  if (castBtn && castBtn.offsetParent !== null) {
    log("BOT", "CAST found by ID");
    return castBtn;
  }

  const byClass = document.querySelector('[class*="cast" i]') as HTMLElement | null;
  if (byClass && byClass.offsetParent !== null) {
    log("BOT", "CAST found by class: " + byClass.className);
    return byClass;
  }

  const buttons = document.querySelectorAll('button, div[role="button"], [onclick]');
  for (let i = 0; i < buttons.length; i++) {
    const txt = (buttons[i].textContent || "").trim().toLowerCase();
    if (txt.includes("cast")) {
      log("BOT", "CAST found by text: " + txt);
      return buttons[i] as HTMLElement;
    }
  }

  const imgs = document.querySelectorAll('img[alt*="cast" i], img[src*="cast" i]');
  if (imgs.length > 0) {
    log("BOT", "CAST found by img");
    return (imgs[0] as HTMLElement).closest("button") || (imgs[0] as HTMLElement).parentElement;
  }

  return null;
}

export function isReelVisible(): HTMLElement | null {
  const reelBtn = document.getElementById("reel-button");
  if (reelBtn && reelBtn.offsetParent !== null) {
    log("BOT", "REEL found by ID");
    return reelBtn;
  }

  const byClass = document.querySelector('[class*="reel" i]') as HTMLElement | null;
  if (byClass && byClass.offsetParent !== null) {
    log("BOT", "REEL found by class: " + byClass.className);
    return byClass;
  }

  const buttons = document.querySelectorAll('button, div[role="button"], [onclick]');
  for (let i = 0; i < buttons.length; i++) {
    const txt = (buttons[i].textContent || "").trim().toLowerCase();
    if (txt.includes("reel")) {
      log("BOT", "REEL found by text: " + txt);
      return buttons[i] as HTMLElement;
    }
  }

  return null;
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

export async function fishingLoop(): Promise<void> {
  if (fishingLoopRunning) {
    log("BOT", "fishingLoop already running, skipping");
    return;
  }
  fishingLoopRunning = true;
  log("BOT", "=== FISHING LOOP STARTED ===");

  while (true) {
    if (window.__botPaused) {
      await sleep(300);
      continue;
    }

    // ── 1. CAST ──
    log("BOT", "[1] Searching for CAST button...");
    let castFound = false;
    const castSearchStart = Date.now();
    while (!castFound) {
      if (window.__botPaused) {
        await sleep(300);
        continue;
      }

      const castEl = isCastVisible();
      if (castEl) {
        await sleep(100 + Math.random() * 200);
        log("BOT", "[1] Clicking CAST button");
        castEl.click();
        log("BOT", "[1] CAST CLICKED!");
        await sleep(1000);
        castFound = true;
      } else {
        if ((Date.now() - castSearchStart) % 5000 < 150) {
          log("BOT", "[1] Still searching for CAST... (" + Math.round((Date.now() - castSearchStart) / 1000) + "s)");
        }
      }
      await sleep(100);
    }

    // ── 2. Wait for fish bite ──
    log("BOT", "[2] Waiting for fish bite...");
    let biteData = null;
    let start = Date.now();
    while (!biteData) {
      if (window.__botPaused) {
        await sleep(300);
        continue;
      }
      const b = window.__fishBite;
      if (b) {
        window.__fishBite = null;
        biteData = b;
        log("BOT", "[2] FISH BITE detected!", b);
        break;
      }
      if (Date.now() - start > 45000) {
        log("BOT", "[2] TIMEOUT 45s, retrying cycle...");
        break;
      }
      await sleep(100);
    }

    if (!biteData) {
      log("BOT", "[2] No bite data, restarting cycle");
      continue;
    }

    // ── 3. REEL + Auto-solve ──
    const challenge = biteData.challenge || "";
    log("BOT", "[3] Challenge present: " + !!challenge);

    await sleep(100 + Math.random() * 200);
    const reelEl = isReelVisible();
    if (reelEl) {
      log("BOT", "[3] Clicking REEL");
      reelEl.click();
      log("BOT", "[3] REEL CLICKED!");
    } else {
      log("BOT", "[3] WARNING: REEL button not found!");
    }

    if (challenge) {
      log("BOT", "[3] Waiting 500ms before auto-solve...");
      await sleep(500);
      window.__blockFishingFail = true;
      log("BOT", "[3] Fail blocking ON");
      const solved = window.__autoSolveChallenge(challenge);
      log("BOT", "[3] Auto-solve result: " + solved);
    }

    // ── 4. Wait for fishing-result ──
    log("BOT", "[4] Waiting for fishing-result...");
    let fishData = null;
    start = Date.now();
    while (!fishData) {
      fishData = window.__lastFish;
      if (fishData) {
        log("BOT", "[4] FISH RESULT received", fishData);
        break;
      }
      if (Date.now() - start > 10000) {
        log("BOT", "[4] TIMEOUT 10s waiting for result");
        break;
      }
      await sleep(200);
    }

    // Force end minigame
    if (challenge && fishData) {
      log("BOT", "[4] Force ending minigame...");
      window.__forceEndMinigame();
      await sleep(300);
      window.__blockFishingFail = false;
      log("BOT", "[4] Fail blocking OFF");
    }

    // ── 5. Process fish ──
    await sleep(500);
    if (!fishData) fishData = window.__lastFish;
    window.__lastFish = null;

    if (!fishData) {
      log("BOT", "[5] No fish data at all, skipping");
      await sleep(300);
      const closeBtn = document.querySelector('[class*="close" i]') as HTMLElement | null;
      if (closeBtn) {
        log("BOT", "[5] Clicking close button");
        closeBtn.click();
      }
      continue;
    }

    const fishName = fishData.name || "";
    const weight = fishData.weight || 0;
    const isShiny = fishData.isShiny || false;
    const rarity = getRarity(fishName);
    let statKey = rarity;
    if (rarity === "halloween" || rarity === "christmas") statKey = "event";
    const goldEarned = calculateGold(fishName, weight, isShiny);

    log("BOT", "[5] Fish: " + fishName + " | " + rarity + " | " + weight + "kg | shiny=" + isShiny + " | gold=" + goldEarned);

    const st = window.__fishStats;
    if (st[statKey] !== undefined) (st[statKey] as number)++;
    else st.unknown++;
    st.total++;
    (st.gold as number) += goldEarned;

    const shinyTag = isShiny ? " SHINY!" : "";
    const goldStr = goldEarned ? " +" + goldEarned + "g" : "";
    st.last_fish = fishName + " (" + rarity + ") " + weight + "kg" + shinyTag + goldStr;

    updateHUD();
    saveData("fishStats", window.__fishStats);

    // Close popup
    log("BOT", "[5] Closing popup...");
    await sleep(300);
    const closeBtn = document.querySelector('[class*="close" i]') as HTMLElement | null;
    if (closeBtn) {
      log("BOT", "[5] Found close button, clicking");
      closeBtn.click();
    } else {
      log("BOT", "[5] No close button, clicking center");
      gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
    }
    await sleep(150);
    gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
    await sleep(300 + Math.random() * 300);

    log("BOT", "=== FISH #" + st.total + ": " + fishName + " [" + rarity.toUpperCase() + "] " + weight + "kg" + shinyTag + " | +" + goldEarned + "g (total: " + st.gold + "g) ===");
  }
}
