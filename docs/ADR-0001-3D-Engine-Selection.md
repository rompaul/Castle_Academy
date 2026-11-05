# ADR-0001: Initial 3D Engine Selection

**Status:** Provisional — validate on target hardware  
**Decision:** Three.js for the V0.1 first playable baseline

## Context
V0.1 needs a browser voxel scene, camera, movement, collision, block targeting, placement, and removal. The initial implementation should avoid unnecessary engine features and keep the world/domain model independent of rendering.

## Rationale
Three.js offers a focused rendering layer and direct control over meshes, materials, cameras, and raycasting. This fits the small V0.1 scope and allows Castle Academy to own its world model and interaction rules.

## Trade-off
Three.js does not provide a complete game-engine workflow out of the box. Player controls, collision, lifecycle, and interaction are implemented by this project. Babylon.js may offer more integrated game-oriented tooling.

## Required validation
On the target Windows laptop and at least one representative browser:
1. Install dependencies and build.
2. Run the world with the initial block count.
3. Place/remove blocks repeatedly.
4. Record average FPS and visible frame-time spikes.
5. Verify camera and collision feel.
6. Compare a small Babylon.js spike if performance, tooling, or collision implementation becomes a concern.

This is a provisional engineering choice, not a claim that Three.js has empirically outperformed Babylon.js in this project.
