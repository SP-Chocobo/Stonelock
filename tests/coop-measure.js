'use strict';
/* 2v1 co-op balance probe (analysis, not pass/fail). Drives all-AI co-op fights
   built directly (skipping the probabilistic makeCircuitEvent). Reports party
   clear rate — run before/after the A1/A2 co-op scoring fixes to size the
   rebalance. Run: K=150 node tests/coop-measure.js */
const M = require('../game.js');
M.setAlphaUnlock(true);
const K = +(process.env.K || 150);
const ACT2_FOES = ['The Lady', 'The Miner', 'The Stranger', 'The Tinker'];
let wins = 0, losses = 0, other = 0, hands = 0, n = 0;
// Per-showdown scores are the sensitive metric: the A1/A2 fixes change SCORING,
// which win-rate (pinned at the AI-party floor) can't reveal.
let shows = 0, teamSum = 0, foeSum = 0, foeWinsHand = 0;
for (let s = 1; s <= K; s++) {
  M.seedRng(2000 + s);
  M.startCircuit();
  const cg = M._gauntlet();
  cg.act = 2; cg.allies = ['The Ferryman'];
  const foe = ACT2_FOES[s % ACT2_FOES.length];
  const pool = M.circuitAllyDraftPool();
  // A representative mid-run player build: base deck + a few modded cards, full standing.
  cg.deck = M.TYPES.slice().concat(pool.slice(8, 12));
  cg.pouch = { red: 2, white: 2, blue: 1, black: 1 };
  cg.standing = cg.maxStanding;
  const allyDeck = []; for (const t of M.TYPES) { allyDeck.push(t, t); }
  for (let i = 0; i < 8; i++) allyDeck.push(pool[i]);
  cg.allyDeck = allyDeck; cg.allyPouch = { red: 3, white: 3, blue: 2, black: 2 };
  const node = { type: 'event', col: 3, idx: 0, coop: true, foe };
  cg.curNode = node;
  M.circuitSetupCoopFight(node, 'The Ferryman', foe); // sets the real tuned foeMax (coopFoeMult + tier)
  // Restart the same fight all-AI (seat 0 piloted too), exactly as circuit.test.js does.
  cg.standing = cg.maxStanding;
  M.circuitResetPiles();
  M.newGame({ mode: 'coop', humans: [], companyNames: [foe, 'The Ferryman'], venue: 'slums', deal: 'small', target: 999, gauntlet: true });
  const G = M._state();
  let guard = 0, seenHand = 0;
  while (!G.over && guard++ < 12000) {
    if (!G.queue.length) M.nextHand(); else M._run();
    const ls = G.lastShowdown;
    if (ls && ls.coop && ls.hand !== seenHand) { // a new showdown resolved
      seenHand = ls.hand; shows++; teamSum += ls.teamScore; foeSum += ls.foe.score;
      if (ls.foe.score > ls.teamScore) foeWinsHand++;
    }
  }
  if (!G.over) { continue; }
  n++; hands += G.handNum;
  if (cg.tableCleared) wins++; else if (cg.groundOut) losses++; else other++;
}
M.clearRng();
console.log(`2v1 co-op: ${n} fights · party clears ${wins} (${n ? Math.round(100 * wins / n) : 0}%) · mean hands ${n ? (hands / n).toFixed(1) : '—'}`);
console.log(`  per-showdown (${shows} hands): party ${(teamSum / shows).toFixed(2)} vs foe ${(foeSum / shows).toFixed(2)}  (foe margin ${((foeSum - teamSum) / shows).toFixed(2)}, foe wins the hand ${Math.round(100 * foeWinsHand / shows)}%)`);
