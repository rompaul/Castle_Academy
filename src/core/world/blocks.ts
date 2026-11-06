export const BLOCKS = [
  { id: "grass", name: "Grass", color: 0x6d9c54, swatch: "#6d9c54" },
  { id: "dirt", name: "Dirt", color: 0x8b6346, swatch: "#8b6346" },
  { id: "stone", name: "Stone", color: 0x858b89, swatch: "#858b89" },
  { id: "wood", name: "Wood", color: 0x9b7047, swatch: "#9b7047" },
  { id: "sand", name: "Sand", color: 0xd8c58a, swatch: "#d8c58a" },
  { id: "brick", name: "Brick", color: 0xa65e4e, swatch: "#a65e4e" },
  { id: "glass", name: "Glass", color: 0x8fc8c5, swatch: "#8fc8c5" },
  // V0.4.2 新增块（按 Block Catalog v1.0 映射）
  { id: "sandstone_warm", name: "Warm Sandstone", color: 0xd4c49e, swatch: "#d4c49e" },
  { id: "rock_moss", name: "Moss Rock", color: 0x6b8e23, swatch: "#6b8e23" },
  { id: "gravel", name: "Gravel", color: 0xa9a9a9, swatch: "#a9a9a9" },
  { id: "wood_walnut", name: "Walnut Timber", color: 0x70452e, swatch: "#70452e" },
  { id: "brick_limestone", name: "Limestone Brick", color: 0xd9c79e, swatch: "#d9c79e" },
  { id: "tile_slate", name: "Slate Tile", color: 0x454d5b, swatch: "#454d5b" },
  { id: "foundation_concrete", name: "Foundation Concrete", color: 0xc0c0c0, swatch: "#c0c0c0" },
  { id: "footing_carved", name: "Carved Footing", color: 0x80502e, swatch: "#80502e" },
  { id: "wall_plaster", name: "Plaster Wall", color: 0xe8e8d8, swatch: "#e8e8d8" },
  { id: "wall_timber_frame", name: "Timber Frame Wall", color: 0xb77a3e, swatch: "#b77a3e" },
  { id: "tunnel_lining", name: "Tunnel Lining", color: 0x454d5b, swatch: "#454d5b" },
  { id: "pillar_corner", name: "Stone Pillar", color: 0x85878a, swatch: "#85878a" },
  { id: "arch_keystone", name: "Arch Keystone", color: 0x85878a, swatch: "#85878a" },
  { id: "stair_stone", name: "Stone Stair", color: 0x85878a, swatch: "#85878a" },
  { id: "window_frame", name: "Timber Window Frame", color: 0xb77a3e, swatch: "#b77a3e" },
] as const;

export type BlockId = typeof BLOCKS[number]["id"];
export type BlockDefinition = typeof BLOCKS[number];

export function getBlockDefinition(id: BlockId): BlockDefinition {
  const block = BLOCKS.find((candidate) => candidate.id === id);
  if (!block) throw new Error(`Unknown block id: ${id}`);
  return block;
}
