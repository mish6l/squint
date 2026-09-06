# SQUINT — pixel simulation audit, tests, and algorithm improvements

Date: 6 September 2026.

**Verdict: fix the sampling pipeline before adding more simulation features.** This deeper audit found four reproducible numerical defects: screen minification aliases LED colours, repeated box reductions do not always equal an exact box filter, transparent colours can leak during magnification, and level-of-detail averaging happens before nonlinear quantisation. These are broader pipeline findings, not claims that the cabinet-height change introduced them. No production code was changed.

## What was actually tested

The earlier cabinet review used a stub browser. This follow-up ran the real application shaders and, for the minification test, the real `renderView()` pipeline in headless Chrome with **WebGL2 through ANGLE/SwiftShader**. Shader compilation and execution succeeded; the final GL error was zero. This is real browser/shader execution on a software graphics backend, not a physical-GPU validation. The reported texture limit was 8192.

The reviewed source is the snapshot read at HEAD `de03ca0` (`Mark the cabinet plan shipped`), SHA-256 `B2694B66363F2D227FBD894C9623F28F05094B95892F2922A5E723A7A238E438`. This differs from the earlier cabinet-review snapshot. The source hash was rechecked after testing and remained unchanged. Line references below refer to this snapshot of `D:/Mishal/Claude Code/SQUINT/squint.html`.

Included artifacts:

- [Standalone browser test page](SQUINT-pixel-regression-tests.html): a self-contained copy of the tested application plus the audit fixtures. Open locally in a WebGL2-capable browser; it displays JSON results. It does not modify the repository or upload content. Its bootstrap is replaced with the test runner, so it is not a test of the normal startup sequence.
- [Recorded shader results](SQUINT-pixel-test-results.json).
- [Visual reproduction](pixel-simulation-phase-comparison.png).

The test page contains experimental checks of two proposed fixes, but leaves the original application functions unchanged. It is an audit fixture, not a patched release.

## 1. High: multiple LEDs per screen pixel can become black or white instead of grey

**Evidence:** `squint.html:829`, `squint.html:833`, `squint.html:1151`, `squint.html:1179`.

The LED crop uses nearest-neighbour sampling. The composite shader reads one LED colour:

```glsl
col = texture(uTex, uv).rgb;
```

It then multiplies that colour by an analytically averaged LED-gap mask. The mask coverage is integrated, but the colours of all LEDs inside the screen pixel are not. `decim` only grows when the visible crop exceeds 4096 pixels; it is not an adequate antialiasing rule for a smaller wall viewed at reduced scale.

### Reproduction

Use 2000 × 20 alternating black/white vertical LED stripes, a 2 × 0.02 m Free-size wall at 1 mm pitch, Stretch mapping, and a 1000 × 10 render viewport. There are exactly two LEDs per display pixel (`cell = 0.5`, `decim = 1`). Disable processor limits, tile variance, ambient wash, and quantisation to isolate the operation. The interior should average to linear 0.5, approximately sRGB **188/255**, at every horizontal phase.

Measured interior values with **LED gaps and eye blur both enabled**, at a 20 m viewing distance:

| Horizontal pan | Actual mean sRGB code | Expected |
|---|---:|---:|
| 0.25 device pixels | ~0.005 | ~188 |
| 0.75 device pixels | 255 | ~188 |

The same failure occurs with gaps disabled and with blur disabled. Sixteen combinations of pan phase, gap visibility, and blur were executed. Fractional phases near sampling boundaries also produce unstable mixtures; the two above give the cleanest reproduction.

![Observed minification error](pixel-simulation-phase-comparison.png)

**Why blur does not fix it:** the scene is already aliased before the blur pass. Blurring an incorrectly sampled all-white or all-black image cannot reconstruct the missing average.

### Recommended algorithm change

Integrate the **emitted linear-light signal over the display-pixel footprint before final sampling**, including the LED values and their lit-area mask. Conceptually:

```text
display-pixel radiance =
  integral over footprint of [LED radiance × lit-area mask × tile gain]
  divided by footprint area
```

For small footprints, intersect nearby LED emitter rectangles analytically. For large footprints, use a prefiltered radiance representation or another area-integration method with an explicit error budget. Retain sharp per-LED boundaries under magnification. Simply changing every texture to LINEAR is not a complete fix: bilinear filtering has a limited footprint and can blur individual emitters when zoomed in.

**Required regression:** phase-sweep alternating stripes at 1.1, 1.5, 2, 4, and 8 LEDs per display pixel. Include horizontal/vertical stripes and checkerboards. Exact integer-period fixtures should preserve their expected mean across pan phases; noninteger footprints should match an independent footprint integral. Validate with blur both on and off.

## 2. Med: chained box reductions leak energy across final pixel boundaries

**Evidence:** `squint.html:972`–`984`, especially:

```js
while (cw > dw) step(Math.max(dw, Math.ceil(cw / 64)), ch, 0);
```

Each individual reduction computes an overlap-weighted average. However, an intermediate pixel can straddle a final output boundary. Once its two sides have been averaged, a later pass cannot separate them. Therefore, a chain of individually correct box filters is not necessarily the direct box filter claimed by the comments.

### Reproduction

Create a 130 × 1 image with one unit-red texel at index 64 and all other texels black; resize to 2 × 1. The current chain is **130 → 3 → 2**.

| Output | Exact direct integration | Actual shader result |
|---|---:|---:|
| First red value | 1/65 = 0.015384615… | 0.0076904296875 |
| Second red value | 0 | 0.0076904296875 |

The impulse belongs entirely to the first final pixel. The current chain distributes it almost equally between both. Total energy is approximately conserved, so a mean-brightness test alone misses the error.

### Recommended algorithm change

Keep intermediate dimensions aligned to the **final output bins**. A candidate reduction size for one axis is:

```js
const nextWidth = Math.max(dw, dw * Math.ceil(cw / (64 * dw)));
```

All intermediate widths remain integer multiples of the final width; final boundaries therefore remain aligned throughout the chain. Apply the same reasoning independently to height. Handle target allocation limits explicitly rather than relying on silent clamping.

**Prototype evidence:** the existing shaders, using **130 → 4 → 2**, returned `[0.015380859375, 0]`, consistent with the expected value within half-float rounding.

An independent double-precision overlap-integral oracle also tested **500 deterministic random reductions**. The current stage-selection rule differed from the direct reference in 436 cases, with a maximum absolute channel error of ~0.06414. The proposed aligned rule's maximum error was `4.44e-16`. These random tests validate the arithmetic strategy in CPU double precision; they are not 500 GPU runs.

**Required regression:** impulses immediately on either side of every final boundary, random inputs, odd dimensions, reductions just above 64:1, and mixed-axis resizing. Compare each output pixel, not just the overall mean.

## 3. Med: transparent colours are interpolated before compositing onto black

**Evidence:** `squint.html:714`, the `FS_COPY` shader around `squint.html:754`, and `boxTo()`'s final copy pass around `squint.html:993`.

The expression:

```glsl
ovb(texture(uTex, vUV))
```

samples/interpolates RGB and alpha first, then multiplies the interpolated RGB by interpolated alpha. When the source is straight-alpha colour, this is not equivalent to filtering the colour already composited onto black. The reduction path samples original texel centres and often avoids the problem; direct magnification does not.

### Reproduction

Magnify two texels to four:

```text
texel 0: opaque red       (1, 0, 0, 1)
texel 1: transparent green (0, 1, 0, 0)
```

At the first interior output sample, the correct linear RGB over black is `(0.75, 0, 0)`. The shader produced **`(0.5625, 0.1875, 0)`**. Invisible green has become visible, and the red contribution is too dark. Transparent black also exposes the darkening problem; hidden coloured RGB is not required for a defect.

### Recommended algorithm change

Decode source texels to linear light and composite/premultiply **before any interpolation**. For the current black-background model, an explicit texel-centred conversion pass can write opaque `(linearRGB × alpha, 1)` into the first intermediate texture. All later resampling then operates on the correct signal.

Do not substitute gamma-space premultiplication for this step. Preserve the operation order: decode RGB, multiply by alpha in linear light, then filter.

**Prototype evidence:** a texel-centred precomposite pass followed by the existing magnification shader returned the expected interior values `(0.75, 0, 0)` and `(0.25, 0, 0)` exactly in this fixture.

**Required regression:** transparent black/white/coloured padding, partially transparent edges, gradients, magnification, reduction, and comparison with an equivalent source explicitly composited onto black in linear light. Changing fully transparent RGB should never change the result.

## 4. Med: changing level of detail changes the quantisation result

**Evidence:** `squint.html:1151`, `squint.html:1168`, and `squint.html:1187`–`1195`.

For `decim > 1`, the renderer averages the source to a coarser LED representation before applying the bit-depth/drive quantiser. Quantisation is nonlinear:

```text
quantise(average(LED values)) != average(quantise(each LED value))
```

An internal performance choice can therefore change emitted brightness and banding instead of merely reducing spatial detail.

### Reproduction using the actual shaders

At 8 bits and 5% drive, the current formula selects 12 quantisation intervals. Use adjacent grayscale source codes **10 and 31 out of 255**, each mapped to one native LED.

| Operation order | Mean linear output |
|---|---:|
| Quantise each LED, then average | 0.003814697265625 |
| Average, then quantise | 0.00762939453125 |

The coarse-first path is **twice as bright** for this fixture. This test compares the two real shader sequences directly; it is not a screenshot test of the 4096-pixel transition.

### Recommended algorithm change

Compute each native LED's value from the mapped content and processor feed, apply that LED's quantisation, then build any lower-resolution radiance representation. Native processing can be tiled to bound memory use.

Keep two different reductions distinct:

- Content/processor → native LED sampling legitimately occurs **before** the LED quantiser.
- Native LEDs → lower-detail preview occurs **after** the quantiser.

Do not quantise the original source before determining native LED values; that would introduce a different model error. Also, do not reduce quantisation levels further as a function of `decim`.

**Required regression:** lock a wall and signal, then vary viewport size/pan/zoom so internal decimation changes. Compare matched physical regions against quantised-native reference data. Include dark patterns near code thresholds and 4095/4096/4097 visible-pixel boundaries.

## Further audits and test coverage to add

The following are recommended investigations, not additional defects claimed as experimentally established by this pass.

| Area | Test | What it protects |
|---|---|---|
| Blur footprint | An impulse and a white edge just outside the viewport; compare against a larger render cropped afterward | Detects missing blur margins and texture-edge clamping artifacts |
| Blur scaling | Measure impulse width/energy across the `sigma > 8` downsample transition and the 96-tap radius cap | Checks the requested blur against the blur actually produced |
| Crop stability | Pan a fixed impulse or fine grid through crop-origin changes | Detects changes in the sampling lattice as `x0`, `y0`, or `decim` changes |
| GPU allocation | Assert requested and allocated dimensions throughout `grab`, `boxTo`, and uniforms, including oversized Fill-mapped content | Prevents a capped texture from silently standing in for a different grid |
| Colour pipeline | Black, white, middle-grey, saturated colours, alpha ramps, and equivalent precomposited fixtures | Verifies linear-light processing and one final sRGB conversion |
| Quantisation | Count actual levels for every bits/drive setting; test ramps and threshold-adjacent values | Checks monotonicity, endpoints, and advertised level count |
| Arrays and tiles | Impulses at screen gaps, cabinet boundaries, and array origins, with nonzero tile variance | Checks masks and gains before filtering, plus A/B physical consistency |
| Photometry | White/black measurements versus reported contrast for combinations of lux, reflectance, drive, and viewing angle | Checks that readouts and rendered relative luminance implement the same model |
| Precision | Compare float64 reference, RGBA16F execution, and final 8-bit output over dark/bright patterns | Separates algorithm errors from expected storage rounding |
| Real hardware | Repeat the suite on available physical GPU backends and at least another browser engine | Detects backend-specific precision, texture, and framebuffer behavior |
| UI/export | Real input events, self-test state restoration, image loading, PNG captions and dimensions | Tests subsystem connections absent from isolated shader fixtures |

Use independent expected values. Comparing two paths that share `boxTo()` can miss a defect shared by both. Record renderer, device-pixel ratio, source dimensions, wall state, native resolution, crop/decimation, texture dimensions, and shader settings with each failure.

Suggested initial tolerances: CPU overlap-integral comparisons at `1e-10`; GPU tests with fixture-specific half-float allowances; final 8-bit grey fixtures around 188 within two code values when no clipping is expected. These are starting test budgets, not universal accuracy guarantees. Energy, edge location, impulse spread, and phase stability need separate assertions.

## Improvements to the physical model

These are design opportunities rather than substitutes for fixing the four numerical defects.

### Calibrate the eye-blur model against spatial-frequency response

The current `sTarget = (MM_PER_M * dist * scale) / FWHM` assigns a Gaussian blur width to a nominal acuity scale. It is a useful approximation, but the conversion should be validated rather than treated as a complete model of vision. Test sine gratings and line-pair patterns at different contrasts and angular sizes; measure attenuation, not only a “visible/invisible” threshold.

The subtraction `sqrt(max(0, targetSigma² - monitorSigma²))` is internally consistent for Gaussian kernels. Its physical accuracy depends on the monitor/viewer blur assumptions. Keep these parameters explicit, and distinguish calibrated measurements from generic defaults. Wide, nearby walls also deserve a separate audit of the constant-angular-scale approximation across the wall.

### Make processor and driver behavior selectable only when backed by data

The present “good/cheap” scaler and drive-dependent level-count formula are simplified models. Useful future options include measured scaler responses, different dimming/quantisation behavior, and calibrated black level. Validate against captured ramps and spatial patterns from known hardware before assigning product-specific labels.

### Extend emitter geometry without losing energy conservation

The current fill mask models centred square emitters. Circular emitters or RGB subpixel layouts could improve close-up structure simulation if needed. Normalize each emitter footprint so changing fill alone preserves integrated emitted light; test the integrated radiance before display clipping. Camera moiré, scan timing, and PWM are separate temporal/sensor models and should not be implied by a static eye-view rendering.

### Improve performance after preserving the correct operation order

Cache source-to-linear conversion for still images, cache the quantised native LED field when its inputs are unchanged, and use a tested filtered representation for pan/zoom previews. Tile large native fields, with margins where filters require neighboring samples. Cache keys must include all signal-affecting settings; changing only the view should not rebuild unrelated source processing.

## Recommended implementation order

1. Land independent CPU/GPU regression fixtures for these four failures.
2. Fix source-alpha preprocessing and align multi-stage reduction boundaries; both have successful isolated prototypes in this audit.
3. Rework native-LED quantisation and screen-footprint integration together, preserving their order and memory limits.
4. Verify phase/crop/decimation continuity and blur margins, then test physical GPUs and actual PNG exports.
5. Only then add richer emitter, processor, or visual-acuity models.

The existing boot self-test is still useful, but it cannot cover this scope: its fusion fixture first averages the checkerboard into uniform LED values, so it never tests alternating **native LEDs** under screen minification. Passing that test can coexist with all-black/all-white output in finding 1.
