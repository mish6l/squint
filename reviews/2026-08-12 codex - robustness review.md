# Codex robustness review — SQUINT

**Date:** 2026-08-12
**Reviewer:** Codex (`codex exec`, external reviewer, dispatched via herdr)
**Scope:** line-by-line code review of `squint.html` for silently-wrong numbers,
crashes, geometry errors, resource leaks and browser-API misuse.
**Result:** 18 findings. Line numbers refer to the pre-fix file.

Status key: **FIXED** · **MITIGATED** (disclosed rather than eliminated) ·
**ACCEPTED** (documented as a known simplification) · **OPEN**

---

## High

**1. Pixel gaps silently omitted at common zoom levels** — MITIGATED
Below `cell < 3` device px or `gap < 0.6`, no inter-pixel gap is drawn. Eye-match
commonly produces `cell < 3`, so the default view can show filled pixels while the
readout says the grid is visible.
*Resolution:* cannot be eliminated — a sub-pixel black line is not drawable in
canvas 2D, and drawing it with coverage alpha would darken the image (the very
bug fixed in #2 of the Fable audit). Now disclosed with an on-canvas banner plus
a top-bar warning, and mean brightness is correct in both paths. Slated for real
resolution by the WebGL pass.

**2. "Good processor" is not a deterministic box filter** — ACCEPTED
`imageSmoothingQuality='high'` is a browser hint, not a guarantee; output varies
by browser. *Resolution:* documented in the README. To be fixed properly by an
explicit GPU box filter.

**3. Unbounded native resolution can crash rendering** — FIXED
A 30×8 m wall at 2.6 mm is 11538×3077 native and was allocating a 35 MP buffer
per frame; 60×12 m at 2.6 mm (23077×4615, 106 MP) exceeded Chrome's canvas limit
and froze the renderer. Found independently by hostile-input testing.
*Fix:* `CROP_CAP = 4096` with a decimation factor; `f > 1` only occurs when
`cell < 1`, where the grid is physically invisible, so filtering down is the
correct approximation rather than a compromise. Disclosed in the top bar.

**4. One-pixel walls geometrically inconsistent** — FIXED
`nativeRes()` clamps a sub-pitch wall to 1 px while `cellPx()` still sizes it by
the full pitch, so the drawn wall exceeded the declared wall.
*Fix:* the condition is detected and flagged in the native-resolution readout.

## Medium

**5. Total-pixel readout wrong for small walls** — FIXED. A 1×1 grid displayed
"0 kP". Now shows exact pixel counts below 1,000.

**6. `file://` boot crash from unguarded `localStorage` write** — FIXED. The read
was guarded, the write was not, so a storage-disabled `file://` context would
throw before the first render — on the tool's primary launch path. Now wrapped.

**7. Async file loads can overwrite newer content** — FIXED via a load-generation
token; stale `onload` / `onloadedmetadata` callbacks are ignored.

**8. Videos with zero dimensions poison geometry** — FIXED. Metadata is rejected
unless `videoWidth > 0 && videoHeight > 0`.

**9. Measurement wrong on the B view in A/B mode** — FIXED. **The most serious
finding.** Measurement always divided by `geoA.cell`, so dragging over view B
reported wall-pixel height using pitch A's scale. Verified error: a 132 mm
feature reported as 455 mm (3.4×). The measure tool now binds to the view the
drag started in and labels the result.

**10. Wheel anchoring wrong over view B** — FIXED. Same root cause; the wheel
handler now resolves the view under the pointer and uses its geometry and pitch.

**11. Repeated playback can leak animation loops** — FIXED. Guarded, and the RAF
loop now stops on `pause`, `ended`, `error` and `emptied`, not only the button.

**12. Old video not paused when loading new content** — FIXED.

**13. Object URLs leak for every loaded file** — FIXED; the previous URL is
revoked when content is replaced.

**14. Per-frame canvas reallocation** — FIXED (partial). Backing stores are only
resized when dimensions actually change. Full native-resample caching deferred.

## Low

**15. Wheel zoom exceeded the free-zoom slider's range** — FIXED; both paths now
share bounds.

**16. Unsupported Canvas 2D filters silently disable acuity blur** — FIXED.
`HAS_FILTER` is feature-detected and a warning is shown, since without it the
tool would render an unblurred image while claiming to simulate the eye.

**17. PNG export failure leaves the button disabled** — FIXED; `toBlob`
availability and a null blob are both handled, and the button always restores.

**18. MIME-based video detection rejects empty MIME types** — FIXED; falls back
to file extension.

---

## Verified correct by the reviewer

- `contentRect()` fit, fill, stretch and 1:1 mappings are algebraically correct.
- Visible-crop bounds in `renderView()` are correct for positive finite `cell`,
  and safely produce an empty crop when panned fully off-canvas.
- DPR handling is internally consistent.
- Eye-match scale (`pitch × calibrated monitor px/mm × monitor distance /
  viewer distance`) is correct.
- The retina factor is numerically consistent: `ARCMIN_RAD × 1000 = 0.2908882`
  mm/m, and `1 / 0.2909 = 3.4376`, so `3.44 × pitch` is right to the displayed
  precision.
  *Reviewer's caveat, since actioned:* it was hard-coded in two places and could
  drift from the constant. It is now derived from `MM_PER_M` in both.
