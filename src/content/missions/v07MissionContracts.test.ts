import { describe, expect, it } from "vitest";

import { ALL_MISSIONS } from "./index";
import { EXPRESSION_FORMS } from "./types";
import { isRegisteredKnowledgePoint, KNOWLEDGE_POINTS } from "../knowledge/registry";
import { createDefaultEvaluatorRegistry } from "../../plugins/mission/evaluators";
import { V07_EVALUATOR_IDS, V07_MISSION_CONTRACTS, V07_MISSION_IDS } from "./v07MissionContracts";

const MISSION_ID_PATTERN = /^mission\.[a-z0-9-]+\.v\d+$/;
const EVALUATOR_ID_PATTERN = /^evaluator\.[a-z0-9-]+$/;

describe("V07-006 六个新任务 ID / evaluator ID / 知识点映射冻结", () => {
  it("6 个任务 ID 合法、零重复；V07-021 后在 ALL_MISSIONS 末尾且全量零重复", () => {
    expect(V07_MISSION_IDS).toHaveLength(6);
    expect(new Set(V07_MISSION_IDS).size).toBe(6);
    expect(ALL_MISSIONS).toHaveLength(24);
    expect(new Set(ALL_MISSIONS.map((m) => m.id)).size).toBe(24);
    expect(ALL_MISSIONS.slice(18).map((m) => m.id)).toEqual(V07_MISSION_IDS);
    for (const id of V07_MISSION_IDS) {
      expect(id, id).toMatch(MISSION_ID_PATTERN);
    }
  });

  it("6 个 evaluator ID 合法、零重复；V07-021 后已注册到同一默认注册表", () => {
    const registry = createDefaultEvaluatorRegistry();
    expect(registry.ids()).toHaveLength(24);
    expect(new Set(registry.ids()).size).toBe(24);
    expect(V07_EVALUATOR_IDS).toHaveLength(6);
    expect(new Set(V07_EVALUATOR_IDS).size).toBe(6);
    for (const id of V07_EVALUATOR_IDS) {
      expect(id, id).toMatch(EVALUATOR_ID_PATTERN);
      expect(registry.has(id), id).toBe(true);
    }
  });

  it("所有知识点引用命中已注册 24 个 ID，零编造、零新增", () => {
    expect(KNOWLEDGE_POINTS).toHaveLength(24);
    for (const contract of V07_MISSION_CONTRACTS) {
      expect(contract.knowledgePointIds.length, contract.id).toBeGreaterThan(0);
      for (const id of contract.knowledgePointIds) {
        expect(isRegisteredKnowledgePoint(id), `${contract.id} -> ${id}`).toBe(true);
      }
    }
  });

  it("六类主形式全覆盖，life-simulation 与 communication 各有主任务", () => {
    const forms = V07_MISSION_CONTRACTS.map((c) => c.primaryForm);
    expect(new Set(forms).size).toBe(6);
    expect([...forms].sort()).toEqual([...EXPRESSION_FORMS].sort());
    expect(forms).toContain("life-simulation");
    expect(forms).toContain("communication");
  });

  it("4 个年龄档全覆盖；证据通道与学习规格一一对应", () => {
    const ages = V07_MISSION_CONTRACTS.map((c) => c.ageScope);
    expect(new Set(ages)).toEqual(new Set(["6-7", "8-10", "11-12", "13-15"]));
    expect(V07_MISSION_CONTRACTS.map((c) => [c.id, c.evidenceChannel])).toEqual([
      ["mission.find-the-pattern.v1", "observationLog"],
      ["mission.switch-compare.v1", "variableComparison"],
      ["mission.why-no-water-here.v1", "water"],
      ["mission.choose-water-route.v1", "decisionSequence"],
      ["mission.explain-my-choice.v1", "textEvidence"],
      ["mission.story-map.v1", "world"]
    ]);
  });

  it("冻结表不可写，且任务与评估器 1:1", () => {
    expect(Object.isFrozen(V07_MISSION_CONTRACTS)).toBe(true);
    expect(Object.isFrozen(V07_MISSION_IDS)).toBe(true);
    expect(Object.isFrozen(V07_MISSION_CONTRACTS[0])).toBe(true);
    expect(V07_MISSION_CONTRACTS.map((c) => c.evaluatorId)).toEqual(V07_EVALUATOR_IDS);
  });
});
