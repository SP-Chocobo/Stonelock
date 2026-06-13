'use strict';
/* Headless full-match simulation across all formats: a random-but-
   legal "human" plays complete matches against the AI. Asserts
   structural invariants at every showdown. */
const M = require('../game.js');

const STONE_KEYS = ['red', 'white', 'blue', 'black'];
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function assert(cond, msg, ctx) {
  if (!cond) {
    console.error('ASSERT FAIL:', msg, ctx === undefined ? '' : ctx);
    process.exit(1);
  }
}

let showdowns = 0, blacksUsed = 0, bluesUsed = 0;

function driveOne(cfg) {
  M.newGame(cfg);
  const footprint = cfg.deal === 'house' ? 5 : 4;
  let guard = 0;
  while (true) {
    if (guard++ > 60000) { assert(false, 'game did not terminate', cfg); }
    const G = M._state();

    if (G.over) break;
    if (!G.queue.length) {
      // showdown finished — validate the table
      showdowns++;
      for (const p of G.players) {
        assert(p.board.length === footprint, 'board holds the full footprint', p.board.length);
        assert(p.board.every(c => c.faceUp), 'all cards flipped at showdown');
        assert(p.hand.length === 0, 'hand empty at showdown');
        assert(p.active.length === 0, 'all active stones resolved');
      }
      const total = G.players.reduce((s, p) => s + p.board.length, 0);
      assert(total === G.nPlayers * footprint, 'cards conserved across swaps', total);
      if (G.mode !== 'ffa') assert(Math.abs(G.ledger) <= G.target, 'ledger clamped');
      M.nextHand();
      continue;
    }

    const step = G.queue[0];
    switch (step.t) {
      case 'declare': {
        assert(step.who === 0, 'engine should only wait on human declare');
        const p = G.players[0];
        const avail = STONE_KEYS.filter(c => p.pool[c] > 0);
        assert(avail.length > 0, 'pool not exhausted');
        M.humanDeclare(rnd(avail));
        break;
      }
      case 'deploy': {
        const p = G.players[0];
        const picks = p.hand.slice();
        for (let i = 0; i < step.count; i++) M.humanToggleCard(rnd0(picks));
        M.humanConfirmDeploy();
        break;
      }
      case 'thin':
        M.humanThin(Math.floor(Math.random() * 3));
        break;
      case 'place': {
        const p = G.players[0];
        assert(p.active.length > 0, 'place step waits only with stones in hand');
        const color = rnd(p.active);
        M.humanChooseStone(color);
        placeTargets(color);
        break;
      }
      default:
        assert(false, 'engine stuck on non-human step', step.t);
    }
  }
  const G = M._state();
  if (G.mode === 'ffa') assert(G.scores.some(s => s >= G.target), 'ffa match ends at target');
  else assert(Math.abs(G.ledger) >= G.target, 'match ends at target');
}

// pick-and-remove helper so deploy never double-toggles the same card
function rnd0(arr) { const i = Math.floor(Math.random() * arr.length); return arr.splice(i, 1)[0]; }

function placeTargets(color) {
  const G = M._state();
  const mine = () => G.players[0].board.filter(c => !M.isLocked(c));
  const theirs = () => G.players
    .filter(p => M.isOpponent(0, p.idx))
    .flatMap(p => p.board)
    .filter(c => !M.isLocked(c));
  if (color === 'white') {
    const t = mine();
    if (!t.length) return M.humanDiscardStone();
    M.humanTargetCard(rnd(t));
  } else if (color === 'red') {
    const t = mine().filter(c => !c.stones.some(s => s.color === 'red'));
    if (!t.length) return M.humanDiscardStone();
    M.humanTargetCard(rnd(t));
  } else if (color === 'blue') {
    bluesUsed++;
    const own = mine(), opp = theirs();
    if (!own.length || !opp.length || Math.random() < 0.1) return M.humanDiscardStone();
    M.humanTargetCard(rnd(own));
    M.humanTargetCard(rnd(opp));
  } else if (color === 'black') {
    const targets = G.players.flatMap(p => p.board).filter(c => M.undoableEventFor(c));
    if (!targets.length || Math.random() < 0.2) return M.humanDiscardStone();
    blacksUsed++;
    M.humanTargetCard(rnd(targets));
  }
}

const matrix = [
  { mode: 'duel', deal: 'small', venue: 'tavern' },
  { mode: 'duel', deal: 'house', venue: 'docks' },
  { mode: 'ffa', deal: 'small', venue: 'hall' },
  { mode: 'ffa', deal: 'house', venue: 'slums' },
  { mode: 'teams', deal: 'small', venue: 'court' },
  { mode: 'teams', deal: 'house', venue: 'slums' },
  { mode: 'duel', deal: 'small', venue: 'academy' },
  { mode: 'ffa', deal: 'house', venue: 'academy' },
];
for (let i = 0; i < 64; i++) {
  driveOne({ ...matrix[i % matrix.length], target: 10 });
}
console.log(`OK: 64 full matches across 8 format/venue combos. showdowns=${showdowns} blue-placed=${bluesUsed} black-undos=${blacksUsed}`);
