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

process.exit(fails ? 1 : 0);
