# Codex round 2 — the WebGL2 render core

**Date:** 2026-08-12
**Reviewer:** Codex (external, second pass — the first pass reviewed the
canvas-2D build)
**Scope:** the rewritten GL engine: linear-light pipeline, box downsample chain,
analytic gap coverage, quantisation, photometry, resource lifecycle.
**Result:** 16 findings, two of them Critical and both in the downsample chain
that carries the tool's headline claim.

Status key: **FIXED** · **ACCEPTED** (documented) · **OPEN**

---

## Critical

**1. Odd-size box reductions discarded pixels** — FIXED
`FS_HALVE` averaged pairs `(2k, 2k+1)` while the JS chose `floor(cw/2)`, so a
5x5 reduction averaged only the upper-left 4x4 and silently dropped the last
row and column.

**2. Anisotropic reductions were not fully sampled** — FIXED
The halving loop condition was `cw>dw*2 && ch>dh*2`, so it stopped as soon as
*either* axis came within 2x, leaving the other axis to be covered by an
8-tap box shader. A 10000x100 -> 100x90 reduction sampled 8 of every 100
source texels.

*Resolution for both:* the 2x2 halving chain and the fixed 8-tap box were
deleted and replaced by an exact **separable area reducer** — each axis is
reduced independently, in steps of at most 64x, with every source texel
contributing its true overlap weight. Odd dimensions and non-integer ratios are
now exact by construction.
*Verified after:* fill-invariance drift in the boot self-test fell from 1.49%
to 0.1%; the 50/50 gamma patch fuses to 185.6 against a reference block that
reproduces exactly 188.0.

## High

**3. "Cheap processor" was bilinear, not nearest** — FIXED
The nearest branch called `texture()`, which honours the source texture's
`LINEAR` filter, so the deliberately-bad scaler was quietly being filtered.
Now uses `texelFetch`. *Verified:* local range in a 1 px stripe field is 247
under the cheap scaler versus 7 under the box filter — it aliases hard, as a
bad processor should.

**4. Decimation mishandled partial final LED groups** — FIXED
`round(cw/decim)` could leave the final texel sampling past the crop. Now
`ceil`, so the last partial group has a texel of its own.

**5. The self-test permanently changed the user's content mapping** — FIXED
`selftest()` set `S.fitMode='stretch'` but `fitMode` was absent from its
restore list, so after every boot the user's content was stretched while the UI
still read "Fit (letterbox)". The snapshot now covers every field the test
touches. **The most damaging finding of the round** — it was silent, permanent,
and my own verification runs had masked it by setting `fitMode` explicitly.

**6. Refusal mode still had live render paths** — FIXED
`draw()` could still reach `renderView()` with a null GL context on resize or a
late-decoding file. `draw()` now returns immediately unless the context is live.

**7. Context loss was unhandled** — FIXED
A GPU reset invalidates every program, texture and framebuffer while `live`
stayed true. A `webglcontextlost` handler now stops rendering and says so,
rather than drawing pixels it cannot vouch for.

## Medium

**8. Framebuffer completeness never checked** — FIXED; `grab()` now checks and
throws rather than rendering into an incomplete target.

**9. The texture pool leaked when full** — FIXED; textures and framebuffers over
the 24-entry cap are deleted instead of discarded.

**10. Ambient photometry was silently capped at 4x panel white** — FIXED; the
clamp existed only to keep the shader finite and was low enough to flatter
genuinely hopeless rooms. Raised so the readout reports what the photometry
actually implies.

**11. PWM level count was fractional** — FIXED; 8-bit at 20% drive produced
`uLevels = 50.2`. Now an integer maximum code, `floor((2^bits - 1) * drive)`.

**12. Very large blur sigmas were under-blurred** — FIXED; the pre-downsample
factor was capped at 16 while the kernel radius was capped at 96, so a
sufficiently large sigma was truncated well inside 3 sigma. The factor now
follows the sigma.

**13. Same-name, same-size images served the cached texture** — FIXED; the
source cache key is invalidated on every accepted load.

**14. Superseded and failed loads leaked object URLs** — FIXED; every abandoned
load now revokes its own URL.

**15. Absurd native resolutions exceed shader float precision** — ACCEPTED.
Only reachable with configurations far outside any real wall; ordinary
oversized walls are handled correctly by crop decimation, which the reviewer
confirmed.

## Low

**16. PNG export could leave state and the button stuck** — FIXED; the export
mutation and render are wrapped in `try/finally`.

---

## Verified as correct by the reviewer

These matter as much as the findings — they are independent confirmation of the
physics, not just the plumbing:

- `Fi`/`cov1` **is** mathematically the antiderivative of a periodic square
  lit-area indicator, and its mean equals the requested fill factor for
  arbitrary footprint widths, including footprints spanning many cells.
- The `1/fill` gain correctly preserves mean emitted brightness when coverage is
  averaged and nothing clips; the clipping that does occur is legitimately
  introduced by the final sRGB clamp for bright content at low fill or high
  drive.
- The ambient transform `(in + amb)/(1 + amb)` is correct for panel-normalised
  emitted luminance plus reflected ambient.
- The separable blur uses correctly normalised symmetric Gaussian weights with
  edge clamping.
- Texture-unit usage in the composite pass is consistent (`uTex` unit 0,
  `uContent` unit 1, reset by the next pass), and no texture is double-returned
  or sampled while bound as a render target.
- There is exactly **one** Y flip, in `FS_PRESENT`. The wipe view, both A/B
  views and the PNG export copy already-presented canvases and do not add
  another.
