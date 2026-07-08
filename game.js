'use strict';
/* ============================================================
   STONELOCK — a playable adaptation of the tabletop game
   from the novel.

   Formats: Solo 1v1, 4-player Free-for-All, 2v2 Paired Teams.
   Deals: Small Game (5 cards, best 3 of 4) or House Deep Draft
   (9 cards, best 3 of 5). Sovereign Honor scoring throughout —
   each FFA seat banks its margin over the LOWEST hand each showdown.
   ============================================================ */

/* ---------------- Static data ---------------- */

const TYPES = ['Crest', 'Coin', 'Bread', 'Quill', 'Sword', 'Chain', 'Ferry', 'Road'];

const REGIONS = {
  bar: {
    key: 'bar',
    name: 'Bar-Level Rules',
    subtitle: 'The Practical Common',
    blurb: 'Roadside taverns, frontier camps, and common villages.',
    values: { Bread: 3, Coin: 3, Road: 3, Sword: 2, Ferry: 2, Quill: 1, Crest: 1, Chain: 1 },
  },
  house: {
    key: 'house',
    name: 'House Games',
    subtitle: 'The Sovereign Ledger',
    blurb: 'Formal high-court chambers and noble estates.',
    values: { Chain: 3, Crest: 3, Quill: 3, Ferry: 2, Road: 2, Bread: 1, Coin: 1, Sword: 1 },
  },
  dock: {
    key: 'dock',
    name: 'Dock / Traveler Games',
    subtitle: 'The Fluvial Exchange',
    blurb: 'Merchant ports, river syndicates, and highway checkpoints.',
    values: { Road: 3, Ferry: 3, Coin: 3, Bread: 2, Sword: 2, Chain: 1, Quill: 1, Crest: 1 },
  },
};

// Venues bundle a regional valuation with its local house rule, so
// the value shifts arrive paired with real rule changes.
// Each venue keeps its own crowd of regulars (the "usual" company), so the
// default opponents vary by table instead of always being The Stranger.
// Listed in campaign order: the two always-open base tables, then each boss's
// unlock in the order you'd earn it climbing (Warden→Slums, Apothecary→Hall,
// Quartermaster→Academy, Archivist→Court).
const VENUES = {
  tavern: { region: 'bar', variant: null, label: 'The Roadside Tavern', desc: 'The Practical Common values. No house rules — the baseline game.', regulars: ['The Old Hand', 'The Tinker', 'The Deckhand', 'The Stranger'] },
  docks: { region: 'dock', variant: 'riverlock', label: 'The River Docks', desc: 'Fluvial Exchange values, under Riverlock: field a Road or Ferry among your final three, or the hand is docked 2 points.', regulars: ['The Ferryman', 'The Wagoner', 'The Deckhand', 'The Clerk'] },
  slums: { region: 'bar', variant: 'slumlock', label: 'The Slum Tables', desc: 'Common values, under Slumlock: a stone placed this hand is exhausted for the next two hands.', regulars: ['The Miner', 'The Wagoner', 'The Stranger', 'The Ferryman'] },
  hall: { region: 'bar', variant: 'cursed', label: 'The Gambling Hall', desc: 'Common values, under the Cursed Register: each hand one card type is drawn cursed — it scores nothing and builds nothing.', regulars: ['The Stranger', 'The Lady', 'The Miner', 'The Tinker'] },
  academy: { region: 'bar', variant: 'gauntlet', label: 'The Academy Gauntlet', desc: 'A drill in pure interaction: no telegraphing, no thinning. Every player holds one of each stone and must place all four, in serpentine turn order. The cards are a fixed canvas — the stones decide it.', regulars: ['The Clerk', 'The Old Hand', 'The Tinker', 'The Lady'] },
  court: { region: 'house', variant: 'precedence', label: 'The Court of Precedence', desc: 'Statecraft values, under the Writ of Precedence: stones go down FIRST, onto the empty slots, and wait — then you fill the slots with cards. The stones resolve in the order they were placed. Sequence is everything.', regulars: ['The Clerk', 'The Lady', 'The Old Hand', 'The Stranger'] },
};

const STONES = {
  red:   { name: 'Red Stone',   power: 'Duplication', desc: 'Places a phantom duplicate onto one of your cards. The phantom can stand as the second or third copy for a Pair or Triad bonus, but scores no point value of its own.' },
  white: { name: 'White Stone', power: 'Lock',        desc: 'Protects a card. A locked card cannot be altered, stolen, or neutralized for the rest of the hand.' },
  blue:  { name: 'Blue Stone',  power: 'Exchange',    desc: 'Forcibly swaps one of your cards with an unprotected card in an opponent’s layout. Visibility states stay as they were.' },
  black: { name: 'Black Stone', power: 'Disruption',  desc: 'Undoes the last stone effect upon a card. Played on your turn like any other stone; it cannot itself be undone.' },
  green: { name: 'Green Stone', power: 'Poison',      desc: 'Poisons a card: it scores nothing and joins no Pair or Triad, and any phantom riding it dies with it. The Apothecary’s scalpel — always its last word, cutting your best unlocked card. Only a White lock set in time can shield against it.' },
};

const STONE_KEYS = ['red', 'white', 'blue', 'black'];

// Stone variants (the pouch's upgrade track — its answer to effect cards). A
// variant is a stronger version of a base colour, acquired/upgraded in the
// Circuit. It carries the base's resolution category (targeting, persona, UI
// colour) plus an override. Circuit-only; the base game never sees them.
const STONE_VARIANTS = {
  twinred:  { base: 'red',   name: 'Twin Red',     power: 'Double Duplication',  desc: 'Places TWO phantoms onto your card — enough to stand as a whole Triad on its own.' },
  deadbolt: { base: 'white', name: 'Deadbolt White', power: 'Double Lock',       desc: 'Locks your card AND an adjacent one — two cards shielded by a single stone.' },
  riptide:  { base: 'blue',  name: 'Riptide Blue', power: 'Undertow Exchange',     desc: 'Swaps a card like Blue, but the pull is strong: a Black Stone only weakens it back to an ordinary swap. It takes a SECOND Black to actually unwind the trade.' },
  onyx:     { base: 'black', name: 'Onyx Black',   power: 'Double Disruption',     desc: 'Undoes the last stone effect on the target card, then the latest remaining effect elsewhere on the table — two disruptions from a single stone.' },
};
function isVariant(key) { return !!STONE_VARIANTS[key]; }
function stoneBase(key) { return STONE_VARIANTS[key] ? STONE_VARIANTS[key].base : key; }
function getStone(key) { const v = STONE_VARIANTS[key]; return v ? Object.assign({}, STONES[v.base], v) : (STONES[key] || STONES.red); }
const ALL_STONE_KEYS = STONE_KEYS.concat(Object.keys(STONE_VARIANTS));

const AI_ROSTER = ['The Stranger', 'The Ferryman', 'The Clerk'];
const PARTNER_NAME = 'The Old Hand';

// Each regular at this table has habits — and at experienced tables,
// players learn to recognize them. Multipliers shape stone weights;
// `bluff` is the chance a telegraph means nothing; `risk` is how much
// an unknown face-down card discourages a steal.
const PERSONALITIES = {
  'The Stranger': { red: 1.0, white: 1.0, blue: 1.2, black: 1.2, bluff: 0.30, risk: 1, skill: 1.0, flavor: 'Reads the table, and lies to it. His telegraphs mean less than they seem.', bio: 'A hooded regular nobody quite places. He telegraphs stones he never means to spend and spends ones he never showed — every read he gives you is one he planted. Treat his board as a story he is telling, not the truth of it.' },
  'The Ferryman': { red: 0.8, white: 0.7, blue: 1.9, black: 0.9, bluff: 0.10, risk: 0, skill: 1.0, flavor: 'Anything on the river can be taken. Hide what you love.', bio: 'He worked the crossing thirty years and learned that everything in transit is fair game. He leans hard on the Blue Stone, swapping his dross for your treasures the instant your guard drops. Veil your best cards, or watch them float away.' },
  'The Clerk':    { red: 1.6, white: 1.6, blue: 0.6, black: 1.0, bluff: 0.05, risk: 2, skill: 1.0, flavor: 'Builds his ledger and locks it twice. Rarely reaches across the table.', bio: 'A creature of columns and double-entries. He raises a tidy, high-value layout and bolts it down with White, almost never reaching across the table. Patient and predictable — and very hard to dislodge once he has set his figures.' },
  'The Old Hand': { red: 1.0, white: 1.5, blue: 0.9, black: 1.4, bluff: 0.10, risk: 1, skill: 1.0, flavor: 'Keeps his partner alive, and unmakes what threatens the alliance.', bio: 'An old campaigner who plays for the alliance, not himself. He White-locks his partner’s prizes and Blacks whatever threatens the pair, scoring quietly while he shields you. The ally you want at your shoulder in a raid.' },
  'The Magistrate': { red: 1.2, white: 1.3, blue: 1.2, black: 1.3, bluff: 0, risk: 1, skill: 1.0, flavor: 'Fields a wide board, face-up, and scores its two best hands. Powerful, methodical, and fair only in that it never bluffs.' },
  'The Archivist': { red: 1.1, white: 1.2, blue: 1.4, black: 1.5, bluff: 0, risk: 1, skill: 1.0, flavor: 'Files your every move in order, then reads the ledger back — sometimes front to back, sometimes back to front.' },
  'The Quartermaster': { red: 1.2, white: 1.3, blue: 1.2, black: 1.2, bluff: 0, risk: 1, skill: 1.0, flavor: 'Rations the pouch — one colour locked away each hand, for everyone, cycling as the match wears on.' },
  'The Crucible': { red: 1.2, white: 1.3, blue: 1.3, black: 1.4, bluff: 0, risk: 1, skill: 1.0, flavor: 'Every trial at once — reverse order, colour-denial, exhaustion, and a buried Green scalpel.' },
  'The Warden': { red: 1.0, white: 1.2, blue: 1.5, black: 1.7, bluff: 0, risk: 0, skill: 1.0, flavor: 'Keeps one of every stone in hand and never wastes a hand of it — exhaustion be damned. It snuffs, steals, and locks without mercy.' },
  'The Tinker':   { red: 1.7, white: 1.2, blue: 0.7, black: 0.8, bluff: 0.12, risk: 1, skill: 0.93, flavor: 'In love with phantoms — reds everything, defends out of habit, and sometimes plays the wrong stone entirely.', bio: 'A tinkerer enchanted by phantoms — he Reds nearly everything, hunting Pairs and Triads that are not always there, and now and then fumbles the wrong stone entirely. Lethal when his duplicates land; gift-wrapped when they do not.' },
  'The Deckhand': { red: 1.0, white: 1.0, blue: 1.0, black: 1.0, bluff: 0.12, risk: 1, skill: 0.95, flavor: 'Plays it straight and even — no favorite stone, no grand plan.', bio: 'An honest pair of hands with no particular cunning. He spends whatever the moment asks for, favors no stone, and reads little into yours — a clean, even game with no exploitable habit and no real edge either. The fairest fight at the table.' },
  'The Lady':     { red: 0.8, white: 1.5, blue: 1.5, black: 0.9, bluff: 0.30, risk: 1, skill: 1.0, flavor: 'Guards her own treasures, and helps herself to yours.', bio: 'Poised and acquisitive. She White-locks whatever she means to keep and Blues away whatever she covets, smiling the whole time. Defense and theft with impeccable manners — the hardest regular to take anything from, and the easiest to lose things to.' },
  'The Miner':    { red: 1.6, white: 0.8, blue: 0.7, black: 1.5, bluff: 0.05, risk: 2, skill: 0.97, flavor: 'Digs out value, then blasts away whatever others build.', bio: 'Grim and tireless. He Red-doubles the richest seams he hauls up, then takes a Black to the props under everyone else’s work — building and demolition in the same calloused hands. Subtle as a rockfall.' },
  'The Wagoner':  { red: 0.8, white: 0.8, blue: 1.7, black: 1.5, bluff: 0.15, risk: 0, skill: 0.95, flavor: 'Everything’s cargo — to be hauled off or dropped in the mud.', bio: 'A restless hauler who treats the whole table as freight. He Blues your prizes onto his wagon and Blacks the plans you were proud of, rerouting a hand into chaos. Light on defense — outlast the churn and he runs out of road.' },
};
const DEFAULT_PERSONA = { red: 1, white: 1, blue: 1, black: 1, bluff: 0.1, risk: 1, skill: 1, flavor: '' };
function personaOf(who) { return PERSONALITIES[G.names[who]] || DEFAULT_PERSONA; }
// Personality stone-leans are flavor, but raw multipliers are extreme enough to
// override good play (e.g. the Clerk never steals, so it loses to neutral play).
// Compress them toward 1.0 for stone DECISIONS: the lean stays visible, but a
// regular won't self-destruct on it. (Flavor weights themselves are unchanged.)
const PERS_COMPRESS = 0.5;
function persStoneW(who, color) { return 1 + (personaOf(who)[color] - 1) * PERS_COMPRESS; }
// Sloppiness: below-skill players occasionally make the wrong play.
function fumbles(who) { return rnd() > personaOf(who).skill; }

// The pool a table can draw from. The Old Hand is the default partner in
// teams, but is also a selectable regular in its own right (a defensive
// locker/disruptor) — his protective play comes from team scoring, not his
// name, so he reads as a wary tactician at any seat.
const BOT_POOL = ['The Stranger', 'The Ferryman', 'The Clerk', 'The Tinker', 'The Deckhand', 'The Old Hand', 'The Lady', 'The Miner', 'The Wagoner'];

// Character portraits (assets/portraits/*.jpg). 'lady', 'miner', 'wagon-driver'
// art is on disk too, awaiting characters to attach them to.
const PORTRAITS = {
  'The Stranger': 'stranger', 'The Ferryman': 'ferryman', 'The Clerk': 'clerk',
  'The Tinker': 'tinker', 'The Deckhand': 'deckhand', 'The Old Hand': 'oldhand',
  'The Lady': 'lady', 'The Miner': 'miner', 'The Wagoner': 'wagon-driver',
  'The Magistrate': 'magistrate', 'The Warden': 'warden', 'The Apothecary': 'apothecary',
  'The Archivist': 'archivist', 'The Quartermaster': 'quartermaster', 'The Crucible': 'crucible',
};
function portraitFor(name) { return PORTRAITS[name] ? `assets/portraits/${PORTRAITS[name]}.jpg` : null; }

// Which seats are AI-held, in seat order, per mode.
function slotName(i, footprint) {
  if (footprint === 5) return ['Foundation I', 'Foundation II', 'Veil I', 'Veil II', 'Final'][i] || '';
  return ['Foundation I', 'Foundation II', 'The Veil', 'Final'][i] || '';
}

/* ---------------- Sound ----------------
   All effects are synthesized with WebAudio — no files, nothing to
   load. Muting persists in localStorage. */

// Slider 0..1 maps to actual gain 0..MAX, with the slider midpoint (0.5) landing
// on the calibrated "sweet spot" (so MAX = 2× the good level): effects 0.5→0.60,
// music 0.5→0.25.
const SFX_MAX = 1.2;
const SFX = (() => {
  let ctx = null, master = null;
  let muted = false, vol = 0.5; // slider fraction; 0.5 = the 0.60 sweet spot
  try { muted = localStorage.getItem('stonelock-muted') === '1'; } catch (e) { /* headless */ }
  try { const v = localStorage.getItem('stonelock-sfxv2'); if (v !== null) vol = Math.max(0, Math.min(1, +v)); } catch (e) {}

  function ensure() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (!master) { master = ctx.createGain(); master.gain.value = muted ? 0 : vol * SFX_MAX; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function applyGain() { if (master) master.gain.value = muted ? 0 : vol * SFX_MAX; }

  function tone(c, t0, freq, dur, type = 'sine', peak = 0.1, slideTo = null) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(c, t0, dur, filterType = 'lowpass', freq = 600, peak = 0.18) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = peak;
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const recipes = {
    card(c, t)  { noiseBurst(c, t, 0.09, 'lowpass', 320, 0.22); },                     // soft thump on the felt
    flip(c, t)  { noiseBurst(c, t, 0.07, 'highpass', 2200, 0.07); noiseBurst(c, t + 0.05, 0.06, 'lowpass', 500, 0.14); },
    stone(c, t) { tone(c, t, 170, 0.09, 'triangle', 0.22, 95); noiseBurst(c, t, 0.025, 'highpass', 1800, 0.12); }, // river-glass clack
    undo(c, t)  { tone(c, t, 520, 0.22, 'sine', 0.1, 170); },                          // the work unwinds
    chime(c, t) { tone(c, t, 880, 0.22, 'sine', 0.05); tone(c, t + 0.05, 1318, 0.28, 'sine', 0.035); }, // your move
    sting(c, t) { tone(c, t, 392, 0.3, 'triangle', 0.08); tone(c, t + 0.13, 523, 0.4, 'triangle', 0.08); },
    win(c, t)   { [523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * 0.1, f, 0.3, 'triangle', 0.08)); },
    lose(c, t)  { [392, 311, 262].forEach((f, i) => tone(c, t + i * 0.14, f, 0.34, 'triangle', 0.07)); },
  };

  return {
    play(name) {
      if (muted || vol <= 0) return;
      const c = ensure();
      if (!c || !recipes[name]) return;
      try { recipes[name](c, c.currentTime); } catch (e) { /* never break the game for a sound */ }
    },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('stonelock-sfxv2', String(vol)); } catch (e) {} applyGain(); },
    getVolume() { return vol; },
    setMuted(m) { muted = !!m; try { localStorage.setItem('stonelock-muted', muted ? '1' : '0'); } catch (e) {} applyGain(); },
    toggle() { this.setMuted(!muted); return muted; },
    isMuted() { return muted; },
  };
})();

// Looping background music. Two tracks: 'menu' (Lost at Sea — menus + standard
// matches, unbroken) and 'boss' (Lost Ruins — boss raids). Volume + mute share the
// audio settings; playback only begins after a user gesture (browser autoplay).
const MUSIC_MAX = 0.5; // slider 0.5 -> 0.25 gain (the calibrated music sweet spot)
const Music = (() => {
  let vol = 0.5, muted = false, wanted = false, active = 'menu', fade = null; // vol is slider fraction
  try { const v = localStorage.getItem('stonelock-musicv2'); if (v !== null) vol = Math.max(0, Math.min(1, +v)); } catch (e) {}
  try { muted = localStorage.getItem('stonelock-muted') === '1'; } catch (e) {}
  const elFor = t => (typeof document !== 'undefined') ? document.getElementById(t === 'boss' ? 'bgmBoss' : 'bgm') : null;
  const TRACK_GAIN = { menu: 1, boss: 1.08 }; // boss theme rides ~8% hotter than the menu bed
  const target = () => muted ? 0 : Math.min(1, vol * MUSIC_MAX * (TRACK_GAIN[active] || 1));
  const clearFade = () => { if (fade) { clearInterval(fade); fade = null; } };
  // Smoothly ramp the active track toward its target volume and any others to 0,
  // over `dur` ms — used for fade-in on start, crossfade on track change, and
  // fade on mute/unmute, so nothing ever cuts in or out sharply.
  function transition(dur) {
    clearFade();
    const toEl = elFor(active);
    const others = ['menu', 'boss'].filter(t => t !== active).map(elFor).filter(Boolean);
    if (!toEl) return;
    const playable = wanted && !muted && vol > 0;
    if (playable && toEl.paused) { toEl.volume = 0; toEl.play().catch(() => {}); }
    const tgt = target();
    const fromTo = toEl.volume, fromOthers = others.map(e => e.volume);
    let p = 0; const inc = 50 / Math.max(50, dur);
    fade = setInterval(() => {
      p = Math.min(1, p + inc);
      if (toEl) toEl.volume = playable ? fromTo + (tgt - fromTo) * p : fromTo * (1 - p);
      others.forEach((e, i) => { e.volume = fromOthers[i] * (1 - p); });
      if (p >= 1) { clearFade(); if (!playable && toEl) toEl.pause(); others.forEach(e => e.pause()); }
    }, 50);
  }
  return {
    start() { wanted = true; transition(1000); },              // fade in from silence
    stop() { wanted = false; transition(600); },
    // Crossfade menu<->boss. On an actual track change, restart the incoming track
    // from the top (so the boss theme always gets its intro/drop and the menu its
    // opening) — resuming mid-phrase felt stark. Menu<->standard isn't a change, so
    // that bed stays unbroken.
    setTrack(t) { t = (t === 'boss') ? 'boss' : 'menu'; if (t === active) return; active = t; const a = elFor(active); if (a) { try { a.currentTime = 0; } catch (e) {} } if (wanted) transition(1400); },
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('stonelock-musicv2', String(vol)); } catch (e) {}
      if (fade) return; // a fade is mid-flight; let it finish at the new target
      const a = elFor(active);
      if (a) { if (wanted && !muted && vol > 0) { a.volume = target(); if (a.paused) a.play().catch(() => {}); } else a.pause(); }
    },
    getVolume() { return vol; },
    setMuted(m) { muted = !!m; transition(400); },             // fade on mute/unmute
  };
})();
// One global mute across music + effects.
function setGlobalMute(m) { SFX.setMuted(m); Music.setMuted(m); }
function isGlobalMute() { return SFX.isMuted(); }

/* ---------------- Utilities ---------------- */

/* ---------------- Seeded RNG ----------------
   A run routes ALL its randomness (shuffles, map gen, offers, AI) through a
   seeded PRNG so it's reproducible from a seed — daily/shared runs, and steadier
   tests. `rnd()` uses the seeded stream when one is active, else Math.random, so
   non-run modes (Standard/Campaign) are untouched. ---- */
let _rng = null;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedRng(seed) { _rng = mulberry32(seed >>> 0); }
function clearRng() { _rng = null; }
function rnd() { return _rng ? _rng() : Math.random(); }
let _seedCounter = 0;
function freshSeed() { return (((Date.now() >>> 0) ^ (Math.imul(_seedCounter++, 2654435761))) >>> 0); }
function dailySeed() { const d = new Date(); const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------------- Scoring ----------------
   A board card may carry a Red Stone, granting one phantom
   duplicate. The phantom may only be fielded alongside its
   physical card, and it counts toward STRUCTURE ONLY: it can stand
   as the second or third copy for a Pair or Triad bonus, but it
   adds no regional point value of its own. A weak phantom may
   simply not make the scoring set. Best 3 units are selected. */

function bestSelection(cards, values, opts = {}) {
  let best = null;
  const n = cards.length;
  const contrib = new Array(n).fill(0);

  // A Wildcard unit matches any type, so it folds onto the largest fixed group
  // (or, if every selected unit is wild, forms its own group). With at most 3
  // units selected, piling wilds on the biggest group is always optimal.
  function structure(counts, wilds) {
    const c = Object.values(counts);
    const maxFixed = c.length ? Math.max(...c) : 0;
    const group = (c.length ? maxFixed : 0) + (wilds || 0);
    if (group >= 3) return 'triad';
    if (group >= 2) return 'pair';
    return 'singles';
  }
  const RANK = { triad: 2, pair: 1, singles: 0 };

  function evaluate() {
    const counts = {};
    let raw = 0, wilds = 0;
    const picks = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < contrib[i]; k++) {
        const t = cards[i].type;
        // A poisoned card behaves exactly like a cursed one: no value, no structure.
        const cursed = cards[i].poisoned || (!!opts.cursed && t === opts.cursed); // scores nothing, builds nothing
        const effVal = (cards[i].evalue != null ? cards[i].evalue : values[t]); // modifier-aware value
        // Boss relics: River King's Toll folds Road/Ferry into one structural
        // type; Motherlode gives a Red phantom raw value.
        const ct = (opts.foldTypes && opts.foldTypes[t]) || t;
        const phVal = opts.phantomValue || 0;
        if (!cursed) {
          if (cards[i].wild) wilds++;                 // counts for structure as any type
          else counts[ct] = (counts[ct] || 0) + 1;
          // Effect cards carry a pre-computed effective value (evalue); plain
          // cards fall back to the region's value table. A phantom scores no raw
          // unless Motherlode (phantomValue) is in play.
          if (k === 0) raw += effVal;
          else raw += phVal;
        }
        // `value` is what this unit actually contributed (0 for a voided card; a
        // phantom's value is 0, or phantomValue under Motherlode), so the
        // showdown can show modifiers.
        picks.push({ type: t, phantom: k > 0, cardIdx: i, cursed, wild: !cursed && !!cards[i].wild, value: cursed ? 0 : (k > 0 ? phVal : effVal) });
      }
    }
    const struct = structure(counts, wilds);
    // Base structural bonus, plus any charm sweeteners passed in opts (Forger's
    // Seal on Pairs/Triads, Master Forger on Triads). 0 without those charms.
    const bonus = (struct === 'triad' ? 6 : struct === 'pair' ? 2 : 0)
      + (struct !== 'singles' ? (opts.bonusAdd || 0) : 0)
      + (struct === 'triad' ? (opts.triadAdd || 0) : 0)
      + (struct === 'pair' ? (opts.pairAdd || 0) : 0); // Matched Set (boss relic)
    let penalty = 0;
    if (opts.riverlock && !picks.some(p => !p.cursed && (p.wild || p.type === 'Road' || p.type === 'Ferry'))) {
      penalty = 2; // the Passage Requirement (a Wildcard can stand in for the Road/Ferry)
    }
    const score = raw + bonus - penalty;
    if (!best || score > best.score ||
        (score === best.score && RANK[struct] > RANK[best.structure])) {
      best = { score, raw, bonus, penalty, structure: struct, picks };
    }
  }

  function dfs(i, used) {
    if (used === 3) { evaluate(); return; }
    if (i === n) return;
    const maxHere = 1 + (cards[i].phantoms != null ? cards[i].phantoms : (cards[i].hasRed ? 1 : 0)); // Twin Red fields two phantoms
    for (let c = 0; c <= maxHere && used + c <= 3; c++) {
      contrib[i] = c;
      dfs(i + 1, used + c);
    }
    contrib[i] = 0;
  }
  dfs(0, 0);
  return best || { score: 0, raw: 0, bonus: 0, penalty: 0, structure: 'singles', picks: [] };
}

function variantOpts() {
  return {
    cursed: G.cursedType || null,
    riverlock: G.variant === 'riverlock',
  };
}
// Scoring opts for one seat: the variant rules, plus the player's charm scoring
// sweeteners (seat 0 in the Circuit). No-op for everyone else.
function scoreOptsFor(seat) {
  const o = variantOpts();
  if (G.gauntlet && charmsOf(seat).length) {
    o.bonusAdd = charmValSeat('bonusAdd', seat);
    o.triadAdd = charmValSeat('triadAdd', seat);
    o.phantomValue = charmValSeat('phantomValue', seat);                 // Motherlode (boss relic)
    o.pairAdd = charmValSeat('pairAdd', seat);                           // Matched Set (boss relic)
    if (charmsOf(seat).includes('riverking')) o.foldTypes = { Road: 'RoadFerry', Ferry: 'RoadFerry' }; // River King's Toll
  }
  return o;
}

// ---- The Archivist (4th boss) — pure resolution engine ----
// Stones are queued onto slots, then resolved in placement order (forward) or
// last-placed-first (reverse = Hardcore). `slotsIn` is a card-or-null per slot;
// `queue` is the ordered placements [{color, slot, swap?, by?}]. Returns the
// resolved slots (cards carry .phantom/.locked, and may have swapped position)
// plus a per-step log with fizzle flags for the playout. Pure (clones inputs).
// White locks the card in its slot; Red gives it a phantom; Blue swaps two slots
// (locked slots block it); Black undoes the last resolved, not-yet-undone stone
// on its slot. See docs/archivist-design.md.
// `owners` (optional) maps a global slot index → its owner seat, so Deadbolt can
// find an ADJACENT slot on the same side. Raids (no variants) call it 3-arg; the
// Circuit's Court tables pass owners so Deadbolt/Twin Red/Riptide/Onyx resolve in
// full. Base colours still drive the rules; the variant key rides in `color` and
// only adds its extra (a second phantom, a second lock, sticky undo, a double).
function resolveArchivist(slotsIn, queue, reverse, owners) {
  const slots = slotsIn.map(c => (c ? { ...c, phantom: !!c.phantom, twin: !!c.twin, locked: !!c.locked, poisoned: !!c.poisoned } : null));
  const order = reverse ? [...queue].reverse() : queue.slice();
  const history = []; // applied effects in resolution order, for Black to undo
  const log = [];
  const lockSlot = i => { if (slots[i] && !slots[i].locked) { slots[i].locked = true; return true; } return false; };
  // Deadbolt's second lock: the next slot on the SAME side, else the previous.
  // Without an owner map (raid tests) fall back to flat neighbours — never hit,
  // since raids field no variants.
  const adjacentSlot = i => {
    const own = owners ? owners[i] : null;
    const ok = j => j >= 0 && j < slots.length && (own == null || owners[j] === own);
    return ok(i + 1) ? i + 1 : ok(i - 1) ? i - 1 : -1;
  };
  // Undo the last resolved, not-yet-undone Red/Blue on slot i. White/Green shield
  // everything beneath them. Riptide is sticky: the first Black only breaks the
  // undertow to a plain swap (the trade holds); a later Black finds it again and
  // unwinds. Returns the event acted on, or null.
  const undoOnSlot = i => {
    for (let h = history.length - 1; h >= 0; h--) {
      const e = history[h];
      if (e.slot !== i || e.undone) continue;
      const b = stoneBase(e.color);
      if (b === 'white' || b === 'green') return null; // shield
      if (b === 'red') { e.undone = true; if (slots[i]) { slots[i].phantom = false; slots[i].twin = false; } return e; }
      if (b === 'blue') {
        if (e.riptide) { e.riptide = false; return e; }  // downgrade only — trade holds
        e.undone = true; const t = e.swap; const tmp = slots[i]; slots[i] = slots[t]; slots[t] = tmp; return e;
      }
    }
    return null;
  };
  // Onyx's second disruption: the latest not-yet-undone Red/Blue ANYWHERE (skip
  // the one it already handled on its own slot). Shields elsewhere are simply
  // passed over — a Black can't reach across a White/Green either.
  const undoLatestAnywhere = skip => {
    for (let h = history.length - 1; h >= 0; h--) {
      const e = history[h];
      if (e.undone || e === skip) continue;
      const b = stoneBase(e.color);
      if (b === 'red') { e.undone = true; const q = slots[e.slot]; if (q) { q.phantom = false; q.twin = false; } return e; }
      if (b === 'blue') {
        if (e.riptide) { e.riptide = false; return e; }
        e.undone = true; const s = e.slot, t = e.swap; const tmp = slots[s]; slots[s] = slots[t]; slots[t] = tmp; return e;
      }
    }
    return null;
  };
  for (const p of order) {
    const s = p.slot, base = stoneBase(p.color);
    const rec = { color: p.color, slot: s, swap: p.swap, by: p.by, fizzled: false };
    if (base === 'white') {
      const locked = [];
      if (lockSlot(s)) locked.push(s);
      if (p.color === 'deadbolt') { const j = adjacentSlot(s); if (j >= 0 && lockSlot(j)) locked.push(j); }
      // File a shield entry for EACH slot locked, so Black is blocked on either.
      if (locked.length) for (const q of locked) history.push({ slot: q, color: p.color, undone: false });
      else rec.fizzled = true;
    } else if (base === 'red') {
      if (slots[s] && !slots[s].locked && !slots[s].phantom) {
        slots[s].phantom = true; slots[s].twin = (p.color === 'twinred'); // Twin Red fields two phantoms
        history.push({ slot: s, color: p.color, undone: false });
      } else rec.fizzled = true;
    } else if (base === 'green') {
      // Poison: voids the card in the slot. A White lock shields it; like White it
      // cannot be undone (Black can't pull a Green).
      if (slots[s] && !slots[s].locked && !slots[s].poisoned) { slots[s].poisoned = true; history.push({ slot: s, color: p.color, undone: false }); }
      else rec.fizzled = true;
    } else if (base === 'blue') {
      const t = p.swap;
      if (slots[s] && slots[t] && !slots[s].locked && !slots[t].locked) {
        const tmp = slots[s]; slots[s] = slots[t]; slots[t] = tmp;
        history.push({ slot: s, color: p.color, swap: t, undone: false, riptide: (p.color === 'riptide') });
      } else rec.fizzled = true;
    } else if (base === 'black') {
      const e1 = undoOnSlot(s);                                    // last on this slot
      const e2 = (e1 && p.color === 'onyx') ? undoLatestAnywhere(e1) : null; // Onyx: a second, anywhere
      if (!e1 && !e2) rec.fizzled = true;
    }
    log.push(rec);
  }
  return { slots, log };
}
// Global slot index → owner seat, for the Court/Archivist resolution engine.
function archSlotOwners() { const out = []; for (let o = 0; o < G.nPlayers; o++) for (let pos = 0; pos < archFP(o); pos++) out.push(o); return out; }

// ---- The Archivist live adapter (inverted loop) ----
// Slots are fixed POSITIONS. Both sides queue stones onto empty slots first
// (blind to the cards that will fill them), THEN commit cards into the slots,
// reading the open queue. Nothing fires until the ledger resolves — in
// placement order, or REVERSE on Hardcore. A global slot index is the seat's
// footprint offset + local position, stable all hand (footprints are fixed).
function archFP(o) { return footprintOf(o); }
// Slot model generalized to any seat count: a global slot index is the running
// footprint offset of seat o plus the local position. Used by both the Archivist
// raid (3 seats) and the stone-first venue (2-4 seats).
function archOffsets() { const off = {}; let acc = 0; for (let s = 0; s < G.nPlayers; s++) { off[s] = acc; acc += archFP(s); } return off; }
function archGlobal(o, pos) { return archOffsets()[o] + pos; }
function archLocal(gi) { const off = archOffsets(); for (let o = G.nPlayers - 1; o >= 0; o--) if (gi >= off[o]) return { o, pos: gi - off[o] }; return { o: 0, pos: gi }; }
function archOwnerOfSlot(gi) { return archLocal(gi).o; }
function archCardAt(gi) { const { o, pos } = archLocal(gi); return G.players[o].board[pos] || null; }
// The flat slot array the engine reads, built from board positions (null = empty).
function archFlatSlots() {
  const flat = [];
  for (let o = 0; o < G.nPlayers; o++) { const b = G.players[o].board; for (let pos = 0; pos < archFP(o); pos++) flat.push(b[pos] || null); }
  return flat;
}
function archSlotLabel(gi) {
  const { o, pos } = archLocal(gi);
  const nm = slotName(pos, archFP(o)) || `slot ${pos + 1}`;
  return `${playerName(o)} · ${nm}`;
}
// Stones queued onto a slot — used to paint the slot frame (empty or filled).
function archPendingOn(gi) {
  const out = [];
  for (const p of G.archQueue) {
    if (p.resolved) continue; // already fired in the playout — its real effect now shows
    // `color` is the base colour (CSS class / blue-pair test); `key` keeps the
    // variant for the tooltip name. For a Blue (a swap), carry the partner slot.
    const base = stoneBase(p.color);
    if (p.slot === gi) out.push({ color: base, key: p.color, by: p.by, other: base === 'blue' ? p.swap : null });
    else if (base === 'blue' && p.swap === gi) out.push({ color: 'blue', key: p.color, by: p.by, other: p.slot });
  }
  return out;
}
// A slot is a legal Black target if a Red or Blue is queued onto it (Black undoes
// the last resolved Red/Blue on its slot — never a White, which is untouchable).
// Reverse order (Archivist Hardcore / the Crucible) flips this: later-placed
// stones resolve FIRST, so a Black may be set down before the Red/Blue it will
// catch — any slot is fair game, and it simply fizzles if nothing lands there.
function archBlackableSlot(gi) {
  if (archReverse()) return true;
  return G.archQueue.some(p => { const b = stoneBase(p.color); return (b === 'red' || b === 'blue') && p.slot === gi; });
}
// Which slots a queued stone may legally target in the slot game — matched to
// normal play so the rules don't change just because resolution inverts:
// White/Red protect or buff YOUR OWN cards, Green poisons a RIVAL's, Blue swaps
// any two slots, Black undoes a Red/Blue on a slot.
function archStoneTargetable(color, gi) {
  const b = stoneBase(color); // variant keys (deadbolt/twinred/riptide/onyx) target by their base
  if (b === 'blue') return true;
  if (b === 'black') return archBlackableSlot(gi);
  const mine = teamOf(archOwnerOfSlot(gi)) === teamOf(G.viewer);
  if (b === 'green') return !mine; // poison is offensive — a rival's slot only
  return mine;                     // White / Red act on your own side
}
function archQueueStone(actor, color, slot, swap) {
  const rec = { color, by: actor, slot }; // color may be a variant key
  if (stoneBase(color) === 'blue') rec.swap = swap;
  G.archQueue.push(rec);
  SFX.play('stone');
  const st = getStone(color);
  const lab = stoneBase(color) === 'blue' ? `${archSlotLabel(slot)} ⇄ ${archSlotLabel(swap)}` : archSlotLabel(slot);
  log(`${playerName(actor)} ${verb(actor, 'queue')} a ${st.name} on ${lab}. It waits in the ledger.`, logClass(actor));
  announce(`${st.name} queued — ${lab}`, stoneBase(color), actor);
  render();
}
// Per-seat scores from a resolved flat-slot array (by slot range, not by card —
// a swapped card scores for whoever's slots it ends up in). The boss scores its
// two best hands; everyone else their single best.
function archSeatScores(resolvedSlots) {
  const opts = variantOpts();
  const cardsOf = o => { const off = archOffsets()[o]; const cs = []; for (let pos = 0; pos < archFP(o); pos++) { const c = resolvedSlots[off + pos]; if (c) cs.push({ type: c.type, hasRed: !!c.phantom, phantoms: c.phantom ? (c.twin ? 2 : 1) : 0, poisoned: !!c.poisoned }); } return cs; };
  return G.players.map(p => (isTwoHandFoe(p.idx) ? twoBestHands : bestSelection)(cardsOf(p.idx), G.region.values, opts).score);
}
// What `who` is playing to maximize: own side's total minus the best rival side's.
// Team-agnostic, so it serves the raid (party vs boss) and the venue (per-seat /
// per-team) alike.
function archObjective(who, resolvedSlots) {
  const s = archSeatScores(resolvedSlots);
  const teams = [...new Set(G.players.map(p => teamOf(p.idx)))];
  const teamSum = t => G.players.filter(p => teamOf(p.idx) === t).reduce((a, p) => a + s[p.idx], 0);
  const myTeam = teamOf(who);
  const rivals = teams.filter(t => t !== myTeam).map(teamSum);
  return teamSum(myTeam) - (rivals.length ? Math.max(...rivals) : 0);
}
// AI stone placement onto EMPTY slots (no cards yet, so this is positional):
// lock/build your own slots, swap one of yours for an opponent's, undo a
// contested stone. The real skill is in the commit (archAiCommit), which reads
// the queue with full card knowledge.
function archAiPlaceSlots(who) {
  const p = G.players[who];
  if (!p.active.length) return;
  const color = p.active[0], base = stoneBase(color); // color may be a variant key; place it by its base
  const ownSlots = []; for (let pos = 0; pos < archFP(who); pos++) ownSlots.push(archGlobal(who, pos));
  const oppSeats = opponentsOf(who);
  const oppSlots = oppSeats.flatMap(o => { const a = []; for (let pos = 0; pos < archFP(o); pos++) a.push(archGlobal(o, pos)); return a; });
  const queuedAny = gi => G.archQueue.some(q => q.slot === gi || (stoneBase(q.color) === 'blue' && q.swap === gi));
  const hasColor = (gi, c) => G.archQueue.some(q => q.slot === gi && stoneBase(q.color) === c);
  let slot = null, swap;
  if (base === 'white' || base === 'red') {
    slot = ownSlots.find(gi => !hasColor(gi, base)) ?? ownSlots[0];
  } else if (base === 'green') {
    // The Crucible's poison: drop it on an opponent slot not already poisoned/locked.
    slot = oppSlots.find(gi => !hasColor(gi, 'green') && !hasColor(gi, 'white')) ?? oppSlots[0];
  } else if (base === 'blue') {
    slot = ownSlots.find(gi => !queuedAny(gi)) ?? ownSlots[ownSlots.length - 1];
    swap = oppSlots.find(gi => !G.archQueue.some(q => stoneBase(q.color) === 'blue' && (q.slot === gi || q.swap === gi))) ?? oppSlots[0];
  } else { // black
    slot = oppSlots.find(gi => archBlackableSlot(gi)) ?? ownSlots.find(gi => archBlackableSlot(gi));
    if (slot == null) { consumeActive(who, color); log(`${playerName(who)} sets a Black Stone down — nothing queued to undo. It passes.`, 'ai'); return; }
  }
  consumeActive(who, color);
  archQueueStone(who, color, slot, swap);
}
// AI card commitment: greedily slot each card where it most helps this side,
// resolving the open queue with full card knowledge. (Greedy per card.)
function archAiCommit(seat, count, faceUp) {
  const p = G.players[seat];
  const reverse = archReverse();
  const subRate = isMagistrate(seat) ? archSub() : 0; // the boss occasionally takes its 2nd-best
  for (let n = 0; n < count && p.hand.length; n++) {
    const emptyPos = []; for (let pos = 0; pos < archFP(seat); pos++) if (!p.board[pos]) emptyPos.push(pos);
    if (!emptyPos.length) break;
    let best = null, second = null;
    for (const card of p.hand) {
      for (const pos of emptyPos) {
        p.board[pos] = card;
        const v = archObjective(seat, resolveArchivist(archFlatSlots(), G.archQueue, reverse, archSlotOwners()).slots);
        p.board[pos] = null;
        if (!best || v > best.v) { second = best; best = { v, card, pos }; }
        else if (!second || v > second.v) second = { v, card, pos };
      }
    }
    if (subRate && second && rnd() < subRate) best = second;
    if (fumbles(seat)) { best.card = p.hand[Math.floor(rnd() * p.hand.length)]; best.pos = emptyPos[Math.floor(rnd() * emptyPos.length)]; }
    p.board[best.pos] = best.card;
    best.card.zone = 'board'; best.card.faceUp = faceUp;
    if (faceUp) best.card.known = best.card.known.map(() => true);
    p.hand.splice(p.hand.indexOf(best.card), 1);
  }
  SFX.play(faceUp ? 'flip' : 'card');
  log(`${playerName(seat)} ${verb(seat, 'fill')} ${count} slot${count === 1 ? '' : 's'}${faceUp ? '' : ', face-down'}.`, logClass(seat));
  announce(`${playerName(seat)} commits to the slots`, null, seat);
}
// Write an engine-resolved flat-slot state onto the live boards: phantoms/locks
// onto the real cards, re-seated by slot position. Used per animation frame and
// for the final state, so every frame is exactly what the tested engine says.
function archWriteState(slots) {
  const realById = {}; for (const c of G.cards) realById[c.id] = c;
  const nb = {}; for (let o = 0; o < G.nPlayers; o++) nb[o] = new Array(archFP(o)).fill(null);
  slots.forEach((clone, gi) => {
    if (!clone) return;
    const { o, pos } = archLocal(gi);
    const c = realById[clone.id];
    c.stones = c.stones.filter(s => s.color !== 'white' && s.color !== 'red' && s.color !== 'green');
    if (clone.phantom) c.stones.push({ color: 'red', by: o, twin: !!clone.twin }); // twin → two phantoms score
    if (clone.locked) c.stones.push({ color: 'white', by: o });
    if (clone.poisoned) c.stones.push({ color: 'green', by: 1 });
    c.owner = o;
    nb[o][pos] = c;
  });
  for (let o = 0; o < G.nPlayers; o++) G.players[o].board = nb[o];
}
// Begin the animated playout: snapshot the committed board, fix the resolution
// order, and expand the queue into one visible step per stone (with beats to
// absorb), then a finalize. Each step replays the tested engine on a longer
// prefix, so the shown transformation is always engine-true.
function archResolveBegin() {
  const reverse = archReverse();
  G.archSnapshot = archFlatSlots();
  G.archResOrder = reverse ? [...G.archQueue].reverse() : G.archQueue.slice();
  log(`${isArchivist() ? 'The Archivist reads the ledger' : 'The writ is read'} ${reverse ? 'back to front — last placed fires first' : 'in placement order'}. The stones fire:`, 'sys');
  const steps = [];
  for (let k = 1; k <= G.archResOrder.length; k++) { steps.push({ t: 'archstep', k }); steps.push({ t: 'beat', ms: 850 }); }
  steps.push({ t: 'archfinal' });
  G.queue.unshift(...steps);
}
// Show the board after the first k stones have fired (engine-resolved prefix),
// highlight the slot(s) that just changed, and narrate fire/fizzle.
function archShowStep(k) {
  const rec = G.archResOrder[k - 1];
  const r = resolveArchivist(G.archSnapshot, G.archResOrder.slice(0, k), false, archSlotOwners());
  archWriteState(r.slots);
  rec.resolved = true; // its pending marker clears; the real effect now shows
  const fizzled = r.log[k - 1] && r.log[k - 1].fizzled;
  const base = stoneBase(rec.color), st = getStone(rec.color);
  const lab = base === 'blue' ? `${archSlotLabel(rec.slot)} ⇄ ${archSlotLabel(rec.swap)}` : archSlotLabel(rec.slot);
  log(`  ${st.name} on ${lab} — ${fizzled ? 'fizzles, nothing to bind' : 'takes hold'}.`, fizzled ? 'sys' : logClass(rec.by));
  announce(`${st.name} ${fizzled ? 'fizzles' : 'fires'} — ${lab}`, base, rec.by);
  const ids = []; const a = archCardAt(rec.slot); if (a) ids.push(a.id);
  if (base === 'blue') { const b = archCardAt(rec.swap); if (b) ids.push(b.id); }
  UI.flashIds = ids;
  SFX.play(base === 'black' ? 'undo' : 'stone');
  render();
}
function archResolveFinal() {
  archWriteState(resolveArchivist(G.archSnapshot, G.archResOrder, false, archSlotOwners()).slots);
  for (let o = 0; o < G.nPlayers; o++) G.players[o].board = G.players[o].board.filter(Boolean);
  G.archivist = false; G.archSnapshot = null;
  UI.flashIds = G.players.flatMap(p => p.board).map(c => c.id);
  announce(`The order resolves ${archReverse() ? 'in reverse' : 'in placement order'}`, null, isArchivist() ? 1 : G.viewer);
  render();
}

// The Magistrate's score: the two best non-overlapping three-card
// hands from its board. We try every split of the cards into two
// groups (bitmask) and let bestSelection optimize each group's best
// three units (phantoms included); the best summed pair of hands wins.
function twoBestHands(cards, values, opts) {
  const n = cards.length;
  const empty = { score: 0, raw: 0, bonus: 0, penalty: 0, structure: 'singles', picks: [] };
  if (n < 6) { // not enough to field two full hands — score the one best
    const h = bestSelection(cards, values, opts);
    return { score: h.score, hands: [h, empty] };
  }
  // A scoring hand uses at most 3 physical cards (2 if one carries a
  // phantom). Try every 2- or 3-card group as hand A; hand B is the
  // best three of whatever's left. This is exact and far cheaper than
  // a full 2^n partition.
  let best = null;
  const tryA = combo => {
    const A = combo.map(i => cards[i]);
    const rest = cards.filter((_, i) => !combo.includes(i));
    const ha = bestSelection(A, values, opts);
    const hb = bestSelection(rest, values, opts);
    const total = ha.score + hb.score;
    if (!best || total > best.score) {
      const [h1, h2] = ha.score >= hb.score ? [ha, hb] : [hb, ha];
      best = { score: total, hands: [h1, h2] };
    }
  };
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      tryA([a, b]);
      for (let c = b + 1; c < n; c++) tryA([a, b, c]);
    }
  }
  return best || { score: 0, hands: [empty, empty] };
}

const STRUCT_RANK = { triad: 2, pair: 1, singles: 0 };
const STRUCT_LABEL = { triad: 'a Triad', pair: 'a Pair', singles: 'three Singles' };

/* ---------------- Game state ---------------- */

let G = null;
let UI = { mode: 'idle', selected: [], pendingStone: null, blueOwn: null, flashIds: [] };
let runTimer = null;

const TEAM_MODES = new Set(['teams', 'hs-team', 'hs-rivals']);

function newGame(cfg) {
  clearTimeout(runTimer);
  INGAME = true;
  // A new non-Circuit match abandons any Circuit run outright: reset its seeded
  // RNG (else a run's seed leaks into this match's deals), drop GAUNTLET.active,
  // and hide the Standing HUD — starting from the in-match Menu skips showTitle,
  // which is the only other place that did this.
  if (!cfg.gauntlet) {
    clearRng();
    if (typeof GAUNTLET !== 'undefined') GAUNTLET.active = false;
    if (typeof document !== 'undefined' && $('circuitHud')) $('circuitHud').style.display = 'none';
  }
  clearSuddenFlash();
  hideTitle();
  const raid = cfg.mode === 'raid';
  if (typeof Music !== 'undefined') Music.setTrack(raid ? 'boss' : 'menu'); // boss raids get their own theme; standard play keeps the menu loop unbroken
  const n = raid ? 3 : seatCountOf(cfg.mode);
  const cfgHumans = raid ? null : (cfg.humans || humansFor(cfg.mode));
  const venue = VENUES[cfg.venue || 'tavern'];
  G = {
    mode: cfg.mode,                 // 'duel' | 'ffa' | 'teams' | 'hotseat… | 'raid' | 'coop'
    coop: cfg.mode === 'coop',      // the Circuit 2v1: you (0) + a recruited ally (2) vs one strong foe (1)
    venueKey: cfg.venue || 'tavern', // remembered so a paused match can restore its backdrop on resume
    gauntlet: !!cfg.gauntlet,        // a rung of The Circuit — its own end-handling, never a resumable match
    deal: raid ? (cfg.raidBoss === 'crucible' ? 'house' : 'small') : cfg.deal, // the Crucible forces the deep draw
    target: cfg.target,
    venue,
    variant: raid ? null : venue.variant,
    raidBoss: raid ? (cfg.raidBoss || 'magistrate') : null,
    // Stone exhaustion: Slumlock venue = 2 hands; the Warden raid = 1.
    exhaustHands: raid ? (cfg.raidBoss === 'warden' || cfg.raidBoss === 'crucible' ? 1 : 0) : (venue.variant === 'slumlock' ? 2 : 0),
    open: cfg.targeting === 'open' || (raid && (cfg.raidBoss === 'archivist' || cfg.raidBoss === 'crucible')), // advanced forced for the slot bosses (cross-layout slot war)
    archivist: false, // The Archivist: true only during its deferred placement phase
    archQueue: [],    // ordered slot placements awaiting resolution
    cardsOnly: !!cfg.cardsOnly, // Academy Lesson 1: cards with no stone phases
    fixedHands: cfg.fixedHands || null, // Academy: seat -> [card types] for deterministic teaching hands
    fixedPool: cfg.fixedPool || null,   // Academy: seat -> stone pool override
    demoStone: cfg.demoStone || null,   // Academy stone lesson: the one stone you place
    demoOpp: cfg.demoOpp || null,       // Academy: a stone the Stranger plays first (for the Black lesson)
    cursedType: null,
    region: REGIONS[raid ? 'bar' : (cfg.region || venue.region)],
    nPlayers: n,
    names: raid
      ? (cfg.raidAlly === 'hotseat'
          ? [((cfg.names || [])[0] || 'Player One'), raidBossName(cfg.raidBoss), ((cfg.names || [])[1] || 'Player Two')]
          : ['You', raidBossName(cfg.raidBoss), cfg.allyBot || 'The Old Hand'])
      : buildNames(cfg.mode, cfgHumans, cfg.names || [], cfg.companyNames || null),
    humans: raid ? (cfg.raidAlly === 'hotseat' ? [0, 2] : [0]) : cfgHumans,
    viewer: 0,
    raidDiff: raid ? (cfg.raidDiff || 'standard') : null,
    ledger: 0,                      // duel/teams: positive = your side
    scores: new Array(n).fill(0),   // ffa: banked margins
    dealer: Math.floor(rnd() * n),
    handNum: 0,
    over: false,
    players: null,
    queue: [],
    events: [],
    cards: [],
  };
  G.slum = Array.from({ length: n }, () => []); // Slumlock exhaustion ledger
  buildTableDOM();
  setVenueBackdrop(cfg.venue || 'tavern');
  const fmt = G.mode === 'duel' ? 'a quiet duel' : G.mode === 'ffa' ? 'a four-seat free-for-all' : 'paired alliances, two against two';
  const dl = G.deal === 'house' ? 'House deep-draft deal, nine cards down' : 'small-game deal, five cards down';
  if (cfg.drewLots) {
    log(`Lots are drawn for the seats: ${botSeatsOf(cfg.mode, cfgHumans).map(s => G.names[s]).join(', ')} sit down at the table.`, 'sys');
  }
  const variantNote = {
    riverlock: ' Riverlock is declared: no Road or Ferry in your final three, and the hand is docked 2.',
    cursed: ' The Cursed Register is declared: each hand, one card type is voided entirely.',
    slumlock: ' Slumlock is declared: a stone placed this hand is exhausted for the two that follow.',
    gauntlet: ' The Gauntlet: no telegraphing or thinning — every player holds one of each stone and places all four in serpentine order.',
    precedence: ' The Writ of Precedence is declared: stones are placed first, onto the empty slots, then cards fill the slots — and the stones resolve in the order they were placed.',
  }[G.variant] || '';
  if (G.mode === 'raid' && isCrucible()) {
    const bn = playerName(1);
    log(`${bn} — the Crucible. Every trial at once: the inverted slot order resolved BACK TO FRONT, one stone-colour locked from the whole table each hand, every stone exhausted for a hand, a deep draw, advanced targeting forced — and a single Green scalpel the boss may bury anywhere. It opens ${bossCardCount()} cards and queues ${archStones()} stones — ${archCfg().green} of them Green scalpels, immune to the colour-denial; the party places ${archParty()} each. Break it if you can.`, 'sys');
  } else if (G.mode === 'raid' && G.raidBoss === 'archivist') {
    const bn = playerName(1);
    log(`${bn} takes the high seat — a ${archCfg().label} raid. The order is inverted: both sides commit their layouts, then place stones onto the SLOTS — they do not fire as they land. ${playerName(0)} and ${playerName(2)} field five cards and three stones each; ${bn} opens ${bossCardCount()} cards face-up and queues ${archStones()} stones. When all are down, the ledger resolves ${archReverse() ? 'BACK TO FRONT — last placed fires first' : 'in placement order'}. Read the queue, commit your cards around it. It scores its two best hands; your party scores both of yours combined. Drive the marker ${G.target} to break it — it holds any tie.`, 'sys');
  } else if (G.mode === 'raid') {
    const bn = playerName(1);
    log(`${bn} takes the high seat — a ${raidDiff().label} raid. ${playerName(0)} and ${playerName(2)} field five cards and three stones each; ${bn} fields ${RAID_BOSS_CARDS} cards, all face-up, selects from a deep pouch (3 of each), and spends ${raidDiff().stones} stones — answering every move and keeping the last word.${G.exhaustHands ? ` Every stone the party spends is exhausted for ${G.exhaustHands} hand${G.exhaustHands === 1 ? '' : 's'} — the Warden's own pouch stays full.` : ''}${isQuartermaster() ? ' Each hand it locks away one stone-colour from the whole table, cycling red → white → blue → black — so you can never lean on a favourite.' : ''} It scores its two best hands; your party scores both of yours combined. Drive the marker ${G.target} to break it — it holds any tie.`, 'sys');
  } else if (G.gauntlet) {
    // The Circuit decides by Standing depletion, not the ledger (target is a
    // sentinel so the ledger never ends it) — don't leak the 999.
    log(`A table is set at ${G.venue.label} — ${fmt}, ${dl}, under ${G.region.name}.${variantNote} Press your foe's Standing to zero before they press yours.`, 'sys');
  } else {
    log(`A table is set at ${G.venue.label} — ${fmt}, ${dl}, under ${G.region.name}.${variantNote} ${G.mode === 'ffa'
      ? `Each showdown, every seat banks its margin over the lowest hand; first to ${G.target} takes the match.`
      : `First to push the Ledger Stone ${G.target} onto the other side takes the match.`}`, 'sys');
  }
  startHand();
}

// Seat-by-seat names: humans take entered names in seat order; bots take
// the roster (in teams, the seat partnered with seat 0 is the Old Hand).
// Seats alternate teams: {0,2} vs {1,3}.
function buildNames(shape, humans, entered, company) {
  const n = seatCountOf(shape);
  const base = new Array(n);
  const botSeats = [];
  let hi = 0;
  for (let s = 0; s < n; s++) {
    if (humans.includes(s)) {
      const nm = (entered[hi] || '').trim();
      base[s] = nm || (humans.length > 1 ? `Player ${hi + 1}` : 'You');
      hi++;
    } else botSeats.push(s);
  }
  const roster = [...AI_ROSTER];
  for (const s of botSeats) {
    base[s] = (shape === 'teams' && s === 2) ? PARTNER_NAME : (roster.shift() || 'The Stranger');
  }
  if (company) botSeats.forEach((seat, i) => { if (company[i]) base[seat] = company[i]; });
  return base;
}

function humansFor(mode) {
  if (mode === 'hotseat' || mode === 'hs-rivals') return [0, 1];
  if (mode === 'hs-team') return [0, 2];
  return [0];
}

function playerName(i) { return G.names[i]; }
function isHuman(i) { return G.humans.includes(i); }
function teamOf(i) {
  if (G.mode === 'raid' || G.mode === 'coop') return i === 1 ? 1 : 0; // the lone foe vs your side (you + ally)
  return TEAM_MODES.has(G.mode) ? i % 2 : i;
}
function isOpponent(a, b) { return teamOf(a) !== teamOf(b); }
function opponentsOf(me) {
  return G.players.map(p => p.idx).filter(i => isOpponent(me, i));
}
function alliesOf(me) {
  return G.players.map(p => p.idx).filter(i => i !== me && !isOpponent(me, i));
}

function dealSpec() {
  return G.deal === 'house'
    ? { handSize: 9, footprint: 5, deploys: [{ c: 2, up: true }, { c: 2, up: false }, { c: 1, up: false }] }
    : { handSize: 5, footprint: 4, deploys: [{ c: 2, up: true }, { c: 1, up: false }, { c: 1, up: false }] };
}

// Raid Boss: seat 1 is The Magistrate, who fields a larger board, all
// face-up, and scores its two best non-overlapping three-card hands.
// Card/stone counts are tuned for a hard-but-winnable fight.
const RAID_BOSS_CARDS = 7;
// Raids are a fixed-length trial (no picking a lucky short race) — uniform across
// the campaign so the tuned win-rates are honest and unlocks mean the same thing.
const RAID_TARGET = (typeof process !== 'undefined' && process.env.RAID_TARGET) ? +process.env.RAID_TARGET : 15;
// Sudden death: a raid dragging past this many hands escalates the marker swing
// each hand toward whoever's ahead, so a stalemate resolves fast instead of
// grinding on (a battery put the median win at 10 hands, the slow tail at 30–45).
// Not a punishment — the better side still wins, just sooner. Uniform for every boss.
const RAID_SUDDEN_DEATH = (typeof process !== 'undefined' && process.env.RAID_SUDDEN) ? +process.env.RAID_SUDDEN : 20;
// Difficulty = how many stones the Magistrate spends, and the swing
// order it spends them in (it always closes with the last word).
// Party places three stones each (seats 0, 2); the boss 5/6/7.
// Measured vs a greedy team: easy ~70%, standard ~50%, hard ~25%.
const RAID_DIFFS = {
  easy:     { stones: 5, label: 'Easy',     order: [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1] },
  standard: { stones: 6, label: 'Standard', order: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1] },
  hard:     { stones: 7, label: 'Hardcore', order: [1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1] },
};
function raidDiff() { return RAID_DIFFS[G.raidDiff] || RAID_DIFFS.standard; }
// Per-hand "holds back" roll: on specific tiers that ran too hard, the
// boss occasionally spends one fewer stone, blending toward the next
// stone count down. Scoped by boss+difficulty so other tiers are
// untouched. (A die-roll that eases only where it's needed.)
const envNum = (k, d) => (typeof process !== 'undefined' && process.env[k] !== undefined) ? +process.env[k] : d;
const RAID_HOLDBACK = {
  'magistrate-hard': envNum('MAG_HARD_HB', 0.45), // eased toward ~30% at the locked target-15
  'warden-standard': envNum('WAR_STD_HB', 0.3),   // ~44% party (was ~37)
  'warden-hard': envNum('WAR_HARD_HB', 0.75),     // party-only exhaustion makes 7 stones brutal (~7%); hold back to ~30
  // The Apothecary's cut is worth far more than one stone, so it spends several
  // fewer regular ones (APOTH_DROP_BY_DIFF) and these hold-backs fine-tune the
  // tiers: measured ~easy 70% / standard ~55% / hardcore ~25% vs competent,
  // white-aware party bots. Tunable by play.
  'apothecary-easy': envNum('APO_EASY_HB', 0.4),
  'apothecary-hard': envNum('APO_HARD_HB', 0.45),
};
const APOTH_DROP_BY_DIFF = { easy: 3, standard: 4, hard: 4 };
function apothDrop() { return envNum('APOTH_DROP', APOTH_DROP_BY_DIFF[G.raidDiff] ?? 4); }
// The Quartermaster's colour-denial actually eases the boss (it cripples its
// two-best building more than the party's single hand), so it carries a few EXTRA
// stones — a probabilistic per-hand bonus that brings its tiers in line with the
// other bosses (~easy 70 / standard 50 / hard 25-30). Reverse of a hold-back.
const QM_BONUS = { easy: envNum('QM_E_BONUS', 0.45), standard: envNum('QM_S_BONUS', 0.2), hard: envNum('QM_H_BONUS', 0) };
// The Archivist (4th boss): inverted flow — stones queue onto SLOTS, then
// resolve in placement order (Easy/Standard) or REVERSE (Hardcore). Board size
// is the difficulty lever (validated in tests/archivist-balance.js): Easy 7
// cards / Standard+Hard 8. Hard reuses Standard's stone budget + reverse only.
// Tuned against the LIVE all-AI race (not the synthetic single-hand harness):
// board size is a steep lever (8 cards crushes the party, 6 is a pushover), so
// every tier fields 7 and the stone budget + a probabilistic hold-back fine-tune
// the curve. Measured ~Easy 70% / Standard 50% / Hardcore 45%.
// Difficulty ladder, tuned on the LIVE all-AI race in the CORRECT inverted flow
// (stones blind onto empty slots, then cards). Board size is a cliff (6 cards
// ≈95% party, 7 ≈48-62%, 8 crushes), so every tier fields 7 and the stone
// budget carries the gradient; REVERSE (Hardcore) is the real teeth — it breaks
// the party's forward-order reads. Measured ~Easy 62% / Standard 48% / Hard 34%.
// Difficulty scales by resources, like the other bosses: boss stone budget, and
// — since the Archivist's blind stones plateau — the PARTY's stone count (Easy
// hands the party extra). `sub` = how often the boss commits its 2nd-best
// card→slot; counter-intuitively this STRENGTHENS the boss (its greedy commit is
// myopic, so the 2nd choice dodges greedy traps), a fine downward dial on party
// win. Hardcore adds REVERSE resolution.
const ARCH_DIFFS = {
  easy:     { cards: envNum('ARCH_E_C', 7), stones: envNum('ARCH_E_S', 3), party: envNum('ARCH_E_P', 5), sub: 0,   reverse: false, label: 'Easy' },
  standard: { cards: envNum('ARCH_S_C', 7), stones: envNum('ARCH_S_S', 6), party: envNum('ARCH_S_P', 3), sub: 0.15, reverse: false, label: 'Standard' },
  hard:     { cards: envNum('ARCH_H_C', 7), stones: envNum('ARCH_H_S', 6), party: envNum('ARCH_H_P', 2), sub: 0,   reverse: true,  label: 'Hardcore' },
};
function archParty() { return archCfg().party || 3; }
function archSub() { return envNum('ARCH_SUB', archCfg().sub || 0); }
function archHoldback() { return envNum('ARCH_HB', archCfg().hold ?? 0); }
function isArchivist() { return G.mode === 'raid' && G.raidBoss === 'archivist'; }
// The Crucible super boss: every layer at once — the Archivist's inverted slot
// loop resolved in REVERSE, colour-denial each hand, one-hand exhaustion, a lone
// Green stone for the boss, deep draw + forced advanced. One difficulty.
function isCrucible() { return G.mode === 'raid' && G.raidBoss === 'crucible'; }
const CRUCIBLE = { cards: envNum('CRU_C', 9), foot: envNum('CRU_F', 4), hand: envNum('CRU_H', 9), stones: envNum('CRU_S', 7), party: envNum('CRU_P', 3), green: envNum('CRU_G', 2), sub: envNum('CRU_SUB', 0), reverse: true, label: 'The Crucible' };
// The Court of Precedence venue: the Archivist's stone-first inverted loop as a
// normal-table house rule (forward resolution, any seat count).
function isStoneFirst() { return G.variant === 'precedence'; }
function isSlotMode() { return isArchivist() || isCrucible() || isStoneFirst(); }
// Placement/declare order: round the table, the boss answering and keeping the
// last word(s). Party places 3 each; the boss archStones(). (Matches the order
// the balance battery was tuned against.)
function archPlaceOrder(bossN, partyN) {
  const order = [];
  const pn = (partyN == null ? archParty() : partyN);
  let pa = pn, pb = pn, bs = (bossN == null ? archStones() : bossN);
  while (pa + pb + bs > 0) {
    if (pa > 0) { order.push(0); pa--; }
    if (bs > 0) { order.push(1); bs--; }
    if (pb > 0) { order.push(2); pb--; }
    if (bs > 0 && (pa + pb) > 0) { order.push(1); bs--; }
  }
  return order;
}
function archCfg() { return isCrucible() ? CRUCIBLE : (ARCH_DIFFS[G.raidDiff] || ARCH_DIFFS.standard); }
function archStones() { return archCfg().stones; }
function archReverse() { return (isArchivist() || isCrucible()) && !!archCfg().reverse; } // reverse: Archivist Hardcore + the Crucible
function bossCardCount() { return (isArchivist() || isCrucible()) ? archCfg().cards : RAID_BOSS_CARDS; }
function raidBossName(boss) { return boss === 'warden' ? 'The Warden' : boss === 'apothecary' ? 'The Apothecary' : boss === 'archivist' ? 'The Archivist' : boss === 'quartermaster' ? 'The Quartermaster' : boss === 'crucible' ? 'The Crucible' : 'The Magistrate'; }
function isMagistrate(seat) { return G.mode === 'raid' && seat === 1; }
// The Circuit 2v1: the lone foe (seat 1) is braced against two of you, so it
// fields a bigger board and scores its TWO best hands — like a raid boss, but
// decided by Standing, not the campaign ledger.
const COOP_FOE_CARDS = 10;
// The 2v1 foe is boss-tier and tuned HARD on purpose: by the Act 2/3 reunion you
// carry relics and modded cards, so a vanilla foe would play easy — its raw
// strength is meant to be pulled back toward even by your accumulated leverage.
// Its difficulty is SCORING leverage (a developed deck + Triad/Pair charms), not
// theft: a structure-leaning pouch (and the 2-stone-per-hand cap) keep it from
// stripping the very build that's supposed to carry you.
const COOP_FOE_FX = ['keen', 'anchor', 'lodestone', 'drain', 'keen', 'anchor']; // modifiers laid over its persona deck
const COOP_FOE_CHARMS = ['forgerseal', 'masterforger', 'matchedset'];            // Pairs/Triads +1, Triads +3, Pairs +3
const COOP_FOE_POUCH = { red: 2, black: 2, white: 1, blue: 1 };                  // phantom/tempo lean; little theft
function isCoopFoe(seat) { return G.coop && seat === 1; }
function isTwoHandFoe(seat) { return isMagistrate(seat) || isCoopFoe(seat); }
// The Quartermaster rations the pouch: each hand one stone-colour is locked away
// from EVERYONE (party and boss), cycling red→white→blue→black hand by hand —
// you can't lean on a favourite. Also folded into the Crucible.
function isQuartermaster() { return G.mode === 'raid' && G.raidBoss === 'quartermaster'; }
function deniedColor() { return (isQuartermaster() || isCrucible()) ? STONE_KEYS[(G.handNum - 1) % STONE_KEYS.length] : null; }
// Crucible's Mark chit: the colour rationed from the player this hand (cycling).
function circuitRationColor() { return (G && G.gauntlet && ccfg('ration')) ? STONE_KEYS[(G.handNum - 1) % STONE_KEYS.length] : null; }
// The Crucible keeps the deep DRAW (9 in hand) but fields a LEAN footprint — you
// see lots, commit few — so the party can't out-score the boss on raw selection.
// Wide Board (chit): a Circuit foe fields one more card than you.
function foeWideBonus(seat) { return (G && G.gauntlet && seat !== 0 && !isCoopFoe(seat) && ccfg('foeWide')) ? 1 : 0; }
function footprintOf(seat) { return (isCoopFoe(seat) ? COOP_FOE_CARDS : isMagistrate(seat) ? bossCardCount() : (isCrucible() ? (archCfg().foot || 4) : dealSpec().footprint)) + foeWideBonus(seat); }
function handSizeFor(seat) { return (isCoopFoe(seat) ? COOP_FOE_CARDS : isMagistrate(seat) ? bossCardCount() : (isCrucible() ? (archCfg().hand || dealSpec().handSize) : dealSpec().handSize)) + foeWideBonus(seat); }


function orderFrom(start) {
  const out = [];
  for (let k = 0; k < G.nPlayers; k++) out.push((start + k) % G.nPlayers);
  return out;
}
function dealOrder() { return orderFrom((G.dealer + 1) % G.nPlayers); }

function startHand() {
  G.handNum++;
  if (G.mode === 'raid' && G.handNum === RAID_SUDDEN_DEATH + 1) flashSuddenDeath(); // the moment you cross into it
  G.events = [];
  G.cards = [];
  G.armed = false; // telegraphed stones become "spendable" once arming runs
  UI = { mode: 'idle', selected: [], pendingStone: null, blueOwn: null, flashIds: [] };
  // Reset the centre callout every hand so no prior announce — a denied colour,
  // a telegraph, even one left over from a different match — lingers beneath the
  // new prompt. Denial bosses re-announce immediately below.
  if (typeof document !== 'undefined') { const a = $('announce'); if (a) { a.innerHTML = ''; a.classList.remove('pop'); } }

  // Build the 64-card Ledger Deck, full shuffle, scale to 16 per player.
  let id = 0;
  const full = [];
  for (const t of TYPES) for (let i = 0; i < 8; i++) full.push(t);
  shuffle(full);
  const active = full.slice(0, Math.min(64, 16 * G.nPlayers));

  const spec = dealSpec();
  const gauntlet = G.variant === 'gauntlet';
  const raid = G.mode === 'raid';
  G.players = [];
  for (let p = 0; p < G.nPlayers; p++) {
    // Gauntlet: one of each, all live. Raid: the Magistrate selects its
    // stones from a deeper 3-of-each pouch; the party from the usual 2.
    let pool = { red: 2, white: 2, blue: 2, black: 2 };
    if (gauntlet) pool = { red: 1, white: 1, blue: 1, black: 1 };
    else if (raid && isMagistrate(p)) pool = { red: 3, white: 3, blue: 3, black: 3 };
    // The Circuit: each seat with a build (you AND the foe) draws a working set
    // of stones from its own Pouch each hand — a depleting stone deck (draw →
    // discard → reshuffle when dry), so thinning and added stones shift the draw.
    else if (G.gauntlet && GAUNTLET.piles && GAUNTLET.piles[p]) pool = pileDrawStones(GAUNTLET.piles[p], ccfg('drawStones') + (p === 0 ? charmVal('drawStones') : 0) + (isCoopFoe(p) ? 2 : 0) + (p !== 0 && ccfg('foeDeepPouch') ? 1 : 0));
    if (G.fixedPool && G.fixedPool[p]) pool = Object.assign({ red: 0, white: 0, blue: 0, black: 0 }, G.fixedPool[p]);
    // Exhaustion (Slumlock / Warden): recently-placed stones are still out.
    if (G.exhaustHands && !(p === 0 && G.gauntlet && charmVal('noExhaust'))) {
      // Iterate the pool's ACTUAL keys (base + variant): consumeActive records the
      // exact stone spent, so an exhausted Riptide/Twin Red must block its own key,
      // not just base colours (it was dodging Slumlock entirely).
      for (const key of Object.keys(pool)) pool[key] = Math.max(0, pool[key] - slumBlocked(p, key));
    }
    // The Quartermaster (and the super boss) lock away one colour from all this hand.
    const denied = deniedColor();
    if (denied) pool[denied] = 0;
    // The Ration (prestige chit): locks one of YOUR colours from this hand's DRAW.
    // It acts on the drawn pool, so if you didn't draw the locked colour there is
    // simply nothing to remove — no penalty that hand (only variance bites).
    const chitDenied = (p === 0) ? circuitRationColor() : null;
    if (chitDenied) for (const key of Object.keys(pool)) if (stoneBase(key) === chitDenied) pool[key] = 0;
    G.players.push({
      idx: p,
      hand: [],
      board: [],
      pool,
      declared: [],
      removed: null,
      // Pre-armed stones (no telegraph): the Circuit arms the actual drawn pouch
      // as a multiset of its exact KEYS — base colours, variant upgrades
      // (Twin Red / Deadbolt / Riptide / Onyx), and Green all placeable, and a
      // drawn pair of the same key both live. This holds at Court (stone-first)
      // tables too: the slot engine now resolves every variant in full (see
      // resolveArchivist), so upgrades keep their power in Act 3 instead of
      // reverting to base. The gauntlet-variant venue & non-Circuit precedence
      // raids field a one-of-each base set.
      active: G.gauntlet ? Object.keys(pool).flatMap(c => Array(pool[c] || 0).fill(c))
        : (gauntlet || isStoneFirst()) ? STONE_KEYS.filter(c => pool[c] > 0) : [],
      aiPlan: null,
      forcedFirst: null,   // By the Ledger (chit): the stone locked to place first
      stonePlaced: false,  // …lifts once any stone is placed this hand
    });
    // By the Ledger: your first-DRAWN stone (that survived into the active set)
    // must be your first placement. Seat 0 only; the drawn order lives on the pile.
    if (p === 0 && G.gauntlet && ccfg('fixedOrder')) {
      const pl = G.players[p];
      const order = (GAUNTLET.piles && GAUNTLET.piles[0] && GAUNTLET.piles[0].stoneHand) || [];
      pl.forcedFirst = order.find(k => pl.active.includes(k)) || null;
    }
  }

  // The Cursed Register: one card type is drawn and voided this hand.
  if (G.variant === 'cursed') {
    G.cursedType = TYPES[Math.floor(rnd() * TYPES.length)];
    log(`The Cursed Card is drawn: every ${G.cursedType} is voided this hand — no points, no Pairs, no Triads.`, 'sys');
  }
  for (let p = 0; p < G.nPlayers; p++) {
    const fixed = G.fixedHands && G.fixedHands[p];
    // The Circuit: each seat with a build draws this hand from its own owned
    // deck — a depleting draw pile that reshuffles its discard when dry —
    // instead of the shared regional pool. Thinning cycles its bombs back faster.
    // Full Satchel (charm) draws seat 0 a larger hand — more to choose from.
    const hs = handSizeFor(p) + ((G.gauntlet && p === 0) ? charmVal('drawCards') : 0);
    const owned = (G.gauntlet && GAUNTLET.piles && GAUNTLET.piles[p]) ? pileDrawCards(GAUNTLET.piles[p], hs) : null;
    for (let k = 0; k < hs; k++) {
      const dealt = owned ? (owned[k] != null ? owned[k] : active.pop()) : active.pop();
      // Owned-deck entries may be effect cards: { type, fx }. Plain entries are
      // a bare type string. The fx rider drives the per-card value pass.
      const dealtType = (dealt && typeof dealt === 'object') ? dealt.type : dealt;
      const dealtFx = (dealt && typeof dealt === 'object') ? dealt.fx : null;
      const card = {
        id: id++,
        type: (fixed && fixed[k]) || dealtType,
        fx: dealtFx,
        owner: p,
        origOwner: p, // survives Blue swaps — drain only fires from its owner's board

        zone: 'hand',
        faceUp: false,
        stones: [],
        prov: null,
        known: G.players.map((_, i) => i === p),
      };
      G.cards.push(card);
      G.players[p].hand.push(card);
    }
  }

  const dOrd = dealOrder(), rOrd = [...dealOrder()].reverse();
  const dep = spec.deploys;
  const dealNote = { t: 'phase', label: `Hand ${G.handNum} — The Deal`, note: `${playerName(G.dealer)} hold${G.dealer === 0 ? '' : 's'} the Dealer Token. ${spec.handSize} cards each from a fresh-shuffled pool.` };

  if (raid && (G.raidBoss === 'archivist' || isCrucible())) {
    // The Archivist (and the Crucible, which reuses this inverted loop): select
    // stones → queue them onto EMPTY slots (blind) → commit cards into the slots →
    // resolve in placement order, or REVERSE (Archivist Hardcore / the Crucible).
    // The Crucible also adds a lone Green for the boss, plus colour-denial and
    // one-hand exhaustion handled in the pool build. No card plays until all stones
    // are down.
    const bn = playerName(1);
    const bc = bossCardCount();
    const dir = archReverse() ? 'back to front — last placed, first to fire' : 'in the order they were placed';
    const bossN = archStones() - ((rnd() < archHoldback()) ? 1 : 0); // may hold one back (eases the tier)
    let order;
    if (isCrucible()) {
      // The Crucible weaves the order war: the boss opens with 2 stones, spreads the
      // rest evenly through the party's placements, and closes with 2. Under reverse
      // resolution it threads first, middle, and last — pressure all the way down.
      const party = [];
      for (let r = 0; r < archParty(); r++) for (const w of [0, 2]) party.push(w);
      const mid = Math.max(0, bossN - 4); // 2 open + mid + 2 close = bossN
      const middle = [];
      let placed = 0;
      for (let i = 0; i < party.length; i++) {
        while (placed < mid && i >= party.length * (placed + 1) / (mid + 1)) { middle.push(1); placed++; }
        middle.push(party[i]);
      }
      while (placed < mid) { middle.push(1); placed++; }
      order = [1, 1, ...middle, 1, 1];
    } else {
      order = archPlaceOrder(bossN);
    }
    G.queue = [
      dealNote,
      { t: 'phase', label: 'Choose Your Stones', note: `Select the stones you will spend — shown to the table, kept in full. The party picks ${archParty()} each; ${bn}, ${bossN}.` },
    ];
    const tn = { 0: 0, 1: 0, 2: 0 };
    for (const w of order) G.queue.push({ t: 'declare', who: w, n: ++tn[w] });
    G.queue.push(
      { t: 'raidarm' },
      { t: 'archinit' },
      { t: 'phase', label: 'The Placement', note: `Place your stones onto the empty SLOTS, in turn — no cards yet. They wait in the ledger, unfired. ${bn} answers.` }
    );
    for (const w of order) G.queue.push({ t: 'place', who: w });
    // (The Crucible's Greens are woven into the boss's active mix at raidarm, so
    // they ride the normal placement steps — no extra step needed.)
    // Commitment is interleaved round-the-table (like the Magistrate) so neither
    // side gets a clean last look — the informational edge is shared. The boss
    // files its bc cards across four turns; the party two face-up, then two veiled.
    const turns = 4, base = Math.floor(bc / turns), bch = new Array(turns).fill(base);
    for (let i = 0, rem = bc - base * turns; rem > 0; i = (i + 1) % turns, rem--) bch[i]++;
    const pf = footprintOf(0), pUp = Math.min(2, pf), pDown = pf - pUp; // party fills its whole footprint (4 small / 5 deep)
    G.queue.push(
      { t: 'phase', label: 'The Commitment', note: `Now fill the slots, round by round — read the open queue and place your cards to exploit it. When all are down, the ledger resolves ${dir}.` },
      { t: 'archcommit', seat: 0, count: pUp, faceUp: true }, { t: 'archcommit', seat: 1, count: bch[0], faceUp: true },
      { t: 'archcommit', seat: 2, count: pUp, faceUp: true }, { t: 'archcommit', seat: 1, count: bch[1], faceUp: true },
      { t: 'archcommit', seat: 0, count: pDown, faceUp: false }, { t: 'archcommit', seat: 1, count: bch[2], faceUp: true },
      { t: 'archcommit', seat: 2, count: pDown, faceUp: false }, { t: 'archcommit', seat: 1, count: bch[3], faceUp: true },
      { t: 'discard' },
      { t: 'beat', ms: 700 },
      { t: 'phase', label: 'The Ledger Resolves', note: `The stones fire ${dir}. Read it right and your value lands; misread the order and it fizzles.` },
      { t: 'archresolve' },
      { t: 'beat', ms: 2600 },
      { t: 'showdown' }
    );
  } else if (raid) {
    // The Magistrate (seat 1) faces the party (seats 0 and 2). Every
    // action goes round the table You → Magistrate → Ally → Magistrate,
    // so the boss's board and stone picks reveal between your turns.
    // It fields its cards face-up; the party commits normally. Stones
    // are telegraphed up front (no thinning) and then spent from that
    // pool: the party three each, the Magistrate five.
    const party = [0, 2];
    const D = (seat, count, faceUp) => ({ t: 'deploy1', seat, count, faceUp });
    const bn = playerName(1);
    G.queue = [
      dealNote,
      { t: 'phase', label: 'The Foundation', note: `In turn, commit two cards face-up. ${bn} answers — fielding its board open for all to read.` },
      D(0, 2, true), D(1, 2, true), D(2, 2, true), D(1, 2, true),
      { t: 'phase', label: 'The Veil', note: `Commit one card face-down. ${bn} fields its share face-up.` },
      D(0, 1, false), D(1, 1, true), D(2, 1, false), D(1, 1, true),
      { t: 'phase', label: 'The Final Commitment', note: 'One final face-down card. Leftover party cards are discarded dead.' },
      D(0, 1, false), D(1, 1, true), D(2, 1, false),
      { t: 'discard' },
      { t: 'phase', label: 'Choose Your Stones', note: `Select the stones you will spend this hand — shown to the table, kept in full (no thinning). The party picks three each; ${bn}, ${raidDiff().stones - (G.raidBoss === 'apothecary' ? apothDrop() : 0)}${G.raidBoss === 'apothecary' ? ' plus the Green cut' : ''}.` },
    ];
    // The chosen difficulty sets how many stones the Magistrate spends
    // and the swing order — it always closes with the last word. On
    // eased tiers the boss may "hold back" one stone this hand.
    const RAID_ORDER = raidDiff().order.slice();
    const holdback = RAID_HOLDBACK[`${G.raidBoss}-${G.raidDiff}`] || 0;
    if (holdback && rnd() < holdback) {
      const i = RAID_ORDER.lastIndexOf(1); // drop the boss's last (unanswered) stone
      if (i >= 0) RAID_ORDER.splice(i, 1);
    }
    // The Apothecary's last word is its Green cut, not a regular stone — so it
    // spends fewer telegraphed stones (APOTH_DROP) and closes with the scalpel.
    if (G.raidBoss === 'apothecary') {
      for (let d = 0, n = apothDrop(); d < n; d++) {
        const i = RAID_ORDER.lastIndexOf(1);
        if (i >= 0) RAID_ORDER.splice(i, 1);
      }
    }
    // The Quartermaster carries a few extra rationed stones (its denial otherwise
    // eases it) — a probabilistic last-word bonus this hand.
    if (G.raidBoss === 'quartermaster' && rnd() < (QM_BONUS[G.raidDiff] || 0)) {
      RAID_ORDER.push(1);
    }
    const tn = { 0: 0, 1: 0, 2: 0 };
    for (const w of RAID_ORDER) G.queue.push({ t: 'declare', who: w, n: ++tn[w] });
    G.queue.push(
      { t: 'raidarm' },
      { t: 'phase', label: 'The Reckoning', note: `Spend your telegraphed stones in turn. ${bn} answers between you${G.raidBoss === 'apothecary' ? ', and closes with the Green cut — its scalpel on your best unlocked card' : ', and has the last word'}.` }
    );
    for (const w of RAID_ORDER) G.queue.push({ t: 'place', who: w });
    if (G.raidBoss === 'apothecary') {
      // Pause on the scalpel so you can watch it land before the results.
      G.queue.push({ t: 'beat', ms: 800 }, { t: 'apothcut' }, { t: 'beat', ms: 2200 }, { t: 'showdown' });
    } else {
      G.queue.push({ t: 'beat', ms: 1700 }, { t: 'showdown' });
    }
  } else if (isStoneFirst()) {
    // The Court of Precedence: the Archivist's inverted loop as a house rule —
    // stones go down FIRST onto the empty slots (two each, in turn), then players
    // fill the slots with cards reading the open queue, and the stones resolve in
    // placement order. Forward only (the boss owns reverse). Any seat count.
    G.queue = [
      dealNote,
      { t: 'archinit' },
      { t: 'phase', label: 'The Writ — Stones First', note: 'Place your stones onto the empty SLOTS, in turn — they wait in the writ, unfired. No cards yet.' },
    ];
    for (let r = 0; r < 2; r++) for (const w of dOrd) G.queue.push({ t: 'place', who: w });
    G.queue.push({ t: 'phase', label: 'The Commitment', note: 'Now fill the slots with cards — read the open queue and place your cards to exploit it. The stones resolve in the order they were placed.' });
    for (const d of dep) for (const w of dOrd) G.queue.push({ t: 'archcommit', seat: w, count: d.c, faceUp: d.up });
    G.queue.push(
      { t: 'discard' },
      { t: 'beat', ms: 700 },
      { t: 'phase', label: 'Precedence Resolves', note: 'The stones fire in placement order — what you read is what you get.' },
      { t: 'archresolve' },
      { t: 'beat', ms: 2200 },
      { t: 'showdown' }
    );
  } else if (gauntlet) {
    // No telegraphing, no thinning — commit the cards, then place all
    // four stones across four serpentine rounds (deal / reverse / …).
    const veilCount = dep[1].c + dep[2].c; // fold the two veil deploys into the normal pattern
    G.queue = [
      dealNote,
      { t: 'phase', label: 'The Foundation', note: 'Commit two cards face-up — no stones are telegraphed here.' },
      { t: 'deploy', count: dep[0].c, faceUp: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Veil', note: `Commit ${dep[1].c === 2 ? 'two cards' : 'one card'} face-down.` },
      { t: 'deploy', count: dep[1].c, faceUp: false, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Final Commitment', note: 'One final face-down card. Leftover hand cards are discarded dead.' },
      { t: 'deploy', count: dep[2].c, faceUp: false, discardRest: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Gauntlet', note: 'Every player holds one of each stone. Place all four, one per round, in serpentine order.' },
    ];
    for (let r = 0; r < 4; r++) {
      const order = r % 2 === 0 ? dOrd : rOrd; // serpentine: balances tempo across the four placements
      for (const w of order) G.queue.push({ t: 'place', who: w, gaunt: r + 1 });
    }
    G.queue.push({ t: 'beat', ms: 1700 }, { t: 'showdown' });
  } else if (G.gauntlet) {
    // The Circuit: you already drew your stone hand from the pouch — no
    // telegraphing it face-up, no separate thinning. Commit cards, then place
    // your stones directly (best CIRCUIT.placeStones of what you drew).
    G.armed = true;
    const rounds = Math.min(CIRCUIT.placeStones, ccfg('drawStones'));
    G.queue = [
      dealNote,
      { t: 'phase', label: 'The Foundation', note: 'Commit two cards face-up.' },
      { t: 'deploy', count: dep[0].c, faceUp: dep[0].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Veil', note: `Commit ${dep[1].c === 2 ? 'two cards' : 'one card'} face-down.` },
      { t: 'deploy', count: dep[1].c, faceUp: dep[1].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Final Commitment', note: 'One final face-down card. Leftover hand cards are discarded dead.' },
      { t: 'deploy', count: dep[2].c, faceUp: dep[2].up, discardRest: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Stones', note: `Place ${rounds} of your drawn stones — no telegraph, no thinning. Spend the best of your hand.` },
    ];
    for (let r = 0; r < rounds; r++) { const order = r % 2 === 0 ? dOrd : rOrd; for (const w of order) G.queue.push({ t: 'place', who: w }); }
    G.queue.push({ t: 'beat', ms: 1700 }, { t: 'showdown' });
  } else if (G.demoStone) {
    // Academy stone lesson: commit cards, then place a single stone to see its
    // effect (no telegraph/thin). The Black lesson lets the Stranger act first.
    G.queue = [
      dealNote,
      { t: 'phase', label: 'The Foundation', note: 'Commit two cards face-up.' },
      { t: 'deploy', count: dep[0].c, faceUp: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Veil', note: 'Commit one card face-down.' },
      { t: 'deploy', count: dep[1].c, faceUp: false, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Final Commitment', note: 'One final face-down card.' },
      { t: 'deploy', count: dep[2].c, faceUp: false, discardRest: true, pendingHumans: G.humans.slice(), choices: {} },
    ];
    G.armed = true;
    if (G.demoOpp) { // the Stranger plays a stone first, so there's something to answer
      G.players[1].active = [G.demoOpp];
      G.queue.push({ t: 'phase', label: 'The Stranger moves', note: 'Watch the Stranger spend a stone.' }, { t: 'place', who: 1 }, { t: 'beat', ms: 900 });
    }
    G.players[0].active = [G.demoStone];
    G.queue.push(
      { t: 'phase', label: `Your ${STONES[G.demoStone].name}`, note: `${STONES[G.demoStone].power} — ${STONES[G.demoStone].desc}` },
      { t: 'place', who: 0 },
      { t: 'beat', ms: 1500 },
      { t: 'showdown' }
    );
  } else if (G.cardsOnly) {
    // Academy Lesson 1: just the cards — no stones telegraphed or placed.
    G.queue = [
      dealNote,
      { t: 'phase', label: 'The Foundation', note: 'Commit two cards face-up.' },
      { t: 'deploy', count: dep[0].c, faceUp: dep[0].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Veil', note: `Commit ${dep[1].c === 2 ? 'two cards' : 'one card'} face-down — hidden until the showdown.` },
      { t: 'deploy', count: dep[1].c, faceUp: dep[1].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'The Final Commitment', note: 'One final face-down card. Leftover cards are discarded dead.' },
      { t: 'deploy', count: dep[2].c, faceUp: dep[2].up, discardRest: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'beat', ms: 1500 },
      { t: 'showdown' },
    ];
  } else {
    G.queue = [
      dealNote,
      { t: 'phase', label: 'Phase 2 — The Foundation', note: 'Declare your first stone, then commit two cards face-up.' },
      ...dOrd.map(w => ({ t: 'declare', who: w, n: 1 })),
      { t: 'deploy', count: dep[0].c, faceUp: dep[0].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'Phase 3 — The Veil', note: `Declare your second stone (reverse order), then commit ${dep[1].c === 2 ? 'two cards' : 'one card'} face-down.` },
      ...rOrd.map(w => ({ t: 'declare', who: w, n: 2 })),
      { t: 'deploy', count: dep[1].c, faceUp: dep[1].up, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'Phase 4 — The Final Commitment', note: 'Declare your third stone, then commit one final card. Leftover hand cards are discarded dead.' },
      ...dOrd.map(w => ({ t: 'declare', who: w, n: 3 })),
      { t: 'deploy', count: dep[2].c, faceUp: dep[2].up, discardRest: true, pendingHumans: G.humans.slice(), choices: {} },
      { t: 'phase', label: 'Phase 5 — The Thinning', note: 'In reverse order, each player abandons one telegraphed stone, leaving two active.' },
      ...rOrd.map(w => ({ t: 'thin', who: w })),
      { t: 'phase', label: 'Phase 6 — First Stone Resolution', note: 'In deal order, each player applies their first active stone.' },
      ...dOrd.map(w => ({ t: 'place', who: w })),
      { t: 'phase', label: 'Phase 7 — Second Stone & Showdown', note: 'Final stones drop, then all veiled cards are flipped.' },
      ...dOrd.map(w => ({ t: 'place', who: w })),
      { t: 'beat', ms: 1700 },
      { t: 'showdown' },
    ];
  }
  log(`— Hand ${G.handNum}. The deck is broken, shuffled clean, and dealt. —`, 'sys');
  const denied = deniedColor();
  if (denied) {
    log(`${playerName(1)} locks away the ${STONES[denied].name} this hand — no one at the table may spend it.`, 'sys');
    announce(`${STONES[denied].name} is locked away this hand`, denied, 1);
  }
  // Charm hooks: reset the per-hand board buff, then let hand-start charms set it.
  if (G.gauntlet) { GAUNTLET.handBuff = 0; G.veilUsed = false; charmFire('handStart', { handNum: G.handNum }); }
  // Hand-edit charms (player only): Mulligan on a table's first hand, Cycle every
  // hand. Insert a hand-edit step before the first commit.
  if (G.gauntlet && G.players[0]) {
    let ins = 1;
    let editMax = 0;
    if (G.handNum === 1 && charmVal('mulliganFirst')) editMax = G.players[0].hand.length;
    else if (charmVal('cycleEach')) editMax = charmVal('cycleEach');
    if (editMax > 0) { G.queue.splice(ins, 0, { t: 'handedit', who: 0, max: editMax }); ins++; }
    // Foul Play: a chance to discard a card and force a random foe discard.
    if (charmVal('disruptEach') && G.players[1] && G.players[1].hand.length) { G.queue.splice(ins, 0, { t: 'disrupt', who: 0 }); ins++; }
  }
  run();
}

function isLocked(card) { return card.stones.some(s => s.color === 'white'); }
function hasRed(card) { return card.stones.some(s => s.color === 'red'); }
function redPhantoms(card) { return card.stones.reduce((n, s) => n + (s.color === 'red' ? (s.twin ? 2 : 1) : 0), 0); }
// Green Stone (the Apothecary's poison): the card scores nothing and joins no
// Pair or Triad — and since it zeroes the whole card, any Red phantom on it
// dies with it (green overrides red).
function isPoisoned(card) { return card.stones.some(s => s.color === 'green'); }

/* ---------------- Queue runner ---------------- */

// Dramatic pause (ms) taken BEFORE a step is shown, so the table
// breathes between visible opponent actions. Zero when headless
// or when tests set window.STONELOCK_FAST.
function dramatic(ms) {
  if (typeof document === 'undefined') return 0;
  if (typeof window !== 'undefined' && window.STONELOCK_FAST) return 0;
  return ms;
}

function preWait(step) {
  switch (step.t) {
    case 'phase': return 500;
    case 'declare': return !isHuman(step.who) ? 900 : 0;
    case 'deploy': return 700;
    case 'deploy1': return !isHuman(step.seat) ? 800 : 0;
    case 'thin': return !isHuman(step.who) ? 900 : 0;
    case 'place': return (!isHuman(step.who) && G.players[step.who].active.length > 0) ? 1300 : 0;
    case 'archcommit': return !isHuman(step.seat) ? 900 : 0;
    case 'beat': return step.ms || 900;
    default: return 0;
  }
}

function run() {
  clearTimeout(runTimer);
  if (UI.reviewing) return; // the table waits while a showdown is reviewed
  while (G.queue.length && !G.over) {
    const step = G.queue[0];
    if (stepNeedsHuman(step)) {
      promptHuman(step);
      render();
      autoScrollToPrompt();
      return;
    }
    const actingSeat = 'who' in step ? step.who : 'seat' in step ? step.seat : null;
    const wait = dramatic(preWait(step));
    if (wait > 0 && !step._waited) {
      step._waited = true;
      // Spotlight the seat that is about to act, through the pause.
      G.activeSeat = actingSeat;
      render();
      runTimer = setTimeout(run, wait);
      return;
    }
    G.queue.shift();
    G.activeSeat = actingSeat;
    executeStep(step);
  }
  G.activeSeat = null;
  render();
}

function stepNeedsHuman(step) {
  switch (step.t) {
    case 'declare': return isHuman(step.who);
    case 'deploy': return step.pendingHumans.length > 0;
    case 'deploy1': return isHuman(step.seat) && !step.done;
    case 'thin': return isHuman(step.who);
    case 'place': return isHuman(step.who) && G.players[step.who].active.length > 0;
    case 'archcommit': return isHuman(step.seat) && G.players[step.seat].hand.length > 0;
    case 'handedit': return isHuman(step.who) && step.max > 0 && G.players[step.who].hand.length > 0;
    case 'disrupt': return isHuman(step.who) && G.players[step.who].hand.length > 0 && G.players[1] && G.players[1].hand.length > 0;
    default: return false;
  }
}

function executeStep(step) {
  switch (step.t) {
    case 'phase':
      setPhase(step.label, step.note);
      break;
    case 'declare':
      aiDeclare(step.who);
      break;
    case 'deploy': {
      // Human portions already stored in step.choices by the UI. The
      // Magistrate commits double, always face-up.
      const reveals = [];
      for (let i = 0; i < G.nPlayers; i++) {
        const up = isTwoHandFoe(i) ? true : step.faceUp;
        const cnt = isTwoHandFoe(i) ? step.count * 2 : step.count;
        const cards = isHuman(i) ? step.choices[i] : aiChooseDeploy(i, cnt, up);
        deployCards(i, cards, up);
        reveals.push(`${playerName(i)} ${verb(i, 'show')} ${cards.map(c => c.type).join(' and ')}`);
      }
      SFX.play(step.faceUp ? 'flip' : 'card');
      if (step.faceUp) {
        log(`The cards flip in the same breath. ${reveals.join('; ')}.`);
        announce('The Foundation — every layout is revealed');
        UI.flashIds = G.players.flatMap(p => p.board).map(c => c.id);
      } else {
        log('Every player slides cards onto the table, face-down. The veil holds.');
        announce('Veiled cards slide onto the table');
      }
      if (step.discardRest) {
        for (const p of G.players) {
          for (const c of p.hand.splice(0)) c.zone = 'discard';
        }
        log('Remaining hand cards are discarded dead.');
      }
      break;
    }
    case 'deploy1': {
      // One seat commits, in the raid's round-the-table order.
      const i = step.seat;
      const cards = aiChooseDeploy(i, step.count, step.faceUp);
      deployCards(i, cards, step.faceUp);
      SFX.play(step.faceUp ? 'flip' : 'card');
      log(`${playerName(i)} ${verb(i, 'commit')} ${cards.length} card${cards.length === 1 ? '' : 's'}${step.faceUp ? ': ' + cards.map(c => c.type).join(', ') : ', face-down'}.`, logClass(i));
      announce(`${playerName(i)} ${verb(i, 'commit')} ${step.faceUp ? cards.map(c => c.type).join(', ') : 'a veiled card'}`, null, i);
      break;
    }
    case 'discard':
      for (const p of G.players) for (const c of p.hand.splice(0)) c.zone = 'discard';
      log('Leftover party cards are discarded dead.');
      break;
    case 'raidarm':
      for (const p of G.players) p.active = p.declared.slice(); // spend from the telegraphed pool
      if (isCrucible()) {
        // Swap a few of the boss's colored stones for Green scalpels, interleaved
        // evenly so they thread through its placements like any other stone.
        const g = archCfg().green || 0;
        const colored = G.players[1].active.slice(0, Math.max(0, G.players[1].active.length - g));
        const mix = []; let gi = 0;
        for (let i = 0; i < colored.length; i++) {
          while (gi < g && i >= colored.length * gi / g) { mix.push('green'); gi++; }
          mix.push(colored[i]);
        }
        while (gi < g) { mix.push('green'); gi++; }
        G.players[1].active = mix;
      }
      G.armed = true;
      break;
    case 'thin':
      aiThin(step.who);
      break;
    case 'place':
      if (!isHuman(step.who) && G.players[step.who].active.length > 0) (G.archivist ? archAiPlaceSlots : aiPlace)(step.who);
      break;
    case 'archinit':
      G.archivist = true;
      G.archQueue = [];
      for (let o = 0; o < G.nPlayers; o++) G.players[o].board = new Array(footprintOf(o)).fill(null);
      break;
    case 'archcommit':
      if (!isHuman(step.seat)) archAiCommit(step.seat, step.count, step.faceUp);
      break;
    case 'archresolve':
      archResolveBegin();
      break;
    case 'archstep':
      archShowStep(step.k);
      break;
    case 'archfinal':
      archResolveFinal();
      break;
    case 'apothcut':
      apothecaryCut();
      break;
    case 'beat':
      break;
    case 'handedit':
    case 'disrupt':
      break; // human-only (handled by promptHuman)
    case 'showdown':
      showdown();
      break;
  }
}

/* ---------------- Human prompts ---------------- */

function promptHuman(step) {
  const seat = step.t === 'deploy' ? step.pendingHumans[0] : (step.t === 'deploy1' || step.t === 'archcommit') ? step.seat : step.who;
  // Hotseat: hide the table behind a pass screen until the right
  // player is holding the device.
  if (G.humans.length > 1 && G.viewer !== seat) {
    UI.mode = 'pass';
    UI.passSeat = seat;
    if (typeof document !== 'undefined') {
      $('passTitle').textContent = `Pass the device to ${playerName(seat)}`;
      $('passBtn').textContent = `I am ${playerName(seat)}`;
      $('passModal').classList.add('open');
    }
    return;
  }
  G.viewer = seat;
  G.activeSeat = seat;
  SFX.play('chime');
  switch (step.t) {
    case 'declare':
      UI.mode = 'pickStone';
      setPrompt(`Telegraph stone ${step.n} of 3 — choose a stone from your pouch.`);
      break;
    case 'deploy':
    case 'deploy1':
      UI.mode = 'pickCards';
      UI.selected = [];
      UI.needed = step.count;
      setPrompt(step.faceUp
        ? `Choose ${step.count} card${step.count === 1 ? '' : 's'} from your hand to commit face-up.`
        : `Choose ${step.count === 1 ? '1 card' : step.count + ' cards'} to commit face-down${step.discardRest ? ' (leftover cards will be discarded dead)' : ''}.`);
      break;
    case 'thin':
      UI.mode = 'thin';
      setPrompt('The Thinning — abandon one of your three telegraphed stones.');
      break;
    case 'place':
      UI.mode = 'placeChoose';
      UI.pendingStone = null;
      setPrompt(G.archivist ? 'Choose a stone to queue onto a slot.' : 'Choose which of your active stones to place.');
      break;
    case 'archcommit':
      UI.mode = 'arch-commit';
      // Resume from what's already committed this step (step.done), not the full
      // count — else pausing mid-step (title → Continue) re-inflates the counter
      // and forces extra commits / a slot-starved soft-lock.
      UI.commitLeft = Math.min(step.count - (step.done || 0), G.players[seat].hand.length);
      UI.commitFaceUp = step.faceUp;
      UI.commitCard = null;
      setPrompt(`Place ${UI.commitLeft} card${UI.commitLeft === 1 ? '' : 's'} ${step.faceUp ? 'face-up' : 'face-down (veiled)'} — click a card in hand, then an empty slot of yours to commit it.`);
      break;
    case 'handedit':
      UI.mode = 'handedit';
      UI.selected = [];
      UI.needed = step.max;
      setPrompt(step.max >= G.players[seat].hand.length
        ? 'Mulligan — tap any cards to discard, then redraw the same number. Or keep your hand.'
        : `Cycle — tap up to ${step.max} card${step.max === 1 ? '' : 's'} to swap, then redraw. Or keep your hand.`);
      break;
    case 'disrupt':
      UI.mode = 'disrupt';
      UI.selected = [];
      UI.needed = 1;
      setPrompt('Foul Play — tap one card to discard and force a random foe discard. Or pass.');
      break;
  }
}

// On phone layouts the page scrolls; when input is needed, bring
// the control the player must use into view. One nudge per prompt —
// never during AI turns, so the screen doesn't fight the reader.
function autoScrollToPrompt() {
  if (typeof window === 'undefined' || window.innerWidth > 760) return;
  let el = null;
  if (UI.mode === 'pickCards') el = $('handArea');
  else if (['pickStone', 'thin', 'placeChoose'].includes(UI.mode)) el = $('stoneTray');
  else if (UI.mode.startsWith('target')) el = document.querySelector('.battlefield');
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---- Human input handlers (wired from render) ----
   All operate on the current viewer's seat (always 0 except in
   hotseat play, where the pass screen rotates the viewer). ---- */

function passConfirm() {
  G.viewer = UI.passSeat;
  UI.passSeat = null;
  UI.mode = 'idle';
  closeModal('passModal');
  run();
}

function humanDeclare(color) {
  const me = G.viewer;
  const p = G.players[me];
  if (p.pool[color] <= 0 || UI.mode !== 'pickStone') return;
  p.pool[color]--;
  p.declared.push(color);
  log(`${playerName(me)} ${verb(me, 'set')} a ${STONES[color].name} in the open. (${STONES[color].power})`, 'you');
  announce(`${playerName(me)} ${verb(me, 'telegraph')} a ${STONES[color].name}`, color, me);
  finishHumanStep();
}

function humanToggleCard(card) {
  const i = UI.selected.indexOf(card);
  if (i >= 0) UI.selected.splice(i, 1);
  else if (UI.selected.length < UI.needed) UI.selected.push(card);
  render();
}

function humanConfirmHandEdit() {
  if (UI.mode !== 'handedit') return;
  const me = G.viewer, picks = UI.selected.slice(), n = picks.length;
  for (const card of picks) circuitDiscardHandCard(me, card);
  for (let i = 0; i < n; i++) circuitDrawOne(me);
  if (n) { log(`${playerName(me)} ${verb(me, 'swap')} ${n} card${n === 1 ? '' : 's'}.`, logClass(me)); SFX.play('card'); }
  UI.selected = [];
  UI.mode = 'idle';
  if (G.queue[0] && G.queue[0].t === 'handedit') G.queue.shift();
  run();
}

// Foul Play (charm): discard one chosen card to force the foe to drop one at
// random from hand. Passing (no selection) spends nothing.
function humanConfirmDisrupt() {
  if (UI.mode !== 'disrupt') return;
  const me = G.viewer, card = UI.selected[0];
  if (card) {
    circuitDiscardHandCard(me, card);
    const foe = G.players[1];
    if (foe && foe.hand.length) {
      const victim = foe.hand[Math.floor(rnd() * foe.hand.length)];
      circuitDiscardHandCard(1, victim);
      log(`${playerName(me)} ${verb(me, 'play')} foul — discarding a card to make ${playerName(1)} drop one at random.`, logClass(me));
      SFX.play('card');
    }
  }
  UI.selected = [];
  UI.mode = 'idle';
  if (G.queue[0] && G.queue[0].t === 'disrupt') G.queue.shift();
  run();
}

function humanConfirmDeploy() {
  const step = G.queue[0];
  if (!step || UI.selected.length !== step.count) return;
  if (step.t === 'deploy1') {
    // Raid: this one seat commits, then play passes on.
    const seat = step.seat;
    const cards = UI.selected.slice();
    deployCards(seat, cards, step.faceUp);
    SFX.play(step.faceUp ? 'flip' : 'card');
    log(`${playerName(seat)} commit ${cards.length} card${cards.length === 1 ? '' : 's'}${step.faceUp ? ': ' + cards.map(c => c.type).join(', ') : ', face-down'}.`, 'you');
    announce(`${playerName(seat)} commit ${step.faceUp ? cards.map(c => c.type).join(', ') : 'a veiled card'}`, null, seat);
    step.done = true;
    UI.selected = [];
    UI.mode = 'idle';
    G.queue.shift();
    run();
    return;
  }
  if (step.t !== 'deploy') return;
  const seat = step.pendingHumans.shift();
  step.choices[seat] = UI.selected.slice();
  UI.selected = [];
  UI.mode = 'idle';
  run();
}

function humanThin(index) {
  const me = G.viewer;
  const p = G.players[me];
  if (UI.mode !== 'thin' || index >= p.declared.length) return;
  const color = p.declared[index];
  p.removed = color;
  p.declared.splice(index, 1);
  p.active = p.declared.slice();
  log(`${playerName(me)} ${verb(me, 'slide')} a ${STONES[color].name} back to the pouch. Two stones stay live.`, 'you');
  announce(`${playerName(me)} ${verb(me, 'abandon')} a ${STONES[color].name}`, color, me);
  finishHumanStep();
}

function humanChooseStone(color) {
  if (UI.mode !== 'placeChoose' || !G.players[G.viewer].active.includes(color)) return;
  const pl = G.players[G.viewer];
  // By the Ledger (chit): the first-drawn stone is locked to go first.
  if (pl.forcedFirst && !pl.stonePlaced && color !== pl.forcedFirst) {
    setPrompt(`By the Ledger — you must place your ${getStone(pl.forcedFirst).name} first (the stone you drew first).`);
    return;
  }
  UI.pendingStone = color;             // may be a variant key; applyStone resolves it
  UI.blueOwn = null;
  UI.blueSlot = null;
  const sName = getStone(color).name, base = stoneBase(color);
  // The Archivist queues stones onto empty SLOTS (positions), not cards.
  if (G.archivist) {
    if (base === 'blue') { UI.mode = 'arch-slot-blue-a'; setPrompt(`${sName} (Exchange) — click the first SLOT of the swap (any layout).`); }
    else if (base === 'black') { UI.mode = 'arch-slot'; setPrompt(archReverse() ? `${sName} (Disruption) — reverse order: click ANY slot; it catches a Red/Blue placed onto it later.` : `${sName} (Disruption) — click a SLOT carrying a queued Red/Blue to undo its last.`); }
    else { UI.mode = 'arch-slot'; setPrompt(base === 'green' ? `${sName} (Poison) — click a RIVAL slot to void it.` : `${sName} (${getStone(color).power}) — click one of YOUR slots.`); }
    render(); autoScrollToPrompt();
    return;
  }
  switch (base) {
    case 'white':
      UI.mode = 'target-own';
      setPrompt(`${sName} (Lock) — click a card of yours${G.mode === 'teams' ? ' or your partner’s' : ''} to protect it.`);
      break;
    case 'red':
      UI.mode = 'target-own';
      setPrompt(`${sName} (Duplication) — click one of your cards to place ${color === 'twinred' ? 'two phantoms' : 'a phantom duplicate'}.`);
      break;
    case 'blue':
      UI.mode = 'target-blue-own';
      setPrompt(G.open
        ? 'Blue Stone (Exchange) — open table: click the first card of the trade, on any layout.'
        : 'Blue Stone (Exchange) — first click the card of YOURS you will give up.');
      break;
    case 'black':
      UI.mode = 'target-black';
      setPrompt(G.archivist
        ? 'Black Stone (Disruption) — click a slot to undo the last stone queued on it.'
        : 'Black Stone (Disruption) — click a card to undo the last stone effect upon it.');
      break;
    case 'green':
      UI.mode = 'target-green';
      setPrompt(`${sName} (Poison) — click an opponent’s unlocked card to poison it to nothing. Only a White lock can shield it.`);
      break;
  }
  render();
  autoScrollToPrompt();
}

function humanCancelStone() {
  UI.pendingStone = null;
  UI.blueOwn = null;
  UI.blueSlot = null; // also reset a half-set slot-mode Blue swap
  UI.mode = 'placeChoose';
  setPrompt('Choose which of your active stones to place.');
  render();
}

function humanDiscardStone() {
  const me = G.viewer;
  const sName = getStone(UI.pendingStone).name;
  consumeActive(me, UI.pendingStone);
  log(`${playerName(me)} ${verb(me, 'set')} a ${sName} down without effect. It passes.`, 'you');
  announce(`${playerName(me)} ${verb(me, 'set')} a ${sName} down without effect`, stoneBase(UI.pendingStone), me);
  UI.pendingStone = null;
  finishHumanStep();
}

function validWhiteTarget(card) {
  if (card.zone !== 'board' || isLocked(card)) return false;
  return G.open || !isOpponent(G.viewer, card.owner);
}

function humanTargetCard(card) {
  const me = G.viewer;
  const color = UI.pendingStone;
  if (UI.mode === 'target-own') {
    if (stoneBase(color) === 'white') {
      if (!validWhiteTarget(card)) return;
    } else { // red (or Twin Red)
      if ((card.owner !== me && !G.open) || card.zone !== 'board' || isLocked(card) || hasRed(card)) return;
    }
    consumeActive(me, color);
    applyStone(me, color, { card });
    UI.pendingStone = null;
    finishHumanStep();
  } else if (UI.mode === 'target-blue-own') {
    if ((card.owner !== me && !G.open) || card.zone !== 'board' || isLocked(card)) return;
    UI.blueOwn = card;
    UI.mode = 'target-blue-opp';
    setPrompt(G.open
      ? `Trading away ${describeCard(card)} — now click any card on another layout to trade it with.`
      : `Giving up your ${card.faceUp ? card.type : 'veiled card'} — now click the opponent card to seize.`);
    render();
  } else if (UI.mode === 'target-blue-opp') {
    const legal = G.open ? card.owner !== UI.blueOwn.owner : isOpponent(me, card.owner);
    if (!legal || card.zone !== 'board' || isLocked(card)) return;
    consumeActive(me, color);
    applyStone(me, color, { give: UI.blueOwn, take: card });
    UI.pendingStone = null; UI.blueOwn = null;
    finishHumanStep();
  } else if (UI.mode === 'target-black') {
    const ev = undoableEventFor(card);
    if (!ev) return;
    consumeActive(me, color);
    applyStone(me, color, { event: ev, card });
    UI.pendingStone = null;
    finishHumanStep();
  } else if (UI.mode === 'target-green') {
    if ((!isOpponent(me, card.owner) && !G.open) || card.zone !== 'board' || isLocked(card)) return;
    consumeActive(me, color);
    applyStone(me, color, { card });
    UI.pendingStone = null;
    finishHumanStep();
  }
}

// The Archivist: clicking a SLOT (empty or filled) — either to queue a stone
// onto it, or to commit a chosen card into it.
function humanTargetSlot(gi) {
  const me = G.viewer;
  if (UI.mode === 'arch-commit') return humanCommitToSlot(gi);
  const color = UI.pendingStone;
  if (UI.mode === 'arch-slot') {
    if (!archStoneTargetable(color, gi)) return; // White/Red own side, Green a rival's, Black an undo target
    consumeActive(me, color);
    archQueueStone(me, color, gi);
    UI.pendingStone = null;
    finishHumanStep();
  } else if (UI.mode === 'arch-slot-blue-a') {
    UI.blueSlot = gi;
    UI.mode = 'arch-slot-blue-b';
    setPrompt(`First slot set (${archSlotLabel(gi)}) — now click the SECOND slot to swap it with.`);
    render();
  } else if (UI.mode === 'arch-slot-blue-b') {
    if (gi === UI.blueSlot) return;
    consumeActive(me, color);                     // may be a Riptide — spend the exact key
    archQueueStone(me, color, UI.blueSlot, gi);
    UI.pendingStone = null; UI.blueSlot = null;
    finishHumanStep();
  }
}

function humanPickCommitCard(card) {
  if (UI.mode !== 'arch-commit' || !G.players[G.viewer].hand.includes(card)) return;
  UI.commitCard = card;
  setPrompt(`Placing ${card.type} ${UI.commitFaceUp ? 'face-up' : 'face-down'} — click one of your empty slots.`);
  render();
}

function humanCommitToSlot(gi) {
  const me = G.viewer;
  const { o, pos } = archLocal(gi);
  if (o !== me || G.players[me].board[pos]) return;        // own empty slot only
  if (!UI.commitCard) { setPrompt('Pick a card from your hand first, then click an empty slot.'); return; }
  const card = UI.commitCard;
  const p = G.players[me];
  p.board[pos] = card;
  card.zone = 'board';
  card.faceUp = UI.commitFaceUp;
  if (UI.commitFaceUp) card.known = card.known.map(() => true);
  p.hand.splice(p.hand.indexOf(card), 1);
  SFX.play(UI.commitFaceUp ? 'flip' : 'card');
  log(`${playerName(me)} ${verb(me, 'commit')} ${UI.commitFaceUp ? card.type : 'a veiled card'} to ${archSlotLabel(gi)}.`, 'you');
  UI.commitCard = null;
  UI.commitLeft--;
  if (G.queue[0]) G.queue[0].done = (G.queue[0].done || 0) + 1; // record progress so a pause/resume can't re-inflate the count
  if (UI.commitLeft <= 0) { UI.flashIds = []; finishHumanStep(); }
  else { setPrompt(`Place ${UI.commitLeft} more ${UI.commitFaceUp ? 'face-up' : 'face-down'} — click a card, then an empty slot.`); render(); }
}

function finishHumanStep() {
  G.queue.shift();
  UI.mode = 'idle';
  run();
}

/* ---------------- Stone mechanics ---------------- */

function consumeActive(who, color) {
  const a = G.players[who].active;
  const i = a.indexOf(color);
  if (i >= 0) a.splice(i, 1);
  if (G.players[who]) G.players[who].stonePlaced = true; // By the Ledger: the opening lock lifts after the first placement
  // Exhaustion (Slumlock / the Warden): a placed stone is unavailable for the next
  // G.exhaustHands hands. The Crucible exhausts the PARTY only — the boss keeps its
  // pouch full (otherwise it disarms itself spending 7 stones + a Green each hand).
  // The Crucible and the Warden exhaust the PARTY only — the boss keeps its pouch
  // full (symmetric exhaustion self-caps the boss's difficulty). Slumlock venue
  // still exhausts everyone.
  const bossKeepsPouch = who === 1 && (isCrucible() || G.raidBoss === 'warden');
  if (G.exhaustHands && !bossKeepsPouch) G.slum[who].push({ color, until: G.handNum + G.exhaustHands });
}

function slumBlocked(who, color) {
  return G.slum[who].filter(e => e.color === color && e.until >= G.handNum).length;
}

// Card descriptions are written from the viewer's seat; hotseat
// tables use plain names so the log reads the same for both players.
function describeCard(card) {
  const useNames = G.humans.length > 1;
  const ownerWord = (!useNames && card.owner === G.viewer) ? 'your' : `${playerName(card.owner)}’s`;
  return card.faceUp ? `${ownerWord} ${card.type}` : `${ownerWord} veiled card`;
}

function verb(actor, base) { return playerName(actor) === 'You' ? base : base + 's'; }

function applyStone(actor, key, target) {
  const color = stoneBase(key);            // a variant resolves by its base colour
  const sName = getStone(key).name;        // but logs/labels read the variant name
  SFX.play(color === 'black' ? 'undo' : 'stone');
  const ev = { id: G.events.length, color, actor, undone: false };
  switch (color) {
    case 'white': {
      target.card.stones.push({ color: 'white', by: actor });
      ev.cards = [target.card];
      if (key === 'deadbolt') {
        // Double Lock: shield one adjacent card on the same board as well.
        const owner = G.players[target.card.owner];
        const idx = owner.board.indexOf(target.card);
        const adj = [owner.board[idx - 1], owner.board[idx + 1]].find(c => c && !isLocked(c));
        if (adj) { adj.stones.push({ color: 'white', by: actor }); ev.cards.push(adj); }
      }
      if (ev.cards.length > 1) {
        log(`${playerName(actor)} ${verb(actor, 'set')} a ${sName} — ${describeCard(ev.cards[0])} and ${describeCard(ev.cards[1])} are both sealed. Untouchable now.`, logClass(actor));
        announce(`${sName} — two cards locked`, 'white', actor);
      } else {
        log(`${playerName(actor)} ${verb(actor, 'lock')} ${describeCard(target.card)} under a ${sName}. Untouchable now.`, logClass(actor));
        announce(`${sName} — ${describeCard(target.card)} is locked`, 'white', actor);
      }
      break;
    }
    case 'red':
      target.card.stones.push({ color: 'red', by: actor, twin: key === 'twinred' });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'drop')} a ${sName} on ${describeCard(target.card)} — ${key === 'twinred' ? 'two phantoms shimmer' : 'a phantom duplicate shimmers'} over it.`, logClass(actor));
      announce(`${sName} — ${key === 'twinred' ? 'two phantoms rise' : 'a phantom rises'} over ${describeCard(target.card)}`, 'red', actor);
      break;
    case 'green':
      target.card.stones.push({ color: 'green', by: actor });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'drop')} a Green Stone on ${describeCard(target.card)} — its worth bleeds away to nothing.`, logClass(actor));
      announce(`Green Stone — ${describeCard(target.card)} is poisoned to nothing`, 'green', actor);
      break;
    case 'blue': {
      const { give, take } = target;
      const giveDesc = describeCard(give), takeDesc = describeCard(take);
      swapCards(give, take);
      ev.cards = [give, take];
      ev.give = give; ev.take = take;
      ev.giveOwner = give.owner; ev.takeOwner = take.owner; // post-trade seats — if either card is re-traded away, this unwind goes cold (see undoableEventFor)
      if (key === 'riptide') ev.riptide = true; // sticky: first Black only downgrades it
      give.prov = { by: actor, partnerId: take.id };
      take.prov = { by: actor, partnerId: give.id };
      log(`${playerName(actor)} ${verb(actor, 'drop')} a Blue Stone — ${giveDesc} trades places with ${takeDesc}. Whatever was hidden stays hidden.`, logClass(actor));
      announce(`Blue Stone — ${playerName(actor) === 'You' ? 'you trade' : playerName(actor) + ' trades'} ${takeDesc} for ${giveDesc}`, 'blue', actor);
      // A face-down card may be secretly inspected by its new owner.
      for (const c of [give, take]) {
        if (!c.faceUp) {
          c.known[c.owner] = true;
          if (isHuman(c.owner) && c.owner === G.viewer) toast(`You peek at your new veiled card: it is a ${c.type}.`);
        }
      }
      break;
    }
    case 'black': {
      // One Black "charge": downgrade a Riptide, or undo a Red/Blue/Green.
      // Returns the cards it touched (for the flash) — Onyx fires it twice.
      const charge = (prev) => {
        if (prev.color === 'blue' && prev.riptide) {
          // Undertow: the first Black only weakens a Riptide back to an ordinary
          // swap. The trade stands; a second Black can then unwind it normally.
          prev.riptide = false;
          log(`${playerName(actor)} ${verb(actor, 'drop')} a ${sName} on the riptide — the undertow breaks, but the trade holds. It is an ordinary swap now.`, logClass(actor));
          announce(`${sName} — the riptide is broken to a plain swap`, 'black', actor);
          return prev.cards.slice();
        }
        prev.undone = true;
        if (prev.color === 'red') {
          const idx = prev.cards[0].stones.findIndex(s => s.color === 'red' && s.by === prev.actor);
          if (idx >= 0) prev.cards[0].stones.splice(idx, 1);
          log(`${playerName(actor)} ${verb(actor, 'drop')} a ${sName} — the phantom over ${describeCard(prev.cards[0])} gutters out.`, logClass(actor));
          announce(`${sName} — the phantom is snuffed out`, 'black', actor);
        } else if (prev.color === 'blue') {
          // Reverse the trade. Stones travel with their cards.
          swapCards(prev.give, prev.take);
          prev.give.prov = null;
          prev.take.prov = null;
          log(`${playerName(actor)} ${verb(actor, 'drop')} a ${sName} on the trade — the swap unwinds, and every stone riding those cards travels home with them.`, logClass(actor));
          announce(`${sName} — the trade unwinds, stones and all`, 'black', actor);
        } else if (prev.color === 'green') {
          const gi = prev.cards[0].stones.findIndex(s => s.color === 'green' && s.by === prev.actor);
          if (gi >= 0) prev.cards[0].stones.splice(gi, 1);
          log(`${playerName(actor)} ${verb(actor, 'drop')} a ${sName} — the poison in ${describeCard(prev.cards[0])} is drawn out, its worth restored.`, logClass(actor));
          announce(`${sName} — the poison is drawn out`, 'black', actor);
        }
        return prev.cards.slice();
      };
      const first = target.event;
      ev.undid = first;
      let cards = charge(first);
      if (key === 'onyx') { // Double Disruption: a second charge on the next undoable event
        const second = nextUndoableEvent(first.id);
        if (second) { ev.undid2 = second; cards = cards.concat(charge(second)); }
      }
      ev.cards = cards;
      break;
    }
  }
  G.events.push(ev);
  if (G.gauntlet && actor === 0) charmFire('stonePlaced'); // Resonance and kin
  UI.flashIds = ev.cards.map(c => c.id);
  render();
}

// In log lines, human actions read as 'you' lines for the player(s).
function logClass(actor) { return isHuman(actor) ? 'you' : 'ai'; }

function swapCards(a, b) {
  const pa = G.players[a.owner], pb = G.players[b.owner];
  const ia = pa.board.indexOf(a), ib = pb.board.indexOf(b);
  pa.board[ia] = b; pb.board[ib] = a;
  const t = a.owner; a.owner = b.owner; b.owner = t;
  // faceUp states remain strictly static during the flight of the trade.
}

function undoableEventFor(card) {
  for (let i = G.events.length - 1; i >= 0; i--) {
    const ev = G.events[i];
    // Green is un-undoable, like Black/White: the printed rule and the slot engine
    // agree only a White lock set in time shields against poison — Black cannot pull it.
    if (ev.undone || ev.color === 'black' || ev.color === 'white' || ev.color === 'green') continue;
    if (!ev.cards.includes(card)) continue;
    if (ev.cards.some(isLocked)) return null; // locked cards cannot be altered
    // A trade only unwinds cleanly if both cards still sit where it left them. If
    // either was re-traded away since, the trail is cold — unwinding would fling a
    // card onto a seat never party to the trade, so Black fizzles instead.
    if (ev.color === 'blue' && ev.giveOwner != null && (ev.give.owner !== ev.giveOwner || ev.take.owner !== ev.takeOwner)) return null;
    return ev;
  }
  return null;
}

function anyUndoable() {
  return G.players.flatMap(p => p.board).some(c => undoableEventFor(c));
}

// The most recent undoable event anywhere on the table, optionally skipping one
// id (Onyx's second charge, so it can't re-hit the event it just touched).
function nextUndoableEvent(excludeId) {
  for (let i = G.events.length - 1; i >= 0; i--) {
    const e = G.events[i];
    if (e.id === excludeId || e.undone || e.color === 'black' || e.color === 'white' || e.color === 'green') continue; // green is un-undoable (only White shields poison)
    if (e.cards.some(isLocked)) continue;
    return e;
  }
  return null;
}

function stoneHasValidTarget(color) {
  const me = G.viewer;
  const mine = G.players[me].board.filter(c => !isLocked(c));
  const theirs = opponentsOf(me).flatMap(i => G.players[i].board).filter(c => !isLocked(c));
  const anyCards = G.players.flatMap(p => p.board).filter(c => !isLocked(c));
  switch (color) {
    case 'white':
      if (G.open) return anyCards.length > 0;
      return mine.length > 0 || alliesOf(me).some(i => G.players[i].board.some(c => !isLocked(c)));
    case 'red':
      return (G.open ? anyCards : mine).some(c => !hasRed(c));
    case 'blue':
      if (G.open) return anyCards.length > 1 && new Set(anyCards.map(c => c.owner)).size > 1;
      return mine.length > 0 && theirs.length > 0;
    case 'black': return anyUndoable();
    case 'green': return G.open ? anyCards.length > 0 : theirs.length > 0;
  }
  return false;
}

/* ---------------- AI ---------------- */

function regionVal(type) { return G.region.values[type]; }
// A card's effective value: its computed evalue (effect cards) or the venue value.
function effVal(card) { return (card && card.evalue != null) ? card.evalue : regionVal(card.type); }

// Effect cards: a card may carry an `fx` rider that shifts effective value.
const CIRCUIT_ANCHOR = 2; // Anchor pins a card to this value regardless of venue
//
// ── The effect registry ──────────────────────────────────────────────────
// One entry per effect, holding EVERYTHING about it in one place: its UI text,
// how it resolves value (in phases), and how the AI should weight holding it.
// Adding a new effect = add one entry here; the value pass, the card art, the
// loadout/deck UI, and the AI keep-priority all pick it up with no edits to the
// core loops. Layer AI tuning per effect as it's added, never an all-at-once
// overhaul. Value hooks (all optional, run in this order, all additive):
//   base(card)            → overrides the starting value (default: regionVal)
//   self(card, board)     → delta to its OWN value (reads the board)
//   spread(card,i,board)  → mutate same-board neighbours' evalue
//   cross(card,i,boards,ownerBoardIdx) → mutate other boards' evalue (slot = i)
//   slot(card,i,board,boards) → delta to its OWN value from WHERE it sits
//   ownerLocked: true     → a cross effect only fires from its owner's board
//   aiKeep(card, ctx)     → extra deploy keep-priority for the AI {hasTwin,counts}
const EFFECTS = {
  anchor: {
    label: 'Anchor', blurb: 'Always worth 2, whatever the venue pays.',
    base: () => CIRCUIT_ANCHOR,
    aiKeep: () => 0, // value already reflected in base; no extra nudge
  },
  keen: {
    label: 'Keen', blurb: '+1 if you hold another card of its type.',
    self: (c, board) => board.some(o => o && o !== c && o.type === c.type) ? 1 : 0,
    aiKeep: (c, ctx) => ctx.hasTwin ? 1 : 0.3, // fires now if a twin's in hand
  },
  lodestone: {
    label: 'Lodestone', blurb: '+1 to the cards on either side of it.',
    spread: (c, i, board) => { if (board[i - 1]) board[i - 1].evalue += 1; if (board[i + 1]) board[i + 1].evalue += 1; },
    aiKeep: () => 1.4, // lifts up to two neighbours
  },
  drain: {
    label: 'Drain', blurb: 'The facing card in the same slot reads −1.',
    ownerLocked: true,
    cross: (c, i, boards, ownerBoard) => {
      // Only opponents' facing cards — never your own board or an ally's (teamOf
      // makes this a no-op in duel/ffa, and correctly spares partners in teams/coop).
      for (let j = 0; j < boards.length; j++) { if (teamOf(j) === teamOf(ownerBoard) || !boards[j][i]) continue; boards[j][i].evalue -= 1; }
    },
    aiKeep: () => 1, // shaves the facing card
  },
  sentinel: {
    label: 'Sentinel', blurb: '+2 when placed on an end slot of your board.',
    slot: (c, i, board) => (i === 0 || i === board.length - 1) ? 2 : 0,
    aiKeep: () => 1.5, // the AI will seek an end slot, so it reliably pays
  },
  harmony: {
    label: 'Harmony', blurb: '+1 for each other effect card you field (max +2).',
    self: (c, board) => Math.min(2, board.filter(o => o && o !== c && o.fx).length),
    aiKeep: () => 0.8, // pays off in an effect-dense deck
  },
  bulwark: {
    label: 'Bulwark', blurb: '+1 for each card beside it (rewards a packed interior).',
    slot: (c, i, board) => (board[i - 1] ? 1 : 0) + (board[i + 1] ? 1 : 0),
    aiKeep: () => 1.2, // wants an interior slot — the opposite of Sentinel
  },
  siphon: {
    label: 'Siphon', blurb: '+1 to itself, and the facing card in the same slot reads −1.',
    self: () => 1,
    ownerLocked: true,
    cross: (c, i, boards, ownerBoard) => { for (let j = 0; j < boards.length; j++) { if (teamOf(j) === teamOf(ownerBoard) || !boards[j][i]) continue; boards[j][i].evalue -= 1; } }, // opponents only (spares ally/partner)
    aiKeep: () => 1.6, // a vampiric Drain: lifts you and shaves them
  },
  gleam: {
    label: 'Gleam', blurb: '+2 — but only if it is your one and only effect card.',
    self: (c, board) => board.some(o => o && o !== c && o.fx) ? 0 : 2,
    aiKeep: (c, ctx) => 1, // rewards a lean deck — the opposite of Harmony
  },
  surge: {
    label: 'Surge', blurb: '+2 if it would otherwise be worth only 1 here — lifts a low card.',
    self: (c) => (c.type != null && regionVal(c.type) === 1) ? 2 : 0,
    aiKeep: (c) => (c && c.type != null && regionVal(c.type) === 1) ? 1.2 : 0.3, // pays on a low-tier card
  },
  gambit: {
    label: 'Gambit', blurb: '+3 to itself, but −1 to each card beside it — wants elbow room.',
    self: () => 3,
    spread: (c, i, board) => { if (board[i - 1]) board[i - 1].evalue -= 1; if (board[i + 1]) board[i + 1].evalue -= 1; },
    aiKeep: () => 1.1, // strong solo; the value pass already weighs the neighbour cost
  },
  contrast: {
    label: 'Contrast', blurb: '+2 unless you field another card of its type — rewards a lone type.',
    self: (c, board) => board.some(o => o && o !== c && o.type === c.type) ? 0 : 2,
    aiKeep: (c, ctx) => ctx && ctx.hasTwin ? 0.2 : 1, // the mirror of Keen
  },
  ledger: {
    label: 'Ledger', blurb: '+1 for each plain (no-effect) card you field (max +2).',
    self: (c, board) => Math.min(2, board.filter(o => o && o !== c && !o.fx).length),
    aiKeep: () => 0.9, // pays off in a mostly-plain deck — the opposite of Harmony
  },
  // ── Build-around modifiers (draft a deck AROUND these, not just +value) ──
  echo: {
    label: 'Echo', blurb: '+2 while it carries a Red phantom — built to be duplicated.',
    self: (c) => (c.stones && c.stones.some(s => s.color === 'red')) ? 2 : 0,
    aiKeep: () => 0.6, // pays only with a Red investment
  },
  contraband: {
    label: 'Contraband', blurb: '+3 in the Slums, worth nothing in the Court, its usual value elsewhere.',
    base: (c) => (G.variant === 'precedence') ? 0 : (c.type != null ? regionVal(c.type) : UNKNOWN_VAL),
    self: () => (G.variant === 'slumlock') ? 3 : 0,
    aiKeep: () => (G.variant === 'slumlock') ? 1.4 : (G.variant === 'precedence' ? 0 : 0.4),
  },
  runesmith: {
    label: 'Runesmith', blurb: '+1 for each upgraded stone in your pouch (max +3) — rewards the variant track.',
    self: () => { if (!G.gauntlet || typeof GAUNTLET === 'undefined') return 0; const p = GAUNTLET.pouch || {}; return Math.min(3, Object.keys(p).filter(isVariant).reduce((s, k) => s + (p[k] || 0), 0)); },
    aiKeep: () => 0.7,
  },
  cantrip: {
    label: 'Cantrip', blurb: 'When you commit it, draw a card — more to place later.',
    onCommit: (who) => { const c = circuitDrawOne(who); if (c) { log(`${playerName(who)} ${verb(who, 'draw')} a card (Cantrip).`, logClass(who)); if (typeof document !== 'undefined') render(); } },
    aiKeep: () => 0.6, // no board value, but card advantage is worth keeping
  },
  wild: {
    label: 'Wildcard', blurb: 'Counts as ANY type for a Pair or Triad — but only on your side; a steal turns it inert. Granted by the Wildcard charm.',
    wild: true, viaCharm: true,    // structural only; never rolled into the card-offer pool
    aiKeep: () => 1.6,             // reliably completes a Pair or Triad
  },
};
// UI/text consumers read label/blurb from the same registry (single source).
const FX_INFO = EFFECTS;

// ── Charms (relics) ───────────────────────────────────────────────────────
// Run-long player passives, drafted between Circuit tables. Each declares the
// lever it pulls and/or lifecycle hooks (`on`). Integration points sum/fire
// across owned charms. PLAYER-ONLY + CIRCUIT-ONLY, so base game and the AI seat
// stay untouched (every helper returns 0/no-op without owned charms). Fields:
//   cardBonus(card,i,board) → +value to your board cards (seat 0)
//   bonusAdd / triadAdd     → added to your Pair&Triad / Triad-only bonus
//   valueFloor              → your cards never read below this
//   drawStones / maxStandingAdd / healBonus / coinBonus → economy levers
//   noExhaust               → ignore exhaustion
//   on: { fightStart, handStart, handWon, handLost }(g, ctx) → event hooks
const CHARMS = {
  loadedcoin:   { label: 'Loaded Coin',       blurb: 'Your Coin cards are worth +1.', cardBonus: c => c.type === 'Coin' ? 1 : 0 },
  passagetoll:  { label: 'Passage Toll',      blurb: 'Your Road and Ferry cards are worth +1.', cardBonus: c => (c.type === 'Road' || c.type === 'Ferry') ? 1 : 0 },
  whetstone:    { label: 'Whetstone',         blurb: 'Your effect cards are worth +1.', cardBonus: c => c.fx ? 1 : 0 },
  forgerseal:   { label: "Forger's Seal",     blurb: 'Your Pairs and Triads pay +1.', bonusAdd: 1 },
  masterforger: { label: 'Master Forger',     blurb: 'Your Triads pay +3 more.', triadAdd: 3 },
  floorprice:   { label: 'Floor Price',       blurb: 'None of your cards read below 2.', valueFloor: 2 },
  smugglers:    { label: "Smuggler's Lining", blurb: 'Draw one extra stone each hand.', drawStones: 1 },
  ironpouch:    { label: 'Iron Pouch',        blurb: 'Your stones ignore exhaustion.', noExhaust: 1 },
  hardened:     { label: 'Hardened',          blurb: 'Your maximum Standing is +3.', maxStandingAdd: 3 },
  fieldsurgeon: { label: 'Field Surgeon',     blurb: 'Clearing a table heals +2 Standing.', healBonus: 2 },
  warchest:     { label: 'War Chest',         blurb: 'Clearing a table pays +3 coin.', coinBonus: 3 },
  firstblood:   { label: 'First Blood',       blurb: 'The first card you play each hand reads +1.', cardBonus: (c, i) => i === 0 ? 1 : 0 },
  strongfinish: { label: 'Strong Finish',     blurb: 'The last card you play each hand reads +2.', cardBonus: (c, i, b) => i === b.length - 1 ? 2 : 0 },
  opening:      { label: 'Opening Gambit',    blurb: 'On the first hand of each table, your board reads +1.', on: { handStart: (g, c) => { if (c.handNum === 1) g.handBuff = (g.handBuff || 0) + 1; } } },
  spite:        { label: 'Spite Engine',      blurb: 'After a hand you lose, your board reads +1 the next hand.', on: { handLost: g => { g.spitePending = true; }, handStart: g => { if (g.spitePending) { g.handBuff = (g.handBuff || 0) + 1; g.spitePending = false; } } } },
  momentum:     { label: 'Momentum',          blurb: 'Each hand won in a row, your board reads +1 more (up to +3) — a loss resets it.', on: { handWon: g => { g.winStreak = (g.winStreak || 0) + 1; }, handLost: g => { g.winStreak = 0; }, handStart: g => { if (g.winStreak) g.handBuff = (g.handBuff || 0) + Math.min(3, g.winStreak); } } },
  counterpunch: { label: 'Counterpunch',      blurb: 'The first hand they take from you each table, heal 2.', on: { handLost: g => { if (!g.cpDone) { g.cpDone = true; g.standing = Math.min(g.maxStanding, g.standing + 2); } } } },
  tithe:        { label: 'Tithe',             blurb: 'Win a hand by 4 or more and press 1 extra Standing.' },
  crownjewel:   { label: 'Crown Jewel',       blurb: 'Your single highest-value card reads +2.', cardBonus: (c, i, b) => { const m = Math.max(...b.filter(Boolean).map(x => regionVal(x.type))); return regionVal(c.type) === m ? 2 : 0; } },
  evenkeel:     { label: 'Even Keel',         blurb: 'Your lowest-value card reads +1.', cardBonus: (c, i, b) => { const m = Math.min(...b.filter(Boolean).map(x => regionVal(x.type))); return regionVal(c.type) === m ? 1 : 0; } },
  fullsatchel:  { label: 'Full Satchel',      blurb: 'Draw one extra card each hand (more to choose from).', drawCards: 1 },
  bulwarkcharm: { label: 'Bracing',           blurb: 'Take 1 less Standing damage from a lost hand.', dmgReduce: 1 },
  vigor:        { label: 'Vigor',             blurb: 'Start each table at full Standing.', on: { fightStart: g => { g.standing = g.maxStanding; } } },
  tollkeeper:   { label: 'Toll Keeper',       blurb: 'Each hand you win pays +1 coin.', on: { handWon: g => { g.coin = (g.coin || 0) + 1; } } },
  mulligan:     { label: 'Mulligan',          blurb: "On a table's first hand, discard any number of cards and redraw that many.", mulliganFirst: 1 },
  cycle:        { label: 'Cycle',             blurb: 'At the start of each hand, you may discard a card and draw one.', cycleEach: 1 },
  foresight:    { label: 'Foresight',         blurb: 'See the next cards waiting in your draw pile (in the deck view).', foresight: 2 },
  foulplay:     { label: 'Foul Play',         blurb: 'At the start of each hand you may discard a card to make your opponent discard one at random.', disruptEach: 1 },
  laststand:    { label: 'Last Stand',        blurb: 'While at 5 Standing or less, your whole board reads +1.', on: { handStart: (g) => { if (g.standing <= 5) g.handBuff = (g.handBuff || 0) + 1; } } },
  reckless:     { label: 'Reckless Wager',    blurb: 'Your board reads +1 every hand — but you take 1 more Standing from a lost hand.', dmgReduce: -1, on: { handStart: (g) => { g.handBuff = (g.handBuff || 0) + 1; } } },
  resonance:    { label: 'Resonance',         blurb: 'Every third stone you place at a table, recover 1 Standing.',
    on: { fightStart: g => { g.resoCount = 0; },
          stonePlaced: g => { g.resoCount = (g.resoCount || 0) + 1; if (g.resoCount % 3 === 0 && g.standing < g.maxStanding) { g.standing = Math.min(g.maxStanding, g.standing + 1); log('Resonance — a stone rings true; you recover 1 Standing.', 'you'); updateCircuitHud(); } } } },
  // The rarest relic — only ever offered after a boss. On gain you choose one
  // of your cards to imbue (see the wild-imbue invariant in circuitAfterNode).
  wildcard:     { label: 'Wildcard',          blurb: 'Choose one of your cards when taken — it counts as ANY type for a Pair or Triad. Falls inert if an opponent steals it.', bossOnly: 1 },
  // ── Signature boss relics — dropped only by the persona who carries them. ──
  riverking:    { label: "River King's Toll",  blurb: 'Road and Ferry count as the SAME type for your Pairs and Triads.', bossOnly: 1, persona: 'The Ferryman' },
  motherlode:   { label: 'Motherlode',         blurb: 'Each Red phantom you field scores +1 (phantoms are no longer worthless).', bossOnly: 1, persona: 'The Miner', phantomValue: 1 },
  ironverdict:  { label: 'Iron Verdict',       blurb: 'The first card you commit each hand begins Locked.', bossOnly: 1, persona: 'The Clerk' },
  sovereign:    { label: "Sovereign's Favor",  blurb: 'Your locked cards read +2.', bossOnly: 1, persona: 'The Lady', cardBonus: (c) => isLocked(c) ? 2 : 0 },
  matchedset:   { label: 'Matched Set',        blurb: 'Your Pairs pay +3.', bossOnly: 1, persona: 'The Tinker', pairAdd: 3 },
  highwayman:   { label: "Highwayman's Cut",    blurb: 'Cards you steal with Blue read +2 on your board.', bossOnly: 1, persona: 'The Wagoner', cardBonus: (c) => (c.owner === 0 && c.origOwner != null && c.origOwner !== c.owner) ? 2 : 0 },
  followingsea: { label: 'Following Sea',       blurb: 'The hand after you win one, your whole board reads +2.', bossOnly: 1, persona: 'The Deckhand', on: { handWon: (g) => { g.pressNext = true; }, handStart: (g) => { if (g.pressNext) { g.handBuff = (g.handBuff || 0) + 2; g.pressNext = false; } } } },
  secondwind:   { label: 'Second Wind',         blurb: 'The first time your Standing would break each act, you survive at 1 instead.', bossOnly: 1, persona: 'The Old Hand' },
  veilwalker:   { label: 'Veilwalker',          blurb: "Each hand, one of the opponent's veiled cards is revealed to you.", bossOnly: 1, persona: 'The Stranger' },
  // The trophy of the 2v1 "Old Rival" event (its only source). Each hand, the
  // first Lock or Steal the foe drew is shuffled back into their pouch and they
  // draw a random replacement — rattling their control before they can set it.
  doublecross:  { label: 'The Double-Cross',    blurb: 'Each hand, the first Lock or Steal the foe drew is shuffled back into their pouch — they draw a random stone in its place.', bossOnly: 1, coopRelic: 1,
    on: { handStart: () => {
      if (typeof G === 'undefined' || !G || !G.gauntlet) return;
      const foe = G.players && G.players[1]; if (!foe) return;
      const ps = (typeof GAUNTLET !== 'undefined' && GAUNTLET.piles) ? GAUNTLET.piles[1] : null;
      if (!ps || !ps.stoneHand) return;
      const i = ps.stoneHand.findIndex(s => { const b = stoneBase(s); return b === 'white' || b === 'blue'; });
      if (i < 0) return; // they drew no control stone this hand — nothing to rattle
      const removed = ps.stoneHand[i];
      ps.stoneHand.splice(i, 1);
      ps.stoneDraw.push(removed); shuffle(ps.stoneDraw);     // shuffle it back into the pouch
      const rep = drawPile(ps.stoneDraw, ps.stoneDiscard, 1)[0]; // draw a random replacement
      if (rep != null) ps.stoneHand.push(rep);
      // Mirror the swap onto the foe's live drawn set so the AI plans around it.
      foe.pool[removed] = Math.max(0, (foe.pool[removed] || 0) - 1);
      const ai = foe.active.indexOf(removed); if (ai >= 0) foe.active.splice(ai, 1);
      if (rep != null) { foe.pool[rep] = (foe.pool[rep] || 0) + 1; foe.active.push(rep); }
      if (typeof document !== 'undefined') announce('The Double-Cross — you rattle their hand', 'blue', 0);
    } } },
};
// Charms are seat-aware: seat 0 is the player (GAUNTLET.charms); seat 1 is the
// foe (GAUNTLET.foeCharms — only elites/bosses carry any). Foes use the passive
// board/score levers only; the economy/event levers are the player's alone.
function charmsOf(seat) { const g = (typeof GAUNTLET !== 'undefined') && GAUNTLET; if (!g) return []; return (seat === 0 ? g.charms : seat === 1 ? g.foeCharms : null) || []; }
// The foe's per-card board read for the current act (Foe Menace — see CIRCUIT).
function foeActBuff() { if (!G || !G.gauntlet || typeof GAUNTLET === 'undefined') return 0; return (ccfg('foeMenace') || [])[(GAUNTLET.act || 1) - 1] || 0; }
function playerCharms() { return charmsOf(0); }
function charmHas(key) { return playerCharms().indexOf(key) >= 0; }
function charmValSeat(field, seat) { return charmsOf(seat).reduce((s, k) => { const v = CHARMS[k] && CHARMS[k][field]; return s + (typeof v === 'number' ? v : 0); }, 0); }
function charmCardBonusSeat(card, i, board, seat) { return charmsOf(seat).reduce((s, k) => { const f = CHARMS[k] && CHARMS[k].cardBonus; return s + (f ? f(card, i, board) : 0); }, 0); }
function charmVal(field) { return charmValSeat(field, 0); }
function charmCardBonus(card, i, board) { return charmCardBonusSeat(card, i, board, 0); }
function charmFire(ev, ctx) { for (const k of playerCharms()) { const h = CHARMS[k] && CHARMS[k].on && CHARMS[k].on[ev]; if (h) h(GAUNTLET, ctx || {}); } }

// ── Circuit records (persisted across runs) ────────────────────────────────
// Run history, charms discovered (seen in an offer — others stay blacked out in
// the compendium), and best results. Stored in localStorage via the `ls` shim.
const CIRCUIT_REC_KEY = 'stonelock_circuit_records';
function circuitRecords() {
  let r; try { r = JSON.parse(ls.get(CIRCUIT_REC_KEY)); } catch (e) { r = null; }
  r = r || {};
  r.seen = r.seen || {}; r.runs = r.runs || []; r.best = r.best || { tables: 0, score: 0 };
  return r;
}
function saveCircuitRecords(r) { ls.set(CIRCUIT_REC_KEY, JSON.stringify(r)); }
function markCharmSeen(key) { const r = circuitRecords(); if (!r.seen[key]) { r.seen[key] = 1; saveCircuitRecords(r); } }
function charmSeen(key) { return !!circuitRecords().seen[key]; }
function recordCircuitRun(g) {
  const r = circuitRecords();
  r.runs.unshift({ tables: g.cleared || 0, score: g.score || 0, foe: g.opp || '', venue: g.venue || '', act: g.act || 1, won: !!g.won, seed: g.seed >>> 0, charms: (g.charms || []).slice(), t: Date.now() });
  r.runs = r.runs.slice(0, 20); // keep the last 20
  if (g.won) r.best.wins = (r.best.wins || 0) + 1;
  r.best.tables = Math.max(r.best.tables, g.cleared || 0);
  r.best.score = Math.max(r.best.score, g.score || 0);
  saveCircuitRecords(r);
}

// Resolve every card's effective value (evalue) over a set of boards from its fx
// rider, neighbours, and the opposing board, then the seat-aware charm pass. The
// CORE used both on the real boards (full info) and on a fog-masked clone for AI
// estimates. A masked card carries type:null/fx:null — it occupies its slot but
// contributes no value/effect (base reads the flat unknown value). Boards may
// hold null slots mid-deal (the Archivist queue), so guard throughout.
const UNKNOWN_VAL = 2;
function resolveBoardEffects(boards) {
  // Phase 1 — base value (anchor pins to 2; a masked/unknown card reads flat).
  for (const board of boards) for (const c of board) if (c) {
    const e = EFFECTS[c.fx];
    c.evalue = (e && e.base) ? e.base(c) : (c.type != null ? regionVal(c.type) : UNKNOWN_VAL);
  }
  // Phase 2 — self mods (a card reads the board and adjusts its own value).
  for (const board of boards) for (const c of board) if (c) {
    const e = EFFECTS[c.fx];
    if (e && e.self) c.evalue += e.self(c, board);
  }
  // Phase 3 — spread/slot/cross mods (a card adjusts itself by position or other
  // cards: same-board neighbours via `spread`, other boards via `cross`). All
  // deltas are additive/commutative. An ownerLocked cross effect (Drain) only
  // fires from its original owner's board — stolen across (Blue swap) it's inert.
  for (let bi = 0; bi < boards.length; bi++) {
    const board = boards[bi];
    for (let i = 0; i < board.length; i++) {
      const c = board[i]; if (!c) continue;
      const e = EFFECTS[c.fx]; if (!e) continue;
      if (e.slot) c.evalue += e.slot(c, i, board, boards);
      if (e.spread) e.spread(c, i, board);
      if (e.cross) {
        const owner = (c.origOwner != null) ? c.origOwner : bi;
        if (!e.ownerLocked || owner === bi) e.cross(c, i, boards, bi);
      }
    }
  }
  for (const board of boards) for (const c of board) if (c && c.evalue < 0) c.evalue = 0;
  // Charms buff their owner's board — seat 0 (player) and seat 1 (elite/boss).
  // Gauntlet-only and a no-op without owned charms. A masked card's null type/fx
  // means a charm like Loaded Coin won't apply to a hidden card (correct fog).
  if (G.gauntlet) {
    // Foe Menace: a flat per-card read the foe gains by act (seat 1 only, and not
    // in the already-tuned 2v1 co-op). Charm-independent, so even a plain duel
    // tough in act 2/3 scores hard enough to press your Standing — the fix for the
    // act-2 dead zone where HP scaling alone never threatened a scoring build.
    const foeBuff = (G.coop || G.mode === 'raid') ? 0 : foeActBuff();
    for (const seat of [0, 1]) {
      const board = boards[seat]; if (!board) continue;
      const hasCharms = charmsOf(seat).length > 0;
      const floor = charmValSeat('valueFloor', seat);
      const hb = (seat === 0 ? (GAUNTLET.handBuff || 0) : foeBuff);
      if (!hasCharms && !hb && !floor) continue; // nothing to apply for this seat
      for (let i = 0; i < board.length; i++) {
        const c = board[i]; if (!c) continue;
        c.evalue += (hasCharms ? charmCardBonusSeat(c, i, board, seat) : 0) + hb;
        if (floor) c.evalue = Math.max(c.evalue, floor);
        if (c.evalue < 0) c.evalue = 0;
      }
    }
  }
}
// Resolve effects on the live boards (full info) for scoring and the value
// badges. A SEEN card therefore reads its true value even when a hidden source
// lifts it — fair inference. No-op for plain cards, so base game is unchanged.
function applyCardEffects() {
  if (!G.players) return;
  resolveBoardEffects(G.players.map(p => p.board));
}

// The card's value badge. Under the Cursed Register, the voided type reads 0
// (the cursed value-stone), since it scores nothing this hand. Effect cards
// show their live effective value.
function cvalHtml(card) {
  const poisoned = isPoisoned(card);
  const cursed = poisoned || (G.cursedType && card.type === G.cursedType);
  const base = (card.evalue != null) ? card.evalue : regionVal(card.type);
  const v = cursed ? 0 : base;
  const tip = poisoned ? ' title="Poisoned — scores nothing this hand"' : cursed ? ' title="Cursed — voided this hand"' : '';
  return `<div class="cval val-${v}"${tip}>${v}</div>`;
}

// The effect-card badge (Anchor/Keen/Lodestone/Drain). Empty for plain cards.
function cfxHtml(card) {
  if (!card.fx || !FX_INFO[card.fx]) return '';
  const info = FX_INFO[card.fx];
  return `<div class="cfx cfx-${card.fx}">${info.label}</div>`; // styled hover tip handles the reminder
}

function knownBoardFor(viewer, ofPlayer) {
  return G.players[ofPlayer].board.map(c => {
    const seen = c.known[viewer] || c.faceUp;
    return {
      type: seen ? c.type : null,
      hasRed: hasRed(c),
      phantoms: redPhantoms(c), // Twin Red = 2 (stones are public, so this is known)
      poisoned: isPoisoned(c),
      // A Wildcard's flexibility is a visible fx tell — known only when the
      // card is seen (fog). It also falls inactive if STOLEN: the rider only
      // works on its original owner's board (owner === origOwner).
      wild: seen && c.fx === 'wild' && c.owner === c.origOwner,
      // The card's effective value (set by applyCardEffects) is only used when
      // the viewer can see the card; hidden cards stay at the flat estimate.
      evalue: seen && c.evalue != null ? c.evalue : null,
    };
  });
}

function estimate(ofPlayer, viewer) {
  // Estimated showdown score using only what `viewer` can see.
  // Unknown cards are given a flat expected value and unique names
  // so they never combine into imaginary Pairs.
  const values = Object.assign({}, G.region.values);
  const cards = knownBoardFor(viewer, ofPlayer).map((c, i) => {
    const type = c.type || ('_u' + i);
    if (!c.type) values[type] = UNKNOWN_VAL; // a hidden card is worth the average — a neutral gamble
    // A SEEN card reads its true effective value — including a boost from a
    // hidden source (e.g. a face-down Lodestone). That bleed is fair inference:
    // the value is visibly higher, so something must be lifting it. A HIDDEN
    // card's own value stays flat (knownBoardFor returns null), so the AI can't
    // see a face-down card's identity and beeline it.
    return { type, hasRed: c.hasRed, phantoms: c.phantoms, poisoned: c.poisoned, wild: c.wild, evalue: c.evalue };
  });
  if (!cards.length) return 0;
  // The Magistrate (and the Circuit 2v1 foe) is worth its two best hands, so it plays for both.
  if (isTwoHandFoe(ofPlayer)) return twoBestHands(cards, values, variantOpts()).score;
  return bestSelection(cards, values, variantOpts()).score;
}

// My side's estimated total minus the best opposing side's, all
// through my own eyes — the AI's working sense of the table.
function sideSwing(me) {
  applyCardEffects(); // refresh effective values for the (possibly hypothetical) board
  const mySide = [me, ...alliesOf(me)].reduce((s, i) => s + estimate(i, me), 0);
  const oppSides = {};
  for (const o of opponentsOf(me)) {
    oppSides[teamOf(o)] = (oppSides[teamOf(o)] || 0) + estimate(o, me);
  }
  const best = Math.max(...Object.values(oppSides));
  return mySide - best;
}

function aiDeclare(who) {
  const p = G.players[who];
  const plan = aiStonePreference(who);
  let choice = plan.find(c => p.pool[c] > 0) || STONE_KEYS.find(c => p.pool[c] > 0);
  if (!choice) return; // exhausted — nothing left to telegraph this hand
  p.pool[choice]--;
  p.declared.push(choice);
  log(`${playerName(who)} sets a ${STONES[choice].name} in the open. (${STONES[choice].power})`, 'ai');
  announce(`${playerName(who)} telegraphs a ${STONES[choice].name}`, choice, who);
}

// Telegraphs are part mind game: order the pouch by situational
// value, but sample with randomness so tables don't converge on a
// single doctrine (and so declarations can be honest bluffs).
function aiStonePreference(who) {
  const p = G.players[who];
  const counts = {};
  for (const c of p.hand.concat(p.board.filter(b => b.owner === who))) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  const hasPair = Object.values(counts).some(v => v >= 2);
  const threatened = opponentsOf(who).some(o => G.players[o].declared.includes('blue'));
  const enemiesShowedValue = opponentsOf(who).some(o => G.players[o].declared.some(c => c === 'red' || c === 'blue'));
  const pers = personaOf(who);
  if (rnd() < pers.bluff) return shuffle(STONE_KEYS.slice()); // a telegraph that means nothing
  const weights = {
    red: (hasPair ? 2.4 : 1.0) * persStoneW(who, 'red'),
    white: (threatened ? 2.6 : 1.3) * persStoneW(who, 'white'),
    blue: 2.2 * persStoneW(who, 'blue'),
    black: (enemiesShowedValue ? 2.0 : 1.2) * persStoneW(who, 'black'),
  };
  // The Warden values having every tool, but only as a tiebreak: a
  // gentle nudge toward colours it hasn't telegraphed yet.
  if (G.raidBoss === 'warden' && isMagistrate(who)) {
    for (const c of STONE_KEYS) if (!p.declared.includes(c)) weights[c] *= 1.25;
  }
  // Facing the Apothecary, the party secures one White first — the only shield
  // against the guaranteed cut — then plays its remaining stones for value.
  if (G.mode === 'raid' && G.raidBoss === 'apothecary' && !isMagistrate(who)
      && !p.declared.includes('white') && p.pool.white > 0) {
    return ['white', ...weightedOrder(STONE_KEYS.filter(c => c !== 'white'), weights)];
  }
  return weightedOrder(STONE_KEYS, weights);
}

function weightedOrder(keys, weights) {
  const pool = keys.slice();
  const out = [];
  while (pool.length) {
    let ball = rnd() * pool.reduce((s, k) => s + weights[k], 0);
    for (let i = 0; i < pool.length; i++) {
      ball -= weights[pool[i]];
      if (ball <= 0) { out.push(pool.splice(i, 1)[0]); break; }
    }
    if (ball > 0) out.push(pool.pop()); // float-edge fallback
  }
  return out;
}

// An effect is "positional" when where the card sits changes its impact — i.e.
// it reaches other cards (a spread/cross hook). Registry-driven, so a future
// positional effect joins the deploy search automatically.
function isPositionalFx(fx) { const e = EFFECTS[fx]; return !!(e && (e.spread || e.cross || e.slot)); }

// All orderings of a small array (footprints are tiny, ≤ ~5).
function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const sub of permutations(rest)) out.push([arr[i], ...sub]);
  }
  return out;
}

// Choose the slot ordering (face-up cards in the front slots, hidden behind)
// that maximizes the AI's own table swing — so positional effects land where
// they pay. General over effects: it just scores the resulting board, letting
// Lodestone seek interior slots between high cards and Drain seek the slot
// facing the foe's best card, all via sideSwing. Keeps the exposure split intact.
function positionDeploy(who, faceUpSet, hiddenSet) {
  if (faceUpSet.length > 5 || hiddenSet.length > 5) return { faceUp: faceUpSet, hidden: hiddenSet };
  const p = G.players[who];
  const saved = p.board;
  let best = null;
  for (const f of permutations(faceUpSet)) {
    for (const h of permutations(hiddenSet)) {
      p.board = f.concat(h);
      const score = sideSwing(who);
      if (!best || score > best.score) best = { score, faceUp: f, hidden: h };
    }
  }
  p.board = saved;
  return best ? { faceUp: best.faceUp, hidden: best.hidden } : { faceUp: faceUpSet, hidden: hiddenSet };
}

function aiChooseDeploy(who, count, faceUp) {
  const p = G.players[who];
  const fp = footprintOf(who);
  if (!p.aiPlan) {
    const counts = {};
    for (const c of p.hand) counts[c.type] = (counts[c.type] || 0) + 1;
    // Layered card value: base venue value, set potential, then the effect
    // rider's own keep-priority (from the EFFECTS registry). Adding an effect
    // there teaches this heuristic about it automatically.
    const scoreCard = c => {
      if (c.type === G.cursedType) return 0;
      const e = EFFECTS[c.fx];
      let v = (e && e.base) ? e.base(c) : regionVal(c.type);
      const hasTwin = counts[c.type] >= 2;
      if (hasTwin) v += 2.5;                                       // pair/triad potential
      if (e && e.aiKeep) v += e.aiKeep(c, { hasTwin, counts });    // the effect's own weight
      return v;
    };
    const sorted = p.hand.slice().sort((a, b) => scoreCard(b) - scoreCard(a));
    const keep = sorted.slice(0, fp);
    // A less practiced player keeps the wrong card now and then.
    if (sorted.length > fp && fumbles(who)) {
      keep[Math.floor(rnd() * keep.length)] =
        sorted[fp + Math.floor(rnd() * (sorted.length - fp))];
    }
    const threatened = opponentsOf(who).some(o => G.players[o].declared.includes('blue'));
    const exposable = keep.slice().sort((a, b) => {
      const risk = c => (counts[c.type] >= 2 ? 5 : 0) + (threatened ? regionVal(c.type) : -regionVal(c.type));
      return risk(a) - risk(b);
    });
    // queue: face-up cards lead so they fill the early (revealed) commits.
    let faceUpSet = exposable.slice(0, 2);
    let hiddenSet = keep.filter(c => !faceUpSet.includes(c));
    // Positional mastery: if the kept cards include a positional effect (one with
    // a spread/cross hook — Lodestone, Drain), search slot orderings to place
    // them best (Lodestone interior between high cards; Drain facing the foe's
    // strongest slot). Reorders WITHIN the exposure groups the risk pass chose,
    // so what's revealed is unchanged. Skipped entirely without such effects, so
    // base game / no-effect play is untouched.
    if (keep.some(c => isPositionalFx(c.fx))) {
      const placed = positionDeploy(who, faceUpSet, hiddenSet);
      faceUpSet = placed.faceUp; hiddenSet = placed.hidden;
    }
    p.aiPlan = { faceUp: faceUpSet, hidden: hiddenSet, queue: faceUpSet.concat(hiddenSet) };
  }
  // The Magistrate (and the 2v1 foe) fields everything face-up, in ranked order.
  if (isTwoHandFoe(who)) return p.aiPlan.queue.splice(0, count);
  if (faceUp) return p.aiPlan.faceUp;
  return p.aiPlan.hidden.splice(0, count);
}

function deployCards(who, cards, faceUp) {
  const p = G.players[who];
  const wasEmpty = p.board.length === 0; // the first commit of the hand
  for (const c of cards) {
    p.hand.splice(p.hand.indexOf(c), 1);
    c.zone = 'board';
    c.faceUp = faceUp;
    if (faceUp) c.known = c.known.map(() => true);
    p.board.push(c);
    const e = EFFECTS[c.fx];
    if (e && e.onCommit) e.onCommit(who, c); // Cantrip: draw a card for later placement
  }
  // Iron Verdict (boss relic): the first card you commit each hand starts Locked.
  if (G.gauntlet && wasEmpty && cards.length && charmsOf(who).includes('ironverdict') && !isLocked(cards[0])) {
    cards[0].stones.push({ color: 'white', by: who });
  }
  // Veilwalker (boss relic): when the opponent veils a card, the player glimpses
  // one of their face-down cards (once per hand).
  if (G.gauntlet && !faceUp && who !== 0 && !G.veilUsed && charmsOf(0).includes('veilwalker')) {
    const veiled = G.players[who].board.filter(c => !c.faceUp && !c.known[0]);
    if (veiled.length) { veiled[Math.floor(rnd() * veiled.length)].known[0] = true; G.veilUsed = true; }
  }
}

function aiThin(who) {
  const p = G.players[who];
  if (!p.declared.length) return; // nothing telegraphed (a no-telegraph venue) — nothing to abandon
  const scores = p.declared.map(color => aiStoneValue(who, color));
  let worst = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[worst]) worst = i;
  if (fumbles(who)) worst = Math.floor(rnd() * p.declared.length);
  const color = p.declared[worst];
  p.removed = color;
  p.declared.splice(worst, 1);
  p.active = p.declared.slice();
  log(`${playerName(who)} abandons a ${STONES[color].name}. Two stones stay live.`, 'ai');
  announce(`${playerName(who)} abandons a ${STONES[color].name}`, color, who);
}

function aiStoneValue(who, color) {
  return persStoneW(who, color) * aiStoneBaseValue(who, color);
}

function aiStoneBaseValue(who, color) {
  const threatened = opponentsOf(who).some(o =>
    G.players[o].declared.includes('blue') || G.players[o].active.includes('blue'));
  switch (color) {
    case 'red': {
      const best = aiBestRedTarget(who);
      return best ? best.delta + 0.5 : 0;
    }
    case 'white': {
      applyCardEffects();
      // effVal == regionVal without effect cards, so this is a no-op outside the Circuit.
      const cands = [who, ...alliesOf(who)].flatMap(i => G.players[i].board).filter(c => !isLocked(c));
      const top = cands.length ? Math.max(...cands.map(c => effVal(c))) : 0;
      return threatened ? top + 1 : top * 0.4;
    }
    case 'blue': {
      const best = aiBestBlueTarget(who);
      return best ? best.delta : 0.5;
    }
    case 'black':
      return opponentsOf(who).some(o => G.players[o].declared.some(c => c === 'red' || c === 'blue')) ? 2.5 : 0.5;
  }
  return 0;
}

function aiBestRedTarget(who) {
  // Open tables let allies' layouts carry your phantom too.
  const seats = G.open ? [who, ...alliesOf(who)] : [who];
  let best = null;
  const base = sideSwing(who);
  for (const seat of seats) {
    for (const card of G.players[seat].board) {
      if (isLocked(card) || hasRed(card)) continue;
      card.stones.push({ color: 'red', by: who });
      const delta = sideSwing(who) - base;
      card.stones.pop();
      if (!best || delta > best.delta) best = { card, delta };
    }
  }
  return best;
}

function aiBestBlueTarget(who) {
  let best = null;
  const baseSwing = sideSwing(who);
  for (const give of G.players[who].board) {
    if (isLocked(give)) continue;
    for (const o of opponentsOf(who)) {
      for (const take of G.players[o].board) {
        if (isLocked(take)) continue;
        // A hidden card's RIDER is unknown — the AI may not anticipate it. So
        // when simulating a steal, suppress a hidden take's fx in the after-state
        // only: it won't fire on the AI's own board (no "try it and watch my side
        // light up" tell), so the AI can't beeline a face-down effect card with
        // no visible cue. The base keeps full info, so a visible tell — a foe
        // card the rider is plainly raising — still rightly makes the steal look
        // good (fair inference). Stealing it remains a gamble (risk discount).
        const hidden = !(take.known[who] || take.faceUp);
        const savedFx = take.fx;
        swapCards(give, take);
        if (hidden) take.fx = null;
        const swing = sideSwing(who) - baseSwing;
        if (hidden) take.fx = savedFx;
        swapCards(give, take);
        const discount = hidden ? personaOf(who).risk : 0;
        const delta = swing - discount;
        if (!best || delta > best.delta) best = { give, take, delta };
      }
    }
  }
  return best;
}

function swingIfUndone(ev, me) {
  const cur = sideSwing(me);
  simulateUndo(ev, true);
  const after = sideSwing(me);
  simulateUndo(ev, false);
  return after - cur;
}

function simulateUndo(ev, apply) {
  if (ev.color === 'red') {
    const card = ev.cards[0];
    if (apply) {
      const i = card.stones.findIndex(s => s.color === 'red' && s.by === ev.actor);
      card._simRed = card.stones.splice(i, 1)[0];
    } else if (card._simRed) {
      card.stones.push(card._simRed);
      delete card._simRed;
    }
  } else if (ev.color === 'blue') {
    swapCards(ev.give, ev.take); // swapping twice restores
  }
}

// What undoing an event is worth to `me`, even on a face-down card —
// the stone itself is public, so a phantom on an enemy card is a known
// threat (a Pair, or a Triad if it can pair with a real card).
function denialValue(ev, me) {
  if (ev.color === 'red') {
    const card = ev.cards[0];
    if (!isOpponent(me, card.owner)) return 0; // never snuff your own/ally's phantom
    const t = (card.faceUp || card.known[me]) ? card.type : null;
    if (t) {
      const sameVisible = G.players[card.owner].board
        .filter(c => c !== card && (c.faceUp || c.known[me]) && c.type === t).length;
      return sameVisible >= 1 ? 6 : 2; // a real pair + phantom = Triad; else a Pair
    }
    return 3; // hidden: a phantom Pair is certain, with Triad upside
  }
  return 0; // blue trades are judged by the visible swing
}

function aiBestBlackTarget(who) {
  let best = null;
  const seen = new Set();
  for (const card of G.players.flatMap(p => p.board)) {
    const ev = undoableEventFor(card);
    if (!ev || seen.has(ev.id)) continue;
    seen.add(ev.id);
    // Take the better of the measured swing and the structural denial,
    // so an enemy red is worth answering even when its card is veiled.
    // A Riptide's first Black only downgrades it (no swing this turn), so
    // the AI won't squander a Black on it.
    const delta = ev.riptide ? 0 : Math.max(swingIfUndone(ev, who), denialValue(ev, who));
    if (!best || delta > best.delta) best = { event: ev, delta };
  }
  return best;
}

function aiPlace(who) {
  const p = G.players[who];
  const options = [];
  for (const key of new Set(p.active)) {            // key may be a base colour or a variant
    const color = stoneBase(key);
    const bump = isVariant(key) ? 0.5 : 0;          // variants are upgrades — slightly preferred
    switch (color) {
      case 'white': {
        applyCardEffects();
        const candidates = [who, ...alliesOf(who)].flatMap(i => G.players[i].board).filter(c => !isLocked(c));
        if (!candidates.length) { options.push({ key, color, value: -1, fizzle: true }); break; }
        const threatened = opponentsOf(who).some(o => G.players[o].active.includes('blue'));
        const target = candidates.slice().sort((a, b) =>
          (effVal(b) + (hasRed(b) ? 3 : 0)) - (effVal(a) + (hasRed(a) ? 3 : 0)))[0];
        const value = (effVal(target) + (hasRed(target) ? 3 : 0)) * (threatened ? 1 : 0.35);
        options.push({ key, color, value: value + bump, target });
        break;
      }
      case 'red': {
        const best = aiBestRedTarget(who);
        if (best) options.push({ key, color, value: best.delta + 0.3 + bump, target: best.card });
        else options.push({ key, color, value: -1, fizzle: true });
        break;
      }
      case 'blue': {
        const best = aiBestBlueTarget(who);
        if (best && best.delta > 0) options.push({ key, color, value: best.delta + bump, swap: best });
        else options.push({ key, color, value: 0, fizzle: true });
        break;
      }
      case 'black': {
        const best = aiBestBlackTarget(who);
        if (best && best.delta > 1) options.push({ key, color, value: best.delta + bump, undo: best.event });
        else options.push({ key, color, value: 0, fizzle: true });
        break;
      }
      case 'green': { // poison the foe's richest unlocked card (a placeable Apothecary cut)
        const foes = opponentsOf(who).flatMap(o => G.players[o].board).filter(c => !isLocked(c));
        if (foes.length) { const t = foes.slice().sort((a, b) => effVal(b) - effVal(a))[0]; options.push({ key, color, value: effVal(t) + bump, target: t }); }
        else options.push({ key, color, value: -1, fizzle: true });
        break;
      }
    }
  }
  for (const o of options) o.value *= (personaOf(who)[o.color] || 1); // habits color the choice (by base; green has no persona weight)
  options.sort((a, b) => b.value - a.value);
  // By the Ledger (chit): the first-drawn stone must be placed first.
  if (p.forcedFirst && !p.stonePlaced) { const f = options.filter(o => o.key === p.forcedFirst); if (f.length) { options.length = 0; options.push(...f); } }
  const chosen = fumbles(who) ? options[Math.floor(rnd() * options.length)] : options[0];
  consumeActive(who, chosen.key);
  if (chosen.fizzle) {
    log(`${playerName(who)} sets a ${getStone(chosen.key).name} down without effect. It passes.`, 'ai');
    announce(`${playerName(who)} sets a ${getStone(chosen.key).name} down without effect`, chosen.color, who);
    return;
  }
  switch (chosen.color) {
    case 'white':
    case 'red':
    case 'green':
      applyStone(who, chosen.key, { card: chosen.target });
      break;
    case 'blue':
      applyStone(who, chosen.key, { give: chosen.swap.give, take: chosen.swap.take });
      break;
    case 'black':
      applyStone(who, chosen.key, { event: chosen.undo });
      break;
  }
}

// The Apothecary's last word: poison the party card whose loss cuts the most
// from their combined best hands — among unlocked cards only, since a White
// lock set in time is the one shield against the scalpel.
function apothecaryCut() {
  const opts = variantOpts();
  const scoreOf = (board, poisonIdx) => bestSelection(
    board.map((c, i) => ({ type: c.type, hasRed: hasRed(c), poisoned: isPoisoned(c) || i === poisonIdx })),
    G.region.values, opts).score;
  let best = null;
  for (const seat of [0, 2]) {
    const board = G.players[seat].board;
    const base = scoreOf(board, -1);
    board.forEach((card, idx) => {
      if (isLocked(card) || isPoisoned(card)) return;
      const drop = base - scoreOf(board, idx);
      const key = drop * 100 + regionVal(card.type); // biggest cut first, then the richest card
      if (!best || key > best.key) best = { card, key };
    });
  }
  if (!best) {
    log(`${playerName(1)} lifts the scalpel — but every prize is locked away, and the cut finds nothing.`, 'ai');
    announce(`${playerName(1)} finds nothing to cut`, 'green', 1);
    return;
  }
  applyStone(1, 'green', { card: best.card });
}

// The Scalpel (prestige chit): each hand the foe cuts your best FOUNDATION card —
// the two you committed face-up (slots 0-1) — poisoning it to nothing. Fires
// before the veil lifts and only reaches the open Foundation, so a prize you
// veiled or White-locked is safe (that's the counterplay), and a card merely
// revealed or moved by a Blue can never become an unintended target. Your side
// only (seat 0 and any co-op ally), never the foe.
const SCALPEL_FOUNDATION = 2; // the face-up Foundation is the first two slots
function circuitScalpelCut() {
  if (!G || !G.gauntlet || !ccfg('scalpel') || G.over) return;
  if ((GAUNTLET.act || 1) < 2) return; // spares Act 1 — you get to establish a board before the cuts begin
  const opts = variantOpts();
  const scoreOf = (board, poisonIdx) => bestSelection(
    board.map((c, i) => ({ type: c.type, hasRed: hasRed(c), phantoms: redPhantoms(c), poisoned: isPoisoned(c) || i === poisonIdx })),
    G.region.values, opts).score;
  let best = null;
  for (let seat = 0; seat < G.nPlayers; seat++) {
    if (teamOf(seat) !== teamOf(0)) continue; // your side only
    const board = G.players[seat].board;
    const base = scoreOf(board, -1);
    board.forEach((card, idx) => {
      if (!card || idx >= SCALPEL_FOUNDATION || !card.faceUp || isLocked(card) || isPoisoned(card)) return; // Foundation, exposed, unlocked, un-cut
      const drop = base - scoreOf(board, idx);
      const key = drop * 100 + regionVal(card.type); // biggest cut first, then the richest
      if (!best || key > best.key) best = { card, key };
    });
  }
  if (!best) return; // nothing in the open Foundation to cut — your prizes are veiled or locked
  log(`The Scalpel — ${g_opp()} cuts your ${best.card.type} to nothing.`, 'ai');
  announce('The Scalpel cuts your Foundation', 'green', 1);
  applyStone(1, 'green', { card: best.card });
}
function g_opp() { return (typeof GAUNTLET !== 'undefined' && GAUNTLET && GAUNTLET.opp) || playerName(1); }

/* ---------------- Showdown ---------------- */

function entities() {
  if (G.mode === 'raid') {
    return [
      { name: G.humans.length > 1 ? `${playerName(0)} & ${playerName(2)}` : 'Your raid party', members: [0, 2] },
      { name: playerName(1), members: [1] },
    ];
  }
  if (G.mode === 'coop') {
    return [
      { name: `${playerName(0)} & ${playerName(2)}`, members: [0, 2] },
      { name: playerName(1), members: [1] },
    ];
  }
  if (TEAM_MODES.has(G.mode)) {
    return [
      { name: G.humans.length === 1 ? 'Your alliance' : `${playerName(0)} & ${playerName(2)}`, members: [0, 2] },
      { name: `${playerName(1)} & ${playerName(3)}`, members: [1, 3] },
    ];
  }
  return Array.from({ length: G.nPlayers }, (_, i) => ({ name: playerName(i), members: [i] }));
}

function showdown() {
  circuitScalpelCut(); // The Scalpel (chit): the foe's last cut, BEFORE the veil lifts
  for (const p of G.players) {
    for (const c of p.board) {
      c.faceUp = true;
      c.known = c.known.map(() => true);
    }
  }
  log('The Showdown — every veiled card on the table is flipped face-up.', 'sys');
  announce('The Showdown — every veiled card is flipped');
  SFX.play('sting');

  applyCardEffects();
  const sel = G.players.map((p, idx) => bestSelection(
    p.board.map(c => ({ type: c.type, hasRed: hasRed(c), phantoms: redPhantoms(c), poisoned: isPoisoned(c), wild: c.fx === 'wild' && c.owner === c.origOwner, evalue: c.evalue })),
    G.region.values,
    scoreOptsFor(idx)
  ));

  if (G.mode === 'raid') { raidShowdown(sel); return; }
  if (G.coop) { coopShowdown(sel); return; }

  const ents = entities().map(e => ({
    ...e,
    score: e.members.reduce((s, m) => s + sel[m].score, 0),
    rank: Math.max(...e.members.map(m => STRUCT_RANK[sel[m].structure])),
  }));
  const sorted = ents.slice().sort((a, b) => b.score - a.score || b.rank - a.rank);
  const top = sorted[0], second = sorted[1];

  let winner = null, structuralOnly = false;
  const push = top.score === second.score && top.rank === second.rank;
  if (!push) {
    winner = top;
    structuralOnly = top.score === second.score;
  }
  const diff = top.score - second.score;

  let matchWinner = null;
  let gains = null;
  if (G.mode === 'ffa') {
    // Everyone banks their margin over the lowest hand at the table.
    const min = Math.min(...ents.map(e => e.score));
    gains = ents.map(e => e.score - min);
    ents.forEach((e, i) => { G.scores[e.members[0]] += gains[i]; });
    const max = Math.max(...G.scores);
    if (max >= G.target) {
      const leaders = G.scores.filter(s => s === max).length;
      if (leaders === 1) matchWinner = ents.find(e => G.scores[e.members[0]] === max);
    }
    if (gains.every(g => g === 0)) {
      log('Every hand scores level — nothing banked.', 'sys');
    } else {
      log(`Hands settle ${ents.map(e => e.score).join(' / ')}. Each banks the lead over the lowest hand: ${ents.map((e, i) => `${e.name} +${gains[i]}`).join(', ')}.`, 'sys');
    }
    if (!matchWinner && Math.max(...G.scores) >= G.target) {
      log('Leaders cross the line together — the race runs on until one stands alone.', 'sys');
    }
  } else {
    if (winner && diff > 0) {
      const sign = winner.members.includes(0) ? 1 : -1;
      G.ledger = Math.max(-G.target, Math.min(G.target, G.ledger + sign * diff));
      if (G.ledger >= G.target) matchWinner = ents.find(e => e.members.includes(0));
      if (G.ledger <= -G.target) matchWinner = ents.find(e => !e.members.includes(0));
    }
    if (push) {
      log('A perfect mathematical tie — declared a Push. Nothing moves.', 'sys');
    } else if (structuralOnly) {
      log(`${winner.name} take${winner.members.includes(0) ? '' : 's'} the showdown on structure (${STRUCT_LABEL[['singles','pair','triad'][winner.rank]]}), but with no point difference nothing moves.`, 'sys');
    } else {
      log(`${winner.name} take${winner.members.includes(0) ? '' : 's'} the showdown, ${top.score} to ${second.score}. The Ledger Stone shifts ${diff}.`, 'sys');
    }
  }

  if (G.gauntlet) circuitHandResult(winner, diff); // Standing drains by lost-hand margin; may end the run
  if (matchWinner) G.over = true;
  G.lastShowdown = { sel, ents, winner, push, structuralOnly, diff, matchWinner, gains, hand: G.handNum };
  showShowdownModal(G.lastShowdown, false);
}

function raidShowdown(sel) {
  const party = [0, 2];
  const teamScore = party.reduce((s, m) => s + sel[m].score, 0);
  const boss = twoBestHands(
    G.players[1].board.map(c => ({ type: c.type, hasRed: hasRed(c), poisoned: isPoisoned(c) })),
    G.region.values, variantOpts()
  );
  const diff = teamScore - boss.score; // positive = the party out-scored the Magistrate
  // Sudden death past RAID_SUDDEN_DEATH hands: DOUBLE the ledger swing, plus an
  // escalating momentum toward the hand's winner (or, on a dead-even hand, the
  // marker leader — a total tie tips to the boss, which holds ties) so even an
  // oscillating raid resolves within a few hands.
  let move = diff, sudden = 0;
  if (G.handNum > RAID_SUDDEN_DEATH) {
    sudden = G.handNum - RAID_SUDDEN_DEATH; // 1, 2, 3, …
    const dir = diff !== 0 ? Math.sign(diff) : (G.ledger !== 0 ? Math.sign(G.ledger) : -1);
    move = diff * 2 + dir * sudden;
  }
  G.ledger = Math.max(-G.target, Math.min(G.target, G.ledger + move));

  let matchWinner = null;
  if (G.ledger >= G.target) { matchWinner = 'party'; G.unlocked = recordCampaignWin(G.raidBoss, G.raidDiff); }
  else if (G.ledger <= -G.target) matchWinner = 'magistrate';

  const bn = playerName(1);
  if (diff > 0) log(`The party fields ${teamScore} to ${bn}'s ${boss.score} — you press the advantage by ${diff}.`, 'sys');
  else if (diff < 0) log(`${bn} fields ${boss.score} to the party's ${teamScore}. It gains ${-diff} ground.`, 'sys');
  else if (sudden > 0) log(`Dead level at ${teamScore} — but the table can't hold.`, 'sys'); // sudden death moves it anyway (below)
  else log(`Dead level at ${teamScore}. ${bn} holds — the marker doesn't move.`, 'sys');
  if (sudden > 0) {
    const toward = (move > 0) ? 'your side' : (move < 0 ? bn : 'no one');
    log(`Sudden death — the swing doubles and lurches toward ${toward} (marker ${move >= 0 ? '+' + move : move}).`, 'sys');
  }

  if (matchWinner) G.over = true;
  G.lastShowdown = { raid: true, sel, boss, teamScore, diff, matchWinner, hand: G.handNum };
  showShowdownModal(G.lastShowdown, false);
}

// The Circuit 2v1 showdown: your side (you + ally, two hands summed) vs the lone
// foe scoring its TWO best hands off its field — a genuine two-vs-two contest.
// Decided by Standing (circuitHandResult), not the campaign ledger.
function coopShowdown(sel) {
  const party = [0, 2];
  const teamScore = party.reduce((s, m) => s + sel[m].score, 0);
  const foe = twoBestHands(
    // Score the foe by the SAME per-card map every other seat gets (see showdown()):
    // it fields effect cards by design, so it must count their evalue too.
    G.players[1].board.map(c => ({ type: c.type, hasRed: hasRed(c), phantoms: redPhantoms(c), poisoned: isPoisoned(c), evalue: c.evalue })),
    G.region.values, scoreOptsFor(1) // the foe's charms boost its two hands (scoring leverage)
  );
  const diff = teamScore - foe.score; // positive = your side out-scores the foe
  const fn = playerName(1), pn = `${playerName(0)} & ${playerName(2)}`;
  let winner = null;
  if (diff > 0) { winner = { name: pn, members: party }; log(`Your side fields ${teamScore} to ${fn}'s ${foe.score} (two hands) — you press by ${diff}.`, 'sys'); }
  else if (diff < 0) { winner = { name: fn, members: [1] }; log(`${fn} fields ${foe.score} across two hands to your side's ${teamScore}, and presses ${-diff}.`, 'sys'); }
  else log(`Dead level at ${teamScore}. ${fn} holds — nothing moves.`, 'sys');

  if (G.gauntlet) circuitHandResult(winner, Math.abs(diff)); // Standing decides the table
  G.lastShowdown = { coop: true, sel, foe, teamScore, diff, winner, hand: G.handNum };
  showShowdownModal(G.lastShowdown, false);
}

function nextHand() {
  closeModal('showdownModal');
  circuitLongNightBleed(); // The Long Night (chit): a dragged-out table costs Standing
  if (G.over) { if (G.gauntlet) { circuitEnd(); return; } showVictory(); return; }
  G.dealer = (G.dealer + 1) % G.nPlayers; // the Rule of Rotation
  startHand();
}
// The Long Night chit: once a table runs past hand 8, each further hand costs 1
// Standing before it's dealt — you cannot grind a hard table forever. Uses the
// same ground-out path as a lost hand, so it ends the run cleanly if it bites.
function circuitLongNightBleed() {
  if (!G || !G.gauntlet || G.over || !ccfg('longNight')) return;
  const g = GAUNTLET;
  if (G.handNum < 8) return; // about to deal hand 9+ (handNum is the hand just played)
  g.standing = Math.max(0, g.standing - 1);
  log(`The Long Night — the table has dragged on; your Standing slips to ${g.standing}/${g.maxStanding}.`, 'ai');
  if (typeof announce === 'function') announce('The Long Night bleeds 1 Standing', 'black', 0);
  if (g.standing <= 0 && charmHas('secondwind') && !g.secondWindUsed) { g.secondWindUsed = true; g.standing = 1; }
  if (g.standing <= 0) { g.groundOut = true; G.over = true; }
  if (typeof updateCircuitHud === 'function') updateCircuitHud();
}

/* ============================================================
   UI LAYER
   ============================================================ */

let logEl, phaseEl, phaseNoteEl, promptEl;

function $(id) { return document.getElementById(id); }

function log(msg, cls) {
  if (typeof document === 'undefined') return;
  const div = document.createElement('div');
  div.className = 'logline ' + (cls || '');
  div.textContent = msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  // Keep the expanded overlay live while it's open (phone Table Talk).
  const lm = $('logModal');
  if (lm && lm.classList.contains('open')) { const b = $('logModalBody'); b.appendChild(div.cloneNode(true)); b.scrollTop = b.scrollHeight; }
}

function openLogModal() {
  if (typeof document === 'undefined') return;
  const b = $('logModalBody');
  b.innerHTML = $('log').innerHTML;
  $('logModal').classList.add('open');
  b.scrollTop = b.scrollHeight;
}

function setPhase(label, note) {
  if (typeof document === 'undefined') return;
  phaseEl.textContent = label;
  phaseNoteEl.textContent = note || '';
  log(`${label}.`, 'phase');
}

function setPrompt(msg) {
  if (typeof document === 'undefined') return;
  promptEl.textContent = msg || '';
}

// Large center-table callout for every visible action, so nothing
// happens in a corner of the screen unannounced. The acting player's
// seat color rides along so the callout points at a region.
function announce(msg, stoneColor, actor) {
  if (typeof document === 'undefined') return;
  const el = $('announce');
  el.innerHTML =
    (actor !== undefined && actor !== null ? `<span class="actorchip" style="--ac:${seatColor(actor)}"></span>` : '') +
    (stoneColor ? `<span class="stone ${stoneColor}"></span>` : '') +
    `<span>${msg}</span>`;
  el.classList.remove('pop');
  void el.offsetWidth; // restart the animation
  el.classList.add('pop');
}

// A big, short-lived "SUDDEN DEATH" bubble slammed over the middle of the play
// area — you cannot miss that the swing has doubled. Auto-clears after ~2s.
let suddenFlashTimer = null;
// Kill any pending Sudden Death bubble so it can't linger over the next match.
function clearSuddenFlash() {
  if (typeof document === 'undefined') return;
  clearTimeout(suddenFlashTimer);
  const el = $('suddenFlash'); if (el) { el.classList.remove('go'); el.style.display = 'none'; }
}
function flashSuddenDeath() {
  if (typeof document === 'undefined') return;
  const el = $('suddenFlash'); if (!el) return;
  SFX && SFX.play && SFX.play('lose'); // a heavy toll
  el.style.display = '';
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(suddenFlashTimer);
  suddenFlashTimer = setTimeout(() => { el.classList.remove('go'); el.style.display = 'none'; }, 2000);
}

function toast(msg) {
  if (typeof document === 'undefined') return;
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 4200);
}

/* ---------- Per-game DOM scaffolding ---------- */

// One identity color per seat, shared by the battlefield frame and
// the sidebar panel so each player's region reads as one unit.
function seatColor(i) {
  if (!isOpponent(0, i)) return i === 0 ? '#55683f' : '#4a5a3a';
  const opps = [];
  for (let k = 0; k < G.nPlayers; k++) if (isOpponent(0, k)) opps.push(k);
  return ['#7a3b2a', '#3a5d78', '#6b4d7a'][opps.indexOf(i) % 3];
}

function buildTableDOM() {
  if (typeof document === 'undefined') return;
  document.body.dataset.compact = G.nPlayers > 2 ? '1' : '0';
  document.body.dataset.deal = G.deal;

  // Wipe the centre display so nothing survives from a prior match — e.g.
  // backing to the menu mid-hand and starting a different boss would otherwise
  // leave the last announce ("The Crucible telegraphs…") under the new prompt.
  ['announce', 'prompt', 'phaseNote', 'actionBar'].forEach(id => { const e = $(id); if (e) e.innerHTML = ''; });
  if ($('phaseLabel')) $('phaseLabel').textContent = 'Stonelock';
  if ($('cursedBadge')) $('cursedBadge').style.display = 'none';

  // Sidebar player panels: opponents in seat order, you last.
  const panels = $('panels');
  panels.innerHTML = '';
  const seats = Array.from({ length: G.nPlayers }, (_, i) => i);
  const order = [0, ...seats.filter(i => i !== 0)]; // you first, always in view
  for (const i of order) {
    const ally = !isOpponent(0, i);
    const div = document.createElement('div');
    div.id = `panel-${i}`;
    div.className = 'playerpanel ' + (ally ? 'you' : 'opp');
    div.style.setProperty('--seatc', seatColor(i));
    const flavor = personaOf(i).flavor;
    div.title = flavor;
    const portrait = portraitFor(playerName(i));
    div.innerHTML = `
      <div class="phead">
        ${portrait ? `<div class="pavatar" style="background-image:url('${portrait}')"></div>` : ''}
        <div class="pheadtext">
          <div class="pname">${playerName(i)} <span id="dealer-${i}" class="dealertoken" title="Dealer Token">dealer</span>${i !== 0 && ally ? '<span class="allytag">partner</span>' : ''}</div>
          ${flavor ? `<div class="epithet">${flavor}</div>` : ''}
        </div>
      </div>
      <div id="pinfo-${i}" class="pinfo"></div>
      <div class="tlabel">stone pouch</div>
      <div id="rack-${i}" class="minipouch${isMagistrate(i) ? ' deep' : ''}"></div>
      <div class="tlabel">telegraphed stones</div>
      <div id="tg-${i}" class="telegraph"></div>`;
    panels.appendChild(div);
  }

  // Battlefield seats: opponents up top, your side at the bottom.
  const oppSeats = $('oppSeats');
  const youSeats = $('youSeats');
  oppSeats.innerHTML = '';
  youSeats.innerHTML = '';
  for (const i of seats) {
    const seat = document.createElement('div');
    seat.id = `seat-${i}`;
    seat.className = 'seat' + (isMagistrate(i) ? ' bossseat' : '');
    seat.style.setProperty('--seatc', seatColor(i));
    const head = `<div class="seathead">${playerName(i)}${isMagistrate(i) ? ' — the raid boss' : ''}</div>`;
    // Raid party seats field four — keep them in a single row (override the deep
    // draw's narrow board cap so the Crucible's party matches the other raids).
    const boardCls = 'board' + (G.mode === 'raid' && !isMagistrate(i) ? ' partyboard' : '');
    const board = `<div id="board-${i}" class="${boardCls}"></div>`;
    if (isMagistrate(i)) {
      // The boss looms over its half of the table: its portrait stands down the
      // left of the seat, the same rectangular framing as the campaign screen.
      const art = portraitFor(playerName(i));
      const bossStrip = `<div class="bosstglabel">Telegraphed stones — spent as it acts</div><div id="bosstg" class="bosstg"></div>`;
      seat.innerHTML =
        (art ? `<div class="bossportrait-rect boss-${G.raidBoss}" style="background-image:url('${art}')"></div>` : '') +
        `<div class="bossseat-body">${head}${bossStrip}${board}</div>`;
    } else {
      seat.innerHTML = head + board;
    }
    if (isOpponent(0, i)) oppSeats.appendChild(seat);
    else youSeats.appendChild(seat);
  }

  // Score widget: track for two-sided modes, purse list for FFA. The Circuit
  // replaces the ledger tug-of-war with its two-Standing HUD, so hide the marker.
  $('ledgerWrap').style.display = (G.mode === 'ffa' || G.gauntlet) ? 'none' : '';
  $('scoreList').style.display = G.mode === 'ffa' ? '' : 'none';
  if (G.gauntlet) { const hn = $('handNum'); if (hn) hn.style.display = 'none'; }
  else { const hn = $('handNum'); if (hn) hn.style.display = ''; }
  if (G.mode === 'raid') {
    $('ledgerHeadAi').textContent = playerName(1).replace('The ', '');
    $('ledgerHeadYou').textContent = 'Party';
  } else if (G.mode !== 'ffa') {
    const multiHuman = G.humans.length > 1;
    $('ledgerHeadAi').textContent = TEAM_MODES.has(G.mode)
      ? (multiHuman ? playerName(1).split(' ')[0] + ' & co.' : 'Them')
      : playerName(1).replace('The ', '');
    $('ledgerHeadYou').textContent = TEAM_MODES.has(G.mode)
      ? (multiHuman ? playerName(0).split(' ')[0] + ' & co.' : 'Yours')
      : (multiHuman ? playerName(0) : 'You');
  }
}

/* ---------- Rendering ---------- */

// FLIP animation: every render captures card positions first, then
// animates any card that ended up somewhere else (hand → table,
// trades, unwound trades) sliding from its old spot.
function captureRects() {
  const m = {};
  document.querySelectorAll('[data-card-id]').forEach(el => {
    m[el.dataset.cardId] = el.getBoundingClientRect();
  });
  return m;
}

function animateMoves(prev) {
  document.querySelectorAll('[data-card-id]').forEach(el => {
    const r0 = prev[el.dataset.cardId];
    if (!r0) return;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) + Math.abs(dy) < 6) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.zIndex = '30';
    el.getBoundingClientRect(); // force reflow
    el.style.transition = 'transform 0.75s cubic-bezier(.45,1.3,.45,1)';
    el.style.transform = '';
    setTimeout(() => { el.style.zIndex = ''; el.style.transition = ''; }, 800);
  });
}

function render() {
  if (typeof document === 'undefined' || !G) return;
  applyCardEffects(); // keep effective card values current for the value badges
  const prevRects = captureRects();
  renderScore();
  renderPanels();
  for (const p of G.players) renderBoard(p.idx, $(`board-${p.idx}`));
  if (G.mode === 'raid' && $('bosstg')) renderTelegraph(1, $('bosstg')); // central, spends as it acts
  renderHand();
  renderTray();
  renderControls();
  for (const p of G.players) {
    const chip = $(`dealer-${p.idx}`);
    if (chip) chip.classList.toggle('on', G.dealer === p.idx);
    const acting = G.activeSeat === p.idx;
    const seat = $(`seat-${p.idx}`), panel = $(`panel-${p.idx}`);
    if (seat) seat.classList.toggle('acting', acting);
    if (panel) panel.classList.toggle('acting', acting);
  }
  $('reviewBtn').disabled = !G.lastShowdown;
  UI.flashIds = []; // flash plays once per action, not per re-render
  animateMoves(prevRects);
  if (TUT.active && TUT.phase === 'live') tutorialTick();
  if (typeof KB !== 'undefined') KB.refresh(); // re-seat the keyboard cursor over the new board
}

/* ============================================================
   KEYBOARD PLAY — an arrow-cursor + number-hotkey layer that rides on the
   existing click handlers. Every interactive element already carries
   .targetable + an onclick, so the cursor just moves a focus ring and calls the
   focused element's .click() — no game logic is duplicated here. Number badges
   label the hand/stone pick-lists (1-9); board targets use the moving ring.
   Live only when Input = Keyboard (body.kbmode). Controller-ready by design:
   arrows ⇒ d-pad, Enter/Space ⇒ A, Esc ⇒ B.
   ============================================================ */
// Nearest focusable in the pressed direction (dx,dy ∈ {-1,0,1}). First restricts
// to candidates genuinely in that direction — inside a ~45° cone (lateral offset
// no bigger than forward distance) — and takes the nearest, so pressing Down goes
// to what's below, not something mostly sideways. If the cone is empty, it widens
// to any element ahead (heavily penalising lateral offset). Returns -1 if nothing
// lies ahead at all.
function kbPickInDirection(rects, cur, dx, dy) {
  if (!rects.length) return -1;
  if (cur < 0 || cur >= rects.length) return 0;
  const c = rects[cur];
  // `ratio` bounds the lateral offset as a fraction of forward distance, so a
  // small ratio is a tight "same row / same column" cone. We try tightest first —
  // pressing Right takes the neighbour ACROSS from you, not one that's mostly up.
  const pick = ratio => {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < rects.length; i++) {
      if (i === cur) continue;
      const ex = rects[i].x - c.x, ey = rects[i].y - c.y;
      const along = ex * dx + ey * dy;          // toward the pressed direction
      if (along <= 1) continue;                 // must be ahead of the cursor
      const perp = Math.abs(ex * dy - ey * dx); // lateral offset off the axis
      if (perp > along * ratio) continue;       // stay within the cone
      const score = along + perp;               // nearest, mild lateral penalty
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  };
  let r = pick(0.4); if (r < 0) r = pick(1.2); if (r < 0) r = pick(1e6);
  return r;
}
const KB = {
  els: [], idx: -1, key: null,
  enabled() { return typeof document !== 'undefined' && inputMode() === 'keyboard'; },
  // A live match board is showing and no blocking modal sits over it.
  liveBoard() { return typeof document !== 'undefined' && INGAME && G && !G.over && !document.querySelector('.modal.open'); },
  // The surface the cursor drives right now: the topmost open modal, else the
  // in-match Menu popup, else the title screen, else the live match board. The
  // ring + Enter/Space layer works identically on all of them — it only calls the
  // focused element's own .click(), so no screen duplicates any game logic. This
  // is what carries keyboard play THROUGH a run: setup, the map, showdowns,
  // rewards, shops, events, and the pause menu, not just the board.
  surface() {
    if (typeof document === 'undefined') return null;
    const modals = Array.from(document.querySelectorAll('.modal.open'));
    if (modals.length) return { kind: 'modal', root: modals[modals.length - 1] };
    const menu = document.getElementById('menuPop');
    if (menu && menu.offsetParent !== null) return { kind: 'menu', root: menu };
    const title = document.getElementById('titleScreen');
    if (title && !title.classList.contains('hidden')) return { kind: 'title', root: title };
    if (INGAME && G && !G.over) return { kind: 'board', root: document };
    return null;
  },
  gather() {
    const s = this.surface();
    if (!s) return [];
    if (s.kind === 'board') {
      const sel = '#hand .targetable, #trayStones .targetable, [id^="board-"] .targetable, #actionBar button:not([disabled])';
      return Array.from(document.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
    }
    // Modal / menu / title: buttons, .targetable, native toggles/links — AND any
    // element wired with an onclick. Lots of menus (the Academy, the Regulars, the
    // Campaign bosses) are clickable <div>s, whose handler is an onclick PROPERTY
    // (not an attribute), so no selector finds them — we scan for el.onclick.
    const cand = new Set(s.root.querySelectorAll('button, .targetable, [role="button"], summary, a[href]'));
    s.root.querySelectorAll('*').forEach(el => { if (el.onclick) cand.add(el); });
    let list = [...cand].filter(el => el.offsetParent !== null && !el.disabled && el.getClientRects().length);
    // When clickables nest (a card holding a button), keep the innermost only.
    list = list.filter(el => !list.some(o => o !== el && el.contains(o)));
    // Document order, so hotkeys and the initial seat read top-to-bottom.
    list.sort((a, b) => (a.compareDocumentPosition(b) & 4 /* FOLLOWING */) ? -1 : 1);
    return list;
  },
  picks() {
    return Array.from(document.querySelectorAll('#hand .targetable, #trayStones .targetable')).filter(el => el.offsetParent !== null);
  },
  badge() {
    document.querySelectorAll('.kbkey').forEach(b => b.remove());
    const s = this.surface();
    if (!this.enabled() || !s || s.kind !== 'board') return; // 1-9 badges label the hand/tray only
    this.picks().slice(0, 9).forEach((el, i) => {
      const b = document.createElement('span'); b.className = 'kbkey'; b.textContent = i + 1;
      el.appendChild(b);
    });
  },
  clearRing() { this.els.forEach(el => el.classList && el.classList.remove('kbfocus')); },
  applyRing() {
    this.clearRing();
    if (this.idx >= 0 && this.idx < this.els.length) { const el = this.els[this.idx]; el.classList.add('kbfocus'); this.key = el; }
  },
  clear() {
    if (typeof document === 'undefined') return;
    this.clearRing(); document.querySelectorAll('.kbkey').forEach(b => b.remove());
    this.els = []; this.idx = -1; this.key = null;
  },
  refresh() {
    if (!this.enabled()) { this.clear(); return; }
    this.clearRing();
    const s = this.surface();
    this.els = this.gather();
    this.badge();
    // Keep the ring on the same element across a re-render if it survives; else
    // seat it sensibly for the surface: the hand/tray on the board; a reachable
    // map node or the primary/default control on a modal, menu, or the title.
    let i = this.key ? this.els.indexOf(this.key) : -1;
    if (i < 0) {
      if (s && s.kind === 'board') { const fp = this.els.find(el => el.closest('#hand, #trayStones')); i = fp ? this.els.indexOf(fp) : (this.els.length ? 0 : -1); }
      else {
        // Prefer the main action: a primary button, a reachable map node / current
        // node, or a big menu option (the boss portrait, a lesson/cast card) — not
        // a nav arrow or a Close. Fall back to the first focusable.
        const prefer = el => el.classList.contains('primary') || el.classList.contains('reach') || el.classList.contains('here') || el.classList.contains('campfocus') || el.classList.contains('bigopt') || el.classList.contains('castcard');
        const seat = this.els.find(prefer);
        i = seat ? this.els.indexOf(seat) : (this.els.length ? 0 : -1);
      }
    }
    this.idx = i; this.applyRing();
  },
  move(dx, dy) {
    if (!this.els.length) this.refresh();
    if (!this.els.length) return;
    if (this.idx < 0) { this.idx = 0; this.applyRing(); return; }
    const rects = this.els.map(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const n = kbPickInDirection(rects, this.idx, dx, dy);
    if (n >= 0) { this.idx = n; this.applyRing(); this.els[this.idx].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  },
  activate() { if (this.idx >= 0 && this.idx < this.els.length) this.els[this.idx].click(); },
  // On the board, Enter prefers confirming the primary action (Deploy/Place),
  // falling back to activating the focused target. On menus/modals it activates
  // whatever is ringed, so arrow-then-Enter picks any option.
  confirm() {
    const s = this.surface();
    if (s && s.kind !== 'board') { this.activate(); return; }
    const prim = document.querySelector('#actionBar button.primary:not([disabled])');
    if (prim) prim.click(); else this.activate();
  },
  cancel() {
    const back = Array.from(document.querySelectorAll('#actionBar button:not([disabled])')).find(b => /‹|back|cancel/i.test(b.textContent));
    if (back) { back.click(); return true; } return false;
  },
  hotkey(n) {
    const el = this.picks()[n - 1]; if (!el) return;
    const i = this.els.indexOf(el); if (i >= 0) { this.idx = i; this.applyRing(); }
    el.click();
  },
  onKey(e) {
    if (!this.enabled()) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const s = this.surface();
    if (!s) return;
    if (!this.els.length) this.refresh();
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); this.move(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); this.move(1, 0); break;
      case 'ArrowUp':    e.preventDefault(); this.move(0, -1); break;
      case 'ArrowDown':  e.preventDefault(); this.move(0, 1); break;
      case ' ': case 'Spacebar': e.preventDefault(); this.activate(); break;
      case 'Enter': e.preventDefault(); this.confirm(); break;
      // Escape is handled globally (onEscapeKey) so it works in mouse mode too.
      default: if (s.kind === 'board' && /^[1-9]$/.test(e.key)) { e.preventDefault(); this.hotkey(+e.key); }
    }
  },
};

// Escape, for EVERY input mode (it's the universal "dismiss"): close the topmost
// modal that offers a Close/Back, then the Menu popup; on a live board, first
// back out of a pending stone/target, and — in keyboard play — open the Menu as
// a pause. A modal with no Close/Back affordance (a forced reward/loadout choice)
// is deliberately left alone.
function dismissButton(root) {
  const btns = Array.from(root.querySelectorAll('button:not([disabled])')).filter(b => b.offsetParent !== null);
  // Only benign dismissals — never a destructive "To title" / "Quit" that would
  // abandon a run, and never a forced choice (those carry no Close/Back).
  return btns.find(b => /^(×|✕|‹|close\b|back\b|resume\b|dismiss\b|keep my hand)/i.test((b.textContent || '').trim())) || null;
}
function menuPopOpen() { const p = (typeof document !== 'undefined') && document.getElementById('menuPop'); return !!(p && p.style.display !== 'none' && p.offsetParent !== null); }
function toggleMenuPop(open) { const b = document.getElementById('menuBtn'); if (!b) return; if (open === menuPopOpen()) return; b.click(); }
function onEscapeKey(e) {
  if (e.key !== 'Escape' || typeof document === 'undefined') return;
  const modals = Array.from(document.querySelectorAll('.modal.open'));
  if (modals.length) { const btn = dismissButton(modals[modals.length - 1]); if (btn) { e.preventDefault(); btn.click(); } return; }
  if (menuPopOpen()) { e.preventDefault(); toggleMenuPop(false); return; }
  if (INGAME && G && !G.over) {
    if (KB.cancel()) { e.preventDefault(); return; }
    if (inputMode() === 'keyboard') { e.preventDefault(); toggleMenuPop(true); }
  }
}

/* ============================================================
   TITLE SCREEN, QUIT, TUTORIAL
   ============================================================ */

let INGAME = false;

function hideTitle() { if (typeof document !== 'undefined') { $('titleScreen').classList.add('hidden'); document.body.classList.remove('titleopen'); } }

// Go to the title — and PAUSE rather than abandon. The match state (G) and its
// board DOM are kept intact behind the title, so "Continue match" can drop the
// player straight back in. A match is only discarded when a new one is started
// (newGame replaces G). A finished match (G.over) simply offers no Continue.
function showTitle() {
  if (typeof document === 'undefined') return;
  clearTimeout(runTimer);
  INGAME = false;
  Music.setTrack('menu'); // back to the menu loop
  TUT.active = false;
  if (typeof GAUNTLET !== 'undefined') GAUNTLET.active = false; // returning to the title abandons a Circuit run
  clearRng(); // a run seeds the global RNG at its intro; drop it so a resumed non-run match deals truly random
  clearSuddenFlash();
  coachHide();
  for (const id of ['quitModal', 'setupModal', 'showdownModal', 'victoryModal', 'rulesModal', 'passModal', 'academyModal', 'logModal', 'circuitModal']) closeModal(id);
  $('showdownResume').style.display = 'none';
  if ($('circuitHud')) $('circuitHud').style.display = 'none';
  setVenueBackdrop(null);
  refreshTitleButtons();
  resetTitleMenu(); // always come back to the main face, not the Play submenu
  document.body.classList.add('titleopen'); // pin the page so a mobile scroll can't peek the board behind the title
  const t = $('titleScreen');
  t.classList.remove('hidden');
  // Replay the intro (scene zoom + staggered menu) on every return to the
  // title, with identical timing — not just on the paths that toggled display.
  t.classList.remove('intro');
  void t.offsetWidth; // force reflow so the CSS animations restart
  t.classList.add('intro');
}

// Drop back into a paused match exactly where it was left. The board DOM
// persisted behind the title; repaint it and resume the loop (run() re-prompts
// the human or restarts the AI beat, whichever the current step needs).
function resumeMatch() {
  if (typeof document === 'undefined' || !G || G.over || G.tutorial || G.gauntlet) return;
  INGAME = true;
  if (typeof Music !== 'undefined') Music.setTrack(G.mode === 'raid' ? 'boss' : 'menu');
  setVenueBackdrop(G.venueKey || 'tavern');
  UI.reviewing = false;
  hideTitle();
  render();
  run();
}

// Show "Continue match" (now inside the Play submenu) only when a paused,
// unfinished match waits.
function refreshTitleButtons() {
  if (typeof document === 'undefined') return;
  const btn = $('titleContinue');
  if (btn) btn.style.display = (G && !G.over && !G.tutorial && !G.gauntlet) ? '' : 'none';
  // Point a first-time player at the Academy with a quiet "Start here" tag.
  const tut = $('titleTutorial');
  if (tut) tut.classList.toggle('firstrun', !onboarded());
}
// Swap the title between its main face and the Play submenu (Continue / Campaign
// / The Circuit / Custom Matches). The leaving set fades out, the arriving set
// falls in. .intro is dropped first so the one-time entrance can't fight it.
function showTitleMenu(which) {
  if (typeof document === 'undefined') return;
  const main = $('titleMenuMain'), play = $('titleMenuPlay');
  if (!main || !play) return;
  const t = $('titleScreen'); if (t) t.classList.remove('intro');
  if (which === 'play') {
    refreshTitleButtons(); // Continue reflects current state when the submenu opens
    // Lock the submenu to the main menu's height (measured while it's still
    // visible) so the centered stack doesn't shift: the top button and the
    // Alpha toggle stay put, and the slack from the missing row falls between
    // Back and Alpha.
    play.style.minHeight = main.offsetHeight + 'px';
  }
  const leaving = which === 'play' ? main : play;
  const entering = which === 'play' ? play : main;
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = () => {
    leaving.style.display = 'none'; leaving.classList.remove('swapout');
    entering.style.display = 'flex';
    entering.classList.remove('swapin'); void entering.offsetWidth; // restart the stagger
    if (!reduce) entering.classList.add('swapin');
  };
  if (reduce) { reveal(); return; }
  leaving.classList.add('swapout');
  setTimeout(reveal, 160);
}
// Reset the title to its main face (used on every return to the title).
function resetTitleMenu() {
  if (typeof document === 'undefined') return;
  const main = $('titleMenuMain'), play = $('titleMenuPlay');
  if (!main || !play) return;
  main.style.display = ''; main.classList.remove('swapin', 'swapout');
  play.style.display = 'none'; play.classList.remove('swapin', 'swapout');
}

// Set (or clear) the per-venue in-game backdrop. The dark overlay is baked in so
// the table and panels stay readable over the art.
function setVenueBackdrop(key) {
  if (typeof document === 'undefined') return;
  const el = $('venuebg');
  if (!el) return;
  el.style.backgroundImage = key
    ? `linear-gradient(rgba(10,7,4,0.5), rgba(10,7,4,0.62)), url('assets/bg/${key}.jpg')`
    : 'none';
}

function requestQuitToTitle() {
  // Leaving a match now pauses it (showTitle keeps G); no abandon prompt.
  showTitle();
}

/* ---------- Tutorial ---------- */

const TUT = { active: false, phase: 'idle', seen: new Set(), introStep: 0, minimized: false, current: null, lesson: null };

// The Academy: short, replayable lessons. Each runs a tailored hand with
// coaching keyed to the moment (deploy / declare / thin / place / showdown).
const LESSONS = [
  {
    id: 'cards', title: 'Lesson 1 — The Cards', blurb: 'How cards are played and scored. No stones yet.',
    cfg: { mode: 'duel', deal: 'small', target: 10, targeting: 'standard', cardsOnly: true,
      fixedHands: { 0: ['Coin', 'Coin', 'Sword', 'Quill', 'Crest'], 1: ['Ferry', 'Sword', 'Crest', 'Quill', 'Chain'] } },
    intro: [
      { sel: '#handArea', text: '<b>This is your hand.</b> Each hand, you and the Stranger field cards into your layouts — and the higher total takes the showdown.' },
      { sel: '#handArea', text: 'Every card carries a <b>value</b> — the numbered stone in its corner. Here a <b>Coin</b> is worth 3, a <b>Sword</b> 2, a <b>Quill</b> or <b>Crest</b> just 1. When scored, only your <b>best three</b> count.' },
      { sel: '.game', text: 'You commit in stages: <b>two face-up</b>, then <b>two veiled</b> (face-down). Veiled cards stay hidden from the Stranger until the showdown — what you hide is yours alone to know.' },
      { sel: '.game', text: 'Matching types pay off: a <b>Pair</b> adds <b>+2</b>, a <b>Triad</b> of three adds <b>+6</b>. You’ve been dealt <b>two Coins</b> — keep both for a Pair. Let’s deal it out — no stones this time, just cards.' },
    ],
    live: { deploy: { sel: '#handArea', text: '<b>Commit your cards.</b> Keep your <b>two Coins</b> (3 + 3 + the Pair’s +2 = 8) and your <b>Sword</b> (2). Tap them, then confirm — drop a 1-value card.' } },
    showdown: '<b>The Showdown.</b> Both layouts flip up; each side’s best three are summed, plus any Pair (+2) or Triad (+6). Your paired Coins should carry it. This is the heart of Stonelock — everything else just bends these numbers.',
  },
  {
    id: 'stones', title: 'Lesson 2 — The Stones', blurb: 'How stones work, and what each one does — pick a stone to study.',
    opens: 'stones',
  },
  {
    id: 'match', title: 'Lesson 3 — Winning the Match', blurb: 'Play a full hand on your own — and learn how a match is won.',
    cfg: { mode: 'duel', deal: 'small', target: 10, targeting: 'standard' },
    intro: [
      { sel: '.ledger', text: 'Last lesson — and this time you run a <b>full hand on your own</b>, no step-by-step coaching. First, the goal: this is <b>the ledger</b>.' },
      { sel: '.ledger', text: 'Win a showdown and the <b>Ledger Stone</b> slides toward your side by the point <b>difference</b> — win by 4, it moves 4. Drive it the whole way to the target and the match is yours; lose hands and it slides back.' },
      { sel: '#panels', text: 'The sidebar tracks each seat: the <b>Dealer Token</b> (it rotates each hand and sets turn order), the stones left in the pouch, and what’s been telegraphed.' },
      { sel: '.game', text: 'Now play the hand — telegraph, commit, thin, resolve — all yourself. Show what you’ve learned.' },
    ],
    live: {},
    showdown: '<b>The ledger moves</b> by your margin — and first to drive it the full distance wins the match. That’s Stonelock, start to finish. From the title, set your own table — venue, format, length. Good luck out there.',
  },
];

// Lesson 2 opens this sub-menu: the stone-handling procedure, then one focused
// fixed-hand demo per stone (place the one stone, see its effect).
const STONE_LESSONS = [
  {
    id: 'st-how', title: 'How stones work', blurb: 'Telegraph, thin, place — the procedure, not the effects.',
    cfg: { mode: 'duel', deal: 'small', target: 10, targeting: 'standard' },
    intro: [
      { sel: '.game', text: 'Before a stone <i>does</i> anything, you handle it in three steps. This lesson is the <b>procedure</b> — what each stone does comes after.' },
      { sel: '#stoneTray', text: '<b>1 · Telegraph.</b> Across the hand you lay <b>three</b> stones in the open. They do nothing yet — everyone sees them, so they’re part plan, part bluff.' },
      { sel: '#stoneTray', text: '<b>2 · Thin</b> — abandon one, keeping two. <b>3 · Place</b> — the two you kept act for real, in turn. Walk it through; don’t worry what each stone does yet.' },
    ],
    live: {
      declare: { sel: '#stoneTray', text: '<b>Telegraph</b> a stone — tap one. (You’ll do this three times across the hand.)' },
      thin: { sel: '#stoneTray', text: '<b>Thin</b> — abandon one telegraphed stone; the two you keep go live.' },
      place: { sel: '#stoneTray', text: '<b>Place</b> — choose a live stone, then its target. This is where it finally acts.' },
    },
    showdown: 'That’s the rhythm: <b>telegraph three · thin to two · place two</b>. Now study what each stone actually does.',
  },
  {
    id: 'st-red', title: 'Red — Duplication', blurb: 'A phantom copy for an instant Pair or Triad.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'red',
      fixedHands: { 0: ['Coin', 'Coin', 'Sword', 'Quill', 'Crest'], 1: ['Sword', 'Crest', 'Quill', 'Chain', 'Ferry'] }, fixedPool: { 0: { red: 1 } },
    },
    intro: [
      { sel: '.game', text: '<b>Red — Duplication.</b> It drops a <b>phantom duplicate</b> on one of your cards. The phantom scores no value of its own, but counts as another copy for a <b>Pair (+2)</b> or <b>Triad (+6)</b>.' },
      { sel: '#handArea', text: 'You hold <b>two Coins</b> — already a Pair. Commit your cards, then drop your Red on a Coin to make it a <b>Triad</b> (+6).' },
    ],
    live: { place: { sel: '#stoneTray', text: '<b>Place the Red</b> on one of your Coins — the phantom becomes a third Coin, turning your Pair into a Triad.' } },
    showdown: 'Watch the bonus jump from +2 to +6 — that’s Red. It builds structure from cards you already hold.',
  },
  {
    id: 'st-white', title: 'White — Lock', blurb: 'Protect a card; it can’t be touched.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'white',
      fixedHands: { 0: ['Coin', 'Bread', 'Sword', 'Quill', 'Crest'], 1: ['Sword', 'Crest', 'Quill', 'Chain', 'Ferry'] }, fixedPool: { 0: { white: 1 } },
    },
    intro: [
      { sel: '.game', text: '<b>White — Lock.</b> It shields a card: once locked, it can’t be stolen, swapped, or unmade for the rest of the hand.' },
      { sel: '#handArea', text: 'You hold a <b>Coin</b> and a <b>Bread</b>, both worth 3. Commit your cards, then lock the one you most want to guarantee.' },
    ],
    live: { place: { sel: '#stoneTray', text: '<b>Place the White</b> on your richest card — now the Stranger can’t take or unmake it.' } },
    showdown: 'A locked card is untouchable. White adds no points — it <b>guarantees</b> them.',
  },
  {
    id: 'st-blue', title: 'Blue — Exchange', blurb: 'Steal an opponent’s card for one of yours.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'blue',
      fixedHands: { 0: ['Crest', 'Quill', 'Chain', 'Sword', 'Coin'], 1: ['Bread', 'Coin', 'Road', 'Sword', 'Ferry'] }, fixedPool: { 0: { blue: 1 } },
    },
    intro: [
      { sel: '.game', text: '<b>Blue — Exchange.</b> It forcibly <b>swaps</b> one of your cards for an unprotected card in an opponent’s layout — give a weak one, take a strong one. A double swing.' },
      { sel: '#handArea', text: 'The Stranger will field rich cards face-up. Commit yours, then trade your weakest for their best.' },
    ],
    live: { place: { sel: '#stoneTray', text: '<b>Place the Blue</b> — pick one of <i>your</i> cards to give, then a strong card of the <b>Stranger’s</b> to take.' } },
    showdown: 'You swung the value twice: their layout lost a card, yours gained one. That’s Blue.',
  },
  {
    id: 'st-black', title: 'Black — Disruption', blurb: 'Undo the last stone played on a card.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'black', demoOpp: 'red',
      fixedHands: { 0: ['Coin', 'Sword', 'Quill', 'Crest', 'Chain'], 1: ['Bread', 'Sword', 'Quill', 'Crest', 'Chain'] }, fixedPool: { 0: { black: 1 }, 1: { red: 1 } },
    },
    intro: [
      { sel: '.game', text: '<b>Black — Disruption.</b> It <b>undoes the last stone</b> played on a card — a snuffed phantom, a reversed trade. It cannot itself be undone.' },
      { sel: '.game', text: 'The Stranger will drop a Red to build a phantom Pair. Commit your cards, then watch — and answer it.' },
    ],
    live: { place: { sel: '#stoneTray', text: '<b>Place the Black</b> on the Stranger’s phantom-bearing card — snuff it, and the bonus it bought vanishes.' } },
    showdown: 'Their phantom is gone, and the bonus with it. Black doesn’t build — it <b>takes away</b>, at the right moment.',
  },
];

// Strategy & Puzzles: situational lessons about intent — when and why to spend a
// stone, and how hidden information wins hands. (Deeper "find-the-win" puzzles
// can grow this list.)
const STRATEGY = [
  {
    id: 'sg-info', title: 'Information Advantage', blurb: 'Hide your prizes; expose bait.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', cardsOnly: true,
      fixedHands: { 0: ['Coin', 'Bread', 'Sword', 'Crest', 'Quill'], 1: ['Sword', 'Ferry', 'Crest', 'Quill', 'Chain'] },
    },
    intro: [
      { sel: '.game', text: '<b>Information is leverage.</b> A card the Stranger can’t see, he can’t steal, swap, or lock away from you. So what you <b>hide</b> matters as much as what you play.' },
      { sel: '#handArea', text: 'You hold a <b>Coin</b> and a <b>Bread</b> (both 3) — your prizes. The Foundation is committed <b>face-up</b>, so expose your <b>weak</b> cards there as bait, and save the rich ones for the veil.' },
    ],
    live: { deploy: { sel: '#handArea', text: 'Commit your <b>lowest</b> cards face-up first (a Crest, a Quill) — let those be what the Stranger reads. Your Coin and Bread go veiled, later.' } },
    showdown: 'Your value rode in hidden; the Stranger only ever saw bait. Against a foe with stones, that anonymity is what keeps your best cards safe.',
  },
  {
    id: 'sg-lock', title: 'Lock the Linchpin', blurb: 'White isn’t for any card — it’s for the one that wins it.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'white',
      fixedHands: { 0: ['Coin', 'Coin', 'Sword', 'Quill', 'Crest'], 1: ['Bread', 'Road', 'Sword', 'Quill', 'Crest'] }, fixedPool: { 0: { white: 1 } },
    },
    intro: [
      { sel: '.game', text: 'White locks a card untouchable — but you only get so many. The skill is choosing <b>which</b> card. Lock the one your hand can’t win without.' },
      { sel: '#handArea', text: 'Your <b>two Coins</b> are a Pair — your whole score leans on them. The Stranger would love to steal or snuff one. Commit your cards, then lock the Coin that anchors the Pair.' },
    ],
    live: { place: { sel: '#stoneTray', text: 'Place the <b>White</b> on a <b>Coin</b> — protect the Pair the Stranger most wants to break, not a card you could afford to lose.' } },
    showdown: 'You spent White where it mattered — on the card that carries the hand. A lock on a throwaway is a wasted stone.',
  },
  {
    id: 'sg-snuff', title: 'Snuff the Swing', blurb: 'Black answers their biggest play — read which one.',
    cfg: {
      mode: 'duel', deal: 'small', target: 10, targeting: 'standard', demoStone: 'black', demoOpp: 'red',
      fixedHands: { 0: ['Coin', 'Sword', 'Quill', 'Crest', 'Chain'], 1: ['Bread', 'Road', 'Sword', 'Quill', 'Crest'] }, fixedPool: { 0: { black: 1 }, 1: { red: 1 } },
    },
    intro: [
      { sel: '.game', text: 'Black undoes a stone — so save it for the play that <b>hurts most</b>. A phantom on a 3 is worth far more to snuff than one on a 1.' },
      { sel: '.game', text: 'The Stranger will Red a card to build a bonus. Commit your cards, watch where the phantom lands — then snuff the one that swings the score.' },
    ],
    live: { place: { sel: '#stoneTray', text: 'Place the <b>Black</b> on the Stranger’s phantom-bearing card — take back the bonus they just bought.' } },
    showdown: 'You spent Black on their biggest swing, not a small one. Disruption is about <b>timing and target</b>, not just having the stone.',
  },
];

// Top-level Academy tracks.
const CATEGORIES = [
  { title: 'Tutorials', blurb: 'Learn to play — the cards, the stones, and a full match.', opens: 'tutorials' },
  { title: 'Strategy & Puzzles', blurb: 'Advanced stone theory and the situations that decide hands.', opens: 'strategy' },
];

function lessonById(id) {
  return LESSONS.find(l => l.id === id) || STONE_LESSONS.find(l => l.id === id) || STRATEGY.find(l => l.id === id);
}

function openAcademy() {
  markOnboarded(); // they found the tutorial — drop the first-run tag
  academyMenu('The Academy', CATEGORIES, { label: '‹ Title', fn: () => { closeModal('academyModal'); showTitle(); } });
}

// The Regulars: the bot cast. A 3-up grid of faces; click one to zoom into a
// focused profile with the full bio.
function regularLeans(p) {
  const ranked = STONE_KEYS.slice().sort((a, b) => p[b] - p[a]);
  // A roughly even hand (no stone meaningfully favored) has no lean to name.
  if (p[ranked[0]] - p[ranked[ranked.length - 1]] < 0.25) return 'Even hand — no lean';
  return ranked.slice(0, 2).map(c => STONES[c].power).join(' · ');
}
// A concise "coach's note" read STRAIGHT OFF a persona's AI weights + temperament,
// so it can never drift from how the bot actually plays. Flavor tells you who they
// are; this tells a new player what they'll DO — the missing legibility a tester
// flagged on the allied AI. STONE_DO is in plain "what it does to the board" terms.
const STONE_DO = { red: 'builds Pairs & Triads', white: 'locks down what it keeps', blue: 'poaches cards across the table', black: 'undoes plays on the board' };
function personaCoachNote(name) {
  const p = PERSONALITIES[name]; if (!p) return null;
  const prefers = STONE_KEYS.filter(c => p[c] >= 1.3).sort((a, b) => p[b] - p[a]);
  const avoids = STONE_KEYS.filter(c => p[c] <= 0.8).sort((a, b) => p[a] - p[b]);
  const tags = [];
  if (p.risk >= 2) tags.push('gambles on veiled cards');
  else if (p.risk === 0) tags.push('won’t bluff into the veil');
  if (p.bluff >= 0.25) tags.push('its telegraphs lie');
  if (p.skill < 0.96) tags.push('fumbles a stone now and then');
  return {
    prefers: prefers.map(c => STONES[c].power),
    avoids: avoids.map(c => STONES[c].power),
    plays: prefers.length ? prefers.map(c => STONE_DO[c]).join(', ') : 'spends whatever the moment asks for',
    tags,
  };
}
// One-line form (for the cast grid) or the full Prefers/Plays/Avoids block.
function coachNoteHtml(name, full) {
  const n = personaCoachNote(name); if (!n) return '';
  if (!full) {
    const lead = n.prefers.length ? `Prefers <b>${n.prefers.join(' · ')}</b> — ${n.plays}` : `No favoured stone — ${n.plays}`;
    return `<div class="coachnote">${lead}${n.tags.length ? `; ${n.tags.join(', ')}` : ''}.</div>`;
  }
  const rows = [];
  if (n.prefers.length) rows.push(`<span class="cn-k">Prefers</span> ${n.prefers.join(' · ')}`);
  rows.push(`<span class="cn-k">Plays</span> ${n.plays}${n.tags.length ? `; ${n.tags.join(', ')}` : ''}`);
  if (n.avoids.length) rows.push(`<span class="cn-k">Shy of</span> ${n.avoids.join(' · ')}`);
  return `<div class="coachnote full">${rows.map(r => `<div>${r}</div>`).join('')}</div>`;
}
function openRegulars() {
  if (typeof document === 'undefined') return;
  const body = $('regularsBody');
  body.className = 'castgrid';
  body.innerHTML = '';
  for (const name of BOT_POOL) {
    const p = PERSONALITIES[name];
    if (!p) continue;
    const portrait = portraitFor(name);
    const card = document.createElement('div');
    card.className = 'castcard';
    card.innerHTML =
      `${portrait ? `<div class="castportrait" style="background-image:url('${portrait}')"></div>` : ''}` +
      `<h3>${name}</h3><div class="castepithet">${p.flavor}</div>`;
    card.onclick = () => showRegular(name);
    body.appendChild(card);
  }
  $('regularsModal').querySelector('h2').textContent = 'The Regulars';
  const b = $('regularsBack');
  b.textContent = '‹ Title'; b.onclick = () => closeModal('regularsModal');
  $('regularsModal').classList.add('open');
}
// The ally picker: the same 3×3 cast grid, but each face selects that regular
// as your raid ally (current pick highlighted) and drops back to the setup
// screen. Overlays the raid setup modal, which stays open behind it.
function openAllyPicker() {
  if (typeof document === 'undefined') return;
  const body = $('regularsBody');
  body.className = 'castgrid';
  body.innerHTML = '';
  for (const name of BOT_POOL) {
    const p = PERSONALITIES[name];
    if (!p) continue;
    const portrait = portraitFor(name);
    const card = document.createElement('div');
    card.className = 'castcard' + (RAIDSET.allyBot === name ? ' selected' : '');
    card.innerHTML =
      `${portrait ? `<div class="castportrait" style="background-image:url('${portrait}')"></div>` : ''}` +
      `<h3>${name}</h3><div class="castepithet">${p.flavor}</div>` +
      coachNoteHtml(name, false);
    card.onclick = () => { RAIDSET.allyBot = name; closeModal('regularsModal'); renderRaidSetup(); };
    body.appendChild(card);
  }
  $('regularsModal').querySelector('h2').textContent = 'Choose your ally';
  const b = $('regularsBack');
  b.textContent = '‹ Back'; b.onclick = () => closeModal('regularsModal');
  $('regularsModal').classList.add('open');
}
// Standard-game company picker: the same cast grid, but an ordered multi-pick —
// tap regulars in seat order (numbered), tap again to drop. Overlays the setup
// modal; on phones the grid is the Regulars' one-column scroll.
function openCompanyPicker() {
  if (typeof document === 'undefined') return;
  const humans = humansFromSetup();
  const K = botSeatsOf(SETUP.mode, humans).length;
  const setTitle = () => { $('regularsModal').querySelector('h2').textContent = `Choose Your Company — ${SETUP.picks.length}/${K}`; };
  const draw = () => {
    const body = $('regularsBody');
    body.className = 'castgrid';
    body.innerHTML = '';
    for (const name of BOT_POOL) {
      const p = PERSONALITIES[name];
      if (!p) continue;
      const ord = SETUP.picks.indexOf(name);
      const portrait = portraitFor(name);
      const full = ord < 0 && SETUP.picks.length >= K;
      const card = document.createElement('div');
      card.className = 'castcard' + (ord >= 0 ? ' selected' : '') + (full ? ' dim' : '');
      card.innerHTML =
        `${portrait ? `<div class="castportrait" style="background-image:url('${portrait}')">${ord >= 0 ? `<span class="pickord">${ord + 1}</span>` : ''}</div>` : ''}` +
        `<h3>${name}</h3><div class="castepithet">${p.flavor}</div>`;
      card.onclick = () => {
        const i = SETUP.picks.indexOf(name);
        if (i >= 0) SETUP.picks.splice(i, 1);
        else if (SETUP.picks.length < K) SETUP.picks.push(name);
        draw(); setTitle();
      };
      body.appendChild(card);
    }
  };
  draw(); setTitle();
  const b = $('regularsBack');
  b.textContent = 'Done'; b.onclick = () => { closeModal('regularsModal'); renderSetup(); };
  $('regularsModal').classList.add('open');
}
function showRegular(name) {
  const p = PERSONALITIES[name];
  if (!p) return openRegulars();
  const portrait = portraitFor(name);
  const body = $('regularsBody');
  body.className = 'castdetail';
  body.innerHTML =
    `${portrait ? `<div class="castportrait-lg" style="background-image:url('${portrait}')"></div>` : ''}` +
    `<h3>${name}</h3><div class="castepithet">${p.flavor}</div>` +
    `<div class="castbio">${p.bio || ''}</div>` +
    coachNoteHtml(name, true);
  $('regularsModal').querySelector('h2').textContent = name;
  const b = $('regularsBack');
  b.textContent = '‹ The Regulars'; b.onclick = openRegulars;
}

// Render a grid of lesson/sub-menu cards into the Academy modal. Always leaves
// any in-progress lesson cleanly — no showdown/quit modal left stacked behind.
function academyMenu(title, items, back) {
  if (typeof document === 'undefined') return;
  clearTimeout(runTimer);
  TUT.active = false; TUT.lesson = null; INGAME = false; coachHide();
  for (const id of ['quitModal', 'setupModal', 'showdownModal', 'victoryModal', 'rulesModal', 'passModal']) closeModal(id);
  $('showdownResume').style.display = 'none';
  hideTitle();
  $('academyModal').querySelector('h2').textContent = title;
  const body = $('academyBody');
  body.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'optgrid';
  for (const l of items) {
    const el = document.createElement('div');
    el.className = 'bigopt';
    el.innerHTML = `<h3>${l.title}</h3><div class="bigoptdesc">${l.blurb}</div>`;
    el.onclick = l.opens ? () => openMenu(l.opens) : l.puzzle ? () => academyPuzzle(l.puzzle) : () => { closeModal('academyModal'); startLesson(l.id); };
    grid.appendChild(el);
  }
  body.appendChild(grid);
  const b = $('academyBack');
  b.textContent = back.label;
  b.onclick = back.fn;
  $('academyModal').classList.add('open');
}

function openMenu(which) {
  if (which === 'tutorials') openTutorials();
  else if (which === 'strategy') openStrategy();
  else if (which === 'puzzles') openPuzzles();
  else if (which === 'stones') openStonesMenu();
  else openAcademy();
}
function openTutorials() {
  academyMenu('Tutorials', LESSONS, { label: '‹ The Academy', fn: openAcademy });
}
function openStrategy() {
  const items = [{ opens: 'puzzles', title: 'Puzzles', blurb: 'One-move riddles — read the board, place the stone that wins it.' }].concat(STRATEGY);
  academyMenu('Strategy & Puzzles', items, { label: '‹ The Academy', fn: openAcademy });
}
function openPuzzles() {
  const items = PUZZLE_KEYS.filter(k => puzzleAcademySafe(PUZZLES[k])).map(k => ({ puzzle: k, title: PUZZLES[k].name, blurb: PUZZLES[k].flavor }));
  academyMenu('Puzzles', items, { label: '‹ Strategy & Puzzles', fn: openStrategy });
}
function openStonesMenu() {
  academyMenu('Lesson 2 — The Stones', STONE_LESSONS, { label: '‹ Tutorials', fn: openTutorials });
}

function startLesson(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  // Wipe any prior lesson's table so the intro reads on a clean slate (and no
  // stale hand/timer/showdown carries over between lessons).
  clearTimeout(runTimer);
  closeModal('academyModal');
  closeModal('showdownModal');
  if (typeof document !== 'undefined') {
    ['oppSeats', 'youSeats', 'panels', 'hand', 'announce', 'prompt', 'phaseNote', 'actionBar'].forEach(i => { const e = $(i); if (e) e.innerHTML = ''; });
    $('phaseLabel').textContent = 'Stonelock'; // clear the prior lesson's "Showdown" banner
    $('stoneTray').style.display = 'none';
    $('cursedNote').style.display = 'none';
    $('cursedBadge').style.display = 'none';
    $('nextHandBtn').style.display = '';
  }
  G = null;
  TUT.active = true; TUT.phase = 'intro'; TUT.seen = new Set();
  TUT.introStep = 0; TUT.minimized = false; TUT.current = null; TUT.lesson = lesson;
  hideTitle();
  tutIntro();
}

function tutIntro() {
  const intro = TUT.lesson.intro;
  const step = intro[TUT.introStep];
  coachShow(step.text, step.sel, {
    next: () => {
      TUT.introStep++;
      if (TUT.introStep < intro.length) tutIntro();
      else { TUT.phase = 'live'; coachHide(); newGame(TUT.lesson.cfg); G.tutorial = true; } // never resumable as a "Continue match"
    },
    nextLabel: TUT.introStep === intro.length - 1 ? 'Deal the hand' : 'Next',
  });
}

function tutorialTick() {
  const lesson = TUT.lesson;
  if (!lesson) return;
  if ($('showdownModal').classList.contains('open')) {
    if (!TUT.seen.has('showdown')) {
      TUT.seen.add('showdown');
      coachShow(lesson.showdown, '#showdownBody', { next: tutFinish, nextLabel: 'Finish lesson' });
    }
    return;
  }
  const key = UI.mode === 'pickStone' ? 'declare' :
    UI.mode === 'pickCards' ? 'deploy' :
    UI.mode === 'thin' ? 'thin' :
    UI.mode === 'placeChoose' ? 'place' : null;
  const step = key && lesson.live[key];
  if (step && !TUT.seen.has(key)) {
    TUT.seen.add(key);
    coachShow(step.text, step.sel, { action: true });
  } else if (!step || TUT.seen.has(key)) {
    if (!$('showdownModal').classList.contains('open')) coachHide();
  }
}

// The linear path through every runnable lesson — "Next" walks it straight,
// no menu in between. (The Stones submenu is only for deliberate selection.)
const LESSON_FLOW = ['cards', 'st-how', 'st-red', 'st-white', 'st-blue', 'st-black', 'match'];

function tutFinish() {
  const lesson = TUT.lesson;
  TUT.active = false; TUT.phase = 'idle';
  // Strategy situations stand alone — return to the Strategy menu to try another.
  if (lesson.id.startsWith('sg-')) {
    coachShow('Situation cleared. Try another, or head back to the Academy.', null, {
      next: () => { coachHide(); openStrategy(); }, nextLabel: '‹ Strategy & Puzzles',
      alt: { label: 'The Academy', fn: () => { coachHide(); openAcademy(); } },
    });
    return;
  }
  const nextId = LESSON_FLOW[LESSON_FLOW.indexOf(lesson.id) + 1];
  if (nextId) {
    const short = lessonById(nextId).title.replace(/^Lesson \d+ — /, '');
    coachShow('Lesson complete. Straight on, or back to the Academy to revisit any.', null, {
      next: () => { coachHide(); startLesson(nextId); }, nextLabel: `Next: ${short} ›`,
      alt: { label: 'The Academy', fn: () => { coachHide(); openAcademy(); } },
    });
  } else {
    coachShow('That completes the Academy basics — you know how to play. Deeper strategy lessons are still to come; for now, set your own table from the title.', null, {
      next: () => { coachHide(); openAcademy(); }, nextLabel: 'The Academy', alt: { label: 'To title', fn: showTitle },
    });
  }
}

/* ---------- Coach panel ---------- */

function tutHighlight(sel) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.tut-spotlight').forEach(e => e.classList.remove('tut-spotlight'));
  if (sel) { const el = document.querySelector(sel); if (el) el.classList.add('tut-spotlight'); }
}

function coachShow(html, sel, opts = {}) {
  if (typeof document === 'undefined') return;
  TUT.current = { html, sel, opts };
  // Honor a minimized preference: stash the lesson behind the restore pill.
  if (TUT.minimized) {
    $('coach').style.display = 'none';
    tutHighlight(null);
    $('coachRestore').style.display = '';
    return;
  }
  $('coachRestore').style.display = 'none';
  $('coachText').innerHTML = html;
  tutHighlight(sel);
  const next = $('coachNext');
  if (opts.next) {
    next.style.display = '';
    next.textContent = opts.nextLabel || 'Next';
    next.onclick = opts.next;
  } else {
    next.style.display = 'none'; // action-driven: the move itself advances
  }
  const skip = $('coachSkip');
  if (opts.alt) {
    skip.textContent = opts.alt.label;
    skip.onclick = opts.alt.fn;
  } else {
    skip.textContent = 'Exit lesson';
    skip.onclick = () => { coachHide(); openAcademy(); };
  }
  $('coach').style.display = '';
}

function coachHide() {
  if (typeof document === 'undefined') return;
  $('coach').style.display = 'none';
  $('coachRestore').style.display = 'none';
  tutHighlight(null);
  TUT.current = null;
}

function coachMinimize() {
  TUT.minimized = true;
  if (TUT.current) coachShow(TUT.current.html, TUT.current.sel, TUT.current.opts);
}

function coachRestoreShow() {
  TUT.minimized = false;
  if (TUT.current) coachShow(TUT.current.html, TUT.current.sel, TUT.current.opts);
}

function renderScore() {
  // The raid shows a visible countdown to Sudden Death (then flags it live).
  if (G.mode === 'raid') {
    const sd = G.handNum > RAID_SUDDEN_DEATH;
    $('handNum').textContent = sd ? `Hand ${G.handNum} · Sudden Death` : `Hand ${G.handNum} / ${RAID_SUDDEN_DEATH}`;
    $('handNum').classList.toggle('sudden', sd);
  } else {
    $('handNum').textContent = `Hand ${G.handNum}`;
    $('handNum').classList.remove('sudden');
  }
  $('regionBadge').textContent = `${G.venue.label} · ${G.region.subtitle}`;
  const cb = $('cursedBadge');
  cb.style.display = G.cursedType ? '' : 'none';
  if (G.cursedType) cb.textContent = `Cursed: ${G.cursedType}`;
  // A fixed banner in the scoreboard so the curse is always in view, not just
  // in the phase row and the log.
  const cn = $('cursedNote');
  cn.style.display = G.cursedType ? '' : 'none';
  if (G.cursedType) cn.innerHTML = `<span class="cursedmark">⊘</span> Cursed this hand: <b>${G.cursedType}</b><span class="cursedsub">scores nothing — no Pairs or Triads</span>`;
  if (G.mode === 'ffa') {
    const list = $('scoreList');
    list.innerHTML = '';
    const max = Math.max(1, ...G.scores);
    for (const p of G.players) {
      const row = document.createElement('div');
      row.className = 'scorerow' + (p.idx === 0 ? ' yourow' : '') + (G.scores[p.idx] === max && max > 0 ? ' leading' : '');
      const pct = Math.min(100, (G.scores[p.idx] / G.target) * 100);
      row.innerHTML = `
        <span class="scorename">${playerName(p.idx)}</span>
        <span class="scorebar"><span class="scorefill" style="width:${pct}%"></span></span>
        <span class="scorenum">${G.scores[p.idx]}</span>`;
      list.appendChild(row);
    }
  } else {
    const pct = 50 + (G.ledger / G.target) * 50;
    $('ledgerMarker').style.left = `${Math.max(0, Math.min(100, pct))}%`;
    $('ledgerEndAi').textContent = G.target;
    $('ledgerEndYou').textContent = G.target;
    const sides = G.mode === 'raid'
      ? ['the party', 'the Magistrate']
      : G.humans.length > 1
        ? [entities()[0].name, entities()[1].name]
        : ['your side', 'their side'];
    $('ledgerValue').textContent = G.ledger > 0 ? `+${G.ledger} ${sides[0]}` : G.ledger < 0 ? `+${-G.ledger} ${sides[1]}` : 'even';
  }
}

function renderPanels() {
  for (const p of G.players) {
    const i = p.idx;
    $(`pinfo-${i}`).textContent = `${p.hand.length} in hand · ${p.board.length} on table`;
    const rack = $(`rack-${i}`);
    rack.innerHTML = '';
    // Gauntlet: one of each stone — show which remain unplaced.
    if (G.variant === 'gauntlet') {
      for (const color of STONE_KEYS) {
        const col = document.createElement('div');
        col.className = 'minicol';
        const held = p.active.includes(color);
        const dot = document.createElement('span');
        dot.className = held ? `stonedot ${color}` : 'stonedot socket';
        dot.title = `${STONES[color].name} — ${STONES[color].power}` + (held ? '' : ' (placed)');
        col.appendChild(dot);
        rack.appendChild(col);
      }
      renderTelegraph(i, $(`tg-${i}`));
      continue;
    }
    for (const color of STONE_KEYS) {
      const col = document.createElement('div');
      col.className = 'minicol';
      const cap = (G.mode === 'raid' && isMagistrate(i)) ? 3 : 2; // the Magistrate's deep pouch
      const exhausted = G.exhaustHands ? slumBlocked(i, color) : 0;
      for (let k = 0; k < cap; k++) {
        const dot = document.createElement('span');
        const held = k < p.pool[color];
        const isExhausted = !held && k >= cap - exhausted;
        dot.className = held ? `stonedot ${color}` : 'stonedot socket' + (isExhausted ? ' exhausted' : '');
        dot.title = `${STONES[color].name} — ${STONES[color].power}: ${STONES[color].desc}` +
          (held ? '' : isExhausted ? ' (exhausted, returning soon)' : ' (telegraphed)');
        // The viewer's rack is the live pouch: declare from here too.
        if (i === G.viewer && held && UI.mode === 'pickStone') {
          dot.classList.add('targetable');
          dot.onclick = () => humanDeclare(color);
        }
        col.appendChild(dot);
      }
      rack.appendChild(col);
    }
    // The Apothecary always holds a Green Stone in reserve — its last-word cut.
    if (G.mode === 'raid' && G.raidBoss === 'apothecary' && isMagistrate(i)) {
      const col = document.createElement('div');
      col.className = 'minicol';
      const spent = G.events.some(e => e.color === 'green' && !e.undone);
      const dot = document.createElement('span');
      dot.className = spent ? 'stonedot socket' : 'stonedot green';
      dot.title = `${STONES.green.name} — ${STONES.green.power}: ${STONES.green.desc}` + (spent ? ' (the cut is made)' : ' (held for the last word)');
      col.appendChild(dot);
      rack.appendChild(col);
    }
    renderTelegraph(i, $(`tg-${i}`));
  }
}

// Read-only recap of the current table's settings, shown atop the Menu.
function renderTableSummary() {
  if (typeof document === 'undefined') return;
  const el = $('tableSummary');
  if (!el) return;
  if (!G || !INGAME) { el.innerHTML = ''; return; }
  const rows = [['Venue', `${G.venue.label} · ${G.region.name}`]];
  if (G.mode === 'raid') {
    rows.push(['Raid boss', `${playerName(1)} — ${raidDiff().label}`]);
    rows.push(['Party', G.humans.length > 1 ? 'Two players (co-op)' : 'You + an ally bot']);
  } else {
    const shape = G.mode === 'duel' ? 'Solo Duel' : G.mode === 'ffa' ? 'Free-for-All' : 'Paired Teams';
    const total = G.nPlayers, bots = total - G.humans.length, h = G.humans.length;
    rows.push(['Table', `${shape} · ${total} seats`]);
    rows.push(['Players', h <= 1 ? `You + ${bots} bot${bots === 1 ? '' : 's'}` : `${h} players + ${bots} bot${bots === 1 ? '' : 's'}`]);
  }
  rows.push(['Targeting', G.open ? 'Advanced' : 'Simplified']);
  if (G.mode !== 'raid') rows.push(['Deal', G.deal === 'house' ? 'House Deep Draft (9 cards)' : 'Small Game (5 cards)']);
  if (G.gauntlet) rows.push(['Win by', 'Standing depletion']);
  else rows.push(['Race to', String(G.target)]);
  el.innerHTML = '<div class="tstitle">This table</div>' +
    rows.map(([k, v]) => `<div class="tsrow"><span class="tskey">${k}</span><span class="tsval">${v}</span></div>`).join('');
}

function cardEl(card) {
  const el = document.createElement('div');
  const V = G.viewer;
  const visible = card.faceUp || card.known[V];
  // Allies' veiled cards stay hidden from you too — only your own
  // veiled cards (and revealed swaps) show their face.
  const showFace = card.faceUp || (card.known[V] && card.owner === V);
  el.className = 'card' + (showFace ? '' : ' back') + (card.faceUp ? ' faceup' : ' facedown') + (isPoisoned(card) ? ' poisoned' : '');
  el.dataset.cardId = card.id;
  if (showFace) {
    el.innerHTML = `
      <div class="cicon icon-${card.type}"></div>
      <div class="cname">${card.type}</div>
      ${cfxHtml(card)}
      ${cvalHtml(card)}`;
    if (!card.faceUp) {
      el.classList.add('veiled');
      const v = document.createElement('div');
      v.className = 'veilband';
      v.textContent = 'veiled';
      el.appendChild(v);
    }
  } else {
    // An opponent's face-down card is unknown to you — flag it as a mystery.
    // Why is it hidden? Bait, or something they mean to protect? That read is
    // part of the game.
    const mystery = !visible && isOpponent(G.viewer, card.owner);
    el.innerHTML = `<div class="backsigil">${mystery ? '?' : ''}</div>`;
    if (mystery) {
      el.classList.add('mystery');
      el.title = 'A hidden card — you can’t see what it is. Bait, or a card they mean to protect?';
    }
    if (visible) {
      const k = document.createElement('div');
      k.className = 'knownband';
      k.textContent = `you know: ${card.type}`;
      el.appendChild(k);
    }
  }
  if (card.stones.length) {
    const row = document.createElement('div');
    row.className = 'stonerow';
    for (const s of card.stones) {
      const dot = document.createElement('span');
      dot.className = `stonedot ${s.color}`;
      dot.title = `${STONES[s.color].name} (${s.by === G.viewer && G.humans.length === 1 ? 'yours' : playerName(s.by) + '’s'})`;
      row.appendChild(dot);
    }
    el.appendChild(row);
  }
  if ((UI.flashIds || []).includes(card.id)) el.classList.add('flash');
  if (card.prov) {
    el.classList.add('traded');
    const badge = document.createElement('div');
    badge.className = 'tradebadge';
    badge.textContent = '⇄';
    el.appendChild(badge);
    const partnerId = card.prov.partnerId;
    const partner = G.cards.find(c => c.id === partnerId);
    const partnerDesc = partner && (partner.faceUp || partner.known[G.viewer])
      ? `the ${partner.type}` : 'the veiled card';
    el.title = `Changed hands via ${card.prov.by === G.viewer && G.humans.length === 1 ? 'your' : playerName(card.prov.by) + '’s'} Blue Stone — traded for ${partnerDesc} (hover to see it).`;
    el.addEventListener('mouseenter', () => {
      const pe = document.querySelector(`[data-card-id="${partnerId}"]`);
      if (pe) pe.classList.add('tradepair');
      el.classList.add('tradepair');
    });
    el.addEventListener('mouseleave', () => {
      document.querySelectorAll('.tradepair').forEach(x => x.classList.remove('tradepair'));
    });
  }
  return el;
}

function renderBoard(who, container) {
  if (!container) return;
  container.innerHTML = '';
  const fp = footprintOf(who);
  const board = G.players[who].board;
  for (let i = 0; i < fp; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const label = document.createElement('div');
    label.className = 'slotlabel';
    label.textContent = isMagistrate(who) ? '' : slotName(i, fp);
    slot.appendChild(label);
    const card = board[i];
    if (card) {
      const el = cardEl(card);
      decorateTarget(card, el);
      slot.appendChild(el);
    } else {
      slot.classList.add('empty');
    }
    // The Archivist: paint the stones queued onto this slot, and make slots
    // clickable for stone-placement / card-commit.
    if (isSlotMode() && (G.archivist || (G.archQueue && G.archQueue.length))) {
      const gi = archGlobal(who, i);
      slot.dataset.gi = gi; // so a Blue's hover can light up its swap partner
      const pend = archPendingOn(gi);
      if (pend.length) {
        const row = document.createElement('div');
        row.className = 'stonerow queuedrow slotqueue';
        for (const s of pend) {
          const d = document.createElement('span');
          d.className = `stonedot pending ${s.color}${isVariant(s.key) ? ' variant' : ''}`;
          d.title = `Queued ${getStone(s.key).name} (${playerName(s.by)}) — waits in the ledger`;
          // Hover a queued Blue to highlight the two slots it swaps.
          if (s.color === 'blue' && s.other != null) {
            const pair = [gi, s.other];
            d.classList.add('swaplink');
            d.title = `Queued Blue Stone (${playerName(s.by)}) — swaps these two slots`;
            d.addEventListener('mouseenter', () => {
              document.querySelectorAll('.slot.swaphi').forEach(e => e.classList.remove('swaphi'));
              pair.forEach(g => { const el = document.querySelector(`.slot[data-gi="${g}"]`); if (el) el.classList.add('swaphi'); });
            });
            d.addEventListener('mouseleave', () => document.querySelectorAll('.slot.swaphi').forEach(e => e.classList.remove('swaphi')));
          }
          row.appendChild(d);
        }
        slot.appendChild(row);
      }
      decorateSlotTarget(who, i, gi, slot);
    }
    container.appendChild(slot);
  }
}

function decorateSlotTarget(who, pos, gi, slot) {
  const me = G.viewer;
  let ok = false;
  if (UI.mode === 'arch-slot') ok = archStoneTargetable(UI.pendingStone, gi);
  else if (UI.mode === 'arch-slot-blue-a') ok = true;
  else if (UI.mode === 'arch-slot-blue-b') ok = (gi !== UI.blueSlot);
  else if (UI.mode === 'arch-commit') ok = (who === me && !G.players[who].board[pos]);
  if (UI.mode === 'arch-slot-blue-b' && UI.blueSlot === gi) slot.classList.add('selected');
  if (ok) {
    slot.classList.add('targetable', 'slottarget');
    slot.onclick = () => humanTargetSlot(gi);
  }
}

function decorateTarget(card, el) {
  const me = G.viewer;
  let targetable = false;
  if (UI.mode === 'target-own') {
    targetable = UI.pendingStone === 'white'
      ? validWhiteTarget(card)
      : ((card.owner === me || G.open) && !isLocked(card) && !hasRed(card));
  } else if (UI.mode === 'target-blue-own') {
    targetable = (card.owner === me || G.open) && !isLocked(card);
  } else if (UI.mode === 'target-blue-opp') {
    targetable = (G.open ? card.owner !== UI.blueOwn.owner : isOpponent(me, card.owner)) && !isLocked(card);
    if (UI.blueOwn === card) el.classList.add('selected');
  } else if (UI.mode === 'target-black') {
    targetable = !!undoableEventFor(card);
  } else if (UI.mode === 'target-green') {
    // Green (poison) voids a rival's unlocked board card (any board when Open).
    targetable = (isOpponent(me, card.owner) || G.open) && card.zone === 'board' && !isLocked(card);
  }
  if (targetable) {
    el.classList.add('targetable');
    el.onclick = () => humanTargetCard(card);
  }
}

function renderHand() {
  const wrap = $('hand');
  wrap.innerHTML = '';
  $('handArea').querySelector('.arealabel').textContent =
    G.humans.length > 1 ? `${playerName(G.viewer)}’s hand` : 'Your hand';
  const dealt = UI.dealtIds || [];
  for (const card of G.players[G.viewer].hand) {
    const el = document.createElement('div');
    el.dataset.cardId = card.id;
    el.className = 'card hand-card' + (UI.selected.includes(card) ? ' selected' : '') + (dealt.includes(card.id) ? ' dealt' : '');
    el.innerHTML = `
      <div class="cicon icon-${card.type}"></div>
      <div class="cname">${card.type}</div>
      ${cfxHtml(card)}
      ${cvalHtml(card)}`;
    if (UI.mode === 'pickCards' || UI.mode === 'handedit' || UI.mode === 'disrupt') {
      el.classList.add('targetable');
      el.onclick = () => humanToggleCard(card);
    } else if (UI.mode === 'arch-commit') {
      el.classList.add('targetable');
      if (UI.commitCard === card) el.classList.add('selected');
      el.onclick = () => humanPickCommitCard(card);
    }
    wrap.appendChild(el);
  }
  UI.dealtIds = []; // one-shot: the deal-in animation plays on this render only
  $('handArea').style.display = G.players[G.viewer].hand.length ? '' : 'none';
}

// Contextual tray along the base of the play area: whenever a stone
// choice is due, the stones grow large down here and the hand makes
// way; during card commitment the hand takes the emphasis instead.
function renderTray() {
  const tray = $('stoneTray');
  const stonesEl = $('trayStones');
  const label = $('trayLabel');
  const p = G.players[G.viewer];
  let items = null;
  if (UI.mode === 'pickStone') {
    label.textContent = G.humans.length > 1 ? `${playerName(G.viewer)} — telegraph a stone` : 'Telegraph a stone';
    items = [];
    for (const color of STONE_KEYS) {
      for (let k = 0; k < p.pool[color]; k++) {
        items.push({ color, onClick: () => humanDeclare(color) });
      }
    }
  } else if (UI.mode === 'thin') {
    label.textContent = 'The Thinning — abandon one stone';
    items = p.declared.map((color, i) => ({ color, onClick: () => humanThin(i) }));
  } else if (UI.mode === 'placeChoose') {
    label.textContent = (p.forcedFirst && !p.stonePlaced) ? 'By the Ledger — place your first-drawn stone' : 'Place a stone';
    items = p.active.map(color => ({ color, onClick: () => humanChooseStone(color) }));
  }
  const visible = !!items;
  tray.style.display = visible ? '' : 'none';
  $('handArea').classList.toggle('min', visible);
  $('handArea').classList.toggle('focus', UI.mode === 'pickCards' || UI.mode === 'arch-commit' || UI.mode === 'handedit');
  if (!visible) { stonesEl.innerHTML = ''; return; } // clear stale clickable stones
  stonesEl.innerHTML = '';
  const trayStone = (key, onClick) => {
    const s = document.createElement('div');
    const st = getStone(key); // variant keys resolve to their base colour + label
    s.className = `stone big ${stoneBase(key)} targetable${isVariant(key) ? ' variant' : ''}`;
    s.title = `${st.name} — ${st.power}: ${st.desc}`;
    s.onclick = onClick;
    return s;
  };
  if (UI.mode === 'pickStone') {
    // Group the full pouch by color, like the sidebar racks.
    for (const color of STONE_KEYS) {
      if (p.pool[color] <= 0) continue;
      const col = document.createElement('div');
      col.className = 'traycol';
      for (let k = 0; k < p.pool[color]; k++) {
        col.appendChild(trayStone(color, () => humanDeclare(color)));
      }
      stonesEl.appendChild(col);
    }
  } else {
    // By the Ledger: while the opening lock holds, only the first-drawn stone is
    // live — it's ringed, the rest are dimmed until it's placed.
    const forced = (UI.mode === 'placeChoose' && p.forcedFirst && !p.stonePlaced) ? p.forcedFirst : null;
    for (const it of items) {
      const locked = forced && it.color !== forced;
      const el = trayStone(it.color, locked ? null : it.onClick);
      if (forced && it.color === forced) el.classList.add('forcedfirst');
      if (locked) { el.classList.remove('targetable'); el.classList.add('locked'); el.onclick = null; }
      stonesEl.appendChild(el);
    }
  }
}

function renderTelegraph(who, container) {
  if (!container) return;
  container.innerHTML = '';
  const p = G.players[who];
  const shown = p.declared.slice();
  for (let i = 0; i < shown.length; i++) {
    const color = shown[i];
    const s = document.createElement('div');
    s.className = `stone ${color}`;
    s.title = `${STONES[color].name} — ${STONES[color].power}`;
    if ((p.removed !== null || G.armed) && !isUsableTelegraph(p, color, i)) s.classList.add('spent');
    if (who === G.viewer && UI.mode === 'thin') {
      s.classList.add('targetable');
      s.onclick = () => humanThin(i);
    }
    if (who === G.viewer && UI.mode === 'placeChoose' && p.active.includes(color)) {
      s.classList.add('targetable');
      s.onclick = () => humanChooseStone(color);
    }
    container.appendChild(s);
  }
  if (p.removed) {
    const s = document.createElement('div');
    s.className = `stone ${p.removed} removed`;
    s.title = `${STONES[p.removed].name} — abandoned in the Thinning`;
    container.appendChild(s);
  }
  // The Apothecary's reserved Green cut, shown alongside its telegraphed stones.
  if (G.mode === 'raid' && G.raidBoss === 'apothecary' && isMagistrate(who)) {
    const spent = G.events.some(e => e.color === 'green' && !e.undone);
    const s = document.createElement('div');
    s.className = 'stone green' + (spent ? ' spent' : '');
    s.title = `${STONES.green.name} — ${STONES.green.power}` + (spent ? ' (the cut is made)' : ' (held for the last word)');
    container.appendChild(s);
  }
}

function isUsableTelegraph(p, color, idx) {
  const activeCount = p.active.filter(c => c === color).length;
  const shownBefore = p.declared.slice(0, idx + 1).filter(c => c === color).length;
  return shownBefore <= activeCount;
}

function renderControls() {
  const bar = $('actionBar');
  bar.innerHTML = '';
  if (UI.mode === 'pickCards') {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = `Commit ${UI.selected.length}/${UI.needed}`;
    b.disabled = UI.selected.length !== UI.needed;
    b.onclick = humanConfirmDeploy;
    bar.appendChild(b);
  }
  if (UI.mode === 'handedit') {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = UI.selected.length ? `Discard & redraw ${UI.selected.length}` : 'Keep your hand';
    b.onclick = humanConfirmHandEdit;
    bar.appendChild(b);
  }
  if (UI.mode === 'disrupt') {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = UI.selected.length ? 'Discard & disrupt' : 'Pass';
    b.onclick = humanConfirmDisrupt;
    bar.appendChild(b);
  }
  if (['target-own', 'target-blue-own', 'target-blue-opp', 'target-black', 'target-green'].includes(UI.mode)) {
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = '‹ Back';
    cancel.onclick = humanCancelStone;
    bar.appendChild(cancel);
    // Resolve variant keys (twinred/deadbolt/riptide/onyx) to their base colour:
    // STONES has no variant entries and stoneHasValidTarget switches on base
    // colours, so using the raw key here threw a TypeError mid-render.
    const baseColor = stoneBase(UI.pendingStone);
    const noTargets = !stoneHasValidTarget(baseColor);
    if (baseColor === 'black' || baseColor === 'blue' || noTargets) {
      const skip = document.createElement('button');
      skip.className = 'btn ghost';
      skip.textContent = 'Set it down without effect';
      skip.onclick = humanDiscardStone;
      bar.appendChild(skip);
    }
    if (noTargets) {
      setPrompt(`${getStone(UI.pendingStone).name} — no valid target remains. Set it down without effect.`);
    }
  }
  // Slot modes (Court of Precedence / Archivist): the same escapes, so a Black
  // with no Red/Blue to catch (or any stone) is never a softlock — Back to
  // re-choose, or set it down on the writ without effect.
  if (['arch-slot', 'arch-slot-blue-a', 'arch-slot-blue-b'].includes(UI.mode)) {
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = '‹ Back';
    cancel.onclick = humanCancelStone;
    bar.appendChild(cancel);
    const blackNoTarget = UI.pendingStone === 'black' && !archReverse()
      && !G.archQueue.some(p => p.color === 'red' || p.color === 'blue');
    if (UI.pendingStone === 'black' || UI.pendingStone === 'blue' || blackNoTarget) {
      const skip = document.createElement('button');
      skip.className = 'btn ghost';
      skip.textContent = 'Set it down without effect';
      skip.onclick = humanDiscardStone;
      bar.appendChild(skip);
    }
    if (blackNoTarget) {
      setPrompt('Black Stone — no slot carries a Red or Blue to undo. Set it down without effect.');
    }
  }
}

/* ---------- Modals ---------- */

function closeModal(id) {
  if (typeof document === 'undefined') return;
  $(id).classList.remove('open');
}

function handPicksHtml(s) {
  return s.picks.map(p => `
    <div class="pickcard${p.phantom ? ' phantom' : ''}${p.cursed ? ' cursedpick' : ''}" ${p.phantom ? 'title="Phantom — counts for the bonus, scores no points"' : p.cursed ? 'title="Cursed — voided this hand"' : ''}>
      <div class="cicon icon-${p.type}"></div>
      <div class="cname">${p.type}${p.phantom ? ' ✧' : ''}</div>
      <div class="cval ${(p.phantom||p.cursed)?'val-0':'val-'+regionVal(p.type)}">${p.phantom ? '✧' : p.cursed ? '0' : regionVal(p.type)}</div>
    </div>`).join('');
}
function handMathLine(s) {
  return `${s.raw} raw ${s.bonus ? `+ ${s.bonus} ${s.structure === 'triad' ? 'Triad' : 'Pair'} bonus` : ''}${s.penalty ? ` − ${s.penalty} Riverlock` : ''} — ${STRUCT_LABEL[s.structure]} (${s.score})`;
}

function showShowdownModal(d, review) {
  if (typeof document === 'undefined') return;
  if (d.raid) return showRaidShowdown(d, review);
  if (d.coop) return showCoopShowdown(d, review);
  const { sel, ents, winner, push, structuralOnly, diff, matchWinner, gains } = d;
  const m = $('showdownModal');
  const body = $('showdownBody');
  $('showdownTitle').textContent = (review ? `Hand ${d.hand} — ` : '') +
    (push ? (G.mode === 'ffa' ? 'Dead heat at the top' : 'A Push')
    : winner.members.includes(0) ? `${winner.name === 'You' ? 'You take' : winner.name + ' takes'} the showdown`
    : `${winner.name} takes the showdown`);

  function memberHtml(i) {
    const s = sel[i];
    const picksHtml = s.picks.map(p => `
      <div class="pickcard${p.phantom ? ' phantom' : ''}${p.cursed ? ' cursedpick' : ''}" ${p.phantom ? 'title="Phantom — counts for the bonus, scores no points"' : p.cursed ? 'title="Cursed — voided this hand"' : ''}>
        <div class="cicon icon-${p.type}"></div>
        <div class="cname">${p.type}${p.phantom ? ' ✧' : ''}</div>
        <div class="cval ${(p.phantom||p.cursed)?'val-0':'val-'+p.value}">${p.phantom ? '✧' : p.cursed ? '0' : p.value}</div>
      </div>`).join('');
    const caption = ents.length === G.players.length ? '' : `<div class="membername">${playerName(i)}</div>`;
    return `${caption}<div class="pickrow">${picksHtml}</div>
      <div class="mathline">${s.raw} raw ${s.bonus ? `+ ${s.bonus} ${s.structure === 'triad' ? 'Triad' : 'Pair'} bonus` : ''}${s.penalty ? ` − ${s.penalty} Riverlock` : ''} — ${STRUCT_LABEL[s.structure]} (${s.score})</div>`;
  }

  body.innerHTML = `<div class="showgrid">` + ents.map(e => `
    <div class="showhand">
      <h3>${e.name} — ${e.score} points</h3>
      ${e.members.map(memberHtml).join('')}
    </div>`).join('') + `</div>`;

  let verdict;
  if (G.mode === 'ffa') {
    verdict = gains.every(g => g === 0)
      ? 'Every hand scores level — nothing banked.'
      : `Each seat banks its lead over the lowest hand: ${ents.map((e, i) => `${e.name} <b>+${gains[i]}</b>`).join(' · ')}.`;
  }
  else if (push) verdict = 'A perfect mathematical tie. Nothing moves.';
  else if (structuralOnly) verdict = `${winner.name} wins on structure, but with no point difference nothing moves.`;
  else {
    const sideWord = G.humans.length > 1 ? `${winner.name}’s side` : winner.members.includes(0) ? 'your side' : 'their side';
    verdict = `The Ledger Stone shifts <b>${diff}</b> toward ${sideWord}. Ledger now <b>${G.ledger > 0 ? '+' + G.ledger : G.ledger}</b>.`;
  }

  body.innerHTML += `<div class="verdict">${verdict}</div>`;
  $('nextHandBtn').textContent = review ? '‹ Back to the table'
    : matchWinner ? 'See the result' : 'Next hand — the Dealer Token rotates';
  // In a lesson, the coach drives ("Finish lesson") — hide the Next-hand button
  // so it can't deal another hand of the same lesson out from under the coaching.
  $('nextHandBtn').style.display = (TUT.active && !review) ? 'none' : '';
  // The peek/minimize machinery is for normal play; in a guided lesson it just
  // lets you close the showdown out from under the coaching. Hide it.
  $('showdownPeek').style.display = (TUT.active && !review) ? 'none' : '';
  $('showdownResume').style.display = 'none';
  m.classList.add('open');
}

function showRaidShowdown(d, review) {
  const { sel, boss, teamScore, diff, matchWinner } = d;
  const bn = playerName(1);
  $('showdownTitle').textContent = (review ? `Hand ${d.hand} — ` : '') +
    (diff > 0 ? 'The party presses' : diff < 0 ? `${bn} answers` : `${bn} holds`);
  const party = [0, 2];
  const partyHtml = party.map(i => `
    <div class="showhand">
      <h3>${playerName(i)} — ${sel[i].score} points</h3>
      <div class="pickrow">${handPicksHtml(sel[i])}</div>
      <div class="mathline">${handMathLine(sel[i])}</div>
    </div>`).join('');
  const bossHtml = `
    <div class="showhand">
      <h3>${bn} — ${boss.score} points <span class="mathline">(two best hands)</span></h3>
      ${boss.hands.map(h => `<div class="pickrow">${handPicksHtml(h)}</div><div class="mathline">${handMathLine(h)}</div>`).join('')}
    </div>`;
  const verdict = diff > 0
    ? `Your party fields <b>${teamScore}</b> to ${bn}'s <b>${boss.score}</b> — the marker swings <b>${diff}</b> your way. Ledger now <b>${G.ledger > 0 ? '+' + G.ledger : G.ledger}</b>.`
    : diff < 0
      ? `${bn} fields <b>${boss.score}</b> to your <b>${teamScore}</b> and gains <b>${-diff}</b>. Ledger now <b>${G.ledger > 0 ? '+' + G.ledger : G.ledger}</b>.`
      : `Dead level at <b>${teamScore}</b> — ${bn} holds on the tie. Nothing moves.`;
  $('showdownBody').innerHTML =
    `<div class="raidteam"><div class="raidlabel">Your party — ${teamScore} combined</div><div class="showgrid">${partyHtml}</div></div>${bossHtml}<div class="verdict">${verdict}</div>`;
  $('nextHandBtn').textContent = review ? '‹ Back to the table'
    : matchWinner ? 'See the result' : 'Next hand';
  $('nextHandBtn').style.display = (TUT.active && !review) ? 'none' : '';
  $('showdownResume').style.display = 'none';
  $('showdownModal').classList.add('open');
}

// The 2v1 showdown read-out: your side's two hands (combined) against the lone
// foe's two best hands — Standing language, not the campaign ledger.
function showCoopShowdown(d, review) {
  const { sel, foe, teamScore, diff } = d;
  const fn = playerName(1);
  $('showdownTitle').textContent = (review ? `Hand ${d.hand} — ` : '') +
    (diff > 0 ? 'Your side presses' : diff < 0 ? `${fn} answers` : `${fn} holds`);
  const party = [0, 2];
  const partyHtml = party.map(i => `
    <div class="showhand">
      <h3>${playerName(i)} — ${sel[i].score} points</h3>
      <div class="pickrow">${handPicksHtml(sel[i])}</div>
      <div class="mathline">${handMathLine(sel[i])}</div>
    </div>`).join('');
  const foeHtml = `
    <div class="showhand">
      <h3>${fn} — ${foe.score} points <span class="mathline">(two best hands)</span></h3>
      ${foe.hands.map(h => `<div class="pickrow">${handPicksHtml(h)}</div><div class="mathline">${handMathLine(h)}</div>`).join('')}
    </div>`;
  const g = GAUNTLET;
  const verdict = diff > 0
    ? `Your side fields <b>${teamScore}</b> to ${fn}'s <b>${foe.score}</b> — you press their Standing by <b>${Math.min(diff, ccfg('dmgCap'))}</b>${g.foeHp != null ? ` (to ${g.foeHp}/${g.foeMax})` : ''}.`
    : diff < 0
      ? `${fn} fields <b>${foe.score}</b> across two hands to your side's <b>${teamScore}</b>, and presses you <b>${Math.min(-diff, ccfg('dmgCap'))}</b>${g.standing != null ? ` (Standing ${g.standing}/${g.maxStanding})` : ''}.`
      : `Dead level at <b>${teamScore}</b> — ${fn} holds. Nothing moves.`;
  $('showdownBody').innerHTML =
    `<div class="raidteam"><div class="raidlabel">Your side — ${teamScore} combined</div><div class="showgrid">${partyHtml}</div></div>${foeHtml}<div class="verdict">${verdict}</div>`;
  $('nextHandBtn').textContent = review ? '‹ Back to the table' : (G.over ? 'See the result' : 'Next hand');
  $('nextHandBtn').style.display = (TUT.active && !review) ? 'none' : '';
  $('showdownResume').style.display = 'none';
  $('showdownModal').classList.add('open');
}

function showVictory() {
  if (typeof document === 'undefined') return;
  const m = $('victoryModal');
  const uw = $('victoryUnlocks');
  if (uw) { uw.style.display = 'none'; uw.innerHTML = ''; }
  const vdp = $('victoryDialogue');
  if (vdp) { vdp.style.display = 'none'; vdp.innerHTML = ''; }
  if (G.mode === 'raid') {
    const won = G.ledger >= G.target;
    SFX.play(won ? 'win' : 'lose');
    $('victoryTitle').textContent = won ? `${playerName(1)} is broken` : `${playerName(1)} prevails`;
    $('victoryText').textContent = won
      ? `Your party drove the marker the full ${G.target} after ${G.handNum} hands. The high seat is empty — for now.`
      : `${playerName(1)} held the table after ${G.handNum} hands, grinding the marker ${G.target} the other way. It was never going to be fair.`;
    // The broken boss’s parting word, face to face (reset to hidden up top).
    const dp = $('victoryDialogue');
    if (dp && won && showCampaignDefeat()) { dp.style.display = ''; dp.innerHTML = dialoguePlate(playerName(1), bossDefeatLine(playerName(1)), { side: 'left' }); }
    const lines = won ? unlockLines(G.unlocked) : [];
    if (uw && lines.length) {
      uw.style.display = '';
      uw.innerHTML = `<div class="unlockhead">Newly Unlocked</div>` +
        lines.map(l => `<div class="unlockitem ${l.kind}">${l.text}</div>`).join('');
    }
    m.classList.add('open');
    return;
  }
  let winnerEnt;
  if (G.mode === 'ffa') {
    const w = G.scores.indexOf(Math.max(...G.scores));
    winnerEnt = entities()[w];
  } else {
    const e = entities();
    winnerEnt = G.ledger >= G.target ? e.find(x => x.members.includes(0)) : e.find(x => !x.members.includes(0));
  }
  const won = winnerEnt.members.some(isHuman);
  SFX.play(won ? 'win' : 'lose');
  if (G.humans.length > 1) {
    $('victoryTitle').textContent = `${winnerEnt.name} take${winnerEnt.members.length > 1 ? '' : 's'} the table`;
    $('victoryText').textContent = `The match settles at ${G.target} after ${G.handNum} hands. Somewhere down the line, someone is already complaining about how it was done.`;
  } else {
    $('victoryTitle').textContent = won ? 'The table is yours' : `${winnerEnt.name} cleans the table`;
    $('victoryText').textContent = won
      ? `${TEAM_MODES.has(G.mode) ? 'Your alliance' : 'You'} reached ${G.target} after ${G.handNum} hands. Somewhere down the line, someone is already complaining about how it was done.`
      : `${winnerEnt.name} reached ${G.target} after ${G.handNum} hands. You keep your property — this was an honor table — but not your pride.`;
  }
  m.classList.add('open');
}

/* ---------- Setup / boot ---------- */

/* Setup wizard: table → deal → match length, big option cards
   with a breadcrumb of picks and Back buttons. */

const SETUP_STEPS = [
  {
    key: 'venue', title: 'Choose the venue', hint: 'Rules variant — regional card values & house rules', options:
      Object.entries(VENUES).map(([v, info]) => ({ v, label: info.label, desc: info.desc })),
  },
  {
    key: 'mode', title: 'Choose the table', hint: 'The shape of the contest', options: [
      { v: 'duel', label: 'Solo Duel — 1v1', desc: 'Two seats, head to head. The Ledger Stone races by the net difference of each showdown.' },
      { v: 'ffa', label: 'Free-for-All — 4 seats', desc: 'Four seats, every seat for itself. Each showdown banks your margin over the lowest hand; first to the target, standing alone, wins.' },
      { v: 'teams', label: 'Paired Teams — 2v2', desc: 'Four seats in two alliances. Team totals decide the showdown, and partners may shelter each other.' },
    ],
  },
  {
    key: 'players', title: 'Choose the players', hint: 'How many seats are real people at this device', dynamic: true,
  },
  {
    key: 'company', title: 'Choose the company', hint: 'Which regulars take the other seats', options: [
      { v: 'usual', label: 'The Usual Table', desc: 'The regulars take their accustomed seats.' },
      { v: 'lottery', label: 'Draw Lots', desc: 'Seats are filled at random from whoever is in the room tonight.' },
      { v: 'choose', label: 'Choose Your Company', desc: 'Pick exactly who sits down, seat by seat.' },
    ],
  },
  {
    key: 'targeting', title: 'Choose the targeting', hint: 'How far stones may reach across layouts', options: [
      { v: 'standard', label: 'Simplified', desc: 'Stones bind as written: Red and Blue work your own layout against your rivals’; White may shelter an ally. The cleaner game.' },
      { v: 'open', label: 'Advanced', desc: 'Any stone may target any layout, allies included: red an ally’s pair, lock a rival’s dead card, trade between any two seats.' },
    ],
  },
  {
    key: 'deal', title: 'Choose the deal', hint: 'Cards dealt & the scoring footprint', options: [
      { v: 'small', label: 'Small Game', desc: '5 cards dealt, a 2-1-1 footprint, best 3 of 4 scored. The roadside standard.' },
      { v: 'house', label: 'House Deep Draft', desc: '9 cards dealt, a 2-2-1 footprint, best 3 of 5 scored. Leftovers are discarded dead.' },
    ],
  },
  {
    key: 'target', title: 'Choose the match length', hint: 'How far the Ledger Stone must travel to win', options: [
      { v: 10, label: 'Quick — to 10', desc: 'A fast settling of scores.' },
      { v: 20, label: 'Standard — to 20', desc: 'The common evening match.' },
      { v: 40, label: 'Full Sovereign Race — to 40', desc: 'The long campaign, as the nobles play it.' },
    ],
  },
];

let SETUP = null;

function openSetup() {
  if (typeof Music !== 'undefined') Music.setTrack('menu'); // menus carry the menu bed (e.g. after a raid)
  if (typeof document !== 'undefined') $('titleScreen').classList.remove('hidden'); // sit over the title, never a live match behind
  SETUP = { step: 'venue', venue: 'tavern', mode: 'duel', players: 'solo', company: 'usual', targeting: 'standard', deal: 'small', target: 20, names: ['', '', '', ''], picks: [], randomTeams: false, _open: null };
  renderSetup();
  $('setupModal').classList.add('open');
}

// A table shape has a fixed seat count; the chosen "players" option says
// which seats are real people (the rest are filled by bots).
function seatCountOf(shape) { return shape === 'duel' ? 2 : shape === 'coop' ? 3 : 4; }

const PLAYERS_OPTIONS = {
  duel: [
    { v: 'solo', humans: [0], label: 'Solo — you vs a bot', desc: 'You against one of the regulars across a quiet table.' },
    { v: 'hot2', humans: [0, 1], label: 'Hotseat — two players', desc: 'Two players share one device; veiled cards stay private as it passes between you.' },
  ],
  ffa: [
    { v: 'h1', humans: [0], label: '1 player + 3 bots', desc: 'You alone against three of the regulars.' },
    { v: 'h2', humans: [0, 1], label: '2 players + 2 bots', desc: 'Two real players and two bots — every seat for itself.' },
    { v: 'h3', humans: [0, 1, 2], label: '3 players + 1 bot', desc: 'Three real players and a single bot at the fourth seat.' },
    { v: 'h4', humans: [0, 1, 2, 3], label: '4 players — full table', desc: 'All four seats are real players, passing the device.' },
  ],
  teams: [
    { v: 'solo', humans: [0], label: '1 player + 3 bots', desc: 'You and a bot partner (the Old Hand) against two bots.' },
    { v: 'allies', humans: [0, 2], label: '2 players — allies', desc: 'You two partnered on one side, against two bots.' },
    { v: 'rivals', humans: [0, 1], label: '2 players — rivals', desc: 'Two real players on opposite sides, each with a bot partner.' },
    { v: 'h4', humans: [0, 1, 2, 3], label: '4 players — 2v2', desc: 'All four seats are real players, two against two.' },
  ],
};
function playersOptions(shape) { return PLAYERS_OPTIONS[shape] || PLAYERS_OPTIONS.duel; }
function humansFromSetup() {
  const opts = playersOptions(SETUP.mode);
  return (opts.find(o => o.v === SETUP.players) || opts[0]).humans;
}
function botSeatsOf(shape, humans) {
  const out = [];
  for (let s = 0; s < seatCountOf(shape); s++) if (!humans.includes(s)) out.push(s);
  return out;
}
// Describe each bot seat, in order, for the lineup picker.
function seatRoles(shape, humans) {
  return botSeatsOf(shape, humans).map(s =>
    shape === 'duel' ? 'your opponent'
      : shape === 'teams' ? (s % 2 === 0 ? 'your partner' : 'a rival')
        : 'a rival');
}

function renderSetup() {
  // Accordion: each setting is a collapsed row showing its current pick;
  // open one to change it. One confirm button at the bottom — no wall.
  const body = $('setupBody');
  body.innerHTML = '';
  // Screen 1 — venue: just the tables, in campaign order. Pick one to advance.
  if (SETUP.step !== 'rest') {
    $('setupModal').querySelector('h2').textContent = 'Choose the Venue';
    const venues = SETUP_STEPS.find(s => s.key === 'venue').options;
    const N = venues.length;
    if (SETUP.vfocus == null) {
      const cur = venues.findIndex(o => o.v === SETUP.venue);
      SETUP.vfocus = cur >= 0 ? cur : Math.max(0, venues.findIndex(o => venueUnlocked(o.v)));
    }
    SETUP.vfocus = Math.max(0, Math.min(N - 1, SETUP.vfocus));
    const fi = SETUP.vfocus, vopt = venues[fi], unlocked = venueUnlocked(vopt.v);
    const venueArt = v => `assets/bg/${v}.jpg`;

    body.innerHTML = '<p class="modalsub small">Pick the table — locked venues are earned by breaking the boss that keeps them.</p>';

    // A focused venue scene with a dock of thumbnails down the side — the same
    // carousel as the campaign. The house rule rides under the name (no later
    // screen carries it).
    const stage = document.createElement('div');
    stage.className = 'campstage';
    const arrow = (dir) => {
      const off = (dir < 0 && fi === 0) || (dir > 0 && fi === N - 1);
      const a = document.createElement('button');
      a.className = 'camparrow' + (off ? ' off' : ''); a.innerHTML = dir < 0 ? '▲' : '▼'; a.disabled = off;
      a.onclick = () => { SETUP.vfocus = fi + dir; renderSetup(); };
      return a;
    };
    const focus = document.createElement('div');
    focus.className = 'campfocus venuefocus' + (unlocked ? '' : ' locked');
    focus.innerHTML =
      `<div class="campfocus-art" style="background-image:url('${venueArt(vopt.v)}')">` +
        (unlocked ? '' : `<div class="camplockbig">🔒</div><div class="camplockinfo"><span>${venueLockHint(vopt.v)}</span></div>`) +
      `</div>` +
      `<div class="campfocus-name">${vopt.label}</div>` +
      (unlocked ? `<div class="campfocus-desc">${vopt.desc}</div>` : '');
    if (unlocked) focus.onclick = () => { SETUP.venue = vopt.v; SETUP.step = 'rest'; SETUP._open = null; renderSetup(); };
    stage.append(arrow(-1), focus, arrow(1));

    const dock = document.createElement('div');
    dock.className = 'campdock';
    venues.forEach((o, j) => {
      const ul = venueUnlocked(o.v);
      const dot = document.createElement('button');
      dot.className = 'campdot' + (j === fi ? ' current' : '') + (ul ? '' : ' locked');
      dot.style.backgroundImage = `url('${venueArt(o.v)}')`;
      dot.title = o.label + (ul ? '' : ' — locked');
      dot.innerHTML = ul ? '' : '<span class="dotbadge">🔒</span>';
      dot.onclick = () => { SETUP.vfocus = j; renderSetup(); };
      dock.appendChild(dot);
    });
    const sel = document.createElement('div');
    sel.className = 'campselect';
    sel.append(dock, stage);
    body.appendChild(sel);

    const vbtns = $('setupBtns'); vbtns.innerHTML = '';
    const vback = document.createElement('button');
    vback.className = 'btn'; vback.textContent = '‹ Title';
    vback.onclick = () => { closeModal('setupModal'); showTitle(); };
    vbtns.appendChild(vback);
    return;
  }
  // Screen 2 — the rest of the table settings, as the accordion.
  $('setupModal').querySelector('h2').textContent = `Set the Table — ${VENUES[SETUP.venue].label}`;
  // Keep the players choice valid for the current shape.
  if (!playersOptions(SETUP.mode).some(o => o.v === SETUP.players)) SETUP.players = playersOptions(SETUP.mode)[0].v;
  const humans = humansFromSetup();
  const K = botSeatsOf(SETUP.mode, humans).length; // bot seats to cast
  SETUP.picks = SETUP.picks.slice(0, K);
  if (SETUP._open === undefined) SETUP._open = null;
  const optionsOf = section => section.dynamic ? playersOptions(SETUP.mode) : section.options;
  const labelOf = key => {
    const s = SETUP_STEPS.find(s => s.key === key);
    if (!s) return '';
    const o = optionsOf(s).find(o => o.v === SETUP[key]);
    return o ? o.label : '';
  };

  for (const section of SETUP_STEPS) {
    if (section.key === 'venue') continue; // venue is chosen on screen 1
    if (section.key === 'company' && K === 0) continue; // pure hotseat: no AI seats
    const open = SETUP._open === section.key;
    const acc = document.createElement('div');
    acc.className = 'acc';

    const head = document.createElement('button');
    head.className = 'acchead' + (open ? ' open' : '');
    head.dataset.k = section.key;
    const heading = section.title.replace('Choose the ', 'The ').replace('Choose ', '');
    head.innerHTML =
      `<span class="acclabelwrap"><span class="acclabel">${heading}</span>` +
      (section.hint ? `<span class="accsub">${section.hint}</span>` : '') + `</span>` +
      `<span class="accpick">${labelOf(section.key)}<span class="accchev">›</span></span>`;
    head.onclick = () => { SETUP._open = open ? null : section.key; renderSetup(); };
    acc.appendChild(head);

    if (open) {
      const accbody = document.createElement('div');
      accbody.className = 'accbody';
      const buildOpt = (opt) => {
        const locked = section.key === 'venue' && !venueUnlocked(opt.v);
        const el = document.createElement('div');
        el.className = 'bigopt' + (SETUP[section.key] === opt.v ? ' selected' : '') + (locked ? ' locked' : '');
        el.dataset.v = opt.v;
        el.innerHTML = `<h3>${opt.label}${locked ? ' 🔒' : ''}</h3><div class="bigoptdesc">${locked ? venueLockHint(opt.v) : opt.desc}</div>`;
        if (locked) return el;
        el.onclick = () => {
          SETUP[section.key] = opt.v;
          // Changing the shape resets the players choice to that shape's
          // default; either change can alter how many bot seats remain.
          if (section.key === 'mode') SETUP.players = playersOptions(opt.v)[0].v;
          if (section.key === 'mode' || section.key === 'players') SETUP.picks = [];
          // Keep company open so the seat picker shows; otherwise the pick
          // collapses the row to its summary.
          SETUP._open = (section.key === 'company' && opt.v === 'choose') ? 'company' : null;
          renderSetup();
        };
        return el;
      };
      // Options may carry a `group` label; render each group under its own
      // subheading, preserving order.
      const groups = [];
      for (const opt of optionsOf(section)) {
        const g = opt.group || '';
        let bucket = groups.find(x => x.name === g);
        if (!bucket) { bucket = { name: g, opts: [] }; groups.push(bucket); }
        bucket.opts.push(opt);
      }
      for (const bucket of groups) {
        if (bucket.name) {
          const gl = document.createElement('div');
          gl.className = 'optgroup';
          gl.textContent = bucket.name;
          accbody.appendChild(gl);
        }
        const grid = document.createElement('div');
        grid.className = 'optgrid';
        for (const opt of bucket.opts) grid.appendChild(buildOpt(opt));
        accbody.appendChild(grid);
      }

      // The seat-by-seat picker opens the cast grid (like the campaign ally
      // picker) — a numbered, ordered multi-pick rather than a row of chips.
      if (section.key === 'company' && SETUP.company === 'choose' && K > 0) {
        const card = document.createElement('button');
        card.className = 'allycard';
        const names = SETUP.picks.length
          ? SETUP.picks.map((n, i) => `${i + 1}. ${n}`).join('  ·  ')
          : 'Tap to pick who sits down, seat by seat.';
        card.innerHTML =
          `<span class="allymeta"><span class="allyname">Your company — ${SETUP.picks.length}/${K} chosen</span>` +
          `<span class="allyflavor">${names}</span></span><span class="allychev">Choose ›</span>`;
        card.onclick = openCompanyPicker;
        accbody.appendChild(card);
        const roles = document.createElement('div');
        roles.className = 'rolesline';
        roles.textContent = 'Seats in order: ' + seatRoles(SETUP.mode, humans).map((r, i) => `${i + 1} — ${r}`).join(' · ');
        accbody.appendChild(roles);
      }
      acc.appendChild(accbody);
    }
    body.appendChild(acc);
  }

  // Two or more real players: take a name for each, always visible.
  if (humans.length > 1) {
    const row = document.createElement('div');
    row.className = 'namerow';
    const lab = document.createElement('span');
    lab.className = 'arealabel';
    lab.textContent = 'Who is playing?';
    row.appendChild(lab);
    for (let k = 0; k < humans.length; k++) {
      const inp = document.createElement('input');
      inp.className = 'nameinput';
      inp.placeholder = `Player ${k + 1}`;
      inp.maxLength = 16;
      inp.value = SETUP.names[k] || '';
      inp.oninput = () => { SETUP.names[k] = inp.value; };
      row.appendChild(inp);
    }
    // In 2v2, spell out the partnerships — seats {0,2} vs {1,3} interleave
    // the player numbers, so who's allied isn't obvious from the inputs.
    if (SETUP.mode === 'teams') {
      const fourHuman = humans.length === 4;
      // A full human 2v2 can shuffle who partners whom instead of the fixed pairing.
      if (fourHuman) {
        const toggle = document.createElement('button');
        toggle.className = 'botchip' + (SETUP.randomTeams ? ' selected' : '');
        toggle.textContent = (SETUP.randomTeams ? '✓ ' : '') + 'Random partners';
        toggle.title = 'Shuffle who sits with whom; you learn your side at the deal.';
        toggle.onclick = () => { SETUP.randomTeams = !SETUP.randomTeams; renderSetup(); };
        row.appendChild(toggle);
      }
      const note = document.createElement('div');
      note.className = 'rolesline';
      if (fourHuman && SETUP.randomTeams) {
        note.textContent = 'Partners drawn at random — you learn your side at the deal.';
      } else {
        const sideMembers = parity => humans
          .map((seat, k) => ({ seat, k }))
          .filter(x => x.seat % 2 === parity)
          .map(x => `Player ${x.k + 1}`);
        const botsOn = (...seats) => seats.filter(s => !humans.includes(s)).length;
        const sideStr = (members, bots) => {
          const parts = [...members];
          if (bots === 2) parts.push('two bots');
          else if (bots === 1) parts.push('a bot');
          return parts.join(' & ');
        };
        note.textContent = `Partners — ${sideStr(sideMembers(0), botsOn(0, 2))}  vs  ${sideStr(sideMembers(1), botsOn(1, 3))}`;
      }
      row.appendChild(note);
    }
    body.appendChild(row);
  }

  const r = REGIONS[VENUES[SETUP.venue].region];
  const vals = [3, 2, 1].map(v => `<b>${v}:</b> ${TYPES.filter(t => r.values[t] === v).join(', ')}`).join(' · ');
  // Each row already shows its pick, so just the venue's value table here.
  body.insertAdjacentHTML('beforeend',
    `<div class="valstrip">${r.name} — card values: ${vals}</div>`);

  const btns = $('setupBtns');
  btns.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'btn';
  back.textContent = '‹ Venue';
  back.onclick = () => { SETUP.step = 'venue'; SETUP._open = null; renderSetup(); };
  btns.appendChild(back);
  const deal = document.createElement('button');
  deal.id = 'startBtn';
  deal.className = 'btn primary big';
  const needPicks = SETUP.company === 'choose' && K > 0 && SETUP.picks.length !== K;
  deal.textContent = needPicks ? `Choose ${K - SETUP.picks.length} more for the table` : 'Deal the first hand';
  deal.disabled = needPicks;
  deal.onclick = startFromSetup;
  btns.appendChild(deal);
}

function startFromSetup() {
  closeModal('setupModal');
  logEl.innerHTML = '';
  const humans = humansFromSetup();
  const K = botSeatsOf(SETUP.mode, humans).length;
  let companyNames = null, drewLots = false;
  if (K > 0 && SETUP.company === 'lottery') {
    companyNames = shuffle(BOT_POOL.slice()).slice(0, K);
    drewLots = true;
  } else if (K > 0 && SETUP.company === 'choose') {
    companyNames = SETUP.picks.slice(0, K);
  } else if (K > 0 && SETUP.mode !== 'teams') {
    // The "usual" crowd: each venue has its own regulars, so the default
    // opponents vary by table rather than always being The Stranger. (Teams
    // keep their scripted Old Hand partner, handled in buildNames.)
    const crowd = (VENUES[SETUP.venue] && VENUES[SETUP.venue].regulars) || BOT_POOL;
    companyNames = crowd.slice(0, K);
  }
  let names = SETUP.names.map(s => (s || '').trim());
  // Random partners: shuffle the entered names across the four seats so the
  // {0,2} vs {1,3} pairing lands at random.
  if (SETUP.mode === 'teams' && SETUP.randomTeams && humans.length === 4) names = shuffle(names.slice(0, 4));
  newGame({
    venue: SETUP.venue, mode: SETUP.mode, humans, deal: SETUP.deal, target: SETUP.target, targeting: SETUP.targeting,
    names,
    companyNames, drewLots,
  });
}

/* ---------- Raid Boss setup (its own small screen) ---------- */

let RAIDSET = null;

function openRaidSetup() {
  if (typeof Music !== 'undefined') Music.setTrack('menu'); // the campaign screen is a menu — menu bed, not the boss theme
  if (typeof document !== 'undefined') $('titleScreen').classList.remove('hidden'); // sit over the title, never a live match behind
  RAIDSET = { step: 'boss', boss: null, ally: 'bot', allyBot: 'The Old Hand', diff: 'standard', target: RAID_TARGET, targeting: 'standard', names: ['', ''], anim: 'boss' };
  renderRaidSetup();
  $('setupModal').classList.add('open');
}

// PC + motion-OK gate for the campaign-screen slide transitions; everywhere
// else the screens simply swap, with no deferred render.
function raidShouldAnimate() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(min-width: 761px) and (prefers-reduced-motion: no-preference)').matches;
}

// Step 1: choose the boss. Each gets a lore card; picking one advances.
const RAID_BOSSES = [
  { v: 'magistrate', name: 'The Magistrate', lore: 'A wide, methodical board fielded face-up. It selects from a deep pouch, scores its two best hands, and never bluffs — powerful, and fair only in that. Difficulty sets how many stones it spends.' },
  { v: 'warden', name: 'The Warden', lore: 'Keeps one of every stone within reach and spends without mercy — snuffing, stealing, locking. It grinds YOUR disruption away: every stone you play is exhausted for a hand, while the Warden\'s own pouch never runs dry. Ration what you spend, or be worn down. Viciously tactical.' },
  { v: 'apothecary', name: 'The Apothecary', lore: 'A healer who deals in poisons. It fields a wide board and spends fewer ordinary stones than the others — because it always keeps a Green Stone for the last word, cutting the single best card you left unlocked to nothing. You cannot answer the scalpel after it falls; lock what matters most before it does.' },
  { v: 'quartermaster', name: 'The Quartermaster', lore: 'Keeper of the pouch. Each hand it locks away one stone-colour from the whole table — yours and its own — cycling red → white → blue → black as the match wears on. You can never settle into a favourite; every hand demands a different plan. It fields a wide board and scores its two best hands. Beat it to earn the Academy Gauntlet, where every stone is always at hand.' },
  { v: 'archivist', name: 'The Archivist', lore: 'A keeper of records who inverts the game. Both sides commit their layouts, then place stones onto the SLOTS — and nothing fires until every stone is down. The ledger then resolves in the order the stones were placed… or, on Hardcore, BACK TO FRONT. A boss of sequence and priority: read the queue, commit your cards around it, and win the order war. Advanced targeting is forced — it is a war for position across every layout.' },
  { v: 'crucible', name: 'The Crucible', super: true, lore: 'The final trial — every boss’s method at once. The inverted slot order, read BACK TO FRONT. One stone-colour locked from the whole table each hand. Every stone exhausted for a hand. A deep draw, advanced targeting forced — and a single Green scalpel the boss may bury anywhere, unanswerable. One difficulty: brutal. Earned only by breaking every other boss on Hardcore.' },
];

/* ---- Campaign progression ----
   Beating a boss at a difficulty unlocks the next difficulty of that boss AND
   that difficulty of the next boss — a diagonal climb from Magistrate · Easy.
   During alpha, an unlock-all bypass (default ON) keeps everything open. */
const RAID_DIFF_ORDER = ['easy', 'standard', 'hard'];
const _lsMem = {}; // in-memory fallback when localStorage is absent (headless/tests)
const ls = {
  get(k, d) { try { if (typeof localStorage !== 'undefined') return localStorage.getItem(k); } catch (e) {} return (k in _lsMem) ? _lsMem[k] : (d != null ? d : null); },
  set(k, v) { try { if (typeof localStorage !== 'undefined') { localStorage.setItem(k, v); return; } } catch (e) {} _lsMem[k] = v; },
};
function campaignBeaten() { try { return new Set(JSON.parse(ls.get('stonelock-campaign') || '[]')); } catch (e) { return new Set(); } }
function markCampaignWin(boss, diff) { const s = campaignBeaten(); s.add(`${boss}-${diff}`); ls.set('stonelock-campaign', JSON.stringify([...s])); }
function alphaUnlock() { const v = ls.get('stonelock-alpha'); return v === null ? true : v === '1'; } // default ON in alpha
function setAlphaUnlock(on) { ls.set('stonelock-alpha', on ? '1' : '0'); }
// First-run onboarding: has this player engaged yet? Used only to point a brand
// new player at the Academy (a "Start here" tag on the title). A returning player
// — any past Circuit run, campaign win, or seen charm — is already onboarded, so
// veterans are never nagged. The nudge also clears the moment they open the
// Academy or start any match (markOnboarded).
function onboarded() {
  if (ls.get('stonelock-onboard') === '1') return true;
  try { const r = circuitRecords(); if (r.runs.length || r.best.tables || Object.keys(r.seen).length) return true; } catch (e) {}
  try { if (campaignBeaten().size) return true; } catch (e) {}
  return false;
}
function markOnboarded() { ls.set('stonelock-onboard', '1'); }

/* ---- Dialogue preferences: which portrait scenes play. One settings home
   (see the Settings panel); the encounter screens read these gates. Campaign
   is 3-way (always / only until the boss is first cleared / off); the Circuit
   and event scenes are simple on/off. Defaults: everything on. ---- */
const DLG_KEY = 'stonelock-dialogue';
const DLG_DEFAULTS = { campaign: 'always', elites: true, cbosses: true, events: true };
function dialoguePrefs() {
  let p = null; try { p = JSON.parse(ls.get(DLG_KEY)); } catch (e) {}
  return Object.assign({}, DLG_DEFAULTS, p && typeof p === 'object' ? p : {});
}
function setDialoguePref(k, v) { const p = dialoguePrefs(); p[k] = v; ls.set(DLG_KEY, JSON.stringify(p)); }
function bossBeatenAny(bossVal) { return RAID_DIFF_ORDER.some(d => campaignBeaten().has(`${bossVal}-${d}`)); }
// Show the campaign boss's intro? 'firstclear' shows it only until you've broken
// that boss at least once (the story beat lands, then stops nagging on retries).
function showCampaignIntro(bossVal) { const c = dialoguePrefs().campaign; return c === 'always' || (c === 'firstclear' && !bossBeatenAny(bossVal)); }
// The defeat line rides the same setting; 'firstclear' shows it on the run that
// first breaks the boss (G.firstClearThisBoss is stamped before the win records).
function showCampaignDefeat() { const c = dialoguePrefs().campaign; return c === 'always' || (c === 'firstclear' && !!G.firstClearThisBoss); }
function showCircuitScene(nodeType) { const p = dialoguePrefs(); return nodeType === 'boss' ? p.cbosses : nodeType === 'elite' ? p.elites : false; }
function showEventScene() { return !!dialoguePrefs().events; }

/* ---- Input mode: 'mouse' (default) or 'keyboard' (arrow-cursor + number
   hotkeys; see the KB module). Persisted like the other settings. ---- */
const INPUT_KEY = 'stonelock-input';
// Keyboard mode is offered only on a mouse-driven computer (a device that can
// hover with a fine pointer) — phones and tablets report coarse/none and never
// see it. No API reveals a physical keyboard, so this pointer signal is the
// robust proxy. Headless/no-matchMedia contexts count as capable (tests, etc.).
function kbCapable() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
function inputMode() { return (kbCapable() && ls.get(INPUT_KEY) === 'keyboard') ? 'keyboard' : 'mouse'; }
function setInputMode(m) { ls.set(INPUT_KEY, m === 'keyboard' ? 'keyboard' : 'mouse'); if (typeof document !== 'undefined') applyInputMode(); }
function applyInputMode() {
  if (typeof document === 'undefined') return;
  const on = inputMode() === 'keyboard';
  document.body.classList.toggle('kbmode', on);
  if (typeof KB !== 'undefined') { if (on) KB.refresh(); else KB.clear(); }
}
function raidUnlocked(boss, diff) { return alphaUnlock() || bossDiffEarned(boss, diff, campaignBeaten()); }
// The real progression rule (independent of the alpha bypass) — used both for
// gating and for reporting what a win newly earns.
function bossDiffEarned(boss, diff, beaten) {
  // The Crucible: one trial, earned only by breaking every other boss on Hardcore.
  if (boss === 'crucible') return RAID_BOSSES.filter(b => b.v !== 'crucible').every(b => beaten.has(`${b.v}-hard`));
  const bosses = RAID_BOSSES.map(b => b.v);
  const bi = bosses.indexOf(boss), di = RAID_DIFF_ORDER.indexOf(diff);
  if (bi === 0 && di === 0) return true; // the entry point
  if (di > 0 && beaten.has(`${boss}-${RAID_DIFF_ORDER[di - 1]}`)) return true;   // next difficulty of this boss
  if (bi > 0 && beaten.has(`${bosses[bi - 1]}-${diff}`)) return true;             // this difficulty of the next boss
  return false;
}
function raidBossUnlocked(boss) { return RAID_DIFF_ORDER.some(d => raidUnlocked(boss, d)); }

/* ---- Venue unlocks: beat a boss (any difficulty) to earn its themed table ----
   Warden→Slum Tables, Apothecary→Gambling Hall, Quartermaster→Academy Gauntlet,
   Archivist→Court of Precedence (its stone-first inverted loop as a house rule).
   Venues not listed here are always open. Alpha bypass opens all. */
const VENUE_UNLOCK = { slums: 'warden', hall: 'apothecary', academy: 'quartermaster', court: 'archivist' };
function venueEarned(v, beaten) {
  const boss = VENUE_UNLOCK[v];
  if (!boss) return true; // a base / always-open table
  return RAID_DIFF_ORDER.some(d => beaten.has(`${boss}-${d}`));
}
function venueUnlocked(v) { return alphaUnlock() || venueEarned(v, campaignBeaten()); }
function venueLockHint(v) { return `Locked — beat <b>${raidBossName(VENUE_UNLOCK[v])}</b> in the campaign to earn this table.`; }

// A snapshot of everything EARNED in the real progression for a given beaten
// set (boss seats, difficulties, venues), as tokens. Diffing two snapshots
// across a win tells us exactly what that win newly opened.
function unlockSnapshot(beaten) {
  const s = new Set();
  for (const b of RAID_BOSSES) {
    if (RAID_DIFF_ORDER.some(d => bossDiffEarned(b.v, d, beaten))) s.add('boss:' + b.v);
    for (const d of RAID_DIFF_ORDER) if (bossDiffEarned(b.v, d, beaten)) s.add(`diff:${b.v}-${d}`);
  }
  for (const v of Object.keys(VENUE_UNLOCK)) if (venueEarned(v, beaten)) s.add('venue:' + v);
  return s;
}
// Record the win and return the tokens it newly earned (independent of alpha).
function recordCampaignWin(boss, diff) {
  const beatenBefore = campaignBeaten();
  if (typeof G !== 'undefined' && G) G.firstClearThisBoss = !RAID_DIFF_ORDER.some(d => beatenBefore.has(`${boss}-${d}`));
  const before = unlockSnapshot(beatenBefore);
  markCampaignWin(boss, diff);
  const after = unlockSnapshot(campaignBeaten());
  return [...after].filter(x => !before.has(x));
}
// Turn newly-earned tokens into display lines for the victory screen.
function unlockLines(gained) {
  if (!gained || !gained.length) return [];
  const bosses = gained.filter(t => t.startsWith('boss:')).map(t => t.slice(5));
  const bossSet = new Set(bosses);
  const venues = gained.filter(t => t.startsWith('venue:')).map(t => t.slice(6));
  const DIFF_LABEL = { easy: 'Easy', standard: 'Standard', hard: 'Hardcore' };
  const diffs = gained.filter(t => t.startsWith('diff:')).map(t => t.slice(5))
    .map(bd => { const i = bd.lastIndexOf('-'); return { boss: bd.slice(0, i), diff: bd.slice(i + 1) }; })
    .filter(x => !bossSet.has(x.boss)); // a brand-new boss's first tier is covered by its boss line
  const lines = [];
  if (bossSet.has('crucible')) lines.push({ kind: 'crucible', text: `<b>The Crucible</b> — every trial at once. The final seat opens.` });
  for (const b of bosses) if (b !== 'crucible') lines.push({ kind: 'boss', text: `<b>${raidBossName(b)}</b> takes the high seat — a new boss to break.` });
  for (const v of venues) lines.push({ kind: 'venue', text: `<b>${VENUES[v] ? VENUES[v].label : v}</b> — a new table to play.` });
  for (const x of diffs) lines.push({ kind: 'diff', text: `<b>${DIFF_LABEL[x.diff]}</b> opens against ${raidBossName(x.boss)}.` });
  return lines;
}

function renderRaidSetup() {
  const body = $('setupBody');
  const btns = $('setupBtns');
  const card = $('setupModal').querySelector('.modalcard');
  body.innerHTML = '';
  body.className = '';
  if (card) card.classList.remove('raidcompact');
  btns.innerHTML = '';
  // One-shot entrance flag, set only at genuine screen changes (open / focus /
  // back) so in-place re-renders — chip toggles, arrow paging — never replay it.
  const anim = RAIDSET.anim; RAIDSET.anim = null;

  if (RAIDSET.step === 'boss') {
    $('setupModal').querySelector('h2').textContent = 'The Campaign';
    const beaten = campaignBeaten();
    const frontier = RAID_BOSSES.findIndex(b => raidBossUnlocked(b.v) && !RAID_DIFF_ORDER.every(d => beaten.has(`${b.v}-${d}`)));
    const N = RAID_BOSSES.length;
    if (RAIDSET.focus == null) RAIDSET.focus = frontier >= 0 ? frontier : 0;
    RAIDSET.focus = Math.max(0, Math.min(N - 1, RAIDSET.focus));
    const meta = j => {
      const bb = RAID_BOSSES[j], unlocked = raidBossUnlocked(bb.v);
      const wins = RAID_DIFF_ORDER.filter(d => beaten.has(`${bb.v}-${d}`));
      return { unlocked, wins, mastered: wins.length === RAID_DIFF_ORDER.length, frontier: j === frontier };
    };
    const fi = RAIDSET.focus, b = RAID_BOSSES[fi], f = meta(fi);
    const status = !f.unlocked ? '🔒 Locked' : f.mastered ? '★ Mastered' : f.wins.length ? `Broken ×${f.wins.length}` : f.frontier ? 'Up Next' : 'Unlocked';
    const pips = RAID_DIFF_ORDER.map(d => `<span class="camppip${beaten.has(`${b.v}-${d}`) ? ' done' : ''}${!raidUnlocked(b.v, d) ? ' lk' : ''}" title="${d}"></span>`).join('');

    body.innerHTML = '<p class="modalsub small">Climb the high seats in turn — break one to earn your place at the next.</p>';

    // Focused stage: ▲ above / [big portrait + name + status] / ▼ below — the
    // up/down paning matches the vertical dock climb.
    const stage = document.createElement('div');
    stage.className = 'campstage';
    const arrow = (dir) => {
      const off = (dir < 0 && fi === 0) || (dir > 0 && fi === N - 1);
      const a = document.createElement('button');
      a.className = 'camparrow' + (off ? ' off' : ''); a.innerHTML = dir < 0 ? '▲' : '▼'; a.disabled = off;
      a.onclick = () => { RAIDSET.focus = fi + dir; renderRaidSetup(); };
      return a;
    };
    const prev = RAID_BOSSES[fi - 1];
    const unlockHint = b.v === 'crucible' ? 'Break every other boss on Hardcore to unlock'
      : prev ? `Defeat ${prev.name} to unlock this seat` : 'Locked';
    const focus = document.createElement('div');
    focus.className = 'campfocus' + (f.unlocked ? '' : ' locked') + (f.frontier ? ' frontier' : '');
    // Just the name under the portrait — the art and pips tell the rest. Locked
    // seats reveal their unlock requirement on hover.
    focus.innerHTML =
      `<div class="campfocus-art" style="background-image:url('${portraitFor(b.name)}')">` +
        `<div class="camppips" title="Difficulties cleared">${pips}</div>` +
        (f.unlocked ? '' : `<div class="camplockbig">🔒</div><div class="camplockinfo">${unlockHint}</div>`) +
      `</div>` +
      `<div class="campfocus-name">${b.name}</div>`;
    if (f.unlocked) focus.onclick = () => {
      const go = () => { RAIDSET.boss = b.v; RAIDSET.step = 'options'; RAIDSET.anim = 'options'; renderRaidSetup(); };
      // Fade the circle chain + arrows out, then hand off to the options screen.
      if (raidShouldAnimate()) { sel.classList.remove('preanim'); sel.classList.add('out'); setTimeout(go, 230); }
      else go();
    };
    stage.append(arrow(-1), focus, arrow(1));

    // Dock: the six bosses as connected circles down the left; the centred one is
    // highlighted, locks shown — a vertical climb mirroring the campaign.
    const dock = document.createElement('div');
    dock.className = 'campdock';
    RAID_BOSSES.forEach((bb, j) => {
      const m = meta(j);
      const dot = document.createElement('button');
      dot.className = 'campdot' + (j === fi ? ' current' : '') + (m.unlocked ? '' : ' locked') + (m.mastered ? ' mastered' : '');
      dot.style.backgroundImage = `url('${portraitFor(bb.name)}')`;
      dot.title = bb.name + (m.unlocked ? '' : ' — locked');
      dot.innerHTML = m.unlocked ? (m.mastered ? '<span class="dotbadge">★</span>' : '') : '<span class="dotbadge">🔒</span>';
      dot.onclick = () => { RAIDSET.focus = j; renderRaidSetup(); };
      dock.appendChild(dot);
    });
    const sel = document.createElement('div');
    const animBoss = anim === 'boss' && raidShouldAnimate();
    sel.className = 'campselect' + (animBoss ? ' preanim' : '');
    sel.append(dock, stage);
    body.appendChild(sel);
    // Returning from a boss: let the circle chain slide back into view.
    if (animBoss) requestAnimationFrame(() => requestAnimationFrame(() => sel.classList.remove('preanim')));

    const back = document.createElement('button');
    back.className = 'btn'; back.textContent = '‹ Title';
    back.onclick = () => { closeModal('setupModal'); showTitle(); };
    btns.appendChild(back);
    return;
  }
  // Keep the chosen difficulty valid for this boss's unlock state.
  if (!raidUnlocked(RAIDSET.boss, RAIDSET.diff)) {
    RAIDSET.diff = RAID_DIFF_ORDER.find(d => raidUnlocked(RAIDSET.boss, d)) || 'easy';
  }

  // Step 2: the rest of the raid options.
  $('setupModal').querySelector('h2').textContent = `Face ${raidBossName(RAIDSET.boss)}`;
  const isWarden = RAIDSET.boss === 'warden';
  const isApothecary = RAIDSET.boss === 'apothecary';
  const isArch = RAIDSET.boss === 'archivist';
  const isQM = RAIDSET.boss === 'quartermaster';
  const isCru = RAIDSET.boss === 'crucible';
  if (isCru) RAIDSET.diff = 'hard'; // the Crucible has a single trial
  const extra = isWarden ? ' It grinds <b>your</b> disruption away — every stone you play is <b>exhausted for a hand</b>, while its own pouch never empties.'
    : isApothecary ? ' It keeps a <b>Green Stone</b> for the last word, poisoning your best unlocked card — a <b>White lock</b> set in time is your only shield.'
    : isQM ? ' It locks one stone-colour from the whole table each hand, cycling <b>red → white → blue → black</b>.'
    : '';
  const bossArt = portraitFor(raidBossName(RAIDSET.boss));
  const intro = isCru
    ? `<b>The Crucible</b> — every trial at once: inverted slots resolved <b>back to front</b>, a colour <b>locked from the table</b> each hand, every stone <b>exhausted</b>, a <b>deep draw</b>, forced advanced targeting, and one buried <b>Green scalpel</b>. One difficulty — brutal.`
    : isArch
    ? `<b>The Archivist</b> inverts the game: both sides commit layouts, then place stones onto the <b>slots</b> — nothing fires until every stone is down, and the ledger resolves in placement order (<b>back to front</b> on Hardcore). Advanced targeting is forced.`
    : `A raid boss fields <b>${RAID_BOSS_CARDS} cards face-up</b>, telegraphs from a deep pouch, answers every move and keeps the last word. You and an ally combine your two scores — drive the marker the full distance to break it.${extra}`;
  body.className = 'raidopts';
  if (card) card.classList.add('raidcompact');
  // Two columns: a tall portrait dominating the left, full height of the
  // decision stack; the choices run down a justified column on the right.
  const layout = document.createElement('div');
  layout.className = 'raidlayout';
  const art = document.createElement('div');
  art.className = 'raidportrait';
  if (bossArt) art.style.backgroundImage = `url('${bossArt}')`;
  const choices = document.createElement('div');
  choices.className = 'raidchoices';
  layout.append(art, choices);
  body.appendChild(layout);

  const lore = document.createElement('p');
  lore.className = 'bosshead-lore';
  lore.innerHTML = intro;
  choices.appendChild(lore);

  // Compact chip-row picker: a labelled strip of toggles that fills the column
  // width, so every section squares up to the same measure. The headline
  // carries the choice; an optional one-word sub carries the only detail that
  // actually differs (stone counts, resolve order) — no brochure paragraphs.
  const chips = (title, key, opts, state) => {
    const h = document.createElement('div');
    h.className = 'steptitle'; h.textContent = title; choices.appendChild(h);
    const row = document.createElement('div'); row.className = 'chiprow';
    for (const o of opts) {
      const st = state ? state(o) : {};
      const c = document.createElement('button');
      c.className = 'pillopt' + (RAIDSET[key] === o.v ? ' selected' : '') + (st.locked ? ' locked' : '');
      const tag = st.locked ? ' 🔒' : st.beaten ? ' <span class="campwin">✓</span>' : '';
      c.innerHTML = `<span class="pilllabel">${o.label}${tag}</span>` + (o.sub ? `<span class="pillsub">${o.sub}</span>` : '');
      if (st.locked) c.title = st.hint || 'Locked.';
      else c.onclick = () => { RAIDSET[key] = o.v; renderRaidSetup(); };
      row.appendChild(c);
    }
    choices.appendChild(row);
  };
  const firstBoss = RAID_BOSSES.findIndex(bb => bb.v === RAIDSET.boss) === 0;
  const diffState = o => ({
    locked: !raidUnlocked(RAIDSET.boss, o.v),
    beaten: campaignBeaten().has(`${RAIDSET.boss}-${o.v}`),
    hint: firstBoss
      ? 'Locked — clear the lower difficulty here to unlock.'
      : 'Locked — win a lower difficulty here, or this difficulty against the previous boss, to unlock.',
  });

  chips('The party', 'ally', [
    { v: 'bot', label: 'You + Ally bot' },
    { v: 'hotseat', label: 'Two players', sub: 'co-op · pass device' },
  ]);

  if (RAIDSET.ally === 'bot') {
    // One ally card showing who's chosen; tap it to open the cast as a
    // selectable 3×3 grid rather than a row of inline chips.
    const name = RAIDSET.allyBot;
    const face = portraitFor(name);
    const p = PERSONALITIES[name] || {};
    const card2 = document.createElement('button');
    card2.className = 'allycard';
    card2.innerHTML =
      (face ? `<span class="allyface" style="background-image:url('${face}')"></span>` : '') +
      `<span class="allymeta"><span class="allyname">${name}</span>` +
      `<span class="allyflavor">${p.flavor || ''}</span></span>` +
      `<span class="allychev">Change ›</span>`;
    card2.onclick = openAllyPicker;
    choices.appendChild(card2);
  }

  if (RAIDSET.ally === 'hotseat') {
    const row = document.createElement('div');
    row.className = 'namerow';
    const lab = document.createElement('span'); lab.className = 'arealabel'; lab.textContent = 'The party:';
    row.appendChild(lab);
    [0, 1].forEach(k => {
      const inp = document.createElement('input');
      inp.className = 'nameinput';
      inp.placeholder = k === 0 ? 'Player One' : 'Player Two';
      inp.maxLength = 16; inp.value = RAIDSET.names[k] || '';
      inp.oninput = () => { RAIDSET.names[k] = inp.value; };
      row.appendChild(inp);
    });
    choices.appendChild(row);
  }

  if (!isCru) chips('Difficulty', 'diff', isArch ? [
    { v: 'easy', label: 'Easy', sub: '5 stones · forward' },
    { v: 'standard', label: 'Standard', sub: '6 stones · forward' },
    { v: 'hard', label: 'Hardcore', sub: '6 stones · reverse' },
  ] : isApothecary ? [
    { v: 'easy', label: 'Easy', sub: '1–2 stones' },
    { v: 'standard', label: 'Standard', sub: '2 + the cut' },
    { v: 'hard', label: 'Hardcore', sub: '3 + last cut' },
  ] : [
    { v: 'easy', label: 'Easy', sub: '5 stones' },
    { v: 'standard', label: 'Standard', sub: '6 stones' },
    { v: 'hard', label: 'Hardcore', sub: '7 stones' },
  ], diffState);

  RAIDSET.target = RAID_TARGET; // raids are a fixed-length trial — no picking a lucky short race

  if (isArch || isCru) {
    const note = document.createElement('div');
    note.className = 'rolesline';
    note.innerHTML = `Targeting: <b>Advanced (forced)</b> · Length: <b>race to ${RAID_TARGET}</b> · <b>Sudden Death</b> past hand ${RAID_SUDDEN_DEATH}`;
    choices.appendChild(note);
  } else {
    chips('Targeting', 'targeting', [
      { v: 'standard', label: 'Simplified', sub: 'stones bind as written' },
      { v: 'open', label: 'Advanced', sub: 'any stone, any layout' },
    ]);
    const note = document.createElement('div');
    note.className = 'rolesline';
    note.innerHTML = `Length: <b>race the marker to ${RAID_TARGET}</b> — fixed for every raid. <b>Sudden Death</b> past hand ${RAID_SUDDEN_DEATH}: the swing escalates until it breaks.`;
    choices.appendChild(note);
  }

  // Entrance: settle the portrait, then fade the choices in just behind it.
  // Pure transform/opacity (PC + reduced-motion gated in CSS); layout never
  // shifts, since the choices reserve their space the whole time. Only on a
  // real arrival — chip toggles add the settled class synchronously, no replay.
  if (anim === 'options' && raidShouldAnimate()) {
    requestAnimationFrame(() => requestAnimationFrame(() => layout.classList.add('in')));
  } else layout.classList.add('in');

  const back = document.createElement('button');
  back.className = 'btn'; back.textContent = '‹ Boss';
  back.onclick = () => {
    const go = () => { RAIDSET.step = 'boss'; RAIDSET.anim = 'boss'; renderRaidSetup(); };
    // Slide the portrait back to the right, then let the carousel return.
    if (raidShouldAnimate()) { layout.classList.remove('in'); layout.classList.add('out'); setTimeout(go, 250); }
    else go();
  };
  btns.appendChild(back);
  const begin = document.createElement('button');
  begin.id = 'startBtn'; begin.className = 'btn primary big'; begin.textContent = `Face ${raidBossName(RAIDSET.boss)}`;
  begin.onclick = () => {
    // Intro disabled (setting off, or already first-cleared): drop straight in.
    if (!showCampaignIntro(RAIDSET.boss)) { raidLaunch(); return; }
    // Otherwise slide the choice column out (as Back does) before the boss steps
    // in — so the settings→dialogue hand-off is one motion, not a hard cut.
    if (raidShouldAnimate()) { layout.classList.remove('in'); layout.classList.add('out'); setTimeout(raidBossIntroScreen, 250); }
    else raidBossIntroScreen();
  };
  btns.appendChild(begin);
}
// Drop from the setup/intro into the actual raid match.
function raidLaunch() {
  closeModal('setupModal');
  logEl.innerHTML = '';
  newGame({ mode: 'raid', raidBoss: RAIDSET.boss, raidAlly: RAIDSET.ally, allyBot: RAIDSET.allyBot, raidDiff: RAIDSET.diff, target: RAIDSET.target, targeting: RAIDSET.targeting, names: RAIDSET.names.map(s => s.trim()) });
}
// The boss’s one spoken word before the raid — a portrait plate over the setup
// modal, then a Sit-down that drops into the match.
function raidBossIntroScreen() {
  const boss = raidBossName(RAIDSET.boss);
  const body = $('setupBody'), btns = $('setupBtns');
  const card = $('setupModal').querySelector('.modalcard');
  if (card) card.classList.remove('raidcompact');
  $('setupModal').querySelector('h2').textContent = `${boss} takes the high seat`;
  body.className = 'raidintro';
  body.innerHTML = dialoguePlate(boss, bossIntroLine(boss), { side: 'right', foe: true }) + dialogueSkipLink('campaign');
  wireDialogueSkipLink(body);
  // Let the boss settle in from the right — one frame in the pre-state first.
  if (raidShouldAnimate()) requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('in')));
  else body.classList.add('in');
  btns.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'btn'; back.textContent = '‹ Back';
  back.onclick = () => {
    const go = () => { RAIDSET.anim = 'options'; renderRaidSetup(); };
    if (raidShouldAnimate()) { body.classList.remove('in'); body.classList.add('out'); setTimeout(go, 220); }
    else go();
  };
  const go = document.createElement('button');
  go.id = 'startBtn'; go.className = 'btn primary big'; go.textContent = 'Sit down';
  go.onclick = () => raidLaunch();
  btns.append(back, go);
}
// The one in-context concession: a quiet link under an encounter plate that
// disables that category on the spot (source of truth still lives in Settings).
// `kind` is a dialoguePrefs key: 'campaign' turns Off, the on/off kinds toggle off.
function dialogueSkipLink(kind) {
  return `<div class="dlgskip"><button class="dlgskip-b" data-dlg="${kind}">Turn these off ›</button></div>`;
}
function wireDialogueSkipLink(root) {
  const b = root.querySelector('.dlgskip-b'); if (!b) return;
  b.onclick = () => {
    setDialoguePref(b.dataset.dlg, b.dataset.dlg === 'campaign' ? 'off' : false);
    const wrap = b.closest('.dlgskip');
    if (wrap) wrap.innerHTML = '<span class="dlgskip-done">Off — re-enable in Settings</span>';
  };
}

/* ============================================================
   THE CIRCUIT — Phase 0 endless gauntlet (validation MVP)
   Back-to-back duels vs rotating Regulars and venues. A table is a duel of
   attrition between TWO Standing pools: each showdown, the hand's winner deals
   its (shaped) margin as damage to the loser's Standing. Drop the opponent's
   Standing to clear the table; lose your own and the run ends. There is no
   ledger tug-of-war — a lost hand costs YOUR Standing, it never un-does damage
   already dealt, so progress only moves forward. Your Standing carries across
   tables (healing a little per clear); each opponent gets fresh, slightly
   higher Standing as you climb (the difficulty ramp, independent of AI skill).
   All numbers are first-guess, meant to be tuned by playtest.
   ============================================================ */
const CIRCUIT = {
  // Standing 24 (was 20) buffers the opening so a fresh build survives long enough
  // to stabilise — it broke a brutal early wall (median run died at node ~2). The
  // steeper foe ramp (foeStep 1.2, was 0.8; foeBase 6, was 7) is a gentler opener
  // but a harder late game, moving deaths out of act 1 and into act 3. Act 2's old
  // dead zone (0 deaths) is closed by Foe Menace (below) — a scoring buff, since
  // HP scaling alone can't threaten a build that out-scores every hand.
  startStanding: 24, maxStanding: 24, dmgCap: 6, heal: 7, foeBase: 6, foeStep: 1.2, drawStones: 3,
  rewardCards: 3, rewardStones: 2, rewardCharms: 2, deckFloor: 6,
  // The run map: a few acts, each a short branching path of columns to a boss.
  acts: 3, actRows: 10, eliteHpMult: 1.25, bossHpMult: 1.5, placeStones: 2, coopFoeMult: 1.2,
  // Foe Menace — a flat per-card board read the foe gains by act, indexed [act-1].
  // Standing is HP, not scoring, so ramping foeHp alone never threatens a build
  // that simply out-scores every hand: it grinds any HP down without ever losing
  // Standing. Act 2 was the proof — 0 deaths in a 150-run battery, because the
  // mid-run build reliably out-scored a middling foe. A flat +1 to the act-2 foe's
  // every card lifts its SCORING enough to win hands and press your Standing back:
  // it turned the dead zone into ~10 deaths/150 and pulled the win rate from 37%
  // to a healthy ~30%. Act 1 stays clean (the opener is tuned by Standing already);
  // act 3 stays 0 because its ×1.5 boss HP + up to 3 boss charms already threaten —
  // stacking menace there crushed the win rate to ~15%. Tuned by the battery.
  foeMenace: [0, 1, 0],
  coinDuel: 4, coinElite: 8, coinBoss: 12,
  shopCard: 6, shopStone: 5, shopCharm: 12, shopThin: 8, shopHeal: 5, shopHealAmt: 6, shopUpgrade: 9,
  // Recognizable venues first; the big rule-shifts (Court = stone-first,
  // Academy = no telegraph/thin) arrive deeper in as escalation.
  venues: ['tavern', 'docks', 'slums', 'hall', 'court', 'academy'],
};
let GAUNTLET = { active: false, rung: 1, cleared: 0, standing: 14, maxStanding: 14, foeHp: 10, foeMax: 10, score: 0, opp: null, venue: null, tableCleared: false, groundOut: false, deck: null, pouch: null };

// Starter pouches (4 stones each) — leans, not extremes. A run offers 3 at
// random (shown as their composition, not named).
const POUCH_SIZE = 4; // stones in your opening pouch — you build it, max 2 of a colour
const CIRCUIT_POUCHES = [
  { key: 'locksmith', pouch: { white: 2, black: 1, red: 1 } },
  { key: 'ferryman', pouch: { blue: 2, black: 1, white: 1 } },
  { key: 'alchemist', pouch: { red: 2, blue: 1, black: 1 } },
  { key: 'duelist', pouch: { red: 1, white: 1, blue: 1, black: 1 } },
  { key: 'breaker', pouch: { black: 2, blue: 1, red: 1 } },
  { key: 'reaver', pouch: { blue: 2, red: 1, black: 1 } },
];
// The effect-card pool, derived from the registry — a new EFFECTS entry is
// offered in runs automatically. A run offers typed cards each carrying one fx
// rider, so the two-card add is a real decision (value vs. effect).
const CIRCUIT_FX = Object.keys(EFFECTS).filter(k => !EFFECTS[k].viaCharm); // charm-only effects never appear on offered cards
function circuitOfferCards(n, reveal = true) {
  const types = shuffle(TYPES.slice());
  const fxBag = shuffle(CIRCUIT_FX.slice());
  const out = [];
  for (let i = 0; i < n; i++) out.push({ type: types[i % types.length], fx: fxBag[i % fxBag.length] });
  // Discovery: an offered modifier reveals in the compendium — but ONLY for
  // in-run offers (rewards/shop/events). The pre-game starter offer is
  // re-rollable by cycling seeds, so it must not credit discovery (reveal=false).
  if (reveal) out.forEach(c => { if (c.fx) markCharmSeen('fx:' + c.fx); });
  return out;
}
// ── Starter archetypes (Circuit loadout) ──────────────────────────────────
// Four named decks you choose between at the door instead of drafting blind.
// Each run's deck is the 8 plain base (one of each type) + two signature effect
// cards that define the lane = a tuned 10-card deck. Then you pick ONE of three
// charms — a reward-style beat right at the start. The signature cards pin a
// base TYPE on purpose: for steady value (Road/Ferry never drop below 2), a
// venue arc (House-payoff types pay off as you climb), or to twin a plain base
// card (Keen·Crest fires off the base Crest from turn one). Portraits load from
// assets/portraits/<portrait>.jpg; a tinted gradient stands in until art lands.
const CIRCUIT_DECKS = [
  { key: 'vanguard', name: 'The Vanguard', portrait: 'vanguard', lane: 'Aggro — raw pressure',
    tint: ['#7a2d2d', '#c0563f'],
    blurb: 'Hit first, hit hardest — pump your own numbers and shave theirs.',
    cards: [{ type: 'Road', fx: 'gambit' }, { type: 'Bread', fx: 'siphon' }],
    charms: ['reckless', 'spite', 'firstblood'], grit: -8 }, // glass cannon (Bread=Coin=3 in bar, so the type swap is a wash here)
  { key: 'broker', name: 'The Broker', portrait: 'broker', lane: 'Value — dependable board',
    tint: ['#6b5424', '#caa23f'],
    blurb: 'No dead cards — a plain-heavy deck where every card reads its worth.',
    cards: [{ type: 'Coin', fx: 'ledger' }, { type: 'Chain', fx: 'anchor' }],
    charms: ['floorprice', 'crownjewel', 'loadedcoin'], grit: 0 }, // baseline; a Coin signature gives Loaded Coin two cards to buff
  { key: 'anvil', name: 'The Anvil', portrait: 'anvil', lane: 'Defense — board wall',
    tint: ['#2f4a4a', '#4f8f8a'],
    blurb: 'Outlast them — a packed board where every card props up its neighbors.',
    cards: [{ type: 'Ferry', fx: 'bulwark' }, { type: 'Sword', fx: 'lodestone' }],
    charms: ['bulwarkcharm', 'counterpunch', 'laststand'], grit: 3 }, // the wall
  { key: 'weaver', name: 'The Weaver', portrait: 'weaver', lane: 'Synergy — effect engine',
    tint: ['#3d2f5a', '#8163c4'],
    blurb: 'Stack effects into an engine — lift the weak, and snowball late.',
    cards: [{ type: 'Ferry', fx: 'harmony' }, { type: 'Crest', fx: 'surge' }],
    charms: ['whetstone', 'forgerseal', 'fullsatchel'], grit: 6 }, // both signatures floored (Ferry 2-3, Surge·Crest 3) + a buffer
];
function deckByKey(k) { return CIRCUIT_DECKS.find(d => d.key === k) || null; }
let circuitLoad = { pouch: null, deck: null, charm: null, chits: [] };
function stoneSummary(p) { return STONE_KEYS.filter(c => p[c]).map(c => `${p[c]} ${STONES[c].name.replace(' Stone', '')}`).join(' · '); }

let circuitSeed = 0;
function startCircuit(seed) {
  // Sit the intro/loadout/first-map over the title (as the other setups do), not
  // over a stale paused-match board — newGame hides the title at the first fight.
  if (typeof document !== 'undefined') $('titleScreen').classList.remove('hidden');
  // Seed the run BEFORE dealing options, so the seed reproduces the whole run
  // (loadout offers, map, fights, AI). An explicit NUMERIC seed = a shared/daily
  // run; anything else (incl. a stray MouseEvent from a bare onclick) is fresh.
  circuitSeed = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : freshSeed();
  seedRng(circuitSeed);
  // You compose your own opening: build a pouch (four stones, max two of a colour)
  // and choose one of four named starter decks + one charm. Carry the chits
  // forward; everything else resets. The pouch is yours to lay out, from EMPTY.
  circuitLoad = { pouch: { red: 0, white: 0, blue: 0, black: 0 }, deck: null, charm: null, chits: (circuitLoad.chits || []).filter(k => chitsUnlocked().some(c => c.key === k)) };
  if (typeof document === 'undefined') { circuitLoad.pouch = { red: 1, white: 1, blue: 1, black: 1 }; circuitLoad.deck = CIRCUIT_DECKS[0].key; circuitLoad.charm = CIRCUIT_DECKS[0].charms[0]; circuitBegin(); return; } // headless: auto-outfit (balanced pouch + first archetype)
  circuitIntro();
}

// A framing/confirm gate before the loadout decisions appear.
function circuitIntro() {
  if (typeof document === 'undefined') return;
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.remove('wide');
  // The hero carries the title/tagline; the modal's own h2/p are cleared (the
  // empty <p> collapses via CSS) so the banner reads as the front of the card.
  $('circuitTitle').textContent = '';
  $('circuitText').textContent = '';
  const isDaily = (circuitSeed >>> 0) === dailySeed();
  const stats = $('circuitStats'); stats.className = 'circuitintro'; stats.innerHTML = '';

  // Hero banner — art (assets/circuit-banner) over a painted gradient fallback.
  const hero = document.createElement('div'); hero.className = 'circuithero';
  hero.innerHTML = `<div class="circuithero-cap">` +
    `<div class="circuithero-kicker">A seeded roguelike run</div>` +
    `<div class="circuithero-title">The Circuit</div>` +
    `<div class="circuithero-tag">Three acts, one pouch — the long road to each boss.</div></div>`;
  stats.appendChild(hero);

  const lede = document.createElement('div'); lede.className = 'circuitlede';
  lede.textContent = 'Outfit a stone pouch and a deck, then pick your path through each act. Win fights for coin and spoils, draft charms, upgrade stones, and spend at The Fence as you climb.';
  stats.appendChild(lede);

  // Records & Compendium holds the best-results stats (nodes / score / charms) and
  // the archives — so the intro shows one button, not a duplicate stats box.
  const recRow = document.createElement('div'); recRow.className = 'introrecrow';
  const recordsBtn = document.createElement('button'); recordsBtn.className = 'btn introrecbtn'; recordsBtn.textContent = '📖 Records & Compendium'; recordsBtn.onclick = showCircuitRecords;
  recRow.appendChild(recordsBtn);
  stats.appendChild(recRow);

  // One compact seed bar: the seed is shown ONCE, inline-editable (type + ↵ to
  // play it), with reroll / daily beside it. Records is not here — it's its own thing.
  const seedbar = document.createElement('div'); seedbar.className = 'seedbar';
  const token = document.createElement('div'); token.className = 'seedtoken' + (isDaily ? ' daily' : '');
  token.innerHTML = '<span class="st-lab">Seed</span>';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.inputMode = 'numeric'; inp.className = 'st-num'; inp.value = String(circuitSeed >>> 0);
  inp.title = 'Same seed, same run — type one and press Enter to share a race';
  const playTyped = () => { const v = parseInt(inp.value, 10); if (!isNaN(v) && (v >>> 0) !== (circuitSeed >>> 0)) startCircuit(v >>> 0); };
  inp.onkeydown = e => { if (e.key === 'Enter') playTyped(); };
  inp.onfocus = () => inp.select();
  token.appendChild(inp);
  if (isDaily) token.insertAdjacentHTML('beforeend', '<span class="st-daily">☀ today’s daily</span>');
  seedbar.appendChild(token);
  const sBtn = (label, title, fn, on) => { const b = document.createElement('button'); b.className = 'seedbtn' + (on ? ' on' : ''); b.textContent = label; b.title = title; b.onclick = fn; return b; };
  seedbar.appendChild(sBtn('↻', 'New random seed', () => startCircuit()));
  seedbar.appendChild(sBtn('☀', 'Today’s daily run', () => startCircuit(dailySeed()), isDaily));
  stats.appendChild(seedbar);

  const next = $('circuitNext'); next.style.display = '';
  next.disabled = false; next.textContent = 'Outfit & set out ›'; next.onclick = circuitLoadoutScreen;
  circuitQuitToTitle(); // the briefing screen's secondary is "To title"
  $('circuitModal').classList.add('open');
}
// The shared circuitModal quit button: default "To title". The loadout re-points
// it at the briefing screen (see circuitLoadoutScreen) so Back doesn't punt you
// all the way out; every other screen restores this default.
function circuitQuitToTitle() {
  const q = $('circuitQuit'); if (!q) return;
  q.textContent = 'To title'; q.onclick = () => { closeModal('circuitModal'); showTitle(); };
}

// The records & charm compendium — past runs, best results, and the charms
// you've discovered (undiscovered ones stay blacked out, no effect text).
function showCircuitRecords() {
  if (typeof document === 'undefined') return;
  const rec = circuitRecords();
  const revealAll = alphaUnlock(); // the alpha lock lays the whole archive bare
  const shown = k => revealAll || !!rec.seen[k];
  const all = Object.keys(CHARMS), seen = all.filter(k => rec.seen[k]).length;
  let html = `<div class="ldsection"><div class="ldhead">Best results</div><div class="recbest">` +
    `<div><span class="recbig">${rec.best.tables}</span><span class="reclab">tables cleared</span></div>` +
    `<div><span class="recbig">${rec.best.score}</span><span class="reclab">best score</span></div>` +
    `<div><span class="recbig">${seen}/${all.length}</span><span class="reclab">charms found</span></div>` +
    `</div></div>`;
  html += `<div class="ldsection"><div class="ldhead">Recent runs</div>`;
  html += rec.runs.length
    ? `<div class="rechist">` + rec.runs.map(r => `<div class="recrow"><span class="recrow-t">${r.won ? '★ ' : ''}${r.tables} node${r.tables === 1 ? '' : 's'}</span><span class="recrow-s">${r.score} pts</span><span class="recrow-f">${r.won ? 'conquered the Circuit' : 'fell to ' + (r.foe || '—')}${r.seed != null ? ' · seed ' + (r.seed >>> 0) : ''}</span></div>`).join('') + `</div>`
    : `<div class="ldnote">No runs yet — set out on the Circuit.</div>`;
  html += `</div>`;
  const lockedCard = `<div class="compcard locked"><div class="compcard-h">? ? ?</div><div class="compcard-b">Undiscovered — meet it in a run to reveal it.</div></div>`;
  const compSection = (head, keys, info) => {
    const got = keys.filter(k => shown(k.seenKey)).length;
    return `<div class="ldsection"><div class="ldhead">${head} — ${got}/${keys.length}</div><div class="compendium">` +
      keys.map(k => shown(k.seenKey)
        ? `<div class="compcard"><div class="compcard-h">${info(k).h}</div><div class="compcard-b">${info(k).b}</div></div>`
        : lockedCard).join('') + `</div></div>`;
  };
  // Charms (relics)
  html += compSection('Charm compendium', all.map(k => ({ key: k, seenKey: k })), k => ({ h: CHARMS[k.key].label, b: CHARMS[k.key].blurb }));
  // Modifiers (effect-card riders)
  html += compSection('Modifier compendium', Object.keys(EFFECTS).map(k => ({ key: k, seenKey: 'fx:' + k })), k => ({ h: EFFECTS[k.key].label, b: EFFECTS[k.key].blurb }));
  // Stone variants (the pouch upgrade track)
  html += compSection('Stone variants', Object.keys(STONE_VARIANTS).map(k => ({ key: k, seenKey: 'var:' + k })), k => ({ h: `${STONE_VARIANTS[k.key].name} — ${STONE_VARIANTS[k.key].power}`, b: STONE_VARIANTS[k.key].desc }));
  $('recordsBody').innerHTML = html;
  $('recordsClose').onclick = () => closeModal('recordsModal');
  $('recordsModal').classList.add('open');
}

// Outfit screen: pick a pouch (shown as its stone composition, not named) and
// add 2 cards (real card visuals, click-to-select) to a base of one-of-each
// (→ a 10-card owned deck, intentionally smaller than the standard 64-pool).
function circuitLoadoutScreen() {
  if (typeof document === 'undefined') return;
  const mc = $('circuitModal').querySelector('.modalcard');
  if (mc) mc.classList.add('wide');
  $('circuitTitle').textContent = 'Outfit for the Circuit';
  $('circuitText').textContent = 'Lay out your stone pouch, then choose one of four decks and the charm to carry with it.';
  const body = $('circuitStats');
  body.className = 'circuitload';
  body.innerHTML = '';

  // Pouch — YOU lay it out: four stones, at most two of a colour. Click a palette
  // stone to add it, click a stone in the pouch to remove it. No random offers.
  const pouch = circuitLoad.pouch, pTotal = STONE_KEYS.reduce((s, c) => s + (pouch[c] || 0), 0);
  const ps = document.createElement('div'); ps.className = 'ldsection';
  ps.innerHTML = `<div class="ldhead">Your pouch — <b>${pTotal}/${POUCH_SIZE}</b> stones · draw ${CIRCUIT.drawStones} a hand, max two of a colour</div>`;
  const pbuild = document.createElement('div'); pbuild.className = 'pouchbuild';
  // The pouch itself — a centered row of four slots. Filled slots (click to remove)
  // then dashed empties, so the shape of what you still owe is always visible.
  const slots = document.createElement('div'); slots.className = 'pouchslots';
  for (const color of STONE_KEYS) for (let i = 0; i < (pouch[color] || 0); i++) {
    const d = document.createElement('button'); d.className = `stonedot big ${color} pouchpick`;
    d.setAttribute('data-tip-head', STONES[color].name); d.setAttribute('data-tip', 'Click to return it to the palette'); d.setAttribute('data-tip-cls', 'tip-' + color);
    d.onclick = () => { pouch[color]--; circuitLoadoutScreen(); };
    slots.appendChild(d);
  }
  for (let i = pTotal; i < POUCH_SIZE; i++) { const e = document.createElement('span'); e.className = 'stonedot big empty'; slots.appendChild(e); }
  pbuild.appendChild(slots);
  pbuild.appendChild(document.createElement('div')).className = 'pouchcap'; pbuild.lastChild.textContent = 'Add stones — max two of a colour';
  // Palette — centered below, one of each colour with a live count. Dims a colour
  // at two, and all when the pouch is full.
  const pal = document.createElement('div'); pal.className = 'pouchpalette';
  for (const color of STONE_KEYS) {
    const cnt = pouch[color] || 0, atMax = cnt >= 2, full = atMax || pTotal >= POUCH_SIZE;
    const b = document.createElement('button'); b.className = 'palstone' + (full ? ' full' : '') + (atMax ? ' maxed' : '');
    b.innerHTML = `<span class="stonedot big ${color}"></span><span class="palcount">${STONES[color].name.replace(' Stone', '')} · ${cnt}/2</span>`;
    b.setAttribute('data-tip-head', `${STONES[color].name} — ${STONES[color].power}`); b.setAttribute('data-tip', STONES[color].desc); b.setAttribute('data-tip-cls', 'tip-' + color);
    if (!full) b.onclick = () => { pouch[color] = cnt + 1; circuitLoadoutScreen(); };
    else b.disabled = true;
    pal.appendChild(b);
  }
  pbuild.appendChild(pal);
  ps.appendChild(pbuild);
  body.appendChild(ps);

  // Deck — a compact slot that opens the full-page picker. Empty until you
  // choose; once you do, it shows your pick (portrait + name + charm). Re-click
  // to change. The picker itself (renderDeckPicker) is the big carousel.
  const cs = document.createElement('div'); cs.className = 'ldsection';
  cs.innerHTML = `<div class="ldhead">Your deck</div>`;
  const dk = circuitLoad.deck ? deckByKey(circuitLoad.deck) : null;
  const slot = document.createElement('button'); slot.className = 'deckslot' + (dk && circuitLoad.charm ? ' filled' : ' empty');
  if (dk && circuitLoad.charm) {
    const rc = CHARMS[circuitLoad.charm] || { label: circuitLoad.charm };
    slot.style.setProperty('--d1', dk.tint[0]); slot.style.setProperty('--d2', dk.tint[1]);
    slot.innerHTML =
      `<div class="deckslot-art" style="background-image:url('assets/portraits/${dk.portrait}.jpg?v=2'), linear-gradient(150deg, ${dk.tint[0]}, ${dk.tint[1]})"></div>` +
      `<div class="deckslot-info"><div class="deckslot-name">${dk.name}</div><div class="deckslot-lane">${dk.lane}</div>` +
      `<div class="deckslot-charm">Charm — <b>${rc.label}</b></div></div>` +
      `<div class="deckslot-change">Change ▾</div>`;
  } else {
    slot.innerHTML =
      `<div class="deckslot-plus">＋</div>` +
      `<div class="deckslot-info"><div class="deckslot-name">Choose your deck</div><div class="deckslot-lane">Four archetypes — pick one and the charm it carries</div></div>` +
      `<div class="deckslot-change">Open ›</div>`;
  }
  slot.onclick = openDeckPicker;
  cs.appendChild(slot);
  body.appendChild(cs);

  // Debts — a compact summary on the build; the picker lives behind a button so
  // the loadout stays clean. Hidden until the first is earned.
  const unlocked = chitsUnlocked();
  const sel = (circuitLoad.chits || []).filter(k => unlocked.some(c => c.key === k)).slice(0, activeChitCap());
  circuitLoad.chits = sel;
  const val = chitValue(sel);
  const ds = document.createElement('div'); ds.className = 'ldsection lddebts';
  if (!unlocked.length) {
    ds.innerHTML = `<div class="ldhead">Debts — difficulty modifiers</div><div class="ldnote">Clear a run to earn your first Debt. Each one you carry raises the stakes; clear harder runs to earn more.</div>`;
  } else {
    ds.innerHTML = `<div class="ldhead">Debts — this run: <b>${val} chit${val === 1 ? '' : 's'}</b></div>`;
    const bar = document.createElement('div'); bar.className = 'ldchitbar';
    const btn = document.createElement('button'); btn.className = 'btn ldchitbtn';
    btn.textContent = sel.length ? 'Change Debts ›' : 'Raise the stakes ›';
    btn.onclick = openChitMenu;
    bar.appendChild(btn);
    const sum = document.createElement('div'); sum.className = 'ldchitsummary';
    sum.innerHTML = sel.length ? chitPileHtml(sel) : `<span class="ldchip empty">No Debts — an honest run</span>`;
    bar.appendChild(sum);
    ds.appendChild(bar);
  }
  body.appendChild(ds);

  const pouchFull = STONE_KEYS.reduce((s, c) => s + (circuitLoad.pouch[c] || 0), 0) === POUCH_SIZE;
  const deckReady = !!circuitLoad.deck && !!circuitLoad.charm;
  const ready = pouchFull && deckReady;
  const next = $('circuitNext'); next.style.display = '';
  next.textContent = !ready
    ? (!pouchFull ? 'Fill your pouch…' : 'Choose your deck…')
    : (val > 0 ? `Begin — ${val} chit${val === 1 ? '' : 's'} ›` : 'Begin the Circuit ›');
  next.disabled = !ready;
  next.onclick = () => { if (ready) circuitBegin(); };
  const back = $('circuitQuit'); if (back) { back.textContent = '‹ Back'; back.onclick = () => circuitIntro(); } // back to the briefing, not the title
  $('circuitModal').classList.add('open');
}

// The deck picker — a full-page horizontal carousel (the campaign boss browser,
// laid on its side): one archetype at a time with its portrait big enough to
// actually read, its two signature cards + three charm choices beside it, ‹ ›
// to page (wrapping endlessly), a dock of four below. Picking a charm locks the
// deck in and returns to the outfit. Back returns without changing your pick.
function openDeckPicker() {
  if (typeof document === 'undefined') return;
  if (circuitLoad.deckIdx == null) circuitLoad.deckIdx = Math.max(0, CIRCUIT_DECKS.findIndex(d => d.key === circuitLoad.deck));
  renderDeckPicker();
}
function renderDeckPicker() {
  const N = CIRCUIT_DECKS.length;
  circuitLoad.deckIdx = (((circuitLoad.deckIdx || 0) % N) + N) % N;
  const di = circuitLoad.deckIdx, dk = CIRCUIT_DECKS[di];
  const esc = s => String(s == null ? '' : s).replace(/"/g, '&quot;');
  $('circuitTitle').textContent = 'Choose your deck';
  $('circuitText').textContent = 'Eight plain cards plus two signature cards — pick the charm to carry and lock the deck in.';
  const body = $('circuitStats'); body.className = 'circuitload deckpicker'; body.innerHTML = '';

  const goIdx = i => { circuitLoad.deckIdx = ((i % N) + N) % N; renderDeckPicker(); }; // wraps both ways

  const carousel = document.createElement('div'); carousel.className = 'deckcarousel';
  const arrow = dir => {
    const a = document.createElement('button'); a.className = 'camparrow deckarrow';
    a.innerHTML = dir < 0 ? '‹' : '›'; a.setAttribute('aria-label', dir < 0 ? 'Previous deck' : 'Next deck');
    a.onclick = () => goIdx(di + dir);
    return a;
  };

  const hero = document.createElement('div'); hero.className = 'deckhero enter';
  hero.style.setProperty('--d1', dk.tint[0]); hero.style.setProperty('--d2', dk.tint[1]);
  const art = document.createElement('div'); art.className = 'deckhero-art';
  art.style.backgroundImage = `url('assets/portraits/${dk.portrait}.jpg?v=2'), linear-gradient(150deg, ${dk.tint[0]}, ${dk.tint[1]})`;
  const panel = document.createElement('div'); panel.className = 'deckhero-panel';
  const cardsHtml = dk.cards.map(c => {
    const v = (c.fx === 'anchor') ? CIRCUIT_ANCHOR : (REGIONS.bar.values[c.type] != null ? REGIONS.bar.values[c.type] : 2);
    const info = FX_INFO[c.fx] || { label: c.fx };
    return `<div class="card faceup loadcard mini"><div class="cval val-${v}">${v}</div><div class="cfx cfx-${c.fx}">${info.label}</div><div class="cicon icon-${c.type}"></div><div class="cname">${c.type}</div></div>`;
  }).join('');
  const charmHtml = dk.charms.map(ck => {
    const ch = CHARMS[ck] || { label: ck, blurb: '' };
    const picked = circuitLoad.deck === dk.key && circuitLoad.charm === ck;
    return `<button class="deckcharm${picked ? ' picked' : ''}" data-charm="${ck}" data-tip-head="${esc(ch.label)}" data-tip="${esc(ch.blurb)}" data-tip-cls="tip-gold"><span class="charmdot"></span><span class="charmname">${ch.label}</span><span class="charmblurb">${esc(ch.blurb)}</span></button>`;
  }).join('');
  // Signature-card effects spelled out inline (not hover-only) so touch players
  // read them too — same reason the charm blurbs sit under each charm.
  const cardFx = dk.cards.map(c => { const info = FX_INFO[c.fx] || { label: c.fx, blurb: '' }; return `<div class="deckfx-line"><b>${info.label}</b> — ${info.blurb}</div>`; }).join('');
  panel.innerHTML =
    `<div class="deckhero-id"><span class="deckname">${dk.name}</span><span class="deckcount">${di + 1} / ${N}</span></div>` +
    `<div class="decklane">${dk.lane}</div>` +
    `<div class="deckblurb">${dk.blurb}</div>` +
    `<div class="deckcards-lab">Signature cards <span class="deckplus">+ 8 plain (one of each type)</span></div>` +
    `<div class="deckcards">${cardsHtml}</div>` +
    `<div class="deckcards-fx">${cardFx}</div>` +
    `<div class="deckcharms-lab">Pick one charm to choose this deck</div>` +
    `<div class="deckcharms">${charmHtml}</div>`;
  panel.querySelectorAll('.deckcharm').forEach(b => {
    b.onclick = () => { circuitLoad.deck = dk.key; circuitLoad.charm = b.dataset.charm; circuitLoadoutScreen(); }; // commit + back to outfit
  });
  hero.append(art, panel);
  carousel.append(arrow(-1), hero, arrow(1));
  body.appendChild(carousel);

  const dock = document.createElement('div'); dock.className = 'deckdock';
  CIRCUIT_DECKS.forEach((dd, j) => {
    const dot = document.createElement('button');
    dot.className = 'deckdot' + (j === di ? ' current' : '') + (circuitLoad.deck === dd.key ? ' chosen' : '');
    dot.style.backgroundImage = `url('assets/portraits/${dd.portrait}.jpg?v=2'), linear-gradient(150deg, ${dd.tint[0]}, ${dd.tint[1]})`;
    dot.setAttribute('data-tip-head', dd.name); dot.setAttribute('data-tip', dd.lane); dot.setAttribute('data-tip-cls', 'tip-gold');
    dot.onclick = () => goIdx(j);
    dock.appendChild(dot);
  });
  body.appendChild(dock);

  const next = $('circuitNext'); next.style.display = 'none'; // committing is done by picking a charm
  const back = $('circuitQuit'); if (back) { back.style.display = ''; back.textContent = '‹ Back to outfit'; back.onclick = () => circuitLoadoutScreen(); }
  $('circuitModal').classList.add('open');
}

// The Debts picker (opened from the loadout): the full toggle grid, the running
// chit total, the active cap, and the next unlock gate. Selecting returns to the
// loadout, which repaints its compact summary.
function openChitMenu() {
  if (typeof document === 'undefined') return;
  renderChitMenu();
  $('chitDone').onclick = () => { closeModal('chitModal'); circuitLoadoutScreen(); };
  const ab = $('chitAlpha');
  if (ab) ab.onclick = () => { setAlphaUnlock(!alphaUnlock()); renderChitMenu(); }; // testing: open/close every debt live
  $('chitModal').classList.add('open');
}
// The Debtor's Ledger — two focused views behind a tab, with a soft transition:
//   · Sign Debts — a coffer of ONLY your unlocked coins over the ledger you build.
//   · The Reckoning — the progression rail: what you've earned, what's next, slots.
// Keeping the roadmap out of the selection screen is what keeps it uncluttered.
let chitView = 'select';
const chitMk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
function renderChitMenu() {
  const cap = activeChitCap();
  const sel = (circuitLoad.chits || []).filter(chitIsUnlockedKey).slice(0, cap);
  circuitLoad.chits = sel;
  const onRail = chitView === 'rail';
  $('chitTitle').textContent = onRail ? 'The Reckoning' : "The Debtor's Ledger";
  $('chitSub').innerHTML = onRail
    ? 'Your progression — the Debts you’ve earned and the runs that earn the rest.'
    : 'Sign debts you’ve earned, then <b>win the whole Circuit</b> carrying them — each heavier win opens more.';
  const ab = $('chitAlpha');
  if (ab) { const on = chitAlpha(); ab.textContent = (on ? '✓ Alpha — all unlocked' : 'Alpha — unlock all'); ab.classList.toggle('selected', on); }
  const body = $('chitBody'); body.innerHTML = '';
  // Only two views, so a single toggle reads cleaner than a tab strip.
  const nav = chitMk('div', 'chitnav');
  const navBtn = chitMk('button', 'btn chitnavbtn', onRail ? '‹ Sign Debts' : 'Your progression ›');
  navBtn.onclick = () => { chitView = onRail ? 'select' : 'rail'; renderChitMenu(); };
  nav.appendChild(navBtn);
  body.appendChild(nav);
  const view = chitMk('div', 'chitview enter');
  if (chitView === 'rail') renderRailView(view);
  else renderSelectView(view, sel, cap);
  body.appendChild(view);
}
// SIGN DEBTS — the coffer of unlocked coins over the ledger being signed.
function renderSelectView(view, sel, cap) {
  const val = chitValue(sel), atCap = sel.length >= cap;
  const toggle = key => { const i = circuitLoad.chits.indexOf(key); if (i >= 0) circuitLoad.chits.splice(i, 1); else if (circuitLoad.chits.length < cap) circuitLoad.chits.push(key); renderChitMenu(); };
  const unlocked = chitsUnlocked();
  const coffer = chitMk('div', 'coffer');
  coffer.appendChild(chitMk('div', 'coffer-lab', `The Coffer — ${unlocked.length} Debt${unlocked.length === 1 ? '' : 's'} earned`));
  if (!unlocked.length) coffer.appendChild(chitMk('div', 'ledger-empty', 'No Debts yet — win the Circuit once to earn your first, or peek at The Reckoning.'));
  else {
    const coins = chitMk('div', 'coffer-coins');
    for (const c of unlocked) {
      const on = sel.includes(c.key), full = !on && atCap;
      const slot = chitMk('div', 'coffercoin' + (on ? ' taken' : '') + (full ? ' full' : ''),
        chitCoinHtml(c) + `<span class="coffercoin-n">${c.name}</span>`); // coin carries the styled tooltip
      if (!full || on) slot.onclick = () => toggle(c.key);
      coins.appendChild(slot);
    }
    coffer.appendChild(coins);
  }
  view.appendChild(coffer);
  const book = chitMk('div', 'ledgerbook');
  book.appendChild(chitMk('div', 'ledger-head', 'Debts owed — this run'));
  const lines = chitMk('div', 'ledger-lines');
  if (!sel.length) lines.appendChild(chitMk('div', 'ledger-empty', 'The ledger is clean — an honest run.'));
  else for (const k of sel) {
    const c = chitByKey(k); if (!c) continue;
    const line = chitMk('div', 'ledger-line' + (c.req ? ' prestige' : ''),
      `<span class="ll-coin">${chitCoinHtml(c)}</span><span class="ll-name">${c.name}${c.boss ? ` <i>· ${c.boss}</i>` : ''}</span><span class="ll-lead"></span><span class="ll-val">${c.chits}</span><span class="ll-strike" title="Strike this debt">✕</span>`);
    line.onclick = () => toggle(k);
    lines.appendChild(line);
  }
  book.appendChild(lines);
  const totalRow = chitMk('div', 'ledger-total',
    `Total owed <span class="lt-val">${val}</span> chit${val === 1 ? '' : 's'} <span class="lt-slots">· ${sel.length} of ${cap} slots</span>`);
  if (sel.length) {
    const clr = chitMk('button', 'ledger-clear', 'Clear all');
    clr.onclick = () => { circuitLoad.chits = []; renderChitMenu(); };
    totalRow.insertBefore(clr, totalRow.firstChild);
  }
  book.appendChild(totalRow);
  view.appendChild(book);
}
// THE RECKONING — the progression rail. Rungs at each gate carry the pair of
// Debts that open there (earned / next / to-come), slot milestones ride the 3 and
// 5 rungs, and prestige Debts hang below as their own boss-won row.
function renderRailView(view) {
  const best = chitsBestCleared(), cap = activeChitCap(), gated = gatedChits();
  view.appendChild(chitMk('div', 'rail-head',
    `Best win <b>${best < 0 ? 'none yet' : best + ' chit' + (best === 1 ? '' : 's')}</b>` +
    `<span class="rail-slots">${cap} of ${MAX_CHIT_SLOTS} Debt slots</span>`));
  // The reading is the confusing part, so state it plainly: the coins on a rung are
  // the REWARD, and the label below is the RUN you must win to earn them.
  view.appendChild(chitMk('div', 'rail-legend', 'The coins on each rung are the <b>reward</b> — win a run carrying that rung’s chits to earn them.'));
  const rail = chitMk('div', 'rail');
  CHIT_GATES.forEach((g, gi) => {
    const pair = gated.slice(gi * 2, gi * 2 + 2);
    const earned = best >= g;
    const isNext = !earned && (gi === 0 || best >= CHIT_GATES[gi - 1]);
    const slotHere = (g === 3 || g === 5);
    const rung = chitMk('div', 'rung' + (earned ? ' earned' : '') + (isNext ? ' next' : ''));
    const reqLab = g === 0 ? 'win any run' : `win ${g === 8 || g === 11 ? 'an' : 'a'} ${g}-chit run`;
    rung.innerHTML =
      `<div class="rung-earn">${earned ? '✓ earned' : (isNext ? 'earn next ↓' : 'reward ↓')}</div>` +
      `<div class="rung-coins">${pair.map(c => `<span class="rungcoin${earned ? '' : ' dim'}">${chitCoinHtml(c)}</span>`).join('')}</div>` +
      `<div class="rung-track"><span class="rung-dot">${earned ? '✓' : ''}</span></div>` +
      `<div class="rung-lab">${reqLab}${slotHere ? '<span class="rung-slot">+ a slot</span>' : ''}</div>`;
    rail.appendChild(rung);
  });
  view.appendChild(rail);
  const ng = chitsNextGate();
  if (ng != null) {
    const gi = CHIT_GATES.indexOf(ng), names = gated.slice(gi * 2, gi * 2 + 2).map(c => c.name).join(' + ');
    view.appendChild(chitMk('div', 'rail-next', `Next — <b>win a ${ng}-chit run</b> to open <b>${names}</b>.`));
  } else view.appendChild(chitMk('div', 'rail-next', 'Every ladder Debt is earned. Only the prestige Debts remain.'));
  // Prestige row — the six boss-won Debts.
  const pr = chitMk('div', 'railprestige');
  pr.appendChild(chitMk('div', 'coffer-lab', 'Prestige Debts — won on Hardcore'));
  const prow = chitMk('div', 'coffer-coins');
  for (const c of CIRCUIT_CHITS.filter(x => x.req)) {
    const got = chitIsUnlocked(c);
    const slot = chitMk('div', 'coffercoin' + (got ? '' : ' locked'),
      chitCoinHtml(c) + `<span class="coffercoin-n">${c.name}</span><span class="coffercoin-boss">${got ? '✓ ' + c.boss : c.boss}</span>` + (got ? '' : `<span class="coffercoin-lk" data-tip-head="Locked" data-tip="${chitUnlockHint(c).replace(/"/g, '&quot;')}">🔒</span>`));
    prow.appendChild(slot);
  }
  pr.appendChild(prow);
  view.appendChild(pr);
}
function chitIsUnlockedKey(k) { const c = chitByKey(k); return !!c && chitIsUnlocked(c); }

function circuitBegin() {
  if (typeof document !== 'undefined') circuitQuitToTitle(); // restore the shared quit button for the map/rewards ahead
  const pouch = Object.assign({}, circuitLoad.pouch); // the pouch you built (four stones)
  // The chosen archetype: 8 plain (one of each type) + its two signature cards
  // = a tuned 10-card deck, plus one starting charm you picked.
  const arch = deckByKey(circuitLoad.deck) || CIRCUIT_DECKS[0];
  const sig = arch.cards.map(c => ({ type: c.type, fx: c.fx }));
  const deck = TYPES.slice().concat(sig); // one of each (8) + 2 signature = 10
  sig.forEach(c => { if (c.fx) markCharmSeen('fx:' + c.fx); }); // the modifiers you carry in DO count as discovered
  const relic = (circuitLoad.charm && CHARMS[circuitLoad.charm]) ? circuitLoad.charm : arch.charms[0];
  const charms = relic ? [relic] : [];
  if (relic) markCharmSeen(relic);
  // Chits: the difficulty debts carried into this run. Only ones still unlocked
  // count. The tune overlays CIRCUIT via ccfg(); start Standing reads it up front.
  const chitKeys = (circuitLoad.chits || []).filter(k => chitsUnlocked().some(c => c.key === k)).slice(0, activeChitCap());
  const tune = computeChitTune(chitKeys);
  const grit = arch.grit || 0; // per-archetype Standing: the Vanguard runs fragile, the Anvil & Weaver tanky
  let start = (tune.startStanding != null ? tune.startStanding : CIRCUIT.startStanding) + grit;
  let startMax = (tune.maxStanding != null ? tune.maxStanding : CIRCUIT.maxStanding) + grit;
  const msa = relic && CHARMS[relic] && CHARMS[relic].maxStandingAdd; // a relic that lifts max Standing sets it up front
  if (msa) { startMax += msa; start += msa; }
  GAUNTLET = { active: true, act: 1, cleared: 0, coin: 0, standing: start, maxStanding: startMax, foeHp: CIRCUIT.foeBase, foeMax: CIRCUIT.foeBase, score: 0, opp: null, venue: null, tableCleared: false, groundOut: false, deck, pouch, pouchName: stoneSummary(pouch), deckName: arch.name, charms, foeCharms: [], handBuff: 0, curNode: null, seed: circuitSeed, allies: [], allyOffered: false, chits: chitKeys, chitValue: chitValue(chitKeys), tune };
  GAUNTLET.map = buildAct(1);
  circuitActIntro(1, circuitToMap); // open the run on the Act I cinematic
}

/* ---- The run map: each act is a few columns of nodes you path through to a
   boss. Node types: duel / elite (tougher + foe charms) / event (the interlude)
   / boss (act-ender). Finite acts bound the run (and the snowball). ---- */
// Shops and a baseline of Reposes are placed deliberately in buildAct, so the
// random roll keeps Reposes rare (they'd otherwise flood the map) and leans on
// duels/elites/events for the bulk of the branches.
function rollNodeType(noElite, act) {
  const t = actTuning(act || 1), r = rnd();
  if (r < t.elite) return noElite ? 'duel' : 'elite';
  if (r < t.elite + t.event) return 'event';
  if (r < t.elite + t.event + t.repose) return 'repose';
  return 'duel';
}
function pickFoe() { return BOT_POOL[Math.floor(rnd() * BOT_POOL.length)]; }
// Elites/bosses carry persona-appropriate charms; earlier acts carry none.
function nodeFoeCharms(type, act, foe) {
  const n = (type === 'elite') ? Math.min(2, Math.max(0, act - 1))
    : (type === 'boss') ? Math.min(3, Math.max(0, act - 1)) : 0;
  if (!n) return [];
  const pool = (CIRCUIT_BUILDS[foe] && CIRCUIT_BUILDS[foe].charms) || ['loadedcoin', 'forgerseal', 'whetstone'];
  return shuffle(pool.slice()).slice(0, n);
}
function mkNode(type, col, idx, act) {
  const foe = (type === 'event' || type === 'shop' || type === 'repose' || type === 'puzzle') ? null : pickFoeFor(type, act);
  const node = { type, col, idx, foe, foeCharms: nodeFoeCharms(type, act, foe), done: false, edges: [] };
  if (type === 'puzzle' && PUZZLE_KEYS.length) node.puzzle = PUZZLE_KEYS[Math.floor(rnd() * PUZZLE_KEYS.length)];
  return node;
}
// Link column A → B with adjacency-biased edges: every A node gets ≥1 outgoing,
// every B node ≥1 incoming (no dead ends, nothing unreachable), plus a little
// branching. So you commit to a lane and can't reach every node.
function linkColumns(A, B) {
  const a = A.length, b = B.length;
  A.forEach(n => n.edges = []);
  if (a === 1) { A[0].edges = B.map((_, j) => j); return; }   // the entry fans out to the whole next column
  if (b === 1) { A.forEach(n => n.edges = [0]); return; }     // everything converges on the boss/shop
  // Both columns are ordered by lane, so a monotonic projection gives every A a
  // primary edge with no two edges crossing. Orphan B nodes are adopted into the
  // bracket they fall in, and the optional 2nd branch is bounded by its
  // neighbours — the whole graph stays planar, so branches spread instead of
  // knotting. (No dead ends: every A keeps ≥1 out, every B ends with ≥1 in.)
  const proj = i => Math.round(i * (b - 1) / (a - 1));
  for (let i = 0; i < a; i++) A[i].edges = [proj(i)];
  for (let j = 0; j < b; j++) {
    if (A.some(n => n.edges.includes(j))) continue;
    let i = 0; while (i < a - 1 && proj(i + 1) <= j) i++;      // the bracket proj(i) ≤ j < proj(i+1)
    A[i].edges.push(j);
  }
  for (let i = 0; i < a; i++) {                                // a little branching, kept in-lane so nothing crosses
    if (rnd() >= 0.35) continue;
    const lo = i > 0 ? Math.max(...A[i - 1].edges) : 0;
    const hi = i < a - 1 ? Math.min(...A[i + 1].edges) : b - 1;
    const cur = A[i].edges, down = Math.max(...cur) + 1, up = Math.min(...cur) - 1;
    const cand = [];
    if (down <= hi && !cur.includes(down)) cand.push(down);
    if (up >= lo && !cur.includes(up)) cand.push(up);
    if (cand.length) cur.push(cand[Math.floor(rnd() * cand.length)]);
  }
  A.forEach(n => n.edges.sort((x, y) => x - y));
}
const MAP_LANES = 5; // vertical slots — nodes sit in lanes so paths visibly interweave
// Every route to the boss must be earned: at least this many fights on the
// fewest-fight path, counting the opener AND the boss (so: start + ≥2 more + boss).
const CIRCUIT_MIN_FIGHTS = 4;
// …but no route is an all-fight slog: at most this many fights on the most-fight
// path, so every path also carries a few Encounters/Shops/Reposes for variety.
// 7 leaves enough slack to coexist with the floor as a HARD per-map guarantee
// (a 6-cap is infeasible on rare dense graphs); it also widens the spread so a
// map offers a chill 4-fight line and a greedy 7-fight line side by side.
const CIRCUIT_MAX_FIGHTS = 7;

/* ============================================================
   CHITS — hybrid difficulty modifiers (the end-game ladder).
   Each Chit is a named DEBT you take into a run, worth some chits (its weight).
   A run's difficulty = the sum of its active chits. Clearing a full run at a
   given chit value UNLOCKS more debts (gates below) — a Halo-skulls / Wildfrost-
   bells hybrid: you earn the pool in order, then play any subset you've earned.
   Each modifier tweaks exactly ONE lever, applied through the ccfg() layer so the
   base game is untouched when no chits are active. Weights/gates tune freely.
   ============================================================ */
const CHIT_KEY = 'stonelock-chits-best'; // highest chit value of a completed run (-1 = never)
// Passing gate g (bestClearedChits >= g) unlocks another PAIR of debts, in list
// order. gates[0]=0 → clearing the base Circuit once opens the first two.
// Gates unlock the ladder two at a time (best-cleared value ≥ gate). Reachable at
// every step with the pool earned so far. Derived from the tuned weights below.
// Re-derived for the progressive active cap (3 → 4 → 5 slots): reachable at every
// step even while you carry only 3 debts, and the slot unlocks line up with the
// gates (clear a 3-chit run → slot 4; a 5-chit run → slot 5). See activeChitCap().
const CHIT_GATES = [0, 2, 3, 5, 8];
// Ladder debts, ORDERED gentle → brutal (so early unlocks are mild and the two
// worst arrive last). Weights are battery-graded (~1 chit per ~10pt win-rate
// drop for the neutral pilot; the AI-blind ones judged by human impact). Each
// tune(t) mutates an effective-config object (t) layered over CIRCUIT via ccfg.
const CIRCUIT_CHITS = [
  { key: 'marked',  name: 'Marked Cards',    chits: 1, blurb: 'The road turns mean — more Elites, fewer Reposes.', tune: t => { t.eliteBias = true; } },
  { key: 'purse',   name: 'Short Purse',     chits: 1, blurb: 'Draw one fewer stone each hand (2, not 3).', tune: t => { t.drawStones = 2; } },
  { key: 'masters', name: 'Grimmer Masters', chits: 1, blurb: 'Act bosses stand far tougher (Standing ×1.85).', tune: t => { t.bossHpMult = 1.85; } },
  { key: 'noquarter', name: 'No Quarter',    chits: 1, blurb: 'A lost hand presses harder — the damage cap rises to 8.', tune: t => { t.dmgCap = 8; } },
  { key: 'lean',    name: 'Lean Season',     chits: 1, blurb: 'Respite between tables heals far less (4, not 7).', tune: t => { t.heal = 4; } },
  { key: 'steep',   name: 'Steep Grade',     chits: 2, blurb: 'Foe Standing climbs faster the deeper you go.', tune: t => { t.foeStep = 1.7; } },
  { key: 'costly',  name: 'Costly Road',     chits: 2, blurb: 'Coin comes slower — every purse is lighter.', tune: t => { t.coinMult = 0.6; } },
  { key: 'thin',    name: 'Thin Footing',    chits: 2, blurb: 'Start the run with less Standing (20, not 24).', tune: t => { t.startStanding = 20; t.maxStanding = 20; } },
  { key: 'loaded',  name: 'Loaded Table',    chits: 3, blurb: 'From Act 2 on, every foe reads its board +1 — they win more hands.', tune: t => { const m = (t.foeMenace || CIRCUIT.foeMenace).slice(); m[1] = (m[1] || 0) + 1; m[2] = (m[2] || 0) + 1; t.foeMenace = m; } },
  { key: 'longnight', name: 'The Long Night', chits: 3, blurb: 'Drag a table past hand 8 and your Standing bleeds 1 each hand.', tune: t => { t.longNight = true; } },
  // Prestige debts — NOT on the value ladder. Each is earned by breaking a
  // campaign boss on Hardcore, and brings THAT boss's signature cruelty to the
  // Circuit. Weights are placeholders here; the tuning battery sets them.
  { key: 'ration',    name: 'The Ration',    chits: 3, req: () => hcBeaten('quartermaster'), boss: 'The Quartermaster', blurb: 'Each hand one of YOUR stone colours is locked away — cycling red → white → blue → black.', tune: t => { t.ration = true; } },
  { key: 'wideboard', name: 'Wide Board',    chits: 3, req: () => hcBeaten('magistrate'),    boss: 'The Magistrate',   blurb: 'Every foe fields one more card — a wider board to out-score.', tune: t => { t.foeWide = true; } },
  { key: 'deeppouch', name: 'Deep Pouch',    chits: 3, req: () => hcBeaten('warden'),        boss: 'The Warden',       blurb: 'Every foe draws one more stone each hand — the pouch never runs dry.', tune: t => { t.foeDeepPouch = true; } },
  { key: 'scalpel',   name: 'The Scalpel',   chits: 4, req: () => hcBeaten('apothecary'),    boss: 'The Apothecary',   blurb: 'From Act 2 on, each hand your best UNLOCKED Foundation card (the face-up two) is cut to nothing. Veil your prizes or lock them.', tune: t => { t.scalpel = true; } },
  { key: 'fixedorder', name: 'By the Ledger', chits: 2, req: () => hcBeaten('archivist'),    boss: 'The Archivist',    blurb: 'The first stone you draw must be your first placement — no holding it back.', tune: t => { t.fixedOrder = true; } },
  { key: 'reckoning', name: 'The Reckoning', chits: 2, req: () => hcBeaten('crucible'),      boss: 'The Crucible',     blurb: 'Every foe pouch gains one of each stone — red, white, blue, black, and a Green scalpel. The whole road can poison.', tune: t => { t.foeAllStones = true; } },
];
// A campaign boss broken on Hardcore (the Crucible has its own single difficulty).
function hcBeaten(boss) {
  try { return [...campaignBeaten()].some(k => k === boss + '-hard' || (boss === 'crucible' && k.indexOf('crucible-') === 0)); } catch (e) { return false; }
}
function chitByKey(k) { return CIRCUIT_CHITS.find(c => c.key === k) || null; }
// The value ladder covers the plain debts; prestige debts (req) unlock on their
// own condition and never affect the gate count.
function gatedChits() { return CIRCUIT_CHITS.filter(c => !c.req); }
function chitAlpha() { return typeof alphaUnlock === 'function' && alphaUnlock(); } // the title's Alpha toggle opens every debt for testing
function bonusChits() { return CIRCUIT_CHITS.filter(c => c.req && (chitAlpha() || (() => { try { return c.req(); } catch (e) { return false; } })())); }
function chitsBestCleared() { const v = parseInt(ls.get(CHIT_KEY), 10); return isNaN(v) ? -1 : v; }
// How many ladder debts are unlocked: two per gate passed by the best cleared value.
function chitsUnlockedCount() {
  if (chitAlpha()) return gatedChits().length;
  const best = chitsBestCleared();
  let passed = 0; for (const g of CHIT_GATES) if (best >= g) passed++;
  return Math.min(gatedChits().length, passed * 2);
}
function chitsUnlocked() { return gatedChits().slice(0, chitsUnlockedCount()).concat(bonusChits()); }
function chitIsUnlocked(c) { return chitsUnlocked().some(x => x.key === c.key); }
// The number of Debt slots earned — the ascension hook: start at 3, earn a 4th by
// clearing a 3-chit run and a 5th by clearing a 5-chit run (Alpha opens all).
const MAX_CHIT_SLOTS = 5;
function activeChitCap() {
  if (chitAlpha()) return MAX_CHIT_SLOTS;
  const best = chitsBestCleared();
  return Math.min(MAX_CHIT_SLOTS, 3 + (best >= 3 ? 1 : 0) + (best >= 5 ? 1 : 0));
}
// The value you must CLEAR to earn your next slot (null once all slots are earned).
function nextSlotAt() { if (chitAlpha()) return null; const best = chitsBestCleared(); if (best < 3) return 3; if (best < 5) return 5; return null; }
// Why a still-locked debt is locked, and how to earn it — shown greyed in the picker.
function chitUnlockHint(c) {
  if (c.req) return `Win a run after breaking ${c.boss} on Hardcore`;
  const i = gatedChits().indexOf(c), g = CHIT_GATES[Math.floor(i / 2)] || 0;
  // Ladder debts open a PAIR at a time, gated by the heaviest run you've WON —
  // so a debt opens once you win a full Circuit run carrying at least g chits.
  return g > 0 ? `Win a run carrying ${g}+ chits` : 'Win the Circuit once';
}
// The next value you must CLEAR a run at to unlock more ladder debts (null when
// the whole ladder is out; a prestige debt has no gate).
function chitsNextGate() {
  const best = chitsBestCleared();
  if (chitsUnlockedCount() >= gatedChits().length) return null;
  for (const g of CHIT_GATES) if (best < g) return g;
  return null;
}
// Record a cleared run's chit value; raises the unlock ceiling. Returns how many
// NEW debts it opened (for a spoils callout).
function recordChitClear(value) {
  const before = chitsUnlockedCount();
  if (value > chitsBestCleared()) ls.set(CHIT_KEY, String(value));
  return Math.max(0, chitsUnlockedCount() - before);
}
function chitValue(keys) { return (keys || []).reduce((s, k) => { const c = chitByKey(k); return s + (c ? c.chits : 0); }, 0); }
// Build the effective-config overlay from a set of active chit keys.
function computeChitTune(keys) {
  const t = {};
  for (const k of (keys || [])) { const c = chitByKey(k); if (c && c.tune) c.tune(t); }
  return t;
}
// The one read layer: a tuned value if this run has one, else the base constant.
function ccfg(key) {
  const t = (typeof GAUNTLET !== 'undefined' && GAUNTLET && GAUNTLET.tune) ? GAUNTLET.tune : null;
  return (t && key in t) ? t[key] : CIRCUIT[key];
}
// The Reckoning (prestige chit): seed every foe pouch with one of each stone —
// including a Green scalpel, so any fight can poison. Non-mutating.
function foePouchWithChits(pouch) {
  if (!ccfg('foeAllStones')) return pouch;
  const p = Object.assign({}, pouch);
  for (const c of ['red', 'white', 'blue', 'black', 'green']) p[c] = (p[c] || 0) + 1;
  return p;
}
// Each Debt is minted as a coin: a mark stamped on it and its chit-value below.
// Monochrome symbols (not emoji) so they take the coin's gilt; hover names it.
const CHIT_GLYPH = {
  marked: '✖', purse: '◒', masters: '♛', noquarter: '⚔', lean: '☾', steep: '▲', costly: '⊘', thin: '◇', loaded: '⚅', longnight: '✦',
  ration: '⊟', wideboard: '▦', deeppouch: '❖', scalpel: '✚', fixedorder: '≡', reckoning: '☠',
};
function chitGlyph(key) { return CHIT_GLYPH[key] || '◈'; }
function chitCoinHtml(c) {
  if (!c) return '';
  // data-tip → the shared styled tooltip (#fxtip), not the basic native `title`.
  const esc = s => String(s).replace(/"/g, '&quot;');
  const head = `${c.name} · ${c.chits} chit${c.chits === 1 ? '' : 's'}${c.boss ? ' · ' + c.boss : ''}`;
  return `<span class="chitcoin${c.req ? ' prestige' : ''}" data-tip-head="${esc(head)}" data-tip="${esc(c.blurb)}" data-tip-cls="tip-gold"><span class="chitcoin-g">${chitGlyph(c.key)}</span><span class="chitcoin-v">${c.chits}</span></span>`;
}
// A small scattered pile of the given chit keys (CSS jitters each coin).
function chitPileHtml(keys) {
  const cs = (keys || []).map(chitByKey).filter(Boolean);
  return cs.length ? `<span class="chitpile">${cs.map(chitCoinHtml).join('')}</span>` : '';
}

// Spread `count` nodes evenly across the lanes (a lone node rides the middle).
function laneFor(count, i) {
  if (count <= 1) return Math.floor(MAP_LANES / 2);
  return Math.round(i * (MAP_LANES - 1) / (count - 1));
}
function buildAct(act) {
  const N = CIRCUIT.actRows, cols = [];
  for (let c = 0; c < N; c++) {
    let arr;
    if (c === N - 1) arr = [mkNode('boss', c, 0, act)];          // the act boss
    else if (c === N - 2) arr = [mkNode('repose', c, 0, act)];   // a breather before the boss
    else if (c === 0) arr = [mkNode('duel', c, 0, act)];         // a safe opener
    else {
      // First fanned column is a clean symmetric 3 (lanes 0·2·4) so the entry
      // spreads evenly; later columns vary 3–4 for robust, interweaving trees.
      const count = (c === 1) ? 3 : 3 + (rnd() < 0.5 ? 1 : 0);
      const noElite = c === 1;                                   // no elites in the first two nodes
      arr = []; for (let i = 0; i < count; i++) arr.push(mkNode(rollNodeType(noElite, act), c, i, act));
    }
    arr.forEach((n, i) => { n.lane = laneFor(arr.length, i); });
    cols.push(arr);
  }
  // Deliberately scatter the key nodes so every act reliably has them. Shops
  // never sit in the first two columns, the pre-boss Repose, or the boss; the
  // two shops are kept ≥2 columns apart so a path can't chain them.
  const placed = new Set(), shopCols = [];
  const placeOne = (type, lo, hi, avoid) => {
    const cands = [];
    for (let c = lo; c <= hi; c++) {
      if (placed.has(c)) continue;
      if (avoid && avoid.some(x => Math.abs(x - c) < 2)) continue; // keep a column's gap from `avoid`
      cands.push(c);
    }
    if (!cands.length) return null;
    const c = cands[Math.floor(rnd() * cands.length)]; placed.add(c);
    const idx = Math.floor(rnd() * cols[c].length);
    cols[c][idx] = mkNode(type, c, idx, act);
    cols[c][idx].lane = laneFor(cols[c].length, idx);
    return c;
  };
  // Shops go no later than N-4 so one can never feed the pre-boss Repose (two
  // protected rests back to back — Rule 1 could resolve neither). Keeps them ≥2 apart.
  const s1 = placeOne('shop', 2, N - 4); if (s1 != null) shopCols.push(s1);
  const s2 = placeOne('shop', 2, N - 4, shopCols); if (s2 != null) shopCols.push(s2); // 2nd shop ≥2 cols off the 1st
  for (let k = 0; k < actTuning(act).reposes; k++) placeOne('repose', 1, N - 3);
  if (PUZZLE_KEYS.length) placeOne('puzzle', 2, N - 3); // one tailored riddle per act
  for (let c = 0; c < cols.length - 1; c++) linkColumns(cols[c], cols[c + 1]);
  /* ---- Structure rules (edge-aware, applied after linking) --------------------
     A coherent system, not a pile of patches. The skeleton is fixed for every
     act (per-act WEIGHTS in actTuning only flavour the middle node types, so
     these rules read the same on Acts 1–3):
       • Fixed spine: a single opener (fight), a resolute pre-boss Repose, the boss.
       • Edges are planar (linkColumns) and every node is reachable — no dead ends.
       Rule 1  no two rests back to back on a path.
       Rule 2  no run of 4+ non-fight nodes (cap a rest/encounter streak at 3).
       Rule 3  FLOOR (hard): every route has ≥ CIRCUIT_MIN_FIGHTS fights
               (start + ≥2 + boss) — always satisfiable by demoting non-fights.
       Rule 4  CEILING (hard): no route exceeds CIRCUIT_MAX_FIGHTS fights, by
               promoting fights to Encounters where it won't undercut Rule 3 or
               Rule 2. At 7 this holds on every map (a 6-cap would be infeasible
               with the floor on rare dense graphs).
     A "rest" is a Repose/Shop; a "fight" is Duel/Elite/Boss; everything else
     (Encounter/Puzzle) is a non-fight. ------------------------------------------ */
  const isFight = t => t === 'duel' || t === 'elite' || t === 'boss';
  const isRest = t => t === 'repose' || t === 'shop';
  const lastCol = cols.length - 1;
  const demote = n => { n.type = 'duel'; n.foe = pickFoeFor('duel', act); n.foeCharms = []; n.puzzle = undefined; }; // in place — keeps edges
  // Protected non-fights — authored content the structure rules won't casually
  // eat: the Shops (spend coin), the one tailored Puzzle, and the resolute
  // pre-boss Repose. (Rule 3 may still demote a Shop/Puzzle as a LAST resort to
  // keep the fight floor hard, but never the breather.)
  const protectedRest = (node, c) => node.type === 'shop' || (c === lastCol - 1 && node.type === 'repose');
  const protectedNode = (node, c) => protectedRest(node, c) || node.type === 'puzzle';
  // Rule 1 — no two rest stops back to back on any path (kills repose→shop→repose at its source).
  for (let c = 1; c < cols.length; c++) {
    cols[c].forEach((node, k) => {
      if (!isRest(node.type)) return;
      const restPreds = cols[c - 1].filter(p => isRest(p.type) && (p.edges || []).includes(k));
      if (!restPreds.length) return;
      // Keep a protected rest (Shop / pre-boss Repose): clear the colliding rest
      // that leads into it instead. Otherwise demote this node.
      if (protectedRest(node, c)) restPreds.forEach(p => { if (!protectedRest(p, c - 1)) demote(p); });
      else demote(node);
    });
  }
  // Rule 2 — no path may chain 4 non-fight nodes (cap a run at 3; demote the 4th).
  const run = cols.map(col => col.map(() => 0));
  for (let c = 0; c < cols.length; c++) {
    cols[c].forEach((node, k) => {
      if (isFight(node.type)) { run[c][k] = 0; return; }
      const preds = c === 0 ? [] : cols[c - 1].map((p, pi) => ({ p, pi })).filter(o => (o.p.edges || []).includes(k));
      const inRun = () => preds.length ? Math.max(...preds.map(o => run[c - 1][o.pi])) : 0;
      if (inRun() + 1 > 3) {
        // The resolute breather is never the one demoted — break the chain behind
        // it instead. A protected Shop/Puzzle is spared where an unprotected
        // predecessor can take its place, but yields to the hard no-4-chain rule
        // if the run can't be broken any other way.
        if (c === lastCol - 1 && node.type === 'repose') {
          while (preds.length && inRun() + 1 > 3) { const w = preds.reduce((a, b) => run[c - 1][b.pi] > run[c - 1][a.pi] ? b : a); demote(w.p); run[c - 1][w.pi] = 0; }
        } else if (protectedNode(node, c)) {
          let open = preds.filter(o => !protectedNode(o.p, c - 1));
          while (open.length && inRun() + 1 > 3) { const w = open.reduce((a, b) => run[c - 1][b.pi] > run[c - 1][a.pi] ? b : a); demote(w.p); run[c - 1][w.pi] = 0; open = open.filter(o => o !== w); }
          if (inRun() + 1 > 3) { demote(node); run[c][k] = 0; return; } // couldn't break behind it — yield
        } else { demote(node); run[c][k] = 0; return; }
      }
      run[c][k] = inRun() + 1;
    });
  }
  // Rule 3 — no cheap run to the boss: guarantee CIRCUIT_MIN_FIGHTS fights on the
  // fewest-fight path (start + ≥2 more + boss). A forward DP finds the easiest
  // route; if it's short, demote a non-fight node ON that route to a duel and
  // repeat — so only the too-easy paths gain fights, richer paths keep variety.
  const fewestFights = () => {
    const ff = cols.map(col => col.map(() => Infinity));
    cols[0].forEach((n, k) => ff[0][k] = isFight(n.type) ? 1 : 0);
    for (let c = 1; c < cols.length; c++) cols[c].forEach((n, k) => {
      const preds = cols[c - 1].map((p, pi) => pi).filter(pi => (cols[c - 1][pi].edges || []).includes(k));
      if (!preds.length) return;
      ff[c][k] = Math.min(...preds.map(pi => ff[c - 1][pi])) + (isFight(n.type) ? 1 : 0);
    });
    return ff;
  };
  for (let guard = 0; guard < 60; guard++) {
    const ff = fewestFights();
    if (ff[lastCol][0] >= CIRCUIT_MIN_FIGHTS) break;
    // Backtrack the fewest-fight route from the boss.
    const path = []; let c = lastCol, k = 0;
    while (c >= 0) {
      path.push({ c, k });
      if (c === 0) break;
      const preds = cols[c - 1].map((_, pi) => pi).filter(pi => (cols[c - 1][pi].edges || []).includes(k));
      k = preds.reduce((best, pi) => ff[c - 1][pi] < ff[c - 1][best] ? pi : best, preds[0]); c--;
    }
    // Demote a non-fight on that route. Plain Encounters/Reposes go first; the
    // authored Shops & Puzzle are spared unless nothing else is left; the pre-boss
    // breather is resolute and never demoted (so the boss always sits behind it).
    const breather = ({ c, k }) => c === lastCol - 1 && cols[c][k].type === 'repose';
    let did = path.find(({ c, k }) => { const n = cols[c][k]; return !isFight(n.type) && n.type !== 'shop' && n.type !== 'puzzle' && !breather({ c, k }); })
           || path.find(o => !isFight(cols[o.c][o.k].type) && !breather(o) && o.c !== lastCol);
    if (!did) break; // route already all fights (or only the protected breather left) — nothing to add
    demote(cols[did.c][did.k]);
  }
  // Rule 4 — variety ceiling: no route is an all-fight slog. Cap fights on the
  // MOST-fight path; promote a mid-route fight to an Encounter, but only where it
  // won't drop another route below the min-fight floor (Rule 3 stays intact).
  const promote = n => { n.type = 'event'; n.foe = null; n.foeCharms = []; n.puzzle = undefined; };
  // Longest run of non-fight nodes on any path (mirrors Rule 2's cap of 3) — so a
  // promotion can't quietly create a 4-in-a-row rest chain.
  const longestNonFightRun = () => {
    let mx = 0; const run = cols.map(col => col.map(() => 0));
    for (let c = 0; c < cols.length; c++) cols[c].forEach((n, k) => {
      if (isFight(n.type)) { run[c][k] = 0; return; }
      const preds = c === 0 ? [] : cols[c - 1].map((_, pi) => pi).filter(pi => (cols[c - 1][pi].edges || []).includes(k));
      run[c][k] = 1 + (preds.length ? Math.max(...preds.map(pi => run[c - 1][pi])) : 0);
      if (run[c][k] > mx) mx = run[c][k];
    });
    return mx;
  };
  // Most fights on any route through each node — forward (entry→node) and
  // backward (node→boss); a node lies on a global-max route when fw+bw-1 == max.
  const mostFightsDir = back => {
    const mf = cols.map(col => col.map(() => -Infinity)), edge0 = back ? lastCol : 0;
    for (const c of (back ? [...cols.keys()].reverse() : [...cols.keys()])) cols[c].forEach((n, k) => {
      const adj = back
        ? (c < lastCol ? (cols[c][k].edges || []).map(j => mf[c + 1][j]) : [])
        : (c > 0 ? cols[c - 1].map((_, pi) => pi).filter(pi => (cols[c - 1][pi].edges || []).includes(k)).map(pi => mf[c - 1][pi]) : []);
      if (c === edge0 || adj.length) mf[c][k] = (adj.length ? Math.max(...adj) : 0) + (isFight(n.type) ? 1 : 0);
    });
    return mf;
  };
  // Variety ceiling: no route exceeds CIRCUIT_MAX_FIGHTS fights, so every path
  // carries a few Encounters/Shops/Reposes. Search ALL fights on a most-fight
  // route (not one backtracked path) and promote the first that won't drop a route
  // below the floor or spawn a 4-rest chain. (This also trims most 3-fight slogs,
  // though a lone 2→3 streak can survive when breaking it would undercut the floor.)
  for (let guard = 0; guard < 80; guard++) {
    const fw = mostFightsDir(false), gmax = fw[lastCol][0];
    if (gmax <= CIRCUIT_MAX_FIGHTS) break;
    const bw = mostFightsDir(true), cands = [];
    for (let c = 1; c < lastCol; c++) cols[c].forEach((n, k) => {
      if (isFight(n.type) && fw[c][k] > -Infinity && bw[c][k] > -Infinity && fw[c][k] + bw[c][k] - 1 === gmax) cands.push({ c, k });
    });
    let did = null;
    for (const { c, k } of cands) {
      const n = cols[c][k], st = n.type, fo = n.foe, ch = n.foeCharms;
      promote(n);
      if (fewestFights()[lastCol][0] >= CIRCUIT_MIN_FIGHTS && longestNonFightRun() <= 3) { did = { c, k }; break; }
      n.type = st; n.foe = fo; n.foeCharms = ch;        // would break the floor or the rest cap — revert
    }
    if (!did) break; // nothing safely promotable on the max route — leave it
  }
  // Restore pass — authored content the fight rules may have eaten on rare dense
  // maps (~2–6%): re-seat a missing Shop (2 per act) or the Puzzle (1) in place
  // onto a safe non-fight slot, preserving edges. Non-fight → the type only; a
  // Shop also avoids the first two columns, the pre-boss column, rest-adjacency,
  // and stays ≥2 columns from the other shop.
  const setType = (node, c, k, type) => {
    node.type = type; node.foe = null; node.foeCharms = []; node.puzzle = undefined;
    if (type === 'puzzle' && PUZZLE_KEYS.length) node.puzzle = PUZZLE_KEYS[Math.floor(rnd() * PUZZLE_KEYS.length)];
  };
  const restAdjacent = (c, k) => cols[c - 1].some(p => isRest(p.type) && (p.edges || []).includes(k))
    || (cols[c][k].edges || []).some(j => isRest(cols[c + 1][j].type));
  if (PUZZLE_KEYS.length && !cols.flat().some(n => n.type === 'puzzle')) {
    outer: for (let c = 2; c < lastCol - 1; c++) for (let k = 0; k < cols[c].length; k++) {
      const n = cols[c][k]; if (!isFight(n.type) && !isRest(n.type)) { setType(n, c, k, 'puzzle'); break outer; }
    }
  }
  const shopColsNow = () => cols.map((col, c) => col.some(n => n.type === 'shop') ? c : -1).filter(c => c >= 0);
  for (let guard = 0; guard < 4 && cols.flat().filter(n => n.type === 'shop').length < 2; guard++) {
    const have = shopColsNow(); let placed = false;
    for (let c = 2; c <= lastCol - 3 && !placed; c++) {
      if (have.some(sc => Math.abs(sc - c) < 2)) continue;               // ≥2 columns off any shop
      for (let k = 0; k < cols[c].length; k++) {
        const n = cols[c][k];
        if (isFight(n.type) || isRest(n.type) || n.type === 'puzzle') continue; // convert a plain Encounter
        if (restAdjacent(c, k)) continue;                                 // don't create a rest pair
        setType(n, c, k, 'shop'); placed = true; break;
      }
    }
    if (!placed) break; // no safe slot — leave it (rare)
  }
  return { act, cols, pos: null }; // pos = the node you're currently on (null = before the entry)
}
// The nodes you may enter next: the entry column when nowhere yet, else the
// edges of the node you're on.
function circuitReachable(m) {
  if (!m.pos) return m.cols[0].slice();
  const cur = m.cols[m.pos.col][m.pos.idx];
  return (cur.edges || []).map(j => m.cols[m.pos.col + 1][j]);
}

function circuitOpponent() {
  const pool = BOT_POOL.filter(n => n !== GAUNTLET.opp); // no immediate repeat
  return pool[Math.floor(rnd() * pool.length)];
}

// Each regular fields a build that matches their habits — a leaning 4-stone
// pouch and two effect cards in an otherwise one-of-each deck. So a foe plays
// to a recognizable identity (the Ferryman steals and drains, the Clerk locks
// and anchors), and the same depleting draw applies to both sides of the table.
// `charms` is the pool an elite/boss of that name draws from — passive levers
// only (board/score), so they read as a tougher version of the same identity.
const CIRCUIT_BUILDS = {
  'The Ferryman': { pouch: { blue: 2, black: 1, white: 1 }, fx: [{ type: 'Ferry', fx: 'drain' }, { type: 'Coin', fx: 'keen' }], charms: ['passagetoll', 'whetstone', 'strongfinish'] },
  'The Clerk':    { pouch: { white: 2, red: 1, black: 1 },  fx: [{ type: 'Coin', fx: 'anchor' }, { type: 'Crest', fx: 'keen' }], charms: ['forgerseal', 'floorprice', 'loadedcoin'] },
  'The Miner':    { pouch: { red: 2, black: 1, white: 1 },  fx: [{ type: 'Coin', fx: 'keen' }, { type: 'Crest', fx: 'lodestone' }], charms: ['loadedcoin', 'masterforger', 'firstblood'] },
  'The Lady':     { pouch: { blue: 2, white: 1, black: 1 }, fx: [{ type: 'Crest', fx: 'anchor' }, { type: 'Quill', fx: 'drain' }], charms: ['floorprice', 'whetstone', 'forgerseal'] },
  'The Wagoner':  { pouch: { blue: 2, black: 1, red: 1 },   fx: [{ type: 'Road', fx: 'drain' }, { type: 'Ferry', fx: 'lodestone' }], charms: ['passagetoll', 'strongfinish', 'whetstone'] },
  'The Tinker':   { pouch: { red: 2, white: 1, black: 1 },  fx: [{ type: 'Sword', fx: 'keen' }, { type: 'Bread', fx: 'keen' }], charms: ['forgerseal', 'masterforger', 'firstblood'] },
  'The Stranger': { pouch: { blue: 1, black: 1, red: 1, white: 1 }, fx: [{ type: 'Quill', fx: 'drain' }, { type: 'Chain', fx: 'anchor' }], charms: ['whetstone', 'floorprice', 'strongfinish'] },
  'The Old Hand': { pouch: { white: 2, black: 1, blue: 1 }, fx: [{ type: 'Crest', fx: 'anchor' }, { type: 'Chain', fx: 'lodestone' }], charms: ['floorprice', 'forgerseal', 'firstblood'] },
  'The Deckhand': { pouch: { red: 1, white: 1, blue: 1, black: 1 }, fx: [{ type: 'Coin', fx: 'keen' }, { type: 'Sword', fx: 'lodestone' }], charms: ['loadedcoin', 'whetstone', 'forgerseal'] },
};
const CIRCUIT_DEFAULT_BUILD = { pouch: { red: 1, white: 1, blue: 1, black: 1 }, fx: [] };
// Neutral foes — the anonymous toughs who fill the DUEL nodes. They carry no
// signature relic and never headline an Elite/Boss; the named regulars do that.
// Each still fields a themed build so duels read like the act they're in.
const CIRCUIT_NEUTRALS = {
  // Act I — the roads abroad (plain/road/river play)
  'A Drifter':         { pouch: { red: 1, white: 1, blue: 1, black: 1 }, fx: [{ type: 'Coin', fx: 'keen' }, { type: 'Sword', fx: 'lodestone' }] },
  'A Roadside Tough':  { pouch: { red: 2, white: 1, black: 1 },          fx: [{ type: 'Sword', fx: 'keen' }, { type: 'Bread', fx: 'keen' }] },
  'A Ferry Hand':      { pouch: { blue: 2, black: 1, red: 1 },           fx: [{ type: 'Ferry', fx: 'lodestone' }, { type: 'Road', fx: 'drain' }] },
  'A Toll Collector':  { pouch: { white: 2, black: 1, blue: 1 },         fx: [{ type: 'Road', fx: 'anchor' }, { type: 'Coin', fx: 'keen' }] },
  'A Peddler':         { pouch: { red: 1, white: 1, blue: 1, black: 1 }, fx: [{ type: 'Coin', fx: 'keen' }, { type: 'Crest', fx: 'anchor' }] },
  // Act II — the Phirra underbelly (blue/black tricks, theft, drain)
  'A Cutpurse':        { pouch: { blue: 2, black: 1, red: 1 },           fx: [{ type: 'Quill', fx: 'drain' }, { type: 'Coin', fx: 'keen' }] },
  'A Slum Bravo':      { pouch: { red: 2, black: 1, white: 1 },          fx: [{ type: 'Sword', fx: 'siphon' }, { type: 'Bread', fx: 'keen' }] },
  'A Hall Tout':       { pouch: { blue: 1, white: 1, red: 1, black: 1 }, fx: [{ type: 'Coin', fx: 'keen' }, { type: 'Crest', fx: 'anchor' }] },
  'A Smuggler':        { pouch: { blue: 2, black: 2 },                   fx: [{ type: 'Chain', fx: 'drain' }, { type: 'Quill', fx: 'siphon' }] },
  'A Card Sharp':      { pouch: { white: 1, blue: 2, black: 1 },         fx: [{ type: 'Crest', fx: 'anchor' }, { type: 'Coin', fx: 'keen' }] },
  // Act III — the high courts (white/anchor, statecraft)
  'A Court Page':      { pouch: { white: 2, red: 1, black: 1 },          fx: [{ type: 'Crest', fx: 'anchor' }, { type: 'Chain', fx: 'lodestone' }] },
  'A Bailiff':         { pouch: { white: 2, black: 1, blue: 1 },         fx: [{ type: 'Chain', fx: 'lodestone' }, { type: 'Crest', fx: 'anchor' }] },
  'A Petitioner':      { pouch: { white: 1, red: 1, blue: 1, black: 1 }, fx: [{ type: 'Quill', fx: 'keen' }, { type: 'Coin', fx: 'anchor' }] },
  "A Magistrate's Clerk": { pouch: { white: 2, red: 1, black: 1 },       fx: [{ type: 'Coin', fx: 'anchor' }, { type: 'Crest', fx: 'keen' }] },
  "A Noble's Second":  { pouch: { blue: 1, white: 2, black: 1 },         fx: [{ type: 'Crest', fx: 'drain' }, { type: 'Chain', fx: 'anchor' }] },
};
// Per-act casts. Named regulars headline Elites/Bosses (and drop signatures);
// neutral toughs fill the duels. The arc: the roads abroad → the Phirra
// underbelly → the high courts.
const CIRCUIT_ACT_FOES = {
  1: { named: ['The Ferryman', 'The Wagoner', 'The Deckhand', 'The Old Hand'], neutral: ['A Drifter', 'A Roadside Tough', 'A Ferry Hand', 'A Toll Collector', 'A Peddler'] },
  2: { named: ['The Miner', 'The Stranger', 'The Lady', 'The Tinker'], neutral: ['A Cutpurse', 'A Slum Bravo', 'A Hall Tout', 'A Smuggler', 'A Card Sharp'] },
  3: { named: ['The Clerk', 'The Lady', 'The Old Hand', 'The Stranger'], neutral: ['A Court Page', 'A Bailiff', 'A Petitioner', "A Magistrate's Clerk", "A Noble's Second"] },
};
function actCast(act) { return CIRCUIT_ACT_FOES[act] || CIRCUIT_ACT_FOES[3]; }
// A duel draws a neutral tough; an Elite/Boss draws a named regular — all from
// the current act's cast, so the pool is hard-restricted by where you are.
function pickFoeFor(type, act) {
  const cast = actCast(act);
  const pool = (type === 'duel') ? cast.neutral : cast.named;
  return pool[Math.floor(rnd() * pool.length)];
}
function circuitBuildFor(name) {
  const b = CIRCUIT_BUILDS[name] || CIRCUIT_NEUTRALS[name] || CIRCUIT_DEFAULT_BUILD;
  return { pouch: Object.assign({}, b.pouch), deck: TYPES.slice().concat(b.fx || []) };
}
// Venues are scoped to each act's region: the roads abroad (Tavern / Docks) →
// the Phirra underbelly (Slums / Hall) → the high courts (Court of Precedence).
const CIRCUIT_ACT_VENUES = { 1: ['tavern', 'tavern', 'docks'], 2: ['slums', 'slums', 'hall'], 3: ['court'] };
function actVenues(act) { return CIRCUIT_ACT_VENUES[act] || CIRCUIT_ACT_VENUES[3]; }
// Each act also tunes its own texture: Act I is gentler (more Reposes, fewer
// Elites), Act II squeezes (more Elites, fewer Reposes), Act III leans on
// strange Encounters. (Foe Standing already ramps across acts via the tier.)
function actTuning(act) {
  let t;
  if (act === 1) t = { elite: 0.12, event: 0.28, repose: 0.10, reposes: 2 };
  else if (act === 2) t = { elite: 0.28, event: 0.24, repose: 0.06, reposes: 1 };
  else t = { elite: 0.24, event: 0.34, repose: 0.06, reposes: 1 }; // act 3+
  // Marked Cards (chit): meaner maps — more Elites, one fewer guaranteed Repose.
  if (ccfg('eliteBias')) { t = Object.assign({}, t, { elite: Math.min(0.5, t.elite + 0.15), repose: Math.max(0, t.repose - 0.03), reposes: Math.max(0, t.reposes - 1) }); }
  return t;
}

/* ---- Depleting decks: both the card deck and the stone pouch are draw piles
   that reshuffle their discard when dry, per seat (you AND the foe). Reset at
   the start of each table (a fresh shuffle of the whole owned deck/pouch), then
   cycle hand to hand. ---- */
function makePileSet(deck, pouch) {
  const stoneDraw = [];
  for (const c of Object.keys(pouch || {})) for (let i = 0; i < (pouch[c] || 0); i++) stoneDraw.push(c); // includes variant keys
  return {
    deck: deck || [], pouch: pouch || {},
    cardDraw: shuffle((deck || []).slice()), cardDiscard: [], cardHand: null,
    stoneDraw: shuffle(stoneDraw), stoneDiscard: [], stoneHand: null,
  };
}
function circuitResetPiles() {
  const g = GAUNTLET;
  g.piles = {};
  g.piles[0] = makePileSet(g.deck, g.pouch);                 // you (seat 0)
  if (g.oppDeck || g.oppPouch) g.piles[1] = makePileSet(g.oppDeck, g.oppPouch); // the foe (seat 1)
  if (g.allyDeck || g.allyPouch) g.piles[2] = makePileSet(g.allyDeck, g.allyPouch); // the recruited ally (seat 2, co-op only)
}
// Draw n entries from a depleting pile (draw → discard → reshuffle when dry).
function drawPile(draw, discard, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!draw.length) {
      if (!discard.length) break;        // both piles spent — deck smaller than n
      while (discard.length) draw.push(discard.pop());
      shuffle(draw);
    }
    out.push(draw.pop());
  }
  return out;
}
// Each hand: last hand's draw goes to the discard, then draw a fresh hand.
function pileDrawCards(ps, n) {
  if (ps.cardHand) for (const c of ps.cardHand) ps.cardDiscard.push(c);
  ps.cardHand = drawPile(ps.cardDraw, ps.cardDiscard, n);
  return ps.cardHand;
}
function pileDrawStones(ps, n) {
  if (ps.stoneHand) for (const s of ps.stoneHand) ps.stoneDiscard.push(s);
  ps.stoneHand = drawPile(ps.stoneDraw, ps.stoneDiscard, n);
  const drawn = {}; // keyed by stone key (base colour or variant)
  for (const s of ps.stoneHand) drawn[s] = (drawn[s] || 0) + 1;
  return drawn;
}
// Discard a card from hand back to the pile (Mulligan/Cycle): pull its spec out
// of this hand's pile-hand and push it to the discard, and remove the object —
// so it isn't double-discarded at hand's end and the deck stays conserved.
function circuitDiscardHandCard(seat, card) {
  const ps = GAUNTLET.piles && GAUNTLET.piles[seat]; if (!ps) return;
  const p = G.players[seat];
  const hi = p.hand.indexOf(card); if (hi >= 0) p.hand.splice(hi, 1);
  const ci = G.cards.indexOf(card); if (ci >= 0) G.cards.splice(ci, 1);
  if (ps.cardHand) { const si = ps.cardHand.findIndex(s => specType(s) === card.type && (specFx(s) || null) === (card.fx || null)); if (si >= 0) ps.cardHand.splice(si, 1); }
  ps.cardDiscard.push(card.fx ? { type: card.type, fx: card.fx } : card.type);
}
// Draw a single card from a seat's pile straight into hand mid-hand (Cantrip /
// Cycle). The spec joins this hand's pile-hand so it discards at hand's end —
// the deck stays conserved. Returns the new card (or null if the pile is empty).
function circuitDrawOne(seat) {
  if (!G.gauntlet) return null;
  const ps = GAUNTLET.piles && GAUNTLET.piles[seat];
  if (!ps) return null;
  const specs = drawPile(ps.cardDraw, ps.cardDiscard, 1);
  if (!specs.length) return null;
  const spec = specs[0];
  const type = (spec && typeof spec === 'object') ? spec.type : spec;
  const fx = (spec && typeof spec === 'object') ? spec.fx : null;
  const nid = G.cards.reduce((m, c) => Math.max(m, c.id), -1) + 1;
  const card = { id: nid, type, fx, owner: seat, origOwner: seat, zone: 'hand', faceUp: false, stones: [], prov: null, known: G.players.map((_, i) => i === seat) };
  G.cards.push(card);
  G.players[seat].hand.push(card);
  if (ps.cardHand) ps.cardHand.push(spec);
  // Flag it so the hand renderer deals it in with a brief animation — a card
  // popping straight into the hand is hard to track when you've just played one.
  if (typeof UI !== 'undefined' && UI && seat === G.viewer) UI.dealtIds = (UI.dealtIds || []).concat(card.id);
  return card;
}

// The overall difficulty depth of a node (act + column drive foe Standing/venue).
function nodeTier(act, col) { return (act - 1) * CIRCUIT.actRows + col; }
// Enter a chosen node: an event runs the interlude; a fight is set up and played.
function circuitEnterNode(node) {
  const g = GAUNTLET;
  hideMapTip(); // a tapped node's hover tip would otherwise stay pinned over the encounter
  g.curNode = node;
  if (node.type === 'event') { g.event = makeCircuitEvent(); circuitEventScreen(); return; }
  if (node.type === 'repose') { g.event = { kind: 'interlude', choice: null, cardIdx: null, stoneColor: null, srcIdx: null, dstIdx: null }; circuitEventScreen(); return; }
  if (node.type === 'shop') { g.shop = makeShop(); circuitShopScreen(); return; }
  if (node.type === 'puzzle') { g.puzzle = { key: node.puzzle || PUZZLE_KEYS[0], tryN: 0, sel: null }; circuitPuzzleScreen(); return; }
  circuitBeginFight(node);
}
// Named foes (Elites & Bosses — the regulars with a face) get a spoken plate as
// you sit down; the frequent neutral duels stay quick and silent.
function circuitBeginFight(node) {
  const foe = node && node.foe;
  const speaks = typeof document !== 'undefined' && foe && portraitFor(foe)
    && (node.type === 'elite' || node.type === 'boss') && FOE_SOLO_TAUNTS[foe]
    && showCircuitScene(node.type);
  if (speaks) { circuitPrefightScreen(node); return; }
  circuitSetupFight(node);
}
function circuitPrefightScreen(node) {
  const g = GAUNTLET;
  const boss = node.type === 'boss';
  const body = eventShell(boss ? 'The road’s end — a Boss' : 'A named hand bars the road',
    `Standing ${g.standing}/${g.maxStanding}. ${node.foe} holds this stretch of ${node.type === 'boss' ? 'the act' : 'the road'}. There’s no going around.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = dialoguePlate(node.foe, foeSoloTaunt(node.foe), { side: 'right', foe: true })
    + dialogueSkipLink(boss ? 'cbosses' : 'elites');
  body.appendChild(sec);
  wireDialogueSkipLink(sec);
  const row = document.createElement('div'); row.className = 'eventopts';
  const go = document.createElement('button'); go.className = 'eventopt'; go.style.maxWidth = '260px';
  go.innerHTML = `<div class="eventopt-l">Sit down</div><div class="eventopt-n">Take ${node.foe} across the table${boss ? ' — break them to clear the act' : ''}.</div>`;
  go.onclick = () => { closeModal('circuitModal'); circuitSetupFight(node); };
  row.appendChild(go);
  body.appendChild(row);
}
// Set up a duel/elite/boss for the given node (foe, venue, Standing, foe charms).
function circuitSetupFight(node) {
  const g = GAUNTLET;
  g.allyDeck = null; g.allyPouch = null; // a plain duel is never co-op — drop any ally pile from a prior 2v1
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  charmFire('fightStart');
  g.opp = node.foe;
  const tier = nodeTier(g.act, node.col);
  const vp = actVenues(g.act); g.venue = vp[node.col % vp.length]; // venues are scoped to the act's region
  let max = Math.round(ccfg('foeBase') + tier * ccfg('foeStep')); // whole-number Standing — the step is fractional
  if (node.type === 'elite') max = Math.round(max * ccfg('eliteHpMult'));
  if (node.type === 'boss') max = Math.round(max * ccfg('bossHpMult'));
  g.foeMax = max; g.foeHp = max;
  g.foeCharms = node.foeCharms || [];
  const build = circuitBuildFor(node.foe);
  g.oppDeck = build.deck; g.oppPouch = foePouchWithChits(build.pouch);
  circuitResetPiles();
  closeModal('circuitModal');
  if (logEl) logEl.innerHTML = '';
  // A very high target so the engine never ends the table via the ledger —
  // Standing depletion decides it instead (see circuitHandResult).
  newGame({ mode: 'duel', humans: [0], companyNames: [node.foe], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
  updateCircuitHud();
}
// Mark the current node done and advance the map — to the next column, the next
// act (after a boss), or the run victory (after the last act's boss).
function circuitAfterNode() {
  const g = GAUNTLET, m = g.map;
  const node = g.curNode;
  const wasBoss = node && node.type === 'boss';
  if (node) { node.done = true; m.pos = { col: node.col, idx: node.idx }; } // you now stand on it
  // A bested act boss respects you now — they join the bench, recruitable later as a 2v1 ally.
  if (wasBoss && node.foe) { g.allies = g.allies || []; if (!g.allies.includes(node.foe)) g.allies.push(node.foe); }
  g.curNode = null;
  if (wasBoss) {
    if (g.act >= CIRCUIT.acts) { circuitVictory(); return; }
    g.act++; g.map = buildAct(g.act);
    g.standing = Math.min(g.maxStanding, g.standing + ccfg('heal')); // a breather between acts
    g.secondWindUsed = false; // Second Wind recharges each act
    circuitActIntro(g.act, circuitToMap); return; // cinematic open on the new act
  }
  circuitToMap();
}
// Show the map — but settle a Wildcard imbue first if one is owed.
function circuitToMap() {
  const g = GAUNTLET;
  if (typeof document !== 'undefined' && charmHas('wildcard') && !g.deck.some(c => specFx(c) === 'wild')) { circuitWildImbueScreen(); return; }
  circuitMapScreen();
}
// The act cinematic — a short panning clip over the act's region (art slot at
// assets/acts/actN.{webm,mp4}) with a painted-gradient fallback, the act name,
// and its tagline. Headless calls straight through.
const CIRCUIT_ACTS = {
  1: { name: 'The Roads Abroad', tag: 'Frontier taverns and the river crossing — the long road in.' },
  2: { name: 'The Phirra Underbelly', tag: 'The city’s slums and gambling halls. Mind your purse, and your stones.' },
  3: { name: 'The High Courts', tag: 'The Court of Precedence — statecraft values, and masters who do not lose.' },
};
function circuitActIntro(act, then) {
  if (typeof document === 'undefined') { if (then) then(); return; }
  const info = CIRCUIT_ACTS[act] || CIRCUIT_ACTS[3];
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.add('wide');
  $('circuitTitle').textContent = ''; $('circuitText').textContent = '';
  const body = $('circuitStats'); body.className = 'actintro'; body.innerHTML = '';
  const scene = document.createElement('div'); scene.className = 'actscene act' + act;
  scene.innerHTML =
    `<video class="actvid" autoplay muted loop playsinline preload="auto">` +
      `<source src="assets/acts/act${act}.webm?v=1" type="video/webm">` +
      `<source src="assets/acts/act${act}.mp4?v=1" type="video/mp4">` +
    `</video>` +
    `<div class="actscene-cap"><div class="actscene-kick">Act ${act} of ${CIRCUIT.acts}</div>` +
    `<div class="actscene-title">${info.name}</div><div class="actscene-tag">${info.tag}</div></div>`;
  body.appendChild(scene);
  const next = $('circuitNext'); next.style.display = '';
  next.disabled = false; next.textContent = act === 1 ? 'Set out ›' : 'Press on ›';
  next.onclick = () => { if (then) then(); };
  $('circuitModal').classList.add('open');
}

// On taking the Wildcard charm: choose one owned card to imbue (it then counts
// as any type for a Pair/Triad). Re-offered if that card is ever removed.
function circuitWildImbueScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  if (g.wildPick === undefined) g.wildPick = null;
  SFX.play('win');
  const body = eventShell('A Wild Card', 'The Wildcard is yours. Choose one card to imbue — it will stand as ANY type for a Pair or Triad, every hand for the rest of the run.');
  body.appendChild(eventCardPicker('Imbue which card?', i => g.wildPick === i, i => { g.wildPick = (g.wildPick === i ? null : i); circuitWildImbueScreen(); }));
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = '';
  next.disabled = g.wildPick == null;
  next.textContent = g.wildPick == null ? 'Choose a card' : 'Imbue it ›';
  next.onclick = () => {
    if (g.wildPick != null) { g.deck[g.wildPick] = { type: specType(g.deck[g.wildPick]), fx: 'wild' }; g.wildPick = null; }
    circuitMapScreen();
  };
  $('circuitModal').classList.add('open');
}

// A node's foe Standing (for the map preview).
function nodeFoeMax(node) {
  let m = Math.round(ccfg('foeBase') + nodeTier(GAUNTLET.act, node.col) * ccfg('foeStep'));
  if (node.type === 'elite') m = Math.round(m * ccfg('eliteHpMult'));
  if (node.type === 'boss') m = Math.round(m * ccfg('bossHpMult'));
  return m;
}
// The road ahead reads only by KIND (icon), with a legend + hover tip naming it —
// who waits at a fight and how hard stays unknown until you're at the table.
const MAP_NODE_ORDER = ['duel', 'elite', 'boss', 'repose', 'shop', 'event', 'puzzle'];
const MAP_NODE_NAME = { duel: 'Duel', elite: 'Elite', boss: 'Boss', repose: 'Repose', shop: 'Shop', event: 'Encounter', puzzle: 'Puzzle' };
const MAP_NODE_SUB = { duel: 'a standing fight', elite: 'a hardened foe', boss: 'the act’s master', repose: 'rest & refit', shop: 'spend your coin', event: 'who knows what', puzzle: 'a tailored riddle' };
const MAP_NODE_ICON = { duel: '⚔', elite: '★', boss: '☠', repose: '✦', shop: '⛃', event: '?', puzzle: '◆' };
// Hand-drawn SVG icons (recolour by state via currentColor) — crisp and identical
// on every device, unlike the Unicode glyphs they replace.
const MAP_NODE_SVG = {
  duel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l10 10"/><path d="M19 5L9 15"/><path d="M3.4 7.4l3-3"/><path d="M20.6 7.4l-3-3"/><path d="M13.5 16.5l2.6 2.6"/><path d="M10.5 16.5L7.9 19.1"/></svg>',
  elite: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.9 6.2 20.3l1.6-6.6L2.6 9.3l6.8-.5z"/></svg>',
  boss: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6c-4.6 0-7.7 3.1-7.7 7.5 0 2 .8 3.7 2.2 4.9v2.3c0 1 .8 1.8 1.8 1.8h.5v1.7c0 .3.3.6.6.6s.6-.3.6-.6v-1.7h2.8v1.7c0 .3.3.6.6.6s.6-.3.6-.6v-1.7h.5c1 0 1.8-.8 1.8-1.8V15c1.4-1.2 2.2-2.9 2.2-4.9 0-4.4-3.1-7.5-7.5-7.5z"/><circle cx="9" cy="10.6" r="1.7" fill="#140d06"/><circle cx="15" cy="10.6" r="1.7" fill="#140d06"/><path d="M11 14.5h2v3h-2z" fill="#140d06"/></svg>',
  repose: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c0 4-1 6.8-2 8.2.5 1 1.5 2 1.2 3.4-.9-.7-1.4-1.9-1.2-3.1C9.1 12 7.5 13 7.5 15.6c0 2.2 1.6 3.8 3.4 4.1-.9-.8-1.1-2.1-.7-3.1.5-1.3 2.1-2.3 1.8-4.3.9.7 1.4 1.9 1.2 3.1.6-.6 1-1.4 1-2.4C14.2 9.4 12 8.5 12 2.2z"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.4"/></svg>',
  event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8.6 9a3.5 3.5 0 1 1 5.1 3.1c-1.2.7-1.7 1.5-1.7 2.8"/><circle cx="12" cy="18.4" r="1.2" fill="currentColor" stroke="none"/></svg>',
  puzzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 2.5l9 9-9 10-9-10z"/><path d="M3.2 11.5h17.6"/><path d="M12 2.5l-4 9 4 10 4-10z"/></svg>',
};
function mapNodeHtml(node) { return `<div class="mapnode-i">${MAP_NODE_SVG[node.type] || MAP_NODE_ICON[node.type] || ''}</div>`; }
// A single fixed-position tooltip (so the scrolling map can't clip it).
function mapTipEl() { let t = document.getElementById('maptip'); if (!t) { t = document.createElement('div'); t.id = 'maptip'; t.className = 'maptip'; document.body.appendChild(t); } return t; }
// On touch there's no mouseleave, so the hover tip a tap raises would otherwise
// stay pinned over the match. Hide it whenever we leave the map. (Doesn't create
// the element — safe headless.)
function hideMapTip() { if (typeof document === 'undefined') return; const t = document.getElementById('maptip'); if (t) t.classList.remove('show'); }
function wireMapTip(btn, node) {
  const show = () => { const t = mapTipEl(); t.innerHTML = `<div class="maptip-h mapnode-${node.type}">${MAP_NODE_NAME[node.type]}</div><div class="maptip-b">${MAP_NODE_SUB[node.type] || ''}</div>`; const r = btn.getBoundingClientRect(); t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top - 6) + 'px'; t.classList.add('show'); };
  btn.addEventListener('mouseenter', show);
  btn.addEventListener('mouseleave', hideMapTip);
  btn.addEventListener('touchend', hideMapTip); // touch fires no mouseleave — dismiss on tap-up
}
// The act map — pick a node in the current column to advance toward the boss.
// Build the map's node track (columns × lanes). Interactive on the between-fights
// map — reachable nodes click to enter. Read-only for the in-match peek: every
// node disabled, but `done` history, your `here` position, and the branches ahead
// still render, so it reads as a reference of the route. `hereKey` ("col,idx")
// marks which node is lit as your position (last-cleared between fights, the
// current node during a peek).
function buildMapTrack(m, act, interactive, hereKey) {
  const reach = new Set(circuitReachable(m).map(n => n.col + ',' + n.idx));
  const track = document.createElement('div'); track.className = 'maptrack mapact' + Math.min(act, 3); // region texture on the TRACK so it pans with the nodes
  m.cols.forEach((col) => {
    const colEl = document.createElement('div'); colEl.className = 'mapcol';
    for (let lane = 0; lane < MAP_LANES; lane++) {            // fixed lanes → diagonal branches
      const node = col.find(n => n.lane === lane);
      if (!node) { const sp = document.createElement('div'); sp.className = 'mapslot'; colEl.appendChild(sp); continue; }
      const here = hereKey && hereKey === node.col + ',' + node.idx;
      const ok = reach.has(node.col + ',' + node.idx);
      const b = document.createElement('button');
      b.className = 'mapnode mapnode-' + node.type + (node.done ? ' done' : '') + (here ? ' here' : '') + (ok ? ' reach' : '');
      b.dataset.col = node.col; b.dataset.idx = node.idx;
      b.disabled = interactive ? !ok : true; // the peek is look-only
      b.innerHTML = mapNodeHtml(node);
      wireMapTip(b, node); // styled hover tooltip names the node
      if (interactive && ok) b.onclick = () => circuitEnterNode(node);
      colEl.appendChild(b);
    }
    track.appendChild(colEl);
  });
  return track;
}
// A read-only look at the run map, opened from the in-match HUD — the same map,
// nodes un-clickable, your current node lit. It's a memory aid for pushing risk:
// how many fights to the boss, whether a Repose or Shop is coming, what the path
// forward costs. Navigation still happens only on the between-fights map.
function showMapPeek() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  if (!g || !g.active || !g.map) return;
  const m = g.map;
  $('mapPeekTitle').textContent = `Act ${g.act} — ${(CIRCUIT_ACTS[g.act] || CIRCUIT_ACTS[3]).name}`;
  const sub = $('mapPeekText');
  if (sub) sub.textContent = `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin · score ${g.score}. Your route ahead — reference only; you move on the map between tables.`;
  const body = $('mapPeekBody'); body.className = 'circuitmap'; body.innerHTML = '';
  const tip0 = document.getElementById('maptip'); if (tip0) tip0.classList.remove('show');
  const grid = document.createElement('div'); grid.className = 'mapgrid';
  // Mid-fight you stand ON the current node (m.pos still points at the last-cleared
  // one), so light the node you're fighting at.
  const hereKey = g.curNode ? g.curNode.col + ',' + g.curNode.idx : (m.pos ? m.pos.col + ',' + m.pos.idx : null);
  const track = buildMapTrack(m, g.act, false, hereKey);
  grid.appendChild(track);
  body.appendChild(grid);
  $('mapPeekClose').onclick = () => closeModal('mapPeekModal');
  $('mapPeekModal').classList.add('open');
  requestAnimationFrame(() => { drawMapEdges(track, m); fitMapToWidth(grid, track); ensureCurrentNodeVisible(grid, track); });
}

function circuitMapScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET, m = g.map;
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.add('wide');
  $('circuitTitle').textContent = `Act ${g.act} — ${(CIRCUIT_ACTS[g.act] || CIRCUIT_ACTS[3]).name}`;
  $('circuitText').textContent = `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin · score ${g.score}. Choose your path to the boss.`;
  const body = $('circuitStats'); body.className = 'circuitmap'; body.innerHTML = '';
  const tip0 = document.getElementById('maptip'); if (tip0) tip0.classList.remove('show'); // clear any stale hover tip
  // A scroll viewport with an inner track: the track is max-content and auto-
  // margined, so it CENTERS when it fits but scrolls from the LEFT when it
  // overflows (a portrait phone). Centering the flex directly would push the
  // first column into unreachable overflow — the bug being fixed here.
  const grid = document.createElement('div'); grid.className = 'mapgrid';
  const hereKey = m.pos ? m.pos.col + ',' + m.pos.idx : null; // between fights you stand on the last-cleared node
  const track = buildMapTrack(m, g.act, true, hereKey);
  grid.appendChild(track);
  body.appendChild(grid);
  // Legend — tucked into a press-to-reveal popup (nodes themselves are icon-only).
  const lwrap = document.createElement('div'); lwrap.className = 'maplegendwrap';
  const lbtn = document.createElement('button'); lbtn.className = 'btn maplegendbtn'; lbtn.textContent = '◇ Legend';
  const pop = document.createElement('div'); pop.className = 'maplegendpop'; pop.style.display = 'none';
  pop.innerHTML = `<button class="maplegendclose" title="Close">×</button>` +
    MAP_NODE_ORDER.map(t => `<span class="maplegend-i mapnode-${t}">${MAP_NODE_SVG[t] || MAP_NODE_ICON[t]}</span><span class="maplegend-n">${MAP_NODE_NAME[t]}</span>`).join('');
  const closePop = () => { pop.style.display = 'none'; document.removeEventListener('click', offClick); };
  const offClick = e => { if (!lwrap.contains(e.target)) closePop(); };
  lbtn.onclick = e => {
    e.stopPropagation();
    if (pop.style.display === 'none') { pop.style.display = ''; setTimeout(() => document.addEventListener('click', offClick), 0); }
    else closePop();
  };
  pop.querySelector('.maplegendclose').onclick = closePop;
  lwrap.appendChild(lbtn); lwrap.appendChild(pop); body.appendChild(lwrap);
  $('circuitNext').style.display = 'none'; // navigation is by clicking a node
  $('circuitModal').classList.add('open');
  requestAnimationFrame(() => { drawMapEdges(track, m); fitMapToWidth(grid, track); ensureCurrentNodeVisible(grid, track); });
}
// On a roomy (mouse) viewport, scale the whole map down to fit the panel so no
// horizontal scrollbar is needed — the edges live inside the track, so they
// scale with the nodes. Touch/small screens keep scrolling (shrinking there
// would make nodes un-tappable); a very wide act that would shrink too far also
// falls back to scroll rather than becoming unreadable.
function fitMapToWidth(grid, track) {
  if (typeof window === 'undefined') return;
  track.style.transform = ''; track.style.transformOrigin = 'top left';
  grid.style.overflowX = ''; grid.style.height = '';
  const roomy = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!roomy) return;
  const natural = track.scrollWidth, avail = grid.clientWidth;
  if (natural <= avail + 1) return;          // already fits — nothing to do
  const s = avail / natural;
  if (s < 0.62) return;                       // would shrink too far — keep scroll
  track.style.transform = `scale(${s})`;
  grid.style.overflowX = 'hidden';
  grid.style.height = Math.ceil(track.offsetHeight * s) + 'px';
}
// On a narrow screen the map scrolls; bring the player's current position into
// view so the next choices are on-screen without manual panning.
function ensureCurrentNodeVisible(grid, track) {
  const here = track.querySelector('.mapnode.here') || track.querySelector('.mapnode.reach');
  if (!here || grid.scrollWidth <= grid.clientWidth) return;
  const target = here.offsetLeft - grid.clientWidth / 2 + here.offsetWidth / 2;
  grid.scrollLeft = Math.max(0, target);
}
// Draw the branch edges as an SVG overlay behind the nodes; the edges leaving
// your current position (your live choices) are highlighted.
function drawMapEdges(grid, m) {
  if (!grid || !grid.isConnected) return;
  grid.style.position = 'relative';
  const old = grid.querySelector('svg.mapedges'); if (old) old.remove();
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'mapedges');
  svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
  svg.style.width = grid.scrollWidth + 'px'; svg.style.height = grid.scrollHeight + 'px'; svg.style.pointerEvents = 'none';
  const btn = {}; grid.querySelectorAll('.mapnode').forEach(b => btn[b.dataset.col + ',' + b.dataset.idx] = b);
  const gr = grid.getBoundingClientRect();
  for (const col of m.cols) for (const node of col) for (const j of (node.edges || [])) {
    const from = btn[node.col + ',' + node.idx], to = btn[(node.col + 1) + ',' + j];
    if (!from || !to) continue;
    const fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
    const x1 = fr.right - gr.left, y1 = fr.top - gr.top + fr.height / 2;
    const x2 = tr.left - gr.left, y2 = tr.top - gr.top + tr.height / 2;
    const c = (x2 - x1) * 0.5; // horizontal-tangent control points → a smooth winding trail
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    const live = m.pos ? (m.pos.col === node.col && m.pos.idx === node.idx) : node.col === 0;
    path.setAttribute('class', 'mapedge' + (live ? ' live' : '') + (node.done ? ' taken' : ''));
    svg.appendChild(path);
  }
  grid.insertBefore(svg, grid.firstChild);
}

function circuitVictory() {
  const g = GAUNTLET; g.active = false; g.won = true;
  recordCircuitRun(g);
  const newDebts = recordChitClear(g.chitValue || 0); // clearing at this chit value can open more debts
  if (typeof document === 'undefined') return;
  SFX.play('win');
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.remove('wide');
  $('circuitStats').className = 'victoryunlocks';
  $('circuitTitle').textContent = 'The Circuit — Conquered';
  $('circuitText').textContent = `You ran all ${CIRCUIT.acts} acts and broke the final boss. Masterful.`;
  $('circuitStats').innerHTML = `<div class="unlockitem">Nodes cleared: <b>${g.cleared}</b></div>` +
    `<div class="unlockitem">Final score: <b>${g.score}</b></div>` +
    `<div class="unlockitem">Coin banked: <b>${g.coin}</b></div>` +
    (g.chitValue ? `<div class="unlockitem">Debts carried: <b>${g.chitValue} chit${g.chitValue === 1 ? '' : 's'}</b></div>` : '') +
    (newDebts ? `<div class="unlockitem gold">⛓ ${newDebts} new Debt${newDebts === 1 ? '' : 's'} earned — raise the stakes next run.</div>` : '');
  const rb = document.createElement('button'); rb.className = 'btn recordsbtn'; rb.textContent = 'Records & Compendium'; rb.onclick = showCircuitRecords;
  $('circuitStats').appendChild(rb);
  const next = $('circuitNext'); next.style.display = ''; next.disabled = false; next.textContent = 'Run it again'; next.onclick = () => startCircuit();
  $('circuitModal').classList.add('open');
}

// Each showdown: the hand winner deals its shaped margin to the loser's pool.
function circuitHandResult(winner, diff) {
  const g = GAUNTLET;
  if (!g.active || !winner || diff <= 0) return;
  if (winner.members.includes(0)) {
    const press = diff + ((charmHas('tithe') && diff >= 4) ? 1 : 0); // Tithe presses a big win harder
    const dmg = Math.min(press, ccfg('dmgCap')); // shaped: one hand can't decide a table outright
    g.foeHp = Math.max(0, g.foeHp - dmg);
    log(`The Circuit — you press ${g.opp} for ${dmg} (Standing ${g.foeHp}/${g.foeMax} left).`, 'you');
    charmFire('handWon');
    if (g.foeHp <= 0) { g.tableCleared = true; G.over = true; }
  } else {
    const dmg = Math.max(1, Math.min(diff, ccfg('dmgCap')) - charmVal('dmgReduce')); // Bulwark softens a lost hand (min 1)
    g.standing = Math.max(0, g.standing - dmg);
    log(`The Circuit — ${g.opp} presses you for ${dmg} (your Standing ${g.standing}/${g.maxStanding}).`, 'ai');
    charmFire('handLost');
    // Second Wind (boss relic): cheat death once per act.
    if (g.standing <= 0 && charmHas('secondwind') && !g.secondWindUsed) {
      g.secondWindUsed = true; g.standing = 1;
      log('Second Wind — you should be finished, but you find your feet at 1 Standing.', 'you');
      announce('Second Wind — you cling on at 1 Standing', 'white', 0);
    }
    if (g.standing <= 0) { g.groundOut = true; G.over = true; }
  }
  updateCircuitHud();
}

function circuitEnd() {
  const g = GAUNTLET, node = g.curNode || { type: 'duel' };
  g.allyDeck = null; g.allyPouch = null; g.ally = null; // the ally goes home once the table breaks
  closeModal('showdownModal');
  if (g.tableCleared) {
    g.cleared++;
    const tier = nodeTier(g.act, node.col || 0);
    g.score += 10 + tier;
    g.standing = Math.min(g.maxStanding, g.standing + ccfg('heal') + charmVal('healBonus'));
    const coinMult = ccfg('coinMult') || 1; // Costly Road (chit) lightens every purse
    let coinWon = Math.round((node.coop ? CIRCUIT.coinBoss : (node.type === 'boss' ? CIRCUIT.coinBoss : node.type === 'elite' ? CIRCUIT.coinElite : CIRCUIT.coinDuel)) * coinMult);
    coinWon += charmVal('coinBonus'); // War Chest — pays coin on a clear
    g.coin += coinWon;
    // Reward by node: duels grow the deck (card/stone); elites and bosses also
    // offer a charm. The reward screen's confirm advances.
    g.reward = makeReward({ charm: node.type === 'elite' || node.type === 'boss', charmCount: node.type === 'boss' ? 3 : 2, boss: node.type === 'boss', foe: node.foe });
    // The 2v1 always pays its one signature trophy: The Double-Cross (pre-taken).
    // If you somehow already hold it, the spoil converts to a coin bonus.
    if (node.coop) {
      if (!charmHas('doublecross')) { g.reward.charms = ['doublecross']; g.reward.charmPick = 'doublecross'; markCharmSeen('doublecross'); }
      else { g.reward.charms = []; coinWon += CIRCUIT.coinElite; g.coin += CIRCUIT.coinElite; }
    }
    g.reward.coin = coinWon; // shown explicitly on the spoils screen
    circuitRewardScreen();
  } else {
    g.active = false;
    recordCircuitRun(g); // bank the run into the persisted records
    circuitScreen(true);
  }
  updateCircuitHud();
}

// Node spoils: cards + stones always; a charm offer only when asked (elite/boss
// rewards), so charms are gated to the harder nodes rather than every fight.
// bossOnly charms (Wildcard) are kept out of the ordinary pool — shops, events,
// and elite rewards never roll them; they appear only as a boss spoil.
function unownedCharmKeys() { const owned = playerCharms(); return Object.keys(CHARMS).filter(k => owned.indexOf(k) < 0 && !CHARMS[k].bossOnly); }
// The signature relic a given persona drops (only as their boss).
function signatureRelicFor(foe) { return Object.keys(CHARMS).find(k => CHARMS[k].persona === foe) || null; }
function makeReward(opts) {
  opts = opts || {};
  let charmOffer = [];
  if (opts.charm && opts.boss) {
    // A boss offers a CHOICE of three: its own signature relic, a random charm,
    // and a Wildcard (pick one). Owned/absent slots fall back to more randoms.
    const owned = new Set(playerCharms());
    const sig = signatureRelicFor(opts.foe);
    if (sig && !owned.has(sig)) charmOffer.push(sig);
    const rand1 = shuffle(unownedCharmKeys().filter(k => !charmOffer.includes(k)))[0];
    if (rand1) charmOffer.push(rand1);
    if (!owned.has('wildcard') && !charmOffer.includes('wildcard')) charmOffer.push('wildcard');
    const fill = shuffle(unownedCharmKeys().filter(k => !charmOffer.includes(k)));
    while (charmOffer.length < 3 && fill.length) charmOffer.push(fill.shift());
  } else if (opts.charm) {
    charmOffer = shuffle(unownedCharmKeys()).slice(0, opts.charmCount || CIRCUIT.rewardCharms || 2);
  }
  charmOffer.forEach(markCharmSeen); // discovery: appearing in an offer reveals it in the compendium
  return {
    cards: circuitOfferCards(CIRCUIT.rewardCards),       // N effect cards (type + fx)
    stones: shuffle(STONE_KEYS.slice()).slice(0, CIRCUIT.rewardStones),
    charms: charmOffer,
    cardPick: null, stonePick: null, charmPick: null,
  };
}

// The spoils screen — pick one card and/or one stone (both optional), with a
// deck/pouch review you can open and close without losing your selection. Picks
// grow the OWNED deck/pouch, so they reshape the depleting draw from here on.
function circuitRewardScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  if (!g.reward) g.reward = makeReward();
  const r = g.reward;
  SFX.play('win');
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.add('wide');
  const node = g.curNode || { type: 'duel' };
  $('circuitTitle').textContent = (node.coop ? 'Rival at your side — the foe falls' : node.type === 'boss' ? 'Boss cleared' : node.type === 'elite' ? 'Elite cleared' : 'Node cleared') + ' — take your spoils';
  $('circuitText').textContent = `Standing ${g.standing}/${g.maxStanding}. Add a card and a stone to your decks${r.charms && r.charms.length ? ', and take a charm' : ''} — or skip. Then back to the map.`;
  const body = $('circuitStats');
  body.className = 'circuitload';
  body.innerHTML = '';

  // The 2v1 victory — your ally's parting word as they hand you the trophy.
  if (node.coop && node.ally && showEventScene()) {
    const q = document.createElement('div');
    q.innerHTML = dialoguePlate(node.ally, allyWinLine(node.ally), { side: 'left' });
    body.appendChild(q);
  }

  // Coin won — an explicit, banked reward (already added to your purse).
  if (r.coin) {
    const cb = document.createElement('div'); cb.className = 'ldsection';
    cb.innerHTML = `<div class="coinwon"><span class="coinwon-ic">⛁</span><span class="coinwon-amt">+${r.coin} coin</span><span class="coinwon-tot">purse: ${g.coin}</span></div>`;
    body.appendChild(cb);
  }

  // Cards — take one (click to toggle; leaving none selected = skip).
  const cs = document.createElement('div'); cs.className = 'ldsection';
  cs.innerHTML = `<div class="ldhead">Take a card — ${r.cardPick ? '1' : '0'}/1 · optional</div>`;
  const crow = document.createElement('div'); crow.className = 'ldcards';
  for (const card of r.cards) {
    const sel = r.cardPick === card;
    const v = (card.fx === 'anchor') ? CIRCUIT_ANCHOR : ((REGIONS.bar.values[card.type] != null) ? REGIONS.bar.values[card.type] : 2);
    const info = FX_INFO[card.fx] || { label: card.fx, blurb: '' };
    const el = document.createElement('div');
    el.className = 'card faceup loadcard' + (sel ? ' selected' : '');
    el.innerHTML = `<div class="cval val-${v}">${v}</div><div class="cfx cfx-${card.fx}">${info.label}</div><div class="cicon icon-${card.type}"></div><div class="cname">${card.type}</div>`;
    el.onclick = () => { r.cardPick = (r.cardPick === card) ? null : card; circuitRewardScreen(); };
    crow.appendChild(el);
  }
  cs.appendChild(crow);
  const key = document.createElement('div'); key.className = 'ldfxkey';
  key.innerHTML = r.cards.filter((c, i, a) => a.findIndex(o => o.fx === c.fx) === i)
    .map(c => `<span><b>${FX_INFO[c.fx].label}</b> — ${FX_INFO[c.fx].blurb}</span>`).join('');
  cs.appendChild(key);
  body.appendChild(cs);

  // Stones — take one (click to toggle).
  const ss = document.createElement('div'); ss.className = 'ldsection';
  ss.innerHTML = `<div class="ldhead">Take a stone — ${r.stonePick ? '1' : '0'}/1 · optional</div>`;
  const srow = document.createElement('div'); srow.className = 'ldpouches';
  for (const color of r.stones) {
    srow.appendChild(stonePickBtn({
      dot: color, label: STONES[color].name.replace(' Stone', ''),
      title: `${STONES[color].name} — ${STONES[color].power}`,
      selected: r.stonePick === color,
      onClick: () => { r.stonePick = (r.stonePick === color) ? null : color; circuitRewardScreen(); },
    }));
  }
  ss.appendChild(srow);
  body.appendChild(ss);

  // Charm — take one run-long relic (when any remain unowned).
  if (r.charms && r.charms.length) {
    const cm = document.createElement('div'); cm.className = 'ldsection';
    cm.innerHTML = `<div class="ldhead">Take a charm — ${r.charmPick ? '1' : '0'}/1 · optional</div>`;
    const cmrow = document.createElement('div'); cmrow.className = 'charmoffer';
    for (const key of r.charms) {
      const ch = CHARMS[key]; if (!ch) continue;
      const sel = r.charmPick === key;
      const b = document.createElement('button');
      b.className = 'charmcard' + (sel ? ' selected' : '');
      b.innerHTML = `<div class="charmcard-h">${ch.label}</div><div class="charmcard-b">${ch.blurb}</div>`;
      b.onclick = () => { r.charmPick = (r.charmPick === key) ? null : key; circuitRewardScreen(); };
      cmrow.appendChild(b);
    }
    cm.appendChild(cmrow);
    body.appendChild(cm);
  }

  // Review your decks before committing (opens over this screen; closing returns
  // here with your selection intact).
  eventReviewBtn(body);

  const next = $('circuitNext'); next.style.display = '';
  next.disabled = false;
  next.textContent = (r.cardPick || r.stonePick || r.charmPick) ? 'Take & set out ›' : 'Skip & set out ›';
  next.onclick = circuitTakeRewardAndAdvance;
  $('circuitModal').classList.add('open');
}

// Apply the chosen spoils to the owned deck/pouch, then set the next table.
function circuitTakeRewardAndAdvance() {
  const g = GAUNTLET, r = g.reward;
  if (r) {
    if (r.cardPick) g.deck = g.deck.concat([r.cardPick]);
    if (r.stonePick) g.pouch = Object.assign({}, g.pouch, { [r.stonePick]: (g.pouch[r.stonePick] || 0) + 1 });
    if (r.charmPick) {
      g.charms = (g.charms || []).concat([r.charmPick]);
      const add = CHARMS[r.charmPick] && CHARMS[r.charmPick].maxStandingAdd;
      if (add) { g.maxStanding += add; g.standing += add; } // gain the buffer immediately
    }
    g.reward = null;
  }
  circuitAfterNode();
}

/* ---- The shop node: spend coin earned from fights on cards, stones, charms,
   a one-off thin, or patching up Standing. ---- */
function makeShop() {
  const charmKeys = shuffle(unownedCharmKeys()).slice(0, 2);
  charmKeys.forEach(markCharmSeen); // seen in a shop counts for the compendium
  // Upgrades: variants whose base colour you actually hold in the pouch.
  const upgrades = Object.keys(STONE_VARIANTS)
    .filter(v => (GAUNTLET.pouch[STONE_VARIANTS[v].base] || 0) > 0)
    .slice(0, 2).map(v => ({ variant: v, base: STONE_VARIANTS[v].base, price: CIRCUIT.shopUpgrade }));
  upgrades.forEach(u => markCharmSeen('var:' + u.variant)); // an offered variant is revealed in the compendium
  return {
    cards: circuitOfferCards(3).map(c => ({ type: c.type, fx: c.fx, price: CIRCUIT.shopCard })),
    stones: shuffle(STONE_KEYS.slice()).slice(0, 2).map(c => ({ color: c, price: CIRCUIT.shopStone })),
    charms: charmKeys.map(k => ({ key: k, price: CIRCUIT.shopCharm })),
    upgrades,
    thinPrice: CIRCUIT.shopThin, healPrice: CIRCUIT.shopHeal,
    sold: {}, thinning: false,
  };
}
function circuitShopBuy(kind, idx) {
  const g = GAUNTLET, s = g.shop; if (!s) return;
  if (kind === 'card') { const it = s.cards[idx]; if (s.sold['c' + idx] || g.coin < it.price) return; g.coin -= it.price; g.deck = g.deck.concat([{ type: it.type, fx: it.fx }]); s.sold['c' + idx] = true; }
  else if (kind === 'stone') { const it = s.stones[idx]; if (s.sold['s' + idx] || g.coin < it.price) return; g.coin -= it.price; g.pouch = Object.assign({}, g.pouch, { [it.color]: (g.pouch[it.color] || 0) + 1 }); s.sold['s' + idx] = true; }
  else if (kind === 'charm') { const it = s.charms[idx]; if (s.sold['m' + idx] || g.coin < it.price) return; g.coin -= it.price; g.charms = (g.charms || []).concat([it.key]); const add = CHARMS[it.key] && CHARMS[it.key].maxStandingAdd; if (add) { g.maxStanding += add; g.standing += add; } s.sold['m' + idx] = true; }
  else if (kind === 'upgrade') { const it = s.upgrades[idx]; if (s.sold['u' + idx] || g.coin < it.price || (g.pouch[it.base] || 0) <= 0) return; g.coin -= it.price; g.pouch = Object.assign({}, g.pouch, { [it.base]: g.pouch[it.base] - 1, [it.variant]: (g.pouch[it.variant] || 0) + 1 }); s.sold['u' + idx] = true; }
  else if (kind === 'heal') { if (g.coin < s.healPrice || g.standing >= g.maxStanding) return; g.coin -= s.healPrice; g.standing = Math.min(g.maxStanding, g.standing + CIRCUIT.shopHealAmt); }
  circuitShopScreen();
}
function circuitShopThin(cardIdx) {
  const g = GAUNTLET, s = g.shop; if (!s || s.sold.thin || g.coin < s.thinPrice || g.deck.length <= CIRCUIT.deckFloor) return;
  g.coin -= s.thinPrice; g.deck = g.deck.slice(0, cardIdx).concat(g.deck.slice(cardIdx + 1)); s.sold.thin = true; s.thinning = false;
  circuitShopScreen();
}
// One shop ware as an icon-first tile: a big glyph, a name, a one-line gloss,
// and a price badge. Greys out when sold, unaffordable, or unavailable.
function shopTile(o) {
  const dead = o.sold || o.available === false;
  const b = document.createElement('button');
  b.className = 'shoptile shoptile-' + o.accent + (dead ? ' sold' : (o.afford ? '' : ' cantafford')) + (o.selected ? ' selected' : '');
  b.disabled = dead || !o.afford;
  if (o.title) b.title = o.title;
  const priceLabel = o.soldLabel != null ? o.soldLabel : (o.sold ? 'sold' : '⛁' + o.price);
  b.innerHTML = `<div class="shoptile-ic">${o.icon}</div>` +
    `<div class="shoptile-name">${o.name}</div>` +
    (o.desc ? `<div class="shoptile-desc">${o.desc}</div>` : '') +
    `<div class="shoptile-price">${priceLabel}</div>`;
  if (!dead && o.afford && o.onClick) b.onclick = o.onClick;
  return b;
}

function circuitShopScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET, s = g.shop;
  SFX.play('flip');
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.add('wide');
  $('circuitTitle').textContent = 'The Fence';
  $('circuitText').textContent = `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin. Spend it, then move on to the boss.`;
  const body = $('circuitStats'); body.className = 'circuitload'; body.innerHTML = '';
  const can = p => g.coin >= p;

  // The Fence's face — a per-act merchant backdrop (art + framing live in CSS:
  // .shopbanner.actN at assets/shops/actN.jpg).
  const act = Math.min(g.act, 3);
  const banner = document.createElement('div'); banner.className = 'shopbanner act' + act;
  body.appendChild(banner);

  // Cards
  const cs = document.createElement('div'); cs.className = 'ldsection';
  cs.innerHTML = `<div class="ldhead">Cards</div>`;
  const crow = document.createElement('div'); crow.className = 'ldcards';
  s.cards.forEach((it, i) => {
    const sold = s.sold['c' + i], v = (it.fx === 'anchor') ? CIRCUIT_ANCHOR : ((REGIONS.bar.values[it.type] != null) ? REGIONS.bar.values[it.type] : 2);
    const info = FX_INFO[it.fx] || { label: it.fx };
    const el = document.createElement('div'); el.className = 'card faceup loadcard shopitem' + (sold ? ' sold' : '');
    el.innerHTML = `<div class="cval val-${v}">${v}</div><div class="cfx cfx-${it.fx}">${info.label}</div><div class="cicon icon-${it.type}"></div><div class="cname">${it.type}</div><div class="shopprice">${sold ? 'sold' : '⛁' + it.price}</div>`;
    if (!sold && can(it.price)) el.onclick = () => circuitShopBuy('card', i); else if (!sold) el.classList.add('cantafford');
    crow.appendChild(el);
  });
  cs.appendChild(crow);
  const shopLeg = fxLegendWrap(s.cards.map(c => c.fx)); if (shopLeg) cs.appendChild(shopLeg); // map-style key for the modded cards
  body.appendChild(cs);

  // Stones, charms, upgrades & services as visual tiles (icon-first).
  const us = document.createElement('div'); us.className = 'ldsection'; us.innerHTML = `<div class="ldhead">Wares & services</div>`;
  const urow = document.createElement('div'); urow.className = 'shopwares';
  s.stones.forEach((it, i) => {
    const sold = s.sold['s' + i];
    urow.appendChild(shopTile({
      accent: 'stone', icon: `<span class="stonedot ${it.color} big"></span>`,
      name: STONES[it.color].name.replace(' Stone', ''), desc: STONES[it.color].power,
      title: `${STONES[it.color].name} — ${STONES[it.color].desc}`,
      price: it.price, sold, afford: can(it.price), onClick: () => circuitShopBuy('stone', i),
    }));
  });
  (s.upgrades || []).forEach((it, i) => {
    const sold = s.sold['u' + i], have = (g.pouch[it.base] || 0) > 0;
    urow.appendChild(shopTile({
      accent: 'upgrade', icon: `<span class="stonedot ${it.base} big variant"></span><span class="shoptile-up">⇪</span>`,
      name: getStone(it.variant).name, desc: getStone(it.variant).power,
      title: `${getStone(it.variant).name} — ${getStone(it.variant).desc}`,
      price: it.price, sold, available: have, soldLabel: sold ? 'done' : (have ? null : 'need ' + STONES[it.base].name.replace(' Stone', '')),
      afford: can(it.price), onClick: () => circuitShopBuy('upgrade', i),
    }));
  });
  s.charms.forEach((it, i) => {
    const sold = s.sold['m' + i], ch = CHARMS[it.key];
    urow.appendChild(shopTile({
      accent: 'charm', icon: '✦', name: ch.label, desc: ch.blurb, title: ch.blurb,
      price: it.price, sold, afford: can(it.price), onClick: () => circuitShopBuy('charm', i),
    }));
  });
  const healOff = g.standing >= g.maxStanding;
  urow.appendChild(shopTile({
    accent: 'heal', icon: '✚', name: 'Patch up', desc: `+${CIRCUIT.shopHealAmt} Standing`,
    price: s.healPrice, sold: healOff, soldLabel: healOff ? 'full' : null,
    afford: can(s.healPrice), onClick: () => circuitShopBuy('heal'),
  }));
  const thinOff = s.sold.thin || g.deck.length <= CIRCUIT.deckFloor;
  urow.appendChild(shopTile({
    accent: 'thin', icon: '✂', name: 'Thin a card', desc: 'Strike one card from your deck',
    price: s.thinPrice, sold: thinOff, soldLabel: s.sold.thin ? 'done' : (thinOff ? 'min' : null),
    selected: s.thinning, afford: can(s.thinPrice), onClick: () => { s.thinning = !s.thinning; circuitShopScreen(); },
  }));
  us.appendChild(urow);
  if (s.thinning) {
    const pick = eventCardPicker('Thin which card?', () => false, i => circuitShopThin(i));
    us.appendChild(pick);
  }
  body.appendChild(us);

  eventReviewBtn(body);

  const next = $('circuitNext'); next.style.display = ''; next.disabled = false; next.textContent = 'Leave the shop ›';
  next.onclick = () => { g.shop = null; circuitAfterNode(); };
  $('circuitModal').classList.add('open');
}

/* ---- The interlude event: choose one of remove a card / remove a stone /
   heal / move a modifier. Refine the build, or recover. ---- */
function specType(s) { return (s && typeof s === 'object') ? s.type : s; }
function specFx(s) { return (s && typeof s === 'object') ? s.fx : null; }
function specVal(s) { return specFx(s) === 'anchor' ? CIRCUIT_ANCHOR : ((REGIONS.bar.values[specType(s)] != null) ? REGIONS.bar.values[specType(s)] : 2); }
function circuitHealAmount() { return Math.ceil(GAUNTLET.maxStanding * 0.6); }
function pouchTotal(p) { return STONE_KEYS.reduce((s, c) => s + ((p && p[c]) || 0), 0); }
// What the event can currently offer (each guarded so it can't footgun).
function eventAvail() {
  const g = GAUNTLET;
  return {
    heal: g.standing < g.maxStanding,
    removeCard: g.deck.length > CIRCUIT.deckFloor,
    removeStone: pouchTotal(g.pouch) > CIRCUIT.drawStones,
    moveMod: g.deck.some(specFx) && g.deck.some(s => !specFx(s)),
  };
}
// Is the currently-selected event action fully specified (confirm-ready)?
function eventReady() {
  const ev = GAUNTLET.event; if (!ev || !ev.choice) return false;
  switch (ev.choice) {
    case 'heal': return true;
    case 'removeCard': return ev.cardIdx != null;
    case 'removeStone': return ev.stoneColor != null;
    case 'moveMod': return ev.srcIdx != null && ev.dstIdx != null;
  }
  return false;
}

// ── Circuit events ────────────────────────────────────────────────────────
// An event node rolls a KIND when entered, each with its own screen + payload.
// The interlude (the original heal/thin menu) is the common one; the rest add
// texture: a free card cache, a stone whetstone (upgrade to a variant), a
// crooked trade (give a stone, take a random one), a pawnbroker (swap a charm
// for a random one), and an ambush (fight for spoils or pay Standing to slip).
function variantForBase(base) { return Object.keys(STONE_VARIANTS).find(v => STONE_VARIANTS[v].base === base) || null; }
function upgradableStones(g) { return STONE_KEYS.filter(c => (g.pouch[c] || 0) > 0 && variantForBase(c)); }
function makeCircuitEvent() {
  const g = GAUNTLET;
  // An Old Rival: once you've bested an act boss, the next Encounter in a later
  // act is a reunion — team up 2v1 against a strong foe. Offered once per run
  // (decline and they ride on). Takes priority over the random pool.
  if (g.act >= 2 && (g.allies || []).length && !g.allyOffered) return makeRivalEvent(g);
  // Random encounters only — never the interlude (that now lives on its own
  // Repose node, rolled into the map explicitly).
  const kinds = ['cache', 'cache', 'ambush', 'ambush', 'gold', 'blood', 'merchant'];
  if (upgradableStones(g).length) kinds.push('whetstone');
  if (pouchTotal(g.pouch) > 1) kinds.push('swap');
  if (playerCharms().length && unownedCharmKeys().length) kinds.push('gamble');
  // The Dark Pact is rare and self-limiting: only when your Standing pool is
  // still healthy, and behind a coin flip on top of being one kind among many.
  if (g.maxStanding >= 15 && rnd() < 0.5) kinds.push('pact');
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const ev = { kind, choice: null, cardIdx: null, stoneColor: null, srcIdx: null, dstIdx: null, giveCharm: null };
  if (kind === 'cache') ev.offer = circuitOfferCards(3);
  else if (kind === 'swap') ev.gain = STONE_KEYS[Math.floor(rnd() * STONE_KEYS.length)];
  else if (kind === 'gamble') ev.gain = shuffle(unownedCharmKeys())[0];
  else if (kind === 'ambush') { ev.foe = pickFoeFor('duel', g.act); ev.dmg = Math.max(4, Math.round(g.maxStanding * 0.3)); }
  else if (kind === 'gold') ev.gold = 10 + Math.floor(rnd() * 6); // a 10–15 coin windfall
  else if (kind === 'blood') { ev.step = 0; ev.spentHp = 0; ev.gotGold = 0; }
  else if (kind === 'pact') ev.cut = Math.round(g.maxStanding * 0.3); // permanent max-Standing cost
  return ev;
}

// Shared modal shell for an event screen.
function eventShell(title, text) {
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.add('wide');
  $('circuitTitle').textContent = title;
  $('circuitText').textContent = text;
  const body = $('circuitStats'); body.className = 'circuitload'; body.innerHTML = '';
  return body;
}
function eventReviewBtn(body) {
  const rev = document.createElement('div'); rev.className = 'ldsection rewardreview';
  const rb = document.createElement('button'); rb.className = 'btn'; rb.textContent = 'Review deck & pouch';
  rb.onclick = () => showDeckView('full');
  rev.appendChild(rb); body.appendChild(rev);
}
// A tap-to-open "Effects" legend (mirrors the map's): lists each offered modifier
// with its name + one-line blurb. Reused on the reward/shop screens so a player on
// touch — where the hover tooltips don't fire — can still read what a badge means.
function fxLegendWrap(keys) {
  const uniq = [...new Set((keys || []).filter(Boolean))].filter(k => FX_INFO[k]);
  if (!uniq.length) return null;
  const wrap = document.createElement('div'); wrap.className = 'maplegendwrap fxlegendwrap';
  const btn = document.createElement('button'); btn.className = 'btn maplegendbtn'; btn.textContent = '◇ Effects';
  const pop = document.createElement('div'); pop.className = 'fxlegendpop'; pop.style.display = 'none';
  pop.innerHTML = `<button class="maplegendclose" title="Close">×</button>` +
    uniq.map(k => `<div class="fxlegend-row"><span class="fxlegend-n cfx-${k}">${FX_INFO[k].label}</span> <span class="fxlegend-b">${FX_INFO[k].blurb}</span></div>`).join('');
  const close = () => { pop.style.display = 'none'; document.removeEventListener('click', off); };
  const off = e => { if (!wrap.contains(e.target)) close(); };
  btn.onclick = e => { e.stopPropagation(); if (pop.style.display === 'none') { pop.style.display = ''; setTimeout(() => document.addEventListener('click', off), 0); } else close(); };
  pop.querySelector('.maplegendclose').onclick = close;
  wrap.appendChild(btn); wrap.appendChild(pop);
  return wrap;
}
// One pouch-stone pick button — shared by every stone picker (reward / whetstone
// / swap / ally-draft / puzzle / interlude-remove). Caller supplies the dot class,
// label, title, state and handler; the markup is built once here so the pickers
// (and their tooltips) can't drift apart.
function stonePickBtn(o) {
  const b = document.createElement('button');
  b.className = 'ldpouch rewardstone' + (o.selected ? ' selected' : '') + (o.disabled ? ' disabled' : '');
  if (o.disabled) b.disabled = true;
  if (o.title) b.title = o.title;
  const cluster = document.createElement('div'); cluster.className = 'ldstones';
  const d = document.createElement('span'); d.className = 'stonedot ' + o.dot; cluster.appendChild(d);
  b.appendChild(cluster);
  const lab = document.createElement('div'); lab.className = 'rewardlab'; lab.textContent = o.label;
  b.appendChild(lab);
  if (o.onClick) b.onclick = o.onClick;
  return b;
}
// A clickable card tile (used by the cache offer).
function eventOfferCard(c, selected, onClick) {
  const type = specType(c), fx = specFx(c), v = specVal(c);
  const info = fx ? (FX_INFO[fx] || { label: fx }) : null;
  const el = document.createElement('div');
  el.className = 'card faceup loadcard' + (selected ? ' selected' : '');
  el.innerHTML = `<div class="cval val-${v}">${v}</div>${info ? `<div class="cfx cfx-${fx}">${info.label}</div>` : ''}<div class="cicon icon-${type}"></div><div class="cname">${type}</div>`;
  el.onclick = onClick;
  return el;
}

function circuitEventScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  if (!g.event) g.event = { kind: 'interlude', choice: null, cardIdx: null, stoneColor: null, srcIdx: null, dstIdx: null };
  switch (g.event.kind) {
    case 'cache': return renderCacheEvent(g);
    case 'whetstone': return renderWhetstoneEvent(g);
    case 'swap': return renderSwapEvent(g);
    case 'gamble': return renderGambleEvent(g);
    case 'ambush': return renderAmbushEvent(g);
    case 'gold': return renderGoldEvent(g);
    case 'blood': return renderBloodEvent(g);
    case 'pact': return renderPactEvent(g);
    case 'rival': return renderRivalEvent(g);
    case 'draft': return renderAllyDraftScreen(g);
    case 'merchant': g.event = null; g.shop = makeShop(); return circuitShopScreen(); // a wandering Fence
    default: return renderInterludeEvent(g);
  }
}

function renderInterludeEvent(g) {
  const ev = g.event;
  const avail = eventAvail();
  SFX.play('win');
  const body = eventShell('An Interlude', `Standing ${g.standing}/${g.maxStanding}. A quiet node — refine your hand or recover. Choose one, then back to the map.`);

  // The four options as selectable tiles.
  const opts = [
    { key: 'removeCard', label: 'Remove a card', note: 'Thin the deck — cycle to your best faster.', ok: avail.removeCard },
    { key: 'removeStone', label: 'Remove a stone', note: 'Thin the pouch — draw what matters more often.', ok: avail.removeStone },
    { key: 'heal', label: `Heal +${circuitHealAmount()}`, note: `Restore ${circuitHealAmount()} Standing (60% of max).`, ok: avail.heal },
    { key: 'moveMod', label: 'Move a modifier', note: 'Lift an effect off one card onto a plain one.', ok: avail.moveMod },
  ];
  const orow = document.createElement('div'); orow.className = 'eventopts';
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'eventopt' + (ev.choice === o.key ? ' selected' : '') + (o.ok ? '' : ' disabled');
    b.disabled = !o.ok;
    b.innerHTML = `<div class="eventopt-l">${o.label}</div><div class="eventopt-n">${o.note}</div>`;
    b.onclick = () => { ev.choice = o.key; ev.cardIdx = ev.stoneColor = ev.srcIdx = ev.dstIdx = null; circuitEventScreen(); };
    orow.appendChild(b);
  }
  body.appendChild(orow);

  // The picker for the chosen option.
  if (ev.choice === 'removeCard') body.appendChild(eventCardPicker('Remove which card?', i => ev.cardIdx === i, i => { ev.cardIdx = ev.cardIdx === i ? null : i; circuitEventScreen(); }));
  else if (ev.choice === 'removeStone') body.appendChild(eventStonePicker());
  else if (ev.choice === 'heal') { const d = document.createElement('div'); d.className = 'ldnote'; d.textContent = `You will restore ${circuitHealAmount()} Standing (to ${Math.min(g.maxStanding, g.standing + circuitHealAmount())}/${g.maxStanding}).`; body.appendChild(d); }
  else if (ev.choice === 'moveMod') {
    body.appendChild(eventCardPicker('Take the modifier from…', i => ev.srcIdx === i, i => { ev.srcIdx = ev.srcIdx === i ? null : i; if (ev.dstIdx === i) ev.dstIdx = null; circuitEventScreen(); }, s => !!specFx(s)));
    if (ev.srcIdx != null) body.appendChild(eventCardPicker(`…onto which plain card? (gains ${FX_INFO[specFx(g.deck[ev.srcIdx])].label})`, i => ev.dstIdx === i, i => { ev.dstIdx = ev.dstIdx === i ? null : i; circuitEventScreen(); }, s => !specFx(s)));
  }

  // Review your decks before committing.
  eventReviewBtn(body);

  const next = $('circuitNext'); next.style.display = '';
  const anyAvail = avail.heal || avail.removeCard || avail.removeStone || avail.moveMod;
  next.disabled = anyAvail && !eventReady();
  next.textContent = !anyAvail ? 'Move on ›' : eventReady() ? 'Confirm ›' : 'Choose an option';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// A Traveler's Cache: a small spread of cards; take one or leave it.
function renderCacheEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const body = eventShell('A Traveler’s Cache', `Standing ${g.standing}/${g.maxStanding}. A dropped satchel spills a few cards across the road. Take one for your deck, or leave it and move on.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">Take one card</div>`;
  const row = document.createElement('div'); row.className = 'ldcards';
  ev.offer.forEach((c, i) => row.appendChild(eventOfferCard(c, ev.cardIdx === i, () => { ev.cardIdx = ev.cardIdx === i ? null : i; circuitEventScreen(); })));
  sec.appendChild(row); body.appendChild(sec);
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = ''; next.disabled = false;
  next.textContent = ev.cardIdx != null ? 'Take it ›' : 'Leave it ›';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// The Whetstone: upgrade one base stone in your pouch to its variant, free.
function renderWhetstoneEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const body = eventShell('The Whetstone', `Standing ${g.standing}/${g.maxStanding}. A stone-cutter offers to hone one of your stones into its finer form — at no charge. Choose one, or pass.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">Upgrade which stone?</div>`;
  const rowEl = document.createElement('div'); rowEl.className = 'ldpouches';
  for (const color of upgradableStones(g)) {
    const variant = variantForBase(color);
    rowEl.appendChild(stonePickBtn({
      dot: `${color} variant`, label: `⇪ ${getStone(variant).name}`,
      title: `${getStone(variant).name} — ${getStone(variant).power}: ${getStone(variant).desc}`,
      selected: ev.stoneColor === color,
      onClick: () => { ev.stoneColor = ev.stoneColor === color ? null : color; circuitEventScreen(); },
    }));
  }
  sec.appendChild(rowEl); body.appendChild(sec);
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = ''; next.disabled = false;
  next.textContent = ev.stoneColor ? 'Hone it ›' : 'Pass ›';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// A Crooked Trade: give up a stone of your choice, take a fixed random one.
function renderSwapEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const body = eventShell('A Crooked Trade', `Standing ${g.standing}/${g.maxStanding}. A fence will only deal in kind: hand over a stone and you walk away with a ${STONES[ev.gain].name}. Pick what you can spare.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">Give up which stone? (you receive a ${STONES[ev.gain].name})</div>`;
  const rowEl = document.createElement('div'); rowEl.className = 'ldpouches';
  for (const color of STONE_KEYS) {
    const n = g.pouch[color] || 0; if (!n) continue;
    rowEl.appendChild(stonePickBtn({
      dot: color, label: `${STONES[color].name.replace(' Stone', '')} ×${n}`,
      title: `${STONES[color].name} — ${STONES[color].power}`,
      selected: ev.stoneColor === color,
      onClick: () => { ev.stoneColor = ev.stoneColor === color ? null : color; circuitEventScreen(); },
    }));
  }
  sec.appendChild(rowEl); body.appendChild(sec);
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = '';
  next.disabled = !ev.stoneColor;
  next.textContent = ev.stoneColor ? 'Make the trade ›' : 'Choose a stone to give';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// The Pawnbroker: sacrifice one charm to gain a different random one (refusable).
function renderGambleEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const gainC = CHARMS[ev.gain];
  const body = eventShell('The Pawnbroker', `Standing ${g.standing}/${g.maxStanding}. A broker eyes your charms. Pawn one and a ${gainC ? gainC.label : 'mystery charm'} is yours in return — or keep what you have and walk on.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">Pawn which charm? (you receive <b>${gainC ? gainC.label : '—'}</b> — ${gainC ? gainC.blurb : ''})</div>`;
  const rowEl = document.createElement('div'); rowEl.className = 'compendium';
  for (const key of playerCharms()) {
    const c = CHARMS[key]; if (!c) continue;
    const b = document.createElement('button');
    b.className = 'compcard' + (ev.giveCharm === key ? ' selected' : '');
    b.innerHTML = `<div class="compcard-h">${c.label}</div><div class="compcard-b">${c.blurb}</div>`;
    b.onclick = () => { ev.giveCharm = ev.giveCharm === key ? null : key; circuitEventScreen(); };
    rowEl.appendChild(b);
  }
  sec.appendChild(rowEl); body.appendChild(sec);
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = ''; next.disabled = false;
  next.textContent = ev.giveCharm ? 'Pawn it ›' : 'Walk on ›';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// An Ambush: stand and fight a duel for spoils, or pay Standing to slip past.
function renderAmbushEvent(g) {
  const ev = g.event;
  SFX.play('sting');
  const body = eventShell('An Ambush', `Standing ${g.standing}/${g.maxStanding}. A figure blocks the road, hand on a satchel of stones. Stand and fight for the spoils, or pay them off in blood — lose ${ev.dmg} Standing and slip past.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  const orow = document.createElement('div'); orow.className = 'eventopts';
  const fight = document.createElement('button');
  fight.className = 'eventopt';
  fight.innerHTML = `<div class="eventopt-l">Stand and fight</div><div class="eventopt-n">A duel for coin and a card — but a loss ends the run.</div>`;
  fight.onclick = () => { g.curNode.foe = ev.foe; g.event = null; closeModal('circuitModal'); circuitSetupFight(g.curNode); };
  const pay = document.createElement('button');
  pay.className = 'eventopt' + (g.standing <= ev.dmg ? ' disabled' : '');
  pay.disabled = g.standing <= ev.dmg;
  pay.innerHTML = `<div class="eventopt-l">Slip past</div><div class="eventopt-n">Lose ${ev.dmg} Standing (to ${Math.max(0, g.standing - ev.dmg)}/${g.maxStanding}) and move on.</div>`;
  pay.onclick = () => { g.standing = Math.max(1, g.standing - ev.dmg); g.event = null; circuitAfterNode(); };
  orow.appendChild(fight); orow.appendChild(pay);
  sec.appendChild(orow); body.appendChild(sec);
  eventReviewBtn(body);
  $('circuitNext').style.display = 'none'; // choices are the buttons above
  $('circuitModal').classList.add('open');
}

/* ---- An Old Rival (2v1 co-op): a boss you bested earlier reappears and offers
   to fight beside you against one strong foe. You draft their loadout — pick 8
   cards (from a spread of 20) on top of a 2-of-each base deck, and add 2 stones
   to a 2-of-each base pouch — then the three of you sit the table: you (seat 0)
   and the ally (seat 2) versus the lone foe (seat 1), who carries the Standing
   of two. Optional and offered once a run; decline and they ride on. ---- */
// A line of recruitment patter per persona (with a generic fallback).
const CIRCUIT_ALLY_LINES = {
  'The Ferryman': 'You paid the toll in full, once. The river remembers a fair hand. Point me at whoever blocks the crossing.',
  'The Wagoner':  'Lost my last race to you. Won’t lose this one beside you. Climb on — we’ll run them down together.',
  'The Deckhand': 'You took me clean, no grudge in it. Two of us on the rail? Nobody boards.',
  'The Old Hand': 'I’ve folded to a better player twice in my life. You’re the second. Deal me in — I’ll cover your weak hand.',
  'The Miner':    'You cut deeper than I did, and I respect a deep cut. There’s a vein here worth more than coin. Let’s split it open.',
  'The Stranger': 'You saw my face once and walked away. That buys you a hand at my side. Once. Don’t waste it.',
  'The Lady':     'I do not lend my name lightly. You earned it across a table. Stand with me, and we do not lose.',
  'The Tinker':   'You broke my best gadget and grinned about it. I like you. Let’s build something that breaks THEM.',
  'The Clerk':    'The ledger says you beat me, fair and signed. I keep honest books — consider this account settled in your favour, this once.',
};
function allyLine(name) { return CIRCUIT_ALLY_LINES[name] || 'We’ve crossed before, and you came out ahead. Let’s see what the two of us do on the same side of the table.'; }
// The foe's sneer as they block the road, two-on-one.
const CIRCUIT_FOE_TAUNTS = {
  'The Ferryman': 'Two of you, one crossing, and neither’s paid. The river takes what it’s owed — in coin or in cards.',
  'The Wagoner':  'Brought a friend to lose with? The road’s long, and I’ve all day to empty both your purses.',
  'The Deckhand': 'An old face and a sore winner. Cute. I’ll put the pair of you over the side.',
  'The Old Hand': 'I’ve buried partnerships better than yours. Sit down — let’s see how long it holds.',
  'The Miner':    'Two picks at the same vein. I’ll bury you both and keep the ore.',
  'The Stranger': 'You brought a witness. Bold. Neither of you leaves remembering this.',
  'The Lady':     'How quaint — a pair of strays. I dine on alliances. Shall we?',
  'The Tinker':   'Two against one? I’ve rigged worse odds in my favour. Mind your stones.',
  'The Clerk':    'I’ll enter you both in the ledger. Under losses. Take your seats.',
};
function foeTaunt(name) { return CIRCUIT_FOE_TAUNTS[name] || 'Two of you? I’ve taken worse odds and smiled. Sit.'; }
// The ally's word once the foe falls — and they hand you the trophy (The Double-Cross).
const CIRCUIT_ALLY_WINLINES = {
  'The Ferryman': 'Crossing’s clear. You ferry like you owe nobody — I respect that. Take this; you’ll want it downriver.',
  'The Wagoner':  'HA! Did you see the face on them? Here — a parting gift. Run the next one down for me.',
  'The Deckhand': 'Clean sweep, no survivors. Knew you’d hold the rail. This trick’s yours now — use it ugly.',
  'The Old Hand': 'Forty years and I still learn one a fight. That’s what we did to them. Keep this — pass it on someday.',
  'The Miner':    'Struck it. Told you there was a vein. Your cut — and it’s the good stuff.',
  'The Stranger': 'We were never here. But you keep this. Call it a debt I’d sooner not owe.',
  'The Lady':     'Flawless. I do so enjoy winning in company. A token — wear it where they can see.',
  'The Tinker':   'Boom. Built to break, and break it did. Made you a little something — don’t ask how it works.',
  'The Clerk':    'Settled in full, with interest. The books are balanced and you’re in the black. This is yours by right.',
};
function allyWinLine(name) { return CIRCUIT_ALLY_WINLINES[name] || 'We make a fine table, you and I. Take this — you earned the both of us.'; }

/* ---- Portrait dialogue: a Fire Emblem-style plate (face beside a speech box).
   The lines below are the voice these characters only ever had in the rival
   event; now they speak when you sit down against them and when they fall. ---- */
// A lone regular sizing you up across the Circuit table (1v1 — distinct from the
// two-on-one CIRCUIT_FOE_TAUNTS, which assume a partner at your side).
const FOE_SOLO_TAUNTS = {
  'The Ferryman': 'The crossing has a price, and today it’s paid in cards. Sit — let’s see what you’re carrying.',
  'The Wagoner':  'Another traveller on my road. Everything you’re hauling looks like cargo to me. Climb down.',
  'The Deckhand': 'Just you, me, and an honest deck. No tricks from my end — can’t vouch for yours. Deal.',
  'The Old Hand': 'Forty years at this table. I’ve read your whole hand before you’ve drawn it. Sit, and be quick.',
  'The Miner':    'It’s all just ore to me — dig it out, or blast it flat. Let’s see which you are.',
  'The Stranger': 'You don’t know me, and by the end you’ll know me less. Every card I show you is one I chose to.',
  'The Lady':     'How charming — a challenger. Do sit. I’ll try to leave you something to walk away with.',
  'The Tinker':   'Ooh — a fresh hand to test my rigs on. Mind the stones, they bite. Sit, sit.',
  'The Clerk':    'I’ve a column open for your losses. Take a seat, and we’ll start filling it.',
};
function foeSoloTaunt(name) { return FOE_SOLO_TAUNTS[name] || 'You’ve the look of a player. Sit, and we’ll find out.'; }
// The campaign bosses take the high seat — their one spoken word before the raid.
const BOSS_INTRO = {
  'The Magistrate': 'Another petitioner, hat in hand, quite sure of himself. They always are. Sit down. I have sentenced better players than you before luncheon, and taken no pleasure in it. This one I might.',
  'The Warden': 'Soft hands. The hands of a man who’s never been worn down slow. Sit — I’ve nothing but nights, and I intend to spend one on you.',
  'The Apothecary': 'Oh, don’t look so pale. I mend far more than I harm. …Well. Roughly as much. Sit, sit — let me get a proper look at what I’m working with.',
  'The Quartermaster': 'Everything at this table is inventory, and inventory answers to me — you included. Sit. Let’s find out what you’re worth, and then let’s watch it depreciate.',
  'The Archivist': 'I keep a file on everyone who sits here. Yours is thin, and what’s in it is dull. Sit, and give me something worth the ink. You won’t — but do try.',
  'The Crucible': 'So. The last door, and you knock so politely. Everything that broke the others is behind me, and it has grown so terribly bored. Sit down. Let’s see what you’re made of — before I take it apart.',
};
function bossIntroLine(name) { return BOSS_INTRO[name] || 'You’ve climbed far to reach this seat. Sit, and let us see if you belong in it.'; }
// The boss’s parting word when you break them — gracious or grudging, in voice.
const BOSS_DEFEAT = {
  'The Magistrate': 'The verdict goes against me. How… novel. Take the seat, then. I’ll be watching how you keep it — and I am a patient man.',
  'The Warden': 'Worn through. Twenty years, and it’s you who does it. Go on — through the gate. You’ve earned the walk. Don’t make me regret opening it.',
  'The Apothecary': 'Ah. You kept the one thing that mattered just out of my reach. Clever. Irritating. …Take your prizes, before I think better of letting you.',
  'The Quartermaster': 'Balanced against me, hand for hand — and the books don’t lie, more’s the pity. The stores are yours. Go, before I find a clerical error.',
  'The Archivist': 'A loss. In my own hand, in my own ledger. I shall have to open a new volume. You are… noted. Now get out of my records.',
  'The Crucible': 'Tempered. Not broken. There is nothing back here you haven’t now survived. Go — there’s no door left to knock on. You’re finished. In the best of ways.',
};
function bossDefeatLine(name) { return BOSS_DEFEAT[name] || 'Well played. The seat is cold, and it is yours.'; }
// The plate itself: portrait framed beside a speech box. opts.side 'right' mirrors
// it (face on the right) so two speakers face each other; opts.foe casts the
// hostile palette; opts.coach appends the derived coach note (opts.coachFull for
// the three-line form). Pure string — callers drop it into innerHTML.
function dialoguePlate(name, line, opts) {
  opts = opts || {};
  const src = portraitFor(name);
  const face = src
    ? `<div class="dplate-face" style="background-image:url('${src}')"></div>`
    : `<div class="dplate-face dplate-face--none">${String(name || '?').replace(/^The /, '').charAt(0)}</div>`;
  const note = opts.coach ? coachNoteHtml(name, !!opts.coachFull) : '';
  const box =
    `<div class="dplate-box">` +
      `<div class="dplate-name">${name}</div>` +
      `<div class="dplate-line">“${line}”</div>` +
      note +
    `</div>`;
  return `<div class="dplate${opts.foe ? ' foe' : ''}${opts.side === 'right' ? ' right' : ''}">${face}${box}</div>`;
}
// Build the rival reunion: the most recently bested boss returns, set against a
// strong named foe of the current act (never the ally themself).
function makeRivalEvent(g) {
  const ally = g.allies[g.allies.length - 1];
  let foe = pickFoeFor('elite', g.act);
  for (let i = 0; i < 8 && foe === ally; i++) foe = pickFoeFor('elite', g.act);
  return { kind: 'rival', ally, foe, choice: null };
}
// The 20-card draft pool: every base type appears, roughly half carrying a
// modifier — enough spread to actually shape the ally's deck.
function circuitAllyDraftPool() {
  const types = shuffle(TYPES.slice());
  const fxBag = shuffle(CIRCUIT_FX.slice());
  const pool = [];
  for (let i = 0; i < 20; i++) {
    const type = types[i % types.length];
    const fx = (i % 2 === 0) ? fxBag[(i >> 1) % fxBag.length] : null;
    pool.push(fx ? { type, fx } : type);
  }
  const out = shuffle(pool);
  out.forEach(c => { const fx = specFx(c); if (fx) markCharmSeen('fx:' + fx); });
  return out;
}
function renderRivalEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const body = eventShell('An Old Rival', `Standing ${g.standing}/${g.maxStanding}. A familiar figure falls into step beside you on the road — ${ev.ally}, the master you broke earlier. They’ve heard ${ev.foe} holds this stretch, and they don’t much care for ${ev.foe}.`);
  // The ally at your side (face left) and the foe barring the road (face right),
  // turned toward one another across the plate — unless event scenes are off, in
  // which case the shell text above already names them and we skip the plates.
  if (showEventScene()) {
    const sec = document.createElement('div'); sec.className = 'ldsection';
    sec.innerHTML =
      dialoguePlate(ev.ally, allyLine(ev.ally), { side: 'left' }) +
      dialoguePlate(ev.foe, foeTaunt(ev.foe), { side: 'right', foe: true }) +
      dialogueSkipLink('events');
    body.appendChild(sec);
    wireDialogueSkipLink(sec);
  }
  const orow = document.createElement('div'); orow.className = 'eventopts';
  const fight = document.createElement('button');
  fight.className = 'eventopt';
  fight.innerHTML = `<div class="eventopt-l">Fight together</div><div class="eventopt-n">Outfit ${ev.ally}’s deck, then take ${ev.foe} two-on-one. A strong foe, but two hands — and a rich spoil.</div>`;
  fight.onclick = () => { ev.kind = 'draft'; g.allyDraft = { ally: ev.ally, foe: ev.foe, pool: circuitAllyDraftPool(), cards: [], stones: {} }; circuitEventScreen(); };
  const wave = document.createElement('button');
  wave.className = 'eventopt';
  wave.innerHTML = `<div class="eventopt-l">Wave them on</div><div class="eventopt-n">Part ways and keep to your own road. They won’t offer twice.</div>`;
  wave.onclick = () => { g.allyOffered = true; g.event = null; circuitAfterNode(); };
  orow.appendChild(fight); orow.appendChild(wave);
  body.appendChild(orow);
  eventReviewBtn(body);
  $('circuitNext').style.display = 'none'; // choices are the buttons above
  $('circuitModal').classList.add('open');
}
// Outfit the ally: pick 8 of 20 cards (on top of 2-of-each base) and 2 stones
// (on top of 2-of-each base), then sit the 2v1 table.
function renderAllyDraftScreen(g) {
  const d = g.allyDraft;
  const stoneTotal = STONE_KEYS.reduce((s, c) => s + (d.stones[c] || 0), 0);
  const ready = d.cards.length === 8 && stoneTotal === 2;
  SFX.play('flip');
  const body = eventShell(`Outfit ${d.ally}`, `Build your ally up to fight at your side. Their deck starts at two of each base card; choose 8 more to add. Their pouch starts at two of each stone; add 2 more. Then face ${d.foe}, together.`);
  const cn = document.createElement('div'); cn.className = 'ldsection'; cn.innerHTML = `<div class="ldhead">How ${d.ally} plays</div>` + coachNoteHtml(d.ally, true); body.appendChild(cn);

  // Cards — pick exactly 8 of 20.
  const cs = document.createElement('div'); cs.className = 'ldsection';
  cs.innerHTML = `<div class="ldhead">Add cards — ${d.cards.length}/8</div>`;
  const crow = document.createElement('div'); crow.className = 'ldcards';
  d.pool.forEach((c, i) => {
    const sel = d.cards.includes(i);
    const type = specType(c), fx = specFx(c), v = specVal(c);
    const info = fx ? (FX_INFO[fx] || { label: fx }) : null;
    const el = document.createElement('div');
    el.className = 'card faceup loadcard' + (sel ? ' selected' : '');
    el.innerHTML = `<div class="cval val-${v}">${v}</div>${info ? `<div class="cfx cfx-${fx}">${info.label}</div>` : ''}<div class="cicon icon-${type}"></div><div class="cname">${type}</div>`;
    el.onclick = () => {
      if (sel) d.cards = d.cards.filter(x => x !== i);
      else if (d.cards.length < 8) d.cards.push(i);
      renderAllyDraftScreen(g);
    };
    crow.appendChild(el);
  });
  cs.appendChild(crow);
  const draftLeg = fxLegendWrap(d.pool.map(c => specFx(c))); if (draftLeg) cs.appendChild(draftLeg); // key for the 20-card modded pool
  body.appendChild(cs);

  // Stones — add exactly 2 (any base colours, duplicates allowed).
  const ss = document.createElement('div'); ss.className = 'ldsection';
  ss.innerHTML = `<div class="ldhead">Add stones — ${stoneTotal}/2</div>`;
  const srow = document.createElement('div'); srow.className = 'ldpouches';
  for (const color of STONE_KEYS) {
    const n = d.stones[color] || 0;
    srow.appendChild(stonePickBtn({
      dot: color, label: `${STONES[color].name.replace(' Stone', '')}${n ? ` +${n}` : ''}`,
      title: `${STONES[color].name} — ${STONES[color].power}`,
      selected: !!n, disabled: stoneTotal >= 2 && !n,
      onClick: () => { // left-click adds (cap 2); click a held one to drop it back
        if (n && stoneTotal >= 2) d.stones[color] = n - 1;
        else if (stoneTotal < 2) d.stones[color] = n + 1;
        else d.stones[color] = n - 1;
        renderAllyDraftScreen(g);
      },
    }));
  }
  ss.appendChild(srow);
  const hint = document.createElement('div'); hint.className = 'ldnote';
  hint.textContent = 'Tap a stone to add it; tap a held stone to drop it.';
  ss.appendChild(hint);
  body.appendChild(ss);

  const next = $('circuitNext'); next.style.display = '';
  next.disabled = !ready;
  next.textContent = !ready ? `Pick 8 cards & 2 stones` : `Take the field with ${d.ally} ›`;
  next.onclick = () => {
    const picks = d.cards.map(i => d.pool[i]);
    const deck = [];
    for (const t of TYPES) { deck.push(t); deck.push(t); }   // two of each base card
    for (const c of picks) deck.push(c);
    const pouch = { red: 2, white: 2, blue: 2, black: 2 };    // two of each base stone
    for (const color of STONE_KEYS) if (d.stones[color]) pouch[color] += d.stones[color];
    g.allyDeck = deck; g.allyPouch = pouch;
    g.allyOffered = true;
    const ally = d.ally, foe = d.foe;
    g.allyDraft = null; g.event = null;
    g.curNode.foe = foe; g.curNode.coop = true; g.curNode.ally = ally; // node remembers its ally (for the win line)
    circuitSetupCoopFight(g.curNode, ally, foe);
  };
  $('circuitModal').classList.add('open');
}
// Set up the 2v1 table: you (0) + ally (2) vs one strong foe (1).
function circuitSetupCoopFight(node, ally, foe) {
  const g = GAUNTLET;
  g.tableCleared = false; g.groundOut = false;
  g.handBuff = 0; g.cpDone = false; g.winStreak = 0; g.spitePending = false;
  charmFire('fightStart');
  g.opp = foe; g.ally = ally; if (node) { node.ally = ally; node.coop = true; }
  const tier = nodeTier(g.act, node.col);
  const vp = actVenues(g.act); g.venue = vp[node.col % vp.length];
  let max = ccfg('foeBase') + tier * ccfg('foeStep');
  max = Math.round(max * CIRCUIT.coopFoeMult);   // a lone foe braced against two of you
  g.foeMax = max; g.foeHp = max;
  g.foeCharms = COOP_FOE_CHARMS.slice();          // scoring leverage (Triads/Pairs), not theft
  const fb = circuitBuildFor(foe);
  g.oppDeck = fb.deck.concat(COOP_FOE_FX.map((fx, i) => ({ type: TYPES[i % TYPES.length], fx }))); // a developed deck
  g.oppPouch = foePouchWithChits(Object.assign({}, COOP_FOE_POUCH)); // ally pile lives on g.allyDeck/g.allyPouch (from the draft)
  circuitResetPiles();
  closeModal('circuitModal');
  if (logEl) logEl.innerHTML = '';
  newGame({ mode: 'coop', humans: [0], companyNames: [foe, ally], venue: g.venue, deal: 'small', target: 999, gauntlet: true });
  if (typeof document !== 'undefined') announce(`${ally} stands with you against ${foe}`, 'white', 0);
  updateCircuitHud();
}

// A Windfall: a flat coin find, no strings.
function renderGoldEvent(g) {
  const ev = g.event;
  SFX.play('win');
  const body = eventShell('A Windfall', `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin. A purse lies forgotten in the dust — and it is heavy.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="goldfind"><span class="goldfind-ic">⛁</span><span class="goldfind-amt">+${ev.gold} coin</span></div>`;
  body.appendChild(sec);
  eventReviewBtn(body);
  const next = $('circuitNext'); next.style.display = ''; next.disabled = false;
  next.textContent = 'Pocket it ›';
  next.onclick = circuitTakeEventAndAdvance;
  $('circuitModal').classList.add('open');
}

// The Blood Price: bleed for coin, the pot growing each round (step N costs N
// Standing, pays 2N−1 coin). Cumulative; stop whenever you like. Applied live.
function renderBloodEvent(g) {
  const ev = g.event;
  const nextN = (ev.step || 0) + 1;
  const cost = nextN, gain = 2 * nextN - 1;
  const canBleed = g.standing > cost; // must survive the cut (stay ≥ 1)
  SFX.play('flip');
  const body = eventShell('The Blood Price', `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin. A back-alley wager: open a vein and the pot grows. Bleed as often as you dare — then walk.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = (ev.step ? `<div class="ldnote">So far: <b>${ev.spentHp}</b> Standing spent for <b>${ev.gotGold}</b> coin.</div>` : '') +
    `<div class="ldnote">Next cut: lose <b>${cost}</b> Standing, gain <b>${gain}</b> coin.</div>`;
  const orow = document.createElement('div'); orow.className = 'eventopts';
  const bleed = document.createElement('button');
  bleed.className = 'eventopt' + (canBleed ? '' : ' disabled'); bleed.disabled = !canBleed;
  bleed.innerHTML = `<div class="eventopt-l">Open a vein</div><div class="eventopt-n">−${cost} Standing · +${gain} coin</div>`;
  bleed.onclick = () => { g.standing -= cost; g.coin = (g.coin || 0) + gain; ev.step = nextN; ev.spentHp += cost; ev.gotGold += gain; circuitEventScreen(); };
  const walk = document.createElement('button');
  walk.className = 'eventopt';
  walk.innerHTML = `<div class="eventopt-l">${ev.step ? 'Bind the wound & go' : 'Walk away'}</div><div class="eventopt-n">${ev.step ? `Keep your ${ev.gotGold} coin and move on.` : 'Take nothing; lose nothing.'}</div>`;
  walk.onclick = circuitTakeEventAndAdvance;
  orow.appendChild(bleed); orow.appendChild(walk);
  sec.appendChild(orow); body.appendChild(sec);
  eventReviewBtn(body);
  $('circuitNext').style.display = 'none'; // the choices above drive it
  $('circuitModal').classList.add('open');
}

// The Dark Pact: permanently sacrifice ~30% of your max Standing for a Green
// Stone — the Apothecary's poison, now yours to place. Refusable.
function renderPactEvent(g) {
  const ev = g.event;
  SFX.play('sting');
  const newMax = g.maxStanding - ev.cut;
  const body = eventShell('A Dark Pact', `Standing ${g.standing}/${g.maxStanding} · ${g.coin} coin. A hooded apothecary offers a trade in flesh: give up some of your endurance, for good, and carry a Green Stone — the poison that cuts a card to nothing.`);
  const sec = document.createElement('div'); sec.className = 'ldsection';
  const cluster = `<span class="stonedot green big" style="display:inline-block;vertical-align:middle"></span>`;
  sec.innerHTML = `<div class="ldnote" style="text-align:center">${cluster} <b>+1 Green Stone</b> — poison an opponent's unlocked card to nothing (a White lock shields it).</div>`;
  const orow = document.createElement('div'); orow.className = 'eventopts';
  const accept = document.createElement('button');
  accept.className = 'eventopt' + (newMax >= 4 ? '' : ' disabled'); accept.disabled = newMax < 4;
  accept.innerHTML = `<div class="eventopt-l">Seal the pact</div><div class="eventopt-n">Max Standing −${ev.cut} forever (to ${newMax}) · gain a Green Stone</div>`;
  accept.onclick = () => {
    g.maxStanding = newMax;
    g.standing = Math.min(g.standing, g.maxStanding);
    g.pouch = Object.assign({}, g.pouch, { green: (g.pouch.green || 0) + 1 });
    g.event = null; circuitAfterNode();
  };
  const refuse = document.createElement('button');
  refuse.className = 'eventopt';
  refuse.innerHTML = `<div class="eventopt-l">Refuse</div><div class="eventopt-n">Keep your endurance whole; walk on.</div>`;
  refuse.onclick = () => { g.event = null; circuitAfterNode(); };
  orow.appendChild(accept); orow.appendChild(refuse);
  sec.appendChild(orow); body.appendChild(sec);
  eventReviewBtn(body);
  $('circuitNext').style.display = 'none'; // the choices above drive it
  $('circuitModal').classList.add('open');
}

// ── Puzzles ───────────────────────────────────────────────────────────────
// A puzzle is a hand-authored stone-placement riddle: a fixed board of your
// cards, a fixed rival board, and a set of stones. You get 3 guesses; each
// guess is ONE placement (a stone onto a target). Outcomes are NOT computed by
// the engine — the author writes a specific response for every meaningful
// (stone → target), so a puzzle plays out exactly as designed. The placement
// whose response is `solve` wins; the reward scales by how few guesses it took
// (1st: a relic, 2nd: a stone upgrade, 3rd: gold). A wrong guess costs 2
// Standing; you may bail. Authoring is pure data — drop entries in PUZZLES.
//   you/foe : arrays of card type names (rendered with the venue's values)
//   stones  : the stone keys you may place (red/twinred/white/blue/green/…)
//   responses : { '<placementKey>': { text, solve? } }  — see puzzleKey()
//   miss    : the default response for any placement not listed (a wrong line)
const PUZZLES = {
  // ---- Academy fundamentals (⌂ in the design doc): base stones only. ----
  larceny: {
    name: 'Grand Larceny', academy: true,
    flavor: 'Their best card also completes your hand. Take it.',
    venue: 'tavern',
    you: ['Road', 'Quill', 'Chain'],          // a lone Road (3) and two junk (1)
    foe: ['Road', 'Bread', 'Sword'],          // their Road (3) pairs with yours
    stones: ['blue'],
    responses: {
      'blue@you1>foe0': { solve: true, text: 'You trade a Chain for their Road: +3 to you, −3 to them, and your Roads pair. The swing is the spread plus the structure.' },
      'blue@you2>foe0': { solve: true, text: 'A Quill for their Road — you bank the 3 AND pair your Roads. Both ends of the steal count.' },
      'blue@you0>foe0': { text: 'Road for Road is a wash — you gained no value and broke nothing.' },
      'blue@you1>foe1': { text: 'A Bread is a 3, but it pairs with nothing of yours — value without structure. The Road steal was the double swing.' },
      'blue@you2>foe1': { text: 'A Bread is a 3, but it pairs with nothing of yours. The Road both lifts you and guts them.' },
    },
    miss: { text: 'A steal that neither lifts your structure nor guts theirs is only half a play. Take the Road.' },
  },
  keystone: {
    name: 'Steal the Keystone', academy: true,
    flavor: 'Their Triad is three real cards — no phantom to snuff. Take the body, and give up your least.',
    venue: 'tavern',
    you: ['Coin', 'Sword', 'Chain'],          // a Coin (3), a Sword (2), a junk Chain (1)
    foe: ['Coin', 'Coin', 'Coin'],            // a real Triad of coins
    stones: ['blue'],
    responses: {
      'blue@you2>foe0': { solve: true, text: 'A Chain for a Coin: their Triad (+6) folds to a Pair, your Coins pair, and you keep the Sword. You end a point up.' },
      'blue@you2>foe1': { solve: true, text: 'A Chain for a Coin: their Triad folds, your Coins pair, the Sword stays. A point to the good.' },
      'blue@you2>foe2': { solve: true, text: 'A Chain for a Coin: their Triad folds, your Coins pair, the Sword stays. A point to the good.' },
      'blue@you1>foe0': { text: 'You gave up the Sword — your Coins pair, but you’re a point light. Spend your LOWEST, the Chain.' },
      'blue@you1>foe1': { text: 'You gave up the Sword — spend the Chain instead and keep the 2.' },
      'blue@you1>foe2': { text: 'You gave up the Sword — spend the Chain instead and keep the 2.' },
      'blue@you0>foe0': { text: 'You handed back your own Coin — their three reforms. Give up a junk card, not your keystone.' },
      'blue@you0>foe1': { text: 'You handed back your own Coin — their three reforms. Spend the Chain instead.' },
      'blue@you0>foe2': { text: 'You handed back your own Coin — their three reforms. Spend the Chain instead.' },
    },
    miss: { text: 'No phantom to undo here — take one of the three, and pay with your lowest card to keep the most value.' },
  },
  thirdcoin: {
    name: 'The Third Coin', academy: true,
    flavor: 'You hold a Pair. Their board has the card that makes it three.',
    venue: 'tavern',
    you: ['Coin', 'Coin', 'Quill'],           // a Pair of coins (+2)
    foe: ['Coin', 'Sword', 'Bread'],          // a lone stealable Coin
    stones: ['blue'],
    responses: {
      'blue@you2>foe0': { solve: true, text: 'A Quill for their Coin completes your Triad (+6) — and strips a 3 from them. The biggest swing on the board.' },
      'blue@you2>foe2': { text: 'A Bread is a 3, but it joins no set of yours. The Coin makes your Triad — take it.' },
      'blue@you2>foe1': { text: 'A Sword adds value but no structure. The Coin finishes your Triad.' },
      'blue@you0>foe0': { text: 'You swapped a Coin for a Coin — your Pair is unchanged. Give up the Quill to make three.' },
      'blue@you1>foe0': { text: 'You swapped a Coin for a Coin — your Pair is unchanged. Spend the junk Quill.' },
    },
    miss: { text: 'You hold two Coins — the steal that finishes the Triad is worth far more than any loose 3.' },
  },
  shatter: {
    name: 'Shatter the Triad', academy: true,
    flavor: 'A phantom props their Triad. Undo it, and the +6 guts out.',
    venue: 'tavern',
    you: ['Road', 'Road', 'Bread'],           // a Pair of Roads + a Bread
    foe: ['Coin', { type: 'Coin', phantoms: 1 }, 'Sword'], // 2 Coins + a phantom = Triad
    stones: ['black'],
    responses: {
      'black@foe1': { solve: true, text: 'Black snuffs the phantom: their Triad (+6) collapses to a bare Pair, and your Roads carry the table.' },
      'black@foe0': { text: 'No stone rides that Coin — it’s the phantom-bearing one that makes the third. Snuff THAT.' },
      'black@foe2': { text: 'The Sword is no part of their set. Undo the phantom that props the Triad.' },
    },
    miss: { text: 'Black undoes a stone — and the only one that matters here is the phantom holding their Triad together.' },
  },
  poison: {
    name: 'Poison the Set', academy: true,
    flavor: 'One cut voids a card and kills the phantom riding it — the whole Triad folds.',
    venue: 'tavern',
    you: ['Road', 'Road', 'Bread'],
    foe: ['Coin', { type: 'Coin', phantoms: 1 }, 'Sword'],
    stones: ['green'],
    responses: {
      'green@foe1': { solve: true, text: 'Green takes the phantom-bearing Coin: it scores nothing, joins no set, and the phantom dies with it. Triad gone.' },
      'green@foe0': { text: 'You void a Coin — but the phantom still pairs the other. Cut the Coin the phantom RIDES to fold the whole set.' },
      'green@foe2': { text: 'A Sword is no part of their Triad. Poison the Coin carrying the phantom.' },
    },
    miss: { text: 'Poison erases value AND structure — so cut the one card doing both: the Coin the phantom rides.' },
  },
  // ---- Circuit-only (variants): not Academy-safe. ----
  wayfarer: {
    name: 'A Wayfarer’s Riddle',
    flavor: 'One stone decides it. Read the board and pick the line that lands.',
    venue: 'tavern',
    you: ['Coin', 'Sword', 'Quill'],
    foe: ['Bread', 'Quill', 'Chain'],
    stones: ['twinred', 'red'],
    responses: {
      'twinred@you0': { solve: true, text: 'Two phantoms crown the Coin — a full Triad of coins on one card, and the table tips to you.' },
      'twinred@you1': { text: 'A Triad of Swords scores too lean — three 2s can’t catch their Bread.' },
      'twinred@you2': { text: 'Three Quills is still a pauper’s hand. It falls short.' },
      'red@you0': { text: 'One phantom makes only a Pair of coins — not enough to take the table.' },
      'red@you1': { text: 'A Pair of Swords. The wall holds.' },
      'red@you2': { text: 'A Pair of Quills changes little.' },
    },
    miss: { text: 'The line comes up short.' },
  },
  lonespur: {
    name: 'Twin Red Alone',
    flavor: 'One high card, no second copy — but a Twin Red is two phantoms.',
    venue: 'tavern',
    you: ['Road', 'Quill', 'Chain'],
    foe: ['Bread', 'Sword', 'Coin'],
    stones: ['twinred', 'red'],
    responses: {
      'twinred@you0': { solve: true, text: 'Two phantoms ride the Road — a finished Triad of Roads (3 + 6) from a single card. No second copy needed.' },
      'red@you0': { text: 'One phantom makes only a Pair of Roads — it doesn’t clear their board.' },
      'twinred@you1': { text: 'A Triad of Quills is three 1s. A pauper’s set.' },
      'twinred@you2': { text: 'Three Chains scores nothing worth having.' },
      'red@you1': { text: 'A Pair of Quills falls short.' },
      'red@you2': { text: 'A Pair of Chains falls short.' },
    },
    miss: { text: 'Put the two phantoms where one high card becomes a whole Triad — the Road.' },
  },
  // ---- Defensive / denial (base stones, ⌂): the rival answers your move with a
  // scripted counter — a lock you set in the right place makes it fizzle. ----
  shields: {
    name: 'Shields Up', academy: true,
    flavor: 'Their Blue is poised to seize your Road. Defend the card that carries the hand.',
    venue: 'tavern',
    you: ['Road', 'Bread', 'Chain'],          // two 3s; the Road is what their Blue wants
    foe: ['Sword', 'Crest', 'Quill'],
    stones: ['white'],
    rival: { stone: 'blue', idx: 0, swap: 2 }, // the rival steals your Road (you0) for their Quill
    responses: {
      'white@you0': { solve: true, text: 'You lock the Road. Their Blue finds it sealed and dies — your lead holds.' },
      'white@you1': { text: 'You locked the Bread, but the Road sat open — their Blue takes it and the table flips.' },
      'white@you2': { text: 'A locked Chain no one wanted. The Road was naked — gone to their Blue.' },
      'white@foe0': { text: 'Locking their card does nothing for your exposed Road — their Blue still seizes it.' },
      'white@foe1': { text: 'Locking their card does nothing for your exposed Road.' },
      'white@foe2': { text: 'Locking their card does nothing for your exposed Road.' },
    },
    miss: { text: 'With their Blue live, lock the swing card before anything clever — the Road they covet.' },
  },
  scalpel: {
    name: 'Shield the Scalpel', academy: true,
    flavor: 'Their Green is the last word — it cuts your best UNLOCKED card. Deny it.',
    venue: 'tavern',
    you: ['Bread', 'Sword', 'Chain'],
    foe: ['Coin', 'Quill', 'Crest'],
    stones: ['white'],
    rival: { stone: 'green', side: 'you', idx: 0 }, // the scalpel poisons your Bread (your best)
    responses: {
      'white@you0': { solve: true, text: 'You lock the Bread. The scalpel finds it shielded and finds nothing — your 3 stands.' },
      'white@you1': { text: 'You locked the Sword; the Bread sat open — the Green takes your best card to nothing.' },
      'white@you2': { text: 'You locked a Chain; the Bread was open — the scalpel cuts it.' },
      'white@foe0': { text: 'Locking their card leaves your best one bare — the Green still cuts it.' },
      'white@foe1': { text: 'Locking their card leaves your best one bare — the Green still cuts it.' },
      'white@foe2': { text: 'Locking their card leaves your best one bare — the Green still cuts it.' },
    },
    miss: { text: 'Against a known Green, White your TOP card before the last word — a locked card can’t be poisoned.' },
  },
  freeze: {
    name: 'Freeze the Setup', academy: true,
    flavor: 'They have one card they must Red into a Pair to score. Deny the irreplaceable piece.',
    venue: 'tavern',
    you: ['Bread', 'Road', 'Quill'],          // two 3s, no set — you win only if they don't pair
    foe: ['Coin', 'Sword', 'Crest'],          // their Coin is the only duplicable card
    stones: ['white'],
    rival: { stone: 'red', side: 'foe', idx: 0 }, // they Red the Coin into a Pair of coins
    responses: {
      'white@foe0': { solve: true, text: 'You lock their Coin — the Red has nowhere to land, their Pair never forms, and your two 3s carry it.' },
      'white@foe1': { text: 'You locked their Sword — but the Red still pairs the Coin. Lock the card their setup NEEDS.' },
      'white@foe2': { text: 'You locked their Crest — the Coin still takes its phantom and pairs. Freeze the Coin.' },
      'white@you0': { text: 'A lock on your own card does nothing to their setup — they pair the Coin and hold you level.' },
      'white@you1': { text: 'Locking your own card lets their Coin pair — you only draw level.' },
      'white@you2': { text: 'Locking your own card lets their Coin pair — you only draw level.' },
    },
    miss: { text: 'Deny the irreplaceable piece — lock the one card their hand can’t score without.' },
  },
};
const PUZZLE_KEYS = Object.keys(PUZZLES);
function puzzleValues(p) { const v = VENUES[p.venue]; return REGIONS[(v && v.region) || 'bar'].values; }
function puzzleSpecType(s) { return (s && typeof s === 'object') ? s.type : s; }
function puzzleSpecFx(s) { return (s && typeof s === 'object') ? s.fx : null; }
// Resolve display values across both puzzle boards through the real effect
// hooks (so an authored Drain/Lodestone/etc. is shown exactly as it scores).
// Charm-only and venue-reading effects (Surge/Contraband/Runesmith/Echo/Wild)
// aren't supported on puzzle cards — author with the board-reading ones.
function puzzleEvalues(boards, values) {
  for (const b of boards) for (const c of b) if (c) { const e = EFFECTS[c.fx]; c.evalue = (e && e.base && c.fx !== 'contraband' && c.fx !== 'surge') ? e.base(c) : values[c.type]; }
  for (const b of boards) for (const c of b) if (c) { const e = EFFECTS[c.fx]; if (e && e.self) c.evalue += e.self(c, b); }
  for (let bi = 0; bi < boards.length; bi++) { const b = boards[bi]; for (let i = 0; i < b.length; i++) { const c = b[i]; if (!c) continue; const e = EFFECTS[c.fx]; if (!e) continue; if (e.slot) c.evalue += e.slot(c, i, b, boards); if (e.spread) e.spread(c, i, b); if (e.cross) { const owner = (c.origOwner != null) ? c.origOwner : bi; if (!e.ownerLocked || owner === bi) e.cross(c, i, boards, bi); } } }
  for (const b of boards) for (const c of b) if (c && c.evalue < 0) c.evalue = 0;
}
// The signature an authored response is keyed by. Blue (a swap) names both
// cards; every other stone names its single target.
function puzzleKey(stone, side, idx, swap) {
  return stoneBase(stone) === 'blue' ? `${stone}@you${idx}>foe${swap}` : `${stone}@${side}${idx}`;
}
function puzzleResponse(p, key) { return (p.responses && p.responses[key]) || p.miss || { text: 'Nothing comes of it.' }; }
// Headless helper (tests/authoring): the authored response for one placement.
function solvePuzzle(key, placementKey) { const p = PUZZLES[key]; if (!p) return null; return puzzleResponse(p, placementKey); }
// A puzzle is Academy-safe (re-usable as base-game practice) when it leans on no
// Circuit-exclusive stones — i.e. no variants. (Run charms never touch a puzzle.)
function puzzleAcademySafe(p) { return (p.academy != null) ? !!p.academy : p.stones.every(s => !isVariant(s)); }

// A working board. Card specs may pre-set phantoms/locked/poisoned so a puzzle can
// field a real Triad, a locked card, etc. (e.g. {type:'Coin', phantoms:1}).
function puzzleFresh(p) {
  const mk = (s, owner) => {
    const o = (s && typeof s === 'object') ? s : { type: s };
    return { type: o.type, fx: o.fx || null, phantoms: o.phantoms || 0, locked: !!o.locked, poisoned: !!o.poisoned, owner, origOwner: owner, stones: [] };
  };
  return { you: p.you.map(s => mk(s, 0)), foe: p.foe.map(s => mk(s, 1)) };
}
function puzzlePreview(p, stone, side, idx, swap) {
  const st = puzzleFresh(p), base = stoneBase(stone);
  const board = side === 'you' ? st.you : st.foe;
  if (base === 'red') { board[idx].phantoms += (stone === 'twinred' ? 2 : 1); }
  else if (base === 'white') { board[idx].locked = true; }
  else if (base === 'green') { st.foe[idx].poisoned = true; }
  else if (base === 'black') { board[idx].phantoms = 0; board[idx].poisoned = false; } // undo the red/green riding the target
  else if (base === 'blue') { const a = st.you[idx], b = st.foe[swap]; a.owner = 1; b.owner = 0; st.you[idx] = b; st.foe[swap] = a; }
  puzzleApplyRival(st, p.rival); // the rival's scripted answer — a lock you set in the right place makes it fizzle
  puzzleEvalues([st.you, st.foe], puzzleValues(p));
  return st;
}
// A puzzle's scripted rival counter, applied AFTER your move: their one answer.
// It honours locks — a White you placed on the right card blocks a Blue steal,
// a Green poison, or a Red setup — which is the whole point of the defensive
// riddles. A blocked move simply does nothing.
function puzzleApplyRival(st, r) {
  if (!r) return;
  const b = stoneBase(r.stone);
  const at = (side, i) => (side === 'foe' ? st.foe : st.you)[i];
  if (b === 'blue') {
    const yc = st.you[r.idx], fc = st.foe[r.swap];
    if (!yc || !fc || yc.locked) return; // lock the TAKEN card to block the steal (they can re-route what they give)
    yc.owner = 1; fc.owner = 0; st.you[r.idx] = fc; st.foe[r.swap] = yc;
  } else if (b === 'green') {
    const c = at(r.side || 'you', r.idx); if (!c || c.locked) return;
    c.poisoned = true; c.phantoms = 0;
  } else if (b === 'black') {
    const c = at(r.side || 'you', r.idx); if (!c || c.locked) return;
    c.phantoms = 0; c.poisoned = false;
  } else if (b === 'red') {
    const c = at(r.side || 'foe', r.idx); if (!c || c.locked) return; // a locked card can't take a phantom
    c.phantoms += (r.stone === 'twinred' ? 2 : 1);
  } else if (b === 'white') {
    const c = at(r.side || 'foe', r.idx); if (c) c.locked = true;
  }
}
// The puzzle reward scales by how few guesses it took: 1st a relic, 2nd a stone
// upgrade, 3rd gold — each falling through to the next if unavailable.
function circuitPuzzleReward(g, guess) {
  const relic = () => { const k = shuffle(unownedCharmKeys())[0]; if (!k) return null; g.charms = (g.charms || []).concat([k]); markCharmSeen(k); const a = CHARMS[k].maxStandingAdd; if (a) { g.maxStanding += a; g.standing += a; } return `a relic — ${CHARMS[k].label}`; };
  const upgrade = () => { const ups = upgradableStones(g); if (!ups.length) return null; const base = ups[Math.floor(rnd() * ups.length)], v = variantForBase(base); g.pouch = Object.assign({}, g.pouch, { [base]: g.pouch[base] - 1, [v]: (g.pouch[v] || 0) + 1 }); return `a stone honed to ${getStone(v).name}`; };
  const gold = () => { g.coin = (g.coin || 0) + 12; return '12 coin'; };
  if (guess === 1) return relic() || upgrade() || gold();
  if (guess === 2) return upgrade() || gold();
  return gold();
}

// The puzzle screen: read the board (modifiers and all), pick one stone→target
// line, and commit. The authored response decides it; a miss costs 2 Standing.
function circuitPuzzleScreen() {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET, q = g.puzzle, p = PUZZLES[q.key];
  if (!p) { q.academy ? (q.back && q.back()) : circuitAfterNode(); return; }
  SFX.play('flip');
  const guess = q.tryN + 1;
  const body = eventShell(p.name, q.academy
    ? `${p.flavor}  ·  Read the board and place the one stone that wins it.`
    : `${p.flavor}  ·  Guess ${guess} of 3 — a wrong line costs 2 Standing. (Standing ${g.standing}/${g.maxStanding})`);
  const st = (q.pick && q.pick.done) ? puzzlePreview(p, q.pick.stone, q.pick.side, q.pick.idx, q.pick.swap) : puzzleFresh(p);
  if (!(q.pick && q.pick.done)) puzzleEvalues([st.you, st.foe], puzzleValues(p));

  const cardEl = (c, side, i, clickable) => {
    const el = document.createElement('div');
    el.className = 'card faceup loadcard puzzlecard' + (c.poisoned ? ' cursedpick' : '') + (clickable ? ' targetable' : '');
    const info = c.fx ? (FX_INFO[c.fx] || { label: c.fx }) : null;
    const v = c.poisoned ? 0 : c.evalue;
    el.innerHTML = `<div class="cval val-${Math.max(0, Math.min(3, v))}">${v}</div>` +
      (info ? `<div class="cfx cfx-${c.fx}">${info.label}</div>` : '') +
      `<div class="cicon icon-${c.type}"></div><div class="cname">${c.type}${c.phantoms ? ' ' + '✧'.repeat(c.phantoms) : ''}</div>`;
    if (clickable) el.onclick = () => puzzleClickCard(side, i);
    return el;
  };
  const boardRow = (cards, side) => {
    const row = document.createElement('div'); row.className = 'ldcards puzzlerow';
    const need = q.pick && !q.pick.done ? q.pick.need : null;
    cards.forEach((c, i) => row.appendChild(cardEl(c, side, i, need === side || need === 'any')));
    return row;
  };
  const foeSec = document.createElement('div'); foeSec.className = 'ldsection';
  foeSec.innerHTML = `<div class="ldhead">The rival’s board</div>`; foeSec.appendChild(boardRow(st.foe, 'foe'));
  const youSec = document.createElement('div'); youSec.className = 'ldsection';
  youSec.innerHTML = `<div class="ldhead">Your board</div>`; youSec.appendChild(boardRow(st.you, 'you'));
  body.appendChild(foeSec); body.appendChild(youSec);

  // Stones to spend.
  const ss = document.createElement('div'); ss.className = 'ldsection';
  ss.innerHTML = `<div class="ldhead">${q.pick && !q.pick.done ? promptForPick(q.pick) : 'Choose a stone, then its target'}</div>`;
  const srow = document.createElement('div'); srow.className = 'ldpouches';
  for (const stone of p.stones) {
    srow.appendChild(stonePickBtn({
      dot: `${stoneBase(stone)}${isVariant(stone) ? ' variant' : ''}`,
      label: getStone(stone).name.replace(' Stone', ''),
      title: `${getStone(stone).name} — ${getStone(stone).power}`,
      selected: q.pick && q.pick.stone === stone && !q.pick.done,
      onClick: () => puzzlePickStone(stone),
    }));
  }
  ss.appendChild(srow); body.appendChild(ss);

  // Preview + commit, once a full line is chosen.
  if (q.pick && q.pick.done) {
    const resp = puzzleResponse(p, puzzleKey(q.pick.stone, q.pick.side, q.pick.idx, q.pick.swap));
    const pv = document.createElement('div'); pv.className = 'ldsection puzzlepreview';
    pv.innerHTML = `<div class="ldnote">${resp.text}</div>`;
    body.appendChild(pv);
  }

  const next = $('circuitNext'); next.style.display = 'none';
  // Action buttons in the body (commit / reconsider / bail).
  const acts = document.createElement('div'); acts.className = 'introbtns';
  if (q.pick && q.pick.done) {
    const commit = document.createElement('button'); commit.className = 'btn primary'; commit.textContent = 'Commit this line ›';
    commit.onclick = puzzleCommit;
    const back = document.createElement('button'); back.className = 'btn'; back.textContent = 'Reconsider';
    back.onclick = () => { q.pick = null; circuitPuzzleScreen(); };
    acts.appendChild(commit); acts.appendChild(back);
  }
  const bail = document.createElement('button'); bail.className = 'btn ghost'; bail.textContent = q.academy ? '‹ Back to Puzzles' : 'Walk away';
  bail.onclick = () => { const back = q.back; g.puzzle = null; if (q.academy) { closeModal('circuitModal'); back && back(); } else circuitAfterNode(); };
  acts.appendChild(bail);
  body.appendChild(acts);
  $('circuitModal').classList.add('open');
}
function promptForPick(pick) {
  const base = stoneBase(pick.stone), nm = getStone(pick.stone).name;
  if (pick.need === 'any') return `${nm} — click any card to target.`;
  if (pick.need === 'foe') return `${nm} — click a rival card to target.`;
  if (base === 'blue') return pick.idx == null ? `${nm} — click one of YOUR cards to give up.` : `${nm} — now click a rival card to seize.`;
  return `${nm} — click one of YOUR cards.`;
}
function puzzlePickStone(stone) {
  const q = GAUNTLET.puzzle; const base = stoneBase(stone);
  // Green poisons a rival card; Blue gives up one of yours; everything else
  // (Red/White/Black/variants) may land on EITHER board — locking or undoing a
  // rival's card is a real line.
  const need = base === 'green' ? 'foe' : base === 'blue' ? 'you' : 'any';
  q.pick = { stone, side: need === 'foe' ? 'foe' : 'you', need, idx: null, swap: null, done: false };
  circuitPuzzleScreen();
}
function puzzleClickCard(side, i) {
  const q = GAUNTLET.puzzle; if (!q.pick || q.pick.done) return; const base = stoneBase(q.pick.stone);
  if (base === 'blue') {
    if (q.pick.idx == null) { if (side !== 'you') return; q.pick.idx = i; q.pick.need = 'foe'; }
    else { if (side !== 'foe') return; q.pick.swap = i; q.pick.done = true; }
  } else if (q.pick.need === 'any') {
    q.pick.side = side; q.pick.idx = i; q.pick.done = true; // either board; the key records which
  } else {
    if (side !== q.pick.need) return; q.pick.side = side; q.pick.idx = i; q.pick.done = true;
  }
  circuitPuzzleScreen();
}
function puzzleCommit() {
  const g = GAUNTLET, q = g.puzzle, p = PUZZLES[q.key];
  const resp = puzzleResponse(p, puzzleKey(q.pick.stone, q.pick.side, q.pick.idx, q.pick.swap));
  const guess = q.tryN + 1;
  // Academy: a practice riddle — no Standing at stake, retry as often as you like.
  if (q.academy) {
    if (resp.solve) { const back = q.back; g.puzzle = null; toast('Solved — well read.'); SFX.play('win'); closeModal('circuitModal'); back && back(); return; }
    q.pick = null; toast('Not the line — read the board again.'); SFX.play('sting'); circuitPuzzleScreen(); return;
  }
  if (resp.solve) {
    const reward = circuitPuzzleReward(g, guess);
    g.puzzle = null;
    toast(`Puzzle solved on guess ${guess} — you win ${reward}.`);
    SFX.play('win');
    circuitAfterNode();
    return;
  }
  // a miss
  g.standing = Math.max(1, g.standing - 2);
  q.tryN = guess; q.pick = null;
  if (guess >= 3) { g.puzzle = null; toast('The riddle bests you. You move on.'); circuitAfterNode(); return; }
  SFX.play('sting');
  circuitPuzzleScreen();
}
// Launch a puzzle from the Academy (practice mode — no run, no stakes).
function academyPuzzle(key) {
  if (typeof document === 'undefined') return;
  closeModal('academyModal');
  GAUNTLET.puzzle = { key, tryN: 0, pick: null, academy: true, back: openPuzzles };
  circuitPuzzleScreen();
}

// A grid of the owned deck's individual cards (optionally filtered), for the
// remove / move pickers.
function eventCardPicker(head, isSel, onPick, filter) {
  const g = GAUNTLET;
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">${head}</div>`;
  const row = document.createElement('div'); row.className = 'ldcards';
  g.deck.forEach((s, i) => {
    if (filter && !filter(s)) return;
    const type = specType(s), fx = specFx(s), v = specVal(s);
    const info = fx ? (FX_INFO[fx] || { label: fx }) : null;
    const el = document.createElement('div');
    el.className = 'card faceup loadcard' + (isSel(i) ? ' selected' : '');
    el.innerHTML = `<div class="cval val-${v}">${v}</div>${info ? `<div class="cfx cfx-${fx}">${info.label}</div>` : ''}<div class="cicon icon-${type}"></div><div class="cname">${type}</div>`;
    el.onclick = () => onPick(i);
    row.appendChild(el);
  });
  sec.appendChild(row);
  return sec;
}

function eventStonePicker() {
  const g = GAUNTLET, ev = g.event;
  const sec = document.createElement('div'); sec.className = 'ldsection';
  sec.innerHTML = `<div class="ldhead">Remove which stone?</div>`;
  const row = document.createElement('div'); row.className = 'ldpouches';
  for (const color of STONE_KEYS) {
    const n = g.pouch[color] || 0; if (!n) continue;
    row.appendChild(stonePickBtn({
      dot: color, label: `${STONES[color].name.replace(' Stone', '')} ×${n}`,
      title: `${STONES[color].name} — ${STONES[color].power}`,
      selected: ev.stoneColor === color,
      onClick: () => { ev.stoneColor = ev.stoneColor === color ? null : color; circuitEventScreen(); },
    }));
  }
  sec.appendChild(row);
  return sec;
}

// Apply the chosen event outcome (by kind), then advance the map. Headless-safe:
// the battery/tests build g.event directly with an interlude choice and no kind,
// which falls through to the interlude branch.
function circuitTakeEventAndAdvance() {
  const g = GAUNTLET, ev = g.event;
  const kind = (ev && ev.kind) || 'interlude';
  if (ev) {
    if (kind === 'cache') { if (ev.cardIdx != null && ev.offer) g.deck = g.deck.concat([ev.offer[ev.cardIdx]]); }
    else if (kind === 'whetstone') {
      const v = ev.stoneColor && variantForBase(ev.stoneColor);
      if (v && (g.pouch[ev.stoneColor] || 0) > 0) g.pouch = Object.assign({}, g.pouch, { [ev.stoneColor]: g.pouch[ev.stoneColor] - 1, [v]: (g.pouch[v] || 0) + 1 });
    }
    else if (kind === 'swap') {
      if (ev.stoneColor && (g.pouch[ev.stoneColor] || 0) > 0) g.pouch = Object.assign({}, g.pouch, { [ev.stoneColor]: g.pouch[ev.stoneColor] - 1, [ev.gain]: (g.pouch[ev.gain] || 0) + 1 });
    }
    else if (kind === 'gold') { g.coin = (g.coin || 0) + (ev.gold || 0); }
    else if (kind === 'blood') { /* already applied per bleed; nothing to confirm */ }
    else if (kind === 'gamble') {
      if (ev.giveCharm && ev.gain && (g.charms || []).includes(ev.giveCharm)) {
        const lost = CHARMS[ev.giveCharm], got = CHARMS[ev.gain];
        if (lost && lost.maxStandingAdd) { g.maxStanding -= lost.maxStandingAdd; g.standing = Math.min(g.standing, g.maxStanding); }
        g.charms = g.charms.filter(c => c !== ev.giveCharm).concat([ev.gain]);
        if (got && got.maxStandingAdd) { g.maxStanding += got.maxStandingAdd; g.standing += got.maxStandingAdd; }
      }
    }
    else if (ev.choice && eventReady()) { // interlude / repose
      if (ev.choice === 'heal') g.standing = Math.min(g.maxStanding, g.standing + circuitHealAmount());
      else if (ev.choice === 'removeCard' && g.deck.length > CIRCUIT.deckFloor) g.deck = g.deck.slice(0, ev.cardIdx).concat(g.deck.slice(ev.cardIdx + 1));
      else if (ev.choice === 'removeStone' && pouchTotal(g.pouch) > CIRCUIT.drawStones && g.pouch[ev.stoneColor] > 0) g.pouch = Object.assign({}, g.pouch, { [ev.stoneColor]: g.pouch[ev.stoneColor] - 1 });
      else if (ev.choice === 'moveMod') {
        const fx = specFx(g.deck[ev.srcIdx]);
        if (fx && !specFx(g.deck[ev.dstIdx])) {
          const deck = g.deck.slice();
          deck[ev.srcIdx] = specType(deck[ev.srcIdx]);                       // source becomes plain
          deck[ev.dstIdx] = { type: specType(deck[ev.dstIdx]), fx };          // destination gains the rider
          g.deck = deck;
        }
      }
    }
  }
  g.event = null;
  circuitAfterNode();
}

function updateCircuitHud() {
  if (typeof document === 'undefined') return;
  const hud = $('circuitHud');
  if (!hud) return;
  const g = GAUNTLET;
  if (!g.active) { hud.style.display = 'none'; return; }
  hud.style.display = '';
  const you = g.piles && g.piles[0];
  const drawN = you ? you.cardDraw.length : 0;
  // At the table the persona IS revealed (you know who you face here) — it's
  // only the map tree that keeps it hidden.
  const node = g.curNode, tag = node && node.type === 'boss' ? ' ⚔' : node && node.type === 'elite' ? ' ★' : '';
  hud.innerHTML = `<div class="chud-top"><span class="chud-k">The Circuit</span> · Act <b>${g.act}</b> · ⛁<b>${g.coin || 0}</b> · Score <b>${g.score}</b>` +
      `<button id="circuitMapPeek" class="chud-deck" title="Peek at the run map — your route ahead, for planning how hard to push">Map</button>` +
      `<button id="circuitDeck" class="chud-deck" title="View your deck and pouch — what's left to draw">Deck (${drawN})</button></div>` +
    `<div class="chud-bars">` +
      `<div class="chud-bar you" data-tip-head="Your Standing" data-tip="Your footing at the table — ${g.standing}/${g.maxStanding}. Lose a showdown and it drops by the margin; if it hits zero, the run ends. Clearing a node restores some."><span class="chud-lab">${g.ally ? 'You &amp; ' + g.ally : 'You'}</span><span class="chud-track"><span class="chud-fill" style="width:${Math.round(100 * g.standing / g.maxStanding)}%"></span></span><span class="chud-num">${g.standing}</span></div>` +
      `<div class="chud-bar foe" data-tip-head="Their Standing" data-tip="The foe's footing — ${g.foeHp}/${g.foeMax}. Win showdowns to press it down; break it to zero to clear this node."><span class="chud-lab">${(g.opp || '') + tag}</span><span class="chud-track"><span class="chud-fill" style="width:${Math.round(100 * g.foeHp / g.foeMax)}%"></span></span><span class="chud-num">${g.foeHp}</span></div>` +
    `</div>` +
    ((g.charms && g.charms.length) ? `<div class="chud-charms">${g.charms.map(k => `<span class="chud-charm" title="${CHARMS[k].label} — ${CHARMS[k].blurb}">${CHARMS[k].label}</span>`).join('')}</div>` : '') +
    ((g.chits && g.chits.length) ? `<div class="chud-chits" title="Debts carried this run — ${chitValue(g.chits)} chits">${chitPileHtml(g.chits)}</div>` : '');
  const db = $('circuitDeck'); if (db) db.onclick = () => showDeckView('remaining');
  const mb = $('circuitMapPeek'); if (mb) mb.onclick = () => showMapPeek();
}

// The deck / pouch viewer: what's left to draw (composition, not order) or the
// whole owned loadout. Built to extend to ally decks once the bench exists.
let deckViewMode = 'remaining';
function deckSpecKey(s) {
  const type = (s && typeof s === 'object') ? s.type : s;
  const fx = (s && typeof s === 'object') ? s.fx : null;
  return { type, fx, key: type + '|' + (fx || '') };
}
function showDeckView(mode) {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  if (!g || !g.active) return;
  if (mode) deckViewMode = mode;
  const remaining = deckViewMode === 'remaining';
  $('deckTabRemain').classList.toggle('on', remaining);
  $('deckTabFull').classList.toggle('on', !remaining);
  $('deckTabRemain').onclick = () => showDeckView('remaining');
  $('deckTabFull').onclick = () => showDeckView('full');
  $('deckClose').onclick = () => closeModal('deckModal');

  const body = $('deckViewBody');
  const you = (g.piles && g.piles[0]) || { cardDraw: [], cardDiscard: [], cardHand: null, stoneDraw: [], stoneDiscard: [], stoneHand: null };
  const cardSpecs = remaining ? (you.cardDraw || []) : (g.deck || []);
  const stoneList = remaining ? (you.stoneDraw || []) : (function () {
    const out = []; for (const c of STONE_KEYS) for (let i = 0; i < ((g.pouch && g.pouch[c]) || 0); i++) out.push(c); return out;
  })();

  // group cards by type+fx and count
  const groups = new Map();
  for (const s of cardSpecs) { const d = deckSpecKey(s); if (!groups.has(d.key)) groups.set(d.key, { type: d.type, fx: d.fx, n: 0 }); groups.get(d.key).n++; }
  const cardHtml = [...groups.values()].sort((a, b) => a.type.localeCompare(b.type)).map(grp => {
    const v = (grp.fx === 'anchor') ? CIRCUIT_ANCHOR : regionVal(grp.type);
    const info = grp.fx ? (FX_INFO[grp.fx] || { label: grp.fx }) : null;
    const fxBadge = info ? `<div class="cfx cfx-${grp.fx}">${info.label}</div>` : '';
    return `<div class="card faceup loadcard deckcard"><div class="cval val-${v}">${v}</div>${fxBadge}` +
      `<div class="cicon icon-${grp.type}"></div><div class="cname">${grp.type}</div>` +
      `<span class="deckcount">×${grp.n}</span></div>`;
  }).join('') || '<div class="ldnote">No cards left to draw — the discard reshuffles next.</div>';

  const sc = {}; for (const s of stoneList) sc[s] = (sc[s] || 0) + 1; // by stone key (base + variants)
  const stoneHtml = Object.keys(sc).filter(c => sc[c]).map(c =>
    `<span class="deckstone"><span class="stonedot ${stoneBase(c)}${isVariant(c) ? ' variant' : ''}" title="${getStone(c).name}"></span>×${sc[c]}${isVariant(c) ? ' <b>' + getStone(c).name + '</b>' : ''}</span>`).join('')
    || '<div class="ldnote">No stones left to draw — the discard reshuffles next.</div>';

  const cTotal = g.deck ? g.deck.length : 0;
  const pTotal = STONE_KEYS.reduce((s, c) => s + ((g.pouch && g.pouch[c]) || 0), 0);
  const cMeta = remaining
    ? `draw <b>${cardSpecs.length}</b> · discard <b>${you.cardDiscard ? you.cardDiscard.length : 0}</b> · in hand <b>${you.cardHand ? you.cardHand.length : 0}</b> · deck ${cTotal}`
    : `<b>${cTotal}</b> cards`;
  const pMeta = remaining
    ? `draw <b>${stoneList.length}</b> · discard <b>${you.stoneDiscard ? you.stoneDiscard.length : 0}</b> · in hand <b>${you.stoneHand ? you.stoneHand.length : 0}</b> · pouch ${pTotal}`
    : `<b>${pTotal}</b> stones`;

  const charms = (g.charms || []);
  const charmHtml = charms.length
    ? `<div class="ldsection"><div class="ldhead">Charms — ${charms.length}</div><div class="charmlist">` +
        charms.map(k => `<div class="charmrow"><span class="charmrow-h">${CHARMS[k].label}</span><span class="charmrow-b">${CHARMS[k].blurb}</span></div>`).join('') +
      `</div></div>`
    : '';
  const debts = (g.chits || []);
  const debtHtml = debts.length
    ? `<div class="ldsection"><div class="ldhead">Debts — ${chitValue(debts)} chit${chitValue(debts) === 1 ? '' : 's'}</div>${chitPileHtml(debts)}</div>`
    : '';
  const status = `<div class="deckstatus">Standing <b>${g.standing}/${g.maxStanding}</b>` +
    (g.foeMax && g.curNode ? ` · ${g.opp || 'foe'} <b>${g.foeHp}/${g.foeMax}</b>` : '') +
    ` · Act <b>${g.act}</b> · <b>${g.coin || 0}</b> coin</div>`;
  // Foresight (charm): reveal the next cards waiting on top of the draw pile.
  const fsN = charmVal('foresight');
  let foreHtml = '';
  if (fsN && remaining && (you.cardDraw || []).length) {
    const next = you.cardDraw.slice(-fsN).reverse(); // the pile pops from the end
    foreHtml = `<div class="ldsection"><div class="ldhead">Foresight — next to draw</div><div class="ldcards deckcards">` +
      next.map(s => { const t = (s && typeof s === 'object') ? s.type : s, fx = (s && typeof s === 'object') ? s.fx : null;
        const v = fx === 'anchor' ? CIRCUIT_ANCHOR : (REGIONS.bar.values[t] != null ? REGIONS.bar.values[t] : 2);
        const info = fx ? (FX_INFO[fx] || { label: fx }) : null;
        return `<div class="card faceup loadcard"><div class="cval val-${v}">${v}</div>${info ? `<div class="cfx cfx-${fx}">${info.label}</div>` : ''}<div class="cicon icon-${t}"></div><div class="cname">${t}</div></div>`;
      }).join('') + `</div></div>`;
  }
  body.innerHTML =
    status +
    foreHtml +
    `<div class="ldsection"><div class="ldhead">Cards — ${cMeta}</div><div class="ldcards deckcards">${cardHtml}</div></div>` +
    `<div class="ldsection"><div class="ldhead">Pouch — ${pMeta}</div><div class="deckstones">${stoneHtml}</div></div>` +
    charmHtml +
    debtHtml +
    (remaining ? `<div class="ldnote">What's left to draw — the order is shuffled, so this is the pool, not the sequence.</div>` : '');
  $('deckModal').classList.add('open');
}

function circuitScreen(over) {
  if (typeof document === 'undefined') return;
  const g = GAUNTLET;
  const title = $('circuitTitle'), text = $('circuitText'), stats = $('circuitStats');
  const next = $('circuitNext'); next.style.display = '';
  next.disabled = false; // the loadout screen may have disabled it
  const mc = $('circuitModal').querySelector('.modalcard'); if (mc) mc.classList.remove('wide');
  stats.className = 'victoryunlocks'; // reset from the loadout layout
  if (over) {
    SFX.play('lose');
    title.textContent = 'The Circuit ends';
    text.textContent = `You cleared ${g.cleared} node${g.cleared === 1 ? '' : 's'} before ${g.opp} wore your Standing down at ${VENUES[g.venue].label}.`;
    stats.innerHTML = `<div class="unlockhead">Run Chronicle</div>` +
      `<div class="unlockitem">Nodes cleared: <b>${g.cleared}</b> (act ${g.act})</div>` +
      `<div class="unlockitem">Final score: <b>${g.score}</b></div>` +
      `<div class="unlockitem">Seed: <b>${g.seed >>> 0}</b></div>`;
    const rb = document.createElement('button'); rb.className = 'btn recordsbtn'; rb.textContent = 'Records & Compendium'; rb.onclick = showCircuitRecords;
    stats.appendChild(rb);
    next.textContent = 'Run it again';
    next.onclick = () => startCircuit(); // no arg = fresh random seed (a bare onclick passes the MouseEvent → seed 0)
  } else {
    SFX.play('win');
    const nv = CIRCUIT.venues[(g.rung - 1) % CIRCUIT.venues.length];
    title.textContent = `Table ${g.cleared} cleared`;
    text.textContent = `Standing restored (+${ccfg('heal')}). Look ahead — the next table is set.`;
    stats.innerHTML = `<div class="unlockhead">The Circuit — up next</div>` +
      `<div class="unlockitem">Your Standing: <b>${g.standing}/${g.maxStanding}</b></div>` +
      `<div class="unlockitem">Score: <b>${g.score}</b></div>` +
      `<div class="unlockitem">Next foe: <b>${g.opp}</b> — ${VENUES[nv] ? VENUES[nv].label : nv}</div>`;
    next.textContent = 'Next table ›';
    next.onclick = circuitRung;
  }
  $('circuitModal').classList.add('open');
}

// Styled hover reminder for effect cards: read the fx off whatever card the
// pointer is over (works for every card render path, since they all carry the
// .cfx badge) and float a themed tooltip anchored to it.
// One styled tooltip for the whole UI. It themes three families uniformly:
//   • card modifiers — a .card carrying a .cfx badge (label + blurb from FX_INFO)
//   • stones & charms — .stonedot / .stone / .chud-charm / .rewardstone, whose
//     existing native `title` ("Name — power: desc") is parsed into head + body
//     and shown in the styled box (the native tooltip is suppressed while shown)
//   • anything explicit — an element with data-tip (+ data-tip-head / -cls), e.g.
//     the Circuit Standing bars.
// Incidental button titles (Menu, dealer token…) stay as plain native tooltips.
const TIP_SELECTOR = '.stonedot, .stone, .chud-charm, .rewardstone';
function setupTooltips() {
  const tip = $('fxtip'); if (!tip) return;
  let cur = null, stashEl = null, stashTitle = null;
  const fxOf = card => {
    const badge = card.querySelector && card.querySelector('.cfx');
    if (!badge) return null;
    for (const cls of badge.classList) if (cls.indexOf('cfx-') === 0) return cls.slice(4);
    return null;
  };
  const colorClassOf = el => {
    const probe = el.classList && [...el.classList].find(c => STONE_KEYS.includes(c)) ||
      (el.querySelector && el.querySelector('.stonedot') && [...el.querySelector('.stonedot').classList].find(c => STONE_KEYS.includes(c)));
    return probe ? 'tip-' + probe : '';
  };
  // Resolve the hovered element into { el, head, body, cls } — or null.
  const resolve = t => {
    if (!t || !t.closest) return null;
    const de = t.closest('[data-tip]');
    if (de) return { el: de, head: de.dataset.tipHead || '', body: de.dataset.tip || '', cls: de.dataset.tipCls || '' };
    // stones/charms before .card, so a stone marker rendered on a card shows the
    // stone, not the card's modifier.
    const se = t.closest(TIP_SELECTOR);
    if (se && se.getAttribute('title')) {
      const raw = se.getAttribute('title');
      const i = raw.indexOf(' — ');
      const head = i >= 0 ? raw.slice(0, i) : raw;
      const body = i >= 0 ? raw.slice(i + 3) : '';
      return { el: se, head, body, cls: colorClassOf(se), nativeTitle: true };
    }
    const card = t.closest('.card');
    if (card) { const fx = fxOf(card); if (fx && FX_INFO[fx]) return { el: card, head: FX_INFO[fx].label, body: FX_INFO[fx].blurb, cls: 'cfx-' + fx }; }
    return null;
  };
  const place = anchor => {
    const r = anchor.getBoundingClientRect();
    tip.style.display = 'block';
    const t = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - t.width / 2;
    let top = r.top - t.height - 8;
    if (top < 6) top = r.bottom + 8; // flip below if no room above
    left = Math.max(6, Math.min(left, window.innerWidth - t.width - 6));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  };
  const hide = () => {
    if (!cur) return;
    if (stashEl && stashTitle != null) { stashEl.setAttribute('title', stashTitle); } // restore native title
    stashEl = stashTitle = cur = null;
    tip.classList.remove('show'); tip.style.display = 'none';
  };
  document.addEventListener('mouseover', e => {
    const r = resolve(e.target);
    if (!r) { hide(); return; }
    if (r.el === cur) return;
    hide();
    cur = r.el;
    if (r.nativeTitle) { stashEl = r.el; stashTitle = r.el.getAttribute('title'); r.el.removeAttribute('title'); } // suppress the native tooltip
    tip.innerHTML = (r.head ? `<div class="fxtip-h ${r.cls || 'tip-gold'}">${r.head}</div>` : '') + (r.body ? `<div class="fxtip-b">${r.body}</div>` : '');
    place(r.el);
    requestAnimationFrame(() => tip.classList.add('show'));
  });
  document.addEventListener('mouseout', e => {
    if (!cur) return;
    if (e.relatedTarget && e.relatedTarget.closest && (e.relatedTarget.closest('[data-tip]') === cur || e.relatedTarget.closest('.card') === cur || e.relatedTarget.closest(TIP_SELECTOR) === cur)) return;
    hide();
  });
  window.addEventListener('scroll', hide, true);
}

function boot() {
  // Start buffering the music at page load so it plays the instant the first
  // gesture lands (otherwise it downloads on-click, a ~3s awkward gap).
  try { $('bgm').load(); $('bgmBoss').load(); } catch (e) {}
  setupTooltips();
  logEl = $('log');
  phaseEl = $('phaseLabel');
  phaseNoteEl = $('phaseNote');
  promptEl = $('prompt');
  $('nextHandBtn').onclick = () => {
    $('showdownResume').style.display = 'none';
    if (UI.reviewing) {
      UI.reviewing = false;
      closeModal('showdownModal');
      run();
    } else {
      nextHand();
    }
  };
  $('reviewBtn').onclick = () => {
    if (G && G.lastShowdown && !$('showdownModal').classList.contains('open')) {
      UI.reviewing = true;
      showShowdownModal(G.lastShowdown, true);
    }
  };
  // Open Rules fully collapsed every time — no accordion carries a stale
  // open state from a prior visit (title or in-match, either entry point).
  const openRules = () => {
    const m = $('rulesModal'); if (!m) return;
    m.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open'));
    m.classList.add('open');
  };
  $('rulesBtn').onclick = openRules;
  $('passBtn').onclick = passConfirm;
  // The Menu dropdown: new match, sound, fullscreen, and quit-to-title all
  // live here so the sidebar stays uncluttered.
  const menuPopSet = open => {
    const pop = $('menuPop');
    if (open) {
      renderTableSummary();
      pop.style.display = '';
      // Anchor as a fixed, viewport-clamped popover: it never grows the page
      // (no scroll) and always paints above the board. Prefer above the button;
      // drop below only if there isn't room.
      const r = $('menuBtn').getBoundingClientRect();
      pop.style.position = 'fixed';
      pop.style.bottom = 'auto';
      pop.style.transform = 'none';
      const w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + 'px';
      let top = r.top - h - 6;
      if (top < 8) top = Math.min(r.bottom + 6, window.innerHeight - h - 8);
      pop.style.top = Math.round(Math.max(8, top)) + 'px';
    } else {
      pop.style.display = 'none';
    }
    $('menuBtn').classList.toggle('active', open);
  };
  $('menuBtn').onclick = e => { e.stopPropagation(); menuPopSet($('menuPop').style.display === 'none'); };
  document.addEventListener('click', e => {
    if ($('menuPop').style.display !== 'none' && !e.target.closest('.menuwrap')) menuPopSet(false);
  });
  // ---- Audio settings panel (music vol, effects vol, mute) ----
  const syncAudio = () => {
    const m = isGlobalMute();
    $('muteToggle').textContent = m ? 'Sound: Off' : 'Sound: On';
    $('muteToggle').classList.toggle('muted', m);
    const mv = Math.round(Music.getVolume() * 100), sv = Math.round(SFX.getVolume() * 100);
    $('musicVol').value = mv; $('musicVolVal').textContent = mv;
    $('sfxVol').value = sv; $('sfxVolVal').textContent = sv;
    $('musicVol').disabled = m; $('sfxVol').disabled = m;
  };
  // ---- Dialogue settings (which portrait scenes play) ----
  const syncDialogue = () => {
    const p = dialoguePrefs();
    document.querySelectorAll('#dlgCampaign .segbtn').forEach(b => b.classList.toggle('on', b.dataset.v === p.campaign));
    const tog = (id, on) => { const b = $(id); if (b) { b.textContent = on ? 'On' : 'Off'; b.classList.toggle('on', !!on); b.classList.toggle('off', !on); } };
    tog('dlgElites', p.elites); tog('dlgCbosses', p.cbosses); tog('dlgEvents', p.events);
  };
  document.querySelectorAll('#dlgCampaign .segbtn').forEach(b => {
    b.onclick = () => { setDialoguePref('campaign', b.dataset.v); syncDialogue(); };
  });
  [['dlgElites', 'elites'], ['dlgCbosses', 'cbosses'], ['dlgEvents', 'events']].forEach(([id, key]) => {
    const b = $(id); if (b) b.onclick = () => { setDialoguePref(key, !dialoguePrefs()[key]); syncDialogue(); };
  });
  // ---- Input mode (mouse / keyboard cursor) — hidden on touch devices ----
  const syncInput = () => {
    const sec = $('ctrlSection'); if (sec) sec.style.display = kbCapable() ? '' : 'none';
    document.querySelectorAll('#inputMode .segbtn').forEach(b => b.classList.toggle('on', b.dataset.v === inputMode()));
  };
  document.querySelectorAll('#inputMode .segbtn').forEach(b => {
    b.onclick = () => { setInputMode(b.dataset.v); syncInput(); };
  });
  window.addEventListener('keydown', e => KB.onKey(e));
  window.addEventListener('keydown', onEscapeKey); // universal dismiss (all input modes)
  // Keyboard play covers whatever surface is up (modal / menu / title / board),
  // but only render() re-seats the ring — and screens swap in without a render
  // (title submenus, the map, loadout/shop/reward views, modal tabs) by toggling
  // child display, not any one attribute. So watch the whole tree and re-seat the
  // cursor a frame after anything changes. The observer disconnects around KB's
  // own ring/badge writes so those can't re-trigger it (no feedback loop).
  if (window.MutationObserver) {
    const KBOBS = { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] };
    let queued = false;
    const kbObserver = new MutationObserver(() => {
      if (queued || !KB.enabled()) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!KB.enabled()) return;
        kbObserver.disconnect();
        KB.refresh();
        kbObserver.observe(document.body, KBOBS);
      });
    });
    kbObserver.observe(document.body, KBOBS);
  }
  applyInputMode();
  const openAudio = () => { syncAudio(); syncDialogue(); syncInput(); $('audioModal').classList.add('open'); };
  $('audioBtn').onclick = () => { menuPopSet(false); openAudio(); };
  $('titleAudio').onclick = openAudio;
  $('audioClose').onclick = () => closeModal('audioModal');
  $('muteToggle').onclick = () => { setGlobalMute(!isGlobalMute()); syncAudio(); };
  $('musicVol').oninput = e => { Music.setVolume(+e.target.value / 100); $('musicVolVal').textContent = e.target.value; };
  $('sfxVol').oninput = e => { SFX.setVolume(+e.target.value / 100); $('sfxVolVal').textContent = e.target.value; SFX.play('stone'); };
  // Browsers block audio until a user gesture. Retry on EVERY gesture until the
  // loop is actually playing (the first click can land before the file buffers,
  // so a one-shot attempt silently fails), then unhook.
  const tryStartMusic = () => {
    const a = document.getElementById('bgm');
    if (a && !a.paused) {
      window.removeEventListener('pointerdown', tryStartMusic);
      window.removeEventListener('keydown', tryStartMusic);
      return;
    }
    Music.start();
  };
  window.addEventListener('pointerdown', tryStartMusic);
  window.addEventListener('keydown', tryStartMusic);
  $('rulesClose').onclick = () => closeModal('rulesModal');
  // Collapsing the turn-order section resets its nested mode accordions, so it
  // reopens to a clean "pick a mode" state rather than remembering old expansions.
  const toa = $('turnOrderAcc');
  if (toa) toa.addEventListener('toggle', () => { if (!toa.open) toa.querySelectorAll('.turnacc[open]').forEach(d => d.removeAttribute('open')); });
  // Table Talk is cramped and hard to scroll on a phone — tap it there to read
  // the full log in a roomy, scrollable overlay.
  $('logClose').onclick = () => closeModal('logModal');
  $('log').addEventListener('click', () => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 760px)').matches) openLogModal();
  });
  $('newGameBtn').onclick = () => { menuPopSet(false); (G && G.mode === 'raid' ? openRaidSetup() : openSetup()); };
  $('fsBtn').onclick = () => {
    menuPopSet(false);
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  $('victoryNew').onclick = () => { const raid = G && G.mode === 'raid'; closeModal('victoryModal'); raid ? openRaidSetup() : openSetup(); };
  $('titleBtn').onclick = () => { menuPopSet(false); requestQuitToTitle(); };
  $('titleContinue').onclick = resumeMatch;
  // quitModal is now the "start a new match — discard the paused one?" confirm.
  let pendingNewMatch = null;
  const startNewFromTitle = fn => {
    markOnboarded(); // starting any match clears the first-run Academy tag
    if (G && !G.over) {
      pendingNewMatch = fn;
      const m = $('quitModal');
      m.querySelector('h2').textContent = 'Start a new match?';
      m.querySelector('p').textContent = 'Your paused match will be discarded once you set a new table.';
      $('quitYes').textContent = 'New match';
      $('quitNo').textContent = 'Keep paused match';
      m.classList.add('open');
    } else fn();
  };
  $('quitYes').onclick = () => { closeModal('quitModal'); const fn = pendingNewMatch; pendingNewMatch = null; if (fn) fn(); };
  $('quitNo').onclick = () => { pendingNewMatch = null; closeModal('quitModal'); };
  if ($('titlePlay')) $('titlePlay').onclick = () => showTitleMenu('play');
  if ($('titleBack')) $('titleBack').onclick = () => showTitleMenu('main');
  $('titleStandard').onclick = () => startNewFromTitle(openSetup);
  $('titleRaid').onclick = () => startNewFromTitle(openRaidSetup);
  if ($('titleCircuit')) $('titleCircuit').onclick = () => startNewFromTitle(startCircuit);
  if ($('circuitQuit')) $('circuitQuit').onclick = () => { closeModal('circuitModal'); showTitle(); };
  $('titleTutorial').onclick = openAcademy;
  // academyBack's handler is set per-view (Academy vs Stones submenu) in academyMenu().
  $('titleRules').onclick = openRules;
  $('titleRegulars').onclick = openRegulars;
  // Alpha bypass lives on the title now: ignore campaign locks while testing.
  const syncAlpha = () => {
    const on = alphaUnlock();
    $('titleAlpha').classList.toggle('selected', on);
    $('titleAlpha').textContent = (on ? '✓ ' : '') + 'Alpha — all bosses unlocked';
  };
  $('titleAlpha').onclick = () => { setAlphaUnlock(!alphaUnlock()); syncAlpha(); };
  syncAlpha();
  $('regularsBack').onclick = () => closeModal('regularsModal');
  $('coachNext').onclick = () => {}; // assigned per-step by coachShow
  $('coachMin').onclick = coachMinimize;
  $('coachRestore').onclick = coachRestoreShow;
  // Peek at the board behind a showdown (e.g. to see where the Apothecary cut),
  // then come back to the results — like minimizing the tutorial coach.
  $('showdownPeek').onclick = () => { closeModal('showdownModal'); $('showdownResume').style.display = ''; render(); };
  $('showdownResume').onclick = () => { $('showdownResume').style.display = 'none'; $('showdownModal').classList.add('open'); };
  showTitle();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', boot);
} else if (typeof module !== 'undefined') {
  module.exports = {
    bestSelection, REGIONS, TYPES, STONES, CIRCUIT, CHARMS, STONE_VARIANTS, stoneBase, getStone, isVariant,
    circuitRecords, markCharmSeen, charmSeen, recordCircuitRun,
    newGame, nextHand,
    humanDeclare, humanToggleCard, humanConfirmDeploy, humanThin, humanConfirmHandEdit, humanConfirmDisrupt,
    humanChooseStone, humanTargetCard, humanDiscardStone, passConfirm, applyStone,
    humanTargetSlot, humanPickCommitCard,
    twoBestHands, undoableEventFor, isLocked, isOpponent, resolveArchivist,
    campaignBeaten, markCampaignWin, recordCampaignWin, unlockLines, setAlphaUnlock,
    dialoguePrefs, setDialoguePref, showCampaignIntro, showCampaignDefeat, showCircuitScene, showEventScene, DLG_KEY,
    inputMode, setInputMode, kbPickInDirection, INPUT_KEY,
    startCircuit, circuitEnd, circuitHandResult, applyCardEffects, FX_INFO,
    buildAct, circuitReachable, circuitEnterNode, circuitSetupFight, circuitSetupCoopFight, circuitAllyDraftPool, pickFoeFor, circuitAfterNode, makeShop, circuitShopBuy, circuitShopThin,
    seedRng, clearRng, rnd, dailySeed,
    circuitResetPiles, circuitBuildFor, CIRCUIT_DECKS, deckByKey, makeReward, circuitTakeRewardAndAdvance,
    circuitTakeEventAndAdvance, circuitHealAmount, makeCircuitEvent, variantForBase, upgradableStones,
    PUZZLES, PUZZLE_KEYS, solvePuzzle, puzzleAcademySafe, puzzlePreview, puzzleValues, puzzleKey, actVenues, actCast, CIRCUIT_MIN_FIGHTS, CIRCUIT_MAX_FIGHTS,
    CIRCUIT_CHITS, CHIT_GATES, computeChitTune, chitValue, chitsUnlocked, chitsUnlockedCount, chitsNextGate, chitsBestCleared, recordChitClear, chitByKey, gatedChits, bonusChits, hcBeaten,
    CIRCUIT_ALLY_LINES, CIRCUIT_FOE_TAUNTS, CIRCUIT_ALLY_WINLINES,
    FOE_SOLO_TAUNTS, BOSS_INTRO, BOSS_DEFEAT, dialoguePlate, foeSoloTaunt, bossIntroLine, bossDefeatLine,
    circuitDrawCards: n => pileDrawCards(GAUNTLET.piles[0], n),
    circuitDrawStones: n => pileDrawStones(GAUNTLET.piles[0], n),
    _gauntlet: () => GAUNTLET,
    _state: () => G, _ui: () => UI, _run: () => run(),
    // AI internals, exposed for decision-level effect tests.
    _ai: { estimate, sideSwing, aiBestBlueTarget, aiBestRedTarget, aiBestBlackTarget, aiChooseDeploy, aiStonePreference, aiStoneValue, effVal, EFFECTS, positionDeploy, isPositionalFx },
    _personas: { PERSONALITIES, BOT_POOL, personaCoachNote, coachNoteHtml },
  };
}
