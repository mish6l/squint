SQUINT - LED pitch and visual-acuity simulator
==============================================

WHAT IT IS
----------
A single self-contained HTML file. Drop in an image or a video, tell it the wall
size, the pixel pitch, the ambient light and how far the audience stands, and it
shows you what they will actually see.

Nothing is uploaded anywhere. No dependencies, no install, works offline.


HOW TO RUN
----------
Double-click squint.html. That is it.

If your browser blocks local canvas readback (some file:// configurations), the
"Save comparison PNG" button is the only thing that will misbehave. In that case
serve the folder instead:

    cd "D:\Mishal\Claude Code\SQUINT"
    python -m http.server 8731
    then open  http://127.0.0.1:8731/squint.html

CALIBRATE IT ONCE. Open "Monitor calibration", drag until the box matches a real
credit card held against the screen, and set your viewing distance. Until you do,
the top bar reads UNCALIBRATED and the 1:1 and eye-match modes are guesses. This
is stored per machine.


WHAT IT ACTUALLY SIMULATES
--------------------------
Five things stack up, in this order:

1. NATIVE GRID
   Wall width divided by pitch gives the real panel resolution. Your content is
   resampled to exactly that grid. A 12 m wall at 3.9 mm is 3077 px wide - your
   4K master loses 20% of its detail before anything else happens. This is
   usually what kills a design, not the pitch itself.

2. PHYSICAL PIXEL STRUCTURE
   Each wall pixel is drawn as a hard-edged lit square with a black gap around
   it, sized from the fill factor (lit LED area vs. the pitch cell). SMD is
   roughly 40-55%, GOB/COB roughly 70-90%.
   Fill factor changes STRUCTURE ONLY. Mean brightness is held constant, because
   a real wall is calibrated to its rated nits whatever the fill factor - the
   LEDs are simply driven harder. Without that correction the tool would punish
   low-fill SMD product for a brightness loss it does not actually have.

3. AMBIENT WASH
   Light falling on the panel face lifts blacks and crushes contrast:
   out = ambient + (1 - ambient) x image. 0% is a blackout room, 10-20% a lit
   hall, 30%+ daylight or a heavily lit booth. This is the single most common
   reason a dark, moody grade dies on the floor while looking perfect at your
   desk. It is a contrast model, not a calibrated photometric one.

4. THE EYE
   Human acuity is about 1 arcminute. At distance D the eye cannot resolve
   detail finer than 0.291 mm per metre of distance. That is applied as a
   low-pass filter, minus whatever your own eye is already doing to your
   monitor, so the two are not double-counted.

5. THE READOUT BAR
   Live: native resolution, total pixels, how much of your content is being
   thrown away, what the eye resolves at that distance, whether the grid is
   visible, and two distances explained below.


THE TWO DISTANCES
-----------------
ACUITY LIMIT (3.44 x pitch) is where the pitch equals the eye's 1-arcminute
resolution limit. It is derived from the acuity constant, not hard-coded.

STRUCTURE-FREE AT (5.7 x pitch) is further away, and is where this tool stops
calling the structure detectable at all. The gap between the two is deliberate:
a repeating grid stays visible somewhat past the limit for a single isolated
feature, which is why people still report seeing screen-door slightly beyond the
textbook "retina" distance.

Quote the first number to sound like the textbook. Trust the second one.


THE THREE JOBS
--------------
JUDGING YOUR OWN RENDER
  Mode "Wipe vs. source". Left of the bar is an ideal infinite-resolution wall,
  right is the real one - same distance, same eye filter, so the only difference
  is what the pitch costs you.
  Then "Measure a feature": drag a box over a cap-height letter or the thinnest
  line that has to read. You get its height in wall pixels, in millimetres, and
  in arcminutes at the viewing distance, with a verdict. Rules of thumb baked
  in: under ~6 wall px of cap height or under ~12 arcminutes will not read.
  In A/B mode the measurement uses whichever view you dragged in, and says so.

SELLING A PITCH TO A CLIENT
  Mode "A / B pitch". Two pitches, same content, same distance, side by side.
  "Save comparison PNG" bakes in wall size, both pitches, distance, native
  resolution - AND the viewing contract (see below).

GENERAL SPEC WORK
  Set the wall and walk the distance slider. Arrow keys nudge it, shift for 5 m.


THE EXPORT CARRIES A VIEWING CONTRACT - READ THIS
-------------------------------------------------
A pitch simulation is only true at one specific ratio of displayed size to
viewing distance. A 12 m wall shown as a 25 cm image on a laptop is optically
the same as standing 50 m back, and every pitch looks flawless at 50 m.

So the exported PNG states the rule directly on the caption strip:

    "Angularly true only when viewed from N x its displayed width."

where N = viewer distance / wall width. A 6 m wall viewed from 5 m gives 0.83,
so a 25 cm-wide slide must be viewed from 21 cm to be honest.

The export also bakes the audience's acuity in ABSOLUTELY rather than relying on
the recipient's own eye and monitor to supply the difference, since neither is
knowable. Without both of these the PNG flatters the wall - which matters,
because the PNG is the artifact that reaches the person signing the cheque.


ZOOM MODES
----------
EYE-MATCH   Scales the wall so its angular size on your monitor equals the real
            wall's at the viewer distance. Best for composition and legibility.
            Caveat: at this scale one LED is roughly one monitor pixel, so the
            physical gap cannot be drawn. Exactly in the band where the pitch
            decision is live, the view can look clean while the readout says the
            audience would see structure. A banner appears on the canvas when
            that is happening. Trust the readout, inspect in 1:1.

FIT         Whole wall on screen. Watch the "your eye is ~N m from this wall"
            figure - fitting a 12 m wall onto a monitor is optically the same as
            standing 25 m back, which is why everything always looks fine here.

1:1         One wall millimetre = one real millimetre on your monitor. The only
            mode that can honestly show pixel structure. Scroll to zoom
            (anchored on the cursor), drag to pan, double-click to recentre.

FREE        Anything. The equivalent-distance readout keeps you honest.


SCALER SETTING
--------------
"Good processor" resamples progressively; "cheap processor" uses nearest
neighbour. If your design only survives the good one, say so in the spec,
because you do not always get to choose the processor. Note that the filtered
path uses the browser's own high-quality resampler, which is a hint rather than
a guaranteed box filter - results can differ slightly outside Chrome.


KNOWN SIMPLIFICATIONS (things it does NOT model)
------------------------------------------------
Stated plainly, because a measuring instrument that hides its limits is worse
than one that has none.

- Resampling and the acuity blur run in sRGB gamma space, not linear light.
  Real light mixes linearly, so fused detail is slightly darker here than
  physics. Affects fine detail near black more than anything else.
- No bit-depth or PWM model, so low-luminance banding is not shown. A 16-bit
  smooth vignette that bands on a real panel will look clean here. Test dark
  ramps on real hardware.
- No off-axis model. Booth audiences view at 45-60 degrees, where colour and
  brightness shift (though grid visibility actually improves).
- Static acuity only. Moving content reads worse than a still frame at the same
  pitch, so still-frame judgements err on the safe side.
- No nits, no photometry. The ambient wash is a contrast model, not a measured
  one - it tells you the shape of the problem, not the number.
- The pixel gap is not drawn below 3 screen pixels per LED cell. Mean brightness
  stays correct either way; only the visible structure is affected, and the tool
  says so on the canvas when it matters.


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
  testcard.png       3840x2160 legibility test card
  make-testcard.ps1  regenerates it
  testclip.mp4       4 s moving 4K clip, for checking the video path
  README.txt         this file

The test card is the fastest sanity check: load it, set your wall and distance,
and read down the text ladder until the rows stop being legible. That row height
in source pixels is your floor for that wall at that distance.


VERIFICATION STATUS (2026-08-12)
--------------------------------
Reviewed by two independent reviewers (a code reviewer and an adversarial model
auditor) and re-tested after every fix.

Verified against the test card:
  - native resolution, content scale, eye-resolution, structure verdicts and
    both distances checked against hand maths on four wall configurations
    (6x3 @2.9mm, 12x4 @3.9mm, 3x2 @1.5mm, 30x8 @2.6mm) - all correct
  - the acuity limit is derived from the acuity constant, so the two cannot
    drift apart
  - the acuity filter demonstrably removes detail with distance
  - fill factor from 90% to 25% now holds mean brightness within 3.6%
  - ambient wash measured: 30% wash on a 14/255 black lifts it to 86/255,
    matching amb + (1-amb) x in exactly
  - measure tool agrees with independent maths, including on the B view in A/B
    mode (which previously reported pitch A's numbers - a 3.4x error)
  - cursor-anchored zoom drifts 0.6 wall px in 1282 over 14 zoom steps
  - 17 hostile-input cases (zero/negative/text/absurd walls and pitches,
    extreme zoom and pan, fill and ambient extremes) throw nothing, produce no
    NaN or Infinity readouts, and no longer hang the renderer
  - simulate / wipe / A-B modes all render; PNG export produces a correctly
    named file with the viewing contract stamped on it

NOT verified: the video path (load, play, scrub). It could not be tested from an
automated session because Chrome refuses to load media in a backgrounded tab.
The code path is the same pipeline as stills and the lifecycle bugs found in it
have been fixed, but that is an argument, not a test. Drag testclip.mp4 in and
press Play to confirm - it is a five-second check.


SCRIPTING HANDLE
----------------
window.SQUINT exposes { S, nativeRes, contentRect, cellPx, draw, ppmmDev,
viewUnder, geo, geoB, HAS_FILTER, ARCMIN_RAD, MM_PER_M } from the console, if
you ever want to drive it or batch out comparisons.
