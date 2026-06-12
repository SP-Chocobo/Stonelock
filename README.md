# Stonelock

*A Game of Regional Leverage, Point Optimization, and Tactical Wills* — a playable,
browser-based adaptation of the card-and-stone game from the novel.

You are not building a rigid recipe; you are **seizing assets**. Commit cards to the
table across three deployment phases, telegraph your Interaction Stones, thin them to
two, and warp the board — duplicate your high cards, lock your assets, or steal
straight out of your opponent's layout — before the showdown flips every veiled card.

## Playing

No build step and no dependencies — open `index.html` in any modern browser.

Or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also hosts cleanly on GitHub Pages (Settings → Pages → deploy from branch).

## This version

- **Solo 1v1** against an AI opponent ("The Stranger"), Small Game rules: 5 cards
  dealt, a 2–1–1 table footprint, best 3 of 4 scored.
- **Sovereign Honor scoring** (no betting): the Pivot Marker shifts by the net
  difference of each showdown; push it the full distance to win. Match length is
  selectable (10 / 20 / full 40).
- All **three regional valuations** are selectable at the table: Bar-Level
  ("The Practical Common"), House Games ("The Sovereign Ledger"), and Dock /
  Traveler ("The Fluvial Exchange").
- All four **Interaction Stones** — Red (Duplication), White (Lock), Blue
  (Exchange), Black (Disruption) — including immediate Black Stone reactions and
  stones traveling home with an unwound trade.
- The **Rule of Rotation**: the Dealer Token passes after every hand.

### Rule interpretations made for the digital table

The source document leaves a few edges to the hosting venue; this table rules:

- A locked card cannot be targeted by *any* subsequent stone, from either player.
- One Red Stone per card.
- A Blue or Black Stone (or any stone with no legal target) may be set down
  without effect.
- The best 3-of-4 selection at showdown is computed automatically and shown with
  a full breakdown.

### Not yet at this table

House/team format (9-card deep draft), the money variants (Fixed Purse, Raw
Exchange) with betting, folds and all-ins, and the regional house rules
(Slumlock, Riverlock, Cursed Register).

## Files

- `index.html` — page structure and the rules reference
- `style.css` — the warm tavern-table look
- `game.js` — engine, AI, and UI (also loadable in Node for headless testing)
