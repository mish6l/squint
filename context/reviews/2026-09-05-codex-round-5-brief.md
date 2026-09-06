# SQUINT — code review brief, round 5: non-square Custom cabinets

**Reviewer instructions.** You are reviewing an UNCOMMITTED change to SQUINT, a
single-file WebGL2 LED-wall simulator. Read-only — flag, don't fix. Work from the
diff embedded at the end of this file; if you can read the repository at
`D:/Mishal/Claude Code/SQUINT` (branch `main`, base commit `4320719`), also open
`squint.html` in full so every line reference below can be checked in context.
The diff is against `4320719`. `index.html` is omitted from the diff because it
is a byte-identical mirror of `squint.html` (GitHub Pages serves the repo root);
the rule is that the two files must be the same blob in every commit.

## What the change is

A field user (Reddit, r/VideoEngineering) asked for non-square custom LED
cabinets. The tool already ships two non-square presets (`500×1000` via
`tall:2`, `600×337.5` via `ar:337.5/600`) and the helpers `cabPxY()` /
`cabMMY()` carry aspect correctly, but `cab()` hard-coded `{tall:1, ar:1}` on
the custom branch and the Custom row exposed only width-mm and pixels-across.

The change adds **one input — cabinet height in mm (`S.cabHMM`)** — routed
through the existing `tall/ar` vocabulary (`ar = H/W`), with rows derived by the
unchanged `cabPxY()`. A four-field datasheet model (W×H mm + W×H px) was
considered and rejected because it needs a refusal gate consulted at five sites
and misses two; do not propose it.

Everything the change touches, in order of the file:

| Site | Change |
|---|---|
| Panel HTML (`#rowCustom`, `#rowCustomH`, `#rowCustomPx`) | Custom is three rows, one input each (`cabMM` "mm wide", `cabHMM` "mm tall", `cabPX` "px wide"); `step="0.5"` on mm; `autocomplete="off"` on the five cabinet inputs |
| `S` literal | `cabHMM:500` added (must equal the DOM `value="500"`; boot never reads inputs; `draw()` runs before `setCabMode(true)`) |
| `CABS` header comment | corrected ("every one is a 500 mm tile" was false) |
| `cab()` | custom branch: `h=(S.cabHMM>0)?S.cabHMM:S.cabMM` (NaN guard), returns `ar:h/S.cabMM, mmY:h, custom:true` |
| `fmtM()` (new) | 4-dp metre formatter for the export caption |
| `cabMMY()` | returns `c.mmY` when present (typed mm, no `mm*(h/mm)` float noise); presets take the old expression |
| `cabRowsRes()` (new) | `{rows, want, res, mmQ}` — rows the typed height implies at the width pitch vs `cabPxY()`; `mmQ = want*mm/px` (multiply before divide) |
| `cabTileTxt()` (new) | one source for the "(px / mm)" tile clause; W×H form only when `c.custom && nonSq` so preset strings are unchanged |
| `tileMMY()` (new) + `syncFromCabinets()` | **a custom tile is ALWAYS built from its whole-LED height `mmQ`** (no tolerance branch); presets from `cabMMY()`; so `ny == cabY*cabPxY()` for custom by construction |
| free-size `num()` binders | call `syncPlan()` after `draw()` so the build plan follows free edits |
| `cabRefresh()` | toggles the three rows from one clamped boolean; hint uses `cabTileTxt`; custom-only ⚠ line when `res>0.1`, quantised clause when `0.005<res<=0.1` |
| `setCabMode(false)` | repopulates `#wallW/#wallH/#pitchA` from `S` (they were never written from state) |
| `cabNum()` | fractional flag: mm fields keep fractions (337.5), px/counts stay integer |
| `composeExport()`, `exportTemplate()` | refuse with a toast when `wallMode==='cab' && cab().custom && cabRowsRes().res>0.1` |
| export caption | `fmtM(S.wallW)` / `fmtM(S.wallH)` |
| `window.SQUINT` | exports `cabMMY, cabRowsRes, cabTileTxt, cabRefresh` |
| `syncPlan()` | true-pitch line uses `cabTileTxt(' / ')`; custom-only `height check` line when `res>0.1` |
| layout-guide stamp | font from `min(nx,ny)` so a portrait wall's stamp stays inside the canvas |
| `README.txt`, `README.md` | cabinet paragraph, corrected tile-variance limitation, refreshed scripting-handle list |

## Ground truth — do not re-litigate

- Pitch is DERIVED: `cabinet_mm / cabinet_px`. A nominal pitch is never typed.
  `cabPitch()` is the only pitch in the file. LED pixels are square.
- Presets 1–6 and the untouched default Custom (`500 / 500 / 192`) must be
  **byte-identical** to base `4320719` in geometry, pixels, caption, filename
  and hint text. Proven so far: a Node harness over the extracted shipped
  source (91 rows) and real-Chrome runs; `fmtM` proven equal to `String(v)` over
  all 168 preset metre values.
- The pre-existing double rounding between `screenRes().ny` (per wall) and
  `cabY*cabPxY()` (per tile) — preset 6 gives 1169 vs 1170 at cabY ≥ 9 — is
  **deliberately left in place for presets** (fixing it changes preset 6's
  numbers; scheduled as its own change). The custom path no longer carries it.
- The export refusal on `res>0.1` is a product decision by the owner ("refuse
  rather than render an unbacked answer"). Comment on its *correctness*, not on
  whether it should exist.
- The previous three review rounds (Aug 2026) found 23 defects, every one at a
  SEAM between subsystems — a control correct alone but not reaching another
  consumer. `selftest()` is blind to such bugs by construction (it forces a
  neutral world). Review the seams, not the maths.

## Already reviewed — do not re-report

Two Codex passes ran on 2026-09-05 (`gpt-5.6-sol`); their text is in
`reviews/2026-09-05 codex round 4 - custom cabinet height.md` and
`reviews/2026-09-05 codex round 4b - delta on the fixes.md`.

- **Round 4, High (fixed):** the per-tile residual gate let the wall-level
  mismatch accumulate (`500/760.2/192` @ 20 → `ny 5838` vs a 5840 tile grid).
  Fixed by building custom walls from the whole-LED tile height (`tileMMY()`).
- **Round 4, Med (fixed):** a 3-dp caption formatter broke preset 6 at odd cabY
  (`0.3375 → 0.338`). Fixed with `fmtM()` at 4 dp.
- **Round 4, Low:** vault documentation — done.
- **Round 4b, Low (fixed, NOT yet reviewed by anyone):** `tileMMY()` had a
  `res<1e-9` shortcut that kept the typed height; a per-tile epsilon cannot prove
  an all-count invariant. Removed — custom always uses `mmQ`, and `mmQ` is now
  `want*mm/px` (multiply first) so a height that IS a whole number of rows stays
  exact (`384*500/192 = 1000`). **This final state of `cabRowsRes()` /
  `tileMMY()` / `syncFromCabinets()` is the one thing no reviewer has seen.**
- Round 4b confirmed correct: presets byte-identical through the new path;
  `syncFromCabinets()` UI-only and selftest-safe; no recursion in `tileMMY()`;
  three-row layout wired correctly; consumers of `S.wallH` consistent with the
  tiled height; `spanW()` and the viewing contract are width-only.

## What to check in this round, with `squint.html:LINE` evidence

1. **The unreviewed final geometry.** With `tileMMY()` always returning `mmQ`
   for custom: is `ny == cabY*cabPxY()` for every custom configuration a GPU
   can hold? Is `mmQ = want*mm/px` exact in the whole-row case for realistic
   inputs (fractional mm like 337.5, widths like 600)? Any custom input where
   the `Math.max(1,c.px)` floor, a fractional `cabMM`, or `cabPX=1` produces a
   wrong or NaN value downstream?
2. **Byte-identity, adversarially.** Find any preset, at any `cabX`/`cabY`
   1…24, any mode (A/B compare, array, processor), where a printed string,
   filename, caption or pixel differs from base. Candidates: `cabTileTxt`'s
   `nonSq` gate, `fmtM` on the array caption branch, `cabRefresh`'s toggle, the
   guide-stamp font (`min(nx,ny)` vs `ny` — any preset layout where `nx<ny`?).
3. **Seams.** Trace every consumer of cabinet geometry and of `S.wallH`:
   `screenRes`/`nativeRes`, the `uCabPx` uniform, `drawCabGrid`,
   `exportTemplate`'s `cpx/cpy`, `contentRect`, `cellPx`, the measure/readout
   code, `syncPlan`, the caption, filenames, `selftest()`'s `keep`, and the boot
   order. Does any consumer now see the *typed* height where it should see the
   *tiled* one, or vice versa?
4. **The hint and plan text for custom.** Are the ⚠ line, the quantised clause
   and the `height check` line correct in every combination of `res` (0, ≤0.005,
   0.005–0.1, >0.1)? Do they agree with what `S.wallH`/`ny` actually are after
   the tiled-height change (e.g. `500/750.9/192`: hint says `6.00 × 4.50 m =
   2304 × 1728` and "Simulating 288 rows = 750 mm")?
5. **Refusal mechanics.** `composeExport` early-returns via `toast()`; its
   caller `exportPng` restores `absBlur` and the button in `finally`.
   `exportTemplate` returns before allocating its canvas. Any path where a
   refused export leaves state changed, or where a preset could be refused?
6. **State and restore.** `S.cabHMM` default in the literal; the DOM default
   equals it; `selftest()` never writes cabinet keys; no persistence of cabinet
   keys exists. Any enumeration of `S` keys that silently drops `cabHMM`?
7. **Free-size crossover.** `setCabMode(false)` now writes the free inputs from
   `S`; free inputs call `syncPlan()`. Any side effect on cab→free→cab
   round-trips, on `pitchB`, or on first boot?
8. **Docs honesty.** Does `README.txt`'s new cabinet paragraph and the corrected
   tile-variance sentence describe exactly what the code does — nothing more?
9. Anything else, ranked by severity. Prefer defects you can prove with a line
   and an expression over style.

## Output

Write the review as Markdown with: a one-paragraph verdict (ready / not ready);
numbered findings, each with **Severity** (High/Med/Low), `squint.html:LINE`,
the expression, why it is wrong, and the correct behaviour; a short "Confirmed
correct" list of what you checked that holds. If you can write files, save it as
`D:/Mishal/Claude Code/SQUINT/reviews/2026-09-05 codex round 5 - fresh pass.md`
and end with `done: written to <path>`; otherwise return the review inline.

---

## The diff (against `4320719`; `index.html` omitted — it mirrors `squint.html`)

```diff
diff --git a/README.md b/README.md
index ce6fc8b..49b0f6f 100644
--- a/README.md
+++ b/README.md
@@ -36,7 +36,7 @@ are guesses and the top bar says UNCALIBRATED.
 | | |
 |---|---|
 | **Native grid** | Content resampled to the wall's true LED grid by an exact box filter |
-| **Cabinets** | Walls are built from real tiles, and the pitch is derived from the tile — a 500 mm cabinet at "2.6 mm" carries 192 px, so the true pitch is 2.604 mm and a 12×6 wall is exactly 2304×1152 |
+| **Cabinets** | Walls are built from real tiles, and the pitch is derived from the tile — a 500 mm cabinet at "2.6 mm" carries 192 px, so the true pitch is 2.604 mm and a 12×6 wall is exactly 2304×1152. Custom tiles take width × height; a height that isn't a whole number of LEDs is flagged |
 | **Processor feed** | A 2304-wide wall fed 1920×1080 is a 1920-wide wall that happens to contain more LEDs. Content is genuinely resampled through the feed's grid |
 | **Bit depth / drive** | Quantisation in the signal domain. An 8-bit chain at 20% drive collapses a 40-level dark ramp to 9 — this is why dark grades band on real walls |
 | **Pixel structure** | Analytic sub-pixel fill coverage; fill factor costs structure, never brightness, because a real wall is calibrated to its rated nits whatever the fill |
diff --git a/README.txt b/README.txt
index 6bc7044..ba1ae87 100644
--- a/README.txt
+++ b/README.txt
@@ -102,7 +102,11 @@ mapping and every downstream number slightly wrong.
 
 BUILD FROM CABINETS is the default. Pick a tile, set cabinets across and down,
 and the wall metres, the true pitch and the exact native resolution all derive.
-Free size is still there for quick what-ifs, and says so when you use it.
+Custom takes cabinet width and height in mm plus pixels across; pixels down
+derive from the height (LED pixels are square), the hint shows the derived rows,
+and a height that is not a whole number of LEDs is flagged - and refused at
+export - because one of the three numbers is then a datasheet round-off or a
+typo. Free size is still there for quick what-ifs, and says so when you use it.
 
 PROCESSOR LIMIT is the one nobody models. A wall is fed from a processor
 output. If that feed is smaller than the wall's native grid, the wall is being
@@ -239,8 +243,10 @@ honest to leave it out, not because it was inconvenient.
   drives its LEDs well above the average luminance (4x at 25% fill), which an
   SDR monitor cannot display, so bright content clips there. Mean brightness is
   still exact once the structure fuses.
-- No moire simulation of a camera sensor, no HDR output, no per-panel calibration
-  or seam/tile variation.
+- No moire simulation of a camera sensor, no HDR output, no per-panel
+  calibration. (Tile-to-tile brightness variance IS simulated - the Tile
+  variance slider - since the event-wall build; the physical seam itself is
+  not, because on good stock it is nearly invisible.)
 
 
 KEYS
@@ -303,4 +309,10 @@ SCRIPTING HANDLE
 ----------------
 window.SQUINT exposes { S, nativeRes, contentRect, cellPx, draw, ppmmDev,
 viewUnder, geo, geoB, GLE, selftest, ambientFraction, contrastRatio,
-offAxisGain, ARCMIN_RAD, MM_PER_M } from the console.
+offAxisGain, effectiveNits, blackFraction, spanW, ARCMIN_RAD, MM_PER_M,
+CABS, cab, cabPitch, cabPxY, cabMMY, cabRowsRes, cabTileTxt, cabRefresh,
+syncFromCabinets, screenRes, effectiveRes, gapPx, syncPlan, exportTemplate }
+from the console. The cabinet helpers are how a change to the wall model gets
+verified: set S, call syncFromCabinets(); draw(); cabRefresh(), then read
+nativeRes(S.pitchA), cabPxY() and cabRowsRes() - numbers only the correct code
+can produce. selftest() alone cannot see a wrong cabinet height.
diff --git a/squint.html b/squint.html
index d8a0696..f2142f3 100644
--- a/squint.html
+++ b/squint.html
@@ -212,14 +212,21 @@ video{position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-e
             <select id="cabSel"></select>
           </div>
           <div class="row"><label>Cabinets</label>
-            <input type="number" id="cabX" value="12" step="1" min="1"><span class="val">across</span></div>
+            <input type="number" id="cabX" value="12" step="1" min="1" autocomplete="off"><span class="val">across</span></div>
           <div class="row"><label></label>
-            <input type="number" id="cabY" value="6" step="1" min="1"><span class="val">down</span></div>
+            <input type="number" id="cabY" value="6" step="1" min="1" autocomplete="off"><span class="val">down</span></div>
+          <!-- One input per row, like the across/down pair above: two number
+               inputs sharing a row clip "1000" at the default rail width, and
+               .val is a fixed 62 px, so units stay at 7 characters. -->
           <div class="row" id="rowCustom" style="display:none">
             <label>Custom</label>
-            <input type="number" id="cabMM" value="500" step="1" min="50" title="cabinet width, mm">
-            <input type="number" id="cabPX" value="192" step="1" min="8" title="pixels across the cabinet">
-          </div>
+            <input type="number" id="cabMM" value="500" step="0.5" min="50" autocomplete="off" title="cabinet width, mm (datasheet W)"><span class="val">mm wide</span></div>
+          <div class="row" id="rowCustomH" style="display:none">
+            <label></label>
+            <input type="number" id="cabHMM" value="500" step="0.5" min="50" autocomplete="off" title="cabinet height, mm (datasheet H) — rows derive from the width pitch"><span class="val">mm tall</span></div>
+          <div class="row" id="rowCustomPx" style="display:none">
+            <label></label>
+            <input type="number" id="cabPX" value="192" step="1" min="8" autocomplete="off" title="LEDs across the cabinet (datasheet resolution W); pixels down derive from the height"><span class="val">px wide</span></div>
           <p class="hint" id="cabHint"></p>
         </div>
         <div id="freeUI" style="display:none">
@@ -492,13 +499,13 @@ const $ = id => document.getElementById(id);
 const clamp = (v,a,b) => v<a?a:v>b?b:v;
 
 const S = {
-  wallW:6, wallH:3, pitchA:2.9, pitchB:3.9, fill:.5,   // pitchB must match the DOM default
+  wallW:6, wallH:3, pitchA:2.9, pitchB:3.9, fill:.5,   // pitchB and cabHMM must match their DOM defaults (no S->DOM push exists)
   // Event walls are built from cabinets, not typed as arbitrary rectangles, and
   // the pitch is DERIVED from the tile: a "2.6 mm" 500 mm cabinet carries 192
   // pixels, so the true pitch is 500/192 = 2.604 and a 12-wide wall is exactly
   // 2304 px. Typing 6 m / 2.6 mm instead gives 2307 -- a near-miss that makes
   // every comp size and mapping slightly wrong.
-  wallMode:'cab', cabI:1, cabX:12, cabY:6, cabMM:500, cabPX:192,
+  wallMode:'cab', cabI:1, cabX:12, cabY:6, cabMM:500, cabHMM:500, cabPX:192,
   cabGrid:true, tileVar:0, procOn:false, procW:1920, procH:1080,
   arrayOn:false, arrayN:3, arrayGap:1.5,
   dist:5, fitMode:'fit', scaler:'good', ambient:0, absBlur:false, calibrated:false,
@@ -517,9 +524,11 @@ const mk = () => document.createElement('canvas');
 const idealCv=mk();
 
 /* ================= geometry ================= */
-/* Generic rental cabinets, by pitch. Every one is a 500 mm tile carrying a whole
-   number of pixels, which is what makes the nominal pitch a round-off: the true
-   pitch is always cabinet_mm / cabinet_px. */
+/* Generic rental cabinets, by pitch. `mm` is the cabinet WIDTH and `px` the LEDs
+   ACROSS it; the height is width x ar x tall (500x1000 via tall:2, 600x337.5 via
+   ar). LED pixels are square, so rows derive from the height at the width pitch.
+   Custom takes W and H in mm plus pixels across. The nominal pitch is a
+   round-off: the true pitch is always cabinet_mm / cabinet_px. */
 const CABS=[
   {n:'500×500 · 1.95 mm (256 px)', mm:500, px:256},
   {n:'500×500 · 2.6 mm (192 px)',  mm:500, px:192},
@@ -532,23 +541,65 @@ const CABS=[
 ];
 function cab(){
   const c=CABS[clamp(S.cabI,0,CABS.length-1)];
-  if(c.custom) return {mm:S.cabMM, px:S.cabPX, tall:1, ar:1, n:'Custom'};
+  if(c.custom){
+    // Height in the same tall/ar vocabulary the presets use (ar = H/W), plus the
+    // typed mm itself so it is never reconstructed as mm*(h/mm) -- that product
+    // is float-noisy in ~11% of integer pairs and would land on the caption.
+    // (S.cabHMM>0) is the NaN guard: Math.max(1,NaN) is NaN and nothing throws.
+    const h=(S.cabHMM>0)?S.cabHMM:S.cabMM;
+    return {mm:S.cabMM, px:S.cabPX, tall:1, ar:h/S.cabMM, mmY:h, custom:true, n:'Custom'};
+  }
   return {mm:c.mm, px:c.px, tall:c.tall||1, ar:c.ar||1, n:c.n};
 }
 function cabPitch(){ const c=cab(); return c.mm/Math.max(1,c.px); }
 // A derived pitch is a long float (500/192 = 2.6041666...). Never print it raw:
 // it lands on labels, filenames and the client-facing caption strip.
 function fmtPitch(p){ return (+p).toFixed(3).replace(/0+$/,'').replace(/\.$/,''); }
+// Metres on the caption strip: 4 dp strips float noise from a tiled custom
+// height (5 x 760.417 mm = 3.802083333 m) while every preset value -- k x 0.5,
+// k x 1.0, k x 0.3375 -- survives byte-for-byte. fmtPitch's 3 dp would print
+// the 600x337.5 preset's 0.3375 m as 0.338 (Codex, round 4).
+function fmtM(v){ return (+v).toFixed(4).replace(/0+$/,'').replace(/\.$/,''); }
 // Cabinet height in pixels: square pixels, so it follows the physical aspect.
 function cabPxY(){ const c=cab(); return Math.max(1,Math.round(c.px*c.ar*c.tall)); }
-function cabMMY(){ const c=cab(); return c.mm*c.ar*c.tall; }
-// Drive the physical wall from the cabinet grid. wallW*1000/pitch then lands on
-// an exact integer by construction, so nativeRes() needs no special case.
+function cabMMY(){ const c=cab(); return c.mmY!==undefined ? c.mmY : c.mm*c.ar*c.tall; }
+// Rows the typed height implies at the width pitch, against the rows actually
+// drawn. Measured against cabPxY() -- what the renderer uses -- not round(rows):
+// round(px*H/W) and round(H/(W/px)) can disagree on an exact .5.
+// mmQ multiplies before it divides (want*mm/px, not want*pitch) so a height that
+// IS a whole number of rows comes back exactly: 384*500/192 = 1000, where
+// 384*2.6041666… may not.
+function cabRowsRes(){ const c=cab(), p=cabPitch(), rows=cabMMY()/p, want=cabPxY();
+  return {rows, want, res:Math.abs(rows-want), mmQ:want*c.mm/Math.max(1,c.px)}; }
+// One source for the "(px / mm)" tile clause in the hint and the build plan.
+// Presets keep their exact old string; only a non-square CUSTOM tile gets the
+// W x H form, so nothing a preset prints changes.
+function cabTileTxt(sep){ const c=cab();
+  const nonSq = c.custom && (cabPxY()!==c.px || cabMMY()!==c.mm);
+  return nonSq ? `${c.px} × ${cabPxY()} px on ${fmtPitch(c.mm)} × ${fmtPitch(cabMMY())} mm`
+               : `${c.px} px${sep}${c.mm} mm`; }
+// The tile height the wall is BUILT from. A custom tile is ALWAYS simulated at
+// its whole-LED height (cabRowsRes().mmQ) -- no tolerance branch -- so the wall
+// is exactly cabY tiles tall and ny == cabY*cabPxY() for any wall a GPU can
+// hold (the products agree to float precision; a mismatch needs cabY*rows
+// beyond ~1e14). Building from the typed height instead lets a residual under
+// the refusal threshold accumulate: 500x760.2 at 192 px is 0.08 px off per
+// tile, which is 5838 native rows against a 20x292 tile grid -- two rows short
+// while the plan still claimed whole cabinets (Codex, round 4; the earlier
+// res<1e-9 shortcut was its round-4b finding). Presets keep the shipped
+// physical height on purpose: the 600x337.5 preset carries the same seam
+// (1169 vs 1170 at cabY>=9) and stays byte-identical until that is changed
+// deliberately (plan F1).
+function tileMMY(){ const c=cab(); return c.custom ? cabRowsRes().mmQ : cabMMY(); }
+// Drive the physical wall from the cabinet grid. wallW*1000/pitch lands on an
+// exact integer by construction, and so does wallH for a custom tile (above).
+// Must stay UI-only (never called from draw()): selftest writes wallW/wallH/
+// pitchA directly with wallMode still 'cab'.
 function syncFromCabinets(){
   if(S.wallMode!=='cab') return;
   S.pitchA = cabPitch();
   S.wallW  = S.cabX*cab().mm/1000;
-  S.wallH  = S.cabY*cabMMY()/1000;
+  S.wallH  = S.cabY*tileMMY()/1000;
 }
 // One screen, in pixels.
 function screenRes(pitch){
@@ -1470,7 +1521,9 @@ PITCHES.forEach(p=>{
 });
 
 const num=(id,key,after)=>{ $(id).oninput=e=>{ const v=parseFloat(e.target.value); if(isFinite(v)&&v>0){ S[key]=v; (after||draw)(); } }; };
-num('wallW','wallW'); num('wallH','wallH'); num('pitchA','pitchA'); num('pitchB','pitchB');
+// Free-size edits change the comp size, so the build plan must follow them.
+const rePlan=()=>{ draw(); syncPlan(); };
+num('wallW','wallW',rePlan); num('wallH','wallH',rePlan); num('pitchA','pitchA',rePlan); num('pitchB','pitchB');
 
 $('fill').oninput=e=>{ S.fill=e.target.value/100; $('fillV').textContent=e.target.value+'%'; draw(); };
 $('amb').oninput =e=>{ S.ambient=e.target.value/100; $('ambV').textContent=e.target.value+'%'; draw(); };
@@ -1496,12 +1549,21 @@ CABS.forEach((c,i)=>{ const o=document.createElement('option'); o.value=i; o.tex
                       $('cabSel').appendChild(o); });
 $('cabSel').value=String(S.cabI);
 function cabRefresh(){
-  $('rowCustom').style.display = CABS[S.cabI].custom ? 'flex' : 'none';
-  const c=cab(), p=cabPitch(), {nx,ny}=nativeRes(S.pitchA);
-  $('cabHint').innerHTML =
+  const cu=CABS[clamp(S.cabI,0,CABS.length-1)].custom;
+  $('rowCustom').style.display=$('rowCustomH').style.display=$('rowCustomPx').style.display=cu?'flex':'none';
+  const c=cab(), p=cabPitch(), {nx,ny}=nativeRes(S.pitchA), rr=cabRowsRes();
+  let html =
     `<b>${S.cabX} × ${S.cabY}</b> cabinets = <b>${S.wallW.toFixed(2)} × ${S.wallH.toFixed(2)} m</b>`+
     ` = <b>${nx} × ${ny} px</b><br>true pitch <b>${p.toFixed(3)} mm</b>`+
-    ` (${c.px} px across ${c.mm} mm) — the nominal figure is a round-off.`;
+    ` (${cabTileTxt(' across ')}) — the nominal figure is a round-off.`;
+  // A custom height that is not a whole number of LEDs at the width pitch is a
+  // datasheet round-off or a typo. Say what is actually being simulated; the
+  // exports refuse until the numbers agree (composeExport / exportTemplate).
+  if(c.custom && rr.res>0.1)
+    html += `<br><span class="no">⚠ ${fmtPitch(cabMMY())} mm tall is ${rr.rows.toFixed(2)} pixels at ${fmtPitch(p)} mm — not a whole number. LED pixels are square, so one of width / pixels across / height is a datasheet round-off or a typo. Simulating ${rr.want} rows = ${fmtPitch(rr.mmQ)} mm.</span>`;
+  else if(c.custom && rr.res>0.005)
+    html += `<span class="mid"> (rows quantised: ${rr.want} × ${fmtPitch(p)} = ${fmtPitch(rr.mmQ)} mm)</span>`;
+  $('cabHint').innerHTML = html;
   syncPlan();
 }
 function setCabMode(cabMode){
@@ -1511,14 +1573,21 @@ function setCabMode(cabMode){
   $('modeCab').classList.toggle('on',cabMode);
   $('modeFree').classList.toggle('on',!cabMode);
   if(cabMode) syncFromCabinets();
+  // Free size inherits the cabinet-built wall, so show it: the rail otherwise
+  // keeps its HTML defaults (6 / 3 / 2.9) while S and every export carry the
+  // cabinet numbers.
+  else { $('wallW').value=S.wallW; $('wallH').value=S.wallH; $('pitchA').value=fmtPitch(S.pitchA); }
   draw(); cabRefresh();
 }
 $('modeCab').onclick=()=>setCabMode(true);
 $('modeFree').onclick=()=>setCabMode(false);
 $('cabSel').onchange=e=>{ S.cabI=+e.target.value; syncFromCabinets(); draw(); cabRefresh(); };
-const cabNum=(id,key)=>{ $(id).oninput=e=>{ const v=parseFloat(e.target.value);
-  if(isFinite(v)&&v>0){ S[key]=Math.max(1,Math.round(v)); syncFromCabinets(); draw(); cabRefresh(); } }; };
-cabNum('cabX','cabX'); cabNum('cabY','cabY'); cabNum('cabMM','cabMM'); cabNum('cabPX','cabPX');
+// mm fields keep fractions (337.5 is a shipped preset height); px and counts
+// stay integer. Order is sync -> draw -> refresh.
+const cabNum=(id,key,frac)=>{ $(id).oninput=e=>{ const v=parseFloat(e.target.value);
+  if(isFinite(v)&&v>0){ S[key]=Math.max(1, frac ? v : Math.round(v)); syncFromCabinets(); draw(); cabRefresh(); } }; };
+cabNum('cabX','cabX'); cabNum('cabY','cabY');
+cabNum('cabMM','cabMM',true); cabNum('cabHMM','cabHMM',true); cabNum('cabPX','cabPX');
 
 $('tCabGrid').onclick=e=>{ S.cabGrid=!S.cabGrid; e.target.classList.toggle('on',S.cabGrid); draw(); };
 $('tProc').onclick=e=>{ S.procOn=!S.procOn; e.target.classList.toggle('on',S.procOn);
@@ -1799,6 +1868,12 @@ function exportPng(btn){
              btn.textContent='Save comparison PNG'; btn.disabled=false; } }
 }
 function composeExport(btn){
+  // A custom tile whose height is not a whole number of LEDs would caption the
+  // typed height over pixels drawn at the quantised one. Refuse rather than
+  // ship a number the render does not back; exportPng's finally restores the
+  // button and absBlur.
+  if(S.wallMode==='cab' && cab().custom && cabRowsRes().res>0.1)
+    return toast('Custom cabinet height is not a whole number of LEDs — fix the datasheet numbers before exporting');
   const a=$('cvA'), ab=S.mode==='ab', wipe=S.mode==='wipe';
   const b=$('cvB');
   const W=ab?a.width+b.width+8:a.width, H=a.height+124;
@@ -1837,8 +1912,8 @@ function composeExport(btn){
   // State the span the recipient is being asked to judge, not one screen of it.
   const span=spanW(), arrN=S.arrayOn?Math.max(2,S.arrayN|0):1;
   const wallTxt = arrN>1
-    ? `${arrN} × ${S.wallW} m screens on ${S.arrayGap.toFixed(2)} m gaps = ${span.toFixed(2)} × ${S.wallH} m overall`
-    : `${S.wallW} × ${S.wallH} m wall`;
+    ? `${arrN} × ${fmtM(S.wallW)} m screens on ${S.arrayGap.toFixed(2)} m gaps = ${span.toFixed(2)} × ${fmtM(S.wallH)} m overall`
+    : `${fmtM(S.wallW)} × ${fmtM(S.wallH)} m wall`;
   const l1 = `${wallTxt}   ·   viewer at ${S.dist.toFixed(1)} m   ·   ${S.name}`;
   const l2 = ab
     ? `A: ${fmtPitch(S.pitchA)} mm → ${nx}×${ny}      B: ${fmtPitch(S.pitchB)} mm → ${nativeRes(S.pitchB).nx}×${nativeRes(S.pitchB).ny}      eye resolves ${(MM_PER_M*S.dist).toFixed(2)} mm`
@@ -1889,7 +1964,8 @@ window.SQUINT = { S, nativeRes, contentRect, cellPx, draw, ppmmDev, viewUnder,
                   geo:()=>geoA, geoB:()=>geoB, ARCMIN_RAD, MM_PER_M,
                   GLE, selftest, ambientFraction, contrastRatio, offAxisGain,
                   effectiveNits, blackFraction, spanW,
-                  CABS, cab, cabPitch, cabPxY, syncFromCabinets, screenRes,
+                  CABS, cab, cabPitch, cabPxY, cabMMY, cabRowsRes, cabTileTxt, cabRefresh,
+                  syncFromCabinets, screenRes,
                   effectiveRes, gapPx, syncPlan, exportTemplate };
 
 /* ---------- build plan ----------
@@ -1908,7 +1984,10 @@ function syncPlan(){
   }
   if(S.wallMode==='cab'){
     L.push(`cabinets       ${S.cabX} × ${S.cabY}${n>1?` per screen (${S.cabX*n} total)`:''} = ${S.cabX*S.cabY*n}`);
-    L.push(`true pitch     ${cabPitch().toFixed(3)} mm  (${c.px} px / ${c.mm} mm)`);
+    L.push(`true pitch     ${cabPitch().toFixed(3)} mm  (${cabTileTxt(' / ')})`);
+    const rr=cabRowsRes();
+    if(c.custom && rr.res>0.1)
+      L.push(`height check   <span class="no">${rr.rows.toFixed(2)} rows at ${fmtPitch(cabPitch())} mm — check datasheet; simulating ${rr.want} rows (${fmtPitch(rr.mmQ)} mm)</span>`);
   } else {
     L.push(`pitch          ${pitch.toFixed(2)} mm  <span class="mid">(free size — not cabinet-quantised)</span>`);
   }
@@ -1928,6 +2007,8 @@ function syncPlan(){
 function exportTemplate(){
   const pitch=S.pitchA, {nx,ny}=nativeRes(pitch), sr=screenRes(pitch);
   const n=S.arrayOn?Math.max(2,S.arrayN|0):1, gp=gapPx(pitch);
+  if(S.wallMode==='cab' && cab().custom && cabRowsRes().res>0.1)
+    return toast('Custom cabinet height is not a whole number of LEDs — fix the datasheet numbers before exporting');
   if(nx*ny>80e6) return toast('Native grid too large to write a guide');
   const cvT=mk(); cvT.width=nx; cvT.height=ny;
   const c=cvT.getContext('2d');
@@ -1952,7 +2033,9 @@ function exportTemplate(){
   c.setLineDash([nx/120,nx/120]);
   c.strokeRect(nx*0.05,ny*0.05,nx*0.90,ny*0.90);        // 5% safe area
   c.setLineDash([]);
-  const fs=Math.max(14,Math.round(ny*0.035));
+  // Size the stamp from the SHORT side: a portrait wall (few columns, many rows)
+  // otherwise gets a font from ny that runs off the right edge of an nx canvas.
+  const fs=Math.max(14,Math.round(Math.min(nx,ny)*0.035));
   c.fillStyle='#ff9f1c'; c.font=`600 ${fs}px Segoe UI, sans-serif`;
   c.fillText(`${nx} × ${ny}`, fs*0.6, fs*1.5);
   c.fillStyle='#8b939e'; c.font=`${Math.round(fs*0.55)}px Consolas, monospace`;
```
