import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

export class BuildingPlugin {
  constructor(
    private readonly world: WorldState,
    private readonly events: EventBus
  ) {}

  place(position: GridPosition, blockId: BlockId): boolean {
    const placed = this.world.place(position, blockId);
    if (placed) this.events.emit("world.block.placed", { position, blockId });
    return placed;
  }

  remove(position: GridPosition): boolean {
    const removed = this.world.remove(position);
    if (removed) this.events.emit("world.block.removed", { position });
    return removed;
  }
}
