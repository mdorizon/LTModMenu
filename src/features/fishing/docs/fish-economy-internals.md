# Fish Economy Internals (lofi.town)

> Reverse-engineered le 2026-03-16 via inspection console + interception WS/API sur app.lofi.town.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Inventaire poissons

Stocke dans le store Zustand `useUserData` :

```js
const { fishInventory, points } = window.__stores.useUserData.getState();
// fishInventory: array d'objets poisson
// points: gold actuel du joueur
```

### Structure d'un poisson en inventaire

```
{
  id: string,          // UUID unique du catch
  name: string,        // nom de l'espece (ex: "Salmon", "Billy Bass")
  weight: number,      // poids en kg
  isShiny: boolean,    // variante shiny (x50 gold)
  // autres champs probables: createdAt, userId — non utilises
}
```

Source : champs observes dans `fishing-result` WS event et confirmes via `fishInventory` en console.

## API de vente

### POST /api/sellFish

```
URL:     https://app.lofi.town/api/sellFish
Method:  POST
Auth:    Bearer {accessToken}   — depuis useUserData.getState().accessToken
Body:    { fishIds: string[] }  — array d'UUIDs de poissons
```

Reponse succes :
```json
{ "goldToGain": 1234 }
```

- Accepte un batch de N poissons en un seul appel (pas de limite observee)
- Le serveur calcule le gold cote serveur — le montant retourne fait foi
- 401 si token invalide/expire
- Les poissons vendus sont retires de l'inventaire cote serveur

Apres vente, mettre a jour le store local :
```js
store.setState({
  points: currentPoints + goldToGain,
  fishInventory: inventory.filter(f => !soldIds.includes(f.id))
});
```

### Fish Shop in-game

```js
// Ouvre l'UI native de vente (modal PixiJS/React)
window.__gameApp.onShowFishingInventory("sell");
```

## Calcul du gold (client-side, indicatif)

Le serveur fait le vrai calcul. Formule client pour estimation :

```
baseGold = FISH_DATA[name].baseGold
ratio = clamp((weight - minWeight) / (maxWeight - minWeight), 0, 1)
gold = round(baseGold * (0.8 + ratio * 0.7))
if shiny: gold *= 50
```

- Le poids influence le gold de 80% a 150% du baseGold
- Shiny = multiplicateur x50 (observe, confirme)
- `FISH_DATA` : 132 especes avec baseGold, minWeight, maxWeight, rarity

## Rarete

Tiers observes dans le client (module fish data) :

```
common      — gris, baseGold faible
uncommon    — vert
rare        — bleu
epic        — violet
legendary   — orange, baseGold eleve
secret      — rouge (ex: "Billy Bass")
halloween   — event saisonnier (probas a 0 hors event)
christmas   — event saisonnier (probas a 0 hors event)
```

`halloween` et `christmas` sont des rarites a part entiere dans la DB du jeu (pas un flag).
Les probas de drop de ces tiers sont a 0 quand aucun event n'est actif — impossible d'en pecher hors saison.

## Fishing Frenzy

Event temporaire (~15 min) ou la peche est instantanee (pas d'attente pour le bite).

```
WS event:  fishingFrenzyUpdate  S→C  periodic
Payload:   { focusedMinutes, goalMinutes, isFrenzyActive: bool, frenzyEndsAt: timestamp }
```

- NE donne PAS de poissons event — les poissons peches sont normaux
- Simplement skip le temps d'attente entre cast et bite
- Declenche quand la communaute atteint le goalMinutes de focus collectif

## Pieges connus

- `goldToGain` dans la reponse API est le montant TOTAL du batch, pas par poisson
- Le store `useUserData` contient `points` (gold), pas `gold` — ne pas confondre
- `fishInventory` est un array plat, pas pagine — peut etre volumineux
- Le jeu ne rafraichit PAS `fishInventory` automatiquement apres vente via API directe — il faut `setState` manuellement
- Token JWT expire : fallback sur `window.__wsAuthToken` capture dans le WS hook
- Limite de taille du batch `fishIds` cote serveur : aucune erreur observee, a confirmer
- Champs exacts de `fishInventory[n]` au-dela de id/name/weight/isShiny : a confirmer via console
- Comportement si on envoie un `fishId` deja vendu : probablement ignore, a confirmer
