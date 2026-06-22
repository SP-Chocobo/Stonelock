# Stonelock

*A Game of Regional Leverage, Point Optimization, and Tactical Wills* — a playable,
browser-based adaptation of the card-and-stone game from the novel.

You are not building a rigid recipe; you are **seizing assets**. Commit cards to the
table across deployment phases, spend your Interaction Stones, and warp the board —
duplicate your high cards, lock your assets, or steal straight out of an opponent's
layout — before the showdown flips every veiled card and the best three count.

## Playing

Open `index.html` and you land on the **title screen**. No build step and no
dependencies — it runs in any modern browser, and hosts cleanly on GitHub Pages
(Settings → Pages → deploy from branch).

Or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Modes

- **Standard Game** — a single table. Solo 1v1, 4-player Free-for-All, or Paired
  Teams (2v2). Pick how many seats are real players (hotseat on one device);
  bots fill the rest. Two deals: Small Game (5 cards) or House Deep Draft (9).
- **The Circuit** — the roguelike run (see below).
- **Campaign** — the raid bosses: one oversized opponent you and an ally face
  down across a longer match (see below).
- **The Academy** — a guided tutorial that walks one full hand, spotlighting each
  piece of the UI, plus the pure-interaction Gauntlet drill.
- **The Regulars** — the table personas and their habits.
- **Rules** — the full reference.

## The Circuit

A seeded roguelike run: three **acts**, each a branching **map** of nodes you
pick a path through to an act boss. You carry a small **deck** of cards and a
**pouch** of stones — both depleting draw piles that reshuffle when dry — and
press each opponent's **Standing** to zero while protecting your own (a
two-sided attrition; there is no point target). Win a fight, lose Standing on a
lost hand, and the run ends when your Standing is gone — or when you conquer all
three act bosses.

- **Node kinds** read by glyph on the map (the opponent's identity and exact
  strength stay hidden until you sit down across from them):
  - **Duel / Elite / Boss** — fights. Elites and bosses carry charms and hit harder.
  - **Repose** — rest and refit: heal, thin a card, thin a stone, or move a modifier.
  - **Encounter** — a random event: a card **Cache** (take one), a **Whetstone**
    (upgrade a stone to its variant), a **Crooked Trade** (give a stone, take a
    random one), the **Pawnbroker** (swap a charm for a random one), an **Ambush**
    (fight for spoils or pay Standing to slip past), a **Windfall** (free coin),
    or the **Blood Price** (bleed escalating Standing for escalating coin).
  - **Shop — The Fence** — spend the coin you win from fights on cards, stones,
    charm relics, stone upgrades, a heal, or a one-off card thin.
- **Charms** are run-long relics drafted from elite/boss spoils, shops, and
  events — value boosters, economy levers, and trick effects (Mulligan, Cycle,
  Foul Play, Resonance, and more). The rarest, **Wildcard**, is a boss-only
  relic: it imbues one card to count as *any* type for a Pair or Triad.
- **Stone variants** upgrade a base stone's power: **Twin Red** (two phantoms),
  **Deadbolt White** (locks two cards), **Riptide Blue** (a sticky swap a single
  Black only downgrades), and **Onyx Black** (undoes the last two effects).
- A **Records & Compendium** screen tracks your best runs and everything you've
  discovered — charms, modifiers, and stone variants.

## Campaign — the raid bosses

Co-op fights against a single oversized opponent. You and an ally (bot or hotseat)
play the standard game; the boss fields a larger board, draws from a deep pouch,
and scores its two best non-overlapping hands. Your two scores combine and the
marker moves by (party − boss); the boss holds any tie. The roster:

- **The Magistrate** — a wide, methodical face-up board. Never bluffs.
- **The Warden** — spends without mercy and exhausts every stone *you* play,
  while its own pouch never runs dry.
- **The Apothecary** — keeps a Green Stone for the last word, cutting your best
  unlocked card to nothing. Lock what matters before the scalpel falls.
- **The Quartermaster** — locks away one stone colour from the whole table each
  hand, cycling red → white → blue → black.
- **The Archivist** — a slot-mode duel: stones are placed onto empty slots first
  and resolve in order; then you fill the slots with cards.
- **The Crucible** — the all-layers fight that combines the others' tricks.

Difficulty sets the boss's stone count (Easy / Standard / Hardcore).

## The stones, cards, and scoring

- **Interaction Stones** — Red (Duplication / phantom), White (Lock), Blue
  (Exchange / steal), Black (Disruption / undo the last effect on a card). A
  Black Stone undoing a trade sends every riding stone home with its card.
- **Effect cards** carry a rider that shifts a card's effective value or the
  board around it — Anchor, Keen, Lodestone, Drain, Sentinel, Harmony, Bulwark,
  Siphon, Gleam, Cantrip (these appear in the Circuit; Wildcard is charm-only).
- **Sovereign Honor scoring** (no betting): two-sided tables race the Ledger
  Stone by the net difference of each showdown; the Free-for-All table is a
  purse race where every seat banks its margin over the lowest hand.
- **Venues** carry regional value tables and house rules: the Roadside Tavern
  (baseline), the River Docks (**Riverlock** — field a Road or Ferry or lose 2),
  the Slum Tables (**Slumlock** — a placed stone is exhausted for two hands), the
  Gambling Hall (**Cursed Register** — one card type is voided each hand), the
  Academy Gauntlet (no telegraph or thinning — place all four stones in turn),
  and the Court of Precedence (**stones placed first**, onto empty slots, then
  cards).

### Rule interpretations made for the digital table

- A locked card cannot be targeted by *any* later stone, from any player — and if
  either card of a trade is later locked, a Black Stone can no longer unwind it.
- A Red Stone's phantom counts toward **structure only**: it can stand as a second
  or third copy for a Pair or Triad bonus, but scores no value of its own.
- One Red Stone per card (a Twin Red variant places two phantoms).
- A stone with no legal target may be set down without effect.
- The best three-card selection at showdown is computed automatically and shown
  with a full breakdown (effect modifiers included).

## Files

- `index.html` — page structure and the rules reference
- `style.css` — the warm tavern-table look
- `game.js` — engine, AI, and UI (also loadable in Node for headless testing)
- `tests/` — Node test suites (`node tests/*.test.js`) and the Circuit balance
  battery (`K=120 node tests/circuit-battery.js`)
- `docs/` — design notes (`roguelike-design.md`, `archivist-design.md`)
