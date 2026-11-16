/**
 * V0.7.1 — 桥梁任务 ID / evaluator / 知识点 / 奖励契约（冻结）。
 *
 * 只追加一条任务；原有 24 个任务 ID、顺序与文案零改动。
 * 知识点 append-only 新增 3 个（owner D3 授权），其余复用已注册 ID。
 */
import type { AgeBand } from "../../plugins/learner/types";
import type { ExpressionForm } from "./types";

export const V071_MISSION_ID = "mission.bridge-repair.v1";
export const V071_EVALUATOR_ID = "evaluator.bridge-repair";
export const V071_REWARD_ID = "resourceKit.masonry_basic";

export interface V071MissionContract {
  readonly id: string;
  readonly evaluatorId: string;
  readonly primaryForm: ExpressionForm;
  readonly ageScope: AgeBand;
  readonly scenarioId: string;
  readonly blueprintName: string;
  readonly knowledgePointIds: readonly string[];
  readonly rewardId: string;
}

export const V071_MISSION_CONTRACT: V071MissionContract = Object.freeze({
  id: V071_MISSION_ID,
  evaluatorId: V071_EVALUATOR_ID,
  primaryForm: "problem-solving",
  ageScope: "8-10",
  scenarioId: "site.eastern-river-crossing",
  blueprintName: "v071-bridge-deck",
  knowledgePointIds: Object.freeze([
    "kp.engineering.planning",
    "kp.measurement.height",
    "kp.system.continuous_path",
    "kp.measurement.area",
    "kp.arithmetic.multiplication",
    "kp.engineering.material_count"
  ]),
  rewardId: V071_REWARD_ID
});
