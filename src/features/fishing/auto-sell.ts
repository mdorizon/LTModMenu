import { getRarity } from "./fish-rarity";
import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";

export interface AutoSellConfig {
  enabled: boolean;
  keepLegendary: boolean;
  keepSecret: boolean;
  keepShiny: boolean;
  keepEvent: boolean;
}

const DEFAULT_CONFIG: AutoSellConfig = {
  enabled: false,
  keepLegendary: true,
  keepSecret: true,
  keepShiny: true,
  keepEvent: false,
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

function shouldSellFish(name: string, isShiny: boolean): boolean {
  if (!config.enabled) return false;
  if (isShiny && config.keepShiny) return false;
  const rarity = getRarity(name);
  if (rarity === "legendary" && config.keepLegendary) return false;
  if (rarity === "secret" && config.keepSecret) return false;
  if ((rarity === "halloween" || rarity === "christmas") && config.keepEvent) return false;
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
        store.setState({ points: (state.points || 0) + goldGained });
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

export function updateAutoSellHUD(): void {
  const el = document.getElementById("lt-auto-sold");
  if (!el) return;
  el.textContent = totalAutoSold + " | +" + totalAutoGold.toLocaleString() + "g";
}

export function renderAutoSell(): string {
  const mkFilter = (id: string, label: string, color: string, active: boolean) =>
    '<div class="lt-stat-row" style="cursor:pointer;font-size:15px;" id="' + id + '">' +
    '<span style="color:' + color + ';">' + label + '</span>' +
    '<span style="color:' + (active ? '#6abe6a' : '#be6a6a') + ';">' + (active ? 'KEEP' : 'SELL') + '</span></div>';

  return '<div class="lt-sep"></div>' +
    '<div class="lt-stat-row" style="font-size:15px;color:var(--lt-text-muted, #6a6a9a);">' +
    '<span>Auto-Sold</span><span id="lt-auto-sold">' + totalAutoSold + ' | +' + totalAutoGold.toLocaleString() + 'g</span></div>' +
    '<button class="lt-action ' + (config.enabled ? 'lt-success' : 'lt-muted') + '" id="lt-auto-sell">' +
    'AUTO-SELL: ' + (config.enabled ? 'ON' : 'OFF') + '</button>' +
    mkFilter('lt-keep-legendary', 'Legendary', '#f0a030', config.keepLegendary) +
    mkFilter('lt-keep-secret', 'Secret', '#f05050', config.keepSecret) +
    mkFilter('lt-keep-shiny', 'Shiny', '#f0f040', config.keepShiny) +
    mkFilter('lt-keep-event', 'Event', '#6a6a9a', config.keepEvent);
}

type BooleanConfigKey = "keepLegendary" | "keepSecret" | "keepShiny" | "keepEvent";

export function bindAutoSell(): void {
  const toggle = document.getElementById("lt-auto-sell");
  if (toggle) {
    toggle.onclick = () => {
      config.enabled = !config.enabled;
      saveData("autoSellConfig", config);
      toggle.textContent = "AUTO-SELL: " + (config.enabled ? "ON" : "OFF");
      toggle.className = "lt-action " + (config.enabled ? "lt-success" : "lt-muted");
      log("UI", "Auto-sell " + (config.enabled ? "enabled" : "disabled"));
    };
  }

  const filters: [string, BooleanConfigKey][] = [
    ["lt-keep-legendary", "keepLegendary"],
    ["lt-keep-secret", "keepSecret"],
    ["lt-keep-shiny", "keepShiny"],
    ["lt-keep-event", "keepEvent"],
  ];

  for (const [id, key] of filters) {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = () => {
        config[key] = !config[key];
        saveData("autoSellConfig", config);
        const valSpan = el.lastElementChild as HTMLElement;
        if (valSpan) {
          valSpan.textContent = config[key] ? "KEEP" : "SELL";
          valSpan.style.color = config[key] ? "#6abe6a" : "#be6a6a";
        }
      };
    }
  }
}
