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
    if (step.t === 'deploy1') {
      // only seat 0 is human here; AI seats execute themselves
      if (step.seat === 0) {
        const p = G.players[0], picks = p.hand.slice();
        for (let k = 0; k < step.count; k++) M.humanToggleCard(rnd0(picks));
        M.humanConfirmDeploy();
      } else { M._run(); }
    } else if (step.t === 'declare') {
      if (step.who === 0) {
        const p = G.players[0];
        M.humanDeclare(rnd(STONE_KEYS.filter(c => p.pool[c] > 0)));
      } else { M._run(); }
    } else if (step.t === 'place') {
      if (step.who !== 0) { M._run(); continue; }
      const p = G.players[0];
      if (!p.active.length) { M._run(); continue; }
      const color = rnd(p.active);
      M.humanChooseStone(color);
      const all = G.players.flatMap(q => q.board).filter(c => c.zone === 'board');
      if (color === 'white' || color === 'red') {
        all.length ? M.humanTargetCard(rnd(all)) : M.humanDiscardStone();
      } else if (color === 'blue') {
        const mine = G.players[0].board;
        const theirs = all.filter(c => c.owner !== 0);
        (mine.length && theirs.length) ? (M.humanTargetCard(rnd(mine)), M.humanTargetCard(rnd(theirs))) : M.humanDiscardStone();
      } else { // black — needs a slot with a prior queued stone
        const q = M._state().archQueue || [];
        const okSlots = new Set(q.filter(e => e.color !== 'black').flatMap(e => [e.slot, e.swap]).filter(x => x != null));
        // map flat slot -> card
        const flat = []; for (const o of [0, 1, 2]) for (const c of G.players[o].board) flat.push(c);
        const targets = [...okSlots].map(s => flat[s]).filter(Boolean);
        targets.length ? M.humanTargetCard(rnd(targets)) : M.humanDiscardStone();
      }
    } else { M._run(); }
  }
  const G = M._state();
  assert(Math.abs(G.ledger) >= G.target, 'archivist match ends at target');
  (G.ledger >= G.target) ? teamWins++ : bossWins++;
  resolves += hands;
}
console.log(`OK archivist-live: 30 inverted-flow matches, ${hands} hands. party ${teamWins} / Archivist ${bossWins}.`);
