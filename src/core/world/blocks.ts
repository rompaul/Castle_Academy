export const BLOCKS = [
  { id: "grass", name: "Grass", color: 0x6d9c54, swatch: "#6d9c54" },
  { id: "dirt", name: "Dirt", color: 0x8b6346, swatch: "#8b6346" },
  { id: "stone", name: "Stone", color: 0x858b89, swatch: "#858b89" },
  { id: "wood", name: "Wood", color: 0x9b7047, swatch: "#9b7047" },
  { id: "sand", name: "Sand", color: 0xd8c58a, swatch: "#d8c58a" },
  { id: "brick", name: "Brick", color: 0xa65e4e, swatch: "#a65e4e" },
  { id: "glass", name: "Glass", color: 0x8fc8c5, swatch: "#8fc8c5" }
] as const;

export type BlockId = typeof BLOCKS[number]["id"];
export type BlockDefinition = typeof BLOCKS[number];

export function getBlockDefinition(id: BlockId): BlockDefinition {
  const block = BLOCKS.find((candidate) => candidate.id === id);
  if (!block) throw new Error(`Unknown block id: ${id}`);
  return block;
}
