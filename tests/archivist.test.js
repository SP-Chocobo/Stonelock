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

// --- 2b. White is untouchable: Black never pulls a lock ---
{
  const slots = [card('A'), card('B')];
  // White locks slot 0, then Black tries to undo it.
  const q = [{ color: 'white', slot: 0 }, { color: 'black', slot: 0 }];
  const r = M.resolveArchivist(slots, q, false);
  assert(r.slots[0].locked, 'white lock survives a Black on its slot');
  assert(r.log[1].fizzled, 'black fizzles against a lock — nothing it may undo');
}
// --- 2c. A lock shields the Red beneath it from Black ---
{
  const slots = [card('A')];
  // Red phantom, then White lock on the same slot, then Black.
  const q = [{ color: 'red', slot: 0 }, { color: 'white', slot: 0 }, { color: 'black', slot: 0 }];
  const r = M.resolveArchivist(slots, q, false);
  assert(r.slots[0].locked && r.slots[0].phantom, 'locked slot keeps both its phantom and lock');
  assert(r.log[2].fizzled, 'black fizzles on a locked slot, leaving the red intact');
}

// --- 2d. Fizzles are evaluated in REVERSE resolution order (Hardcore) ---
{
  // Two Whites on the same slot: exactly one locks, the other fizzles — and which
  // one fizzles flips with direction (the log is always in resolution order).
  const slots = [card('A')];
  const q = [{ color: 'white', slot: 0 }, { color: 'white', slot: 0 }];
  const fwd = M.resolveArchivist(slots, q, false);
  assert(!fwd.log[0].fizzled && fwd.log[1].fizzled, 'fwd: first white locks, second fizzles');
  const rev = M.resolveArchivist(slots, q, true);
  assert(!rev.log[0].fizzled && rev.log[1].fizzled, 'rev: the last-placed white resolves first and locks; the earlier one fizzles');
  assert(rev.slots[0].locked, 'rev: slot ends locked regardless');
}
{
  // Red then Blue-swap on a slot, reversed: Blue resolves first (swaps the card
  // away), so the Red — resolving second — lands on the swapped-in card, not a
  // fizzle; but a Red onto an already-phantomed card DOES fizzle. Check the latter
  // in reverse: two Reds same slot — last-placed phantoms first, the other fizzles.
  const slots = [card('A')];
  const q = [{ color: 'red', slot: 0 }, { color: 'red', slot: 0 }];
  const rev = M.resolveArchivist(slots, q, true);
  assert(!rev.log[0].fizzled && rev.log[1].fizzled, 'rev: one red phantoms, the second fizzles');
  assert(rev.slots[0].phantom, 'rev: slot keeps its single phantom');
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

// --- Black can NEVER undo another Black (it cannot itself be undone). Stacking
// blacks is allowed; the extras simply fizzle. ---
{
  // Red, then two Blacks on the same slot. The first Black undoes the Red; the
  // second finds nothing (a Black is never in the undo history) and fizzles.
  const slots = [card('A')];
  const q = [{ color: 'red', slot: 0 }, { color: 'black', slot: 0 }, { color: 'black', slot: 0 }];
  const fwd = M.resolveArchivist(slots, q, false);
  assert(fwd.log[1].color === 'black' && !fwd.log[1].fizzled, 'first Black undoes the Red');
  assert(fwd.log[2].color === 'black' && fwd.log[2].fizzled, 'second Black fizzles — it cannot undo the first Black');
  assert(fwd.slots[0].phantom === false, 'the Red is undone exactly once, not re-applied');
  // Two Blacks alone: both fizzle, nothing touched.
  const r2 = M.resolveArchivist([card('A')], [{ color: 'black', slot: 0 }, { color: 'black', slot: 0 }], false);
  assert(r2.log.every(e => e.fizzled), 'stacked Blacks with nothing to undo both fizzle — no Black-on-Black');
  // Reverse order: the Blacks resolve before the Red, so they fizzle and the Red stands.
  const rev = M.resolveArchivist([card('A')], [{ color: 'red', slot: 0 }, { color: 'black', slot: 0 }, { color: 'black', slot: 0 }], true);
  assert(rev.slots[0].phantom === true && rev.log.filter(e => e.color === 'black').every(e => e.fizzled), 'reverse: Blacks resolve first, fizzle; the Red survives');
}

// --- Variant stones in the slot engine (Court of Precedence upgrades) ---
// The four Circuit upgrades resolve in full through the same engine: Twin Red
// fields two phantoms, Deadbolt locks an adjacent own slot, Riptide resists the
// first Black (a plain swap survives) and unwinds only on a second, Onyx undoes
// twice (its slot, then the latest elsewhere). Base rules still drive placement.
{
  // Twin Red — two phantoms on its slot (a base Red only one).
  const twin = M.resolveArchivist([card('A')], [{ color: 'twinred', slot: 0 }], false);
  assert(twin.slots[0].phantom && twin.slots[0].twin, 'Twin Red sets a phantom AND the twin flag (two phantoms)');
  const one = M.resolveArchivist([card('A')], [{ color: 'red', slot: 0 }], false);
  assert(one.slots[0].phantom && !one.slots[0].twin, 'a base Red sets one phantom, no twin');
  // A Black undoes the whole Twin Red (both phantoms gone).
  const twinUndo = M.resolveArchivist([card('A')], [{ color: 'twinred', slot: 0 }, { color: 'black', slot: 0 }], false);
  assert(!twinUndo.slots[0].phantom && !twinUndo.slots[0].twin, 'a Black pulls the whole Twin Red — no phantom, no twin');
}
{
  // Deadbolt — locks its slot AND an adjacent slot on the SAME side. owners: two
  // seats of two slots each ([0,0,1,1]); a Deadbolt on slot 0 also locks slot 1,
  // never crossing to seat 1's slot 2.
  const owners = [0, 0, 1, 1];
  const slots = [card('A'), card('B'), card('C'), card('D')];
  const r = M.resolveArchivist(slots, [{ color: 'deadbolt', slot: 0 }], false, owners);
  assert(r.slots[0].locked && r.slots[1].locked, 'Deadbolt locks its slot and the adjacent own slot');
  assert(!r.slots[2].locked && !r.slots[3].locked, 'Deadbolt never reaches across to the other side');
  // The adjacent lock shields a Red beneath it from a later Black on THAT slot.
  const shield = M.resolveArchivist([card('A'), card('B')], [
    { color: 'red', slot: 1 }, { color: 'deadbolt', slot: 0 }, { color: 'black', slot: 1 },
  ], false, [0, 0]);
  assert(shield.slots[1].phantom && shield.log[2].fizzled, 'the second Deadbolt lock shields slot 1’s Red from Black');
}
{
  // Riptide — a Blue that resists the first Black. queue: Riptide swap 0<->1,
  // then Black on slot 0. The first Black only breaks the undertow; the swap holds.
  const slots = [card('A'), card('B')];
  const oneBlack = M.resolveArchivist(slots, [{ color: 'riptide', slot: 0, swap: 1 }, { color: 'black', slot: 0 }], false);
  assert(oneBlack.slots[0].name === 'B' && oneBlack.slots[1].name === 'A', 'one Black leaves the Riptide swap standing (undertow only broken)');
  assert(!oneBlack.log[1].fizzled, 'the first Black does act (it downgrades the Riptide), so it is not a fizzle');
  // A SECOND Black finally unwinds the (now plain) swap.
  const twoBlack = M.resolveArchivist(slots, [{ color: 'riptide', slot: 0, swap: 1 }, { color: 'black', slot: 0 }, { color: 'black', slot: 0 }], false);
  assert(twoBlack.slots[0].name === 'A' && twoBlack.slots[1].name === 'B', 'a second Black unwinds the Riptide trade');
}
{
  // Onyx — Double Disruption: undoes the last on its slot, THEN the latest
  // elsewhere. queue: Red@0, Red@1, Onyx@0 → both Reds gone.
  const r = M.resolveArchivist([card('A'), card('B')], [
    { color: 'red', slot: 0 }, { color: 'red', slot: 1 }, { color: 'onyx', slot: 0 },
  ], false);
  assert(!r.slots[0].phantom && !r.slots[1].phantom, 'Onyx undoes its own slot’s Red and the latest Red elsewhere');
  // A plain Black would only clear its own slot, leaving slot 1’s Red.
  const plain = M.resolveArchivist([card('A'), card('B')], [
    { color: 'red', slot: 0 }, { color: 'red', slot: 1 }, { color: 'black', slot: 0 },
  ], false);
  assert(!plain.slots[0].phantom && plain.slots[1].phantom, 'a base Black clears only its own slot — slot 1’s Red stands');
}

console.log('OK archivist engine: order-war forward/reverse, black-undoes-last-resolved, no Black-on-Black, fizzles, variants (Twin/Deadbolt/Riptide/Onyx), purity.');
