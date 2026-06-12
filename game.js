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

// The table plays the Practical Common for now. The other regional
// valuations return alongside the regional rule variants (Riverlock,
// Slumlock, Cursed Register), where value shifts pair with real
// rule changes.
const TABLE_REGION = 'bar';

const STONES = {
  red:   { name: 'Red Stone',   power: 'Duplication', desc: 'Places a phantom duplicate onto one of your cards, letting it count twice toward Pairs and Triads.' },
  white: { name: 'White Stone', power: 'Lock',        desc: 'Protects a card. A locked card cannot be altered, stolen, or neutralized for the rest of the hand.' },
  blue:  { name: 'Blue Stone',  power: 'Exchange',    desc: 'Forcibly swaps one of your cards with an unprotected card in an opponent’s layout. Visibility states stay as they were.' },
  black: { name: 'Black Stone', power: 'Disruption',  desc: 'Undoes the last stone effect upon a card. Played on your turn like any other stone; it cannot itself be undone.' },
};

const STONE_KEYS = ['red', 'white', 'blue', 'black'];

const AI_ROSTER = ['The Stranger', 'The Ferryman', 'The Clerk'];
const PARTNER_NAME = 'The Old Hand';

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
   physical card. Best 3 units are selected from the layout. */

function bestSelection(cards, values) {
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
        counts[cards[i].type] = (counts[cards[i].type] || 0) + 1;
        raw += values[cards[i].type];
        picks.push({ type: cards[i].type, phantom: k > 0, cardIdx: i });
      }
    }
    const struct = structure(counts);
    const bonus = struct === 'triad' ? 6 : struct === 'pair' ? 2 : 0;
    const score = raw + bonus;
    if (!best || score > best.score ||
        (score === best.score && RANK[struct] > RANK[best.structure])) {
      best = { score, raw, bonus, structure: struct, picks };
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
  return best || { score: 0, raw: 0, bonus: 0, structure: 'singles', picks: [] };
}

const STRUCT_RANK = { triad: 2, pair: 1, singles: 0 };
const STRUCT_LABEL = { triad: 'a Triad', pair: 'a Pair', singles: 'three Singles' };

/* ---------------- Game state ---------------- */

let G = null;
let UI = { mode: 'idle', selected: [], pendingStone: null, blueOwn: null, flashIds: [] };
let runTimer = null;

function newGame(cfg) {
  clearTimeout(runTimer);
  const n = cfg.mode === 'duel' ? 2 : 4;
  G = {
    mode: cfg.mode,                 // 'duel' | 'ffa' | 'teams'
    deal: cfg.deal,                 // 'small' | 'house'
    target: cfg.target,
    region: REGIONS[cfg.region || TABLE_REGION],
    nPlayers: n,
    names: buildNames(cfg.mode),
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
  buildTableDOM();
  const fmt = G.mode === 'duel' ? 'a quiet duel' : G.mode === 'ffa' ? 'a four-seat free-for-all' : 'paired alliances, two against two';
  const dl = G.deal === 'house' ? 'House deep-draft deal, nine cards down' : 'small-game deal, five cards down';
  log(`A table is set — ${fmt}, ${dl}, under ${G.region.name}. ${G.mode === 'ffa'
    ? `Each showdown the winner banks the margin over the runner-up; first to ${G.target} takes the match.`
    : `First to push the Pivot Marker ${G.target} onto the other side takes the match.`}`, 'sys');
  startHand();
}

function buildNames(mode) {
  if (mode === 'teams') return ['You', AI_ROSTER[0], PARTNER_NAME, AI_ROSTER[1]];
  if (mode === 'ffa') return ['You', ...AI_ROSTER];
  return ['You', AI_ROSTER[0]];
}

function playerName(i) { return G.names[i]; }
function teamOf(i) { return G.mode === 'teams' ? i % 2 : i; }
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
    G.players.push({
      idx: p,
      hand: [],
      board: [],
      pool: { red: 2, white: 2, blue: 2, black: 2 },
      declared: [],
      removed: null,
      active: [],
      aiPlan: null,
    });
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
    { t: 'deploy', count: dep[0].c, faceUp: dep[0].up },
    { t: 'phase', label: 'Phase 3 — The Veil', note: `Declare your second stone (reverse order), then commit ${dep[1].c === 2 ? 'two cards' : 'one card'} face-down.` },
    ...rOrd.map(w => ({ t: 'declare', who: w, n: 2 })),
    { t: 'deploy', count: dep[1].c, faceUp: dep[1].up },
    { t: 'phase', label: 'Phase 4 — The Final Commitment', note: 'Declare your third stone, then commit one final card. Leftover hand cards are discarded dead.' },
    ...dOrd.map(w => ({ t: 'declare', who: w, n: 3 })),
    { t: 'deploy', count: dep[2].c, faceUp: dep[2].up, discardRest: true },
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
  const multi = G.nPlayers > 2;
  switch (step.t) {
    case 'phase': return 500;
    case 'declare': return step.who !== 0 ? (multi ? 650 : 900) : 0;
    case 'deploy': return 700;
    case 'thin': return step.who !== 0 ? (multi ? 650 : 900) : 0;
    case 'place': return (step.who !== 0 && G.players[step.who].active.length > 0) ? (multi ? 1000 : 1200) : 0;
    case 'beat': return step.ms || 900;
    default: return 0;
  }
}

function run() {
  clearTimeout(runTimer);
  while (G.queue.length && !G.over) {
    const step = G.queue[0];
    if (stepNeedsHuman(step)) {
      promptHuman(step);
      render();
      return;
    }
    const wait = dramatic(preWait(step));
    if (wait > 0 && !step._waited) {
      step._waited = true;
      render();
      runTimer = setTimeout(run, wait);
      return;
    }
    G.queue.shift();
    executeStep(step);
  }
  render();
}

function stepNeedsHuman(step) {
  switch (step.t) {
    case 'declare': return step.who === 0;
    case 'deploy': return !step.humanDone;
    case 'thin': return step.who === 0;
    case 'place': return step.who === 0 && G.players[0].active.length > 0;
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
      // Human portion already stored in step.humanCards by the UI.
      const reveals = [];
      for (let i = 1; i < G.nPlayers; i++) {
        const cards = aiChooseDeploy(i, step);
        deployCards(i, cards, step.faceUp);
        reveals.push(`${playerName(i)} shows ${cards.map(c => c.type).join(' and ')}`);
      }
      deployCards(0, step.humanCards, step.faceUp);
      if (step.faceUp) {
        log(`The cards flip in the same breath. You show ${step.humanCards.map(c => c.type).join(' and ')}; ${reveals.join('; ')}.`);
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
      if (step.who !== 0 && G.players[step.who].active.length > 0) aiPlace(step.who);
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

/* ---- Human input handlers (wired from render) ---- */

function humanDeclare(color) {
  const p = G.players[0];
  if (p.pool[color] <= 0 || UI.mode !== 'pickStone') return;
  p.pool[color]--;
  p.declared.push(color);
  log(`You set a ${STONES[color].name} in the open. (${STONES[color].power})`, 'you');
  announce(`You telegraph a ${STONES[color].name}`, color);
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
  step.humanCards = UI.selected.slice();
  step.humanDone = true;
  UI.selected = [];
  UI.mode = 'idle';
  run();
}

function humanThin(index) {
  const p = G.players[0];
  if (UI.mode !== 'thin' || index >= p.declared.length) return;
  const color = p.declared[index];
  p.removed = color;
  p.declared.splice(index, 1);
  p.active = p.declared.slice();
  log(`You slide your ${STONES[color].name} back to your pouch. Two stones stay live.`, 'you');
  announce(`You abandon a ${STONES[color].name}`, color);
  finishHumanStep();
}

function humanChooseStone(color) {
  if (UI.mode !== 'placeChoose' || !G.players[0].active.includes(color)) return;
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
      setPrompt('Blue Stone (Exchange) — first click the card of YOURS you will give up.');
      break;
    case 'black':
      UI.mode = 'target-black';
      setPrompt('Black Stone (Disruption) — click a card to undo the last stone effect upon it.');
      break;
  }
  render();
}

function humanCancelStone() {
  UI.pendingStone = null;
  UI.blueOwn = null;
  UI.mode = 'placeChoose';
  setPrompt('Choose which of your active stones to place.');
  render();
}

function humanDiscardStone() {
  consumeActive(0, UI.pendingStone);
  log(`You set your ${STONES[UI.pendingStone].name} down without effect. It passes.`, 'you');
  announce(`You set a ${STONES[UI.pendingStone].name} down without effect`, UI.pendingStone);
  UI.pendingStone = null;
  finishHumanStep();
}

function validWhiteTarget(card) {
  return card.zone === 'board' && !isLocked(card) && !isOpponent(0, card.owner);
}

function humanTargetCard(card) {
  const color = UI.pendingStone;
  if (UI.mode === 'target-own') {
    if (color === 'white') {
      if (!validWhiteTarget(card)) return;
    } else { // red
      if (card.owner !== 0 || card.zone !== 'board' || isLocked(card) || hasRed(card)) return;
    }
    consumeActive(0, color);
    applyStone(0, color, { card });
    UI.pendingStone = null;
    finishHumanStep();
  } else if (UI.mode === 'target-blue-own') {
    if (card.owner !== 0 || card.zone !== 'board' || isLocked(card)) return;
    UI.blueOwn = card;
    UI.mode = 'target-blue-opp';
    setPrompt(`Giving up your ${card.faceUp ? card.type : 'veiled card'} — now click the opponent card to seize.`);
    render();
  } else if (UI.mode === 'target-blue-opp') {
    if (!isOpponent(0, card.owner) || card.zone !== 'board' || isLocked(card)) return;
    consumeActive(0, 'blue');
    applyStone(0, 'blue', { give: UI.blueOwn, take: card });
    UI.pendingStone = null; UI.blueOwn = null;
    finishHumanStep();
  } else if (UI.mode === 'target-black') {
    const ev = undoableEventFor(card);
    if (!ev) return;
    consumeActive(0, 'black');
    applyStone(0, 'black', { event: ev, card });
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
}

// All card descriptions are written from the player's seat.
function describeCard(card) {
  const ownerWord = card.owner === 0 ? 'your' : `${playerName(card.owner)}’s`;
  return card.faceUp ? `${ownerWord} ${card.type}` : `${ownerWord} veiled card`;
}

function verb(actor, base) { return actor === 0 ? base : base + 's'; }

function applyStone(actor, color, target) {
  const ev = { id: G.events.length, color, actor, undone: false };
  switch (color) {
    case 'white':
      target.card.stones.push({ color: 'white', by: actor });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'lock')} ${describeCard(target.card)} under a White Stone. Untouchable now.`, actor === 0 ? 'you' : 'ai');
      announce(`White Stone — ${describeCard(target.card)} is locked`, 'white');
      break;
    case 'red':
      target.card.stones.push({ color: 'red', by: actor });
      ev.cards = [target.card];
      log(`${playerName(actor)} ${verb(actor, 'drop')} a Red Stone on ${describeCard(target.card)} — a phantom duplicate shimmers over it.`, actor === 0 ? 'you' : 'ai');
      announce(`Red Stone — a phantom rises over ${describeCard(target.card)}`, 'red');
      break;
    case 'blue': {
      const { give, take } = target;
      const giveDesc = describeCard(give), takeDesc = describeCard(take);
      swapCards(give, take);
      ev.cards = [give, take];
      ev.give = give; ev.take = take;
      give.prov = { by: actor, partnerId: take.id };
      take.prov = { by: actor, partnerId: give.id };
      log(`${playerName(actor)} ${verb(actor, 'drop')} a Blue Stone — ${giveDesc} trades places with ${takeDesc}. Whatever was hidden stays hidden.`, actor === 0 ? 'you' : 'ai');
      announce(`Blue Stone — ${actor === 0 ? 'you seize' : playerName(actor) + ' seizes'} ${takeDesc} for ${giveDesc}`, 'blue');
      // The receiver may secretly inspect a face-down arrival.
      if (!take.faceUp) {
        take.known[actor] = true;
        if (actor === 0) toast(`You peek at your new veiled card: it is a ${take.type}.`);
      }
      if (!give.faceUp) give.known[give.owner] = true; // its new owner may inspect it
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
        log(`${playerName(actor)} ${verb(actor, 'drop')} a Black Stone — the phantom over ${describeCard(prev.cards[0])} gutters out.`, actor === 0 ? 'you' : 'ai');
        announce('Black Stone — the phantom is snuffed out', 'black');
      } else if (prev.color === 'blue') {
        // Reverse the trade. Stones travel with their cards.
        swapCards(prev.give, prev.take);
        prev.give.prov = null;
        prev.take.prov = null;
        log(`${playerName(actor)} ${verb(actor, 'drop')} a Black Stone on the trade — the swap unwinds, and every stone riding those cards travels home with them.`, actor === 0 ? 'you' : 'ai');
        announce('Black Stone — the trade unwinds, stones and all', 'black');
      }
      break;
    }
  }
  G.events.push(ev);
  UI.flashIds = ev.cards.map(c => c.id);
  render();
}

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
  const mine = G.players[0].board.filter(c => !isLocked(c));
  const theirs = opponentsOf(0).flatMap(i => G.players[i].board).filter(c => !isLocked(c));
  switch (color) {
    case 'white': return mine.length > 0 || alliesOf(0).some(i => G.players[i].board.some(c => !isLocked(c)));
    case 'red': return mine.some(c => !hasRed(c));
    case 'blue': return mine.length > 0 && theirs.length > 0;
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
  return bestSelection(cards, values).score;
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
  announce(`${playerName(who)} telegraphs a ${STONES[choice].name}`, choice);
}

function aiStonePreference(who) {
  const p = G.players[who];
  const counts = {};
  for (const c of p.hand.concat(p.board.filter(b => b.owner === who))) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  const hasMultiple = Object.values(counts).some(v => v >= 2);
  const threatened = opponentsOf(who).some(o => G.players[o].declared.includes('blue'));
  const prefs = [];
  if (hasMultiple) prefs.push('red');
  if (threatened || hasMultiple) prefs.push('white');
  prefs.push('blue');
  prefs.push('black');
  if (!hasMultiple) prefs.unshift('blue');
  if (Math.random() < 0.25) shuffle(prefs);
  return prefs;
}

function aiChooseDeploy(who, step) {
  const p = G.players[who];
  if (!p.aiPlan) {
    const spec = dealSpec();
    const counts = {};
    for (const c of p.hand) counts[c.type] = (counts[c.type] || 0) + 1;
    const scoreCard = c => regionVal(c.type) + (counts[c.type] >= 2 ? 2.5 : 0);
    const sorted = p.hand.slice().sort((a, b) => scoreCard(b) - scoreCard(a));
    const keep = sorted.slice(0, spec.footprint);
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
  const color = p.declared[worst];
  p.removed = color;
  p.declared.splice(worst, 1);
  p.active = p.declared.slice();
  log(`${playerName(who)} abandons a ${STONES[color].name}. Two stones stay live.`, 'ai');
  announce(`${playerName(who)} abandons a ${STONES[color].name}`, color);
}

function aiStoneValue(who, color) {
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
  const p = G.players[who];
  let best = null;
  const base = estimate(who, who);
  for (const card of p.board) {
    if (isLocked(card) || hasRed(card)) continue;
    card.stones.push({ color: 'red', by: who });
    const delta = estimate(who, who) - base;
    card.stones.pop();
    if (!best || delta > best.delta) best = { card, delta };
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
        const discount = take.known[who] || take.faceUp ? 0 : 1;
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
  options.sort((a, b) => b.value - a.value);
  const chosen = options[0];
  consumeActive(who, chosen.color);
  if (chosen.fizzle) {
    log(`${playerName(who)} sets a ${STONES[chosen.color].name} down without effect. It passes.`, 'ai');
    announce(`${playerName(who)} sets a ${STONES[chosen.color].name} down without effect`, chosen.color);
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
  if (G.mode === 'teams') {
    return [
      { name: 'Your alliance', members: [0, 2] },
      { name: `${playerName(1)} & ${playerName(3)}`, members: [1, 3] },
    ];
  }
  return G.players.map(p => ({ name: playerName(p.idx), members: [p.idx] }));
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

  const sel = G.players.map(p => bestSelection(
    p.board.map(c => ({ type: c.type, hasRed: hasRed(c) })),
    G.region.values
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
  showShowdownModal(sel, ents, winner, push, structuralOnly, diff, matchWinner, gains);
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
// happens in a corner of the screen unannounced.
function announce(msg, stoneColor) {
  if (typeof document === 'undefined') return;
  const el = $('announce');
  el.innerHTML = (stoneColor ? `<span class="stone ${stoneColor}"></span>` : '') +
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

function buildTableDOM() {
  if (typeof document === 'undefined') return;
  document.body.dataset.compact = G.nPlayers > 2 ? '1' : '0';
  document.body.dataset.deal = G.deal;

  // Sidebar player panels: opponents in seat order, you last.
  const panels = $('panels');
  panels.innerHTML = '';
  const seats = Array.from({ length: G.nPlayers }, (_, i) => i);
  const order = [...seats.filter(i => i !== 0), 0];
  for (const i of order) {
    const ally = !isOpponent(0, i);
    const div = document.createElement('div');
    div.className = 'playerpanel ' + (ally ? 'you' : 'opp');
    div.innerHTML = `
      <div class="pname">${playerName(i)} <span id="dealer-${i}" class="dealertoken" title="Dealer Token">dealer</span>${i !== 0 && ally ? '<span class="allytag">partner</span>' : ''}</div>
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
    seat.className = 'seat';
    seat.innerHTML = `<div class="seathead">${playerName(i)}</div><div id="board-${i}" class="board"></div>`;
    if (isOpponent(0, i)) oppSeats.appendChild(seat);
    else youSeats.appendChild(seat);
  }

  // Score widget: track for two-sided modes, purse list for FFA.
  $('ledgerWrap').style.display = G.mode === 'ffa' ? 'none' : '';
  $('scoreList').style.display = G.mode === 'ffa' ? '' : 'none';
  $('ledgerHeadAi').textContent = G.mode === 'teams' ? 'Them' : playerName(1).replace('The ', '');
  $('ledgerHeadYou').textContent = G.mode === 'teams' ? 'Yours' : 'You';
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
  }
  UI.flashIds = []; // flash plays once per action, not per re-render
  animateMoves(prevRects);
}

function renderScore() {
  $('handNum').textContent = `Hand ${G.handNum}`;
  $('regionBadge').textContent = `${G.region.name} · ${G.region.subtitle}`;
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
    $('ledgerValue').textContent = G.ledger > 0 ? `+${G.ledger} your side` : G.ledger < 0 ? `+${-G.ledger} their side` : 'even';
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
      for (let k = 0; k < 2; k++) {
        const dot = document.createElement('span');
        const held = k < p.pool[color];
        dot.className = held ? `stonedot ${color}` : 'stonedot socket';
        dot.title = `${STONES[color].name} — ${STONES[color].power}: ${STONES[color].desc}` + (held ? '' : ' (telegraphed)');
        // Your rack is the live pouch: declare stones from here too.
        if (i === 0 && held && UI.mode === 'pickStone') {
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
  const visible = card.faceUp || card.known[0];
  // Allies' veiled cards stay hidden from you too — only your own
  // veiled cards (and revealed swaps) show their face.
  const showFace = card.faceUp || (card.known[0] && card.owner === 0);
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
      dot.title = `${STONES[s.color].name} (${s.by === 0 ? 'yours' : playerName(s.by) + '’s'})`;
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
    const partnerDesc = partner && (partner.faceUp || partner.known[0])
      ? `the ${partner.type}` : 'the veiled card';
    el.title = `Changed hands via ${card.prov.by === 0 ? 'your' : playerName(card.prov.by) + '’s'} Blue Stone — traded for ${partnerDesc} (hover to see it).`;
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
  let targetable = false;
  if (UI.mode === 'target-own') {
    targetable = UI.pendingStone === 'white'
      ? validWhiteTarget(card)
      : (card.owner === 0 && !isLocked(card) && !hasRed(card));
  } else if (UI.mode === 'target-blue-own') {
    targetable = card.owner === 0 && !isLocked(card);
  } else if (UI.mode === 'target-blue-opp') {
    targetable = isOpponent(0, card.owner) && !isLocked(card);
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
  for (const card of G.players[0].hand) {
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
  $('handArea').style.display = G.players[0].hand.length ? '' : 'none';
}

// Contextual tray along the base of the play area: whenever a stone
// choice is due, the stones grow large down here and the hand makes
// way; during card commitment the hand takes the emphasis instead.
function renderTray() {
  const tray = $('stoneTray');
  const stonesEl = $('trayStones');
  const label = $('trayLabel');
  const p = G.players[0];
  let items = null;
  if (UI.mode === 'pickStone') {
    label.textContent = 'Telegraph a stone';
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
  for (const it of items) {
    const s = document.createElement('div');
    s.className = `stone big ${it.color} targetable`;
    s.title = `${STONES[it.color].name} — ${STONES[it.color].power}: ${STONES[it.color].desc}`;
    s.onclick = it.onClick;
    stonesEl.appendChild(s);
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
    if (who === 0 && UI.mode === 'thin') {
      s.classList.add('targetable');
      s.onclick = () => humanThin(i);
    }
    if (who === 0 && UI.mode === 'placeChoose' && p.active.includes(color)) {
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

function showShowdownModal(sel, ents, winner, push, structuralOnly, diff, matchWinner, gains) {
  if (typeof document === 'undefined') return;
  const m = $('showdownModal');
  const body = $('showdownBody');
  $('showdownTitle').textContent = push ? (G.mode === 'ffa' ? 'Dead heat at the top' : 'A Push')
    : winner.members.includes(0) ? `${winner.name === 'You' ? 'You take' : winner.name + ' takes'} the showdown`
    : `${winner.name} takes the showdown`;

  function memberHtml(i) {
    const s = sel[i];
    const picksHtml = s.picks.map(p => `
      <div class="pickcard${p.phantom ? ' phantom' : ''}">
        <div class="cicon">${ICONS[p.type]}</div>
        <div class="cname">${p.type}${p.phantom ? ' ✧' : ''}</div>
        <div class="cval">${regionVal(p.type)}</div>
      </div>`).join('');
    const caption = ents.length === G.players.length ? '' : `<div class="membername">${playerName(i)}</div>`;
    return `${caption}<div class="pickrow">${picksHtml}</div>
      <div class="mathline">${s.raw} raw ${s.bonus ? `+ ${s.bonus} ${s.structure === 'triad' ? 'Triad' : 'Pair'} bonus` : ''} — ${STRUCT_LABEL[s.structure]} (${s.score})</div>`;
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
  else verdict = `The Pivot Marker shifts <b>${diff}</b> toward ${winner.members.includes(0) ? 'your' : 'their'} side. Ledger now <b>${G.ledger > 0 ? '+' + G.ledger : G.ledger}</b>.`;

  body.innerHTML += `<div class="verdict">${verdict}</div>`;
  $('nextHandBtn').textContent = matchWinner ? 'See the result' : 'Next hand — the Dealer Token rotates';
  m.classList.add('open');
}

function showVictory() {
  if (typeof document === 'undefined') return;
  const m = $('victoryModal');
  let won, name;
  if (G.mode === 'ffa') {
    const w = G.scores.indexOf(Math.max(...G.scores));
    won = w === 0;
    name = playerName(w);
  } else {
    won = G.ledger >= G.target;
    name = won ? (G.mode === 'teams' ? 'Your alliance' : 'You') : (G.mode === 'teams' ? `${playerName(1)} & ${playerName(3)}` : playerName(1));
  }
  $('victoryTitle').textContent = won ? 'The table is yours' : `${name} cleans the table`;
  $('victoryText').textContent = won
    ? `${G.mode === 'teams' ? 'Your alliance' : 'You'} reached ${G.target} after ${G.handNum} hands. Somewhere down the line, someone is already complaining about how it was done.`
    : `${name} reached ${G.target} after ${G.handNum} hands. You keep your property — this was an honor table — but not your pride.`;
  m.classList.add('open');
}

/* ---------- Setup / boot ---------- */

function buildSetup() {
  const wrap = $('regionChoices');
  wrap.innerHTML = '';
  const r = REGIONS[TABLE_REGION];
  const card = document.createElement('div');
  card.className = 'regionchoice static';
  const rows = [3, 2, 1].map(v => {
    const names = TYPES.filter(t => r.values[t] === v).join(', ');
    return `<div class="valrow"><span class="valnum v${v}">${v}</span> ${names}</div>`;
  }).join('');
  card.innerHTML = `<h3>${r.name}</h3><div class="regionsub">“${r.subtitle}”</div><div class="regionblurb">${r.blurb} Card values at this table:</div>${rows}`;
  wrap.appendChild(card);
}

function startFromSetup() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  const deal = document.querySelector('input[name=deal]:checked').value;
  const target = parseInt(document.querySelector('input[name=target]:checked').value, 10);
  closeModal('setupModal');
  logEl.innerHTML = '';
  newGame({ mode, deal, target });
}

function boot() {
  logEl = $('log');
  phaseEl = $('phaseLabel');
  phaseNoteEl = $('phaseNote');
  promptEl = $('prompt');
  buildSetup();
  $('startBtn').onclick = startFromSetup;
  $('nextHandBtn').onclick = nextHand;
  $('rulesBtn').onclick = () => $('rulesModal').classList.add('open');
  $('rulesClose').onclick = () => closeModal('rulesModal');
  $('newGameBtn').onclick = () => { $('setupModal').classList.add('open'); };
  $('victoryNew').onclick = () => { closeModal('victoryModal'); $('setupModal').classList.add('open'); };
  $('setupModal').classList.add('open');
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
