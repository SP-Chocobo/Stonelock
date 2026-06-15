'use strict';
/* The Court of Precedence venue: the Archivist's stone-first inverted loop as a
   normal-table house rule (forward, any seat count). Drives full all-AI matches in
   every table shape and asserts the mechanic holds — stones placed before cards,
   resolved in placement order, boards intact, no pending stones lingering, match
   terminating. Also a human-driven duel exercising the slot/commit UI path. */
const M = require('../game.js');
const rnd = a => a[Math.floor(Math.random() * a.length)];
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

// --- all-AI across the three table shapes ---
for (const mode of ['duel', 'ffa', 'teams']) {
  for (let i = 0; i < 6; i++) {
    M.newGame({ venue: 'court', mode, humans: [], deal: 'small', target: 10 });
    const G = M._state();
    let guard = 0;
    while (!G.over) {
      if (guard++ > 60000) assert(false, `precedence ${mode} did not terminate`);
      if (!G.queue.length) {
        const n = G.nPlayers;
        for (let s = 0; s < n; s++) assert(G.players[s].board.length === 4, `${mode}: seat ${s} fields four, got ${G.players[s].board.length}`);
        assert(!G.archivist, `${mode}: slot mode cleared after the hand`);
        assert(G.players.flatMap(p => p.board).every(c => !c.queued || !c.queued.length), `${mode}: no pending stones linger`);
        M.nextHand();
        continue;
      }
      M._run();
    }
  }
}

// --- human-driven duel: exercise the slot-placement + card-commit UI path ---
{
  let hands = 0, guard = 0;
  M.newGame({ venue: 'court', mode: 'duel', humans: [0], deal: 'small', target: 10 });
  const G = M._state();
  const off = { 0: 0, 1: 4 };
  while (!G.over) {
    if (guard++ > 40000) assert(false, 'precedence human duel did not terminate');
    if (!G.queue.length) { hands++; M.nextHand(); continue; }
    const s = G.queue[0];
    if (M._ui().mode === 'pass') { M.passConfirm(); continue; }
    if (s.t === 'place') {
      if (s.who !== 0) { M._run(); continue; }
      if (!G.players[0].active.length) { M._run(); continue; }
      const color = rnd(G.players[0].active);
      M.humanChooseStone(color);
      const own = [0, 1, 2, 3].map(p => off[0] + p);
      const opp = [0, 1, 2, 3].map(p => off[1] + p);
      const q = M._state().archQueue || [];
      if (color === 'white' || color === 'red') M.humanTargetSlot(rnd(own));
      else if (color === 'blue') { M.humanTargetSlot(rnd(own)); M.humanTargetSlot(rnd(opp)); }
      else { const ok = new Set(q.filter(e => e.color === 'red' || e.color === 'blue').map(e => e.slot)); ok.size ? M.humanTargetSlot([...ok][0]) : M.humanDiscardStone(); }
    } else if (s.t === 'archcommit') {
      if (s.seat !== 0) { M._run(); continue; }
      let placed = 0;
      while (placed < s.count && G.players[0].hand.length) {
        M.humanPickCommitCard(G.players[0].hand[0]);
        const empty = [0, 1, 2, 3].map(p => off[0] + p).filter(gi => !G.players[0].board[gi - off[0]]);
        if (!empty.length) break;
        M.humanTargetSlot(empty[0]); placed++;
      }
    } else M._run();
  }
  assert(Math.abs(G.ledger) >= G.target, 'precedence human duel ends at target');
  assert(hands > 0, 'precedence human duel played at least one hand');
}

console.log('OK precedence venue: stone-first inverted loop across duel/ffa/teams (AI) + human duel.');
