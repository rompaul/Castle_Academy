import { describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { PersistencePlugin } from "../persistence/PersistencePlugin";
import { WaterPlugin } from "../water/WaterPlugin";
import { LearnerProfilePlugin } from "../learner/LearnerProfilePlugin";
import { LEARNER_STORAGE_KEY, type LearnerStore } from "../learner/types";
import { buildCastleWaterStage } from "../learning/castleStage";
import { MissionRuntimePlugin } from "./MissionRuntimePlugin";
import { LearnerProfileProgressStore } from "./LearnerProfileProgressStore";
import { MISSION_EVENTS, type MissionCompletedPayload } from "./events";

const p = (x: number, y: number, z: number) => ({ x, y, z });

type MemoryStore = LearnerStore & { data: Record<string, string> };

function memoryStore(): MemoryStore {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; }
  };
}

function harness(store: MemoryStore) {
  const events = new EventBus();
  const world = new WorldState();
  const water = new WaterPlugin(world, events);
  water.activate();
  const profile = new LearnerProfilePlugin(events, store);
  profile.activate();
  const runtime = new MissionRuntimePlugin(water, events, {
    progressStore: new LearnerProfileProgressStore(profile, events)
  });
  runtime.activate();
  const settle = () => {
    water.refresh();
    for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
    runtime.refresh();
  };
  const dispose = () => { runtime.dispose(); water.dispose(); profile.dispose(); };
  return { events, world, water, profile, runtime, settle, dispose };
}

function fillMoat(world: WorldState): void {
  buildCastleWaterStage((pos, id) => world.place(pos, id));
  for (const pos of [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5)]) {
    world.place(pos, "water_source");
  }
}

describe("V51-008 任务进度持久化接入档案域（AC-201/202/211）", () => {
  it("完成状态写入当前档案，重进世界后从档案恢复且不重复发奖励", () => {
    const store = memoryStore();
    const a = harness(store);
    a.profile.createProfile("甲", "8-10");
    fillMoat(a.world);
    a.settle();
    expect(a.runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    const entry = a.profile.getMissionProgress("mission.moat.v1");
    expect(entry?.status).toBe("completed");
    expect(entry?.evidence?.evaluatorId).toBe("evaluator.moat");
    expect(entry?.evidence?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    a.dispose();

    // 模拟刷新：全新插件实例、同一 localStorage、同样已建好的世界
    const b = harness(store);
    const completed: MissionCompletedPayload[] = [];
    b.events.on<MissionCompletedPayload>(MISSION_EVENTS.completed, (e) => completed.push(e.payload));
    expect(b.profile.getActiveProfile()?.nickname).toBe("甲");
    expect(b.runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    fillMoat(b.world);
    b.settle();
    expect(completed).toHaveLength(0);
    b.dispose();
  });

  it("世界存档 JSON 中 0 个档案字段；档案 JSON 中 0 个世界字段（验收 §5）", () => {
    const store = memoryStore();
    const h = harness(store);
    h.profile.createProfile("小小工程师", "8-10");
    h.runtime.activateMission("mission.moat.v1");
    h.runtime.useHint("mission.moat.v1");
    fillMoat(h.world);
    h.settle();

    const persistence = new PersistencePlugin(
      h.world,
      h.events,
      { storageKey: "castle-academy-world-v1", storageKeyView: "castle-academy-view-v1", enabled: true },
      store
    );
    persistence.activate();
    expect(persistence.saveWorld()).toBe(true);

    const worldJson = store.data["castle-academy-world-v1"];
    const learnerJson = store.data[LEARNER_STORAGE_KEY];
    expect(worldJson).toBeDefined();
    expect(learnerJson).toBeDefined();
    expect(worldJson).not.toContain("nickname");
    expect(worldJson).not.toContain("missionProgress");
    expect(worldJson).not.toContain("小小工程师");
    expect(learnerJson).not.toContain("blocks");
    expect(learnerJson).toContain("小小工程师");
    expect(JSON.parse(worldJson).version).toBe(1); // WorldSnapshot version 1 零变更
    expect(new Set(Object.keys(store.data))).toEqual(
      new Set(["castle-academy-world-v1", LEARNER_STORAGE_KEY])
    );
    h.dispose();
  });

  it("多档案切换：进度按档案恢复，互不串扰（AC-202）", () => {
    const store = memoryStore();
    const h = harness(store);
    const a = h.profile.createProfile("甲", "8-10");
    const b = h.profile.createProfile("乙", "11-12");
    if (!a.ok || !b.ok) throw new Error("setup failed");
    h.profile.switchProfile(a.profile.id);
    h.events.emit("water.flow.updated", { added: [], removed: [], reason: "tick" }); // 解除切换抑制
    fillMoat(h.world);
    h.settle();
    expect(h.runtime.getMission("mission.moat.v1")?.status).toBe("completed");

    h.profile.switchProfile(b.profile.id);
    expect(h.runtime.getMission("mission.moat.v1")?.status).toBe("available");
    expect(h.profile.getMissionProgress("mission.moat.v1")).toBeNull();

    // 新档案经历一次真实世界变化后才可自己完成任务
    h.events.emit("water.flow.updated", { added: [], removed: [], reason: "tick" });
    h.settle();
    expect(h.runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    expect(h.profile.getMissionProgress("mission.moat.v1")?.status).toBe("completed");

    h.profile.switchProfile(a.profile.id);
    expect(h.runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    expect(h.profile.getActiveProfile()?.nickname).toBe("甲");
    h.dispose();
  });

  it("无档案降级：任务运行时仍可工作，不阻塞进入世界", () => {
    const store = memoryStore();
    const h = harness(store);
    expect(h.profile.getActiveProfile()).toBeNull();
    expect(h.runtime.getMissions()).toHaveLength(9);
    fillMoat(h.world);
    expect(() => h.settle()).not.toThrow();
    expect(h.runtime.getMission("mission.moat.v1")?.progress).toBe(1);
    expect(h.profile.getMissionProgress("mission.moat.v1")).toBeNull(); // 无档案 → 不写任何地方
    h.dispose();
  });

  it("档案损坏：容错重置，世界与任务运行时照常可用", () => {
    const store = memoryStore();
    store.data[LEARNER_STORAGE_KEY] = "{broken";
    const h = harness(store);
    expect(h.profile.consumeNotice()).toContain("已重置");
    expect(h.runtime.getMissions()).toHaveLength(9);
    expect(() => h.profile.createProfile("重新来过", "6-7")).not.toThrow();
    h.dispose();
  });
});
