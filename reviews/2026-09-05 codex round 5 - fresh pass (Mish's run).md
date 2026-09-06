# SQUINT — round 5 code review and recommended fixes

Reviewed: 6 September 2026. Baseline: `43207193a16621debf5149947d56f282574db320`.

**Verdict: not ready under the brief's compatibility requirements.** The revised custom-height geometry works in the tested domain, including the previously problematic accumulating residuals. I found two Medium regressions: the layout-guide font change alters existing preset output, and the cabinet-to-free transition puts a rounded pitch into an editable input while retaining a different value in state. There is also a Low documentation mismatch about which heights block export. Two additional Medium seam issues already exist in the baseline; they are reported separately rather than attributed to this change. No High-severity defect was established. The fixes below are recommendations; I did not edit the application.

## Scope and evidence

- Read the supplied brief, the application source, the changed documentation, and the previous delta review. Compared the shipped JavaScript against the actual baseline from Git.
- The repository was initially uncommitted on `4320719`. During review, an external change advanced HEAD to `6c6f0cdb088d50d5e9bc9af448f2cb04c8b38482` (`Let Custom cabinets take a height, and build the wall from whole LEDs`). The reviewed HTML bytes did not change, so the findings and line numbers remain applicable.
- `squint.html` and `index.html` are byte-identical: SHA-256 `1525CCD622561D2492C671189D39795F1C0E51CECAF5700124FF67433A14E9C2`.
- Executed the actual script in Node VM contexts with a stub DOM and recording canvas contexts. This tests source arithmetic, event handlers, generated text, export drawing commands, and refusal cleanup. GPU rendering, browser input-spinner behavior, font rasterization, and PNG encoding were **not** exercised. Pixel equivalence is therefore not claimed.
- Line references below refer to `D:/Mishal/Claude Code/SQUINT/squint.html`, unless another filename is named.

## Findings introduced by this change

### 1. Preserve the exact pitch in the editable free-size field

**Severity: Med**  
**Evidence:** `squint.html:1579`; downstream input handler at `squint.html:1523` and native rounding at `squint.html:605`.

**Expression:**

```js
$('pitchA').value = fmtPitch(S.pitchA);
```

`fmtPitch()` is a three-decimal presentation formatter. Assigning its output to the input does not update `S.pitchA`, so the displayed editable value and the active simulation immediately disagree. Re-entering the displayed value then changes the geometry even though the user sees the same number.

**Reproduction:** select the `600 × 337.5` preset (`cabI = 6`), with 24 cabinets across and down, and switch to Free size.

| Point in the interaction | Stored pitch | Input text | Native resolution |
|---|---:|---:|---:|
| Immediately after switching | 2.5974025974025974 | 2.597 | 5544 × 3119 |
| Re-enter `2.597` in Pitch A | 2.597 | 2.597 | 5545 × 3119 |

The one-column change follows directly from `Math.round(14400 / pitch)`. This is separate from the acknowledged preset-6 vertical rounding issue.

**Correct behavior:** entering Free size should show the pitch actually in use, and re-entering that value should preserve the native dimensions.

**Recommended fix:** retain full precision in the editable control; continue using `fmtPitch()` for captions and labels.

```js
else {
  $('wallW').value = String(S.wallW);
  $('wallH').value = String(S.wallH);
  $('pitchA').value = String(S.pitchA);
}
```

Do not round `S.pitchA` to match the field: that would move the resolution change to the mode switch itself. Regression-check cabinet → free → cabinet, and re-entering the populated pitch, with preset 6 at 24 columns. Verify that `pitchB` stays unchanged.

### 2. The portrait-stamp fix changes existing preset guide output

**Severity: Med — compatibility requirement**  
**Evidence:** `squint.html:2038`, affecting the drawing commands at `squint.html:2039` through `squint.html:2046`.

**Expression:**

```js
const fs = Math.max(14, Math.round(Math.min(nx, ny) * 0.035));
```

This runs for every wall, including existing presets and the unchanged default Custom. Existing square cabinets can form a portrait wall; being a preset does not imply `nx >= ny`.

**Reproduction:** preset `cabI = 0` (`500 × 500`, 256 px), one cabinet across and two down, array off. Both versions produce a 256 × 512 guide, but:

| Guide element | Baseline | Reviewed version |
|---|---:|---:|
| Main font | 18 px | 14 px |
| Secondary font | 10 px | 8 px |
| Main text origin | (10.8, 27) | (8.4, 21) |

The changed font sizes and coordinates establish an output change without needing a PNG byte comparison. The matrix found different guide drawing commands in **5,512 of 18,432 configurations** covering seven presets plus default Custom, cabinet counts 1–24, and array/processor toggles. This is a compatibility regression under the brief, not a claim that the smaller font is aesthetically worse.

**Correct behavior:** preserve the original guide expression for existing presets and unchanged square Custom. Scope this change to the new non-square Custom case, or ship the general guide redesign separately with an explicit compatibility change.

**Recommended minimal fix:**

```js
const tile = cab();
const nonSquareCustom = S.wallMode === 'cab' && tile.custom &&
  (cabPxY() !== tile.px || cabMMY() !== tile.mm);
const stampBasis = nonSquareCustom ? Math.min(nx, ny) : ny;
const fs = Math.max(14, Math.round(stampBasis * 0.035));
```

This restores the baseline formula outside the new feature. It does not prove all text fits on extremely narrow guides; text-fit behavior still needs browser verification. Regression-check the concrete 1 × 2 preset, portrait default Custom, and a portrait non-square Custom.

### 3. The README overstates the height warning and refusal policy

**Severity: Low**  
**Evidence:** `README.txt:105`–`109`, `README.md:39`; actual branches at `squint.html:1562`, `squint.html:1564`, `squint.html:1875`, and `squint.html:2010`.

**Expressions:** warning/refusal uses `rr.res > 0.1`; the softer notice uses `rr.res > 0.005`.

The new documentation says a height that is not a whole number of LEDs is flagged and refused at export. That is not the implemented policy. All Custom walls use the quantised height, but only discrepancies above 0.1 rows refuse export.

With width 500 mm, 192 pixels across, and six cabinets down:

| Typed height | Residual in rows | Hint behavior | Export behavior | Built height |
|---|---:|---|---|---:|
| 750 mm | 0 | No notice | Allowed | 4.5 m |
| 750.01 mm | ~0.00384 | No notice | Allowed | 4.5 m |
| 750.1 mm | ~0.0384 | Quantisation notice | Allowed | 4.5 m |
| 750.9 mm | ~0.3456 | Warning | Refused | 4.5 m |

**Correct behavior:** documentation should describe the implemented tolerances and the fact that the simulation always uses whole rows. The export gate itself follows the brief's stated product decision.

**Recommended replacement wording:**

> Custom takes cabinet width and height in mm plus pixels across. Square LED pixels determine the row count, and the simulated wall uses the resulting whole-row height. A discrepancy above 0.005 rows is shown in the hint; a discrepancy above 0.1 rows also produces a warning and blocks PNG exports until the cabinet numbers are corrected.

Use a shorter equivalent in `README.md`, such as “Custom tiles take width × height; heights are quantised to whole LED rows, and discrepancies above 0.1 rows block export.”

## Additional existing seam issues

These are reproducible in baseline code paths. They should not be represented as regressions caused by `cabHMM`, nor folded into a strict preset-identity patch without acknowledging their behavior changes.

### 4. The build-plan refresh fix omits other geometry and mapping controls

**Severity: Med — pre-existing, partially addressed by this patch**  
**Evidence:** `squint.html:1519`, `squint.html:1619`, and the plan's source-scale consumer at `squint.html:2001`.

**Expressions:**

```js
c.onclick = () => { S.pitchA=p; $('pitchA').value=p; draw(); };
$('fitMode').onchange = e => { S.fitMode=e.target.value; draw(); };
```

The newly added `rePlan()` handles typed free-size values, but the pitch chips still only redraw. Switching mapping mode also redraws without refreshing the plan.

**Reproductions:**

- In Free size, a 14.4 × 8.1 m wall at 2.597 mm shows 5545 × 3119. Click the 3.9 pitch chip: `nativeRes()` changes to 3692 × 2077, while `planOut` remains unchanged.
- On a 6 × 6 m Custom wall at 192 px per 500 mm, set a 1920 × 1080 source and Fit mapping. The plan reports 120% source scale. Select 1:1 mapping: `contentRect()` correctly changes to 100%, but the plan still reports 120%.

**Correct behavior:** the build plan must update whenever an interaction changes the dimensions or mapping it reports.

**Recommended fix:** call `rePlan()` from both handlers. Also route successful image/video load completion through a plan refresh, since those handlers at `squint.html:1736` and `squint.html:1746` change source dimensions consumed by the plan. Keep the refresh at state-changing handlers rather than adding cabinet synchronization inside `draw()`.

```js
c.onclick = () => { S.pitchA=p; $('pitchA').value=p; rePlan(); };
$('fitMode').onchange = e => { S.fitMode=e.target.value; rePlan(); };
```

Regression-check pitch chips, mapping changes, and replacing the source after the plan is visible.

### 5. View B uses A's cabinet pixel dimensions at B's different pitch

**Severity: Med — pre-existing**  
**Evidence:** `squint.html:1213`–`1215` (`uCabPx`), `squint.html:1273`–`1276` (`drawCabGrid`), and the B render call at `squint.html:1365`.

**Expression:** both consumers choose `cab().px` and `cabPxY()` whenever `wallMode === 'cab'`, regardless of the `pitch` passed to the view.

Those pixel counts belong to pitch A. View B computes its own native dimensions and cell size from `S.pitchB`, so reusing A's tile pixel dimensions changes the cabinet's represented physical size in B.

**Reproduction:** Custom 500 × 1000 mm, 192 px across, 12 × 6 cabinets, pitch B = 3.9 mm. The physical wall is 6 × 6 m. B's native grid is 1538 × 1538, but its diagnostic lines repeat every 192 × 384 B pixels. They therefore represent **748.8 × 1497.6 mm** tiles rather than 500 × 1000 mm. The recording context confirms 192-pixel horizontal spacing and 384-pixel vertical spacing. The shader uses the same dimensions for tile-brightness variation.

**Correct behavior:** a comparison of LED pitch on the same cabinet installation should retain the physical cabinet boundaries in both views. If the intention is instead to change cabinet sizes with pitch, the UI must explicitly describe that different installation; the present labels do not.

**Recommended fix:** in a separately scoped correction, derive both the grid and shader tile extents from physical cabinet dimensions divided by the view's pitch. Use the tiled Custom height, not its rejected typed height. Keep the exact existing integer tile counts for A; for B, use a shared helper along these lines:

```js
// Inside a cabinet-mode branch; A retains its exact tile counts.
const tilePixels = pitch === S.pitchA
  ? { x: cab().px, y: cabPxY() }
  : { x: cab().mm / pitch, y: tileMMY() / pitch };
```

Use it for both `uCabPx` and `drawCabGrid`. B's fractional boundaries represent physical cabinet placement on a hypothetical pitch grid. Verify that interpretation visually, including arrays and nonzero tile variance, before changing baseline B rendering.

## Confirmed correct

- **The final Custom construction removes the accumulation defect.** `tileMMY()` always returns `mmQ`, and `mmQ` is `want * mm / Math.max(1, px)`. Custom `500/760.2/192` at 20 rows gives 5840 native rows, exactly `20 × 292`. `500/750.9/192` at six gives 1728 rows and 4.5 m. Custom `600/337.5/231` at nine gives 1170 rows; the preset remains on its old branch.
- **Broad numerical test:** one million deterministic candidates used half-mm dimensions from 1–2000 mm, pixel widths 1–2048, and cabinet counts down 1–24. Of these, 805,781 satisfied the harness's 32,768-pixel dimension ceiling. None violated `screenRes(S.pitchA).ny === S.cabY * cabPxY()`. Maximum pre-rounding discrepancy was approximately `1.09e-11` rows. This is practical numerical evidence, not a proof for all positive finite numbers or a measurement of the machine's GPU limits.
- **Whole-row examples and low pixel counts:** 500 × 1000 mm at 192 px returns `mmQ = 1000`; 337.5 × 675 mm at 135 px returns 675; 600 × 337.5 mm at 240 px returns 337.5. The tested `cabPX = 1` cases stay finite. A tile whose typed height implies less than one row is clamped to one row, with the residual checked against that actual count. Multiply-before-divide reduces float noise; it does not make arbitrary decimal arithmetic universally exact.
- **Preset/default compatibility outside the stamp:** across 18,432 states, geometry, A/B native sizes, effective resolution, cabinet hints, build-plan HTML, and formatted width/height caption values matched baseline. The guide-stamp differences are finding 2. Another 96 combinations of preset/default Custom, sim/A-B/wipe, array on/off, and processor on/off produced matching comparison-export drawing commands at the default 12 × 6 counts.
- **A-side consumers use the tiled geometry:** `screenRes()` drives `nativeRes()`, content placement, view scale, readouts, and guide dimensions; `cabPxY()` drives the A cabinet grid and tile-variance uniform. The tiled wall height reaches the physical plan and caption. `cabMMY()` intentionally remains the typed height for datasheet diagnostics. The B exception is finding 5.
- **Refusal branches agree:** hint warning, plan warning, comparison PNG refusal, and guide refusal all use `res > 0.1` for Custom. The softer hint applies only when `0.005 < res <= 0.1`; smaller residuals have no notice. Floating-point comparisons apply to the computed residual, not an independently exact decimal threshold.
- **Refusal cleanup:** the comparison-export test restored `absBlur = false`, enabled the button, restored its label, and displayed the refusal toast. The guide returns before creating its canvas. Presets and Free size are excluded by the explicit gate. The verification used a no-op draw and therefore does not claim recovery from an unrelated GPU draw exception.
- **State and boot:** `S.cabHMM` and its DOM default are both 500. The new rows share the same Custom visibility condition. `cabHMM` uses the fractional binder; counts/pixel width retain integer binding. `selftest()` does not change cabinet keys, and `draw()` does not call `syncFromCabinets()`. The initial pre-sync draw does not read an uninitialized `cabHMM`. Local storage persists calibration/rail width, not cabinet state.
- **Documentation's tile-variance correction is accurate:** the shader applies tile-dependent brightness variation, while physical seams remain diagnostic grid overlays rather than a photometric seam simulation.

## Fix order and verification

1. Fix the editable pitch precision and scope the guide stamp. Update both mirrored HTML files together.
2. Correct the documentation's tolerance wording.
3. Track the existing refresh omissions and B cabinet geometry separately; their fixes can change baseline behavior.
4. Repeat the concrete reproductions and comparison matrix, then verify representative landscape/portrait guides and A/B tile variance in a real WebGL2 browser. Confirm the two HTML files still have the same hash.

The previously accepted preset-6 vertical double rounding and the earlier, now-removed per-tile epsilon shortcut are not re-reported as new findings.
