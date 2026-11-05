import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

interface StoredBlock {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
}

export type { StoredBlock };

interface BlueprintEntry {
  name: string;
  createdAt: number;
  blocks: StoredBlock[];
}

/**
 * Blueprint plugin (V0.3).
 *
 * Saves a selected block region as a reusable template and places it elsewhere
 * in the world. Blueprint data contains only block coordinates and block IDs —
 * no personal data (CA-TECH-005:9-11).
 *
 * Mutates WorldState only through its public `place` interface and notifies
 * through the event bus. It does not depend on other plugins.
 *
 * Lifecycle: register() → initialize() → activate() → deactivate() → dispose().
 */
export class BlueprintPlugin {
  readonly id = "blueprint";
  readonly name = "Blueprint";
  readonly version = "0.3.0";

  private active = false;
  private readonly blueprints = new Map<string, BlueprintEntry>();

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
    this.blueprints.clear();
  }

  /* ---------- Blueprint CRUD ---------- */

  /** List all saved blueprint names. */
  listBlueprints(): string[] {
    return Array.from(this.blueprints.keys());
  }

  /** Check whether a blueprint with the given name exists. */
  hasBlueprint(name: string): boolean {
    return this.blueprints.has(name);
  }

  /**
   * Save the given blocks as a blueprint under `name`. Blocks are normalized
   * relative to their own min corner so placement is translation-invariant.
   * Returns false if a blueprint with the same name already exists.
   */
  saveBlueprint(name: string, blocks: ReadonlyArray<StoredBlock>): boolean {
    if (!this.active || this.blueprints.has(name)) return false;
    if (blocks.length === 0) return false;

    const base = regionMin(blocks);
    const normalized = blocks.map((b) => ({
      x: b.x - base.x,
      y: b.y - base.y,
      z: b.z - base.z,
      blockId: b.blockId,
    }));

    this.blueprints.set(name, {
      name,
      createdAt: Date.now(),
      blocks: normalized,
    });

    this.events.emit("world.blueprint.saved", {
      name,
      blockCount: normalized.length,
      timestamp: Date.now(),
    });
    return true;
  }

  /** Get a deep copy of the stored blocks for a blueprint, or undefined if not found. */
  loadBlueprint(name: string): ReadonlyArray<StoredBlock> | undefined {
    const entry = this.blueprints.get(name);
    if (!entry) return undefined;
    return entry.blocks.map((b) => ({ ...b }));
  }

  /** Delete a saved blueprint. Returns false if it did not exist. */
  deleteBlueprint(name: string): boolean {
    if (!this.blueprints.has(name)) return false;
    this.blueprints.delete(name);
    this.events.emit("world.blueprint.deleted", { name, timestamp: Date.now() });
    return true;
  }

  /* ---------- Placement ---------- */

  /**
   * Place a saved blueprint at `origin` (its min corner aligns with origin).
   * Blocks already present at a target position are not overwritten.
   * Returns the number of blocks placed, or 0 if the blueprint does not exist.
   */
  placeBlueprint(name: string, origin: GridPosition): number {
    if (!this.active) return 0;
    const blocks = this.loadBlueprint(name);
    if (!blocks) return 0;

    let placed = 0;
    for (const block of blocks) {
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
      this.events.emit("world.blueprint.placed", {
        name,
        origin,
        count: placed,
        timestamp: Date.now(),
      });
    }
    return placed;
  }

  /** Number of saved blueprints. */
  get blueprintCount(): number {
    return this.blueprints.size;
  }
}

/* ---------- Helpers ---------- */

function regionMin(blocks: ReadonlyArray<StoredBlock>): GridPosition {
  if (blocks.length === 0) return { x: 0, y: 0, z: 0 };
  let minX = blocks[0].x, minY = blocks[0].y, minZ = blocks[0].z;
  for (const b of blocks.slice(1)) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.z < minZ) minZ = b.z;
  }
  return { x: minX, y: minY, z: minZ };
}
