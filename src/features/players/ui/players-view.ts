import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { getTrackedPlayers, type TrackedPlayer } from "../player-tracker";
import { renderPlayerActions } from "./player-actions-view";

const MAX_RESULTS = 5;
const REFRESH_INTERVAL = 5000;

function renderFilteredList(
  container: HTMLElement,
  players: TrackedPlayer[],
  query: string,
  onSelect: (p: TrackedPlayer) => void,
): void {
  const filtered = query
    ? players.filter((p) => p.displayName.toLowerCase().includes(query.toLowerCase()))
    : players;

  const shown = filtered.slice(0, MAX_RESULTS);
  const remaining = filtered.length - shown.length;

  container.innerHTML = shown.length > 0
    ? shown.map((p, i) =>
        '<button class="lt-item" id="lt-pf-' + i + '">' +
        "<span>" + escHtml(p.displayName) + "</span>" +
        '<span class="lt-sub">' + p.x + ", " + p.y + "</span>" +
        "</button>",
      ).join("") +
      (remaining > 0
        ? '<div class="lt-empty">+ ' + remaining + " more...</div>"
        : "")
    : '<div class="lt-empty">' + (query ? "No match" : "No players") + "</div>";

  shown.forEach((p, i) => {
    const el = document.getElementById("lt-pf-" + i);
    if (el) el.onclick = () => onSelect(p);
  });
}

function openPlayerModal(
  onSelect: (p: TrackedPlayer) => void,
): void {
  const existing = document.getElementById("lt-players-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "lt-players-modal";
  overlay.innerHTML =
    '<div class="lt-pm-box">' +
    '<div class="lt-pm-header">' +
    '<span class="lt-pm-title" id="lt-pm-title">Players</span>' +
    '<button class="lt-pm-close">X</button>' +
    "</div>" +
    '<input class="lt-pm-search" placeholder="Search..." />' +
    '<div class="lt-pm-grid" id="lt-pm-grid"></div>' +
    "</div>";

  document.body.appendChild(overlay);

  const grid = document.getElementById("lt-pm-grid")!;
  const title = document.getElementById("lt-pm-title")!;
  const search = overlay.querySelector<HTMLInputElement>(".lt-pm-search")!;
  const close = overlay.querySelector<HTMLButtonElement>(".lt-pm-close")!;
  let lastQuery = "";

  function renderGrid(): void {
    const players = getTrackedPlayers();
    const query = lastQuery;
    const filtered = query
      ? players.filter((p) => p.displayName.toLowerCase().includes(query.toLowerCase()))
      : players;

    title.textContent = "Players (" + players.length + ")";

    grid.innerHTML = filtered.map((p, i) =>
      '<button class="lt-pm-cell" data-pi="' + i + '">' +
      escHtml(p.displayName) +
      "</button>",
    ).join("");

    grid.querySelectorAll<HTMLButtonElement>(".lt-pm-cell").forEach((btn) => {
      const idx = Number(btn.dataset.pi);
      btn.onclick = () => {
        clearInterval(refreshId);
        overlay.remove();
        onSelect(filtered[idx]);
      };
    });
  }

  renderGrid();
  search.focus();
  search.oninput = () => {
    lastQuery = search.value.trim();
    renderGrid();
  };

  const refreshId = setInterval(renderGrid, REFRESH_INTERVAL);

  const cleanup = () => {
    clearInterval(refreshId);
    overlay.remove();
  };
  close.onclick = cleanup;
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup();
  };
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let activeRefreshId: ReturnType<typeof setInterval> | null = null;

export function renderPlayers(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  // Clear any previous refresh interval
  if (activeRefreshId !== null) {
    clearInterval(activeRefreshId);
    activeRefreshId = null;
  }

  const searchInput = () => document.getElementById("lt-player-search") as HTMLInputElement | null;
  const resultsDiv = () => document.getElementById("lt-player-results");
  const headerTitle = () => hud.querySelector<HTMLElement>(".lt-title");

  const selectPlayer = (p: TrackedPlayer) => {
    if (activeRefreshId !== null) {
      clearInterval(activeRefreshId);
      activeRefreshId = null;
    }
    renderPlayerActions(hud, renderMainFn, pages, p);
  };

  function refreshList(): void {
    const res = resultsDiv();
    const input = searchInput();
    const title = headerTitle();
    if (!res || !input) return;
    const players = getTrackedPlayers();
    if (title) title.textContent = "Players (" + players.length + ")";
    renderFilteredList(res, players, input.value.trim(), selectPlayer);
  }

  const players = getTrackedPlayers();

  hud.innerHTML =
    mkHeader("Players (" + players.length + ")", true) +
    '<div class="lt-body">' +
    '<input class="lt-input" id="lt-player-search" placeholder="Search player..." />' +
    '<div id="lt-player-results"></div>' +
    '<button class="lt-action lt-muted" id="lt-players-browse">Browse all</button>' +
    "</div>" +
    '<div class="lt-warn">Teleportation is detectable by the server</div>';

  // Override back to clear interval
  const back = document.getElementById("lt-back");
  if (back) {
    back.onclick = () => {
      if (activeRefreshId !== null) {
        clearInterval(activeRefreshId);
        activeRefreshId = null;
      }
      renderMainFn();
    };
  }
  bindNav(renderMainFn, pages);
  // Re-override back after bindNav (bindNav sets it too)
  if (back) {
    back.onclick = () => {
      if (activeRefreshId !== null) {
        clearInterval(activeRefreshId);
        activeRefreshId = null;
      }
      renderMainFn();
    };
  }

  refreshList();
  searchInput()!.oninput = () => refreshList();

  activeRefreshId = setInterval(refreshList, REFRESH_INTERVAL);

  document.getElementById("lt-players-browse")!.onclick = () =>
    openPlayerModal(selectPlayer);
}
