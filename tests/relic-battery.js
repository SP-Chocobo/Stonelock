'use strict';
/* Relic-grading battery (analysis, not pass/fail). The sole-charm value battery is
   BLIND to relics: most are conditional (sovereign needs locks, matchedset needs
   pairs), defensive (secondwind), or disruptive (doublecross), so as a lone charm on
   a bare board they read ~0 while a generic one (followingsea) looks huge. This grades
   each relic the fair way — the WIN-RATE DELTA it adds to a realistic loadout: a
   deck-aligned baseline pool of commons, measured with vs without the relic, averaged
   across all four archetype decks. Run at a raised difficulty (a chit load) so the
   baseline sits mid-range and there's room for a delta to show.

   Run:  K=120 node tests/relic-battery.js
         K=120 CHITS=masters,steep node tests/relic-battery.js
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 120);
const PLAYER = 'The Deckhand';
const POUCH = { red: 1, white: 1, blue: 1, black: 1 };
const CHIT_LOAD = (process.env.CHITS ? process.env.CHITS.split(',').map(s => s.trim()).filter(Boolean) : ['masters', 'steep']);
const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2 : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

// Deck-aligned baseline pools (3 commons each) so the board has real context for a
// relic's condition to fire against. Same shape as the fixer battery's scenarios.
const BASE = {
  vanguard: ['reckless', 'spite', 'firstblood'],
  broker:   ['loadedcoin', 'warchest', 'tollkeeper'],
  anvil:    ['fieldsurgeon', 'bulwarkcharm', 'counterpunch'],
  weaver:   ['whetstone', 'foresight', 'fullsatchel'],
};
const DECKS = Object.keys(BASE);
const RELICS = Object.keys(CHARMS).filter(k => CHARMS[k].bossOnly);
// A couple of known combos worth checking beyond the individual grades.
const COMBOS = [['ironverdict', 'sovereign'], ['matchedset', 'riverking']];

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
function winPct(deckKey, charms) { let w = 0, n = 0; for (let i = 0; i < K; i++) { let r; try { r = simulateRun(deckKey, charms); } catch (e) { continue; } if (!r || r.hung) continue; n++; if (r.won) w++; } return n ? 100 * w / n : 0; }
const lab = k => (CHARMS[k] && CHARMS[k].label) || k;
const cat = k => (M.charmCat ? M.charmCat(k) : '?');

console.log(`\nRelic-grading battery — ${K} runs/deck/condition, decks [${DECKS.join(', ')}], chit load [${CHIT_LOAD.join(', ') || 'none'}].`);
console.log('Win-rate DELTA a relic adds to a deck baseline pool (avg over decks). Higher = stronger relic.\n');

// Per-deck baseline (relic-less) first — the reference each relic is measured against.
const baseByDeck = {}; let baseSum = 0;
for (const d of DECKS) { const b = winPct(d, BASE[d]); baseByDeck[d] = b; baseSum += b; }
console.log('baseline win% (no relic):  ' + DECKS.map(d => `${d} ${baseByDeck[d].toFixed(0)}`).join('  ') + `   avg ${(baseSum / DECKS.length).toFixed(0)}`);
console.log('');

const rows = RELICS.map(k => {
  let dsum = 0;
  for (const d of DECKS) dsum += winPct(d, BASE[d].concat([k])) - baseByDeck[d];
  return { k, delta: dsum / DECKS.length };
}).sort((a, b) => b.delta - a.delta);

console.log('RELIC VALUE (Δ win% vs baseline) — top = strongest in context');
rows.forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${(r.delta >= 0 ? '+' : '') + r.delta.toFixed(1).padStart(5)}pt   ${lab(r.k).padEnd(18)} [${cat(r.k)}]`);
});

console.log('\nCOMBOS (Δ of the pair vs baseline, one representative deck each):');
for (const [a, b] of COMBOS) {
  const d = cat(a) === 'value' ? 'broker' : cat(a) === 'defense' ? 'anvil' : cat(a) === 'cunning' ? 'weaver' : 'vanguard';
  const delta = winPct(d, BASE[d].concat([a, b])) - baseByDeck[d];
  console.log(`  ${(lab(a) + ' + ' + lab(b)).padEnd(36)} on ${d}: ${(delta >= 0 ? '+' : '') + delta.toFixed(1)}pt`);
}
console.log('\nA relic far above the pack wants a look; one near/under 0 is a flavour/feel-bad pick, not a power spike.');
