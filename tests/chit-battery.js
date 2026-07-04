'use strict';
/* Chit balance battery (analysis, not pass/fail). Grades each difficulty debt by
   running full all-AI Circuit runs with that chit — and stacks — active, versus a
   clean baseline, so the weights (CIRCUIT_CHITS[].chits) can be set from measured
   impact instead of guessed. Also a bug net: every run is wrapped, so an
   interaction-layering fault (two tune flags composing badly) surfaces as a
   THROW or a non-terminating run rather than a silent wrong number.

   Reports, per config: win rate, median nodes cleared, deaths by act, and the
   win-rate DROP vs baseline (the difficulty grade). Prestige chits are forced on
   regardless of campaign progress (we're grading the lever, not the unlock).

   Run:  K=80 node tests/chit-battery.js         (all chits, solo + key combos)
         K=80 CHITS=loaded,thin node tests/chit-battery.js   (one config)
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT;
const REGIONS = M.REGIONS;
const K = +(process.env.K || 80);
const PLAYER = 'The Deckhand'; // one fixed neutral pilot — clean per-chit signal, not skill

const cardVal = s => (s && typeof s === 'object' && s.fx === 'anchor') ? 2 : (REGIONS.bar.values[(s && typeof s === 'object') ? s.type : s] || 2);

// --- auto-pilot (same cautious heuristic as circuit-battery) ---
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
  return guard < 30000; // false = a non-terminating run (a soft-lock / interaction bug)
}

// Set up an all-AI fight with the tune applied. circuitSetupFight itself fields a
// human seat (humans:[0]) and would hang a headless battery, so we replicate its
// foe scaling here — tuned — augment the foe pouch for The Reckoning, and restart
// all-AI. Every OTHER lever (menace, heal, dmgCap, draw, scalpel, ration, fixed
// order, wide board, deep pouch, long night) reads g.tune through ccfg in live
// code during play, so setting g.tune is all they need.
function setupFight(g, node, tune) {
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  g.opp = node.foe;
  const tier = (g.act - 1) * C.actRows + node.col;
  const vp = M.actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = Math.round((tune.foeBase != null ? tune.foeBase : C.foeBase) + tier * (tune.foeStep != null ? tune.foeStep : C.foeStep));
  if (node.type === 'elite') max = Math.round(max * (tune.eliteHpMult != null ? tune.eliteHpMult : C.eliteHpMult));
  if (node.type === 'boss') max = Math.round(max * (tune.bossHpMult != null ? tune.bossHpMult : C.bossHpMult));
  g.foeMax = max; g.foeHp = max; g.foeCharms = node.foeCharms || [];
  const b = M.circuitBuildFor(node.foe);
  g.oppDeck = b.deck;
  const pouch = Object.assign({}, b.pouch);
  if (tune.foeAllStones) for (const c of ['red', 'white', 'blue', 'black', 'green']) pouch[c] = (pouch[c] || 0) + 1; // The Reckoning
  g.oppPouch = pouch;
  M.circuitResetPiles();
  M.newGame({ mode: 'duel', humans: [], companyNames: [PLAYER, node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
}
function simulateRun(keys) {
  const g = M._gauntlet();
  const build = M.circuitBuildFor(PLAYER);
  const tune = M.computeChitTune(keys);
  const startMax = tune.maxStanding != null ? tune.maxStanding : C.maxStanding;
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0,
    standing: tune.startStanding != null ? tune.startStanding : C.startStanding, maxStanding: startMax,
    score: 0, opp: null, deck: build.deck.slice(), pouch: Object.assign({}, build.pouch),
    oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null, charms: [], foeCharms: [],
    handBuff: 0, curNode: null, won: false, secondWindUsed: false,
    chits: keys.slice(), chitValue: M.chitValue(keys), tune,
  });
  g.map = M.buildAct(1);
  let guard = 0;
  while (g.active && guard++ < 200) {
    const node = chooseNode(g, M.circuitReachable(g.map));
    g.curNode = node;
    if (node.type === 'event' || node.type === 'repose') { autoEvent(g); M.circuitTakeEventAndAdvance(); continue; }
    if (node.type === 'shop') { g.shop = M.makeShop(); autoShop(g); g.shop = null; M.circuitAfterNode(); continue; }
    if (node.type === 'puzzle') { M.circuitAfterNode(); continue; }
    setupFight(g, node, tune);
    if (!playFight()) return { hung: true, cleared: g.cleared, act: g.act };
    if (g.tableCleared) { M.circuitEnd(); autoReward(g); M.circuitTakeRewardAndAdvance(); }
    else { g.active = false; }
  }
  return { won: !!g.won, cleared: g.cleared, act: g.act, deathAct: g.won ? 0 : g.act };
}

function grade(keys) {
  let wins = 0, hung = 0, threw = 0; const depths = [], deathActs = new Array(C.acts + 2).fill(0);
  for (let i = 0; i < K; i++) {
    let r;
    try { r = simulateRun(keys); }
    catch (e) { threw++; if (threw <= 2) console.log(`    THREW [${keys.join('+') || 'baseline'}]: ${e.message}`); continue; }
    if (r.hung) { hung++; continue; }
    depths.push(r.cleared);
    if (r.won) wins++; else deathActs[r.deathAct]++;
  }
  depths.sort((a, b) => a - b);
  const n = depths.length || 1;
  return { keys, wins, hung, threw, winPct: Math.round(100 * wins / K), med: depths[Math.floor(n / 2)] || 0, deathActs, value: M.chitValue(keys) };
}

// Configs: baseline, each chit solo, then interaction-layering combos + full stack.
const ALL = M.CIRCUIT_CHITS.map(c => c.key);
const combos = [
  ['ration', 'fixedorder'],   // both touch the stone draw/selection
  ['scalpel', 'wideboard'],   // Foundation cut + wider foe board
  ['longnight', 'lean'],      // bleed + weak heals (survival squeeze)
  ['reckoning', 'scalpel'],   // foe green everywhere + your Foundation cut (double poison)
  ['ration', 'fixedorder', 'purse'], // stone-economy triple
];
let configs;
if (process.env.CHITS) configs = [process.env.CHITS.split(',').map(s => s.trim()).filter(Boolean)];
else configs = [[], ...ALL.map(k => [k]), ...combos, ALL.slice()];

console.log(`\nChit battery — ${K} all-AI runs per config (pilot = ${PLAYER}). Prestige chits forced on.\n`);
const base = grade([]);
const nameOf = k => { const c = M.chitByKey(k); return c ? c.name : k; };
const line = g => {
  const label = g.keys.length ? g.keys.map(nameOf).join(' + ') : 'BASELINE';
  const drop = g.keys.length ? `  drop ${String(base.winPct - g.winPct).padStart(3)}pt` : '';
  const deaths = g.deathActs.map((n, a) => a >= 1 && a <= C.acts ? `a${a}:${n}` : null).filter(Boolean).join(' ');
  const flags = (g.hung ? ` ⚠HUNG×${g.hung}` : '') + (g.threw ? ` ⚠THREW×${g.threw}` : '');
  return `${String(g.value).padStart(2)}c  win ${String(g.winPct).padStart(3)}%${drop}  med ${String(g.med).padStart(2)}  [${deaths}]${flags}  ${label}`;
};
console.log(line(base));
console.log('  ── solo (difficulty grade = win-rate drop vs baseline) ──');
const solos = ALL.map(k => grade([k])).sort((a, b) => (base.winPct - b.winPct) - (base.winPct - a.winPct));
for (const g of solos) console.log('  ' + line(g));
console.log('  ── combos (interaction-layering bug net) ──');
for (const cfg of [...combos, ALL.slice()]) console.log('  ' + line(grade(cfg)));
console.log('\nGrade → weight: ~1 chit per ~8-10pt win-rate drop. Any ⚠HUNG/⚠THREW is an interaction bug to fix; win 0% + low med = unbeatable, dial back.');
