/**
 * V51-006 — MissionDefinition（Content Pack 纯数据契约，ADR-0007）。
 *
 * 本文件只有类型与校验函数；不含世界查询、不含判定逻辑、不 import 插件运行时。
 * 判定一律通过 `evaluatorId` 指向 `src/plugins/mission/evaluators.ts` 的确定性评估器。
 */
import { isAgeBand, type AgeBand } from "../../plugins/learner/types";
import { isRegisteredKnowledgePoint } from "../knowledge/registry";

/** V0.2 PRODUCT_DEFINITION §4 六种任务表达形式 */
export type ExpressionForm =
  | "creation"
  | "exploration"
  | "problem-solving"
  | "experiment"
  | "life-simulation"
  | "communication";

export const EXPRESSION_FORMS: readonly ExpressionForm[] = [
  "creation", "exploration", "problem-solving", "experiment", "life-simulation", "communication"
];

export interface MissionReward {
  kind: "title";
  title: string;
}

export interface MissionDefinition {
  /** 稳定 ID，如 "mission.moat.v1"；发布后不可变更 */
  id: string;
  version: number;
  title: string;
  /** 背景故事（V0.5 briefing 原样迁移） */
  context: string;
  /** 一个清晰的学习者视角目标句，不暴露难度分层/系统术语 */
  goal: string;
  ageScope: AgeBand;
  expressionForms: ExpressionForm[];
  /** 启动前由 CapabilityRegistry 校验；缺失显示"暂不可玩"，不隐藏 */
  requiredCapabilities: string[];
  /** 渐进提示阶梯，一次展开一级；使用次数记录进档案、不惩罚 */
  hintLadder: string[];
  successMessage: string;
  /** 确定性评估器注册 ID */
  evaluatorId: string;
  reward?: MissionReward;
  /** —— V0.2 LEARNING_MODEL §6 内容质量清单必填项 —— */
  learningGoal: string;
  /** 任务链前置；V0.6 起由 resolveMissionGraph() 真正解析（ADR-0009），仅数据占位 → 运行时消费 */
  prerequisiteMissionIds: string[];
  /**
   * Content Pack schema 版本（ADR-0009）：缺省 = v1（无知识点字段）；
   * 2 = v2，必须带 knowledgePointIds 且每个 ID 已注册。
   */
  schemaVersion?: 1 | 2;
  /** 引用的知识点 ID（v2 必填）；每个 ID 必须已在 src/content/knowledge/registry.ts 注册 */
  knowledgePointIds?: string[];
  reflectionPrompt: string;
  accessibilityNote: string;
  /** 平实语言进度模板：{done}/{total} 由运行时替换，永不显示百分比分层 */
  progressLanguage: string;
  /** 能力缺失时的解释文案（S8） */
  unavailableReason: string;
}

/** 侧栏/详情消费的运行时视图（不是持久化数据） */
export interface MissionSummary {
  id: string;
  title: string;
  /** V0.6 起新增 locked（前置未完成）派生视图态；持久化三态（available/active/completed）不变 */
  status: "available" | "active" | "completed" | "unavailable" | "locked";
  progress: number;
  progressText: string;
  ageScope: AgeBand;
  evaluatorId: string;
  successMessage: string;
  /** V06-018（K3/K4）：未完成前置任务的标题（按定义顺序）；锁定详情页展示「先完成〈任务名〉」 */
  prerequisiteTitles: string[];
}

const REQUIRED_STRING_FIELDS = [
  "id", "title", "context", "goal", "successMessage", "evaluatorId",
  "learningGoal", "reflectionPrompt", "accessibilityNote", "progressLanguage", "unavailableReason"
] as const;

/** 内容质量校验（AC-230）：返回全部错误，便于内容评审一次修完。 */
export function validateMissionDefinition(value: unknown): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["不是对象"] };
  const def = value as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof def[field] !== "string" || (def[field] as string).trim().length === 0) {
      errors.push(`${field} 缺失或为空`);
    }
  }
  if (typeof def.version !== "number" || !Number.isInteger(def.version) || def.version < 1) {
    errors.push("version 必须是正整数");
  }
  if (typeof def.id === "string" && !/^mission\.[a-z0-9-]+\.v\d+$/.test(def.id)) {
    errors.push("id 必须形如 mission.<slug>.v<n>");
  }
  if (typeof def.evaluatorId === "string" && !/^evaluator\.[a-z0-9-]+$/.test(def.evaluatorId)) {
    errors.push("evaluatorId 必须形如 evaluator.<slug>");
  }
  if (!isAgeBand(def.ageScope)) errors.push("ageScope 非法");
  if (!Array.isArray(def.expressionForms) || def.expressionForms.length === 0
    || def.expressionForms.some((form) => !EXPRESSION_FORMS.includes(form as ExpressionForm))) {
    errors.push("expressionForms 至少一个且取值合法");
  }
  if (!Array.isArray(def.hintLadder) || def.hintLadder.length === 0
    || def.hintLadder.some((h) => typeof h !== "string" || h.trim() === "")) {
    errors.push("hintLadder 至少一条且非空");
  }
  if (!Array.isArray(def.requiredCapabilities)
    || def.requiredCapabilities.some((c) => typeof c !== "string" || c.trim() === "")) {
    errors.push("requiredCapabilities 必须是字符串数组");
  }
  if (!Array.isArray(def.prerequisiteMissionIds)) errors.push("prerequisiteMissionIds 必须是数组");

  // —— schema v2 双模校验（ADR-0009）：v1 缺省行为不变，v2 强制知识点字段 ——
  const schemaVersion = def.schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== 1 && schemaVersion !== 2) {
    errors.push("schemaVersion 只允许 1 / 2");
  }
  if (schemaVersion === 2) {
    if (!Array.isArray(def.knowledgePointIds) || def.knowledgePointIds.length === 0) {
      errors.push("schemaVersion 2 要求 knowledgePointIds 至少一个");
    } else if (def.knowledgePointIds.some((id) => typeof id !== "string" || !isRegisteredKnowledgePoint(id))) {
      errors.push("knowledgePointIds 中存在未注册的知识点 ID");
    }
  } else if (def.knowledgePointIds !== undefined) {
    // v1 允许缺省；若显式携带也必须全部已注册，不允许静默忽略
    if (!Array.isArray(def.knowledgePointIds)) {
      errors.push("knowledgePointIds 必须是字符串数组");
    } else if (def.knowledgePointIds.some((id) => typeof id !== "string" || !isRegisteredKnowledgePoint(id))) {
      errors.push("knowledgePointIds 中存在未注册的知识点 ID");
    }
  }
  if (def.reward !== undefined) {
    const reward = def.reward as Record<string, unknown> | null;
    if (!reward || typeof reward !== "object" || reward.kind !== "title"
      || typeof reward.title !== "string" || (reward.title as string).trim() === "") {
      errors.push("reward 必须为 { kind: 'title', title: string }");
    }
  }
  if (typeof def.progressLanguage === "string" && !def.progressLanguage.includes("{done}")) {
    errors.push("progressLanguage 必须含 {done} 占位符（平实语言）");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
