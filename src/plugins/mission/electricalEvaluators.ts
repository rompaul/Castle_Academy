/**
 * V061-021 — 电力任务的确定性评估器（ADR-0012 决策 5，AC-6712/6713/6739）。
 *
 * 红线（AC-212）：纯函数，同输入同输出；不读时钟、不取随机数、不访问 DOM / 网络 /
 * localStorage / WorldSnapshot，也不持有任何历史状态。判定只查询注入的只读
 * `ElectricalQuery` / `WaterQuery` 与世界方块只读快照，绝不使用 UI 点击、任务完成计数或 LLM。
 *
 * 实现口径（V061-021 定案；**DEV-615 owner 2026-11-14 裁定改回「生活中的开关」模型**）：
 * 存储层因 `WorldSnapshot v1` 无状态字段，开关开 / 合只能以两个 blockId 表达；
 * 但**学习证据必须是体验视角**——同一个开关位置「按一下开、再按一下关」，
 * 分别观察到「灯没通电」与「灯通电」，两次结果成对出现（ADR-0012 决策 5、
 * `LEARNING_ACTIVITIES_SPEC.md` §7）。观察痕迹由 `ElectricalPlugin` 在运行时内存中
 * 有界派生、经 `ElectricalQuery.getSwitchObservations()` 只读暴露；评估器自身
 * 零历史、零落盘、零新 localStorage key，同输入同输出。
 * 「任务完成 ≠ 掌握」由 MissionRuntimePlugin 按知识点落证据保证。
 */
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import type { ElectricalQuery } from "../electrical/query";
import type { EvaluatorQuery, EvaluatorRegistry, MissionEvaluator } from "./evaluators";

type BlockCell = { position: GridPosition; blockId: string };

function blocks(query: EvaluatorQuery): readonly BlockCell[] {
  return query.world?.all() ?? [];
}

function has(query: EvaluatorQuery, blockId: string): boolean {
  return blocks(query).some((cell) => cell.blockId === blockId);
}

function cells(query: EvaluatorQuery, blockId: string): readonly BlockCell[] {
  return blocks(query).filter((cell) => cell.blockId === blockId);
}

/** 与 V0.51 `extendedEvaluators.ts` 同源的确定性观察摘要；未注入电力查询时降级为 0 进度。 */
function result(done: number, total: number) {
  const clamped = Math.max(0, Math.min(done, total));
  return clamped >= total
    ? { progress: 1, complete: true, evidence: { observation: `${total}/${total}` } }
    : { progress: clamped / total, complete: false, evidence: { observation: `${clamped}/${total}` } };
}

function describe(done: number, total: number) {
  return { done: Math.max(0, Math.min(done, total)), total };
}

function electrical(query: EvaluatorQuery): ElectricalQuery | undefined {
  return query.electrical;
}

/** 活动 A：电源存在 + 信标终端确实通电（连通分量含电源由 ElectricalPlugin 保证）。 */
const lightBeacon: MissionEvaluator = {
  id: "evaluator.electric-light-beacon",
  legacyQuestId: "",
  evaluate: (query) => {
    const eq = electrical(query);
    if (!eq) return result(0, 2); // 未注入电力查询：完全降级，不显示误导性部分进度
    const beacons = cells(query, "signal_beacon");
    const done = (has(query, "power_source_low_voltage") ? 1 : 0)
      + (beacons.some((cell) => eq.isPowered(cell.position)) ? 1 : 0);
    return result(done, 2);
  },
  describe: (query) => {
    const eq = electrical(query);
    if (!eq) return describe(0, 2);
    const beacons = cells(query, "signal_beacon");
    return describe(
      (has(query, "power_source_low_voltage") ? 1 : 0)
        + (beacons.some((cell) => eq.isPowered(cell.position)) ? 1 : 0),
      2
    );
  }
};

/**
 * 活动 B 的成对观察判定（纯函数）：按开关位置聚合插件给出的观察痕迹，
 * 只有「同一位置既见过断开且灯灭、又见过合上且灯亮」才算看全一个开关。
 * 世界里同时摆两个不同位置的开关不构成配对（旧口径的漏洞已封堵）。
 */
function switchPair(query: EvaluatorQuery): number {
  const eq = electrical(query);
  if (!eq) return 0;
  const byPosition = new Map<string, { openOk: boolean; closedOk: boolean }>();
  for (const observation of eq.getSwitchObservations()) {
    const key = positionKey(observation.position);
    const entry = byPosition.get(key) ?? { openOk: false, closedOk: false };
    if (observation.state === "open" && !observation.lampPowered) entry.openOk = true;
    if (observation.state === "closed" && observation.lampPowered) entry.closedOk = true;
    byPosition.set(key, entry);
  }
  const entries = [...byPosition.values()];
  if (entries.some((entry) => entry.openOk && entry.closedOk)) return 2;
  return entries.some((entry) => entry.openOk || entry.closedOk) ? 1 : 0;
}

/** 活动 B：同一个开关按一下开、再按一下关，两态各看一次灯的样子。 */
const switchMagic: MissionEvaluator = {
  id: "evaluator.electric-switch-magic",
  legacyQuestId: "",
  evaluate: (query) => result(switchPair(query), 2),
  describe: (query) => describe(switchPair(query), 2)
};

/** 活动 C：泵通电（窄端口）+ 阀门开 + 泵出口正上方确实有水。 */
const powerPump: MissionEvaluator = {
  id: "evaluator.electric-power-pump",
  legacyQuestId: "",
  evaluate: (query) => {
    const eq = electrical(query);
    if (!eq) return result(0, 3);
    const pumps = cells(query, "water_pump_basic");
    const pumpActive = pumps.some((cell) => eq.isPumpOutputActive(cell.position));
    const outletHasWater = pumps.some((cell) =>
      query.water.hasWater({ x: cell.position.x, y: cell.position.y + 1, z: cell.position.z })
    );
    const done = (pumpActive ? 1 : 0)
      + (has(query, "water_valve_open") ? 1 : 0)
      + (outletHasWater ? 1 : 0);
    return result(done, 3);
  },
  describe: (query) => {
    const eq = electrical(query);
    if (!eq) return describe(0, 3);
    const pumps = cells(query, "water_pump_basic");
    const pumpActive = pumps.some((cell) => eq.isPumpOutputActive(cell.position));
    const outletHasWater = pumps.some((cell) =>
      query.water.hasWater({ x: cell.position.x, y: cell.position.y + 1, z: cell.position.z })
    );
    return describe(
      (pumpActive ? 1 : 0)
        + (has(query, "water_valve_open") ? 1 : 0)
        + (outletHasWater ? 1 : 0),
      3
    );
  }
};

export const ELECTRICAL_EVALUATORS: readonly MissionEvaluator[] = [
  lightBeacon, switchMagic, powerPump
];

/** 注册到唯一产品入口 `createDefaultEvaluatorRegistry()`；不新建平行注册表。 */
export function registerElectricalEvaluators(registry: EvaluatorRegistry): void {
  for (const evaluator of ELECTRICAL_EVALUATORS) registry.register(evaluator);
}
