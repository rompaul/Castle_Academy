import type { GridPosition } from "../../core/world/coordinates";
import { MOAT_FLOOR_CELLS, WELL_SHAFT_CELLS, DUNGEON_DRY_CELLS } from "./castleStage";
import type { WaterQuery } from "../water/WaterPlugin";

/**
 * V05-010~012 — 城堡水务任务定义与判定（学习规格 V0.5_Learning_Experience_Spec）。
 *
 * 三个任务对应三个舞台区域：
 * 1. quest-moat   注满护城河 —— 渠内 40 格 ≥90% 充水（connectivity 挑战）。
 * 2. quest-well   城堡水井   —— 井筒 2 格全部充水（把水引到塔顶）。
 * 3. quest-dungeon 地牢告急  —— 牢房区 2×2 全部脱水（排水渠屏障）。
 *
 * 判定是纯函数：给定 WaterQuery，输出进度与完成态；UI 文案集中在任务定义里。
 */

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
    hint: "在塔顶开口正上方放水源，水会灌满井筒；或用管道从远处把水引过来。",
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
