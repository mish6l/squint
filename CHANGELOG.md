# Changelog

Each entry says what changed **and what was wrong before it** — the second half
is the useful one. Release notes on GitHub carry the same text at release time.

## v1.3 — 2026-09-06 · Render honesty

**Superseded builds:** v1.0–v1.2 showed one LED per screen pixel whenever the
wall had more LEDs than the screen had pixels for it — the default eye-match
view, *Fit*, and the exported comparison PNG. Fine LED-scale detail (hairlines,
small text edges, stripe bursts) could render black or white depending on pan,
and the acuity blur could not undo it. The measure-box legibility numbers were
not affected; the picture was.

- The quantised LED field is now area-averaged onto the screen by a
  fragment-aligned reduce whose weights carry the lit-area mask, so value × mask
  is integrated jointly. Worst per-pixel error against an independent footprint
  integral: 1.1 sRGB codes at 1.1 LEDs per pixel, 0.5 at 2 / 4 / 8.
- The chained area reduce is exact for the whole chain: stage sizes are integer
  multiples of the target (the old `ceil(cw/64)` rule split an impulse across
  two output bins above 64:1).
- Transparent source pixels are premultiplied per tap *before* bilinear
  interpolation (the magnify path blended straight alpha in hardware and
  premultiplied afterwards — hidden colour leaked into the opaque neighbour).
- Every shipped preset now quantises at native resolution; the memory fallback
  (walls beyond 8192 LEDs on an axis or 24 M in view) still averages before the
  quantiser, and the readout **and the exported PNG's caption** now say so. A
  GPU that cannot hold a wall refuses the frame instead of drawing a different
  grid under the same caption.
- New gate: `SQUINT.probe()` (116 fixtures, independent expectations),
  `tools/test-reduce-stages-node.js` (double-precision oracle with red-proofs of
  the old rule), `tools/pw-render-probe.js` (real Chrome, incl. the exported
  PNG). The boot self-test is unchanged and still passes — which is exactly why
  it was not enough.
- Found by an external pixel-simulation audit (2026-09-06); the fix was itself
  reviewed (round 6), which found five further defects, all fixed. Both
  write-ups are in `reviews/`.

## v1.2 — 2026-09-06 · Custom cabinets take a height

- Custom cabinets are width × height in mm plus pixels across; rows derive.
  Previously Custom was locked square, although the 500×1000 and 600×337.5
  presets already rendered non-square tiles.
- A custom wall is built from whole LEDs: a height that is not a whole number
  of rows is simulated at the nearest whole-LED tile and the hint says so;
  more than 0.1 rows off is flagged and refuses export.
- Free size now shows the wall you built (the fields kept their HTML defaults
  while every export carried the cabinet numbers) and refreshes the build plan
  on pitch chips, mapping changes and source load.
- Three external reviews (rounds 4, 4b, 5) shaped it; the first cut of v1.2
  was re-cut the same day after round 5.

## v1.1 — 2026-09-03 · Corrections

**Superseded build:** v1.0 reported numbers it had not earned — contrast was
overstated by exactly `1/drive` (197:1 shown where 40:1 was true at 20 %
drive), the off-axis readout quoted the on-axis figure, and with a screen array
the exported PNG stated a viewing distance wrong by 3.5×.

- 23 findings from the third external review closed; every one sat at a seam
  between subsystems, none in the linear-light core.

## v1.0 — 2026-08-13 · First public release

- WebGL2, linear light end to end; cabinet-quantised walls; processor feed as
  a ceiling; bit depth and drive; ambient from lux / nits / reflectance;
  visual acuity at the 1-arcminute limit; screen arrays with real gaps; a
  test card with 188 / 128 reference blocks.
