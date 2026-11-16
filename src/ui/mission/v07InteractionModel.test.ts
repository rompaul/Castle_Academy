import { describe, expect, it } from "vitest";

import type { SwitchObservation } from "../../plugins/electrical/query";
import type { DecisionEntry } from "../../plugins/mission/interactionContracts";
import {
  EXPRESSION_FORMS
} from "../../content/missions/types";
import {
  HYPOTHESIS_LABELS,
  OBSERVATION_LABELS,
  ROUTE_CHOICE_LABELS,
  buildPairRows,
  choicesForStep,
  decisionRows,
  emptyStateText,
  hasForbiddenChildWording,
  isTypingTarget,
  recordedTargets
} from "./v07InteractionModel";

const observation = (
  x: number, state: "open" | "closed", lampPowered: boolean, sequence: number
): SwitchObservation => ({ position: { x, y: 2, z: 3 }, state, lampPowered, sequence });

describe("V07-013~017 形式交互纯函数模型", () => {
  it("typing guard 覆盖 INPUT / TEXTAREA / SELECT / contenteditable，放过按钮", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });

  it("两态对照按位置聚合：同位置成对才算看全，零物理量", () => {
    const rows = buildPairRows([
      observation(1, "closed", true, 1),
      observation(1, "open", false, 2),
      observation(2, "closed", true, 3)
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].both).toBe(true);
    expect(rows[1].both).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/volt|ampere|pressure|flowRate|电压|电流|水压/);
    expect(buildPairRows([])).toEqual([]);
  });

  it("观察去重、按任务过滤；决策按序号取最终选择", () => {
    expect(recordedTargets([
      { missionId: "a", target: "water-source" },
      { missionId: "a", target: "water-source" },
      { missionId: "b", target: "channel-end" }
    ], "a")).toEqual(["water-source"]);

    const decisions: DecisionEntry[] = [
      { missionId: "a", step: 1, choiceId: "near-stream", sequence: 1 },
      { missionId: "a", step: 1, choiceId: "save-material", sequence: 9 },
      { missionId: "a", step: 3, choiceId: "care-garden", sequence: 3 },
      { missionId: "b", step: 2, choiceId: "share-water", sequence: 4 }
    ];
    const rows = decisionRows(decisions, "a", 3, []);
    expect(rows.map((r) => r.choiceId)).toEqual(["save-material", null, "care-garden"]);
    expect(rows[1].label).toBe("还没选");
  });

  it("每步给出 3 个受控选项，标签齐全，六类空态文案无禁用词", () => {
    const choices = Object.keys(ROUTE_CHOICE_LABELS);
    for (let step = 1; step <= 3; step++) {
      const picked = choicesForStep(choices, step);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      expect(picked.every((id) => ROUTE_CHOICE_LABELS[id])).toBe(true);
    }
    expect(Object.keys(OBSERVATION_LABELS)).toHaveLength(3);
    expect(Object.keys(HYPOTHESIS_LABELS)).toHaveLength(3);
    for (const form of EXPRESSION_FORMS) {
      const text = emptyStateText(form);
      expect(text.length, form).toBeGreaterThan(0);
      expect(hasForbiddenChildWording(text), form).toBe(false);
    }
    expect(hasForbiddenChildWording("你的等级提升了")).toBe(true);
    expect(hasForbiddenChildWording("记下三处地方")).toBe(false);
  });
});
