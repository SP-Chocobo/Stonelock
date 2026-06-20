# Stonelock — Roguelike Run Mode (design note)

Status: **design only, not built.** A working draft capturing a long design
brainstorm. Sections marked **(decided)** are leaning commitments; **(open)**
marks forks that are the designer's call before building. Written to be
self-contained so an outside reader (or future-me) can follow it and give
feedback.

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

**What keeps it Stonelock and not a generic deckbuilder:** venues still reshape
card values per fight, so your owned deck has **no fixed power level — it is
strong where its types are valued and weak where they aren't.** A deck tuned for
the River Docks struggles at the Sovereign Court. That preserves *regional
leverage* (the game's subtitle) inside an owned deck, and makes deck-building
act/venue-aware — a layer no other deckbuilder has. This single rule is what
stops an owned-deck model from flattening the identity.

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

**Fail-state (open):**
- **(A) Standing as HP** — a pool that drains by the margin you lose hands by;
  empty = run over. Reuses the ledger naturally; couples cleanly to "cards that
  touch HP."
- **(B) Lives** — simple win/lose per table, 3 lives. More readable, less
  systemic.

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
(you + a recruited ally); **FFA melee** (a crowded table — note it's a different
win-con, *bank your margin over the lowest*, so a run needs a mapping like
"place top-2 to pass"). Raids are *already* 2v1 (you+ally vs boss), so the
plumbing for partner/gang-up is proven.

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

### 5.2 Charms (relics)
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

### 5.4 The ally / mercenary
Recruit a Regular to fight beside you (2v2 nodes / hired for N tables). The
**Regular *is* the merc "class"** — its innate lean is the "aura" (the Old Hand's
protective instinct). Then **outfit them**: assign stones/cards from your
**shared** inventory.

Why this is the cleanest answer to the ally-AI worry: **outfitting moves agency
from the AI's choices to your setup.** A predictable partner running a kit *you*
built beats a clever partner making opaque decisions. Borrow from Diablo:
fewer slots than you (tight optimization), the merc can be *lost* (a soft
fail-state with investment behind it), keep their behavior **simple and legible**
("always lock your best card"). Keep it **optional depth** — default auto-kit so
non-micromanagers can ignore it.

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
- **The cost (eyes open):** this is the bigger build — real deck-management
  (add/remove/thin/stamp UI + economy) — and it nudges the run toward "a
  deckbuilder that uses Stonelock's combat." The §2 venue-value rule is what keeps
  it from flattening into a generic one; commit to that rule alongside this.
- **Dial (open):** *full* owned deck (draw only from your deck, StS-style) vs a
  *hybrid* (your deck seeds/biases a draw still partly from the regional pool).
  Full is cleaner and the assumed default; hybrid is a fallback if a pure owned
  deck strays too far from the base feel.
- **Base game unchanged:** campaign/standard keep the shared regional pool. Only
  the run swaps the draw source to your deck.

### 6.5 Card idea catalog (raw — tag each by axis + AI-safety before building)
- **Wild / Joker** — fills any type for a set, or flexes value. *(structure,
  static)*
- **Mirror debuff −1 / buff +1** — same mechanic, opposite valence; **modal
  "choose one"** version is a board-*read* (−1 breaks their set vs +1 completes
  yours; thresholds make it asymmetric and deep). Stamped ceiling = *do both*.
  *(value, static/modal)*
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
- **The anti-White dial:** several ideas bend White (revert, ward, lockpick).
  *Some* counterplay keeps lock-heavy builds honest; *too much* kills White and
  the Locksmith archetype. Treat "how reliable is White" as one dial you set
  across the whole set, rarity-gated — not per card. **(open)**
- **Use modality sparingly** — if every card is "choose one," each hand becomes
  decision fatigue and the board stops reading.

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

---

## 8. The AI prerequisite (read this twice)

**The AI gates the entire mode.** A run makes you face the bots *dozens* of
times; if they're a soft proxy, the run feels hollow no matter how good the card
system is. This is the single most important non-obvious truth in this doc.

Mitigations baked into the design:
- **Distinct opponents via KITS, not skill.** A dumb AI holding a strong *static*
  kit still feels smart and threatening, because the effect just *happens* at
  showdown. Author a signature kit per Regular/boss.
- **AI-safety lens for every effect:** *static (auto-resolve) > modal-finite
  (a tiny evaluable option set, e.g. mirror buff-or-debuff — brute-force both,
  take the bigger swing) > open-target (AI-brutal).* Bias AI-held cards toward
  static/auto; reserve clever enemy-disruption and position plays for the player.
- **Allies must be simple and legible** (§5.4) — a bad partner is worse than a
  bad enemy.
- Even so, **budget a genuine AI pass** before/alongside the first real run
  phase. The Gauntlet (§9) is partly a *test* of whether the core + AI hold up.

---

## 9. Build plan (phased so each step de-risks the next)

- **Phase 0 — Endless Gauntlet (MVP).** No map, economy, or relics. Pick a Pouch,
  face escalating tables with stacking modifiers, lives + score, daily seed.
  Answers the one question everything rides on: **is a Stonelock match fun the
  10th time, and is the AI good enough to carry it?** Cheapest possible test of
  the whole thesis. Reuses ~everything. **Do an AI pass here.**
- **Phase 1 — Run skeleton.** `RUN` state object (persists above the ephemeral
  match `G`), **seeded RNG** (the most pervasive plumbing — seed run-gen first,
  defer match-shuffle), map gen + screen, the run controller (state machine),
  fight wrapper + fail-state, basic drops (gain a stone / coin). Now it's a *run*.
- **Phase 2 — Roguelike.** Pouch feeding matches (generalize the Gauntlet
  loadout), the Fence + card thinning, ~15 lever-only charms, events + puzzle
  nodes, encounter shapes (2v1/2v2/FFA). Now it's a *roguelike*.
- **Phase 3 — Depth & legs.** Static effect-card layer + the hook system (shared
  by charms and triggered cards), stone variants, elites, hooked charms,
  positional layer (then position cards), Wildfrost attach-stamps, meta-unlocks +
  ascension tiers, full match-seed for true dailies.

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

## 11. Open decisions (for feedback)

1. **Fail-state:** Standing-as-HP vs lives (§3).
2. **Gauntlet-first vs commit to the full run** (§9).
3. **AI:** invest in a pass up front, or test the core as-is first and decide
   after? (§8)
4. **Card-deck draw model** — *full* owned deck (draw only from your deck) vs
   *hybrid* (deck seeds a draw still partly from the regional pool) (§6.4).
   Owned-deck itself is decided; this is the remaining dial.
5. **The anti-White dial** — how reliable should White stay (§6.7)?
6. **Footprint ceiling** — confirm player caps at 6, bosses 7+ (§5.5).
7. **FFA in a run** — keep it (with a "top-2 passes" mapping) or cut it (§4)?

---

## 12. The lighter alternative (if the full run is too big a swing)

Ship the **Endless Gauntlet** (Phase 0) *and the Daily Puzzle* as standalone
retention features first. Together they reuse ~90% of what exists, give "one more
run" + "come back daily," require no map/economy/relics, and are the natural
stepping stones into the full Long Road once the core fight (and the AI) prove
they hold up under repetition. **Recommended starting point.**
