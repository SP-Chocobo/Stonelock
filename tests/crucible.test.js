'use strict';
/* The Crucible super boss: every layer at once — the inverted slot loop resolved
   in REVERSE, colour-denial each hand, one-hand exhaustion, the boss's lone Green
   scalpel, deep draw + forced advanced. Drives full all-AI matches and asserts the
   stack functions end-to-end (boards intact, green can land, nothing lingers, the
   match terminates). Balance is intentionally untuned here — this is a "does it
   run with all layers on" check. */
const M = require('../game.js');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

let greenLandings = 0, matches = 0;
for (let i = 0; i < 8; i++) {
  M.newGame({ mode: 'raid', raidBoss: 'crucible', raidAlly: 'bot', allyBot: 'The Old Hand', raidDiff: 'hard', target: 12 });
  const G = M._state(); G.humans = [];
  assert(G.deal === 'house', 'Crucible forces the deep draw');
  assert(G.open === true, 'Crucible forces advanced targeting');
  assert(G.exhaustHands === 1, 'Crucible exhausts stones for one hand');
  let guard = 0;
  while (!G.over) {
    if (guard++ > 120000) assert(false, 'Crucible did not terminate');
    if (!G.queue.length) {
      assert(G.players[1].board.length === 9, 'boss fields nine, got ' + G.players[1].board.length);
      assert(G.players[0].board.length === 5 && G.players[2].board.length === 5, 'party fields its full deep footprint (5)');
      assert(!G.archivist, 'slot mode cleared after the hand');
      assert(G.players.flatMap(p => p.board).every(c => !c.queued || !c.queued.length), 'no pending stones linger');
      if (G.players.flatMap(p => p.board).some(c => c.stones.some(s => s.color === 'green'))) greenLandings++;
      M.nextHand();
      continue;
    }
    M._run();
  }
  assert(Math.abs(G.ledger) >= G.target, 'Crucible match ends at target');
  matches++;
}
assert(greenLandings > 0, 'the boss Green scalpel lands at least once across the run');
console.log(`OK crucible: ${matches} all-layers matches ran end-to-end; green landed in ${greenLandings} scored hands.`);
