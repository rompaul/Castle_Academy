/**
 * V061-016 — 电 ↔ 水集成测试（AC-6723~6730，ADR-0011 决策 7/8/9）。
 *
 * 冻结顺序：world.block.* → ElectricalPlugin 合并重算 → electric.network.changed
 *          → WaterPlugin 通过 isPumpOutputActive() 读端口 → 水重算一次 → water.* 事件。
 * 断言「水事件不反向触发电力重算」「无端口时安全降级」「旧纯水场景输出不变」。
 */

import { describe, expect, it } from "vitest";
import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import { BuildingPlugin } from "../building/BuildingPlugin";
import { WaterPlugin } from "../water/WaterPlugin";
import { ElectricalPlugin } from "./ElectricalPlugin";
import { ELECTRICAL_EVENTS } from "./events";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

function flushWater(water: WaterPlugin, times = 40): void {
  for (let i = 0; i < times; i++) (water as unknown as { tick(): void }).tick();
}

function harness(withPort = true) {
  const events = new EventBus();
  const world = new WorldState();
  const building = new BuildingPlugin(world, events);
  const pending: Array<() => void> = [];
  const electrical = new ElectricalPlugin(world, events, {
    schedule: (task) => pending.push(task),
  });
  const water = new WaterPlugin(world, events, { tickIntervalMs: 1_000_000, maxCellsPerTick: 512 });
  const networkEvents: string[] = [];
  const waterTicks: unknown[] = [];
  events.on(ELECTRICAL_EVENTS.networkChanged, () => networkEvents.push("network"));
  events.on("water.simulation.tick", (e) => waterTicks.push(e.payload));

  const start = (): void => {
    if (withPort) water.setPumpOutputPort(electrical.getQuery());
    water.activate();
    electrical.activate();
    flushElectro();
    flushWater(water);
  };
  const flushElectro = (): void => {
    const tasks = pending.splice(0);
    for (const task of tasks) task();
  };
  const stop = (): void => {
    electrical.dispose();
    water.dispose();
  };
  return {
    events, world, building, electrical, water, pending, networkEvents, waterTicks,
    start, flushElectro, stop,
  };
}

/** 泵 + 完整电路：电源 (0,0,0) → 电线 (1,0,0) → 灯 (2,0,0)；泵放在 (0,1,0) 会与出口冲突，故另置。 */
function placePoweredPump(building: BuildingPlugin): void {
  building.place(p(0, 0, 0), "power_source_low_voltage");
  building.place(p(1, 0, 0), "wire_basic");
  building.place(p(1, 1, 0), "water_pump_basic"); // 出口 = (1,2,0)
  building.place(p(2, 0, 0), "lamp_basic");
}

function waterKeys(water: WaterPlugin): string[] {
  return water.getQuery().getWaterCells().map(positionKey).sort();
}

describe("V061-016 电 ↔ 水集成（AC-6723~6730）", () => {
  it("AC-6723 未通电泵不产生虚拟水源", () => {
    const h = harness();
    h.building.place(p(0, 0, 0), "water_pump_basic");
    h.start();
    expect(h.electrical.getQuery().isPumpOutputActive(p(0, 0, 0))).toBe(false);
    expect(waterKeys(h.water)).toEqual([]);
    h.stop();
  });

  it("AC-6724 通电泵只在正上方出口产生水源，位置精确", () => {
    const h = harness();
    placePoweredPump(h.building);
    h.start();
    expect(h.electrical.getQuery().isPumpOutputActive(p(1, 1, 0))).toBe(true);
    const keys = waterKeys(h.water);
    // 出口 (1,2,0) 下方是泵方块（有支撑）→ 只向四邻水平扩散，不向上、不穿泵。
    expect(keys).toContain("2,2,0");
    expect(keys).toContain("0,2,0");
    expect(keys).not.toContain("1,3,0");
    expect(keys).not.toContain("1,1,0");
    h.stop();
  });

  it("AC-6725 阀门开允许传播 / 闭阻断传播（V0.5 语义适配层）", () => {
    const h = harness();
    placePoweredPump(h.building);
    // V0.5 规则：水格下方有支撑才水平扩散。铺 y=1 支撑层让下游路径可预测。
    for (const x of [-1, 0, 2, 3, 4]) h.building.place(p(x, 1, 0), "stone");
    h.building.place(p(2, 2, 0), "water_valve_open");
    h.start();
    expect(waterKeys(h.water)).toContain("2,2,0"); // 开阀格本身视为空格，水贯通
    expect(waterKeys(h.water)).toContain("3,2,0"); // 继续向下游扩散

    // 切换为闭阀：走 WorldState 公共 API 的 remove + place（V061-008 契约）
    h.building.remove(p(2, 2, 0));
    h.building.place(p(2, 2, 0), "water_valve_closed");
    h.flushElectro();
    flushWater(h.water);
    expect(waterKeys(h.water)).not.toContain("2,2,0");
    expect(waterKeys(h.water)).not.toContain("3,2,0");
    h.stop();
  });

  it("AC-6726 移除电源 → 泵输出关闭，水重算后结果正确且无残留水", () => {
    const h = harness();
    placePoweredPump(h.building);
    h.start();
    expect(waterKeys(h.water).length).toBeGreaterThan(0);
    h.building.remove(p(0, 0, 0));
    h.flushElectro();
    flushWater(h.water);
    expect(h.electrical.getQuery().isPumpOutputActive(p(1, 1, 0))).toBe(false);
    expect(waterKeys(h.water)).toEqual([]);
    h.stop();
  });

  it("AC-6727 / AC-6730 水更新不反向触发电力重算；批量放置合并、无事件环", () => {
    const h = harness();
    h.start();
    const networkBefore = h.networkEvents.length;
    // 纯水事件不得触发电力重算
    h.events.emit("water.flow.updated", { added: [], removed: [], reason: "tick" });
    h.events.emit("water.simulation.tick", { activeCells: 5, pendingOps: 0 });
    h.water.refresh();
    h.flushElectro();
    expect(h.networkEvents.length).toBe(networkBefore);

    // 同 tick 批量放置：只排队一个合并任务，电力只重算一次
    const recomputeBefore = h.electrical.getRecomputeCount();
    h.building.place(p(0, 0, 0), "power_source_low_voltage");
    h.building.place(p(1, 0, 0), "wire_basic");
    h.building.place(p(2, 0, 0), "lamp_basic");
    expect(h.pending).toHaveLength(1);
    h.flushElectro();
    expect(h.electrical.getRecomputeCount()).toBe(recomputeBefore + 1);
    expect(h.networkEvents.length).toBe(networkBefore + 1);
    h.stop();
  });

  it("AC-6728 既有纯水场景输出与 V0.6 完全一致（端口不注入时零差异）", () => {
    const makeLegacy = (): string[] => {
      const events = new EventBus();
      const world = new WorldState();
      const building = new BuildingPlugin(world, events);
      const water = new WaterPlugin(world, events, { tickIntervalMs: 1_000_000 });
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) building.place(p(x, 0, z), "stone");
      building.place(p(0, 1, 0), "water_source");
      water.activate();
      flushWater(water);
      const keys = waterKeys(water);
      water.dispose();
      return keys;
    };
    const legacy = makeLegacy();

    const h = harness();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) h.building.place(p(x, 0, z), "stone");
    h.building.place(p(0, 1, 0), "water_source");
    h.start();
    expect(waterKeys(h.water)).toEqual(legacy);
    h.stop();
  });

  it("AC-6729 泵端口缺失时安全降级：不伪造出水，灯 / 信标仍可用", () => {
    const h = harness(false); // 不注入端口
    h.building.place(p(0, 0, 0), "power_source_low_voltage");
    h.building.place(p(1, 0, 0), "wire_basic");
    h.building.place(p(1, 1, 0), "water_pump_basic");
    h.building.place(p(2, 0, 0), "lamp_basic");
    h.start();
    expect(h.electrical.getQuery().isPowered(p(2, 0, 0))).toBe(true); // 灯仍可用
    expect(h.electrical.getQuery().isPumpOutputActive(p(1, 1, 0))).toBe(true); // 电力侧正常
    expect(waterKeys(h.water)).toEqual([]); // 水侧无端口 → 不出水
    h.stop();
  });
});
