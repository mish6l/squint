# Fable round 2 — model judgment pass

**Date:** 2026-08-18
**Reviewer:** Fable (independent of the parallel Codex round 3; read-only)
**Angle:** is the physics the code implements the physics an LED engineer would
accept, and does any number leave the tool with more confidence than the model
earns? Code defects are included where caught, but the weight is on the model.
**Files checked:** `squint.html` (1,920 lines); `index.html` verified
byte-identical (`cmp`), so no drift finding.

---

## Verdict

The core is sound. The linear-light pipeline, the exact area reduce, the
coverage antiderivative, signal-domain quantisation, the Lambertian ambient
derivation and the `(col + amb)/(1 + amb)` renormalisation all hold up under a
hostile re-derivation, and the acuity subtraction is genuinely elegant: in
eye-match, `sTarget` and `sMon` cancel *exactly* (substitute the eye-match
`cellPx` into line 975 and `sAdd` is identically zero), so the viewer's own eye
supplies the whole filter — that is the right physics, implemented as an
identity rather than an approximation. Neither boot self-test assertion is
threatened by anything below: every real finding in this pass lives **at the
seams between subsystems** — controls that are each individually correct but do
not talk to each other (wall drive vs. photometry, processor vs. content
mapping, the variance hash vs. the array model, export vs. view mode). Those
seams are exactly where a confident number escapes that the model has not
earned, and the two High findings both flatter the wall.

Findings: **2 High, 4 Medium, 6 Low, 1 simplification sweep** (13 total).

---

## HIGH

### 1. "Wall driven at" is decoupled from the photometry — contrast overstated by 1/drive

**Anchors:** `squint.html:1046` (drive reaches only the quantiser),
`squint.html:916-917` (`ambientFraction` divides by full `S.nits`),
`squint.html:752` (`uAmb` applied unscaled), `squint.html:1289-1301` (readout),
`squint.html:1714-1719` (caption prints drive % and contrast side by side).

The drive slider does exactly one thing: it shrinks the quantiser's level count
(`floor((2^bits−1)·drive)`). It never touches the luminance model. But the
ambient fraction is `lux·reflectance/π` against **full** `S.nits`, and both the
rendered black lift and the "On-site contrast" readout derive from that. A wall
driven at 20% has an effective peak of `0.2 × nits`; relative to *that* white,
the reflected ambient is 5× larger than the tool computes.

Keeping the *image* display-relative (panel white = monitor white) is a
documented, deliberate choice and is fine. The inconsistency is that the
**ambient fraction and contrast ratio are physical claims about the venue**,
and they silently assume 100% drive while a separate control on the same panel
says otherwise. The exported caption then prints `@ 20% drive` and
`contrast ≈ 197:1` in the same line — two numbers that cannot both be true.

**Failure scenario:** 1000-nit panel, 400 lux, 4% face, wall driven at 20%
(a completely ordinary indoor config — walls are routinely driven at 30-60%).
Tool: reflected 5.1 nits → black at 0.51% of white, contrast **197:1** (amber
band). Reality: effective peak 200 nits → black at 2.5%, contrast **≈40:1**
(red band). The readout is 5× flattering, the simulated image shows one fifth
of the real ambient lift, and the number is exactly the kind he would quote to
a client. Direction of error: always flatters, and it flatters *more* the
dimmer the wall is driven — i.e. worst in dark-room shows, the tool's own
stated core use case.

**Check he can run:** live build, set 400 lux / 1000 nits, then sweep "Wall
driven at" 100% → 5%. The on-site contrast readout and the black lift in the
image do not move at all. They should move by 20×.

**Suggested fix (words):** define effective peak `nits_eff = S.nits ×
S.wallBright` and use it in `ambientFraction()` and the photo hint. Nothing
else needs to change: the renormalisation already does the right thing once
`amb` is computed against the driven peak. State in the hint that drive costs
both greyscale *and* ambient headroom.

### 2. Processor limit is not applied to content that does not fill the wall

**Anchors:** `squint.html:1024-1029` (condition and target compare the feed to
the **content rect**), `squint.html:1018-1021` (comment states the correct
model), `squint.html:570-575` (`effectiveRes` states the correct wall-level
ceiling), `squint.html:1764-1768` (plan panel quotes that ceiling).

The processor stage runs only when `procW < r.w || procH < r.h` and downsamples
to `min(procW, r.w) × min(procH, r.h)` — i.e. it compares the feed to the
*content's* pixel extent. But the feed covers the **whole native canvas**:
content occupying `r.w` of `nx` native pixels occupies `r.w · procW/nx` pixels
of the feed. Whenever content does not fill an axis (pillarboxed logo, 4:3
IMAG, 1:1-mapped element), the tool under-applies or entirely skips the
processor penalty on that axis, and shows the content sharper than the chain
can physically deliver.

This directly contradicts the tool's own copy: the hint at `squint.html:267`
calls the feed ceiling "the most common gap between the spec sold and the
picture delivered", and the build plan quotes `effective 1920 × 1152` from
`effectiveRes()` — while the simulation quietly exempts any content that
doesn't touch the wall edges. Two parts of the same file disagree about the
same physics.

**Failure scenario (clean one):** 12×6 cabinet wall of 192 px tiles →
2304 × 1152 native. Processor limit ON, HD feed. Load a 1000 × 1000 image,
mapping "1:1 native px". `r = 1000×1000`; `1920 < 1000` is false,
`1080 < 1000` is false → the processor stage is **never entered**. Truth: the
feed carries that content at ~833 × 938 and the wall upscales it back.
Fit-mode version: 4:3 content on the same wall → `r.w = 1536`; horizontal cap
skipped (correct value 1280), vertical correct only because the content is
full-height. Direction: flatters — overstates deliverable sharpness precisely
in the "processor limit" scenario the feature exists to expose.

**Check he can run:** wall wider than the feed, processor ON, load any content
smaller than 1920 × 1080, mapping 1:1. Toggle "Processor limit" — the plan
panel flips its "effective" line, the rendered image does not change one pixel.

**Suggested fix (words):** trigger on `procW < nx || procH < ny` and target
`round(r.w · min(1, procW/nx)) × round(r.h · min(1, procH/ny))` — the
content's share of the feed, not the content's native extent.

---

## MEDIUM

### 3. Tile-variance hash: every screen shows the identical pattern, and the top-left cabinet is deterministically the dimmest

**Anchors:** `squint.html:745-748` (indexing by per-screen `localX`),
`squint.html:708-709` (`hash21`).

Two defects in one mechanism:

(a) `ci = floor(vec2(localX, wall.y)/uCabPx)` uses coordinates local to each
screen, so cabinet (i,j) of every screen in an array hashes to the same value —
all screens are brightness-clones of each other. The adjacent comment says
"each screen carries its own tile stock"; the code implements the opposite
(each screen carries the *same* stock). Repeated mottle across a 3-screen row
is visually detectable in exactly the flat-gradient content the hint says
reveals variance.

(b) `hash21(vec2(0,0))` is an exact fixed point: `fract(0·k)=0`, `sin(0)=0`,
output **0** — so the factor for cabinet (0,0) is always `1 − tileVar`. The
top-left cabinet of the wall (and, per (a), of every screen) is always pinned
at the extreme dim end of the distribution, every session, every pitch. A
hash's job is to look like stock scatter; a deterministic dark corner cabinet
looks like a defect in the wall being simulated.

**Check he can run:** flat 50% grey image, tile variance 12%, cabinet grid
overlay off, blur off, fit zoom. (1) The wall's top-left cabinet is the darkest
patch, and stays the darkest after reload and at any pitch. (2) Enable a
3-screen array: screenshot screen 1 and screen 2 — the mottle patterns are
identical.

**Suggested fix (words):** feed the hash the *global* cabinet index plus the
screen index (or just `wall.x` instead of `localX`, plus a screen-index term),
and offset the input by an irrational constant so integer (0,0) is not a fixed
point.

### 4. Wipe-mode export ships a half-source PNG with no disclosure

**Anchors:** `squint.html:1684-1691` (`composeExport` copies `cvA`, which in
wipe mode already contains the source composited over the left half —
`squint.html:1228-1231`), `squint.html:1714` (caption stamps `zoom` but not
mode), `squint.html:141` (the vlabel that *does* say "SOURCE | WALL" is a DOM
overlay, never baked into the export).

The round-1 export fix built a careful honesty contract into the caption —
viewing-ratio, fill, bit depth, ambient, "audience acuity baked in". But export
from wipe mode bakes an image whose left portion is **not the simulation at
all** (the ideal reference), split at an arbitrary slider position, and the
caption says nothing about it. A recipient sees an unexplained vertical seam
under an authoritative caption; worse, if the wipe bar sits far right, the deck
slide is mostly the *ideal* wall wearing the simulation's credentials. This is
the same failure family as the round-1 export finding: the one artifact that
leaves the tool claiming more than it shows.

**Check he can run:** wipe mode, bar at ~70%, export. Open the PNG: seam
present, caption reads as a plain simulation, the on-screen "SOURCE | WALL"
label is absent.

**Suggested fix (words):** either export the pure simulation view regardless of
mode, or stamp the mode into the caption and draw the seam position plus
SOURCE/WALL labels into the exported bitmap. (A/B mode already does this
correctly via the `A:`/`B:` caption line — wipe is the only leak.)

### 5. Pitch B boots at 6 mm while the UI says 3.9

**Anchors:** `squint.html:231` (`value="3.9"`), `squint.html:495`
(`pitchB:6`).

The state and the DOM disagree at boot and stay disagreed until the field is
touched (the handler at `squint.html:1370` only fires on input; pitchB is not
persisted). First use of A/B mode simulates, labels, and *exports* B at 6 mm
while the sidebar reads 3.9 — anyone cross-referencing the sidebar against the
render, or trusting the "Compare to" box when reading the exported caption's
`B:` line, gets a contradiction; anyone who doesn't notice compares against
the wrong pitch entirely.

**Check he can run:** fresh load (no interaction), click "A / B pitch": the B
view label says `B · 6 mm`, the sidebar box says 3.9.

**Suggested fix (words):** make the two agree — one character in either place.

### 6. Texture pool has no eviction, so one zoom/resize session permanently defeats it

**Anchors:** `squint.html:806-826` (`grab`/`give`: exact-size match, cap 24,
full pool deletes the *incoming* texture), `squint.html:1009-1016` (crop sizes
`lw × lh` change every frame during pan/zoom), `squint.html:1085-1096` (blur
work sizes scale with sigma). **Unverified — needs a browser check.**

Pool entries are matched by exact `(w,h,filter)`. During a pan or zoom drag the
visible-crop dimensions change every frame, so each frame's grabs miss, allocate
fresh, and push new sizes until the pool holds 24 entries. Nothing ever evicts a
stale size: once the pool is full of dimensions that will never recur, every
subsequent frame — including steady-state frames at rest — allocates and
deletes its entire working set (`give` deletes the incoming texture when full),
plus up to 24 dead RGBA16F textures stay pinned (at 4K viewport sizes,
potentially hundreds of MB of VRAM). Pixels stay correct; the cost is silent
per-frame GPU allocation churn and pinned memory for the rest of the session —
the kind of thing that shows up as a long video playback getting janky after
the user has zoomed around.

**Check he can run:** load a video, play it, note smoothness; wheel-zoom and
pan vigorously for ~10 s; play again and watch frame pacing / GPU memory in
`chrome://gpu` or the task manager. Or instrument `grab` from the console via
`SQUINT.GLE` and count creations per frame before vs. after a zoom spree.

**Suggested fix (words):** evict oldest-first when the pool is full (keep the
incoming, delete `pool.shift()`), which makes the pool self-refresh toward the
current working set. One line, no semantics change.

---

## LOW

### 7. Off-axis rolloff is rendered but the contrast readout ignores it

**Anchors:** `squint.html:919` (`contrastRatio` uses ambient only),
`squint.html:751-752` (shader: white drops by `uOffGain`, ambient does not —
which is the *correct* physics), `squint.html:1718` (caption prints
`contrast ≈ N:1 · 60° off-axis` as one line).

In the image, off-axis contrast is correctly `(offGain + amb)/amb`; the readout
and caption quote the on-axis `(1 + amb)/amb`. At 60° (`cos^1.35` → 0.39) the
quoted number is ~2.5× better than the picture being shown above it, and the
caption pairs the on-axis figure with the off-axis label. Flattering, and
internally inconsistent with its own render.

**Check:** 400 lux / 1000 nits, sweep viewing angle 0° → 60°: image visibly
washes out, "On-site contrast" readout never moves.

**Fix (words):** multiply into the ratio: `(offGain + a)/a`, and let the
readout label say "at N° off-axis" when nonzero.

### 8. The structure bands are fill-independent — stated more precisely than the model earns

**Anchors:** `squint.html:1271-1284` (ratio thresholds 1.0/0.6 and the two
distances), `squint.html:1307` (hint).

The 0.6 detectability buffer (endorsed in round 1) is a constant, but grating
detectability past the acuity limit is contrast-driven: a 25%-fill SMD wall
presents a far higher-contrast grid than a 90% COB and stays detectable
further. The tool prints "structure-free from 51.7 m" to 0.1 m resolution
identically for both, while its own renderer draws visibly different grids.
Not a bug to model away (that would be v2 scope) — a labelling gap: the number
carries decimal-place confidence with no stated dependence on the fill the user
just set two sections up.

**Fix (words):** one clause in the hint/label — the buffer assumes typical
fill; low-fill product stays detectable somewhat further. No math change.

### 9. `FS_REDUCE`'s 64-tap loop can drop the 65th partial texel

**Anchor:** `squint.html:659-669` (`for(int i=0;i<64;i++)`). **Unverified —
reasoned only.**

The chain guarantees ratio `r ≤ 64`, but a *fractional* r just under 64 with a
fractional span start covers up to 65 partial texels (`ceil(frac(s0)+r)`), and
the loop stops at 64 — the trailing sliver (weight < 1) is excluded from that
destination texel's average. The result stays normalised (divides by `wsum`),
so this is a ≤ ~1.5% local error on hard edges in extreme single-step
reductions (e.g. source width 8127 → 127), not a brightness bias. Neither
self-test assertion is sensitive to it (both use small integer ratios).

**Fix (words):** raise the tap cap to 65.

### 10. Arrow keys with a focused `<select>` also drive the viewer distance

**Anchor:** `squint.html:1657-1663` (guard checks `tagName==='INPUT'` only).

Click the Bit-depth (or any) dropdown, press ArrowLeft/Right: the select
changes *and* the distance jumps 0.5 m — two unrelated state changes from one
keystroke, and the distance one is easy to miss, silently invalidating the
reading the user is looking at.

**Check:** focus the bits select, press ArrowRight twice, look at the distance
readout. **Fix (words):** extend the guard to SELECT (and BUTTON for space).

### 11. Manual `SQUINT.selftest()` false-fails under user settings

**Anchors:** `squint.html:1832-1849` (forced-state and `keep` lists omit
`arrayOn`, `tileVar`, `cabGrid`, `procOn`).

At boot this is harmless (defaults are neutral). But `selftest` is exported on
`window.SQUINT` as the verification handle, and calling it with a screen array
active makes check 1 sample what may be an inter-screen gap (fused ≈ 0 → FAIL),
and with tile variance set, the centre cabinet's hash multiplier can push the
188 ± 6 assertion out of band. The restore side is fine (those fields are never
mutated); the defect is that the *checks* run in a non-neutral world, and a
red "do not trust these numbers" banner from a healthy pipeline is its own
kind of wrong number.

**Check:** console: enable Multiple screens, run `SQUINT.selftest()`.
**Fix (words):** add the four fields to both the forced-neutral setup and the
snapshot.

### 12. Calibration is silently capped at 900 CSS px despite the modal's 1200 range

**Anchors:** `squint.html:397` (`calR` max 900), `squint.html:443` (`calR2` max
1200), `squint.html:1464` (`applyCal` reads **calR**), `squint.html:1490-1491`
(calR2 syncs *through* calR, which clamps).

The full-stage modal exists precisely so the card "can reach its true size at
ANY rail width", and offers a slider to 1200 — but every path funnels through
the rail slider's 900 max, so beyond 900 the drag moves and nothing happens:
the card stops growing, `ppmmCss` freezes at 10.51, and a saved value above 900
reloads clamped. Only bites very dense CSS-dpi displays (> ~267 CSS dpi), but
on one of those the tool would accept a calibration, mark the state
`calibrated`, and have 1:1 / eye-match wrong by the clamp ratio — a wrong
number wearing the calibrated badge, which is the exact failure the
UNCALIBRATED machinery was built to prevent.

**Check:** open the calibration modal, drag the card slider to the far right —
the dpi note stops at ~267 dpi while the slider keeps travelling.
**Fix (words):** raise `calR`'s max to 1200 (or make `applyCal` read whichever
slider fired).

### 13. Simplification: the canvas-2D era left a shadow skeleton in the file

**Anchors:** `squint.html:483-486` (`HAS_FILTER` computed, never read — its
warning path died with the 2D renderer), `squint.html:515-516` (`tmp`,
`contentCv`, `cropCv`, `offA`, `offB`, `idealOff` scratch canvases — only
`idealCv` is real), `squint.html:951` (`renderView`'s `off` parameter is
unused; three call sites pass dead canvases), `squint.html:1338` + 1601
(`mStart` written, never read), `squint.html:1754` (`lost` computed, unused),
`squint.html:1328` (`nativeRes(S.pitchA)` computed twice in one line).

None of this changes behaviour; all of it misleads a reader — `HAS_FILTER`
especially, since it *looks* like a live capability gate for the acuity model
and is actually a fossil of the renderer this file no longer contains. In a
single-author single-file artifact, ~10 lines of deletion buys real
readability.

---

## Could not verify (no browser available)

- Finding 6 (pool churn) and finding 9 (65th-tap sliver) are reasoned from the
  source only; both include a concrete runtime check above.
- Half-float portability (`EXT_color_buffer_half_float` accepted as satisfying
  the RGBA16F requirement) is correct per spec on WebGL2 and I found no
  counter-evidence, but actual Safari/mobile behaviour was not exercised.
- The exact eye-match cancellation (`sAdd = 0`) was verified algebraically,
  not by measurement.
- All "what he would see" predictions for findings 1-5, 7, 10-12 are derived
  from static reading; each is stated as a live-build check precisely so they
  can be falsified in minutes at https://mish6l.github.io/squint/.

done: 13 findings written to D:\Mishal\Claude Code\SQUINT\reviews\2026-08-18 fable round 2 - improvements.md
