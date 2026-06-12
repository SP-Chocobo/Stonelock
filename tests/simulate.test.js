'use strict';
/* Headless full-match simulation: a random-but-legal "human" plays
   complete matches against the AI. Asserts structural invariants. */
const M = require('../game.js');

const STONE_KEYS = ['red', 'white', 'blue', 'black'];
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function assert(cond, msg, ctx) {
  if (!cond) {
    console.error('ASSERT FAIL:', msg, ctx || '');
    process.exit(1);
  }
}

let showdowns = 0, blacksUsed = 0, bluesUsed = 0;

function driveOne(region, target) {
  M.newGame(region, target);
  let guard = 0;
  while (true) {
    if (guard++ > 20000) { assert(false, 'game did not terminate'); }
    const G = M._state(), UI = M._ui();

    if (G.over) break;
    if (!G.queue.length) {
      // showdown finished — validate the table
      showdowns++;
      for (const p of G.players) {
        assert(p.board.length === 4, 'board must hold 4 cards', p.board.length);
        assert(p.board.every(c => c.faceUp), 'all cards flipped at showdown');
        assert(p.hand.length === 0, 'hand empty at showdown');
        assert(p.active.length === 0 || p.active.length <= 2, 'active stones sane');
      }
      const total = G.players[0].board.length + G.players[1].board.length;
      assert(total === 8, 'cards conserved across swaps', total);
      assert(Math.abs(G.ledger) <= G.target, 'ledger clamped');
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
  assert(Math.abs(G.ledger) >= G.target, 'match ends at target');
}

// pick-and-remove helper so deploy never double-toggles the same card
function rnd0(arr) { const i = Math.floor(Math.random() * arr.length); return arr.splice(i, 1)[0]; }

function placeTargets(color) {
  const G = M._state(), UI = M._ui();
  const mine = () => G.players[0].board.filter(c => !M.isLocked(c));
  const theirs = () => G.players[1].board.filter(c => !M.isLocked(c));
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

const regions = ['bar', 'house', 'dock'];
for (let i = 0; i < 120; i++) {
  driveOne(regions[i % 3], 10);
}
console.log(`OK: 120 full matches completed. showdowns=${showdowns} blue-placed=${bluesUsed} black-undos=${blacksUsed}`);
