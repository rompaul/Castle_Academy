import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { GridPosition } from "../../core/world/coordinates";
import type { ElectricalQuery, SwitchObservation } from "../electrical/query";
import { EvaluatorRegistry, type EvaluatorQuery } from "./evaluators";
import { V07_EVALUATOR_IDS, V07_MISSION_CONTRACTS } from "../../content/missions/v07MissionContracts";
import {
  INTERACTIVE_EVALUATORS,
  INTERACTIVE_MISSION_IDS,
  OBSERVATION_TARGETS,
  ROUTE_CHOICES,
  STORY_MAP_MARKERS,
  registerInteractiveEvaluators
} from "./interactiveEvaluators";
import type { DecisionEntry, ObservationEntry, VariablePair } from "./interactionContracts";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

interface StubOptions {
  converged?: boolean;
  observations?: ObservationEntry[];
  pairs?: VariablePair[];
  decisions?: DecisionEntry[];
  textEvidence?: ReadonlyMap<string, string>;
  blocks?: string[];
  switchObservations?: SwitchObservation[];
}

function stubQuery(options: StubOptions = {}): EvaluatorQuery {
  const electrical = options.switchObservations
    ? {
      getSwitchObservations: () => options.switchObservations ?? []
    } as unknown as ElectricalQuery
    : undefined;
  return {
    water: {
      hasWater: () => false,
      getWaterCells: () => [],
      isPipeFlowing: () => false,
      isConverged: () => options.converged ?? false
    },
    everWet: new Set<string>(),
    measurementDone: false,
    world: {
      blockAt: () => undefined,
      all: () => (options.blocks ?? []).map((blockId, index) => ({ position: p(index, 1, 0), blockId }))
    },
    textEvidence: options.textEvidence ?? new Map(),
    observationLog: options.observations ?? [],
    variableComparison: options.pairs ?? [],
    decisionSequence: options.decisions ?? [],
    electrical
  };
}

const byId = (id: string) => INTERACTIVE_EVALUATORS.find((e) => e.id === id)!;
const resultKeys = (value: object) => Object.keys(value).sort();

describe("V07-007 六个形式专属纯函数评估器", () => {
  it("与冻结表 1:1，重复注册抛错，EvaluatorResult 保持 3 字段", () => {
    expect(INTERACTIVE_EVALUATORS).toHaveLength(6);
    expect(INTERACTIVE_EVALUATORS.map((e) => e.id)).toEqual(V07_EVALUATOR_IDS);
    expect(INTERACTIVE_MISSION_IDS).toEqual(V07_MISSION_CONTRACTS.map((c) => c.id));
    const registry = new EvaluatorRegistry();
    registerInteractiveEvaluators(registry);
    expect(registry.ids()).toHaveLength(6);
    expect(() => registry.register(byId("evaluator.story-map"))).toThrow(/Duplicate/);

    const empty = stubQuery();
    for (const evaluator of INTERACTIVE_EVALUATORS) {
      const result = evaluator.evaluate(empty);
      expect(resultKeys(result)).toEqual(["complete", "evidence", "progress"]);
      expect(result.complete, evaluator.id).toBe(false);
      expect(result.progress, evaluator.id).toBe(0);
      expect(evaluator.describe(empty).total, evaluator.id).toBeGreaterThan(0);
    }
  });

  it("Exploration：3 个去重后的受控观察点完成，文字内容与重复项不影响", () => {
    const evaluator = byId("evaluator.find-the-pattern");
    const missionId = "mission.find-the-pattern.v1";
    const entries = OBSERVATION_TARGETS.map((target, sequence) => ({ missionId, target, sequence }));
    expect(evaluator.evaluate(stubQuery({ observations: entries })).complete).toBe(true);
    expect(evaluator.describe(stubQuery({ observations: entries }))).toEqual({ done: 3, total: 3 });
    expect(evaluator.evaluate(stubQuery({ observations: [...entries, entries[0]] })).complete).toBe(true);
    expect(evaluator.describe(stubQuery({ observations: entries.slice(0, 2) }))).toEqual({ done: 2, total: 3 });
    expect(evaluator.evaluate(stubQuery({
      observations: [{ missionId: "mission.other.v1", target: "water-source", sequence: 1 }]
    })).complete).toBe(false);
  });

  it("Experiment：同一位置两态且结果不同才完成；不同位置不算成对", () => {
    const evaluator = byId("evaluator.switch-compare");
    const missionId = "mission.switch-compare.v1";
    const pair: VariablePair = {
      missionId,
      position: p(1, 2, 3),
      stateA: "closed",
      stateB: "open",
      outcomeA: true,
      outcomeB: false,
      sequence: 1
    };
    expect(evaluator.evaluate(stubQuery({ pairs: [pair] })).complete).toBe(true);
    expect(evaluator.evaluate(stubQuery({
      pairs: [{ ...pair, outcomeB: true }]
    })).complete).toBe(false);

    const samePlace: SwitchObservation[] = [
      { position: p(4, 5, 6), state: "closed", lampPowered: true, sequence: 1 },
      { position: p(4, 5, 6), state: "open", lampPowered: false, sequence: 2 }
    ];
    expect(evaluator.evaluate(stubQuery({ switchObservations: samePlace })).complete).toBe(true);
    const differentPlaces: SwitchObservation[] = [
      samePlace[0],
      { position: p(9, 5, 6), state: "open", lampPowered: false, sequence: 2 }
    ];
    expect(evaluator.evaluate(stubQuery({ switchObservations: differentPlaces })).complete).toBe(false);
  });

  it("Problem-solving：假设可改、只认最终假设 + 对应验证 + 世界收敛", () => {
    const evaluator = byId("evaluator.why-no-water-here");
    const missionId = "mission.why-no-water-here.v1";
    const decisions: DecisionEntry[] = [
      { missionId, step: 0, choiceId: "source", sequence: 1 },
      { missionId, step: 0, choiceId: "break", sequence: 2 }
    ];
    const observations: ObservationEntry[] = [
      { missionId, target: "check:source", sequence: 1 },
      { missionId, target: "check:break", sequence: 2 }
    ];
    expect(evaluator.evaluate(stubQuery({ decisions, observations, converged: true })).complete).toBe(true);
    // 改假设后旧验证不惩罚，但仍须有与最终假设对应的验证
    expect(evaluator.evaluate(stubQuery({
      decisions: [decisions[1]],
      observations: [observations[0]],
      converged: true
    })).complete).toBe(false);
    expect(evaluator.evaluate(stubQuery({ decisions, observations, converged: false })).complete).toBe(false);
  });

  it("Life simulation：3 个不同步骤各一条受控选择；重复步骤去重", () => {
    const evaluator = byId("evaluator.choose-water-route");
    const missionId = "mission.choose-water-route.v1";
    const decisions: DecisionEntry[] = ROUTE_CHOICES.slice(0, 3)
      .map((choiceId, index) => ({ missionId, step: index + 1, choiceId, sequence: index + 1 }));
    expect(evaluator.evaluate(stubQuery({ decisions })).complete).toBe(true);
    expect(evaluator.describe(stubQuery({ decisions: [...decisions, decisions[0]] }))).toEqual({ done: 3, total: 3 });
    expect(evaluator.describe(stubQuery({ decisions: decisions.slice(0, 2) }))).toEqual({ done: 2, total: 3 });
  });

  it("Communication：只确认有没有留下一段话，长度与内容都不参与判定", () => {
    const evaluator = byId("evaluator.explain-my-choice");
    const missionId = "mission.explain-my-choice.v1";
    expect(evaluator.evaluate(stubQuery({
      textEvidence: new Map([[missionId, "啊"]])
    })).complete).toBe(true);
    expect(evaluator.evaluate(stubQuery({
      textEvidence: new Map([[missionId, "很长很长的一段解释，也不因此更完成"]])
    })).complete).toBe(true);
    expect(evaluator.evaluate(stubQuery({
      textEvidence: new Map([["mission.other.v1", "别人的话"]])
    })).complete).toBe(false);
  });

  it("Creation：3 类既有标记块计数，不评价美观、不排名", () => {
    const evaluator = byId("evaluator.story-map");
    expect(evaluator.evaluate(stubQuery({ blocks: [...STORY_MAP_MARKERS] })).complete).toBe(true);
    expect(evaluator.describe(stubQuery({ blocks: [...STORY_MAP_MARKERS, "grass"] }))).toEqual({ done: 3, total: 3 });
    expect(evaluator.describe(stubQuery({ blocks: STORY_MAP_MARKERS.slice(0, 2) }))).toEqual({ done: 2, total: 3 });
  });

  it("确定性：同输入连续三次结果完全一致；源码无随机 / 时钟 / 网络 / DOM / 存档", () => {
    const query = stubQuery({
      converged: true,
      observations: OBSERVATION_TARGETS.map((target, sequence) => ({
        missionId: "mission.find-the-pattern.v1", target, sequence
      })),
      switchObservations: [
        { position: p(1, 1, 1), state: "closed", lampPowered: true, sequence: 1 },
        { position: p(1, 1, 1), state: "open", lampPowered: false, sequence: 2 }
      ],
      blocks: [...STORY_MAP_MARKERS]
    });
    for (const evaluator of INTERACTIVE_EVALUATORS) {
      const results = [1, 2, 3].map(() => evaluator.evaluate(query));
      expect(results[0], evaluator.id).toEqual(results[1]);
      expect(results[1], evaluator.id).toEqual(results[2]);
    }
    const source = readFileSync(new URL("./interactiveEvaluators.ts", import.meta.url), "utf8");
    for (const pattern of [
      /Math\.random/, /Date\.now/, /new Date\(/, /\bfetch\(/, /localStorage/,
      /window\./, /document\./, /setInterval|setTimeout/
    ]) {
      expect(source, String(pattern)).not.toMatch(pattern);
    }
  });

  it("DEV-703：既有电力评估器同样补上纯函数禁串契约扫描", () => {
    // V0.6.1 既有文件头注释里写了「localStorage」等红线词；扫描只针对可执行代码，
    // 不把文档措辞误判为违规，禁用调用本身零放行（该文件不改一字）。
    const source = readFileSync(new URL("./electricalEvaluators.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(|fetch\(|localStorage|window\./);
  });
});
