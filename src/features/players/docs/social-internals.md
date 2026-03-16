# Social & Burrow System Internals (lofi.town)

> Reverse-engineered le 2026-03-12 via WS hook + console devtools sur app.lofi.town.
> Mis a jour le 2026-03-12 avec la decouverte de `friendPresences` dans le `connected` event.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Systeme d'amis

### Source de donnees

Aucune API REST accessible (`/api/getFriends` retourne 401, auth Supabase server-side).
La detection d'amis passe par les events WS : snapshot initial via `connected`, puis deltas temps reel.

### Events WS

```
connected              S→C  {..., friendPresences: Record<userId, lobbyName>}  — SNAPSHOT: tous les amis en ligne au moment de la connexion
friendPresenceUpdate   S→C  {userId: "discordId", event: "online"|"offline", lobby: "ambient"|"blossom"|"daydream"|...}
newFriend              S→C  ["uuid-du-joueur", {username, displayName, pfpUrl, themeColor, traits:{hat,back,body,face,legs,torso,outfit,facialExpression}}]
removeFriend           C→S  ["userId"]  — envoye par le client quand on supprime un ami
```

### `friendPresences` dans `connected` (decouverte 2026-03-12)

Le `connected` event contient un champ `friendPresences` qui donne la liste complete des amis actuellement en ligne avec leur lobby :

```js
eventData.friendPresences = {
  "1176474483196960810": "blossom",
  "572454671508307993": "daydream",
  "495261899689033738": "daydream"
}
// Record<userId, lobbyName>
// Les amis ABSENTS de ce record sont offline
```

C'est le seul moment ou le serveur envoie un etat complet. Ensuite, seuls les deltas (`friendPresenceUpdate`) arrivent.

### `friendPresenceUpdate` — deltas temps reel

Arrive tout au long de la session quand un ami change d'etat. Quand un ami change de map (ex: blossom → daydream), on recoit DEUX events rapproches :
1. `{event: "offline", lobby: "blossom"}` — quitte l'ancien lobby
2. `{event: "online", lobby: "daydream"}` — rejoint le nouveau lobby

### `newFriend` — profil complet

DEUX arguments dans le parsed array : `parsed[1]` = ID string, `parsed[2]` = objet profil complet avec `username`, `displayName`, `pfpUrl`, `themeColor`, `traits`. Capturer les deux.

### Donnees capturees

```js
window.__friendIds  // Map<string, FriendPresence>
// FriendPresence = { online: boolean, lobby: string, displayName: string, username: string }
```

- Persistees en localStorage (`ltmod_friends`) au format `Record<string, FriendPresence>`
- Au demarrage, les noms sont restaures du localStorage, online/lobby remis a false/""
- Le `connected` event met a jour les statuts online/lobby instantanement
- Les events `friendPresenceUpdate` mettent a jour en temps reel
- Les events `newFriend` ajoutent un ami avec son profil
- Les noms sont mis a jour quand un ami est vu sur la meme map (`initOtherPlayers`, `playerJoinedRoom`)

### Cycle d'acquisition des noms d'amis

1. `newFriend` arrive → on a le nom immediatement (profil en 2e arg)
2. L'ami est sur la meme map → `initOtherPlayers` / `playerJoinedRoom` → nom capture via `updateFriendName()`
3. Le nom est persiste dans localStorage → disponible aux sessions suivantes
4. Si l'ami n'a jamais ete vu sur notre map et n'a pas ete ajoute pendant cette session → pas de nom, fallback ID tronque

### Limitations amis

- `friendPresences` ne contient PAS les noms, seulement les IDs et lobbies
- Un ami qui a TOUJOURS ete offline depuis que le mod existe n'aura jamais de nom (jamais vu sur une map, jamais ajoute via `newFriend`)
- Le `lobby` est le nom du serveur (ex: "ambient", "blossom", "daydream"), PAS un room ID complet

## Profils joueurs

### Source de donnees

```js
window.__playerProfiles  // Map<string, PlayerProfile>
// PlayerProfile = { displayName: string, username: string, activeBurrow?: ActiveBurrow | null }
```

### Events WS alimentant les profils

```
initOtherPlayers  S→C  {playerStates: [{id, profile: {displayName, username, activeBurrow, pfpUrl, themeColor, traits, tags}}, ...]}
playerJoinedRoom  S→C  {id, profile: {displayName, username, activeBurrow, pfpUrl, themeColor, traits, tags}, position, status, seatId, sitAnimation, isBot, room, kartId}
playerDisconnected S→C  "playerId" (string direct)
playerLeftRoom     S→C  "playerId" (string direct)
playerConnected    S→C  {id, profile: {displayName, username, activeBurrow, pfpUrl, themeColor, traits, tags}, position, status, seatId, sitAnimation, isBot, room, kartId}
```

`initOtherPlayers` est envoye a chaque changement de room/map et contient TOUS les joueurs presents. C'est le bulk load initial. Observe : jusqu'a ~290 joueurs sur les maps populaires.

`playerConnected` est emis quand un joueur se connecte au LOBBY (serveur), pas a une room specifique. Il contient le profil complet.

`playerJoinedRoom` et `playerDisconnected`/`playerLeftRoom` sont des deltas incrementaux.

### Cycle de vie des profils

1. Joueur rejoint la room → `initOtherPlayers` ou `playerJoinedRoom` → profil stocke
2. Joueur quitte → `playerDisconnected` ou `playerLeftRoom` → profil SUPPRIME
3. On change de map nous-memes → nouveau `initOtherPlayers` pour la nouvelle room, anciens profils pas nettoyes (mais deviennent stale)

### Donnees dans le profil

```js
activeBurrow: {
  id: "uuid",                    // ID unique du burrow
  privacyLevel: "PUBLIC" | "FRIENDS_ONLY" | "OWNER_ONLY",
  template: "apartment-sm" | "burrow-1" | "burrow-2" | ...  // Nom du template de scene
} | null
```

Pas de burrow = `null` ou `activeBurrow` absent. Tester `burrow?.id` pour verifier l'existence.

## Tracking cross-map de joueurs

### `updateRoom` event

```
updateRoom  S→C  {id: "playerId", room: "roomIdString"}
```

Emis quand N'IMPORTE QUEL joueur du LOBBY (pas juste la room) change de room. Permet de savoir sur quelle map se trouve un joueur meme s'il n'est pas sur la meme map que nous.

Valeurs de `room` observees :
- `"main"` — map principale
- `"fishing"` — map peche
- `"coffee-shop"` — sous-map coffee shop
- `"burrow:uuid:0"` — burrow d'un joueur
- `""` — lobby (pas encore dans une room)

**Interet majeur** : combine avec `playerConnected` (qui donne le profil), on peut tracker les mouvements inter-map de tous les joueurs du lobby. C'est la seule source de donnees cross-map disponible depuis le client.

### Limitations

- On ne recoit `updateRoom` que pour les joueurs de NOTRE lobby (serveur). Chaque lobby (ambient, blossom, daydream, etc.) est un serveur separe.
- Pas de moyen de savoir combien de joueurs sont sur une autre map sans les tracker un par un.

## Burrows

### Niveaux de confidentialite

```
PUBLIC       — tout le monde peut visiter
FRIENDS_ONLY — seulement les amis (verifier isFriend)
OWNER_ONLY   — personne d'autre ne peut visiter
```

Valeurs viennent du champ `activeBurrow.privacyLevel` dans le profil du joueur.

### Visiter un burrow

#### Methode principale : signal natif `visitBurrow`

Le jeu expose un signal bus via `window.__gameGlobals.signal` qui gere nativement les visites de burrow :

```js
window.__gameGlobals.signal.emit("visitBurrow", {
  burrowId: "uuid",
  template: "burrow-1",    // template de scene du burrow
  ownerId: "discordId"     // ID du proprietaire du burrow
});
```

Le signal gere tout en interne : chargement de la scene, positionnement du joueur, connexion a la room serveur, gestion des erreurs. C'est le meme mecanisme que le jeu utilise quand on clique "Visit" dans l'interface native.

#### Fallback : `loadScene` manuel

Si `window.__gameGlobals.signal` n'est pas disponible (capture ratee, timing), fallback sur `loadScene` :

```js
app.loadScene({
  scene: sceneObject,                   // GameScene avec name, fastTravelSpawnPosition, etc.
  burrow: { id: "burrow-uuid", subRoom: 0 },
  position: {
    x: spawn.x + BURROW_SPAWN_OFFSET_X, // offset -30 pour eviter collision mur
    y: spawn.y,
    direction: spawn.direction
  }
})
```

Le `loadScene` cote client :
1. Charge la scene visuellement (PixiJS)
2. Envoie un `joinRoom` WS au serveur avec le room ID du burrow
3. Le serveur repond (ou non) avec un `updateRoom` confirmant le changement

Cette methode necessite de gerer manuellement le spawn offset, le timeout, et le recovery — le signal natif est toujours prefere.

#### Implementation centralisee

Toute la logique de visite est dans `src/features/teleport/burrow-visit.ts` :
- `visitBurrow(burrowId, template, ownerId)` — visite generique (signal > loadScene fallback)
- `visitOwnBurrow(burrowId?)` — visite de son propre burrow avec resolution de preference
- `getOwnBurrows()` — liste les burrows du joueur local via `useUserData` store
- `getPreferredBurrowId()` / `setPreferredBurrowId()` — persistence localStorage du burrow prefere

### Format des room IDs burrow

```
"burrow:{uuid}:{subRoom}"
// Exemple: "burrow:c0fea8b7-f5e7-412a-b95b-9642a30395bb:0"
```

`subRoom` est toujours `0` pour les burrows standards. Pas de sous-rooms observees.

### Confirmation et timeout (fallback loadScene uniquement)

Applicable seulement quand le fallback `loadScene` est utilise (le signal natif gere ca en interne).

Le serveur peut silencieusement ignorer le `joinRoom` si :
- Le burrow n'existe pas
- Le joueur n'a pas le droit d'y acceder (privacy)
- Le burrow est dans un etat invalide

Dans ce cas, PAS d'erreur WS. Le client charge la scene visuellement mais reste dans la room precedente cote serveur → ecran noir fonctionnel mais pas de joueurs, pas d'interactions.

Detection de l'echec :
```js
const expectedRoom = "burrow:" + burrowId + ":0";
setTimeout(() => {
  if (app.currentServerRoomId !== expectedRoom) {
    // Echec : le serveur n'a pas confirme
    app.backToMainScene();  // Retour a la map principale
  }
}, 5000);  // JOIN_TIMEOUT_MS
```

Confirmation anticipee via WS listener :
```js
ws.addEventListener("message", (e) => {
  if (e.data.includes(expectedRoom)) {
    clearTimeout(timeout);  // Succes, annuler le timeout
  }
});
```

### Templates de scenes burrow

Les templates sont extraits du code source webpack (module 82380) au runtime :
```js
// Le code source contient un objet literal `ir={...}` avec tous les templates
// extractBurrowTemplates() parse ce code et stocke dans window.__sceneCache
```

Templates observes : ~12 templates (burrow-1, burrow-2, apartment-sm, etc.), chacun avec `fastTravelSpawnPosition`, `objects`, etc.

Si le template n'est pas dans le cache, fallback :
```js
FALLBACK_SPAWN = { x: 200, y: 200, direction: "left" }
FALLBACK_SCENE = { fastTravelSpawnPosition: FALLBACK_SPAWN, showMinimap: false, objects: [{ name: "Camera" }] }
```

### `backToMainScene()`

Methode sur `gameApp` qui ramene le joueur a la map principale. Utilise comme recovery quand un burrow visit echoue. Equivalent a cliquer "Leave" dans l'interface du jeu.

## Distinction local vs. autres joueurs

Le joueur local est AUSSI present dans `gameApp.players` avec `isLocal: true`.
Pour lister les autres joueurs : `Object.values(players).filter(p => !p.isLocal && !p.isBot)`.

`gameApp.localPlayer` est un objet SEPARE avec beaucoup plus de proprietes (collider, speed, handleCollisions, etc.). Voir `player-physics-internals.md`.

## Pieges connus

- `activeBurrow` peut exister MAIS etre `OWNER_ONLY` → verifier `privacyLevel`, pas juste `!!burrow?.id`
- `loadScene` pour un burrow prive ne cause PAS d'erreur — juste un ecran noir silencieux
- Les profils des joueurs qui quittent la room sont SUPPRIMES — pas de cache persistant des noms (sauf pour les amis via localStorage)
- `currentServerRoomId` sur gameApp peut avoir un delai de mise a jour apres `loadScene`
- Sur les maps populaires, `initOtherPlayers` peut contenir ~290 joueurs d'un coup
- `updateRoom` n'est emis que pour les joueurs du meme lobby (serveur), pas cross-lobby
