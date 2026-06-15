'use strict';
/* The Archivist pure resolution engine (resolveArchivist).
   Stones queue onto slots; resolve forward (placement order) or reverse
   (last-placed-first = Hardcore). Verifies the order-war divergences that
   make the boss tick. See docs/archivist-design.md. */
const M = require('../game.js');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

// helper: a fresh slot board of named cards (or null)
const card = name => ({ name, phantom: false, locked: false });

// --- 1. White-then-Blue: lock vs swap differs forward vs reverse ---
// queue: White on slot 2, then Blue swap 2<->3.
{
  const slots = [card('A'), card('B'), card('C'), card('D')];
  const q = [{ color: 'white', slot: 2 }, { color: 'blue', slot: 2, swap: 3 }];

  const fwd = M.resolveArchivist(slots, q, false);
  // forward: lock slot2 (C), then blue hits a locked slot -> fizzles.
  assert(fwd.slots[2].name === 'C' && fwd.slots[2].locked, 'fwd: slot2 stays C, locked');
  assert(fwd.slots[3].name === 'D', 'fwd: slot3 stays D (swap fizzled)');
  assert(fwd.log[1].fizzled, 'fwd: blue fizzled on locked slot');

  const rev = M.resolveArchivist(slots, q, true);
  // reverse: blue resolves first (C<->D swap), then white locks slot2.
  assert(rev.slots[2].name === 'D' && rev.slots[2].locked, 'rev: slot2 now D, locked');
  assert(rev.slots[3].name === 'C', 'rev: slot3 now C');
  assert(!rev.log[1].fizzled && !rev.log[0].fizzled, 'rev: nothing fizzled');
}

// --- 2. Black undoes the last RESOLVED stone on its slot ---
// queue on slot 1: Red, Black, Blue (the user's worked example).
//  forward: Red(phantom) -> Black undoes Red -> Blue swaps -> phantom gone, swap stands.
//  reverse: Blue swaps -> Black undoes Blue (swap reverts) -> Red phantom stands.
{
  const slots = [card('A'), card('B'), card('C'), card('D')];
  const q = [
    { color: 'red', slot: 1 },
    { color: 'black', slot: 1 },
    { color: 'blue', slot: 1, swap: 2 },
  ];

  const fwd = M.resolveArchivist(slots, q, false);
  // Black countered Red; Blue then swaps slot1<->2 (B<->C).
  assert(fwd.slots[1].name === 'C' && !fwd.slots[1].phantom, 'fwd: slot1 swapped to C, no phantom (red undone)');
  assert(fwd.slots[2].name === 'B', 'fwd: slot2 swapped to B');

  const rev = M.resolveArchivist(slots, q, true);
  // Blue first (B<->C), Black undoes that swap (revert), Red gives phantom to original B.
  assert(rev.slots[1].name === 'B' && rev.slots[1].phantom, 'rev: slot1 back to B with phantom (blue undone, red stands)');
  assert(rev.slots[2].name === 'C', 'rev: slot2 back to C');
}

// --- 3. Black fizzles with nothing to undo ---
{
  const slots = [card('A'), card('B')];
  const q = [{ color: 'black', slot: 0 }];
  const r = M.resolveArchivist(slots, q, false);
  assert(r.log[0].fizzled, 'lone black fizzles');
  assert(r.slots[0].name === 'A' && !r.slots[0].locked && !r.slots[0].phantom, 'lone black leaves slot untouched');
}

// --- 4. Red on an empty slot fizzles; existing structure is respected ---
{
  const slots = [card('A'), null];
  const q = [{ color: 'red', slot: 1 }, { color: 'white', slot: 0 }, { color: 'red', slot: 0 }];
  const r = M.resolveArchivist(slots, q, false);
  assert(r.log[0].fizzled, 'red on empty slot fizzles');
  // white locks slot0, then red wants slot0 but it's locked -> fizzle.
  assert(r.slots[0].locked && !r.slots[0].phantom, 'red fizzles on locked slot');
  assert(r.log[2].fizzled, 'red after lock fizzled');
}

// --- 5. Purity: inputs are not mutated ---
{
  const slots = [card('A'), card('B')];
  const q = [{ color: 'white', slot: 0 }, { color: 'blue', slot: 0, swap: 1 }];
  const snapshot = JSON.stringify(slots);
  M.resolveArchivist(slots, q, false);
  M.resolveArchivist(slots, q, true);
  assert(JSON.stringify(slots) === snapshot, 'engine does not mutate input slots');
}

// --- 6. Blue swap is symmetric & both endpoints must be unlocked ---
{
  const slots = [card('A'), card('B'), card('C')];
  // lock slot2 first, then try to swap 0<->2 -> fizzle (target locked).
  const q = [{ color: 'white', slot: 2 }, { color: 'blue', slot: 0, swap: 2 }];
  const r = M.resolveArchivist(slots, q, false);
  assert(r.log[1].fizzled, 'blue fizzles when an endpoint is locked');
  assert(r.slots[0].name === 'A' && r.slots[2].name === 'C', 'no swap occurred');
}

console.log('OK archivist engine: order-war forward/reverse, black-undoes-last-resolved, fizzles, purity.');
