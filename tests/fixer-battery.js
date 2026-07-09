'use strict';
/* Fixer-swap battery (analysis, not pass/fail). Measures whether "A Voice in the
   Alley" — trading your least-represented charm for one in your most-represented
   lane — actually raises your win rate, and by how much (does consolidation run
   away?). For each deck it runs full all-AI runs twice:
     · DECLINE  — the charm pool as-is
     · ACCEPT   — the pool after the real fixerDeal() swap (reward re-rolled each
                  run so we average over the random gain)
   The pool is held FIXED through the run (no reward/shop charms) so the only
   variable is the swap. Same neutral pilot + cautious heuristic as the other
   batteries.  Run:  K=100 node tests/fixer-battery.js
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 100);
const PLAYER = 'The Deckhand';
const POUCH = { red: 1, white: 1, blue: 1, black: 1 };
const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2 : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

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
function autoReward(g) { // take the card + stone, but NOT charms (keep the pool fixed)
  const r = g.reward; if (!r) return;
  let best = r.cards[0]; for (const c of r.cards) if (cardVal(c) > cardVal(best)) best = c;
  if (best) r.cardPick = best;
  if (r.stones && r.stones.length) r.stonePick = r.stones[0];
}
function autoShop(g) { // buy upgrades/cards/heal, but NOT charms
  const s = g.shop; if (!s) return;
  if (s.upgrades && s.upgrades.length && g.coin >= s.upgrades[0].price) M.circuitShopBuy('upgrade', 0);
  if (s.cards.length && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0);
  if (g.standing < g.maxStanding * 0.6 && g.coin >= s.healPrice) M.circuitShopBuy('heal');
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.event = { choice: 'heal' }; return; }
  let li = -1, lv = 99;
  g.deck.forEach((s, i) => { if (!(s && typeof s === 'object')) { const v = REGIONS.bar.values[s] || 0; if (v < lv) { lv = v; li = i; } } });
  g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
}
function playFight() { const G = M._state(); let guard = 0; while (!G.over && guard++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); } return guard < 30000; }
function setupFight(g, node) {
  g.tableCleared = false; g.groundOut = false; g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col;
  const vp = M.actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = Math.round(C.foeBase + tier * C.foeStep);
  if (node.type === 'elite') max = Math.round(max * C.eliteHpMult);
  if (node.type === 'boss') max = Math.round(max * C.bossHpMult);
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe); g.oppDeck = b.deck; g.oppPouch = Object.assign({}, b.pouch);
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function simulateRun(deckKey, charms) {
  const g = M._gauntlet(); const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const grit = arch.grit || 0;
  let start = C.startStanding + grit, startMax = C.maxStanding + grit;
  for (const k of charms) { const a = CHARMS[k] && CHARMS[k].maxStandingAdd; if (a) { startMax += a; start += a; } }
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax,
    score: 0, opp: null, deck: deck.slice(), pouch: Object.assign({}, POUCH),
    oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: charms.slice(), foeCharms: [], handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0,
    chits: [], chitValue: 0, tune: M.computeChitTune([]),
  });
  g.map = M.buildAct(1);
  let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map)); g.curNode = node;
    if (node.type === 'event' || node.type === 'repose') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    if (node.type === 'puzzle') { M.circuitAfterNode(); continue; }
    setupFight(g, node);
    if (!playFight()) return { hung: true };
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else { g.active = false; }
  }
  return { won: !!g.won };
}
function fixerApply(pre) { // the REAL fixerDeal, from a temp gauntlet holding this pool
  const g = M._gauntlet(); g.charms = pre.slice();
  const d = M.fixerDeal(g);
  return d ? { post: pre.filter(k => k !== d.giveCharm).concat([d.gain]), give: d.giveCharm, gain: d.gain } : { post: pre.slice(), give: null, gain: null };
}
function grade(deckKey, poolFn) {
  let wins = 0, hung = 0;
  for (let i = 0; i < K; i++) { let r; try { r = simulateRun(deckKey, poolFn()); } catch (e) { continue; } if (r.hung) { hung++; continue; } if (r.won) wins++; }
  return { winPct: Math.round(100 * wins / K), hung };
}
const lab = k => (CHARMS[k] && CHARMS[k].label) || k;

// Deck-aligned pools: a majority in the deck's own lane + a couple of off-class
// charms the fixer will trade away.
const SCENARIOS = [
  { deck: 'vanguard', pre: ['reckless', 'spite', 'firstblood', 'fieldsurgeon', 'loadedcoin'] },
  { deck: 'broker',   pre: ['loadedcoin', 'warchest', 'tollkeeper', 'reckless', 'foresight'] },
  { deck: 'anvil',    pre: ['fieldsurgeon', 'bulwarkcharm', 'counterpunch', 'loadedcoin', 'reckless'] },
  { deck: 'weaver',   pre: ['whetstone', 'foresight', 'fullsatchel', 'loadedcoin', 'reckless'] },
];

console.log(`\nFixer-swap battery — ${K} all-AI runs per condition (pilot = ${PLAYER}, pool held fixed).\n`);
let sumBefore = 0, sumAfter = 0;
for (const s of SCENARIOS) {
  const arch = M.deckByKey(s.deck);
  const before = grade(s.deck, () => s.pre);
  const after = grade(s.deck, () => fixerApply(s.pre).post);
  const sample = fixerApply(s.pre); // one example swap, for display
  sumBefore += before.winPct; sumAfter += after.winPct;
  console.log(`${arch.name}  [${s.pre.map(lab).join(', ')}]`);
  console.log(`   decline  win ${String(before.winPct).padStart(3)}%${before.hung ? ' ⚠hung×' + before.hung : ''}`);
  console.log(`   accept   win ${String(after.winPct).padStart(3)}%${after.hung ? ' ⚠hung×' + after.hung : ''}   (Δ ${(after.winPct - before.winPct >= 0 ? '+' : '') + (after.winPct - before.winPct)}pt)`);
  console.log(`   e.g. gives ${sample.give ? lab(sample.give) : '—'} → gets ${sample.gain ? lab(sample.gain) : '—'}\n`);
}
const n = SCENARIOS.length;
console.log(`── overall ──`);
console.log(`  avg win  decline ${Math.round(sumBefore / n)}%  →  accept ${Math.round(sumAfter / n)}%   (Δ ${(sumAfter - sumBefore >= 0 ? '+' : '') + Math.round((sumAfter - sumBefore) / n)}pt avg)`);
console.log('\nA small positive Δ = consolidation modestly helps (as intended). A large Δ = it runs away and wants a cost/limit. ~0 or negative = the fixer is a flavour/side-grade, not a power spike.');
