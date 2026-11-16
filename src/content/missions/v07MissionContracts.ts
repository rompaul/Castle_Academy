/**
 * V07-006 — 六个新任务的 ID / evaluator ID / 知识点映射（**冻结**）。
 *
 * 纯数据常量，无副作用；V07-007（评估器）与 V07-008（任务内容）唯一消费此表，
 * 避免两处各写一份 ID 造成漂移。知识点一律取自 `src/content/knowledge/registry.ts`
 * 已注册的 24 个 ID，**不新增、不改名、不编造**。
 *
 * 映射相对 `docs/v0.7/audit/V07_MISSION_AND_EVALUATOR_ID_MAP.md` §7 草案的差异：
 * `mission.find-the-pattern.v1` 原草案为 `kp.geometry.axis_symmetry` + `kp.reasoning.diagnosis`；
 * 按 `06_LEARNING/LEARNING_ACTIVITIES_SPEC.md` §3 活动 A「水会出现在哪些地方」的实际语义，
 * 冻结为 `kp.water.flow.range` + `kp.reasoning.cause_effect`。仍只使用已注册 ID，不改注册表。
 * 其余 5 条沿用草案。
 */
import type { AgeBand } from "../../plugins/learner/types";
import type { ExpressionForm } from "./types";

export type V07EvidenceChannel =
  | "observationLog"
  | "variableComparison"
  | "decisionSequence"
  | "textEvidence"
  | "world"
  | "water";

export interface V07MissionContract {
  readonly id: string;
  readonly evaluatorId: string;
  /** 主表达形式：六个新任务各占一类，六类全覆盖 */
  readonly primaryForm: ExpressionForm;
  readonly ageScope: AgeBand;
  readonly knowledgePointIds: readonly string[];
  /** 该任务完成判定所依据的确定性证据通道 */
  readonly evidenceChannel: V07EvidenceChannel;
}

export const V07_MISSION_CONTRACTS: readonly V07MissionContract[] = Object.freeze([
  Object.freeze({
    id: "mission.find-the-pattern.v1",
    evaluatorId: "evaluator.find-the-pattern",
    primaryForm: "exploration",
    ageScope: "6-7",
    knowledgePointIds: Object.freeze(["kp.water.flow.range", "kp.reasoning.cause_effect"]),
    evidenceChannel: "observationLog"
  }),
  Object.freeze({
    id: "mission.switch-compare.v1",
    evaluatorId: "evaluator.switch-compare",
    primaryForm: "experiment",
    ageScope: "8-10",
    knowledgePointIds: Object.freeze(["kp.electric.switch.effect", "kp.experiment.control"]),
    evidenceChannel: "variableComparison"
  }),
  Object.freeze({
    id: "mission.why-no-water-here.v1",
    evaluatorId: "evaluator.why-no-water-here",
    primaryForm: "problem-solving",
    ageScope: "8-10",
    knowledgePointIds: Object.freeze(["kp.reasoning.diagnosis", "kp.system.continuous_path"]),
    evidenceChannel: "water"
  }),
  Object.freeze({
    id: "mission.choose-water-route.v1",
    evaluatorId: "evaluator.choose-water-route",
    primaryForm: "life-simulation",
    ageScope: "11-12",
    knowledgePointIds: Object.freeze(["kp.water.barrier.redirect", "kp.water.channel.absorb"]),
    evidenceChannel: "decisionSequence"
  }),
  Object.freeze({
    id: "mission.explain-my-choice.v1",
    evaluatorId: "evaluator.explain-my-choice",
    primaryForm: "communication",
    ageScope: "13-15",
    knowledgePointIds: Object.freeze(["kp.communication.explain_reason", "kp.reasoning.cause_effect"]),
    evidenceChannel: "textEvidence"
  }),
  Object.freeze({
    id: "mission.story-map.v1",
    evaluatorId: "evaluator.story-map",
    primaryForm: "creation",
    ageScope: "6-7",
    knowledgePointIds: Object.freeze(["kp.engineering.planning", "kp.system.dependency"]),
    evidenceChannel: "world"
  })
]);

export const V07_MISSION_IDS: readonly string[] = Object.freeze(
  V07_MISSION_CONTRACTS.map((contract) => contract.id)
);

export const V07_EVALUATOR_IDS: readonly string[] = Object.freeze(
  V07_MISSION_CONTRACTS.map((contract) => contract.evaluatorId)
);
