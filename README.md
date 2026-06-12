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

- **Three table formats**: Solo 1v1, 4-player Free-for-All, and Paired Teams
  (2v2 — your AI partner sits opposite; team totals decide the showdown, but
  multiples never pool across layouts; partners may Lock each other's cards
  and never trade against each other).
- **Two deals**: Small Game (5 cards, 2–1–1 footprint, best 3 of 4) or House
  Deep Draft (9 cards, 2–2–1 footprint, best 3 of 5, leftovers dead).
- **Sovereign Honor scoring** (no betting): two-sided tables race the Pivot
  Marker by the net difference of each showdown; the Free-for-All table is a
  purse race where every seat banks its margin over the lowest hand each
  showdown. Match length selectable (10 / 20 / full 40).
- The table plays the **Bar-Level valuation** ("The Practical Common"). The
  engine supports all three regional value tables (House Games, Dock /
  Traveler); they will surface alongside the regional rule variants so the
  value shifts pair with actual rule changes.
- All four **Interaction Stones** — Red (Duplication), White (Lock), Blue
  (Exchange), Black (Disruption). All stones are placed in turn during the
  resolution phases; a Black Stone undoing a trade sends every riding stone
  home with its card.
- The **Rule of Rotation**: the Dealer Token passes after every hand.

### Rule interpretations made for the digital table

The source document leaves a few edges to the hosting venue; this table rules:

- A locked card cannot be targeted by *any* subsequent stone, from any player —
  and if either card of a trade is later locked, a Black Stone can no longer
  unwind that trade.
- One Red Stone per card.
- A Blue or Black Stone (or any stone with no legal target) may be set down
  without effect.
- The best 3-of-4 selection at showdown is computed automatically and shown with
  a full breakdown.

### Not yet at this table

The money variants (Fixed Purse, Raw Exchange) with betting, folds and
all-ins, and the regional house rules (Slumlock, Riverlock, Cursed Register).

## Files

- `index.html` — page structure and the rules reference
- `style.css` — the warm tavern-table look
- `game.js` — engine, AI, and UI (also loadable in Node for headless testing)
