# Review: non-square Custom cabinets, round 4

The one-height-input design is wired consistently through the intended cabinet helpers and the shipped 12×6 validation cases recompute correctly, but the change is not ready as submitted. One newly broadened seam can pass the per-cabinet residual gate while producing a native wall and exported guide that are several rows short of the stated cabinet grid, and the global caption formatting change breaks the required byte-identity for preset 6 at odd cabinet counts. Tasks 1–7 are otherwise implemented as written and the repository documentation portions of Task 8 are present; the external vault Documentation update is not represented in the supplied change and therefore cannot be confirmed.

## Findings

1. **Severity: High** — `squint.html:558`, `squint.html:583`, `squint.html:587`, `squint.html:1195`, `squint.html:1255`, `squint.html:1991`, `squint.html:1998`

   **Expression:** `screenRes().ny = round(cabY × H/(W/px))`, while the shader uniform, overlay and guide use `cabY × cabPxY() = cabY × round(px×H/W)`. The refusal tests only the single-tile residual `abs(H/(W/px) - cabPxY()) > 0.1`.

   A residual below the refusal threshold accumulates over an unbounded `cabY`. Using validation case (e), `W=500`, `H=760.2`, `px=192`, and `cabY=20` gives `rows=291.9168`, `cabPxY()=292`, and `res=0.0832`, so both exports are allowed. Nevertheless, `screenRes().ny=round(20×291.9168)=5838`, whereas twenty cabinet rows require `20×292=5840`. The renderer's `uCabPx`, `drawCabGrid`, and the guide all divide a 5838-row wall into 292-row tiles, leaving the last requested cabinet row two pixels short while the build plan still claims 20 complete cabinets. Warning case (d) already differs by two rows at the planned six cabinets (`1730` native versus `1728` tile rows), so the hint's claim that it is “Simulating 288 rows” is not what the whole-wall native grid actually does.

   The plan records only a one-pixel F1 residue and does not account for accumulation; the new arbitrary Custom aspect makes larger discrepancies newly reachable. Correct behavior is for the native height and all tile consumers to agree for an accepted Custom configuration, or for the UI and exports to refuse/explicitly flag the accumulated wall-level discrepancy. The deliberately preserved preset-6 result must remain unchanged.

2. **Severity: Med** — `squint.html:1895`

   **Expression:** `fmtPitch(S.wallH)` replaces JavaScript's prior `String(S.wallH)` for every preset caption.

   This is byte-identical only for the default values listed in the plan, not for every value a preset can produce. Preset 6 has `S.wallH=cabY×337.5/1000`; at `cabY=1` the base caption contains `0.3375 m`, while the changed caption contains `0.338 m`. Odd counts 3, 5, 7, 9 and 11 likewise change (`1.0125→1.012`, `1.6875→1.688`, `2.3625→2.362`, `3.0375→3.038`, `3.7125→3.712`). This both rounds a client-facing physical dimension and violates the explicit preset byte-identity requirement.

   Correct behavior is to preserve the prior preset string while applying bounded formatting only where the new Custom-height calculation can introduce floating-point noise, or to use a metre formatter that preserves these exact preset values.

3. **Severity: Low** — `squint.html:218`, `squint.html:1532`

   **Expression:** `Task 8 required artifacts = README.md + README.txt + vault Documentation + vault field-report status`; the supplied diff contains only the two repository README artifacts.

   The code exposes and explains the new W×H controls, but the required vault Documentation controls-row update is not present in any supplied review input, so Task 8 cannot be considered fully demonstrated. The field-report `SHIPPED <hash>` update is correctly deferred until the feature is live and is not a pre-commit defect.

   Correct behavior is to update the vault Documentation controls row, or include verifiable evidence that it was updated, before declaring Task 8 complete.

## Validation numbers

Rows (d) and (e) retain the preceding 12×6 cabinet count. Values below use the JavaScript evaluation order in the implementation.

| Case | Pitch (mm) | `cabPxY()` | Implied rows | `res` | `mmQ` (mm) | Wall W×H (m) | Native `nx×ny` | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| (a) 500 / 1000 / 192 @ 12×6 | 2.6041666667 | 384 | 384 | 0 | 1000 | 6×6 | 2304×2304 | Caption `6 × 6 m wall`; square guide; no warning or quantised clause. Plan correct. |
| (b) 600 / 337.5 / 231 @ 12×6 | 2.5974025974 | 130 | 129.9375 | 0.0625 | 337.6623377 | 7.2×2.025 | 2772×780 | Clause formats as `130 × 2.597 = 337.662 mm`; no red line. Plan correct. |
| (c) untouched 500 / 500 / 192 @ 12×6 | 2.6041666667 | 192 | 192 | 0 | 500 | 6×3 | 2304×1152 | Same geometry and helper strings as the 500×500/192 preset; DOM and state defaults are both `500`. Plan correct. |
| (d) 500 / 750.9 / 192 @ 12×6 | 2.6041666667 | 288 | 288.3456 | 0.3456 | 750 | 6×4.5054 | 2304×1730 | Rows format as `288.35`; red line and both refusals fire. The native/tile mismatch is 1730 vs 1728 as Finding 1 notes. |
| (e) 500 / 760.2 / 192 @ 12×6 | 2.6041666667 | 292 | 291.9168 | 0.0832 | 760.4166667 | 6×4.5612 | 2304×1752 | Clause formats as `292 × 2.604 = 760.417 mm`; no red line; exports pass. Plan correct at six cabinets. |
| (g) 500 / 1000 / 192 @ 2×10 | 2.6041666667 | 384 | 384 | 0 | 1000 | 1×10 | 384×3840 | `fs=max(14,round(384×0.035))=14`; the orange stamp is bounded by the short side. Plan correct. |

For case (b), the recomputed `ny` sweep for `cabY=1…12` is `130, 260, 390, 520, 650, 780, 910, 1040, 1169, 1299, 1429, 1559`. In particular, `cabY=9` is correctly `round(9×129.9375)=1169`; the per-tile path is `9×130=1170`. Every expected number in the plan's Validation rows (a)–(e) and (g) is correct. The separate F1 prose is too narrow when it characterizes the discrepancy as one pixel without bounding `cabY` or residual.

## Confirmed correct

- Task 1 is complete: `S.cabHMM` is in the state literal at `squint.html:507`, its value is `500`, and it matches the DOM `value="500"` at `squint.html:221` before any boot draw.
- Task 2 is implemented as specified: `cab()` emits Custom `ar=H/W` and exact `mmY`; `cabMMY()`, `cabRowsRes()` and `cabTileTxt()` share those values; presets retain the old `mm/ar/tall` branch.
- Task 3 is complete: the two Custom rows, fractional millimetre steps, integer pixel/count controls and `autocomplete="off"` attributes are present.
- Task 4 is implemented in the specified order: fractional millimetres are preserved, both Custom rows use one clamped mode test, hint/plan text shares `cabTileTxt()`, switching to Free size repopulates width/height/pitch, and the three free numeric inputs call `syncPlan()` after drawing.
- `cabPitch()` remains the only pitch derivation. `cabPxY()` reaches `uCabPx` at `squint.html:1195`, `drawCabGrid` at `squint.html:1255`, and the layout guide at `squint.html:1998`; there is no independent vertical-pitch input.
- For `S.cabHMM===undefined` or `0`, `cab()` falls back to `S.cabMM` at `squint.html:548`, so `ar`, `cabPxY()`, `cabMMY()`, `wallH` and `ny` remain finite given the pre-existing valid width/pixel defaults. The guard is available during every pre-boot draw.
- Both refusal sites use the same Custom-only `res>0.1` predicate. `toast()` is declared at `squint.html:1492`; function declarations are hoisted before user interaction. Presets have no truthy `custom` property and cannot trigger the refusal.
- `exportPng()` restores `S.absBlur` and redraws in `finally` at `squint.html:1845`; its conditional button restoration also runs after the early-return refusal. `exportTemplate()` returns before allocating its canvas or starting `toBlob()`.
- At the shipped 12×6 counts, all preset and untouched-Custom helper outputs remain byte-identical: the `cabTileTxt()` W×H form is gated on `c.custom && nonSq`, the default Custom residual is zero, and `fmtPitch()` leaves `6`, `3`, `7.2` and `2.025` unchanged. Comparison and guide filename expressions are unchanged.
- The main render geometry for presets and untouched Custom is unchanged. The only guide-pixel change is the planned short-side font sizing for portrait layouts; all shipped 12×6 preset layouts have `ny<=nx` and retain the old font size.
- `selftest()` does not write any cabinet key, so leaving `cabI`, `cabMM`, `cabHMM` and `cabPX` out of `keep` is correct. Its temporary wall dimensions are not overwritten because `syncFromCabinets()` remains UI-only.
- Boot is safe: `cabHMM` exists in `S` before `applyCal(false)` or persisted rail sizing can draw, and `setCabMode(true)` later synchronizes cabinet geometry.
- Task 6's four console helpers are exported at `squint.html:1948`.
- Task 7 holds in the working tree: `squint.html` and `index.html` are byte-identical and both hash to `476D754E4C0AB0C9AD9E19858DA5D980AF4713B4F7BDA7B68F42ABBB734DBE21`.
- The changed script parses successfully. No tree files were edited, staged or committed during this review.
- Task 8's `README.md` cabinet row, `README.txt` cabinet/refusal explanation, corrected tile-variance limitation, and refreshed scripting-handle list are present.

done: written to C:\Users\user\.claude\jobs\da6cb5ae\tmp\codex-cabinet-review.md
