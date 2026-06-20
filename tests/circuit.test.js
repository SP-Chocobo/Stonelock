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

// --- init ---
M.startCircuit();
let g = M._gauntlet();
assert(g.active && g.rung === 1 && g.score === 0, 'starts active at table 1, score 0');
assert(g.standing === g.maxStanding && g.standing > 0, 'starts at full Standing');
let G = M._state();
assert(G.gauntlet === true && G.nPlayers === 2, 'a rung is a flagged duel');
assert(G.target === 10 && G.venueKey === 'tavern', 'table 1 is tavern, race to 10');

// --- per-hand margin damage (shaped + capped) ---
const full = g.standing;
M.circuitHandResult({ members: [1] }, 3);   // you lose the hand by 3
assert(g.standing === full - 3, 'a lost hand drains Standing by its margin');
M.circuitHandResult({ members: [1] }, 99);  // blowout — capped
assert(g.standing === full - 3 - DMG_CAP, 'damage is shaped/capped, one hand cannot nuke the run');
M.circuitHandResult({ members: [0] }, 5);   // you win the hand
assert(g.standing === full - 3 - DMG_CAP, 'winning a hand costs no Standing');

// --- ground-out ends the rung ---
let safety = 0;
while (g.standing > 0) { M.circuitHandResult({ members: [1] }, 99); if (safety++ > 50) assert(false, 'standing never drained'); }
assert(g.standing === 0 && M._state().over === true, 'Standing hitting 0 ends the rung (ground out)');
M.circuitEnd();
g = M._gauntlet();
assert(!g.active, 'ground-out ends the run');

// --- clearing a table advances, banks score, heals (capped) ---
M.startCircuit();
g = M._gauntlet(); G = M._state();
g.standing = 4; // leave room to see the heal
const rung0 = g.rung, score0 = g.score;
G.ledger = G.target; // simulate driving the marker home
M.circuitEnd();
g = M._gauntlet();
assert(g.active && g.rung === rung0 + 1, 'a cleared table advances to the next');
assert(g.score > score0, 'a cleared table banks score');
assert(g.standing > 4 && g.standing <= g.maxStanding, 'a clear heals Standing, capped at max');

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
