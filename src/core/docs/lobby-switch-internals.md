# Lobby Switch Internals (LTModMenu)

> Documente le 2026-03-12.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.
> Voir aussi : `ws-protocol-internals.md` pour le protocole Socket.IO, `social-internals.md` pour le systeme d'amis, `scene-internals.md` pour loadScene.

## Vue d'ensemble

Le jeu n'expose aucune API de lobby switch. Le mecanisme est 100% client-side : deconnecter le WS actuel, en creer un nouveau vers un autre sous-domaine, et laisser Socket.IO + le jeu se reinitialiser.

### Les 4 lobbies connus

```
ambient, blossom, cozy, daydream
```

Chaque lobby = un serveur Socket.IO independant a `wss://<lobby>.lofi.town/socket.io/`. Detection dynamique : on extrait le sous-domaine de l'URL WS, et les presences d'amis (`friendPresences` dans `connected`) revelent les lobbies existants.

## Orchestrator API

L'Orchestrator (`https://orchestrator.lofi.town`) est l'API publique de decouverte de serveurs. Pas besoin d'auth.

### Endpoints

#### `GET /servers`

```json
{
  "servers": [
    { "id": "ambient", "url": "https://ambient.lofi.town" },
    { "id": "blossom", "url": "https://blossom.lofi.town" },
    { "id": "cozy", "url": "https://cozy.lofi.town" },
    { "id": "daydream", "url": "https://daydream.lofi.town" }
  ],
  "recommended": { "id": "ambient", "url": "https://ambient.lofi.town" }
}
```

Champs : `id` (nom du lobby, correspond au sous-domaine WS) et `url` (HTTPS, pas WSS). `recommended` = le serveur que le jeu propose par defaut (generalement le moins charge).

#### `GET /player-counts`

```json
{
  "total": 438,
  "lobbies": { "ambient": 239, "blossom": 95, "cozy": 50, "daydream": 54 }
}
```

`lobbies` est un `Record<string, number>` — cle = lobby id, valeur = nombre de joueurs connectes.

### Constantes

| Constante | Valeur | Signification |
|-----------|--------|---------------|
| `SOFT_CAP` | 250 | Seuil au-dela duquel le jeu redirige les nouveaux joueurs vers un autre lobby |
| `MAX_PLAYERS` | 350 | Limite dure par serveur |

### Usage dans le mod

Le mod utilise `/player-counts` pour le bouton "Join least populated lobby" (dans POI view). Le fetch est fait au clic, pas en polling continu. L'Orchestrator n'est PAS utilise pour le cross-lobby TP (qui repose sur les presences WS des amis via `friendPresences`).

## Mecanisme de switch — vue technique

### Sequence complete

```
1. switchLobby("target")                    → game.ts
2.   __lobbySwitching = true                 → verrou anti-spam
3.   __lobbyOverride = "target"              → flag consomme par le hook WS
4.   ws.send("41")                           → Socket.IO disconnect
5.   ws.close()                              → ferme le transport
6. Socket.IO detecte la deconnexion          → auto-reconnect
7.   new WebSocket("wss://OLD.lofi.town/..") → intercepte par notre hook
8.   Hook detecte __lobbyOverride            → websocket-hook.ts
9.   URL reecrite: OLD → TARGET              → __lobbyOverride consomme (mis a null)
10.  lobbySwitched = true                    → flag local au hook
11.  __currentLobby = "target"              → mis a jour immediatement
12. WS.open event                           → websocket-hook.ts onLobbyOpen
13.   __lobbySwitching = false              → verrou relache
14.   app.isFirstLoad = true                → force re-init complete
15.   app.hasInitiallyJoinedRoom = false    → force joinRoom
16. Socket.IO auth (40{token:...})          → pid/offset strippes (lobbySwitched)
17. Serveur envoie "connected" event        → etat complet du nouveau lobby
18. Game handler charge la scene            → loadScene automatique
19. Game envoie joinRoom                    → entre dans la room
20. initOtherPlayers arrive                 → joueurs de la nouvelle room
```

### Composants impliques

| Fichier | Role |
|---------|------|
| `core/game.ts` — `switchLobby()` | Point d'entree, verrou, envoi `41` + close |
| `core/websocket-hook.ts` | Interception URL, pid/offset strip, App flag reset |
| `core/storage.ts` | Init des globals (`__lobbyOverride`, `__lobbySwitching`, etc.) |
| `core/types/global.d.ts` | Types des globals Window |
| `ui/components.ts` — `showTransitionOverlay()` | Overlay noir pendant la transition |
| `features/players/ui/player-actions-view.ts` | Orchestration cross-lobby TP (overlay + polling) |

## Le hook WebSocket — details

### Interception de l'URL

Dans le constructeur hooke de WebSocket :

```js
// Extrait le lobby courant depuis l'URL WS
const lobbyMatch = url.match(/wss:\/\/([^.]+)\.lofi\.town/);
if (lobbyMatch) {
  window.__currentLobby = lobbyMatch[1];
  if (window.__lobbyOverride && window.__lobbyOverride !== lobbyMatch[1]) {
    url = url.replace(/wss:\/\/[^.]+\.lofi\.town/, "wss://" + target + ".lofi.town");
    window.__lobbyOverride = null;   // consomme
    lobbySwitched = true;            // flag local
  }
}
```

**Pourquoi ca marche** : Socket.IO auto-reconnect cree un `new WebSocket()` avec l'ancienne URL. Notre hook intercepte ce constructeur et reecrit l'URL avant que le WS soit cree.

### Stripping pid/offset

Socket.IO v4 supporte la session recovery : sur reconnexion, le client envoie `pid` (previous session ID) et `offset` dans le message `40{...}` auth. Le nouveau serveur ne connait pas l'ancienne session → il rejetterait la connexion.

```js
if (lobbySwitched && (authPayload.pid || authPayload.offset)) {
  delete authPayload.pid;
  delete authPayload.offset;
  data = "40" + JSON.stringify(authPayload);
}
```

Sans ce strip, le serveur recoit un `pid` inconnu et peut refuser la connexion ou la traiter comme une nouvelle connexion avec un etat incoherent.

### Reset des App flags

Decouverte critique : apres un lobby switch, le `connected` event arrive mais le game handler le traite comme une simple reconnexion (pas un premier chargement). Resultat : pas de `loadScene`, pas de `joinRoom`, pas de scene chargee. Le joueur voit les joueurs de l'ancien lobby disparaitre mais rien d'autre.

```js
// Sur l'event "open" du nouveau WS (apres lobby switch)
app.isFirstLoad = true;              // Force le handler "connected" a charger la scene
app.hasInitiallyJoinedRoom = false;  // Force l'envoi de joinRoom
```

**Decouverte des flags** : trouves par inspection manuelle des proprietes booleennes de gameApp via la console. Les deux flags controlent le comportement du handler `connected` dans le code du jeu.

| Flag | Valeur normale (reconnexion) | Valeur forcee (lobby switch) | Effet |
|------|------------------------------|------------------------------|-------|
| `isFirstLoad` | `false` | `true` | Le handler `connected` appelle `loadScene` avec la scene de `currentPosition.room` |
| `hasInitiallyJoinedRoom` | `true` | `false` | Le handler `connected` envoie `joinRoom` au serveur |

Sans ce reset, le joueur est techniquement connecte au nouveau lobby mais le jeu ne charge aucune scene → ecran fige, marche entre maps cassee, interactions mortes.

## Protection anti-spam

### Le verrou `__lobbySwitching`

Probleme : si l'utilisateur spam le switch, chaque appel fait `send("41") + close()` sur un WS qui peut etre en CLOSING ou CLOSED (Socket.IO n'a pas encore recree le nouveau WS).

```
Appel 1: WS OPEN → send("41") + close() → WS passe en CLOSING
Appel 2: WS CLOSING → send("41") echoue (browser warning)
Appel 3: Nouveau WS cree par Socket.IO mais en CONNECTING → readyState != 1
```

Solution :

```js
// game.ts — switchLobby()
if (window.__lobbySwitching) return false;   // bloque
window.__lobbySwitching = true;              // verrouille

// websocket-hook.ts — onLobbyOpen
window.__lobbySwitching = false;             // deverrouille quand le nouveau WS s'ouvre

// game.ts — safety net
setTimeout(() => {
  if (window.__lobbySwitching) {
    window.__lobbySwitching = false;          // auto-deverrouille apres 10s
  }
}, 10000);
```

### Guard sur send()

Le `send()` hooke verifie `ws.readyState !== 1` avant d'appeler `_origSend()`. Ca evite le warning browser `WebSocket is already in CLOSING or CLOSED state` quand du code tente d'envoyer sur un WS mourant.

## Overlay de transition

Overlay noir plein ecran avec fade-in/fade-out, similaire a la transition native du jeu entre maps.

```js
// components.ts
function showTransitionOverlay(): () => void
// Retourne une fonction dismiss() pour fade-out
```

CSS :
```css
#lt-transition {
  position: fixed; inset: 0; z-index: 999998;
  background: #000; opacity: 0; pointer-events: none;
  transition: opacity 0.4s ease;
}
#lt-transition.lt-fade-in {
  opacity: 1; pointer-events: all;
}
```

L'overlay est affiche au debut du switch et retire quand :
- L'ami est trouve sur la map et le TP est fait
- La room de l'ami est detectee et la navigation commence
- Le timeout (15s) est atteint
- L'element status DOM disparait (l'utilisateur a navigue ailleurs)

## Flow cross-lobby TP complet

Quand l'utilisateur clique "Switch to X" sur la page actions d'un ami :

```
1. switchLobby(friendLobby)        → initie le switch
2. showTransitionOverlay()          → ecran noir
3. setInterval(poll, 300ms)         → boucle de polling
4. Poll: __currentLobby == target?  → attend la connexion
5. Poll: friend in app.players?     → ami sur la meme map → doTP() direct
6. Poll: __playerRooms.get(id)?     → ami sur une autre map/burrow
7.   room.startsWith("burrow:")?    → loadScene avec burrow params
8.   sinon                          → doInterMapTP vers la map
9. Timeout 15s                      → abandon, message d'erreur
```

### Cas : ami sur la meme map

Le plus simple. `app.players[friendId]` existe → on a sa position live → `doTP(x, y, dir)`.

### Cas : ami sur une autre map (meme lobby)

L'event `updateRoom` nous dit dans quelle room est l'ami. Deux sous-cas :
- **Burrow** (`room = "burrow:uuid:0"`) : `loadScene` avec le scene template + burrow params
- **Map normale** (`room = "fishing"`, `room = "main"`, etc.) : `doInterMapTP(spawn.x, spawn.y, dir, room)`

### Cas : ami introuvable

Si apres 15s ni `app.players` ni `__playerRooms` ne contiennent l'ami, le polling timeout. L'overlay se retire, un message "Joined X — couldn't locate Y" s'affiche.

Causes possibles :
- L'ami s'est deconnecte entre-temps
- L'ami est dans un burrow prive (pas d'`updateRoom` visible)
- Race condition sur l'init du lobby

## Globals utilises

| Global | Type | Defini dans | Role |
|--------|------|-------------|------|
| `__currentLobby` | `string \| null` | `websocket-hook.ts` | Lobby actuel, extrait de l'URL WS |
| `__lobbyOverride` | `string \| null` | `game.ts` | Lobby cible, consomme par le hook WS lors de la prochaine connexion |
| `__lobbySwitching` | `boolean` | `game.ts` / `websocket-hook.ts` | Verrou anti-spam |
| `__wsAuthToken` | `string \| null` | `websocket-hook.ts` | JWT capture depuis le message `40` auth |
| `__playerRooms` | `Map<string, string>` | `websocket-hook.ts` | Room actuelle de chaque joueur du lobby (via `updateRoom`) |

## Pieges connus

- **Socket.IO reconnecte au meme lobby** si `__lobbyOverride` est null au moment du `new WebSocket()`. L'override doit etre set AVANT le close.
- **`__gameWS` pointe sur le nouveau WS** des que le constructeur hooke est appele (readyState = CONNECTING). Le WS n'est pas encore utilisable pour envoyer.
- **Le `connected` event arrive DEUX fois** si Socket.IO tente un recovery puis fait une fresh connection. Le handler doit etre idempotent.
- **`isFirstLoad` et `hasInitiallyJoinedRoom`** sont reset UNE seule fois par switch (dans le `open` handler). Si le jeu les modifie entre `open` et `connected`, le reset est perdu.
- **Les profils joueurs (`__playerProfiles`) sont nettoyes** par les events `playerDisconnected`/`playerLeftRoom` de l'ancien lobby. Apres un switch, les profils sont vides jusqu'au prochain `initOtherPlayers`.
- **`__playerRooms` n'est PAS videe** au switch. Les rooms de l'ancien lobby restent. Ca peut causer des faux positifs si un player ID existe dans les deux lobbies.
- **L'overlay peut rester bloque** si le DOM du status element disparait (naviguation hors du menu) ET que le timeout n'a pas encore fire. Le cleanup du `setInterval` depend de `!stEl`.
- **Le safety net de 10s sur `__lobbySwitching`** est necessaire car si le WS ne s'ouvre jamais (erreur reseau, serveur down), le verrou ne serait jamais relache.
- **Spam via la console** bypass `switchLobby()` et donc le verrou. Le `send()` guard empeche le crash mais pas la corruption d'etat.
