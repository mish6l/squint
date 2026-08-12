SQUINT - LED pitch and visual-acuity simulator
==============================================
Built by Mish - instagram.com/mish6l

WHAT IT IS
----------
A single self-contained HTML file. Drop in an image or a video, tell it the wall
size, the pixel pitch, the panel spec and the room light, and it shows you what
the audience will actually see - computed in linear light on the GPU.

Nothing is uploaded anywhere. No dependencies, no install, works offline.


HOW TO RUN
----------
Double-click squint.html.

It requires WebGL2 with floating-point render targets. If they are missing it
shows a refusal card instead of rendering. That is deliberate - see NO FALLBACK
below.

If your browser blocks local canvas readback under file://, only the PNG export
is affected. Serve the folder instead:

    cd "D:\Mishal\Claude Code\SQUINT"
    python -m http.server 8731
    then open  http://127.0.0.1:8731/squint.html

CALIBRATE IT ONCE. Monitor calibration -> "Calibrate full-screen", drag until
the box matches a real credit card held against the screen, and set your eye
distance. It opens over the canvas because a credit card is 85.6 mm, which on a
dense monitor is well over 400 px - wider than any sensible sidebar. The
sidebar itself is also draggable from its right edge. Until you calibrate, the
top bar reads UNCALIBRATED and 1:1 and eye-match are guesses.


THE PIPELINE
------------
Every intermediate buffer is RGBA16F holding linear light.

0. UPLOAD as an sRGB texture, so sampling returns linear values.

1. NATIVE GRID. Wall width divided by pitch gives the real panel resolution, and
   your content is resampled onto exactly that grid by a deterministic box
   filter - repeated exact 2x2 averages, then one area-weighted pass. A 12 m
   wall at 3.9 mm is 3077 px wide: your 4K master loses 20% of its detail before
   anything else happens, and that is usually what kills a design, not the pitch.
   ("Cheap processor" switches to nearest-neighbour, which is what you get from
   a bad scaler.)

2. BIT DEPTH / PWM. Quantisation happens in the signal domain, which is what a
   real processor does and why posterisation shows up near black rather than
   evenly. The "wall driven at X%" control costs you greyscale: at 20% drive an
   8-bit chain has roughly 6 bits left. Measured on the test card's dark ramp:
   40 levels at full drive collapse to 9 at 20% drive. That is what bands your
   dark cinematic grades on a real wall.

3. PIXEL STRUCTURE. Each LED is a lit square inside its pitch cell, sized by the
   fill factor (SMD ~40-55%, GOB/COB ~70-90%). Coverage is computed analytically
   from each screen pixel's footprint, so the gap fades continuously and
   converges to the fill factor when a pixel spans several cells - there is no
   threshold below which it silently disappears. Mean brightness is held
   constant, because a real wall is calibrated to its rated nits whatever the
   fill factor: the LEDs are simply driven harder.

4. LIGHT. Reflected ambient = lux x face reflectance / pi, expressed against the
   panel's peak nits, applied as (in + amb)/(1 + amb) so black lifts and white
   stays white. The readout gives you the resulting on-site contrast ratio.
   Off-axis applies a typical SMD luminance rolloff.

5. THE EYE. Acuity is about 1 arcminute: at distance D the eye cannot resolve
   detail finer than 0.291 mm per metre. Applied as a separable Gaussian in
   linear light, minus whatever your own eye is already doing to your monitor so
   the two are not double-counted.

6. ENCODE back to sRGB.


NO FALLBACK, ON PURPOSE
-----------------------
There is no canvas-2D path any more. A tool that rendered linear light on one
machine and gamma-space on another, silently, under the same name and the same
caption, would be a worse lie than the one this rewrite removed. If the GPU
cannot run the equations, SQUINT says so and stops.

How much this mattered: the old canvas-2D build fused a 50/50 black-and-white
field to sRGB 131. The physically correct answer is 188. The test card carries
that patch with both reference blocks beside it, so you can check the claim
yourself in about five seconds.


EVENT WALLS: CABINETS, FEEDS AND ARRAYS
---------------------------------------
An event wall is not a rectangle you type dimensions into. It is a grid of
cabinets, and the pitch is DERIVED from the tile, not chosen.

The standard rental tile is 500 x 500 mm. At "2.6 mm" it carries 192 x 192
pixels, so the true pitch is 500/192 = 2.604 mm and "2.6" is a round-off. A
12 x 6 cabinet wall is therefore exactly 2304 x 1152. Typing 6 m / 2.6 mm
instead gives 2308 x 1154 - a near-miss that makes your comp size, your 1:1
mapping and every downstream number slightly wrong.

BUILD FROM CABINETS is the default. Pick a tile, set cabinets across and down,
and the wall metres, the true pitch and the exact native resolution all derive.
Free size is still there for quick what-ifs, and says so when you use it.

PROCESSOR LIMIT is the one nobody models. A wall is fed from a processor
output. If that feed is smaller than the wall's native grid, the wall is being
upscaled and its real ceiling is the feed, not the panel count. A 2304-wide wall
fed 1920 x 1080 is a 1920-wide wall that happens to contain more LEDs - you are
using 83% of what you rented, and on a 3-screen array it can fall past 50%.
Turning this on genuinely resamples the content through the feed's grid, so you
see the softening, not just a warning.

SCREEN ARRAY maps one canvas across several physical screens - main plus IMAG
sides, a row of pillars - with the gaps modelled as what they are: content
mapped into a gap is not shown at all. The build plan tells you what percentage
of your canvas lands in the void. Each screen keeps its own cabinet grid.

CABINET GRID draws where the wall physically breaks. It is diagnostic chrome,
not a simulated seam: on good stock the seam itself is nearly invisible, while
the question that matters is whether a join lands through a logo or a face.
TILE VARIANCE is the artifact that IS simulated - the few percent brightness
spread of mixed rental stock, which large flat gradients reveal.

BUILD PLAN answers "what size do I build the comp?" before the job starts, and
"Download layout guide PNG" writes a reference at the wall's exact native
resolution with the cabinet grid, screen outlines, centre marks, a 5% safe area
and the numbers stamped on it. Drop it into your comp as a guide layer.


THE TWO DISTANCES
-----------------
ACUITY LIMIT (3.44 x pitch) is where the pitch equals the eye's 1-arcminute
resolution limit. Derived from the acuity constant, not hard-coded.

STRUCTURE-FREE AT (5.7 x pitch) is further out, and is where this tool stops
calling the structure detectable at all. The gap is deliberate: a repeating grid
stays visible somewhat past the limit for a single isolated feature, which is
why people still see screen-door slightly beyond the textbook retina distance.

Quote the first number to sound like the textbook. Trust the second one.


THE SCALE FIGURE
----------------
A flat 1.75 m silhouette standing at the wall plane, just outside the left edge.
At the wall plane its scale is pure arithmetic and correct in every zoom mode by
construction. It is drawn as instrument chrome, after the simulation and never
through it - running a person through gap, blur and ambient would claim "this is
what someone looks like standing there", which the tool cannot back.

It never moves or rescales to stay in frame; a scale reference that follows the
crop is a scale lie. Fit mode reserves room for it instead. When it is off frame
the top bar says so. Its height is fixed and not adjustable, for the same reason.


THE THREE JOBS
--------------
JUDGING YOUR OWN RENDER
  "Wipe vs. source": left of the bar is an ideal infinite-resolution wall, right
  is the real one - same distance, same eye filter, same ambient, so the only
  difference is what the pitch costs you.
  "Measure a feature": drag a box over a cap-height letter or the thinnest line
  that must read. You get wall pixels, millimetres and arcminutes with a verdict.
  Under ~6 wall px of cap height or ~12 arcminutes will not read. In A/B mode it
  measures whichever view you dragged in, and says so.

SELLING A PITCH TO A CLIENT
  "A / B pitch": two pitches, same content, same distance, side by side.
  "Save comparison PNG" bakes in wall size, both pitches, distance, native
  resolution, bit depth, drive level, nits/lux, contrast ratio, off-axis angle -
  and the viewing contract below.

GENERAL SPEC WORK
  The readout bar is live. Arrow keys walk the viewer distance, shift for 5 m.


THE EXPORT CARRIES A VIEWING CONTRACT
-------------------------------------
A pitch simulation is only true at one ratio of displayed size to viewing
distance. A 12 m wall shown as a 25 cm image on a laptop is optically the same
as standing 50 m back, and every pitch looks flawless at 50 m.

So the PNG states the rule on its caption strip:

    "Angularly true only when viewed from N x its displayed width."

where N = viewer distance / wall width. A 6 m wall viewed from 5 m gives 0.83,
so a 25 cm-wide slide must be viewed from 21 cm to be honest.

The export also bakes the audience's acuity in ABSOLUTELY rather than relying on
the unknown recipient's eye and monitor to supply the difference. Without both,
the PNG flatters the wall - and the PNG is the artifact that reaches the person
signing the cheque.


ZOOM MODES
----------
EYE-MATCH   Wall's angular size on your monitor equals the real wall's at the
            viewer distance. Best for composition and legibility.
FIT         Whole wall on screen. Watch the "your eye is ~N m from this wall"
            figure: fitting a 12 m wall on a monitor is optically the same as
            standing 25 m back, which is why everything looks fine here.
1:1         One wall millimetre = one real millimetre on your monitor.
FREE        Anything; the equivalent-distance readout keeps you honest.

Scroll zooms anchored on the cursor, drag pans, double-click recentres.


SELF-TEST
---------
Runs at boot and asserts two things through the real pipeline:
  - a 50/50 black/white field, fused, lands on sRGB 188 (gamma-space would be
    128). This single number is the difference between right and confidently
    wrong.
  - mean brightness does not move when fill factor changes, measured in the
    fused regime.
A red banner appears if either fails. Call SQUINT.selftest() any time.


KNOWN SIMPLIFICATIONS (what it still does NOT model)
----------------------------------------------------
The list is shorter than it was, and each remaining item is here because it is
honest to leave it out, not because it was inconvenient.

- OFF-AXIS uses a typical SMD luminance rolloff. Real panels vary considerably,
  and geometric foreshortening of the pitch is not modelled - only brightness.
  Treat the angle control as indicative.
- CONTRAST SENSITIVITY is not modelled. Acuity is measured at maximum contrast;
  low-contrast detail needs to be larger than the 1-arcminute figure implies, so
  the legibility verdict is slightly optimistic for low-contrast content.
- MOTION. Static acuity only. Moving content reads worse than a still frame at
  the same pitch, so still-frame judgements err on the safe side.
- PHOTOMETRY is derived, not measured: nits and lux come from spec sheets and
  presets, and every derived figure is labelled an estimate. The image transform
  stays display-relative, because a monitor cannot show 1000 nits.
- CLIPPING. Zoomed in far enough to resolve individual emitters, a low-fill wall
  drives its LEDs well above the average luminance (4x at 25% fill), which an
  SDR monitor cannot display, so bright content clips there. Mean brightness is
  still exact once the structure fuses.
- No moire simulation of a camera sensor, no HDR output, no per-panel calibration
  or seam/tile variation.


KEYS
----
  scroll        zoom, anchored on the cursor (works over either A/B view)
  drag          pan
  double-click  recentre
  left / right  viewer distance -/+ 0.5 m (hold shift for 5 m)
  0             recentre
  space         play / pause video


FILES
-----
  squint.html        the tool. This is the whole thing.
  testcard.png       3840x2160 test card: legibility ladder, hairlines, stripe
                     bursts, a 50/50 gamma-fusion patch with 188 and 128
                     reference blocks, and a 0-40/255 dark ramp for banding
  make-testcard.ps1  regenerates it
  testclip.mp4       4 s moving 4K clip, for checking the video path
  reviews/           the two independent reviews that shaped this tool
  README.txt         this file


VERIFICATION STATUS (2026-08-12)
--------------------------------
Reviewed twice by an external code reviewer and once by an adversarial model
auditor, and re-tested after every fix.

Measured, not asserted:
  - linear-light fusion: the 50/50 field fuses to 185.6 against a reference
    block the pipeline reproduces as exactly 188.0, with the gamma reference
    reproduced as exactly 128.0. The pre-rewrite canvas-2D build read 131.
  - the "cheap processor" scaler genuinely point-samples: local range 247 in a
    1 px stripe field, against 7 for the box filter
  - fill factor 90% -> 25% moves mean brightness by 0.1% in the fused regime
  - bit depth: the dark ramp holds 40 levels at full drive and 9 at 20% drive,
    matching 256 x 0.2 levels across the ramp's signal span
  - photometry: 400 lux at 4% reflectance against 1000 nits gives 5.1 reflected
    nits and 197:1 on-site contrast, by hand and on screen
  - scale figure measures 1.75/3 of the wall's on-screen height
  - measure tool agrees with independent maths, including on the B view
  - native resolution, content scale, eye resolution, both structure distances
    checked against hand maths on four wall configurations
  - 27 hostile-input cases (zero/negative/text/absurd walls and pitches, extreme
    aspect ratios, odd native sizes, extreme zoom and pan, fill, ambient, bit
    depth, drive, angle and scaler extremes) throw nothing and produce no NaN or
    Infinity readouts
  - simulate / wipe / A-B modes render; PNG export names and captions correctly

Video path: VERIFIED by hand, 2026-08-13, including a large file beyond the
bundled test clip. It could not be tested from the automated session because
Chrome will not load media in a backgrounded tab, so this one was confirmed the
old-fashioned way.

Nothing is left flagged as unverified.


SCRIPTING HANDLE
----------------
window.SQUINT exposes { S, nativeRes, contentRect, cellPx, draw, ppmmDev,
viewUnder, geo, geoB, GLE, selftest, ambientFraction, contrastRatio,
offAxisGain, ARCMIN_RAD, MM_PER_M } from the console.
