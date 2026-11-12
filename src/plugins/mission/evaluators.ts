/**
 * V51-007 — 确定性评估器注册表（ADR-0007 / V0.2 §5）。
 *
 * ⚠️ 本文件上半部分是从 V0.5 `castleQuests.ts` **原封不动迁移**的判定逻辑：
 *    `QUEST_DEFINITIONS` + `evaluateQuests()`（含 everWet 防伪完成、水井测量门槛）。
 *    已验证逻辑不重写（PD-009）。`castleQuests.ts` 保留为 re-export 兼容层，
 *    让 V0.5 的 155 个单测与旧 `quest.*` 事件消费方零改动继续工作。
 *
 * 禁止在此引入随机 / 时间 / 网络 / DOM；评估器必须是纯函数（AC-212）。
 */
import type { GridPosition } from "../../core/world/coordinates";
import type { WaterQuery } from "../water/WaterPlugin";
import { MOAT_FLOOR_CELLS, WELL_SHAFT_CELLS, DUNGEON_DRY_CELLS } from "../learning/castleStage";
import { registerExtendedEvaluators } from "./extendedEvaluators";

/* ==================== 以下为 V0.5 原样迁移（勿改写） ==================== */

export type QuestDirection = "fill" | "drain";

export interface QuestDefinition {
  id: string;
  title: string;
  briefing: string;
  hint: string;
  successMessage: string;
  direction: QuestDirection;
  /** 判定区域（fill=需充水的格，drain=需脱水的格） */
  region: readonly GridPosition[];
  /** fill 任务需要的充水比例阈值（0-1]；drain 任务恒为全部脱水 */
  threshold: number;
}

export interface QuestState {
  id: string;
  title: string;
  briefing: string;
  hint: string;
  successMessage: string;
  direction: QuestDirection;
  /** 0~1 */
  progress: number;
  complete: boolean;
}

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [
  {
    id: "quest-moat",
    title: "注满护城河",
    briefing: "敌军压境，护城河干涸！把水引进环绕城堡的水道，充水至少九成。",
    hint: "在渠边放水源（扩散最多 7 格）——离得远的区段需要多个水源或用管道接力。",
    successMessage: "护城河碧波荡漾，敌军只能望水兴叹！",
    direction: "fill",
    region: MOAT_FLOOR_CELLS.map((p) => ({ ...p, y: p.y + 1 })),
    threshold: 0.9
  },
  {
    id: "quest-well",
    title: "城堡水井",
    briefing: "庭院水井见底，厨房马厩都在喊渴。想办法把水送进东侧石塔的井筒。",
    hint: "先用顶栏 Measure 量一次高差（解锁判定）；再在塔顶开口正上方放水源灌满井筒，或用管道从远处引水。",
    successMessage: "水井汩汩冒水，今晚大厅能炖汤了！",
    direction: "fill",
    region: WELL_SHAFT_CELLS,
    threshold: 1
  },
  {
    id: "quest-dungeon",
    title: "地牢告急",
    briefing: "暴雨渗水，地牢积水，被俘的骑士团快要泡汤了！把西北角的牢房区排干。",
    hint: "用剖面视图找到地下渗水点，再在渗水点与牢房区之间横一排排水渠——渠会吸收流经的水。",
    successMessage: "牢房干燥温暖，骑士团向您致敬，城堡水务大师！",
    direction: "drain",
    region: DUNGEON_DRY_CELLS,
    threshold: 1
  }
];

export const ALL_QUESTS_COMPLETE_EVENT = "castle.quests.allCompleted";
export const QUEST_UPDATED_EVENT = "quest.updated";
export const QUEST_COMPLETED_EVENT = "quest.completed";

/** 任务更新事件 payload */
export interface QuestUpdatedPayload {
  quests: QuestState[];
}

/** 任务完成事件 payload */
export interface QuestCompletedPayload {
  id: string;
  title: string;
  successMessage: string;
}

/**
 * 纯判定：根据水域查询计算全部任务状态。
 * @param everWet 曾经积过水的 drain 任务 ID 集合——drain 任务必须先见过水才算完成
 *        （否则空世界/未建舞台时"本来就没水"会被伪完成）。
 */
export function evaluateQuests(
  query: WaterQuery,
  everWet: ReadonlySet<string> = new Set(),
  measurementDone = false
): QuestState[] {
  return QUEST_DEFINITIONS.map((definition) => {
    const wet = definition.region.filter((cell) => query.hasWater(cell)).length;
    const progress =
      definition.direction === "fill"
        ? Math.min(wet / Math.ceil(definition.threshold * definition.region.length), 1)
        : 1 - wet / definition.region.length;
    // 城堡水井：必须先用测量工具量过高差（测量→规划→建造→验证 的完整循环）
    const measurementGate = definition.id === "quest-well" && !measurementDone;
    const complete =
      definition.direction === "fill"
        ? !measurementGate && wet >= Math.ceil(definition.threshold * definition.region.length)
        : wet === 0 && everWet.has(definition.id);
    return {
      id: definition.id,
      title: definition.title,
      briefing: definition.briefing,
      hint: definition.hint,
      successMessage: definition.successMessage,
      direction: definition.direction,
      progress,
      complete
    };
  });
}

/* ==================== V0.51 评估器注册表 ==================== */

/** V51-015+ 世界方块只读快照：不触碰 WorldState / WorldSnapshot 契约，只供确定性计数。 */
export interface WorldReadQuery {
  blockAt(position: GridPosition): string | undefined;
  all(): ReadonlyArray<{ position: GridPosition; blockId: string }>;
}

export interface EvaluatorQuery {
  water: WaterQuery;
  /** 曾经积过水的 drain 任务 ID 集合（防伪完成） */
  everWet: ReadonlySet<string>;
  /** 玩家是否用过测量工具（水井门槛） */
  measurementDone: boolean;
  /** 新增：世界方块只读快照（未注入时评估器降级为 0 进度，便于单测） */
  world?: WorldReadQuery;
  /** 新增：学习者提交的文字证据，仅运行时内存，不进档案 / 世界存档 */
  textEvidence?: ReadonlyMap<string, string>;
  /** 新增：剖面视图是否开启（剖面侦探） */
  sectionEnabled?: boolean;
}

export interface EvaluatorResult {
  progress: number;
  complete: boolean;
  /**
   * V0.6（ADR-0010 / V06-013/014）确定性证据摘要：来自世界状态查询的观察计数，
   * 无随机/时间/网络；运行时在任务完成时把它落入学习者档案的掌握证据。
   */
  evidence?: { observation: string };
}

export interface MissionEvaluator {
  id: string;
  /** 迁移期旧 quest ID，用于旧事件适配 */
  legacyQuestId: string;
  /** 纯函数：禁止随机/时间/网络 */
  evaluate(query: EvaluatorQuery): EvaluatorResult;
  /** 平实语言的确定性计数（UI 显示「已充水 N/M 段」） */
  describe(query: EvaluatorQuery): { done: number; total: number };
}

const EVALUATOR_ID_BY_QUEST: Readonly<Record<string, string>> = {
  "quest-moat": "evaluator.moat",
  "quest-well": "evaluator.well",
  "quest-dungeon": "evaluator.dungeon"
};

/** 每个评估器都复用同一份已验证的 evaluateQuests 判定，不重写逻辑。 */
function createEvaluator(definition: QuestDefinition, id: string): MissionEvaluator {
  return {
    id,
    legacyQuestId: definition.id,
    evaluate: (query) => {
      const state = evaluateQuests(query.water, query.everWet, query.measurementDone)
        .find((quest) => quest.id === definition.id)!;
      // V06-014：判定逻辑未动，只补确定性观察摘要（done/total 与 describe 同源）
      const wet = definition.region.filter((cell) => query.water.hasWater(cell)).length;
      const done = definition.direction === "fill"
        ? wet
        : definition.region.length - wet;
      return {
        progress: state.progress,
        complete: state.complete,
        evidence: { observation: `${done}/${definition.region.length}` }
      };
    },
    describe: (query) => {
      const wet = definition.region.filter((cell) => query.water.hasWater(cell)).length;
      return definition.direction === "fill"
        ? { done: wet, total: definition.region.length }
        : { done: definition.region.length - wet, total: definition.region.length };
    }
  };
}

export class EvaluatorRegistry {
  private readonly evaluators = new Map<string, MissionEvaluator>();

  register(evaluator: MissionEvaluator): void {
    if (this.evaluators.has(evaluator.id)) {
      throw new Error(`Duplicate mission evaluator: ${evaluator.id}`);
    }
    this.evaluators.set(evaluator.id, evaluator);
  }

  get(id: string): MissionEvaluator | undefined {
    return this.evaluators.get(id);
  }

  has(id: string): boolean {
    return this.evaluators.has(id);
  }

  ids(): string[] {
    return [...this.evaluators.keys()];
  }
}

export function createDefaultEvaluatorRegistry(): EvaluatorRegistry {
  const registry = new EvaluatorRegistry();
  for (const definition of QUEST_DEFINITIONS) {
    registry.register(createEvaluator(definition, EVALUATOR_ID_BY_QUEST[definition.id]));
  }
  // V51-015/016 新增批次：判定仍为纯函数，与 V0.5 迁移判定彼此独立。
  registerExtendedEvaluators(registry);
  return registry;
}

export { EVALUATOR_ID_BY_QUEST };
