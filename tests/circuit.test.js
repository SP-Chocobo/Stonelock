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
assert(g.map && g.map.cols.length === M.CIRCUIT.actRows && g.map.pos === null, 'the act map is built; you start before the entry');
assert(g.map.cols[g.map.cols.length - 1][0].type === 'boss', 'the last column is the act boss');
assert(g.map.cols[0][0].type === 'duel', 'the opening node is a safe duel');
// branching tree: every node has an outgoing edge, every non-entry node an incoming
for (let c = 0; c < g.map.cols.length - 1; c++) for (const n of g.map.cols[c]) assert(n.edges && n.edges.length >= 1, 'every non-boss node has an outgoing edge');
for (let c = 1; c < g.map.cols.length; c++) for (let j = 0; j < g.map.cols[c].length; j++) assert(g.map.cols[c - 1].some(n => n.edges.includes(j)), 'every node has an incoming edge (no orphans)');
assert(M.circuitReachable(g.map).length === g.map.cols[0].length, 'before entry, the whole first column is reachable');

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
safety = 0;
while (g.foeHp > 0) { M.circuitHandResult({ members: [0] }, 99); if (safety++ > 50) assert(false, 'foe never dropped'); }
assert(g.tableCleared && M._state().over === true, 'dropping the foe clears the node');
M.circuitEnd();
assert(g.cleared === 1 && g.coin > 0, 'a clear banks a node + coin');
g.reward.cardPick = null; g.reward.stonePick = null; g.reward.charmPick = null;
M.circuitTakeRewardAndAdvance();
assert(g.map.pos && g.map.pos.col === 0, 'taking the reward leaves you standing on the cleared entry node');
assert(M.circuitReachable(g.map).every(n => n.col === 1), 'your next choices are the cleared node\'s edges (column 1)');

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

// --- the new encounter events (cache / whetstone / swap / gamble) ---
M.startCircuit(); g = M._gauntlet();
// every random event is an encounter, never the interlude (that's the Repose node)
g.pouch = { red: 1, white: 1, blue: 1, black: 1 }; g.charms = [];
for (let i = 0; i < 40; i++) assert(M.makeCircuitEvent().kind !== 'interlude', 'random events never roll the interlude');
assert(M.variantForBase('red') === 'twinred' && M.upgradableStones(g).length === 4, 'upgradable stones are the held bases that have a variant');
// cache: taking a card adds it to the deck
g.curNode = { type: 'event', col: 1 }; const cdN = g.deck.length;
g.event = { kind: 'cache', offer: [{ type: 'Coin', fx: null }, { type: 'Sword', fx: 'keen' }], cardIdx: 1 };
M.circuitTakeEventAndAdvance();
assert(g.deck.length === cdN + 1, 'a cache pick adds the chosen card to the deck');
// whetstone: upgrades a held base stone to its variant
g.curNode = { type: 'event', col: 1 }; g.pouch = { red: 1, white: 1, blue: 1, black: 1 };
g.event = { kind: 'whetstone', stoneColor: 'red' };
M.circuitTakeEventAndAdvance();
assert((g.pouch.red || 0) === 0 && (g.pouch.twinred || 0) === 1, 'a whetstone hones Red into Twin Red');
// swap: gives up a chosen stone for the fixed offered one
g.curNode = { type: 'event', col: 1 }; g.pouch = { white: 2, blue: 1 };
g.event = { kind: 'swap', stoneColor: 'white', gain: 'black' };
M.circuitTakeEventAndAdvance();
assert((g.pouch.white || 0) === 1 && (g.pouch.black || 0) === 1, 'a crooked trade swaps a stone for the offered one');
// gamble: pawns one charm for another
g.curNode = { type: 'event', col: 1 }; g.charms = ['masterforger'];
g.event = { kind: 'gamble', giveCharm: 'masterforger', gain: 'forgerseal' };
M.circuitTakeEventAndAdvance();
assert(!g.charms.includes('masterforger') && g.charms.includes('forgerseal'), 'the pawnbroker swaps one charm for another');
// gold windfall: banks its coin
g.curNode = { type: 'event', col: 1 }; const coin0 = g.coin || 0;
g.event = { kind: 'gold', gold: 12 };
M.circuitTakeEventAndAdvance();
assert((g.coin || 0) === coin0 + 12, 'a windfall banks its coin');
// Resonance charm: heals 1 on every third stone placed
assert(M.CHARMS.resonance && M.CHARMS.resonance.on.stonePlaced, 'Resonance fires on stone placement');
const rg = { standing: 5, maxStanding: 20, resoCount: 0 };
M.CHARMS.resonance.on.stonePlaced(rg); M.CHARMS.resonance.on.stonePlaced(rg);
assert(rg.standing === 5, 'Resonance does not heal before the third stone');
M.CHARMS.resonance.on.stonePlaced(rg);
assert(rg.standing === 6, 'Resonance heals 1 Standing on the third stone');

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

// --- seeded RNG: a seed reproduces the run; lanes assigned ---
M.seedRng(4242); const mapA = M.buildAct(1);
M.seedRng(4242); const mapB = M.buildAct(1);
const sig = m => m.cols.map(col => col.map(n => n.type + (n.foe || '') + n.edges.join('')).join('|')).join('/');
assert(sig(mapA) === sig(mapB), 'the same seed builds the same act');
M.seedRng(777); assert(sig(M.buildAct(1)) !== sig(mapA), 'a different seed builds a different act');
M.clearRng();
for (const col of mapA.cols) for (const n of col) assert(n.lane >= 0 && n.lane < 3, 'every node has a lane for the tree layout');

// --- card flow: cantrip draws on commit (conserved), hand-edit charms exist ---
M.startCircuit(); g = M._gauntlet(); M.circuitEnterNode(g.map.cols[0][0]); G = M._state();
const handBefore = G.players[0].hand.length;
M._ai.EFFECTS.cantrip.onCommit(0); // simulate committing a Cantrip card
assert(G.players[0].hand.length === handBefore + 1, 'Cantrip draws a card into hand on commit');
const cps = g.piles[0];
assert(cps.cardDraw.length + cps.cardDiscard.length + (cps.cardHand ? cps.cardHand.length : 0) === g.deck.length, 'a Cantrip draw keeps the deck conserved');
assert(M._ai.EFFECTS.cantrip.aiKeep() > 0, 'the AI keeps a Cantrip (card advantage has value)');
assert(M.CHARMS.mulligan.mulliganFirst && M.CHARMS.cycle.cycleEach && M.CHARMS.foresight.foresight === 2, 'Mulligan / Cycle / Foresight charms are registered');

// --- stone variants: Twin Red (draw, score, shop upgrade) ---
assert(M.stoneBase('twinred') === 'red' && M.isVariant('twinred') && !M.isVariant('red'), 'twinred is a red variant');
// Twin Red gives two phantoms — a card can stand as a Triad alone
const triadAlone = M.bestSelection([{ type: 'Coin', hasRed: true, phantoms: 2 }], { Coin: 3 }, {});
assert(triadAlone.structure === 'triad', 'a Twin Red card (2 phantoms) forms a Triad on its own');
// shop upgrade converts a base Red into Twin Red
M.startCircuit(); g = M._gauntlet();
g.pouch = { red: 2, white: 1, blue: 1 }; g.coin = 40;
g.shop = M.makeShop();
const upIdx = g.shop.upgrades.findIndex(u => u.variant === 'twinred');
assert(upIdx >= 0, 'the shop offers a Twin Red upgrade when you hold a Red');
M.circuitShopBuy('upgrade', upIdx);
assert((g.pouch.red || 0) === 1 && (g.pouch.twinred || 0) === 1 && g.coin === 40 - M.CIRCUIT.shopUpgrade, 'upgrading turns a Red into a Twin Red for coin');
// a variant in the pouch draws into the working set
g.pouch = { twinred: 1, white: 1, blue: 1, black: 1 };
M.circuitResetPiles();
const draw = []; const ps2 = g.piles[0];
for (let i = 0; i < 30 && ps2.stoneDraw.length; i++) draw.push(ps2.stoneDraw.pop());
assert(draw.includes('twinred'), 'a Twin Red in the pouch is drawn like any stone');

// --- stone variants: Deadbolt White (double lock) + Riptide Blue (downgrade) ---
assert(M.stoneBase('deadbolt') === 'white' && M.isVariant('deadbolt'), 'deadbolt is a white variant');
assert(M.stoneBase('riptide') === 'blue' && M.isVariant('riptide'), 'riptide is a blue variant');
assert(M.getStone('deadbolt').name === 'Deadbolt White' && M.getStone('riptide').name === 'Riptide Blue', 'a variant carries its own name over the base colour');
// the shop offers a variant upgrade for every base colour you hold
M.startCircuit(); g = M._gauntlet();
g.pouch = { white: 1, blue: 1 }; g.coin = 40; g.shop = M.makeShop();
assert(g.shop.upgrades.some(u => u.variant === 'deadbolt') && g.shop.upgrades.some(u => u.variant === 'riptide'),
  'the shop offers Deadbolt/Riptide upgrades for held White/Blue');

// drive applyStone on a live board to exercise the resolution overrides
M.newGame({ mode: 'duel', humans: [], companyNames: ['You', 'The Stranger'], deal: 'small', target: 999, gauntlet: true });
const Gv = M._state();
const mk = (owner, type) => { const c = { id: 9000 + Gv.cards.length, type, fx: null, owner, origOwner: owner, zone: 'board', faceUp: true, stones: [], prov: null, known: [true, true] }; Gv.cards.push(c); return c; };

// Deadbolt locks the target AND one adjacent card with a single stone
Gv.events = [];
Gv.players[0].board = [mk(0, 'Coin'), mk(0, 'Ferry'), mk(0, 'Knife')];
const dbTarget = Gv.players[0].board[1];
M.applyStone(0, 'deadbolt', { card: dbTarget });
assert(M.isLocked(dbTarget) && Gv.players[0].board.filter(c => M.isLocked(c)).length === 2,
  'a Deadbolt locks the target and one adjacent card');

// Riptide: a swap whose first Black only downgrades it, second Black unwinds it
Gv.events = [];
const give = mk(0, 'Coin'), take = mk(1, 'Knife');
Gv.players[0].board = [give]; Gv.players[1].board = [take];
M.applyStone(0, 'riptide', { give, take });
const rEv = Gv.events[Gv.events.length - 1];
assert(rEv.riptide === true, 'a Riptide swap is marked sticky');
assert(Gv.players[0].board[0] === take && Gv.players[1].board[0] === give, 'a Riptide performs the swap like Blue');
const blk1 = M.undoableEventFor(take);
assert(blk1 === rEv, 'the Riptide swap is a valid Black target');
M.applyStone(0, 'black', { event: blk1, card: take });
assert(Gv.players[0].board[0] === take && rEv.riptide === false && rEv.undone === false,
  'the first Black only downgrades the Riptide — the trade still stands');
const blk2 = M.undoableEventFor(take);
assert(blk2 === rEv, 'after downgrade the swap is an ordinary Blue, undoable again');
M.applyStone(0, 'black', { event: blk2, card: take });
assert(Gv.players[0].board[0] === give && rEv.undone === true, 'a second Black unwinds the downgraded swap');

// Onyx Black (black variant): one stone undoes the last TWO effects
assert(M.stoneBase('onyx') === 'black' && M.isVariant('onyx'), 'onyx is a black variant');
Gv.events = [];
const oc1 = mk(0, 'Coin'), oc2 = mk(0, 'Ferry'), oe1 = mk(1, 'Knife');
Gv.players[0].board = [oc1, oc2]; Gv.players[1].board = [oe1];
M.applyStone(0, 'red', { card: oc1 });             // event: a phantom on oc1
M.applyStone(0, 'blue', { give: oc2, take: oe1 }); // event: a swap oc2 <-> oe1
const hasRedStone = c => c.stones.some(s => s.color === 'red');
assert(Gv.players[0].board.includes(oe1) && hasRedStone(oc1), 'setup: a phantom and a swap are both live');
const onyxTarget = Gv.events[Gv.events.length - 1]; // the swap
M.applyStone(0, 'onyx', { event: onyxTarget, card: oe1 });
assert(!hasRedStone(oc1) && Gv.players[0].board.includes(oc2) && Gv.players[1].board.includes(oe1),
  'an Onyx undoes BOTH the swap and the phantom in one stone');

// --- records: seen flag + run banking ---
M.markCharmSeen('whetstone');
assert(M.charmSeen('whetstone') === true, 'an offered charm is recorded as seen');
M.recordCircuitRun({ cleared: 9, score: 200, opp: 'The Lady', venue: 'docks', won: true, act: 3 });
const rec = M.circuitRecords();
assert(rec.runs[0].tables === 9 && rec.runs[0].won === true, 'a finished run banks into history');
assert(rec.best.tables >= 9 && rec.best.score >= 200, 'best results update');

console.log('OK circuit: act map, node fights, Standing/clear/ground-out, acts→victory, foe charms, effect/charm scoring, depleting decks, spoils, events, records.');
