'use strict';
/* The Circuit (Phase 0 endless gauntlet). Unit-tests the run wrapper's own
   logic with synthetic hand results (the underlying match engine for each venue
   is covered by simulate/precedence/etc.): Standing init, per-hand margin damage
   with shaping/cap, no damage on a won hand, ground-out, advance+heal+score on a
   cleared table, and that every venue in the rotation builds a clean gauntlet
   duel with the expected venue. */
const M = require('../game.js');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const DMG_CAP = 6; // mirrors CIRCUIT.dmgCap
const CIRCUIT_FOE_BASE = 10; // mirrors CIRCUIT.foeBase

// --- init ---
M.startCircuit();
let g = M._gauntlet();
assert(g.active && g.rung === 1 && g.score === 0, 'starts active at table 1, score 0');
assert(g.standing === g.maxStanding && g.standing > 0, 'starts at full Standing');
let G = M._state();
assert(G.gauntlet === true && G.nPlayers === 2, 'a rung is a flagged duel');
assert(G.venueKey === 'tavern', 'table 1 is the tavern');
assert(g.foeHp === g.foeMax && g.foeHp > 0, 'opponent starts at full Standing');
// loadout feeds the match: owned 10-card deck + 4-stone pouch as seat-0's pool
assert(g.deck && g.deck.length === 10, 'owned deck = one of each (8) + 2 picks = 10');
assert(g.pouch && ['red', 'white', 'blue', 'black'].reduce((s, c) => s + (g.pouch[c] || 0), 0) === 4, 'pouch holds 4 stones');
assert(['red', 'white', 'blue', 'black'].reduce((s, c) => s + (G.players[0].pool[c] || 0), 0) === 3, 'seat 0 draws a 3-stone working set from the 4-stone pouch each hand');

// --- two-pool damage: hands hit the LOSER's Standing, never the ledger ---
const youFull = g.standing, foeFull = g.foeHp;
M.circuitHandResult({ members: [1] }, 3);   // opponent wins the hand by 3 → your Standing -3
assert(g.standing === youFull - 3, 'a lost hand drains YOUR Standing by its margin');
assert(g.foeHp === foeFull, 'a lost hand does not touch the opponent (no double penalty / no un-doing)');
M.circuitHandResult({ members: [0] }, 4);   // you win by 4 → opponent Standing -4
assert(g.foeHp === foeFull - 4, 'a won hand drains the OPPONENT Standing');
assert(g.standing === youFull - 3, 'a won hand does not touch your Standing');
M.circuitHandResult({ members: [1] }, 99);  // blowout — capped
assert(g.standing === youFull - 3 - DMG_CAP, 'damage is shaped/capped both ways');

// --- ground-out (your Standing to 0) ends the table & run ---
let safety = 0;
while (g.standing > 0) { M.circuitHandResult({ members: [1] }, 99); if (safety++ > 50) assert(false, 'standing never drained'); }
assert(g.standing === 0 && g.groundOut && M._state().over === true, 'your Standing at 0 ends the table (ground out)');
M.circuitEnd();
g = M._gauntlet();
assert(!g.active, 'ground-out ends the run');

// --- clearing a table (opponent Standing to 0) advances, banks score, heals ---
M.startCircuit();
g = M._gauntlet();
g.standing = 5; // leave room to see the heal
const rung0 = g.rung, score0 = g.score;
safety = 0;
while (g.foeHp > 0) { M.circuitHandResult({ members: [0] }, 99); if (safety++ > 50) assert(false, 'foe never dropped'); }
assert(g.foeHp === 0 && g.tableCleared && M._state().over === true, 'dropping the opponent clears the table');
M.circuitEnd();
g = M._gauntlet();
assert(g.active && g.rung === rung0 + 1, 'a cleared table advances to the next');
assert(g.score > score0, 'a cleared table banks score');
assert(g.standing > 5 && g.standing <= g.maxStanding, 'a clear heals Standing, capped at max');
M.circuitRung(); // "Next table" — sets up the next opponent
g = M._gauntlet();
assert(g.foeHp === g.foeMax && g.foeMax > 0, 'the next opponent has fresh Standing');
assert(g.foeMax >= CIRCUIT_FOE_BASE, 'deeper tables field tougher opponents');

// --- venue rotation: every table builds a clean gauntlet duel ---
const VENUES = ['tavern', 'docks', 'slums', 'hall', 'court', 'academy'];
for (let i = 0; i < VENUES.length; i++) {
  const gg = M._gauntlet();
  gg.active = true; gg.rung = i + 1; gg.standing = gg.maxStanding; gg.opp = null;
  M.circuitRung();
  const Gr = M._state();
  assert(Gr.gauntlet && Gr.nPlayers === 2, `${VENUES[i]}: builds a gauntlet duel`);
  assert(Gr.venueKey === VENUES[i], `rung ${i + 1} rotates to ${VENUES[i]}, got ${Gr.venueKey}`);
  assert(Gr.players && Gr.players[0].board && Gr.players[1].board, `${VENUES[i]}: table dealt`);
}

// --- effect cards: per-card value overrides, base game untouched ---
const vals = { A: 1, B: 1, C: 1 };
const plain = M.bestSelection([{ type: 'A' }, { type: 'B' }, { type: 'C' }], vals, {});
assert(plain.raw === 3, 'plain cards score from the value table (no evalue → base game unchanged)');
const boosted = M.bestSelection([{ type: 'A', evalue: 3 }, { type: 'B' }, { type: 'C' }], vals, {});
assert(boosted.raw === 5, 'an effect card overrides its own value (3 + 1 + 1)');
const drained = M.bestSelection([{ type: 'A', evalue: 0 }, { type: 'B' }, { type: 'C' }], vals, {});
assert(drained.raw === 2, 'a drained card reads 0 but still fills a slot');

// applyCardEffects: keen kinship, lodestone neighbours, anchor pin, cross-board drain
M.startCircuit();
G = M._state();
const RV = G.region.values;
const T = M.TYPES;
function setBoards(b0, b1) { G.players[0].board = b0; G.players[1].board = b1; M.applyCardEffects(); }

// keen: +1 with a twin of its type, +0 alone
setBoards([{ type: T[0], fx: 'keen' }, { type: T[0] }, { type: T[1] }], [{ type: T[2] }, { type: T[3] }, { type: T[4] }]);
assert(G.players[0].board[0].evalue === RV[T[0]] + 1, 'keen +1 when it holds another of its type');
setBoards([{ type: T[0], fx: 'keen' }, { type: T[1] }, { type: T[2] }], [{ type: T[3] }, { type: T[4] }, { type: T[5] }]);
assert(G.players[0].board[0].evalue === RV[T[0]], 'keen is base value with no twin');

// anchor: pinned to 2 regardless of venue value
setBoards([{ type: T[0], fx: 'anchor' }, { type: T[1] }, { type: T[2] }], [{ type: T[3] }, { type: T[4] }, { type: T[5] }]);
assert(G.players[0].board[0].evalue === 2, 'anchor pins value to 2 regardless of venue');

// lodestone: +1 to each neighbour, itself unchanged
setBoards([{ type: T[0] }, { type: T[1], fx: 'lodestone' }, { type: T[2] }], [{ type: T[3] }, { type: T[4] }, { type: T[5] }]);
assert(G.players[0].board[0].evalue === RV[T[0]] + 1 && G.players[0].board[2].evalue === RV[T[2]] + 1, 'lodestone lifts both neighbours');
assert(G.players[0].board[1].evalue === RV[T[1]], 'lodestone does not lift itself');

// drain: the facing same-slot card on the opposing board reads -1
setBoards([{ type: T[0] }, { type: T[1] }, { type: T[2] }], [{ type: T[3], fx: 'drain' }, { type: T[4] }, { type: T[5] }]);
assert(G.players[0].board[0].evalue === Math.max(0, RV[T[0]] - 1), 'drain knocks the facing same-slot card down by 1');
assert(G.players[0].board[1].evalue === RV[T[1]], 'drain only touches the facing slot');
// a drain card stolen onto the other board (origOwner != current board) goes inert
setBoards([{ type: T[0] }, { type: T[1] }, { type: T[2] }], [{ type: T[3], fx: 'drain', origOwner: 0 }, { type: T[4] }, { type: T[5] }]);
assert(G.players[0].board[0].evalue === RV[T[0]], 'a stolen drain card does not turn on its owner — it goes inert off its home board');

// loadout now deals effect cards and threads them into the owned deck
M.startCircuit();
g = M._gauntlet();
const fxInDeck = g.deck.filter(c => c && typeof c === 'object' && c.fx).length;
assert(fxInDeck === 2, 'the owned deck carries the two chosen effect cards');

// --- depleting decks: draw → discard → reshuffle, conserved across cycles ---
M.startCircuit();
g = M._gauntlet();
M.circuitResetPiles();
let you = g.piles[0];
const deckN = g.deck.length;
assert(you.cardDraw.length === deckN && you.cardDiscard.length === 0 && you.cardHand === null, 'reset shuffles the whole deck into the draw pile');
M.circuitDrawCards(4);
assert(you.cardDraw.length === deckN - 4 && you.cardDiscard.length === 0, 'drawn cards leave the draw pile; nothing discarded yet');
assert(you.cardHand.length === 4, 'a hand of 4 was drawn');
M.circuitDrawCards(4);
assert(you.cardDiscard.length === 4, "the previous hand discards before the next draw");
// keep drawing through a reshuffle; the deck is always conserved
for (let i = 0; i < 12; i++) M.circuitDrawCards(4);
assert(you.cardDraw.length + you.cardDiscard.length + you.cardHand.length === deckN, 'cards are conserved across reshuffles (no loss, no duplication)');
assert(you.cardDiscard.length > 0 && you.cardDraw.length >= 0, 'the discard reshuffles back in once the draw pile runs dry');

// stones deplete the same way: a 4-stone pouch, drawing 3, cycles and conserves
const STONE_KEYS = ['red', 'white', 'blue', 'black'];
const pouchN = STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0);
M.circuitResetPiles();
you = g.piles[0];
assert(you.stoneDraw.length === pouchN, 'reset flattens the whole pouch into the stone draw pile');
const d1 = M.circuitDrawStones(3);
assert(STONE_KEYS.reduce((s, c) => s + d1[c], 0) === 3, 'draws a 3-stone working set');
for (let i = 0; i < 8; i++) M.circuitDrawStones(3);
assert(you.stoneDraw.length + you.stoneDiscard.length + you.stoneHand.length === pouchN, 'stones are conserved across reshuffles');

// --- the opponent fields its own build (depleting deck + leaning pouch) ---
M.startCircuit();
M.circuitRung(); // sets up an opponent build for the current table
g = M._gauntlet();
assert(g.piles[1], 'the foe has its own pile set');
assert(g.oppDeck.length === 10, 'the foe owns a 10-card deck (one of each + 2 effect cards)');
const p1 = g.piles[1];
assert(p1.cardDraw.length + p1.cardDiscard.length + (p1.cardHand ? p1.cardHand.length : 0) === 10, 'the foe deck is conserved through the deal');
const oppPouchN = STONE_KEYS.reduce((s, c) => s + (g.oppPouch[c] || 0), 0);
assert(oppPouchN === 4, 'the foe pouch holds 4 stones');
// the foe draws a 3-stone working set too (check the drawn hand, not the live
// pool — the AI may already have telegraphed/spent from it by now)
assert(p1.stoneHand && p1.stoneHand.length === 3, 'the foe also draws a 3-stone working set, not the default 8');
// a named build is themed (the Ferryman leans Blue and runs an effect card)
const fb = M.circuitBuildFor('The Ferryman');
assert(fb.pouch.blue >= 2, "the Ferryman's build leans Blue");
assert(fb.deck.filter(c => c && typeof c === 'object' && c.fx).length === 2, 'a named build packs two effect cards');

// --- between-table spoils grow the owned deck/pouch (or skip cleanly) ---
M.startCircuit();
g = M._gauntlet();
const deck0 = g.deck.length, pouch0 = STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0);
// skip path: a reward with no picks leaves the decks untouched
g.reward = { cards: [], stones: [], cardPick: null, stonePick: null };
M.circuitTakeRewardAndAdvance();
g = M._gauntlet();
assert(g.deck.length === deck0 && STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0) === pouch0, 'skipping spoils leaves the deck and pouch unchanged');
// take path: a card + a stone grow each by one
g.reward = { cards: [], stones: [], cardPick: { type: 'Coin', fx: 'keen' }, stonePick: 'white' };
const deck1 = g.deck.length, white1 = g.pouch.white || 0;
M.circuitTakeRewardAndAdvance();
g = M._gauntlet();
assert(g.deck.length === deck1 + 1, 'taking a card adds it to the owned deck');
assert((g.pouch.white || 0) === white1 + 1, 'taking a stone adds it to the pouch');
assert(g.piles[0].cardDraw.length + g.piles[0].cardDiscard.length + (g.piles[0].cardHand ? g.piles[0].cardHand.length : 0) === deck1 + 1, 'the next table draws from the grown deck');
const fx = M.makeReward();
assert(fx.cards.length === 3 && fx.stones.length === 2, 'a spoils offer is 3 cards and 2 stones');

// --- interlude event: thin a card, thin a stone, heal, move a modifier ---
M.startCircuit();
g = M._gauntlet();
// heal restores 60% of max, rounded up, capped at max
g.standing = 2;
assert(M.circuitHealAmount() === Math.ceil(g.maxStanding * 0.6), 'heal is ceil(60% of max Standing)');
g.event = { choice: 'heal' };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert(g.standing === 2 + Math.ceil(g.maxStanding * 0.6), 'healing restores the rounded-up 60%');
// remove a card thins the owned deck
const dN = g.deck.length;
g.event = { choice: 'removeCard', cardIdx: 0 };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert(g.deck.length === dN - 1, 'remove-a-card thins the owned deck by one');
// move a modifier: lift the fx off an effect card onto a plain one
const srcI = g.deck.findIndex(s => s && typeof s === 'object' && s.fx);
const dstI = g.deck.findIndex(s => !(s && typeof s === 'object' && s.fx));
const movedFx = g.deck[srcI].fx;
g.event = { choice: 'moveMod', srcIdx: srcI, dstIdx: dstI };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert(!(g.deck[srcI] && typeof g.deck[srcI] === 'object' && g.deck[srcI].fx), 'the source card is left plain after a move');
assert(g.deck[dstI] && g.deck[dstI].fx === movedFx, 'the destination card gains the moved modifier');
// remove a stone is floored at the draw size (no footgun below drawStones)
g.pouch = { red: 1, white: 1, blue: 1 }; // exactly at the floor (3)
g.event = { choice: 'removeStone', stoneColor: 'red' };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert((g.pouch.red || 0) === 1, 'removing a stone is refused at the draw-size floor');
g.pouch = { red: 2, white: 1, blue: 1 }; // 4 — above the floor
g.event = { choice: 'removeStone', stoneColor: 'red' };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert((g.pouch.red || 0) === 1, 'removing a stone above the floor thins the pouch');

console.log('OK circuit: Standing init/damage/cap/ground-out, clear→advance+heal+score, 6 venues build clean, and effect cards score.');
