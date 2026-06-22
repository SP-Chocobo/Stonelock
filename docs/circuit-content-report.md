# Stonelock — The Circuit: content report

A snapshot of the current content in **The Circuit** (the roguelike mode) for
outside review. Pulled directly from the game's registries.

**The Circuit in one paragraph:** a seeded run of **3 acts**, each a branching
map of nodes you pick a path through to an act boss. You carry a small **deck**
of cards and a **pouch** of stones (both depleting draw piles). Fights are
two-sided attrition: each hand you win presses the opponent's **Standing** down,
each hand you lose presses yours. Empty theirs to clear a node; lose all of
yours and the run ends. Between fights you draft **charms** (relics), upgrade
stones, and spend coin at the shop.

---

## 1. Stones

The four base interaction stones (plus Green, normally a boss tool, now reachable
by the player via the Dark Pact event).

| Stone | Power | What it does |
|---|---|---|
| **Red Stone** | Duplication | Places a phantom duplicate on one of your cards. The phantom counts as a 2nd/3rd copy for a Pair/Triad bonus but scores no value itself. |
| **White Stone** | Lock | Protects a card. A locked card can't be altered, stolen, or neutralized for the rest of the hand. |
| **Blue Stone** | Exchange | Forcibly swaps one of your cards with an unprotected card in an opponent's layout. Visibility states stay as they were. |
| **Black Stone** | Disruption | Undoes the last stone effect on a card. Can't itself be undone. |
| **Green Stone** | Poison | Poisons a card: it scores nothing, joins no Pair/Triad, and any phantom on it dies. Only a White lock shields it. (Player-reachable only via the Dark Pact.) |

### Stone variants (the pouch upgrade track)

Stronger versions of a base colour, acquired by upgrading at the shop or the
Whetstone event. Circuit-only.

| Variant | Base | Power | What it does |
|---|---|---|---|
| **Twin Red** | Red | Double Duplication | Places TWO phantoms — enough to stand as a whole Triad on one card. |
| **Deadbolt White** | White | Double Lock | Locks your card AND an adjacent one — two cards shielded by one stone. |
| **Riptide Blue** | Blue | Undertow Exchange | Swaps like Blue, but sticky: a Black Stone only *downgrades* it to an ordinary swap; a SECOND Black is needed to actually unwind it. |
| **Onyx Black** | Black | Double Disruption | Undoes the last TWO stone effects on the table in one stone. |

---

## 2. Card modifiers (effects)

Riders on cards that shift a card's effective value or the board around it. They
appear on offered cards (rewards/shop), except **Wildcard**, which is granted
only by its charm and never found loose. 14 offerable + 1 charm-only.

| Modifier | Effect |
|---|---|
| **Anchor** | Always worth 2, whatever the venue pays. |
| **Keen** | +1 if you hold another card of its type. |
| **Lodestone** | +1 to the cards on either side of it. |
| **Drain** | The facing card in the same slot (opponent) reads −1. |
| **Sentinel** | +2 when placed on an end slot of your board. |
| **Harmony** | +1 for each other effect card you field (max +2). |
| **Bulwark** | +1 for each card beside it (rewards a packed interior). |
| **Siphon** | +1 to itself, and the facing card in the same slot reads −1. |
| **Gleam** | +2 — but only if it's your one and only effect card. |
| **Surge** | +2 if it would otherwise be worth only 1 here (lifts a low card). |
| **Gambit** | +3 to itself, but −1 to each card beside it — wants elbow room. |
| **Contrast** | +2 unless you field another card of its type (rewards a lone type). |
| **Ledger** | +1 for each plain (no-effect) card you field (max +2). |
| **Cantrip** | When you commit it, draw a card. |
| **Wildcard** *(charm-only)* | Counts as ANY type for a Pair or Triad — only on your side; a steal turns it inert. |

*Design note — deliberate mirror pairs:* Keen (reward a same-type twin) ↔ Contrast
(reward a lone type); Harmony (reward effect-dense board) ↔ Gleam/Ledger (reward
a lean/plain board); Lodestone (lift neighbours) ↔ Gambit (lift self, shave
neighbours); Drain/Siphon shave the facing opponent card.

---

## 3. Charms (relics)

Run-long passives, drafted from elite/boss spoils, the shop, and events. The
**Wildcard** is boss-only (never in shops/events/elite spoils).

| Charm | Effect |
|---|---|
| **Loaded Coin** | Your Coin cards are worth +1. |
| **Passage Toll** | Your Road and Ferry cards are worth +1. |
| **Whetstone** | Your effect cards are worth +1. |
| **Forger's Seal** | Your Pairs and Triads pay +1. |
| **Master Forger** | Your Triads pay +3 more. |
| **Floor Price** | None of your cards read below 2. |
| **Smuggler's Lining** | Draw one extra stone each hand. |
| **Iron Pouch** | Your stones ignore exhaustion. |
| **Hardened** | Your maximum Standing is +3. |
| **Field Surgeon** | Clearing a table heals +2 Standing. |
| **War Chest** | Clearing a table pays +5 score. |
| **First Blood** | The first card you play each hand reads +1. |
| **Strong Finish** | The last card you play each hand reads +2. |
| **Opening Gambit** | On the first hand of each table, your board reads +1. |
| **Spite Engine** | After a hand you lose, your board reads +1 the next hand. |
| **Momentum** | Each hand won in a row pays +1 score, stacking. |
| **Counterpunch** | The first hand they take from you each table, heal 2. |
| **Tithe** | Win a hand by 4+ and press 1 extra Standing. |
| **Crown Jewel** | Your single highest-value card reads +2. |
| **Even Keel** | Your lowest-value card reads +1. |
| **Full Satchel** | Draw one extra card each hand. |
| **Bracing** | Take 1 less Standing damage from a lost hand. |
| **Vigor** | Start each table at full Standing. |
| **Toll Keeper** | Each hand you win pays +2 score. |
| **Mulligan** | On a table's first hand, discard any number of cards and redraw that many. |
| **Cycle** | At the start of each hand, you may discard a card and draw one. |
| **Foresight** | See the next cards waiting in your draw pile. |
| **Foul Play** | At the start of each hand you may discard a card to make your opponent discard one at random. |
| **Resonance** | Every third stone you place at a table, recover 1 Standing. |
| **Wildcard** *(boss-only)* | Choose one of your cards when taken — it counts as ANY type for a Pair/Triad. Falls inert if stolen. |

---

## 4. Map nodes

The map reads by KIND only — the opponent's identity and exact strength stay
hidden until you sit down. Acts are **9 columns**: a soft duel opener, branching
middle columns, a Repose before the boss, then the boss. No elites or shops in
the first two columns. Each act guarantees ~2 shops and 3+ Reposes, scattered.

| Node | Role |
|---|---|
| **Duel** | A standard fight. |
| **Elite** | A harder fight — the foe carries charms. |
| **Boss** | The act's master (×1.5 Standing); beating act 3's wins the run. |
| **Repose** | Rest & refit: heal, thin a card, thin a stone, or move a modifier (pick one). |
| **Shop ("The Fence")** | Spend coin on cards, stones, charms, stone upgrades, a heal, or a one-off card thin. |
| **Encounter** | A random event (see below). |

### Encounter events

Rolled when an Encounter node is entered (gated by what you currently hold).

| Event | What it offers |
|---|---|
| **A Traveler's Cache** | Take one card from a small spread, or leave it. |
| **The Whetstone** | Upgrade one held base stone to its variant, free. |
| **A Crooked Trade** | Give up a stone of your choice; receive a fixed random one. |
| **The Pawnbroker** | Pawn one charm for a different random one (refusable). |
| **An Ambush** | Stand and fight a bonus duel for spoils, or pay Standing to slip past. |
| **A Windfall** | A flat 10–15 coin find. |
| **The Blood Price** | Bleed for coin, the pot growing each round (cut N costs N Standing, pays 2N−1 coin); cumulative, stop whenever. |
| **A wandering merchant** | An Encounter that turns out to be a pop-up shop. |
| **A Dark Pact** *(rare)* | Permanently sacrifice ~30% of max Standing to gain a Green Stone. Gated to healthy runs; refusable. |

---

## 5. Economy & tuning (current values)

| Setting | Value |
|---|---|
| Acts × columns | 3 × 9 |
| Starting / max Standing | 20 / 20 |
| Damage cap per hand | 6 |
| Node-clear heal | +7 |
| Foe Standing | base 8 + 0.8 per tier; Elite ×1.25, Boss ×1.5 |
| Draw / place stones per hand | 3 drawn, 2 placed |
| Coin: Duel / Elite / Boss | 4 / 8 / 12 |
| Shop: card / stone / charm / upgrade | 6 / 5 / 12 / 9 |
| Shop: heal (+6) / thin a card | 5 / 8 |
| Deck floor (can't thin below) | 6 cards |
| Venues (rotate by tier) | Tavern, Docks (Riverlock), Slums (Slumlock), Hall (Cursed Register), Court (stones-first), Academy (no telegraph/thin) |

*Balance reference:* an all-AI "floor bot" on a varied build clears the full run
~40% of the time, with most deaths in act 1 — i.e., a non-trivial but reachable
gauntlet for a neutral pilot (a skilled human should do better).
