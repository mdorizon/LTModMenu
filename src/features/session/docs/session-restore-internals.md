# Session Restore Internals (lofi.town)

> Reverse-engineered le 2026-03-16 via inspection runtime + WS traces sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Vue d'ensemble

Sauvegarde l'etat du joueur (lobby, map, position, seat) en localStorage toutes les 10s + beforeunload.
Au rechargement, restaure automatiquement cet etat si les donnees ont < 24h.

## Snapshot sauvegarde

```ts
interface SessionSnapshot {
  lobby: string;      // "blossom", "cozy", etc.
  map: string;        // nom de scene (ex: "main", "fishing-cabin-backyard", template burrow)
  roomId: string;     // server room ID — pour les burrows c'est "burrow:<uuid>:<subRoom>"
  x: number;
  y: number;
  direction: string;
  seatId: string;     // currentSeatId du localPlayer ("", "x530y730", "portable-up")
  timestamp: number;
}
```

- localStorage key : `ltmod_session` (prefixe `ltmod_` via `saveData`)
- Feature toggle : `ltmod_sessionRestoreEnabled` (boolean, default `true`)

## Etats joueur detectes

| Etat | `currentSeatId` | `isInGoKart` | Restaurable |
|------|-----------------|--------------|-------------|
| Peche (spot) | `"x{N}y{N}"` | false | OUI — `lp.sit(seatId)` relance l'interaction peche |
| Assis (banc) | `"x{N}y{N}"` | false | OUI — `lp.sit(seatId)` |
| Portable seat | `"portable-{dir}"` | false | OUI — `lp.sit(seatId)` |
| Go-kart | `""` | true | NON — kart despawn quand le joueur quitte le serveur |
| Debout | `""` | false | Rien a faire |

- `lp.sit(seatId)` verifie `cs.instance.seats[seatId]` — le seat doit exister dans la scene chargee
- Pas de difference entre peche et banc cote restore : `sit()` gere les deux, le jeu detecte le type de seat

## Flow de restore

```
Page load
  → waitForInitialLoad() : attend le signal `initial-load-complete` sur __gameGlobals.signal
  → showRestoreOverlay() : modal non-dismissible avec toggle ON/OFF
  → Step 1 : Lobby check
      Si lobby != saved.lobby → switchLobby()
        switchLobby() ferme le WS actuel (send "41" + close)
        Socket.IO auto-reconnect cree un nouveau WS
        websocket-hook redirige l'URL via __lobbyOverride
        Apres reconnexion : waitForReady() poll localPlayer + __currentLobby + !__lobbySwitching
        Sync useLobbyStore.setCurrentLobby({id, url}) pour mettre a jour le HUD React du jeu
  → Step 2 : Map/Position
      Si burrow → visitBurrow(burrowId, template, ownerId) via signal "visitBurrow"
        Attend 3s pour le chargement de scene, puis doTP + sit
      Si map differente → doInterMapTP(x, y, dir, map)
        doInterMapTP gere SUB_MAP_ROUTES, SCENE_WEBPACK_IDS et __sceneCache
        Attend 3s, puis restorePlayerState (sit)
      Si meme map → doTP(x, y, dir) + restorePlayerState
  → close modal + notify "Session restored"
```

## Timing (pieges)

- `initial-load-complete` : signal unique au premier chargement de scene — si on attend pas, tout TP pendant le loading screen = infinite load
- `waitForReady()` poll 500ms : attend `localPlayer` + `__currentLobby` + `!__lobbySwitching`
- Apres switchLobby : sleep(2000) avant waitForReady — le WS met du temps a se reconnecter
- Apres doInterMapTP ou visitBurrow : sleep(3000) avant sit — les seats de la scene doivent etre charges (`cs.instance.seats`)
- `__lobbySwitching` flag : empiler les switchs provoque des deconnexions en boucle

## Burrow detection

- `roomId` format : `burrow:<uuid>:<subRoom>` (ex: `burrow:abc123:0`)
- `parseBurrowRoom(roomId)` extrait burrowId + subRoom
- Le `map` pour un burrow = le template de scene (utilise par visitBurrow)
- `ownerId` = `__localPlayerId` (set au connect) — necessaire pour visitBurrow

## Toggle ON/OFF

- Bouton partage entre Actions view et la modal de restore
- `registerToggleButton(btn)` / `unregisterToggleButton(btn)` : gere un Set<HTMLButtonElement>
- `setSessionRestoreEnabled(enabled)` : sauvegarde en localStorage + start/stop le saver + sync tous les boutons
- Dans la modal : cliquer OFF → `cancelled = true` → le flow async verifie `cancelled` a chaque etape
- Style CSS : `.lt-action.lt-success` (ON vert) / `.lt-action.lt-muted` (OFF grise) — les regles sont scopees a `#lt-hud` ET `#lt-modal-overlay`

## Lobby emojis

```ts
const LOBBY_EMOJIS = { ambient: "🍃", blossom: "🌸", cozy: "☕", daydream: "💭" }
lobbyLabel("cozy") → "☕ Cozy"
```

Utilise dans : modal de restore, POI "Switching to...", useLobbyStore sync

## Limites connues

- Karts non restaures (despawn cote serveur a la deconnexion)
- Le HUD React du jeu (lobby indicator) ne se met pas a jour seul apres switchLobby — necessite un sync manuel via `useLobbyStore.getState().setCurrentLobby()`
- Si un burrow n'existe plus (supprime par le owner), le visitBurrow timeout apres JOIN_TIMEOUT_MS puis fallback backToMainScene
- Les seats coordinate-based (`x{N}y{N}`) ne marchent que si le seat existe dans la scene — si le jeu a change les seats entre-temps, le sit echoue silencieusement
