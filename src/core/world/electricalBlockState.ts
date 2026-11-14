/**
 * V061-008 — 开关 / 阀门两态切换（ADR-0011 决策 5 / AC-6716 / AC-6717）。
 *
 * 约束：两态只由两个 blockId 表达；切换完全走 `WorldState` 的公共 API
 * （`get` / `remove` / `place`），不新增快照字段、不引入朝向、不写派生通电态。
 * 本模块在 `src/core/world/` 而非 `src/core/electrical/`：后者是零 WorldState 依赖的纯领域模型。
 */

import type { BlockId } from "./blocks";
import type { GridPosition } from "./coordinates";
import type { WorldState } from "./WorldState";

/** 两组可逆状态对，顺序固定（供内容校验与 UI 复用）。 */
export const ELECTRICAL_STATE_PAIRS: Readonly<Record<string, BlockId>> = Object.freeze({
  switch_open: "switch_closed",
  switch_closed: "switch_open",
  water_valve_open: "water_valve_closed",
  water_valve_closed: "water_valve_open",
});

/**
 * 原子切换：只接受两态对中的 ID；remove + place 均为既有公共 API。
 * 放置失败时恢复原块，保证世界不处于「空了一格」的中间态。
 */
export function toggleElectricalState(world: WorldState, position: GridPosition): boolean {
  const current = world.get(position);
  if (!current) return false;
  const next = ELECTRICAL_STATE_PAIRS[current.blockId];
  if (!next) return false;
  if (!world.remove(position)) return false;
  if (world.place(position, next)) return true;
  world.place(position, current.blockId);
  return false;
}
