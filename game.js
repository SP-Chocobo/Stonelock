'use strict';
/* ============================================================
   STONELOCK — a playable adaptation of the tabletop game
   from the novel.

   Formats: Solo 1v1, 4-player Free-for-All, 2v2 Paired Teams.
   Deals: Small Game (5 cards, best 3 of 4) or House Deep Draft
   (9 cards, best 3 of 5). Sovereign Honor scoring throughout —
   the FFA table banks the winner's margin over the runner-up.
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
const VENUES = {
  tavern: { region: 'bar', variant: null, label: 'The Roadside Tavern', desc: 'The Practical Common values. No house rules — the baseline game.' },
  court: { region: 'house', variant: null, label: 'The Sovereign Court', desc: 'Statecraft values — Chain, Crest, Quill high. Formal play, no deviations.' },
  docks: { region: 'dock', variant: 'riverlock', label: 'The River Docks', desc: 'Fluvial Exchange values, under Riverlock: field a Road or Ferry among your final three, or the hand is docked 2 points.' },
  hall: { region: 'bar', variant: 'cursed', label: 'The Gambling Hall', desc: 'Common values, under the Cursed Register: each hand one card type is drawn cursed — it scores nothing and builds nothing.' },
  slums: { region: 'bar', variant: 'slumlock', label: 'The Slum Tables', desc: 'Common values, under Slumlock: a stone placed this hand is exhausted for the next two hands.' },
  academy: { region: 'bar', variant: 'gauntlet', label: 'The Academy Gauntlet', desc: 'A drill in pure interaction: no telegraphing, no thinning. Every player holds one of each stone and must place all four, in serpentine turn order. The cards are a fixed canvas — the stones decide it.' },
};

const STONES = {
  red:   { name: 'Red Stone',   power: 'Duplication', desc: 'Places a phantom duplicate onto one of your cards. The phantom can stand as the second or third copy for a Pair or Triad bonus, but scores no point value of its own.' },
  white: { name: 'White Stone', power: 'Lock',        desc: 'Protects a card. A locked card cannot be altered, stolen, or neutralized for the rest of the hand.' },
  blue:  { name: 'Blue Stone',  power: 'Exchange',    desc: 'Forcibly swaps one of your cards with an unprotected card in an opponent’s layout. Visibility states stay as they were.' },
  black: { name: 'Black Stone', power: 'Disruption',  desc: 'Undoes the last stone effect upon a card. Played on your turn like any other stone; it cannot itself be undone.' },
  green: { name: 'Green Stone', power: 'Poison',      desc: 'Poisons a card: it scores nothing and joins no Pair or Triad, and any phantom riding it dies with it. The Apothecary’s scalpel — always its last word, cutting your best unlocked card. Only a White lock set in time can shield against it.' },
};

const STONE_KEYS = ['red', 'white', 'blue', 'black'];

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
  'The Warden': { red: 1.0, white: 1.2, blue: 1.5, black: 1.7, bluff: 0, risk: 0, skill: 1.0, flavor: 'Keeps one of every stone in hand and never wastes a hand of it — exhaustion be damned. It snuffs, steals, and locks without mercy.' },
  'The Tinker':   { red: 1.7, white: 1.2, blue: 0.7, black: 0.8, bluff: 0.12, risk: 1, skill: 0.93, flavor: 'In love with phantoms — reds everything, defends out of habit, and sometimes plays the wrong stone entirely.', bio: 'A tinkerer enchanted by phantoms — he Reds nearly everything, hunting Pairs and Triads that are not always there, and now and then fumbles the wrong stone entirely. Lethal when his duplicates land; gift-wrapped when they do not.' },
  'The Deckhand': { red: 0.9, white: 0.8, blue: 1.5, black: 0.7, bluff: 0.25, risk: 0, skill: 0.90, flavor: 'Plays fast and peeks at nothing. Bold trades, sloppy endings.', bio: 'Quick hands, no patience. He commits fast, peeks at nothing, and throws Blue Stones like dice — bold steals that swing a hand, undone by careless endgames. Punish the sloppiness and he folds.' },
  'The Lady':     { red: 0.9, white: 1.1, blue: 1.4, black: 1.4, bluff: 0.35, risk: 1, skill: 1.0, flavor: 'Plays the player, not the cards. Her every gesture is theater.', bio: 'Poised, unhurried, and entirely insincere. She bluffs with the best and answers with Blue and Black — stealing tempo, unmaking your cleverness, making you feel clumsy for trying. The most dangerous regular at a full table.' },
  'The Miner':    { red: 1.5, white: 1.4, blue: 0.6, black: 0.7, bluff: 0.05, risk: 2, skill: 0.97, flavor: 'Trusts what he digs up, not sleight of hand.', bio: 'Grim and methodical, he grinds raw value out of the deck, Red-doubles his richest seams, and White-locks the vein. No bluffs, no theft — just a deep, stubborn pile of points you have to out-dig.' },
  'The Wagoner':  { red: 0.8, white: 0.8, blue: 1.7, black: 1.5, bluff: 0.15, risk: 0, skill: 0.95, flavor: 'Everything’s cargo — to be hauled off or dropped in the mud.', bio: 'A restless hauler who treats the whole table as freight. He Blues your prizes onto his wagon and Blacks the plans you were proud of, rerouting a hand into chaos. Light on defense — outlast the churn and he runs out of road.' },
};
const DEFAULT_PERSONA = { red: 1, white: 1, blue: 1, black: 1, bluff: 0.1, risk: 1, skill: 1, flavor: '' };
function personaOf(who) { return PERSONALITIES[G.names[who]] || DEFAULT_PERSONA; }
// Sloppiness: below-skill players occasionally make the wrong play.
function fumbles(who) { return Math.random() > personaOf(who).skill; }

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
  'The Archivist': 'archivist',
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

const SFX = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('stonelock-muted') === '1'; } catch (e) { /* headless */ }

  function ensure() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(c, t0, freq, dur, type = 'sine', peak = 0.1, slideTo = null) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(c, t0, dur, filterType = 'lowpass', freq = 600, peak = 0.18) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = peak;
    src.connect(f).connect(g).connect(c.destination);
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
      if (muted) return;
      const c = ensure();
      if (!c || !recipes[name]) return;
      try { recipes[name](c, c.currentTime); } catch (e) { /* never break the game for a sound */ }
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('stonelock-muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    isMuted() { return muted; },
  };
})();

/* ---------------- Utilities ---------------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

  function structure(counts) {
    const c = Object.values(counts);
    if (c.includes(3)) return 'triad';
    if (c.includes(2)) return 'pair';
    return 'singles';
  }
  const RANK = { triad: 2, pair: 1, singles: 0 };

  function evaluate() {
    const counts = {};
    let raw = 0;
    const picks = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < contrib[i]; k++) {
        const t = cards[i].type;
        // A poisoned card behaves exactly like a cursed one: no value, no structure.
        const cursed = cards[i].poisoned || (!!opts.cursed && t === opts.cursed); // scores nothing, builds nothing
        if (!cursed) {
          counts[t] = (counts[t] || 0) + 1;
          if (k === 0) raw += values[t]; // phantoms score no raw value
        }
        picks.push({ type: t, phantom: k > 0, cardIdx: i, cursed });
      }
    }
    const struct = structure(counts);
    const bonus = struct === 'triad' ? 6 : struct === 'pair' ? 2 : 0;
    let penalty = 0;
    if (opts.riverlock && !picks.some(p => (p.type === 'Road' || p.type === 'Ferry') && !p.cursed)) {
      penalty = 2; // the Passage Requirement
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
    const maxHere = cards[i].hasRed ? 2 : 1;
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
  hideTitle();
  const raid = cfg.mode === 'raid';
  const n = raid ? 3 : seatCountOf(cfg.mode);
  const cfgHumans = raid ? null : (cfg.humans || humansFor(cfg.mode));
  const venue = VENUES[cfg.venue || 'tavern'];
  G = {
    mode: cfg.mode,                 // 'duel' | 'ffa' | 'teams' | 'hotseat… | 'raid'
    deal: raid ? 'small' : cfg.deal,
    target: cfg.target,
    venue,
    variant: raid ? null : venue.variant,
    raidBoss: raid ? (cfg.raidBoss || 'magistrate') : null,
    // Stone exhaustion: Slumlock venue = 2 hands; the Warden raid = 1.
    exhaustHands: raid ? (cfg.raidBoss === 'warden' ? 1 : 0) : (venue.variant === 'slumlock' ? 2 : 0),
    open: cfg.targeting === 'open', // advanced: any stone, any layout (raids may opt in)
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
          : ['You', raidBossName(cfg.raidBoss), 'The Old Hand'])
      : buildNames(cfg.mode, cfgHumans, cfg.names || [], cfg.companyNames || null),
    humans: raid ? (cfg.raidAlly === 'hotseat' ? [0, 2] : [0]) : cfgHumans,
    viewer: 0,
    raidDiff: raid ? (cfg.raidDiff || 'standard') : null,
    ledger: 0,                      // duel/teams: positive = your side
    scores: new Array(n).fill(0),   // ffa: banked margins
    dealer: Math.floor(Math.random() * n),
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
  }[G.variant] || '';
  if (G.mode === 'raid') {
    const bn = playerName(1);
    log(`${bn} takes the high seat — a ${raidDiff().label} raid. ${playerName(0)} and ${playerName(2)} field five cards and three stones each; ${bn} fields ${RAID_BOSS_CARDS} cards, all face-up, selects from a deep pouch (3 of each), and spends ${raidDiff().stones} stones — answering every move and keeping the last word.${G.exhaustHands ? ` Every stone spent is exhausted for ${G.exhaustHands} hand${G.exhaustHands === 1 ? '' : 's'} — for both sides.` : ''} It scores its two best hands; your party scores both of yours combined. Drive the marker ${G.target} to break it — it holds any tie.`, 'sys');
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
  if (G.mode === 'raid') return i === 1 ? 1 : 0; // the Magistrate alone vs the party
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
  'magistrate-hard': envNum('MAG_HARD_HB', 0.25), // ~31% party (was ~20)
  'warden-standard': envNum('WAR_STD_HB', 0.3),   // ~44% party (was ~37)
  // The Apothecary's cut is worth far more than one stone, so it spends several
  // fewer regular ones (APOTH_DROP_BY_DIFF) and these hold-backs fine-tune the
  // tiers: measured ~easy 70% / standard ~55% / hardcore ~25% vs competent,
  // white-aware party bots. Tunable by play.
  'apothecary-easy': envNum('APO_EASY_HB', 0.4),
  'apothecary-hard': envNum('APO_HARD_HB', 0.3),
};
const APOTH_DROP_BY_DIFF = { easy: 3, standard: 4, hard: 4 };
function apothDrop() { return envNum('APOTH_DROP', APOTH_DROP_BY_DIFF[G.raidDiff] ?? 4); }
function raidBossName(boss) { return boss === 'warden' ? 'The Warden' : boss === 'apothecary' ? 'The Apothecary' : 'The Magistrate'; }
function isMagistrate(seat) { return G.mode === 'raid' && seat === 1; }
function footprintOf(seat) { return isMagistrate(seat) ? RAID_BOSS_CARDS : dealSpec().footprint; }
function handSizeFor(seat) { return isMagistrate(seat) ? RAID_BOSS_CARDS : dealSpec().handSize; }


function orderFrom(start) {
  const out = [];
  for (let k = 0; k < G.nPlayers; k++) out.push((start + k) % G.nPlayers);
  return out;
}
function dealOrder() { return orderFrom((G.dealer + 1) % G.nPlayers); }

function startHand() {
  G.handNum++;
  G.events = [];
  G.cards = [];
  G.armed = false; // telegraphed stones become "spendable" once arming runs
  UI = { mode: 'idle', selected: [], pendingStone: null, blueOwn: null, flashIds: [] };

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
    if (G.fixedPool && G.fixedPool[p]) pool = Object.assign({ red: 0, white: 0, blue: 0, black: 0 }, G.fixedPool[p]);
    // Exhaustion (Slumlock / Warden): recently-placed stones are still out.
    if (G.exhaustHands) {
      for (const color of STONE_KEYS) pool[color] = Math.max(0, pool[color] - slumBlocked(p, color));
    }
    G.players.push({
      idx: p,
      hand: [],
      board: [],
      pool,
      declared: [],
      removed: null,
      active: gauntlet ? STONE_KEYS.filter(c => pool[c] > 0) : [], // raid arms active after telegraphing
      aiPlan: null,
    });
  }

  // The Cursed Register: one card type is drawn and voided this hand.
  if (G.variant === 'cursed') {
    G.cursedType = TYPES[Math.floor(Math.random() * TYPES.length)];
    log(`The Cursed Card is drawn: every ${G.cursedType} is voided this hand — no points, no Pairs, no Triads.`, 'sys');
  }
  for (let p = 0; p < G.nPlayers; p++) {
    const fixed = G.fixedHands && G.fixedHands[p];
    for (let k = 0; k < handSizeFor(p); k++) {
      const dealt = active.pop();
      const card = {
        id: id++,
        type: (fixed && fixed[k]) || dealt,
        owner: p,
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

  if (raid) {
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
    if (holdback && Math.random() < holdback) {
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
  run();
}

function isLocked(card) { return card.stones.some(s => s.color === 'white'); }
function hasRed(card) { return card.stones.some(s => s.color === 'red'); }
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
        const up = isMagistrate(i) ? true : step.faceUp;
        const cnt = isMagistrate(i) ? step.count * 2 : step.count;
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
      G.armed = true;
      break;
    case 'thin':
      aiThin(step.who);
      break;
    case 'place':
      if (!isHuman(step.who) && G.players[step.who].active.length > 0) aiPlace(step.who);
      break;
    case 'apothcut':
      apothecaryCut();
      break;
    case 'beat':
      break;
    case 'showdown':
      showdown();
      break;
  }
}

/* ---------------- Human prompts ---------------- */

function promptHuman(step) {
  const seat = step.t === 'deploy' ? step.pendingHumans[0] : step.t === 'deploy1' ? step.seat : step.who;
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
      setPrompt('Choose which of your active stones to place.');
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
  UI.pendingStone = color;
  UI.blueOwn = null;
  switch (color) {
    case 'white':
      UI.mode = 'target-own';
      setPrompt(`White Stone (Lock) — click a card of yours${G.mode === 'teams' ? ' or your partner’s' : ''} to protect it.`);
      break;
    case 'red':
      UI.mode = 'target-own';
      setPrompt('Red Stone (Duplication) — click one of your cards to place a phantom duplicate.');
      break;
    case 'blue':
      UI.mode = 'target-blue-own';
      setPrompt(G.open
        ? 'Blue Stone (Exchange) — open table: click the first card of the trade, on any layout.'
        : 'Blue Stone (Exchange) — first click the card of YOURS you will give up.');
      break;
    case 'black':
      UI.mode = 'target-black';
      setPrompt('Black Stone (Disruption) — click a card to undo the last stone effect upon it.');
      break;
  }
  render();
  autoScrollToPrompt();
}

function humanCancelStone() {
  UI.pendingStone = null;
  UI.blueOwn = null;
  UI.mode = 'placeChoose';
  setPrompt('Choose which of your active stones to place.');
  render();
}

function humanDiscardStone() {
  const me = G.viewer;
  consumeActive(me, UI.pendingStone);
  log(`${playerName(me)} ${verb(me, 'set')} a ${STONES[UI.pendingStone].name} down without effect. It passes.`, 'you');
  announce(`${playerName(me)} ${verb(me, 'set')} a ${STONES[UI.pendingStone].name} down without effect`, UI.pendingStone, me);
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
    if (color === 'white') {
      if (!validWhiteTarget(card)) return;
    } else { // red
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
    consumeActive(me, 'blue');
    applyStone(me, 'blue', { give: UI.blueOwn, take: card });
    UI.pendingStone = null; UI.blueOwn = null;
    finishHumanStep();
  } else if (UI.mode === 'target-black') {
    const ev = undoableEventFor(card);
    if (!ev) return;
    consumeActive(me, 'black');
    applyStone(me, 'black', { event: ev, card });
    UI.pendingStone = null;
    finishHumanStep();
  }
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
  // Exhaustion (Slumlock / the Warden): a placed stone is unavailable
  // for the next G.exhaustHands hands.
  if (G.exhaustHands) G.slum[who].push({ color, until: G.handNum + G.exhaustHands });
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

function applyStone(actor, color, target) {
  SFX.play(color === 'black' ? 'undo' : 'stone');
  const ev = { id: G.events.length, color, actor, undone: false };
  switch (color) {
    case 'white':
      target.card.stones.push({ color: 'white', by: actor });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'lock')} ${describeCard(target.card)} under a White Stone. Untouchable now.`, logClass(actor));
      announce(`White Stone — ${describeCard(target.card)} is locked`, 'white', actor);
      break;
    case 'red':
      target.card.stones.push({ color: 'red', by: actor });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'drop')} a Red Stone on ${describeCard(target.card)} — a phantom duplicate shimmers over it.`, logClass(actor));
      announce(`Red Stone — a phantom rises over ${describeCard(target.card)}`, 'red', actor);
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
      const prev = target.event;
      prev.undone = true;
      ev.cards = prev.cards.slice();
      ev.undid = prev;
      if (prev.color === 'red') {
        const idx = prev.cards[0].stones.findIndex(s => s.color === 'red' && s.by === prev.actor);
        if (idx >= 0) prev.cards[0].stones.splice(idx, 1);
        log(`${playerName(actor)} ${verb(actor, 'drop')} a Black Stone — the phantom over ${describeCard(prev.cards[0])} gutters out.`, logClass(actor));
        announce('Black Stone — the phantom is snuffed out', 'black', actor);
      } else if (prev.color === 'blue') {
        // Reverse the trade. Stones travel with their cards.
        swapCards(prev.give, prev.take);
        prev.give.prov = null;
        prev.take.prov = null;
        log(`${playerName(actor)} ${verb(actor, 'drop')} a Black Stone on the trade — the swap unwinds, and every stone riding those cards travels home with them.`, logClass(actor));
        announce('Black Stone — the trade unwinds, stones and all', 'black', actor);
      } else if (prev.color === 'green') {
        const gi = prev.cards[0].stones.findIndex(s => s.color === 'green' && s.by === prev.actor);
        if (gi >= 0) prev.cards[0].stones.splice(gi, 1);
        log(`${playerName(actor)} ${verb(actor, 'drop')} a Black Stone — the poison in ${describeCard(prev.cards[0])} is drawn out, its worth restored.`, logClass(actor));
        announce('Black Stone — the poison is drawn out', 'black', actor);
      }
      break;
    }
  }
  G.events.push(ev);
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
    if (ev.undone || ev.color === 'black' || ev.color === 'white') continue;
    if (!ev.cards.includes(card)) continue;
    if (ev.cards.some(isLocked)) return null; // locked cards cannot be altered
    return ev;
  }
  return null;
}

function anyUndoable() {
  return G.players.flatMap(p => p.board).some(c => undoableEventFor(c));
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
  }
  return false;
}

/* ---------------- AI ---------------- */

function regionVal(type) { return G.region.values[type]; }
// The card's value badge. Under the Cursed Register, the voided type reads 0
// (the cursed value-stone), since it scores nothing this hand.
function cvalHtml(card) {
  const poisoned = isPoisoned(card);
  const cursed = poisoned || (G.cursedType && card.type === G.cursedType);
  const v = cursed ? 0 : regionVal(card.type);
  const tip = poisoned ? ' title="Poisoned — scores nothing this hand"' : cursed ? ' title="Cursed — voided this hand"' : '';
  return `<div class="cval val-${v}"${tip}>${v}</div>`;
}

function knownBoardFor(viewer, ofPlayer) {
  return G.players[ofPlayer].board.map(c => ({
    type: (c.known[viewer] || c.faceUp) ? c.type : null,
    hasRed: hasRed(c),
    poisoned: isPoisoned(c),
  }));
}

function estimate(ofPlayer, viewer) {
  // Estimated showdown score using only what `viewer` can see.
  // Unknown cards are given a flat expected value and unique names
  // so they never combine into imaginary Pairs.
  const values = Object.assign({}, G.region.values);
  const cards = knownBoardFor(viewer, ofPlayer).map((c, i) => {
    const type = c.type || ('_u' + i);
    if (!c.type) values[type] = 2;
    return { type, hasRed: c.hasRed, poisoned: c.poisoned };
  });
  if (!cards.length) return 0;
  // The Magistrate's worth is its two best hands, so it plays for both.
  if (isMagistrate(ofPlayer)) return twoBestHands(cards, values, variantOpts()).score;
  return bestSelection(cards, values, variantOpts()).score;
}

// My side's estimated total minus the best opposing side's, all
// through my own eyes — the AI's working sense of the table.
function sideSwing(me) {
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
  if (Math.random() < pers.bluff) return shuffle(STONE_KEYS.slice()); // a telegraph that means nothing
  const weights = {
    red: (hasPair ? 2.4 : 1.0) * pers.red,
    white: (threatened ? 2.6 : 1.3) * pers.white,
    blue: 2.2 * pers.blue,
    black: (enemiesShowedValue ? 2.0 : 1.2) * pers.black,
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
    let ball = Math.random() * pool.reduce((s, k) => s + weights[k], 0);
    for (let i = 0; i < pool.length; i++) {
      ball -= weights[pool[i]];
      if (ball <= 0) { out.push(pool.splice(i, 1)[0]); break; }
    }
    if (ball > 0) out.push(pool.pop()); // float-edge fallback
  }
  return out;
}

function aiChooseDeploy(who, count, faceUp) {
  const p = G.players[who];
  const fp = footprintOf(who);
  if (!p.aiPlan) {
    const counts = {};
    for (const c of p.hand) counts[c.type] = (counts[c.type] || 0) + 1;
    const scoreCard = c => c.type === G.cursedType ? 0
      : regionVal(c.type) + (counts[c.type] >= 2 ? 2.5 : 0);
    const sorted = p.hand.slice().sort((a, b) => scoreCard(b) - scoreCard(a));
    const keep = sorted.slice(0, fp);
    // A less practiced player keeps the wrong card now and then.
    if (sorted.length > fp && fumbles(who)) {
      keep[Math.floor(Math.random() * keep.length)] =
        sorted[fp + Math.floor(Math.random() * (sorted.length - fp))];
    }
    const threatened = opponentsOf(who).some(o => G.players[o].declared.includes('blue'));
    const exposable = keep.slice().sort((a, b) => {
      const risk = c => (counts[c.type] >= 2 ? 5 : 0) + (threatened ? regionVal(c.type) : -regionVal(c.type));
      return risk(a) - risk(b);
    });
    // queue: face-up cards lead so they fill the early (revealed) commits.
    p.aiPlan = { faceUp: exposable.slice(0, 2), hidden: keep.filter(c => !exposable.slice(0, 2).includes(c)), queue: keep.slice() };
  }
  // The Magistrate fields everything face-up, in ranked order.
  if (isMagistrate(who)) return p.aiPlan.queue.splice(0, count);
  if (faceUp) return p.aiPlan.faceUp;
  return p.aiPlan.hidden.splice(0, count);
}

function deployCards(who, cards, faceUp) {
  const p = G.players[who];
  for (const c of cards) {
    p.hand.splice(p.hand.indexOf(c), 1);
    c.zone = 'board';
    c.faceUp = faceUp;
    if (faceUp) c.known = c.known.map(() => true);
    p.board.push(c);
  }
}

function aiThin(who) {
  const p = G.players[who];
  const scores = p.declared.map(color => aiStoneValue(who, color));
  let worst = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[worst]) worst = i;
  if (fumbles(who)) worst = Math.floor(Math.random() * p.declared.length);
  const color = p.declared[worst];
  p.removed = color;
  p.declared.splice(worst, 1);
  p.active = p.declared.slice();
  log(`${playerName(who)} abandons a ${STONES[color].name}. Two stones stay live.`, 'ai');
  announce(`${playerName(who)} abandons a ${STONES[color].name}`, color, who);
}

function aiStoneValue(who, color) {
  return personaOf(who)[color] * aiStoneBaseValue(who, color);
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
      const cands = [who, ...alliesOf(who)].flatMap(i => G.players[i].board).filter(c => !isLocked(c));
      const top = cands.length ? Math.max(...cands.map(c => regionVal(c.type))) : 0;
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
        swapCards(give, take);
        const swing = sideSwing(who) - baseSwing;
        swapCards(give, take);
        const discount = take.known[who] || take.faceUp ? 0 : personaOf(who).risk;
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
    const delta = Math.max(swingIfUndone(ev, who), denialValue(ev, who));
    if (!best || delta > best.delta) best = { event: ev, delta };
  }
  return best;
}

function aiPlace(who) {
  const p = G.players[who];
  const options = [];
  for (const color of new Set(p.active)) {
    switch (color) {
      case 'white': {
        const candidates = [who, ...alliesOf(who)].flatMap(i => G.players[i].board).filter(c => !isLocked(c));
        if (!candidates.length) { options.push({ color, value: -1, fizzle: true }); break; }
        const threatened = opponentsOf(who).some(o => G.players[o].active.includes('blue'));
        const target = candidates.slice().sort((a, b) =>
          (regionVal(b.type) + (hasRed(b) ? 3 : 0)) - (regionVal(a.type) + (hasRed(a) ? 3 : 0)))[0];
        const value = (regionVal(target.type) + (hasRed(target) ? 3 : 0)) * (threatened ? 1 : 0.35);
        options.push({ color, value, target });
        break;
      }
      case 'red': {
        const best = aiBestRedTarget(who);
        if (best) options.push({ color, value: best.delta + 0.3, target: best.card });
        else options.push({ color, value: -1, fizzle: true });
        break;
      }
      case 'blue': {
        const best = aiBestBlueTarget(who);
        if (best && best.delta > 0) options.push({ color, value: best.delta, swap: best });
        else options.push({ color, value: 0, fizzle: true });
        break;
      }
      case 'black': {
        const best = aiBestBlackTarget(who);
        if (best && best.delta > 1) options.push({ color, value: best.delta, undo: best.event });
        else options.push({ color, value: 0, fizzle: true });
        break;
      }
    }
  }
  for (const o of options) o.value *= personaOf(who)[o.color]; // habits color the choice
  options.sort((a, b) => b.value - a.value);
  const chosen = fumbles(who) ? options[Math.floor(Math.random() * options.length)] : options[0];
  consumeActive(who, chosen.color);
  if (chosen.fizzle) {
    log(`${playerName(who)} sets a ${STONES[chosen.color].name} down without effect. It passes.`, 'ai');
    announce(`${playerName(who)} sets a ${STONES[chosen.color].name} down without effect`, chosen.color, who);
    return;
  }
  switch (chosen.color) {
    case 'white':
    case 'red':
      applyStone(who, chosen.color, { card: chosen.target });
      break;
    case 'blue':
      applyStone(who, 'blue', { give: chosen.swap.give, take: chosen.swap.take });
      break;
    case 'black':
      applyStone(who, 'black', { event: chosen.undo });
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

/* ---------------- Showdown ---------------- */

function entities() {
  if (G.mode === 'raid') {
    return [
      { name: G.humans.length > 1 ? `${playerName(0)} & ${playerName(2)}` : 'Your raid party', members: [0, 2] },
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
  for (const p of G.players) {
    for (const c of p.board) {
      c.faceUp = true;
      c.known = c.known.map(() => true);
    }
  }
  log('The Showdown — every veiled card on the table is flipped face-up.', 'sys');
  announce('The Showdown — every veiled card is flipped');
  SFX.play('sting');

  const sel = G.players.map(p => bestSelection(
    p.board.map(c => ({ type: c.type, hasRed: hasRed(c), poisoned: isPoisoned(c) })),
    G.region.values,
    variantOpts()
  ));

  if (G.mode === 'raid') { raidShowdown(sel); return; }

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
  G.ledger = Math.max(-G.target, Math.min(G.target, G.ledger + diff));

  let matchWinner = null;
  if (G.ledger >= G.target) { matchWinner = 'party'; markCampaignWin(G.raidBoss, G.raidDiff); }
  else if (G.ledger <= -G.target) matchWinner = 'magistrate';

  const bn = playerName(1);
  if (diff > 0) log(`The party fields ${teamScore} to ${bn}'s ${boss.score} — you press the advantage by ${diff}.`, 'sys');
  else if (diff < 0) log(`${bn} fields ${boss.score} to the party's ${teamScore}. It gains ${-diff} ground.`, 'sys');
  else log(`Dead level at ${teamScore}. ${bn} holds — the marker doesn't move.`, 'sys');

  if (matchWinner) G.over = true;
  G.lastShowdown = { raid: true, sel, boss, teamScore, diff, matchWinner, hand: G.handNum };
  showShowdownModal(G.lastShowdown, false);
}

function nextHand() {
  closeModal('showdownModal');
  if (G.over) { showVictory(); return; }
  G.dealer = (G.dealer + 1) % G.nPlayers; // the Rule of Rotation
  startHand();
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
    const bossStrip = isMagistrate(i)
      ? `<div class="bosstglabel">Telegraphed stones — spent as it acts</div><div id="bosstg" class="bosstg"></div>`
      : '';
    seat.innerHTML = `<div class="seathead">${playerName(i)}${isMagistrate(i) ? ' — the raid boss' : ''}</div>${bossStrip}<div id="board-${i}" class="board"></div>`;
    if (isOpponent(0, i)) oppSeats.appendChild(seat);
    else youSeats.appendChild(seat);
  }

  // Score widget: track for two-sided modes, purse list for FFA.
  $('ledgerWrap').style.display = G.mode === 'ffa' ? 'none' : '';
  $('scoreList').style.display = G.mode === 'ffa' ? '' : 'none';
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
}

/* ============================================================
   TITLE SCREEN, QUIT, TUTORIAL
   ============================================================ */

let INGAME = false;

function hideTitle() { if (typeof document !== 'undefined') $('titleScreen').classList.add('hidden'); }

function showTitle() {
  if (typeof document === 'undefined') return;
  clearTimeout(runTimer);
  INGAME = false;
  TUT.active = false;
  coachHide();
  for (const id of ['quitModal', 'setupModal', 'showdownModal', 'victoryModal', 'rulesModal', 'passModal', 'academyModal']) closeModal(id);
  if (typeof document !== 'undefined') $('showdownResume').style.display = 'none';
  G = null;
  setVenueBackdrop(null);
  $('titleScreen').classList.remove('hidden');
}

// Set (or clear) the per-venue in-game backdrop. The dark overlay is baked in so
// the table and panels stay readable over the art.
function setVenueBackdrop(key) {
  if (typeof document === 'undefined') return;
  const el = $('venuebg');
  if (!el) return;
  el.style.backgroundImage = key
    ? `linear-gradient(rgba(8,6,4,0.84), rgba(10,7,4,0.92)), url('assets/bg/${key}.jpg')`
    : 'none';
}

function requestQuitToTitle() {
  if (INGAME) $('quitModal').classList.add('open');
  else showTitle();
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
      { sel: '.game', text: '<b>White — Lock.</b> It shields a card: once locked, it can’t be stolen, undone, or poisoned for the rest of the hand.' },
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
      { sel: '.game', text: '<b>Information is leverage.</b> A card the Stranger can’t see, he can’t steal, lock away from you, or poison. So what you <b>hide</b> matters as much as what you play.' },
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
  academyMenu('The Academy', CATEGORIES, { label: '‹ Title', fn: () => { closeModal('academyModal'); showTitle(); } });
}

// The Regulars: the bot cast. A 3-up grid of faces; click one to zoom into a
// focused profile with the full bio.
function regularLeans(p) {
  return STONE_KEYS.slice().sort((a, b) => p[b] - p[a]).slice(0, 2).map(c => STONES[c].power).join(' · ');
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
    `<div class="castleans">Leans: <b>${regularLeans(p)}</b></div>`;
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
    el.onclick = l.opens ? () => openMenu(l.opens) : () => { closeModal('academyModal'); startLesson(l.id); };
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
  else if (which === 'stones') openStonesMenu();
  else openAcademy();
}
function openTutorials() {
  academyMenu('Tutorials', LESSONS, { label: '‹ The Academy', fn: openAcademy });
}
function openStrategy() {
  academyMenu('Strategy & Puzzles', STRATEGY, { label: '‹ The Academy', fn: openAcademy });
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
      else { TUT.phase = 'live'; coachHide(); newGame(TUT.lesson.cfg); }
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
  $('handNum').textContent = `Hand ${G.handNum}`;
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
  rows.push(['Race to', String(G.target)]);
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
    container.appendChild(slot);
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
  for (const card of G.players[G.viewer].hand) {
    const el = document.createElement('div');
    el.dataset.cardId = card.id;
    el.className = 'card hand-card' + (UI.selected.includes(card) ? ' selected' : '');
    el.innerHTML = `
      <div class="cicon icon-${card.type}"></div>
      <div class="cname">${card.type}</div>
      ${cvalHtml(card)}`;
    if (UI.mode === 'pickCards') {
      el.classList.add('targetable');
      el.onclick = () => humanToggleCard(card);
    }
    wrap.appendChild(el);
  }
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
    label.textContent = 'Place a stone';
    items = p.active.map(color => ({ color, onClick: () => humanChooseStone(color) }));
  }
  const visible = !!items;
  tray.style.display = visible ? '' : 'none';
  $('handArea').classList.toggle('min', visible);
  $('handArea').classList.toggle('focus', UI.mode === 'pickCards');
  if (!visible) { stonesEl.innerHTML = ''; return; } // clear stale clickable stones
  stonesEl.innerHTML = '';
  const trayStone = (color, onClick) => {
    const s = document.createElement('div');
    s.className = `stone big ${color} targetable`;
    s.title = `${STONES[color].name} — ${STONES[color].power}: ${STONES[color].desc}`;
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
    for (const it of items) stonesEl.appendChild(trayStone(it.color, it.onClick));
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
  if (['target-own', 'target-blue-own', 'target-blue-opp', 'target-black'].includes(UI.mode)) {
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Back';
    cancel.onclick = humanCancelStone;
    bar.appendChild(cancel);
    const noTargets = !stoneHasValidTarget(UI.pendingStone);
    if (UI.pendingStone === 'black' || UI.pendingStone === 'blue' || noTargets) {
      const skip = document.createElement('button');
      skip.className = 'btn ghost';
      skip.textContent = 'Set it down without effect';
      skip.onclick = humanDiscardStone;
      bar.appendChild(skip);
    }
    if (noTargets) {
      setPrompt(`${STONES[UI.pendingStone].name} — no valid target remains. Set it down without effect.`);
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
        <div class="cval ${(p.phantom||p.cursed)?'val-0':'val-'+regionVal(p.type)}">${p.phantom ? '✧' : p.cursed ? '0' : regionVal(p.type)}</div>
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
  $('nextHandBtn').textContent = review ? 'Back to the table'
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
  $('nextHandBtn').textContent = review ? 'Back to the table'
    : matchWinner ? 'See the result' : 'Next hand';
  $('nextHandBtn').style.display = (TUT.active && !review) ? 'none' : '';
  $('showdownResume').style.display = 'none';
  $('showdownModal').classList.add('open');
}

function showVictory() {
  if (typeof document === 'undefined') return;
  const m = $('victoryModal');
  if (G.mode === 'raid') {
    const won = G.ledger >= G.target;
    SFX.play(won ? 'win' : 'lose');
    $('victoryTitle').textContent = won ? `${playerName(1)} is broken` : `${playerName(1)} prevails`;
    $('victoryText').textContent = won
      ? `Your party drove the marker the full ${G.target} after ${G.handNum} hands. The high seat is empty — for now.`
      : `${playerName(1)} held the table after ${G.handNum} hands, grinding the marker ${G.target} the other way. It was never going to be fair.`;
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
  SETUP = { venue: 'tavern', mode: 'duel', players: 'solo', company: 'usual', targeting: 'standard', deal: 'small', target: 20, names: ['', '', '', ''], picks: [], randomTeams: false, _open: null };
  renderSetup();
  $('setupModal').classList.add('open');
}

// A table shape has a fixed seat count; the chosen "players" option says
// which seats are real people (the rest are filled by bots).
function seatCountOf(shape) { return shape === 'duel' ? 2 : 4; }

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
  $('setupModal').querySelector('h2').textContent = 'Set the Table';
  const body = $('setupBody');
  body.innerHTML = '';
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
        const el = document.createElement('div');
        el.className = 'bigopt' + (SETUP[section.key] === opt.v ? ' selected' : '');
        el.dataset.v = opt.v;
        el.innerHTML = `<h3>${opt.label}</h3><div class="bigoptdesc">${opt.desc}</div>`;
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

      // The seat-by-seat picker, right under the company choice.
      if (section.key === 'company' && SETUP.company === 'choose' && K > 0) {
        const row = document.createElement('div');
        row.className = 'namerow';
        const lab = document.createElement('span');
        lab.className = 'arealabel';
        lab.textContent = `The lineup (${SETUP.picks.length}/${K}):`;
        row.appendChild(lab);
        for (const name of BOT_POOL) {
          const chip = document.createElement('button');
          const ord = SETUP.picks.indexOf(name);
          chip.className = 'botchip' + (ord >= 0 ? ' selected' : '');
          chip.title = PERSONALITIES[name].flavor;
          const face = portraitFor(name);
          chip.innerHTML = (face ? `<span class="chipface" style="background-image:url('${face}')"></span>` : '') +
            (ord >= 0 ? `<span class="ordnum">${ord + 1}</span>` : '') + name;
          chip.onclick = () => {
            const i = SETUP.picks.indexOf(name);
            if (i >= 0) SETUP.picks.splice(i, 1);
            else if (SETUP.picks.length < K) SETUP.picks.push(name);
            renderSetup();
          };
          row.appendChild(chip);
        }
        const roles = document.createElement('div');
        roles.className = 'rolesline';
        roles.textContent = 'Seats in order: ' + seatRoles(SETUP.mode, humans).map((r, i) => `${i + 1} — ${r}`).join(' · ');
        row.appendChild(roles);
        accbody.appendChild(row);
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
  back.textContent = '‹ Title';
  back.onclick = () => { closeModal('setupModal'); showTitle(); };
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
  RAIDSET = { step: 'boss', boss: null, ally: 'bot', diff: 'standard', target: 16, targeting: 'standard', names: ['', ''] };
  renderRaidSetup();
  $('setupModal').classList.add('open');
}

// Step 1: choose the boss. Each gets a lore card; picking one advances.
const RAID_BOSSES = [
  { v: 'magistrate', name: 'The Magistrate', lore: 'A wide, methodical board fielded face-up. It selects from a deep pouch, scores its two best hands, and never bluffs — powerful, and fair only in that. Difficulty sets how many stones it spends.' },
  { v: 'warden', name: 'The Warden', lore: 'Keeps one of every stone within reach and spends without mercy — snuffing, stealing, locking. Every stone it plays is exhausted for a hand, and so is yours: ration your disruption, or be ground down. Viciously tactical.' },
  { v: 'apothecary', name: 'The Apothecary', lore: 'A healer who deals in poisons. It fields a wide board and spends fewer ordinary stones than the others — because it always keeps a Green Stone for the last word, cutting the single best card you left unlocked to nothing. You cannot answer the scalpel after it falls; lock what matters most before it does.' },
];

/* ---- Campaign progression ----
   Beating a boss at a difficulty unlocks the next difficulty of that boss AND
   that difficulty of the next boss — a diagonal climb from Magistrate · Easy.
   During alpha, an unlock-all bypass (default ON) keeps everything open. */
const RAID_DIFF_ORDER = ['easy', 'standard', 'hard'];
const ls = {
  get(k, d) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch (e) { return d; } },
  set(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (e) {} },
};
function campaignBeaten() { try { return new Set(JSON.parse(ls.get('stonelock-campaign') || '[]')); } catch (e) { return new Set(); } }
function markCampaignWin(boss, diff) { const s = campaignBeaten(); s.add(`${boss}-${diff}`); ls.set('stonelock-campaign', JSON.stringify([...s])); }
function alphaUnlock() { const v = ls.get('stonelock-alpha'); return v === null ? true : v === '1'; } // default ON in alpha
function setAlphaUnlock(on) { ls.set('stonelock-alpha', on ? '1' : '0'); }
function raidUnlocked(boss, diff) {
  if (alphaUnlock()) return true;
  const bosses = RAID_BOSSES.map(b => b.v);
  const bi = bosses.indexOf(boss), di = RAID_DIFF_ORDER.indexOf(diff);
  if (bi === 0 && di === 0) return true; // the entry point
  const beaten = campaignBeaten();
  if (di > 0 && beaten.has(`${boss}-${RAID_DIFF_ORDER[di - 1]}`)) return true;   // next difficulty of this boss
  if (bi > 0 && beaten.has(`${bosses[bi - 1]}-${diff}`)) return true;             // this difficulty of the next boss
  return false;
}
function raidBossUnlocked(boss) { return RAID_DIFF_ORDER.some(d => raidUnlocked(boss, d)); }

function renderRaidSetup() {
  const body = $('setupBody');
  const btns = $('setupBtns');
  body.innerHTML = '';
  btns.innerHTML = '';

  if (RAIDSET.step === 'boss') {
    $('setupModal').querySelector('h2').textContent = 'Choose Your Boss';
    body.innerHTML = '<p class="modalsub small">Three sit the high seat. Pick the one you mean to break.</p>';
    const grid = document.createElement('div');
    grid.className = 'optgrid';
    const beaten = campaignBeaten();
    for (const b of RAID_BOSSES) {
      const unlocked = raidBossUnlocked(b.v);
      const wins = RAID_DIFF_ORDER.filter(d => beaten.has(`${b.v}-${d}`));
      const el = document.createElement('div');
      el.className = 'bigopt bosscard' + (unlocked ? '' : ' locked');
      const tag = unlocked ? (wins.length ? ` <span class="campwin">${wins.length === RAID_DIFF_ORDER.length ? 'mastered' : 'broken ×' + wins.length}</span>` : '') : ' 🔒';
      const portrait = portraitFor(b.name);
      el.innerHTML = `${portrait ? `<div class="bossportrait" style="background-image:url('${portrait}')"></div>` : ''}<div class="bosstext"><h3>${b.name}${tag}</h3><div class="bigoptdesc">${unlocked ? b.lore : 'Locked — break the boss before it in the campaign to earn your seat at this table.'}</div></div>`;
      if (unlocked) el.onclick = () => { RAIDSET.boss = b.v; RAIDSET.step = 'options'; renderRaidSetup(); };
      grid.appendChild(el);
    }
    body.appendChild(grid);
    // Alpha bypass: ignore campaign locks while testing (default ON in alpha).
    const arow = document.createElement('div');
    arow.className = 'namerow';
    const on = alphaUnlock();
    const tog = document.createElement('button');
    tog.className = 'botchip' + (on ? ' selected' : '');
    tog.textContent = (on ? '✓ ' : '') + 'Alpha — all bosses unlocked';
    tog.title = 'Alpha testing: ignore campaign locks. Turn this off to climb the ladder.';
    tog.onclick = () => { setAlphaUnlock(!on); renderRaidSetup(); };
    arow.appendChild(tog);
    body.appendChild(arow);
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
  const extra = isWarden ? ' <b>The Warden</b> spends ruthlessly, and every stone spent is <b>exhausted for a hand</b> — for both sides.'
    : isApothecary ? ' <b>The Apothecary</b> always keeps a <b>Green Stone</b> for its last word — poisoning the best card you left unlocked to nothing. You cannot answer it after it falls, so a <b>White lock</b> set in time is your only shield.'
    : '';
  body.innerHTML = `<p class="modalsub small">A raid boss fields <b>${RAID_BOSS_CARDS} cards, all face-up</b>, telegraphs from a deep <b>3-of-each pouch</b>, answers every move and keeps the last word, and scores its <b>two best non-overlapping hands</b>. You and an ally field five cards and three stones each; your two scores combine. Drive the marker the full distance to break it — the boss holds any tie.${extra}</p>`;

  const section = (title, key, opts, state) => {
    const h = document.createElement('div');
    h.className = 'steptitle'; h.textContent = title; body.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'optgrid';
    for (const o of opts) {
      const st = state ? state(o) : {};
      const el = document.createElement('div');
      el.className = 'bigopt' + (RAIDSET[key] === o.v ? ' selected' : '') + (st.locked ? ' locked' : '');
      const tag = st.locked ? ' 🔒' : st.beaten ? ' <span class="campwin">✓</span>' : '';
      el.innerHTML = `<h3>${o.label}${tag}</h3><div class="bigoptdesc">${st.locked ? (st.hint || 'Locked.') : o.desc}</div>`;
      if (!st.locked) el.onclick = () => { RAIDSET[key] = o.v; renderRaidSetup(); };
      grid.appendChild(el);
    }
    body.appendChild(grid);
  };
  const diffState = o => ({
    locked: !raidUnlocked(RAIDSET.boss, o.v),
    beaten: campaignBeaten().has(`${RAIDSET.boss}-${o.v}`),
    hint: 'Locked — win a lower difficulty here, or this difficulty against the previous boss, to unlock.',
  });

  section('The party', 'ally', [
    { v: 'bot', label: 'You + an Ally bot', desc: 'The Old Hand fights at your side, AI-controlled.' },
    { v: 'hotseat', label: 'Two players — co-op', desc: 'Both party seats are human; the device passes between you.' },
  ]);

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
    body.appendChild(row);
  }

  section('Difficulty', 'diff', isApothecary ? [
    { v: 'easy', label: 'Easy', desc: 'A light hand of stones beneath the scalpel — often just one or two. A coordinated, white-aware party wins most fights.' },
    { v: 'standard', label: 'Standard', desc: 'Two stones and the guaranteed cut. A true coin-flip against good play.' },
    { v: 'hard', label: 'Hardcore', desc: 'Three stones and the last-word cut — it opens, answers, and closes with the scalpel. Only sharp, coordinated play breaks it.' },
  ] : [
    { v: 'easy', label: 'Easy — 5 stones', desc: 'The boss spends five stones. A coordinated party wins most fights.' },
    { v: 'standard', label: 'Standard — 6 stones', desc: 'Six stones, answering every move. A true coin-flip against good play.' },
    { v: 'hard', label: 'Hardcore — 7 stones', desc: 'Seven stones — it opens, answers, and closes. Only sharp, coordinated play breaks it.' },
  ], diffState);

  section('How far to break it', 'target', [
    { v: 10, label: 'Skirmish — to 10', desc: 'A quick clash. High variance; one good hand swings it.' },
    { v: 16, label: 'Siege — to 16', desc: 'The standard raid. Coordination starts to tell.' },
    { v: 24, label: 'Campaign — to 24', desc: 'A long grind against the high seat.' },
  ]);

  section('Targeting', 'targeting', [
    { v: 'standard', label: 'Simplified', desc: 'Stones bind as written: Red and Blue work your own layout; White may shelter an ally. The balanced co-op fight.' },
    { v: 'open', label: 'Advanced — open table', desc: 'Any stone reaches any layout: lock or build an ally’s card, trade across party seats. Deeper coordination — and an easier raid.' },
  ]);

  const back = document.createElement('button');
  back.className = 'btn'; back.textContent = '‹ Boss';
  back.onclick = () => { RAIDSET.step = 'boss'; renderRaidSetup(); };
  btns.appendChild(back);
  const begin = document.createElement('button');
  begin.id = 'startBtn'; begin.className = 'btn primary big'; begin.textContent = `Face ${raidBossName(RAIDSET.boss)}`;
  begin.onclick = () => {
    closeModal('setupModal');
    logEl.innerHTML = '';
    newGame({ mode: 'raid', raidBoss: RAIDSET.boss, raidAlly: RAIDSET.ally, raidDiff: RAIDSET.diff, target: RAIDSET.target, targeting: RAIDSET.targeting, names: RAIDSET.names.map(s => s.trim()) });
  };
  btns.appendChild(begin);
}

function boot() {
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
  $('rulesBtn').onclick = () => $('rulesModal').classList.add('open');
  $('passBtn').onclick = passConfirm;
  $('muteBtn').textContent = SFX.isMuted() ? '🔇' : '🔊';
  // The Menu dropdown: new match, sound, fullscreen, and quit-to-title all
  // live here so the sidebar stays uncluttered.
  const menuPopSet = open => { if (open) renderTableSummary(); $('menuPop').style.display = open ? '' : 'none'; $('menuBtn').classList.toggle('active', open); };
  $('menuBtn').onclick = e => { e.stopPropagation(); menuPopSet($('menuPop').style.display === 'none'); };
  document.addEventListener('click', e => {
    if ($('menuPop').style.display !== 'none' && !e.target.closest('.menuwrap')) menuPopSet(false);
  });
  const setSoundLabel = () => { $('muteBtn').textContent = SFX.isMuted() ? 'Sound: off' : 'Sound: on'; };
  setSoundLabel();
  $('muteBtn').onclick = () => { SFX.toggle(); setSoundLabel(); }; // stay open to show the new state
  $('rulesClose').onclick = () => closeModal('rulesModal');
  $('newGameBtn').onclick = () => { menuPopSet(false); (G && G.mode === 'raid' ? openRaidSetup() : openSetup()); };
  $('fsBtn').onclick = () => {
    menuPopSet(false);
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  $('victoryNew').onclick = () => { const raid = G && G.mode === 'raid'; closeModal('victoryModal'); raid ? openRaidSetup() : openSetup(); };
  $('titleBtn').onclick = () => { menuPopSet(false); requestQuitToTitle(); };
  $('quitYes').onclick = () => { closeModal('quitModal'); showTitle(); };
  $('quitNo').onclick = () => closeModal('quitModal');
  $('titleStandard').onclick = () => { hideTitle(); openSetup(); };
  $('titleRaid').onclick = () => { hideTitle(); openRaidSetup(); };
  $('titleTutorial').onclick = openAcademy;
  // academyBack's handler is set per-view (Academy vs Stones submenu) in academyMenu().
  $('titleRules').onclick = () => $('rulesModal').classList.add('open');
  $('titleRegulars').onclick = openRegulars;
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
    bestSelection, REGIONS, TYPES, STONES,
    newGame, nextHand,
    humanDeclare, humanToggleCard, humanConfirmDeploy, humanThin,
    humanChooseStone, humanTargetCard, humanDiscardStone, passConfirm,
    twoBestHands, undoableEventFor, isLocked, isOpponent,
    _state: () => G, _ui: () => UI, _run: () => run(),
  };
}
