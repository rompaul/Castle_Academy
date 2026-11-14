/**
 * V0.6.1 · MC 式方块栏的分组与快捷格规则（DDR-0002 有意设计变更）
 *
 * 契约：
 * - 只描述「方块怎么被浏览 / 怎么放进快捷格」，不新增方块、不改 BLOCKS 顺序、不碰 WorldSnapshot。
 * - 34 个既有 BlockId 必须且只能出现在一个分组里；电力 9 块按 E1 参考图分四组。
 * - 默认快捷格 = BLOCKS 前 9 个，保证 V0.5 基线「按 2 → Dirt」「点击 Select Brick」不变。
 * - 快捷格内容只在运行时内存中，绝不写进任何持久化存储（localStorage 仍只有 3 个 key）。
 */
import { BLOCKS, type BlockId } from "./blocks";

/** 快捷格数量：与 MC 一致，数字键 1–9 / 滚轮切换 */
export const QUICK_SLOT_COUNT = 9;

export interface BlockGroup {
  id: string;
  label: string;
  blockIds: readonly BlockId[];
}

/** 分类目录：组内顺序沿用 BLOCKS 顺序，保证确定性 */
export const BLOCK_GROUPS: readonly BlockGroup[] = [
  {
    id: "basics",
    label: "基础方块",
    blockIds: ["grass", "dirt", "stone", "wood", "sand", "brick", "glass"],
  },
  {
    id: "stonework",
    label: "石材与构件",
    blockIds: [
      "sandstone_warm", "rock_moss", "gravel", "wood_walnut", "brick_limestone",
      "tile_slate", "foundation_concrete", "footing_carved", "wall_plaster",
      "wall_timber_frame", "tunnel_lining", "pillar_corner", "arch_keystone",
      "stair_stone", "window_frame",
    ],
  },
  {
    id: "water",
    label: "水工程",
    blockIds: ["water_source", "drain_channel", "water_pipe_blue"],
  },
  {
    id: "electric-supply",
    label: "电 · 供电与导电",
    blockIds: ["power_source_low_voltage", "wire_basic"],
  },
  {
    id: "electric-control",
    label: "电 · 控制",
    blockIds: ["switch_open", "switch_closed"],
  },
  {
    id: "electric-load",
    label: "电 · 负载",
    blockIds: ["lamp_basic", "signal_beacon"],
  },
  {
    id: "electric-water",
    label: "电 · 水联动",
    blockIds: ["water_pump_basic", "water_valve_open", "water_valve_closed"],
  },
];

/** 初始快捷格：BLOCKS 前 9 个，永不重复 */
export const DEFAULT_QUICK_SLOTS: readonly BlockId[] = BLOCKS.slice(0, QUICK_SLOT_COUNT).map(
  (block) => block.id
);

/**
 * 把方块放进指定快捷格。
 * 若该方块已在别的格子，两格内容互换（保持 9 格互不重复，按钮 aria-label 永远唯一）。
 * 纯函数、不改入参、越界或重复点击不产生变化。
 */
export function assignToSlot(
  slots: readonly BlockId[],
  index: number,
  blockId: BlockId
): readonly BlockId[] {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length) return slots;
  const existing = slots.indexOf(blockId);
  if (existing === index) return slots;
  const next = slots.slice();
  if (existing >= 0) next[existing] = slots[index];
  next[index] = blockId;
  return next;
}
