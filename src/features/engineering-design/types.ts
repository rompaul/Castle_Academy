/**
 * V0.7.1 — Engineering design-to-build 纯数据契约。
 *
 * 本模块只定义类型，不含世界查询、DOM、网络或浏览器存储。
 * 场景参数在 scenario.ts 冻结；所有计算结果由纯函数产生。
 */
import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";

/** 桥梁任务固定场景（游戏参数，不是现实桥梁规范）。 */
export interface BridgeScenario {
  readonly scenarioId: string;
  readonly siteId: string;
  readonly riverSpan: number;
  /** 右岸搭接固定 1 格；左岸搭接由桥长反推，保证桥的右端始终落在同一岸。 */
  readonly rightLanding: number;
  readonly minDeckWidth: number;
  readonly deckLengthRange: readonly [number, number];
  readonly deckWidthRange: readonly [number, number];
  readonly materialBudget: number;
  readonly planksPerCell: number;
  readonly materialBlockId: BlockId;
  readonly deckY: number;
  /** 河槽 x ∈ [riverMinX, riverMaxX]，净宽 = riverSpan。 */
  readonly riverMinX: number;
  readonly riverMaxX: number;
  /** 河槽沿 Z 流动。 */
  readonly riverMinZ: number;
  readonly riverMaxZ: number;
  /** 右岸搭接格的世界 x；桥面右端固定落在这里。 */
  readonly rightBankX: number;
  /** 桥面窄端 z；宽度向 +Z 增长。 */
  readonly deckZStart: number;
  readonly orientation: "x";
}

/** 设计输入：只含学习者可改变的量，搭接由纯函数反推，避免两份事实来源。 */
export interface BridgeDesignInput {
  readonly scenarioId: string;
  readonly measuredRiverSpan: number;
  readonly deckLength: number;
  readonly deckWidth: number;
  readonly materialBlockId: BlockId;
}

/** 计算输出：所有字段均由 computeBridgeDesign() 产生，UI 不保存可编辑副本。 */
export interface BridgeDesignComputed {
  readonly requiredDeckLength: number;
  readonly leftLanding: number;
  readonly rightLanding: number;
  readonly deckArea: number;
  readonly requiredPlanks: number;
  readonly availablePlanks: number;
  readonly remainingPlanks: number;
}

export type DesignIssueSeverity = "error" | "warning" | "info";

export interface DesignIssue {
  /** 机器可读规则码，例如 BR-02。 */
  readonly code: string;
  readonly severity: DesignIssueSeverity;
  /** UI 文案 key；计算引擎不硬编码组件。 */
  readonly messageKey: string;
  readonly relatedField?: string;
}

export interface DesignValidationResult {
  readonly passed: boolean;
  readonly issues: readonly DesignIssue[];
}

/** 桥面目标格（相对 blueprint origin）。 */
export interface BridgeCell {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly materialBlockId: BlockId;
}

/** 从设计参数生成的施工蓝图，不绕过 Building Plugin 落方块。 */
export interface BridgeBlueprint {
  readonly blueprintId: string;
  readonly scenarioId: string;
  readonly origin: GridPosition;
  readonly orientation: "x";
  readonly deckLength: number;
  readonly deckWidth: number;
  readonly materialBlockId: BlockId;
  readonly requiredCells: readonly BridgeCell[];
}

/** 施工证据：由 Building/Blueprint 适配层生成，evaluator 只读。 */
export interface ConstructionEvidence {
  readonly blueprintId: string;
  readonly placedRequiredCells: number;
  readonly totalRequiredCells: number;
  readonly missingCells: readonly Readonly<{ dx: number; dz: number }>[];
  readonly invalidMaterialCells: readonly Readonly<{ dx: number; dz: number }>[];
}

/** 任务状态机（V0.7.1 §11.4）。 */
export type DesignStage =
  | "briefing"
  | "site-survey"
  | "guided-design"
  | "design-validation"
  | "construction"
  | "construction-validation"
  | "completed";

/** 任务级资源解锁记录，只存 ID，不存自由文本或坐标。 */
export interface V071ProgressState {
  readonly version: 1;
  readonly completedMissionIds: readonly string[];
  readonly unlockedRewardIds: readonly string[];
}
