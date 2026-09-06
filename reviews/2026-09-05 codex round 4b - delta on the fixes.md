# Delta review: custom cabinet fixes, round 4b

Not ready under the stated universal invariant: finding #2 is closed, and finding #1 is fixed for the intended and all practical cabinet counts tested, including the supplied accumulating-residual cases, but #1 is not completely closed because `tileMMY()`'s fixed epsilon can still select the typed height while an unbounded `cabY` accumulates enough sub-epsilon residual to change `ny`. No new High or Medium issue was found; the remaining defect is Low severity and requires a physically impossible billion-row wall, but it directly contradicts the claimed `ny == cabY·cabPxY()` “at every count.”

## Findings

1. **Severity: Low — `squint.html:217`, `squint.html:587-588`, `squint.html:597`, `squint.html:600-602`, `squint.html:1582-1585`**

   **Expression:** `tileMMY() = rr.res < 1e-9 ? cabMMY() : rr.mmQ`, followed by `ny = round(cabY × tileMMY() / pitch)`, while the cabinet grid is `cabY × rr.want`; `cabY` has no maximum.

   The epsilon is per tile, so it does not prove the wall-level rounding invariant for an unbounded count. A Custom `W=500`, `H=500.000000001`, `px=192`, `cabY=1,500,000,000` has `pitch=2.6041666666666665`, `want=192`, `rows=192.000000000384`, and `res=3.8400571611418854e-10 < 1e-9`. Line 588 therefore keeps the typed `500.000000001 mm` rather than `mmQ=500 mm`; line 597 produces `wallH=750000000.0015 m`, and line 602 produces `ny=288000000001`, while `cabY·cabPxY()=288000000000`. Equivalently, the residual exceeds the wall boundary `0.5/cabY = 3.333333333333333e-10` rows per tile. The normal input binder accepts both values: `step` does not enforce validity in the handler, and neither the DOM input nor the binder caps `cabY`.

   This is Low rather than High because the first simple counterexample needs more than a billion cabinet rows and is already far beyond the guide export's size limit. Correct behavior is nevertheless to avoid a fixed per-tile tolerance as proof of an all-count invariant: always use `rr.mmQ` for Custom geometry (or derive Custom `ny` directly from `cabY·cabPxY()`), or explicitly cap `cabY` so every accepted count stays below the accumulated half-row boundary.

## Confirmed correct

- The practical fix for #1 works: `500/760.2/192 @ 20` gives `tileMMY=760.4166666666666`, `wallH=15.208333333333332`, and `ny=5840=20×292`; `500/750.9/192 @ 6` gives `wallH=4.5` and `ny=1728=6×288`; Custom `600/337.5/231` gives `wallH=2.025974025974026`, `ny=780` at 6 and `ny=1170` at 9. A deterministic million-case sweep over half-millimetre W/H values, 8–2048 px, and `cabY` 1–10,000 found no mismatch.
- Presets take the unchanged branch at `squint.html:587`; their `cabMMY()` expression and `syncFromCabinets()` arithmetic are numerically unchanged, including preset 6 retaining `2.025 / 1169` at `cabY=9`.
- Finding #2 is closed. `fmtM()` at `squint.html:562` matched `String(v)` for all 168 preset metre values (7 presets × counts 1…12 × width/height), including every odd-count 337.5 mm height. Its caption use at `squint.html:1909-1911` removes the Custom tiled-height float tails without changing a preset caption.
- The consumers are internally consistent with the tiled Custom height: `screenRes()`/`nativeRes()` and therefore the renderer and `contentRect()` use the quantised `ny`; the hint at `squint.html:1549-1560`, caption at `squint.html:1908-1912`, plan `physical` line at `squint.html:1989`, and guide grid at `squint.html:2003-2019` all describe or use the same simulated wall. `spanW()` and the viewing-distance contract are horizontal-only and correctly remain driven by wall width.
- `syncFromCabinets()` remains UI-only: its callers are the cabinet mode/selection/input handlers at `squint.html:1570-1585`, not `draw()` or `selftest()`. `tileMMY()` has no recursion: it reads `cabRowsRes()`, whose `cab()`, `cabPitch()`, `cabMMY()`, and `cabPxY()` calls terminate without calling `syncFromCabinets()` or `tileMMY()`. Function declaration hoisting makes its placement safe.
- The three-row Custom layout is wired correctly: the unique `rowCustom`, `rowCustomH`, and `rowCustomPx` elements and `cabMM`, `cabHMM`, and `cabPX` inputs are at `squint.html:221-229`; one clamped Custom boolean toggles all three at `squint.html:1547-1548`; the fractional millimetre and integer pixel binders are present at `squint.html:1582-1585`.
- `squint.html` and `index.html` remain byte-identical (SHA-256 `41874354ED998BD8A0A2433BE2F5637695A98D7090AF5AA92953E818B85C29C7`).

done: written to C:\Users\user\.claude\jobs\da6cb5ae\tmp\codex-cabinet-review-2.md
