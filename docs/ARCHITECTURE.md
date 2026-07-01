# Stonelock — Architecture Map

> A "UML" for a codebase that isn't object-oriented. Stonelock (`game.js`, ~8.4k
> lines) is **functional**: pure-ish functions over a few big **global state
> objects** and a wall of **const data dictionaries**, all driven by a
> **queue-based hand state machine**. So instead of a class-per-file diagram,
> this captures the four things that actually describe it: the *state shapes*,
> the *subsystems*, the *hand loop* (the core pattern), and the *raid-boss
> variation*. Line numbers refer to `game.js`.

Entry points: `boot()` on `DOMContentLoaded` in the browser; a `module.exports`
test API under Node (guarded by `typeof module`).

---

## 1. State shapes — the objects everything mutates

There are no domain classes; there are a handful of long-lived mutable objects.
`G` is the per-match world; `GAUNTLET` is the Circuit run that *wraps* matches;
`UI` is the interaction cursor; the rest are screen/session state.

```mermaid
classDiagram
  class G {
    +mode_duel_ffa_teams_raid_coop
    +venue_region_variant_deal_target
    +names_humans_viewer_dealer
    +players_seatList
    +raidBoss_raidDiff_archivist_exhaustHands
    +ledger_scores_handNum_over_lastShowdown
    +queue_stepMachine
    +events_cards_armed_activeSeat
  }
  class Player {
    +idx
    +hand_cardList
    +board_cardList
    +pool_red_white_blue_black
    +declared_active_removed_aiPlan
  }
  class Card {
    +id_type_fx
    +owner_origOwner_zone_faceUp
    +stones_appliedEffects
    +prov_known
  }
  class UI {
    +mode_interactionDispatcher
    +selected_pendingStone_blueOwn
    +flashIds
  }
  class GAUNTLET {
    +active_act_cleared_won_seed
    +standing_maxStanding_secondWindUsed
    +opp_foeHp_foeMax_foeCharms
    +deck_pouch_piles
    +ally_allyDeck_allies_allyDraft
    +coin_score_charms_shop_event_puzzle
    +map_curNode_venue
  }
  class SETUP {
    +step_venue_mode_players
    +targeting_deal_target_names_picks
  }
  class RAIDSET {
    +step_boss_ally_allyBot
    +diff_target_targeting_names
  }
  class TUT {
    +active_phase_seen_lesson
  }
  class KB {
    +els_idx_key
    +focusRingNavigation
  }
  G "1" *-- "2..4" Player : seats
  Player "1" *-- "0..n" Card : hand+board
  G ..> UI : reads interaction cursor
  GAUNTLET ..> G : builds each fight via newGame()
  SETUP ..> G : configures a custom match
  RAIDSET ..> G : configures a campaign raid
```

---

## 2. Subsystems — the function clusters

Ten clusters. Everything funnels through the **core hand loop**: Circuit and
Campaign are *drivers* that call `newGame()` and read the result; scoring, stone
effects, AI, and rendering are *services* the loop leans on each step;
persistence and dialogue are cross-cutting.

```mermaid
flowchart TD
  subgraph drivers["Drivers (game modes)"]
    CUSTOM["Custom match<br/>openSetup → newGame"]
    CIRCUIT["Circuit roguelike<br/>startCircuit · buildAct · map · shop · events"]
    CAMPAIGN["Campaign raids<br/>openRaidSetup · 6 bosses"]
    ACADEMY["Academy / tutorial<br/>LESSONS · demos"]
  end

  subgraph core["Core hand loop — queue state machine"]
    NEWGAME["newGame()"] --> STARTHAND["startHand() builds G.queue"]
    STARTHAND --> RUN["run() — cooperative runner"]
    RUN --> SHOWDOWN["showdown() / raidShowdown()"]
  end

  subgraph services["Per-step services"]
    SCORING["Scoring<br/>bestSelection · twoBestHands"]
    STONES["Stone effects<br/>applyStone · resolveArchivist"]
    AI["AI (_ai)<br/>estimate · aiChooseDeploy · aiPlace"]
    RENDER["Rendering<br/>render · renderBoard/Hand · modals"]
  end

  subgraph crosscut["Cross-cutting"]
    PERSIST["Persistence (localStorage)<br/>records · campaign · prefs"]
    DIALOGUE["Dialogue & settings gates"]
    INPUT["Keyboard nav (KB)"]
  end

  CUSTOM --> NEWGAME
  CIRCUIT --> NEWGAME
  CAMPAIGN --> NEWGAME
  ACADEMY --> NEWGAME

  RUN --> AI
  RUN --> STONES
  RUN --> RENDER
  SHOWDOWN --> SCORING
  STONES --> SCORING

  CIRCUIT -.reads/writes.-> PERSIST
  CAMPAIGN -.unlocks.-> PERSIST
  RENDER -.gated by.-> DIALOGUE
  RENDER -.driven by.-> INPUT
```

---

## 3. The hand loop — the core pattern

This is the heart of the whole codebase and the answer to "what patterns you've
got going on": a **cooperative coroutine over a work queue**. `startHand` picks
a queue *template* by game type and fills it with typed step objects
(`{t:'declare'|'deploy'|'place'|'thin'|'showdown'|…}`). `run()` walks the queue;
**AI seats resolve inline**, **human seats yield to the DOM** (the loop
`return`s; a `human*` handler mutates state and calls `run()` again). No blocking
— the browser event loop is the scheduler.

```mermaid
stateDiagram-v2
  [*] --> startHand : nextHand()
  startHand --> run : build G.queue<br/>(template per game type)

  state run {
    [*] --> peek
    peek --> done : queue empty / G.over
    peek --> humanBranch : stepNeedsHuman(step)
    peek --> aiBranch : else

    aiBranch --> executeStep : dramatic() spotlight,<br/>then shift()
    executeStep --> peek : AI resolves inline<br/>(aiDeclare/Deploy/Thin/Place)

    humanBranch --> promptHuman
    promptHuman --> yield : render() + return
    yield --> executeStep : human* handler<br/>mutates + calls run()
  }

  run --> showdown : t == 'showdown'
  showdown --> scoring : bestSelection /<br/>twoBestHands
  scoring --> resolve : move ledger / scores
  resolve --> [*] : match over?  →  showVictory
  resolve --> startHand : else next hand
```

Queue templates (the `else-if` ladder in `startHand`): **Standard** (declare →
deploy across Foundation/Veil/Final → thin → two place rounds → showdown),
**Raid Magistrate** (round-table deploys → telegraph → interleaved places, boss
last), **Archivist/Crucible** (stones onto empty slots first → commit cards →
`archresolve` forward *or* reverse), plus Gauntlet, Circuit, Precedence, and
Academy variants.

---

## 4. Raid bosses — one engine, six behaviours

All six campaign bosses share `raidShowdown` (party = seats 0+2 vs boss's two
best hands). Four of them just tune stone economy; the **Archivist** and
**Crucible** swap in a whole different resolution engine (`resolveArchivist` —
stones queue onto flat slots and fire in placement order, or reversed).

```mermaid
flowchart LR
  RS["raidShowdown()<br/>party two-hands vs boss two-hands"]
  RA["resolveArchivist()<br/>slot queue, forward/reverse"]

  RS --> MAG["Magistrate<br/>wide face-up board, no bluff"]
  RS --> WAR["Warden<br/>your stones exhaust 1 hand,<br/>its pouch stays full"]
  RS --> APO["Apothecary<br/>fewer stones + Green<br/>scalpel finale (apothcut)"]
  RS --> QM["Quartermaster<br/>locks 1 colour/hand<br/>red→white→blue→black"]
  RA --> ARC["Archivist<br/>inverted slot loop,<br/>reverse on Hardcore"]
  RA --> CRU["Crucible<br/>ALL layers at once,<br/>always reverse"]

  SD["Sudden Death (uniform)<br/>past hand 20 the swing doubles<br/>+ escalates toward the leader"] -.caps every boss.-> RS
  SD -.caps every boss.-> RA
```

---

## Notes for readers

- **Seeded RNG** (`seedRng`/`rnd`) makes Circuit runs reproducible (daily/shared
  seeds) and every battery/test deterministic.
- **`module.exports`** exposes the pure logic plus internal accessors
  (`_state`, `_ui`, `_gauntlet`, `_run`, `_ai`, `_personas`) so the `tests/`
  batteries can drive full all-AI matches headlessly — that's how balance
  (win-rates, turn-counts, map structure) is measured, not guessed.
- **Structure rules** (Circuit map generation) and **balance constants**
  (`CIRCUIT`, `RAID_DIFFS`, `CIRCUIT_MIN/MAX_FIGHTS`, `RAID_SUDDEN_DEATH`) are
  centralised so tuning is a small, testable surface rather than scattered magic
  numbers.
