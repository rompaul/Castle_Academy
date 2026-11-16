import { describe, expect, it } from "vitest";

import type { GridPosition } from "../../core/world/coordinates";
import type { EvaluatorQuery } from "./evaluators";
import {
  DECISION_SEQUENCE_LIMIT,
  INTERACTION_OVERFLOW_POLICY,
  INTERACTION_RECORD_LIMIT,
  InteractionRecords,
  OBSERVATION_LOG_LIMIT,
  VARIABLE_COMPARISON_LIMIT
} from "./interactionRecords";
import { INTERACTIVE_EVALUATORS, OBSERVATION_TARGETS, ROUTE_CHOICES, STORY_MAP_MARKERS } from "./interactiveEvaluators";
import type { DecisionEntry, ObservationEntry, VariablePair } from "./interactionContracts";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

interface Channels {
  observationLog: ObservationEntry[];
  variableComparison: VariablePair[];
  decisionSequence: DecisionEntry[];
}

function completedChannels(): Channels {
  const observationLog: ObservationEntry[] = [
    ...OBSERVATION_TARGETS.map((target, index) => ({
      missionId: "mission.find-the-pattern.v1", target, sequence: index + 1
    })),
    { missionId: "mission.why-no-water-here.v1", target: "check:break", sequence: 4 }
  ];
  const variableComparison: VariablePair[] = [{
    missionId: "mission.switch-compare.v1",
    position: p(1, 2, 3),
    stateA: "closed",
    stateB: "open",
    outcomeA: true,
    outcomeB: false,
    sequence: 5
  }];
  const decisionSequence: DecisionEntry[] = [
    { missionId: "mission.why-no-water-here.v1", step: 0, choiceId: "source", sequence: 6 },
    { missionId: "mission.why-no-water-here.v1", step: 0, choiceId: "break", sequence: 7 },
    ...ROUTE_CHOICES.slice(0, 3).map((choiceId, index) => ({
      missionId: "mission.choose-water-route.v1", step: index + 1, choiceId, sequence: 8 + index
    }))
  ];
  return { observationLog, variableComparison, decisionSequence };
}

function query(channels: Channels): EvaluatorQuery {
  return {
    water: {
      hasWater: () => false,
      getWaterCells: () => [],
      isPipeFlowing: () => false,
      isConverged: () => true
    },
    everWet: new Set<string>(),
    measurementDone: false,
    world: {
      blockAt: () => undefined,
      all: () => STORY_MAP_MARKERS.map((blockId, index) => ({ position: p(index, 1, 0), blockId }))
    },
    textEvidence: new Map([["mission.explain-my-choice.v1", "我这样选是因为先看到了水沟"]]),
    observationLog: channels.observationLog,
    variableComparison: channels.variableComparison,
    decisionSequence: channels.decisionSequence
  };
}

describe("V07-009 有界性与溢出策略冻结（AC-7032）", () => {
  it("三个通道各有显式上限常量，策略冻结为丢弃最旧", () => {
    expect(OBSERVATION_LOG_LIMIT).toBe(128);
    expect(VARIABLE_COMPARISON_LIMIT).toBe(128);
    expect(DECISION_SEQUENCE_LIMIT).toBe(128);
    expect(INTERACTION_RECORD_LIMIT).toBe(128);
    expect(INTERACTION_OVERFLOW_POLICY).toBe("drop-oldest");
  });

  it("默认实例三通道各 129 条：上限 128、丢弃最旧、序号仍单调", () => {
    const records = new InteractionRecords();
    for (let i = 0; i < 129; i++) {
      expect(records.addObservation("mission.find-the-pattern.v1", `target-${i}`)).toBe(true);
      expect(records.addVariablePair({
        missionId: "mission.switch-compare.v1",
        position: p(i, 2, 3),
        stateA: "closed",
        stateB: "open",
        outcomeA: true,
        outcomeB: false
      })).toBe(true);
      expect(records.addDecision("mission.choose-water-route.v1", i + 1, ROUTE_CHOICES[i % ROUTE_CHOICES.length])).toBe(true);
    }
    const snapshot = records.snapshot();
    expect(snapshot.observationLog).toHaveLength(OBSERVATION_LOG_LIMIT);
    expect(snapshot.variableComparison).toHaveLength(VARIABLE_COMPARISON_LIMIT);
    expect(snapshot.decisionSequence).toHaveLength(DECISION_SEQUENCE_LIMIT);
    expect(snapshot.observationLog[0].target).toBe("target-1");
    expect(snapshot.variableComparison[0].position.x).toBe(1);
    expect(snapshot.decisionSequence[0].step).toBe(2);
    const sequences = snapshot.observationLog.map((o) => o.sequence);
    expect([...sequences].sort((a, b) => a - b)).toEqual(sequences);
    expect(Object.isFrozen(snapshot.observationLog)).toBe(true);
  });

  it("插入顺序置换后，六个评估器的 complete / progress / describe 完全一致", () => {
    const base = completedChannels();
    const baseQuery = query(base);
    // 完成态基线：六个评估器都应可完成
    for (const evaluator of INTERACTIVE_EVALUATORS) {
      expect(evaluator.evaluate(baseQuery).complete, evaluator.id).toBe(true);
    }

    const permuted = query({
      observationLog: [...base.observationLog].reverse(),
      variableComparison: [...base.variableComparison].reverse(),
      decisionSequence: [...base.decisionSequence].reverse()
    });
    for (const evaluator of INTERACTIVE_EVALUATORS) {
      expect(evaluator.evaluate(permuted), evaluator.id).toEqual(evaluator.evaluate(baseQuery));
      expect(evaluator.describe(permuted), evaluator.id).toEqual(evaluator.describe(baseQuery));
    }
  });

  it("溢出后仍保持完成态判定：只保留最新的有界记录，不因淘汰丢判定依据", () => {
    const base = completedChannels();
    const extra: ObservationEntry[] = Array.from({ length: 140 }, (_, i) => ({
      missionId: "mission.find-the-pattern.v1",
      target: `extra-${i}`,
      sequence: 100 + i
    }));
    const overflowQuery = query({ ...base, observationLog: [...extra, ...base.observationLog] });
    // 评估器只读传入的有界快照；记录容器负责淘汰，评估器不自行截断
    const evaluator = INTERACTIVE_EVALUATORS.find((e) => e.id === "evaluator.find-the-pattern")!;
    expect(evaluator.evaluate(overflowQuery).complete).toBe(true);
  });
});
