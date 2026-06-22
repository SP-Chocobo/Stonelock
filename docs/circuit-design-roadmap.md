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

## Backlog (prioritized) — bigger moments

### 1. Signature boss relics (highest moment-per-effort)
Boss-only drops (a themed pool like Wildcard, since the act boss is a *random*
regular — not tied to a fixed persona unless we fix boss identities). Each needs
a bespoke hook:
- **River King's Toll** — Road/Ferry count as *both* types for Pairs/Triads. (structural, like a targeted Wild)
- **Iron Verdict** — your first committed card each hand begins Locked. (deploy hook)
- **Veilwalker** — once per hand, reveal a veiled enemy card. (active ability + UI)
- **Apothecary's Mercy** — keep a Green Stone you'd otherwise spend. (stone economy)

*Decision needed:* themed boss-pool vs. fixing act bosses to named personas so
"the Ferryman relic" is literal.

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
