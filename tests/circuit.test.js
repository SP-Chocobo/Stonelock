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
assert(['red', 'white', 'blue', 'black'].reduce((s, c) => s + (G.players[0].pool[c] || 0), 0) === 4, 'seat 0 spends from the 4-stone pouch, not the default 8');

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

console.log('OK circuit: Standing init/damage/cap/ground-out, clear→advance+heal+score, and all 6 venue tables build clean.');
