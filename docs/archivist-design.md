# The Archivist — 4th raid boss / campaign capstone (design note)

Status: **design only, not built.** Captured for when the raid campaign is built out.
Slots into `RAID_BOSSES` (4th entry); the unlock ladder picks it up automatically.

## Concept
An archivist keeps records in order. The fight is about **sequence and priority**:
you commit your stones *before* your cards, and they resolve in the order they were
placed. It is the sequencing-mastery boss — the natural final exam for the Academy's
Strategy track. Feel: "program your stones, then watch them execute" (RoboRally-ish).

## Inverted loop
Normal Stonelock: commit cards → place stones on cards.
Archivist: **select stones → place stones into empty slots → commit cards → stones
resolve, in placement order.**

- Both sides select stones first; the Archivist gets a few extra (like the other bosses).
- Stones are placed onto **empty slots** (positions, not cards). Slots already have
  positional names — Foundation I / Foundation II / The Veil / Final — used by the log.
- Then players commit cards into the slots, seeing the full queue.
- Then the queue **resolves in the order stones were first placed.**

## Resolution model (decided)
- **Place-all-then-resolve**, not iteratively. Effects are NOT applied as placed.
- **Placements are OPEN** (shown on slots + in the stone log). Keeps Stonelock's
  "telegraph in the open" identity; avoids a fog-of-war that an extra-stone boss would
  dominate. Tension comes from the *committed order*, not hidden information.
- After cards commit, an **animated resolution playout** runs the queue **in the tier's
  direction** (see Difficulty); the stone log highlights each entry as it **fires or
  fizzles**. Forward order looks like standard real-time resolution (no surprises);
  reverse is where fizzles bloom.
- One engine, one model at every tier: identical placement/log UX, only the playout
  *direction* changes. Skill = win the **order war**: place key stones for priority,
  read the queue, commit cards around it.

## Difficulty = resolution order (the boss's signature)
The Archivist reads its records forward on the lower tiers and **backward** on Hardcore.
- **Easy / Standard — forward order:** stones resolve in placement order, standard
  interaction logic. Intuitive; difficulty still scales via the boss's extra stones.
- **Hardcore — reverse order:** the queue resolves last-placed-first. Interactions flip
  and fizzle in non-obvious ways — a true sequencing brain-bender.
- Worked example (lock vs swap): queue **White on slot 2**, then **Blue swap 2↔their 4**.
  - Forward: lock slot 2 → the swap hits a locked slot and **fizzles** (card stays).
  - Reverse: swap resolves first (slots trade) → then White locks slot 2 (the swap
    **succeeds**). Same two stones, opposite result.

## Making the card phase matter (avoid trivial matching)
Risk: if the game hands the player the fully-resolved final board, committing cards
becomes trivial matching (junk into the doomed slot, value into the doubled one) — no
decision. Fix WITHOUT hiding placements (which would break open/fair + bully via the
boss's extra stones):
- **Open placements, but NOT pre-resolved.** Show the ordered stone log (the inputs) and
  the un-resolved stones sitting on slots. The player must *read the queue* to deduce
  where cards end up, then commit. Misreading is the punish. (Reverse order makes this
  read genuinely hard.)
- **Cards stay veiled as usual.** Swaps move cards *across layouts*; a swap into a veiled
  boss slot trades for an unknown value — so even a perfect sequencing read still carries
  a card-value gamble (Stonelock's existing hidden-info tension, routed through swaps).
- Net: card commitment = "read the queue + bet on the veils," not a lookup.

### Difficulty ramp (combines order + how much is shown)
- **Easy:** forward order **+ resolved preview** (training wheels — learn what the queue does).
- **Standard:** forward order, **no preview** (you compute it).
- **Hardcore:** **reverse** order, **no preview** (compute it backwards).

### Balance (decided)
- **Hard reuses Standard's stone budget** — it is "a wtf version of normal," differing only by
  reverse resolution, not by more stones. So **tune only Easy and Standard**;
  Hard = Standard budget + reverse. Targets vs competent white/order-aware party bots:
  **Easy ~65–75%, Standard ~45–55%.**

### Balance battery findings (`tests/archivist-balance.js`, synthetic — directional)
A headless harness drives full co-op hands with order-aware bots through the REAL
scoring (`bestSelection`/`twoBestHands`) and the REAL `resolveArchivist`. Confirms the
mechanic functions end-to-end and the score responds sanely to the knobs. Key results:
- **Stone count PLATEAUS** ~59–62% party past boss=7: the party's two white-locked
  hands can't be ground down by volume. So *don't* tune with stones alone.
- **Boss BOARD SIZE is the dominant lever** (raises its two-best ceiling). 7→8 cards
  moved Easy(boss=6) from ~64% → ~51%. This is the knob that reaches 50% on Standard.
- **Reverse (Hard)** costs the party ~3–4 pts vs forward at the same budget.
- **Positioning matters** (forward = last-placed resolves last = uncounterable final say;
  the boss keeps the last word. Reverse flips it — first-placed resolves last).
- **Chosen starting config** (synthetic party-win): tune the *board size* per tier, not
  just stones:
  - **Easy** — boss board **7**, **6** boss stones, forward → ~64%.
  - **Standard** — boss board **8**, **7** boss stones, forward → ~50%.
  - **Hardcore** — boss board **8**, **7** boss stones, **reverse** → ~46%.
- These are SYNTHETIC (bespoke bots, single-hand compare). Wire at this config, then
  **re-tune against the real raid AI + multi-hand target ledger**, exactly as the
  Apothecary was dialed in.

### CORRECTED-FLOW tuning (SHIPPED — supersedes everything below)
The first live wiring committed cards *first* then placed stones — backwards. The
correct inverted flow is **stones onto empty slots first (blind), THEN cards
committed into the slots** reading the open queue, with commitment **interleaved
round-the-table** so neither side gets a clean last look. Re-measured all-AI:
- Board size is a cliff: **6 cards ≈95% party, 7 ≈50-60%, 8 crushes** → every tier
  fields **7**.
- Stone count plateaus and the boss's *blind* placement is weak, so the easy↔std
  spread is narrow; both sit ~50-60%.
- **REVERSE is the real teeth** — at 6 stones, ~49% forward drops to ~34% reverse,
  because the party's forward-order card reads betray them.
- The boss's stone budget is a weak lever (blind-stone plateau: 2-3 stones ≈ std
  at 5). A tried-and-rejected idea — having the boss play its **2nd-best** commit
  on Easy — *backfired* (boss got stronger ~42%), because its greedy commit is
  myopic and 2nd-best noise dodges greedy traps. So Easy instead hands the **party
  a bigger stone budget** (resource scaling, like the other bosses ease via stone
  counts), and Hardcore keeps REVERSE as its teeth.
- Shipped ladder (all 7-card board):
  - **Easy** — party **5** stones each vs boss **3**, forward → ~**76%**.
  - **Standard** — party 3 vs boss **6**, plus a light boss-2nd-best `sub`=0.15,
    forward → ~**44%**.
  - **Hardcore** — party 3 vs boss **6**, **REVERSE** → ~**34%**.
- `sub` is a counter-intuitive lever: making the boss commit its 2nd-best card→slot
  *strengthens* it (its greedy commit is myopic, so the 2nd choice avoids greedy
  traps) — a fine downward dial on party win. `ARCH_SUB` overrides it.
- Resolution is an **animated playout**: the queue fires one stone per ~0.85s beat,
  each frame an engine-resolved prefix (always engine-true), pending markers
  clearing into real stones as they land. Reverse fires last-placed-first.
- Knobs env-overridable (`ARCH_E_C/_S/_P`, `ARCH_S_*`, `ARCH_H_*`, `ARCH_SUB`).
  Numbers all-AI/full-knowledge; a human reading the open ledger may differ.

### (Historical) Live tuning of the BACKWARDS cards-first flow — do not use
Once wired into the real engine and measured all-AI over a target race
(`tests/archivist-live.test.js` for function; an all-AI race for balance), the boss
was **far stronger** than the synthetic harness predicted — the multi-hand race
amplifies a per-hand edge, and the live boss two-best from a wide board dominates. Board
size proved a steep cliff in the live game too (8 cards ≈ 9% party, 7 ≈ 59%, 6 ≈ 94% at
mid stone counts), so **every tier fields a 7-card board** and the stone budget +
a probabilistic **hold-back** fine-tune the curve. The shipped ladder (the player's
chosen shape — Easy and Standard share 5 stones, Standard just drops the mercy):
  - **Easy** — 7 cards, **5 stones, ~50% hold-back**, forward → ~**78%** party.
  - **Standard** — 7 cards, **5 stones, no hold-back**, forward → ~**57%** party.
  - **Hardcore** — 7 cards, **6 stones, no hold-back, REVERSE** → ~**29%** party.
All knobs are env-overridable (`ARCH_E_C/_S`, `ARCH_S_C/_S`, `ARCH_H_C/_S`, `ARCH_HB`)
for further tuning. Numbers are all-AI, full-knowledge; a human reading the open ledger
may fare differently — adjust by play.

### Build order (for the next session — de-risked)
1. **Pure resolution engine** (DONE, see `resolveArchivist` + tests): takes slot cards + an
   ordered placement queue + direction, returns resolved slots with fizzles. Unit-tested
   forward/reverse incl. lock-vs-swap and black-undoes-last-resolved. No UI.
2. Engine → scoring adapter (resolved slots → {type,hasRed,poisoned} for bestSelection/twoBestHands).
3. Raid flow: phases Selection → Placement(on slots) → Commitment(cards to slots) → Resolution playout → Showdown.
4. Human UI: place a chosen stone on an empty slot; commit a card to a chosen slot; the stone log.
5. Boss AI for the inverted flow; Easy reference map; forward/reverse by tier.
6. Tune Easy/Standard; add to RAID_BOSSES only after a full automated playthrough passes.

## Per-stone behaviour bound to a slot
- **Red** — the card that lands in this slot gets a phantom duplicate.
- **White** — the card that lands in this slot is locked (untouchable for later queue entries).
- **Blue** — swaps two **slots** (the cards that land there travel). Log records the swap
  AND which slot it was placed on (e.g., placed on their slot 2, swaps with your slot 4).
- **Black** — undoes the most-recently-**resolved** stone on its slot, *at the moment
  Black itself resolves* (resolution order, NOT placement order). Order-agnostic and
  self-consistent: forward it counters the stone placed just before it; reverse it
  counters the stone placed just after it. Cannot itself be undone.
  - Example, Red→Black→Blue on one slot: **forward** Black counters Red (Blue applies);
    **reverse** Black counters Blue (Red applies). Same queue, opposite outcome — this is
    why reverse-order Hardcore is a real brain-bender.

## Rules / constraints
- **Advanced (open) targeting is mandatory** for this boss — cross-layout slot swaps
  require it (forced on, like Slumlock forces exhaustion).
- A **persistent stone log** is required, viewable at all times: ordered list of
  placements (stone · slot · who · swap details), and the live highlight during the playout.

## Engine work required (this is the biggest of the four bosses)
The current engine targets *cards* and resolves each stone *immediately on placement*.
The Archivist needs:
1. **Slot-bound stones** — target empty positions, not cards.
2. **Deferred resolution** — queue placements, resolve after cards commit.
3. **Ordered playout** — execute the queue in placement order, with fizzle handling.
4. **The stone-log UI** — always-visible ordered record + resolution highlight.

## Open questions (resolved unless noted)
- Resolution: place-all-then-resolve, open placements. ✓
- Blue swaps slots; Black undoes last stone on slot. ✓
- Advanced targeting mandatory. ✓
- Global vs per-player timeline: **global** (one shared order across you, ally, boss) is
  the intended, richer version — confirm at build time.
- Whether you may queue onto the boss's slots (full positional war) vs only your own —
  leaning **full positional war** (open targeting); confirm at build time.
