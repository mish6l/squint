# Codex round 3 — improvements review

The core is sound for ordinary, supported media and realistic wall configurations: the pass order, linear-light handling, analytic fill coverage, ambient normalization at normal incidence, Gaussian weighting, and single-flip invariant all survive this review, and `squint.html` is still byte-for-byte identical to `index.html`. I found no critical defect, but the reducer's claim of exactness has one high-severity boundary error, the screen-array addition regressed the client-facing viewing contract, and oversized media can silently retain the previous texture. The two boot self-tests do not cover those paths, so their expected 188-ish fusion result and approximately 0.1% fill drift can still pass.

## Findings

### 1. High — the “64× exact” area reducer can require 65 taps and drops the last one

**File:line:** `squint.html:659` and `squint.html:666` (step sizing at `squint.html:871`)

**What is wrong:** Each reduction step permits a source/destination ratio up to 64, but a non-integer interval shorter than 64 texels can overlap 65 texels when it begins partway through a texel. Both shader loops stop after 64 iterations. The omitted final partial texel is also omitted from `wsum`, so the remaining samples are renormalized as if it did not exist. This makes the “every source texel contributes its true overlap weight” claim false and is an incomplete fix from `f0b6ca3`.

**Failure scenario:** Reduce a 4095×1 source to 64×1. Destination texel 1 covers source interval `[63.984375, 127.96875)`, which intersects 65 texels. The loop visits texels 63–126 and omits texel 127, whose overlap weight is 0.96875. If texel 127 is white and the other covered texels are black, the exact result is 1.514% linear white; the shader returns 0%. A free-size 185.6 mm-wide, 2.9 mm-pitch, 64-pixel wall with a stretched 4095-pixel test strip reaches this path directly.

**Self-test impact:** Neither boot assertion breaks. The fusion check reduces 64→8 (an integer 8:1 interval), and the fill-invariance check upscales the 64×64 source rather than exercising a near-64 non-integer reduction.

**Suggested fix:** Allow the mathematically required 65th tap, or constrain each JS reduction step so no destination footprint can intersect more than 64 source texels. Add a regression test using 4095→64 (and the vertical equivalent) with energy only in the final partial texel.

### 2. High — screen arrays are not propagated into angular readouts or the export viewing contract

**File:line:** `squint.html:1286`, `squint.html:1443`, `squint.html:1698`, and `squint.html:1707`

**What is wrong:** Rendering and the build plan use the complete array span, but “Wall subtends,” the distance jump presets, the export's physical-size caption, and `ratio = S.dist / S.wallW` use one screen's width. The exported contract therefore becomes confidently wrong in array mode. This regresses the prior Fable audit's highest-severity export finding: the contract existed before arrays, and commit `da86c4c` added arrays without updating these consumers. A/B export has a related wording problem because “its displayed width” refers to a PNG containing two wall views, not the displayed width of either wall.

**Failure scenario:** Three 6 m screens with 1.5 m gaps span 21 m. At 5 m, the array subtends about 129° horizontally, but the readout uses 6 m and reports about 62°. The export tells the recipient to view it from `5 / 6 = 0.83×` its displayed width; for the whole array the ratio is `5 / 21 = 0.24×`. The recommended distance is wrong by 3.5×, precisely in the client-facing artifact whose viewing contract was meant to prevent flattering pitch comparisons.

**Suggested fix:** Derive one `overallSpanM()` value from screen count, per-screen width, and gaps, and use it consistently for angular readouts, distance presets, captions, and array-mode contracts. For A/B, state and calculate the contract against each panel's displayed wall width rather than the combined PNG width.

### 3. High — media larger than `MAX_TEXTURE_SIZE` can render black or retain the previous file silently

**File:line:** `squint.html:843`–`squint.html:853` and `squint.html:1559`–`squint.html:1564`

**What is wrong:** Accepted image/video dimensions are never checked against `GLE.MAXTEX`, and `uploadSource()` neither checks `gl.getError()` nor delays `srcKey` assignment until upload success. A DOM image can decode at dimensions the GPU cannot accept as one texture. `texImage2D` then fails; an existing texture allocation may remain unchanged, yet the new cache key is recorded.

**Failure scenario:** Load a valid 3840×2160 image, then load a 20000×1000 PNG on a GPU whose maximum texture dimension is 16384. The second `texImage2D` is invalid. The tool can continue sampling the old 4K texture while the UI and exported caption name the 20000-pixel file, or show black on a first load. Either result is a silent wrong-content failure rather than the refusal the tool's honesty contract requires. The same issue applies to an 8K video on a mobile GPU capped below that frame size.

**Self-test impact:** Neither assertion breaks; its synthetic source is 64×64.

**Suggested fix:** Reject media whose decoded width or height exceeds the actual texture limit before accepting it into `S`, with a specific refusal message. Also verify upload success before changing `srcKey`; on any GL error, keep the prior state visibly identified or clear it and refuse the new source.

### 4. Medium — the 24-entry texture pool is bounded by count, not memory, and retains resize churn

**File:line:** `squint.html:806`–`squint.html:826`

**What is wrong:** The fix in `f0b6ca3` deletes textures returned after the pool is full, but it keeps the first 24 cached allocations indefinitely. Viewport-sized RGBA16F targets are large, and every distinct resize dimension creates pool entries that cannot serve later dimensions. Thus the pool is count-bounded but can still retain gigabytes and trigger the context-loss path.

**Failure scenario:** A 3840×2160 RGBA16F texture is about 63 MiB. A blurred view uses multiple viewport-sized targets with both filter modes. Dragging a 4K browser window through roughly eight distinct sizes can populate 24 near-4K entries and retain around 1.5 GiB of GPU allocations even after the window settles. On a mobile or integrated GPU, context loss can occur much earlier.

**Suggested fix:** Enforce a byte budget rather than only an entry count, evict least-recently-used mismatched sizes, and aggressively discard obsolete viewport-sized targets when the drawing buffer dimensions change.

### 5. Medium — reported contrast ignores the off-axis luminance loss that the shader applies

**File:line:** `squint.html:751`–`squint.html:752`, `squint.html:919`, `squint.html:1289`, and `squint.html:1712`

**What is wrong:** The shader models emitted white as `offGain` before adding ambient, so its white/black contrast is `(offGain + amb) / amb`. `contrastRatio()` always returns `(1 + amb) / amb`. The on-screen number, status colour, photometry hint, and PNG caption therefore contradict the rendered model whenever viewing angle is non-zero.

**Failure scenario:** At the defaults (1000 nits, 400 lux, 4% reflectance), `amb ≈ 0.00509` and the tool reports 197:1 at every angle. At 60°, `offAxisGain() ≈ 0.392`, so the shader's own implied contrast is about 78:1; at 75° it is about 33:1. A booth-side viewer can be labelled as having nearly six times the contrast the simulated panel actually delivers.

**Self-test impact:** Neither assertion breaks because the test explicitly sets `offAxis = 0`.

**Suggested fix:** Make contrast calculation accept the same effective emitted-white gain used by the shader, and use that value consistently in the readout, hint, severity band, and export caption. Keep the current on-axis result when gain is one.

### 6. Medium — rapid or stalled video replacements still leak superseded object URLs

**File:line:** `squint.html:1522`–`squint.html:1556`

**What is wrong:** Each video load assigns new `vid.onloadedmetadata` and `vid.onerror` properties. Starting a second video before the first fires overwrites the only callbacks that close over the first URL, so its `drop()` is no longer reachable. `currentUrl` does not help because it is assigned only after metadata succeeds. This leaves the object-URL cleanup from `f0b6ca3` incomplete for the shared video element.

**Failure scenario:** Select a large MP4 and immediately select another before metadata for the first arrives, or load a malformed video that stalls without either callback and then choose another. The first blob URL is never revoked. Repeating this with several large clips retains every superseded blob for the page lifetime and can exhaust memory during a production session.

**Suggested fix:** Track a separate pending URL and revoke it synchronously when a new load supersedes it. Prefer per-load `addEventListener(..., {once:true})` handlers with one idempotent cleanup function that is called on success, error, supersession, and any decode timeout.

### 7. Medium — transparent image pixels are treated as fully opaque RGB

**File:line:** `squint.html:848`, `squint.html:662`, `squint.html:669`, and `squint.html:679`

**What is wrong:** The source texture carries alpha, but every source-consuming shader discards it and reduces/copies `.rgb` only. Hidden RGB under transparent pixels therefore contributes at full intensity to the LED grid and subsequent blur.

**Failure scenario:** Load a transparent PNG logo whose transparent padding contains white matte RGB (a common export). SQUINT displays and averages that padding as white, producing a bright rectangle and contaminating edge LEDs, although compositing the asset over the wall's black background should show only the logo.

**Self-test impact:** Neither assertion breaks because the synthetic checker is fully opaque.

**Suggested fix:** Define the ingest alpha contract explicitly and composite source RGB over black in linear light before area reduction, with `UNPACK_PREMULTIPLY_ALPHA_WEBGL` set deliberately so browser defaults cannot change the result.

### 8. Medium — 1:1 mapping can add a duplicated row and column on parity mismatch

**File:line:** `squint.html:582`, `squint.html:686`–`squint.html:690`, and `squint.html:725`–`squint.html:727`

**What is wrong:** A centered 1:1 rectangle can begin on a half-pixel when source and wall dimensions have different parity. The placement test treats both `uv == 0` and `uv == 1` as inside (`> 1.0`, not a half-open upper bound), and clamp-to-edge sampling duplicates the edge texel. The ideal path uses the same inclusive upper boundary.

**Failure scenario:** Map a 1×1 image in 1:1 mode to a 2×2 wall. `contentRect()` is `(0.5, 0.5, 1, 1)`. LED centres at 0.5 and 1.5 produce UVs 0 and 1, both accepted, so the one source pixel lights all four wall pixels. More generally, any odd/even parity mismatch can turn an N-pixel 1:1 extent into N+1 sampled LED centres.

**Self-test impact:** Neither assertion breaks because both checks force `fitMode = 'stretch'`.

**Suggested fix:** Specify 1:1 placement in pixel-centre terms and use a consistent half-open content extent. If half-pixel centring is retained, distribute its coverage without duplicating energy; add 1×1→2×2 and odd/even regression cases.

### 9. Low — the cabinet-variance hash is periodic and every array screen repeats the same stock pattern

**File:line:** `squint.html:708`–`squint.html:709` and `squint.html:731`–`squint.html:748`

**What is wrong:** Cabinet indices are reduced with `fract(p * vec2(127.1, 311.7))` before hashing. For integer indices, the fractional components advance by 0.1 and 0.7 and repeat every 10 cabinets. In array mode `localX` is reset for each screen and the screen index is not part of the hash, so the entire variance field repeats screen-for-screen despite the comment saying each screen carries its own tile stock.

**Failure scenario:** On the default 12-cabinet-wide wall with non-zero tile variance, columns 0 and 10 share the same hash input, as do columns 1 and 11. With multiple screens, every corresponding cabinet has the same gain. Flat grades show artificial repeated bands rather than independent cabinet variation.

**Self-test impact:** Neither boot assertion breaks because tile variance defaults to zero.

**Suggested fix:** Hash the unreduced integer cabinet coordinates with a stable integer-friendly hash and include the screen index (or a global cabinet coordinate) in the key. Preserve determinism so A/B comparisons remain repeatable.

### 10. Low — obsolete Canvas-2D-era scratch state and parameters remain in the single-file core

**File:line:** `squint.html:482`–`squint.html:486`, `squint.html:513`–`squint.html:516`, and `squint.html:951`

**What is wrong:** `HAS_FILTER`, `tmp`, `contentCv`, `cropCv`, `offA`, `offB`, `idealOff`, and the `off` parameter to `renderView()` have no consumers in the WebGL renderer. The comments still say Canvas 2D filters “carry the acuity model,” which is false in the current build.

**Failure scenario:** On a browser without Canvas 2D `filter`, startup performs the probe and records `false`, but no refusal or warning follows because the value is dead. A maintainer auditing the single-file guarantee can reasonably infer that a fallback or warning path still exists when it does not.

**Suggested fix:** Remove the unused canvases, probe, arguments, and obsolete comments; keep only `idealCv`, which is used for wipe composition.

## Could not verify

- I could not run the tool in a browser, so I did not execute `SQUINT.selftest()` or confirm the reported 185.6/188.0 and approximately 0.1% values on a real WebGL implementation. The self-test impact above is from tracing its exact inputs through the current branches.
- I could not test shader compilation, half-float filtering/renderability, context loss, or allocation thresholds on Chrome, Firefox, Safari, or a mobile GPU. The oversized-upload result and pool exhaustion threshold need browser/hardware confirmation; the missing guards and retained allocations are visible statically.
- I could not exercise video metadata/error timing or confirm when each browser releases superseded media internally. The overwritten-handler URL path remains unclosed by this code regardless of browser-side reclamation.
- I could not execute either PNG path. Canvas encoding limits and download behaviour, especially for very large layout guides, still need Safari/mobile checks.
