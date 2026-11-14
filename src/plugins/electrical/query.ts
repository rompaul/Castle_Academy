/**
 * V061-010 — 只读查询契约（架构契约 §2，ADR-0011 决策 10）。
 *
 * 结果是**每次调用重新投影的不可变快照**：调用方拿不到插件内部 Map/Set，
 * 无法写回通电态；所有派生态从 WorldState 重建，绝不序列化。
 */

import type { GridPosition } from "../../core/world/coordinates";
import type { ElectricalLoadState, ElectricalNetworkStats } from "../../core/electrical";
import type { PumpOutputPort } from "./events";

export interface ElectricalLoadSnapshot {
  readonly position: GridPosition;
  readonly state: ElectricalLoadState;
}

/**
 * V061-021（DEV-615 owner 裁定「回到生活中的开关模型」）——「同一个开关按一下开、
 * 再按一下关」的成对观察记录。
 *
 * 存储层受 `WorldSnapshot v1` 零变更约束，两态只能以 `switch_open` / `switch_closed`
 * 两个 blockId 表达；但**学习证据必须是体验视角**：同一位置先后出现两态，且分别
 * 观察到「灯没通电」与「灯通电」，才算看见一次因果变化。
 *
 * 这是 ElectricalPlugin 在运行时内存中维护的**有界派生观察**，不写世界快照、
 * 不进 localStorage、不新增第 4 个 key；读档 / 重置时清空。评估器只读此快照，
 * 自身不持有历史（AC-6711 纯函数红线）。
 */
export interface SwitchObservation {
  readonly position: GridPosition;
  readonly state: "open" | "closed";
  /** 该次观察时，世界里是否存在一盏通电的灯 */
  readonly lampPowered: boolean;
  /** 产生该观察的重算序号（确定性排序用） */
  readonly sequence: number;
}

export interface ElectricalQuery extends PumpOutputPort {
  /** 该位置的负载是否通电（非负载位置一律 false） */
  isPowered(position: GridPosition): boolean;
  /** 负载状态；非负载位置返回 null（不伪造通电） */
  getLoadState(position: GridPosition): ElectricalLoadState | null;
  /** 导线 / 电源 / 闭合开关是否通电（双态 overlay 的输入） */
  isConductorPowered(position: GridPosition): boolean;
  /** 水泵方块是否通电且可作为虚拟水源（V061-014 窄端口） */
  isPumpOutputActive(position: GridPosition): boolean;
  getPoweredConductors(): readonly GridPosition[];
  getLoadStates(): readonly ElectricalLoadSnapshot[];
  getStatus(): "ok" | "limit-exceeded" | "invalid-input";
  getStats(): ElectricalNetworkStats;
  /**
   * V061-021 / DEV-615：同一开关位置的「开 → 合」成对观察痕迹。
   * 没有观察时返回空数组；返回不可变快照，调用方无法写回插件内部状态。
   */
  getSwitchObservations(): readonly SwitchObservation[];
  /** 诊断用：累计重算次数（不参与任何判定） */
  getRecomputeCount(): number;
}
