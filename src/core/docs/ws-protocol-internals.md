# WebSocket Protocol Internals (lofi.town)

> Reverse-engineered le 2026-03-12 via WS hook + ws-raw.log dump sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Transport : Socket.IO v4

lofi.town utilise Socket.IO v4 par-dessus un WebSocket natif. La connexion passe par Engine.IO (polling upgrade vers WS).

### URL de connexion

```
wss://<lobby>.lofi.town/socket.io/?sessionId=<uuid>&EIO=4&transport=websocket
```

- Le sous-domaine = le nom du lobby (`ambient`, `blossom`, `cozy`, `daydream`)
- `sessionId` = UUID genere par le client a chaque nouvelle connexion
- `EIO=4` = Engine.IO protocol v4

### Prefixes de messages

Chaque message WS est prefixe par un code Engine.IO + Socket.IO :

```
0   → Engine.IO OPEN (handshake serveur, contient sid + pingInterval + pingTimeout + maxPayload)
2   → Engine.IO PING
3   → Engine.IO PONG
40  → Socket.IO CONNECT (auth client → serveur, contient le JWT)
42  → Socket.IO EVENT (le format principal pour tous les events applicatifs)
```

### Handshake (message `0`)

Premier message recu apres connexion WS :
```json
0{"sid":"...","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}
```

- `pingInterval` : 25s — le serveur envoie un ping toutes les 25s
- `pingTimeout` : 20s — si pas de pong en 20s, deconnexion
- `maxPayload` : 1000000 (1MB) — taille max d'un message

### Auth (message `40`)

Envoye par le client juste apres le handshake :
```
40{"token":"eyJhbGciOi..."}
```

Le token est un JWT contenant au minimum `id` (user ID Discord-style) et `discordAccessToken`. Expire apres ~1h.

### Ping/Pong

Le serveur envoie `2` (PING), le client repond `3` (PONG). Cycle toutes les ~25s. Si le client ne repond pas dans `pingTimeout` ms, le serveur coupe la connexion.

## Sequence de connexion complete

1. Client ouvre WS vers `wss://<lobby>.lofi.town/socket.io/?sessionId=<uuid>&EIO=4&transport=websocket`
2. Serveur envoie `0{...}` (handshake Engine.IO avec sid, pingInterval, etc.)
3. Serveur envoie `40{"sid":"...","pid":"..."}` (Socket.IO CONNECT ACK)
4. Client envoie `40{"token":"..."}` (auth JWT)
5. Serveur envoie `42["connected", {...}]` (etat initial complet)
6. Client charge la scene (`loadScene` est appele par le handler `connected`)
7. Client envoie `42["joinRoom", {"room":"main","position":{...}}]`
8. Serveur envoie `42["initOtherPlayers", {...}]` (bulk load joueurs de la room)
9. Boucle normale : events bidirectionnels `42[...]`

## Le `connected` event — payload complet

Envoye par le serveur en reponse au `40` auth. C'est le plus gros message de la session, contient tout l'etat initial du joueur.

```js
42["connected", {
  serverTime: 1741788042855,          // Timestamp serveur (ms epoch)
  globalMessageHistory: [...],        // Messages chat globaux recents
  currentPosition: {                  // Position sauvegardee du joueur
    x: 123, y: 456,
    direction: "left",
    room: "main"                      // Derniere room visitee
  },
  pendingFriendRequests: [...],       // Demandes d'amis en attente
  fishingFrenzyStatus: {              // Etat du fishing frenzy event
    frenzyActive: false,
    frenzyMultiplier: 1,
    ...
  },
  restartTimerEndsAt: null,           // Timer de redemarrage serveur (null si pas en cours)
  friendPresences: {                  // SNAPSHOT: tous les amis en ligne
    "1176474483196960810": "blossom",
    "572454671508307993": "daydream",
    // Record<userId, lobbyName>
  },
  focusSessionData: {...},            // Donnees session pomodoro/focus
  ...                                 // Possiblement d'autres champs
}]
```

### `friendPresences` — point cle

Seul moment ou le serveur envoie la liste COMPLETE des amis en ligne avec leur lobby. Format `Record<userId, lobbyName>`. Les amis absents du record sont offline. Ensuite, seuls les deltas `friendPresenceUpdate` arrivent.

## Events WS — catalogue complet

### Format general

Tous les events applicatifs suivent le format Socket.IO :
```
42["eventName", data]
42["eventName", data1, data2]   // Certains events ont plusieurs arguments (ex: newFriend)
```

### Events serveur → client (S→C)

#### Connexion & etat
| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{serverTime, globalMessageHistory, currentPosition, friendPresences, ...}` | Etat initial complet apres auth |

#### Joueurs — meme room
| Event | Payload | Description |
|-------|---------|-------------|
| `initOtherPlayers` | `{playerStates: [{id, profile, position, status, ...}]}` | Bulk load de tous les joueurs de la room. Envoye a chaque changement de room. Jusqu'a ~290 joueurs. |
| `playerJoinedRoom` | `{id, profile, position, status, seatId, sitAnimation, isBot, room, kartId}` | Un joueur rejoint la room |
| `playerLeftRoom` | `"playerId"` (string direct) | Un joueur quitte la room |
| `playerDisconnected` | `"playerId"` (string direct) | Un joueur se deconnecte du lobby |
| `playerConnected` | `{id, profile, position, status, seatId, sitAnimation, isBot, room, kartId}` | Un joueur se connecte au LOBBY (pas a la room) — profil complet |
| `playerMoved` | `{id, x, y, direction}` | Mouvement d'un joueur (haute frequence) |
| `updatePosition` | `{id, x, y, direction}` | Alias/variante de playerMoved |

#### Joueurs — cross-map (lobby-wide)
| Event | Payload | Description |
|-------|---------|-------------|
| `updateRoom` | `{id: "playerId", room: "roomIdString"}` | N'importe quel joueur du LOBBY change de room. **Seule source cross-map.** |

Valeurs de `room` observees :
- `"main"` — map principale
- `"fishing"` — map peche
- `"coffee-shop"` — sous-map coffee shop
- `"burrow:uuid:0"` — burrow d'un joueur
- `""` — lobby (pas encore dans une room)

#### Amis
| Event | Payload | Description |
|-------|---------|-------------|
| `friendPresenceUpdate` | `{userId, event: "online"\|"offline", lobby}` | Delta de presence d'un ami |
| `newFriend` | arg1: `"userId"`, arg2: `{username, displayName, pfpUrl, themeColor, traits}` | Nouvel ami ajoute — **2 arguments** dans le parsed array |

#### Peche
| Event | Payload | Description |
|-------|---------|-------------|
| `fishCaught` | `{fish:{name,rarityTier,weight,gold,shiny}, challenge:"hash32"}` | Un poisson mord — broadcast toute la room, peut etre local ou autre joueur. Peut arriver en doublon (meme challenge, ~4s d'ecart). |
| `fishing-result` | `{id, userId, name, weight, isShiny, isSold, isInAquarium, createdAt}` | Resultat de peche — toujours local (response directe serveur), pas de filtre userId |
| `fishingFrenzyUpdate` | `{frenzyActive, frenzyMultiplier, ...}` | Mise a jour de l'event fishing frenzy |

#### Divers
| Event | Payload | Description |
|-------|---------|-------------|
| `newFocusSessionData` | `{...}` | Mise a jour session pomodoro |
| `updateAvatarTraitsResponse` | `{...}` | Reponse au changement de traits avatar |
| `focus-stats-updated` | `{...}` | Stats de focus mises a jour |

### Events client → serveur (C→S)

| Event | Payload | Description |
|-------|---------|-------------|
| `joinRoom` | `"roomId"` | Demande de rejoindre une room |
| `clientUpdatePosition` | `{x, y, direction}` | Position du joueur local (haute frequence) |
| `removeFriend` | `["userId"]` | Supprimer un ami |
| `startFishing` | `{...}` | Lancer la peche |
| `fishingClick` | `{...}` | Clic sur le minigame de peche |

## Lobbies et rooms

### Architecture

```
Lobby (serveur WS distinct)   → "ambient", "blossom", "cozy", "daydream"
  └── Room (sous-espace)       → "main", "fishing", "coffee-shop", "burrow:uuid:0"
```

4 lobbies connus : `ambient`, `blossom`, `cozy`, `daydream`. Chacun est un serveur Socket.IO independant a `wss://<lobby>.lofi.town/socket.io/`.

### Lobby switching (mecanisme)

Quand le joueur switch de lobby dans l'UI du jeu :

1. Client envoie `41` (Socket.IO disconnect) sur la WS courante
2. Client cree immediatement une nouvelle WebSocket vers `wss://<targetLobby>.lofi.town/socket.io/?sessionId=<newUUID>&EIO=4&transport=websocket`
3. Ancienne WS se ferme (code 1005, ~200ms apres)
4. Nouvelle WS s'ouvre
5. Handshake EIO + auth JWT (meme token, meme flow que la connexion initiale)
6. Serveur envoie `connected` avec l'etat complet
7. Le jeu charge la scene `main`, envoie `joinRoom`

**Points cles :**
- Aucun event WS "switchLobby" — c'est entierement client-side
- Le JWT est le meme pour tous les lobbies
- Le `sessionId` est un nouvel UUID a chaque connexion
- Le delai entre `41` SEND et `new WebSocket()` est ~2ms (quasiment simultane)
- `loadScene` est appele automatiquement par le handler du `connected` event

### Implications

- `friendPresences` dans `connected` donne le LOBBY de chaque ami, pas leur room
- `updateRoom` donne la ROOM d'un joueur, mais seulement dans NOTRE lobby
- Pas de visibilite cross-lobby depuis le client

## DOM events dispatches par le hook

`websocket-hook.ts` dispatche des CustomEvents sur `document` pour permettre une detection event-driven sans polling (contourne le throttling Chrome en background).

```js
"lt:fish-caught"    — dispatch quand fishCaught recu ET localPlayer.currentSeatId truthy
                      detail = {fish:{name,rarityTier,weight,gold,shiny}, challenge:"hash32"}

"lt:fishing-result" — dispatch quand fishing-result recu
                      detail = {id, userId, name, weight, isShiny, isSold, isInAquarium, createdAt}

"lt:players-changed" — dispatch quand playerProfiles ou friendIds change (initOtherPlayers, join/leave, etc.)
```

Ces events se resolvent dans la meme microtask que le message WS entrant — pas de throttling Chrome, pas de RAF requis.

## Pieges connus

- Le `connected` event est le plus gros message (~plusieurs KB). Ne pas le tronquer dans les logs.
- `playerConnected` ≠ `playerJoinedRoom` : le premier est lobby-wide, le second est room-specific
- `playerDisconnected` et `playerLeftRoom` envoient un string direct, pas un objet
- `newFriend` a 2 arguments (parsed[1] = ID, parsed[2] = profil) — inhabituel en Socket.IO
- Les events `playerMoved`/`updatePosition` sont tres haute frequence (~10/s par joueur), a filtrer
- `maxPayload` de 1MB : theoriquement un message ne peut pas depasser cette taille
- Le JWT dans `40` auth expire apres ~1h
- Lobby switch = nouvelle WebSocket + nouveau sessionId — l'ancienne connexion meurt, toutes les references deviennent stale
- Socket.IO auto-reconnect peut se declencher apres un close inattendu — il reconnectera au MEME lobby (meme URL)
