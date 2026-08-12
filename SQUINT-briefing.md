# SQUINT — context briefing

*Written for another AI session picking this up cold. Read top to bottom; it is
short on purpose. Built by Mish (@mish6l), 2026-08-12/13.*

---

## What it is

A single self-contained HTML file that simulates **what an audience actually
sees on an LED video wall**, ingesting the user's own image or video rather than
a canned test pattern. No dependencies, no install, nothing leaves the machine.

It exists because every LED pitch visualiser on the market is parametric — you
move a slider and it renders a stock photo. None ingest your content, which is
where the real answer lives: *a 12 m wall at 3.9 mm is 3077 px wide, so a 4K
master loses 20% of its detail before pixel pitch does anything at all.*

Vendor tools will never show this, because a vendor's visualiser is a sales
tool. That incentive gap is why the thing didn't already exist.

## Where things are

| | |
|---|---|
| Source | `squint.html` — the whole tool, one file |
| Repo | `github.com/mish6l/squint` |
| Reviews | `reviews/` — two code-review rounds and one adversarial model audit |
| Test assets | `testcard.png` (3840×2160), `testclip.mp4`, `make-testcard.ps1` |

**How to run it: double-click `squint.html`.** If you see a
`python -m http.server 8731` in the history, that exists *only* because the
Chrome extension used for automated verification cannot navigate `file://` URLs.
It is scaffolding, it dies with its session, and telling the user to rely on it
is wrong. Everything works off the file directly.

Requires WebGL2 + float render targets. If missing it shows a **refusal card**
rather than degrading — see "Design commitments".

## Architecture

WebGL2, RGBA16F buffers, **linear light end to end**. Pass order in
`renderView` / the `GLE` module:

0. Upload frame as `SRGB8_ALPHA8` → sampling returns linear for free
1. **Exact separable area reduce** to the native LED grid — one axis at a time,
   ≤64× per step, every source texel weighted by true overlap
2. **Bit-depth / PWM quantisation** in the *signal* domain (sRGB-encode →
   quantise → decode), with a drive-level control that cuts effective levels
3. **Composite**: analytic sub-pixel fill coverage via an antiderivative of the
   lit-area indicator, `1/fill` gain, ambient, off-axis rolloff, array gaps,
   tile variance
4. **Separable Gaussian acuity blur** in linear light (pre-downsample if σ > 8)
5. **sRGB encode + present** — this holds the *single* Y flip in the whole
   pipeline (GL is bottom-up, every other pass is addressed top-down)

Chrome (labels, wipe bar, measure box, cabinet grid, scale figure, PNG caption)
is canvas-2D drawn *over* the GL output, never through it.

## The domain model — the parts that are non-obvious

- **Walls are grids of cabinets, and pitch is derived from the tile.** A 500 mm
  rental tile at "2.6 mm" carries 192 px, so true pitch = 500/192 = **2.604 mm**
  and a 12×6 wall is exactly **2304×1152**. Typing 6 m ÷ 2.6 mm gives 2308×1154
  — a near-miss that corrupts the comp size. Cabinet mode is the default.
- **Two distances, not one.** Acuity limit = 3.44 × pitch (where pitch equals
  the eye's 1-arcmin limit). Structure-free ≈ 5.7 × pitch, because a repeating
  grid stays detectable past the limit for a single feature. Both shown,
  separately labelled, both derived from `MM_PER_M`, never hard-coded.
- **Fill factor costs structure, not brightness.** A real wall is calibrated to
  rated nits whatever the fill — the LEDs are driven harder. Hence the `1/fill`
  gain holding mean brightness invariant.
- **The processor feed is a ceiling.** A 2304-wide wall fed 1920×1080 is a
  1920-wide wall containing more LEDs. Content is genuinely resampled through
  the feed's grid, so the softening is visible, not merely warned about.
- **Exports carry a viewing contract.** A pitch sim is only true at one ratio of
  displayed size to viewing distance; a 12 m wall as a 25 cm slide is optically
  50 m back, where every pitch looks flawless. The PNG states *"angularly true
  only when viewed from N × its displayed width"* and bakes audience acuity
  absolutely, since the recipient's screen and distance are unknown.
- **Fit views always flatter.** The top bar permanently reports the equivalent
  viewing distance for whatever is on screen.

## Design commitments (do not quietly reverse these)

1. **No canvas-2D fallback.** Two render paths = two answers under one name.
   Missing WebGL2 → refusal card, by design.
2. **The scale figure is chrome, not content.** Flat 1.75 m silhouette at the
   wall plane, drawn after the simulation. It never moves or rescales to stay in
   frame (a reference that follows the crop is a scale lie); fit mode reserves
   room instead, and the top bar says when it is off frame.
3. **Cabinet grid is diagnostic; tile variance is simulated.** On good stock the
   seam is nearly invisible — the useful question is whether a join lands
   through a logo. Brightness spread is the artifact that actually shows.
4. **No author credit on exports.** Sidebar + README + repo only. The comparison
   PNG and layout guide go to clients, vendors and editors.
5. **State the limits.** The README's "known simplifications" list is a trust
   artefact; shrink it with receipts, never by quietly dropping items.

## Numbers that must hold

`SQUINT.selftest()` runs at boot and asserts the first two through the real
pipeline; a red banner appears on failure.

| Check | Expected |
|---|---|
| 50/50 field, fused | **~188** sRGB (linear 0.5). Gamma-space would give 128 — the pre-rewrite build read 131 |
| Fill 90% → 25%, fused regime | mean brightness drift **< 2.5%** (currently ~0.1%) |
| "Cheap" scaler on 1 px stripes | local range **247** vs 7 for the box filter |
| Dark ramp, 8-bit | 40 levels at full drive, **9 at 20% drive** |
| Photometry: 400 lux / 4% / 1000 nits | 5.1 reflected nits, **197:1** contrast |

The test card carries the 50/50 patch with **188** and **128** reference blocks
beside it, so the headline claim is checkable by eye in five seconds.

## Traps that cost real time here

- **A backtick inside a GLSL comment inside a JS template literal** silently
  terminated the string and killed the entire script, with no console error.
  Always `node --check` the extracted `<script>` before debugging anything else.
- **PowerShell text cmdlets destroy this file.** PS 5.1 reads no-BOM UTF-8 as
  CP1252, so a read/write round-trip mojibakes every non-ASCII glyph (reversible
  by re-encoding CP1252→UTF-8). `-replace` is also **case-insensitive by
  default** — it renamed `arcminute` to `SQUINTute` and clobbered a local
  variable. Use the Edit tool, or .NET IO with explicit encoding.
- **GDI+ antialiases 1 px lines.** The first test card's stripe patches were flat
  grey *at source*, and were briefly cited as evidence the physics worked. Set
  `SmoothingMode='None'` for geometric test patches.
- **A self-test that mutates global state must snapshot every field it touches.**
  Ours set `fitMode='stretch'` and never restored it, so every launch left the
  user's content stretched while the UI read "Fit" — and the verification runs
  masked it by setting `fitMode` explicitly. A harness can hide the bug it
  should catch.
- **Filter choice matters when a texture will later be magnified.** `boxTo`
  returned NEAREST, so the processor-feed upscale point-replicated and kept
  edges artificially crisp — the feature looked wired up and changed nothing.
  Caught only by *measuring* detail, not by looking at the picture.
- **Never print a derived pitch raw.** 500/192 is `2.6041666666666665` and it
  reached labels, filenames and the client-facing caption. Everything goes
  through `fmtPitch()`.
- **Chrome will not load media in a backgrounded tab**, so no automated session
  can test the video path. That one was verified by hand.

## Verifying a change

1. `node --check` on the extracted `<script>` (catches the template-literal class
   of bug instantly).
2. Load `testcard.png`; run `SQUINT.selftest()`.
3. Sample the gamma patch against its 188/128 reference blocks.
4. Sweep hostile inputs — zero/negative/text/absurd walls and pitches, extreme
   aspect ratios, odd native sizes, extreme zoom and pan, fill/ambient/bit-depth/
   drive/angle/scaler extremes. 27 such cases currently pass with no throws and
   no NaN/Infinity readouts.
5. `window.SQUINT` exposes the internals for scripted checks: `S`, `nativeRes`,
   `contentRect`, `cellPx`, `draw`, `geo`, `geoB`, `viewUnder`, `GLE`,
   `selftest`, `cab`, `cabPitch`, `screenRes`, `effectiveRes`, `gapPx`,
   `syncPlan`, `exportTemplate`, `ambientFraction`, `contrastRatio`.

## Review history

Two external code-review rounds and one adversarial audit of the *model* (as
opposed to the code). Full findings with per-item status live in `reviews/`.
The adversarial audit's verdict before fixes was *"not fit for client-facing
pitch decisions"*; its two strongest findings were an export unmoored from the
angular model, and fill factor taxing brightness. Both fixed. The second code
round found two Critical bugs in the downsample chain and independently
confirmed the coverage antiderivative, the `1/fill` invariance, the ambient
transform, and the single Y flip.

## Deliberately not modelled

Contrast sensitivity (acuity is measured at max contrast, so the legibility
verdict is mildly optimistic for low-contrast content — a wrong CSF filter would
be a fancier dishonesty than an admitted gap); geometric foreshortening off-axis
(brightness only); motion acuity (static errs safe); camera moiré, scan and
refresh artifacts (an eye question, not a camera one); HDR; per-panel
calibration and seam/tile geometry beyond brightness spread.

## Possible next work

Nothing is outstanding or broken. Candidates raised but not built: curved and
segmented walls; scenario save/load so a spec is reproducible; data/power/weight
planning (LED Wall Central already does this well and it is arguably out of
scope); named vendor cabinet presets beyond the generic-by-pitch set.

v2 is deliberately parked pending field data: the list above is ranked by
reasoning about the job rather than by anything that has actually gone wrong on
one. The audience for this is people who own the content↔hardware boundary —
media server operators, screens crew, technical directors — rather than pure
content designers, and their reported failure cases should rank v2, not
speculation.
