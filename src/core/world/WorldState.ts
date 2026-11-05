import { BLOCKS, type BlockId } from "./blocks";
import { isInsideBuildArea, positionKey, type GridPosition } from "./coordinates";

export interface BlockRecord {
  position: GridPosition;
  blockId: BlockId;
}

export interface WorldSnapshot {
  version: number;
  blocks: Array<{ x: number; y: number; z: number; blockId: BlockId }>;
}

const SNAPSHOT_VERSION = 1;

const VALID_BLOCK_IDS = new Set<string>(BLOCKS.map((block) => block.id));

export class WorldState {
  private readonly blocks = new Map<string, BlockRecord>();

  get(position: GridPosition): BlockRecord | undefined {
    if (!isInsideBuildArea(position)) return undefined;
    return this.blocks.get(positionKey(position));
  }

  has(position: GridPosition): boolean {
    return this.get(position) !== undefined;
  }

  place(position: GridPosition, blockId: BlockId): boolean {
    if (!isInsideBuildArea(position) || !VALID_BLOCK_IDS.has(blockId) || this.has(position)) return false;
    this.blocks.set(positionKey(position), { position: { ...position }, blockId });
    return true;
  }

  remove(position: GridPosition): boolean {
    if (!isInsideBuildArea(position)) return false;
    return this.blocks.delete(positionKey(position));
  }

  all(): BlockRecord[] {
    return [...this.blocks.values()].map((record) => ({
      position: { ...record.position },
      blockId: record.blockId
    }));
  }

  clear(): void {
    this.blocks.clear();
  }

  get size(): number {
    return this.blocks.size;
  }

  serialize(): WorldSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      blocks: this.all().map((record) => ({
        x: record.position.x,
        y: record.position.y,
        z: record.position.z,
        blockId: record.blockId
      }))
    };
  }

  load(snapshot: WorldSnapshot): boolean {
    if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.blocks)) {
      return false;
    }
    this.clear();
    for (const block of snapshot.blocks) {
      const position: GridPosition = { x: block.x, y: block.y, z: block.z };
      if (!isInsideBuildArea(position) || !VALID_BLOCK_IDS.has(block.blockId)) {
        return false;
      }
      this.blocks.set(positionKey(position), { position: { ...position }, blockId: block.blockId });
    }
    return true;
  }
}
