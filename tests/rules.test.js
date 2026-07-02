'use strict';
/* Targeted rule checks on a live game state. */
const M = require('../game.js');

let fails = 0;
function check(name, cond) {
  if (!cond) { fails++; console.log(`FAIL ${name}`); }
  else console.log(`ok   ${name}`);
}

M.newGame({ mode: 'duel', deal: 'small', target: 10, region: 'bar' });
const G = M._state();

// Fabricate a mid-hand board state directly on the engine's state.
function mkCard(id, type, owner) {
  const c = { id, type, owner, zone: 'board', faceUp: true, stones: [], prov: null, known: [true, true] };
  G.cards.push(c);
  G.players[owner].board.push(c);
  return c;
}
G.players[0].board.length = 0;
G.players[1].board.length = 0;
const myRoad = mkCard(900, 'Road', 0);
const hisFerry = mkCard(901, 'Ferry', 1);
const bystander = mkCard(902, 'Bread', 1);

// A blue trade occurred between myRoad and hisFerry.
const blueEv = { id: 500, color: 'blue', actor: 1, undone: false, cards: [myRoad, hisFerry], give: hisFerry, take: myRoad };
G.events.push(blueEv);

check('trade is undoable from either traded card',
  M.undoableEventFor(myRoad) === blueEv && M.undoableEventFor(hisFerry) === blueEv);
check('bystander card has nothing to undo', M.undoableEventFor(bystander) === null);

// Rules clarification: locking EITHER traded card shields the whole
// trade from a Black Stone.
hisFerry.stones.push({ color: 'white', by: 1 });
check('locking one traded card blocks black on both',
  M.undoableEventFor(myRoad) === null && M.undoableEventFor(hisFerry) === null);
check('locked card reads as locked', M.isLocked(hisFerry));

hisFerry.stones.pop();
check('unlocking restores undoability', M.undoableEventFor(myRoad) === blueEv);

// A red placed AFTER the trade is the "last stone" on that card —
// black through that card hits the red, not the trade.
const redEv = { id: 501, color: 'red', actor: 0, undone: false, cards: [myRoad] };
myRoad.stones.push({ color: 'red', by: 0 });
G.events.push(redEv);
check('latest stone on a card takes precedence', M.undoableEventFor(myRoad) === redEv);
check('partner card still reaches the trade', M.undoableEventFor(hisFerry) === blueEv);

// Team opposition map
M.newGame({ mode: 'teams', deal: 'small', target: 10, region: 'bar' });
check('teams: seat 2 is your partner', !M.isOpponent(0, 2));
check('teams: seats 1 and 3 oppose you', M.isOpponent(0, 1) && M.isOpponent(0, 3));
M.newGame({ mode: 'ffa', deal: 'small', target: 10, region: 'bar' });
check('ffa: everyone opposes everyone', M.isOpponent(0, 1) && M.isOpponent(1, 2) && M.isOpponent(2, 3));

// A3 regression: a trade whose partner card was RE-TRADED away can't be unwound
// (the trail is cold — else Black would teleport a card to a seat never in the
// original trade). Real events carry giveOwner/takeOwner; synthetic ones (above)
// don't, so the guard is opt-in and the earlier trade tests still pass.
{
  const Gf = M._state();
  const mk = (id, owner) => { const c = { id, type: 'Coin', owner, zone: 'board', faceUp: true, stones: [], prov: null, known: [true, true, true, true] }; Gf.cards.push(c); return c; };
  const A = mk(920, 1), B = mk(921, 3), C = mk(922, 0); // post-state after two trades
  // event1: You(0) traded A↔B; post-trade A sat on seat 1, B on seat 0.
  Gf.events.push({ id: 600, color: 'blue', actor: 0, undone: false, cards: [A, B], give: A, take: B, giveOwner: 1, takeOwner: 0 });
  // event2: seat 2 then re-traded B away (B now on seat 3) — the first trade is cold.
  Gf.events.push({ id: 601, color: 'blue', actor: 2, undone: false, cards: [C, B], give: C, take: B, giveOwner: 0, takeOwner: 3 });
  check('A3: a re-traded partner makes the earlier trade un-unwindable (no teleport)', M.undoableEventFor(A) === null);
  // The intact (later) trade is still unwindable from its own cards.
  check('A3: the intact trade still unwinds from its partner', M.undoableEventFor(C) && M.undoableEventFor(C).id === 601);
}

process.exit(fails ? 1 : 0);
