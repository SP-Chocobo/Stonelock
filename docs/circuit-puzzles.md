# The Circuit — puzzle pool (design draft)

Prose scenarios for the puzzle node, written to teach **standard good-play
practice**. Build/format is deferred — these are for review and theorycraft.

**Target:** ~20 puzzles in the Circuit pool (1 puzzle node per act pulls one).
The **Academy "Puzzles" tab** surfaces ~5–8 of them — the base-stone fundamentals
(tagged ⌂ below), which teach the core game with no Circuit-only content.

**Conventions used here** (Tavern values, unless a puzzle names a venue):
Bread / Coin / Road = **3** · Sword / Ferry = **2** · Quill / Crest / Chain = **1**.
Scoring is best-3 of your board · Pair = **+2** bonus · Triad = **+6** · a Red
phantom counts for *structure only* (scores no value).

**Stone rules the puzzles lean on:**
- **Red** — a phantom on *your* card (pair/triad filler, no value). One per card.
- **White** — *lock*: the card can't be altered, stolen, poisoned, or undone (by
  either player). You can't lock-then-red the same card.
- **Blue** — swap one of *your* cards for an *unlocked* rival card (a steal). The
  card travels with its stones/modifier.
- **Black** — undo the **last** stone effect on a card (a Red, a Blue trade, or a
  Green). It can't undo a White, and can't itself be undone.
- **Green** — *poison*: the card scores nothing and joins no set; kills a phantom
  on it. Only a White shields it. (Player-side only via the Dark Pact / variants.)
- **Drain** (modifier) only fires from its **owner's** board — steal it and it
  goes inert.

**Two puzzle shapes** (for the eventual build):
- **Riddle** — one decisive line; hand-authored outcomes.
- **Scored duel** — fixed boards, both sides hold stones, alternate placing vs a
  fixed rival script, win by out-scoring. (Tempo/order puzzles want this shape.)

Many of these intentionally **share a theory** and can be reskinned with
different cards/stones/venues to multiply the pool cheaply.

---

## A. Bait & decoy — spend a cheap threat to soak their answer

**1. The Decoy Phantom** ⌂
*Setup:* your board has a natural Pair of Coins (face-up) plus a **veiled** Quill;
you hold a Red; the rival holds a Black.
*Solution:* drop the Red on the **veiled** card. The rival can't tell it isn't your
triad piece, so they spend their Black to undo it — and your real Pair stands.
*Trap:* Red-ing a Coin makes the triad obvious; they Black *that* and you've lost
the swing.
*Teaches:* a threat they can't read is worth more than the best threat they can.

**2. Two Veils, One Black**
*Setup:* two veiled cards, one is your scorer; you hold Red; rival holds one Black.
*Solution:* Red the *decoy* veil. Their single Black can only answer one card, and
they guess wrong as often as right.
*Teaches:* force a 50/50 on their limited disruption.

## B. Value theft — Blue is a *double* swing

**3. Grand Larceny** ⌂
*Setup:* rival's best unlocked card is a Road (3) that pairs with a Road of yours;
you hold a Blue and a junk Chain (1).
*Solution:* Blue your Chain for their Road. You gain 3 *and* complete a Pair; they
lose their 3. The swing is the spread **plus** the structure.
*Teaches:* steal the card that helps you *and* hurts them — count both ends.

**4. Carry the Rider**
*Setup:* the rival fields a Lodestone propping up two of their cards; one of those
neighbours is stealable.
*Solution:* Blue the *Lodestone itself* onto your board, between two of your cards —
the buff now lifts **your** neighbours, and theirs sags.
*Teaches:* a modifier is loot; relocate it to flip its sign.

**5. Drain Goes Home**
*Setup:* the rival's Drain is pulling your facing card to −1; you hold a Blue.
*Solution:* Blue-steal the Drain card. Off its owner's board it goes **inert**, your
facing card recovers, and you pocket the body.
*Teaches:* `ownerLocked` modifiers die when stolen — a clean triple gain.

## C. Breaking sets — deny the +6

**6. Shatter the Triad** ⌂
*Setup:* the rival has a Triad of Coins (two real, one Red phantom); you hold a Black.
*Solution:* Black the Red. The phantom gutters out, Triad → Pair: a **−4** bonus
swing plus the lost filler.
*Trap:* Blue-stealing a Coin also breaks it, but costs you a card and leaves them a
Pair — the Black is cheaper and total.
*Teaches:* attack the *filler*, not the body; undo is the cheapest disruption.

**7. Steal the Keystone** ⌂
*Setup:* the rival's Triad is three **real** cards (no phantom to undo); you hold Blue.
*Solution:* Blue-steal one of the three. Their Triad collapses to a Pair and you
gain a 3-card — disruption *and* value.
*Teaches:* when there's no phantom to snuff, take the body.

**8. Poison the Set**
*Setup:* the rival's Triad rides on a Coin that also carries their Red phantom; you
hold a Green; the Coin is unlocked.
*Solution:* Green the Coin. It scores nothing, joins no set, and the phantom on it
dies with it — the whole Triad folds.
*Teaches:* Green erases structure *and* the rider in one cut.

## D. Protect first — order beats power when they hold Blue

**9. Shields Up** ⌂
*Setup:* your whole margin is one Road (3); the rival has an **open Blue**; you hold
a White.
*Solution:* lock the Road *now*. A locked card can't be stolen, and your lead holds.
*Trap:* making any other play leaves the Road naked — they Blue it and the table flips.
*Teaches:* with their Blue live, defend the swing card before you do anything clever.

**10. Lock, Then Loot** ⌂
*Setup:* you can Blue-steal a rival 3-card, but they hold a Black to unwind the trade;
you also hold a White.
*Solution:* **order matters** — steal first, then White the stolen card. A Black can't
undo a trade once either card is locked.
*Teaches:* seal a gain the same turn you make it, or expect it undone.

## E. Denial — White can be an attack

**11. Bind Their Hands** ⌂
*Setup:* the rival plans to Blue-dump their poisoned/Drain Chain onto your scorer's
slot; you hold a White.
*Solution:* lock **their** Chain. A locked card can't be traded, so the dump dies and
your scorer sits clean.
*Teaches:* lock the card their *plan* depends on — White denies, not just defends.

**12. Freeze the Setup**
*Setup:* the rival has one card they must Red into a Pair to score at all (their only
duplicate-able type); you hold a White.
*Solution:* lock that card — a locked card can't be altered, so the Red has nowhere to
land and their hand stays singles.
*Teaches:* deny the *irreplaceable* piece; locking a fungible one does nothing.

## F. Tempo / stone order — keep your options live

**13. Black First, Then Blue** ⌂  *(the marquee tempo read)*
*Setup:* the rival opens by Blue-stealing your high card; they still hold a White. You
hold a Blue **and** a Black. There's a red'd card on their side they'll lock.
*Solution:* undo the steal with your **Black**, not your Blue. They White their red'd
card — but your Blue is still live, so you steal a *different* high card and swing the
table to you.
*Trap A:* undo with **Blue** → they White the red'd card and your Black has nothing to
do — wasted. *Trap B:* don't undo → they simply White the card they stole and bank it.
*Teaches:* when two stones can answer, spend the one that **keeps your other option live**.

**14. The Patient Lock**
*Setup:* the rival reds a card threatening a Triad; you hold a Black and a White; they
hold a Blue.
*Solution:* don't Black the Red (they'd just re-red or Blue around it). White your own
scorer instead — their Triad is real but yours is *safe*, and you win the count.
*Teaches:* sometimes the right answer isn't to their threat — it's to your own safety.

## G. Green / the last word

**15. The Apothecary's Choice**
*Setup:* you hold a Green; the rival has two strong unlocked cards, one of which also
carries their phantom.
*Solution:* Green the one carrying the phantom — you void a 3 **and** collapse their set.
Tie goes to the cut that breaks the most.
*Teaches:* a poison's worth is value voided *plus* structure broken.

**16. Shield the Scalpel**
*Setup:* the rival holds a Green and it's their last move; your best card is unlocked;
you hold a White.
*Solution:* lock your best card. Green only takes an *unlocked* card, so the scalpel
finds a lesser one.
*Teaches:* against a known Green, White your top card before the last word.

## H. Variant lines  *(Circuit-only — not Academy)*

**17. Twin Red Alone**
*Setup:* you have one Road (3) and two junk cards; you hold a **Twin Red**.
*Solution:* Twin Red the Road — two phantoms make a whole Triad of Roads on one card
(3 + 6 bonus), no second copy needed.
*Teaches:* Twin Red turns a lone high card into a finished Triad.

**18. Onyx Doubletake**
*Setup:* the rival has *both* a Red phantom (Triad) and a fresh Blue steal on the board;
you hold an **Onyx Black**.
*Solution:* Onyx undoes the **last two** effects — the steal unwinds and the phantom dies
in one stone.
*Teaches:* Onyx answers two threats at once; save it for a double setup.

**19. Riptide Sticky**
*Setup:* you want to steal a card, but the rival holds a Black; you hold a **Riptide Blue**.
*Solution:* Riptide the steal. Their Black can only **downgrade** it to a plain swap — it
can't unwind the trade, so your gain holds (and a second Black is more than they have).
*Teaches:* Riptide buys a steal that survives a single Black.

**20. Deadbolt Two**
*Setup:* two adjacent scorers, and the rival holds a Green *and* a Blue; you hold a
**Deadbolt White**.
*Solution:* Deadbolt the pair — one stone locks *both* adjacent cards, so neither the
poison nor the steal can land.
*Teaches:* Deadbolt is two shields; place it where two threats overlap.

## I. Modifier placement reads

**21. Lodestone Centrepiece**
*Setup:* you hold a Lodestone card and field two 3-value neighbours; an end slot and a
centre slot are open.
*Solution:* place it in the **centre** — it lifts *both* neighbours (+2). An end slot
lifts only one.
*Teaches:* spread effects want the interior; count the neighbours before you commit.

**22. Sentinel's Corner**
*Setup:* you hold a Sentinel (+2 on an end slot) and a Bulwark (+1 per neighbour); two
slots remain — one end, one interior.
*Solution:* Sentinel to the **end**, Bulwark to the **interior** — each lands where it
pays. Swap them and both underperform.
*Teaches:* positional modifiers are opposites; don't crowd them into the same slot.

---

## Academy set (the ⌂ fundamentals — base stones only)

A good starter tab of base-mechanic teachers, no Circuit content:
1 Decoy Phantom · 3 Grand Larceny · 6 Shatter the Triad · 7 Steal the Keystone ·
9 Shields Up · 10 Lock, Then Loot · 11 Bind Their Hands · 13 Black First, Then Blue.

That's 8 — trim to 5–6 if the tab wants to stay tight (e.g. 1, 3, 6, 9, 13).

## Reuse / multiplying the pool

Each **theory** above reskins cheaply into several pool entries: change the venue
(so the value table shifts which card is the steal/keystone), swap the card types,
or swap a base stone for its variant (e.g. Riddle 6 "Shatter the Triad" → an Onyx
version that also undoes a steal). ~6 theories × 3 reskins ≈ the 20-puzzle pool.
