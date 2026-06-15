'use strict';
/* The Archivist live wiring: drive full inverted-flow raid matches headlessly
   (seat 0 random-but-legal, ally + boss AI) and assert the mechanic holds —
   correct board sizes, every queued stone resolved (no pending left), boards
   intact, and the match terminating at the target. Proves the live boss
   functions end-to-end on the real engine, not just the pure resolver. */
const M = require('../game.js');
const STONE_KEYS = ['red', 'white', 'blue', 'black'];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const rnd0 = a => a.splice(Math.floor(Math.random() * a.length), 1)[0];
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

const expectCards = { easy: 7, standard: 7, hard: 7 };
let teamWins = 0, bossWins = 0, hands = 0, resolves = 0;

for (let i = 0; i < 30; i++) {
  const diff = ['easy', 'standard', 'hard'][i % 3];
  M.newGame({ mode: 'raid', raidBoss: 'archivist', raidAlly: 'bot', allyBot: 'The Old Hand', raidDiff: diff, target: 10 });
  let guard = 0;
  while (true) {
    if (guard++ > 60000) assert(false, 'archivist raid did not terminate (' + diff + ')');
    const G = M._state();
    if (G.over) break;
    if (!G.queue.length) {
      hands++;
      assert(G.players[1].board.length === expectCards[diff], `boss fields ${expectCards[diff]} on ${diff}, got ${G.players[1].board.length}`);
      assert(G.players[0].board.length === 4 && G.players[2].board.length === 4, 'party fields four each');
      // After resolution nothing should still be queued, and the boss flag is down.
      assert(!G.archivist, 'archivist flag cleared after the hand');
      assert(G.players.flatMap(p => p.board).every(c => !c.queued || !c.queued.length), 'no pending stones linger after resolve');
      M.nextHand();
      continue;
    }
    const step = G.queue[0];
    if (M._ui().mode === 'pass') { M.passConfirm(); continue; }
    // global slot helpers (footprint offsets: seat0, boss, seat2)
    const fp = [4, expectCards[diff], 4];
    const off = { 0: 0, 1: fp[0], 2: fp[0] + fp[1] };
    const ownSlots = seat => { const a = []; for (let p = 0; p < fp[seat]; p++) a.push(off[seat] + p); return a; };
    const allSlots = () => [...ownSlots(0), ...ownSlots(1), ...ownSlots(2)];
    if (step.t === 'declare') {
      if (step.who === 0) M.humanDeclare(rnd(STONE_KEYS.filter(c => G.players[0].pool[c] > 0)));
      else M._run();
    } else if (step.t === 'place') {
      if (step.who !== 0) { M._run(); continue; }
      if (!G.players[0].active.length) { M._run(); continue; }
      const color = rnd(G.players[0].active);
      M.humanChooseStone(color);
      const q = M._state().archQueue || [];
      if (color === 'white' || color === 'red') {
        M.humanTargetSlot(rnd(ownSlots(0)));
      } else if (color === 'blue') {
        const a = rnd(ownSlots(0)); let b = rnd(ownSlots(1)); if (b === a) b = ownSlots(1)[0];
        M.humanTargetSlot(a); M.humanTargetSlot(b);
      } else { // black — needs a slot already carrying a queued stone
        const ok = new Set(q.filter(e => e.color !== 'black').flatMap(e => [e.slot, e.swap]).filter(x => x != null));
        ok.size ? M.humanTargetSlot([...ok][0]) : M.humanDiscardStone();
      }
    } else if (step.t === 'archcommit') {
      if (step.seat !== 0) { M._run(); continue; }
      // place `count` cards into our empty slots
      let placed = 0;
      while (placed < step.count && G.players[0].hand.length) {
        const card = G.players[0].hand[0];
        M.humanPickCommitCard(card);
        const empty = ownSlots(0).filter(gi => !G.players[0].board[gi - off[0]]);
        if (!empty.length) break;
        M.humanTargetSlot(empty[0]);
        placed++;
      }
    } else { M._run(); }
  }
  const G = M._state();
  assert(Math.abs(G.ledger) >= G.target, 'archivist match ends at target');
  (G.ledger >= G.target) ? teamWins++ : bossWins++;
  resolves += hands;
}
console.log(`OK archivist-live: 30 inverted-flow matches, ${hands} hands. party ${teamWins} / Archivist ${bossWins}.`);
