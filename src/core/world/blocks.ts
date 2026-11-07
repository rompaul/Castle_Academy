/** 方块几何形状类型 */
export type BlockModelType = "cube" | "slab" | "stair" | "pillar" | "arch" | "frame";

/** 方块几何模型元数据：形状与朝向 */
export interface BlockModel {
  type: BlockModelType;
  orientation: "fixed" | "rotatable";
}

/** 方块材质/纹理引用：顶面/侧面/底面纹理路径与体素密度 */
export interface BlockMaterial {
  top?: string;        // 纹理资产键或路径
  side?: string;       // 纹理资产键或路径
  bottom?: string;     // 纹理资产键或路径
  texelSize?: 16 | 32; // 体素纹理密度，V0.4.2 原型阶段统一 16
  transparent?: boolean;
  opacity?: number;
}

/** 方块行为元数据：碰撞、选中、放置策略 */
export interface BlockBehavior {
  collidable: boolean;
  selectable: boolean;
  placeable: boolean;
}

/** 方块定义：稳定逻辑身份 + 视觉/行为引用。
 * WorldState 仅存储 {position, blockId}，不存储纹理数据；
 * 视觉/行为信息通过本注册表按 blockId 查询。
 */

/** 玻璃材质：透明 */
const GLASS_MATERIAL: BlockMaterial = {
  top: "glass_top",
  side: "glass_side",
  bottom: "glass_bottom",
  texelSize: 16,
  transparent: true,
  opacity: 0.48,
};

/** 玻璃行为：可碰撞、可选中、可放置 */
const GLASS_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 楼梯行为：可碰撞、可选中、可放置，特殊碰撞形状 */
const STAIR_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 架子/窗框行为：可碰撞、可选中、可放置，非立方体 */
const FRAME_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 柱子行为：可碰撞、可选中、可放置，非立方体 */
const PILLAR_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 拱门行为：可碰撞、可选中、可放置，非立方体 */
const ARCH_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 默认方块模型：立方体，固定朝向 */
const CUBE_MODEL: BlockModel = { type: "cube", orientation: "fixed" };

/** 默认方块行为：可碰撞、可选中、可放置 */
const DEFAULT_BEHAVIOR: BlockBehavior = {
  collidable: true,
  selectable: true,
  placeable: true,
};

/** 资产清单条目：构建时从稳定资产键到模型/材质/行为的映射 */
export interface AssetManifestEntry {
  id: string;
  model: BlockModel;
  material: BlockMaterial;
  behavior: BlockBehavior;
}

/** 资产清单：构建时从稳定资产键到文件、尺寸、哈希、版本的映射。
 * V0.4.2 阶段作为类型定义预留，实际资产文件由 Phase 2 生产后接入。
 */
export interface AssetManifest {
  schemaVersion: number;
  entries: Record<string, AssetManifestEntry>;
}

export const BLOCKS = [
  // V0.3 原有 7 个块（向后兼容，cube 模型）
  { id: "grass", name: "Grass", color: 0x6d9c54, swatch: "#6d9c54",
    model: CUBE_MODEL,
    material: { top: "grass_top", side: "grass_side", bottom: "dirt_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "dirt", name: "Dirt", color: 0x8b6346, swatch: "#8b6346",
    model: CUBE_MODEL,
    material: { top: "dirt_top", side: "dirt_side", bottom: "dirt_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "stone", name: "Stone", color: 0x858b89, swatch: "#858b89",
    model: CUBE_MODEL,
    material: { top: "stone_top", side: "stone_side", bottom: "stone_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "wood", name: "Wood", color: 0x9b7047, swatch: "#9b7047",
    model: CUBE_MODEL,
    material: { top: "wood_top", side: "wood_side", bottom: "wood_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "sand", name: "Sand", color: 0xd8c58a, swatch: "#d8c58a",
    model: CUBE_MODEL,
    material: { top: "sand_top", side: "sand_side", bottom: "sand_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "brick", name: "Brick", color: 0xa65e4e, swatch: "#a65e4e",
    model: CUBE_MODEL,
    material: { top: "brick_top", side: "brick_side", bottom: "brick_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "glass", name: "Glass", color: 0x8fc8c5, swatch: "#8fc8c5",
    model: CUBE_MODEL,
    material: GLASS_MATERIAL,
    behavior: GLASS_BEHAVIOR },

  // V0.4.2 新增块（按 Block Catalog v1.0 映射）
  { id: "sandstone_warm", name: "Warm Sandstone", color: 0xd4c49e, swatch: "#d4c49e",
    model: CUBE_MODEL,
    material: { top: "sandstone_warm_top", side: "sandstone_warm_side", bottom: "sandstone_warm_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "rock_moss", name: "Moss Rock", color: 0x6b8e23, swatch: "#6b8e23",
    model: CUBE_MODEL,
    material: { top: "rock_moss_top", side: "rock_moss_side", bottom: "rock_moss_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "gravel", name: "Gravel", color: 0xa9a9a9, swatch: "#a9a9a9",
    model: CUBE_MODEL,
    material: { top: "gravel_top", side: "gravel_side", bottom: "gravel_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "wood_walnut", name: "Walnut Timber", color: 0x70452e, swatch: "#70452e",
    model: CUBE_MODEL,
    material: { top: "wood_walnut_top", side: "wood_walnut_side", bottom: "wood_walnut_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "brick_limestone", name: "Limestone Brick", color: 0xd9c79e, swatch: "#d9c79e",
    model: CUBE_MODEL,
    material: { top: "brick_limestone_top", side: "brick_limestone_side", bottom: "brick_limestone_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "tile_slate", name: "Slate Tile", color: 0x454d5b, swatch: "#454d5b",
    model: CUBE_MODEL,
    material: { top: "tile_slate_top", side: "tile_slate_side", bottom: "tile_slate_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "foundation_concrete", name: "Foundation Concrete", color: 0xc0c0c0, swatch: "#c0c0c0",
    model: CUBE_MODEL,
    material: { top: "foundation_concrete_top", side: "foundation_concrete_side", bottom: "foundation_concrete_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "footing_carved", name: "Carved Footing", color: 0x80502e, swatch: "#80502e",
    model: { type: "pillar", orientation: "fixed" },
    material: { top: "footing_carved_top", side: "footing_carved_side", bottom: "footing_carved_bottom", texelSize: 16 },
    behavior: PILLAR_BEHAVIOR },
  { id: "wall_plaster", name: "Plaster Wall", color: 0xe8e8d8, swatch: "#e8e8d8",
    model: CUBE_MODEL,
    material: { top: "wall_plaster_top", side: "wall_plaster_side", bottom: "wall_plaster_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "wall_timber_frame", name: "Timber Frame Wall", color: 0xb77a3e, swatch: "#b77a3e",
    model: { type: "frame", orientation: "fixed" },
    material: { top: "wall_timber_frame_top", side: "wall_timber_frame_side", bottom: "wall_timber_frame_bottom", texelSize: 16 },
    behavior: FRAME_BEHAVIOR },
  { id: "tunnel_lining", name: "Tunnel Lining", color: 0x454d5b, swatch: "#454d5b",
    model: CUBE_MODEL,
    material: { top: "tunnel_lining_top", side: "tunnel_lining_side", bottom: "tunnel_lining_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "pillar_corner", name: "Stone Pillar", color: 0x85878a, swatch: "#85878a",
    model: { type: "pillar", orientation: "fixed" },
    material: { top: "pillar_corner_top", side: "pillar_corner_side", bottom: "pillar_corner_bottom", texelSize: 16 },
    behavior: PILLAR_BEHAVIOR },
  { id: "arch_keystone", name: "Arch Keystone", color: 0x85878a, swatch: "#85878a",
    model: { type: "arch", orientation: "fixed" },
    material: { top: "arch_keystone_top", side: "arch_keystone_side", bottom: "arch_keystone_bottom", texelSize: 16 },
    behavior: ARCH_BEHAVIOR },
  { id: "stair_stone", name: "Stone Stair", color: 0x85878a, swatch: "#85878a",
    model: { type: "stair", orientation: "fixed" },
    material: { top: "stair_stone_top", side: "stair_stone_side", bottom: "stair_stone_bottom", texelSize: 16 },
    behavior: STAIR_BEHAVIOR },
  { id: "window_frame", name: "Timber Window Frame", color: 0xb77a3e, swatch: "#b77a3e",
    model: { type: "frame", orientation: "fixed" },
    material: { top: "window_frame_top", side: "window_frame_side", bottom: "window_frame_bottom", texelSize: 16, transparent: true, opacity: 0.9 },
    behavior: FRAME_BEHAVIOR },

  // V0.5 水工程方块（激活 V0.4.2 块目录占位 ID）
  { id: "water_source", name: "Water Source", color: 0x3b7dd8, swatch: "#3b7dd8",
    model: CUBE_MODEL,
    material: { top: "water_source_top", side: "water_source_side", bottom: "water_source_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "drain_channel", name: "Drain Channel", color: 0x6e7580, swatch: "#6e7580",
    model: CUBE_MODEL,
    material: { top: "drain_channel_top", side: "drain_channel_side", bottom: "drain_channel_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
  { id: "water_pipe_blue", name: "Water Pipe", color: 0x4a90c2, swatch: "#4a90c2",
    model: CUBE_MODEL,
    material: { top: "water_pipe_blue_top", side: "water_pipe_blue_side", bottom: "water_pipe_blue_bottom", texelSize: 16 },
    behavior: DEFAULT_BEHAVIOR },
] as const;

export type BlockId = typeof BLOCKS[number]["id"];
export type BlockDefinition = typeof BLOCKS[number];

export function getBlockDefinition(id: BlockId): BlockDefinition {
  const block = BLOCKS.find((candidate) => candidate.id === id);
  if (!block) throw new Error(`Unknown block id: ${id}`);
  return block;
}

/** 构建资产清单：从 BLOCKS 数组生成构建时映射 */
export const ASSET_MANIFEST: AssetManifest = {
  schemaVersion: 1,
  entries: Object.fromEntries(
    BLOCKS.map((block) => [block.id, {
      id: block.id,
      model: block.model,
      material: block.material,
      behavior: block.behavior,
    }])
  ),
};
