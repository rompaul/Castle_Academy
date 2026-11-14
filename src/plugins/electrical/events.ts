/**
 * V061-010 — `electric.*` 事件契约（ADR-0011 决策 9/12，架构契约 §6）。
 *
 * Phase 0 全库检索确认 `electric.*` 前缀 0 命中；既有 `water.*` / `mission.*` /
 * `quest.*` 事件名一个不改。所有事件走既有 EventBus，版本化、结构化 payload。
 * 事件只在**一次重算完成后**发布，不在每帧或每个方块变更时发布。
 */

import type { GridPosition } from "../../core/world/coordinates";
import type { ElectricalLoadState, ElectricalNetworkStats } from "../../core/electrical";

export const ELECTRICAL_EVENTS = Object.freeze({
  /** 网络整体结果变化（一次重算一条） */
  networkChanged: "electric.network.changed",
  /** 负载逐格状态变化（diff，仅变化项） */
  loadStateChanged: "electric.load.state.changed",
  /** 水泵输出通断变化（diff，供水侧与 UI 消费） */
  pumpStateChanged: "electric.pump.state.changed",
});

export const ELECTRICAL_EVENT_VERSION = 1;

export interface ElectricalLoadStateEntry {
  position: GridPosition;
  state: ElectricalLoadState;
}

export interface ElectricalNetworkChangedPayload {
  status: "ok" | "limit-exceeded" | "invalid-input";
  reason: string | null;
  /** 稳定排序后的 positionKey 列表（导线逐段点亮的派生输入） */
  poweredConductorKeys: readonly string[];
  /** 水泵输出已激活的位置键（水侧据此判重，避免无谓重算） */
  pumpActiveKeys: readonly string[];
  loadStates: readonly ElectricalLoadStateEntry[];
  stats: ElectricalNetworkStats;
  /** 本次重算序号（诊断 / 事件环守卫用） */
  sequence: number;
  cause: "activate" | "refresh" | "block-change" | "merged-batch";
}

export interface ElectricalLoadStateChangedPayload {
  changed: ReadonlyArray<{
    position: GridPosition;
    state: ElectricalLoadState;
    previous: ElectricalLoadState | null;
  }>;
  sequence: number;
}

export interface ElectricalPumpStateChangedPayload {
  changed: ReadonlyArray<{ position: GridPosition; active: boolean }>;
  sequence: number;
}

/** 水侧消费的窄公共端口（V061-014）；不暴露 ElectricalPlugin 内部实现。 */
export interface PumpOutputPort {
  isPumpOutputActive(position: GridPosition): boolean;
}
