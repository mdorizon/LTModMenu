import { log } from "@core/logger";
import { setStatus, clearStatus } from "@ui/status-bar";
import { findPixiGraphics } from "@core/module-resolver";

let enabled = false;
let drawnChildren: any[] = [];
let _Graphics: any = null;

export function isHitboxes(): boolean {
  return enabled;
}

function findGraphicsClass(): any {
  if (_Graphics) return _Graphics;
  if (!window.__wpRequire) return null;
  _Graphics = findPixiGraphics(window.__wpRequire);
  return _Graphics;
}

function drawHitboxes(): string | null {
  const gameApp = window.__gameApp as any;
  const container = gameApp?.gizmoContainer;
  if (!container) return "gizmoContainer not found";

  const Graphics = findGraphicsClass();
  if (!Graphics) return "PIXI.Graphics not found";

  const colliders = gameApp.colliders;
  const interactables = gameApp.interactables;
  const seats = gameApp.seats;
  if (!colliders && !interactables && !seats) return "No scene data found on gameApp";

  let total = 0;

  if (colliders) {
    const g = new Graphics();
    for (const key in colliders) {
      const c = colliders[key];
      if (!c) continue;
      const w = c.width ?? c.w ?? 0;
      const h = c.height ?? c.h ?? 0;
      if (!w || !h) continue;
      g.rect(c.x ?? 0, c.y ?? 0, w, h);
      g.fill({ color: 0xff4444, alpha: 0.15 });
      g.stroke({ width: 1, color: 0xff4444, alpha: 0.5 });
      total++;
    }
    container.addChild(g);
    drawnChildren.push(g);
  }

  if (interactables) {
    const g = new Graphics();
    for (const key in interactables) {
      const i = interactables[key];
      if (!i) continue;
      const x = i.x ?? 0;
      const y = i.y ?? 0;
      const w = i.width ?? i.w ?? 0;
      const h = i.height ?? i.h ?? 0;
      if (w && h) g.rect(x, y, w, h);
      else g.circle(x, y, 15);
      g.fill({ color: 0x44ff44, alpha: 0.15 });
      g.stroke({ width: 1, color: 0x44ff44, alpha: 0.5 });
      total++;
    }
    container.addChild(g);
    drawnChildren.push(g);
  }

  if (seats) {
    const g = new Graphics();
    for (const key in seats) {
      const s = seats[key];
      if (!s) continue;
      g.circle(s.x ?? 0, s.y ?? 0, 8);
      g.fill({ color: 0x4488ff, alpha: 0.2 });
      g.stroke({ width: 1, color: 0x4488ff, alpha: 0.6 });
      total++;
    }
    container.addChild(g);
    drawnChildren.push(g);
  }

  container.visible = true;
  log("DEBUG", "Drew " + total + " hitboxes (red=colliders, green=interactables, blue=seats)");
  return null;
}

function clearHitboxes(): void {
  const container = (window.__gameApp as any)?.gizmoContainer;
  for (const child of drawnChildren) {
    container?.removeChild(child);
    child.destroy?.();
  }
  drawnChildren = [];
  if (container) container.visible = false;
}

export function toggleHitboxes(): { enabled: boolean; error?: string } {
  if (!window.__gameApp) return { enabled: false, error: "gameApp not captured" };

  if (!enabled) {
    const error = drawHitboxes();
    if (error) return { enabled: false, error };
    enabled = true;
    setStatus("hitboxes", { label: "HITBOXES", color: "#e0a040", bg: "#302010" });
  } else {
    clearHitboxes();
    enabled = false;
    clearStatus("hitboxes");
  }

  return { enabled };
}
