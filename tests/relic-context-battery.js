'use strict';
/* Relic-in-real-builds battery (analysis). Grades each relic (or any charm) not in
   isolation but as a MARGINAL addition across a spectrum of realistic builds — an
   aggro build, a value build, a defense build, a cunning build, a generalist, etc. —
   with competent play. Reports the average win% lift AND the per-build breakdown, so a
   conditional/synergistic relic (Sovereign wants locks, Matched Set wants pairs) shows
   both its average value and where it actually shines. Complements the sole-charm
   context battery: this is the "how good is it in a real deck of varying spectrum" view.

   Run:  K=80 node tests/relic-context-battery.js
         GRADE=all K=80 node tests/relic-context-battery.js   # grade every charm, not just relics
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 80);
const DECKS = ['vanguard', 'broker', 'anvil', 'weaver'];
const CHITS = (process.env.CHITS ? process.env.CHITS.split(',').map(s => s.trim()).filter(Boolean) : ['lean', 'thin']); // moderate: headroom for a lift
const POUCH0 = { red: 1, white: 1, blue: 1, black: 1 };
// A spectrum of realistic 3-charm builds (commons only, so relic grading isn't circular).
// Realistic ANCHORED builds — each has one real board charm so none floor, spanning
// flavours. Grading relics on floored pure-category builds is useless (any board relic
// "rescues" them and shows fake lift); these sit mid-range so a relic's delta is honest.
const BUILDS = {
  aggro:   ['reckless', 'spite', 'firstblood'],
  value:   ['crownjewel', 'loadedcoin', 'passagetoll'],
  defense: ['laststand', 'bulwarkcharm', 'fieldsurgeon'],
  cunning: ['whetstone', 'foresight', 'fullsatchel'],
  neutral: ['crownjewel', 'evenkeel', 'floorprice'],
};
const BUILD_KEYS = Object.keys(BUILDS);
const cardVal = c => { const t = (c && typeof c === 'object') ? c.type : c; return (REGIONS.bar.values[t] || 2) + ((c && typeof c === 'object' && c.fx) ? 1.5 : 0); };
const deckAvg = d => d.length ? d.reduce((s, c) => s + cardVal(c), 0) / d.length : 0;

function chooseNode(g, col) {
  const s = g.standing / g.maxStanding; const has = t => col.find(n => n.type === t);
  const nonElite = col.filter(n => n.type !== 'elite' && n.type !== 'boss');
  if (s < 0.5) { const r = has('repose') || has('shop') || has('event'); if (r) return r; }
  if (s < 0.4 && nonElite.length) { const d = nonElite.find(n => n.type === 'duel'); return d || nonElite[0]; }
  if (s > 0.72 && has('elite') && Math.random() < 0.5) return has('elite');
  const d = has('duel'); if (d) return d; return col[Math.floor(Math.random() * col.length)];
}
function autoReward(g) { // build is fixed → decline all charms; still build deck/pouch competently
  const r = g.reward; if (!r) return; const avg = deckAvg(g.deck);
  let best = null; for (const c of (r.cards || [])) if (!best || cardVal(c) > cardVal(best)) best = c;
  r.cardPick = (best && cardVal(best) > avg) ? best : null;
  const total = Object.values(g.pouch).reduce((a, b) => a + b, 0);
  if (total < 9 && r.stones && r.stones.length) { let p = null, lo = 99; for (const st of r.stones) { const c = g.pouch[st] || 0; if (c < lo) { lo = c; p = st; } } r.stonePick = p; } else r.stonePick = null;
  r.charmPick = null;
}
function autoShop(g) {
  const s = g.shop; if (!s) return;
  if (g.standing < g.maxStanding * 0.5 && g.coin >= s.healPrice) M.circuitShopBuy('heal');
  if (s.upgrades && s.upgrades.length && g.coin >= s.upgrades[0].price) M.circuitShopBuy('upgrade', 0);
  const avg = deckAvg(g.deck);
  if (s.cards && s.cards.length && cardVal(s.cards[0]) > avg && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0);
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.event = { choice: 'heal' }; return; }
  const avg = deckAvg(g.deck); let li = -1, lv = 99;
  g.deck.forEach((c, i) => { const v = cardVal(c); if (v < lv && v < avg) { lv = v; li = i; } });
  g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
}
function playFight() { const G = M._state(); let g = 0; while (!G.over && g++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); } return g < 30000; }
function setupFight(g, node, tune) {
  g.tableCleared = false; g.groundOut = false; g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false; g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col; const vp = M.actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = Math.round((tune.foeBase != null ? tune.foeBase : C.foeBase) + tier * (tune.foeStep != null ? tune.foeStep : C.foeStep));
  if (node.type === 'elite') max = Math.round(max * (tune.eliteHpMult != null ? tune.eliteHpMult : C.eliteHpMult));
  if (node.type === 'boss') max = Math.round(max * (tune.bossHpMult != null ? tune.bossHpMult : C.bossHpMult));
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe); g.oppDeck = b.deck; const pouch = Object.assign({}, b.pouch);
  if (tune.foeAllStones) for (const c of ['red', 'white', 'blue', 'black', 'green']) pouch[c] = (pouch[c] || 0) + 1;
  g.oppPouch = pouch; M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: ['P', node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function run(deckKey, pool) {
  const g = M._gauntlet(); const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const tune = M.computeChitTune(CHITS); const grit = arch.grit || 0;
  let start = (tune.startStanding != null ? tune.startStanding : C.startStanding) + grit;
  let startMax = (tune.maxStanding != null ? tune.maxStanding : C.maxStanding) + grit;
  for (const k of pool) { const a = CHARMS[k] && CHARMS[k].maxStandingAdd; if (a) { startMax += a; start += a; } }
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax, score: 0, opp: null,
    deck: deck.slice(), pouch: Object.assign({}, POUCH0), oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: pool.slice(), foeCharms: [], handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0, chits: CHITS.slice(), chitValue: 0, tune,
  });
  g.map = M.buildAct(1); let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map)); g.curNode = node;
    if (node.type === 'event' || node.type === 'repose') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    if (node.type === 'puzzle') { M.circuitAfterNode(); continue; }
    setupFight(g, node, tune);
    if (!playFight()) return { hung: true };
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else return { won: false };
  }
  return { won: !!g.won };
}
function winPct(deckKey, pool) { let w = 0, n = 0; for (let i = 0; i < K; i++) { let r; try { r = run(deckKey, pool); } catch (e) { continue; } if (!r || r.hung) continue; n++; if (r.won) w++; } return n ? 100 * w / n : 0; }
// build value averaged over the 4 decks
function buildWin(pool) { let s = 0; for (const d of DECKS) s += winPct(d, pool); return s / DECKS.length; }
const lab = k => (CHARMS[k] && CHARMS[k].label) || k;

const GRADE = process.env.GRADE === 'all' ? Object.keys(CHARMS)
  : (process.env.GRADE && process.env.GRADE.includes(',')) ? process.env.GRADE.split(',').map(s => s.trim()).filter(k => CHARMS[k])
  : Object.keys(CHARMS).filter(k => CHARMS[k].bossOnly);
console.log(`\nRelic-in-real-builds battery — ${K} runs/deck/build, decks [${DECKS.join(',')}], load [${CHITS.join(',')||'none'}], competent play.`);
console.log(`Marginal win% lift across ${BUILD_KEYS.length} builds [${BUILD_KEYS.join(', ')}]. Grading ${GRADE.length} ${process.env.GRADE && process.env.GRADE !== 'relics' ? 'charms' : 'relics'}.\n`);

// per-build baselines (no relic)
const base = {}; for (const b of BUILD_KEYS) base[b] = buildWin(BUILDS[b]);
console.log('build baselines:  ' + BUILD_KEYS.map(b => `${b} ${base[b].toFixed(0)}`).join('  ') + `   avg ${(BUILD_KEYS.reduce((s,b)=>s+base[b],0)/BUILD_KEYS.length).toFixed(0)}`);
console.log('');
if (process.env.PROBE) process.exit(0); // calibration: just print baselines and stop

const rows = GRADE.map(k => {
  const per = {}; let sum = 0;
  for (const b of BUILD_KEYS) { const d = buildWin(BUILDS[b].concat([k])) - base[b]; per[b] = d; sum += d; }
  return { k, avg: sum / BUILD_KEYS.length, per };
}).sort((a, b) => b.avg - a.avg);

console.log('RELIC VALUE ACROSS BUILDS (avg Δ, then per-build Δ — where it shines):');
console.log('    ' + 'avg'.padStart(6) + '   ' + BUILD_KEYS.map(b => b.slice(0, 4).padStart(5)).join(' '));
rows.forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${((r.avg >= 0 ? '+' : '') + r.avg.toFixed(1)).padStart(6)}   ` +
    BUILD_KEYS.map(b => ((r.per[b] >= 0 ? '+' : '') + r.per[b].toFixed(0)).padStart(5)).join(' ') + `   ${lab(r.k)}`);
});
console.log('\nHigh avg = strong everywhere; big spread = build-dependent (synergy). Low/flat = weak or niche.');
