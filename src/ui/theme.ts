import { SITE_VARS, DEFAULT_COLORS, darken } from "./theme-database";
import { log } from "../core/logger";

let lastApplied = "";

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

  log("THEME", "Theme synced from site (primary: " + primary + ")");
}

function applyDefault(): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;

  const c = DEFAULT_COLORS;
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

  log("THEME", "Theme applied: Default (fallback)");
}

export function initThemeSync(): void {
  if (siteThemeAvailable()) {
    applyThemeFromSite();
  } else {
    applyDefault();
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
