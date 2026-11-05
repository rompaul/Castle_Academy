import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

interface StoreBlock {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
}

/**
 * Building tools plugin (V0.3).
 *
 * Provides higher-order block operations beyond single-block place/remove:
 * line placement, rectangle fill, region copy, and region paste.
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
  private tool: "place" | "line" | "fill" | "copy" | "paste" = "place";
  private clipboard: StoreBlock[] = [];

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
    this.clipboard = [];
  }

  /* ---------- Tool selection ---------- */

  getTool(): "place" | "line" | "fill" | "copy" | "paste" {
    return this.tool;
  }

  setTool(tool: "place" | "line" | "fill" | "copy" | "paste"): void {
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

  /* ---------- Region copy ---------- */

  /**
   * Snapshot all blocks inside an axis-aligned box (inclusive) into the clipboard.
   * Returns the number of blocks copied.
   */
  copyRegion(min: GridPosition, max: GridPosition): number {
    if (!this.active) return 0;
    const lo = cornerMin(min, max);
    const hi = cornerMax(min, max);
    const copied: StoreBlock[] = [];
    for (let x = lo.x; x <= hi.x; x++) {
      for (let y = lo.y; y <= hi.y; y++) {
        for (let z = lo.z; z <= hi.z; z++) {
          const pos: GridPosition = { x, y, z };
          const record = this.world.get(pos);
          if (record) {
            copied.push({ x: record.position.x, y: record.position.y, z: record.position.z, blockId: record.blockId });
          }
        }
      }
    }
    // Normalize clipboard to be relative to its own min corner so pasting is translation-invariant.
    const base = regionMin(copied);
    this.clipboard = copied.map((b) => ({
      x: b.x - base.x,
      y: b.y - base.y,
      z: b.z - base.z,
      blockId: b.blockId,
    }));
    this.events.emit("world.building-tools.region-copied", {
      min: lo,
      max: hi,
      count: this.clipboard.length,
    });
    return this.clipboard.length;
  }

  /** Blocks currently on the clipboard (relative coordinates). */
  getClipboard(): ReadonlyArray<StoreBlock> {
    return this.clipboard;
  }

  /** Clear the clipboard. */
  clearClipboard(): void {
    this.clipboard = [];
    this.events.emit("world.building-tools.clipboard-cleared", {});
  }

  /* ---------- Region paste ---------- */

  /**
   * Paste the clipboard at `origin` (the clipboard's min corner aligns with origin).
   * Blocks already present at a target position are not overwritten.
   * Returns the number of blocks pasted.
   */
  pasteRegion(origin: GridPosition): number {
    if (!this.active || this.clipboard.length === 0) return 0;
    let placed = 0;
    for (const block of this.clipboard) {
      const pos: GridPosition = {
        x: origin.x + block.x,
        y: origin.y + block.y,
        z: origin.z + block.z,
      };
      if (this.world.place(pos, block.blockId)) {
        placed++;
        this.events.emit("world.block.placed", { position: pos, blockId: block.blockId });
      }
    }
    if (placed > 0) {
      this.events.emit("world.building-tools.region-pasted", {
        origin,
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

function regionMin(blocks: StoreBlock[]): GridPosition {
  if (blocks.length === 0) return { x: 0, y: 0, z: 0 };
  let minX = blocks[0].x, minY = blocks[0].y, minZ = blocks[0].z;
  for (const b of blocks.slice(1)) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.z < minZ) minZ = b.z;
  }
  return { x: minX, y: minY, z: minZ };
}
