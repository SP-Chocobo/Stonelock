'use strict';
/* The Archivist — headless balance battery (NOT a unit test; run on demand:
   `node tests/archivist-balance.js`). Drives full co-op hands with order-aware
   bots through the REAL scoring engine (bestSelection / twoBestHands) and the
   REAL resolveArchivist, measuring per-tier party win rates. It proves the
   inverted slot-stone mechanic functions end-to-end and sets a starting tuning
   for each difficulty. These are SYNTHETIC numbers (bespoke heuristic bots, a
   single-hand party-vs-boss compare) — directional only; the live boss must be
   re-tuned against the real wired raid AI, like the Apothecary was. See
   docs/archivist-design.md.

   Findings (n>=800):
     - Stone count alone PLATEAUS ~59-62% party past boss=7 — the party's two
       white-locked hands can't be ground down by volume.
     - Boss BOARD SIZE is the dominant lever (raises its two-best ceiling):
       7->8 cards moved Easy(boss=6) from ~64% to ~51%.
     - Reverse (Hard) costs the party ~3-4 pts vs forward at the same budget.
     - Positioning matters: forward, the LAST-placed stone resolves last (an
       uncounterable final say — the boss "keeps the last word"); reverse flips
       that (first-placed resolves last), which is the Hard brain-bender.
   Chosen starting config (party win, synthetic):
     Easy     board 7, 6 boss stones, forward  ~64%
     Standard board 8, 7 boss stones, forward  ~50%
     Hardcore board 8, 7 boss stones, reverse  ~46%  (Std budget + reverse) */
const M = require('../game.js');
const VALUES = M.REGIONS.bar.values;
const OPTS = {};
const TYPES = M.TYPES;
const rint = n => Math.floor(Math.random() * n);

const slotsOfOwner = (o, L) => (o === 1 ? L.BOSS : o === 0 ? L.SEAT0 : L.SEAT2);
function layout(pf, bc) {
  const SEAT0 = Array.from({ length: pf }, (_, i) => i);
  const BOSS = Array.from({ length: bc }, (_, i) => pf + i);
  const SEAT2 = Array.from({ length: pf }, (_, i) => pf + bc + i);
  const ownerOf = gi => (BOSS.includes(gi) ? 1 : SEAT0.includes(gi) ? 0 : 2);
  return { pf, bc, SEAT0, BOSS, SEAT2, N: pf + bc + pf, ownerOf };
}

function dealHand(n) { const h = []; for (let k = 0; k < n; k++) h.push(TYPES[rint(TYPES.length)]); return h; }
function keepBest(hand, footprint) {
  return hand.slice().sort((a, b) => VALUES[b] - VALUES[a]).slice(0, footprint);
}
function buildBoard(L) {
  const slots = new Array(L.N).fill(null);
  for (const o of [0, 2]) {
    const kept = keepBest(dealHand(L.pf + 1), L.pf);
    slotsOfOwner(o, L).forEach((gi, k) => { slots[gi] = { id: gi, type: kept[k], owner: o, phantom: false, locked: false }; });
  }
  L.BOSS.forEach((gi) => { slots[gi] = { id: gi, type: dealHand(1)[0], owner: 1, phantom: false, locked: false }; });
  return slots;
}
function scoreSeat(slots, owner, L) {
  const cards = slotsOfOwner(owner, L).map(gi => slots[gi]).filter(Boolean)
    .map(c => ({ type: c.type, hasRed: c.phantom, poisoned: false }));
  return M.bestSelection(cards, VALUES, OPTS).score;
}
function bossScore(slots, L) {
  const cards = L.BOSS.map(gi => slots[gi]).filter(Boolean)
    .map(c => ({ type: c.type, hasRed: c.phantom, poisoned: false }));
  return M.twoBestHands(cards, VALUES, OPTS).score;
}
const partyScore = (slots, L) => scoreSeat(slots, 0, L) + scoreSeat(slots, 2, L);
function objective(slots, actorOwner, L) {
  const diff = partyScore(slots, L) - bossScore(slots, L);
  return actorOwner === 1 ? -diff : diff;
}

// order-aware bot: shortlist legal placements for a color, full-evaluate them.
function candidates(color, actorOwner, baseSlots, L) {
  const out = [];
  const all = baseSlots.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
  const mine = all.filter(s => L.ownerOf(s) === actorOwner);
  const theirs = all.filter(s => (actorOwner === 1) ? L.ownerOf(s) !== 1 : L.ownerOf(s) === 1);
  const byVal = (a, b) => VALUES[baseSlots[b].type] - VALUES[baseSlots[a].type];
  const mineHi = mine.slice().sort(byVal);
  const theirHi = theirs.slice().sort(byVal);
  if (color === 'white' || color === 'red') {
    for (const s of mineHi.slice(0, 3)) out.push({ color, slot: s, by: actorOwner });
  } else if (color === 'black') {
    for (const s of mineHi.slice(0, 2)) out.push({ color, slot: s, by: actorOwner });
    for (const s of theirHi.slice(0, 2)) out.push({ color, slot: s, by: actorOwner });
  } else if (color === 'blue') {
    const lows = mineHi.slice().reverse().slice(0, 2);
    for (const a of lows) for (const b of theirHi.slice(0, 2)) out.push({ color, slot: a, swap: b, by: actorOwner });
  }
  return out;
}

function playHand(L, bossStones, reverse) {
  const slots = buildBoard(L);
  const queue = [];
  const caps = {
    0: { pool: { red: 2, white: 2, blue: 2, black: 2 }, left: 3 },
    2: { pool: { red: 2, white: 2, blue: 2, black: 2 }, left: 3 },
    1: { pool: { red: 3, white: 3, blue: 3, black: 3 }, left: bossStones },
  };
  const order = [];
  let pa = 3, pb = 3, bs = bossStones;
  while (pa + pb + bs > 0) {
    if (pa > 0) { order.push(0); pa--; }
    if (bs > 0) { order.push(1); bs--; }
    if (pb > 0) { order.push(2); pb--; }
    if (bs > 0 && (pa + pb) > 0) { order.push(1); bs--; }
  }
  for (const actor of order) {
    const cap = caps[actor];
    if (cap.left <= 0) continue;
    const base = M.resolveArchivist(slots, queue, reverse).slots;
    let best = null;
    for (const color of ['red', 'white', 'blue', 'black']) {
      if (cap.pool[color] <= 0) continue;
      for (const cand of candidates(color, actor, base, L)) {
        const res = M.resolveArchivist(slots, queue.concat([cand]), reverse);
        const val = objective(res.slots, actor, L);
        if (!best || val > best.val) best = { val, cand, color };
      }
    }
    if (!best) continue;
    queue.push(best.cand); cap.pool[best.color]--; cap.left--;
  }
  const final = M.resolveArchivist(slots, queue, reverse).slots;
  return partyScore(final, L) > bossScore(final, L); // boss holds ties
}

function rate(label, pf, bc, bossStones, reverse, n) {
  const L = layout(pf, bc);
  let wins = 0;
  for (let i = 0; i < n; i++) if (playHand(L, bossStones, reverse)) wins++;
  console.log(`${label.padEnd(10)} board=${bc} boss=${bossStones} ${reverse ? 'REVERSE' : 'forward'}  party win ${(100 * wins / n).toFixed(1)}%`);
  return wins / n;
}

// Default sample is modest so a run finishes in well under a minute (the
// board-8 tiers call the exponential two-best scorer); bump with ARCH_N for
// tighter numbers, e.g. `ARCH_N=2000 node tests/archivist-balance.js`.
const N = +(process.env.ARCH_N || 350);
console.log(`--- The Archivist balance battery (n=${N}/tier) ---`);
rate('Easy',     4, 7, 6, false, N);
rate('Standard', 4, 8, 7, false, N);
rate('Hardcore', 4, 8, 7, true,  N);
