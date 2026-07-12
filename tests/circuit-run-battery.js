'use strict';
/* Full-run circuit battery with COMPETENT play (analysis, not pass/fail). Unlike the
   isolate-a-charm batteries, this plays realistic runs and lets acquisitions accrue
   naturally — the pilot drafts whatever the run offers (not along class lines), keeps
   its deck/pouch LEAN (declines a card unless it beats the deck average; declines a
   stone unless it fixes a colour gap), seeks Repose under 50% Standing, avoids Elites
   under 40% when no Repose is reachable, buys upgrades and only-upgrade cards, and
   thins dead cards at events. Reports win% / depth / final pool size / the charm mix
   that naturally emerges, per starting class across three difficulty loads.

   Run:  K=200 node tests/circuit-run-battery.js
*/
const M = require('../game.js');
M.setAlphaUnlock(true);
const C = M.CIRCUIT, REGIONS = M.REGIONS, TYPES = M.TYPES, CHARMS = M.CHARMS;
const K = +(process.env.K || 200);
const CLASSES = ['vanguard', 'broker', 'anvil', 'weaver'];
const LOADS = {
  baseline: [],
  moderate: ['lean', 'thin'],                        // attrition only: less heal + thinner start (no foe combat buff)
  heavy:    ['masters', 'steep', 'loaded', 'wideboard'], // tough bosses, steep scaling, +1 boards, wider boards
};
const POUCH0 = { red: 1, white: 1, blue: 1, black: 1 };
const cardVal = c => { const t = (c && typeof c === 'object') ? c.type : c; return (REGIONS.bar.values[t] || 2) + ((c && typeof c === 'object' && c.fx) ? 1.5 : 0); };
const deckAvg = deck => deck.length ? deck.reduce((s, c) => s + cardVal(c), 0) / deck.length : 0;
const worth = k => (M.charmWorth ? M.charmWorth(k) : 20);

// --- competent play heuristics -------------------------------------------------
function chooseNode(g, col) {
  const s = g.standing / g.maxStanding;
  const has = t => col.find(n => n.type === t);
  const nonElite = col.filter(n => n.type !== 'elite' && n.type !== 'boss');
  if (s < 0.5) {                                    // hurt: heal first
    const rep = has('repose') || has('shop') || has('event'); if (rep) return rep;
  }
  if (s < 0.4 && nonElite.length) {                 // low + no repose reachable → dodge the elite
    const duel = nonElite.find(n => n.type === 'duel'); return duel || nonElite[0];
  }
  // healthy: take an elite for the better spoils now and then, else press on via a duel
  if (s > 0.72 && has('elite') && Math.random() < 0.5) return has('elite');
  const duel = has('duel'); if (duel) return duel;
  return col[Math.floor(Math.random() * col.length)];
}
function autoReward(g) {
  const r = g.reward; if (!r) return;
  // CARD: take only if it beats the current deck average (a real upgrade), else decline.
  const avg = deckAvg(g.deck);
  let best = null; for (const c of (r.cards || [])) if (!best || cardVal(c) > cardVal(best)) best = c;
  r.cardPick = (best && cardVal(best) > avg) ? best : null;
  // STONE: take only to shore up the least-held colour while the pouch is still lean.
  const total = Object.values(g.pouch).reduce((a, b) => a + b, 0);
  if (total < 9 && r.stones && r.stones.length) {
    let pick = null, lo = 99; for (const st of r.stones) { const cnt = g.pouch[st] || 0; if (cnt < lo) { lo = cnt; pick = st; } }
    r.stonePick = pick;
  } else r.stonePick = null;
  // CHARM: always take the strongest offered (charms are permanent; class-agnostic).
  let bc = null; for (const k of (r.charms || [])) if (!bc || worth(k) > worth(bc)) bc = k;
  r.charmPick = bc;
}
function autoShop(g) {
  const s = g.shop; if (!s) return;
  if (g.standing < g.maxStanding * 0.5 && g.coin >= s.healPrice) M.circuitShopBuy('heal');
  if (s.upgrades && s.upgrades.length && g.coin >= s.upgrades[0].price) M.circuitShopBuy('upgrade', 0); // variants are strict upgrades
  const avg = deckAvg(g.deck);
  if (s.cards && s.cards.length && cardVal(s.cards[0]) > avg && g.coin >= s.cards[0].price) M.circuitShopBuy('card', 0);
}
function autoEvent(g) {
  if (g.standing < g.maxStanding * 0.6) { g.event = { choice: 'heal' }; return; }
  const avg = deckAvg(g.deck); let li = -1, lv = 99;
  g.deck.forEach((c, i) => { const v = cardVal(c); if (v < lv && v < avg) { lv = v; li = i; } }); // thin a below-average card
  g.event = (li >= 0 && g.deck.length > C.deckFloor) ? { choice: 'removeCard', cardIdx: li } : { choice: 'heal' };
}
// --- sim plumbing (shared with the other batteries) ----------------------------
function playFight() { const G = M._state(); let guard = 0; while (!G.over && guard++ < 30000) { if (!G.queue.length) M.nextHand(); else M._run(); } return guard < 30000; }
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
function run(deckKey, chits) {
  const g = M._gauntlet(); const arch = M.deckByKey(deckKey);
  const deck = TYPES.slice().concat(arch.cards.map(c => ({ type: c.type, fx: c.fx })));
  const tune = M.computeChitTune(chits); const grit = arch.grit || 0;
  let start = (tune.startStanding != null ? tune.startStanding : C.startStanding) + grit;
  let startMax = (tune.maxStanding != null ? tune.maxStanding : C.maxStanding) + grit;
  Object.assign(g, {
    active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax, score: 0, opp: null,
    deck: deck.slice(), pouch: Object.assign({}, POUCH0), oppDeck: null, oppPouch: null, allyDeck: null, allyPouch: null,
    charms: [], foeCharms: [], handBuff: 0, curNode: null, won: false, secondWindUsed: false, winStreak: 0, chits: chits.slice(), chitValue: 0, tune,
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
    else return { won: false, cleared: g.cleared, deck: g.deck.length, pouch: Object.values(g.pouch).reduce((a, b) => a + b, 0), charms: g.charms.slice() };
  }
  return { won: !!g.won, cleared: g.cleared, deck: g.deck.length, pouch: Object.values(g.pouch).reduce((a, b) => a + b, 0), charms: g.charms.slice() };
}

console.log(`\nFull-run circuit battery — ${K} runs/class/load, competent play (repose<50%, dodge elites<40%, lean deck/pouch, best-charm drafting).`);
const catMix = {}; // aggregate drafted-charm category counts across everything
for (const load of Object.keys(LOADS)) {
  console.log(`\n── ${load.toUpperCase()} ${LOADS[load].length ? '[' + LOADS[load].join(', ') + ']' : '(no chits)'} ──`);
  for (const cls of CLASSES) {
    let w = 0, n = 0, cl = 0, dk = 0, po = 0, ch = 0;
    for (let i = 0; i < K; i++) {
      let r; try { r = run(cls, LOADS[load]); } catch (e) { continue; }
      if (!r || r.hung) continue; n++; cl += r.cleared || 0; dk += r.deck || 0; po += r.pouch || 0; ch += r.charms.length;
      if (r.won) w++;
      for (const k of r.charms) { const c = M.charmCat(k); catMix[c] = (catMix[c] || 0) + 1; }
    }
    console.log(`  ${cls.padEnd(9)} win ${String(Math.round(100 * w / n)).padStart(3)}%   tables ${(cl / n).toFixed(1).padStart(4)}   final deck ${(dk / n).toFixed(0)}   pouch ${(po / n).toFixed(0)}   charms ${(ch / n).toFixed(1)}`);
  }
}
const mixTot = Object.values(catMix).reduce((a, b) => a + b, 0) || 1;
console.log('\nWhat naturally accrues — drafted-charm category mix (across all runs):');
console.log('  ' + ['aggro', 'value', 'defense', 'cunning', 'neutral'].map(c => `${c} ${Math.round(100 * (catMix[c] || 0) / mixTot)}%`).join('   '));
console.log('\nEqual win% across classes at a load = the class is fine there. A class far below the rest wants help.');
