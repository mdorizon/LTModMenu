# LTModMenu — Lofi Town Mod Menu

![LTModMenu Preview](https://raw.githubusercontent.com/mdorizon/LTModMenu/refs/heads/dev/LTModMenuPreview.webp)

Tampermonkey userscript mod menu for [Lofi Town](https://lofi.town/).  
Includes an automatic fishing bot, teleportation, waypoints, and detailed statistics.

> ⚠️ **Use at your own risk.** This mod menu may violate [Lofi Town's terms of service](https://lofi.town/) and could result in your account being banned.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) on your browser
2. Create a new userscript and paste the contents of [`ltmodmenu.user.js`](https://github.com/mdorizon/LTModMenu/releases/latest)
3. Go to [lofi.town](https://lofi.town/) — the menu appears automatically

---

## Features

### 🎣 Auto Fishing Bot

Fully automated fishing bot:

- Automatic detection and click of CAST and REEL buttons
- Automatic challenge resolution (FNV-1a algorithm)
- Result collection and popup closing
- Fishing fail blocking (prevents the server from registering fails)
- Continuous loop with humanized delays (100–200ms random)
- Smart timeouts (45s cast, 10s result)
- START/STOP button with session timer

### 📊 Fishing Statistics

Detailed tracking with auto-save every 30s via localStorage:

- Total fish caught
- Total gold earned (calculated from weight and rarity)
- Counters per rarity: Common, Uncommon, Rare, Epic, Legendary, Secret, Event
- Last fish caught (name, weight, rarity, gold, shiny)
- Shiny fish detection (x50 gold)
- Stats reset button

### 🗄️ Fish Database

54 species with min/max weight and base gold:

| Rarity    | Count | Examples |
| --------- | ----- | -------- |
| Common    | 12    | Bass, Cod, Shrimp, Lobster... |
| Uncommon  | 11    | Puffer Fish, Tuna, Seahorse... |
| Rare      | 7     | Goldfish, Koi Carp, Blobfish... |
| Epic      | 11    | Blue Lobster, Tiger Shark, Octopus... |
| Legendary | 10    | Golden Goldfish, Cthulhu, Megalodon... |
| Secret    | 7     | Goblin Shark, Ghost Shark, Barreleye Fish... |
| Event     | 12    | Halloween (Vampire Squid, Nessie...) + Christmas (Narwhal, Walrus...) |

### 🗺️ Teleportation

- **Fixed points of interest:** Fishing Spot (860, 380), Merchant (793, 198)
- **Custom waypoints:** save your current position with a name, teleport in one click, delete individually
- Server sync via WebSocket (position + direction)

### ⚙️ Player Actions

- **Sit** — forces the sitting animation
- **Force fish** — triggers the fishing animation at the current position
- **Stand** — returns to standing position (no cooldown)

---

## Interface

Draggable menu fixed on the left side of the screen with 4 sections:

1. **Saved Locations** — fixed POIs + custom waypoints
2. **Teleport Options** — waypoint management (add/delete)
3. **Player Actions** — manual actions (sit, fish, stand)
4. **Auto Fishing** — bot controls, timer, live statistics

Dark Lofi Town theme (navy + lavender), custom HabitSmall font.

---

## Keyboard Shortcuts

| Key | Action |
| --- | ------ |
| `1` | Open / close the mod menu |
| `2` | Previous item |
| `3` | Next item |
| `4` | Select / activate |
| `5` | Back |

> Shortcuts are disabled when a text input or textarea is focused.

---

## Contributors

<a href="https://github.com/mdorizon/LTModMenu/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mdorizon/LTModMenu" />
</a>
