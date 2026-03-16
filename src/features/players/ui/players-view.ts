import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { showModal } from "@ui/modal";
import { syncTheme } from "@ui/theme";
import { getTrackedPlayers, type TrackedPlayer } from "../player-tracker";
import { renderPlayerActions } from "./player-actions-view";

const MAX_RESULTS = 5;
const FALLBACK_REFRESH = 15000;

type TabFilter = "all" | "friends";

interface FriendEntry {
  id: string;
  displayName: string;
  username: string;
  online: boolean;
  lobby: string;
  onMap: boolean;
  player: TrackedPlayer | null;
}

function matchesQuery(query: string, displayName: string, username: string): boolean {
  const q = query.toLowerCase();
  return displayName.toLowerCase().includes(q) || username.toLowerCase().includes(q);
}

function nameHtml(displayName: string, username: string): string {
  const dn = escHtml(displayName);
  if (!username || username === displayName) return "<span>" + dn + "</span>";
  return '<span class="lt-name-stack"><span>' + dn + '</span><span class="lt-username">@' + escHtml(username) + "</span></span>";
}

function getAllFriends(onMapPlayers: TrackedPlayer[]): FriendEntry[] {
  const friends = window.__friendIds;
  const profiles = window.__playerProfiles;
  const onMapById = new Map<string, TrackedPlayer>();
  for (const p of onMapPlayers) {
    if (p.isFriend) onMapById.set(p.id, p);
  }

  const entries: FriendEntry[] = [];
  for (const [id, presence] of friends) {
    const onMapPlayer = onMapById.get(id) || null;
    const profile = profiles.get(id);
    const displayName = onMapPlayer?.displayName || profile?.displayName || presence.displayName || "";
    const username = onMapPlayer?.username || profile?.username || presence.username || "";
    if (!displayName && !username) continue;

    let player: TrackedPlayer | null = onMapPlayer;
    if (!player && presence.online) {
      player = {
        id,
        displayName: displayName || username,
        username,
        x: 0, y: 0,
        direction: "left",
        isBot: false,
        isFriend: true,
        activeBurrow: profile?.activeBurrow?.id ? profile.activeBurrow : null,
        offMap: true,
      };
    }

    entries.push({
      id,
      displayName: displayName || username,
      username,
      online: !!onMapPlayer || presence.online,
      lobby: presence.lobby,
      onMap: !!onMapPlayer,
      player,
    });
  }

  return entries.sort((a, b) => {
    if (a.onMap !== b.onMap) return a.onMap ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

function mkTabs(activeTab: TabFilter, idPrefix: string, friendCount: number): string {
  return '<div class="lt-tabs">' +
    '<button class="lt-tab' + (activeTab === "friends" ? " lt-tab-active" : "") +
    '" id="' + idPrefix + '-friends">Friends (' + friendCount + ')</button>' +
    '<button class="lt-tab' + (activeTab === "all" ? " lt-tab-active" : "") +
    '" id="' + idPrefix + '-all">All</button>' +
    "</div>";
}

function renderPlayerList(
  container: HTMLElement,
  players: TrackedPlayer[],
  query: string,
  onSelect: (p: TrackedPlayer) => void,
): void {
  const filtered = query
    ? players.filter((p) => matchesQuery(query, p.displayName, p.username))
    : players;

  const shown = filtered.slice(0, MAX_RESULTS);
  const remaining = filtered.length - shown.length;

  container.innerHTML = shown.length > 0
    ? shown.map((p, i) =>
        '<button class="lt-item" id="lt-pf-' + i + '">' +
        nameHtml(p.displayName, p.username) +
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

function renderFriendList(
  container: HTMLElement,
  friends: FriendEntry[],
  query: string,
  onSelect: (p: TrackedPlayer) => void,
): void {
  const filtered = query
    ? friends.filter((f) => matchesQuery(query, f.displayName, f.username))
    : friends;

  container.innerHTML = filtered.length > 0
    ? '<div class="lt-friend-scroll">' + filtered.map((f, i) => {
        if (f.onMap && f.player) {
          return '<button class="lt-item" id="lt-pf-' + i + '">' +
            nameHtml(f.displayName, f.username) +
            '<span class="lt-sub">' + f.player.x + ", " + f.player.y + "</span>" +
            "</button>";
        }
        if (f.player) {
          return '<button class="lt-item" id="lt-pf-' + i + '">' +
            nameHtml(f.displayName, f.username) +
            '<span class="lt-sub">' + f.lobby + "</span>" +
            "</button>";
        }
        const status = f.online ? "online @ " + f.lobby : "offline";
        return '<div class="lt-item lt-friend-away">' +
          nameHtml(f.displayName, f.username) +
          '<span class="lt-sub">' + status + "</span>" +
          "</div>";
      }).join("") + "</div>"
    : '<div class="lt-empty">' + (query ? "No match" : "No friends yet") + "</div>";

  filtered.forEach((f, i) => {
    if (f.player) {
      const el = document.getElementById("lt-pf-" + i);
      if (el) el.onclick = () => onSelect(f.player!);
    }
  });
}

function openPlayerModal(
  onSelect: (p: TrackedPlayer) => void,
  initialTab: TabFilter = "friends",
): void {
  const existing = document.getElementById("lt-players-modal");
  if (existing) existing.remove();

  let modalTab: TabFilter = initialTab;

  const overlay = document.createElement("div");
  overlay.id = "lt-players-modal";
  overlay.innerHTML =
    '<div class="lt-pm-box">' +
    '<div class="lt-pm-header">' +
    '<span class="lt-pm-title" id="lt-pm-title">Players</span>' +
    '<button class="lt-pm-close">\u00d7</button>' +
    "</div>" +
    '<input class="lt-pm-search" placeholder="Search..." />' +
    '<div id="lt-pm-tabs"></div>' +
    '<div class="lt-pm-grid" id="lt-pm-grid"></div>' +
    "</div>";

  document.body.appendChild(overlay);
  syncTheme(overlay);

  const grid = document.getElementById("lt-pm-grid")!;
  const title = document.getElementById("lt-pm-title")!;
  const tabsContainer = document.getElementById("lt-pm-tabs")!;
  const search = overlay.querySelector<HTMLInputElement>(".lt-pm-search")!;
  const close = overlay.querySelector<HTMLButtonElement>(".lt-pm-close")!;
  let lastQuery = "";

  function bindModalTabs(friendCount: number): void {
    tabsContainer.innerHTML = mkTabs(modalTab, "lt-pm-tab", friendCount);
    document.getElementById("lt-pm-tab-all")!.onclick = () => {
      modalTab = "all";
      renderGrid();
    };
    document.getElementById("lt-pm-tab-friends")!.onclick = () => {
      modalTab = "friends";
      renderGrid();
    };
  }

  function cellNameHtml(displayName: string, username: string): string {
    const dn = escHtml(displayName);
    if (!username || username === displayName) return dn;
    return dn + '<div class="lt-pm-sub">@' + escHtml(username) + "</div>";
  }

  function renderGrid(): void {
    const players = getTrackedPlayers();
    const friends = getAllFriends(players);
    const query = lastQuery;

    if (modalTab === "friends") {
      title.textContent = "Friends (" + friends.length + ")";
      bindModalTabs(friends.length);

      const filtered = query
        ? friends.filter((f) => matchesQuery(query, f.displayName, f.username))
        : friends;

      grid.innerHTML = filtered.length > 0
        ? filtered.map((f, i) => {
            const cls = f.player ? "lt-pm-cell" : (f.online ? "lt-pm-cell lt-pm-away" : "lt-pm-cell lt-pm-offline");
            const status = f.onMap ? "" : ('<div class="lt-pm-sub">' + (f.online ? f.lobby : "offline") + "</div>");
            return '<button class="' + cls + '" data-pi="' + i + '"' +
              (f.player ? "" : " disabled") + ">" +
              cellNameHtml(f.displayName, f.username) + status + "</button>";
          }).join("")
        : '<div class="lt-empty">' + (query ? "No match" : "No friends yet") + "</div>";

      grid.querySelectorAll<HTMLButtonElement>(".lt-pm-cell:not([disabled])").forEach((btn) => {
        const idx = Number(btn.dataset.pi);
        const entry = filtered[idx];
        if (entry?.player) {
          btn.onclick = () => {
            cleanup();
            onSelect(entry.player!);
          };
        }
      });

      const note = document.createElement("div");
      note.className = "lt-info-note";
      note.textContent = "Why are some friends not shown?";
      note.onclick = showFriendsInfoModal;
      grid.appendChild(note);
    } else {
      title.textContent = "Players (" + players.length + ")";
      bindModalTabs(friends.length);

      const filtered = query
        ? players.filter((p) => matchesQuery(query, p.displayName, p.username))
        : players;

      grid.innerHTML = filtered.length > 0
        ? filtered.map((p, i) =>
            '<button class="lt-pm-cell" data-pi="' + i + '">' +
            cellNameHtml(p.displayName, p.username) +
            "</button>",
          ).join("")
        : '<div class="lt-empty">' + (query ? "No match" : "No players") + "</div>";

      grid.querySelectorAll<HTMLButtonElement>(".lt-pm-cell").forEach((btn) => {
        const idx = Number(btn.dataset.pi);
        btn.onclick = () => {
          cleanup();
          onSelect(filtered[idx]);
        };
      });
    }
  }

  renderGrid();
  search.focus();
  search.oninput = () => {
    lastQuery = search.value.trim();
    renderGrid();
  };

  const refreshId = setInterval(renderGrid, FALLBACK_REFRESH);
  const onEvent = () => renderGrid();
  document.addEventListener("lt:players-changed", onEvent);

  const cleanup = () => {
    clearInterval(refreshId);
    document.removeEventListener("lt:players-changed", onEvent);
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

function showFriendsInfoModal(): void {
  showModal({
    title: "Friends list",
    message:
      "Only friends whose names have been captured are shown. " +
      "Names are learned when a friend is seen on the same map or connects to the lobby.<br><br>" +
      "Log out and back in to refresh online statuses.",
    buttons: [{ label: "OK", onClick() {} }],
  });
}

let activeRefreshId: ReturnType<typeof setInterval> | null = null;
let activeEventHandler: (() => void) | null = null;

function cleanupListeners(): void {
  if (activeRefreshId !== null) {
    clearInterval(activeRefreshId);
    activeRefreshId = null;
  }
  if (activeEventHandler) {
    document.removeEventListener("lt:players-changed", activeEventHandler);
    activeEventHandler = null;
  }
}

export function renderPlayers(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  cleanupListeners();

  let currentTab: TabFilter = "friends";

  const searchInput = () => document.getElementById("lt-player-search") as HTMLInputElement | null;
  const resultsDiv = () => document.getElementById("lt-player-results");
  const headerTitle = () => hud.querySelector<HTMLElement>(".lt-title");

  const selectPlayer = (p: TrackedPlayer) => {
    cleanupListeners();
    renderPlayerActions(hud, renderMainFn, pages, p);
  };

  function bindTabs(friendCount: number): void {
    const container = document.getElementById("lt-player-tabs");
    if (!container) return;
    container.innerHTML = mkTabs(currentTab, "lt-pt", friendCount);
    document.getElementById("lt-pt-all")!.onclick = () => {
      currentTab = "all";
      refreshList();
    };
    document.getElementById("lt-pt-friends")!.onclick = () => {
      currentTab = "friends";
      refreshList();
    };
  }

  function refreshList(): void {
    const res = resultsDiv();
    const input = searchInput();
    const title = headerTitle();
    if (!res || !input) return;
    const players = getTrackedPlayers();
    const friends = getAllFriends(players);
    const query = input.value.trim();

    if (currentTab === "friends") {
      if (title) title.textContent = "Friends (" + friends.length + ")";
      bindTabs(friends.length);
      renderFriendList(res, friends, query, selectPlayer);
      const note = document.createElement("div");
      note.className = "lt-info-note";
      note.textContent = "Why are some friends not shown?";
      note.onclick = showFriendsInfoModal;
      res.appendChild(note);
    } else {
      if (title) title.textContent = "Players (" + players.length + ")";
      bindTabs(friends.length);
      renderPlayerList(res, players, query, selectPlayer);
    }
  }

  const players = getTrackedPlayers();

  hud.innerHTML =
    mkHeader("Players (" + players.length + ")", true) +
    '<div class="lt-body">' +
    '<input class="lt-input" id="lt-player-search" placeholder="Search player..." />' +
    '<div id="lt-player-tabs"></div>' +
    '<div id="lt-player-results"></div>' +
    '<button class="lt-action lt-muted" id="lt-players-browse">Browse all</button>' +
    "</div>";

  const back = document.getElementById("lt-back");
  if (back) {
    back.onclick = () => {
      cleanupListeners();
      renderMainFn();
    };
  }
  bindNav(renderMainFn, pages);
  if (back) {
    back.onclick = () => {
      cleanupListeners();
      renderMainFn();
    };
  }

  refreshList();
  searchInput()!.oninput = () => refreshList();

  activeRefreshId = setInterval(refreshList, FALLBACK_REFRESH);
  activeEventHandler = () => refreshList();
  document.addEventListener("lt:players-changed", activeEventHandler);

  document.getElementById("lt-players-browse")!.onclick = () =>
    openPlayerModal(selectPlayer, currentTab);
}
