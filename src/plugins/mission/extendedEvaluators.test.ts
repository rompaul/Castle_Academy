import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { GridPosition } from "../../core/world/coordinates";
import { ALL_MISSIONS, WATER_EXTENSION_MISSIONS } from "../../content/missions";
import { validateMissionDefinition } from "../../content/missions/types";
import { createDefaultEvaluatorRegistry, type EvaluatorQuery } from "./evaluators";
import { WATER_EXTENSION_EVALUATORS } from "./extendedEvaluators";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

interface StubOptions {
  blocks?: Array<{ position: GridPosition; blockId: string }>;
  water?: GridPosition[];
  flowing?: GridPosition[];
}

/** 纯内存 stub：不依赖 Three.js / DOM / 时钟，保证评估器输入输出可完全控制。 */
function stubQuery(options: StubOptions = {}): EvaluatorQuery {
  const blocks = options.blocks ?? [];
  const cells = options.water ?? [];
  const flowing = new Set((options.flowing ?? []).map((c) => `${c.x},${c.y},${c.z}`));
  const wet = new Set(cells.map((c) => `${c.x},${c.y},${c.z}`));
  return {
    water: {
      hasWater: (position) => wet.has(`${position.x},${position.y},${position.z}`),
      getWaterCells: () => cells.map((c) => ({ ...c })),
      isPipeFlowing: (position) => flowing.has(`${position.x},${position.y},${position.z}`),
      isConverged: () => true
    },
    everWet: new Set<string>(),
    measurementDone: false,
    world: {
      blockAt: (position) => blocks.find(
        (b) => b.position.x === position.x && b.position.y === position.y && b.position.z === position.z
      )?.blockId,
      all: () => blocks
    },
    textEvidence: new Map(),
    sectionEnabled: false
  };
}

const byId = (id: string) => WATER_EXTENSION_EVALUATORS.find((e) => e.id === id)!;

describe("V51-015 批次 1 内容质量（AC-230/231）", () => {
  it("6 个新任务全部通过 LEARNING_MODEL §6 内容质量清单", () => {
    expect(WATER_EXTENSION_MISSIONS).toHaveLength(6);
    for (const mission of WATER_EXTENSION_MISSIONS) {
      expect(validateMissionDefinition(mission), mission.id).toEqual({ ok: true });
      expect(mission.hintLadder.length).toBeGreaterThanOrEqual(2);
      expect(mission.progressLanguage).toContain("{done}");
      expect(mission.progressLanguage).not.toContain("%");
      expect(mission.reward?.kind).toBe("title");
      expect(JSON.stringify(mission)).not.toContain("unlockBlock"); // PD-003 不锁资源
    }
  });

  it("ID / evaluatorId 全仓唯一，且注册表中都有对应确定性评估器", () => {
    const ids = ALL_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const evaluatorIds = ALL_MISSIONS.map((m) => m.evaluatorId);
    expect(new Set(evaluatorIds).size).toBe(evaluatorIds.length);
    const registry = createDefaultEvaluatorRegistry();
    for (const mission of WATER_EXTENSION_MISSIONS) {
      expect(registry.has(mission.evaluatorId), mission.id).toBe(true);
    }
  });

  it("批次 1 已覆盖 3 个年龄带、4 种表达形式（AC-231 阶段性证据）", () => {
    const ages = new Set(WATER_EXTENSION_MISSIONS.map((m) => m.ageScope));
    expect(ages.size).toBeGreaterThanOrEqual(3);
    const forms = new Set(WATER_EXTENSION_MISSIONS.flatMap((m) => m.expressionForms));
    expect(forms.size).toBeGreaterThanOrEqual(3);
  });

  it("迁移三任务仍排在 Content Pack 最前，V0.5 顺序契约不变", () => {
    expect(ALL_MISSIONS.slice(0, 3).map((m) => m.id)).toEqual([
      "mission.moat.v1", "mission.well.v1", "mission.dungeon.v1"
    ]);
  });
});

describe("V51-015 批次 1 评估器（AC-212 确定性）", () => {
  it("源码无随机 / 时间 / 网络 / DOM / 存档依赖", () => {
    const source = readFileSync(new URL("./extendedEvaluators.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, ""); // 注释里的说明文字不算代码依赖
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(|fetch\(|localStorage|window\./);
  });

  it("空查询下 6 个评估器都不完成，且进度为 0（种子世界不伪完成）", () => {
    const query = stubQuery();
    for (const evaluator of WATER_EXTENSION_EVALUATORS) {
      const evaluated = evaluator.evaluate(query);
      expect(evaluated.complete, evaluator.id).toBe(false);
      expect(evaluated.progress, evaluator.id).toBe(0);
    }
  });

  it("未注入 world 快照时降级为 0 进度，不抛错", () => {
    const query = stubQuery();
    delete (query as { world?: unknown }).world;
    for (const evaluator of WATER_EXTENSION_EVALUATORS) {
      expect(() => evaluator.evaluate(query)).not.toThrow();
      expect(evaluator.evaluate(query).complete).toBe(false);
    }
  });

  it("同输入连续评估三次结果完全一致", () => {
    const query = stubQuery({
      blocks: [{ position: p(1, 3, 1), blockId: "water_source" }],
      water: [p(0, 1, 0), p(1, 1, 0), p(0, -3, 0)]
    });
    for (const evaluator of WATER_EXTENSION_EVALUATORS) {
      const results = [1, 2, 3].map(() => evaluator.evaluate(query));
      expect(results[0], evaluator.id).toEqual(results[1]);
      expect(results[1], evaluator.id).toEqual(results[2]);
    }
  });

  it("每个评估器都有可达的完成路径，describe 与 evaluate 一致", () => {
    const courtyardWater = Array.from({ length: 7 }, (_, i) => p(i - 3, 1, 0));
    const upperWater = Array.from({ length: 12 }, (_, i) => p((i % 4) - 2, 2, Math.floor(i / 4) - 1));
    // 结构性门槛：内院地板（y=0 铺 6 格 / y=1 搭 8 格平台）
    const courtyardFloor = Array.from({ length: 6 }, (_, i) => ({ position: p(i - 3, 0, 0), blockId: "stone" }));
    const upperPlatform = Array.from({ length: 8 }, (_, i) => ({ position: p((i % 4) - 2, 1, Math.floor(i / 4)), blockId: "stone" }));
    const pipes = [p(0, 1, 0), p(1, 1, 0), p(2, 1, 0)].map((position) => ({ position, blockId: "water_pipe_blue" }));
    const cases: Array<{ id: string; query: EvaluatorQuery }> = [
      {
        id: "evaluator.water-flow",
        query: stubQuery({
          blocks: [{ position: p(0, 3, 0), blockId: "water_source" }],
          water: [p(0, -3, 0)]
        })
      },
      { id: "evaluator.seven-steps", query: stubQuery({ blocks: courtyardFloor, water: courtyardWater }) },
      {
        id: "evaluator.channel-dam",
        query: stubQuery({
          blocks: [
            { position: p(0, 1, 0), blockId: "drain_channel" },
            ...[0, 1, 2].map((i) => ({ position: p(i, 2, 0), blockId: "brick" }))
          ]
        })
      },
      {
        id: "evaluator.garden-water",
        query: stubQuery({
          blocks: [{ position: p(0, 1, 0), blockId: "water_source" }],
          water: courtyardWater.slice(0, 3)
        })
      },
      { id: "evaluator.broken-pipe", query: stubQuery({ blocks: pipes, flowing: [p(1, 1, 0)] }) },
      { id: "evaluator.reservoir", query: stubQuery({ blocks: upperPlatform, water: upperWater }) }
    ];
    for (const testCase of cases) {
      const evaluator = byId(testCase.id);
      const evaluated = evaluator.evaluate(testCase.query);
      expect(evaluated.complete, testCase.id).toBe(true);
      expect(evaluated.progress, testCase.id).toBe(1);
      const described = evaluator.describe(testCase.query);
      expect(described.done, testCase.id).toBe(described.total);
      expect(described.total, testCase.id).toBeGreaterThan(0);
    }
  });

  it("内院水格必须先有玩家自建地板才算数（防止高处水源掉落误完成）", () => {
    const courtyardWater = Array.from({ length: 12 }, (_, i) => p((i % 4) - 2, 1, Math.floor(i / 4) - 1));
    const query = stubQuery({ water: courtyardWater });
    for (const id of ["evaluator.seven-steps", "evaluator.garden-water", "evaluator.reservoir"]) {
      const evaluator = byId(id);
      expect(evaluator.evaluate(query).complete, id).toBe(false);
      expect(evaluator.evaluate(query).progress, id).toBe(0);
      expect(evaluator.describe(query).done, id).toBe(0);
    }
  });

  it("V0.5 护城河完成动作 + 追加高处水源都不会误触发新任务完成", () => {
    // 复刻 water-quests / reward E2E 的四个水源，以及幂等用例追加的 (5,2,0)
    const moatSources = [p(5, 1, 0), p(-5, 1, 0), p(0, 1, 5), p(0, 1, -5), p(5, 2, 0)]
      .map((position) => ({ position, blockId: "water_source" }));
    const moatWater = Array.from({ length: 30 }, (_, i) => p(5, 1, i - 15));
    const query = stubQuery({ blocks: moatSources, water: [...moatWater, p(2, -3, 2)] });
    for (const evaluator of WATER_EXTENSION_EVALUATORS) {
      expect(evaluator.evaluate(query).complete, evaluator.id).toBe(false);
    }
  });
});
