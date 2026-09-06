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
