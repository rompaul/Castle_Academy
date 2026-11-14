/**
 * V061-009/010/011/014 — ElectricalPlugin 契约测试。
 *
 * 覆盖：生命周期与释放、只订阅相关变更、只读查询不可变、`electric.*` 版本化事件与顺序、
 * 同 tick 合并 / 有界 / 重入保护 / 无每帧扫描、泵窄端口、事件环守卫、派生态不写回世界。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EventBus, type DomainEvent } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { BuildingPlugin } from "../building/BuildingPlugin";
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import { ElectricalPlugin, MAX_MERGED_RECOMPUTES } from "./ElectricalPlugin";
import {
  ELECTRICAL_EVENTS,
  ELECTRICAL_EVENT_VERSION,
  type ElectricalNetworkChangedPayload,
} from "./events";
import type { ElectricalQuery } from "./query";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

function harness() {
  const events = new EventBus();
  const world = new WorldState();
  const building = new BuildingPlugin(world, events);
  const pending: Array<() => void> = [];
  const plugin = new ElectricalPlugin(world, events, {
    schedule: (task) => pending.push(task),
  });
  const flush = (): void => {
    // 每轮只执行当前已排队的任务；事件回调中新排队的任务留给下一轮。
    const tasks = pending.splice(0);
    for (const task of tasks) task();
  };
  return { events, world, building, plugin, pending, flush };
}

/** 一条完整链路：源 → 电线 → 闭合开关 → 电线 → 灯 / 泵。 */
function placeChain(building: BuildingPlugin, withPump = false): void {
  building.place(p(0, 0, 0), "power_source_low_voltage");
  building.place(p(1, 0, 0), "wire_basic");
  building.place(p(2, 0, 0), "switch_closed");
  building.place(p(3, 0, 0), "wire_basic");
  building.place(p(4, 0, 0), "lamp_basic");
  if (withPump) building.place(p(3, 1, 0), "water_pump_basic");
}

describe("V061-009 ElectricalPlugin 生命周期", () => {
  it("activate / dispose 成对，重复 activate 不重复监听", () => {
    const h = harness();
    expect(h.plugin.isActive).toBe(false);
    h.plugin.activate();
    expect(h.plugin.isActive).toBe(true);
    const first = h.plugin.getRecomputeCount();
    expect(first).toBe(1);
    h.plugin.activate(); // 幂等
    expect(h.plugin.getRecomputeCount()).toBe(first);

    h.building.place(p(0, 0, 0), "power_source_low_voltage");
    h.building.place(p(1, 0, 0), "wire_basic");
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(first + 1); // 合并为一次，不是两次

    h.plugin.dispose();
    expect(h.plugin.isActive).toBe(false);
    h.building.place(p(2, 0, 0), "wire_basic");
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(first + 1); // 释放后不再重算

    h.plugin.activate();
    h.building.place(p(3, 0, 0), "wire_basic");
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(first + 3); // activate 一次 + 变更一次
    h.plugin.dispose();
  });

  it("只订阅世界方块变更；water.* 不触发电力重算（事件环守卫）", () => {
    const h = harness();
    h.plugin.activate();
    const before = h.plugin.getRecomputeCount();
    h.events.emit("water.flow.updated", { added: [], removed: [], reason: "tick" });
    h.events.emit("water.simulation.tick", { activeCells: 0, pendingOps: 0 });
    h.events.emit("mission.completed", { missionId: "x" });
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(before);
    h.plugin.dispose();
  });

  it("无定时器 / 无每帧扫描 / 无第二套 EventBus 或持久化", () => {
    const source = readFileSync(fileURLToPath(new URL("./ElectricalPlugin.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/setInterval|requestAnimationFrame|localStorage|new EventBus/);
    expect(source).not.toMatch(/from ["'].*WaterPlugin/);
  });
});

describe("V061-010 只读查询与 electric.* 事件契约", () => {
  it("3 个事件名前缀零冲突，payload 版本化且结构化", () => {
    const existing = ["water.flow.updated", "water.simulation.tick", "water.pipe.state.changed",
      "quest.updated", "quest.completed", "mission.completed", "mission.unlocked"];
    for (const name of Object.values(ELECTRICAL_EVENTS)) {
      expect(name.startsWith("electric.")).toBe(true);
      expect(existing).not.toContain(name);
    }
    expect(new Set(Object.values(ELECTRICAL_EVENTS)).size).toBe(3);
    expect(ELECTRICAL_EVENT_VERSION).toBe(1);

    const h = harness();
    const received: DomainEvent<ElectricalNetworkChangedPayload>[] = [];
    h.events.on<ElectricalNetworkChangedPayload>(ELECTRICAL_EVENTS.networkChanged, (e) => received.push(e));
    h.plugin.activate();
    placeChain(h.building, true);
    h.flush();
    expect(received).toHaveLength(2); // activate + 合并批次
    const event = received[1]!;
    expect(event.eventName).toBe("electric.network.changed");
    expect(event.version).toBe(1);
    expect(event.payload.status).toBe("ok");
    expect(event.payload.poweredConductorKeys).toContain(positionKey(p(1, 0, 0)));
    expect(event.payload.loadStates.length).toBeGreaterThan(0);
    expect(event.payload.sequence).toBe(2);
    expect(Object.isFrozen(event.payload)).toBe(true);
    h.plugin.dispose();
  });

  it("事件顺序：network → load → pump，且一次重算只发一条 network", () => {
    const h = harness();
    const order: string[] = [];
    h.events.on(ELECTRICAL_EVENTS.networkChanged, () => order.push("network"));
    h.events.on(ELECTRICAL_EVENTS.loadStateChanged, () => order.push("load"));
    h.events.on(ELECTRICAL_EVENTS.pumpStateChanged, () => order.push("pump"));
    h.plugin.activate();
    placeChain(h.building, true);
    h.flush();
    const batch = order.slice(order.indexOf("network", 1));
    expect(batch[0]).toBe("network");
    if (batch.includes("load")) expect(batch.indexOf("load")).toBeGreaterThan(0);
    if (batch.includes("pump")) expect(batch.indexOf("pump")).toBeGreaterThan(0);
    expect(order.filter((name) => name === "network")).toHaveLength(2);
    h.plugin.dispose();
  });

  it("ElectricalQuery 返回冻结快照，插件内部状态不可被写回", () => {
    const h = harness();
    h.plugin.activate();
    placeChain(h.building, true);
    h.flush();
    const query: ElectricalQuery = h.plugin.getQuery();
    const conductors = query.getPoweredConductors();
    const loads = query.getLoadStates();
    expect(Object.isFrozen(conductors)).toBe(true);
    expect(Object.isFrozen(loads)).toBe(true);
    expect(Object.isFrozen(loads[0])).toBe(true);
    expect(Object.isFrozen(query.getStats())).toBe(true);
    expect(query.getStatus()).toBe("ok");
    expect(query.isPowered(p(4, 0, 0))).toBe(true);
    expect(query.isConductorPowered(p(1, 0, 0))).toBe(true);
    expect(query.getLoadState(p(4, 0, 0))).toBe("powered");
    expect(query.getLoadState(p(9, 9, 9))).toBeNull();
    // 世界没有被写入任何派生字段
    const json = JSON.stringify(h.world.serialize());
    expect(json).not.toMatch(/powered|energized|orientation|pumpActive/);
    h.plugin.dispose();
  });
});

describe("V061-011 合并 / 有界 / 重入保护", () => {
  it("同 tick 批量放置合并为一次重算；无关方块不触发", () => {
    const h = harness();
    h.plugin.activate();
    const before = h.plugin.getRecomputeCount();
    let networkEvents = 0;
    h.events.on(ELECTRICAL_EVENTS.networkChanged, () => networkEvents++);
    placeChain(h.building);
    h.building.place(p(8, 0, 0), "stone");
    h.building.place(p(9, 0, 0), "sand");
    expect(h.pending).toHaveLength(1); // 只排队了一个 microtask
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(before + 1);
    expect(networkEvents).toBe(1);
    h.plugin.dispose();
  });

  it("移除电力方块触发一次重算；移除无关方块不触发", () => {
    const h = harness();
    h.plugin.activate();
    placeChain(h.building);
    h.flush();
    const before = h.plugin.getRecomputeCount();
    h.building.remove(p(8, 0, 0)); // 不存在的位置，removed 事件仍发出但 key 不相关
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(before);
    h.building.remove(p(2, 0, 0));
    h.flush();
    expect(h.plugin.getRecomputeCount()).toBe(before + 1);
    expect(h.plugin.getQuery().getLoadState(p(4, 0, 0))).toBe("no-connection");
    h.plugin.dispose();
  });

  it("事件回调中再变更不会同步递归，合并预算有上限", () => {
    const h = harness();
    expect(MAX_MERGED_RECOMPUTES).toBe(16);
    h.plugin.activate();
    let n = 0;
    h.events.on(ELECTRICAL_EVENTS.networkChanged, () => {
      n++;
      if (n < 5) h.building.place(p(10 + n, 0, 0), "wire_basic");
    });
    h.building.place(p(0, 0, 0), "power_source_low_voltage");
    for (let round = 0; round < 8; round++) h.flush();
    expect(n).toBeLessThanOrEqual(8);
    expect(h.plugin.getRecomputeCount()).toBeLessThanOrEqual(1 + MAX_MERGED_RECOMPUTES);
    h.plugin.dispose();
  });
});

describe("V061-014 泵输出窄端口", () => {
  it("通电泵为 true，断电 / 非泵 / 未知位置为 false", () => {
    const h = harness();
    h.plugin.activate();
    placeChain(h.building, true);
    h.flush();
    const query = h.plugin.getQuery();
    expect(query.isPumpOutputActive(p(3, 1, 0))).toBe(true);
    expect(query.isPumpOutputActive(p(4, 0, 0))).toBe(false);
    expect(query.isPumpOutputActive(p(99, 0, 0))).toBe(false);
    h.building.remove(p(0, 0, 0)); // 移除电源
    h.flush();
    expect(h.plugin.getQuery().isPumpOutputActive(p(3, 1, 0))).toBe(false);
    h.plugin.dispose();
  });
});
