'use strict';
/* Soak / fuzz harness. Drives a HUMAN seat with random-but-legal input across
   every match shape — duel, ffa, teams, all six raid bosses, and a Circuit fight
   seeded with variant + Green stones — asserting for each match:
     · no handler throws,
     · the queue always advances (no soft-lock),
     · the board state stays sane (every committed card lives in exactly one
       board slot, no NaN on the ledger/scores),
     · the match terminates.
   This automates the whole bug-class the manual audit turned up by hand
   (C1 no-target stones, C2 arch-commit resume, C3 Green targeting): those were
   all "a human input path soft-locks / throws in a mode the all-AI batteries
   never exercise." Run:  node tests/fuzz.test.js   ·   N=20 node tests/fuzz.test.js */
const M = require('../game.js');
M.setAlphaUnlock(true);
// startHand() reassigns the module-level UI to a fresh object every hand, so a
// captured reference goes stale — always read it live through the accessor.
const ui = () => M._ui();

const N = +(process.env.N || 8);
let fails = 0, matches = 0, totalHands = 0;
function fail(msg) { fails++; console.log(`FAIL ${msg}`); }

// A local seeded PRNG for the driver's OWN choices, kept separate from the game's
// seeded RNG so fuzzing the input doesn't perturb the deal. Deterministic: a
// failing match reprints its (matchSeed) so the exact run can be replayed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R = Math.random;
const pick = arr => arr[Math.floor(R() * arr.length)];
const range = n => Array.from({ length: n }, (_, i) => i);
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// The modes promptHuman parks the queue on, waiting for input. target-*/arch-slot*
// modes are transient (entered and cleared inside a single driveHumanStep), so they
// never appear as a top-level parked mode.
const HUMAN_MODES = new Set(['pass', 'pickStone', 'pickCards', 'thin', 'placeChoose', 'arch-commit', 'handedit', 'disrupt']);
const isTargetMode = m => m.startsWith('target') || m.startsWith('arch-slot');

// Global slot index range for the Archivist/precedence slot engine: seat footprints
// are fixed for the hand, so a slot index is (sum of prior boards' lengths) + pos.
function slotTotal(G) { return G.players.reduce((s, p) => s + p.board.length, 0); }
function ownOffset(G, seat) { let acc = 0; for (let s = 0; s < seat; s++) acc += G.players[s].board.length; return acc; }
const allBoardCards = G => G.players.flatMap(p => p.board).filter(Boolean);

// Spend a pending stone: try every candidate target (card, or slot in the arch
// engine) until a handler accepts one and the queue advances. If nothing is a
// legal target — the C1 case — set it down for no effect. A two-step stone (Blue,
// Riptide, arch Blue swap) advances its own mode between clicks, which the loop
// detects as progress and continues resolving.
function resolveStone(G) {
  const UI = ui();
  let guard = 0;
  while (UI.pendingStone != null && isTargetMode(UI.mode) && guard++ < 400) {
    const before = UI.mode;
    let progressed = false;
    if (before.startsWith('arch-slot')) {
      for (const gi of shuffled(range(slotTotal(G)))) {
        M.humanTargetSlot(gi);
        if (UI.mode !== before || UI.pendingStone == null) { progressed = true; break; }
      }
    } else {
      for (const card of shuffled(allBoardCards(G))) {
        M.humanTargetCard(card);
        if (UI.mode !== before || UI.pendingStone == null) { progressed = true; break; }
      }
    }
    if (!progressed) { M.humanDiscardStone(); break; }
  }
}

// The Archivist commit: repeatedly pick a hand card and drop it into one of your
// own empty slots, until the step's count is satisfied (handler flips mode off
// arch-commit and advances the queue on the last one).
function commitAll(G) {
  const UI = ui();
  let guard = 0;
  while (UI.mode === 'arch-commit' && guard++ < 60) {
    const seat = G.viewer, p = G.players[seat];
    if (!p.hand.length) break;
    M.humanPickCommitCard(pick(p.hand));
    const off = ownOffset(G, seat);
    let placed = false;
    for (let pos = 0; pos < p.board.length; pos++) {
      if (!p.board[pos]) { M.humanTargetSlot(off + pos); placed = true; break; }
    }
    if (!placed) break; // no empty slot — shouldn't happen while count > 0
  }
}

function driveHumanStep(G) {
  const UI = ui();
  const seat = G.viewer, p = G.players[seat], step = G.queue[0];
  switch (UI.mode) {
    case 'pass':
      M.passConfirm();
      break;
    case 'pickStone': {
      const cols = Object.keys(p.pool).filter(c => p.pool[c] > 0);
      if (!cols.length) throw new Error('declare with an empty pool');
      M.humanDeclare(pick(cols));
      break;
    }
    case 'pickCards': {
      const need = step.count;
      UI.selected.length = 0;
      for (const c of shuffled(p.hand).slice(0, need)) M.humanToggleCard(c);
      M.humanConfirmDeploy();
      break;
    }
    case 'thin':
      M.humanThin(Math.floor(R() * p.declared.length));
      break;
    case 'placeChoose':
      M.humanChooseStone(pick(p.active));
      resolveStone(G);
      break;
    case 'arch-commit':
      commitAll(G);
      break;
    case 'handedit': {
      const max = Math.min(step.max, p.hand.length);
      const k = Math.floor(R() * (max + 1)); // 0..max — sometimes keep the hand
      UI.selected.length = 0;
      for (const c of shuffled(p.hand).slice(0, k)) M.humanToggleCard(c);
      M.humanConfirmHandEdit();
      break;
    }
    case 'disrupt':
      UI.selected.length = 0;
      if (R() < 0.5 && p.hand.length) M.humanToggleCard(pick(p.hand)); // else pass
      M.humanConfirmDisrupt();
      break;
    default:
      throw new Error('unexpected parked human mode: ' + UI.mode);
  }
}

// Every committed card must live in exactly one board slot, and the running
// tallies must stay finite. Cheap enough to run each queue step.
function assertSane(G, label) {
  const seen = new Map();
  for (const p of G.players) {
    for (const c of p.board) {
      if (!c) continue; // arch slots hold nulls
      if (c.zone !== 'board') throw new Error(`${label}: board card ${c.id} has zone ${c.zone}`);
      if (seen.has(c.id)) throw new Error(`${label}: card ${c.id} sits in two boards`);
      seen.set(c.id, p.idx);
    }
  }
  if (!Number.isFinite(G.ledger)) throw new Error(`${label}: ledger is ${G.ledger}`);
  if (G.scores.some(s => !Number.isFinite(s))) throw new Error(`${label}: a score is non-finite`);
}

function runMatch(label, setup) {
  setup();
  const G = M._state();
  let guard = 0, stuck = 0, lastKey = '';
  while (!G.over) {
    if (guard++ > 300000) throw new Error(`${label}: guard blew — non-terminating`);
    if (!G.queue.length) { M.nextHand(); continue; }
    M._run(); // advance AI steps until the next human gate or the queue drains
    if (G.over || !G.queue.length) { assertSane(G, label); continue; }
    const UI = ui();
    if (HUMAN_MODES.has(UI.mode)) driveHumanStep(G);
    // else: run() parked on a dramatic-pause step; the next _run() proceeds.
    assertSane(G, label);
    const key = `${G.handNum}/${G.queue.length}/${UI.mode}/${G.queue[0] && G.queue[0].t}`;
    if (key === lastKey) { if (++stuck > 800) throw new Error(`${label}: soft-lock at ${key}`); }
    else stuck = 0;
    lastKey = key;
  }
  assertSane(G, label);
  matches++; totalHands += G.handNum;
  return G.handNum;
}

// A Circuit fight seeded so the human draws the newest, riskiest stone keys —
// variants (Twin Red / Onyx / Riptide / Deadbolt) and the Green scalpel — over a
// real Standing-depletion fight. Exercises the C1/C3 resolution paths a human hits.
function setupVariantCircuit(seed) {
  M.seedRng(4000 + seed);
  M.startCircuit();
  const g = M._gauntlet();
  g.act = 1;
  g.deck = M.TYPES.slice();
  g.pouch = { twinred: 1, onyx: 1, riptide: 1, deadbolt: 1, green: 2, red: 1, white: 1, blue: 1, black: 1 };
  g.charms = g.charms || [];
  const foe = 'The Tinker';
  const build = M.circuitBuildFor(foe);
  g.opp = foe; g.oppDeck = build.deck; g.oppPouch = build.pouch;
  g.foeMax = 8; g.foeHp = 8; g.foeCharms = [];
  g.curNode = { type: 'fight', col: 1, idx: 0, foe };
  g.standing = g.maxStanding;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [0], companyNames: [foe], venue: g.venue || 'slums', deal: 'small', target: 999, gauntlet: true });
}

// Same seeded variant/Green pouch, but at the Court of Precedence (stone-first):
// the slot engine now resolves every variant in full, so this drives a human
// through arch-slot placement + arch-commit with Twin Red / Deadbolt / Riptide /
// Onyx / Green in the ledger — the whole A4 "variants in the slot engine" path.
function setupVariantCourt(seed) {
  M.seedRng(5000 + seed);
  M.startCircuit();
  const g = M._gauntlet();
  g.act = 3;
  g.deck = M.TYPES.slice();
  g.pouch = { twinred: 1, onyx: 1, riptide: 1, deadbolt: 1, green: 1, red: 1, white: 1, blue: 1, black: 1 };
  g.charms = g.charms || [];
  const foe = 'The Clerk';
  const build = M.circuitBuildFor(foe);
  g.opp = foe; g.oppDeck = build.deck; g.oppPouch = build.pouch;
  g.foeMax = 8; g.foeHp = 8; g.foeCharms = [];
  g.curNode = { type: 'fight', col: 1, idx: 0, foe };
  g.standing = g.maxStanding;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [0], companyNames: [foe], venue: 'court', deal: 'small', target: 999, gauntlet: true });
}

const RAID_BOSSES = ['magistrate', 'warden', 'apothecary', 'archivist', 'quartermaster', 'crucible'];

for (let s = 1; s <= N; s++) {
  R = mulberry32(0x51ED * s + 7);
  const jobs = [
    ['duel', () => M.newGame({ mode: 'duel', humans: [0], deal: 'small', target: 10, region: 'bar' })],
    ['ffa', () => M.newGame({ mode: 'ffa', humans: [0], deal: 'small', target: 10, region: 'bar' })],
    ['teams', () => M.newGame({ mode: 'teams', humans: [0], deal: 'small', target: 10, region: 'bar' })],
    ['circuit+variants', () => setupVariantCircuit(s)],
    ['court+variants', () => setupVariantCourt(s)],
  ];
  for (const boss of RAID_BOSSES) {
    jobs.push([`raid:${boss}`, () => M.newGame({ mode: 'raid', raidBoss: boss, target: 15 })]);
  }
  for (const [label, setup] of jobs) {
    try {
      runMatch(`${label}#${s}`, setup);
    } catch (e) {
      fail(`${label}#${s} — ${e.message}`);
    }
  }
}
M.clearRng();

console.log(`\nfuzz: ${matches} matches driven, ${totalHands} hands total, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
