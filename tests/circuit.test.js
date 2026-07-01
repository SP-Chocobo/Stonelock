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
assert(M.CHARMS.foulplay && M.CHARMS.foulplay.disruptEach === 1, 'Foul Play is registered as a per-hand disrupt charm');
const rg = { standing: 5, maxStanding: 20, resoCount: 0 };
M.CHARMS.resonance.on.stonePlaced(rg); M.CHARMS.resonance.on.stonePlaced(rg);
assert(rg.standing === 5, 'Resonance does not heal before the third stone');
M.CHARMS.resonance.on.stonePlaced(rg);
assert(rg.standing === 6, 'Resonance heals 1 Standing on the third stone');

// --- Wildcard: a hard-to-get relic that makes one card count as any type ---
const wv = { Coin: 3, Sword: 2, Ferry: 1 };
assert(M.bestSelection([{ type: 'Coin' }, { type: 'Sword' }, { type: 'Ferry', wild: true }], wv, {}).structure === 'pair',
  'a Wildcard turns three singles into a Pair');
const wtri = M.bestSelection([{ type: 'Coin' }, { type: 'Coin' }, { type: 'Sword', wild: true }], wv, {});
assert(wtri.structure === 'triad' && wtri.raw === 3 + 3 + 2, 'a Wildcard completes a Triad and still scores its own face value');
assert(M._ai.EFFECTS.wild && M._ai.EFFECTS.wild.viaCharm && M.CHARMS.wildcard && M.CHARMS.wildcard.bossOnly,
  'wild is a charm-only effect and the Wildcard charm is boss-only');
M.startCircuit(); g = M._gauntlet(); g.charms = [];
assert(M.makeReward({ charm: true, charmCount: 3, boss: true }).charms.includes('wildcard'), 'a boss spoil offers the Wildcard');
assert(!M.makeReward({ charm: true, charmCount: 3, boss: false }).charms.includes('wildcard'), 'non-boss spoils never offer the Wildcard');
// a Wildcard falls inert when stolen (active only on its original owner's board)
const wildOnOwn = M.bestSelection([{ type: 'Coin' }, { type: 'Sword' }, { type: 'Ferry', wild: true }], wv, {});
const wildStolen = M.bestSelection([{ type: 'Coin' }, { type: 'Sword' }, { type: 'Ferry' }], wv, {}); // same board, wild inert
assert(wildOnOwn.structure === 'pair' && wildStolen.structure === 'singles',
  'a Wildcard makes a Pair on its owner board but is just a single when its wild is stripped (stolen)');

// --- depleting decks conserve across reshuffles ---
[g, G] = enterFirstFight();
M.circuitResetPiles();
const you = g.piles[0], deckN = g.deck.length;
M.circuitDrawCards(4);
for (let i = 0; i < 12; i++) M.circuitDrawCards(4);
assert(you.cardDraw.length + you.cardDiscard.length + (you.cardHand ? you.cardHand.length : 0) === deckN, 'cards are conserved across reshuffles');
assert(g.piles[1], 'the foe also has a depleting pile set');

// --- the shop: spend coin on cards / stones / charms / thin ---
M.startCircuit(424242); g = M._gauntlet(); // fixed seed for a deterministic map
assert(g.map.cols[M.CIRCUIT.actRows - 2][0].type === 'repose', 'a Repose breather sits before each act boss');
assert(g.map.cols.flat().filter(n => n.type === 'shop').length >= 2, 'each act scatters at least two shops through the branches');
assert(g.map.cols.slice(0, 2).flat().every(n => n.type !== 'shop' && n.type !== 'elite'), 'no shop or elite in the first two columns');
assert(g.map.cols.flat().filter(n => n.type === 'repose').length >= 1, 'at least the pre-boss Repose breather is present (more scatter in, structure rules permitting)');
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
for (const col of mapA.cols) for (const n of col) assert(n.lane >= 0 && n.lane < 5, 'every node has a lane for the tree layout');

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

// --- the Dark Pact's Green Stone: a placeable player poison ---
Gv.events = [];
const myCoin = mk(0, 'Coin'), foeBread = mk(1, 'Bread');
Gv.players[0].board = [myCoin]; Gv.players[1].board = [foeBread];
M.applyStone(0, 'green', { card: foeBread });
assert(foeBread.stones.some(s => s.color === 'green'), 'a player Green Stone poisons the targeted foe card');
// a poisoned card scores nothing in the selection
const poisonScore = M.bestSelection([{ type: 'Bread', poisoned: true }, { type: 'Coin' }, { type: 'Sword' }], { Bread: 3, Coin: 3, Sword: 2 }, {});
assert(!poisonScore.picks.some(p => p.type === 'Bread' && p.value > 0), 'a poisoned card contributes no value');
// a Green Stone in the pouch draws like any other (the Pact's reward is usable)
M.startCircuit(); g = M._gauntlet();
g.pouch = { green: 1, red: 1, white: 1, blue: 1 }; M.circuitResetPiles();
const gdraw = []; const gps = g.piles[0];
for (let i = 0; i < 30 && gps.stoneDraw.length; i++) gdraw.push(gps.stoneDraw.pop());
assert(gdraw.includes('green'), 'a Green Stone in the pouch draws like any stone');

// --- build-around modifier Runesmith + transformational charms ---
[g, G] = enterFirstFight(); // a live gauntlet match (G.gauntlet) so Runesmith can read the pouch
g.pouch = { twinred: 2, deadbolt: 1, red: 1 };
assert(M._ai.EFFECTS.runesmith.self() === 3, 'Runesmith reads +1 per upgraded stone in the pouch (capped 3)');
g.pouch = { red: 1, white: 1, blue: 1 };
assert(M._ai.EFFECTS.runesmith.self() === 0, 'Runesmith reads nothing with no upgraded stones');
assert(M.CHARMS.laststand && M.CHARMS.laststand.on.handStart, 'Last Stand is registered (a comeback charm)');
assert(M.CHARMS.reckless && M.CHARMS.reckless.dmgReduce === -1 && M.CHARMS.reckless.on.handStart, 'Reckless Wager is registered (board +1, more damage taken)');

// --- signature boss relics ---
// the four are boss-only and persona-tagged
const sigs = { riverking: 'The Ferryman', motherlode: 'The Miner', ironverdict: 'The Clerk', sovereign: 'The Lady' };
for (const k in sigs) assert(M.CHARMS[k] && M.CHARMS[k].bossOnly && M.CHARMS[k].persona === sigs[k], `${k} is a boss-only relic for ${sigs[k]}`);
// River King's Toll folds Road/Ferry into one structural type
const rkv = { Road: 2, Ferry: 2, Coin: 3 };
assert(M.bestSelection([{ type: 'Road' }, { type: 'Ferry' }, { type: 'Coin' }], rkv, { foldTypes: { Road: 'RF', Ferry: 'RF' } }).structure === 'pair'
  && M.bestSelection([{ type: 'Road' }, { type: 'Ferry' }, { type: 'Coin' }], rkv, {}).structure === 'singles',
  "River King's Toll makes Road+Ferry a Pair");
// Motherlode gives each Red phantom +1
const mlb = [{ type: 'Coin', phantoms: 1 }, { type: 'Sword' }, { type: 'Quill' }], mlv = { Coin: 3, Sword: 2, Quill: 1 };
assert(M.bestSelection(mlb, mlv, { phantomValue: 1 }).score === M.bestSelection(mlb, mlv, {}).score + 1, 'Motherlode scores +1 per Red phantom');
// a boss offers exactly its signature + a random + Wildcard (pick one)
M.startCircuit(); g = M._gauntlet(); g.charms = [];
const bossR = M.makeReward({ charm: true, boss: true, foe: 'The Ferryman' });
assert(bossR.charms.length === 3 && bossR.charms.includes('riverking') && bossR.charms.includes('wildcard'),
  'a Ferryman boss offers its signature relic, a random charm, and a Wildcard');
const bossR2 = M.makeReward({ charm: true, boss: true, foe: null }); // a foe with no signature persona
assert(bossR2.charms.includes('wildcard') && !bossR2.charms.some(k => M.CHARMS[k].persona),
  'a boss with no signature still offers Wildcard plus randoms');
// Sovereign's Favor reads +2 on a locked card
[g, G] = enterFirstFight(); g.charms = ['sovereign'];
const sfCard = (type, locked) => ({ type, fx: null, owner: 0, origOwner: 0, faceUp: true, known: [true, true], zone: 'board', poisoned: false, stones: locked ? [{ color: 'white', by: 0 }] : [] });
G.players[0].board = [sfCard('Coin', true), sfCard('Sword', false), sfCard('Quill', false)];
M.applyCardEffects();
assert(G.players[0].board[0].evalue === M.REGIONS.bar.values.Coin + 2 && G.players[0].board[1].evalue === M.REGIONS.bar.values.Sword,
  "Sovereign's Favor reads +2 on a locked card only");

// --- the rest of the cast's signature relics ---
const allSigs = { riverking: 'The Ferryman', motherlode: 'The Miner', ironverdict: 'The Clerk', sovereign: 'The Lady', matchedset: 'The Tinker', highwayman: 'The Wagoner', followingsea: 'The Deckhand', secondwind: 'The Old Hand', veilwalker: 'The Stranger' };
for (const k in allSigs) assert(M.CHARMS[k] && M.CHARMS[k].bossOnly && M.CHARMS[k].persona === allSigs[k], `${k} is the boss relic for ${allSigs[k]}`);
// every regular has a signature, offered only by their own boss
for (const persona of new Set(Object.values(allSigs))) {
  M.startCircuit(); const gg = M._gauntlet(); gg.charms = [];
  const sig = Object.keys(allSigs).find(k => allSigs[k] === persona);
  assert(M.makeReward({ charm: true, boss: true, foe: persona }).charms.includes(sig), `${persona}'s boss offers ${sig}`);
}
// Matched Set — Pairs pay +3
const msv = { Coin: 3, Quill: 1 }, msHand = [{ type: 'Coin' }, { type: 'Coin' }, { type: 'Quill' }];
assert(M.bestSelection(msHand, msv, { pairAdd: 3 }).score === M.bestSelection(msHand, msv, {}).score + 3, 'Matched Set adds +3 to a Pair');
// Following Sea — +2 board the hand after a win
assert(M.CHARMS.followingsea.on.handWon && M.CHARMS.followingsea.on.handStart, 'Following Sea has win/start hooks');
const fsG = { handBuff: 0 }; M.CHARMS.followingsea.on.handWon(fsG); M.CHARMS.followingsea.on.handStart(fsG);
assert(fsG.handBuff === 2, 'Following Sea grants +2 board the hand after a win');
// Highwayman's Cut — a stolen card (owner ≠ origOwner) reads +2
[g, G] = enterFirstFight(); g.charms = ['highwayman'];
const bc = (type, orig) => ({ type, fx: null, owner: 0, origOwner: orig, faceUp: true, known: [true, true], zone: 'board', poisoned: false, stones: [] });
G.players[0].board = [bc('Coin', 1), bc('Sword', 0), bc('Quill', 0)]; // first card was stolen from seat 1
M.applyCardEffects();
assert(G.players[0].board[0].evalue === M.REGIONS.bar.values.Coin + 2 && G.players[0].board[1].evalue === M.REGIONS.bar.values.Sword,
  "Highwayman's Cut reads +2 on a stolen card only");

// --- puzzles: authored response table, node placement, Academy-safety ---
assert(M.solvePuzzle('wayfarer', 'twinred@you0').solve === true, 'the authored solving line is marked solve');
assert(!M.solvePuzzle('wayfarer', 'twinred@you1').solve, 'a non-solving authored line is a miss');
assert(M.solvePuzzle('wayfarer', 'blue@you2>foe0').text && !M.solvePuzzle('wayfarer', 'blue@you2>foe0').solve, 'an unlisted placement falls to the miss response');
assert(M.solvePuzzle('nope', 'x') === null, 'an unknown puzzle resolves to null');
// Every puzzle is honestly solvable: the marked-solve line is the strict best
// outcome (you − foe margin) over all legal placements, and the best line(s) are
// marked solve. This guards against authoring a riddle with a wrong/no answer.
function pzScore(boardCards, values) {
  return M.bestSelection(boardCards.map(c => ({ type: c.type, phantoms: c.phantoms || 0, poisoned: !!c.poisoned, evalue: c.evalue })), values, {}).score;
}
function pzPlacements(p) {
  const out = [];
  for (const stone of p.stones) {
    const b = M.stoneBase(stone);
    if (b === 'blue') { for (let i = 0; i < p.you.length; i++) for (let j = 0; j < p.foe.length; j++) out.push({ stone, side: 'you', idx: i, swap: j }); }
    else if (b === 'green') { for (let j = 0; j < p.foe.length; j++) out.push({ stone, side: 'foe', idx: j }); }
    else { for (let i = 0; i < p.you.length; i++) out.push({ stone, side: 'you', idx: i }); for (let j = 0; j < p.foe.length; j++) out.push({ stone, side: 'foe', idx: j }); }
  }
  return out;
}
for (const key of M.PUZZLE_KEYS) {
  const p = M.PUZZLES[key], values = M.puzzleValues(p);
  const rows = pzPlacements(p).map(pl => {
    const st = M.puzzlePreview(p, pl.stone, pl.side, pl.idx, pl.swap);
    const resp = (p.responses && p.responses[M.puzzleKey(pl.stone, pl.side, pl.idx, pl.swap)]) || p.miss;
    return { margin: pzScore(st.you, values) - pzScore(st.foe, values), solve: !!(resp && resp.solve) };
  });
  const max = Math.max(...rows.map(r => r.margin));
  assert(rows.some(r => r.solve), `puzzle ${key} has a marked solve`);
  assert(max > 0, `puzzle ${key} is winnable (best margin > 0)`);
  assert(rows.filter(r => r.solve).every(r => r.margin >= max - 1e-9), `puzzle ${key}: every marked solve is the best line`);
  assert(rows.filter(r => r.margin >= max - 1e-9).every(r => r.solve), `puzzle ${key}: the best line is marked solve`);
}
// each act seeds exactly one puzzle node (in the branching columns, never the first two)
for (const act of [1, 2, 3]) {
  M.seedRng(700 + act);
  const flat = M.buildAct(act).cols.flat();
  const pz = flat.filter(n => n.type === 'puzzle');
  assert(pz.length === 1 && pz[0].puzzle && M.PUZZLES[pz[0].puzzle], `act ${act} seeds one puzzle node with a valid key`);
  assert(M.buildAct(act).cols.slice(0, 2).flat().every(n => n.type !== 'puzzle'), `no puzzle in act ${act}'s first two columns`);
}
M.clearRng();
// structure rules: no two rest stops back to back, no 4 non-fight nodes in a
// row on any path, shops kept apart, pre-boss breather intact.
const isFightT = t => t === 'duel' || t === 'elite' || t === 'boss';
const isRestT = t => t === 'repose' || t === 'shop';
for (let act = 1; act <= 3; act++) {
  for (let s = 0; s < 30; s++) {
    M.seedRng(s * 13 + act);
    const cols = M.buildAct(act).cols;
    assert(cols[cols.length - 2][0].type === 'repose', `act ${act}: the pre-boss Repose breather survives the rules`);
    for (let c = 1; c < cols.length; c++) cols[c].forEach((node, k) => {
      if (isRestT(node.type)) assert(!cols[c - 1].some(p => isRestT(p.type) && (p.edges || []).includes(k)),
        `act ${act}: no two rest stops back to back`);
    });
    // longest run of non-fight nodes on any path must be <= 3
    const run = cols.map(col => col.map(() => 0));
    for (let c = 0; c < cols.length; c++) cols[c].forEach((node, k) => {
      if (isFightT(node.type)) { run[c][k] = 0; return; }
      const preds = c === 0 ? [] : cols[c - 1].map((p, pi) => ({ p, pi })).filter(o => (o.p.edges || []).includes(k));
      run[c][k] = (preds.length ? Math.max(...preds.map(o => run[c - 1][o.pi])) : 0) + 1;
      assert(run[c][k] <= 3, `act ${act}: no path chains 4 non-fight nodes`);
    });
    const shopCols = []; cols.forEach((col, ci) => col.forEach(n => { if (n.type === 'shop') shopCols.push(ci); }));
    for (let i = 0; i < shopCols.length; i++) for (let j = i + 1; j < shopCols.length; j++)
      assert(Math.abs(shopCols[i] - shopCols[j]) >= 2, `act ${act}: shops kept >=2 columns apart`);
  }
}
M.clearRng();
// Academy-safety: a base-stones puzzle is re-usable; a variant-stone one is Circuit-only
assert(!M.puzzleAcademySafe(M.PUZZLES.wayfarer), 'a Twin Red puzzle is Circuit-only (not Academy-safe)');
assert(M.puzzleAcademySafe({ stones: ['red', 'blue', 'white'] }), 'a base-stones puzzle is Academy-safe');

// --- per-act venues + tuning (the act themes) ---
assert(M.actVenues(1).every(v => ['tavern', 'docks'].includes(v)) && M.actVenues(2).every(v => ['slums', 'hall'].includes(v)) && M.actVenues(3).join(',') === 'court',
  'venues are act-scoped: roads (tavern/docks) → underbelly (slums/hall) → court');
let rA1 = 0, rA2 = 0, eA1 = 0, eA2 = 0;
for (let s = 0; s < 40; s++) {
  M.seedRng(s); const a1 = M.buildAct(1).cols.flat();
  M.seedRng(s); const a2 = M.buildAct(2).cols.flat();
  rA1 += a1.filter(n => n.type === 'repose').length; rA2 += a2.filter(n => n.type === 'repose').length;
  eA1 += a1.filter(n => n.type === 'elite').length; eA2 += a2.filter(n => n.type === 'elite').length;
}
assert(rA1 > rA2, 'Act I scatters more Reposes than Act II (gentler)');
assert(eA2 > eA1, 'Act II fields more Elites than Act I (the squeeze)');
M.clearRng();

// --- act-scoped foe pools: neutral toughs fill duels, named regulars headline ---
for (const act of [1, 2, 3]) {
  M.seedRng(900 + act);
  const flat = M.buildAct(act).cols.flat();
  for (const n of flat) {
    if (n.type === 'duel') assert(/^A /.test(n.foe), `act ${act} duel uses a neutral foe (got ${n.foe})`);
    if (n.type === 'elite' || n.type === 'boss') assert(/^The /.test(n.foe), `act ${act} elite/boss uses a named regular (got ${n.foe})`);
    if (n.foe) assert(M.circuitBuildFor(n.foe).pouch && M.circuitBuildFor(n.foe).deck.length, `${n.foe} resolves a build`);
  }
}
M.clearRng();

// --- records: seen flag + run banking ---
M.markCharmSeen('whetstone');
assert(M.charmSeen('whetstone') === true, 'an offered charm is recorded as seen');
M.recordCircuitRun({ cleared: 9, score: 200, opp: 'The Lady', venue: 'docks', won: true, act: 3 });
const rec = M.circuitRecords();
assert(rec.runs[0].tables === 9 && rec.runs[0].won === true, 'a finished run banks into history');
assert(rec.best.tables >= 9 && rec.best.score >= 200, 'best results update');

// --- 2v1 co-op (An Old Rival): recruit, draft, three-seat table, sides, clear ---
M.seedRng(73);
M.startCircuit();
let cg = M._gauntlet();
// A bested act boss joins the bench.
cg.act = 1; cg.curNode = { type: 'boss', col: 8, idx: 0, foe: 'The Ferryman' };
M.circuitAfterNode();
assert((cg.allies || []).includes('The Ferryman'), 'a cleared boss is recorded as a recruitable ally');
assert(cg.act === 2, 'clearing the act boss advances the act');
// The next Encounter in a later act becomes the rival reunion.
cg.allyOffered = false;
const ev = M.makeCircuitEvent();
assert(ev.kind === 'rival' && ev.ally === 'The Ferryman' && /^The /.test(ev.foe) && ev.foe !== ev.ally, 'the rival event offers the ally vs a distinct named foe');
// Draft pool is 20 cards.
const pool = M.circuitAllyDraftPool();
assert(pool.length === 20, 'the ally draft pool is 20 cards');
// Build the ally loadout the way the screen would, then sit the table.
cg.deck = M.TYPES.slice(); cg.pouch = { red: 1, white: 1, blue: 1, black: 1 };
cg.standing = cg.maxStanding;
const allyDeck = []; for (const t of M.TYPES) { allyDeck.push(t); allyDeck.push(t); } for (let i = 0; i < 8; i++) allyDeck.push(pool[i]);
cg.allyDeck = allyDeck; cg.allyPouch = { red: 3, white: 3, blue: 2, black: 2 };
const node = { type: 'event', col: 3, idx: 0, coop: true, foe: ev.foe };
cg.curNode = node;
M.circuitSetupCoopFight(node, ev.ally, ev.foe);
let cG = M._state();
assert(cG.mode === 'coop' && cG.coop === true && cG.nPlayers === 3, 'the co-op table is a three-seat coop match');
assert(cG.humans.length === 1 && cG.humans[0] === 0, 'only you are human; the ally and foe are AI');
assert(cg.piles[0] && cg.piles[1] && cg.piles[2], 'all three seats draw from their own depleting piles');
assert(allyDeck.length === 24, 'the ally deck is 2-of-each (16) + 8 drafted = 24');
assert((cg.allyPouch.red + cg.allyPouch.white + cg.allyPouch.blue + cg.allyPouch.black) === 10, 'the ally pouch is 2-of-each (8) + 2 drafted = 10');
// Sides: you (0) and the ally (2) stand together against the lone foe (1).
assert(M.isOpponent(0, 1) && M.isOpponent(2, 1) && !M.isOpponent(0, 2), 'sides group you + ally vs the foe');
assert(node.ally === ev.ally, 'the node remembers its ally (for the victory line on the spoils screen)');
assert(cg.foeMax === Math.round((M.CIRCUIT.foeBase + ((2 - 1) * M.CIRCUIT.actRows + 3) * M.CIRCUIT.foeStep) * M.CIRCUIT.coopFoeMult), 'the lone foe carries the co-op Standing multiplier');
// The foe is boss-tier: a developed (modded) deck and scoring foe-charms, so it
// can field two real hands — and it scores its TWO best hands, not one.
assert(cg.foeCharms.length >= 2 && cg.foeCharms.includes('matchedset'), 'the 2v1 foe carries scoring foe-charms');
assert(cg.oppDeck.length > M.TYPES.length && cg.oppDeck.some(c => c && typeof c === 'object' && c.fx), 'the 2v1 foe fields a developed (modded) deck');
// Run an all-AI co-op table (seat 0 piloted too) and confirm the side-aware
// Standing result fires — the foe's two hands vs your side's combined.
M.seedRng(74);
cg.foeHp = cg.foeMax = 40; cg.standing = cg.maxStanding;
M.circuitResetPiles();
M.newGame({ mode: 'coop', humans: [], companyNames: [ev.foe, ev.ally], venue: 'slums', deal: 'small', target: 999, gauntlet: true });
const cG2 = M._state();
let cguard = 0; const startFoe = cg.foeHp, startStand = cg.standing;
while (!cG2.over && cguard++ < 8000) { if (!cG2.queue.length) M.nextHand(); else M._run(); }
assert(cg.foeHp < startFoe || cg.standing < startStand, 'a 2v1 showdown presses Standing on one side (side-aware result fires)');
assert(cg.tableCleared || cg.groundOut, 'the all-AI 2v1 table resolves to a clear or a ground-out');

// The Double-Cross relic: each hand, the foe's first Lock/Steal is shuffled away.
M.seedRng(75);
const dc = M.CHARMS.doublecross;
assert(dc && dc.bossOnly && dc.coopRelic && dc.on && dc.on.handStart, 'The Double-Cross is a co-op-only relic with a hand-start hook');

// Dialogue: every persona has a recruit line, a foe taunt, and a victory line.
const ROSTER9 = ['The Ferryman','The Wagoner','The Deckhand','The Old Hand','The Miner','The Stranger','The Lady','The Tinker','The Clerk'];
for (const p of ROSTER9) {
  assert(M.CIRCUIT_ALLY_LINES[p] && M.CIRCUIT_ALLY_LINES[p].length > 10, `${p} has a recruit line`);
  assert(M.CIRCUIT_FOE_TAUNTS[p] && M.CIRCUIT_FOE_TAUNTS[p].length > 10, `${p} has a foe taunt`);
  assert(M.CIRCUIT_ALLY_WINLINES[p] && M.CIRCUIT_ALLY_WINLINES[p].length > 10, `${p} has a victory line`);
  assert(M.FOE_SOLO_TAUNTS[p] && M.FOE_SOLO_TAUNTS[p].length > 10, `${p} has a 1v1 pre-fight taunt`);
}
// Every campaign boss has an intro AND a defeat line, and both fall back safely.
const BOSSES6 = ['The Magistrate','The Warden','The Apothecary','The Quartermaster','The Archivist','The Crucible'];
for (const b of BOSSES6) {
  assert(M.BOSS_INTRO[b] && M.BOSS_INTRO[b].length > 10, `${b} has an intro line`);
  assert(M.BOSS_DEFEAT[b] && M.BOSS_DEFEAT[b].length > 10, `${b} has a defeat line`);
}
assert(M.foeSoloTaunt('A Nobody').length > 10 && M.bossIntroLine('A Nobody').length > 10 && M.bossDefeatLine('A Nobody').length > 10, 'dialogue lookups fall back for unknown names');
// Structural guard: every spoken line carries enough words that the wrap has
// something to balance — no one- or two-word fragments that render as a lonely
// widow line. (The visual fix is CSS text-wrap; this keeps the writing honest.)
const words = s => s.trim().split(/\s+/).length;
const MIN_WORDS = 8;
for (const [tbl, dict] of [['ALLY', M.CIRCUIT_ALLY_LINES], ['TAUNT', M.CIRCUIT_FOE_TAUNTS], ['WIN', M.CIRCUIT_ALLY_WINLINES], ['SOLO', M.FOE_SOLO_TAUNTS], ['INTRO', M.BOSS_INTRO], ['DEFEAT', M.BOSS_DEFEAT]]) {
  for (const [who, line] of Object.entries(dict)) {
    assert(words(line) >= MIN_WORDS, `${tbl} line for ${who} has ${words(line)} words (min ${MIN_WORDS}) — too short, would widow`);
  }
}
// The plate renders a face + name + line; .right/.foe are reflected in the markup.
const plate = M.dialoguePlate('The Ferryman', 'Pay the toll.', { side: 'right', foe: true });
assert(/dplate/.test(plate) && /dplate-face/.test(plate) && /The Ferryman/.test(plate) && /Pay the toll\./.test(plate), 'plate carries face, name, and line');
assert(/\bright\b/.test(plate) && /\bfoe\b/.test(plate), 'plate reflects side + foe classes');
assert(/assets\/portraits\/ferryman\.jpg/.test(plate), 'plate uses the persona portrait when one exists');
const noface = M.dialoguePlate('A Drifter', 'No face here.', {});
assert(/dplate-face--none/.test(noface), 'plate falls back to an initial tile with no portrait');

// ---- Dialogue preferences: the four scene gates honour the settings ----
{
  const P = M.dialoguePrefs();
  assert(P.campaign === 'always' && P.elites && P.cbosses && P.events, 'defaults: all dialogue on');
  M.setDialoguePref('elites', false);
  assert(!M.showCircuitScene('elite') && M.showCircuitScene('boss'), 'elites off, floor bosses still speak');
  M.setDialoguePref('cbosses', false);
  assert(!M.showCircuitScene('boss'), 'floor bosses off');
  assert(!M.showCircuitScene('duel'), 'plain duels never speak, regardless of settings');
  M.setDialoguePref('events', false);
  assert(!M.showEventScene(), 'event scenes off');
  M.setDialoguePref('events', true);
  assert(M.showEventScene(), 'event scenes back on');
  // Campaign 3-way: off / always / first-clear-only
  M.setDialoguePref('campaign', 'off');
  assert(!M.showCampaignIntro('warden') && !M.showCampaignDefeat(), 'campaign off: no intro, no defeat');
  M.setDialoguePref('campaign', 'always');
  assert(M.showCampaignIntro('warden'), 'campaign always: intro shows even once beaten');
  M.setDialoguePref('campaign', 'firstclear');
  assert(M.showCampaignIntro('crucible'), 'firstclear: an unbeaten boss shows its intro');
  M.markCampaignWin('crucible', 'hard');
  assert(!M.showCampaignIntro('crucible'), 'firstclear: a beaten boss no longer shows its intro');
  const st = M._state();
  st.firstClearThisBoss = true;
  assert(M.showCampaignDefeat(), 'firstclear: the defeat line shows on the first-clear run');
  st.firstClearThisBoss = false;
  assert(!M.showCampaignDefeat(), 'firstclear: the defeat line is hidden on later clears');
  // restore defaults so nothing downstream inherits a muted state
  M.setDialoguePref('campaign', 'always'); M.setDialoguePref('elites', true); M.setDialoguePref('cbosses', true);
}

// A clean plain duel afterwards drops the ally pile (no stale third seat).
M.seedRng(76);
M.circuitSetupFight({ type: 'duel', col: 0, idx: 0, foe: 'A Drifter' });
assert(!cg.allyDeck && !cg.allyPouch && !cg.piles[2], 'a following plain duel clears the ally pile');
assert(!M._state().coop, 'a plain duel is not a co-op match');
M.clearRng();

console.log('OK circuit: act map, node fights, Standing/clear/ground-out, acts→victory, foe charms, effect/charm scoring, depleting decks, spoils, events, 2v1 co-op, records.');
