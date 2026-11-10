import { describe, expect, it } from "vitest";

import { QUEST_DEFINITIONS } from "../../plugins/learning/castleQuests";
import { DUNGEON_DRY_CELLS, MOAT_FLOOR_CELLS, WELL_SHAFT_CELLS } from "../../plugins/learning/castleStage";
import {
  CASTLE_WATER_MISSIONS,
  LEGACY_QUEST_ID_BY_MISSION,
  MISSION_ID_BY_LEGACY_QUEST
} from "./castleWaterMissions";
import { ALL_MISSIONS, getMissionById, getMissionByEvaluatorId } from "./index";
import { validateMissionDefinition, type MissionDefinition } from "./types";

describe("V51-006 MissionDefinition schema 校验（AC-230）", () => {
  it("首批三任务全部通过内容质量清单", () => {
    for (const mission of CASTLE_WATER_MISSIONS) {
      expect(validateMissionDefinition(mission), mission.id).toEqual({ ok: true });
    }
  });

  it("缺字段 / 非法枚举 / 非法 id / progressLanguage 无占位符都被拒绝并列出原因", () => {
    const base = CASTLE_WATER_MISSIONS[0] as unknown as Record<string, unknown>;
    const cases: Array<Record<string, unknown>> = [
      { ...base, title: "" },
      { ...base, version: 0 },
      { ...base, id: "quest-moat" },
      { ...base, evaluatorId: "moat" },
      { ...base, ageScope: "adult" },
      { ...base, expressionForms: ["magic"] },
      { ...base, hintLadder: [] },
      { ...base, requiredCapabilities: [3] },
      { ...base, reward: { kind: "coins", title: "x" } },
      { ...base, progressLanguage: "完成度 70%" },
      { ...base, learningGoal: "  " }
    ];
    for (const bad of cases) {
      const result = validateMissionDefinition(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(validateMissionDefinition(null).ok).toBe(false);
    expect(validateMissionDefinition("mission").ok).toBe(false);
  });

  it("ID 唯一、稳定格式、与评估器一一对应", () => {
    const ids = ALL_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const evaluators = ALL_MISSIONS.map((m) => m.evaluatorId);
    expect(new Set(evaluators).size).toBe(evaluators.length);
    for (const mission of ALL_MISSIONS) {
      expect(getMissionById(mission.id)).toBe(mission);
      expect(getMissionByEvaluatorId(mission.evaluatorId)).toBe(mission);
    }
  });

  it("每个任务具备提示阶梯（≥2 级）、平实进度语言、无障碍备注、反思机会", () => {
    for (const mission of CASTLE_WATER_MISSIONS) {
      expect(mission.hintLadder.length).toBeGreaterThanOrEqual(2);
      expect(mission.progressLanguage).toContain("{done}");
      expect(mission.progressLanguage).not.toContain("%");
      expect(mission.accessibilityNote.length).toBeGreaterThan(8);
      expect(mission.reflectionPrompt.length).toBeGreaterThan(4);
      expect(mission.learningGoal.length).toBeGreaterThan(4);
      expect(mission.prerequisiteMissionIds).toEqual([]);
    }
  });
});

describe("V51-006 V0.5 三任务迁移等价性（AC-210 内容层）", () => {
  it("任务数量与顺序一致，ID 双向映射完整", () => {
    expect(CASTLE_WATER_MISSIONS).toHaveLength(QUEST_DEFINITIONS.length);
    expect(CASTLE_WATER_MISSIONS).toHaveLength(3);
    for (const quest of QUEST_DEFINITIONS) {
      const missionId = MISSION_ID_BY_LEGACY_QUEST[quest.id];
      expect(missionId, `missing mapping for ${quest.id}`).toBeDefined();
      expect(LEGACY_QUEST_ID_BY_MISSION[missionId]).toBe(quest.id);
      expect(getMissionById(missionId)).toBeDefined();
    }
  });

  it("标题 / 背景 / 首级提示 / 完成消息与 V0.5 逐字一致", () => {
    for (const quest of QUEST_DEFINITIONS) {
      const mission = getMissionById(MISSION_ID_BY_LEGACY_QUEST[quest.id])!;
      expect(mission.title, quest.id).toBe(quest.title);
      expect(mission.context, quest.id).toBe(quest.briefing);
      expect(mission.hintLadder[0], quest.id).toBe(quest.hint);
      expect(mission.successMessage, quest.id).toBe(quest.successMessage);
    }
  });

  it("评估器 ID 与判定区域/阈值仍来自同一份舞台常量，无双写漂移", () => {
    const byLegacy = new Map(QUEST_DEFINITIONS.map((q) => [q.id, q]));
    expect(getMissionById("mission.moat.v1")!.evaluatorId).toBe("evaluator.moat");
    expect(getMissionById("mission.well.v1")!.evaluatorId).toBe("evaluator.well");
    expect(getMissionById("mission.dungeon.v1")!.evaluatorId).toBe("evaluator.dungeon");

    expect(byLegacy.get("quest-moat")!.region).toHaveLength(MOAT_FLOOR_CELLS.length);
    expect(byLegacy.get("quest-moat")!.threshold).toBe(0.9);
    expect(byLegacy.get("quest-well")!.region).toEqual(WELL_SHAFT_CELLS);
    expect(byLegacy.get("quest-well")!.threshold).toBe(1);
    expect(byLegacy.get("quest-dungeon")!.region).toEqual(DUNGEON_DRY_CELLS);
    expect(byLegacy.get("quest-dungeon")!.direction).toBe("drain");
  });

  it("奖励为装饰性称号，不锁基础建造资源（PD-003）", () => {
    const titles = CASTLE_WATER_MISSIONS.map((m: MissionDefinition) => m.reward?.title);
    expect(titles.every((title) => typeof title === "string" && title.length > 0)).toBe(true);
    for (const mission of CASTLE_WATER_MISSIONS) {
      expect(mission.reward?.kind).toBe("title");
      expect(JSON.stringify(mission)).not.toContain("unlockBlock");
    }
  });
});
