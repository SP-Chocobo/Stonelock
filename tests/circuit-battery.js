'use strict';
/* Circuit balance battery (analysis, not pass/fail). Drives full all-AI Circuit
   runs through the real map: a finite set of acts, each a branching path of
   nodes (duel / elite / event / boss) to an act boss, with depleting builds on
   both seats, foe charms on elites/bosses, Standing attrition, and auto-piloted
   rewards/events. Reports the win rate and where runs die so the numbers
   (Standing/heal/damage, foe + boss scaling, act count, charm gating) can be
   tuned. The "player" is a neutral Deckhand on a varied build — the economy and
   curve, not skill. Run: K=120 node tests/circuit-battery.js */
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT;
const REGIONS = M.REGIONS;
const ROSTER = ['The Stranger', 'The Ferryman', 'The Clerk', 'The Tinker', 'The Deckhand', 'The Old Hand', 'The Lady', 'The Miner', 'The Wagoner'];
const K = +(process.env.K || 120);
const PLAYER = 'The Deckhand';

const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2 : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

function setupFight(g, node) {
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col;
  g.venue = C.venues[tier % C.venues.length];
  let max = C.foeBase + tier * C.foeStep;
  if (node.type === 'elite') max = Math.round(max * C.eliteHpMult);
  if (node.type === 'boss') max = Math.round(max * C.bossHpMult);
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe);
  g.oppDeck = b.deck; g.oppPouch = b.pouch;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function playFight() {
  const G = M._state();
  let guard = 0;
  while (!G.over && guard++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); }
  return guard < 30000;
}
// A cautious-but-reasonable path: heal at an event when hurt, otherwise prefer a
// plain duel over an elite, taking elites (for charms) when healthy.
function chooseNode(g, col) {
  if (g.standing < g.maxStanding * 0.45) { const ev = col.find(n => n.type === 'event'); if (ev) return ev; }
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
  if (s.charms.length && g.coin >= s.charms[0].price) M.circuitShopBuy('charm', 0);
  if (s.cards.length && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0);
  if (g.standing < g.maxStanding * 0.6 && g.coin >= s.healPrice) M.circuitShopBuy('heal');
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) g.event = { choice: 'heal' };
  else { // thin a low plain card if possible, else heal
    let li = -1, lv = 99;
    g.deck.forEach((s, i) => { if (!(s && typeof s === 'object')) { const v = REGIONS.bar.values[s] || 0; if (v < lv) { lv = v; li = i; } } });
    g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
  }
}

function simulateRun() {
  const g = M._gauntlet();
  const build = M.circuitBuildFor(ROSTER[Math.floor(Math.random() * ROSTER.length)]);
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: C.maxStanding, maxStanding: C.maxStanding,
    score: 0, opp: null, deck: build.deck.slice(), pouch: Object.assign({}, build.pouch),
    oppDeck: null, oppPouch: null, charms: [], foeCharms: [], handBuff: 0, curNode: null, won: false,
  });
  g.map = M.buildAct(1);
  let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map)); // only the edge-reachable nodes
    g.curNode = node;
    if (node.type === 'event') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    setupFight(g, node);
    if (!playFight()) break;
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else { g.active = false; }
  }
  return { won: !!g.won, cleared: g.cleared, act: g.act, score: g.score, coin: g.coin, deathAct: g.won ? 0 : g.act };
}

// --- run K runs ---
let wins = 0; const depths = [], deathActs = new Array(C.acts + 2).fill(0);
for (let i = 0; i < K; i++) {
  const r = simulateRun();
  depths.push(r.cleared);
  if (r.won) wins++; else deathActs[r.deathAct]++;
}
depths.sort((a, b) => a - b);
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const padL = (s, w) => String(s).padStart(w);

console.log(`\nCircuit balance battery — ${K} full all-AI runs (player = ${PLAYER}, varied builds).`);
console.log(`Config: ${C.acts} acts × ${C.actRows} cols · Standing ${C.maxStanding}, heal +${C.heal}, dmgCap ${C.dmgCap}, foe ${C.foeBase}+${C.foeStep}/tier, elite ×${C.eliteHpMult}, boss ×${C.bossHpMult}.\n`);
console.log(`Win rate (ran all ${C.acts} acts): ${Math.round(100 * wins / K)}%  (${wins}/${K})`);
console.log(`Nodes cleared per run: mean ${mean(depths).toFixed(1)} · median ${depths[Math.floor(depths.length / 2)]} · max ${depths[depths.length - 1]}`);
console.log('Deaths by act: ' + deathActs.map((n, a) => a >= 1 && a <= C.acts ? `act ${a}: ${n}` : null).filter(Boolean).join(' · '));
console.log('\nReading: a healthy MVP wants most runs to END (few endless), a non-trivial win rate (~15-40%), and deaths spread across acts (not all act 1).');
