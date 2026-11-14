/**
 * V061-022/023 — 电力状态消息派生（纯函数，AC-6736 六类齐全且互斥）。
 *
 * 只读取不可变快照（事件 payload 的负载状态 + 世界方块只读列表），
 * 不订阅事件、不写世界、不读时钟 / 随机 / DOM。UI 只负责展示结果。
 */
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import type { ElectricalLoadState } from "../../core/electrical";
import type { ElectricalStatusKey } from "./glossary";

export interface ElectricalStatusInput {
  readonly loadStates: ReadonlyArray<{ position: GridPosition; state: ElectricalLoadState }>;
  readonly blocks: ReadonlyArray<{ position: GridPosition; blockId: string }>;
}

/**
 * 优先级（一次只显示一个最可能原因，V0.6.1 实现期定案）：
 * 电源冲突 → 水泵没通电 → 阀门关着 → 开关断开 → 通电了 → 还没接通 → 无电力方块时 null。
 * 通电态与未通电态只靠 `ElectricalLoadState` 派生，不写回任何持久化结构。
 */
export function deriveElectricalStatus(input: ElectricalStatusInput): ElectricalStatusKey | null {
  const states = input.loadStates.map((entry) => entry.state);
  if (states.includes("source-conflict")) return "source-conflict";

  const pumpKeys = new Set(
    input.blocks
      .filter((block) => block.blockId === "water_pump_basic")
      .map((block) => positionKey(block.position))
  );
  if (pumpKeys.size > 0) {
    const pumpStates = input.loadStates
      .filter((entry) => pumpKeys.has(positionKey(entry.position)))
      .map((entry) => entry.state);
    if (pumpStates.length === 0 || pumpStates.some((state) => state !== "powered")) {
      return "pump-not-powered";
    }
  }

  const valves = input.blocks.filter((block) => block.blockId.startsWith("water_valve_"));
  if (valves.length > 0
    && valves.some((block) => block.blockId === "water_valve_closed")
    && !valves.some((block) => block.blockId === "water_valve_open")) {
    return "valve-closed";
  }

  if (states.includes("switch-open")) return "switch-open";
  if (states.includes("powered")) return "powered";
  if (states.length > 0) return "no-connection";
  return null;
}
