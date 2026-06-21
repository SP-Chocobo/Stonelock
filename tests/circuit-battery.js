'use strict';
/* Circuit balance battery (analysis, not pass/fail). Drives full all-AI Circuit
   runs through the real loop — depleting builds on BOTH seats, Standing
   attrition, clear→heal→advance, auto-piloted spoils/events between tables —
   and reports the difficulty curve so the first-guess numbers (Standing/heal/
   damage, foe scaling, spoils richness, event cadence) can be tuned with data.
   The "player" is a neutral Deckhand persona on a varied build, so this measures
   the ECONOMY + curve, not persona skill. Run: K=60 node tests/circuit-battery.js */
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT;
const REGIONS = M.REGIONS;
const ROSTER = ['The Stranger', 'The Ferryman', 'The Clerk', 'The Tinker', 'The Deckhand', 'The Old Hand', 'The Lady', 'The Miner', 'The Wagoner'];
const K = +(process.env.K || 60);
const CAP = 40;          // safety cap on run length (a run that never dies)
const PLAYER = 'The Deckhand'; // neutral skill, so the build/economy is what's measured

const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2
  : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

function setupTable(g) {
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false; // mirror circuitRung's per-table reset
  // a fresh foe each table, no immediate repeat
  const pool = ROSTER.filter(n => n !== g.opp);
  g.opp = pool[Math.floor(Math.random() * pool.length)];
  g.venue = C.venues[(g.rung - 1) % C.venues.length];
  g.foeMax = C.foeBase + (g.rung - 1) * C.foeStep;
  g.foeHp = g.foeMax;
  const b = M.circuitBuildFor(g.opp);
  g.oppDeck = b.deck; g.oppPouch = b.pouch;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, g.opp], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}

// Play one table to its Standing-decided end (never call nextHand once over —
// that would re-enter the real circuitEnd/circuitRung human flow).
function playTable() {
  const G = M._state();
  let guard = 0;
  while (!G.over && guard++ < 30000) {
    if (!G.queue.length) M.nextHand();
    else M._run();
  }
  return guard < 30000;
}

// Auto-pilot a reasonable player between tables.
function autoSpoils(g) {
  const r = M.makeReward();
  let best = r.cards[0];
  for (const c of r.cards) if (cardVal(c) > cardVal(best)) best = c;
  g.deck = g.deck.concat([best]);
  const col = r.stones[0];
  g.pouch = Object.assign({}, g.pouch, { [col]: (g.pouch[col] || 0) + 1 });
  if (r.charms && r.charms.length) { // grab the first offered charm
    const k = r.charms[0];
    g.charms = (g.charms || []).concat([k]);
    const add = M.CHARMS[k] && M.CHARMS[k].maxStandingAdd;
    if (add) { g.maxStanding += add; g.standing += add; }
  }
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.standing = Math.min(g.maxStanding, g.standing + M.circuitHealAmount()); return; }
  // else thin the lowest-value plain card
  let li = -1, lv = 99;
  g.deck.forEach((s, i) => { if (!(s && typeof s === 'object')) { const v = REGIONS.bar.values[s] || 0; if (v < lv) { lv = v; li = i; } } });
  if (li >= 0 && g.deck.length > C.deckFloor) g.deck = g.deck.slice(0, li).concat(g.deck.slice(li + 1));
  else g.standing = Math.min(g.maxStanding, g.standing + M.circuitHealAmount());
}

function simulateRun() {
  const g = M._gauntlet();
  const build = M.circuitBuildFor(ROSTER[Math.floor(Math.random() * ROSTER.length)]); // a varied loadout
  Object.assign(g, {
    active: true, rung: 1, cleared: 0, standing: C.maxStanding, maxStanding: C.maxStanding,
    score: 0, opp: null, deck: build.deck.slice(), pouch: Object.assign({}, build.pouch),
    oppDeck: null, oppPouch: null, charms: [], handBuff: 0,
  });
  const perTable = []; // true = cleared this table, false = died here
  while (g.active && g.rung <= CAP) {
    setupTable(g);
    if (!playTable()) break; // stuck (shouldn't happen)
    if (g.tableCleared) {
      perTable.push(true);
      g.cleared = g.rung; g.score += 10 + g.rung;
      g.standing = Math.min(g.maxStanding, g.standing + C.heal); g.rung++;
      if (g.cleared % C.eventEvery === 0) autoEvent(g); else autoSpoils(g);
    } else { perTable.push(false); g.active = false; }
  }
  return { cleared: g.cleared, score: g.score, capped: g.rung > CAP, perTable };
}

// --- run K runs ---
const depths = [], scores = [];
const reached = new Array(CAP + 2).fill(0), clearedAt = new Array(CAP + 2).fill(0);
let capped = 0;
for (let i = 0; i < K; i++) {
  const r = simulateRun();
  depths.push(r.cleared); scores.push(r.score);
  if (r.capped) capped++;
  r.perTable.forEach((ok, t) => { reached[t + 1]++; if (ok) clearedAt[t + 1]++; });
}

// --- report ---
depths.sort((a, b) => a - b);
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
const padL = (s, w) => String(s).padStart(w);

console.log(`\nCircuit balance battery — ${K} full all-AI runs (player = ${PLAYER}, varied builds).`);
console.log(`Config: Standing ${C.maxStanding}, heal +${C.heal}, dmgCap ${C.dmgCap}, foe ${C.foeBase}+${C.foeStep}/table, draw ${C.drawStones}, event every ${C.eventEvery}.\n`);

console.log('Tables cleared per run:');
console.log(`  mean ${mean(depths).toFixed(1)} · median ${pct(depths, 0.5)} · p10 ${pct(depths, 0.1)} · p90 ${pct(depths, 0.9)} · max ${depths[depths.length - 1]}`);
console.log(`  reached table 3: ${Math.round(100 * depths.filter(d => d >= 3).length / K)}% · table 5: ${Math.round(100 * depths.filter(d => d >= 5).length / K)}% · table 10: ${Math.round(100 * depths.filter(d => d >= 10).length / K)}%`);
if (capped) console.log(`  ${capped} run(s) hit the ${CAP}-table cap (never died — too easy).`);
console.log(`  score: mean ${Math.round(mean(scores))} · max ${Math.max(...scores)}`);

console.log('\nPer-table clear rate (of runs that reached it) — the difficulty ramp:');
console.log('  ' + 'table'.padEnd(8) + ['1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '15'].map(t => padL('T' + t, 6)).join(''));
const show = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
console.log('  ' + 'clear%'.padEnd(8) + show.map(t => padL(reached[t] ? Math.round(100 * clearedAt[t] / reached[t]) + '%' : '–', 6)).join(''));
console.log('  ' + 'n'.padEnd(8) + show.map(t => padL(reached[t] || '–', 6)).join(''));

const overallReached = reached.reduce((s, x) => s + x, 0), overallCleared = clearedAt.reduce((s, x) => s + x, 0);
console.log(`\nOverall single-table clear rate: ${Math.round(100 * overallCleared / overallReached)}% (≈ per-fight win rate across the run).`);
console.log('Reading: a healthy MVP curve dies out gradually (T1 clear ~55-70%, sliding down deeper); median depth a handful of tables, few runs capped.');
