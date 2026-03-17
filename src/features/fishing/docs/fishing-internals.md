# Fishing System Internals (lofi.town)

> Reverse-engineered le 2026-03-11, mis a jour le 2026-03-17 (background fishing, DOM events, pieges doublon).
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Acces au FishingManager

```js
// Lookup par nom (fiable meme si l'index change entre scenes)
const fm = window.__gameApp.gameObjects.find(go => go.name === "FishingManager");
```

Index observe : `gameObjects[2]` sur la scene fishing. Peut varier sur d'autres scenes.
Tout le systeme (boutons, minigame, modal) est PixiJS canvas. ZERO elements DOM.

## Flow (ordre strict)

### Mode normal (sans focus)

1. `isLocalPlayerSeated()` → `localPlayer.currentSeatId` truthy
2. `fm.startFishing()` → `isFishing=true`, `canCatchFish=true`, store 24795 `setIsCasting(true)`, WS emit `updateSitAnimation "fishing"`, animation canne + `takeOutFishingRod(direction)`
3. Attente serveur → WS broadcast `fishCaught` a toute la room (PAS filtre par joueur)
4. `onFishCaught` → `canCatchFish=false`, stocke `currentFish` + `currentChallenge`
5. Jeu affiche REEL → `fm.reelButton.sprite.visible === true`
6. `fm.miniGame()` → `fishingUI.visible=true`, cadran PixiJS visible, puis `startMinigameLogic()` apres animation
7. Auto-click loop : appeler `fm.handleMinigameClick()` quand fleche dans zone triangle
8. `fishLevel >= fishLevelTarget` → `fm.win()` appele automatiquement par le jeu
9. `win()` fait : `solveFishingChallenge(currentChallenge)` + WS emit `getFishingResult {result:"success", response:hash}` + `stopMiniGame()` + `stopFishing()`
10. Serveur repond WS `fishing-result {id, userId, name, weight, isShiny, ...}`
11. `onFishingResult` → appelle `er({fish:[data], blockKey:"fishingResult", onComplete:...})` → result card avec overlay noir
12. Dismiss : Space keydown (installe apres ~917ms d'animation) → cleanup, `castButton.show()`
13. Reboucle a step 2

### Mode focus (focusCommitted = true, Cozier-only ou hack)

1-3. Identique au mode normal
4. `onFishCaught` → `canCatchFish=false`, `caughtInFocusMode=true`
5. **AUTO-SOLVE** : `solveFishingChallenge()` + WS emit `getFishingResult` instantanement. PAS de reel button, PAS de minigame.
6. `transitionToCaughtIndicator()` → animation exclamation sur le sprite idle
7. Serveur repond `fishing-result`
8. `onFishingResult` → `addSessionFish(data)`, `canCatchFish=true` directement. PAS de result card.
9. Reboucle immediatement (pas de re-cast necessaire, `isFishing` reste true)

Detection dans le bot : `canCatchFish` cycle true→false→true = focus auto-catch.

## FishingManager props (v2)

```
isFishing: bool           — true entre startFishing() et stopFishing()
canCatchFish: bool        — true quand ligne dans l'eau, attend poisson
currentFish: {name, rarityTier, weight, gold, shiny}
currentChallenge: string  — hash 32 chars, change a chaque fishCaught
caughtInFocusMode: bool   — true si le dernier catch etait en focus mode
fishLevel: number         — 0 → fishLevelTarget (progression minigame)
fishLevelTarget: number   — seuil pour win (observe: 100)
arrowAngle: number        — FIXE a 270 (12h sur le cadran)
triangleThickness: number — taille zone cible en degres (observe: 140-170, retrecit)
rotatingTriangle.rotation — radians, le triangle qui tourne
fishingUI: PIXI.Container — container du minigame, visible=true pendant le jeu
castButton: ButtonHelper  — {press(), release(), show(), hide(), sprite: {visible}}
reelButton: ButtonHelper  — {press(), release(), show(), hide(), sprite: {visible}}
disableMinigameInput: bool — cooldown bref apres chaque click
consecutiveSuccesses: number — combo (reset a 0 sur fail)
totalSuccesses: number
input: {stopInput(enable: bool, reason: string)} — controle input joueur
ignoreCastUntilSpaceUp: bool — evite re-cast accidentel apres dismiss
isChatInputActive: bool   — bloque keybinds quand le chat est ouvert
```

### Props supprimees en v2

- `playingMiniGame` → remplace par `fishingUI.visible`
- `resultUI` → remplace par systeme de result cards (`er()` + `blockPixiMenuEvents`)
- `resultDismissHandler` → le keydown listener est gere par le systeme de cards

## FishingManager methodes

```
startFishing()         — cast : anim + rod sprite + son + WS + canCatchFish=true + store setIsCasting(true)
miniGame()             — lance le minigame apres fish bite, fishingUI.visible=true
handleMinigameClick()  — simule click joueur (teste zone, appelle successfulPress ou failedPress)
startMinigameLogic()   — appele apres animation d'entree, installe listeners + timer
stopMiniGame()         — cleanup minigame (UI animation out, resetGameState, listeners)
stopFishing()          — cleanup peche complet, store setIsCasting(false), removeFishingRod
win()                  — AUTO quand fishLevel>=target. Envoie hash, stopMiniGame+stopFishing
lose()                 — AUTO quand timer expire. stopMiniGame+stopFishing, emit getFishingResult fail
onFishCaught(data)     — handler WS fishCaught. Branche focus vs normal
onFishingResult(data)  — handler WS fishing-result. Branche focus (canCatchFish=true) vs normal (result card)
successfulPress()      — fishLevel += rand + streak bonus, son, combo++
failedPress()          — fishLevel -= lastLevelGained, combo=0
transitionToCaughtIndicator() — animation exclamation (focus mode only)
```

## Result card system (v2, remplace resultUI)

```js
// Fonction er() cree une result card avec overlay noir
er({
  fish: [fishData],          // array de poissons a afficher
  blockKey: "fishingResult", // bloque les interactions Pixi
  onComplete: () => { ... }  // callback apres dismiss
})

// Dismiss via Space apres ~917ms d'animation (j0=11 frames, Bb=0.2 anim speed)
// NE PAS utiliser signal "scene-load" : nettoie l'overlay mais laisse la card PixiJS visible (bug visuel)

// blockPixiMenuEvents est un Array<string> sur cs.instance (etait Set en v1, Array depuis v2)
// Verifier si result card active : cs.instance.blockPixiMenuEvents.includes("fishingResult")
```

## Store 24795 (seat type, nouveau en v2)

```js
// Zustand store dedie pour l'etat d'assise
{
  currentSeatType: "none" | "fishing" | "focus",  // type de siege actuel
  setCurrentSeatType: (type) => void,
  isCasting: false,                                // true pendant la peche active
  setIsCasting: (bool) => void
}
// Set par le jeu quand le joueur s'assoit sur un fishing seat ou focus seat
// isCasting set par startFishing/stopFishing
```

## Minigame auto-play

```js
// Conversion rotation radians → degres normalises
let triStart = ((180 * fm.rotatingTriangle.rotation / Math.PI) % 360 + 360) % 360;
let triEnd = (triStart + fm.triangleThickness) % 360;
let arrow = 270; // fm.arrowAngle, fixe

// Wrap-around safe
let inZone = (triStart <= triEnd)
  ? (arrow >= triStart && arrow <= triEnd)
  : (arrow >= triStart || arrow <= triEnd);

if (inZone && !fm.disableMinigameInput) fm.handleMinigameClick();
```

Poll a ~20-50ms. Ajouter sleep(150) apres chaque click pour eviter double-click.
La zone retrecit progressivement (triangleThickness diminue au fil du minigame).

## Fishing rod system (nouveau en v2)

```
traits.fishingRod: "normal" | "swamp"  — type de canne
takeOutFishingRod(direction)           — cree le sprite de canne selon le type
removeFishingRod()                     — detruit le sprite de canne
```

Le type "swamp" charge les sprites `swampFishingRod/*` au lieu de `fishingRod/*`.
Schema Zod dans module 51595 : `FishingRodTraitSchema`.

## Focus fishing (Cozier-only)

Le jeu check `useFocusSession.getState().focusCommitted` dans `onFishCaught`.
Si true, auto-solve + pas de minigame. Reserve aux abonnes Cozier ($9.99/mois).

```js
// updateFocusCommitted fait 3 choses :
//   1. socket.emit("updateFocusCommitted", true)  → notifie le serveur
//   2. signal.emit("focusCommittedUpdated", true)  → notifie le FishingManager
//   3. setState({focusCommitted: true})             → met a jour le store
```

Forcer `focusCommitted=true` cote client ne fonctionne PAS : le serveur valide le tier et ne repond pas avec `fishCaught` si le joueur n'est pas Cozier. Ticket separe pour investigation.

## Background fishing

Chrome throttle setTimeout/setInterval a 1 execution/min apres **5 min** de background. Les Web Workers sont soumis a la meme politique (contrairement a une idee repandue). RAF est suspendu → GSAP gele.

Consequences sur le bot :
- Attentes timer-based (`sleep(100)`) deviennent `sleep(~60000)` → loop figee
- `reelButton.hide()` (GSAP tween) ne s'execute pas → `sprite.visible` reste `true`
- Result cards creees par `er()` s'accumulent en orphelins dans `uiContainer` (GSAP ne joue pas l'anim out, ni l'anim in complete)

Solutions implementees dans `fishing-loop.ts` :
- `waitForBite()` et `waitAndDismissResult()` : **event-driven** via DOM events dispatches par `websocket-hook.ts` (voir section ci-dessous). Messages WS non throttles → resolution instantanee meme apres 30 min background.
- `destroyOrphanedResultCards()` : appelee au retour foreground via `visibilitychange`. Identifie les orphelins par `zIndex:11 && cursor:"pointer"` sur les enfants de `fm.fishingUI.parent`.
- `fm.reelButton.sprite.visible = false` force apres `stopFishing()` pour eviter re-detection de challenge stale.

## DOM events (dispatches par websocket-hook)

```js
// Dispatches sur document par websocket-hook.ts
"lt:fish-caught"    — quand fishCaught WS recu ET joueur assis. detail = {fish:{...}, challenge:"hash32"}
"lt:fishing-result" — quand fishing-result WS recu. detail = {id, userId, name, weight, isShiny, ...}
```

Ces events ne sont PAS throttles par Chrome. Ils se resolvent dans la meme microtask que le message WS.
Utiliser ces events (pas le polling PixiJS) pour toute detection dans le bot.

## Pieges connus

- `fishCaught` est BROADCAST : pas de userId, on recoit les bites de tous. Utiliser l'event DOM `lt:fish-caught` pour detecter notre poisson (dispatche uniquement si `localPlayer.currentSeatId` truthy). `window.__fishBite` reste dispo pour debug console.
- `localPlayer` n'a PAS de propriete `fishingMinigame` ni `minigame`. Ces proprietes n'existent pas sur lofi.town. Tout est dans FishingManager.
- `castButton.press()` ne lance PAS la peche. Il faut `fm.startFishing()`.
- `reelButton.press()/release()` ne lance PAS le minigame. Il faut `fm.miniGame()`.
- Appeler `stopFishingLoop()` en plein cycle peut bloquer le joueur (input lock). Le cleanup doit appeler `fm.stopMiniGame()`, `fm.stopFishing()`, `fm.input.stopInput(false, ...)`.
- Le dismiss de result card se fait via keydown Space sur window (apres ~917ms d'animation). Ne PAS utiliser signal `scene-load` (laisse la card visible).
- `playingMiniGame` n'existe plus en v2. Utiliser `fm.fishingUI.visible` a la place.
- `resultUI` n'existe plus en v2. Le systeme de result cards utilise `er()` + `blockPixiMenuEvents`.
- `fishing-result` WS event a un champ `id` (fish record ID) qui n'est PAS un player ID. Le filtre foreign ID du WS hook doit laisser passer cet event (ajoute a `localEvents`).
- En mode focus, `onFishingResult` ne montre PAS de result card et fait `canCatchFish=true` directement. Pas besoin de dismiss.
- `startFishing()` en v2 appelle `takeOutFishingRod(direction)` — nouveau, montre le sprite de canne.
- `fishCaught` BROADCAST peut arriver en **doublon** depuis le serveur (meme poisson, meme challenge, ~4s d'ecart — observe plusieurs fois). Toujours verifier `challenge !== lastSolvedChallenge` avant de traiter.
- `reelButton.sprite.visible` reste `true` en background apres GSAP freeze. `reelButton.hide()` est un tween qui ne s'execute pas sans RAF. Forcer `fm.reelButton.sprite.visible = false` manuellement apres `stopFishing()` pour eviter que `waitForBite()` detecte un challenge deja soumis au recast suivant.

## WS events

```
fishCaught         S→C  broadcast, {fish:{name,rarityTier,weight,gold,shiny}, challenge:"hash32"}
getFishingResult   C→S  {result:"success"|"fail", response:"hash64"}  — envoye par win() ou focus auto-solve
fishing-result     S→C  {id, userId, name, weight, isShiny, isSold, isInAquarium, createdAt}
updateSitAnimation C→S  "fishing" | "none"
fishingFrenzyUpdate S→C  periodic, {focusedMinutes, goalMinutes, isFrenzyActive, frenzyEndsAt}
```

## Fish database

132 especes au total (v2). 62 nouvelles especes ajoutees dans la mise a jour 2026-03-15.
Nouveaux biomes : swamp (4 especes explicitement nommees "Swamp", ~58 especes freshwater/marais).
Flag serveur `ENABLE_SWAMP_FISH` dans module 46409 — activation cote serveur.
Secret fish ajoute : "Billy Bass" avec sprite shiny special.

## Challenge solver

FNV-1a + salt `[114,51,97,108,109,115]` ("r3alms"). Voir `src/features/fishing/challenge-solver.ts`.
En mode normal, `win()` le fait automatiquement. En mode focus, `onFishCaught` le fait directement.
