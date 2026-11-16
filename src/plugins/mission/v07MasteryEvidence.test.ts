import { describe, expect, it } from "vitest";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { WaterPlugin } from "../water/WaterPlugin";
import type { MasteryEvidenceRecord, MissionProgressEntry } from "../learner/types";
import { MissionRuntimePlugin } from "./MissionRuntimePlugin";
import { EvaluatorRegistry } from "./evaluators";
import type { MissionProgressStore } from "./CapabilityRegistry";
import { INTERACTIVE_EVALUATORS, OBSERVATION_TARGETS, registerInteractiveEvaluators } from "./interactiveEvaluators";
import { V07_MISSIONS } from "../../content/missions/interactiveMissions";

class RecordingStore implements MissionProgressStore {
  readonly saved = new Map<string, Partial<MissionProgressEntry>>();
  readonly evidence: MasteryEvidenceRecord[] = [];

  get(missionId: string): MissionProgressEntry | null {
    return (this.saved.get(missionId) as MissionProgressEntry | undefined) ?? null;
  }

  set(missionId: string, entry: Partial<MissionProgressEntry>): void {
    this.saved.set(missionId, { ...this.saved.get(missionId), ...entry });
  }

  recordMasteryEvidence(records: readonly MasteryEvidenceRecord[]): void {
    this.evidence.push(...records);
  }
}

function setup() {
  const world = new WorldState();
  const events = new EventBus();
  const water = new WaterPlugin(world, events);
  water.activate();
  const registry = new EvaluatorRegistry();
  registerInteractiveEvaluators(registry);
  const store = new RecordingStore();
  const runtime = new MissionRuntimePlugin(water, events, {
    missions: V07_MISSIONS,
    evaluators: registry,
    progressStore: store
  });
  runtime.activate();
  water.refresh();
  for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
  runtime.refresh();
  return {
    runtime,
    store,
    dispose: () => {
      runtime.dispose();
      water.dispose();
    }
  };
}

const EVIDENCE_FIELDS = ["completedAt", "evaluatorId", "knowledgePointId", "missionId", "observation"];

describe("V07-012 掌握证据写回链回归（ADR-0010 / AC-7030）", () => {
  it("完成 Exploration 任务按知识点只追加 2 条记录，5 字段不变、确定性观察摘要", () => {
    const h = setup();
    try {
      for (const target of OBSERVATION_TARGETS) {
        expect(h.runtime.submitObservation("mission.find-the-pattern.v1", target)).toBe(true);
      }
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).toBe("completed");
      expect(h.store.evidence).toHaveLength(2);
      for (const record of h.store.evidence) {
        expect(Object.keys(record).sort()).toEqual(EVIDENCE_FIELDS);
        expect(record.missionId).toBe("mission.find-the-pattern.v1");
        expect(record.evaluatorId).toBe("evaluator.find-the-pattern");
        expect(record.observation).toBe("3/3");
        expect(record.knowledgePointId).toMatch(/^kp\./);
        expect(record.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
      // 只追加、不去重、不降级：重复提交不再追加，也不回退完成态
      h.runtime.submitObservation("mission.find-the-pattern.v1", "moat-side");
      h.runtime.refresh();
      expect(h.store.evidence).toHaveLength(2);
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).toBe("completed");
    } finally {
      h.dispose();
    }
  });

  it("自由文本不进证据链：Communication 任务完成后 observation 仍是确定性计数", () => {
    const h = setup();
    try {
      const text = "我先看了水沟，放弃了近的那条路，所以我就选了照顾花园的走法，理由写在这里很长很长。";
      expect(h.runtime.submitTextEvidence("mission.explain-my-choice.v1", text)).toBe(true);
      expect(h.runtime.getMission("mission.explain-my-choice.v1")?.status).toBe("completed");
      const records = h.store.evidence.filter((r) => r.missionId === "mission.explain-my-choice.v1");
      expect(records).toHaveLength(2);
      for (const record of records) {
        expect(record.observation).toBe("1/1");
        expect(record.observation).not.toContain(text);
        expect(Object.keys(record).sort()).toEqual(EVIDENCE_FIELDS);
      }
      // 完成态不因文本变长 / 变短而降级，也不因读档重置重新发奖
      h.runtime.submitTextEvidence("mission.explain-my-choice.v1", "短");
      expect(h.store.evidence.filter((r) => r.missionId === "mission.explain-my-choice.v1")).toHaveLength(2);
    } finally {
      h.dispose();
    }
  });

  it("六个新评估器与六个新任务 1:1，判定链不消费反思文本", () => {
    expect(INTERACTIVE_EVALUATORS).toHaveLength(V07_MISSIONS.length);
    expect(V07_MISSIONS.map((m) => m.evaluatorId).sort())
      .toEqual(INTERACTIVE_EVALUATORS.map((e) => e.id).sort());
  });
});
