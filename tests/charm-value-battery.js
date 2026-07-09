'use strict';
/* Charm-value battery (analysis). Measures each COMMON charm's contribution to
   run success — win-rate WITH the charm minus the charm-less baseline — to build
   a hidden effectiveness hierarchy (used by the fixer to target dead weight, not
   elites). Run at a raised difficulty (a fixed chit load) so the baseline isn't
   pinned at the ceiling and charms have room to show +/- deltas. Each charm is
   averaged across a couple of diverse decks so the value is general, not
   deck-specific.

   Run:  K=60 node tests/charm-value-battery.js
         K=60 CHITS=masters,steep,loaded node tests/charm-value-battery.js
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 60);
const PLAYER = 'The Deckhand';
const POUCH = { red: 1, white: 1, blue: 1, black: 1 };
const DECKS = ['vanguard', 'broker']; // aggro + value — a board-buff lens and an economy lens
// No charm accumulation from rewards (each charm is the pilot's SOLE charm), so a
// stronger charm simply wins more — that raw win rate IS the value signal. No chit
// load by default (sole-charm rates already sit in a measurable ~10-50% band).
const CHIT_LOAD = (process.env.CHITS ? process.env.CHITS.split(',').map(s => s.trim()).filter(Boolean) : []);
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
function autoReward(g) { const r = g.reward; if (!r) return; let best = r.cards[0]; for (const c of r.cards) if (cardVal(c) > cardVal(best)) best = c; if (best) r.cardPick = best; if (r.stones && r.stones.length) r.stonePick = r.stones[0]; }
function autoShop(g) { const s = g.shop; if (!s) return; if (s.upgrades && s.upgrades.length && g.coin >= s.upgrades[0].price) M.circuitShopBuy('upgrade', 0); if (s.cards.length && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0); if (g.standing < g.maxStanding * 0.6 && g.coin >= s.healPrice) M.circuitShopBuy('heal'); }
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.event = { choice: 'heal' }; return; }
  let li = -1, lv = 99;
  g.deck.forEach((s, i) => { if (!(s && typeof s === 'object')) { const v = REGIONS.bar.values[s] || 0; if (v < lv) { lv = v; li = i; } } });
  g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
}
function playFight() { const G = M._state(); let guard = 0; while (!G.over && guard++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); } return guard < 30000; }
function setupFight(g, node, tune) {
  g.tableCleared = false; g.groundOut = false; g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col;
  const vp = M.actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = Math.round((tune.foeBase != null ? tune.foeBase : C.foeBase) + tier * (tune.foeStep != null ? tune.foeStep : C.foeStep));
  if (node.type === 'elite') max = Math.round(max * (tune.eliteHpMult != null ? tune.eliteHpMult : C.eliteHpMult));
  if (node.type === 'boss') max = Math.round(max * (tune.bossHpMult != null ? tune.bossHpMult : C.bossHpMult));
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe); g.oppDeck = b.deck;
  const pouch = Object.assign({}, b.pouch);
  if (tune.foeAllStones) for (const c of ['red', 'white', 'blue', 'black', 'green']) pouch[c] = (pouch[c] || 0) + 1;
  g.oppPouch = pouch;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function simulateRun(deckKey, charms) {
  const g = M._gauntlet(); const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const tune = M.computeChitTune(CHIT_LOAD);
  const grit = arch.grit || 0;
  let start = (tune.startStanding != null ? tune.startStanding : C.startStanding) + grit;
  let startMax = (tune.maxStanding != null ? tune.maxStanding : C.maxStanding) + grit;
  for (const k of charms) { const a = CHARMS[k] && CHARMS[k].maxStandingAdd; if (a) { startMax += a; start += a; } }
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax,
    score: 0, opp: null, deck: deck.slice(), pouch: Object.assign({}, POUCH),
    oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: charms.slice(), foeCharms: [], handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0,
    chits: CHIT_LOAD.slice(), chitValue: 0, tune,
  });
  g.map = M.buildAct(1);
  let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map)); g.curNode = node;
    if (node.type === 'event' || node.type === 'repose') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    if (node.type === 'puzzle') { M.circuitAfterNode(); continue; }
    setupFight(g, node, tune);
    if (!playFight()) return { hung: true };
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else { g.active = false; }
  }
  return { won: !!g.won };
}
function winPct(deckKey, charms) { let w = 0; for (let i = 0; i < K; i++) { let r; try { r = simulateRun(deckKey, charms); } catch (e) { continue; } if (r && r.won) w++; } return 100 * w / K; }

const commons = Object.keys(CHARMS).filter(k => !CHARMS[k].bossOnly);
const lab = k => CHARMS[k].label;
const catOf = k => (M.charmCat ? M.charmCat(k) : '?');
console.log(`\nCharm-value battery — ${K} runs/charm/deck, decks [${DECKS.join(', ')}], chit load [${CHIT_LOAD.join(', ') || 'none'}].`);
console.log('Sole-charm win rate = value signal (higher = stronger charm).\n');

const rows = commons.map(k => {
  let sum = 0; for (const d of DECKS) sum += winPct(d, [k]);
  return { k, val: sum / DECKS.length };
}).sort((a, b) => b.val - a.val);

const hi = rows[0].val, lo = rows[rows.length - 1].val, span = Math.max(1, hi - lo);
console.log('CHARM VALUE HIERARCHY (avg sole-charm win%) — top = elite, bottom = dead weight');
rows.forEach((r, i) => {
  const norm = Math.round(100 * (r.val - lo) / span); // 0..100 within the observed spread
  console.log(`  ${String(i + 1).padStart(2)}. ${r.val.toFixed(0).padStart(3)}%  (${String(norm).padStart(3)})  ${lab(r.k).padEnd(16)} [${catOf(r.k)}]`);
});
// Per-category ranking (what the fixer actually uses — bottom 40% of the class).
console.log('\nPER-CATEGORY (the fixer targets the bottom ~40% within a class):');
for (const cat of ['aggro', 'value', 'defense', 'cunning', 'neutral']) {
  const inCat = rows.filter(r => catOf(r.k) === cat);
  if (!inCat.length) continue;
  console.log(`  ${cat}: ` + inCat.map(r => `${lab(r.k)} ${r.val.toFixed(0)}%`).join(' · '));
}
console.log('\nSeed these into a hidden per-charm value; the fixer targets the low end of a class and skips elites to the next pool.');
