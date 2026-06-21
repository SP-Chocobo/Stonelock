'use strict';
/* AI battery (analysis, not a pass/fail test). Pits each Regular (seat 0)
   against a neutral Deckhand baseline across every venue, all-AI, and reports
   win% + avg hands. Surfaces what the design doc / reviewers asked to catch
   early: a regular that's dead in a venue, one that dominates, or a roster
   that's too samey (personalities not mattering). Run: node tests/ai-battery.js */
const M = require('../game.js');
M.setAlphaUnlock(true);

const REGULARS = ['The Stranger', 'The Ferryman', 'The Clerk', 'The Tinker', 'The Deckhand', 'The Old Hand', 'The Lady', 'The Miner', 'The Wagoner'];
const VENUES = ['tavern', 'docks', 'slums', 'hall', 'court', 'academy'];
const BASE = 'The Deckhand';
const K = +(process.env.K || 40);

function runDuel(regular, venue) {
  M.newGame({ mode: 'duel', humans: [], companyNames: [regular, BASE], venue, deal: 'small', target: 10 });
  const G = M._state();
  let guard = 0;
  while (!G.over) {
    if (guard++ > 40000) return null; // stuck — shouldn't happen
    if (!G.queue.length) { M.nextHand(); continue; }
    M._run();
  }
  return { win: G.ledger >= G.target, hands: G.handNum };
}

const grid = {};       // regular -> venue -> winPct
let handsTotal = 0, games = 0;
for (const r of REGULARS) {
  grid[r] = {};
  for (const v of VENUES) {
    let wins = 0, n = 0;
    for (let i = 0; i < K; i++) {
      const res = runDuel(r, v);
      if (!res) continue;
      n++; games++; handsTotal += res.hands;
      if (res.win) wins++;
    }
    grid[r][v] = n ? Math.round(100 * wins / n) : NaN;
  }
}

// --- report ---
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);
console.log(`\nAI battery — each Regular (seat 0) vs ${BASE}, ${K} all-AI duels per cell. Cell = Regular win%.\n`);
console.log(pad('Regular', 14) + VENUES.map(v => padL(v, 8)).join('') + padL('avg', 8) + padL('spread', 8));
for (const r of REGULARS) {
  const vals = VENUES.map(v => grid[r][v]);
  const avg = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
  const spread = Math.max(...vals) - Math.min(...vals);
  console.log(pad(r, 14) + vals.map(x => padL(x + '%', 8)).join('') + padL(avg + '%', 8) + padL(spread, 8));
}
// per-venue average win% (how strong the FIELD is vs the baseline at each table)
const venAvg = VENUES.map(v => Math.round(REGULARS.reduce((s, r) => s + grid[r][v], 0) / REGULARS.length));
console.log('\n' + pad('venue avg', 14) + venAvg.map(x => padL(x + '%', 8)).join(''));
console.log(`\n${games} duels, ${(handsTotal / games).toFixed(1)} hands/duel avg.`);
console.log('Reading: ~50% = even with the neutral baseline. Big per-row spread = identity that swings by venue (good). Flat ~50% everywhere = personalities barely matter (samey AI).');
