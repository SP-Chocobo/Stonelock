# The Circuit — boss dialogue (draft script for review)

Short, skippable boss cutscenes — **bosses only** (the named regulars; neutral
toughs stay silent). Each act boss gets a portrait + 1-2 lines on entry, plus a
line on victory and on defeat. Portraits already exist in `assets/portraits/`.

**Intro is state-keyed** (priority: Rematch › Wounded › Hale), so it reads as a
response to how you arrive — no new tracking needed:
- **Hale** — Standing ≳ 60% of max (they size you up).
- **Wounded** — Standing ≲ 35% (they smell blood).
- **Rematch** — you've faced this persona before (records already log foes).
- *(Optional 4th — "Deep run," act 3 — easy to add later if wanted.)*

**Victory** plays on clearing the boss (pairs naturally with handing over their
signature relic). **Defeat** plays on a run-ending loss to them. Keep all lines
1-2 sentences, tap-to-skip, auto-advanceable; consider skip-after-first-seen.

---

## The Ferryman  *(Act I — the crossing · tolls, currents · River King's Toll)*
- **Hale:** "Every crossing has its toll, friend. Sit — let's see what you can pay."
- **Wounded:** "You're listing already, half-drowned before the water. The current won't carry you twice."
- **Rematch:** "Back at my landing. The river remembers a face; so do I. Coin's the same as last time."
- **Victory:** "Hah. You read the current better than most. Take the river's due — you've earned the crossing."
- **Defeat:** "Down you go, then. The water keeps what the road lets fall."

## The Wagoner  *(Act I — the long haul · the road, cargo · Highwayman's Cut)*
- **Hale:** "Long road behind you, longer ahead. Climb up — I'll see how much you're carrying."
- **Wounded:** "You're rattling apart at the axle. Plenty falls off a wagon on a road like this."
- **Rematch:** "You again, dogging my wheels. Didn't take enough off you last haul?"
- **Victory:** "Light fingers, light load. Go on — take what fell off my wagon. You earned the haul."
- **Defeat:** "That's the road for you. Takes a little off everyone — today it took you whole."

## The Deckhand  *(Act I — the deck · tides, momentum · Following Sea)*
- **Hale:** "Fresh off the gangplank, are you? Mind the deck — it pitches when you least want it."
- **Wounded:** "Green at the gills and we haven't cast off. The tide's not kind to the seasick."
- **Rematch:** "Back aboard. Knew the sea'd wash you up at my table again."
- **Victory:** "Well sailed. The following sea's yours now — ride the run while it lasts."
- **Defeat:** "Over the side you go. The deck belongs to them that keep their feet."

## The Old Hand  *(Acts I & III — the long game · patience · Second Wind)*
- **Hale:** "I've sat this table longer than you've drawn breath. Sit. Take your time — I've got plenty."
- **Wounded:** "Worn thin already? Patience is the only stone that never runs out, and you're fresh out of it."
- **Rematch:** "You keep coming back. Stubborn. I respect stubborn — it's most of what I've got left."
- **Victory:** "...Huh. Didn't see that line. Been a while since anyone showed me a new one. Go on — earned it."
- **Defeat:** "Easy, now. You played it well enough. You just played it against me."

## The Miner  *(Act II — the deep · veins, the dark · Motherlode)*
- **Hale:** "Down here we don't dig for show. We dig for what's under. Let's see what you're made of, all the way down."
- **Wounded:** "Already out of air, and we haven't hit the deep yet. The dark swallows the weak."
- **Rematch:** "Back in my tunnels. Some folk never learn — what's buried can stay buried."
- **Victory:** "Struck a vein, did you. Take the motherlode — you dug for it honest."
- **Defeat:** "Cave-in. Happens to them that don't read the rock. The dark keeps you now."

## The Stranger  *(Acts II & III — the veil · secrets, no name · Veilwalker)*
- **Hale:** "No name, no face you'll remember. Only the cards I let you see. Shall we?"
- **Wounded:** "You wear your wounds where I can read them. That's the whole game — and you've already lost it."
- **Rematch:** "We've met. You don't recall the half of it. I prefer it that way."
- **Victory:** "You looked past the veil. Few do. Take it — and tell no one how."
- **Defeat:** "You only ever saw what I showed you. That was the trick of it."

## The Lady  *(Acts II & III — the house · control, favor · Sovereign's Favor)*
- **Hale:** "How quaint, a challenger off the street. Mind the silver — and don't bleed on the felt."
- **Wounded:** "Oh, you poor thing. Nothing left to wager but your dignity, and that's already spent."
- **Rematch:** "You again? I did so enjoy taking everything the first time. Let's."
- **Victory:** "...Well played. The house concedes — rarely, and never graciously. My favor is yours. Do try to keep it."
- **Defeat:** "There, there. The house always keeps its favor. Run along now."

## The Tinker  *(Act II — the workbench · pieces, matched sets · Matched Set)*
- **Hale:** "Everything fits, if you know where it goes. Let's see if your pieces match, hm?"
- **Wounded:** "Missing a few teeth off your gears, friend. A thing that won't turn doesn't win."
- **Rematch:** "Oh, it's you. I do love a problem that keeps coming back to be solved."
- **Victory:** "Hah — every piece in its place. Here, a matched set. You've the hands for it."
- **Defeat:** "Tick, tick — and stop. You came apart right on schedule."

## The Clerk  *(Act III — the court · ledgers, verdicts, locks · Iron Verdict)*
- **Hale:** "Your account is open. Let us see whether it balances. Sit — and don't touch the ledger."
- **Wounded:** "Your column runs red, and the books do not forgive a debt. The verdict writes itself."
- **Rematch:** "Your file is... thicker than most. Persistent debtors always are. Let us settle it properly."
- **Victory:** "The ledger balances in your favour. Irregular. The verdict stands — take the seal. Signed, witnessed, done."
- **Defeat:** "The account is closed. Filed, sealed, and shelved. You may go."

---

## Notes for the build
- **Data shape:** `BOSS_LINES[persona] = { hale, wounded, rematch, win, lose }`
  (strings, or arrays for random variants). Resolve intro by the priority above.
- **Where it fires:** intro in `circuitSetupFight` for `node.type === 'boss'`
  (before `newGame`); win/lose in `circuitEnd` on the boss branch. A portrait
  panel reusing the circuit modal, or a light overlay over the battlefield.
- **Voice cheat-sheet** (keep reskins/extra lines on-tone): Ferryman = tolls &
  currents · Wagoner = the road & what falls off · Deckhand = sea & tides ·
  Old Hand = years & patience · Miner = the deep & the dark · Stranger = the
  veil & secrets · Lady = the house & condescension · Tinker = gears & fitting ·
  Clerk = ledgers, debts & verdicts.
- **Optional later:** a single short *elite* barb per persona (no win/lose), so
  elites have a flicker of voice without diluting the boss moment.
