'use strict';
const { bestSelection, REGIONS } = require('../game.js');

let fails = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${name}`);
}

const bar = REGIONS.bar.values;   // Bread/Coin/Road 3, Sword/Ferry 2, Quill/Crest/Chain 1
const house = REGIONS.house.values;

// Three singles: pick highest values
let r = bestSelection([
  { type: 'Bread', hasRed: false }, { type: 'Coin', hasRed: false },
  { type: 'Quill', hasRed: false }, { type: 'Sword', hasRed: false },
], bar);
check('singles best 3 of 4', [r.score, r.structure], [8, 'singles']); // 3+3+2

// Pair beats singles when bonus helps: pair of Quills (1+1+2=4) vs Bread+Coin+Quill(7)... raw wins
r = bestSelection([
  { type: 'Quill', hasRed: false }, { type: 'Quill', hasRed: false },
  { type: 'Bread', hasRed: false }, { type: 'Coin', hasRed: false },
], bar);
// options: Bread+Coin+Quill = 7 singles; Quill+Quill+Bread = 1+1+3+2 = 7 pair → tie, structure prefers pair
check('pair tiebreak preferred at equal score', [r.score, r.structure], [7, 'pair']);

// Triad: three Roads in bar = 3*3+6 = 15
r = bestSelection([
  { type: 'Road', hasRed: false }, { type: 'Road', hasRed: false },
  { type: 'Road', hasRed: false }, { type: 'Crest', hasRed: false },
], bar);
check('triad', [r.score, r.raw, r.bonus, r.structure], [15, 9, 6, 'triad']);

// Red phantom scores structure only: Bread(red)+phantom+Coin = 3+0+3 +2 pair = 8
// (beats the 7-point singles line, but no free 3 points)
r = bestSelection([
  { type: 'Bread', hasRed: true }, { type: 'Coin', hasRed: false },
  { type: 'Quill', hasRed: false }, { type: 'Crest', hasRed: false },
], bar);
check('red phantom pair (structure only)', [r.score, r.raw, r.structure], [8, 6, 'pair']);

// Red completing a triad (the prose scenario): two Ferries, one redded, in dock rules (Ferry=3)
// Ferry+Ferry+phantom = 3+3+0+6 = 12, beating Ferry+Ferry+Road = 11
const dock = REGIONS.dock.values;
r = bestSelection([
  { type: 'Ferry', hasRed: true }, { type: 'Ferry', hasRed: false },
  { type: 'Sword', hasRed: false }, { type: 'Road', hasRed: false },
], dock);
check('phantom triad (prose scenario)', [r.score, r.structure], [12, 'triad']);

// Phantom must not be double-used beyond 3 units / requires host card:
// single Chain with red in house (Chain=3): chain+phantom+best single = 3+0+1+2 = 6
r = bestSelection([
  { type: 'Chain', hasRed: true }, { type: 'Bread', hasRed: false },
  { type: 'Coin', hasRed: false }, { type: 'Sword', hasRed: false },
], house);
check('phantom pair house', [r.score, r.structure], [6, 'pair']);

// A weak phantom may not make the scoring set at all:
// Quill(red) pair = 1+0+3+2 = 6 loses to Bread+Coin+Road = 9 singles
r = bestSelection([
  { type: 'Quill', hasRed: true }, { type: 'Bread', hasRed: false },
  { type: 'Coin', hasRed: false }, { type: 'Road', hasRed: false },
], bar);
check('weak phantom left out of the set', [r.score, r.structure, r.picks.some(p => p.phantom)], [9, 'singles', false]);

// House values sanity
check('house values', [house.Chain, house.Crest, house.Quill, house.Ferry, house.Road, house.Bread, house.Coin, house.Sword], [3,3,3,2,2,1,1,1]);

process.exit(fails ? 1 : 0);
