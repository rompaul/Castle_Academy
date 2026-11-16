import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { V07_MISSIONS } from "./interactiveMissions";
import { EXPRESSION_FORMS, validateMissionDefinition, type MissionDefinition } from "./types";
import { V07_MISSION_CONTRACTS } from "./v07MissionContracts";
import { ALL_MISSIONS } from "./index";
import { isRegisteredKnowledgePoint, KNOWLEDGE_POINTS } from "../knowledge/registry";
import { createV051Capabilities } from "../../plugins/mission/CapabilityRegistry";
import { INTERACTIVE_EVALUATORS } from "../../plugins/mission/interactiveEvaluators";

const CHILD_FORBIDDEN = /等级|难度|年级|百分比|Tier|掌握度|红石|正确率|星级|得分|扣分|分数/;

function visibleText(mission: MissionDefinition): string {
  return [
    mission.title, mission.context, mission.goal, ...mission.hintLadder,
    mission.successMessage, mission.learningGoal, mission.reflectionPrompt,
    mission.accessibilityNote, mission.progressLanguage, mission.unavailableReason,
    mission.reward?.title ?? ""
  ].join("\n");
}

describe("V07-008 六个新任务内容（schema v2，纯数据）", () => {
  it("6 个任务全部通过 validateMissionDefinition()，全部 schemaVersion 2", () => {
    expect(V07_MISSIONS).toHaveLength(6);
    for (const mission of V07_MISSIONS) {
      expect(validateMissionDefinition(mission), mission.id).toEqual({ ok: true });
      expect(mission.schemaVersion, mission.id).toBe(2);
      expect(mission.version, mission.id).toBe(1);
    }
  });

  it("V07-021 已接入唯一入口：24 个任务零重复，新 6 个只追加在末尾，评估器 1:1", () => {
    expect(ALL_MISSIONS).toHaveLength(24);
    expect(new Set(ALL_MISSIONS.map((m) => m.id)).size).toBe(24);
    expect(ALL_MISSIONS.slice(18).map((m) => m.id)).toEqual(V07_MISSION_CONTRACTS.map((c) => c.id));
    expect(V07_MISSIONS.map((m) => m.evaluatorId)).toEqual(INTERACTIVE_EVALUATORS.map((e) => e.id));
    const legacy = ALL_MISSIONS.slice(0, 18).map((m) => m.id);
    for (const mission of V07_MISSIONS) {
      expect(legacy, mission.id).not.toContain(mission.id);
    }
  });

  it("知识点引用逐条等于冻结映射，全部命中已注册 24 个 ID，零编造", () => {
    expect(KNOWLEDGE_POINTS).toHaveLength(24);
    V07_MISSIONS.forEach((mission, index) => {
      expect(mission.knowledgePointIds, mission.id).toEqual(
        [...V07_MISSION_CONTRACTS[index].knowledgePointIds]
      );
      for (const id of mission.knowledgePointIds ?? []) {
        expect(isRegisteredKnowledgePoint(id), `${mission.id} -> ${id}`).toBe(true);
      }
    });
  });

  it("六类主形式全覆盖；life-simulation 与 communication 都有真实任务", () => {
    const primary = V07_MISSIONS.map((m) => m.expressionForms[0]);
    expect(new Set(primary).size).toBe(6);
    expect([...primary].sort()).toEqual([...EXPRESSION_FORMS].sort());
    expect(primary).toContain("life-simulation");
    expect(primary).toContain("communication");
    for (const mission of V07_MISSIONS) {
      expect(mission.expressionForms.every((form) => EXPRESSION_FORMS.includes(form)), mission.id).toBe(true);
    }
  });

  it("每任务恰好 3 级提示，4 个年龄档全覆盖，能力全部已注册", () => {
    const capabilities = createV051Capabilities();
    for (const mission of V07_MISSIONS) {
      expect(mission.hintLadder, mission.id).toHaveLength(3);
      expect(mission.hintLadder.every((h) => h.trim().length > 0), mission.id).toBe(true);
      expect(capabilities.missing(mission.requiredCapabilities), mission.id).toEqual([]);
      expect(mission.progressLanguage, mission.id).toContain("{done}");
      expect(mission.reflectionPrompt.trim(), mission.id).not.toBe("");
      expect(mission.accessibilityNote.trim(), mission.id).not.toBe("");
      expect(mission.unavailableReason.trim(), mission.id).not.toBe("");
    }
    expect(new Set(V07_MISSIONS.map((m) => m.ageScope))).toEqual(
      new Set(["6-7", "8-10", "11-12", "13-15"])
    );
  });

  it("儿童可见文案禁用词 0 命中；统一用「电」，无真实数值与识别性术语", () => {
    for (const mission of V07_MISSIONS) {
      expect(visibleText(mission), mission.id).not.toMatch(CHILD_FORBIDDEN);
    }
  });

  it("V07-011 只新增 1 条链，其余先决条件为空；纯数据模块零副作用", () => {
    expect(V07_MISSIONS.filter((m) => m.prerequisiteMissionIds.length > 0)).toHaveLength(1);
    expect(V07_MISSIONS.find((m) => m.id === "mission.choose-water-route.v1")?.prerequisiteMissionIds)
      .toEqual(["mission.find-the-pattern.v1"]);
    const source = readFileSync(new URL("./interactiveMissions.ts", import.meta.url), "utf8");
    for (const pattern of [
      /Math\.random/, /Date\.now/, /new Date\(/, /\bfetch\(/, /localStorage/,
      /window\./, /document\./, /schemaVersion:\s*3/, /from ["']react/, /from ["']three/
    ]) {
      expect(source, String(pattern)).not.toMatch(pattern);
    }
  });
});
