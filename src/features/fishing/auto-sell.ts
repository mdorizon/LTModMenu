import { getRarity } from "./fish-rarity";
import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";
import { mkCoin } from "@ui/components";

export interface AutoSellConfig {
  enabled: boolean;
  keepCommon: boolean;
  keepUncommon: boolean;
  keepRare: boolean;
  keepEpic: boolean;
  keepLegendary: boolean;
  keepSecret: boolean;
  keepShiny: boolean;
  keepEvent: boolean;
}

const DEFAULT_CONFIG: AutoSellConfig = {
  enabled: false,
  keepCommon: false,
  keepUncommon: false,
  keepRare: false,
  keepEpic: false,
  keepLegendary: true,
  keepSecret: true,
  keepShiny: true,
  keepEvent: true,
};

const stored = loadData<Partial<AutoSellConfig>>("autoSellConfig", {});
let config: AutoSellConfig = { ...DEFAULT_CONFIG, ...stored };
let pendingFishIds: string[] = [];
let totalAutoSold = 0;
let totalAutoGold = 0;
let selling = false;

export function getAutoSellConfig(): AutoSellConfig {
  return config;
}

export function setAutoSellConfig(partial: Partial<AutoSellConfig>): void {
  Object.assign(config, partial);
  saveData("autoSellConfig", config);
}

export function getAutoSellStats(): { sold: number; gold: number } {
  return { sold: totalAutoSold, gold: totalAutoGold };
}

function getAccessToken(): string | null {
  try {
    const state = window.__stores?.useUserData?.getState();
    if (state?.accessToken) return state.accessToken;
  } catch (_e) { /* ignore */ }
  return window.__wsAuthToken;
}

const rarityToConfigKey: Record<string, keyof AutoSellConfig> = {
  common: "keepCommon",
  uncommon: "keepUncommon",
  rare: "keepRare",
  epic: "keepEpic",
  legendary: "keepLegendary",
  secret: "keepSecret",
  halloween: "keepEvent",
  christmas: "keepEvent",
};

function shouldSellFish(name: string, isShiny: boolean): boolean {
  if (!config.enabled) return false;
  if (isShiny && config.keepShiny) return false;
  const rarity = getRarity(name);
  const key = rarityToConfigKey[rarity];
  if (key && config[key]) return false;
  return true;
}

export function queueFishForSale(fishId: string, fishName: string, isShiny: boolean): boolean {
  if (!shouldSellFish(fishName, isShiny)) return false;
  pendingFishIds.push(fishId);
  log("AUTOSELL", "Queued: " + fishName + " (" + fishId + ") pending=" + pendingFishIds.length);
  return true;
}

export async function flushSellQueue(): Promise<{ sold: number; gold: number } | null> {
  if (pendingFishIds.length === 0 || selling) return null;
  const token = getAccessToken();
  if (!token) {
    log("AUTOSELL", "No access token, skipping sell");
    return null;
  }

  const ids = [...pendingFishIds];
  pendingFishIds = [];
  selling = true;

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
      log("AUTOSELL", "API error " + resp.status);
      return null;
    }

    const data = await resp.json();
    const goldGained = data.goldToGain || 0;
    totalAutoSold += ids.length;
    totalAutoGold += goldGained;

    log("AUTOSELL", "Sold " + ids.length + " fish +" + goldGained + "g (total: " + totalAutoSold + "/" + totalAutoGold + "g)");

    try {
      const store = window.__stores?.useUserData;
      if (store) {
        const state = store.getState();
        const inv: any[] = state.fishInventory || [];
        const idSet = new Set(ids);
        store.setState({
          points: (state.points || 0) + goldGained,
          fishInventory: inv.filter((f: any) => !idSet.has(f.id)),
        });
      }
    } catch (_e) { /* ignore */ }

    return { sold: ids.length, gold: goldGained };
  } catch (e) {
    log("AUTOSELL", "Fetch error: " + (e as Error).message);
    return null;
  } finally {
    selling = false;
  }
}

// ── UI ──

function autoSoldLabel(): string {
  return mkCoin(totalAutoGold);
}

export function updateAutoSellHUD(): void {
  const el = document.getElementById("lt-auto-sold");
  if (!el) return;
  el.innerHTML = autoSoldLabel();
}

export function renderAutoSellStats(): string {
  return '<div class="lt-sep"></div>' +
    '<div class="lt-stat-row" style="font-size:15px;color:var(--lt-text-muted, #6a6a9a);">' +
    '<span>Auto-Sold</span><span id="lt-auto-sold">' + autoSoldLabel() + '</span></div>';
}

export function renderAutoSellButton(): string {
  return '<button class="lt-action ' + (config.enabled ? 'lt-success' : 'lt-muted') + '" id="lt-auto-sell" style="flex:1;margin:0;width:auto;">' +
    'AUTO-SELL: ' + (config.enabled ? 'ON' : 'OFF') + '</button>';
}

export type SellConfigKey = "keepCommon" | "keepUncommon" | "keepRare" | "keepEpic" | "keepLegendary" | "keepSecret" | "keepShiny" | "keepEvent";

export function sellTag(configKey: SellConfigKey): string {
  const keep = config[configKey];
  return '<span class="lt-sell-tag" data-key="' + configKey + '" style="' +
    'cursor:pointer;font-size:10px;margin-right:6px;padding:1px 5px;border-radius:3px;font-weight:600;' +
    'background:' + (keep ? '#6abe6a33' : '#be6a6a33') + ';' +
    'color:' + (keep ? '#6abe6a' : '#be6a6a') + ';">' +
    (keep ? 'KEEP' : 'SELL') + '</span>';
}

export function bindAutoSell(rerender: () => void): void {
  const toggle = document.getElementById("lt-auto-sell");
  if (toggle) {
    toggle.onclick = () => {
      config.enabled = !config.enabled;
      saveData("autoSellConfig", config);
      log("UI", "Auto-sell " + (config.enabled ? "enabled" : "disabled"));
      rerender();
    };
  }

  document.querySelectorAll<HTMLElement>(".lt-sell-tag").forEach((tag) => {
    tag.onclick = (e) => {
      e.stopPropagation();
      const key = tag.dataset.key as SellConfigKey;
      if (!key) return;
      config[key] = !config[key];
      saveData("autoSellConfig", config);
      const keep = config[key];
      tag.textContent = keep ? "KEEP" : "SELL";
      tag.style.background = keep ? "#6abe6a33" : "#be6a6a33";
      tag.style.color = keep ? "#6abe6a" : "#be6a6a";
    };
  });
}
