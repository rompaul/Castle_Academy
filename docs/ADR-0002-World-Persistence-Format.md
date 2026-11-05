# ADR-0002: World Persistence Format and Storage

**Status:** Proposed  
**Date:** 2026-11-05  
**Decision owner:** Product/Engineering owner  
**Related documents/issues:** CA-TECH-003 Data and Event Contracts (Persistence boundary), V0.1 Product Master Plan (V0.2 = Building experience and persistence)

## Context

Castle Academy V0.2 introduces world persistence: the placed blocks must survive page refresh and browser restart so a child's creation is not lost session-to-session. The V0.1 world state lives only in memory (`WorldState`, `CA-TECH-003`); persistent save/load is explicitly V0.2 scope (`CA-TECH-003:66-67`).

A decision is needed on where and in what format the world snapshot is persisted, and how the persistence concern is integrated without violating the plugin-first architecture (`CA-TECH-001`).

## Decision drivers

- Browser-only, no accounts, no network, no backend (V0.1/V0.2 principles, `CA-TECH-005`).
- No personal data or secrets in save files (`CA-TECH-005:9-11`, `CA-TECH-003:59-62`).
- World data must stay separate from render objects; rendering objects are derived, not source of truth (`CA-TECH-003:30-31`).
- Persistence must not be embedded in the Three.js renderer or UI (`CA-TECH-001`: functional plugins, separate rendering/state/domain).
- Snapshot must be versioned to tolerate future schema changes (`CA-TECH-003:60`).

## Options considered

1. **Browser `localStorage`, JSON snapshot, owned by a `PersistencePlugin`.**
2. **IndexedDB, JSON snapshot.**
3. **Backend HTTP persistence** (deferred; not V0.2 scope, requires security review).

## Decision

**Option 1:** Browser `localStorage` with a JSON world snapshot, owned by a new `PersistencePlugin` (`src/plugins/persistence/PersistencePlugin.ts`).

Snapshot format (`WorldSnapshot`, `src/core/world/WorldState.ts`):
```ts
interface WorldSnapshot {
  version: number;   // snapshot schema version, currently 1
  blocks: Array<{ x: number; y: number; z: number; blockId: BlockId }>;
}
```

Storage key: `castle-academy-world-v1`.

The plugin mutates `WorldState` only via its public `serialize()` / `load()` interface, emits `world.saved` / `world.loaded` domain events (`CA-TECH-003` event envelope), and exposes `hasSavedWorld()`, `saveWorld()`, `loadWorld()`, `setReloadHandler()`. The shell (`App`) wires the reload handler so `ThreeWorldRenderer.reloadFromWorld()` rebuilds meshes after load. The renderer itself owns no persistence logic.

## Rationale

- `localStorage` is synchronous, available in all target desktop browsers, and requires no backend or credentials—consistent with the local prototype stance (`CA-TECH-005:6-7`).
- JSON snapshot contains only block coordinates and block IDs—no personal data, no secrets (`CA-TECH-005:10-11`).
- A dedicated plugin keeps persistence separated from rendering and core domain, satisfying `CA-TECH-001` plugin boundaries and `CA-TECH-003` data ownership.
- Versioned snapshot permits safe schema evolution as V0.3+ adds blueprints/tools.

## Consequences

### Positive
- Worlds survive refresh and browser restart with zero backend.
- Small, testable persistence surface (unit-tested with an in-memory store).
- No new dependencies; no bundle impact beyond one plugin module.

### Negative / trade-offs
- `localStorage` is origin-scoped and can be cleared by the user/browser; no cross-device sync (acceptable for V0.2, explicit future work).
- Snapshot size grows with block count; fine for the fixed 32×32 build area, to be re-evaluated for open-world generation.
- `localStorage` is blocked in some private/incognito modes; save failure is surfaced via `onMessage` toast.

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| Corrupted or future-version snapshot | `load()` validates `snapshot.version === 1` and block validity; on failure returns `false` without mutating world (unit-tested). |
| `localStorage` quota exceeded | Fixed build area caps block count; errors caught and surfaced via toast. |
| Save button pressed without pointer lock | UI allows save/load at any time; load triggers renderer reload. |

## Follow-up actions
- [ ] Product/engineering owner sign-off on snapshot format and storage key.
- [ ] Record E2E test evidence for save → refresh → load round-trip (CA-QA-001).
- [ ] Re-evaluate storage choice if V0.3+ open-world generation expands block count beyond the fixed build area.
