import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import {
  startFocusBot,
  stopFocusBot,
  isFocusBotRunning,
  getFocusPhase,
  getDailyEarnings,
  getDailyCap,
  type FocusPhase,
} from "../focus-bot";
import { isGameTimerHidden, toggleGameTimerHide } from "../game-timer-hide";

let updateInterval: ReturnType<typeof setInterval> | null = null;

function formatUptime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return h + "h " + String(m).padStart(2, "0") + "min";
  return m + "min";
}

const PHASE_LABELS: Record<FocusPhase, string> = {
  idle: "Idle",
  creating: "Starting...",
  focus: "Earning",
  break: "Break",
  ending: "Stopping...",
};

const PHASE_COLORS: Record<FocusPhase, string> = {
  idle: "#8a8a9a",
  creating: "#f0c040",
  focus: "#5ad85a",
  break: "#5a9af0",
  ending: "#f0c040",
};

function updateDynamicParts(): void {
  const earnings = getDailyEarnings();
  const cap = getDailyCap();
  const pct = Math.min(100, Math.round((earnings / cap) * 100));
  const phase = getFocusPhase();
  const dailyMinutes = Math.floor(earnings / 6);

  const el = (id: string) => document.getElementById(id);

  const earningsEl = el("lt-focus-earnings");
  if (earningsEl) earningsEl.textContent = earnings.toLocaleString() + " / " + cap.toLocaleString();

  const pctEl = el("lt-focus-pct");
  if (pctEl) pctEl.textContent = pct + "%";

  const barEl = el("lt-focus-bar-fill") as HTMLElement | null;
  if (barEl) barEl.style.width = pct + "%";

  const phaseEl = el("lt-focus-phase");
  if (phaseEl) {
    phaseEl.textContent = PHASE_LABELS[phase];
    phaseEl.style.color = PHASE_COLORS[phase];
  }

  const timerEl = el("lt-focus-timer");
  if (timerEl) timerEl.textContent = formatUptime(dailyMinutes);
}

export function renderFocus(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  const isRunning = isFocusBotRunning();
  const earnings = getDailyEarnings();
  const cap = getDailyCap();
  const pct = Math.min(100, Math.round((earnings / cap) * 100));
  const phase = getFocusPhase();
  const dailyMinutes = Math.floor(earnings / 6);

  hud.innerHTML =
    mkHeader("Focus", true) +
    '<div class="lt-body" style="padding:4px 0;">' +

    '<div class="lt-stat-row" style="font-size:14px;font-weight:700;padding:6px 12px;color:#e0d8f0;">' +
    '<span>Daily Earnings</span><span id="lt-focus-earnings">' + earnings.toLocaleString() + " / " + cap.toLocaleString() + "</span></div>" +

    '<div style="padding:0 14px 8px;">' +
    '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden;">' +
    '<div id="lt-focus-bar-fill" style="background:linear-gradient(90deg,#5ad85a,#f0c040);height:100%;width:' + pct + '%;transition:width 0.5s;border-radius:4px;"></div>' +
    "</div>" +
    '<div style="text-align:right;font-size:12px;color:#8a8a9a;margin-top:2px;" id="lt-focus-pct">' + pct + "%</div>" +
    "</div>" +

    '<div class="lt-sep"></div>' +

    '<div class="lt-stat-row"><span>Status</span><span id="lt-focus-phase" style="color:' + PHASE_COLORS[phase] + ';">' + PHASE_LABELS[phase] + "</span></div>" +
    '<div class="lt-stat-row"><span>Today</span><span id="lt-focus-timer">' + formatUptime(dailyMinutes) + "</span></div>" +
    '<div class="lt-stat-row" style="color:#f0c040;"><span>Rate</span><span>6 coins/min</span></div>' +

    '<div class="lt-sep"></div>' +

    '<button class="lt-action ' + (isRunning ? "lt-danger" : "lt-success") + '" id="lt-focus-toggle">' +
    (isRunning ? "Stop" : "Start") +
    "</button>" +
    '<button class="lt-action" id="lt-focus-hide-ui" style="margin-top:4px;">' +
    (isGameTimerHidden() ? "Show Game Timer" : "Hide Game Timer") +
    "</button>" +

    "</div>";

  bindNav(renderMainFn, pages);

  document.getElementById("lt-focus-toggle")!.onclick = () => {
    if (isFocusBotRunning()) {
      stopFocusBot();
    } else {
      startFocusBot();
    }
    renderFocus(hud, renderMainFn, pages);
  };

  document.getElementById("lt-focus-hide-ui")!.onclick = () => {
    toggleGameTimerHide();
    renderFocus(hud, renderMainFn, pages);
  };

  updateDynamicParts();

  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    if (!document.getElementById("lt-focus-toggle")) {
      clearInterval(updateInterval!);
      updateInterval = null;
      return;
    }
    updateDynamicParts();
  }, 1000);
}
