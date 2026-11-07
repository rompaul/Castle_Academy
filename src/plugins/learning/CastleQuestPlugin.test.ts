import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";
import { WaterPlugin } from "../water/WaterPlugin";
import { buildCastleWaterStage, DUNGEON_SEEP_POSITIONS } from "./castleStage";
import { CastleQuestPlugin } from "./CastleQuestPlugin";
import {
  QUEST_COMPLETED_EVENT,
  QUEST_UPDATED_EVENT,
  evaluateQuests,
  type QuestCompletedPayload,

  type QuestUpdatedPayload
} from "./castleQuests";

const p = (x: number, y: number, z: number) => ({ x, y, z });

function flush(plugin: WaterPlugin, times = 60): void {
  for (let i = 0; i < times; i++) (plugin as unknown as { tick(): void }).tick();
}

/** 直写 WorldState 后显式重算（world.place 不发事件），再 flush 应用 */
function settle(plugin: WaterPlugin): void {
  plugin.refresh();
  flush(plugin);
}

describe("castleStage 舞台构建", () => {
  it("舞台放置全部成功且幂等（重复放置安全）", () => {
    const world = new WorldState();
    let calls = 0;
    buildCastleWaterStage((pos, id) => {
      calls++;
      return world.place(pos, id);
    });
    expect(world.has(DUNGEON_SEEP_POSITIONS[0])).toBe(true);
    expect(world.get(DUNGEON_SEEP_POSITIONS[0])?.blockId).toBe("water_source");
    // 井筒判定格必须是空的（水道）
    expect(world.has(p(7, -2, 0))).toBe(false);
    expect(world.has(p(7, -1, 0))).toBe(false);
    // 井底支撑存在
    expect(world.get(p(7, -3, 0))?.blockId).toBe("stone");
    // 幂等：重放不抛错
    expect(() => buildCastleWaterStage((pos, id) => world.place(pos, id))).not.toThrow();
    expect(calls).toBeGreaterThan(100);
  });
});

describe("evaluateQuests 纯判定", () => {
  it("空世界：fill 任务进度 0，drain 任务未见过水不判完成（防伪完成）", () => {
    const world = new WorldState();
    const water = new WaterPlugin(world, new EventBus());
    water.activate();
    const quests = evaluateQuests(water.getQuery());
    const moat = quests.find((q) => q.id === "quest-moat")!;
    const dungeon = quests.find((q) => q.id === "quest-dungeon")!;
    expect(moat.progress).toBe(0);
    expect(moat.complete).toBe(false);
    // 空世界时地牢本来就没有水——必须"见过水"才允许判定为已排干
    expect(dungeon.complete).toBe(false);
    water.dispose();
  });

  it("护城河区域按充水比例计算进度", () => {
    const world = new WorldState();
    const events = new EventBus();
    const water = new WaterPlugin(world, events);
    water.activate();
    buildCastleWaterStage((pos, id) => world.place(pos, id));
    // 在护城河一角放水源：渠道环上单水源覆盖 ~15/40
    world.place(p(5, 1, 0), "water_source");
    settle(water);
    const quests = evaluateQuests(water.getQuery());
    const moat = quests.find((q) => q.id === "quest-moat")!;
    expect(moat.progress).toBeGreaterThan(0);
    expect(moat.progress).toBeLessThan(0.9);
    expect(moat.complete).toBe(false);
    water.dispose();
  });
});

describe("CastleQuestPlugin（事件层）", () => {
  let world: WorldState;
  let events: EventBus;
  let water: WaterPlugin;
  let quests: CastleQuestPlugin;

  beforeEach(() => {
    world = new WorldState();
    events = new EventBus();
    water = new WaterPlugin(world, events);
    water.activate();
    quests = new CastleQuestPlugin(water, events);
    quests.activate();
  });

  afterEach(() => {
    quests.dispose();
    water.dispose();
  });

  it("激活时发射初始 quest.updated 面板", () => {
    settle(water);
    const payloads: QuestUpdatedPayload[] = [];
    events.on<QuestUpdatedPayload>(QUEST_UPDATED_EVENT, (e) => payloads.push(e.payload));
    const fresh = new CastleQuestPlugin(water, events);
    fresh.activate();
    expect(payloads.length).toBeGreaterThanOrEqual(1);
    expect(payloads[0].quests.length).toBe(3);
    fresh.dispose();
  });

  it("完成地牢任务 → quest.completed 一次性触发 + allCompleted", () => {
    const completions: QuestCompletedPayload[] = [];
    events.on<QuestCompletedPayload>(QUEST_COMPLETED_EVENT, (e) => completions.push(e.payload));
    let allCompleted = 0;
    events.on(ALL_QUESTS_COMPLETE_EVENT_GUARD, () => { allCompleted++; });

    buildCastleWaterStage((pos, id) => world.place(pos, id));
    settle(water); // 渗水源充满地牢水池 → 牢房区湿

    // 玩家在水源与牢房区之间筑排水渠屏障（z=0 一排横跨池内 x=-3..3）
    for (let x = -3; x <= 3; x++) world.place(p(x, -3, 0), "drain_channel");
    settle(water);

    const dungeon = quests.getQuests().find((q) => q.id === "quest-dungeon")!;
    expect(dungeon.complete).toBe(true);
    expect(completions.filter((c) => c.id === "quest-dungeon").length).toBe(1); // 不重复触发

    // 再扰动一次（放/删方块）也不重复完成事件
    world.place(p(0, 5, 5), "stone");
    settle(water);
    expect(completions.filter((c) => c.id === "quest-dungeon").length).toBe(1);
  });

  it("护城河全满 → quest-moat 完成（多水源协同）", () => {
    buildCastleWaterStage((pos, id) => world.place(pos, id));
    settle(water);
    // 环形渠道周长 40，扩散 7：4 个象限水源即可覆盖全部
    for (const pos of [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5)]) {
      world.place(pos, "water_source");
    }
    settle(water);
    const moat = quests.getQuests().find((q) => q.id === "quest-moat")!;
    expect(moat.complete).toBe(true);
    expect(moat.progress).toBe(1);
  });

  it("水井任务：塔顶放水源灌满井筒", () => {
    buildCastleWaterStage((pos, id) => world.place(pos, id));
    settle(water);
    world.place(p(7, 2, 0), "water_source");
    settle(water);
    const well = quests.getQuests().find((q) => q.id === "quest-well")!;
    expect(well.complete).toBe(true);
  });
});

import { ALL_QUESTS_COMPLETE_EVENT as ALL_QUESTS_COMPLETE_EVENT_GUARD } from "./castleQuests";
// allCompleted 事件名从 castleQuests 导入（避免字符串漂移）
