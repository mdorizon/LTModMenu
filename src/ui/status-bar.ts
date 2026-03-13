export interface StatusEntry {
  label: string;
  color: string;
  bg: string;
}

const statuses = new Map<string, StatusEntry>();

export function setStatus(key: string, entry: StatusEntry): void {
  statuses.set(key, entry);
  refreshStatusBar();
}

export function clearStatus(key: string): void {
  if (statuses.delete(key)) refreshStatusBar();
}

export function hasStatus(key: string): boolean {
  return statuses.has(key);
}

function renderBadges(): string {
  let html = "";
  for (const [, entry] of statuses) {
    html += '<span class="lt-badge" style="background:' + entry.bg + ";color:" + entry.color + ';">' + entry.label + "</span>";
  }
  return html;
}

export function getStatusBarHTML(): string {
  return '<div class="lt-status-bar" id="lt-status-bar">' + renderBadges() + "</div>";
}

export function refreshStatusBar(): void {
  const bar = document.getElementById("lt-status-bar");
  if (!bar) return;
  bar.innerHTML = renderBadges();
}

const THEME_VARS = ["--lt-bg", "--lt-bg-secondary", "--lt-border", "--lt-text", "--lt-text-muted", "--lt-accent"];

const MAX_TOASTS = 3;
const DOT_MS = 400;
const DOTS = [".", "..", "..."];

let persistent: { el: HTMLElement; timer: ReturnType<typeof setInterval> } | null = null;

function syncTheme(container: HTMLElement): void {
  const hud = document.getElementById("lt-hud");
  if (!hud) return;
  const s = getComputedStyle(hud);
  for (const v of THEME_VARS) {
    const val = s.getPropertyValue(v).trim();
    if (val) container.style.setProperty(v, val);
  }
}

function getContainer(): HTMLElement {
  let c = document.getElementById("lt-toast-container");
  if (c) return c;
  c = document.createElement("div");
  c.id = "lt-toast-container";
  document.body.appendChild(c);
  syncTheme(c);
  return c;
}

export function refreshToastTheme(): void {
  const c = document.getElementById("lt-toast-container");
  if (c) syncTheme(c);
}

function makeToast(message: string, type: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "lt-toast" + (type !== "info" ? " lt-toast-" + type : "");
  const span = document.createElement("span");
  span.className = "lt-toast-msg";
  span.textContent = message;
  el.appendChild(span);
  return el;
}

function dismiss(el: HTMLElement): void {
  el.classList.add("lt-toast-exit");
  const rm = () => { if (el.parentNode) el.remove(); };
  el.addEventListener("animationend", rm, { once: true });
  setTimeout(rm, 400);
}

function trim(container: HTMLElement): void {
  const all = container.querySelectorAll(".lt-toast:not(.lt-toast-exit)");
  for (let i = MAX_TOASTS; i < all.length; i++) {
    const old = all[i] as HTMLElement;
    if (persistent?.el === old) {
      clearInterval(persistent.timer);
      persistent = null;
    }
    old.remove();
  }
}

function startDots(el: HTMLElement, message: string): ReturnType<typeof setInterval> {
  const span = el.querySelector(".lt-toast-msg")!;
  const base = message.replace(/\.{1,3}$/, "");
  let idx = 0;
  span.textContent = base + DOTS[idx];
  return setInterval(() => {
    idx = (idx + 1) % DOTS.length;
    span.textContent = base + DOTS[idx];
  }, DOT_MS);
}

export function notify(message: string, type: "success" | "error" | "info" = "info", duration = 3000): void {
  const container = getContainer();

  if (duration === 0) {
    if (persistent) {
      clearInterval(persistent.timer);
      const cls = "lt-toast" + (type !== "info" ? " lt-toast-" + type : "");
      persistent.el.className = cls;
      persistent.timer = startDots(persistent.el, message);
      return;
    }

    const el = makeToast(message, type);
    container.prepend(el);
    const timer = startDots(el, message);
    persistent = { el, timer };
    trim(container);
    return;
  }

  if (persistent) {
    clearInterval(persistent.timer);
    dismiss(persistent.el);
    persistent = null;
  }

  const el = makeToast(message, type);
  container.prepend(el);
  trim(container);
  setTimeout(() => dismiss(el), duration);
}

export function clearNotify(): void {
  if (!persistent) return;
  clearInterval(persistent.timer);
  dismiss(persistent.el);
  persistent = null;
}
