# Stonelock

*A Game of Regional Leverage, Point Optimization, and Tactical Wills* — a playable,
browser-based adaptation of the card-and-stone game from the novel.

You are not building a rigid recipe; you are **seizing assets**. Commit cards to the
table across three deployment phases, telegraph your Interaction Stones, thin them to
two, and warp the board — duplicate your high cards, lock your assets, or steal
straight out of your opponent's layout — before the showdown flips every veiled card.

## Playing

Open `index.html` and you land on the **title screen** — Start Game, Tutorial,
or Rules. The guided **tutorial** walks one full hand, spotlighting each piece
of the UI as it comes up. In a match, the sidebar **Menu** button returns to the
title (with a confirmation so you don't lose a game by accident).

No build step and no dependencies — open `index.html` in any modern browser.

Or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also hosts cleanly on GitHub Pages (Settings → Pages → deploy from branch).

## This version

- **Raid Boss — The Magistrate**: a co-op fight reached from the title's Raid
  Boss button. You and an ally (bot or co-op hotseat) play the standard game;
  the Magistrate is one boss who fields a larger face-up board (seven cards),
  telegraphs from a deep three-of-each pouch, answers every move and keeps the
  last word, and scores its two best non-overlapping hands. Every action is
  taken in turn, so the boss's board and picks reveal as you play. Your two
  scores combine; the marker moves by (party − Magistrate) and the boss holds
  any tie. Difficulty sets the boss's stone count — Easy (5) / Standard (6) /
  Hardcore (7) — measured against a greedy team at roughly 80% / 45% / 30%.
- **Hotseat play**: two humans on one device — duel, allied 2v2, or rival 2v2
  with AI partners — with name entry and a pass-confirmation screen guarding
  hidden information between turns.
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
- **The Academy Gauntlet** venue replaces telegraphing and thinning with a
  pure-interaction drill: every player holds one of each stone and places all
  four in serpentine turn order, free to choose which stone and target each
  round.
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
- A Red Stone's phantom counts toward **structure only**: it can stand as the
  second or third copy for a Pair or Triad bonus, but scores no regional value
  of its own (per "build toward a Pair or Triad *flat bonus*").
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
