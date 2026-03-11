# Bypass Fishing — Plan & ressources existantes

> Cree le 2026-03-11 a 16h30 (UTC+1). Feature pas encore implementee.

## Objectif

Mode alternatif au bot minigame : skip le minigame et envoyer directement le hash au serveur pour win instantane.
A activer via un toggle dans le HUD fishing (ex: "Instant Mode" vs "Minigame Mode").

## Ressources deja en place

Ces fonctions existent dans `challenge-solver.ts` et sont exposees sur `window` via `setupFishingGlobals()` (appele dans `index.ts`).
Elles ne sont PAS utilisees par le bot actuel (qui joue le vrai minigame via FishingManager).

### `solveFishingChallenge(challenge: string): string`
- Input : hash challenge 32 chars (recu dans `fishCaught` event ou `fm.currentChallenge`)
- Output : hash reponse 64 chars (FNV-1a + salt "r3alms")
- Expose sur `window.__solveFishingChallenge`

### `autoSolveChallenge(challenge: string): boolean`
- Appelle `solveFishingChallenge` puis envoie `getFishingResult {result:"success", response:hash}` via `window.__gameWS.send()`
- Retourne true si envoye, false si WS pas pret
- Expose sur `window.__autoSolveChallenge`

### `forceEndMinigame(): boolean`
- Cherche `localPlayer.fishingMinigame` ou `localPlayer.minigame` et appelle `.destroy()`
- ATTENTION : ces proprietes n'existent PAS sur lofi.town (voir fishing-internals.md)
- A REECRIRE pour utiliser `getFishingManager().stopMiniGame()` a la place
- Expose sur `window.__forceEndMinigame`

### `window.__fishBite: FishBiteData | null`
- Set par le WS hook quand un `fishCaught` event arrive et que le joueur est assis
- Contient `{fish: {name, rarityTier, weight, gold, shiny}, challenge: "hash32"}`
- Le bot actuel ne le lit plus (utilise `fm.reelButton.sprite.visible`)
- Utile pour le bypass : recuperer le challenge sans passer par le FishingManager

### `window.__lastFish: FishResultData | null`
- Set par le WS hook quand un `fishing-result` arrive
- UTILISE par le bot actuel aussi — ne pas supprimer

## Flow bypass envisage

1. Joueur assis → `fm.startFishing()` (meme chose que le bot normal)
2. Fish bite → au lieu de `fm.miniGame()`, recuperer le challenge :
   - soit `fm.currentChallenge` (sur le FishingManager)
   - soit `window.__fishBite.challenge` (via WS hook)
3. `autoSolveChallenge(challenge)` → envoie le hash directement
4. Le serveur repond `fishing-result` → `window.__lastFish` est set
5. Le FishingManager recoit `onFishingResult` → `resultUI` apparait
6. Dismiss la modal comme le bot normal
7. Reboucle

### Points d'attention

- Le serveur pourrait rejeter les reponses trop rapides (< 1s apres fishCaught). Ajouter un delai configurable.
- `fm.stopMiniGame()` doit etre appele si le minigame a ete lance, sinon le state sera incoherent.
- Si le minigame n'est PAS lance (on bypass avant), le FishingManager reste en `isFishing=true` mais `playingMiniGame=false`. Apres le fishing-result, `onFishingResult` devrait quand meme montrer la modal.
- `forceEndMinigame()` est casse (proprietes inexistantes). A corriger si besoin.

## Nettoyage possible lors de l'implementation

- `forceEndMinigame()` : reecrire ou supprimer selon le flow choisi
- `__fishBite` : garder si le bypass l'utilise, sinon supprimer + WS hook fishCaught handler
- `autoSolveChallenge()` : garder tel quel, c'est le coeur du bypass
- `solveFishingChallenge()` : garder, utilise par autoSolveChallenge
