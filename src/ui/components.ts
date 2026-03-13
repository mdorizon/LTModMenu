import { getStatusBarHTML } from "./status-bar";

export function mkHeader(title: string, hasBack?: boolean, subtitle?: string): string {
  return (
    '<div class="lt-header" id="lt-header">' +
    (hasBack ? '<button class="lt-back-btn" id="lt-back">&lt;</button>' : "") +
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
    '<span class="lt-arrow">' + (right || "&gt;&gt;&gt;") + "</span>" +
    "</button>"
  );
}

export function mkItemTag(id: string, label: string, tag: string): string {
  return (
    '<button class="lt-item" id="' + id + '">' +
    "<span>" + label + '<span class="lt-tag">' + tag + "</span></span>" +
    '<span class="lt-arrow">&gt;&gt;&gt;</span>' +
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

const COIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" style="vertical-align:-2px;">' +
  '<path d="M184,89.57V84c0-25.08-37.83-44-88-44S8,58.92,8,84v40c0,20.89,26.25,37.49,64,42.46V172c0,25.08,37.83,44,88,44s88-18.92,88-44V132C248,111.3,222.58,94.68,184,89.57Z' +
  'M56,146.87C36.41,141.4,24,132.39,24,124V109.93c8.16,5.78,19.09,10.44,32,13.57Zm80-23.37c12.91-3.13,23.84-7.79,32-13.57V124c0,8.39-12.41,17.4-32,22.87Z' +
  'm-16,71.37C100.41,189.4,88,180.39,88,172v-4.17c2.63.1,5.29.17,8,.17,3.88,0,7.67-.13,11.39-.35A121.92,121.92,0,0,0,120,171.41Z' +
  'm0-44.62A163,163,0,0,1,96,152a163,163,0,0,1-24-1.75V126.46A183.74,183.74,0,0,0,96,128a183.74,183.74,0,0,0,24-1.54Z' +
  'm64,48a165.45,165.45,0,0,1-48,0V174.4a179.48,179.48,0,0,0,24,1.6,183.74,183.74,0,0,0,24-1.54ZM232,172c0,8.39-12.41,17.4-32,22.87V171.5c12.91-3.13,23.84-7.79,32-13.57Z"></path>' +
  "</svg>";

export function mkCoin(amount: number): string {
  return '<span style="display:inline-flex;align-items:center;gap:2px;">' + COIN_SVG + amount + "</span>";
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
