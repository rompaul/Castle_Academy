# Castle Academy — V0.5.1 · Mission Experience Foundation

A browser-based voxel building game for learners aged 6–15, built with React, TypeScript, Vite, and Three.js.
Build a castle, route water through moats and wells, and complete hands-on castle-themed missions.

Current release: **0.5.1** (`v0.5.1`). Earlier milestones: V0.4.2 procedural textures, V0.5 water engineering.

## What's in this version

- **Water engineering** — rule-verified simulation with sources, gravity-fed flow, drains and pipes. Water state is derived from sources and fully recomputed on reset; no water is stored in the world snapshot.
- **15 missions** — a pure-data Content Pack (`src/content/missions`) with 15 deterministic evaluators. Completion checks are pure functions: no randomness, clock, network, DOM, localStorage or `WorldSnapshot` access. Covers 4 age bands and 5 expression forms; the communication mission only checks text length, never judges content, and keeps the text in memory only.
- **Mission experience** — collapsible sidebar, detail panel with progressive hints, completion feedback with decorative titles, first-run onboarding, and a reward queue that shows multiple completions one at a time.
- **Learner profiles** — stored in their own localStorage key `castle.academy.learner` (multi-profile, switchable, tolerant of corrupted data). World saves use `castle-academy-world-v1` / `castle-academy-view-v1`; **the `WorldSnapshot` schema stays at version 1**.
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
| Release the mouse | `Esc` |

## Verify

```bash
npm install
npm run verify:source
npm run typecheck
npm test -- --no-file-parallelism
npm run build
npx playwright install chromium
npm run test:e2e -- --workers=1
```

`--no-file-parallelism` avoids Vitest worker failures in sandboxed environments; E2E must run with `--workers=1` and not in parallel with `build`.
Current baseline: **215 unit tests in 28 files, 47 E2E tests** — including the 20 V0.5 baseline E2E tests unchanged.

The browser E2E suite uses a development-only test bridge (`window.__CASTLE_TEST__`) to assert authoritative world-state changes. That bridge is not included in production builds.

## Architecture

- `src/core` — `WorldState` (single source of truth), `EventBus`, `WorldSnapshot` schema v1, block registry
- `src/plugins` — player-controller, building, building-tools, inventory, layers, measurement, persistence, water, learning, learner, mission, blueprint
- `src/content/missions` — pure-data `MissionDefinition` Content Pack and evaluator registry
- `src/rendering` — Three.js adapter, texture atlas, dev test bridge
- `src/ui` — React HUD, design tokens, mission experience overlay
- `src/app` — application shell and lifecycle

World state is authoritative; Three.js meshes are a visual projection. New gameplay domains go through plugins. Mission completion may only be decided by deterministic evaluators. Learner data and world data are deliberately never mixed.

## Documentation

Release evidence lives in `docs/v0.51/`:

- `V0.51_Acceptance_Report.md` — AC-201~232 results
- `V0.51_Performance_Report.md` — A/B measurement against the V0.5 baseline
- `V0.51_Final_Release_Review.md` — release record, known limitations, release notes
- `V0.51_Tester_Report_GATE2.md` — independent tester report (`FULLY SATISFIED`)
- `screenshots/canonical/` — S1~S8 core-experience screenshots and visual-regression evidence

## Known limitations

- Under software rendering (SwiftShader), the ~329 draw calls from stage blocks cause low frame rates. This is a V0.5-era issue, not a regression; hardware GPUs are unaffected. V0.6 candidate: `InstancedMesh` / `BatchedMesh` for static stage blocks.
- **Migration window:** the legacy `quest-panel`, `CastleQuestPlugin` and `quest.*` events are still present to keep the V0.5 baseline E2E suite green; they are scheduled for removal in V0.6.
- A ~9.7% topbar pixel difference in visual regression comes from an existing external web-font dependency (tracked as O-1); canonicals are kept unchanged pending a V0.6 design decision.
- Multiplayer, accounts, AI tutor, adaptive recommendation and full mobile layout remain out of scope.
