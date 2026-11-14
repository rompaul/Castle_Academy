# Castle Academy — V0.6.1 · Electrical Systems

A browser-based voxel building game for learners aged 6–15, built with React, TypeScript, Vite, and Three.js.
Build a castle, route water through moats and wells, and complete hands-on castle-themed missions.

**Current release: `0.6.1` (tag `v0.6.1`), released 2026-11-14.** Use the full tag name `v0.6.1` when creating the GitHub Release page. Previous release: `0.6.0` (`v0.6.0`, Knowledge & Mission Foundation). Earlier milestones: V0.5.1 mission experience, V0.4.2 procedural textures, V0.5 water engineering.

V0.6.1 is a **functional increment**: nine electrical / water-link blocks, a deterministic six-neighbour binary electrical rule with derived powered states, three schema-v2 electrical missions consuming V0.6 knowledge points, three-level hints and child-safety copy, and an MC-style nine-slot quick bar with a category palette (`DDR-0002` declares the intentional HUD change). `WorldSnapshot v1` is unchanged; the clean-world 3D canvas is pixel-identical to V0.6. Full notes: `docs/v0.6.1/V061_Release_Notes.md`.

## What's new in V0.6.1

- **Nine new blocks** — power source, wire, switch (open / closed), lamp, signal beacon, water pump, water valve (open / closed). IDs are appended only; the existing 25 block IDs and their order are unchanged, and the atlas uses 49/64 tiles with the same three shared materials.
- **Electrical rules** — six orthogonal neighbours, binary connection, multi-source conflicts, open-switch diagnostics. Powered state is **derived**, never written into the world save; wire lighting is a rendering overlay, not a second baked texture.
- **A switch that behaves like a real light switch** — look at a switch or valve and press `F` to toggle it; left / right mouse buttons still place / remove blocks. Learning evidence requires a *paired* observation at the **same position**: closed (lamp on) plus open (lamp off).
- **Water–electric link** — a powered pump becomes a virtual water source through a narrow port; water propagation remains owned exclusively by the water plugin.
- **Learning content** — 3 schema-v2 electrical missions (15 → 18), 5 new `kp.electric.*` knowledge points (19 → 24), 3 deterministic evaluators, 3-level hint ladders, and C1/C2 single-system sub-paths for ages 6–7.
- **Child safety** — one consistent "电" vocabulary, no recognisable third-party terminology and no real wiring steps; a first-visit guide, a permanent help-panel notice and a parent / teacher note.
- **MC-style block bar (DDR-0002)** — 9 quick slots plus an "All blocks" category palette (7 groups; the 9 electrical blocks follow the E1 four-group layout). `E` opens the palette, `1`–`9` / mouse wheel switch slots, clicking a block assigns it to the current slot. The default 9 slots are still the original first 9 blocks.

## What's new in V0.6 (previous release)

V0.6 is a **knowledge and mission foundation** release: it adds a knowledge-point registry, a versioned content schema, prerequisite mission chains, deterministic mastery evidence, and a v2 learner profile. It deliberately adds **no new blocks and no rendering changes** — the world canvas is pixel-identical to V0.5.1 and draw calls stay at 329.

- **Knowledge point registry** — `src/content/knowledge/registry.ts` registered 19 knowledge points under a frozen `kp.<domain>.<concept>(.<aspect>)` namespace (3–4 segments, validated by `validateKnowledgePoint()`). At V0.6 release time the `kp.electric.*` prefix was reserved but **not registered**; V0.6.1 has since registered 5 of them (24 total).
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
- **Missions** — a pure-data Content Pack (`src/content/missions`) with 18 deterministic evaluators (15 at V0.5.1 / V0.6, +3 electrical in V0.6.1). Completion checks are pure functions: no randomness, clock, network, DOM, localStorage or `WorldSnapshot` access. Covers 4 age bands and 5 expression forms; the communication mission only checks text length, never judges content, and keeps the text in memory only.
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

`npm run verify:source` currently exits 1 due to a pre-existing V0.5-era defect (see Known limitations); it is not part of the release gate. The legacy full-mode `v051-visual-regression.mjs` **re-captures canonical screenshots** — use `--clean-only`, or back up and restore the canonical directory with git. V0.6.1 uses the separate, non-destructive `scripts/v061-visual-regression.mjs`, which compares against the V0.6 canonical and only writes into `docs/v0.6.1/screenshots/canonical/`.

**Current baseline: 339 unit tests (42 files) and 47 E2E tests**, including the 20 V0.5 baseline E2E tests unchanged byte-for-byte.

The browser E2E suite uses a development-only test bridge (`window.__CASTLE_TEST__`) to assert authoritative world-state changes. That bridge is not included in production builds.

## Release verification (V0.6.1)

| Check | Result |
|---|---|
| typecheck / build / `git diff --check` | exit 0 / exit 0 / 0 |
| Unit tests | 339/339 |
| E2E | 47/47 (`--workers=2`; V0.5 baseline 20 unchanged) |
| Clean-world 3D visual regression | `worldCanvas` **0 px diff** against the V0.6 canonical |
| HUD | full-screen diff 7.623%, **99.84% in the hotbar band**, `worldUpper = 0`; attributed to the intentional `DDR-0002` whitelist |
| Electrical scene | frozen separately as V0.6.1 canonical; `powered`, 338 draw calls |
| D-2 ABBA performance | clean 329 dc / 45.52 ms vs powered 338 dc / 45.98 ms (**+1.01%**, within noise) |
| Data safety | 3 existing localStorage keys, zero new keys, zero learner fields in world saves, no AI/LLM calls |

Earlier V0.6 verification (V06-022~024) recorded 256 unit tests, 47 E2E, `worldCanvas` 0 px, 329 → 329 draw calls; see `docs/v0.6/`.

## Architecture

- `src/core` — `WorldState` (single source of truth), `EventBus`, `WorldSnapshot` schema v1, block registry, block categories
- `src/plugins` — player-controller, building, building-tools, inventory, layers, measurement, persistence, water, electrical, learning, learner, mission, blueprint
- `src/content/missions` — pure-data `MissionDefinition` Content Pack (schema v2, 18 missions) and evaluator registry
- `src/content/knowledge` — knowledge point registry (24 IDs), `resolveMissionGraph()` / `isMissionUnlocked()` pure functions
- `src/rendering` — Three.js adapter, texture atlas, derived electrical overlay, dev test bridge
- `src/ui` — React HUD, design tokens, mission experience overlay, evidence record panel, block palette
- `src/app` — application shell and lifecycle

World state is authoritative; Three.js meshes are a visual projection. New gameplay domains go through plugins. Mission completion may only be decided by deterministic evaluators. Learner data and world data are deliberately never mixed.

## Documentation

V0.6.1 evidence lives in `docs/v0.6.1/` and in the execution package at the workspace root:

- `docs/v0.6.1/V061_Release_Notes.md` — full release notes, intentional design changes, known limitations and upgrade notes
- `docs/v0.6.1/V061_GATE3_Review_Pack.md` — one-page GATE-3 review material with the full acceptance number table
- `docs/v0.6.1/V061_PHASE4_VERIFICATION_REPORT.md`, `V061_Performance_Paired.json`, `V061_Safety_Spotcheck.json` — verification evidence
- `docs/v0.6.1/screenshots/gate2/` (10 shots) and `screenshots/canonical/` (V0.6.1 frozen set)
- `docs/v0.6.1/V061_V07_Handoff.md` — V0.7 handoff checklist
- `../Castle_Academy_V0.6.1_Execution_Package/01_Execution/V061_Progress_Log.md` — task-by-task evidence and gate sign-offs

V0.6 evidence lives in `docs/v0.6/` (`V060_Release_Notes.md`, `audit/`, `screenshots/gate2/`, `screenshots/canonical/`) and `../Castle_Academy_V0.6_Execution_Package/`. The V0.6 clean-world anchors are the zero-tolerance 3D baseline for V0.6.1 as well.

Historical evidence remains in `docs/v0.51/` (`V0.51_Acceptance_Report.md`, `V0.51_Performance_Report.md`, `V0.51_Final_Release_Review.md`, `V0.51_Tester_Report_GATE2.md`, `screenshots/canonical/`).

## V0.6.1 — parent / teacher note

> **本产品为虚构二值规则模型，不含真实电气知识，也不含任何可迁移到现实的操作步骤。建议成人陪同低龄儿童使用。**

The electrical content in V0.6.1 is a fictional two-state (connected / not connected) game rule. Child-facing copy uses one consistent vocabulary — 电源 / 电线 / 开关 / 灯 / 信标 / 水泵 / 阀门 — and contains **no real wiring steps, no electrical values, and no real-world socket or household-wiring imagery**. A first-visit guide and a permanent help-panel notice state plainly that real electricity is dangerous. Full wording, the banned-word list and the acceptance mapping are in [`docs/v0.6.1/V061_Parent_Teacher_Note.md`](docs/v0.6.1/V061_Parent_Teacher_Note.md).

## Known limitations

- **DEV-601 (pre-existing, not fixed):** `npm run verify:source` exits 1 because `scripts/v05-quest-screenshots.mjs:5` imports an undeclared `playwright` package. The script is not referenced by any npm script or config. Registered as read-only evidence, deliberately not fixed to keep the release scope clean.
- **O-1 (pre-existing):** an external web-font dependency produces ~10.2% topbar / 2.8% footer noise in visual regression, identical in nature to V0.5.1. The `worldCanvas` region is 0 px diff and canonicals are kept unchanged pending a separate design decision.
- **DDR-0002 HUD whitelist:** the `AC-6750` "HUD ≤0.5%" criterion is superseded by an approved whitelist for the intentional help-panel and hotbar changes; the 3D world 0 px criterion was **not** relaxed.
- **Performance judgement (D-2):** use same-machine, same-script ABBA paired comparison. Absolute frame-time thresholds are invalid here — two runs on the same machine differed by ~30× in p95.
- **E2E flakiness:** occasional `load` timeouts (e.g. AC-221) come from dev-server cold compilation / software-rendering starvation, not product code; re-runs with `--workers=2` pass. See the port-5173 note above.
- **Knowledge point count:** the approved mapping table said "21 IDs" but de-duplicates to 19 unique IDs (shared IDs were counted per mission). All 19 approved IDs are registered; none were invented to reach 21. V0.6.1 adds 5 electrical IDs for 24 total.
- **ID regex:** ADR-0008 suggested a fixed 4-segment regex, which would reject 16 of the approved 3-segment IDs (e.g. `kp.system.continuous_path`). Per the ADR's "freeze the regex at implementation" clause it is frozen at 3–4 segments with underscores/hyphens allowed inside a segment; approved ID wording is unchanged.
- **Migration window:** legacy `quest-panel`, `CastleQuestPlugin` and `quest.*` events are still present to keep the V0.5 baseline E2E suite green. Removal has been deferred again to **after V0.6.1** (now a V0.7 item).
- **Software rendering:** under SwiftShader, the ~329 draw calls from stage blocks cause low frame rates. This is a V0.5-era issue, not a regression; hardware GPUs are unaffected. A candidate optimisation (`InstancedMesh` / `BatchedMesh` for static stage blocks) is deferred to a later version.
- **Out of scope:** multiplayer, accounts, AI tutor, adaptive recommendation, rankings/levels/percentages in the child-facing UI, and full mobile layout.

## Release administration

Tag `v0.6.1` is pushed to https://github.com/rompaul/Castle_Academy.git; `master` may carry later documentation-only commits. The GitHub **Release page must be created manually** by the owner: `gh release create` returns 403 because the fine-grained PAT has no release write permission (same cause as v0.5.0 / v0.5.1 / v0.6.0). Use https://github.com/rompaul/Castle_Academy/releases/new with the full tag `v0.6.1` and copy the text from `docs/v0.6.1/V061_Release_Notes.md`.

## Next

V0.7 (Interactive Learning Missions) starts from the handoff checklist `docs/v0.6.1/V061_V07_Handoff.md`: the V0.6 canonical remains the zero-tolerance 3D anchor, the legacy `quest.*` migration window is still open, O-1 font noise and AC-122 software-rendering frame rate stay documented, and engineering simulation belongs to the V0.7 Experiment direction (Q-6). GATE-1/2/3 evidence and known limitations: `docs/v0.6.1/V061_GATE3_Review_Pack.md`.
