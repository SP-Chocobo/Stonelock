# Stonelock — Roguelike Run Mode (design note)

Status: **design only, not built.** A working draft capturing a long design
brainstorm. Sections marked **(decided)** are leaning commitments; **(open)**
marks forks that are the designer's call before building. Written to be
self-contained so an outside reader (or future-me) can follow it and give
feedback.

> **Review round 1 (incorporated below).** Several outside reviews are folded in;
> this section is the digest. Detail lives in the cited sections.

### Resolved from feedback
- **Protected pillar #0 — Regional leverage.** Venues reshaping card values per
  fight is the load-bearing mechanic; it's what stops the run from collapsing to
  a solved "best deck steamrolls everything." Every future system is judged
  against *"does this preserve or weaken regional leverage?"* (§2)
- **Fail-state = Standing-as-HP, with damage-shaping.** Margin is the damage; but
  cap/diminish margin past a threshold so one ugly hand can't both lose the table
  *and* gut the run. (§3)
- **Card deck = full owned deck.** Clean ownership; venues are the balance anchor.
  (§6.4)
- **White stays absolute vs the standard card pool;** only the Lockpick stone
  variant, boss mechanics, and rare effects crack it. No common card invalidates
  a lock. (§6.7)
- **Cut FFA from the first run** (keep for hotseat / later event node) — it
  changes the win-con shape and adds targeting noise. (§4, §11)
- **Seeded RNG moves to the *top* of Phase 1** (before the map UI); retrofitting
  determinism later is a nightmare. (§9)
- **Position effects split into Phase 3b**, after mirror/adjacency/slot density
  actually exist and are legible. (§9, §6.6)

### New findings & additions
- **⚠ Venue-value finding (the #1 risk, now measured).** The code has only three
  value economies (bar/house/dock). Tabulated, **Road (3/2/3) and Ferry (2/2/3)
  never drop below 2 in any economy** — they are "good everywhere," exactly the
  decks that bypass regional leverage. The other six types each hit 1 somewhere.
  *Before Phase 2, differentiate the value tables so every type has a dead (1)
  region* — otherwise a Road/Ferry deck is the predicted solved meta. (§2)
- **The AI loophole.** An owned deck lets players build conditional combo engines;
  an ally/opponent that *evaluates* those will choke a brute-force search. Hard
  rule: AI-held effects resolve via **scripted conditional primitives**, never a
  search over player-made combinations. (§8)
- **Green is the likely break-out optimization target** once it's player-stackable
  (not just the boss scalpel). Watch duplicate/recursion/Green-focused pouches
  from day one. (§6.7)
- **Ally equipping has real opportunity cost** (shared inventory — gearing the
  merc means *not* gearing yourself), and the merc is a **retention/ownership**
  feature ("my Old Hand"), tracked in the Run Chronicle. (§5.4)
- **Run Chronicle** — a tiny end-of-run record (name, distance, boss, ally,
  signature stone, memorable play) so losses generate *stories*, not just
  restarts. New §7.5.

### Still open (empirical — answered by building/playtest, not argument)
- Does Phase 0 prove the match is fun 10–15× in a row? (the gate)
- Is the AI good enough under repeated play?
- Exact damage-shaping curve for Standing-as-HP.
- Owned-deck draw model: *full* vs *hybrid* fallback if full strays from the
  base feel (§6.4).
- The venue-value rebalance numbers (§2) once the dead-region rule is applied.

---

## 0. Why this exists

The campaign is a *finite* ladder: break six bosses, unlock venues, done — a
demo's worth of content, not a game's worth of retention. To stand on its own
(Steam Next Fest, etc.) Stonelock needs a **"why am I still playing" loop.** For
a card game the genre-fit answer is a **run-based / roguelike mode**. This note
specs that mode using the systems that already exist.

Other things also stand between here and a Steam release — wrapping the web app
in Tauri/Electron + Steamworks, a store page and trailer, save robustness, and
AI-generated-art disclosure — but those are production/platform work, not design.
This doc is the design.

---

## 1. The base game, in brief (context)

- Cards are **8 types** (Bread, Coin, Road, Sword, Ferry, Quill, Crest, Chain)
  with **values that shift per venue**. Scoring is **best 3** of your fielded
  cards; matching types pay a **Pair (+2)** or **Triad (+6)**.
- **5 interaction stones**: Red (phantom duplicate), White (lock — untouchable),
  Blue (forced swap/trade), Black (undo the last stone effect), Green (poison —
  the boss scalpel). Stones are telegraphed, then spent.
- Cards commit across phases, some **face-up**, some **veiled** (face-down,
  hidden until the showdown) — so bluffing and reading hidden info matter.
- A match is a **ledger race**: each showdown moves a marker by the net score
  difference; drive it the full distance to win.
- **Venues** = regional value sets + house rules (Riverlock, Cursed Register,
  Slumlock, the Gauntlet, the Court of Precedence's stone-first inverted loop).
- **Slot mode** (Court / Archivist / Crucible): stones are placed onto **slots**
  first; nothing fires until all are down; the ledger resolves in placement
  order — or **reverse** on the hardest tier. Position = resolution timing. This
  is the most distinctive mechanic in the game.
- The **Regulars** are the bot cast, each with personality leans.

**The base-game identity to protect:** cards drawn from a *shared value
substrate*, stones as the *only* interaction — teachable in 90 seconds.
Campaign/Standard keep this. The **run** elevates it (owned deck + stone pouch +
effect cards, §2); the run is allowed to be complex, the base game must stay
clean.

---

## 2. The thesis (decided)

The distinctive hook, and the thing almost no other deckbuilder has:

> **You build two interlocking decks — a Card deck *and* a Stone pouch.** The
> cards are the bodies you field; the stones (and effect cards) are the leverage
> that bends them. The run lets you add, remove, upgrade, and stamp *both*.

Most card games have a single card deck. Stonelock's signature is the **second,
parallel build layer** — the stone pouch — sitting alongside the cards. Both are
owned and built through the run.

**What keeps it Stonelock and not a generic deckbuilder — PROTECTED PILLAR #0:**
venues still reshape card values per fight, so your owned deck has **no fixed
power level — it is strong where its types are valued and weak where they
aren't.** A deck tuned for the River Docks struggles at the Sovereign Court.
That preserves *regional leverage* (the game's subtitle) inside an owned deck.
This is the single mechanic doing the most work in the whole design; judge every
future system against *"does this preserve or weaken regional leverage?"*

> **⚠ Finding — this pillar is not yet safe (measured from the code).** There are
> only three value economies (`REGIONS`: bar / house / dock). Tabulating every
> type across them:
>
> | Type | bar | house | dock | ever low (1)? |
> |---|---|---|---|---|
> | Bread | 3 | 1 | 2 | yes (house) |
> | Coin | 3 | 1 | 3 | yes (house) |
> | **Road** | 3 | 2 | 3 | **no — floor 2** |
> | Sword | 2 | 1 | 2 | yes (house) |
> | **Ferry** | 2 | 2 | 3 | **no — floor 2** |
> | Quill | 1 | 3 | 1 | yes |
> | Crest | 1 | 3 | 1 | yes |
> | Chain | 1 | 3 | 1 | yes |
>
> **Road and Ferry never drop below 2 in any economy** — they are "good
> everywhere," precisely the deck that bypasses regional leverage. The reviewers'
> #1 worry is real and located. **Before Phase 2: differentiate the value tables
> so every type has at least one dead (value-1) region** (or add run-specific
> economies). With 3 economies × three 1-slots each = 9 low slots for 8 types,
> it's achievable — currently Chain/Quill/Crest are low in *two* regions while
> Road/Ferry are low in *none*; redistribute. Until then, a Road/Ferry deck is
> the predicted solved meta. (Note: changing the base `REGIONS` tables affects
> campaign/standard balance, so the run may want its *own* widened value set.)

Build axes (all owned, all built through the run):
1. **The Card deck** — the types you field; draft, thin, and stamp them (§6.4).
2. **The Stone pouch** — counts and upgraded variants (§5.1).
3. **The ally loadout** — outfit your AI partner (§5.4).
4. **Charms** — run-wide passive modifiers / relics (§5.2).

**The core combat is untouched** — commit cards, place stones, score best-3,
race the ledger. Only *where your cards come from* changes: the base game
(campaign/standard) keeps the shared regional pool and stays the simple,
teachable version; **the run gives you an owned deck.** Complexity and effect
cards are **roguelike-only** — exactly how Balatro/StS/Monster Train keep a clean
base and a wild run.

---

## 3. The core loop — "The Long Road"

A branching map of nodes across **3 acts**, each ending on a campaign boss,
culminating in **the Crucible** (which already exists as the all-layers
capstone — a free, perfect final boss). Act themes map to venue regions
(Tavern road → River docks → Sovereign court).

**The fight *is* the existing match.** A "fight" is a ledger race; the score
margin each hand is already the damage. Win → bank rewards. Lose the race the
other way → you're cleaned out. The match engine needs **no rework** — only a
wrapper that injects run context into `newGame` and reads win/loss out the end
(instead of match-end → victory modal → title).

**Fail-state (decided: Standing-as-HP, with damage-shaping).**
A **Standing** pool drains by the margin you lose hands by; empty = run over.
Reuses the ledger (margin = damage), rewards *how well* you win rather than
binary win/lose, creates clutch-survival arcs, and opens design space for
charms/cards that spend or interact with Standing.
- **The coupling risk (must mitigate):** run tension and match tension become the
  *same number*, so one ugly showdown against a stacked Elite could lose the
  table *and* gut the run with no buffer. **Damage-shaping is required** — cap or
  diminish margin past a threshold (e.g. each point of margin past N counts half)
  so a single blowout can't do both. Exact curve is an open playtest number.
- *Rejected: flat Lives* — in a margin game, winning by 1 and obliterating by 14
  would feel identical; it throws away the optimization texture that makes
  Stonelock Stonelock.

---

## 4. Node types

All of these reskin pieces that already exist.

- **Easy table** — one soft Regular (Deckhand, Tinker).
- **Moderate table** — a sharp Regular (Ferryman, Clerk, Lady), or a Regular
  *under a venue house rule* (Riverlock / Cursed / Slumlock as the "biome").
- **Elite** — a 2v1 gang-up, a campaign boss at reduced power, or a Regular with
  a nasty modifier. Bigger reward.
- **Boss** — a full campaign boss at act's end.
- **The Fence (shop)** — spend coin: buy/upgrade stones, buy charms/cards, or
  **thin a dead card type out of your draw weighting** (the "card removal").
- **The Roadside (event)** — authored branching choices using the Regulars'
  personalities; wagers, bribes, cursed gifts.
- **The Onlooker (puzzle)** — a frozen board with a correct line ("take the hand
  in one move"); reuses the Academy's `sg-` strategy situations. **Breather**
  (pure upside) or **wager** (ante for a charm) flavors. See §7 — puzzles are a
  first-class pillar, not just a node.
- **The Inn (rest)** — restore Standing, upgrade a stone, or scout the next
  table's modifier.

**Encounter shapes** (all three already exist and pass tests): 1v1 duel; **2v1
gang-up** (you alone vs a coordinated pair — the natural elite); **2v2 alliance**
(you + a recruited ally). Raids are *already* 2v1 (you+ally vs boss), so the
plumbing for partner/gang-up is proven.

> **FFA — cut from the first run (decided).** A four-seat melee has a *different
> win-con shape* (bank your margin over the lowest, not race a marker), so a run
> mapping like "top-2 passes" is a different mode wearing the same UI — plus the
> targeting/visual noise. Keep FFA for casual hotseat now; revisit as a special
> event node or expansion later.

---

## 5. The build axes (detail)

### 5.1 The Pouch (the "deck")
Start by choosing one of ~3 **starter pouches** (your "characters"):
- **The Locksmith** — White/Black heavy; shut down and grind out.
- **The Ferryman's Apprentice** — Blue heavy; run on theft.
- **The Alchemist** — Red/Green; phantoms and poison, a combo engine.

Through the run you **add stones** (copies, or normally-forbidden colors like
Green) and **upgrade** them into variants: *Twin Red* (two phantoms), *Deadbolt
White* (also blocks Black), *Riptide Blue* (swaps two cards), *Hex Green*
(spreads). **Variants are net-new rules in stone resolution — ship 3–5 curated,
not twenty.** The engine already supports per-player stone pools (the Gauntlet
variant gives one-of-each); generalize that to an arbitrary owned loadout for
seat 0.

### 5.2 Charms (relics) — ✅ framework + tiers 1–2 BUILT
> **Shipped:** a `CHARMS` registry (mirrors `EFFECTS`) — each charm declares its
> lever and/or lifecycle hooks (`on.fightStart/handStart/handWon/handLost`),
> summed/fired by `charmVal`/`charmCardBonus`/`charmFire`. Player-only +
> Circuit-only ⇒ base game and the AI seat are numerically untouched. **18
> charms** live across two tiers: passive levers (Loaded Coin, Passage Toll,
> Whetstone, Forger's Seal, Master Forger, Floor Price, Smuggler's Lining, Iron
> Pouch, Hardened, Field Surgeon, War Chest, First Blood, Strong Finish) and auto
> event hooks (Opening Gambit, Spite Engine, Momentum, Counterpunch, Tithe).
> Drafted in spoils (occasional, `charmChance`), shown in the HUD + deck viewer.
> **Records/compendium** persists runs, best results, and charms-seen (localStorage
> w/ in-memory fallback); undiscovered charms stay blacked-out. **Battery finding:**
> charms snowball — endless + compounding power trends unkillable; curbed (rarer
> draft + steeper foe ramp) but the real bound is the **run-structure/boss** pass.
> **Still to build (taxonomy in §6.x notes):** tier 3 reactive charms (ward/counter
> — new targetability + stone-intercept hooks, with AI awareness) and tier 4
> active/amplify charms (scry, rearrange, discard-dig, redraw, effect-doubling —
> need in-match UI). Original notes below.

Persistent passives that warp the card/score/stone economy — **split hard by
cost**:
- *Lever-only* (cheap, ship ~15 fast): Loaded Coin (+1 Coins), Forger's Seal
  (Pairs pay +3), Marked Deck (see one veiled card), Iron Pouch (no exhaustion),
  Second Wind (redraw once/table), Smuggler's Lining (one extra stone past the
  thinning).
- *Hooked* (need new engine hook points): gate to later.

### 5.3 The Card deck
Your owned, built card deck (§6.4): draft cards in, **thin** dead ones out,
**stamp** specific cards (type- or instance-scope). Effect cards (§6) live here.
**Roguelike-only** — the base game keeps the shared regional pool. Venues still
reshape values per fight, so the deck is venue/act-relative (§2).

### 5.4 The ally / mercenary — a recruited bench (Wildfrost model)
Recruit Regulars over the run (an early event seeds your first); keep a **bench
of up to ~3**, and **field one for fights that need an ally** (2v2 nodes), re-kit
between fights. The **Regular *is* the merc "class"** — its innate lean is the
"aura" (the Old Hand's protective instinct). Then **outfit them**: assign
stones/cards from your **shared** inventory.

- **The bench cap (~3) makes recruiting a decision** — who to keep, who to
  dismiss; and a fielded ally can be **lost** (real stakes behind the
  investment). Viable now that the balance pass (§8.2) put the whole roster in a
  fair 48–58% band — pre-balance, a fielded Clerk was a 36% liability.
- **Re-kit freely between fights.** Equipping spends from shared inventory
  (opportunity cost, below), but reallocation between fights is free — a loadout
  *puzzle* ("keep the Twin Red or hand it to my anchor for this Court fight?"),
  not a grind. This is "fully kit whoever you're fielding."
- **Bounded ally AI is the constraint** (§8.1): each fielded ally runs its
  deck/pouch on a scripted **doctrine**, never a search — the more kit
  flexibility, the more it must execute arbitrary loadouts predictably.
- **Optional depth:** default an auto-kit; surface the loadout only for fights
  that field an ally, so solo tables stay clean.
- **Sequencing:** the companion layer sits *on top of* the player's own
  deck/pouch — build that first; recruit-events + bench come after.

Why this is the cleanest answer to the ally-AI worry: **outfitting moves agency
from the AI's choices to your setup.** A predictable partner running a kit *you*
built beats a clever partner making opaque decisions. Borrow from Diablo:
fewer slots than you (tight optimization), the merc can be *lost* (a soft
fail-state with investment behind it), keep their behavior **simple and legible**
("always lock your best card"). Keep it **optional depth** — default auto-kit so
non-micromanagers can ignore it.

- **Opportunity cost is mandatory (decided).** The merc draws from your *shared*
  inventory, so every stone/card on the ally is one *not* on you. Without that
  cost, optimal play trivially over-gears the merc (its execution risk is lower
  than yours). The tension — "do I keep the Twin Red or hand it to my anchor?" —
  *is* the feature.
- **It's a retention feature, not just combat.** Players bond to *ownership*
  ("my Old Hand," "my Ferryman"), not power. A companion you outfit and drag
  through a run stops being an AI and becomes part of the story — so the merc's
  history feeds the Run Chronicle (§7.5): tables survived together, bosses broken,
  signature moments.

### 5.4b Pre-fight loadout — the "ready-up" screen
Before each table, a confirm screen shows the matchup (venue + opponent) and your
loadout — the same outfit UI as the run-start screen, **pre-filled and
adjustable.** Its real value: it makes the loadout **venue-aware** (adapt your
deck/pouch/ally to *this* table's values and foe = pillar #0 as an active
decision), not just a one-time setup.
- **Default to "keep loadout":** solo tables get a compact confirm — venue, foe,
  your deck/pouch — with one-tap **Begin** and an **Adjust** expand. Fiddle only
  when you want; re-kit is free between fights (§5.4), so it's a puzzle, not a tax.
- **Ally-fights fold in the bench on the same screen:** an ally slot appears —
  pick from the bench and kit them (shared inventory), then Begin. One screen, no
  menu-diving.
- **Reveals** venue + opponent (so you can adapt); the foe's full kit stays hidden
  unless a scout charm shows it.
- **Lands with the companion layer** (needs the bench + re-kit). Cheap first step,
  buildable now: have the between-table screen **reveal the next matchup** so the
  player can think ahead — the seed of the ready-up screen.

### 5.5 Footprint-per-act escalation (decided to bake in early)
`footprintOf` is already a parameter. Field **4 → 5 → 6** across acts. Notes:
- **Scale the draw too**; the draw-to-field ratio is the agency knob.
- **Keep scoring at best-3** — bigger boards then mean more *interaction surface*
  (more targets, more set density), not a higher scoring bar. Do NOT scale to
  "best 4" (it breaks the Pair/Triad math).
- It **couples to the Pouch**: a 6-card board with 3 stones dilutes interaction,
  so the growing board is what makes the bigger pouch you earned feel necessary.
- Shape character via the **face-up/veiled ratio**, not just count (more veiled =
  murkier late acts).
- **Cap the player at 6**; let bosses field 7+. "They field more than you" is good
  asymmetry. Mind mobile readability.

---

## 6. The effect-card system

### 6.1 Philosophy (decided)
The specific cards barely matter; what matters is that they reduce to a small set
of **primitives that combine.** You are not authoring 100 cards — you are setting
a few knobs. The breadth is free; the *vocabulary* is the work.

### 6.2 Keywords
- **Mirror** — the positionally-opposite slot on the enemy/ally board. (Already
  recurring: reveal the mirror, debuff the mirror, swap the mirror.) Make it a
  real keyword; it gives your slot geometry a second life beyond slot mode.
- **Adjacent** — neighbors in the footprint.
- **Duality / Trait** — triggers when beside a card sharing its trait
  (a generalization of Pair/Triad).
- **Reveal** — flip a veiled card (private peek vs public flip).
- **Scope** — self / ally / enemy / any. *Already in the engine* via
  Simplified-vs-Advanced targeting.
- **Shape** — static (auto) / modal (choose-one) / active (one-shot) /
  triggered (on-event).

### 6.3 The four disruption axes
Every disruption effect should answer "**which axis?**" — keeps coverage
deliberate, avoids redundancy.
1. **Value** — debuff/buff the numbers.
2. **Structure** — break/complete *sets* without touching value (e.g. *shuffle a
   card into a different type of the same value* — kills a Pair, raw value
   intact; on your own board it can *complete* a set). A genuinely fresh axis.
3. **Stones** — strip the modifiers (e.g. *revert a card to base value, knocking
   all stones off — but trades stay*, deliberately distinct from Black which
   rewinds topology).
4. **Position** — reorder/move (see §6.6).

### 6.4 Ownership model (decided: **owned deck**)
The run gives you an **owned Card deck** (StS/Wildfrost-style), built alongside
the Pouch — you draft cards in, **thin** dead ones out, and **stamp** specific
cards. The deck is the multiset of card types you draw your fielded cards from.
- **Two stamp scopes:** *type-stamps* ("all your Coins carry a built-in Lock")
  and *instance-stamps* (Wildfrost — this one specific card). Instance-stamps are
  where the "which card earns this?" decision lives.
- **Why owned (vs the shared pool):** the base game's shared 64-card pool made
  stamping pointless — an investment lost in the shuffle. An owned deck is small
  and yours, so stamped/special cards **show up reliably**; ownership *solves*
  the draw-reliability problem rather than creating it. It is also the only model
  consistent with letting the player add/thin/modify cards at all (if you build
  them, they're your deck).
- **Alternatives considered (and why owned still wins):** a *smaller curated
  shared pool* still can't make a stamp reliably reappear (it's diluted), and
  *stamping stones/charms instead of cards* doesn't satisfy the actual ask —
  players want to adjust the **cards** too. Owned deck is the only model that both
  makes stamps reliable *and* lets you add/thin/modify cards.
- **The cost (eyes open):** this is the bigger build — real deck-management
  (add/remove/thin/stamp UI + economy) — and it nudges the run toward "a
  deckbuilder that uses Stonelock's combat." The §2 venue-value rule is what keeps
  it from flattening into a generic one — **but that rule is not yet safe (see the
  §2 finding: Road/Ferry are good everywhere). Validate/rebalance the value tables
  before Phase 2 engineering; the owned-deck decision *depends* on regional
  leverage actually biting.**
- **Dial (open):** *full* owned deck (draw only from your deck, StS-style) vs a
  *hybrid* (your deck seeds/biases a draw still partly from the regional pool).
  Full is cleaner and the assumed default; hybrid is a fallback if a pure owned
  deck strays too far from the base feel.
- **Base game unchanged:** campaign/standard keep the shared regional pool. Only
  the run swaps the draw source to your deck.

### 6.4b Effect-card model + the scoring change it needs (✅ BUILT — Circuit MVP)
> **Shipped (v=167):** the per-card value override (`card.evalue`) + an
> `applyCardEffects()` board pass now drive scoring and the value badges; the
> Circuit loadout offers 5 effect cards (type + fx), pick 2 into the owned deck;
> cards wear an fx ribbon in-hand, on-board, and in the loadout. Starter riders
> live: **Anchor / Keen / Lodestone / Drain / Sentinel / Harmony** (Wild still
> deferred). Sentinel (+2 on an end slot — a `slot` self-by-position hook) and
> Harmony (+1 per other effect card you field) add a positional counter-pull to
> Lodestone and a build-around payoff; both dropped in as registry entries with
> their own gate assertions, no core-loop edits. Unit-tested
> in `tests/circuit.test.js`; base-game scoring confirmed unchanged (no-op
> without effect cards). Notes below are the original design.
>
> **Decided since:**
> - **Both decks deplete (draw → discard → reshuffle when dry).** The card deck
>   *and* the stone pouch are draw piles that reset (full shuffle) at the start of
>   each table, then cycle hand to hand. Thinning is a hard, predictable lever and
>   the two parallel decks feel real; matches the genre's mental model. Pouch draw
>   = `CIRCUIT.drawStones` (3) a hand. (`circuitResetPiles`/`circuitDrawCards`/
>   `circuitDrawStones`, `drawPile`.)
> - **Drain is owner-locked.** A Mirror Drain card fires only from its original
>   owner's board (`card.origOwner`, which survives Blue swaps). Stolen across, it
>   goes inert rather than turning −1 onto the board it now sits behind — no
>   feel-bad backfire, no reward for stealing it for its effect.
> - **Opponents field builds too (`CIRCUIT_BUILDS`).** Each regular brings a
>   leaning 4-stone pouch + two themed effect cards in an otherwise one-of-each
>   deck, and draws from the **same depleting piles** as the player (per-seat
>   `g.piles[seat]`, drawing 3 stones / a hand of cards). This also right-sized
>   the foe's stone economy from the old 2-of-each (8/hand) down to a fair 3.
>   Effect *decks* on foes were gated behind the AI pass below; that pass is now
>   done, so they ship together.
> - **AI is effect-value aware, allied and opposing.** `applyCardEffects` feeds a
>   per-card `evalue` that flows through `knownBoardFor`→`estimate`→`sideSwing`,
>   so every stone decision (Red/White/Blue/Black targeting) values and plays
>   around Anchor/Keen/Lodestone/Drain; `aiChooseDeploy` scores cards with layered
>   priorities (base value → set potential → effect rider) so the AI *keeps* the
>   effect cards that pay. **Insulated from regular/campaign by construction:**
>   `evalue == regionVal` without effect cards (which only exist on Circuit decks),
>   so base-game scoring/AI is numerically unchanged — verified by the full test
>   suite + AI battery holding their band.
> - **One registry per effect (`EFFECTS`).** Each effect declares its UI text,
>   its value resolution (phased hooks: `base`/`self`/`spread`/`cross`,
>   `ownerLocked`), AND its AI keep-priority (`aiKeep`) in a single entry.
>   `applyCardEffects`, the card art, the loadout/deck UI, the offer pool
>   (`CIRCUIT_FX = Object.keys(EFFECTS)`), and the deploy heuristic all read from
>   it — so **adding an effect is one isolated entry, no core-loop surgery**, and
>   AI logic is *layered in per effect* rather than overhauled all at once (the
>   stated process to avoid regressions).
> - **Competence gate before new effects (`tests/effects-ai.test.js`).** Proves
>   the bots ASSESS each current effect correctly through their own eyes (incl.
>   fog of war), make effect-correct DECISIONS (Blue steals the highest effective
>   value; deploy keeps the rider that pays), and layer per-bot persona priorities
>   on top (Clerk weights White-over-Blue above the Ferryman on the same board).
>   New effects don't land until the bots play the existing four right.
> - **Positional mastery (generic, not per-effect).** When the kept cards include
>   a *positional* effect — one with a `spread`/`cross` hook (`isPositionalFx`) —
>   `aiChooseDeploy` runs `positionDeploy`: it searches slot orderings (within the
>   exposure groups the risk pass chose) and picks the one that maximizes the AI's
>   table swing. So Lodestone seeks an interior slot between high cards and Drain
>   seeks the slot facing the foe's strongest card — emergent from scoring, no
>   per-effect placement code, and a future positional effect joins the search for
>   free. No-op (and skipped) when no positional effect is held, so base game is
>   untouched. **Still open:** placement is bounded to *within* the face-up/hidden
>   groups, so a Drain can't always reach a slot outside its group — full-board
>   slot freedom + reacting to the foe's hidden/late commits is the next depth.
> - **The run builds (between-table economy).** Most cleared tables open a spoils
>   screen (`makeReward` → pick 1 of 3 effect cards and 1 of 2 stones, or skip),
>   appending to the owned deck/pouch so the depleting draw reshapes as you climb.
>   Every `CIRCUIT.eventEvery` (4) cleared tables an **interlude event** replaces
>   the spoils: choose one of **remove a card** (floored at `deckFloor`), **remove
>   a stone** (floored at `drawStones`, so you can't drop below a full draw),
>   **heal** `ceil(60% of maxStanding)` (offered only below full), or **move a
>   modifier** (lift an fx off one card onto a plain one — the Wildfrost attach).
>   Rhythm: gain, gain, gain, refine. Both screens carry a "Review deck & pouch"
>   button (opens the viewer over the screen, returns with the selection intact)
>   for informed choices. Thinning + move-mod are the deckbuilding verbs the
>   depleting decks were built to reward. **Next:** shops/charms, and an event
>   that adds a stone *variant*, are the natural economy expansions.

Effect cards are **typed cards with an `fx` rider** — they still have a type
(pair/triad normally), an icon, and a venue value, *plus* an effect. So they live
in the existing card model and the loadout/deck unchanged; the fx is the extra.
- **The one engine change:** `bestSelection` values cards **by type**
  (`values[type]`), so per-card effects (drain *this* card −1, anchor *this* one)
  don't fit. Add an **optional per-card value** (`card.evalue`) that
  `bestSelection` uses when present, set by a **board-effects pass** run before
  scoring. **No-op when no effect cards are in play, so the base game's scoring is
  untouched.** Thread `evalue` through the ~6 bestSelection call sites
  (showdown, twoBestHands, the AI estimate, the Apothecary cut).
- **Value-mods first** (all resolve in that pass, AI-safe/static); **Wild last**
  (it changes set-matching logic, not just value).
- **Starter set for the Circuit loadout** (pick 2 of 5; each card = a type + fx):
  - **Anchor** — value is fixed regardless of venue (a hedge vs regional leverage).
  - **Keen** — +1 if you also field another of its type (rewards committing to a set).
  - **Lodestone** — +1 to its neighbours in the footprint (adjacency/support seed).
  - **Mirror Drain** — the opposing card in the **same slot** loses 1 raw value;
    its pair/triad eligibility is untouched (value-axis disruption via the Mirror
    keyword — the inverse of the type-shuffle, which breaks sets but keeps value).
  - **Wild** — counts as any type to complete a Pair/Triad *(deferred — set logic)*.

### 6.5 Card idea catalog (raw — tag each by axis + AI-safety before building)
- **Wild / Joker** — fills any type for a set, or flexes value. *(structure,
  static)*
- **Mirror Drain −1 / Mirror buff +1** — value on the opposing/own same-slot card;
  drain leaves set-eligibility intact. **Modal "choose one"** version is a
  board-*read* (−1 breaks their set vs +1 completes yours; thresholds make it
  asymmetric and deep). Stamped ceiling = *do both*. *(value, static/modal)*
- **Reveal the mirror** — private peek (ship first) or public flip (exposes it to
  stones). A "scout, then strike" setup piece. *(info, static)*
- **Triad → Pair downgrade** (once/match). *(structure, active)*
- **Trap** — negate the next opposing stone/card effect. *(stones, triggered)*
- **Revert to base, strip all stones** (trades stay). *(stones, active; rare —
  strips White)*
- **Ward** — ignore the next stone to target this card (a cheap, one-charge
  White). *(stones, static; a ward isn't White, so the lockpick can't strip it)*
- **Lockpick stone** — *may* target a White'd card to remove the White, but its
  own effect fizzles doing so. A **stone variant**, not a base stone; patches
  Black's blind spot at a tempo cost. *(stones)*
- **Type-shuffle** — see §6.3 structure example; venue-flavored (which types
  share a value shifts per table). *(structure)*
- **Reposition / reorder** — see §6.6. *(position)*
- **Cards that touch score/HP directly** — couple to the §3 fail-state; add
  *last*, once the win-con is locked.

### 6.6 Position effects (build LAST of the four axes)
Position is **second-order**: moving a card changes the *geometry other effects
read*, so it's worth nothing on a position-agnostic board and is **combo glue**
in a positional build. Deepest application: **reorder the slot-mode queue** —
the purest expression of the order war, and the most distinctive thing in the
pool. Rules to pin: stones travel with the card; collision = **swap** (not
push-cascade); **White can't be moved** (another reason it's the anchor; crack
the lock first); moving between a face-up/face-down slot is a **reveal vector**.
`animateMoves` already animates inter-slot movement, so the board stays legible.
**Do not ship before mirror/adjacency/slot density exists** — until then it
moves cards nothing reads.

### 6.7 Readability + balance guards
- Every card/charm needs an instant **scope tell** (▲self / ▼enemy icon) and a
  legible effect — "who does this hit?" can't be a puzzle on a busy board.
- **Denial outweighs buffing** — price/rarity enemy-scope and structure-breakers
  higher.
- **The anti-White dial (decided):** White stays **absolute against the standard
  card pool** — no common card invalidates a lock, or the Locksmith archetype
  collapses and the board becomes impossible for a human to project. Cracking a
  White is restricted to the **Lockpick stone variant** (costs the enemy a stone
  action), **boss mechanics**, and **rare** effects only. Guard against this
  becoming an *implicit per-card decision* during implementation — it's a
  rarity-gating rule for the whole set, revisited once the card catalog exists.
- **⚠ Green watch (balance landmine).** The moment Green is player-stackable it
  stops being "the boss scalpel" and becomes an *optimization target* — the
  effect most likely to be secretly twice as strong as intended. Don't remove it;
  **monitor from day one**: duplicate-Green builds, Green recursion, Green-focused
  pouches. Assume players find a stronger use than designed.
- **Use modality sparingly** — if every card is "choose one," each hand becomes
  decision fatigue and the board stops reading.

### 6.8 Card-flow effects — draw / discard / exhaust (Phase 3+)
The classic deckbuilder consistency/cycling lever. Stonelock already has the
rhythm (draw a hand → commit a footprint → discard the rest) and already uses
"exhaust" in the *stone* economy (Slumlock, the Warden), so the vocabulary
extends cleanly to cards.
- **Draw / dig** — extra cards before committing → deeper selection, steadier
  hands. A pure self-buff; **AI-safe** (a bot just gets more options).
- **Discard** — *self*-discard filters a dead card and cycles (adaptation);
  *opponent*-discard is a **new denial sub-axis** that attacks the hand/options
  rather than the board (complements value/structure/stones/position). AI-cheap
  when scoped (their lowest / random).
- **Exhaust** — remove a card for the rest of the *match* (lets a high-impact
  one-shot pay its cost by leaving). Keep distinct from run-level **thinning** at
  the Fence (permanent removal).
- **⚠ Tension with pillar #0 (regional leverage).** Draw-to-dig directly
  threatens the core mechanic: if you can reliably draw until your pet cards
  appear, the venue's values stop mattering and the anti-solved-meta pillar
  flattens. **Frame draw as "adapt to *this* venue"** (dig for what's valued
  here), not "draw until I see my favorites": ration it (cost/cap), and bias
  discard/exhaust toward *filtering for the current economy* over *enabling one
  dominant line*. Judge every draw effect by *does this help me adapt, or let me
  ignore the venue?*
- **Engine:** unlike the simpler effects, these presuppose a real draw-pile /
  discard-pile / exhaust-pile structure, which only exists once the owned deck
  lands — so they ride **Phase 3**, not an early add.

---

## 7. Puzzles as a first-class pillar

The Academy's Strategy situations (`sg-`) already are puzzles. Promote them:
1. **Run nodes** (§4) — breather/wager.
2. **Onboarding** — teach the clever lines, especially **reverse-order reading**
   (your hardest, most unique skill; a puzzle is the right place to teach it,
   far better than hoping a player figures it out vs a bot).
3. **A standalone Daily Puzzle** — a shareable result; cheap retention that
   doesn't even require a run, and shippable *independently and now*.

Why puzzles punch above their weight: they're **skill, not RNG** (the perfect
counterweight to margin-as-damage variance), and **authored content sidesteps
the AI problem entirely** — guaranteed quality with zero dependence on bot
strength. Some of the highest-confidence content per hour on the board.

### 7.5 Run Chronicle — make losing memorable (new, from feedback)

The doc covers how runs *begin* and *progress*; it was missing **why a loss
should stick.** Not punishment — *narrative*. Stonelock already has named bosses,
named allies, named venues, and strong flavor — the ingredients for stories most
roguelikes generate by accident. Generate them on purpose.

At run end (win *or* loss), record a tiny **Chronicle** entry:
- a generated **run title**, **distance reached** (act/node), **final boss faced**,
- the **ally** you carried (and tables survived together — ties to §5.4),
- your **signature stone** and **key charm**, and a **memorable play** (e.g. the
  biggest single-hand swing, or the Green that won it).

Cheap to build (it's a serialized summary of state you already track) and it
turns a dead run into "the time my Old Hand and I broke the Warden at the Docks
on a single Twin-Red triad." That's retention fuel, and it doubles as the
share-out for a Daily.

---

## 8. The AI prerequisite (read this twice)

**The AI gates the entire mode.** A run makes you face the bots *dozens* of
times; if they're a soft proxy, the run feels hollow no matter how good the card
system is. This is the single most important non-obvious truth in this doc.

**⚠ The AI loophole (architectural landmine — account for it before any code).**
Moving to an *owned deck* lets players build highly conditional combo engines.
If an ally bot — or an opponent on Advanced targeting — has to *evaluate* those
player-made board states, a brute-force / minimax search **explodes
exponentially** and chokes. The hard rule: **AI-held effects resolve via scripted
conditional primitives, never a search over combinations.** e.g.
`if (target.isTriadPartner) applyBuff()` — transparent, bounded, predictable. The
AI must *execute* a kit, never *discover lines*. This is the same Diablo-merc
principle as §5.4, stated as an engine constraint: don't let the AI "think" about
combos; make it run scripts.

Mitigations baked into the design:
- **Distinct opponents via KITS, not skill.** A dumb AI holding a strong *static*
  kit still feels smart and threatening, because the effect just *happens* at
  showdown. Author a signature kit per Regular/boss. Players remember "the
  Ferryman always steals," not "the Ferryman searches to depth 4."
- **AI-safety lens for every effect:** *static (auto-resolve) > modal-finite
  (a tiny evaluable option set, e.g. mirror buff-or-debuff — brute-force both,
  take the bigger swing) > open-target (AI-brutal).* Bias AI-held cards toward
  static/auto; reserve clever enemy-disruption and position plays for the player.
- **Allies must be simple and legible** (§5.4) — a bad partner is worse than a
  bad enemy.
- Even so, **budget a genuine AI pass** before/alongside the first real run
  phase. The Gauntlet (§9) is partly a *test* of whether the core + AI hold up.

### 8.1 AI architecture notes (review round 2 — Codex)
The current AI is a readable heuristic evaluator (visible-score estimate with
hidden cards as generic value-2; cards by regional value + pair potential; stones
by simulated swing; personalities = multipliers; bosses = same brain + rule/turn
advantages). That's the *right* shape — legible, cheap, tunable. **Tighten by
authoring, not by deepening search** (more opaque = wrong direction). Concretely:
- **Add an AI role layer** — `opponent | ally | boss | elite`. Personalities stay,
  but **role sets priorities.** Allies should weight *team survival* and *protect
  the player's carry card* over personal score (today the Old Hand benefits allies
  via `alliesOf` but isn't authored enough — it solo-wins only ~46%, below even).
- **Per-companion doctrine scripts** (tiny, hard-coded): Old Hand → lock the
  ally's highest-contribution card; Black an enemy Red/Blue hitting the ally
  first. Ferryman-ally → Blue only if it improves *team* swing without breaking
  the player's structure. Clerk-ally → secure the team's best Pair/Triad, no
  speculative Blue. Distinct feel without deep search.
- **Explain hook (debug):** let AI decisions optionally emit a reason ("White:
  player's Coin is the current best anchor"). Invisible to players; invaluable
  for tuning.
- **Owned-deck effects = bounded primitives**, never generic search (restates §8):
  "buff own best visible hand", "protect carry", "break enemy pair", "swap
  lowest-for-highest if known".
- **Slot bosses need placement doctrine.** `archAiPlaceSlots` currently queues by
  slot availability and lets `archAiCommit` do the clever part — so the Archivist
  "programs" stones greedily, not with intent. 3–4 authored patterns ("protect
  the centre lane", "bait then reverse", "Blue before/after White by tier") would
  make the sequencing-mastery boss feel sharp.

### 8.2 Bot battery — first run (`tests/ai-battery.js`)
Each Regular (seat 0) vs a neutral Deckhand, 40 all-AI duels per venue; cell =
Regular win%. **Findings:**
- **The roster is NOT samey** — per-row spreads of 18–45 pts show identity that
  genuinely swings by venue. The personality × regional-leverage interaction is
  real and *load-bearing*, which is exactly what the run needs. (Codex's
  "flat ~50% everywhere" failure mode does **not** apply.)
- **But the roster is imbalanced as opponents/allies:** Ferryman **66%** and
  Wagoner/Miner **59%** are strong; **Clerk 36%** and **Tinker 37%** are weak vs
  the *same* baseline. For the Circuit's rotating opponents this means some tables
  are near-free and others walls, purely by who shows up; for the merc system
  you'd always pick Ferryman, never Clerk.
- **Codex's predicted venue mismatches are real:** Tinker is dead in the Gambling
  Hall (20%, its Red-chasing fails under the Cursed Register) but fine in Court
  (55%); the Wagoner crushes the Tavern (83%) and collapses in Court (38%); the
  Ferryman dominates the Hall (85%) but is even in the Slums (45%).
- **The Clerk's "build-and-lock" doctrine underperforms everywhere** (23–45%) — a
  clear authoring target.
- **Action taken — balance pass (done).** Root cause: card play is identical
  across regulars (region-value based), so the win gap came from the *persona
  stone-weight multipliers* being extreme enough to override good play (Clerk
  never steals → loses to neutral; Ferryman always steals → wins, because Blue is
  objectively the strongest stone). Fix: **compress the multipliers toward 1.0
  for stone decisions** (`PERS_COMPRESS = 0.5` via `persStoneW`) — every
  regular's lean stays visible, but won't self-destruct on it. Result: baseline
  band tightened **36–66% → 48–58%** (Clerk 36→48, Tinker 37→53, Ferryman 66→58)
  while per-venue spreads stayed 15–38 (identity preserved). The battery is a
  standing tool (`node tests/ai-battery.js`); re-run after any weight change.

### 8.3 Circuit balance battery (`tests/circuit-battery.js`)
Drives full **all-AI Circuit runs** through the real loop — depleting builds on
both seats, Standing attrition, clear→heal→advance, auto-piloted spoils/events —
and reports the difficulty curve. The "player" is a neutral **Deckhand** on a
varied build, so it measures the **economy + curve, not skill** — a *floor*; a
real player clears more. `K=120 node tests/circuit-battery.js` (~2s).
- **First run (config 14/14, cap6, heal3, foe 10+1):** median **1** table, mean
  2.2; T1 clear 55%; curve **flat and swingy** (55–79% all the way down) yet a
  rare run hit table 28 — i.e. high-variance, no real ramp.
- **Tuned to 16/16, cap4, heal4, foe 9+2:** lowering the per-hand cap lets the
  Standing edge express early and the foe's `+2/table` HP scaling bite deep →
  mean 2.8, **T10 reach 6%→10%**, a softer gradual ramp. Locked as the first
  data-backed config. Test reads the live `CIRCUIT` config so tuning can't desync.
- **Open:** a clear **dip at the Court table** (stone-first venue) for neutral
  play — a venue-balance follow-up. And the floor bot still dies early (median
  1–2); real-player data is the next calibration input, not more bot-tuning.

---

## 9. Build plan (phased so each step de-risks the next)

- **Phase 0 — Endless Gauntlet (MVP).** No map, economy, or relics. Pick a Pouch,
  face escalating tables with stacking modifiers, lives + score, daily seed.
  Answers the one question everything rides on: **is a Stonelock match fun the
  10th time, and is the AI good enough to carry it?** Cheapest possible test of
  the whole thesis. Reuses ~everything. **Do an AI pass here.**
- **Phase 1 — Run skeleton.** ✅ **map skeleton BUILT.** The Circuit is now a
  finite **3-act run map** (`CIRCUIT.acts × actRows`): each act is columns of
  nodes you path through to an **act boss** — node types **duel / elite (×1.25 HP
  + persona charms) / event (the interlude) / boss (×1.5 HP, act-ender)**.
  `buildAct`/`circuitMapScreen`/`circuitEnterNode`/`circuitSetupFight`/
  `circuitAfterNode`; **currency** (`coin`) earned per node; charms gated to
  elite/boss rewards (no longer every spoils). **Foes carry charms** now
  (seat-aware `charmsOf`); earlier acts none, act 2+ ramp. Finite acts **bound
  the snowball** — runs end in victory or death, not endlessly. **Shop node
  ("The Fence") BUILT:** a guaranteed pre-boss shop spends `coin` on cards,
  stones, charms, a one-off thin, or patching Standing (`makeShop`/
  `circuitShopScreen`/`circuitShopBuy`/`circuitShopThin`; prices in `CIRCUIT`).
  Re-tuned via the rewritten map battery (Standing 20, heal 7, dmgCap 6, foe
  8+1/tier): with the shop economy, floor-bot win **~37%**, all runs terminate.
  **Still TODO this phase:** **seeded RNG** (deferred — do before the economy
  deepens), branch *edges* (currently full-connectivity per column), and the
  act-1 death cluster for the neutral floor (real-player data is the calibration
  input).
  *(Pre-req gate: rebalance the value tables per the §2 finding before leaning on
  regional leverage in Phase 2.)*
- **Phase 2 — Roguelike.** Pouch feeding matches (generalize the Gauntlet
  loadout), the Fence + card thinning, ~15 lever-only charms, events + puzzle
  nodes, encounter shapes (2v1/2v2 — **not FFA**, §4). Now it's a *roguelike*.
- **Phase 3 — Depth.** Static effect-card layer + the hook system (shared by
  charms and triggered cards), stone variants, elites, hooked charms, Wildfrost
  attach-stamps, meta-unlocks + ascension tiers, full match-seed for true dailies.
- **Phase 3b — Position (only after 3 lands).** The positional layer (mirror /
  adjacency / slot density) *then* position cards. Split out because position is
  the deepest axis and is meaningless until its prerequisites exist and are
  legible — don't build it in the same breath as everything else in Phase 3.

What reuses existing code: the match engine, team/2v1 logic (raids), per-player
stone pools (Gauntlet variant), the puzzle framework (`sg-`), the campaign-unlock
localStorage pattern (→ meta-progression), `animateMoves` (position).

---

## 10. Risks / landmines

1. **AI quality** — the big one; see §8. The prerequisite, not a polish item.
2. **Seeded RNG** — the most invasive plumbing; plan it, don't retrofit in a
   panic. `Math.random()` is currently sprinkled through shuffle + AI.
3. **Complexity / readability** — every card is a rule × the AI × the tooltip ×
   the balance pass. Curate ruthlessly; ship tight sets.
4. **Save robustness** — a run is hours; a wiped `localStorage` is a rage-quit.
   Serialize `RUN` carefully; plan for Steam Cloud.
5. **Balance** — a playtesting problem, not a coding one. Margin-as-damage
   especially.
6. **Scope creep** — the brainstorm is generative; that's the danger. Lock the
   keyword list + four axes, build the shared hook/board-effects pass once,
   author a curated ~12.
7. **AI-generated art disclosure** — for commercial release, Steam requires
   declaring AI-generated assets; consider IP/licensing before money's involved.

---

## 11. Decisions

**Resolved (review round 1 — see the digest at top):**
- Fail-state = **Standing-as-HP + damage-shaping** (§3).
- Card-deck = **full owned deck** (§6.4).
- White = **absolute vs standard cards; Lockpick/boss/rare only** (§6.7).
- **FFA cut** from the first run (§4).
- **Seeded RNG → top of Phase 1**; **Position → Phase 3b** (§9).
- **Regional leverage = protected pillar #0** (§2).
- Ally = **shared-inventory opportunity cost + retention feature** (§5.4).
- Added **Run Chronicle** (§7.5), **Green watch** + **AI loophole** rules.

**Still open (empirical — answered by building/playtest):**
1. **Does Phase 0 prove repeated play is fun?** The gate; nothing else matters if
   this fails.
2. **Is the AI good enough under repetition** (pass up front vs test-then-decide)?
3. **Owned-deck draw model:** *full* (default) vs *hybrid* fallback if full
   strays from the base feel (§6.4).
4. **Standing-as-HP damage-shaping curve** — the exact cap/diminish numbers (§3).
5. **Venue-value rebalance numbers** once the dead-region rule is applied (§2).
6. **Footprint ceiling** — confirm player caps at 6, bosses 7+ (§5.5).

**Priority order (consensus): 1 → 2 → 3 → 4 → everything else.** If #1 fails the
rest is moot.

---

## 12. The lighter alternative (if the full run is too big a swing)

Ship the **Endless Gauntlet** (Phase 0) *and the Daily Puzzle* as standalone
retention features first. Together they reuse ~90% of what exists, give "one more
run" + "come back daily," require no map/economy/relics, and are the natural
stepping stones into the full Long Road once the core fight (and the AI) prove
they hold up under repetition. **Recommended starting point.**
