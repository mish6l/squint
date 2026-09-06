# Plan: Non-square Custom cabinets (FR-002 #1)

Status: SHIPPED 2026-09-05 — commit `6c6f0cd` on `main`; gate as run: harness 91/91 over the committed blob + real-Chrome rows; Codex rounds 4/4b closed (4b's Low fixed, harness-proven, not re-reviewed).

## Overview
The Custom cabinet row exposes only width-mm and pixels-across, and `cab()`
hard-codes `{tall:1, ar:1}` on the custom branch — so a user cannot describe a
500×1000 or 600×337.5 tile they own, even though the engine already renders both
(they ship as presets 5 and 6). Add **one input, cabinet height in mm**, routed
through the existing `tall/ar` plumbing so every downstream consumer follows
with no edit; disclose the derived rows; warn when the height is not a whole
number of LEDs. Reported by the first external field user (vault `SQUINT — field
reports`, FR-002); verified as a UI gap, not a model gap, 2026-09-03.

**Research basis:** a 12-agent seam sweep (6 read-only lenses → 3 adversarial
verifiers → 2 designs → judge), run 2026-09-04, workflow `wf_21c588df-f33`,
journal at `~/.claude/projects/C--Users-user/1a4be464-…/subagents/workflows/wf_21c588df-f33/journal.jsonl`.
Every line reference below was read against the file after the sweep. Numbers in
Validation were recomputed by hand — **one of the sweep's probe values was wrong
and is corrected here** (see recipe (e)).

## Success Criteria
- [ ] Custom row takes **W mm, H mm, px across**; rows derive as `round(px·H/W)`.
- [ ] Custom `500 / 1000 / 192` at 12×6 reproduces preset 5 exactly: `cabPxY()=384`,
      `S.wallH=6`, `nativeRes().ny=2304`, caption `6 × 6 m wall`, guide 2304×2304.
- [ ] Custom `600 / 337.5 / 231` reproduces preset 6 for cabY 1…8; from cabY 9
      the custom wall is the **tiled** grid (`ny = cabY × 130` → 1170 at 9) while
      preset 6 keeps its shipped `1169` — the preset's residue is deliberately
      untouched (F1). *(Amended after Codex round 4 — see Execution findings.)*
- [ ] Fresh load, select Custom, touch nothing → every readout string identical
      to preset 1; `$('cabHMM').value === String(S.cabHMM)`.
- [ ] Every preset's geometry, pixels, caption, filename and hint text are
      **byte-identical** to `4320719` (hint W×H form is gated on `c.custom`).
- [ ] A height that is not a whole number of LEDs (residual > 0.1 px) shows a red
      line in the hint and the build plan, **and both exports refuse with a toast**.
- [ ] `selftest()` 188 ± 6 / ≈0.1 % before and after, cabinet keys untouched by it.
- [ ] `index.html` same blob as `squint.html` in the commit; live hash == local
      after Pages rebuilds; `selftest()` green on the hosted copy.
- [ ] Gate green: fast checks + slow checks from `context/PROJECT.md`.

## Affected Areas
- `panel` — Custom row becomes two rows (W×H mm / px across); `autocomplete="off"`.
- `state` — `S.cabHMM:500` in the literal; `cab()` custom branch; `cabMMY()`
  override; two new helpers `cabRowsRes()` / `cabTileTxt()`; comment fixes.
- `outputs` — hint, build plan, caption `fmtPitch` wrap, export refusal, guide
  stamp font.
- `selftest` — console handle gains four exports for the gate recipe. `keep` unchanged.
- `docs` — `README.txt` (3 edits), `README.md` (1 row), vault `SQUINT — Documentation`
  controls table, `SQUINT — field reports` FR-002 #1 status.

## Architecture Notes

**Design chosen: one input (height mm), rows derived — over the four-field
datasheet model (W×H mm + W×H px).** The judge's reasoning, kept because it
is the project's own lesson: the four-field model can only stay honest via a
runtime refusal gate (`cabErr`) that has to be consulted at five sites and, by
its own admission, does not reach two more (`uCabPx` 1162, `drawCabGrid` 1222) —
its "held wall" state would render the new cabinet's px counts over the old
wall's extent. That is a *new seam of exactly the class round 3 found 23 of*.
The one-input model cannot admit a second (vertical) pitch by construction:
`cabPitch()` at :538 stays the only pitch in the file, and every consumer reads
one derived row count. Fewer inputs, fewer seams. A typed pixels-down could never
*feed* anything in this tool (one scalar pitch at :538/:555-556, `uCell=(cell,cell)`
at :1084/:1151) — it could only be checked, so it is echoed read-only instead.

**Reuse, not new plumbing.** `cab()` is the single choke point: it is the only
reader of `S.cabMM`/`S.cabPX` in the file (:501, :535). Emitting `ar = H/W` on the
custom branch means `cabPxY()` :543, `syncFromCabinets()` :551, `uCabPx` :1162-1164,
`drawCabGrid` :1222-1223 and `exportTemplate` :1935-1936 all follow with **zero
edits** — the same vocabulary preset 6 already uses (`ar:337.5/600`).

**Store the typed mm, don't round-trip it.** `cabMMY()` returns `c.mmY` when
present rather than `mm·ar` — `mm·(h/mm)` is float-noisy in ~11 % of integer
pairs (`51·(250/51) = 250.00000000000003`) and that noise would land on the
caption. Presets have no `mmY` and take the old expression verbatim
(`600·0.5625 = 337.5` exactly).

**NaN guard is mandatory, not defensive.** Every downstream floor is
`Math.max(1, …)`, and `Math.max(1, NaN)` is `NaN` — nothing throws, the hint
prints `2304 × NaN` and the filename becomes `…2304xNaN.png`. The custom branch
uses `(S.cabHMM>0) ? S.cabHMM : S.cabMM`, the same idiom as the preset branch's
`c.ar||1`.

**Default lives in the `S` literal, never in boot.** `draw()` already runs
before `setCabMode(true)` — `applyCal(false)` ends in `draw()` (:1592) and a
stored rail width calls `setW(w)` → `draw()` at script-parse time (:1610-1611) —
and `renderView` evaluates `cab()`/`cabPxY()` on those frames. Boot never reads
cabinet inputs (:2073-2078) and must not start.

**Residual is measured against what is DRAWN.** `cabRowsRes()` compares
`cabMMY()/cabPitch()` to `cabPxY()` (the value the renderer uses), not to
`round(rows)` — `round(px·H/W)` and `round(H/(W/px))` can land on opposite sides
of an exact .5 (the sweep found 16 such triples in 452 556).

**Decisions on the judge's unresolved items** (routine calls made here; #3 is
the one Mish may want to flip):
1. *Pixl Grid pixels-down input?* Not determinable from public listings (it has
   an LED Type Editor + import/export and a half-height-tile option). No fourth
   field. The sent reply to FR-002 asks what their list looks like.
2. *Byte-identical hint text for presets 5/6?* **Yes, strict** — the W×H tile
   form is gated on `c.custom`, so preset strings do not change. One token to
   flip (`nonSq`) if the richer hint is wanted for presets later.
3. *Block exports on the residual warning?* **Yes.** "Refuse rather than render
   an unbacked answer" (PROJECT.md). A cabinet whose typed height is not a whole
   number of LEDs is a datasheet inconsistency; the caption would print the typed
   height while the pixels are the quantised one. Same class as the oversized-
   texture refusal. One `if` per export; the caller restores state in `finally`
   so early return is safe. *Flip to warn-only by deleting two lines.*
4. *ny vs cabY·cabPxY() double rounding?* Deferred → **F1**. Fixing it changes
   preset 6's `ny` at cabY ≥ 9 (1169 → 1170), which breaks byte-identity.
5. *Seed Custom from the previous preset?* Out of scope (procSel :1528-1532 is
   the template if ever wanted).
6. *`toFixed(2)` vs `fmtPitch` on the metre readouts (`2.02` vs `2.025`)?* Left
   as shipped; pre-existing for preset 6.
7. *Free-size crossover?* Take the two one-liners that are one click from the
   new feature (rail repopulation, free-height `syncPlan`); the square-500 guide
   fallback in free mode → **F2**.

**Blast radius.** One new `S` key; presets untouched; `selftest` `keep` untouched
(it never wrote cabinet keys). Cross-cutting surfaces touched: `S` literal,
`cab()`, caption, build plan, exports, console handle. Rollback is one revert.

## Implementation Tasks

### Task 1: State — the new key and the parity rule
**Files:** `squint.html` :495, :501
**Type:** Modify
**Description:** Insert `cabHMM:500` after `cabMM:500` in the `S` literal:
```js
wallMode:'cab', cabI:1, cabX:12, cabY:6, cabMM:500, cabHMM:500, cabPX:192,
```
Extend the :495 comment — `// pitchB must match the DOM default` — to
`// pitchB and cabHMM must match their DOM defaults (no S->DOM push exists)`.
**Why in the literal:** see Architecture Notes (pre-boot draws).
**Depends on:** none

### Task 2: Model — `cab()`, `cabMMY()`, two helpers, two comments
**Files:** `squint.html` :520-522, :535, :544, after :544, :545-546
**Type:** Modify
**Description:**
1. :535 custom branch →
```js
if(c.custom){ const h=(S.cabHMM>0)?S.cabHMM:S.cabMM;
  return {mm:S.cabMM, px:S.cabPX, tall:1, ar:h/S.cabMM, mmY:h, custom:true, n:'Custom'}; }
```
   Preset branch :536 untouched.
2. :544 →
```js
function cabMMY(){ const c=cab(); return c.mmY!==undefined ? c.mmY : c.mm*c.ar*c.tall; }
```
3. After :544, two helpers (the tile string is factored so hint and plan cannot drift):
```js
// Rows the typed height implies at the width pitch, vs the rows actually drawn.
// Measured against cabPxY() (what the renderer uses), not round(rows): the two
// roundings can disagree on an exact .5.
function cabRowsRes(){ const p=cabPitch(), rows=cabMMY()/p, want=cabPxY();
  return {rows, want, res:Math.abs(rows-want), mmQ:want*p}; }
// One source for the "(px / mm)" tile clause. Presets keep their exact old
// string; only a non-square CUSTOM tile gets the W × H form.
function cabTileTxt(sep){ const c=cab();
  const nonSq = c.custom && (cabPxY()!==c.px || cabMMY()!==c.mm);
  return nonSq ? `${c.px} × ${cabPxY()} px on ${fmtPitch(c.mm)} × ${fmtPitch(cabMMY())} mm`
               : `${c.px} px${sep}${c.mm} mm`; }
```
4. :520-522 header comment: it says "Every one is a 500 mm tile" — false since
   `da86c4c`. Rewrite: *width in mm and LEDs across; height = width × ar × tall
   (600×337.5 and 500×1000 exist); pixels are square so rows derive; Custom takes
   W and H in mm plus pixels across.*
5. :545-546 comment: the "exact integer by construction" promise holds for
   `wallW`; for `wallH` only when the tile height is a whole number of pixels —
   otherwise `ny` (rounded per wall, :556) and `cabY·cabPxY()` (rounded per tile,
   :543) can differ by 1 (preset 6 at cabY ≥ 9: 1169 vs 1170). Code :547-552
   **unchanged** and must **stay UI-only** (never called from `draw()`):
   `selftest` writes `wallW/wallH/pitchA` directly with `wallMode` still `'cab'`.
**Depends on:** Task 1

### Task 3: Panel — two Custom rows
**Files:** `squint.html` :218-222 (and :214-217 for `autocomplete`)
**Type:** Modify
**Description:** Replace the single `#rowCustom` with:
```html
<div class="row" id="rowCustom" style="display:none">
  <label>Custom</label>
  <input type="number" id="cabMM"  value="500" step="0.5" min="50" autocomplete="off" title="cabinet width, mm (datasheet W)">
  <input type="number" id="cabHMM" value="500" step="0.5" min="50" autocomplete="off" title="cabinet height, mm (datasheet H) — rows derive from the width pitch">
  <span class="val">mm</span>
</div>
<div class="row" id="rowCustomPx" style="display:none">
  <label></label>
  <input type="number" id="cabPX" value="192" step="1" min="8" autocomplete="off" title="LEDs across the cabinet (datasheet resolution W); pixels down derive from the height">
  <span class="val">px across</span>
</div>
```
Add `autocomplete="off"` to `#cabX` and `#cabY` too (Firefox/bfcache restores a
typed value into a number input while `S` still holds the literal, and boot
never reads the inputs — the rail would lie).
Two rows, not three inputs in one: at the 240 px rail minimum (:1608) a
three-input row leaves ~30 px per field. Check the row at 302 px default and
240 px minimum. `cabMM` `step` 1 → 0.5: a 600×337.5 tile used portrait is
337.5 mm *wide*.
**Depends on:** Task 1 (DOM `value=` literals must equal the `S` literals)

### Task 4: Binding — fractional mm, both rows from one boolean, hint, rail repopulation
**Files:** `squint.html` :1473, :1499, :1500-1504, :1507-1514, :1519-1521
**Type:** Modify
**Description:**
1. :1519-1521 binder gains a fractional flag; mm fields keep fractions, px and
   counts stay integer; the `sync → draw → cabRefresh` order is preserved:
```js
const cabNum=(id,key,frac)=>{ $(id).oninput=e=>{ const v=parseFloat(e.target.value);
  if(isFinite(v)&&v>0){ S[key]=Math.max(1, frac ? v : Math.round(v)); syncFromCabinets(); draw(); cabRefresh(); } }; };
cabNum('cabX','cabX'); cabNum('cabY','cabY');
cabNum('cabMM','cabMM',true); cabNum('cabHMM','cabHMM',true); cabNum('cabPX','cabPX');
```
   **Behaviour change to name in the commit body:** `cabMM` no longer rounds a
   typed fraction (`337.5` stays `337.5`; it became `338` → wallH 2.028 / ny 781).
   Integer input is byte-identical.
2. :1499 toggle BOTH rows from one clamped boolean (also closes the pre-existing
   TypeError on an out-of-range `cabI` vs `cab()`'s clamp at :534):
```js
const cu=CABS[clamp(S.cabI,0,CABS.length-1)].custom;
$('rowCustom').style.display=$('rowCustomPx').style.display=cu?'flex':'none';
```
3. :1500-1504 hint: replace `(${c.px} px across ${c.mm} mm)` with
   `(${cabTileTxt(' across ')})`; then, **custom only**:
```js
const rr=cabRowsRes();
if(c.custom && rr.res>0.1)
  html += `<br><span class="no">⚠ ${fmtPitch(cabMMY())} mm tall is ${rr.rows.toFixed(2)} pixels at ${fmtPitch(p)} mm — not a whole number. LED pixels are square, so one of width / pixels across / height is a datasheet round-off or a typo. Simulating ${rr.want} rows = ${fmtPitch(rr.mmQ)} mm.</span>`;
else if(c.custom && rr.res>0.005)
  html += `<span class="mid"> (rows quantised: ${rr.want} × ${fmtPitch(p)} = ${fmtPitch(rr.mmQ)} mm)</span>`;
```
   Preset 1 and untouched-Custom output must be **character-for-character**
   unchanged. Threshold rationale: datasheets quote heights to 0.5 mm; at pitch
   ≥ 2.5 mm that is ≤ 0.1 px, so honest round-offs stay quiet.
4. :1507-1514 `setCabMode(false)` repopulates the free rail from `S` — today
   `grep "\$('wallH').value="` returns nothing, so after a custom 500×1000 build
   one click on *Free size* shows `Height 3` / `Pitch 2.9` while every export
   says `6 m` / `2.604`:
```js
if(!cabMode){ $('wallW').value=S.wallW; $('wallH').value=S.wallH; $('pitchA').value=fmtPitch(S.pitchA); }
```
5. :1473 free-mode inputs call `draw()` only, never `syncPlan()`, so `#planOut`
   goes stale while typing a free height:
```js
const rePlan=()=>{ draw(); syncPlan(); };
num('wallW','wallW',rePlan); num('wallH','wallH',rePlan); num('pitchA','pitchA',rePlan); num('pitchB','pitchB');
```
**Depends on:** Tasks 2, 3

### Task 5: Outputs — build plan, caption, export refusal, guide stamp
**Files:** `squint.html` :1911, :1840-1841, `composeExport` (~:1801) and
`exportTemplate` (~:1931) entry, :1955
**Type:** Modify
**Description:**
1. :1911 → `` L.push(`true pitch     ${cabPitch().toFixed(3)} mm  (${cabTileTxt(' / ')})`); ``
   then inside the same `wallMode==='cab'` block:
```js
const rr=cabRowsRes();
if(c.custom && rr.res>0.1) L.push(`height check   <span class="no">${rr.rows.toFixed(2)} rows at ${fmtPitch(cabPitch())} mm — check datasheet; simulating ${rr.want} rows (${fmtPitch(rr.mmQ)} mm)</span>`);
```
2. :1840-1841 wrap `${S.wallW}` and `${S.wallH}` in `fmtPitch()` in both template
   strings — byte-identical for every value the tool prints today (`6`, `3`,
   `7.2`, `2.025`), immune to a long float from a typed height.
3. Export refusal (decision #3): at the top of `composeExport` and `exportTemplate`,
   after their existing early returns:
```js
if(S.wallMode==='cab' && cab().custom && cabRowsRes().res>0.1)
  return toast('Custom cabinet height is not a whole number of LEDs — fix the datasheet numbers before exporting');
```
   `exportPng` (~:1789-1799) restores `absBlur` and the button in `finally`, so
   the early return is safe. Verify that `exportTemplate`'s existing
   `if(nx*ny>80e6) return toast(...)` (:1931) is the pattern being matched.
4. :1955 `const fs=Math.max(14,Math.round(ny*0.035));` →
   `Math.round(Math.min(nx,ny)*0.035)`. Byte-identical for every landscape wall
   (all presets at 12×6); on a portrait custom wall (2×10 of 500×1000 → 384×3840)
   the stamp no longer clips off the right edge.
5. **Not changed, recorded:** the three identical `cpx/cpy` blocks (:1162-1164,
   :1222-1223, :1935-1936) follow `cabPxY()` and need no edit. They also run for
   view B with A's cabinet px counts on B's pitch (`renderView(cvB,S.pitchB)`
   :1314) and the B canvas is copied into the export (:1809) — pre-existing → F3.
**Depends on:** Task 2

### Task 6: Console handle
**Files:** `squint.html` :1888-1893
**Type:** Modify
**Description:** Add `cabMMY, cabRowsRes, cabTileTxt, cabRefresh` after `cabPxY`
so the gate recipe can assert and refresh without dispatching DOM events.
**Depends on:** Task 2

### Task 7: Mirror
**Files:** `index.html`
**Type:** Modify
**Description:** `cp squint.html index.html` in the SAME commit. Verify
`cmp squint.html index.html` (silent) and, after commit,
`git rev-parse HEAD:squint.html HEAD:index.html` → one blob id.
**Depends on:** Tasks 1-6

### Task 8: Docs
**Files:** `README.txt` :97-105, :243-244, :302-306; `README.md` :39; vault
`SQUINT — Documentation.md` controls table (row *Build from cabinets*); vault
`SQUINT — field reports.md` FR-002 #1
**Type:** Modify
**Description:**
- `README.txt` :97-105 add one clause after the BUILD FROM CABINETS paragraph:
  *Custom takes cabinet width and height in mm plus pixels across; pixels down
  derive from the height (LED pixels are square) and the hint shows the derived
  rows and flags a height that is not a whole number of LEDs.*
- `README.txt` :243-244 drop *"or seam/tile variation"* — false since `da86c4c`
  (tile variance IS simulated).
- `README.txt` :302-306 refresh the scripting-handle list — it is stale (omits
  `CABS, cab, cabPitch, cabPxY, cabMMY, cabRowsRes, cabTileTxt, cabRefresh,
  syncFromCabinets, screenRes, effectiveRes, gapPx, syncPlan, exportTemplate,
  effectiveNits, blackFraction, spanW, offAxisGain`).
- `README.md` :39 Cabinets row: append *"— custom tiles take width × height"*.
- Vault Documentation controls row *Build from cabinets*: mention W×H custom.
- Vault field reports FR-002 #1: `SHIPPED <hash>` once live.
**Depends on:** Task 7 (same commit as the code, per PROJECT.md — the limits
list is part of the tool)

## Validation

Every probe below is a number only the correct code can produce. **Do not write
"selftest passes" as the result** — see PROJECT.md on why it is blind to this.

1. **Targeted (browser console on the built file — `SQUINT.` prefix throughout).**
   Select *Custom…* in the cabinet dropdown, set inputs via the DOM or `S` + `syncFromCabinets(); draw(); cabRefresh()`:

   | # | Set (W / H / px, cabinets) | Assert |
   |---|---|---|
   | (a) | 500 / **1000** / 192 @ 12×6 | `cabPxY()===384`, `S.wallH===6`, `nativeRes(S.pitchA).ny===2304` (and `.nx===2304`), caption `6 × 6 m wall`, guide PNG 2304×2304, hint tile `192 × 384 px on 500 × 1000 mm`, **no** red line, **no** quantised clause |
   | (b) | 600 / **337.5** / 231 @ 12×6 | `cabPxY()===130`, `S.wallW===7.2`, `S.wallH===2.025`, `ny===780`, hint shows quantised clause `(rows quantised: 130 × 2.597 = 337.662 mm)` (res 0.0625) and **no** red line; then sweep `cabY` 1…12 and assert `ny` equals preset 6 at every value — `130,260,…,1040` then **1169, 1299, 1429, 1559** (preset 6's own values; `cabY*cabPxY()` gives 1170… — the F1 residue, expected, identical to today) |
   | (c) | fresh reload → Custom, touch nothing | `$('cabHint').innerHTML` identical to preset 1's; `$('cabHMM').value==='500'`; `S.cabHMM===500`; pixels identical to preset 1 (compare `cvA` `toDataURL()` hashes) |
   | (d) | 500 / **750.9** / 192 | hint has the red `⚠ … 288.35 pixels …` line; `cabPxY()===288`; `cabRowsRes().mmQ` prints `750`; build plan has the `height check` line; **Export PNG and Layout guide both toast and produce nothing** |
   | (e) | 500 / **760.2** / 192 | quantised clause `(rows quantised: 292 × 2.604 = 760.417 mm)`, **no** red line, exports work. *(The sweep's recipe said `760` — that is res 0.16, a warning; `760.2` is res 0.083.)* |
   | (f) | 500 / 1000 / 192, `S.tileVar=0.12`, cabGrid on | tile-variance plateaus change every 384 rows (probe `cvA` pixels at rows k·384·cell ± 1); the cabinet-grid overlay draws `cabY+1` horizontal lines at `oy + k·384·cell`; the layout guide's horizontal grid lines are at multiples of 384 |
   | (g) | 2×10 of 500 / 1000 / 192 | guide PNG 384×3840 and the orange `384 × 3840` stamp is fully inside the canvas (font from `min(nx,ny)`) |
   | (h) | any preset 1–6 | every readout string, caption, filename and `toDataURL()` hash identical to a `4320719` build opened side-by-side |
   | (i) | Custom 500/1000/192 then click *Free size* | rail shows `Width 6`, `Height 6`, `Pitch A 2.604`; typing a free height updates `#planOut` immediately |
   | (j) | `selftest(true)` before and after all of the above | 188 ± 6 / ≈0.1 %, no banner; `S.cabI, S.cabMM, S.cabHMM, S.cabPX` unchanged by it |

2. **Full gate:** `context/PROJECT.md` fast checks (mirror parity + selftest +
   7/7 shader programs in the console with no compile/link errors).
3. **Drift/build guards:** `git rev-parse HEAD:squint.html HEAD:index.html` → same
   blob. After push, poll `curl -sL https://mish6l.github.io/squint/ | sha256sum`
   until it equals `sha256sum squint.html`, then run `SQUINT.selftest()` **on the
   hosted page** and repeat (a) and (d) there.
4. **Manual:** open at rail width 240 px (drag the rail edge to minimum) and
   confirm both Custom rows are legible and the `mm` / `px across` unit spans
   do not wrap.

## Downstream impact
- `S` gains `cabHMM` — the future v2.0 config schema (share link / `.squint`
  file) inherits the pair `cabMM/cabHMM`; name chosen for that.
- `README.txt` known-simplifications list shrinks by one false claim (tile
  variation) and the cabinet paragraph grows one clause — the honesty contract
  is updated in the same commit.
- **Cut v1.2 after live verification** (release notes: "Custom cabinets take
  width × height; a height that is not a whole number of LEDs is flagged and
  refused at export"). Reply to FR-002 on the Reddit thread once live — the
  reply draft (`~/.claude/jobs/da6cb5ae/tmp/reply-jono301.md`) promises #1.

## Follow-ups (declared, not in this change)
- **F1 — double rounding, PRESETS ONLY after round 4.** `ny` (per wall) vs
  `cabY·cabPxY()` (per tile) differ by `cabY × residual` rows when the tile
  height is not a whole number of pixels — preset 6 at cabY ≥ 9 (1169 vs 1170;
  two rows by cabY 16). The custom path is now built from the tiled height
  (`tileMMY()`) and no longer carries this. Fixing the presets = route them
  through `tileMMY()` too — changes preset 6's `ny` and printed height, so it
  needs its own commit, its own gate row, and a release-note line.
- **F2 — free-mode guide grid.** After a custom build, *Free size* keeps
  `S.pitchA`/`wallH` but the guide and overlay revert to a square 500 mm tile
  (:1935 fallback). Honest fix is to draw no cabinet grid in free mode or label
  it "assumed 500 mm square".
- **F3 — view B cabinet grid.** The three `cpx/cpy` blocks run for view B with
  A's px counts on B's pitch; collapse into one helper taking the view's pitch
  (`round(cab().mm/pitch) × round(cabMMY()/pitch)`).
- Hint/plan `toFixed(2)` vs caption `fmtPitch` on metres (`2.02` vs `2.025`).

## Rollback
Single revert of the one commit. No persisted state (`localStorage` carries only
`squint.cal` / `squint.railw`), no schema, no migration. If the export refusal
proves too strict in use, delete the two `if` lines in Task 5.3 — the warning in
the hint and plan stays.

## Open questions before `/execute`
None blocking. Decision #3 (export refusal) is the only product call made here
that Mish might reverse; it is two lines either way.

## Execution findings (2026-09-05)

**Deviation from Task 3 — three rows, not two.** As written (W and H inputs
sharing one row + a `px across` row) the panel FAILED the manual check at the
*default* 302 px rail, not just the 240 px minimum: the two mm inputs starved
each other and clipped to `50€` / `10€`, and `px across` (9 chars) wrapped
because `.val` is a fixed `62px` span (`squint.html:98`). Built instead as one
input per row — the exact idiom of the *Cabinets across / down* pair above it —
with 7-character units `mm wide` / `mm tall` / `px wide`, and a third row id
`rowCustomH` in the `cabRefresh` toggle. Measured after the fix: all three
inputs 105 px, `scrollWidth ≤ clientWidth`, unit spans one line.

**The 240 px minimum clips — and that is the rail's, not this change's.** At
240 px every number input is 43 px wide and every value of ≥3 characters clips:
`cabMM` 500 does, and so do the pre-existing `pitchA` (2.604) and `pitchB` (3.9),
while `12` / `6` do not. Units still do not wrap. Recorded as follow-up **F4**
(raise the rail minimum or shrink `.val`), not fixed here.

**Gate, as run — not "should pass":**
- Node harness over the *extracted shipped source* (`cab`, `cabPxY`, `cabMMY`,
  `cabRowsRes`, `cabTileTxt`, `syncFromCabinets`, `screenRes`, `nativeRes`,
  `CABS`, the `S` literal): **67 passed, 0 failed** — rows (a)–(e), (g), the NaN
  guard (`undefined` and `0` → square), the float-noise route (`51/250` → exact
  250), and every preset's `mmY`/`pxY` against the table maths.
- Real Chrome via Playwright, driving the actual inputs with `input`/`change`
  events: (a) `384 / 6 / 2304×2304`, guide PNG **2304×2304**; (b) custom
  `600/337.5/231` equals preset 6 on every number (780, 7.2, 2.025, 130) and
  preset 6's hint string is unchanged (`231 px across 600 mm`); (c) reload →
  Custom untouched → hint **identical** to preset 1, DOM `500` == `S.cabHMM`;
  (d) `750.9` → red ⚠ line, `height check` in the plan, `exportTemplate` toasts
  and downloads nothing, `pngBtn` restored (`Save comparison PNG`, enabled,
  `absBlur` false); (e) `760.2` → quantised clause `292 × 2.604 = 760.417 mm`,
  no ⚠; (g) guide PNG **384×3840** with the stamp inside the canvas; (i) *Free
  size* rail shows `6 / 6 / 2.604`, a free height edit updates `#planOut`;
  (j) `selftest(true)` **188 exact / 0.01 %** before and after, cabinet keys
  untouched.
- **The `composeExport` refusal needed content loaded to be reached** — the
  first pass hit the pre-existing `Load some content first` guard (:1835)
  instead. Re-run with `testcard.png` loaded through the real `#file` input:
  toast is the refusal message, no download, button restored; then at 1000 mm
  the same click exported `SQUINT_2.604mm_5m.png` with caption
  `6 × 6 m wall · 2.604 mm pitch → 2304 × 2304 native`.
- Mirror: `cmp squint.html index.html` silent; line endings unchanged (0 CR
  bytes in both worktree and HEAD blobs — the `autocrlf` warning is noise).
- Console: only the pre-existing favicon 404 and a Canvas2D `willReadFrequently`
  hint.

**Not machine-verified:** the tile-variance plateau pixel probe (row f). The
render path it exercises (`cabPxY()` → `uCabPx`) is unchanged code, and the
guide PNG's horizontal grid (which uses the same `cpy`) landed at 384-row
spacing in (g), so it is covered indirectly.

**Follow-up F4 (new):** rail minimum 240 px clips every ≥3-char number input;
pre-existing for `pitchA`/`pitchB`; either raise the minimum (~270) or shrink
`.val` from 62 px.

### Codex round 4 (2026-09-05, `gpt-5.6-sol`, 143k tokens, brief + diff + plan)

Verdict as submitted: *not ready*. Three findings; two were real defects in
the build above and are fixed in the working tree; the third was already done.

1. **High — the per-tile residual gate lets a wall-level mismatch accumulate.**
   `ny` rounds per wall, `cabY·cabPxY()` per tile; the refusal only checks
   `res > 0.1` on ONE tile. `500/760.2/192` (res 0.083, passes) at 20 cabinets
   gives `ny = 5838` against a `20×292 = 5840` tile grid — two rows short while
   the plan claims 20 whole cabinets. My F1 note said "differ by 1"; it is
   `cabY × residual`, unbounded, and this change made arbitrary residuals
   reachable. **Fix: a custom tile is simulated at its whole-LED height.** New
   `tileMMY()` returns `cabRowsRes().mmQ` for custom (the typed height when the
   residual is zero), and `syncFromCabinets()` builds `wallH` from it — so
   `ny == cabY·cabPxY()` at every count and every consumer (uniform, overlay,
   guide, plan, caption) agrees by construction. Presets go through the old
   expression and are byte-identical; preset 6 keeps 1169. Consequences,
   all honest: `500/750.9/192` @ 6 now reports `6.00 × 4.50 m = 2304 × 1728`
   (the 288-row tile it says it simulates), not `4.51 m / 1730`; custom
   `600/337.5/231` prints `2.026 m` (6 × 337.662) where the preset prints the
   datasheet `2.025`, and diverges from the preset's `ny` from cabY 9 —
   **the custom path no longer carries F1; only the presets do.**
2. **Med —`fmtPitch` on the caption broke preset byte-identity at odd cabY.**
   3 dp prints preset 6's `0.3375 m` as `0.338`; six of the 168 preset metre
   values change. I had checked only the 12×6 defaults. **Fix: `fmtM()`, 4 dp**
   — proven byte-identical over all 168 preset values (every preset height is
   `k×0.5`, `k×1.0` or `k×0.3375`) and it still strips tiled-height noise
   (`3.802083333 → 3.8021`).
3. **Low — vault Documentation row not evidenced.** Patched during the review;
   the field-report status line correctly waits for the shipped hash.

Codex independently recomputed every Validation number in rows (a)–(e), (g)
and the cabY 1…12 sweep and confirmed them — its only correction was to the
F1 *prose*, which is what finding 1 is. Review text kept verbatim at
`reviews/2026-09-05 codex round 4 - custom cabinet height.md`.

### Codex round 4b — delta on the fixes (same day)

Verdict: **#2 closed; #1 closed for every practical wall** — Codex's own
deterministic million-case sweep (half-mm W/H, 8–2048 px, cabY 1…10 000)
found no `ny ≠ cabY·cabPxY()` — with one **Low**: my `tileMMY()` kept a
`res < 1e-9` shortcut to preserve the typed height when it *is* a whole number
of rows, and a per-tile epsilon cannot prove an all-count invariant (its
counterexample needs 1.5 × 10⁹ cabinet rows). **Fixed as it suggested: no
tolerance branch — a custom tile is always built from `mmQ`.** Exactness in
the whole-row case is kept a better way: `mmQ = want·mm/px` (multiply before
divide — `384·500/192 = 1000` exactly) instead of `want·pitch`. Harness rows
added for the pathological case (`ny == 1.5e9 × 192`) and for exactness
(`500/1000/192 → wallH === 6`, `500/500/192 → wallH === 3`). This last fix was
verified by harness + browser, **not re-reviewed by Codex**. Delta review kept
verbatim at `reviews/2026-09-05 codex round 4b - delta on the fixes.md`.

**Final gate (2026-09-05):** harness **91/91**; real-Chrome rows (a)–(j) all
correct on the final build; `selftest` 188 exact / 0.01 % before and after;
`index.html` byte-identical to `squint.html`.
