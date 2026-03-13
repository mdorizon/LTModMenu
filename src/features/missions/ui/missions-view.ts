import { mkHeader, mkCoin, bindNav, type RenderFn } from "@ui/components";
import {
  getDailyMissions,
  getWeeklyMissions,
  completeAllDailies,
  completeAllWeeklies,
  completeMission,
  isMissionStoreReady,
  getMissionResetTimes,
  type Mission,
} from "../missions";
import { isMissionPanelHidden, toggleMissionPanelHide } from "../mission-panel-hide";

const CHECK_CIRCLE =
  '<div style="width:20px;height:20px;border-radius:50%;background:#5ad85a;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
  "</div>";

function emptyCircle(id: string): string {
  return '<button id="' + id + '" style="width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);' +
    'flex-shrink:0;box-sizing:border-box;background:none;padding:0;cursor:pointer;"></button>';
}

function missionRow(
  mission: Mission,
  current: number,
  index: number,
  prefix: string,
): string {
  const done = current >= mission.requiredAmount;
  const pct = Math.min(100, Math.round((current / mission.requiredAmount) * 100));

  return (
    '<div style="padding:7px 14px;display:flex;gap:10px;align-items:center;">' +
    (done ? CHECK_CIRCLE : emptyCircle(prefix + "-" + index)) +
    '<div style="flex:1;min-width:0;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
    '<span style="font-size:14px;color:var(--lt-text, #c8c0e0);">' + mission.title + "</span>" +
    '<span style="font-size:13px;color:#fff;white-space:nowrap;">' + mkCoin(mission.pointsReward) + "</span>" +
    "</div>" +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">' +
    '<span style="font-size:12px;color:rgba(255,255,255,0.45);white-space:nowrap;">' +
    Math.min(current, mission.requiredAmount) + "/" + mission.requiredAmount +
    "</span>" +
    '<div style="flex:1;background:rgba(255,255,255,0.06);border-radius:3px;height:4px;overflow:hidden;">' +
    '<div style="background:rgba(255,255,255,0.2);height:100%;width:' + pct + '%;border-radius:3px;"></div>' +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function renderMissionList(
  missions: { mission: Mission; current: number }[],
  prefix: string,
): string {
  if (missions.length === 0) {
    return '<div class="lt-empty">No missions available</div>';
  }
  return missions
    .map(({ mission, current }, i) => missionRow(mission, current, i, prefix))
    .join("");
}

function totalRewards(missions: { mission: Mission; current: number }[]): number {
  return missions
    .filter(({ mission, current }) => current < mission.requiredAmount)
    .reduce((sum, { mission }) => sum + mission.pointsReward, 0);
}

function formatCountdown(isoEnd: string | null): string {
  if (!isoEnd) return "";
  const diff = new Date(isoEnd).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const hh = (h < 10 ? "0" : "") + h;
  const mm = (m < 10 ? "0" : "") + m;
  const ss = (s < 10 ? "0" : "") + s;
  return d > 0 ? d + "d " + hh + ":" + mm + ":" + ss : hh + ":" + mm + ":" + ss;
}

function scheduleRefresh(hud: HTMLElement, renderMainFn: RenderFn, pages: Record<string, RenderFn>): void {
  setTimeout(() => {
    if (document.getElementById("lt-mission-status")) {
      renderMissions(hud, renderMainFn, pages);
    }
  }, 1500);
}

export function renderMissions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const ready = isMissionStoreReady();
  const dailies = getDailyMissions();
  const weeklies = getWeeklyMissions();
  const dailyPending = dailies.filter(({ mission, current }) => current < mission.requiredAmount).length;
  const weeklyPending = weeklies.filter(({ mission, current }) => current < mission.requiredAmount).length;
  const dailyRewards = totalRewards(dailies);
  const weeklyRewards = totalRewards(weeklies);

  hud.innerHTML =
    mkHeader("Missions", true) +
    '<div class="lt-body" style="padding:4px 0;">' +

    (!ready
      ? '<div class="lt-empty">Mission store not loaded yet</div>'
      : '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px;">' +
        '<span style="font-size:16px;font-weight:700;color:#e0d8f0;">Daily</span>' +
        '<span style="display:flex;align-items:center;gap:10px;">' +
        '<span id="lt-mission-timer" style="font-size:13px;color:rgba(255,255,255,0.45);font-variant-numeric:tabular-nums;"></span>' +
        '<span style="font-size:13px;color:#8a8a9a;">' +
        (dailies.length - dailyPending) + "/" + dailies.length +
        "</span></span></div>" +

        renderMissionList(dailies, "lt-d") +

        (dailyPending > 0
          ? '<button class="lt-action lt-success" id="lt-complete-daily" style="margin:4px 14px;font-size:13px;">' +
            "Complete All " + mkCoin(dailyRewards) + "</button>"
          : "") +

        '<div class="lt-sep"></div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px;">' +
        '<span style="font-size:16px;font-weight:700;color:#e0d8f0;">Weekly</span>' +
        '<span style="display:flex;align-items:center;gap:10px;">' +
        '<span id="lt-mission-timer-weekly" style="font-size:13px;color:rgba(255,255,255,0.45);font-variant-numeric:tabular-nums;"></span>' +
        '<span style="font-size:13px;color:#8a8a9a;">' +
        (weeklies.length - weeklyPending) + "/" + weeklies.length +
        "</span></span></div>" +

        renderMissionList(weeklies, "lt-w") +

        (weeklyPending > 0
          ? '<button class="lt-action lt-success" id="lt-complete-weekly" style="margin:4px 14px;font-size:13px;">' +
            "Complete All " + mkCoin(weeklyRewards) + "</button>"
          : "")) +

    '<div class="lt-sep"></div>' +
    '<button class="lt-action" id="lt-mission-hide-panel" style="margin-top:4px;">' +
    (isMissionPanelHidden() ? "Show Mission Panel" : "Hide Mission Panel") +
    "</button>" +

    '<div id="lt-mission-status" class="lt-status"></div>' +
    "</div>";

  bindNav(renderMainFn, pages);

  if (!ready) return;

  const resets = getMissionResetTimes();
  const dailyTimerEl = document.getElementById("lt-mission-timer");
  const weeklyTimerEl = document.getElementById("lt-mission-timer-weekly");
  if (dailyTimerEl) dailyTimerEl.textContent = formatCountdown(resets.daily);
  if (weeklyTimerEl) weeklyTimerEl.textContent = formatCountdown(resets.weekly);
  const tid = setInterval(() => {
    if (!document.getElementById("lt-mission-timer")) { clearInterval(tid); return; }
    if (dailyTimerEl) dailyTimerEl.textContent = formatCountdown(resets.daily);
    if (weeklyTimerEl) weeklyTimerEl.textContent = formatCountdown(resets.weekly);
  }, 1000);

  document.getElementById("lt-mission-hide-panel")!.onclick = () => {
    toggleMissionPanelHide();
    renderMissions(hud, renderMainFn, pages);
  };

  const status = document.getElementById("lt-mission-status")!;

  const dailyBtn = document.getElementById("lt-complete-daily");
  if (dailyBtn) {
    dailyBtn.onclick = () => {
      const count = completeAllDailies();
      status.textContent = count > 0
        ? "Completed " + count + " daily missions!"
        : "No daily missions to complete";
      status.style.color = count > 0 ? "#5ad85a" : "#8a8a9a";
      if (count > 0) scheduleRefresh(hud, renderMainFn, pages);
    };
  }

  const weeklyBtn = document.getElementById("lt-complete-weekly");
  if (weeklyBtn) {
    weeklyBtn.onclick = () => {
      const count = completeAllWeeklies();
      status.textContent = count > 0
        ? "Completed " + count + " weekly missions!"
        : "No weekly missions to complete";
      status.style.color = count > 0 ? "#5ad85a" : "#8a8a9a";
      if (count > 0) scheduleRefresh(hud, renderMainFn, pages);
    };
  }

  dailies.forEach(({ mission, current }, i) => {
    const btn = document.getElementById("lt-d-" + i);
    if (btn) {
      btn.onclick = () => {
        const ok = completeMission(mission, current);
        status.textContent = ok ? "Forced: " + mission.title : "Already completed";
        status.style.color = ok ? "#5ad85a" : "#8a8a9a";
        if (ok) scheduleRefresh(hud, renderMainFn, pages);
      };
    }
  });

  weeklies.forEach(({ mission, current }, i) => {
    const btn = document.getElementById("lt-w-" + i);
    if (btn) {
      btn.onclick = () => {
        const ok = completeMission(mission, current);
        status.textContent = ok ? "Forced: " + mission.title : "Already completed";
        status.style.color = ok ? "#5ad85a" : "#8a8a9a";
        if (ok) scheduleRefresh(hud, renderMainFn, pages);
      };
    }
  });
}
