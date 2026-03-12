# Player Physics & Collision Internals (lofi.town)

> Reverse-engineered le 2026-03-12 via console devtools sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Pipeline de mouvement

Le mouvement du joueur est gere dans `moveLocalPlayer`, appele chaque frame par le ticker Pixi.js :

```js
// Source decompilee (minifiee, renommee pour lisibilite)
moveLocalPlayer(deltaTime) {
  if (!this.input) return;
  let {x: dx, y: dy} = this.input.movement;
  let speed = this.speed;
  let rawInput = this.input.getRawInputMovement();
  let adjustedDelta = this.handleCollisions({x: speed * dx * deltaTime, y: -speed * dy * deltaTime});
  if (adjustedDelta.x !== 0 || adjustedDelta.y !== 0) {
    this.setPosition({x: this.currentPos.x + adjustedDelta.x, y: this.currentPos.y + adjustedDelta.y});
    // ... animation, minimap, camera update
  }
}
```

Points cles :
- `this.speed` : vitesse de base du joueur (scalaire). Multiplier cette valeur = speedhack.
- Le delta de mouvement est passe a `handleCollisions()` qui retourne le delta AJUSTE.
- Si `handleCollisions` retourne `{x:0, y:0}`, le joueur ne bouge pas.
- `setPosition()` applique la position finale.

## handleCollisions

```js
// Source decompilee
handleCollisions(delta) {
  let currentRect = {
    x: this.collider.x + this.currentPos.x,
    y: this.collider.y + this.currentPos.y,
    width: this.collider.width,
    height: this.collider.height
  };
  let proposedRect = {
    x: currentRect.x + delta.x,
    y: currentRect.y + delta.y,
    width: currentRect.width,
    height: currentRect.height
  };
  let adjusted = {...delta};
  // Itere sur les objets de la scene (rd.instance.interactableColliders ou similaire)
  // Pour chaque objet : checkCollision + checkAxisCollision + isMovingTowardCollider
  // Ajuste `adjusted.x` et/ou `adjusted.y` pour empecher le chevauchement
  return adjusted;
}
```

Signature : `(delta: {x, y}) => {x, y}`
- Input : le deplacement voulu ce frame
- Output : le deplacement autorise apres resolution des collisions
- Noclip : remplacer par `(delta) => delta` (passthrough, aucune collision)

## Collider du joueur

```js
localPlayer.collider = {x: -9, y: -12, width: 18, height: 24}
```

- `x, y` : offset relatif a `currentPos` (le collider est centre autour du joueur)
- `width, height` : taille du hitbox
- Mettre `width=0, height=0` desactive les collisions hitbox MAIS pas les collisions tilemap/grille gerees dans handleCollisions

## checkCollision (AABB)

```js
// Source exacte (non minifiee, c'est deja court)
checkCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
```

Simple test de chevauchement rectangulaire. Retourne `boolean`.
Avec un collider de taille 0, ce test retourne toujours `false` (impossible d'avoir `a.x < b.x` ET `a.x > b.x` en meme temps).

## checkAxisCollision

Signature : `(currentRect, delta, proposedRect, obstacleRect) => adjustedDelta | null`
- 4 arguments
- Retourne `null` si pas de collision, ou un objet delta ajuste
- IMPORTANT : remplacer par `() => false` crash car `moveLocalPlayer` ne l'appelle pas directement — c'est `handleCollisions` qui l'utilise en interne

## isMovingTowardCollider

```js
// Source exacte
isMovingTowardCollider(playerRect, delta, obstacleRect) {
  return (
    (delta.x > 0 && playerRect.x + playerRect.width <= obstacleRect.x) ||
    (delta.x < 0 && playerRect.x >= obstacleRect.x + obstacleRect.width) ||
    (delta.y > 0 && playerRect.y + playerRect.height <= obstacleRect.y) ||
    (delta.y < 0 && playerRect.y >= obstacleRect.y + obstacleRect.height) ||
    this.checkCollision(playerRect, obstacleRect)
  );
}
```

Verifie si le joueur se dirige VERS l'obstacle (optimisation pour ignorer les obstacles derriere).

## doCollisionInteractions

```js
doCollisionInteractions() {
  if (this.currentSeatId) return; // skip si assis
  let rect = {x: this.currentPos.x + this.collider.x, ...};
  // Itere sur rd.instance.interactableColliders
  // Detecte les interactables proches et met a jour lastCollidedInteractable
}
```

Gere les interactions (portes, objets cliquables) quand le joueur les touche. Appele separement de handleCollisions.

## Positions du joueur

```
localPlayer.currentPos   — {x, y} position courante (utilisee par le rendu)
localPlayer.parent       — {x, y} position Pixi.js du container (= currentPos en pratique)
localPlayer.serverPos    — {x, y} derniere position envoyee/recue du serveur
localPlayer.oldPos       — {x, y} position du frame precedent
localPlayer.direction    — "up" | "down" | "left" | "right"
localPlayer.speed        — nombre, vitesse de base (~2-3)
```

Pour teleporter proprement, il faut mettre a jour les 4 positions + envoyer `clientUpdatePosition` via WS.
Voir `doTP()` dans `src/features/teleport/teleport.ts`.

## Scene et donnees de collision

```js
window.__gameApp.currentScene = {
  name: "main",              // nom de la scene courante
  fastTravelSpawnPosition: {x, y, direction},
  showMinimap: true,
  clampZoom: ...,
  zones: [...],              // zones de la map (spawn, transitions)
  objects: [...]             // objets de la scene (meubles, decorations, interactables)
}
```

La scene ne contient PAS de collision layer explicite. Les collisions sont gerees par les `objects` de la scene qui ont des colliders individuels, iteres par `handleCollisions` via `rd.instance` (singleton de gestion de scene).

## Autres joueurs

```js
window.__gameApp.players   // Record<string, OtherPlayer> — joueurs sur la map
```

Chaque `OtherPlayer` :
```
id: string
currentPos: {x, y}
direction: string
isBot: boolean
isLocal: boolean           — true pour le joueur local (aussi dans .players)
currentSeatId?: string     — id du meuble si assis
sitAnimation?: string
```

Les noms des joueurs ne sont PAS dans `gameApp.players`. Ils viennent des events WS :
- `initOtherPlayers` — envoye a la connexion, contient `playerStates[].profile.displayName`
- `playerJoinedRoom` — contient `profile.displayName`
- `playerDisconnected` / `playerLeftRoom` — id du joueur qui part

Stockes dans `window.__playerProfiles` (Map<string, {displayName, username}>).

## Approches de hacking testees

### Noclip (FONCTIONNE)
`lp.handleCollisions = (delta) => delta`
- Court-circuite TOUTE la logique de collision
- Pas de crash, format de retour respecte
- Au disable : faire un `doTP(currentX, currentY, dir)` pour ancrer la position, sinon le joueur se fait ejecter

### Noclip via collider zero (PARTIEL)
`lp.collider.width = 0; lp.collider.height = 0`
- Desactive les collisions hitbox (checkCollision retourne toujours false)
- MAIS ne desactive pas les collisions tilemap/grille dans handleCollisions
- Certains objets bloquent encore

### Noclip via noop handleCollisions (CRASH)
`lp.handleCollisions = () => {}`
- Crash : `moveLocalPlayer` attend un retour `{x, y}`, recoit `undefined`
- `Cannot read properties of undefined (reading 'x')`

### Noclip via remplacement checkAxisCollision (CRASH)
`lp.checkAxisCollision = () => false`
- Meme crash : le retour est utilise dans handleCollisions qui attend un objet ou null

### Speed hack (FONCTIONNE)
`lp.speed = originalSpeed * multiplier`
- Trivial, `moveLocalPlayer` utilise `this.speed` directement
- Sauvegarder `originalSpeed` au premier appel pour pouvoir reset

## Pieges connus

- Toucher a `handleCollisions` ou `checkAxisCollision` sans respecter le contrat de retour crash le jeu immediatement (erreur dans le ticker Pixi.js, spam console)
- Les methodes de collision sont sur l'INSTANCE du joueur, pas sur le prototype
- `doCollisionInteractions` est safe a noop (void, pas de valeur de retour utilisee)
- Le joueur local est AUSSI dans `gameApp.players` (avec `isLocal: true`), a filtrer dans les listes
- Les API REST du jeu (`/api/*`) retournent 401 depuis le client — auth Supabase server-side uniquement
- Pas de moyen cote client de connaitre les joueurs sur d'autres maps ou la liste d'amis
