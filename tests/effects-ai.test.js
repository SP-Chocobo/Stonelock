'use strict';
/* Effect-AI competence: proves the bots ASSESS the four current effects
   correctly (through their own eyes) and make effect-correct DECISIONS, with
   per-bot persona priorities layered on top. This is the gate the design asks
   for before adding new effects — if a bot misreads an effect, neither its play
   nor any later effect's testing can be trusted. Run: node tests/effects-ai.test.js
   (Boards are 3+ cards: bestSelection always scores a best-3.) */
const M = require('../game.js');
M.setAlphaUnlock(true);
const ai = M._ai;
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

function setup(venue, names) {
  M.newGame({ mode: 'duel', humans: [], companyNames: names || ['The Deckhand', 'The Deckhand'], venue, deal: 'small', target: 10 });
  return M._state();
}
// A face-up, fully-known board card (so every viewer assesses it).
function card(type, fx, owner) {
  return { type, fx: fx || null, owner: owner || 0, origOwner: owner || 0, faceUp: true, known: [true, true], stones: [], zone: 'board', poisoned: false };
}
// tavern values: Bread/Coin/Road=3, Sword/Ferry=2, Quill/Crest/Chain=1.

/* ---------- ASSESSMENT: estimate() reflects each effect ---------- */

// Keen — a card with a twin reads +1 through the AI's eyes.
let G = setup('tavern');
G.players[1].board = [card('Chain', null, 1), card('Crest', null, 1), card('Quill', null, 1)];
G.players[0].board = [card('Coin', null, 0), card('Coin', null, 0), card('Quill', null, 0)];
M.applyCardEffects();
const plainPair = ai.estimate(0, 0);
G.players[0].board = [card('Coin', null, 0), card('Coin', 'keen', 0), card('Quill', null, 0)];
M.applyCardEffects();
const keenPair = ai.estimate(0, 0);
assert(keenPair === plainPair + 1, `AI assesses Keen-with-twin as +1 (${plainPair} → ${keenPair})`);

// Anchor — pinned to 2 in the assessment, regardless of venue value.
const anchorVal = ai.EFFECTS.anchor.base();
G.players[0].board = [card('Quill', null, 0), card('Sword', null, 0), card('Bread', null, 0)]; // 1,2,3 distinct
M.applyCardEffects();
const noAnchor = ai.estimate(0, 0);
G.players[0].board = [card('Quill', 'anchor', 0), card('Sword', null, 0), card('Bread', null, 0)];
M.applyCardEffects();
const withAnchor = ai.estimate(0, 0);
assert(withAnchor - noAnchor === anchorVal - 1, `AI assesses Anchor as pinned to ${anchorVal} (Quill 1 → ${anchorVal})`);

// Lodestone — lifts both neighbours in the assessed best-3.
G.players[0].board = [card('Coin', null, 0), card('Bread', null, 0), card('Sword', null, 0)]; // 3,3,2 distinct types
M.applyCardEffects();
const noLode = ai.estimate(0, 0);
G.players[0].board = [card('Coin', null, 0), card('Bread', 'lodestone', 0), card('Sword', null, 0)];
M.applyCardEffects();
const withLode = ai.estimate(0, 0);
assert(withLode === noLode + 2, `AI assesses Lodestone as +1 to each neighbour (+2) (${noLode} → ${withLode})`);

// Drain — the AI sees its own facing card lose 1, and the foe sees the same.
G.players[0].board = [card('Coin', null, 0), card('Sword', null, 0), card('Quill', null, 0)];
G.players[1].board = [card('Crest', null, 1), card('Chain', null, 1), card('Quill', null, 1)];
M.applyCardEffects();
const noDrain = ai.estimate(0, 0);
G.players[1].board = [card('Crest', 'drain', 1), card('Chain', null, 1), card('Quill', null, 1)]; // faces seat0 slot0 (Coin)
M.applyCardEffects();
const withDrain = ai.estimate(0, 0);
assert(withDrain === noDrain - 1, `AI assesses its own card as -1 under an opposing Drain (${noDrain} → ${withDrain})`);
assert(ai.estimate(0, 1) === withDrain, 'the Drain-owner assesses the same reduction on the visible card');

// Fog of war — a veiled card is not assessed by the foe (the same gate that
// hides an opponent's effect value through a veil).
const veiled = card('Coin', null, 0); veiled.faceUp = false; veiled.known = [true, false]; // owner knows, foe doesn't
G.players[0].board = [veiled, card('Sword', null, 0), card('Quill', null, 0)];
G.players[1].board = [card('Crest', null, 1), card('Chain', null, 1), card('Quill', null, 1)];
M.applyCardEffects();
assert(ai.estimate(0, 0) === 6, 'the owner assesses its own veiled Coin at its true value (3+2+1)');
assert(ai.estimate(0, 1) === 5, 'the foe assesses the veiled card at the flat estimate (2+2+1), no leak');
// Balance: a hidden card is worth the AVERAGE (2) to the foe — a neutral gamble,
// neither its true 3 (bomb) nor an undervalued 1 (dud). Both read 2.
function foeFlat(type) { const h = card(type, null, 0); h.faceUp = false; h.known = [true, false]; G.players[0].board = [h, card('Sword', null, 0), card('Quill', null, 0)]; G.players[1].board = []; M.applyCardEffects(); return ai.estimate(0, 1); }
assert(foeFlat('Road') === 5 && foeFlat('Chain') === 5, 'a hidden card counts as the average 2 — a hidden 3 and a hidden 1 both read as 2 (2+2+1)');
// Allowed inference: a HIDDEN Lodestone's +1 to its VISIBLE neighbours reads in
// the foe estimate (you can see the higher values, even without the source).
G.players[1].board = [];
G.players[0].board = [card('Coin', null, 0), card('Sword', null, 0), card('Bread', null, 0)];
M.applyCardEffects(); const noLodeFoe = ai.estimate(0, 1);
const hidLode = card('Sword', 'lodestone', 0); hidLode.faceUp = false; hidLode.known = [true, false];
G.players[0].board = [card('Coin', null, 0), hidLode, card('Bread', null, 0)];
M.applyCardEffects(); const lodeFoe = ai.estimate(0, 1);
assert(lodeFoe === noLodeFoe + 2, `a hidden Lodestone's boost on visible neighbours bleeds into the foe estimate — allowed inference (${noLodeFoe} → ${lodeFoe})`);
// But a hidden card's OWN identity stays flat — the foe values it the same
// whether it's secretly a bomb or a dud, so it can't beeline a face-down card.
function foeViewHidden(type) {
  const h = card(type, null, 0); h.faceUp = false; h.known = [true, false];
  G.players[0].board = [h, card('Sword', null, 0), card('Bread', null, 0)]; G.players[1].board = [];
  M.applyCardEffects(); return ai.estimate(0, 1);
}
assert(foeViewHidden('Coin') === foeViewHidden('Quill'), 'the foe values a hidden card identically (bomb vs dud) — no see-through targeting');
// No-tell case: a hidden rider whose effect lands only on OTHER hidden cards
// gives the foe no visible cue, so its board reads the same as if those cards
// were plain — the AI can't "discover" and beeline it without a tell.
function allHiddenFoeView(slot0fx) {
  const mk = (t, fx) => { const c = card(t, fx, 0); c.faceUp = false; c.known = [true, false]; return c; };
  G.players[0].board = [mk('Sword', slot0fx), mk('Coin', null), mk('Bread', null)]; G.players[1].board = [];
  M.applyCardEffects(); return ai.estimate(0, 1);
}
assert(allHiddenFoeView('lodestone') === allHiddenFoeView(null), 'a hidden rider with no visible tell (boosting only hidden cards) does not leak into the foe estimate');

// Sentinel — +2 only on an end slot of the board.
G = setup('tavern');
G.players[1].board = [];
G.players[0].board = [card('Quill', 'sentinel', 0), card('Sword', null, 0), card('Bread', null, 0)]; // slot 0 = edge
M.applyCardEffects();
const sentEdge = ai.estimate(0, 0);
G.players[0].board = [card('Sword', null, 0), card('Quill', 'sentinel', 0), card('Bread', null, 0)]; // slot 1 = interior
M.applyCardEffects();
const sentMid = ai.estimate(0, 0);
assert(sentEdge === sentMid + 2, `AI assesses Sentinel as +2 on an end slot, +0 in the middle (${sentMid} → ${sentEdge})`);

// Harmony — +1 per other effect card you field. Anchor on a value-2 type reads 2
// (same as plain), so the only delta is Harmony counting it.
G.players[0].board = [card('Coin', 'harmony', 0), card('Sword', null, 0), card('Bread', null, 0)];
M.applyCardEffects();
const harmAlone = ai.estimate(0, 0);
G.players[0].board = [card('Coin', 'harmony', 0), card('Sword', 'anchor', 0), card('Bread', null, 0)];
M.applyCardEffects();
const harmPair = ai.estimate(0, 0);
assert(harmPair === harmAlone + 1, `AI assesses Harmony as +1 per other effect card (${harmAlone} → ${harmPair})`);

/* ---------- DECISIONS: stone targeting engages effect value ---------- */

// Blue — the AI steals the highest effective-value enemy card (here the Anchor).
G = setup('tavern', ['The Ferryman', 'The Ferryman']);
G.players[0].board = [card('Quill', 'anchor', 0), card('Crest', null, 0), card('Chain', null, 0)]; // evalues 2,1,1
G.players[0].hand = [];
G.players[1].board = [card('Quill', null, 1), card('Crest', null, 1), card('Chain', null, 1)];
G.players[1].hand = [];
M.applyCardEffects();
const blue = ai.aiBestBlueTarget(1);
assert(blue && blue.take.fx === 'anchor' && blue.take.evalue === 2, 'Blue targets the highest effective-value enemy card — the Anchor (2 over the 1s)');

/* ---------- DECISIONS: deploy keep-priority engages effects ---------- */

// The registry's per-effect keep weights (the layered priorities themselves).
const E = ai.EFFECTS;
assert(E.lodestone.aiKeep(null, { hasTwin: false }) > 0, 'Lodestone carries a positive keep-priority');
assert(E.drain.aiKeep(null, { hasTwin: false }) > 0, 'Drain carries a positive keep-priority');
assert(E.keen.aiKeep(null, { hasTwin: true }) > E.keen.aiKeep(null, { hasTwin: false }), 'Keen is worth more to keep when a twin is in hand');

// Integration: with a footprint cut, the AI keeps the effect card over plain peers.
G = setup('tavern', ['The Clerk', 'The Clerk']); // skill 1.0 → no fumble noise
const p = G.players[0];
p.aiPlan = null;
// Lodestone on a value-2 card scores 2 + 1.4 = 3.4, lifting it above even the
// plain value-3 cards — so the rider, not the printed value, earns the slot.
const lode = card('Sword', 'lodestone', 0);
p.hand = [lode, card('Coin', null, 0), card('Bread', null, 0), card('Road', null, 0), card('Quill', null, 0), card('Crest', null, 0)];
for (const c of p.hand) { c.faceUp = false; c.zone = 'hand'; }
ai.aiChooseDeploy(0, 2, true); // builds the plan; kept set = aiPlan.queue
assert(p.aiPlan.queue.includes(lode), 'the AI keeps the Lodestone through the footprint cut (its rider outranks plain higher-value cards)');

/* ---------- PER-BOT: persona priorities layer on top of the same read ---------- */

// Same board and identical effect-aware base assessment; persona then weights
// the colours. The Clerk (White-heavy) rates White-vs-Blue higher than the
// Ferryman (Blue-heavy) does — deterministically, since the telegraph order
// itself is a randomized weighted sample by design.
function whiteOverBlue(name) {
  G = setup('docks', [name, 'The Deckhand']);
  G.players[0].board = [card('Coin', null, 0), card('Coin', 'keen', 0), card('Quill', null, 0)];
  G.players[1].board = [card('Bread', null, 1), card('Bread', null, 1), card('Quill', null, 1)];
  // Clear any random telegraphs newGame's partial play left, so `threatened`
  // (which flips White's base value) is deterministic across runs.
  for (const pl of G.players) { pl.hand = []; pl.declared = []; pl.active = []; }
  M.applyCardEffects();
  return ai.aiStoneValue(0, 'white') / ai.aiStoneValue(0, 'blue');
}
const clerkR = whiteOverBlue('The Clerk');
const ferryR = whiteOverBlue('The Ferryman');
assert(clerkR > ferryR, `the Clerk weights White-over-Blue above the Ferryman, same board (Clerk ${clerkR.toFixed(2)} vs Ferryman ${ferryR.toFixed(2)})`);

/* ---------- POSITIONAL MASTERY: the AI places effects, not just values them ---------- */

// Lodestone seeks an interior slot (two neighbours), flanked by high cards.
G = setup('tavern', ['The Clerk', 'The Clerk']);
G.players[1].board = []; // no opposing board → positioning is purely about my own value
const lodeC = card('Sword', 'lodestone', 0);
let placed = ai.positionDeploy(0, [card('Coin', null, 0), lodeC], [card('Bread', null, 0), card('Quill', null, 0)]);
let board = placed.faceUp.concat(placed.hidden);
let li = board.indexOf(lodeC);
assert(li > 0 && li < board.length - 1, `Lodestone is placed in an interior slot (idx ${li} of ${board.length})`);
assert(board[li - 1].evalue >= 3 && board[li + 1].evalue >= 3, 'Lodestone is flanked by the highest-value cards (both lifted)');

// Drain seeks the slot facing the foe's strongest card.
G = setup('tavern', ['The Ferryman', 'The Ferryman']);
// foe (seat0, the opponent of our actor seat1) shows a strong card at slot 2
G.players[0].board = [card('Quill', null, 0), card('Crest', null, 0), card('Coin', null, 0)]; // 1,1,3 — strong at slot 2
const drainC = card('Chain', 'drain', 1);
placed = ai.positionDeploy(1, [card('Quill', null, 1), card('Crest', null, 1)], [drainC, card('Ferry', null, 1)]);
board = placed.faceUp.concat(placed.hidden);
assert(board.indexOf(drainC) === 2, `Drain is placed in the slot facing the foe's strongest card (slot ${board.indexOf(drainC)})`);

// Sentinel seeks an end slot (the opposite of Lodestone's interior want).
G = setup('tavern', ['The Clerk', 'The Clerk']);
G.players[1].board = [];
const sent = card('Quill', 'sentinel', 0);
placed = ai.positionDeploy(0, [card('Coin', null, 0), sent], [card('Bread', null, 0), card('Sword', null, 0)]);
board = placed.faceUp.concat(placed.hidden);
li = board.indexOf(sent);
assert(li === 0 || li === board.length - 1, `Sentinel is placed on an end slot (idx ${li} of ${board.length})`);

// A board with no positional effect is left to the exposure order (no needless churn).
assert(ai.isPositionalFx('lodestone') && ai.isPositionalFx('drain') && ai.isPositionalFx('sentinel'), 'Lodestone, Drain and Sentinel are positional');
assert(!ai.isPositionalFx('keen') && !ai.isPositionalFx('anchor') && !ai.isPositionalFx('harmony'), 'Keen, Anchor and Harmony are position-agnostic');

console.log('OK effects-ai: bots assess Anchor/Keen/Lodestone/Drain correctly (with fog of war), target & keep them by effective value, place positional effects well, and layer per-bot persona priorities on top.');
