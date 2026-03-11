# Fishing System Internals (lofi.town)

> Reverse-engineered le 2026-03-11 a 16h00 (UTC+1) via MCP Chrome DevTools sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Acces au FishingManager

```js
// Lookup par nom (fiable meme si l'index change entre scenes)
const fm = window.__gameApp.gameObjects.find(go => go.name === "FishingManager");
```

Index observe : `gameObjects[2]` sur la scene fishing. Peut varier sur d'autres scenes.
Tout le systeme (boutons, minigame, modal) est PixiJS canvas. ZERO elements DOM.

## Flow (ordre strict)

1. `isLocalPlayerSeated()` → `localPlayer.currentSeatId` truthy
2. `fm.startFishing()` → `isFishing=true`, `canCatchFish=true`, WS emit `updateSitAnimation "fishing"`, animation canne
3. Attente serveur → WS broadcast `fishCaught` a toute la room (PAS filtre par joueur)
4. Jeu affiche REEL → `fm.reelButton.sprite.visible === true`
5. `fm.miniGame()` → `playingMiniGame=true`, cadran PixiJS visible
6. Auto-click loop : appeler `fm.handleMinigameClick()` quand fleche dans zone triangle
7. `fishLevel >= fishLevelTarget` → `fm.win()` appele automatiquement par le jeu
8. `win()` fait : `solveFishingChallenge(currentChallenge)` + WS emit `getFishingResult {result:"success", response:hash}`
9. Serveur repond WS `fishing-result {id, userId, name, weight, isShiny, ...}`
10. `fm.resultUI` passe de null a un objet PixiJS (modal poisson)
11. Dismiss : `window.dispatchEvent(new KeyboardEvent("keydown", {key:" ", code:"Space"}))` → `resultUI` detruit, `castButton.show()`
12. Reboucle a step 2

## FishingManager props

```
isFishing: bool           — true entre startFishing() et stopFishing()
playingMiniGame: bool     — true pendant le minigame uniquement
canCatchFish: bool        — true quand ligne dans l'eau, attend poisson
currentFish: {name, rarityTier, weight, gold, shiny}
currentChallenge: string  — hash 32 chars, change a chaque fishCaught
fishLevel: number         — 0 → fishLevelTarget (progression minigame)
fishLevelTarget: number   — seuil pour win (observe: 100)
arrowAngle: number        — FIXE a 270 (12h sur le cadran)
triangleThickness: number — taille zone cible en degres (observe: 140-170, retrecit)
rotatingTriangle.rotation — radians, le triangle qui tourne
castButton: {press(), release(), show(), hide(), sprite: {visible}}
reelButton: {press(), release(), show(), hide(), sprite: {visible}}
resultUI: PixiObject|null — modal resultat, null = pas affichee
resultDismissHandler: fn|null — keydown listener sur window
disableMinigameInput: bool — cooldown bref apres chaque click
consecutiveSuccesses: number — combo (reset a 0 sur fail)
totalSuccesses: number
input: {stopInput(enable: bool, reason: string)} — controle input joueur
```

## FishingManager methodes

```
startFishing()         — cast : anim + son + WS + canCatchFish=true
miniGame()             — lance le minigame apres fish bite
handleMinigameClick()  — simule click joueur (teste zone, appelle successfulPress ou failedPress)
stopMiniGame()         — cleanup minigame (UI, listeners, state)
stopFishing()          — cleanup peche complet
win()                  — AUTO quand fishLevel>=target. Envoie hash, stop minigame+fishing
lose()                 — AUTO quand timer expire
onFishingResult(data)  — callback serveur, cree resultUI
successfulPress()      — fishLevel += rand + streak bonus, son, combo++
failedPress()          — fishLevel -= lastLevelGained, combo=0
isAngleInWedge(a,s,e)  — test angle dans arc (gere wrap 0/360)
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

## Pieges connus

- `fishCaught` est BROADCAST : pas de userId, on recoit les bites de tous. NE PAS utiliser `window.__fishBite` pour detecter notre poisson. Utiliser `fm.reelButton.sprite.visible`.
- `localPlayer` n'a PAS de propriete `fishingMinigame` ni `minigame`. Ces proprietes n'existent pas sur lofi.town. Tout est dans FishingManager.
- `castButton.press()` ne lance PAS la peche. Il faut `fm.startFishing()`.
- `reelButton.press()/release()` ne lance PAS le minigame. Il faut `fm.miniGame()`.
- Appeler `stopFishingLoop()` en plein cycle peut bloquer le joueur (input lock). Le cleanup doit appeler `fm.stopMiniGame()`, `fm.stopFishing()`, `fm.input.stopInput(false, ...)`, `fm.castButton.show()`.
- Le dismiss de resultUI se fait via keydown event sur window, pas via click DOM.

## WS events

```
fishCaught        S→C  broadcast, {fish:{name,rarityTier,weight,gold,shiny}, challenge:"hash32"}
getFishingResult  C→S  {result:"success", response:"hash64"}  — envoye par win() auto
fishing-result    S→C  {id, userId, name, weight, isShiny, isSold, isInAquarium, createdAt}
updateSitAnimation C→S  "fishing" | "none"
fishingFrenzyUpdate S→C  periodic, {focusedMinutes, goalMinutes, isFrenzyActive, frenzyEndsAt}
```

## Challenge solver

FNV-1a + salt `[114,51,97,108,109,115]` ("r3alms"). Voir `src/features/fishing/challenge-solver.ts`.
Pas besoin de l'appeler manuellement — `win()` le fait via le code interne du jeu (`g.solveFishingChallenge`).
