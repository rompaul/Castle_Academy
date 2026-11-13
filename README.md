# Castle Academy — V0.6.0 · Knowledge & Mission Foundation

A browser-based voxel building game for learners aged 6–15, built with React, TypeScript, Vite, and Three.js.
Build a castle, route water through moats and wells, and complete hands-on castle-themed missions.

**Current release: `0.6.0` (tag `v0.6.0`), released 2026-11-12.** The tag name is exactly `v0.6.0` — there is no `v0.6` tag in this repository. Previous release: `0.5.1` (`v0.5.1`, Mission Experience Foundation). Earlier milestones: V0.4.2 procedural textures, V0.5 water engineering.

V0.6 is a **knowledge and mission foundation** release: it adds a knowledge-point registry, a versioned content schema, prerequisite mission chains, deterministic mastery evidence, and a v2 learner profile. It deliberately adds **no new blocks and no rendering changes** — the world canvas is pixel-identical to V0.5.1 and draw calls stay at 329.

## What's new in V0.6

- **Knowledge point registry** — `src/content/knowledge/registry.ts` registers 19 knowledge points under a frozen `kp.<domain>.<concept>(.<aspect>)` namespace (3–4 segments, validated by `validateKnowledgePoint()`). The `kp.electric.*` prefix is reserved for V0.6.1 but **not registered**; referencing it fails validation.
- **Mission content schema v2** — `schemaVersion: 2` adds `knowledgePointIds` to each mission. `validateMissionDefinition()` is dual-mode: v1 content (no `schemaVersion`) validates exactly as before, while v2 requires every referenced ID to be registered.
- **15-mission lossless migration** — all 15 missions moved to v2 with **byte-identical copy** (`title`, `context`, `goal`, `hintLadder`, `learningGoal`, evaluator IDs, rewards). Only three prerequisite edges were added: `water-flow → seven-steps → broken-pipe` and `count-bridge → material-budget`. The other ten missions keep an empty prerequisite list, avoiding the seven missions that the V0.5 E2E suite clicks and asserts on.
- **Mission graph** — `resolveMissionGraph()` is a pure function (Kahn topological sort with a deterministic, lexicographically ordered ready queue) that detects cycles, dangling references and self-references. `isMissionUnlocked()` derives unlock state from completed missions.
- **Derived `locked` state and unlock event** — the mission sidebar can now show `locked` (prerequisites incomplete) separately from `unavailable` (missing capability). `locked` is a **view-only derived state**: persisted progress remains the original three states `available` / `active` / `completed`. A new `mission.unlocked` event fires once on the locked→playable transition and is cleared on profile switches, so it is deterministic and replayable.
- **Deterministic mastery evidence** — on completion, one `MasteryEvidenceRecord` is written per knowledge point, carrying a plain-language `observation` produced by the evaluator (for example `36/40` for the moat mission). The 15 evaluators' decision logic was **not changed**; evidence is a read-only record, never a score, level, percentage or ranking. Completion is **not** treated as mastery.
- **Evidence record panel** — a read-only panel reachable from the sidebar ("我的证据"), showing the deterministic observations with an empty state written in plain language.
- **Knowledge card in mission detail** — the detail panel shows the knowledge points a mission uses, using child-friendly labels and summaries. A skeleton state avoids ever exposing internal IDs.
- **LearnerProfile v1 → v2 migration** — the `castle.academy.learner` store upgrades atomically and idempotently, reusing the existing `learner.profile.recovered` tolerance path for corrupt data. Old v1 profiles upgrade automatically; truly unsupported versions are rejected.
- **Non-modal migration notice** — recovery and migration messages appear as a lightweight bottom-right card (≤400 ms animation, respects `prefers-reduced-motion`) that never blocks the world or sidebar. A `peekNotice()` read path fixes the case where the recovery event fires before the UI subscribes.

## Core experience (carried forward from V0.5.1)

- **Water engineering** — rule-verified simulation with sources, gravity-fed flow, drains and pipes. Water state is derived from sources and fully recomputed on reset; no water is stored in the world snapshot.
- **15 missions** — a pure-data Content Pack (`src/content/missions`) with 15 deterministic evaluators. Completion checks are pure functions: no randomness, clock, network, DOM, localStorage or `WorldSnapshot` access. Covers 4 age bands and 5 expression forms; the communication mission only checks text length, never judges content, and keeps the text in memory only.
- **Mission experience** — collapsible sidebar, detail panel with progressive hints, completion feedback with decorative titles, first-run onboarding, and a reward queue that shows multiple completions one at a time.
- **Learner profiles** — stored in their own localStorage key `castle.academy.learner` (multi-profile, switchable, tolerant of corrupted data). World saves use `castle-academy-world-v1` / `castle-academy-view-v1`; **the `WorldSnapshot` schema stays at version 1** and contains zero learner fields.
- **Building & exploration** — 25 block types with a procedural 16×16 texture atlas, blueprint / line / fill tools, layer visibility and section (cutaway) view, distance measurement, save / load / reset.
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
| Select a block | Number keys `1`–`9`, or click a hotbar slot (25 blocks) |
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
npm run test:e2e -- --workers=1
```

`--no-file-parallelism` avoids Vitest worker failures in sandboxed environments; E2E must run with `--workers=1` and not in parallel with `build`. **Before running E2E, kill any leftover dev server on port 5173** and let Playwright start its own `webServer` (configured as `--host 127.0.0.1`); a stale long-running Vite process causes `__CASTLE_TEST__` mount failures.

`npm run verify:source` currently exits 1 due to a pre-existing V0.5-era defect (see Known limitations); it is not part of the release gate. The full-mode visual-regression script **re-captures canonical screenshots** — use `--clean-only`, or back up and restore the canonical directory with git.

**Current baseline: 256 unit tests (V0.5.1: 215 → +41) and 47 E2E tests**, including the 20 V0.5 baseline E2E tests unchanged.

The browser E2E suite uses a development-only test bridge (`window.__CASTLE_TEST__`) to assert authoritative world-state changes. That bridge is not included in production builds.

## Release verification (V06-022~024)

| Check | Result |
|---|---|
| typecheck / build | exit 0 / exit 0 |
| Unit tests | 256/256 |
| E2E | 47/47 (V0.5 baseline 20 unchanged) |
| Visual regression | `worldCanvas` **0 px diff**; questPanel 0.01% (≤0.5%) |
| Performance | draw calls **329 → 329**; DOM latency p95 ≤ 0.7 ms |
| Data safety | 3 localStorage keys; 0 learner fields in world saves; 0 AI/LLM dependencies |

## Architecture

- `src/core` — `WorldState` (single source of truth), `EventBus`, `WorldSnapshot` schema v1, block registry
- `src/plugins` — player-controller, building, building-tools, inventory, layers, measurement, persistence, water, learning, learner, mission, blueprint
- `src/content/missions` — pure-data `MissionDefinition` Content Pack (schema v2) and evaluator registry
- `src/content/knowledge` — knowledge point registry, `resolveMissionGraph()` / `isMissionUnlocked()` pure functions
- `src/rendering` — Three.js adapter, texture atlas, dev test bridge
- `src/ui` — React HUD, design tokens, mission experience overlay, evidence record panel
- `src/app` — application shell and lifecycle

World state is authoritative; Three.js meshes are a visual projection. New gameplay domains go through plugins. Mission completion may only be decided by deterministic evaluators. Learner data and world data are deliberately never mixed.

## Documentation

V0.6 evidence lives in `docs/v0.6/` and in the execution package at the workspace root:

- `docs/v0.6/V060_Release_Notes.md` — full release notes, known limitations and the V0.6.1 handoff checklist
- `docs/v0.6/audit/` — six Phase 0 read-only audit reports (baseline, mission/evaluator ID map, learner & persistence contract, event & capability map, test & performance baseline, open questions & risks)
- `docs/v0.6/screenshots/gate2/` — K1~K6 GATE-2 review screenshots
- `docs/v0.6/screenshots/canonical/` — V0.6 clean-world visual-regression anchors
- `../Castle_Academy_V0.6_Execution_Package/01_Execution/V06_Progress_Log.md` — task-by-task evidence and gate sign-offs

Historical evidence remains in `docs/v0.51/` (`V0.51_Acceptance_Report.md`, `V0.51_Performance_Report.md`, `V0.51_Final_Release_Review.md`, `V0.51_Tester_Report_GATE2.md`, `screenshots/canonical/`).

## Known limitations

- **DEV-601 (pre-existing, not fixed):** `npm run verify:source` exits 1 because `scripts/v05-quest-screenshots.mjs:5` imports an undeclared `playwright` package. The script is not referenced by any npm script or config. Registered as read-only evidence, deliberately not fixed to keep the release scope clean.
- **O-1 (pre-existing):** an external web-font dependency produces ~10.2% topbar / 2.8% footer noise in visual regression, identical in nature to V0.5.1. The `worldCanvas` region is 0 px diff and canonicals are kept unchanged pending a separate design decision.
- **Performance judgement (D-2):** use same-machine, same-script ABBA paired comparison. Absolute frame-time thresholds are invalid here — two runs on the same machine differed by ~30× in p95.
- **E2E flakiness:** occasional `load` timeouts (e.g. AC-221) come from dev-server cold compilation, not product code; re-runs pass. See the port-5173 note above.
- **Knowledge point count:** the approved mapping table said "21 IDs" but de-duplicates to 19 unique IDs (shared IDs were counted per mission). All 19 approved IDs are registered; none were invented to reach 21.
- **ID regex:** ADR-0008 suggested a fixed 4-segment regex, which would reject 16 of the approved 3-segment IDs (e.g. `kp.system.continuous_path`). Per the ADR's "freeze the regex at implementation" clause it is frozen at 3–4 segments with underscores/hyphens allowed inside a segment; approved ID wording is unchanged.
- **Migration window:** legacy `quest-panel`, `CastleQuestPlugin` and `quest.*` events are still present to keep the V0.5 baseline E2E suite green. Removal has been deferred again to **after V0.6.1**.
- **Software rendering:** under SwiftShader, the ~329 draw calls from stage blocks cause low frame rates. This is a V0.5-era issue, not a regression; hardware GPUs are unaffected. A candidate optimisation (`InstancedMesh` / `BatchedMesh` for static stage blocks) is deferred to a later version.
- **Out of scope:** multiplayer, accounts, AI tutor, adaptive recommendation, rankings/levels/percentages in the child-facing UI, and full mobile layout.

## Release administration

`master` (`0bd6e4f`) and tag `v0.6.0` are pushed to https://github.com/rompaul/Castle_Academy.git. The GitHub **Release page must be created manually** by the owner: `gh release create` returns 403 because the fine-grained PAT has no release write permission (same cause as v0.5.0 / v0.5.1). Use https://github.com/rompaul/Castle_Academy/releases/new with the full tag `v0.6.0` and copy the text from `docs/v0.6/V060_Release_Notes.md`.

## Next

V0.6.1 (Electrical Systems) is the second implementation step. Its G0 condition — confirmation of the V0.6 release object — is now satisfied (`v0.6.0` / `0bd6e4f`), but implementation remains frozen until the owner explicitly starts V061-001 (read-only baseline audit). `kp.electric.*` is reserved but unregistered; the schema v2 spike concluded that electrical missions fit without a schema change.
