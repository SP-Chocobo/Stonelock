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
};

const STONES = {
  red:   { name: 'Red Stone',   power: 'Duplication', desc: 'Places a phantom duplicate onto one of your cards. The phantom can stand as the second or third copy for a Pair or Triad bonus, but scores no point value of its own.' },
  white: { name: 'White Stone', power: 'Lock',        desc: 'Protects a card. A locked card cannot be altered, stolen, or neutralized for the rest of the hand.' },
  blue:  { name: 'Blue Stone',  power: 'Exchange',    desc: 'Forcibly swaps one of your cards with an unprotected card in an opponent’s layout. Visibility states stay as they were.' },
  black: { name: 'Black Stone', power: 'Disruption',  desc: 'Undoes the last stone effect upon a card. Played on your turn like any other stone; it cannot itself be undone.' },
};

const STONE_KEYS = ['red', 'white', 'blue', 'black'];

const AI_ROSTER = ['The Stranger', 'The Ferryman', 'The Clerk'];
const PARTNER_NAME = 'The Old Hand';

// Each regular at this table has habits — and at experienced tables,
// players learn to recognize them. Multipliers shape stone weights;
// `bluff` is the chance a telegraph means nothing; `risk` is how much
// an unknown face-down card discourages a steal.
const PERSONALITIES = {
  'The Stranger': { red: 1.0, white: 1.0, blue: 1.2, black: 1.2, bluff: 0.30, risk: 1, skill: 1.0, flavor: 'Reads the table, and lies to it. His telegraphs mean less than they seem.' },
  'The Ferryman': { red: 0.8, white: 0.7, blue: 1.9, black: 0.9, bluff: 0.10, risk: 0, skill: 1.0, flavor: 'Anything on the river can be taken. Hide what you love.' },
  'The Clerk':    { red: 1.6, white: 1.6, blue: 0.6, black: 1.0, bluff: 0.05, risk: 2, skill: 1.0, flavor: 'Builds his ledger and locks it twice. Rarely reaches across the table.' },
  'The Old Hand': { red: 1.0, white: 1.5, blue: 0.9, black: 1.4, bluff: 0.10, risk: 1, skill: 1.0, flavor: 'Keeps his partner alive, and unmakes what threatens the alliance.' },
  'The Tinker':   { red: 1.7, white: 1.2, blue: 0.7, black: 0.8, bluff: 0.12, risk: 1, skill: 0.93, flavor: 'In love with phantoms — reds everything, defends out of habit, and sometimes plays the wrong stone entirely.' },
  'The Deckhand': { red: 0.9, white: 0.8, blue: 1.5, black: 0.7, bluff: 0.25, risk: 0, skill: 0.90, flavor: 'Plays fast and peeks at nothing. Bold trades, sloppy endings.' },
};
const DEFAULT_PERSONA = { red: 1, white: 1, blue: 1, black: 1, bluff: 0.1, risk: 1, skill: 1, flavor: '' };
function personaOf(who) { return PERSONALITIES[G.names[who]] || DEFAULT_PERSONA; }
// Sloppiness: below-skill players occasionally make the wrong play.
function fumbles(who) { return Math.random() > personaOf(who).skill; }

// The pool a table can draw from (the Old Hand stays the default
// partner unless seated deliberately).
const BOT_POOL = ['The Stranger', 'The Ferryman', 'The Clerk', 'The Tinker', 'The Deckhand'];

// Which seats are AI-held, in seat order, per mode.
function aiSeatsFor(mode) {
  switch (mode) {
    case 'duel': return [1];
    case 'ffa': return [1, 2, 3];
    case 'teams': return [1, 2, 3];
    case 'hs-team': return [1, 3];
    case 'hs-rivals': return [2, 3];
    default: return []; // hotseat
  }
}

const ICONS = {
  Crest: '<svg viewBox="0 0 40 40"><path d="M20 4 L33 9 V20 C33 29 27 34 20 37 C13 34 7 29 7 20 V9 Z" fill="#8a6d3b" stroke="#4d3a1e" stroke-width="2"/><path d="M20 10 L27 13 V20 C27 25 24 28.5 20 30.5 C16 28.5 13 25 13 20 V13 Z" fill="#e8d9b5"/></svg>',
  Coin:  '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#d9a83d" stroke="#7a5a14" stroke-width="2"/><circle cx="20" cy="20" r="8.5" fill="none" stroke="#7a5a14" stroke-width="1.6"/><path d="M20 14 v12 M16 17 h8 M16 23 h8" stroke="#7a5a14" stroke-width="1.6"/></svg>',
  Bread: '<svg viewBox="0 0 40 40"><path d="M7 24 C7 15 14 11 20 11 C26 11 33 15 33 24 C33 28 29 30 20 30 C11 30 7 28 7 24 Z" fill="#c89556" stroke="#71501f" stroke-width="2"/><path d="M14 16 L17 21 M20 14.5 L20 20.5 M26 16 L23 21" stroke="#71501f" stroke-width="1.8" stroke-linecap="round"/></svg>',
  Quill: '<svg viewBox="0 0 40 40"><path d="M30 7 C22 9 14 16 11.5 26 L10 31 L15 29.5 C25 27 31 18 33 10 Z" fill="#e9e2cf" stroke="#5c5440" stroke-width="2"/><path d="M12 29 C18 22 24 16 29 11" stroke="#5c5440" stroke-width="1.5" fill="none"/></svg>',
  Sword: '<svg viewBox="0 0 40 40"><path d="M23 5 L33 7 L17.5 22.5 L14 19 Z" fill="#cfd4d8" stroke="#54585c" stroke-width="2"/><path d="M11 22 L18 29 M9.5 28.5 L12.5 25.5 M14.5 30.5 L11.5 33.5" stroke="#6b4e26" stroke-width="3" stroke-linecap="round"/></svg>',
  Chain: '<svg viewBox="0 0 40 40"><g fill="none" stroke="#6f7378" stroke-width="3"><ellipse cx="13" cy="13" rx="5.5" ry="4" transform="rotate(45 13 13)"/><ellipse cx="20" cy="20" rx="5.5" ry="4" transform="rotate(-45 20 20)"/><ellipse cx="27" cy="27" rx="5.5" ry="4" transform="rotate(45 27 27)"/></g></svg>',
  Ferry: '<svg viewBox="0 0 40 40"><path d="M8 24 H32 L28 31 H12 Z" fill="#8a6d3b" stroke="#4d3a1e" stroke-width="2"/><path d="M20 8 V23 M20 9 C26 10 27 15 26 18 L20 17" fill="#d8e4ea" stroke="#54585c" stroke-width="1.8"/><path d="M5 33 Q10 30.5 15 33 T25 33 T35 33" fill="none" stroke="#5b86a3" stroke-width="2" stroke-linecap="round"/></svg>',
  Road:  '<svg viewBox="0 0 40 40"><path d="M14 36 C10 26 24 22 19 13 C16.5 8.5 19 5 22 4" fill="none" stroke="#9b8e76" stroke-width="6" stroke-linecap="round"/><path d="M14 36 C10 26 24 22 19 13 C16.5 8.5 19 5 22 4" fill="none" stroke="#e8d9b5" stroke-width="1.6" stroke-dasharray="3 4" stroke-linecap="round"/></svg>',
};

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
        const cursed = !!opts.cursed && t === opts.cursed; // scores nothing, builds nothing
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
  const n = (cfg.mode === 'duel' || cfg.mode === 'hotseat') ? 2 : 4;
  const venue = VENUES[cfg.venue || 'tavern'];
  G = {
    mode: cfg.mode,                 // 'duel' | 'ffa' | 'teams'
    deal: cfg.deal,                 // 'small' | 'house'
    target: cfg.target,
    venue,
    variant: venue.variant,         // null | 'riverlock' | 'cursed' | 'slumlock'
    open: cfg.targeting === 'open', // advanced: any stone, any layout
    cursedType: null,
    region: REGIONS[cfg.region || venue.region],
    nPlayers: n,
    names: buildNames(cfg.mode, cfg.names || [], cfg.companyNames || null),
    humans: humansFor(cfg.mode),
    viewer: 0,
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
  const fmt = G.mode === 'duel' ? 'a quiet duel' : G.mode === 'ffa' ? 'a four-seat free-for-all' : 'paired alliances, two against two';
  const dl = G.deal === 'house' ? 'House deep-draft deal, nine cards down' : 'small-game deal, five cards down';
  if (cfg.drewLots) {
    log(`Lots are drawn for the seats: ${aiSeatsFor(cfg.mode).map(s => G.names[s]).join(', ')} sit down at the table.`, 'sys');
  }
  const variantNote = {
    riverlock: ' Riverlock is declared: no Road or Ferry in your final three, and the hand is docked 2.',
    cursed: ' The Cursed Register is declared: each hand, one card type is voided entirely.',
    slumlock: ' Slumlock is declared: a stone placed this hand is exhausted for the two that follow.',
  }[G.variant] || '';
  log(`A table is set at ${G.venue.label} — ${fmt}, ${dl}, under ${G.region.name}.${variantNote} ${G.mode === 'ffa'
    ? `Each showdown, every seat banks its margin over the lowest hand; first to ${G.target} takes the match.`
    : `First to push the Pivot Marker ${G.target} onto the other side takes the match.`}`, 'sys');
  startHand();
}

function buildNames(mode, entered, company) {
  const n1 = entered[0] || 'Player One';
  const n2 = entered[1] || 'Player Two';
  let base;
  if (mode === 'teams') base = ['You', AI_ROSTER[0], PARTNER_NAME, AI_ROSTER[1]];
  else if (mode === 'ffa') base = ['You', ...AI_ROSTER];
  else if (mode === 'hotseat') base = [n1, n2];
  // Seats alternate teams: {0,2} vs {1,3}.
  else if (mode === 'hs-team') base = [n1, AI_ROSTER[0], n2, AI_ROSTER[1]];   // humans allied
  else if (mode === 'hs-rivals') base = [n1, n2, PARTNER_NAME, AI_ROSTER[2]]; // humans opposed, AI partners
  else base = ['You', AI_ROSTER[0]];
  if (company) {
    aiSeatsFor(mode).forEach((seat, i) => { if (company[i]) base[seat] = company[i]; });
  }
  return base;
}

function humansFor(mode) {
  if (mode === 'hotseat' || mode === 'hs-rivals') return [0, 1];
  if (mode === 'hs-team') return [0, 2];
  return [0];
}

function playerName(i) { return G.names[i]; }
function isHuman(i) { return G.humans.includes(i); }
function teamOf(i) { return TEAM_MODES.has(G.mode) ? i % 2 : i; }
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
  UI = { mode: 'idle', selected: [], pendingStone: null, blueOwn: null, flashIds: [] };

  // Build the 64-card Ledger Deck, full shuffle, scale to 16 per player.
  let id = 0;
  const full = [];
  for (const t of TYPES) for (let i = 0; i < 8; i++) full.push(t);
  shuffle(full);
  const active = full.slice(0, Math.min(64, 16 * G.nPlayers));

  const spec = dealSpec();
  G.players = [];
  for (let p = 0; p < G.nPlayers; p++) {
    const pool = { red: 2, white: 2, blue: 2, black: 2 };
    // Slumlock: stones placed in recent hands are still exhausted.
    if (G.variant === 'slumlock') {
      for (const color of STONE_KEYS) pool[color] = Math.max(0, 2 - slumBlocked(p, color));
    }
    G.players.push({
      idx: p,
      hand: [],
      board: [],
      pool,
      declared: [],
      removed: null,
      active: [],
      aiPlan: null,
    });
  }

  // The Cursed Register: one card type is drawn and voided this hand.
  if (G.variant === 'cursed') {
    G.cursedType = TYPES[Math.floor(Math.random() * TYPES.length)];
    log(`The Cursed Card is drawn: every ${G.cursedType} is voided this hand — no points, no Pairs, no Triads.`, 'sys');
  }
  for (let p = 0; p < G.nPlayers; p++) {
    for (let k = 0; k < spec.handSize; k++) {
      const card = {
        id: id++,
        type: active.pop(),
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
  G.queue = [
    { t: 'phase', label: `Hand ${G.handNum} — The Deal`, note: `${playerName(G.dealer)} hold${G.dealer === 0 ? '' : 's'} the Dealer Token. ${spec.handSize} cards each from a fresh-shuffled pool.` },
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
    { t: 'beat', ms: 900 },
    { t: 'showdown' },
  ];
  log(`— Hand ${G.handNum}. The deck is broken, shuffled clean, and dealt. —`, 'sys');
  run();
}

function isLocked(card) { return card.stones.some(s => s.color === 'white'); }
function hasRed(card) { return card.stones.some(s => s.color === 'red'); }

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
    const wait = dramatic(preWait(step));
    if (wait > 0 && !step._waited) {
      step._waited = true;
      // Spotlight the seat that is about to act, through the pause.
      G.activeSeat = ('who' in step) ? step.who : null;
      render();
      runTimer = setTimeout(run, wait);
      return;
    }
    G.queue.shift();
    G.activeSeat = ('who' in step) ? step.who : null;
    executeStep(step);
  }
  G.activeSeat = null;
  render();
}

function stepNeedsHuman(step) {
  switch (step.t) {
    case 'declare': return isHuman(step.who);
    case 'deploy': return step.pendingHumans.length > 0;
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
      // Human portions already stored in step.choices by the UI.
      const reveals = [];
      for (let i = 0; i < G.nPlayers; i++) {
        const cards = isHuman(i) ? step.choices[i] : aiChooseDeploy(i, step);
        deployCards(i, cards, step.faceUp);
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
    case 'thin':
      aiThin(step.who);
      break;
    case 'place':
      if (!isHuman(step.who) && G.players[step.who].active.length > 0) aiPlace(step.who);
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
  const seat = step.t === 'deploy' ? step.pendingHumans[0] : step.who;
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
      UI.mode = 'pickCards';
      UI.selected = [];
      UI.needed = step.count;
      setPrompt(step.faceUp
        ? `Choose ${step.count} cards from your hand to commit face-up.`
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
  if (!step || step.t !== 'deploy' || UI.selected.length !== step.count) return;
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
  // Slumlock: a placed stone is exhausted for the next two hands.
  if (G.variant === 'slumlock') G.slum[who].push({ color, until: G.handNum + 2 });
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

function knownBoardFor(viewer, ofPlayer) {
  return G.players[ofPlayer].board.map(c => ({
    type: (c.known[viewer] || c.faceUp) ? c.type : null,
    hasRed: hasRed(c),
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
    return { type, hasRed: c.hasRed };
  });
  if (!cards.length) return 0;
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
  const choice = plan.find(c => p.pool[c] > 0) || STONE_KEYS.find(c => p.pool[c] > 0);
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

function aiChooseDeploy(who, step) {
  const p = G.players[who];
  if (!p.aiPlan) {
    const spec = dealSpec();
    const counts = {};
    for (const c of p.hand) counts[c.type] = (counts[c.type] || 0) + 1;
    const scoreCard = c => c.type === G.cursedType ? 0
      : regionVal(c.type) + (counts[c.type] >= 2 ? 2.5 : 0);
    const sorted = p.hand.slice().sort((a, b) => scoreCard(b) - scoreCard(a));
    const keep = sorted.slice(0, spec.footprint);
    // A less practiced player keeps the wrong card now and then.
    if (sorted.length > spec.footprint && fumbles(who)) {
      keep[Math.floor(Math.random() * keep.length)] =
        sorted[spec.footprint + Math.floor(Math.random() * (sorted.length - spec.footprint))];
    }
    const threatened = opponentsOf(who).some(o => G.players[o].declared.includes('blue'));
    const exposable = keep.slice().sort((a, b) => {
      const risk = c => (counts[c.type] >= 2 ? 5 : 0) + (threatened ? regionVal(c.type) : -regionVal(c.type));
      return risk(a) - risk(b);
    });
    p.aiPlan = { faceUp: exposable.slice(0, 2), hidden: keep.filter(c => !exposable.slice(0, 2).includes(c)) };
  }
  if (step.faceUp) return p.aiPlan.faceUp;
  return p.aiPlan.hidden.splice(0, step.count);
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

function aiBestBlackTarget(who) {
  let best = null;
  const seen = new Set();
  for (const card of G.players.flatMap(p => p.board)) {
    const ev = undoableEventFor(card);
    if (!ev || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const delta = swingIfUndone(ev, who);
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

/* ---------------- Showdown ---------------- */

function entities() {
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
    p.board.map(c => ({ type: c.type, hasRed: hasRed(c) })),
    G.region.values,
    variantOpts()
  ));

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
      log(`${winner.name} take${winner.members.includes(0) ? '' : 's'} the showdown, ${top.score} to ${second.score}. The Pivot Marker shifts ${diff}.`, 'sys');
    }
  }

  if (matchWinner) G.over = true;
  G.lastShowdown = { sel, ents, winner, push, structuralOnly, diff, matchWinner, gains, hand: G.handNum };
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
    div.innerHTML = `
      <div class="pname">${playerName(i)} <span id="dealer-${i}" class="dealertoken" title="Dealer Token">dealer</span>${i !== 0 && ally ? '<span class="allytag">partner</span>' : ''}</div>
      ${flavor ? `<div class="epithet">${flavor}</div>` : ''}
      <div id="pinfo-${i}" class="pinfo"></div>
      <div class="tlabel">stone pouch</div>
      <div id="rack-${i}" class="minipouch"></div>
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
    seat.className = 'seat';
    seat.style.setProperty('--seatc', seatColor(i));
    seat.innerHTML = `<div class="seathead">${playerName(i)}</div><div id="board-${i}" class="board"></div>`;
    if (isOpponent(0, i)) oppSeats.appendChild(seat);
    else youSeats.appendChild(seat);
  }

  // Score widget: track for two-sided modes, purse list for FFA.
  $('ledgerWrap').style.display = G.mode === 'ffa' ? 'none' : '';
  $('scoreList').style.display = G.mode === 'ffa' ? '' : 'none';
  if (G.mode !== 'ffa') {
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
  for (const id of ['quitModal', 'setupModal', 'showdownModal', 'victoryModal', 'rulesModal', 'passModal']) closeModal(id);
  G = null;
  $('titleScreen').classList.remove('hidden');
}

function requestQuitToTitle() {
  if (INGAME) $('quitModal').classList.add('open');
  else showTitle();
}

/* ---------- Tutorial ---------- */

const TUT = { active: false, phase: 'idle', seen: new Set(), introStep: 0, minimized: false, current: null };

const TUT_INTRO = [
  { sel: '.game', text: '<b>Welcome to Stonelock.</b> You are not building a careful recipe — you are seizing assets. Each hand, you field three cards and bend the board with stones. Let’s walk one hand together.' },
  { sel: '.ledger', text: 'This is <b>the ledger</b>. Win a showdown and the Pivot Marker slides toward your side by the point difference. Push it the whole way — here, to 10 — and the match is yours.' },
  { sel: '#youSeats', text: 'This is <b>your layout</b>. Cards you commit land here in numbered slots. The Stranger’s layout sits across the table, above.' },
  { sel: '#panels', text: 'The sidebar tracks every seat: who holds the <b>Dealer Token</b>, the stones still in their pouch, and the stones they’ve <b>telegraphed</b> (shown but not yet used).' },
  { sel: '.game', text: 'A hand runs in phases: telegraph stones, commit cards (some open, some veiled), thin your stones to two, then resolve them and reach the showdown. Ready — the deal begins.' },
];

function startTutorial() {
  TUT.active = true;
  TUT.phase = 'intro';
  TUT.seen = new Set();
  TUT.introStep = 0;
  TUT.minimized = false;
  TUT.current = null;
  hideTitle();
  tutIntro();
}

function tutIntro() {
  const step = TUT_INTRO[TUT.introStep];
  coachShow(step.text, step.sel, {
    next: () => {
      TUT.introStep++;
      if (TUT.introStep < TUT_INTRO.length) tutIntro();
      else {
        TUT.phase = 'live';
        coachHide();
        newGame({ venue: 'tavern', mode: 'duel', deal: 'small', target: 10, targeting: 'standard' });
      }
    },
    nextLabel: TUT.introStep === TUT_INTRO.length - 1 ? 'Deal the hand' : 'Next',
  });
}

const TUT_LIVE = {
  declare: { sel: '#stoneTray', text: '<b>Telegraph a stone.</b> It’s laid in the open for all to see but does nothing yet — part plan, part bluff. Tap one of the large stones below. (Red duplicates, White locks, Blue steals, Black undoes.)' },
  deploy:  { sel: '#handArea', text: '<b>Commit your cards.</b> Tap cards from your hand, then confirm. Early ones go face-up; later ones are veiled. Your three best of four are scored at the end.' },
  thin:    { sel: '#stoneTray', text: '<b>The Thinning.</b> You telegraphed three stones — now abandon one. The two you keep are the ones you’ll actually place.' },
  place:   { sel: '#stoneTray', text: '<b>Resolve a stone.</b> Now your stones act for real. Choose one to place, then pick its target on the board.' },
};

function tutorialTick() {
  if ($('showdownModal').classList.contains('open')) {
    if (!TUT.seen.has('showdown')) {
      TUT.seen.add('showdown');
      coachShow('<b>The Showdown.</b> Every veiled card flips. Each player’s best three of four are scored — raw values plus a Pair (+2) or Triad (+6) bonus. The ledger moves by the difference. That’s a full hand!', '#showdownBody', { next: tutFinish, nextLabel: 'Finish' });
    }
    return;
  }
  const step = TUT_LIVE[
    UI.mode === 'pickStone' ? 'declare' :
    UI.mode === 'pickCards' ? 'deploy' :
    UI.mode === 'thin' ? 'thin' :
    UI.mode === 'placeChoose' ? 'place' : null
  ];
  const key = step && Object.keys(TUT_LIVE).find(k => TUT_LIVE[k] === step);
  if (step && !TUT.seen.has(key)) {
    TUT.seen.add(key);
    coachShow(step.text, step.sel, { action: true });
  } else if (!step || TUT.seen.has(key)) {
    // No fresh lesson for this moment (AI turn, or a repeat) — clear the spotlight.
    if (!$('showdownModal').classList.contains('open')) coachHide();
  }
}

function tutFinish() {
  coachShow('You’ve played a hand of Stonelock. Keep going to finish this short match, or return to the title to set your own table.', null, {
    next: () => { TUT.active = false; TUT.phase = 'idle'; coachHide(); },
    nextLabel: 'Keep playing',
    alt: { label: 'To title', fn: showTitle },
  });
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
    skip.textContent = 'Skip tutorial';
    skip.onclick = showTitle;
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
    const sides = G.humans.length > 1
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
    for (const color of STONE_KEYS) {
      const col = document.createElement('div');
      col.className = 'minicol';
      const exhausted = G.variant === 'slumlock' ? slumBlocked(i, color) : 0;
      for (let k = 0; k < 2; k++) {
        const dot = document.createElement('span');
        const held = k < p.pool[color];
        const isExhausted = !held && k >= 2 - exhausted;
        dot.className = held ? `stonedot ${color}` : 'stonedot socket' + (isExhausted ? ' exhausted' : '');
        dot.title = `${STONES[color].name} — ${STONES[color].power}: ${STONES[color].desc}` +
          (held ? '' : isExhausted ? ' (Slumlock: exhausted, returning soon)' : ' (telegraphed)');
        // The viewer's rack is the live pouch: declare from here too.
        if (i === G.viewer && held && UI.mode === 'pickStone') {
          dot.classList.add('targetable');
          dot.onclick = () => humanDeclare(color);
        }
        col.appendChild(dot);
      }
      rack.appendChild(col);
    }
    renderTelegraph(i, $(`tg-${i}`));
  }
}

function cardEl(card) {
  const el = document.createElement('div');
  const V = G.viewer;
  const visible = card.faceUp || card.known[V];
  // Allies' veiled cards stay hidden from you too — only your own
  // veiled cards (and revealed swaps) show their face.
  const showFace = card.faceUp || (card.known[V] && card.owner === V);
  el.className = 'card' + (showFace ? '' : ' back') + (card.faceUp ? ' faceup' : ' facedown');
  el.dataset.cardId = card.id;
  if (showFace) {
    el.innerHTML = `
      <div class="cicon">${ICONS[card.type]}</div>
      <div class="cname">${card.type}</div>
      <div class="cval">${regionVal(card.type)}</div>`;
    if (!card.faceUp) {
      const v = document.createElement('div');
      v.className = 'veilband';
      v.textContent = 'veiled';
      el.appendChild(v);
    }
  } else {
    el.innerHTML = `<div class="backsigil"></div>`;
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
  const spec = dealSpec();
  const board = G.players[who].board;
  for (let i = 0; i < spec.footprint; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const label = document.createElement('div');
    label.className = 'slotlabel';
    label.textContent = slotName(i, spec.footprint);
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
      <div class="cicon">${ICONS[card.type]}</div>
      <div class="cname">${card.type}</div>
      <div class="cval">${regionVal(card.type)}</div>`;
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
  if (!visible) return;
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
    if (p.removed !== null && !isUsableTelegraph(p, color, i)) s.classList.add('spent');
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

function showShowdownModal(d, review) {
  if (typeof document === 'undefined') return;
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
        <div class="cicon">${ICONS[p.type]}</div>
        <div class="cname">${p.type}${p.phantom ? ' ✧' : ''}</div>
        <div class="cval">${p.phantom ? '✧' : p.cursed ? '0' : regionVal(p.type)}</div>
      </div>`).join('');
    const caption = ents.length === G.players.length ? '' : `<div class="membername">${playerName(i)}</div>`;
    return `${caption}<div class="pickrow">${picksHtml}</div>
      <div class="mathline">${s.raw} raw ${s.bonus ? `+ ${s.bonus} ${s.structure === 'triad' ? 'Triad' : 'Pair'} bonus` : ''}${s.penalty ? ` − ${s.penalty} Riverlock` : ''} — ${STRUCT_LABEL[s.structure]} (${s.score})</div>`;
  }

  body.innerHTML = ents.map(e => `
    <div class="showhand">
      <h3>${e.name} — ${e.score} points</h3>
      ${e.members.map(memberHtml).join('')}
    </div>`).join('');

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
    verdict = `The Pivot Marker shifts <b>${diff}</b> toward ${sideWord}. Ledger now <b>${G.ledger > 0 ? '+' + G.ledger : G.ledger}</b>.`;
  }

  body.innerHTML += `<div class="verdict">${verdict}</div>`;
  $('nextHandBtn').textContent = review ? 'Back to the table'
    : matchWinner ? 'See the result' : 'Next hand — the Dealer Token rotates';
  m.classList.add('open');
}

function showVictory() {
  if (typeof document === 'undefined') return;
  const m = $('victoryModal');
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
    key: 'venue', title: 'Choose the venue', options:
      Object.entries(VENUES).map(([v, info]) => ({ v, label: info.label, desc: info.desc })),
  },
  {
    key: 'mode', title: 'Choose the table', options: [
      { v: 'duel', label: 'Solo 1v1', desc: 'You against the Stranger across a quiet table. The Pivot Marker races by the net difference of each showdown.' },
      { v: 'ffa', label: 'Free-for-All — 4 seats', desc: 'Every showdown, each seat banks its margin over the lowest hand. First to the target, standing alone, takes the match.' },
      { v: 'teams', label: 'Paired Teams — 2v2', desc: 'The Old Hand sits opposite as your partner. Team totals decide the showdown; multiples never pool across layouts.' },
      { v: 'hotseat', label: 'Hotseat Duel', desc: 'Two players, one device. The table passes between you with a confirmation screen; veiled cards stay private.' },
      { v: 'hs-team', label: 'Hotseat Allies — 2v2', desc: 'You two against two of the regulars. Pass the device; lock each other’s cards; never trade against each other.' },
      { v: 'hs-rivals', label: 'Hotseat Rivals — 2v2', desc: 'You two on opposite sides, each seated with one of the regulars as a partner.' },
    ],
  },
  {
    key: 'company', title: 'Choose the company', options: [
      { v: 'usual', label: 'The Usual Table', desc: 'The regulars take their accustomed seats.' },
      { v: 'lottery', label: 'Draw Lots', desc: 'Seats are filled at random from whoever is in the room tonight.' },
      { v: 'choose', label: 'Choose Your Company', desc: 'Pick exactly who sits down, seat by seat.' },
    ],
  },
  {
    key: 'targeting', title: 'Choose the targeting custom', options: [
      { v: 'standard', label: 'Standard Custom', desc: 'Stones bind as written: Red and Blue work your own layout against your rivals’; White may shelter an ally.' },
      { v: 'open', label: 'Open Table — advanced', desc: 'Any stone may target any layout, allies included: red an ally’s pair, lock a rival’s dead card, trade between any two seats.' },
    ],
  },
  {
    key: 'deal', title: 'Choose the deal', options: [
      { v: 'small', label: 'Small Game', desc: '5 cards dealt, a 2-1-1 footprint, best 3 of 4 scored. The roadside standard.' },
      { v: 'house', label: 'House Deep Draft', desc: '9 cards dealt, a 2-2-1 footprint, best 3 of 5 scored. Leftovers are discarded dead.' },
    ],
  },
  {
    key: 'target', title: 'Choose the match length', options: [
      { v: 10, label: 'Quick — to 10', desc: 'A fast settling of scores.' },
      { v: 20, label: 'Standard — to 20', desc: 'The common evening match.' },
      { v: 40, label: 'Full Sovereign Race — to 40', desc: 'The long campaign, as the nobles play it.' },
    ],
  },
];

let SETUP = null;

function openSetup() {
  SETUP = { venue: 'tavern', mode: 'duel', company: 'usual', targeting: 'standard', deal: 'small', target: 20, names: ['', ''], picks: [] };
  renderSetup();
  $('setupModal').classList.add('open');
}

function seatRoles(mode) {
  switch (mode) {
    case 'duel': return ['your opponent'];
    case 'ffa': return ['rival', 'rival', 'rival'];
    case 'teams': return ['rival', 'your partner', 'rival'];
    case 'hs-team': return ['rival', 'rival'];
    case 'hs-rivals': return ['Player One’s partner', 'Player Two’s partner'];
    default: return [];
  }
}

function renderSetup() {
  // Single screen: every setting visible, defaults preselected,
  // one confirm button at the bottom.
  const body = $('setupBody');
  body.innerHTML = '';
  const K = aiSeatsFor(SETUP.mode).length;
  SETUP.picks = SETUP.picks.slice(0, K);
  for (const section of SETUP_STEPS) {
    if (section.key === 'company' && K === 0) continue; // pure hotseat: no AI seats
    const title = document.createElement('div');
    title.className = 'steptitle';
    title.textContent = section.title.replace('Choose the ', 'The ').replace('Choose ', '');
    body.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'optgrid';
    for (const opt of section.options) {
      const el = document.createElement('div');
      el.className = 'bigopt' + (SETUP[section.key] === opt.v ? ' selected' : '');
      el.dataset.v = opt.v;
      el.innerHTML = `<h3>${opt.label}</h3><div class="bigoptdesc">${opt.desc}</div>`;
      el.onclick = () => { SETUP[section.key] = opt.v; renderSetup(); };
      grid.appendChild(el);
    }
    body.appendChild(grid);

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
        chip.innerHTML = (ord >= 0 ? `<span class="ordnum">${ord + 1}</span>` : '') + name;
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
      roles.textContent = 'Seats in order: ' + seatRoles(SETUP.mode).map((r, i) => `${i + 1} — ${r}`).join(' · ');
      row.appendChild(roles);
      body.appendChild(row);
    }
  }

  // Hotseat tables take player names.
  if (['hotseat', 'hs-team', 'hs-rivals'].includes(SETUP.mode)) {
    const row = document.createElement('div');
    row.className = 'namerow';
    const lab = document.createElement('span');
    lab.className = 'arealabel';
    lab.textContent = 'Who is playing?';
    row.appendChild(lab);
    [0, 1].forEach(k => {
      const inp = document.createElement('input');
      inp.className = 'nameinput';
      inp.placeholder = k === 0 ? 'Player One' : 'Player Two';
      inp.maxLength = 16;
      inp.value = SETUP.names[k] || '';
      inp.oninput = () => { SETUP.names[k] = inp.value; };
      row.appendChild(inp);
    });
    body.appendChild(row);
  }

  const r = REGIONS[VENUES[SETUP.venue].region];
  const vals = [3, 2, 1].map(v => `<b>${v}:</b> ${TYPES.filter(t => r.values[t] === v).join(', ')}`).join(' · ');
  const labelOf = key => SETUP_STEPS.find(s => s.key === key).options.find(o => o.v === SETUP[key]).label;
  const parts = [labelOf('venue'), labelOf('mode'), labelOf('targeting'), labelOf('deal'), labelOf('target')];
  if (K > 0) parts.splice(2, 0, labelOf('company'));
  // insertAdjacentHTML keeps the option cards' click handlers alive
  // (innerHTML += would re-parse the container and strip them).
  body.insertAdjacentHTML('beforeend', `
    <div class="valstrip">${r.name} — card values: ${vals}</div>
    <div class="setupsummary">${parts.join(' · ')}</div>`);

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
  const K = aiSeatsFor(SETUP.mode).length;
  let companyNames = null, drewLots = false;
  if (K > 0 && SETUP.company === 'lottery') {
    companyNames = shuffle(BOT_POOL.slice()).slice(0, K);
    drewLots = true;
  } else if (K > 0 && SETUP.company === 'choose') {
    companyNames = SETUP.picks.slice(0, K);
  }
  newGame({
    venue: SETUP.venue, mode: SETUP.mode, deal: SETUP.deal, target: SETUP.target, targeting: SETUP.targeting,
    names: SETUP.names.map(s => s.trim()).filter(Boolean).length ? SETUP.names.map(s => s.trim()) : [],
    companyNames, drewLots,
  });
}

function boot() {
  logEl = $('log');
  phaseEl = $('phaseLabel');
  phaseNoteEl = $('phaseNote');
  promptEl = $('prompt');
  $('nextHandBtn').onclick = () => {
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
  $('muteBtn').onclick = () => { $('muteBtn').textContent = SFX.toggle() ? '🔇' : '🔊'; };
  $('rulesClose').onclick = () => closeModal('rulesModal');
  $('newGameBtn').onclick = openSetup;
  $('fsBtn').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  $('victoryNew').onclick = () => { closeModal('victoryModal'); openSetup(); };
  $('titleBtn').onclick = requestQuitToTitle;
  $('quitYes').onclick = () => { closeModal('quitModal'); showTitle(); };
  $('quitNo').onclick = () => closeModal('quitModal');
  $('titleStart').onclick = () => { hideTitle(); openSetup(); };
  $('titleTutorial').onclick = startTutorial;
  $('titleRules').onclick = () => $('rulesModal').classList.add('open');
  $('coachNext').onclick = () => {}; // assigned per-step by coachShow
  $('coachMin').onclick = coachMinimize;
  $('coachRestore').onclick = coachRestoreShow;
  showTitle();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', boot);
} else if (typeof module !== 'undefined') {
  module.exports = {
    bestSelection, REGIONS, TYPES, STONES,
    newGame, nextHand,
    humanDeclare, humanToggleCard, humanConfirmDeploy, humanThin,
    humanChooseStone, humanTargetCard, humanDiscardStone,
    undoableEventFor, isLocked, isOpponent,
    _state: () => G, _ui: () => UI,
  };
}
