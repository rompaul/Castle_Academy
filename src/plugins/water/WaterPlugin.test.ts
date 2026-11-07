import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";
import type { GridPosition } from "../../core/world/coordinates";
import { BuildingPlugin } from "../building/BuildingPlugin";
import { WaterPlugin, type WaterFlowUpdatedPayload } from "./WaterPlugin";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

/** 快速 tick：手动把 pending 全部应用（避免真实等待 150ms） */
function flush(plugin: WaterPlugin, times = 40): void {
  for (let i = 0; i < times; i++) (plugin as unknown as { tick(): void }).tick();
}

describe("WaterPlugin（V05-007 / AC-101,109,110,116 集成层）", () => {
  let world: WorldState;
  let events: EventBus;
  let building: BuildingPlugin;
  let plugin: WaterPlugin;

  beforeEach(() => {
    world = new WorldState();
    events = new EventBus();
    building = new BuildingPlugin(world, events);
    plugin = new WaterPlugin(world, events);
    plugin.activate();
  });

  afterEach(() => {
    plugin.dispose();
  });

  it("放置水源 → 发射 water.flow.updated，水按规则应用", () => {
    const flows: WaterFlowUpdatedPayload[] = [];
    events.on<WaterFlowUpdatedPayload>("water.flow.updated", (e) => flows.push(e.payload));
    // 平地
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) building.place(p(x, 0, z), "stone");
    expect(building.place(p(0, 1, 0), "water_source")).toBe(true);

    flush(plugin);
    const query = plugin.getQuery();
    expect(query.hasWater(p(0, 1, 1))).toBe(true); // 侧面扩散
    expect(query.isConverged()).toBe(true);
    expect(flows.length).toBeGreaterThan(0);
    expect(flows.some((f) => f.added.length > 0)).toBe(true);
  });

  it("AC-109 移除水源 → 全部退水", () => {
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) building.place(p(x, 0, z), "stone");
    building.place(p(0, 1, 0), "water_source");
    flush(plugin);
    expect(plugin.getQuery().getWaterCells().length).toBeGreaterThan(0);

    building.remove(p(0, 1, 0));
    flush(plugin);
    expect(plugin.getQuery().getWaterCells().length).toBe(0);
    expect(plugin.getQuery().isConverged()).toBe(true);
  });

  it("方块盖住水格 → 该格脱水（AC-105 集成层）", () => {
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) building.place(p(x, 0, z), "stone");
    building.place(p(0, 1, 0), "water_source");
    flush(plugin);
    const target = p(1, 1, 0);
    expect(plugin.getQuery().hasWater(target)).toBe(true);

    building.place(target, "stone");
    flush(plugin);
    expect(plugin.getQuery().hasWater(target)).toBe(false);
  });

  it("AC-116 分批应用：单 tick 应用数 ≤ maxCellsPerTick", () => {
    const config = { maxCellsPerTick: 5 };
    const fast = new WaterPlugin(world, events, config);
    fast.activate();
    const flows: WaterFlowUpdatedPayload[] = [];
    events.on<WaterFlowUpdatedPayload>("water.flow.updated", (e) => flows.push(e.payload));
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) building.place(p(x, 0, z), "stone");
    building.place(p(0, 1, 0), "water_source");
    flush(fast, 60);
    const batchSizes = flows.map((f) => f.added.length).filter((n) => n > 0);
    expect(batchSizes.length).toBeGreaterThan(1); // 确实分批了
    for (const size of batchSizes) expect(size).toBeLessThanOrEqual(5);
    fast.dispose();
  });

  it("AC-115 语义：refresh() 后查询与重算一致", () => {
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) building.place(p(x, 0, z), "stone");
    building.place(p(0, 1, 0), "water_source");
    flush(plugin);
    world.clear();
    plugin.refresh();
    expect(plugin.getQuery().getWaterCells().length).toBe(0);
  });

  it("dispose 后不再响应 tick", () => {
    plugin.dispose();
    const spy = vi.fn();
    events.on("water.flow.updated", spy);
    building.place(p(0, 0, 0), "water_source");
    flush(plugin);
    expect(spy).not.toHaveBeenCalled();
  });
});
