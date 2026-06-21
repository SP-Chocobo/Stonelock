'use strict';
/* The Circuit (Phase 0 roguelike). Unit-tests the run wrapper: the act map
   (columns → boss), node entry/fights, Standing attrition with shaping/cap,
   ground-out, clear→reward→advance, acts→victory, the depleting decks, foe
   builds + foe charms, effect-card and charm scoring, spoils, the interlude
   event, and the persisted records. The match engine per venue is covered by
   simulate/precedence/etc. */
const M = require('../game.js');
M.setAlphaUnlock(true);
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const DMG_CAP = M.CIRCUIT.dmgCap; // read the live config so tuning can't desync the test
const STONE_KEYS = ['red', 'white', 'blue', 'black'];
function card(type, fx, owner) { return { type, fx: fx || null, owner: owner || 0, origOwner: owner || 0, faceUp: true, known: [true, true], stones: [], zone: 'board' }; }
function enterFirstFight() { M.startCircuit(); const g = M._gauntlet(); M.circuitEnterNode(g.map.cols[0][0]); return [g, M._state()]; }

// --- the act map ---
M.startCircuit();
let g = M._gauntlet();
assert(g.active && g.act === 1 && g.score === 0 && g.coin === 0, 'a run starts active at act 1, no score/coin');
assert(g.standing === g.maxStanding && g.standing > 0, 'starts at full Standing');
assert(g.map && g.map.cols.length === M.CIRCUIT.actRows && g.map.col === 0, 'the act map is built with the configured columns');
assert(g.map.cols[g.map.cols.length - 1][0].type === 'boss', 'the last column is the act boss');
assert(g.map.cols[0][0].type === 'duel', 'the opening node is a safe duel');

// --- entering a node builds the fight ---
let G;
[g, G] = enterFirstFight();
assert(G.gauntlet === true && G.nPlayers === 2, 'entering a node builds a flagged duel');
assert(G.venueKey === 'tavern', 'act 1 column 0 is the tavern');
assert(g.foeHp === g.foeMax && g.foeHp > 0, 'the foe starts at full Standing');
assert(g.deck && g.deck.length === 10, 'owned deck = one of each (8) + 2 picks = 10');
assert(g.pouch && STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0) === 4, 'pouch holds 4 stones');
assert(STONE_KEYS.reduce((s, c) => s + (G.players[0].pool[c] || 0), 0) === 3, 'seat 0 draws a 3-stone working set');

// --- two-pool damage: hands hit the loser's Standing, shaped/capped ---
const youFull = g.standing, foeFull = g.foeHp;
M.circuitHandResult({ members: [1] }, 3);
assert(g.standing === youFull - 3, 'a lost hand drains YOUR Standing by its margin');
assert(g.foeHp === foeFull, 'a lost hand does not touch the opponent');
M.circuitHandResult({ members: [0] }, 4);
assert(g.foeHp === foeFull - 4, 'a won hand drains the opponent');
M.circuitHandResult({ members: [1] }, 99);
assert(g.standing === youFull - 3 - DMG_CAP, 'damage is shaped/capped');

// --- ground-out ends the run ---
let safety = 0;
while (g.standing > 0) { M.circuitHandResult({ members: [1] }, 99); if (safety++ > 50) assert(false, 'standing never drained'); }
assert(g.standing === 0 && g.groundOut && M._state().over === true, 'your Standing at 0 grounds you out');
M.circuitEnd();
assert(!M._gauntlet().active, 'ground-out ends the run');
assert(M.circuitRecords().runs.length >= 1, 'a finished run is banked');

// --- clearing a node: reward, then advance the map ---
[g, G] = enterFirstFight();
const col0 = g.map.col;
safety = 0;
while (g.foeHp > 0) { M.circuitHandResult({ members: [0] }, 99); if (safety++ > 50) assert(false, 'foe never dropped'); }
assert(g.tableCleared && M._state().over === true, 'dropping the foe clears the node');
M.circuitEnd();
assert(g.cleared === 1 && g.coin > 0, 'a clear banks a node + coin');
g.reward.cardPick = null; g.reward.stonePick = null; g.reward.charmPick = null;
M.circuitTakeRewardAndAdvance();
assert(g.map.col === col0 + 1, 'taking the reward advances to the next map column');

// --- acts → victory ---
g = M._gauntlet();
g.curNode = { type: 'boss', col: M.CIRCUIT.actRows - 1 }; g.act = 1;
M.circuitAfterNode();
assert(M._gauntlet().act === 2 && M._gauntlet().map.act === 2, 'clearing the act boss advances to the next act');
g = M._gauntlet(); g.curNode = { type: 'boss', col: M.CIRCUIT.actRows - 1 }; g.act = M.CIRCUIT.acts;
M.circuitAfterNode();
assert(!M._gauntlet().active && M._gauntlet().won === true, 'clearing the final act boss wins the run');

// --- foe builds + foe charms (elites/bosses) ---
const a1boss = M.buildAct(1).cols.slice(-1)[0][0];
assert(a1boss.foeCharms.length === 0, 'act 1 bosses carry no charms');
const a2boss = M.buildAct(2).cols.slice(-1)[0][0];
assert(a2boss.foeCharms.length === 1, 'act 2 bosses carry a charm');
// foe charms buff the foe's board (seat 1), through the player's eyes too
[g, G] = enterFirstFight();
g.foeCharms = ['loadedcoin'];
const rvCoin = G.region.values['Coin'];
G.players[1].board = [card('Coin', null, 1)];
M.applyCardEffects();
assert(G.players[1].board[0].evalue === rvCoin + 1, 'foe charms buff the foe board (seat 1)');

// --- effect-card + charm scoring (unit) ---
const vv = { A: 2, B: 2 };
const plain = M.bestSelection([{ type: 'A' }, { type: 'B' }, { type: 'A', evalue: 5 }], vv, {});
assert(plain.raw === 9, 'effect cards score by their evalue (2 + 2 + 5)');
assert(M.bestSelection([{ type: 'A' }, { type: 'A' }, { type: 'B' }], vv, { bonusAdd: 1 }).score
     === M.bestSelection([{ type: 'A' }, { type: 'A' }, { type: 'B' }], vv, {}).score + 1, "Forger's Seal sweetens a Pair");

// --- charm value lever + economy ---
[g, G] = enterFirstFight();
g.charms = ['loadedcoin'];
G.players[0].board = [card('Coin', null, 0)];
M.applyCardEffects();
assert(G.players[0].board[0].evalue === G.region.values['Coin'] + 1, 'Loaded Coin adds +1 to your Coins');
M.startCircuit(); g = M._gauntlet();
const ms0 = g.maxStanding;
g.reward = { cards: [], stones: [], charms: ['hardened'], cardPick: null, stonePick: null, charmPick: 'hardened' };
g.curNode = { type: 'elite', col: 1 };
M.circuitTakeRewardAndAdvance();
g = M._gauntlet();
assert(g.charms.indexOf('hardened') >= 0 && g.maxStanding === ms0 + 3, 'drafting Hardened adds it and raises max Standing');

// --- the interlude event: heal / thin / move a modifier ---
M.startCircuit(); g = M._gauntlet(); g.standing = 2;
assert(M.circuitHealAmount() === Math.ceil(g.maxStanding * 0.6), 'heal is ceil(60% of max)');
g.curNode = { type: 'event', col: 2 };
g.event = { choice: 'heal' };
M.circuitTakeEventAndAdvance();
g = M._gauntlet();
assert(g.standing === 2 + Math.ceil(g.maxStanding * 0.6), 'healing restores the rounded-up 60%');
const dN = g.deck.length; g.curNode = { type: 'event', col: 2 };
g.event = { choice: 'removeCard', cardIdx: 0 };
M.circuitTakeEventAndAdvance();
assert(M._gauntlet().deck.length === dN - 1, 'remove-a-card thins the deck');

// --- depleting decks conserve across reshuffles ---
[g, G] = enterFirstFight();
M.circuitResetPiles();
const you = g.piles[0], deckN = g.deck.length;
M.circuitDrawCards(4);
for (let i = 0; i < 12; i++) M.circuitDrawCards(4);
assert(you.cardDraw.length + you.cardDiscard.length + (you.cardHand ? you.cardHand.length : 0) === deckN, 'cards are conserved across reshuffles');
assert(g.piles[1], 'the foe also has a depleting pile set');

// --- the shop: spend coin on cards / stones / charms / thin ---
M.startCircuit(); g = M._gauntlet();
assert(g.map.cols[M.CIRCUIT.actRows - 2][0].type === 'shop', 'a shop sits before each act boss');
g.coin = 40; g.shop = M.makeShop();
const sh = g.shop;
assert(sh.cards.length === 3 && sh.stones.length === 2, 'the shop stocks cards and stones');
const dBefore = g.deck.length, coinBefore = g.coin;
M.circuitShopBuy('card', 0);
assert(g.deck.length === dBefore + 1 && g.coin === coinBefore - sh.cards[0].price, 'buying a card adds it and spends coin');
assert(sh.sold['c0'] === true, 'a bought card is marked sold');
const wBefore = STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0);
M.circuitShopBuy('stone', 0);
assert(STONE_KEYS.reduce((s, c) => s + (g.pouch[c] || 0), 0) === wBefore + 1, 'buying a stone grows the pouch');
if (sh.charms.length) { const cb = (g.charms || []).length; M.circuitShopBuy('charm', 0); assert((g.charms || []).length === cb + 1, 'buying a charm adds it'); }
// can't afford → no purchase
g.coin = 0; const d2 = g.deck.length; M.circuitShopBuy('card', 1);
assert(g.deck.length === d2, 'a purchase you cannot afford is refused');
// thin removes a card for coin (floored)
g.coin = 40; g.shop = M.makeShop(); const d3 = g.deck.length;
M.circuitShopThin(0);
assert(g.deck.length === d3 - 1 && g.coin === 40 - M.CIRCUIT.shopThin, 'thinning at the shop removes a card for coin');

// --- records: seen flag + run banking ---
M.markCharmSeen('whetstone');
assert(M.charmSeen('whetstone') === true, 'an offered charm is recorded as seen');
M.recordCircuitRun({ cleared: 9, score: 200, opp: 'The Lady', venue: 'docks', won: true, act: 3 });
const rec = M.circuitRecords();
assert(rec.runs[0].tables === 9 && rec.runs[0].won === true, 'a finished run banks into history');
assert(rec.best.tables >= 9 && rec.best.score >= 200, 'best results update');

console.log('OK circuit: act map, node fights, Standing/clear/ground-out, acts→victory, foe charms, effect/charm scoring, depleting decks, spoils, events, records.');
