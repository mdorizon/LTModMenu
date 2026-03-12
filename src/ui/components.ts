export function mkHeader(title: string, hasBack?: boolean): string {
  return (
    '<div class="lt-header" id="lt-header">' +
    (hasBack ? '<button class="lt-back-btn" id="lt-back">&lt;</button>' : "") +
    '<span class="lt-title">' + title + "</span>" +
    '<span class="lt-ver">v2.2</span>' +
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
  };

  for (const page in goMap) {
    const el = document.getElementById(goMap[page]);
    if (el && pages[page]) {
      const renderPage = pages[page];
      el.onclick = () => renderPage();
    }
  }
}
