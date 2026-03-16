import { getRarity } from "./fish-rarity";
import { getAutoSellConfig } from "./auto-sell";
import { log } from "@core/logger";
import { notify } from "@ui/status-bar";
import { mkCoin } from "@ui/components";

const rarityToConfigKey: Record<string, string> = {
  common: "keepCommon",
  uncommon: "keepUncommon",
  rare: "keepRare",
  epic: "keepEpic",
  legendary: "keepLegendary",
  secret: "keepSecret",
  halloween: "keepEvent",
  christmas: "keepEvent",
};

function getAccessToken(): string | null {
  try {
    const state = window.__stores?.useUserData?.getState();
    if (state?.accessToken) return state.accessToken;
  } catch (_e) { /* ignore */ }
  return window.__wsAuthToken;
}

function shouldSell(fish: any): boolean {
  if (!fish?.id || !fish?.name) return false;
  const cfg = getAutoSellConfig();
  if (fish.isShiny && cfg.keepShiny) return false;
  const rarity = getRarity(fish.name);
  const key = rarityToConfigKey[rarity];
  if (key && (cfg as any)[key]) return false;
  return true;
}

let selling = false;

export async function sellAll(): Promise<{ sold: number; gold: number } | null> {
  if (selling) return null;
  const token = getAccessToken();
  if (!token) {
    log("SELL-ALL", "No access token");
    return null;
  }

  const store = window.__stores?.useUserData;
  const inventory: any[] = store?.getState()?.fishInventory || [];
  if (inventory.length === 0) {
    log("SELL-ALL", "Inventory empty");
    notify("No fish to sell", "info", 2000);
    return null;
  }

  const toSell = inventory.filter(shouldSell);
  if (toSell.length === 0) {
    log("SELL-ALL", "No fish to sell (all kept by config)");
    notify("All fish are set to KEEP", "info", 2000);
    return null;
  }

  const ids = toSell.map((f: any) => f.id);
  selling = true;
  log("SELL-ALL", "Selling " + ids.length + "/" + inventory.length + " fish...");

  try {
    const resp = await fetch("https://app.lofi.town/api/sellFish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ fishIds: ids }),
    });

    if (!resp.ok) {
      log("SELL-ALL", "API error " + resp.status);
      notify("Sell failed (API " + resp.status + ")", "error", 3000);
      return null;
    }

    const data = await resp.json();
    const goldGained = data.goldToGain || 0;

    if (store) {
      const state = store.getState();
      store.setState({
        points: (state.points || 0) + goldGained,
        fishInventory: inventory.filter((f: any) => !ids.includes(f.id)),
      });
    }

    log("SELL-ALL", "Sold " + ids.length + " fish +" + goldGained + "g");
    notify("Sold " + ids.length + " fish " + mkCoin(goldGained), "success", 3000, true);
    return { sold: ids.length, gold: goldGained };
  } catch (e) {
    log("SELL-ALL", "Fetch error: " + (e as Error).message);
    notify("Sell failed", "error", 3000);
    return null;
  } finally {
    selling = false;
  }
}

// ── UI ──

export function renderSellAll(): string {
  return '<button class="lt-action lt-danger" id="lt-sell-all" style="flex:0 0 auto;margin:0;width:auto;padding:10px 12px;font-size:12px;">' +
    'SELL ALL</button>';
}

export function bindSellAll(): void {
  const btn = document.getElementById("lt-sell-all");
  if (!btn) return;
  btn.onclick = () => { sellAll(); };
}
