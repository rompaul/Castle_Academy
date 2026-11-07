import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";
import { BuildingPlugin } from "../building/BuildingPlugin";
import { PersistencePlugin } from "../persistence/PersistencePlugin";
import type { WorldSnapshot } from "../../core/world/WorldState";
import { WaterPlugin } from "./WaterPlugin";

/**
 * V05-009 存档兼容（ADR-0005 / AC-114）：
 * 水格是派生状态，WorldSnapshot（version 1）不含任何水字段；
 * 加载后 waterPlugin.refresh() 从水源重放重算，结果与保存前一致。
 */

const p = (x: number, y: number, z: number) => ({ x, y, z });

function flush(plugin: WaterPlugin, times = 40): void {
  for (let i = 0; i < times; i++) (plugin as unknown as { tick(): void }).tick();
}

/** 搭一个标准场景：平地 + 水源 */
function buildScene(world: WorldState, events: EventBus): { water: WaterPlugin; building: BuildingPlugin } {
  const building = new BuildingPlugin(world, events);
  const water = new WaterPlugin(world, events);
  water.activate();
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) world.place(p(x, 0, z), "stone");
  world.place(p(0, 1, 0), "water_source");
  water.refresh(); // 直写 WorldState 不发事件，显式重算
  flush(water);
  return { water, building };
}

describe("V05-009 水域存档兼容（AC-114 / ADR-0005）", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    const store = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; }
    };
    (globalThis as Record<string, unknown>).__v05Store = store;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__v05Store;
  });

  function makePersistence(world: WorldState, events: EventBus): PersistencePlugin {
    return new PersistencePlugin(world, events, {
      storageKey: "v05-test-world",
      storageKeyView: "v05-test-view",
      enabled: true
    }, {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; }
    });
  }

  it("AC-114 存档 JSON 不含任何水字段，version 仍为 1", () => {
    const events = new EventBus();
    const world = new WorldState();
    buildScene(world, events);

    const persistence = makePersistence(world, events);
    persistence.activate();
    expect(persistence.saveWorld()).toBe(true);

    const saved: WorldSnapshot & Record<string, unknown> = JSON.parse(storage["v05-test-world"]);
    expect(saved.version).toBe(1);
    // 存档中 water_source 是普通方块；不应出现派生水格或水专用字段
    expect(saved.water).toBeUndefined();
    expect(saved.waterCells).toBeUndefined();
    const waterCellCount = saved.blocks.filter(
      (b: { blockId: string }) => b.blockId === "water" || b.blockId === "water_flow"
    ).length;
    expect(waterCellCount).toBe(0);
    // 只有 1 个水源头块（派生水不进存档）
    expect(saved.blocks.filter((b: { blockId: string }) => b.blockId === "water_source").length).toBe(1);
  });

  it("加载后 refresh() 重放：水格分布与保存前一致", () => {
    const events = new EventBus();
    const world = new WorldState();
    const { water } = buildScene(world, events);
    const before = water.getQuery().getWaterCells().sort((a, b) =>
      `${a.x},${a.y},${a.z}`.localeCompare(`${b.x},${b.y},${b.z}`)
    );

    const persistence = makePersistence(world, events);
    persistence.activate();
    persistence.saveWorld();

    // 模拟重新进入：清空世界 + 全新 WaterPlugin
    world.clear();
    const water2 = new WaterPlugin(world, events);
    water2.activate();
    expect(world.load(JSON.parse(storage["v05-test-world"]))).toBe(true);
    water2.refresh();
    flush(water2);

    const after = water2.getQuery().getWaterCells().sort((a, b) =>
      `${a.x},${a.y},${a.z}`.localeCompare(`${b.x},${b.y},${b.z}`)
    );
    expect(after).toEqual(before);
    expect(water2.getQuery().isConverged()).toBe(true);
    water2.dispose();
  });

  it("加载 V0.4 旧存档（无水方块）→ 水域为空、无异常", () => {
    const events = new EventBus();
    const world = new WorldState();
    const legacy: WorldSnapshot = {
      version: 1,
      blocks: [
        { x: 0, y: 0, z: 0, blockId: "grass" },
        { x: 1, y: 0, z: 0, blockId: "stone" }
      ]
    };
    const water = new WaterPlugin(world, events);
    water.activate();
    expect(world.load(legacy)).toBe(true);
    water.refresh();
    expect(water.getQuery().getWaterCells().length).toBe(0);
    expect(water.getQuery().isConverged()).toBe(true);
    water.dispose();
  });

  it("保存事件 world.saved 不携带水状态（契约零变更）", () => {
    const events = new EventBus();
    const world = new WorldState();
    buildScene(world, events);
    const payloads: unknown[] = [];
    events.on("world.saved", (e) => payloads.push(e.payload));
    const persistence = makePersistence(world, events);
    persistence.activate();
    persistence.saveWorld();
    expect(payloads.length).toBe(1);
    expect(Object.keys(payloads[0] as Record<string, unknown>).sort()).toEqual(["blockCount", "timestamp"]);
  });
});
