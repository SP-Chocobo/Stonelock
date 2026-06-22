# The Circuit — content direction & roadmap

**Guiding principle (from design review):** the framework is feature-complete.
Stop adding *systems*; add *memorable content*. The test for any new piece:

> "Is this closer to **+1 value**, or closer to **Dark Pact**?"

Runs should become emotionally different, not just mathematically different —
content players retell ("I got the boss relic early"), not stat padding.

Do **not** expand foundational systems (Standing, deck/stone building, relics,
routing, shops, events, bosses, venues) unless a real problem emerges.

---

## Shipped (this pass) — draft-identity layer

The cheapest, all-upside layer: build-around content that gives a draft a
direction, via existing registry hooks (no new systems).

**Build-around modifiers**
- **Echo** — +2 while it carries a Red phantom (built to be duplicated).
- **Contraband** — +3 in the Slums, 0 in the Court, normal elsewhere (a venue gamble).
- **Runesmith** — +1 per upgraded stone in your pouch, max +3 (rewards the variant track; ties cards to stones).

**Transformational / cursed charms**
- **Last Stand** — while at ≤5 Standing, your whole board reads +1 (a comeback engine).
- **Reckless Wager** — board reads +1 every hand, but you take +1 more Standing from a lost hand (high-variance).

---

## Shipped (boss relics) — signature drops by persona

Each act boss reveals its persona at the table, so beating it offers **a choice
of three relics: its signature, a random charm, or a Wildcard** (pick one).
Signatures are boss-only and only offered by their own persona, so they're rare
and create a run narrative ("I beat the Ferryman, I got River King's Toll").
- **River King's Toll** (Ferryman) — Road & Ferry count as the same type for Pairs/Triads.
- **Motherlode** (Miner) — each Red phantom you field scores +1.
- **Iron Verdict** (Clerk) — your first card committed each hand begins Locked.
- **Sovereign's Favor** (Lady) — your locked cards read +2 (pairs with Iron Verdict / White / Deadbolt — a lock build).

All nine regulars now have a signature relic:
- **Matched Set** (Tinker) — your Pairs pay +3 (a wide/pairs build).
- **Highwayman's Cut** (Wagoner) — cards you steal with Blue read +2 (a steal build).
- **Following Sea** (Deckhand) — the hand after a win, your board reads +2 (a momentum presser, mirror of Spite Engine).
- **Second Wind** (Old Hand) — the first time your Standing would break each act, survive at 1 (a clutch death-save — a real *moment*).
- **Veilwalker** (Stranger) — each hand, one of the opponent's veiled cards is revealed to you (fires when the foe commits face-down, once per hand).

Each is boss-only and offered only by its own persona, so a full set of nine
gives every act boss a distinct, build-defining prize.

## Shipped (puzzles) — authored stone-placement riddles

A rare node (1 per act, never the first two columns). A puzzle is a fixed board
(your cards + a rival board, both able to carry **modifiers** shown with real
effect math — a Drain pulling your card down, a Lodestone propping neighbours
up) and a set of stones. You get **3 guesses**; each guess is one stone→target
line. Outcomes are **authored, not computed** — a response table maps each
meaningful placement to specific flavor + a `solve` flag, so a puzzle plays out
exactly as designed. Solve and the reward scales by guess (1st a relic, 2nd a
stone upgrade, 3rd gold); a miss costs 2 Standing; you may walk away.

Authoring is pure data in `PUZZLES`:
```
key: { name, flavor, venue, you:[...cards], foe:[...cards], stones:[...],
       responses: { '<stone>@you0': {text, solve?}, 'blue@you2>foe0': {...} },
       miss: { text } }            // cards may be 'Coin' or { type:'Ferry', fx:'drain' }
```
Backlog: author a real set of tight puzzles; **mirror Academy-safe ones into
the Academy** (the resolver/screen are mode-agnostic; `puzzleAcademySafe()`
flags puzzles that avoid Circuit-only stones); optional multi-step (sequence)
puzzles; relic/upgrade reward icons.

## Backlog (prioritized) — bigger moments

### 1. Act themes (NEXT — locked in)
See section below.

### 2. Cursed relics needing a scoring lever
- **Fractured Seal** — Pairs pay +3, Triads score 0 (go wide). Needs `pairAdd` +
  `triadZero` opts in `bestSelection`.
- **Blood Ledger** — one-time: +15 coin, −1 max Standing. Needs a charm `onGain`
  hook (would also let us retire the Wildcard "owed-imbue" invariant hack).

### 3. Run-altering events (permanent, not transactional)
- **The Collector** — destroy a card; future card rewards offer one fewer option. (run-state flag)
- **The Archivist** — *copy* a modifier from one card onto another (vs. the current *move*).
- **The Duelist** — fight an elite now for a rare relic. (reuses ambush→fight plumbing)

### 4. More build-around modifiers
- **Martyr** — if poisoned, adjacent cards +2. (needs a reliable enemy poison source to matter)
- (others as archetypes emerge — keep each a *direction*, not a number.)

### 5. Act themes (run identity by location)
Make acts feel distinct so a player knows where they are at a glance:
- **Act 1** — gentler: simpler foes, more Reposes/healing.
- **Act 2** — resource pressure: more Elites, fewer Reposes.
- **Act 3** — strange: more Encounters and relics, boss mechanics.
Implementation: act-aware weights in `rollNodeType` / `buildAct` and the
guaranteed-node placement. Bounded, but re-check the balance battery after.

---

## Notes / cautions
- Each new piece should pass the Dark Pact test; prefer replacing a flat +N
  charm over adding another one.
- Boss relics and act themes are the biggest identity levers but carry the most
  balance/structure risk — gate them behind battery runs.
- Keep the AI honest: a new value hook is read by the estimate via the resolved
  `evalue`; anything that changes *targeting* or *structure* needs matching AI
  awareness (see Wildcard's fog handling as the pattern).
