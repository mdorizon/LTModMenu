# Camera & Debug Internals

## Free Camera

Utilise `window.__gameGlobals` (module 20993, capture par webpack-spy).

Deux proprietes controlent la camera :
- `manualCameraControl: boolean` — detache la camera du joueur
- `dragCameraMode: boolean` — permet le drag pour deplacer la camera

Au disable, `gameApp.currentCamera.moveCameraToPlayer(true)` re-snap la camera sur le joueur (le `true` = instant, sans animation).

Le joueur ne bouge pas pendant le mode free camera — seule la vue se deplace.

## Show Hitboxes (debug gizmos)

### Pourquoi on ne peut pas utiliser le flag `cm` du jeu

Le jeu a un flag debug `cm` dans le module 9502 (constantes du jeu, chunk 493). Quand `true`, le jeu dessine les colliders/raycasts dans `gizmoContainer`.

**Probleme** : les exports webpack ESM sont definis via `__webpack_require__.d` avec `configurable: false` par defaut. Le getter `cm` retourne une variable de closure (`h = false`) inaccessible depuis l'exterieur. Impossible de :
- Assigner directement (`exports.cm = true` → silently fails, strict mode throws)
- `Object.defineProperty` pour redefinir (non-configurable → TypeError)
- Patcher `require.d` avant le chargement du module (chunk 493 est charge avant le userscript, le module est deja en cache webpack)

Le `gizmoContainer` existe sur gameApp mais est vide quand `cm` est false — le jeu ne dessine les gizmos que pendant le setup de scene.

### Solution : dessiner nos propres hitboxes

On utilise PIXI.Graphics (PixiJS v8, module 77963, chunk 4642) pour dessiner directement dans `gizmoContainer`.

**Detection de PIXI.Graphics** :
1. `__wpRequire(77963).Graphics` — acces direct via le module ID connu
2. Fallback : scan du cache webpack (`req.c`) pour un module avec `Graphics.prototype.rect` (methode v8)

**API PixiJS v8** (different de v7) :
```
// v7 (ancien, ne marche plus)
g.beginFill(0xff0000, 0.3);
g.lineStyle(1, 0xff0000);
g.drawRect(x, y, w, h);
g.endFill();

// v8 (actuel)
g.rect(x, y, w, h);
g.fill({ color: 0xff0000, alpha: 0.3 });
g.stroke({ width: 1, color: 0xff0000, alpha: 0.5 });
```

**Donnees sources** (sur `gameApp`) :
- `colliders: Record<string, {x, y, width, height}>` — murs, obstacles (rouge)
- `interactables: Record<string, {x, y, width?, height?}>` — zones d'interaction (vert, cercle si pas de dimensions)
- `seats: Record<string, {x, y}>` — sieges (bleu, cercle r=8)

Les Graphics sont ajoutees a `gizmoContainer` (qui est dans le meme espace de coordonnees que la scene). Au toggle off, les Graphics sont `removeChild` + `destroy` et le container est re-hidden.

### Module IDs de reference

| Module | Chunk | Contenu |
|--------|-------|---------|
| 9502   | 493   | Constantes jeu (cm, vitesse, anim) — exports non-configurable |
| 20993  | ?     | GameGlobals (signal bus, camera control) |
| 77963  | 4642  | PixiJS v8 bundle (Graphics, Container, Application, etc.) |
| 82380  | 2380  | App class (gameApp, scene, colliders, gizmoContainer) |
