# Scene & Map System Internals (lofi.town)

> Reverse-engineered le 2026-03-12 via webpack-spy + console devtools sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Architecture des scenes

Le jeu utilise PixiJS + Next.js. Chaque map/zone est une "scene" : un objet JSON contenant la definition de la map (spawn, objets, zones, camera).

### Structure GameScene

```ts
{
  name: string                          // Identifiant unique ("main", "fishing", "burrow-1", ...)
  fastTravelSpawnPosition?: {           // Point de spawn par defaut
    x: number
    y: number
    direction: "left" | "right" | "up" | "down"
  }
  showMinimap?: boolean                 // Afficher la minimap
  clampZoom?: number                    // Limite de zoom camera
  zones?: any[]                         // Zones de spawn, transitions entre maps
  objects?: any[]                       // Meubles, decorations, interactables, Camera
  [key: string]: unknown                // Proprietes additionnelles par scene
}
```

`objects` contient au minimum `[{ name: "Camera" }]` pour la camera PixiJS.

### Scenes connues

Maps principales (accessibles par fast travel) :
```
"main"         — map principale, hub central
"fishing"      — zone de peche
"blossom"      — map blossom
"daydream"     — map daydream
"ambient"      — map ambient
```

Sous-maps (accessibles par interaction dans la map parente) :
```
"coffee-shop"    → parente: "main"
"fishing-shop"   → parente: "fishing"
```

Burrows (templates) :
```
"burrow-1", "burrow-2", ... (~12 templates)
```

## Cache des scenes

```js
window.__sceneCache  // Map<string, GameScene>
```

### Sources de capture (par ordre de fiabilite)

**1. Webpack modules connus (IDs hardcodes)**
```js
const KNOWN_SCENES: Record<number, string> = {
  43445: "fishingScene",
  46670: "mainScene",
};
```

Accedes via `window.__wpRequire(moduleId)` apres capture du webpack require.

**2. Burrow templates (module 20493)**

Le module 20493 contient dans son code source un objet literal `ik={...}` qui definit tous les templates de burrows. Extrait par `extractBurrowTemplates()` :

```js
// Parse le code source du module
const src = mod.toString();
// Cherche le pattern ik={...} (nom minifie de l'objet templates)
const match = src.match(/\b\w{1,2}=(\{[^}]+fastTravelSpawnPosition[^}]+\})/);
// Remplace les references a des variables par null pour rendre le JSON parseable
// JSON.parse le resultat
```

Observe : ~12 templates extraits. Log : "Extracted 12 burrow templates from game source".

**3. Hook loadScene (runtime)**

Prototype hook sur `AppClass.prototype.loadScene` :
```js
const origLoadScene = proto.loadScene;
proto.loadScene = function(opts) {
  if (opts.scene?.name) {
    window.__sceneCache.set(opts.scene.name, opts.scene);
  }
  return origLoadScene.call(this, opts);
};
```

Capture toute scene passee a `loadScene()` pendant le jeu. C'est le filet de securite pour les scenes pas capturees autrement.

**4. Scan des modules webpack**

`initSceneCache()` itere `require.c` (cache de tous les modules webpack charges) et cherche des objets avec `name` et `fastTravelSpawnPosition`. Capture opportuniste.

### Timing de capture

Le cache est initialise dans `initSceneCache()`, appele 5 secondes apres la capture de `gameApp` par le polling HUD. Ce delai est necessaire pour que les modules webpack soient charges.

`extractBurrowTemplates()` est aussi appele dans `initSceneCache()`.

## loadScene — mecanisme interne

```ts
app.loadScene(opts: {
  scene: GameScene
  burrow?: { id: string, subRoom: number }    // Si visite de burrow
  position?: { x: number, y: number, direction: string }
  doNotGetMapData?: boolean
})
```

Ce que fait `loadScene` :
1. Charge la scene PixiJS (objets, tilemap, camera)
2. Place le joueur a `position` (ou `scene.fastTravelSpawnPosition`)
3. Envoie `joinRoom` au serveur WS avec le room ID correspondant
4. Cree un nouveau `localPlayer` (IMPORTANT : les references a l'ancien deviennent stale)
5. Le serveur repond avec `updateRoom` si la transition est acceptee

### Effets de bord de loadScene

- `localPlayer` est RECREE — toutes les modifications (speed, noclip) sont perdues
- C'est pourquoi le speed watcher (`setInterval 2s`) re-applique le multiplier
- C'est pourquoi le noclip doit etre re-applique si on change de map (non implemente actuellement)
- `gameApp.players` est vide juste apres — le `initOtherPlayers` WS le remplit

## backToMainScene

```ts
app.backToMainScene()
```

Ramene le joueur a la map principale. Equivalent au bouton "Leave" dans l'UI du jeu.
Utilise comme recovery apres un echec de visite de burrow.

## Teleportation

### Intra-map (doTP)

```ts
function doTP(x: number, y: number, dir: string): boolean
```

Met a jour toutes les positions du localPlayer + envoie `clientUpdatePosition` WS + snap camera.

Positions mises a jour :
```
currentPos.x/y
parent.x/y
serverPos.x/y  (si existe)
oldPos.x/y     (si existe)
```

### Inter-map (doInterMapTP)

```ts
function doInterMapTP(mapName: string, x: number, y: number, dir: string): boolean
```

Recupere la scene depuis le cache, appelle `loadScene`, puis `doTP` apres un delai (1-3s) pour laisser la scene se charger.

Pour les sous-maps (coffee-shop, fishing-shop) :
1. Charger la map parente d'abord
2. Attendre 3s
3. Appeler `probeInteractableScenes()` qui trigger les interactables pour capturer les sous-maps
4. Charger la sous-map depuis le cache

### Seat offset

Quand un joueur est assis (`currentSeatId` truthy), sa position est le centre du meuble. Pour TP a cote de lui, ajouter un offset :
```js
const SEAT_OFFSET = 10; // pixels
x += SEAT_OFFSET;
y += SEAT_OFFSET;
```

## currentServerRoomId

```js
app.currentServerRoomId  // string | undefined
```

Le room ID confirme par le serveur. Mis a jour quand le serveur envoie `updateRoom`.

Formats observes :
```
"main"
"fishing"
"coffee-shop"
"burrow:c0fea8b7-f5e7-412a-b95b-9642a30395bb:0"
```

Peut avoir un delai par rapport a l'appel `loadScene` — ne pas tester immediatement apres.

## Interactables

```js
app.interactables  // Record<string, { onInteract?: () => void }>
```

Objets interactifs de la scene courante (portes, pannneaux, etc.). `probeInteractableScenes()` appelle `onInteract()` sur chaque interactable pour forcer le chargement des sous-maps.

## Webpack spy

### Capture de gameApp

Deux chemins de capture, le HUD polling gagne toujours la course :

**1. HUD polling (gagnant)**
```js
// Dans hud.ts, setInterval qui teste document.querySelector + conditions
// Detecte quand gameApp est disponible sur le renderer PixiJS
// Appelle initSceneCache() 5s apres
```

**2. Webpack-spy retry (backup)**
```js
// webpackChunk_N_E push hook + setter sur __gameApp
// Retry toutes les 500ms pendant 30s
// En pratique, n'aboutit presque jamais car HUD polling est plus rapide
```

### wpRequire

```js
window.__wpRequire  // (moduleId: number) => module
```

Le `require` interne de webpack, capture via le hook `webpackChunk_N_E.push`. Permet d'acceder a n'importe quel module webpack par ID.

## Pieges connus

- `loadScene` recree `localPlayer` — TOUTES les modifications d'instance sont perdues (speed, noclip handler, etc.)
- Le cache de scenes n'est pas rempli instantanement — les templates burrow sont extraits ~5s apres le demarrage
- `probeInteractableScenes` trigger de vrais interactions cote serveur — peut avoir des effets de bord
- Les IDs de modules webpack changent entre les builds du jeu — les IDs hardcodes (43445, 46670, 20493) peuvent casser
- `backToMainScene` n'est pas toujours disponible sur `gameApp` — tester `app.backToMainScene` avant d'appeler
