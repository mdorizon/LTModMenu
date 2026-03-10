import { calculateGold, getRarity } from "../game/fish-utils";
import { gameClick } from "../game/player-actions";
import { saveData } from "../storage/storage";

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
    console.log("[LTModMenu] CAST found by ID");
    return castBtn;
  }

  const byClass = document.querySelector('[class*="cast" i]') as HTMLElement | null;
  if (byClass && byClass.offsetParent !== null) {
    console.log("[LTModMenu] CAST found by class:", byClass.className);
    return byClass;
  }

  const buttons = document.querySelectorAll('button, div[role="button"], [onclick]');
  for (let i = 0; i < buttons.length; i++) {
    const txt = (buttons[i].textContent || "").trim().toLowerCase();
    if (txt.includes("cast")) {
      console.log("[LTModMenu] CAST found by text:", txt);
      return buttons[i] as HTMLElement;
    }
  }

  const imgs = document.querySelectorAll('img[alt*="cast" i], img[src*="cast" i]');
  if (imgs.length > 0) {
    console.log("[LTModMenu] CAST found by img");
    return (imgs[0] as HTMLElement).closest("button") || (imgs[0] as HTMLElement).parentElement;
  }

  return null;
}

export function isReelVisible(): HTMLElement | null {
  const reelBtn = document.getElementById("reel-button");
  if (reelBtn && reelBtn.offsetParent !== null) {
    console.log("[LTModMenu] REEL found by ID");
    return reelBtn;
  }

  const byClass = document.querySelector('[class*="reel" i]') as HTMLElement | null;
  if (byClass && byClass.offsetParent !== null) {
    console.log("[LTModMenu] REEL found by class:", byClass.className);
    return byClass;
  }

  const buttons = document.querySelectorAll('button, div[role="button"], [onclick]');
  for (let i = 0; i < buttons.length; i++) {
    const txt = (buttons[i].textContent || "").trim().toLowerCase();
    if (txt.includes("reel")) {
      console.log("[LTModMenu] REEL found by text:", txt);
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
    console.log("[LTModMenu] fishingLoop already running, skipping");
    return;
  }
  fishingLoopRunning = true;
  console.log("[LTModMenu] === FISHING LOOP STARTED ===");

  while (true) {
    if (window.__botPaused) {
      await sleep(300);
      continue;
    }

    // ── 1. CAST ──
    console.log("[LTModMenu] [1] Searching for CAST button...");
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
        console.log(
          "[LTModMenu] [1] Clicking CAST button:",
          castEl.tagName,
          castEl.className || castEl.id || "",
        );
        castEl.click();
        console.log("[LTModMenu] [1] CAST CLICKED!");
        await sleep(1000);
        castFound = true;
      } else {
        if ((Date.now() - castSearchStart) % 5000 < 150) {
          console.log(
            "[LTModMenu] [1] Still searching for CAST... (" +
              Math.round((Date.now() - castSearchStart) / 1000) +
              "s)",
          );
        }
      }
      await sleep(100);
    }

    // ── 2. Wait for fish bite ──
    console.log("[LTModMenu] [2] Waiting for fish bite (fishCaught WS event)...");
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
        console.log(
          "[LTModMenu] [2] FISH BITE detected! Data:",
          JSON.stringify(b).substring(0, 150),
        );
        break;
      }
      if (Date.now() - start > 45000) {
        console.log("[LTModMenu] [2] TIMEOUT 45s, retrying cycle...");
        break;
      }
      await sleep(100);
    }

    if (!biteData) {
      console.log("[LTModMenu] [2] No bite data, restarting cycle");
      continue;
    }

    // ── 3. REEL + Auto-solve ──
    const challenge = biteData.challenge || "";
    console.log(
      "[LTModMenu] [3] Challenge present:",
      !!challenge,
      challenge ? "length=" + challenge.length : "",
    );

    await sleep(100 + Math.random() * 200);
    const reelEl = isReelVisible();
    if (reelEl) {
      console.log(
        "[LTModMenu] [3] Clicking REEL:",
        reelEl.tagName,
        reelEl.className || reelEl.id || "",
      );
      reelEl.click();
      console.log("[LTModMenu] [3] REEL CLICKED!");
    } else {
      console.log("[LTModMenu] [3] WARNING: REEL button not found!");
    }

    if (challenge) {
      console.log("[LTModMenu] [3] Waiting 500ms before auto-solve...");
      await sleep(500);
      window.__blockFishingFail = true;
      console.log("[LTModMenu] [3] Fail blocking ON");
      const solved = window.__autoSolveChallenge(challenge);
      console.log("[LTModMenu] [3] Auto-solve result:", solved);
    }

    // ── 4. Wait for fishing-result ──
    console.log("[LTModMenu] [4] Waiting for fishing-result WS event...");
    let fishData = null;
    start = Date.now();
    while (!fishData) {
      fishData = window.__lastFish;
      if (fishData) {
        console.log(
          "[LTModMenu] [4] FISH RESULT received:",
          JSON.stringify(fishData).substring(0, 150),
        );
        break;
      }
      if (Date.now() - start > 10000) {
        console.log("[LTModMenu] [4] TIMEOUT 10s waiting for result");
        break;
      }
      await sleep(200);
    }

    // Force end minigame
    if (challenge && fishData) {
      console.log("[LTModMenu] [4] Force ending minigame...");
      window.__forceEndMinigame();
      await sleep(300);
      window.__blockFishingFail = false;
      console.log("[LTModMenu] [4] Fail blocking OFF");
    }

    // ── 5. Process fish ──
    await sleep(500);
    if (!fishData) fishData = window.__lastFish;
    window.__lastFish = null;

    if (!fishData) {
      console.log("[LTModMenu] [5] No fish data at all, skipping");
      await sleep(300);
      const closeBtn = document.querySelector('[class*="close" i]') as HTMLElement | null;
      if (closeBtn) {
        console.log("[LTModMenu] [5] Clicking close button");
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

    console.log(
      "[LTModMenu] [5] Fish: " +
        fishName + " | " + rarity + " | " + weight + "kg | shiny=" + isShiny + " | gold=" + goldEarned,
    );

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
    console.log("[LTModMenu] [5] Closing popup...");
    await sleep(300);
    const closeBtn = document.querySelector('[class*="close" i]') as HTMLElement | null;
    if (closeBtn) {
      console.log("[LTModMenu] [5] Found close button:", closeBtn.tagName, closeBtn.className);
      closeBtn.click();
    } else {
      console.log("[LTModMenu] [5] No close button found, clicking center of screen");
      gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
    }
    await sleep(150);
    gameClick(window.innerWidth / 2, window.innerHeight * 0.6);
    await sleep(300 + Math.random() * 300);

    console.log(
      "[LTModMenu] === FISH #" + st.total + ": " + fishName +
        " [" + rarity.toUpperCase() + "] " + weight + "kg" + shinyTag +
        " | +" + goldEarned + "g (total: " + st.gold + "g) ===",
    );
  }
}
