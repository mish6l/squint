# Plan: Render honesty (v1.3) — the four pixel-simulation defects

Status: SHIPPED 2026-09-06 — commit `c109388` on `main`; gate red on `e3cc230` (69/81), green after (116/116 incl. Codex round-6 rows); Codex rounds audit + 6 closed.

## Overview
The 2026-09-06 pixel-simulation audit (Codex, Mish's run; verified by Fable on
the RTX 4090, by an independent double-precision oracle, and by reading the
code) found four numerical defects in the render core. The first is the first
known case of SQUINT's *picture* being wrong: when there is more than one LED
per display pixel — the default eye-match view at 5 m is `cell ≈ 0.12`, *Fit* is
`cell ≈ 0.43` on a 2304-LED wall, and the exported comparison PNG is the on-screen
canvas — the composite samples ONE LED per pixel, so fine LED-scale detail
aliases (period-2 stripes render 0 or 255 by pan phase where 188 is right).
This slice fixes all four, in the audit's order, behind a gate that is
independent of the code it tests and runs against the shipped file.

**Research basis:** four read-only lenses over `squint.html` (render path,
reuse/decim machinery, the audit's fixture runner, prior art across all five
review rounds) — findings folded in below with line references to `e3cc230`.

## Problem
| # | Defect | Where | Verified |
|---|---|---|---|
| 1 | Minification point-samples one LED per display pixel; `decim` (the only LED-field averaging) is gated on texture size (`CROP_CAP` 4096), not on `cell`, so it never engages on any shipped 12×6 preset | `FS_COMP` :829 `col=texture(uTex,uv).rgb` on a NEAREST `led` (:1179); `decim` :1150-1151 | fixture on real GPU: 0.8 / 0 / 255 / 255 sRGB by pan phase, expected ~188 |
| 2 | `boxTo`'s chained reduction is exact per stage but not for the chain: intermediates `ceil(cw/64)` are not multiples of `dw`, so an intermediate texel straddles a final boundary | :983-984 | oracle: 130→3→2 gives 0.00769/0.00769 vs exact 0.01538/0; 423/500 random reductions differ, max channel error 0.079 |
| 3 | `FS_COPY`'s LINEAR branch blends straight-alpha RGB and A in hardware, THEN premultiplies (`ovb` after the filter); the round-3 alpha fix covered the reduce taps (texel-centred) but not this magnify path | :761 `ovb(texture(uTex,vUV))` | GPU: `(0.562,0.187,0)` where `(0.75,0,0)` is right; invisible green leaks |
| 4 | When `decim>1` the source is averaged to a sub-native grid and quantised there — `quantise(mean) ≠ mean(quantise)` | :1168 `tgtW=r.w/decim`, quant at :1187-1195 on `lw×lh` | GPU: 0.0038 vs 0.0076 at 8-bit/5 % drive — 2× brightness on dark codes |

Prior art matters here: round 1 (both reviewers) flagged the *neighbourhood* of
#1 ("eye-match cannot show marginal pixel structure", `cell < 3`) and deferred
it to the WebGL rewrite; the rewrite integrated the **mask** (`cov1`, verified by
round 2 "for footprints spanning many cells") but left the **colour** as one
texel. Round 1 also justified decimation with "`decim>1` only when `cell<1`" —
true, but the converse is what matters and nobody checked it. Rounds 3 said
"the core is sound" without executing a shader. This audit is the first that did.

## Success Criteria
- [ ] **Gate exists and is RED on `e3cc230` before any fix** — `SQUINT.probe()`
      reports the four audit values (0/255 by phase; 0.00769/0.00769;
      0.562/0.187; 0.0076) — then GREEN after.
- [ ] Period-2 stripes at 2 LEDs/px, grid on/off, blur on/off, pan 0/.25/.5/.75:
      mean sRGB **188 ± 2** at every phase (grid off) — the audit's fixture.
- [ ] Phase sweeps at **1.1, 1.5, 2, 4, 8 LEDs/px**, H/V stripes + checkerboard:
      integer-period cases within 2 codes of 188 at all phases; non-integer
      cases within the **error budget (≤ 2 sRGB codes)** of an independent CPU
      footprint integral (§Architecture, Task 6). Blur on and off.
- [ ] 130→2 impulse: `[1/65, 0]` within half-float; boundary impulses on both
      sides of every final boundary for random `(cw,dw)` incl. ratios just above
      64:1 and mixed-axis: Node oracle exact (< 1e-9) for the **stage rule**, GPU
      within half-float per output pixel.
- [ ] 2-texel alpha magnify: interior `(0.75,0,0)` and `(0.25,0,0)` exact;
      changing fully-transparent RGB never changes any output.
- [ ] Dark codes 10/31 at 8-bit, 5 % drive, one LED each, `decim=1`: mean
      **0.0038147** (quantise-then-average). With the memory fallback forced
      (`decim=2`): the readout AND the export caption carry the approximation flag.
- [ ] **Byte-identity, stated honestly:** geometry, captions, filenames, build
      plan, hint text — identical to `e3cc230` for every preset. Simulation
      pixels identical (≤ 1 sRGB code, from half-float/fixed-point weight
      differences) for every view with `cell ≥ 1` and `decim = 1`. **Every view
      with `cell < 1` changes on purpose — that is the fix.** The audit's
      minification fixture is the receipt.
- [ ] `selftest()` byte-for-byte untouched; still 188 ± 6 / ≈ 0.1 %.
- [ ] `grab()` never silently clamps; an allocation the GPU cannot make refuses
      in-frame (toast + caption) rather than rendering a different grid.
- [ ] README.txt/README.md claims corrected; KNOWN SIMPLIFICATIONS updated with
      receipts; vault briefing + Documentation pass-1 wording corrected.
- [ ] Gate green per `context/PROJECT.md` (updated to include the Node stage-rule
      test and `SQUINT.probe()`); `index.html` same blob; live hash == local;
      `probe()` green **on the hosted copy**.

## Scope
**In:** the four defects; the gate; `grab` clamp → refusal; the decim fallback's
honesty flags; docs; v1.3 notes with disclosure. **Out (recorded):** tiling the
native field for walls beyond the buffer (fallback stays, flagged); view B's
tile geometry (F3); supersampled masked-field integration unless Task 6's
budget forces it; blur-footprint/margin audits and the model improvements the
audit lists as "investigations, not defects"; any change to `selftest()`.

## Affected Areas
- `pipeline` — `FS_REDUCE` (bin offset uniform), `FS_COPY` (bilinear of
  premultiplied taps), `boxTo` (stage rule + opts), `renderView` (native
  quantisation, display-footprint reduce, refusal), `grab`, new constants.
- `state` — none in `S`; new `GLE` constants/exports.
- `outputs` — readout decim line; export caption flag line.
- `selftest` — untouched; **new** `probe()` beside it, exported; `renderView` exported.
- `docs` — README.txt (3 sites), README.md (1), vault briefing + Documentation,
  PROJECT.md gate.
- `tools/` — new Node stage-rule test; new Playwright render probe.

## Architecture Notes

**The pipeline after this slice (real branch, `renderView`):**
```
0  upload           srcTex  SRGB8_ALPHA8, LINEAR                     (unchanged)
1  source → content boxTo(src → r.w × r.h)  FULL native crop, aligned stages
                    [processor on: src → feed → content, both boxTo]
   ↳ memory fallback: if max(cw,ch) > NATIVE_CAP or cw·ch > NATIVE_TEXELS,
     decim = ceil(...) exactly as today — and the frame is FLAGGED (readout +
     export caption). Never silent.
2  place            led  cw×ch  NEAREST                                (uDecim=1 unless fallback)
3  quant            q    cw×ch  NEAREST   ← at NATIVE resolution (#4)
4  NEW if cell<1    disp = boxTo(q, cw,ch → round(cw·cell) × round(ch·cell),
                    {offX,offY: fragment-aligned bins, outNearest:true})   (#1)
5  comp             FS_COMP samples q (cell≥1) or disp (cell<1): uDecim = decim
                    or 1/cell, uLedSize = the sampled texture's size — NO shader
                    change to the sampling line; cov1 keeps integrating the mask
6  blur, present    unchanged
```

**Why this shape.** The ideal branch already area-averages to the display
footprint (`boxTo(src → r.w·cell × r.h·cell)`, :1127-1129); #1 is the same move
applied to the *quantised* LED field. `cov1` (:804-809) already integrates the
lit-area mask over the fragment footprint `w = 1/uCell` and converges to `fill`,
which `uGain = 1/fill` cancels — so when `col` becomes a footprint average the
composite's maths stays right. The two point-evaluated terms that remain —
tile-variance cabinet index (:842) and the array-gap test (:825) — become ≤ 1-px
boundary approximations at `cell < 1` (interior fragments of a cabinet get the
right gain). Recorded as a stated simplification, not hidden.

**Fragment-aligned bins, not "reduce then point-sample".** A plain integer
pre-decimation re-introduces a phase error (the bins start at the crop's integer
LED origin, fragments start at a sub-pixel screen offset). `FS_REDUCE` gets one
new uniform `uS0` (fractional bin origin in source texels, default 0 →
byte-identical for every existing caller); `boxTo` gains an `opts` argument
`{offX, offY, outNearest}`; the display reduce passes the sub-pixel phase so
texel `j` covers exactly the LEDs under screen pixel `j`. The composite then
reads NEAREST, one texel per fragment, zero phase error.

**#3 as a shader edit, not a buffer.** Replace `FS_COPY`'s LINEAR branch with a
manual bilinear of four `texelFetch` taps each passed through `ovb()` first —
`p = vUV·uSrc − 0.5`, `f = fract(p)`, clamp to edge — i.e. premultiply *then*
interpolate, exactly what the audit asks for, with zero extra memory and it
covers video too. The audit's prototype (an identity `P.reduce` pass at upload
into an opaque RGBA16F buffer) is the documented fallback if the gate shows any
mismatch; it costs a source-size half-float texture (66 MB at 4K) per upload and
does not cover per-frame video. `FS_PLACE` (:773) samples `content`, which is
alpha-1 by construction — that invariant is now stated in a comment.

**#2 as a pure function.** `reduceStages(sw, dw)` returns the stage widths under
`nw = max(dw, dw·ceil(cw/(64·dw)))` — every intermediate an integer multiple of
`dw`, every stage ratio ≤ 64 (proof: `nw ≤ cw/64 + dw < cw` when `cw > 64·dw`).
`boxTo` iterates it. Being top-level and pure, `tools/test-cabinets-node.js`'s
`grab(name)` extractor lifts it into Node against the oracle. When
`cw ≤ 64·dw` the rule yields one stage = today's behaviour → byte-identical.

**#4 by re-gating `decim`.** Today `CROP_CAP = 4096` (:489) caps `lw/lh` and
forces average-then-quantise at exactly the sizes where it hurts. New
`NATIVE_CAP = min(MAXTEX, 8192)` per axis and `NATIVE_TEXELS = 24e6` (192 MB
RGBA16F): every shipped 12×6 preset (≤ 43 MB) and the 24×24 worst case (5544×3119
= 17.3 M texels, 138 MB) quantise at native. Beyond that the old fallback
runs and **says so** — readout line reworded to "LED grid averaged N:1 BEFORE
quantisation — wall exceeds the native buffer; dark-grade banding is
approximate at this size", and the same flag appended to the export caption's
settings line (the client-facing artifact must carry it). `POOL_BYTES` rises to
512 MiB so two native fields (A/B mode) plus scene buffers fit without churn;
`grab()` throws instead of clamping, and `renderView` catches GL allocation
failures into a refusal (toast + a `failed` flag on the returned geo that
`composeExport`/`exportTemplate` refuse on).

**Honesty traps carried in (same species as the CSF-filter warning):**
1. *"Simply making the LED texture LINEAR"* would blur emitters when zoomed in.
   Not done — `led`/`q` stay NEAREST; the reduce happens only when `cell < 1`.
2. *A preview path that differs from the exact path* is the "two answers under
   one name" failure. The display reduce IS the exact path at `cell < 1`; the
   fallback is flagged in the frame, never silent.
3. *Comparing two paths that share `boxTo()`* can miss a shared defect. Every
   `probe()` expectation is computed independently in JS (closed form for the
   stripe means; a 64-sub-sample-per-LED numerical footprint integral for the
   grid-on and non-integer cases); the Node oracle is double precision.
4. *Do not quantise the source, and do not reduce levels as a function of
   `decim`* (audit). The quantiser's inputs are unchanged; only its resolution.

**Blast radius.** Every zoomed-out view changes (the point). `cell ≥ 1` views:
≤ 1 sRGB code from #3's weights when content is magnified. `selftest` untouched.
Memory: up to +138 MB per view on the largest realistic wall; `POOL_BYTES` raised.
Rollback: revert the slice's commits; no state, no schema.

## Implementation Tasks

### Task 1: The gate, RED first — `renderView` export + `SQUINT.probe()`
**Files:** `squint.html` (~:1966 export literal; new function beside `selftest` ~:2140)
**Type:** Modify + Create
**Description:** Add `renderView` to the `window.SQUINT` literal. Add
`probe(opts)` — never called at boot, exported — that: snapshots `{...S}`
(shallow copy; `selftest`'s `keep` list omits `wallMode`, `cabI…`, `monDist`,
`ppmmCss`), runs the fixtures below strictly sequentially (`uploadSource` owns
ONE texture), restores with `Object.assign(S, snap); draw();`, and returns
`{pass, checks:[{name, value, expected, tolerance, pass}]}` — the `selftest`
shape. Never touches `document.body`; no preview gallery.
Fixtures, lifted from the audit runner (`context/reviews/2026-09-06-pixel-audit-fixtures/…html:2151-2180`), expectations computed **in JS, independently**:
1. `reduction`: 130×1 unit-red impulse at 64 → `boxTo(…,2,1)`; expect `[1/65, 0]`, tol half-float (1e-3 abs).
2. `reduction-boundaries`: for 12 deterministic `(cw,dw)` pairs incl. `cw>64·dw`
   and odd sizes, impulses at `floor(j·cw/dw) − 1` and `floor(j·cw/dw)` for each
   final bin `j`: expect the impulse entirely in one output bin (value `dw/cw`
   weight), tol half-float. Plus one mixed-axis case.
3. `alpha`: 2×1 `[(1,0,0,1),(0,1,0,0)]` → magnify to 4: expect `[1,0,0][.75,0,0][.25,0,0][0,0,0]` exact; then `alpha-invariance`: same with transparent texel RGB `(1,1,1,0)` → identical output.
4. `quantisation`: codes 10/31 one LED each, 8-bit, 5 % drive: `quant(native)` then
   `boxTo→1` = `0.003814697265625`; also assert the readout flag string is
   ABSENT at `decim=1` and PRESENT when `opts.forceFallback` lowers `NATIVE_CAP`
   (a `GLE.setNativeCap(n)` hook for the probe only, restored after).
5. `minification`: the audit's 2000×20 stripes, `renderView(cv,1,false,{w:1000,h:10})`,
   `grid∈{0,1}×blur∈{0,1}×panX∈{0,.25,.5,.75}` → mean sRGB of the interior
   row, expect `255·toSrgb(0.5) = 187.52`, tol 2 codes (grid off) / 2 codes
   (grid on, integer period).
6. `phase-sweep`: LEDs/px `∈{1.1,1.5,2,4,8}` (set via `wallW`/`pitch`/canvas
   width so `cell = 1/k`), patterns: V stripes, H stripes (20×2000, `{w:10,h:1000}`),
   2-D checkerboard; phases 0/.25/.5/.75 px; blur off and on; grid off and on.
   Expectation = numerical footprint integral of `value(LED)·mask(LED,fill)` at
   64 sub-samples per LED along each axis, evaluated per display pixel for the
   fragment's exact footprint, then `toSrgb`; assert `|Δ| ≤ 2` codes per pixel
   (mean AND max over the interior). Record max Δ per case in the result —
   Task 6 reads it.
Run `probe()` on `e3cc230` first and **file the red result** in the plan's
Execution findings — the gate must be seen to fail before it is trusted.
**Depends on:** none

### Task 2: `tools/test-reduce-stages-node.js` + `reduceStages()` (#2)
**Files:** `squint.html` (:972-995 `boxTo`, new top-level `reduceStages`), `tools/test-reduce-stages-node.js`
**Type:** Create + Modify
**Description:** Add top-level
```js
// Stage widths for an exact chained area reduce sw -> dw: every intermediate
// is an integer multiple of dw, so no intermediate texel straddles a final
// boundary, and every stage ratio is <= 64 (nw <= cw/64 + dw < cw).
function reduceStages(sw, dw){ const out=[]; let cw=sw;
  while(cw>dw){ cw=Math.max(dw, dw*Math.ceil(cw/(64*dw))); out.push(cw); } return out; }
```
`boxTo` iterates `reduceStages(cw,dw)` for X then `reduceStages(ch,dh)` for Y
(same `step()` calls). The Node test extracts `reduceStages` via the existing
`grab(name)` mechanism and asserts, over the audit's 500 deterministic random
`(cw,dw)` pairs plus the impulse cases: (i) last stage == `dw`; (ii) every
ratio ≤ 64; (iii) a double-precision overlap-weighted chain over those stages
equals the direct box filter to `< 1e-9` per output pixel; (iv) the OLD rule
(`ceil(cw/64)`) is shown to fail case (iii) — a red-proof row. Tally line
`N passed, M failed`, exit code tied to it.
**Depends on:** Task 1 (so the GPU `reduction` rows go green in the same commit)

### Task 3: `FS_COPY` — premultiply per tap, then interpolate (#3)
**Files:** `squint.html` :754-761
**Type:** Modify
**Description:** Replace the LINEAR branch body:
```glsl
// Premultiply EACH texel over black in linear light, THEN interpolate --
// hardware LINEAR blends straight RGB and A separately, so a transparent
// texel's hidden colour leaks and the opaque neighbour darkens (round-3's
// ovb() sat after the filter; this puts it before). Manual bilinear with
// CLAMP_TO_EDGE semantics: texel centres at +0.5.
vec2 p=vUV*uSrc-0.5; vec2 f=fract(p); ivec2 i0=ivec2(floor(p)), mx=ivec2(uSrc)-1;
vec3 c00=ovb(texelFetch(uTex,clamp(i0,ivec2(0),mx),0));
vec3 c10=ovb(texelFetch(uTex,clamp(i0+ivec2(1,0),ivec2(0),mx),0));
vec3 c01=ovb(texelFetch(uTex,clamp(i0+ivec2(0,1),ivec2(0),mx),0));
vec3 c11=ovb(texelFetch(uTex,clamp(i0+ivec2(1,1),ivec2(0),mx),0));
oCol=vec4(mix(mix(c00,c10,f.x),mix(c01,c11,f.x),f.y),1.0);
```
Keep the `uNearest==1` branch. Add a comment at `FS_PLACE` :773 stating the
alpha-1 invariant of `content`. Gate rows 3 go green. If any GPU mismatch
survives, fall back to the audit's identity-`P.reduce` precompose at upload
(prototype at fixtures html:2164-2166), documented as such.
**Depends on:** Task 1

### Task 4: Native quantisation + honest fallback + no silent clamp (#4)
**Files:** `squint.html` :489 (`CROP_CAP`), :903 (`grab`), :925 (`POOL_BYTES`), :1147-1195, :1477-1478, `composeExport` caption (~:1943-1949), `exportTemplate` (~:2015), `GLE` return (~:1011)
**Type:** Modify
**Description:**
1. Replace `CROP_CAP` with `NATIVE_CAP = 8192` and `NATIVE_TEXELS = 24e6`;
   `capTex = min(NATIVE_CAP, MAXTEX)`; `decim = max(ceil(max(cw,ch)/capTex), ceil(sqrt(cw·ch/NATIVE_TEXELS)))`.
   Export `GLE.setNativeCap(n)` (probe-only) and `GLE.poolBytes`.
2. With `decim = 1` (the normal case now): `tgtW = round(r.w)`, `tgtH = round(r.h)`;
   `led`/`q` at `cw×ch`. With `decim > 1`: exactly today's path.
3. `grab()`: throw `Error('texture ' + w + 'x' + h + ' exceeds MAX_TEXTURE_SIZE ' + MAXTEX)` instead of clamping.
   `renderView` wraps the GPU section in `try/catch`: on failure clear to black,
   `toast('GPU could not allocate this wall at this size — zoom in or reduce the wall')`,
   return geo with `failed:true`. `composeExport` and `exportTemplate` refuse when
   `geoA.failed`.
4. `POOL_BYTES` 384 → 512 MiB (two native fields + scenes in A/B without churn).
5. Readout :1477-1478 reworded to the honest fallback text; `composeExport`
   appends ` · LED grid averaged ${decim}:1 before quantisation (approximate)`
   to the settings line when `geoA.decim > 1`.
Gate row 4 green; `probe({forceFallback:true})` shows the flag.
**Depends on:** Task 2 (aligned stages feed the native reduce)

### Task 5: Display-footprint reduce when `cell < 1` (#1)
**Files:** `squint.html` `FS_REDUCE` :725-751 (`uS0`), `boxTo` :972-995 (`opts`), `renderView` :1195-1217, `FS_COMP` uniforms only
**Type:** Modify
**Description:**
1. `FS_REDUCE`: add `uniform vec2 uS0;` and use `s0 = uS0.x + d.x*r` (X) /
   `uS0.y + d.y*r` (Y). Default `(0,0)` from every existing caller → identical.
2. `boxTo(inTex,sw,sh,dw,dh,nearest,opts)`: `opts.offX/offY` (source-texel
   fractional bin origin, only on the first stage of each axis — subsequent
   stages are aligned by construction), `opts.outNearest` (final target filter).
3. `renderView`, after `q`: if `cell < 1`:
   `dispW = round(cw*cell)`, `dispH = round(ch*cell)`; the LED-space left edge of
   screen pixel `xs0 = ceil(ox)` is `xw0 = (xs0−ox)/cell` (fractional LEDs);
   `offX = (xw0 − x0)/decim` in `q`-texel units (same for Y); `disp =
   boxTo(q.t, lw, lh, dispW, dispH, false, {offX, offY, outNearest:true})`.
   Composite with `uTex = disp`, `uLedSize = (dispW,dispH)`, `uDecim = 1/cell`,
   `uCropOrigin = (xw0, yw0)`. Give `disp` after the pass. If `cell ≥ 1`: today's
   uniforms (`q`, `lw×lh`, `decim`, `(x0,y0)`).
4. Add to the returned geo: `dispReduce: cell<1`.
5. Comment in `FS_COMP` at :829: *"uTex is the LED field at ≥ 1 texel per
   fragment: q when magnified, the fragment-aligned box reduce of q when
   minified (renderView). cov1 integrates the mask over the same footprint."*
   Note the two remaining point-evaluated terms (tile index, array gap) and the
   ≤ 1 px boundary consequence at `cell < 1`.
Gate rows 5 and 6 (integer periods) green.
**Depends on:** Task 4

### Task 6: Error budget on the mask coupling — measure, then decide
**Files:** plan Execution findings; possibly `renderView`/`FS_COMP`
**Type:** Measure
**Description:** Task 5 approximates the footprint integral of `value×mask` as
`mean(value)×mean(mask)` — exact whenever LED values are locally constant,
in error only for single-LED features straddling a footprint edge. The
phase-sweep rows at 1.1 and 1.5 LEDs/px with grid ON report max Δ against the
64-sub-sample integral. **If max Δ ≤ 2 sRGB codes: accept, record the measured
bound in README's KNOWN SIMPLIFICATIONS with the receipt.** If it exceeds:
escalate to rendering the masked LED field at 2× LED resolution (a `P.mask`
pass applying `cov1` with `w = 0.5` into a `2cw×2ch` buffer) and reducing THAT
— memory ×4, so only if forced. Do not skip this measurement.
**Depends on:** Task 5

### Task 7: Playwright render probe + PROJECT.md gate
**Files:** `tools/pw-render-probe.js`, `context/PROJECT.md`
**Type:** Create + Modify
**Description:** `pw-render-probe.js` (the `pw-cabinet-rows.js` pattern: reload →
fingerprint (`/reduceStages/.test(SQUINT.GLE.boxTo.toString())`) →
`SQUINT.probe()` → JSON), plus one end-to-end row: load a generated period-2
stripe PNG, `zoomMode='fit'`, click **Save comparison PNG**, intercept the
download, decode it and assert the wall region's mean is 188 ± 2 — the
client-facing artifact, not a framebuffer. PROJECT.md fast checks gain
`node tools/test-reduce-stages-node.js squint.html` and `SQUINT.probe()`
(must return pass with every `|Δ| ≤ tolerance`); the selftest-blindness
paragraph gains: *"and it cannot see sampling defects either — `probe()` can"*.
**Depends on:** Tasks 1-5

### Task 8: Docs and honesty surfaces
**Files:** `README.txt` :43-49, :229+ (KNOWN SIMPLIFICATIONS), :286; `README.md` :38; vault `SQUINT — architecture briefing` pass 1/3, `SQUINT — Documentation` :164-165; `index.html`
**Type:** Modify
**Description:**
- README.txt :43-49: replace "repeated exact 2x2 averages, then one
  area-weighted pass" (stale since `f0b6ca3`) with the truth: *"an exact
  separable area reduce — each axis in stages of at most 64:1 whose sizes are
  integer multiples of the target, so the chain is exactly the direct box
  filter"*, and add: *"When the wall has more LEDs than your screen has pixels
  for it, the quantised LED field is area-averaged onto the screen the same
  way — one LED is never allowed to stand in for several."*
- README.md :38 → "…by an exact box filter, and the quantised LED grid is
  area-averaged onto your screen when it is smaller than the wall".
- KNOWN SIMPLIFICATIONS, new bullets with receipts: (a) walls beyond the native
  buffer (`NATIVE_CAP`/`NATIVE_TEXELS`) are averaged before quantisation and
  flagged in the readout and the export caption; (b) at zoom-out, cabinet-
  variance and array-gap edges are per-pixel (≤ 1 px); (c) Task 6's measured
  mask-coupling bound; (d) video with an alpha channel is interpolated by the
  hardware sampler (stills are premultiplied per tap).
- README.txt :286 (cheap-scaler local range 247 vs 7): re-measure at the same
  view; keep or correct.
- Vault briefing: pass 1 wording + a pass 3b line; Documentation :164-165
  decim rationale corrected (both halves of round 1's justification were
  wrong: `decim>1` was not the only `cell<1` case, and averaging-before-quant
  was not harmless).
- Mirror `index.html`.
**Depends on:** Tasks 1-7

## Validation
Every probe below returns a number only the correct code can produce. Gate
first, red first.
1. **Targeted, Node:** `node tools/test-reduce-stages-node.js squint.html` →
   tally `N passed, 0 failed`, incl. the red-proof row for the old rule.
2. **Targeted, browser (console on the built file):** `SQUINT.probe()` →
   `pass:true`; print the `checks` table; on `e3cc230` first: expect the four
   audit values (record them). `SQUINT.selftest()` → 188 ± 6 / ≈ 0.1 %, unchanged.
3. **Full gate:** PROJECT.md fast checks (mirror parity, selftest, probe, Node
   tests); `tools/pw-render-probe.js` incl. the exported-PNG mean.
4. **Drift/build guards:** `cmp squint.html index.html`; same blob after commit;
   live hash == local after Pages; `SQUINT.probe()` on the **hosted** copy.
5. **Manual:** open the test card at *Fit* and at eye-match 5 m before/after: the
   stripe bursts should read as even grey/structured, not flip with a 1-px
   pan; a 1920 transparent-edged PNG on a 2304 wall shows no colour fringe at
   the edge; a dark ramp at 8-bit/20 % drive shows the same band count zoomed
   in and out. Numbers the briefing says must hold: 40 levels full drive / 9 at
   20 % (re-measure — the quantiser's placement changed).

## Downstream impact
- **v1.3 release notes must disclose**: v1.0–v1.2 point-sampled the LED grid
  when zoomed out, so fine LED-scale detail (hairlines, small text edges, stripe
  bursts) could alias — including in the exported comparison PNG at *Fit*. The
  measure-box legibility maths was not affected; the picture was. Same register
  as the v1.1 disclosure.
- **jono_301**: the posted/drafted reply says "the legibility side wasn't
  affected" — still true of the verdict maths; add one line when v1.3 ships
  ("the zoomed-out picture is now averaged properly — re-download").
- `context/PROJECT.md` gate grows two commands; `tools/` becomes tracked (Mish's
  call, pending since handover E).
- The briefing's "numbers that must hold" list gains the probe's expectations.

## Follow-ups (declared)
- **F5** tile the native field so walls beyond `NATIVE_TEXELS` also quantise at
  native (removes the fallback).
- **F3** (carried) view B's tile px at B's pitch — the tile-variance hash and
  grid should use physical cabinet size / view pitch.
- **F6** blur-footprint margin and `sigma>8` transition fixtures (audit's
  "investigations" table).
- **F7** per-LED tile gain applied before the display reduce (removes the ≤ 1 px
  boundary approximation).

## Rollback
Each task is its own commit on `main`; revert in reverse order. No `S` keys,
no persisted state. The gate (Task 1) can stay even if a fix is reverted — a
red `probe()` is information, not a regression.

## Open questions before `/execute`
1. **`NATIVE_TEXELS = 24e6` / `POOL_BYTES = 512 MiB`** are sized for this
   RTX 4090 and the 24×24 worst case; a laptop iGPU with `MAX_TEXTURE_SIZE 4096`
   falls back (flagged) at any wall over 4096 LEDs wide. Acceptable? The
   alternative is F5 now.
2. **Error budget 2 sRGB codes** for Task 6 — Mish's number to set; it decides
   whether the 4×-memory masked-field path is built in this slice.
3. **Disclosure wording** in v1.3 notes and to jono — Mish's voice.

**Decided 2026-09-06 (Mish: "use fable to decide"):** (1) ship as sized, F5
deferred — the fallback is honest and flagged; (2) per-pixel max ≤ 3 codes,
interior mean ≤ 2 — a 2-code per-pixel max would false-fail on half-float +
8-bit rounding alone; (3) drafted in his register, posted by him.

## Execution findings (2026-09-06, same session as the plan)

**Gate first, and it was red.** `probe()` on `e3cc230`: **69 of 81 rows failed**,
reproducing the audit exactly — impulse `0.00769/0.00769`, alpha
`0.562/0.187/0.0625`, minification `0.8/0/255/255` at every blur/grid
combination, per-pixel deltas of 187 codes at 1.1/1.5/4 LEDs per pixel.
Two things the red run taught: the **8 LED/px sweeps passed on the old build**
only because `cw = 8000 > CROP_CAP` tripped the old `decim` averaging (round
1's rationale, working by accident) — so Tasks 4 and 5 had to land as one
green state, as planned; and my quantisation fixture was one LED row tall,
which `FS_PLACE`'s half-open bound at `decim = 2` drops entirely (read 0, not
the audit's 21) — rebuilt as a 10-row wall.

**Task 2 + 3 (green on the real GPU):** Node oracle 9/9 with the old rule
proven red on the same impulses (426/500 random reductions differ; 1020
boundary impulses, old max error 0.0151); alpha `0.75 / 0 / 0.25 / 0` exact;
130→2 exact; 4040 boundary outputs within `5.6e-5`. The mixed-axis row's first
expectation was mine at fault (an impulse at `floor(3·300/7) = 128` straddles
bins 2 and 3) — it now takes its expectation from the separable oracle like
the 1-D rows do.

**Task 4 + 5 (72/82 green):** quantisation reads **12** (want 12.4; was 21) at
`decim = 1`; the memory fallback reports `decim = 3` under a forced 2048 cap
and `decimNote()` names it; the audit's 16 minification combinations sit at
**187** with per-pixel max 0.5; every grid-off sweep within 0.6 codes.

**Task 6 — measured, and it forced the escalation, but not the one the plan
proposed.** Grid-on error at 1.1 LEDs/px was **92 codes** per pixel (24 at
1.5×). Traced by hand: a footprint covering a sliver of a white LED *outside
its lit square* plus a black LED's lit square gets `mean(value) × mean(mask)`
= light where there is none. A 2× supersampled mask field would not fix it
(the sliver is 0.1 LED; sub-texels are 0.5 LED — still ~100 codes). **The exact
fix is cheaper than both:** fold the lit-area mask into the fragment-aligned
reduce — `FS_REDUCE` gets `uLit`, the weight of each LED becomes its *lit*
overlap with the bin, normalised by the whole footprint, so the reduce
integrates `value × mask` jointly and analytically, separably, at the same
cost; the composite then applies only the `1/fill` gain (`uGrid == 2`).
Result: grid-on per-pixel max **1.1 codes** at 1.1×, 0.3 at 1.5×, 0.5 at 2/4/8.
The plan's F7 (per-LED tile gain before the reduce) is the same move for the
remaining point-evaluated term.

**Final gate:** `probe()` **82/82** in ~0.8 s; selftest **188 / 0 %** (the fill-
drift check runs at Fit with the grid on and now goes through the lit-weighted
path — it read 0.01 % before); Node 9/9 + 91/91; **the exported PNG at Fit,
through the real Save button, decoded in-page: wall-region mean 186.97** (want
187.5; on `e3cc230` the same export was 0 or 255 by pan phase). Main view at
boot: `cell 1.183`, `decim 1`, `dispReduce false` (eye-match at 5 m on the
default wall is magnification on this monitor — Fit is `cell 0.424`,
`dispReduce true`).

**Deviations from the plan, all recorded above:** Task 6 escalated to a
lit-weighted reduce instead of a supersampled field; `probe()` exposes
`setNativeCap`, `decimNote`, `frameNote` and `reduceStages` on the handle for
the gate; `grab()` throws and `renderView` refuses via a `failed` flag on the
geo that both exports check.

### Codex round 6 — review of this slice (same day, `gpt-5.6-sol`, my brief)

Verdict as submitted: *not ready*, seven findings. It confirmed #2 closed
(re-ran the Node oracle 9/9), #3 correct, `probe()` independent (82/82 on its
own real-Chrome run), `selftest()` byte-identical, `reduceStages` sound, the
65-tap bound sufficient — and found five real defects of mine plus two fair
gaps. All fixed in the same working tree:

1. **Med — partial leading fragment.** `xs0 = ceil(ox)` dropped `floor(ox)`,
   which then clamped to its neighbour's integral (an impulse in LED column 0
   at pan .25 read **0**, not ~188). Fixed by including `floor(ox)` and making
   `FS_REDUCE` count taps outside the source as **dark** (skipped, normalised
   by the full bin width) — the physically right "outside the wall" for both
   edges. Probe row: pixel 0 now **188**, pixel 1 **0**.
2. **Med — above 64 LED texels per fragment the point sample returned
   silently.** Reachable at eye-match ~200 m on a fine pitch, not only tiny
   canvases (my "under ~128 px" was the Fit condition only). Fixed: 129 taps
   (exact to 128 LEDs/px), beyond that an integer m:1 lit-weighted stage plus
   the fragment-aligned stage, flagged in-frame and on the export
   (`frameNote`: "two stages, ≤ 3 % at pixel edges"). Probe: 160 LEDs/px →
   noted, and period-2 stripes still **187**.
3. **Med — the fallback applied the lit mask per DECIMATED texel** (wrong
   period). Fixed: mask folding only at `decim = 1`; the fallback keeps `cov1`
   in the composite and `decimNote` says "LED structure approximate". Probe:
   constant field, native vs forced fallback, **0** difference.
4. **High — A/B and wipe exports checked only panel A.** Fixed: every panel
   in the artifact (`geoA`, `geoB`, the wipe's new `geoI`) is checked for
   `failed`, and each panel's `frameNote` is drawn with a `B:` / `reference:`
   prefix.
5. **Med — allocation refusal stranded checked-out textures.** Fixed:
   `boxTo`/`reduceTo` give back their intermediate on throw; `renderView` keeps
   a held-set and returns everything on refusal. Probe: `boxTo` past
   `MAX_TEXTURE_SIZE` throws and pool bytes are unchanged.
6. **Med — gate coverage vs the audit's own bullets.** Added: transparent
   black, half-alpha edge, the reduce path with a transparent texel, a
   precomposited-equivalent equality, a pan/zoom sweep of the quantisation
   wall, the 8192/8193 buffer edge, period-2 H/checkerboard at 2 LEDs/px,
   blur-on over a non-constant field, the leading-fragment row, the fallback
   mask row, the coarse-path rows. **82 → 116 rows.**
7. **Med — the caption note could be clipped.** Fixed: notes get their own
   wrapped orange line(s) with reserved height (`H += 8 + 20·lines`).

Also taken from its "confirmed correct" notes: the README video-alpha bullet
was wrong — stills and video share the same shaders, so the per-tap
premultiply covers both — removed; README.md's unconditional "one LED never
stands in for several" qualified with the fallback clause. Left as documented:
`NATIVE_TEXELS` is a ceiling-then-product bound (24 004 000 in its example),
and the pool budget bounds idle retention, not total working memory.

**Final gate after round 6:** `probe()` **116/116** (~1 s); selftest **188 /
0.01 %**; Node 9/9 + 91/91; `index.html` mirrored. Review filed verbatim at
`reviews/2026-09-06 codex round 6 - render-honesty slice.md`.
