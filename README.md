# Castle Academy — V0.1 First Playable

A browser-based voxel building prototype built with React, TypeScript, Vite, and Three.js.

## Requirements

- Node.js 20 LTS or newer
- npm 10 or newer
- A desktop browser with WebGL support (Chrome or Edge recommended)

## Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Controls

| Action | Control |
|---|---|
| Enter / leave play mode | Click **Enter World** / press Esc to release mouse |
| Move | W A S D |
| Move vertically | Space / Shift |
| Look | Mouse |
| Place selected block | Left mouse button |
| Remove block | Right mouse button |
| Select hotbar slot | 1–7 or click a slot |
| Reset world | Reset button |

Enter World requests pointer lock directly from the button click. If the browser blocks it, click the 3D world to retry; press Esc to release the pointer.

## Verify

```bash
npm run verify:source
npm run typecheck
npm run test
npm run build
```

Optional browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

## Architecture

- `src/core`: domain model, world state, events, public interfaces
- `src/plugins`: player controller, building, inventory
- `src/rendering`: Three.js adapter and scene renderer
- `src/ui`: React HUD and controls
- `src/app`: application shell and lifecycle
- `src/assets`: block material definitions

The world state is authoritative; Three.js meshes are a visual projection. The initial build area is finite. World persistence, multiplayer, AI, fluid/electrical simulation, and curriculum systems are intentionally out of scope.

## Current implementation notes

- Engine: Three.js, selected as the initial V0.1 implementation baseline for direct control over voxel geometry and a small browser bundle. The engine decision remains subject to the documented prototype/performance review on the target device.
- World rendering: per-block meshes with shared geometries/materials for this small V0.1 world. This is intentionally simple; chunk/greedy meshing is a future optimization triggered by measured performance.
- Player: first-person creative-flight controller with a horizontal circle / vertical body collision approximation against placed voxels. It is not a full physics engine; vertical flight remains available, but the player cannot pass through solid blocks.
- Save/load: not included in V0.1.


## Automated checks

```bash
npm install
npm run verify:source
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser E2E suite uses a development-only test bridge (`window.__CASTLE_TEST__`) to assert authoritative world-state changes. That bridge is not included in production builds.
