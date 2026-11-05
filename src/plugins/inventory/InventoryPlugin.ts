import { BLOCKS, type BlockId } from "../../core/world/blocks";

export class InventoryPlugin {
  private selected: BlockId = "grass";

  get selectedBlock(): BlockId {
    return this.selected;
  }

  select(blockId: BlockId): void {
    if (!BLOCKS.some((block) => block.id === blockId)) {
      throw new Error(`Unknown block: ${blockId}`);
    }
    this.selected = blockId;
  }
}
