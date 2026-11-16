import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { GridPosition } from "../../core/world/coordinates";
import {
  EMPTY_INTERACTION_SNAPSHOT,
  toInteractionSnapshot,
  type DecisionEntry,
  type ObservationEntry,
  type VariablePair
} from "./interactionContracts";
import { createDefaultEvaluatorRegistry, type EvaluatorQuery } from "./evaluators";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

describe("V07-004 只读交互通道契约（ADR-0014 决策 4）", () => {
  it("三个通道都是冻结的只读快照，条目与位置对象也不可写", () => {
    const observation: ObservationEntry = {
      missionId: "mission.observation.v1",
      target: "lamp",
      position: p(1, 2, 3),
      sequence: 1
    };
    const pair: VariablePair = {
      missionId: "mission.experiment.v1",
      position: p(4, 5, 6),
      stateA: "closed",
      stateB: "open",
      outcomeA: true,
      outcomeB: false,
      sequence: 2
    };
    const decision: DecisionEntry = {
      missionId: "mission.decision.v1",
      step: 1,
      choiceId: "share-water",
      sequence: 3
    };

    const snapshot = toInteractionSnapshot({
      observationLog: [observation],
      variableComparison: [pair],
      decisionSequence: [decision]
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    for (const channel of [
      snapshot.observationLog,
      snapshot.variableComparison,
      snapshot.decisionSequence
    ]) {
      expect(Object.isFrozen(channel)).toBe(true);
    }
    expect(Object.isFrozen(snapshot.observationLog[0])).toBe(true);
    expect(Object.isFrozen(snapshot.observationLog[0].position)).toBe(true);
    expect(Object.isFrozen(snapshot.variableComparison[0].position)).toBe(true);
    // 快照与输入零共享：外部持有可变记录也写不回评估器看到的数据
    expect(snapshot.observationLog[0]).not.toBe(observation);
    expect(() => {
      (snapshot.decisionSequence[0] as unknown as { choiceId: string }).choiceId = "changed";
    }).toThrow(TypeError);
    expect(() => {
      (snapshot.observationLog[0].position as unknown as { x: number }).x = 99;
    }).toThrow(TypeError);
    expect(observation.position?.x).toBe(1);
  });

  it("纯函数：不修改输入、不共享引用、同一输入结果一致", () => {
    const entries: ObservationEntry[] = [
      { missionId: "mission.observation.v1", target: "gate", sequence: 1 }
    ];
    const source = { observationLog: entries };
    const first = toInteractionSnapshot(source);
    const second = toInteractionSnapshot(source);

    expect(entries).toHaveLength(1);
    expect(entries[0].target).toBe("gate");
    expect(first).not.toBe(second);
    expect(first.observationLog).toEqual(second.observationLog);
    expect(first.variableComparison).toEqual([]);
    expect(first.decisionSequence).toEqual([]);
  });

  it("未注入通道时返回冻结空快照", () => {
    const snapshot = toInteractionSnapshot();
    expect(snapshot.observationLog).toEqual([]);
    expect(snapshot.variableComparison).toEqual([]);
    expect(snapshot.decisionSequence).toEqual([]);
    expect(snapshot).toEqual(EMPTY_INTERACTION_SNAPSHOT);
    expect(Object.isFrozen(EMPTY_INTERACTION_SNAPSHOT.observationLog)).toBe(true);
  });

  it("契约模块不含 UI / 渲染 / 时钟 / 网络 / 持久化依赖", () => {
    const source = readFileSync(new URL("./interactionContracts.ts", import.meta.url), "utf8");
    const forbidden = [
      /Math\.random/,
      /Date\.now/,
      /\bfetch\(/,
      /localStorage/,
      /window\./,
      /document\./,
      /from ["']react/,
      /from ["']three/,
      /setInterval|setTimeout/
    ];
    for (const pattern of forbidden) {
      expect(source, String(pattern)).not.toMatch(pattern);
    }
  });

  it("EvaluatorQuery 三个通道为可选：既有评估器 query 构造点零改动仍可判定", () => {
    const legacyQuery: EvaluatorQuery = {
      water: {
        hasWater: () => false,
        getWaterCells: () => [],
        isPipeFlowing: () => false,
        isConverged: () => true
      },
      everWet: new Set<string>(),
      measurementDone: false
    };
    const registry = createDefaultEvaluatorRegistry();
    const moat = registry.get("evaluator.moat")!;
    expect(moat.evaluate(legacyQuery)).toMatchObject({ progress: 0, complete: false });
    expect(moat.describe(legacyQuery)).toMatchObject({ done: 0, total: expect.any(Number) });
    expect(registry.ids()).toHaveLength(24); // V07-021：同一注册表追加 6 个形式评估器
  });
});
