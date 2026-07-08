'use strict';
/* Starting-loadout battery (analysis, not pass/fail). Grades each of the 12
   openings — 4 decks × 3 charms — by running full all-AI Circuit runs from that
   exact start: the archetype's 10-card deck (8 plain + its 2 signature cards) +
   the chosen charm, a fixed balanced pouch, no chits. The only variable is the
   loadout, so an over/under-powered start shows up as a win-rate outlier.

   Same neutral pilot and cautious auto-heuristic as the chit battery, so the
   numbers are comparable to it. Also a bug net: every run is wrapped, so a bad
   card/charm interaction surfaces as a THROW or a non-terminating run.

   Run:  K=80 node tests/deck-battery.js
         K=80 DECK=broker node tests/deck-battery.js     (one deck's three charms)
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT;
const REGIONS = M.REGIONS;
const TYPES = M.TYPES;
const CHARMS = M.CHARMS;
const K = +(process.env.K || 80);
const PLAYER = 'The Deckhand';                       // one fixed neutral pilot — clean per-loadout signal
const POUCH = { red: 1, white: 1, blue: 1, black: 1 }; // fixed balanced pouch — a controlled variable

const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2 : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

// --- auto-pilot (identical to the chit battery) ---
function chooseNode(g, col) {
  const hurt = g.standing < g.maxStanding * 0.5;
  if (hurt) {
    const repose = col.find(n => n.type === 'repose'); if (repose) return repose;
    const safe = col.find(n => n.type === 'shop' || n.type === 'event'); if (safe) return safe;
    const duel = col.find(n => n.type === 'duel'); if (duel) return duel;
  }
  const duel = col.find(n => n.type === 'duel'); if (duel && g.standing < g.maxStanding * 0.7) return duel;
  return col[Math.floor(Math.random() * col.length)];
}
function autoReward(g) {
  const r = g.reward; if (!r) return;
  let best = r.cards[0]; for (const c of r.cards) if (cardVal(c) > cardVal(best)) best = c;
  if (best) r.cardPick = best;
  if (r.stones && r.stones.length) r.stonePick = r.stones[0];
  if (r.charms && r.charms.length) r.charmPick = r.charms[0];
}
function autoShop(g) {
  const s = g.shop; if (!s) return;
  if (s.upgrades && s.upgrades.length && g.coin >= s.upgrades[0].price) M.circuitShopBuy('upgrade', 0);
  if (s.charms.length && g.coin >= s.charms[0].price) M.circuitShopBuy('charm', 0);
  if (s.cards.length && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0);
  if (g.standing < g.maxStanding * 0.6 && g.coin >= s.healPrice) M.circuitShopBuy('heal');
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.event = { choice: 'heal' }; return; }
  let li = -1, lv = 99;
  g.deck.forEach((s, i) => { if (!(s && typeof s === 'object')) { const v = REGIONS.bar.values[s] || 0; if (v < lv) { lv = v; li = i; } } });
  g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
}
function playFight() {
  const G = M._state();
  let guard = 0;
  while (!G.over && guard++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); }
  return guard < 30000;
}

// All-AI fight with the player's real deck/pouch/charms on seat 0 (makePileSet
// reads g.deck/g.pouch) — we just field a second AI in the human seat, and
// replicate circuitSetupFight's foe scaling (no chit tune here).
function setupFight(g, node) {
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col;
  const vp = M.actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = Math.round(C.foeBase + tier * C.foeStep);
  if (node.type === 'elite') max = Math.round(max * C.eliteHpMult);
  if (node.type === 'boss') max = Math.round(max * C.bossHpMult);
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe);
  g.oppDeck = b.deck; g.oppPouch = Object.assign({}, b.pouch);
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function simulateRun(deckKey, charmKey) {
  const g = M._gauntlet();
  const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const tune = M.computeChitTune([]);
  const grit = arch.grit || 0; // per-archetype Standing lever
  let start = C.startStanding + grit, startMax = C.maxStanding + grit;
  const msa = charmKey && CHARMS[charmKey] && CHARMS[charmKey].maxStandingAdd;
  if (msa) { startMax += msa; start += msa; }
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0,
    standing: start, maxStanding: startMax,
    score: 0, opp: null, deck: deck.slice(), pouch: Object.assign({}, POUCH),
    oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: charmKey ? [charmKey] : [], foeCharms: [],
    handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0,
    chits: [], chitValue: 0, tune,
  });
  g.map = M.buildAct(1);
  let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map));
    g.curNode = node;
    if (node.type === 'event' || node.type === 'repose') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    if (node.type === 'puzzle') { M.circuitAfterNode(); continue; }
    setupFight(g, node);
    if (!playFight()) return { hung: true, cleared: g.cleared, act: g.act };
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else { g.active = false; }
  }
  return { won: !!g.won, cleared: g.cleared, act: g.act, deathAct: g.won ? 0 : g.act };
}

function grade(deckKey, charmKey) {
  let wins = 0, hung = 0, threw = 0; const depths = [], deathActs = new Array(C.acts + 2).fill(0);
  for (let i = 0; i < K; i++) {
    let r;
    try { r = simulateRun(deckKey, charmKey); }
    catch (e) { threw++; if (threw <= 2) console.log(`    THREW [${deckKey}+${charmKey}]: ${e.message}`); continue; }
    if (r.hung) { hung++; continue; }
    depths.push(r.cleared);
    if (r.won) wins++; else deathActs[r.deathAct]++;
  }
  depths.sort((a, b) => a - b);
  const n = depths.length || 1;
  return { deckKey, charmKey, wins, hung, threw, winPct: Math.round(100 * wins / K), med: depths[Math.floor(n / 2)] || 0, deathActs };
}

const decks = M.CIRCUIT_DECKS.filter(d => !process.env.DECK || d.key === process.env.DECK);
const chLabel = k => (CHARMS[k] && CHARMS[k].label) || k;
const line = g => {
  const deaths = g.deathActs.map((n, a) => a >= 1 && a <= C.acts ? `a${a}:${n}` : null).filter(Boolean).join(' ');
  const flags = (g.hung ? ` ⚠HUNG×${g.hung}` : '') + (g.threw ? ` ⚠THREW×${g.threw}` : '');
  return `win ${String(g.winPct).padStart(3)}%  med ${String(g.med).padStart(2)}  [${deaths}]${flags}  + ${chLabel(g.charmKey)}`;
};

console.log(`\nDeck battery — ${K} all-AI runs per loadout (pilot = ${PLAYER}, balanced pouch, no chits).\n`);
const all = [];
for (const d of decks) {
  console.log(`${d.name.toUpperCase()} — ${d.lane}`);
  for (const ck of d.charms) { const g = grade(d.key, ck); all.push({ ...g, deckName: d.name }); console.log('   ' + line(g)); }
  console.log('');
}
if (all.length > 1) {
  const sorted = all.slice().sort((a, b) => b.winPct - a.winPct);
  const hi = sorted[0], lo = sorted[sorted.length - 1];
  const byDeck = decks.map(d => { const gs = all.filter(a => a.deckKey === d.key); return { name: d.name, avg: Math.round(gs.reduce((s, g) => s + g.winPct, 0) / gs.length) }; });
  console.log('── spread ──');
  console.log(`  best  ${hi.winPct}%  ${hi.deckName} + ${chLabel(hi.charmKey)}`);
  console.log(`  worst ${lo.winPct}%  ${lo.deckName} + ${chLabel(lo.charmKey)}`);
  console.log(`  band  ${hi.winPct - lo.winPct}pt across all 12 loadouts (tighter = better balanced)`);
  console.log('  per-deck avg: ' + byDeck.map(b => `${b.name.replace('The ', '')} ${b.avg}%`).join(' · '));
}
console.log('\nAny ⚠HUNG/⚠THREW is a card/charm interaction bug. A wide win-rate band = a deck or charm to nudge.');
