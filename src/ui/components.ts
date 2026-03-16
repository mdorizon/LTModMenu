import { getStatusBarHTML } from "./status-bar";
import { iconCoin, iconChevronLeft, iconChevronRight } from "./icons";

export function mkHeader(title: string, hasBack?: boolean, subtitle?: string): string {
  return (
    '<div class="lt-header" id="lt-header">' +
    (hasBack ? '<button class="lt-back-btn" id="lt-back">' + iconChevronLeft() + '</button>' : "") +
    '<div class="lt-title-group">' +
    '<span class="lt-title">' + title + "</span>" +
    (subtitle ? '<span class="lt-ver">' + subtitle + "</span>" : "") +
    "</div>" +
    getStatusBarHTML() +
    "</div>"
  );
}

export function mkItem(id: string, label: string, right?: string): string {
  return (
    '<button class="lt-item" id="' + id + '">' +
    "<span>" + label + "</span>" +
    '<span class="lt-arrow">' + (right || iconChevronRight()) + "</span>" +
    "</button>"
  );
}

export interface SelectOption { value: string; label: string; selected?: boolean }

export function mkActionSelect(id: string, label: string, selectId: string, options: SelectOption[]): string {
  let opts = "";
  for (const o of options) {
    opts += '<option value="' + o.value + '"' + (o.selected ? " selected" : "") + ">" + o.label + "</option>";
  }
  return (
    '<div class="lt-action lt-primary lt-action-select" id="' + id + '">' +
    "<span>" + label + "</span>" +
    '<select class="lt-action-sel" id="' + selectId + '">' + opts + "</select>" +
    "</div>"
  );
}

export function mkCoin(amount: number): string {
  return '<span style="display:inline-flex;align-items:center;gap:2px;">' + iconCoin() + amount + "</span>";
}

export function showTransitionOverlay(): () => void {
  let el = document.getElementById("lt-transition");
  if (!el) {
    el = document.createElement("div");
    el.id = "lt-transition";
    document.body.appendChild(el);
  }
  // Force reflow then fade in
  el.classList.remove("lt-fade-in");
  void el.offsetWidth;
  el.classList.add("lt-fade-in");

  return () => {
    el!.classList.remove("lt-fade-in");
  };
}

export type RenderFn = () => void;

export function bindNav(renderMain: RenderFn, pages: Record<string, RenderFn>): void {
  const back = document.getElementById("lt-back");
  if (back) back.onclick = () => renderMain();

  const goMap: Record<string, string> = {
    poi: "lt-go-poi",
    tp: "lt-go-tp",
    actions: "lt-go-actions",
    players: "lt-go-players",
    fish: "lt-go-fish",
    focus: "lt-go-focus",
    missions: "lt-go-missions",
  };

  for (const page in goMap) {
    const el = document.getElementById(goMap[page]);
    if (el && pages[page]) {
      const renderPage = pages[page];
      el.onclick = () => renderPage();
    }
  }
}
