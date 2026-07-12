'use strict';
/* Context charm-grading battery (analysis). The old sole-charm value battery measured
   a charm on a BARE board (no upgrades, no real deck) — blind to anything that needs a
   built board to matter. This grades each charm as the SOLE charm but on top of a
   COMPETENTLY BUILT run: real card/stone/shop/upgrade accumulation (decline-aware, lean
   pool), just no other charms to confound it. Win% across a couple of decks = the
   charm's value in a robust context. Compares to the current hidden CHARM_VAL so we can
   see what's mis-tuned. Relics included (ALL=1 already implicit — all charms measured).

   Run:  K=150 node tests/charm-context-battery.js
         K=150 CHITS=thin node tests/charm-context-battery.js
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 150);
const DECKS = ['vanguard', 'broker']; // an aggro lens + an economy lens
const CHITS = (process.env.CHITS ? process.env.CHITS.split(',').map(s => s.trim()).filter(Boolean) : ['thin']);
const POUCH0 = { red: 1, white: 1, blue: 1, black: 1 };
const cardVal = c => { const t = (c && typeof c === 'object') ? c.type : c; return (REGIONS.bar.values[t] || 2) + ((c && typeof c === 'object' && c.fx) ? 1.5 : 0); };
const deckAvg = d => d.length ? d.reduce((s, c) => s + cardVal(c), 0) / d.length : 0;

// competent play (same heuristics as the full-run battery), but charm drafting OFF so
// the sole test charm is the only one — card/stone/shop still accrue for real context.
function chooseNode(g, col) {
  const s = g.standing / g.maxStanding; const has = t => col.find(n => n.type === t);
  const nonElite = col.filter(n => n.type !== 'elite' && n.type !== 'boss');
  if (s < 0.5) { const r = has('repose') || has('shop') || has('event'); if (r) return r; }
  if (s < 0.4 && nonElite.length) { const d = nonElite.find(n => n.type === 'duel'); return d || nonElite[0]; }
  if (s > 0.72 && has('elite') && Math.random() < 0.5) return has('elite');
  const d = has('duel'); if (d) return d; return col[Math.floor(Math.random() * col.length)];
}
function autoReward(g) {
  const r = g.reward; if (!r) return; const avg = deckAvg(g.deck);
  let best = null; for (const c of (r.cards || [])) if (!best || cardVal(c) > cardVal(best)) best = c;
  r.cardPick = (best && cardVal(best) > avg) ? best : null;
  const total = Object.values(g.pouch).reduce((a, b) => a + b, 0);
  if (total < 9 && r.stones && r.stones.length) { let p = null, lo = 99; for (const st of r.stones) { const c = g.pouch[st] || 0; if (c < lo) { lo = c; p = st; } } r.stonePick = p; } else r.stonePick = null;
  r.charmPick = null; // sole charm only — decline all charm rewards
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
function run(deckKey, charm) {
  const g = M._gauntlet(); const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const tune = M.computeChitTune(CHITS); const grit = arch.grit || 0;
  let start = (tune.startStanding != null ? tune.startStanding : C.startStanding) + grit;
  let startMax = (tune.maxStanding != null ? tune.maxStanding : C.maxStanding) + grit;
  const a = charm && CHARMS[charm] && CHARMS[charm].maxStandingAdd; if (a) { startMax += a; start += a; }
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax, score: 0, opp: null,
    deck: deck.slice(), pouch: Object.assign({}, POUCH0), oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: charm ? [charm] : [], foeCharms: [], handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0, chits: CHITS.slice(), chitValue: 0, tune,
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
function winPct(charm) { let w = 0, n = 0; for (const d of DECKS) for (let i = 0; i < K; i++) { let r; try { r = run(d, charm); } catch (e) { continue; } if (!r || r.hung) continue; n++; if (r.won) w++; } return n ? 100 * w / n : 0; }
const lab = k => (CHARMS[k] && CHARMS[k].label) || k;
const cat = k => M.charmCat(k);
const cur = k => (M.charmWorth ? M.charmWorth(k) : '?');

console.log(`\nContext charm-grading — ${K} runs/deck/charm, decks [${DECKS.join(', ')}], load [${CHITS.join(',') || 'none'}], competent play + real deck/pouch build.`);
const noCharm = winPct(null);
console.log(`no-charm baseline win: ${noCharm.toFixed(0)}%   (each charm's win% above this is its lift)\n`);
const keys = Object.keys(CHARMS);
const rows = keys.map(k => ({ k, w: winPct(k) })).sort((a, b) => b.w - a.w);
console.log('CHARM VALUE IN CONTEXT (sole-charm win% on a built run) — vs current hidden value:');
rows.forEach((r, i) => {
  const lift = r.w - noCharm;
  console.log(`  ${String(i + 1).padStart(2)}. ${r.w.toFixed(0).padStart(3)}%  (lift ${(lift >= 0 ? '+' : '') + lift.toFixed(0)}pt)  ${lab(r.k).padEnd(18)} [${cat(r.k)}]${CHARMS[r.k].bossOnly ? ' ★' : ''}   cur ${cur(r.k)}`);
});
console.log('\nBig lift = strong; ~0 lift = weak/redundant. Mismatch vs "cur" = a candidate to re-tune CHARM_VAL and/or the charm.');
