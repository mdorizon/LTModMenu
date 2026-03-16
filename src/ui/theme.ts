import { SITE_VARS, DEFAULT_COLORS, darken } from "./data/theme-database";
import { refreshToastTheme } from "./status-bar";
import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";

let lastApplied = "";

interface SavedTheme {
  bg: string; bgSecondary: string; border: string; borderLight: string;
  text: string; textMuted: string; textTitle: string;
  inputBg: string; accent: string; shadow: string;
}

function applySavedOrDefault(): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;

  const saved = loadData<SavedTheme | null>("theme", null);
  const c = saved || DEFAULT_COLORS;

  hud.style.setProperty("--lt-bg", c.bg);
  hud.style.setProperty("--lt-bg-secondary", c.bgSecondary);
  hud.style.setProperty("--lt-border", c.border);
  hud.style.setProperty("--lt-border-light", c.borderLight);
  hud.style.setProperty("--lt-text", c.text);
  hud.style.setProperty("--lt-text-muted", c.textMuted);
  hud.style.setProperty("--lt-text-title", c.textTitle);
  hud.style.setProperty("--lt-input-bg", c.inputBg);
  hud.style.setProperty("--lt-accent", c.accent);
  hud.style.setProperty("--lt-shadow", c.shadow);

  refreshToastTheme();
  log("THEME", saved ? "Theme applied: Saved" : "Theme applied: Default (fallback)");
}

function getSiteVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function siteThemeAvailable(): boolean {
  return getSiteVar(SITE_VARS.primary) !== "";
}

function applyThemeFromSite(): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;

  const primary = getSiteVar(SITE_VARS.primary);
  if (!primary) return;

  const signature = primary + getSiteVar(SITE_VARS.text);
  if (signature === lastApplied) return;
  lastApplied = signature;

  const primaryDark = getSiteVar(SITE_VARS.primaryDark);
  const primaryHover = getSiteVar(SITE_VARS.primaryHover);
  const accentHover = getSiteVar(SITE_VARS.accentHover);
  const text = getSiteVar(SITE_VARS.text);
  const textMuted = getSiteVar(SITE_VARS.textMuted);
  const textAlt = getSiteVar(SITE_VARS.textAlt);
  const icon = getSiteVar(SITE_VARS.icon);

  hud.style.setProperty("--lt-bg", primaryDark || darken(primary, 0.4));
  hud.style.setProperty("--lt-bg-secondary", primary);
  hud.style.setProperty("--lt-border", primaryHover || primary);
  hud.style.setProperty("--lt-border-light", accentHover || primaryHover || primary);
  hud.style.setProperty("--lt-text", text);
  hud.style.setProperty("--lt-text-muted", textMuted || text);
  hud.style.setProperty("--lt-text-title", textAlt || text);
  hud.style.setProperty("--lt-input-bg", darken(primaryDark || primary, 0.3));
  hud.style.setProperty("--lt-accent", icon || accentHover || primary);
  hud.style.setProperty("--lt-shadow", "rgba(0,0,0,0.5)");

  // Persist so the next page load starts with the right theme immediately
  saveData("theme", {
    bg: hud.style.getPropertyValue("--lt-bg"),
    bgSecondary: hud.style.getPropertyValue("--lt-bg-secondary"),
    border: hud.style.getPropertyValue("--lt-border"),
    borderLight: hud.style.getPropertyValue("--lt-border-light"),
    text: hud.style.getPropertyValue("--lt-text"),
    textMuted: hud.style.getPropertyValue("--lt-text-muted"),
    textTitle: hud.style.getPropertyValue("--lt-text-title"),
    inputBg: hud.style.getPropertyValue("--lt-input-bg"),
    accent: hud.style.getPropertyValue("--lt-accent"),
    shadow: hud.style.getPropertyValue("--lt-shadow"),
  } as SavedTheme);

  refreshToastTheme();
  log("THEME", "Theme synced from site (primary: " + primary + ")");
}

const THEME_VARS = [
  "--lt-bg", "--lt-bg-secondary", "--lt-border", "--lt-border-light",
  "--lt-text", "--lt-text-muted", "--lt-text-title", "--lt-input-bg",
  "--lt-accent", "--lt-shadow",
];

export function syncTheme(el: HTMLElement): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;
  const s = getComputedStyle(hud);
  for (const v of THEME_VARS) {
    const val = s.getPropertyValue(v).trim();
    if (val) el.style.setProperty(v, val);
  }
}

export function initThemeSync(): void {
  if (siteThemeAvailable()) {
    applyThemeFromSite();
  } else {
    applySavedOrDefault();
  }

  const observer = new MutationObserver(() => {
    if (siteThemeAvailable()) {
      applyThemeFromSite();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
}
