# Fable adversarial model audit — SQUINT

**Date:** 2026-08-12
**Reviewer:** Fable (adversarial, judgment-level — deliberately *not* code review)
**Question put to it:** where does this tool lie, in ways the user cannot detect
from inside it? And would a working AV professional trust it?
**Verdict at time of audit:** *No* — not fit for client-facing pitch decisions.

Status key: **FIXED** · **ACCEPTED** (documented) · **PLANNED**

---

## What it endorsed first

The core pipeline — resample to the true native grid, draw the gap from fill
factor, then Gaussian low-pass at 1 arcmin with the observer's own eye-blur
subtracted in quadrature — was called sound engineering, and the quadrature
subtraction correct in principle: in eye-match the two terms cancel exactly, so
the viewer's physical eye does the filtering. A single-Gaussian acuity model was
judged an acceptable simplification for the two questions the tool answers —
"does the grid fuse" and "does this text read". The geometry readouts and the
measure tool's thresholds were judged defensible against signage practice.

---

## 1. The export destroyed the tool's own honesty contract — FIXED

The PNG baked whatever zoom mode was active and captioned it with authoritative
numbers, while recording nothing about the size it must be displayed at. The
model is entirely angular: a 12 m wall shown as a 25 cm image on a laptop is
optically the same as standing ~50 m back, and every pitch looks flawless at
50 m. Exporting from Fit mode produced a caption reading "viewer at 5.0 m" over
pixels encoding a ~25 m-equivalent view.

**Direction of error:** always flatters the wall. **Why it mattered most:** it is
the one artifact that leaves the tool and reaches the person signing the cheque.

**Fix:** the caption now states the viewing contract — *angularly true only when
viewed from N × its displayed width*, where N = viewer distance / wall width —
and the export bakes the audience's acuity **absolutely** rather than relying on
the unknown recipient's eye and monitor to supply the difference. Zoom mode,
fill and ambient are stamped too.

## 2. The luminance model was wrong twice, in the same direction — PART FIXED

**(a) Fill factor was a direct brightness tax** — FIXED. Real walls are
calibrated to rated nits whatever the fill factor; the LEDs are simply driven
harder. Drawing black gaps without restoring the mean made low-fill SMD product
look dimmer than it is. Worse, because the gap is only drawn above 3 px/cell,
*the same wall changed tone between zoom modes*, and in Wipe mode the brightness
loss was misattributed to pitch.
*Fix:* mean brightness is now held constant; fill changes structure only.
Measured: 90% → 25% fill holds mean luminance within 3.6%.

**(b) Resampling and blur run in sRGB gamma space** — PLANNED. Light mixes
linearly; fusing a black gap with lit cells in gamma space gives roughly 30% too
dark at 50% fill. The correct fix is linear-light processing, which canvas 2D
cannot do — this is the main driver for the WebGL upgrade.

## 3. The tool contradicted itself in the sale-critical band — FIXED

The structure verdict called the grid MARGINAL until ~5.7 × pitch, while the
readout two boxes away announced "structure-free at 3.44 × pitch". Between those
distances the bar simultaneously said "structure-free" and "MARGINAL".
The reviewer noted the 0.6 buffer is the *better* physics — a maximal-contrast
periodic grating stays detectable past the nominal 1-arcmin cutoff, which is why
professionals report seeing screen-door slightly past the "retina" distance — so
the 3.44 number should have been labelled acuity limit, not structure-free.
*Fix:* both distances are now shown, separately labelled, and derived from the
acuity constant.

## 4. Eye-match cannot show marginal pixel structure — MITIGATED

In eye-match the monitor becomes the bottleneck: a 2.9 mm cell is ~1 monitor
pixel, the gap draw is suppressed, and precisely in the band where the pitch
decision is live the mode renders a clean image of a wall whose screen-door the
audience would see. *Fix:* an on-canvas banner now fires in exactly that
condition, framing eye-match as the legibility/composition mode and 1:1 as the
structure mode. Real resolution awaits the WebGL path.

## 5. No ambient light / black-level model — FIXED

The sim showed perfect blacks. Halls run bright, LED blacks lift, and a dark
graded booth film that reads beautifully at the desk dies on the floor. Called
"the single most common real-world failure mode of booth content", and the
omission most likely to burn a delivered render.
*Fix:* an ambient wash control implementing `out = amb + (1−amb) × in`, applied
after the eye filter (ambient reflection is spatially flat) and confined to the
panel face. Verified: a 30% wash lifts a 14/255 black to 86/255, exactly as the
model predicts.

## 6. No bit-depth / low-luminance banding — PLANNED

PWM depth and panel calibration posterise dark gradients; a 16-bit smooth
vignette bands visibly on a real wall. Same victim as #5: dark cinematic content.

## 7. Motion, off-axis and upstream processing — ACCEPTED

Static acuity is *conservative* for moving content (dynamic acuity is worse), so
still-frame judgements err safe. Scan/PWM artifacts matter to cameras, not eyes.
Off-axis shifts colour and brightness but *improves* grid visibility
(foreshortened pitch), so its absence is mixed rather than flattering. The
good/cheap scaler toggle covers the most important slice of upstream processing.
All documented rather than modelled.

## 8. Trust hygiene — FIXED

The README still described the tool by its former name and documented the wrong
global, so none of its verification claims could be tied to the shipped file.
Separately, calibration was persisted with default values at boot, making "never
calibrated" indistinguishable from "calibrated" forever after — while the README
insisted eye-match lies without calibration.
*Fix:* README rewritten against the shipped file; calibration only persists on
real user interaction, and an UNCALIBRATED badge shows until then.

---

## Would a professional trust it?

An integrator's first three questions — how many nits, what ambient, what
viewing-angle range — had no answer, and the readout-bar contradiction (#3) was
judged findable within a minute. A client would not interrogate the physics; a
client would be misled by the export (#1), which is worse.

What it judged genuinely better than industry practice: the native-grid
resampling story ("this is usually what kills a design, not the pitch" — true,
and most vendor calculators do not say it), the measure tool, and the 1:1 mode.

**Single most limiting gap:** an export that carries its own viewing contract —
since pitch decisions are made in decks and meetings, not inside the browser tab.
Now closed.
