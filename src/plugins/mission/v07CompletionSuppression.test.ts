import { describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { WaterPlugin } from "../water/WaterPlugin";
import { LearnerProfilePlugin } from "../learner/LearnerProfilePlugin";
import type { LearnerStore } from "../learner/types";
import { MissionRuntimePlugin } from "./MissionRuntimePlugin";
import { LearnerProfileProgressStore } from "./LearnerProfileProgressStore";
import { OBSERVATION_TARGETS, STORY_MAP_MARKERS } from "./interactiveEvaluators";

function memoryStore(): LearnerStore {
  const data: Record<string, string> = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; }
  };
}

function harness() {
  const events = new EventBus();
  const water = new WaterPlugin(new WorldState(), events);
  water.activate();
  const profile = new LearnerProfilePlugin(events, memoryStore());
  profile.activate();
  const runtime = new MissionRuntimePlugin(water, events, {
    progressStore: new LearnerProfileProgressStore(profile, events)
  });
  runtime.activate();
  water.refresh();
  for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
  runtime.refresh();
  return {
    profile,
    runtime,
    dispose: () => { runtime.dispose(); water.dispose(); profile.dispose(); }
  };
}

describe("V07-021 回归：建档后非水路任务必须能完成（completionSuppressed 不得只靠水事件解除）", () => {
  it("新建档案后，受控观察三条即可完成 Exploration 并解锁下游链", () => {
    const h = harness();
    try {
      expect(h.profile.createProfile("小小工程师", "8-10").ok).toBe(true);
      expect(h.runtime.getMission("mission.choose-water-route.v1")?.status).toBe("locked");
      for (const target of OBSERVATION_TARGETS) {
        expect(h.runtime.submitObservation("mission.find-the-pattern.v1", target)).toBe(true);
      }
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).toBe("completed");
      expect(h.runtime.getMission("mission.choose-water-route.v1")?.status).not.toBe("locked");
    } finally {
      h.dispose();
    }
  });

  it("新建档案后，写一段理由即可完成 Communication；反思文本单独不解除抑制", () => {
    const h = harness();
    try {
      expect(h.profile.createProfile("小小工程师", "13-15").ok).toBe(true);
      expect(h.runtime.submitReflection("mission.explain-my-choice.v1", "我先看了水源")).toBe(true);
      expect(h.runtime.getMission("mission.explain-my-choice.v1")?.status).not.toBe("completed");
      expect(h.runtime.submitTextEvidence("mission.explain-my-choice.v1", "我这样选是因为水会往下流")).toBe(true);
      expect(h.runtime.getMission("mission.explain-my-choice.v1")?.status).toBe("completed");
    } finally {
      h.dispose();
    }
  });

  it("新建档案后，一次真实世界变化可解除抑制，世界 / 电路类任务也能完成", () => {
    const events = new EventBus();
    const water = new WaterPlugin(new WorldState(), events);
    water.activate();
    const profile = new LearnerProfilePlugin(events, memoryStore());
    profile.activate();
    const runtime = new MissionRuntimePlugin(water, events, {
      progressStore: new LearnerProfileProgressStore(profile, events),
      world: {
        blockAt: () => undefined,
        all: () => STORY_MAP_MARKERS.map((blockId, i) => ({ position: { x: i, y: 1, z: 0 }, blockId }))
      }
    });
    runtime.activate();
    water.refresh();
    for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
    runtime.refresh();
    try {
      expect(profile.createProfile("甲", "6-7").ok).toBe(true);
      expect(runtime.getMission("mission.story-map.v1")?.status).not.toBe("completed");
      // 放置方块 / 剖面切换 / 电力重算都是「一次真实的世界变化」
      events.emit("world.block.placed", { position: { x: 0, y: 1, z: 0 }, blockId: "grass" });
      // 真实运行时由渲染循环持续 tick；单测里手动跑到水收敛，再让下一 tick 触发重算
      water.refresh();
      for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
      runtime.refresh();
      expect(runtime.getMission("mission.story-map.v1")?.status).toBe("completed");
    } finally {
      runtime.dispose();
      water.dispose();
      profile.dispose();
    }
  });

  it("档案切换仍清空会话记录、不把旧档案的完成态串过来", () => {
    const h = harness();
    try {
      const first = h.profile.createProfile("甲", "8-10");
      for (const target of OBSERVATION_TARGETS) {
        h.runtime.submitObservation("mission.find-the-pattern.v1", target);
      }
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).toBe("completed");
      h.profile.createProfile("乙", "8-10");
      expect(first.ok).toBe(true);
      expect(h.runtime.getInteractionSnapshot().observationLog).toEqual([]);
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).not.toBe("completed");
    } finally {
      h.dispose();
    }
  });
});
