import { describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { LearnerProfilePlugin } from "./LearnerProfilePlugin";
import {
  LEARNER_EVENTS,
  LEARNER_STORAGE_KEY,
  type LearnerProfileCreatedPayload,
  type LearnerProfileRecoveredPayload,
  type LearnerProfileSwitchedPayload,
  type LearnerStore
} from "./types";

function memoryStore(seed?: Record<string, string>): LearnerStore & { data: Record<string, string> } {
  const data: Record<string, string> = { ...(seed ?? {}) };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; }
  };
}

describe("V51-005 LearnerProfilePlugin（ADR-0006）", () => {
  it("创建档案写入独立 key，世界存档 key 完全不受影响", () => {
    const store = memoryStore({ "castle-academy-world-v1": "{\"version\":1,\"blocks\":[]}" });
    const plugin = new LearnerProfilePlugin(new EventBus(), store);
    plugin.activate();

    const result = plugin.createProfile("小小工程师", "8-10");
    expect(result.ok).toBe(true);
    expect(store.data[LEARNER_STORAGE_KEY]).toContain("小小工程师");
    expect(store.data["castle-academy-world-v1"]).toBe("{\"version\":1,\"blocks\":[]}");

    const parsed = JSON.parse(store.data[LEARNER_STORAGE_KEY]);
    expect(parsed.version).toBe(1);
    expect(parsed.profiles).toHaveLength(1);
    expect(parsed.activeProfileId).toBe(parsed.profiles[0].id);
    expect(parsed.profiles[0]).not.toHaveProperty("school");
    expect(parsed.profiles[0]).not.toHaveProperty("realName");
  });

  it("无档案时 activate 不崩溃、不创建默认档案", () => {
    const plugin = new LearnerProfilePlugin(new EventBus(), memoryStore());
    expect(() => plugin.activate()).not.toThrow();
    expect(plugin.getActiveProfile()).toBeNull();
    expect(plugin.hasProfiles()).toBe(false);
    expect(plugin.consumeNotice()).toBeNull();
  });

  it("多档案切换：任务进度按档案隔离，互不串扰", () => {
    const plugin = new LearnerProfilePlugin(new EventBus(), memoryStore());
    plugin.activate();
    const a = plugin.createProfile("甲", "6-7");
    const b = plugin.createProfile("乙", "11-12");
    if (!a.ok || !b.ok) throw new Error("setup failed");

    plugin.updateMissionProgress("mission.moat.v1", { status: "completed" });
    plugin.recordHintUsed("mission.moat.v1");
    expect(plugin.getActiveProfile()?.id).toBe(b.profile.id);

    expect(plugin.switchProfile(a.profile.id)).toBe(true);
    expect(plugin.getMissionProgress("mission.moat.v1")).toBeNull();
    plugin.updateMissionProgress("mission.moat.v1", { status: "active", hintsUsed: 3 });

    expect(plugin.switchProfile(b.profile.id)).toBe(true);
    const bState = plugin.getMissionProgress("mission.moat.v1");
    expect(bState?.status).toBe("completed");
    expect(bState?.hintsUsed).toBe(1);

    expect(plugin.switchProfile(a.profile.id)).toBe(true);
    const aState = plugin.getMissionProgress("mission.moat.v1");
    expect(aState?.status).toBe("active");
    expect(aState?.hintsUsed).toBe(3);
  });

  it("刷新（新插件实例读同一 store）后档案与进度恢复", () => {
    const store = memoryStore();
    const first = new LearnerProfilePlugin(new EventBus(), store);
    first.activate();
    const created = first.createProfile("重启后还在", "8-10");
    if (!created.ok) throw new Error("setup failed");
    first.updateMissionProgress("mission.well.v1", {
      status: "completed",
      evidence: { completedAt: "2026-11-10T00:00:00.000Z", evaluatorId: "evaluator.well" }
    });

    const second = new LearnerProfilePlugin(new EventBus(), store);
    second.activate();
    expect(second.getActiveProfile()?.nickname).toBe("重启后还在");
    expect(second.getMissionProgress("mission.well.v1")?.evidence?.evaluatorId).toBe("evaluator.well");
  });

  it("损坏 JSON → 容错重置 + 一次性提示 + recovered 事件，不崩溃", () => {
    const events = new EventBus();
    const recovered: LearnerProfileRecoveredPayload[] = [];
    events.on<LearnerProfileRecoveredPayload>(LEARNER_EVENTS.recovered, (e) => recovered.push(e.payload));
    const store = memoryStore({ [LEARNER_STORAGE_KEY]: "{not-json" });
    const plugin = new LearnerProfilePlugin(events, store);

    expect(() => plugin.activate()).not.toThrow();
    expect(plugin.getActiveProfile()).toBeNull();
    expect(plugin.consumeNotice()).toContain("已重置");
    expect(plugin.consumeNotice()).toBeNull();
    expect(recovered).toHaveLength(1);
    expect(recovered[0].reason).toBe("corrupt");
    // 重置后仍可正常创建，且此时才把损坏数据覆盖为合法档案
    expect(plugin.createProfile("新铭牌", "13-15").ok).toBe(true);
    expect(JSON.parse(store.data[LEARNER_STORAGE_KEY]).profiles).toHaveLength(1);
  });

  it("结构非法 / 未知版本同样容错重置", () => {
    const bad = new LearnerProfilePlugin(new EventBus(), memoryStore({
      [LEARNER_STORAGE_KEY]: JSON.stringify({ version: 1, activeProfileId: "x", profiles: [{ id: "x" }] })
    }));
    expect(() => bad.activate()).not.toThrow();
    expect(bad.consumeNotice()).toContain("已重置");

    const future = new LearnerProfilePlugin(new EventBus(), memoryStore({
      [LEARNER_STORAGE_KEY]: JSON.stringify({ version: 2, activeProfileId: "", profiles: [] })
    }));
    expect(() => future.activate()).not.toThrow();
    expect(future.consumeNotice()).toContain("较新版本");
  });

  it("昵称校验：空 / 空白 / 超长拒绝，trim 后合法通过", () => {
    const plugin = new LearnerProfilePlugin(new EventBus(), memoryStore());
    plugin.activate();
    expect(plugin.createProfile("", "8-10")).toEqual({ ok: false, reason: expect.any(String) });
    expect(plugin.createProfile("   ", "8-10")).toEqual({ ok: false, reason: expect.any(String) });
    expect(plugin.createProfile("一二三四五六七八九十一二三四五六七", "8-10")).toEqual({ ok: false, reason: expect.any(String) });
    expect(plugin.createProfile("  小工程师  ", "8-10").ok).toBe(true);
    expect(plugin.getActiveProfile()?.nickname).toBe("小工程师");
  });

  it("年龄段非法拒绝；created/switched 事件按契约发射", () => {
    const events = new EventBus();
    const created: LearnerProfileCreatedPayload[] = [];
    const switched: LearnerProfileSwitchedPayload[] = [];
    events.on<LearnerProfileCreatedPayload>(LEARNER_EVENTS.created, (e) => created.push(e.payload));
    events.on<LearnerProfileSwitchedPayload>(LEARNER_EVENTS.switched, (e) => switched.push(e.payload));
    const plugin = new LearnerProfilePlugin(events, memoryStore());
    plugin.activate();

    expect(plugin.createProfile("甲", "adult" as never).ok).toBe(false);
    const a = plugin.createProfile("甲", "6-7");
    const b = plugin.createProfile("乙", "13-15");
    if (!a.ok || !b.ok) throw new Error("setup failed");
    plugin.switchProfile(a.profile.id);
    expect(created.map((e) => e.ageBand)).toEqual(["6-7", "13-15"]);
    expect(switched).toEqual([{ profileId: a.profile.id }]);
    expect(plugin.switchProfile("unknown-id")).toBe(false);
  });

  it("存储抛异常（禁用/配额）时不崩溃，仍可内存使用并提示", () => {
    const broken: LearnerStore = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => { throw new Error("SecurityError"); }
    };
    const plugin = new LearnerProfilePlugin(new EventBus(), broken);
    expect(() => plugin.activate()).not.toThrow();
    expect(plugin.createProfile("离线建造者", "8-10").ok).toBe(true);
    expect(plugin.getActiveProfile()?.nickname).toBe("离线建造者");
    expect(plugin.consumeNotice()).toContain("存储");
  });

  it("getActiveProfile 返回副本，外部修改不会污染内部状态", () => {
    const plugin = new LearnerProfilePlugin(new EventBus(), memoryStore());
    plugin.activate();
    plugin.createProfile("甲", "8-10");
    plugin.updateMissionProgress("m1", { status: "completed", hintsUsed: 2 });
    const snapshot = plugin.getActiveProfile()!;
    snapshot.missionProgress["m1"].hintsUsed = 999;
    snapshot.nickname = "篡改";
    expect(plugin.getMissionProgress("m1")?.hintsUsed).toBe(2);
    expect(plugin.getActiveProfile()?.nickname).toBe("甲");
  });

  it("reset 清空档案且不动世界存档 key", () => {
    const store = memoryStore({ "castle-academy-world-v1": "keep-me" });
    const plugin = new LearnerProfilePlugin(new EventBus(), store);
    plugin.activate();
    plugin.createProfile("甲", "8-10");
    plugin.reset();
    expect(plugin.hasProfiles()).toBe(false);
    expect(store.data["castle-academy-world-v1"]).toBe("keep-me");
  });
});
