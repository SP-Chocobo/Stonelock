'use strict';
/* Raid Boss (The Magistrate) regression: drive full co-op matches with
   random-but-legal party play and assert the boss's structure. */
const M = require('../game.js');
const STONE_KEYS = ['red', 'white', 'blue', 'black'];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const rnd0 = a => a.splice(Math.floor(Math.random() * a.length), 1)[0];
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

let teamWins = 0, bossWins = 0, hands = 0;
for (let i = 0; i < 30; i++) {
  M.newGame({ mode: 'raid', raidAlly: i % 2 ? 'hotseat' : 'bot', target: 10 });
  let guard = 0;
  while (true) {
    if (guard++ > 40000) assert(false, 'raid did not terminate');
    const G = M._state();
    if (G.over) break;
    if (!G.queue.length) {
      hands++;
      assert(G.players[1].board.length === 7, 'Magistrate fields seven, got ' + G.players[1].board.length);
      assert(G.players[0].board.length === 4 && G.players[2].board.length === 4, 'party fields four each');
      assert(M.isOpponent(0, 1) && !M.isOpponent(0, 2), 'party allied, boss opposed');
      M.nextHand();
      continue;
    }
    const step = G.queue[0];
    // In hotseat the engine waits on a pass screen for the second human.
    if (M._ui().mode === 'pass') { M.passConfirm(); continue; }
    if (step.t === 'deploy1') {
      const p = G.players[step.seat], picks = p.hand.slice();
      for (let k = 0; k < step.count; k++) M.humanToggleCard(rnd0(picks));
      M.humanConfirmDeploy();
    } else if (step.t === 'declare') {
      const p = G.players[step.who];
      M.humanDeclare(rnd(STONE_KEYS.filter(c => p.pool[c] > 0)));
    } else if (step.t === 'place') {
      const seat = step.who; // a waiting human seat
      const p = G.players[seat];
      const color = rnd(p.active);
      M.humanChooseStone(color);
      const mine = p.board.filter(c => !M.isLocked(c));
      const theirs = G.players.filter(q => M.isOpponent(seat, q.idx)).flatMap(q => q.board).filter(c => !M.isLocked(c));
      if (color === 'white') mine.length ? M.humanTargetCard(rnd(mine)) : M.humanDiscardStone();
      else if (color === 'red') { const t = mine.filter(c => !c.stones.some(s => s.color === 'red')); t.length ? M.humanTargetCard(rnd(t)) : M.humanDiscardStone(); }
      else if (color === 'blue') (mine.length && theirs.length) ? (M.humanTargetCard(rnd(mine)), M.humanTargetCard(rnd(theirs))) : M.humanDiscardStone();
      else { const t = G.players.flatMap(q => q.board).filter(c => M.undoableEventFor(c)); t.length ? M.humanTargetCard(rnd(t)) : M.humanDiscardStone(); }
    } else assert(false, 'raid stuck on ' + step.t);
  }
  const G = M._state();
  assert(Math.abs(G.ledger) >= G.target, 'raid match ends at target');
  (G.ledger >= G.target) ? teamWins++ : bossWins++;
}
console.log(`OK raid: 30 co-op matches, ${hands} hands. party ${teamWins} / Magistrate ${bossWins}.`);
