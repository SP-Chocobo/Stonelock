'use strict';
/* Raid turn-count battery (analysis, not pass/fail). Drives full all-AI campaign
   raids — the real party AI (seats 0 + ally) vs each boss — and reports how many
   HANDS a win takes, per boss and difficulty. Feeds a uniform campaign turn cap:
   pick a number that lets ~95% of legitimate wins finish while cutting the
   pathological grind (a weak bot dragging a raid out for 40+ hands).
   Run: K=200 node tests/raid-turns-battery.js */
const M = require('../game.js');
M.setAlphaUnlock(true);

const K = +(process.env.K || 200);
const TARGET = 15; // the real campaign marker distance (RAID_TARGET)
const BOSSES = ['magistrate', 'warden', 'apothecary', 'quartermaster', 'archivist', 'crucible'];
const DIFFS = { crucible: ['hard'] };            // the Crucible is one trial
const diffsFor = b => DIFFS[b] || ['easy', 'standard', 'hard'];

const GRIND_CAP = +(process.env.CAP || 60); // a raid past this many hands is a "grind" (undecided drag)
function runRaid(boss, diff) {
  M.newGame({ mode: 'raid', raidBoss: boss, raidAlly: 'bot', raidDiff: diff, target: TARGET });
  const G = M._state();
  G.humans = []; // whole party AI-driven (ally already is; this frees seat 0 too)
  let guard = 0;
  while (!G.over) {
    if (G.handNum > GRIND_CAP) return { grind: true, hands: G.handNum };
    if (guard++ > 400000) return null;
    if (!G.queue.length) { M.nextHand(); continue; }
    if (M._ui().mode === 'pass') { M.passConfirm(); continue; }
    M._run();
  }
  return { win: G.ledger >= G.target, hands: G.handNum };
}

const pct = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const allWinHands = [];
let rows = [];
for (const boss of BOSSES) {
  for (const diff of diffsFor(boss)) {
    const winHands = [];
    let wins = 0, n = 0, grinds = 0;
    for (let i = 0; i < K; i++) {
      const r = runRaid(boss, diff);
      if (!r) continue;
      n++;
      if (r.grind) { grinds++; continue; }
      if (r.win) { wins++; winHands.push(r.hands); allWinHands.push(r.hands); }
    }
    rows.push({ boss, diff, n, winPct: Math.round(100 * wins / n), grindPct: Math.round(100 * grinds / n),
      winMean: winHands.length ? (winHands.reduce((a, b) => a + b, 0) / winHands.length).toFixed(1) : '—',
      winMed: pct(winHands, 0.5), winP95: pct(winHands, 0.95), winMax: winHands.length ? Math.max(...winHands) : '—' });
  }
}
console.log(`Raid turn-count battery — ${K} all-AI runs/config, target ${TARGET}.\n`);
console.log(`boss           diff      win%  grind%(>${GRIND_CAP})  win-hands: mean / med / p95 / max`);
for (const r of rows) {
  console.log(
    `${r.boss.padEnd(14)} ${r.diff.padEnd(9)} ${String(r.winPct).padStart(3)}%    ${String(r.grindPct).padStart(3)}%       ` +
    `${String(r.winMean).padStart(5)} / ${String(r.winMed).padStart(3)} / ${String(r.winP95).padStart(3)} / ${String(r.winMax).padStart(3)}`);
}
console.log(`\nAcross all wins (${allWinHands.length}): mean ${(allWinHands.reduce((a, b) => a + b, 0) / allWinHands.length).toFixed(1)}, ` +
  `median ${pct(allWinHands, 0.5)}, p90 ${pct(allWinHands, 0.90)}, p95 ${pct(allWinHands, 0.95)}, p99 ${pct(allWinHands, 0.99)}, max ${Math.max(...allWinHands)}.`);
console.log('A uniform turn cap ≈ the global p95 lets ~95% of wins finish and cuts the grind past it.');
