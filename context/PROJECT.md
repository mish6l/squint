# Project config — read by context-flow skills (SQUINT)

<!-- Read by /plan-feature, /execute, /commit, /ship. Every command here must be
     real and runnable in this repo. Update when the toolchain changes.
     Hand-authored 2026-09-04 from handover D + the repo; no /context-init ran. -->

## Stack
**One self-contained HTML file.** `squint.html` is the whole tool: the panel
(HTML/CSS, top of file), a single mutable state object `S` (defaults ~line 500),
the model helpers (cabinets / pitch / photometry / acuity, ~490–900), a WebGL2
pipeline with float render targets and 7 shader programs (6 passes, linear light
end to end), the outputs (build plan, export caption strip, layout-guide PNG),
and `selftest()` (~1980). No build step, no bundler, no dependency, no network —
that sentence is a *published promise* (README, release notes, the Reddit post)
and every change must keep it true.

`index.html` is a **byte-identical mirror** of `squint.html` because GitHub Pages
serves the repo root at <https://mish6l.github.io/squint/>. The release model *is*
`main`: commits land on `main` directly (no feature branches — a branch would
leave the live site behind a merge nobody asked for), and Pages rebuilds in
~4–5 min.

Debug/scripting handle: `window.SQUINT` (~line 1888) exposes `S`, `draw`,
`nativeRes`, `CABS`, `cab`, `cabPitch`, `cabPxY`, `syncFromCabinets`,
`screenRes`, `effectiveRes`, `gapPx`, `contrastRatio`, `selftest`, and more —
this is how a browser console verifies behaviour.

## Gate (validation that must pass before shipping)

### Fast checks (run inline, after each logical group of changes)
```
# 1. Mirror parity — the two files must be the same bytes in the SAME commit:
cp squint.html index.html
git rev-parse HEAD:squint.html HEAD:index.html     # same blob id after commit
sha256sum squint.html index.html                    # same hash in the working tree

# 2. Open squint.html in Chrome (file:// is fine), then in the console:
SQUINT.selftest()
#    must return linear fusion 188 ± 6 and fill drift ≈ 0.1%, with NO red banner.
#    Check the console for shader compile/link errors — 7/7 programs must build.
```

**A green `selftest()` proves the RENDER CORE, not the feature.** It forces a
neutral world (manual ambient, 0° off-axis, full drive, no array, no processor)
and asserts two numbers — which is precisely what makes it blind to bugs that *are*
the coupling between controls. Round 3 (2026-08-23) fixed 23 findings, every one
at a seam between subsystems, and `selftest()` stayed 188 / 0.11% across all of
them. **So: when a change adds or alters a control, the verification must set
that control and read a number only the correct code can produce** — through
`window.SQUINT` in the console, or by eye against a known-answer source (e.g. a
1×1 source on a 2×2 wall lights exactly one pixel). Write those probes into the
plan's Validation section; do not write "selftest passes".

### Slow checks (after push — Pages rebuild, poll, never foreground-block)
```
# ~4–5 min after push, the live page must hash identical to local:
curl -sL https://mish6l.github.io/squint/ | sha256sum
sha256sum squint.html
# and selftest() run ON THE HOSTED COPY must return 188 / ≈0.1%.
```

### Release (only when cutting a version)
```
gh release create vX.Y --target "$(git rev-parse HEAD)" \
  --title "vX.Y — <one line>" --notes-file <notes.md> squint.html testcard.png
# then re-download the published asset and hash it against local + live.
# v1.1 (2026-09-03) is the template; v1.0 carries a superseded banner.
```

## Conventions checklist
- **Pitch is DERIVED, never nominal.** `cabinet_mm / cabinet_px`. A "2.6 mm" 500 mm
  tile is 2.604 mm and that difference is the tool's reason to exist. Nothing may
  accept a nominal pitch and believe it (this rule extends to any future importer).
- **Never print a derived pitch raw** — use `fmtPitch()`. Raw floats land on
  labels, filenames and the client-facing caption strip.
- **Refuse rather than render an unbacked answer.** Missing WebGL2 → refusal
  card. Oversized texture → refusal card at first draw. A new input whose value
  the model cannot honour must refuse or flag *in the frame*, never silently
  pick something.
- **Every number must reach every consumer.** The round-3 pattern: a control
  reached the quantiser but not the photometry; arrays reached the render but
  not the export's viewing contract. When adding a state key, grep every place
  the *related* keys are read — build plan, caption, PNG guide, hint text,
  `syncFromCabinets`, array maths, shader uniforms — and make each one either use
  it or provably not need it.
- **`S` is the single source of truth**, and `selftest()` saves/restores a subset
  of it. Any enumeration of `S` keys (snapshot, restore, reset) must be checked
  when a key is added — a silent drop there is the classic seam.
- **Presets are byte-identical after any change.** The `CABS` table and the
  default square Custom (500 mm / 192 px) must produce the same wall, pitch,
  native res, caption and pixels as before. Verify with numbers, not intent.
- **No canvas-2D fallback, no three.js** — both were proposed by reviewers and
  refused (two render paths = two answers under one name).
- Commit messages: imperative, plain, no prefixes — `Fix four seam findings from
  the third external review`, `Model event walls properly: cabinets, processor
  feeds and screen arrays`. Body explains the WHY when it is not obvious.

## Cross-cutting surfaces (touching these = wide blast radius, extra review)
- `S` defaults and any save/restore/enumeration of `S` (incl. `selftest()`).
- `CABS` + `cab()` + `cabPitch()` / `cabPxY()` / `cabMMY()` / `syncFromCabinets()`
  — every wall dimension, native res and pitch flows from here.
- The **export caption strip** and **build plan** text — client-facing artifacts;
  a wrong number here leaves the machine.
- The **layout-guide PNG** (native-res reference with grid / safe area).
- Shader uniforms and the per-cabinet tile-variance hash indexing.
- The known-simplifications list in `README.txt` (§ "KNOWN SIMPLIFICATIONS") and
  the controls table in the vault `SQUINT — Documentation` — both are part of
  the tool's honesty contract; a change that shrinks or grows a limitation
  updates them in the same commit.

## Areas (vocabulary for plans)
| Area | Where | What |
|---|---|---|
| `panel` | `squint.html` ~1–300 | HTML/CSS controls, rows, hints, ids |
| `state` | ~490–560 | `S` defaults, `CABS`, `cab()`, sync helpers |
| `model` | ~560–900 | photometry, acuity, contrast, distances |
| `pipeline` | GLSL blocks + draw | 7 programs, texture pool, resample, quantise |
| `outputs` | ~1900–1980 | build plan, caption strip, PNG guide, filenames |
| `selftest` | ~1980–2080 | boot assertion + console handle |
| `docs` | `README.txt`, `README.md`, vault `SQUINT/` | manual, limits list, Documentation, field reports |

## Where things live
- Repo (PC2): `D:\Mishal\Claude Code\SQUINT` · GitHub `mish6l/squint` (public, MIT)
- Live: <https://mish6l.github.io/squint/> · Releases: v1.0 (superseded), **v1.1**
- Vault: `H:\…\My Notes\SQUINT\` — Documentation, soft launch plan, v2 backlog
  (unparked 2026-09-04), v2 triage, **field reports** (the reported-gaps ledger),
  `reviews\`, `handovers\`
- Reviews in repo: `reviews\` (round 1–3, Codex + Fable, unedited)
