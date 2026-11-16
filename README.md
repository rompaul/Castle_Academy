# Castle Academy — V0.7.0 · Interactive Learning Missions

A browser-based voxel building game for learners aged 6–15, built with React, TypeScript, Vite, and Three.js.
Build a castle, route water through moats and wells, and complete hands-on castle-themed missions.

**Current release: `0.7.0` (tag `v0.7.0`), released 2026-11-16.** Use the full tag name `v0.7.0` when creating the GitHub Release page. Previous release: `0.6.1` (`v0.6.1`, Electrical Systems). Earlier milestones: V0.6 knowledge & mission foundation, V0.5.1 mission experience, V0.5 water engineering.

V0.7 is a **learning-form increment**: the six expression forms (creation / exploration / problem-solving / experiment / life-simulation / communication) become real playable flows on the existing deterministic chain. Three optional read-only evaluator query channels (observation log, variable comparison, decision sequence) feed six new pure-function evaluators; six schema-v2 missions (18 → 24) cover all six forms including the first `life-simulation`; an optional in-memory reflection input and a local evidence panel give learners a read-back of what they did — no scores, levels, percentages, saving or uploading. Engineering simulation (water pressure / flow curves) stays out of scope per Q-6: Experiment reuses the existing binary rules for two-state comparison. Full notes: `docs/v0.7/V070_Release_Notes.md`.

## What's new in V0.7

- **Six forms, six real flows** — observation checklists, a two-state switch comparison at one position, a switchable hypothesis with no penalty for changing your mind, a three-step scenario decision that never writes world state, a local explanation card, and a creation mission. `life-simulation` goes from 0 to 1 mission.
- **Deterministic interaction evidence** — three new *optional* `EvaluatorQuery` channels (`observationLog` / `variableComparison` / `decisionSequence`), each bounded at 128 entries with a frozen `drop-oldest` policy, in-memory only, cleared on load / reset / profile switch / dispose. Completion is still decided only by registered pure-function evaluators.
- **24 missions, 24 evaluators** — six schema-v2 missions appended (IDs, copy and order of the existing 18 unchanged), one evaluator per mission, all referencing the 24 registered knowledge points. Prerequisites gain exactly one new edge, cycle-free.
- **Optional reflection, zero persistence** — a "说一说（可以不写）" input that never enters evaluation, never produces mastery evidence, never lifts the profile-switch suppression, and exists only in runtime memory.
- **Local evidence panel** — a read-only "给大人看" panel listing counts and copy (3 observations, 0 comparisons, 2 choices…). No percentage, level, tier, score or right/wrong marker; sentence-style evidence stays in the existing V0.6 evidence panel.
- **Input safety** — the typing guard now covers all new text inputs: digits, `E`, `F`, `Tab` and the mouse wheel never fire while typing.
- **Fixed on the way** — a real defect found during GATE-2 screenshot review: on a fresh profile, session-evidence missions could never complete because `completionSuppressed` was only lifted by water/measurement events. Session-evidence actions and real world changes now lift it; reflection still never does.

## What's new in V0.6.1 (previous release)

V0.6.1 added nine electrical / water-link blocks (25 → 34, append-only), a deterministic six-neighbour binary electrical rule with derived powered states, the `F`-key look-at toggle, three schema-v2 electrical missions (15 → 18) with 5 new `kp.electric.*` knowledge points (19 → 24), three-level hints and child-safety copy, and the MC-style nine-slot quick bar with a category palette (`DDR-0002` declares the intentional HUD change). `WorldSnapshot v1` stayed unchanged; the clean-world 3D canvas stayed pixel-identical to V0.6. Full notes: `docs/v0.6.1/V061_Release_Notes.md`.

## Core experience (carried forward from V0.5.1)

- **Water engineering** — rule-verified simulation with sources, gravity-fed flow, drains and pipes. Water state is derived from sources and fully recomputed on reset; no water is stored in the world snapshot.
- **Missions** — a pure-data Content Pack (`src/content/missions`) with 24 deterministic evaluators (15 at V0.5.1/V0.6, +3 electrical in V0.6.1, +6 interactive forms in V0.7). Completion checks are pure functions: no randomness, clock, network, DOM, localStorage or `WorldSnapshot` access. Covers 4 age bands and all 6 expression forms; text evidence only checks length, reflection is never judged, and both stay in memory only.
- **Mission experience** — collapsible sidebar, detail panel with progressive hints, completion feedback with decorative titles, first-run onboarding, and a reward queue that shows multiple completions one at a time.
- **Learner profiles** — stored in their own localStorage key `castle.academy.learner` (multi-profile, switchable, tolerant of corrupted data). World saves use `castle-academy-world-v1` / `castle-academy-view-v1`; **the `WorldSnapshot` schema stays at version 1** and contains zero learner fields.
- **Building & exploration** — 34 block types with a procedural 16×16 texture atlas (49/64 tiles used), blueprint / line / fill tools, layer visibility and section (cutaway) view, distance measurement, save / load / reset.
- **Design system** — frozen by DDR-0001: `src/ui/tokens.css` is the single source for colour and spacing; SVG icon family, no emoji as permanent UI icons; mission UI is a keyboard-accessible DOM overlay that does not resize the canvas.

## Requirements

- Node.js 20 LTS or newer
- npm 10 or newer
- A desktop browser with WebGL support (Chrome or Edge recommended)

## Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, then click **Enter World** to lock the pointer. If the browser blocks pointer lock, click the 3D world to retry; press `Esc` to release it.

## Controls

| Action | Control |
|---|---|
| Move / look | `W A S D` / mouse |
| Move up / faster; descend | `Space` / `Shift` (right `Shift` to descend) |
| Place / remove a block | Left / right mouse button |
| Choose a quick slot | Number keys `1`–`9`, mouse wheel, or click a hotbar slot |
| Browse / assign all 34 blocks | `E` (7 category groups; click a block to put it in the current slot) |
| Toggle the switch / valve you are looking at | `F` |
| Cycle building tool (`place` → `line` → `fill`) | `Tab` |
| Layers, section view, measurement, blueprints | Topbar **Layers** panel and HUD controls |
| Save / load / reset world | Topbar buttons |
| Missions | Hover or click the left-edge task sidebar; expand a task for hints and progress |
| My evidence | "我的证据" button in the expanded mission sidebar |
| Release the mouse | `Esc` |

Locked missions stay visible with a "先完成〈任务名〉" hint and never block free building.

## Verify

```bash
npm install
npm run typecheck
npm test -- --no-file-parallelism
npm run build
npx playwright install chromium
npm run test:e2e -- --workers=2
```

`--no-file-parallelism` avoids Vitest worker failures in sandboxed environments; E2E must run with **low concurrency (`--workers=2` or fewer)** and not in parallel with `build` — software rendering starves the default 7 workers. **Before running E2E, kill any leftover dev server on port 5173** and let Playwright start its own `webServer` (configured as `--host 127.0.0.1`); a stale long-running Vite process causes `__CASTLE_TEST__` mount failures.

`npm run verify:source` currently exits 1 due to a pre-existing V0.5-era defect (see Known limitations); it is not part of the release gate. The legacy full-mode `v051-visual-regression.mjs` **re-captures canonical screenshots** — use `--clean-only`, or back up and restore the canonical directory with git. V0.7 uses the separate, non-destructive `scripts/v07-visual-regression.mjs`, which compares against the V0.6 / V0.6.1 canonicals and only writes into `docs/v0.7/screenshots/canonical/`.

**Current baseline: 408 unit tests (55 files) and 47 E2E tests**, including the 20 V0.5 baseline E2E tests unchanged byte-for-byte.

The browser E2E suite uses a development-only test bridge (`window.__CASTLE_TEST__`) to assert authoritative world-state changes. That bridge is not included in production builds.

## Release verification (V0.7.0)

| Check | Result |
|---|---|
| typecheck / build / `git diff --check` | exit 0 / exit 0 / 0 |
| Unit tests | 408/408 (55 files) |
| E2E | 47/47 (`--workers=1`; V0.5 baseline 20 unchanged byte-for-byte) |
| Clean-world 3D visual regression | `worldCanvas` **0 px diff** against the V0.6 canonical; full-screen vs V0.6.1 main **0 px diff** (V0.7 ships zero HUD changes) |
| Mission sidebar scene | frozen separately as V0.7 canonical; 24 cards, 329 draw calls |
| D-2 ABBA performance | clean 329 dc / 44.62 ms vs sidebar open 329 dc / 46.20 ms (**+3.54%**, attributed to the 24-card DOM overlay under test) |
| Data & child safety | 3 existing localStorage keys, zero new keys, reflection text runtime-verified absent from storage, banned words 0 hits, no AI/LLM calls |

V0.6.1 verification (339 unit tests, `worldCanvas` 0 px, ABBA +1.01%, safety PASS) remains in `docs/v0.6.1/`.

## Architecture

- `src/core` — `WorldState` (single source of truth), `EventBus`, `WorldSnapshot` schema v1, block registry, block categories
- `src/plugins` — player-controller, building, building-tools, inventory, layers, measurement, persistence, water, electrical, learning, learner, mission, blueprint
- `src/content/missions` — pure-data `MissionDefinition` Content Pack (schema v2, 24 missions), evaluator registry and V0.7 interaction contracts
- `src/content/knowledge` — knowledge point registry (24 IDs), `resolveMissionGraph()` / `isMissionUnlocked()` pure functions
- `src/rendering` — Three.js adapter, texture atlas, derived electrical overlay, dev test bridge
- `src/ui` — React HUD, design tokens, mission experience overlay, V0.7 form interactions, evidence record panel, block palette
- `src/app` — application shell and lifecycle

World state is authoritative; Three.js meshes are a visual projection. New gameplay domains go through plugins. Mission completion may only be decided by deterministic evaluators. Learner data and world data are deliberately never mixed.

## Documentation

V0.7 evidence lives in `docs/v0.7/` and in the execution package at the workspace root:

- `docs/v0.7/V070_Release_Notes.md` — full release notes, intentional design changes, known limitations and upgrade notes
- `docs/v0.7/V07-024_028_POLISH_EVIDENCE.md` — visual regression, ABBA, full regression, AI sweep and safety spot-check evidence
- `docs/v0.7/audit/V07_ROLE_B_ACCEPTANCE_REPORT.md` — role B independent acceptance (STOP GATE-2, FULLY SATISFIED)
- `docs/v0.7/screenshots/gate2/` (15 shots) and `screenshots/canonical/` (V0.7 frozen set)
- `docs/v0.7/V070_V08_Handoff.md` — V0.8 handoff checklist
- `../Castle_Academy_V0.7_Execution_Package/01_Execution/V07_Progress_Log.md` — task-by-task evidence and gate sign-offs

V0.6.1 evidence lives in `docs/v0.6.1/` (`V061_Release_Notes.md`, `V061_GATE3_Review_Pack.md`, `V061_PHASE4_VERIFICATION_REPORT.md`, `V061_Performance_Paired.json`, `V061_Safety_Spotcheck.json`, `screenshots/gate2/` 10 shots, `screenshots/canonical/`, `V061_V07_Handoff.md`) and `../Castle_Academy_V0.6.1_Execution_Package/`. The V0.6 clean-world anchors are the zero-tolerance 3D baseline for V0.6.1 and V0.7 as well.

Historical evidence remains in `docs/v0.51/` (`V0.51_Acceptance_Report.md`, `V0.51_Performance_Report.md`, `V0.51_Final_Release_Review.md`, `V0.51_Tester_Report_GATE2.md`, `screenshots/canonical/`).

## V0.7 — parent / teacher note

> **本产品为虚构二值规则模型，不含真实电气知识，也不含任何可迁移到现实的操作步骤。建议成人陪同低龄儿童使用。**

The electrical content is a fictional two-state (connected / not connected) game rule. Child-facing copy uses one consistent vocabulary — 电源 / 电线 / 开关 / 灯 / 信标 / 水泵 / 阀门 — and contains **no real wiring steps, no electrical values, and no real-world socket or household-wiring imagery**. A first-visit guide and a permanent help-panel notice state plainly that real electricity is dangerous. In V0.7, the reflection input and local explanation are optional, never scored, and **stay on this device only** — they are not saved, uploaded or shared, and disappear when the game closes. Full wording, the banned-word list and the acceptance mapping are in [`docs/v0.6.1/V061_Parent_Teacher_Note.md`](docs/v0.6.1/V061_Parent_Teacher_Note.md).

## Known limitations

- **DEV-601 (pre-existing, not fixed):** `npm run verify:source` exits 1 because `scripts/v05-quest-screenshots.mjs:5` imports an undeclared `playwright` package. The script is not referenced by any npm script or config. Registered as read-only evidence, deliberately not fixed to keep the release scope clean.
- **O-1 (pre-existing):** an external web-font dependency produces ~10.2% topbar / 2.8% footer noise in visual regression, identical in nature to V0.5.1. The `worldCanvas` region is 0 px diff and canonicals are kept unchanged pending a separate design decision.
- **DDR-0002 HUD whitelist:** the `AC-6750` "HUD ≤0.5%" criterion is superseded by an approved whitelist for the intentional help-panel and hotbar changes; the 3D world 0 px criterion was **not** relaxed.
- **Performance judgement (D-2):** use same-machine, same-script ABBA paired comparison. Absolute frame-time thresholds are invalid here — two runs on the same machine differed by ~30× in p95.
- **E2E flakiness:** occasional `load` timeouts (e.g. AC-221) come from dev-server cold compilation / software-rendering starvation, not product code; re-runs with `--workers=2` pass. See the port-5173 note above.
- **Knowledge point count:** the approved mapping table said "21 IDs" but de-duplicates to 19 unique IDs (shared IDs were counted per mission). All 19 approved IDs are registered; none were invented to reach 21. V0.6.1 adds 5 electrical IDs for 24 total.
- **ID regex:** ADR-0008 suggested a fixed 4-segment regex, which would reject 16 of the approved 3-segment IDs (e.g. `kp.system.continuous_path`). Per the ADR's "freeze the regex at implementation" clause it is frozen at 3–4 segments with underscores/hyphens allowed inside a segment; approved ID wording is unchanged.
- **Migration window:** legacy `quest-panel`, `CastleQuestPlugin` and `quest.*` events are still present to keep the V0.5 baseline E2E suite green. Removal was deferred to V0.7 and is **deferred again to after V0.7** (needs owner authorisation and an E2E-scope re-evaluation).
- **Software rendering:** under SwiftShader, the ~329 draw calls from stage blocks cause low frame rates. This is a V0.5-era issue, not a regression; hardware GPUs are unaffected. A candidate optimisation (`InstancedMesh` / `BatchedMesh` for static stage blocks) is deferred to a later version.
- **Out of scope:** multiplayer, accounts, AI tutor, adaptive recommendation, rankings/levels/percentages in the child-facing UI, and full mobile layout.

## Release administration

Tag `v0.7.0` is pushed to https://github.com/rompaul/Castle_Academy.git; `master` may carry later documentation-only commits. The GitHub **Release page must be created manually** by the owner: `gh release create` returns 403 because the fine-grained PAT has no release write permission (same cause as v0.5.0 / v0.5.1 / v0.6.0 / v0.6.1). Use https://github.com/rompaul/Castle_Academy/releases/new with the full tag `v0.7.0` and copy the text from `docs/v0.7/V070_Release_Notes.md`.

## Next

V0.8 starts from the handoff checklist `docs/v0.7/V070_V08_Handoff.md`: the V0.6 canonical remains the zero-tolerance 3D anchor (V0.7 re-verified 0 px), the legacy `quest.*` migration window is still open, engineering simulation (water pressure / flow / pump curves) remains the natural Experiment extension once Q-6's binary-comparison form is proven, and the three V0.7 read-only query channels are ready to be reused by any future evaluator.
