import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

/**
 * Building tools plugin (V0.3).
 *
 * Provides higher-order block operations beyond single-block place/remove:
 * line placement and rectangle fill.
 *
 * Mutates WorldState only through its public `place`/`remove` interface and
 * notifies through the event bus. It does not depend on other plugins.
 *
 * Lifecycle: register() → initialize() → activate() → deactivate() → dispose().
 */
export class BuildingToolsPlugin {
  readonly id = "building-tools";
  readonly name = "Building Tools";
  readonly version = "0.3.0";

  private active = false;
  private tool: "place" | "line" | "fill" = "place";

  constructor(
    private readonly world: WorldState,
    private readonly events: EventBus
  ) {}

  register(): void {
    // No external dependencies to wire up.
  }

  initialize(): void {
    // Nothing async to prepare.
  }

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  dispose(): void {
    this.deactivate();
  }

  /* ---------- Tool selection ---------- */

  getTool(): "place" | "line" | "fill" {
    return this.tool;
  }

  setTool(tool: "place" | "line" | "fill"): void {
    this.tool = tool;
  }

  /* ---------- Line placement ---------- */

  /**
   * Place blocks along a straight 3D line between two grid positions (inclusive).
   * Returns the number of blocks placed.
   */
  placeLine(start: GridPosition, end: GridPosition, blockId: BlockId): number {
    if (!this.active) return 0;
    let placed = 0;
    for (const pos of linePositions(start, end)) {
      if (this.world.place(pos, blockId)) {
        placed++;
        this.events.emit("world.block.placed", { position: pos, blockId });
      }
    }
    if (placed > 0) {
      this.events.emit("world.building-tools.line-placed", {
        start,
        end,
        blockId,
        count: placed,
      });
    }
    return placed;
  }

  /* ---------- Rectangle fill ---------- */

  /**
   * Fill a solid axis-aligned box (inclusive on both corners) with a single block type.
   * Returns the number of blocks placed.
   */
  fillRectangle(min: GridPosition, max: GridPosition, blockId: BlockId): number {
    if (!this.active) return 0;
    const lo = cornerMin(min, max);
    const hi = cornerMax(min, max);
    let placed = 0;
    for (let x = lo.x; x <= hi.x; x++) {
      for (let y = lo.y; y <= hi.y; y++) {
        for (let z = lo.z; z <= hi.z; z++) {
          const pos: GridPosition = { x, y, z };
          if (this.world.place(pos, blockId)) {
            placed++;
            this.events.emit("world.block.placed", { position: pos, blockId });
          }
        }
      }
    }
    if (placed > 0) {
      this.events.emit("world.building-tools.rectangle-filled", {
        min: lo,
        max: hi,
        blockId,
        count: placed,
      });
    }
    return placed;
  }
}

/* ---------- Helpers ---------- */

function* linePositions(start: GridPosition, end: GridPosition): Generator<GridPosition> {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const dz = Math.abs(end.z - start.z);
  const steps = Math.max(dx, dy, dz);
  if (steps === 0) {
    yield start;
    return;
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    yield {
      x: Math.round(start.x + (end.x - start.x) * t),
      y: Math.round(start.y + (end.y - start.y) * t),
      z: Math.round(start.z + (end.z - start.z) * t),
    };
  }
}

function cornerMin(a: GridPosition, b: GridPosition): GridPosition {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    z: Math.min(a.z, b.z),
  };
}

function cornerMax(a: GridPosition, b: GridPosition): GridPosition {
  return {
    x: Math.max(a.x, b.x),
    y: Math.max(a.y, b.y),
    z: Math.max(a.z, b.z),
  };
}
