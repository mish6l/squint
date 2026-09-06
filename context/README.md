# context/ — SQUINT

Durable, curated state for Claude Code sessions on SQUINT. See the vault
`Skills/` manual for how the context-flow lifecycle works.

- **PROJECT.md** — the config every context-flow skill reads (gate commands,
  conventions, cross-cutting surfaces). Keep it current with the toolchain.
- **plans/** — implementation plans from `/plan-feature`; `/execute` consumes
  them in a fresh session. Shipped plans move to `plans/shipped/`.

Lifecycle: `/plan-feature <idea>` → `/clear` → `/execute` → `/commit` → `/ship`.
Stopping mid-work → `/handover` (writes a dated note to the vault `SQUINT\handovers\`).

Field evidence (reported gaps, the thing that ranks v2) lives in the vault:
`SQUINT — field reports.md`. The v2 scope decision is in
`SQUINT — v2 triage 2026-09-03 (first field data).md`.

## Plans
| Plan | Status |
|---|---|
| [non-square-custom-cabinets](plans/shipped/non-square-custom-cabinets.md) — FR-002 #1: one input (cabinet height, mm) routed through the existing `tall/ar` plumbing; a custom tile is simulated at its whole-LED height so `ny == cabY·cabPxY()` by construction; presets byte-identical; exports refuse a height that isn't a whole number of LEDs. Read its `## Execution findings`: the two-input row failed at the *default* rail width, and Codex round 4 caught an accumulating residual the per-tile gate missed | SHIPPED 2026-09-05 (`6c6f0cd` on `main`) |
| [render-honesty](plans/shipped/render-honesty.md) — v1.3: the four verified pixel-simulation defects from the 2026-09-06 audit. Gate first (`SQUINT.probe()` + a Node stage-rule oracle, red on `e3cc230`), then #2 aligned reduce stages, #3 premultiply-per-tap bilinear in `FS_COPY`, #4 quantise at native by re-gating `decim` on a native buffer cap (fallback flagged in-frame and on the export), #1 a fragment-aligned box reduce of the quantised LED field to the display footprint whenever `cell < 1`. **Every zoomed-out view changes on purpose.** README's stale "2×2 averages" and "exact box filter" corrected; v1.3 notes disclose. **Executed same day:** gate red on `e3cc230` (69/81), then green; Task 6's measurement forced a better fix than planned — the lit-area mask folded INTO the fragment-aligned reduce (92 codes → 1.1); Codex round 6 found five more real defects (leading fragment, >64 LEDs/px, fallback mask period, A/B export panels, texture ownership on refusal), all fixed; gate 116/116 | SHIPPED 2026-09-06 (`c109388` on `main`) |
