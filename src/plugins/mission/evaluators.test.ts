import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { WaterPlugin } from "../water/WaterPlugin";
import { buildCastleWaterStage } from "../learning/castleStage";
import {
  QUEST_DEFINITIONS,
  createDefaultEvaluatorRegistry,
  evaluateQuests,
  type EvaluatorQuery
} from "./evaluators";

const p = (x: number, y: number, z: number) => ({ x, y, z });

function harness(): { world: WorldState; water: WaterPlugin; query: () => EvaluatorQuery; settle: () => void; dispose: () => void } {
  const world = new WorldState();
  const water = new WaterPlugin(world, new EventBus());
  water.activate();
  return {
    world,
    water,
    query: () => ({ water: water.getQuery(), everWet: new Set<string>(), measurementDone: false }),
    settle: () => {
      water.refresh();
      for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
    },
    dispose: () => water.dispose()
  };
}

describe("V51-007 评估器注册表（AC-212 确定性）", () => {
  it("注册 3 个首批评估器，ID 与 Content Pack 一致；重复注册报错", () => {
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.ids().sort()).toEqual(["evaluator.dungeon", "evaluator.moat", "evaluator.well"]);
    expect(() => registry.register(registry.get("evaluator.moat")!)).toThrow(/Duplicate/);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("评估器源码无随机 / 时间 / 网络 / DOM 依赖", () => {
    const source = readFileSync(new URL("./evaluators.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(|fetch\(|localStorage|window\./);
  });

  it("同输入同输出：连续评估三次结果一致", () => {
    const h = harness();
    buildCastleWaterStage((pos, id) => h.world.place(pos, id));
    h.world.place(p(5, 1, 0), "water_source");
    h.settle();
    const registry = createDefaultEvaluatorRegistry();
    const results = [1, 2, 3].map(() => registry.ids().map((id) => registry.get(id)!.evaluate(h.query())));
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0][0].progress).toBeGreaterThan(0);
    h.dispose();
  });

  it("迁移等价性：空世界不伪完成地牢，moat 进度 0（AC-210/216）", () => {
    const h = harness();
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.get("evaluator.moat")!.evaluate(h.query())).toEqual({ progress: 0, complete: false });
    expect(registry.get("evaluator.dungeon")!.evaluate(h.query())).toEqual({ progress: 1, complete: false });
    const states = evaluateQuests(h.query().water);
    expect(states).toHaveLength(3);
    expect(states.map((s) => s.id)).toEqual(["quest-moat", "quest-well", "quest-dungeon"]);
    h.dispose();
  });

  it("迁移等价性：护城河多水源完成、水井测量门槛（AC-210/216）", () => {
    const h = harness();
    buildCastleWaterStage((pos, id) => h.world.place(pos, id));
    for (const pos of [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5)]) {
      h.world.place(pos, "water_source");
    }
    h.world.place(p(7, 2, 0), "water_source");
    h.settle();
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.get("evaluator.moat")!.evaluate(h.query()).complete).toBe(true);
    expect(registry.get("evaluator.well")!.evaluate(h.query()).complete).toBe(false);
    expect(registry.get("evaluator.well")!.evaluate({ ...h.query(), measurementDone: true }).complete).toBe(true);
    h.dispose();
  });

  it("describe() 给出平实语言计数，且与判定区域长度一致", () => {
    const h = harness();
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.get("evaluator.moat")!.describe(h.query()).total).toBe(QUEST_DEFINITIONS[0].region.length);
    expect(registry.get("evaluator.well")!.describe(h.query()).total).toBe(2);
    expect(registry.get("evaluator.dungeon")!.describe(h.query()).total).toBe(4);
    h.dispose();
  });

  it("everWet 防伪完成：只有曾见过水的 drain 任务才能完成", () => {
    const h = harness();
    const registry = createDefaultEvaluatorRegistry();
    const dungeon = registry.get("evaluator.dungeon")!;
    expect(dungeon.evaluate(h.query()).complete).toBe(false);
    expect(dungeon.evaluate({ ...h.query(), everWet: new Set(["quest-dungeon"]) }).complete).toBe(true);
    h.dispose();
  });
});
