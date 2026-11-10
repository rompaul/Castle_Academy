import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { WaterPlugin } from "../water/WaterPlugin";
import { buildCastleWaterStage } from "../learning/castleStage";
import { MissionRuntimePlugin } from "./MissionRuntimePlugin";
import { RewardPlugin } from "./RewardPlugin";
import { CapabilityRegistry, createV051Capabilities } from "./CapabilityRegistry";
import {
  MISSION_EVENTS,
  type MissionCompletedPayload,
  type MissionOfferedPayload,
  type MissionRewardGrantedPayload
} from "./events";
import {
  QUEST_COMPLETED_EVENT,
  QUEST_UPDATED_EVENT,
  type QuestCompletedPayload,
  type QuestUpdatedPayload
} from "./evaluators";

const p = (x: number, y: number, z: number) => ({ x, y, z });

describe("V51-007 MissionRuntimePlugin（状态机 + 双事件迁移期）", () => {
  let world: WorldState;
  let events: EventBus;
  let water: WaterPlugin;
  let runtime: MissionRuntimePlugin;
  let reward: RewardPlugin;

  const settle = () => {
    water.refresh();
    for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
    runtime.refresh();
  };

  beforeEach(() => {
    world = new WorldState();
    events = new EventBus();
    water = new WaterPlugin(world, events);
    water.activate();
    reward = new RewardPlugin(events);
    runtime = new MissionRuntimePlugin(water, events, { reward });
  });

  afterEach(() => {
    runtime.dispose();
    water.dispose();
  });

  it("激活时发射 mission.offered 与旧 quest.updated，三任务状态为 available", () => {
    const offered: MissionOfferedPayload[] = [];
    const quests: QuestUpdatedPayload[] = [];
    events.on<MissionOfferedPayload>(MISSION_EVENTS.offered, (e) => offered.push(e.payload));
    events.on<QuestUpdatedPayload>(QUEST_UPDATED_EVENT, (e) => quests.push(e.payload));
    runtime.activate();

    expect(offered.length).toBeGreaterThan(0);
    expect(offered[0].missions).toHaveLength(9);
    expect(offered[0].missions.slice(0, 3).map((m) => m.id)).toEqual([
      "mission.moat.v1", "mission.well.v1", "mission.dungeon.v1"
    ]);
    expect(offered[0].missions.every((m) => m.status === "available")).toBe(true);
    expect(quests.length).toBeGreaterThan(0);
    expect(quests[0].quests.map((q) => q.id)).toEqual(["quest-moat", "quest-well", "quest-dungeon"]);
  });

  it("状态机：available → active，重复激活返回 false，事件按契约发射", () => {
    const activated: string[] = [];
    events.on<{ missionId: string }>(MISSION_EVENTS.activated, (e) => activated.push(e.payload.missionId));
    runtime.activate();
    expect(runtime.activateMission("mission.moat.v1")).toBe(true);
    expect(runtime.activateMission("mission.moat.v1")).toBe(false);
    expect(runtime.getMission("mission.moat.v1")?.status).toBe("active");
    expect(activated).toEqual(["mission.moat.v1"]);
    expect(runtime.activateMission("unknown")).toBe(false);
  });

  it("能力注册表：缺失能力显示「暂不可玩」但不隐藏、不报错（S8 / AC-213）", () => {
    const capabilities = new CapabilityRegistry();
    const custom = new MissionRuntimePlugin(water, events, { capabilities, reward });
    custom.activate();
    const list = custom.getMissions();
    expect(list).toHaveLength(9);
    expect(list.every((m) => m.status === "unavailable")).toBe(true);
    expect(list[0].progressText).toBe("暂不可玩");
    expect(custom.activateMission("mission.moat.v1")).toBe(false);
    expect(custom.getMissingCapabilities("mission.moat.v1")).toEqual(["building.basic", "water.simulation"]);
    custom.dispose();
  });

  it("能力补齐后任务恢复可玩；未注册能力 = 不可用", () => {
    const capabilities = createV051Capabilities();
    capabilities.unregister("measurement.distance");
    const custom = new MissionRuntimePlugin(water, events, { capabilities, reward });
    custom.activate();
    expect(custom.getMission("mission.well.v1")?.status).toBe("unavailable");
    custom.setCapabilityAvailable("measurement.distance", true);
    expect(custom.getMission("mission.well.v1")?.status).toBe("available");
    custom.dispose();
  });

  it("护城河完成：mission.completed / 旧 quest.completed / 奖励各一次，重复刷新幂等（AC-214/215）", () => {
    const completed: MissionCompletedPayload[] = [];
    const legacy: QuestCompletedPayload[] = [];
    const granted: MissionRewardGrantedPayload[] = [];
    events.on<MissionCompletedPayload>(MISSION_EVENTS.completed, (e) => completed.push(e.payload));
    events.on<QuestCompletedPayload>(QUEST_COMPLETED_EVENT, (e) => legacy.push(e.payload));
    events.on<MissionRewardGrantedPayload>(MISSION_EVENTS.rewardGranted, (e) => granted.push(e.payload));
    runtime.activate();

    buildCastleWaterStage((pos, id) => world.place(pos, id));
    for (const pos of [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5)]) {
      world.place(pos, "water_source");
    }
    settle();
    settle(); // 再扰动一次，验证不重复发放

    expect(runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    expect(completed.filter((e) => e.missionId === "mission.moat.v1")).toHaveLength(1);
    expect(completed[0].successMessage).toBe("护城河碧波荡漾，敌军只能望水兴叹！");
    expect(legacy.filter((e) => e.id === "quest-moat")).toHaveLength(1);
    expect(granted).toHaveLength(1);
    expect(granted[0].reward.title).toBe("护城河功臣");
    expect(reward.has("mission.moat.v1")).toBe(true);
  });

  it("水井测量门槛与地牢 everWet 防伪完成在迁移后不回退（AC-216）", () => {
    runtime.activate();
    buildCastleWaterStage((pos, id) => world.place(pos, id));
    world.place(p(7, 2, 0), "water_source");
    settle();
    expect(runtime.getMission("mission.well.v1")?.status).not.toBe("completed");
    events.emit("measurement.used", { tool: "distance" });
    expect(runtime.getMission("mission.well.v1")?.status).toBe("completed");

    // 初始地牢渗水 → 见过水；筑排水渠屏障后完成
    for (let x = -3; x <= 3; x++) world.place(p(x, -3, 0), "drain_channel");
    settle();
    expect(runtime.getMission("mission.dungeon.v1")?.status).toBe("completed");
  });

  it("getQuests() 保持 V0.5 契约形状，进度为平实语言（无百分比）", () => {
    runtime.activate();
    const quests = runtime.getQuests();
    expect(quests).toHaveLength(3);
    expect(quests[0]).toMatchObject({ id: "quest-moat", progress: 0, complete: false });
    const summary = runtime.getMission("mission.moat.v1")!;
    expect(summary.progressText).toContain("已充水");
    expect(summary.progressText).not.toContain("%");
  });

  it("resetEvaluation 清派生记忆但保留已完成状态（D-4）", () => {
    runtime.activate();
    buildCastleWaterStage((pos, id) => world.place(pos, id));
    for (const pos of [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5)]) {
      world.place(pos, "water_source");
    }
    settle();
    expect(runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    runtime.resetEvaluation();
    expect(runtime.getMission("mission.moat.v1")?.status).toBe("completed");
    expect(reward.has("mission.moat.v1")).toBe(true);
  });

  it("提示使用次数只记录不惩罚；used hint 后仍可完成任务", () => {
    runtime.activate();
    expect(runtime.useHint("mission.moat.v1")).toBe(1);
    expect(runtime.useHint("mission.moat.v1")).toBe(2);
    expect(runtime.getHintsUsed("mission.moat.v1")).toBe(2);
    expect(runtime.getMission("mission.moat.v1")?.status).toBe("available");
  });
});

describe("V51-007 RewardPlugin 幂等（AC-214）", () => {
  it("同一任务只授予一次；无奖励定义不授予；restore 后不重复弹窗", () => {
    const events = new EventBus();
    const granted: string[] = [];
    events.on<{ missionId: string }>(MISSION_EVENTS.rewardGranted, (e) => granted.push(e.payload.missionId));
    const reward = new RewardPlugin(events);
    expect(reward.grant("m1", { kind: "title", title: "护城河功臣" })).toBe(true);
    expect(reward.grant("m1", { kind: "title", title: "护城河功臣" })).toBe(false);
    expect(reward.grant("m2", undefined)).toBe(false);
    expect(granted).toEqual(["m1"]);
    reward.restore(["m1"]);
    expect(reward.grant("m1", { kind: "title", title: "护城河功臣" })).toBe(false);
    reward.reset();
    expect(reward.has("m1")).toBe(false);
  });
});
