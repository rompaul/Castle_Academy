/**
 * DEV-615 —「生活中的开关」配对观察集成测试（2026-11-14 owner 裁定）。
 *
 * 证明：真实 WorldState + BuildingPlugin + ElectricalPlugin 链路里，
 * 同一个位置的开关「按一下开、再按一下关」会产出同一位置的两态观察
 * （断开时灯灭 / 合上时灯亮），评估器据此判定完成；而世界里同时摆两个
 * 不同位置的开关不构成配对。观察痕迹不落盘、读档 / 重置即清空。
 */

import { describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { ELECTRICAL_STATE_PAIRS } from "../../core/world/electricalBlockState";
import type { GridPosition } from "../../core/world/coordinates";
import { BuildingPlugin } from "../building/BuildingPlugin";
import { ElectricalPlugin } from "./ElectricalPlugin";
import { ELECTRICAL_EVALUATORS } from "../mission/electricalEvaluators";
import type { EvaluatorQuery } from "../mission/evaluators";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });
const SWITCH = p(2, 0, 0);
const B = ELECTRICAL_EVALUATORS.find((e) => e.id === "evaluator.electric-switch-magic")!;

function harness() {
  const events = new EventBus();
  const world = new WorldState();
  const building = new BuildingPlugin(world, events);
  // 同步合并策略：每次 place/remove 后立刻重算，便于断言事件顺序。
  const electrical = new ElectricalPlugin(world, events, { schedule: (task) => task() });
  electrical.activate();

  /** 与产品交互一致：remove + place 走公共 API，两个事件被合并/连续重算。 */
  const press = (position: GridPosition): void => {
    const current = world.get(position);
    expect(current, "开关位置应有方块").toBeDefined();
    const next = ELECTRICAL_STATE_PAIRS[current!.blockId];
    expect(next, "该方块应属于可切换两态对").toBeDefined();
    building.remove(position);
    building.place(position, next);
  };

  const evaluatorQuery = (): EvaluatorQuery => ({
    water: {
      hasWater: () => false, getWaterCells: () => [],
      isPipeFlowing: () => false, isConverged: () => true,
    },
    everWet: new Set(),
    measurementDone: false,
    world: {
      blockAt: (position) => world.get(position)?.blockId,
      all: () => world.all(),
    },
    electrical: electrical.getQuery(),
  });

  return { world, building, electrical, press, evaluatorQuery };
}

/** 电源 → 电线 → 开关 → 电线 → 灯（六正交邻接，灯是负载）。 */
function placeCircuit(building: BuildingPlugin): void {
  building.place(p(0, 0, 0), "power_source_low_voltage");
  building.place(p(1, 0, 0), "wire_basic");
  building.place(SWITCH, "switch_closed");
  building.place(p(3, 0, 0), "wire_basic");
  building.place(p(4, 0, 0), "lamp_basic");
}

describe("DEV-615 同一个开关按一下开、再按一下关", () => {
  it("合上态灯亮 → 按一下断开灯灭 → 同一位置成对观察，评估器判定完成", () => {
    const h = harness();
    placeCircuit(h.building);

    const before = h.electrical.getQuery().getSwitchObservations();
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ state: "closed", lampPowered: true });
    expect(B.evaluate(h.evaluatorQuery()).complete).toBe(false);

    h.press(SWITCH); // 按一下：合上 → 断开
    expect(h.world.get(SWITCH)?.blockId).toBe("switch_open");
    expect(h.electrical.getQuery().isPowered(p(4, 0, 0))).toBe(false);

    const after = h.electrical.getQuery().getSwitchObservations();
    expect(after).toHaveLength(2);
    expect(after.map((o) => o.state).sort()).toEqual(["closed", "open"]);
    expect(after.every((o) => o.position.x === SWITCH.x && o.position.y === SWITCH.y && o.position.z === SWITCH.z)).toBe(true);
    expect(after.find((o) => o.state === "open")?.lampPowered).toBe(false);
    expect(after.find((o) => o.state === "closed")?.lampPowered).toBe(true);
    expect(B.evaluate(h.evaluatorQuery()).evidence?.observation).toBe("2/2");

    h.press(SWITCH); // 再按一下：断开 → 合上，仍然完成（可逆）
    expect(h.electrical.getQuery().isPowered(p(4, 0, 0))).toBe(true);
    expect(B.evaluate(h.evaluatorQuery()).complete).toBe(true);
  });

  it("世界里同时摆两个不同位置的开关不构成配对", () => {
    const h = harness();
    placeCircuit(h.building);
    h.building.place(p(2, 2, 0), "switch_open");
    expect(B.evaluate(h.evaluatorQuery()).complete).toBe(false);
    expect(h.electrical.getQuery().getSwitchObservations().length).toBe(2);
  });

  it("观察痕迹是运行时派生：refresh / dispose 即清空，不入 WorldSnapshot", () => {
    const h = harness();
    placeCircuit(h.building);
    h.press(SWITCH);
    expect(h.electrical.getQuery().getSwitchObservations()).toHaveLength(2);

    h.electrical.refresh(); // 读档 / 重置：新世界重新观察
    expect(h.electrical.getQuery().getSwitchObservations()).toHaveLength(1);
    expect(B.evaluate(h.evaluatorQuery()).complete).toBe(false);
    const snapshot = JSON.stringify(h.world.serialize());
    expect(snapshot).not.toContain("switchObservation");
    expect(snapshot).not.toContain("lampPowered");

    h.electrical.dispose();
    expect(h.electrical.getQuery().getSwitchObservations()).toHaveLength(0);
  });
});
