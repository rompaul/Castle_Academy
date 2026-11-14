/**
 * V061-004 — 纯电力领域模型的类型与冻结常量。
 *
 * 设计约束（ADR-0011 / V0.6.1 实施计划 §1）：
 * - 纯数据 + 纯函数：不 import WorldState / 插件 / UI / 渲染；不落盘、不缓存、不产生事件。
 * - 通电态、连通分量、负载状态全部从输入方块集合**每次重算派生**，绝不序列化。
 * - 9 个 Block ID 的「角色语义」由本领域模块持有；V061-006 在 `blocks.ts` 只追加视觉/行为注册，
 *   须与本表一致（可 import 复用）。本任务不修改方块注册表与 `WorldSnapshot v1`。
 * - 儿童可见文案统一用「电」；本文件只有内部技术命名，不暴露给儿童。
 */

import type { GridPosition } from "../world/coordinates";

/** 电力方块的领域角色。`valve` 属水侧，不参与电力图。 */
export type ElectricalRole =
  | "source"
  | "conductor"
  | "switch-closed"
  | "switch-open"
  | "load"
  | "valve";

/**
 * 9 个候选 Block ID → 领域角色（只追加，与 25 个既有 ID 零碰撞，见 V061-002 报告 §2）。
 * 导电单元只有 source / conductor / switch-closed；负载与已通电导体相邻即取电（ADR-0011 决策 2/3）。
 */
export const ELECTRICAL_BLOCK_ROLES = Object.freeze({
  power_source_low_voltage: "source",
  wire_basic: "conductor",
  switch_open: "switch-open",
  switch_closed: "switch-closed",
  lamp_basic: "load",
  signal_beacon: "load",
  water_pump_basic: "load",
  water_valve_open: "valve",
  water_valve_closed: "valve",
}) as Readonly<Record<string, ElectricalRole | undefined>>;

/** 9 个电力/联动方块 ID（稳定顺序，供 V061-006 注册与内容校验复用）。 */
export const ELECTRICAL_BLOCK_IDS: readonly string[] = Object.freeze(
  Object.keys(ELECTRICAL_BLOCK_ROLES),
);

/** 识别「看起来像电力方块但未注册」的畸形元数据；命中即安全降级 unknown，绝不静默判为通电。 */
const ELECTRICAL_ID_PREFIXES: readonly string[] = Object.freeze([
  "power_source_",
  "wire_",
  "switch_",
  "lamp_",
  "signal_beacon",
  "water_pump_",
  "water_valve_",
]);

export function isElectricalLikeId(blockId: string): boolean {
  return ELECTRICAL_ID_PREFIXES.some((prefix) => blockId.startsWith(prefix));
}

/** 输入单元：与 `WorldState.all()` 同形，但只用纯字符串 blockId，不 import WorldState 类型。 */
export interface ElectricalCell {
  position: GridPosition;
  blockId: string;
}

export interface ElectricalNetworkInput {
  /** 一次重算的全部方块（可含无关方块，模型会忽略）。 */
  cells: Iterable<ElectricalCell>;
}

/** 负载状态（对应儿童可见消息：通电了 / 还没接通 / 开关断开 / 电源冲突 / unknown→未通电）。 */
export type ElectricalLoadState =
  | "powered"
  | "no-connection"
  | "switch-open"
  | "source-conflict"
  | "unknown";

/** 有界重算上限：防止巨型图导致 UI 冻结或每帧扫描（AC-6710）。 */
export interface ElectricalSimLimits {
  /** 参与电力图的格子数上限（导体 + 负载 + 断开开关；阀门与非电力方块不计）。 */
  maxCells: number;
  /** 导体无向邻接边数上限。 */
  maxEdges: number;
  /** 邻居检查 / BFS 访问的总操作次数上限。 */
  maxOperations: number;
}

export const DEFAULT_ELECTRICAL_SIM_LIMITS: ElectricalSimLimits = Object.freeze({
  maxCells: 4096,
  maxEdges: 24_576,
  maxOperations: 49_152,
});

export interface ElectricalComponent {
  readonly id: number;
  /** 稳定排序后的成员 positionKey 列表。 */
  readonly cellKeys: readonly string[];
  readonly sourceCount: number;
  readonly status: "powered" | "unpowered" | "source-conflict";
  readonly powered: boolean;
}

export interface ElectricalNetworkStats {
  readonly cellCount: number;
  readonly edgeCount: number;
  readonly operationCount: number;
}

/**
 * 一次重算的不可变结果（调用方只读；插件不得持有并修改内部缓存）。
 * Map/Set 以 ReadonlyMap / ReadonlySet 暴露，内容按稳定顺序插入，保证插入顺序置换后字节等价。
 */
export interface ElectricalNetworkResult {
  /** ok / limit-exceeded / invalid-input；后两者一律安全回退「全部未通电 + unknown」。 */
  readonly status: "ok" | "limit-exceeded" | "invalid-input";
  readonly reason: string | null;
  /** 通电导体（导线逐段点亮的派生输入）。 */
  readonly poweredConductors: ReadonlySet<string>;
  /** 每个导体格所属连通分量 id。 */
  readonly componentOf: ReadonlyMap<string, number>;
  readonly components: readonly ElectricalComponent[];
  /** 负载位置 → 状态；含水泵（水侧窄端口据此判断通电）。 */
  readonly loadStates: ReadonlyMap<string, ElectricalLoadState>;
  readonly poweredLoads: ReadonlySet<string>;
  readonly stats: ElectricalNetworkStats;
}
