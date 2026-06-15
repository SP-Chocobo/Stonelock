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

## Per-stone behaviour bound to a slot
- **Red** — the card that lands in this slot gets a phantom duplicate.
- **White** — the card that lands in this slot is locked (untouchable for later queue entries).
- **Blue** — swaps two **slots** (the cards that land there travel). Log records the swap
  AND which slot it was placed on (e.g., placed on their slot 2, swaps with your slot 4).
- **Black** — undoes the **last stone on its slot** (cancels the most recent prior queue
  entry on that slot). Cannot itself be undone.

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
