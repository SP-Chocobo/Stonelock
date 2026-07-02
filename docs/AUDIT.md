# Stonelock — Fable Audit Handoff (Lens A complete + supervisor-verified; Lenses B/C partial — token budget cut them short; their salvage reports (if any) appended at bottom)

> Adversarial audit, Fable session 2026-07-02. Read-only: **no fixes applied.**
> Execution is for a follow-up (Opus) session. Every "CONFIRMED-BY-REVIEWER"
> finding was independently re-verified against source by the supervising
> session, not just taken from the agent.

## Lens A — Rules-lawyer (scoring & stone resolution) — LANDED

### A1. 2v1 co-op foe scored without effect values (evalue) — HIGH, CONFIRMED-BY-REVIEWER
- `coopShowdown` (game.js ~3005-3012) maps the foe board as `{type, hasRed, poisoned}` — **no `evalue`** — while `showdown()` (~2897) gives every other seat `evalue`. The foe *by design* fields 6 fx cards (`COOP_FOE_FX`, line 966; concat at 7397).
- Impact both directions: foe's keen/anchor/lodestone don't score (foe weaker than displayed badges); party's drain/siphon against the foe don't reduce it (foe stronger in that direction).
- **Fix**: add `evalue: c.evalue` to the foe map (applyCardEffects already ran in showdown()).
- **⚠ REBALANCE TRAP**: the 2v1 foe was difficulty-tuned WITH this bug — fixing strengthens it (its 6 fx cards now score). After fixing, re-measure party clear rate and likely soften `coopFoeMult` (1.3) or drop a foe charm (`matchedset`). Measurement recipe below.

### A2. Drain/Siphon hit the ALLY's board in 3-seat co-op — MED-HIGH, CONFIRMED-BY-REVIEWER
- `EFFECTS.drain.cross` / `EFFECTS.siphon.cross` (~2113, ~2137) decrement `boards[j][i]` for **every** j ≠ ownerBoard. Blurbs say "the facing card" (singular, opponent).
- In coop (3 boards): player's Drain shaves the ally's same-slot card; the foe's Drain shaves BOTH party boards (−2 from a card promising −1). Party sel DOES use evalue, so this is real scoring, not display.
- **Fix**: in both `cross` loops, also skip same-team boards — `boards` is seat-indexed (`applyCardEffects` = `G.players.map(p => p.board)`, line 2370), so `teamOf(j) === teamOf(ownerBoard)` → skip. No behavior change in duel/ffa (all seats oppose); fixes coop; future-proofs teams.
- Fix together with A1 and re-measure once (they interact).

### A3. Black "unwinding a trade" after a chained re-trade teleports cards — MED, CONFIRMED-BY-REVIEWER
- `charge()` blue branch (~1981-87) calls `swapCards(prev.give, prev.take)` which swaps the two cards **wherever they currently sit** (`swapCards` reads `a.owner`/`b.owner` at undo time, ~2016). If an endpoint was re-traded first, "unwinding" fabricates a brand-new trade with a third seat; the log still claims "every stone ... travels home."
- Repro (FFA): You Blue A↔B (P1). P2 Blue C↔B (B now on P2). Black on A → A lands on P2's board (never party to trade 1).
- **Fix approach (design decision)**: record origin seats (or origin board slots) on the blue event at creation; undo returns each card to its *origin* if currently unlocked, else fizzle per lock rules. Alternative: invalidate the undo (fizzle) if either card has moved since (cheaper, arguably cleaner rule: "the trail has gone cold"). Either way, update log text to match. Add a regression test with the chained-swap repro.

### A4. Circuit Act 3 (Court/precedence) silently strips variant stones, Dark Pact Green, and duplicate draws — MED, CONFIRMED-BY-REVIEWER
- `active` build (~1041): stone-first venues take `STONE_KEYS.filter(pool[c] > 0)` — a base-color SET. Circuit Act 3 is ALL court venues (`CIRCUIT_ACT_VENUES[3] = ['court']`). So bought upgrades (Riptide/TwinRed/Deadbolt/Onyx), Dark Pact Green, and duplicate colors are unplaceable for the whole final act — while `pileDrawStones` still consumes them from the pouch.
- **⚠ NOT the one-liner it looks like**: the slot engine (`resolveArchivist` ~419, `archQueueStone`, slot targeting) branches on base colors and does NOT understand variant keys or green. Admitting variants into the stone-first flow means teaching the slot engine each variant's resolution (riptide stickiness, onyx double-undo, deadbolt adjacency, twin double-phantom) — real design work.
- **Cheaper interim options** (pick one): (a) at stone-first Circuit tables, draw converts variants to their base color for that fight (log it: "the Court recognizes only the old forms"), so nothing is dead — upgrades merely revert at Court tables and the player is told; (b) diversify Act 3 venues so Court isn't every fight. Full variant support in the slot engine can then be a scheduled feature, not a hotfix.

### A5. Warden rules text contradicts code — MED (doc), CONFIRMED (agent-traced, quotes exact)
- Rules modal (index.html ~476): "every stone spent — yours and its — is exhausted"; code (`consumeActive` ~1884, `bossKeepsPouch`) exempts the boss, and the in-game log + flavor say party-only. Fix the Rules modal line (code is the intended design per two other sources).

### A6. Slumlock exhaustion never applies to variant stones/Green — LOW-MED, CONFIRMED (agent-traced)
- `consumeActive` (~1889) records the variant KEY in `G.slum`; the pool rebuild subtracts blocked counts only over `STONE_KEYS` (~1024-26, 1892-94) so variant keys never match. Upgraded stones ignore Slumlock at Act 2 tables (unearned advantage).
- **Fix**: record/match by `stoneBase(key)` — but ensure the rebuild blocks the right entry (blocking base color when a variant was spent: decide whether exhaustion pins the variant key or its base; simplest consistent rule: exhaust the exact key spent, and make the rebuild subtract by exact key from the multiset).

### A7. Black can undo a Green live; slot engine forbids it — LOW (inconsistency), CONFIRMED (agent-traced)
- `undoableEventFor` (~2027) lets green events be undone (charge() has an explicit green branch ~1988); `resolveArchivist` + STONES.green desc say only a White set in time defends. Narrow reachability (only a human undoing their own Dark-Pact green off a foe card). **Design call**: either make greens un-undoable live (matches printed rule) or amend the Green desc. Recommend matching the printed rule (greens un-undoable) for consistency.

### A8. Onyx behavior vs description — LOW, CONFIRMED (agent-traced)
- Desc says "last TWO effects on the table"; code undoes last-on-target-card + global-latest-excluding-first (~1996-2002, `nextUndoableEvent` excludeId). Also can never downgrade-then-unwind a single Riptide (excludeId blocks the second charge on the same event) though Riptide's desc promises "a SECOND Black" works — currently unreachable (foes never hold Riptide). **Fix**: decide intended semantics, then align desc or code; cheapest is desc rewrite ("undoes the last effect on the target, then the latest other effect on the table").

### A9. Stale text — LOW, trivial
- game.js:8-9 header comment: FFA banks margin "over the runner-up" → code+rules say "over the lowest hand". Fix comment.
- `raidShowdown` (~2991): "Dead level… the marker doesn't move" logged on a tied sudden-death hand where the marker then moves by dir*sudden. Gate the line on `sudden === 0` or reword.

### Verified clean by Lens A (do not re-litigate)
bestSelection (phantom/poison/wild/cursed/riverlock edges incl. twin-red one-card triad), twoBestHands (exhaustive, not greedy), apothecaryCut inputs (fx/variants unreachable in campaign), Sudden Death math (no wrong-direction moves; monotone escalation; tie→boss), locked-trade rule, Deadbolt/TwinRed undo semantics, Quartermaster denial symmetry, Riptide downgrade chain, FFA margin banking (0/1/3/5 matches modal).

## Lens B — State-mutation coupling — PENDING (agent in flight)

## Lens C — State-machine / soft-locks — PENDING (agent in flight)

## Supervisor-verified items (from the interim inline pass, both lenses' scope)
- runTimer lifecycle CLEAN: only `setTimeout(run)` is via runTimer (1396); cleared at newGame 718, run 1379, showTitle 3389, tutorial 3802/3853.
- Handler guards: hard guards on humanConfirmDeploy (queue head + count), humanChooseStone (mode), humanPickCommitCard (mode + hand membership). humanToggleCard (1626) & humanDeclare (1615) lack mode guards but are attach-time-gated (onclick only attached while mode allows; KB.refresh() re-gathers after every render). LOW: add one-line mode guards as defense-in-depth during modularization.

## Measurement recipe for the A1/A2 rebalance (Opus: use this, not makeCircuitEvent)
Crib circuit.test.js:495-520 EXACTLY, but skip `makeCircuitEvent()` (probabilistic — a naive loop rolls 0 rival events; supervising session hit this). Construct directly:
```js
M.seedRng(seed); M.startCircuit(); const cg = M._gauntlet();
cg.act = 2; cg.allies = ['The Ferryman'];
const foe = ['The Lady','The Miner','The Stranger','The Tinker'][seed % 4]; // act-2 named cast
const pool = M.circuitAllyDraftPool();
cg.deck = M.TYPES.slice().concat(pool.slice(8,12));
cg.pouch = { red:2, white:2, blue:1, black:1 }; cg.standing = cg.maxStanding;
const allyDeck = []; for (const t of M.TYPES) { allyDeck.push(t, t); }
for (let i = 0; i < 8; i++) allyDeck.push(pool[i]);
cg.allyDeck = allyDeck; cg.allyPouch = { red:3, white:3, blue:2, black:2 };
const node = { type:'event', col:3, idx:0, coop:true, foe };
cg.curNode = node;
M.circuitSetupCoopFight(node, 'The Ferryman', foe);
const G = M._state(); G.humans = [];
let guard = 0; while (!G.over && guard++ < 12000) { if (!G.queue.length) M.nextHand(); else M._run(); }
// win = cg.tableCleared, loss = cg.groundOut
```
Run K≈150 pre-fix and post-fix. Pre-fix baseline TBD by Opus (supervising session's script had the makeCircuitEvent flaw — numbers not banked). Target: keep party clear rate in the previously-tuned band; adjust `coopFoeMult` (1.3) or drop `matchedset` from `COOP_FOE_CHARMS` if the fix pushes it more than ~10 points.

## Suggested execution order for the fix session
1. A9 + A5 (text-only, zero risk)
2. A1 + A2 together, with the measurement before/after + rebalance
3. A6 (small, clear semantics) + regression test
4. A3 (pick fizzle-if-moved vs origin-tracking; test the chained-swap repro)
5. A7/A8 (design calls — confirm with owner, then align)
6. A4 (interim mitigation now; full variant support in slot engine as scheduled work)

---

## Lens B — State-mutation coupling — SALVAGE REPORT (token-cut; findings as traced)

### B1. "Run it again" always replays seed 0 — MouseEvent passed as seed — HIGH, CONFIRMED-BY-REVIEWER
- game.js 6505 & 8095: `next.onclick = startCircuit` — the click passes the MouseEvent; `startCircuit(seed)` (5551-58) does `(seed != null) ? (seed >>> 0)` → MouseEvent >>> 0 = **0**. Every "Run it again" (victory AND defeat screens) replays the identical seed-0 run — same offers, map, foes, AI rolls — and banks "seed 0" into records.
- Correct wiring exists at 5604 (`() => startCircuit()`), proving intent. **Fix**: wrap both handlers in `() => startCircuit()`. Trivial + high player impact.

### B2. Seeded Circuit RNG leaks into a resumed non-run match — MED, CONFIRMED (agent-traced)
- startCircuit seeds the RNG at the intro (5557-58) before any fight; quitting the Circuit intro back to title and resuming a paused custom duel leaves the global `_rng` seeded — the plain match's deals become deterministic (violates newGame:720's own "non-run matches use true randomness"; clearRng only fires in newGame for non-gauntlet).
- **Fix**: clearRng() in showTitle/circuitQuit, or seed only at circuitBegin (first fight), or clearRng in resumeMatch.

### B3. New match from in-game Menu during a Circuit fight leaves GAUNTLET.active + stale HUD — MED, LIKELY
- newGameBtn (8319) → openSetup → newGame never clears GAUNTLET.active / #circuitHud (writers: showTitle 3393, circuitEnd, circuitVictory only). Stale Standing HUD paints over the new custom match; abandoned run records nothing.
- **Fix**: in newGame (non-gauntlet path): GAUNTLET.active = false + hide circuitHud (or route newGameBtn through the same abandon path as showTitle).

### B4. Pending SUDDEN DEATH flash survives into a replacement match — LOW, CONFIRMED (cosmetic, self-heals ≤2s)
- flashSuddenDeath timer/element not cleared by showTitle/newGame. **Fix**: clear suddenFlashTimer + hide #suddenFlash in both.

### B5. Academy puzzle stamps GAUNTLET.puzzle outside any run — LOW, SPECULATIVE (latent; currently shielded by showTitle abandoning runs).

**Lens B verified clean**: newGame/startHand rebuild G and UI wholesale (no per-match/per-hand leaks: exhaustHands, cursedType, archQueue, slum, pendingStone/blueOwn all safe); GAUNTLET rebuilt wholesale in circuitBegin; ally piles cleared defensively; charm couplings gated on G.gauntlet; circuitHandResult early-returns on !g.active; resumeMatch restores backdrop/music/.sudden correctly; KB gated by liveBoard(); non-runTimer async callbacks are idempotent paints (drawMapEdges guards isConnected).

---

## Lens C — Hand-loop soft-locks — SALVAGE REPORT (token-cut; findings as traced)

### C1. Variant stone keys crash renderControls mid-render — MED-HIGH, CONFIRMED-BY-REVIEWER
- renderControls 4442/4451: `stoneHasValidTarget(UI.pendingStone)` switches on base colors only (2051-68) → variant keys ('twinred','deadbolt',…) fall to default **false** → `noTargets` true even with valid targets → `STONES[UI.pendingStone].name` **TypeError** (STONES lacks variant keys — that's what getStone() is for).
- Every human selection of an upgraded stone for targeting throws in render: mouse limps through (board affordances wired before the throw) but KB.refresh is skipped (keyboard nav dies until next full render), and the UI wrongly offers "Set it down without effect".
- **Fix**: `stoneHasValidTarget(stoneBase(UI.pendingStone))` + `getStone(UI.pendingStone).name`. Two-line fix; add a variant-key render test.

### C2. Pause/resume during arch-commit re-inflates UI.commitLeft — MED, CONFIRMED-LOGIC (needs pause mid-step)
- promptHuman 'archcommit' (1567-72) recomputes `commitLeft = min(step.count, hand.length)` from the FULL step count on every re-prompt; humanCommitToSlot only decrements the UI counter (step carries no progress). Pause (title) after committing 1 of 2, then Continue → required to commit 3 for a 2-card step; can steal cards from the later veiled step (face-up cards that should be veiled) or, on the final step, outrun the empty slots → **hard soft-lock** (renderControls has no 'arch-commit' branch: no Back/skip).
- **Fix**: store progress on the step (e.g. step.done count), or derive commitLeft from empty-own-slots/step remainder; add an 'arch-commit' Back affordance.

### C3. 'target-green' mode has zero affordances — LOW-MED, CONFIRMED but LATENT
- humanChooseStone 1740-42 can set UI.mode='target-green', but decorateTarget has no green branch (nothing .targetable) and renderControls has no green case (no Back/skip) → guaranteed soft-lock IF a human ever holds a live green in the main loop. Currently unreachable (greens are boss-only/puzzle-only; Circuit rewards exclude green) — but one config line away. **Fix**: add the green branch (own-board unlocked targets + skip), or hard-guard humans out of green.

### C4 (fragile invariant, not a bug): Crucible declare margin is exactly zero — pool 8 − 2 denied − 3 exhausted = 3 for 3 declares. Any future +1 to party stones or exhaustion makes a human face a declare with an empty tray and no pass affordance. Note in tuning docs.

**Lens C verified clean**: every step type covered by exactly one of stepNeedsHuman/executeStep in every template (no unpromptable steps); empty-pool declare unreachable in shipped configs; target-black/blue/white always have skip affordances (for BASE keys — see C1); 'place' with empty active auto-skips; G.over mid-queue drains safely (no double showdown, nextHand branches on G.over); resume re-invokes promptHuman for all step-level modes (only intra-step counters are lossy — C2); hotseat pass screen blocks KB and review peeking.
**Not fully traced (out of budget)**: multi-human deploy out-of-order fill-in veil privacy of step.choices during pass renders; pause mid-archresolve dynamic steps.

---

## Consolidated fix priority (all three lenses)
1. **B1** seed-0 "Run it again" (trivial fix, high player impact)
2. **A1+A2** co-op scoring (evalue + cross-team) — with the rebalance measurement
3. **C1** variant-key render crash (two-liner + test)
4. **B2** RNG leak, **B3** GAUNTLET/HUD leak, **C2** arch-commit counter (small, clear fixes)
5. **A5/A9/B4** text & cosmetic
6. **A3** trade-unwind semantics, **A6** slumlock variants, **C3** green affordances, **A7/A8** consistency calls (design decisions)
7. **A4** Act-3 variant stones (interim mitigation now; slot-engine variant support as scheduled work) — NOTE: C1 and A4 are the same root theme (variant keys unhandled outside the happy path); fix as a family.
