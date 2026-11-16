import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import type { GridPosition } from "../../core/world/coordinates";
import { WaterPlugin } from "../../plugins/water/WaterPlugin";
import { MissionRuntimePlugin } from "../../plugins/mission/MissionRuntimePlugin";
import { EvaluatorRegistry } from "../../plugins/mission/evaluators";
import {
  DIAGNOSIS_HYPOTHESES,
  OBSERVATION_TARGETS,
  ROUTE_CHOICES,
  STORY_MAP_MARKERS,
  registerInteractiveEvaluators
} from "../../plugins/mission/interactiveEvaluators";
import type { ElectricalQuery, SwitchObservation } from "../../plugins/electrical/query";
import { V07_MISSIONS } from "../../content/missions/interactiveMissions";
import { buildPairRows } from "./v07InteractionModel";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

/** 不同位置的两态观察：按 V0.6.1 规则不构成「成对」，避免回退路径提前完成。 */
const unpaired: SwitchObservation[] = [
  { position: p(4, 5, 6), state: "closed", lampPowered: true, sequence: 1 },
  { position: p(9, 5, 6), state: "open", lampPowered: false, sequence: 2 }
];
const paired: SwitchObservation[] = [
  { position: p(1, 2, 3), state: "closed", lampPowered: true, sequence: 1 },
  { position: p(1, 2, 3), state: "open", lampPowered: false, sequence: 2 }
];

function setup() {
  const events = new EventBus();
  const water = new WaterPlugin(new WorldState(), events);
  water.activate();
  const registry = new EvaluatorRegistry();
  registerInteractiveEvaluators(registry);
  const runtime = new MissionRuntimePlugin(water, events, {
    missions: V07_MISSIONS,
    evaluators: registry,
    world: {
      blockAt: () => undefined,
      all: () => STORY_MAP_MARKERS.map((blockId, i) => ({ position: p(i, 1, 0), blockId }))
    },
    electrical: () => ({ getSwitchObservations: () => unpaired } as unknown as ElectricalQuery)
  });
  runtime.activate();
  water.refresh();
  for (let i = 0; i < 60; i++) (water as unknown as { tick(): void }).tick();
  runtime.refresh();
  return {
    runtime,
    dispose: () => {
      runtime.dispose();
      water.dispose();
    }
  };
}

describe("V07-013~019 形式交互接线（UI 动作 → 唯一运行时 → 确定性评估器）", () => {
  it("Problem-solving：改猜想可覆盖第 0 步，只有最终假设对应的验证才推进完成", () => {
    const h = setup();
    try {
      const id = "mission.why-no-water-here.v1";
      expect(DIAGNOSIS_HYPOTHESES).toContain("source");
      expect(h.runtime.submitDecision(id, 0, "source")).toBe(true);
      expect(h.runtime.submitDecision(id, 0, "break")).toBe(true);
      expect(h.runtime.getInteractionSnapshot().decisionSequence).toHaveLength(1);
      expect(h.runtime.getInteractionSnapshot().decisionSequence[0]?.choiceId).toBe("break");

      expect(h.runtime.submitObservation(id, "check:source")).toBe(true);
      expect(h.runtime.getMission(id)?.status).not.toBe("completed");
      expect(h.runtime.submitObservation(id, "check:break")).toBe(true);
      expect(h.runtime.getMission(id)?.status).toBe("completed");
    } finally {
      h.dispose();
    }
  });

  it("Experiment：两态行带格子坐标，「记下这组对照」回写后可完成", () => {
    const h = setup();
    try {
      const id = "mission.switch-compare.v1";
      const row = buildPairRows(paired)[0];
      expect(row?.both).toBe(true);
      expect(row?.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(h.runtime.getMission(id)?.status).not.toBe("completed");

      expect(h.runtime.submitVariablePair({
        missionId: id,
        position: row!.position,
        stateA: "closed",
        stateB: "open",
        outcomeA: row!.closedPowered,
        outcomeB: !row!.openUnpowered
      })).toBe(true);
      expect(h.runtime.getMission(id)?.status).toBe("completed");
    } finally {
      h.dispose();
    }
  });

  it("其余四类形式各自的 UI 动作都能走通判定链", () => {
    const h = setup();
    try {
      for (const target of OBSERVATION_TARGETS) {
        expect(h.runtime.submitObservation("mission.find-the-pattern.v1", target)).toBe(true);
      }
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).toBe("completed");

      ROUTE_CHOICES.slice(0, 3).forEach((choiceId, i) => {
        expect(h.runtime.submitDecision("mission.choose-water-route.v1", i + 1, choiceId)).toBe(true);
      });
      expect(h.runtime.getMission("mission.choose-water-route.v1")?.status).toBe("completed");

      expect(h.runtime.submitTextEvidence("mission.explain-my-choice.v1", "我这样选是因为水会往下流")).toBe(true);
      expect(h.runtime.getMission("mission.explain-my-choice.v1")?.status).toBe("completed");
      expect(h.runtime.getMission("mission.story-map.v1")?.status).toBe("completed");
    } finally {
      h.dispose();
    }
  });

  it("反思文本不进判定链；容器接线把假设、两态与反思分别送到正确位置", () => {
    const h = setup();
    try {
      expect(h.runtime.submitReflection("mission.find-the-pattern.v1", "我先看了水源")).toBe(true);
      expect(h.runtime.getReflection("mission.find-the-pattern.v1")).toBe("我先看了水源");
      expect(h.runtime.getInteractionSnapshot().observationLog).toEqual([]);
      expect(h.runtime.getMission("mission.find-the-pattern.v1")?.status).not.toBe("completed");

      const experience = readFileSync(new URL("./MissionExperience.tsx", import.meta.url), "utf8");
      const component = readFileSync(new URL("./V07FormInteractions.tsx", import.meta.url), "utf8");
      expect(experience).toContain("submitHypothesis: (choiceId) => runtime?.submitDecision(missionId, 0, choiceId)");
      expect(experience).toContain("submitVariablePair: (row) => runtime?.submitVariablePair(");
      expect(component).toContain("onSelectHypothesis?.(id)");
      expect(component).toContain("onSubmitPair?.(row)");
    } finally {
      h.dispose();
    }
  });
});
