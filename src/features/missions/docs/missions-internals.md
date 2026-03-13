# Mission System Internals (lofi.town)

> Reverse-engineered le 2026-03-13 via inspection du store Zustand et du source webpack (module 56286).
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Acces au store

```js
const store = window.__stores.useMissionStore;
const state = store.getState();
```

Le store est un Zustand store capture par webpack-spy et expose sur `window.__stores.useMissionStore`.

## Structure du state

```
dailyMissions: MissionSetRaw       — missions daily actives
weeklyMissions: MissionSetRaw      — missions weekly actives
dailyMissionProgress: Record<string, number>   — progression indexee par mission key
weeklyMissionProgress: Record<string, number>  — progression indexee par mission key
progressMission(key: string, amount?: number): void  — incremente la progression
```

### MissionSetRaw

```
{
  id: string,              — UUID du set
  type: "DAILY" | "WEEKLY",
  startDate: string,       — ISO date
  endDate: string,         — ISO date
  missions: string[]       — tableau de CLES (pas d'objets)
}
```

Les cles sont des strings comme `"visit-friends-burrow"`, `"catch-10-fish"`, `"play-5-hours"`.
Les metadonnees (titre, recompense, seuil, progressKey) sont des constantes statiques dans le code du jeu (module 56286), reproduites dans `data/mission-database.ts`.

## Distinction cle mission vs progressKey

C'est le piege principal. Deux systemes de cles coexistent :

- **Mission key** : identifie la mission (`"catch-10-fish"`, `"play-5-hours"`). Utilisee dans `missions[]` et comme index dans `*MissionProgress`.
- **progressKey** : identifie le TYPE d'action (`"catch-fish"`, `"play-hour"`). Passee a `progressMission()`.

Plusieurs missions peuvent partager le meme progressKey (ex: `"complete-2-pomodoros"` et `"complete-15-pomodoros"` utilisent tous les deux `"pomodoro-complete"`).

```
state.dailyMissionProgress["catch-10-fish"]  → 7     // progression lue par mission key
state.progressMission("catch-fish", 3)                // progression ecrite par progressKey
```

NE PAS confondre : lire la progression avec le progressKey retourne undefined.

## progressKeys connus (11)

```
pomodoro-complete      — complete un pomodoro
play-minute            — jouer N minutes (daily)
play-hour              — jouer N heures (weekly)
emote                  — utiliser un emote
visit-friends-burrow   — visiter le burrow d'un ami
visit-public-burrow    — visiter un burrow public en ville
catch-fish             — attraper un poisson
sell-fish-for-coins    — vendre des poissons (montant en coins)
place-furniture        — placer un meuble dans son burrow
complete-task          — completer une tache (todo/pomodoro task)
catch-legendary-fish   — attraper un poisson legendaire
```

## Vecteur d'auto-completion

```js
const state = store.getState();
const remaining = mission.requiredAmount - currentProgress;
state.progressMission(mission.progressKey, remaining);
```

`progressMission` passe par le flow normal du jeu (Zustand action → update state → sync serveur).
Pas besoin d'appeler d'API REST. Le store gere la persistence cote serveur.

**Important** : `progressMission` retourne une `Promise` — c'est un appel REST asynchrone, pas une simple mutation Zustand locale. Le serveur est autoritatif sur la progression.

Alternative non utilisee : `POST /api/progressMission` avec Bearer token directement. Meme validation serveur, aucun avantage.

## Exploits testes et fermes (2026-03-13)

Tous les vecteurs ci-dessous ont ete testes en console. Aucun ne permet de farm des coins au-dela des missions du set actif.

### 1. Delta negatif (reset une mission completee)

```js
state.progressMission("catch-fish", -10)  // Promise fulfilled, mais...
// → Apres reload : progress revient a la valeur serveur (10/10)
```

Le serveur ignore les deltas negatifs ou clamp a la valeur courante. Pas de decrement possible.

### 2. Mutation directe du state Zustand

```js
const prog = { ...state.dailyMissionProgress };
prog["catch-10-fish"] = 0;
store.setState({ dailyMissionProgress: prog });
// → Changement visuel local uniquement. Reload restore les valeurs serveur.
```

Purement cosmetique. Le serveur ne recoit rien, il fait autorite au prochain fetch.

### 3. Progress hors-set actif (pre-farming)

```js
// "pomodoro-complete" n'est pas dans le set daily actuel
state.progressMission("pomodoro-complete", 2)  // Promise fulfilled, mais...
// → dailyMissionProgress ne contient aucune entree pour "complete-2-pomodoros"
```

Le serveur verifie l'appartenance au set actif. Pas de pre-farming de missions futures.

### 4. Race condition (spam concurrent pour doubler les rewards)

```js
// 20 appels concurrents sur une mission a 0/10, compte de test a 3000 points
const promises = Array.from({ length: 20 }, () =>
  state.progressMission("catch-fish", 10)
);
await Promise.all(promises);
// → Points AFTER: 3550. Gain: 550 (exactement 1x la reward)
// → Progress: {catch-10-fish: 10}
```

Le serveur ne credite la reward qu'une seule fois malgre 20 appels concurrents. Lock ou check idempotent cote serveur.

### 5. Vecteurs non testes (probablement fermes)

- **REST direct** (`POST /api/progressMission` avec payload custom) : meme validation serveur que via le store
- **Overflow** (montant enorme) : completerait la mission plus vite, mais c'est ce qu'on fait deja avec `remaining`

### Conclusion

Le systeme de missions est bien protege cote serveur. La seule exploitation viable reste l'auto-completion des missions du set actif (ce que fait notre feature). Pas de farm infini, pas de reset, pas de hors-set, pas de double reward.

### Store points

Les points (coins) du joueur sont dans `useUserData` :
```js
window.__stores.useUserData.getState().points  // ex: 36095
```

## Confetti

```js
window.__gameGlobals.signal.emit("confetti");
```

Signal bus du jeu. Declenche l'animation confetti native. Appele uniquement quand `completeSingle()` retourne true (mission effectivement completee, pas deja finie).

## Mission panel natif du jeu

Deux elements DOM :
- `#missions-button` — bouton collapsed (toujours visible)
- `#mission-log` — modal depliee (visible quand ouverte)

Caches via injection CSS `display: none !important` dans un `<style>` dedie.
React recree ces elements, donc `element.remove()` ne fonctionne pas durablement. Le CSS override est la bonne approche.

Toggle persiste dans localStorage via `saveData("missionHidePanel", hidden)`, restaure au demarrage HUD via `restoreMissionPanelHide()`.

## Refresh de la vue

Pas de `store.subscribe()` — cause des boucles infinies (subscribe → render → subscribe → ...).
A la place, `setTimeout(1500)` apres chaque action (force, complete all) pour laisser le store se mettre a jour avant de re-render.

Le timeout ne se declenche que sur action utilisateur (click), pas en boucle. Il verifie que l'element `#lt-mission-status` existe encore dans le DOM avant de re-render (guard contre les changements de page).

## Pieges connus

- `dailyMissions` est un OBJET `{id, type, startDate, endDate, missions}`, PAS un tableau. Acceder a `.missions` pour avoir les cles.
- `missions` contient des STRING keys, PAS des objets avec title/requiredAmount. Resolution via `MISSION_DB` statique.
- La progression est indexee par mission key dans le state (`dailyMissionProgress["catch-10-fish"]`), PAS par progressKey.
- `progressMission()` prend le progressKey en argument, PAS la mission key.
- `store.subscribe()` + render = boucle infinie. Ne pas l'utiliser.
- Les missions changent chaque jour/semaine (rotation serveur). Les cles inconnues sont gerees avec un fallback dans `resolveMission()`.
