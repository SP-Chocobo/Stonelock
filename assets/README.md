# Art assets (optional)

The game ships with CSS-drawn gems and a woodgrain card back as **fallbacks**,
so it looks complete with this folder empty. Drop matching files in here and the
art is picked up automatically — no code change needed.

Expected files (PNG):

| File | Used for | Notes |
|---|---|---|
| `stone-red.png` | Red Stone (Duplication) | the crimson gem |
| `stone-white.png` | White Stone (Lock) | the pale sphere |
| `stone-blue.png` | Blue Stone (Exchange) | the blue gem |
| `stone-black.png` | Black Stone (Disruption) | the black gem |
| `card-back.png` | the face-down card | the weathered porthole-and-timber panel |

Guidance:
- **Stones** are clipped to a circle, so a gem centered on a (white or
  transparent) square works as-is; transparent PNGs are cleanest but not
  required. ~256×256 is plenty (they render 12–52px). Keep the gem centered and
  roughly filling the frame.
- **card-back.png** is scaled to *cover* the card, which is taller than wide
  (~3:4). A portrait image crops nicely; the central timber reads best.
- Downscaling before committing keeps the repo light (a 1 MB MidJourney export
  is overkill for a 50px stone — ~256px / <100 KB each is ideal).
