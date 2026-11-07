import type { EventBus } from "../../core/events/EventBus";
import type { WaterPlugin } from "../water/WaterPlugin";
import {
  ALL_QUESTS_COMPLETE_EVENT,
  QUEST_COMPLETED_EVENT,
  QUEST_UPDATED_EVENT,
  QUEST_DEFINITIONS,
  evaluateQuests,
  type QuestCompletedPayload,
  type QuestState,
  type QuestUpdatedPayload
} from "./castleQuests";

/**
 * V05-010~012 — CastleQuestPlugin：城堡水务任务插件。
 *
 * 职责（CA-TECH-001 插件优先）：
 * - 订阅 water.flow.updated，在水域收敛后用纯判定函数 evaluateQuests 评估任务。
 * - 发射 quest.updated（UI 面板）、quest.completed（toast）、castle.quests.allCompleted。
 * - 完成状态一次性触发（不重复刷 toast）。
 *
 * 不触碰 WorldState / 渲染器内部；判定数据来自 WaterPlugin 的只读 WaterQuery。
 */
export class CastleQuestPlugin {
  private readonly completed = new Set<string>();
  /** 曾经积过水的 drain 任务（防伪完成：没见过水的区域不算"已排干"） */
  private readonly everWet = new Set<string>();
  private allCompletedNotified = false;
  private active = false;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    private readonly water: WaterPlugin,
    private readonly events: EventBus
  ) {}

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe.push(
      this.events.on("water.flow.updated", () => this.evaluate())
    );
    this.evaluate(); // 激活时给出初始面板状态
  }

  dispose(): void {
    this.active = false;
    while (this.unsubscribe.length > 0) {
      this.unsubscribe.pop()?.();
    }
  }

  /** 当前任务状态快照（UI 初始化用） */
  getQuests(): QuestState[] {
    return evaluateQuests(this.water.getQuery(), this.everWet);
  }

  /** 全部任务是否完成 */
  isAllCompleted(): boolean {
    return this.getQuests().every((quest) => quest.complete);
  }

  /** 世界被整体替换（存档加载/重置）后调用：清空完成记忆，重新开始判定 */
  resetEvaluation(): void {
    this.completed.clear();
    this.everWet.clear();
    this.allCompletedNotified = false;
    this.evaluate();
  }

  private evaluate(): void {
    if (!this.water.getQuery().isConverged()) return; // 只在收敛时判定，避免中途误判
    const query = this.water.getQuery();
    for (const definition of QUEST_DEFINITIONS) {
      if (definition.direction === "drain" && definition.region.some((cell) => query.hasWater(cell))) {
        this.everWet.add(definition.id);
      }
    }
    const quests = evaluateQuests(query, this.everWet);
    this.events.emit<QuestUpdatedPayload>(QUEST_UPDATED_EVENT, { quests });

    for (const quest of quests) {
      if (quest.complete && !this.completed.has(quest.id)) {
        this.completed.add(quest.id);
        this.events.emit<QuestCompletedPayload>(QUEST_COMPLETED_EVENT, {
          id: quest.id,
          title: quest.title,
          successMessage: quest.successMessage
        });
      }
    }

    if (!this.allCompletedNotified && quests.every((quest) => quest.complete) && quests.length > 0) {
      this.allCompletedNotified = true;
      this.events.emit(ALL_QUESTS_COMPLETE_EVENT, {});
    }
  }
}
