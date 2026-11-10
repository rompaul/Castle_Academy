/**
 * V0.5 城堡水务任务定义 —— V0.51 迁移期**兼容层**（ADR-0007）。
 *
 * 判定逻辑（QUEST_DEFINITIONS / evaluateQuests）已原封不动迁往
 * `src/plugins/mission/evaluators.ts` 并注册为确定性评估器。
 * 本文件只做 re-export，保证 V0.5 的 `CastleQuestPlugin`、155 个单测、
 * 旧 `quest.*` 事件消费方与 E2E 全部零改动继续工作（AC-215/216）。
 *
 * ⛔ 请勿在本文件重新添加判定逻辑；STOP GATE-2 后旧事件与 CastleQuestPlugin 一并移除，
 *    届时本文件删除，所有消费方改用 `mission.*` 事件与 Content Pack。
 */
export {
  QUEST_DEFINITIONS,
  evaluateQuests,
  ALL_QUESTS_COMPLETE_EVENT,
  QUEST_UPDATED_EVENT,
  QUEST_COMPLETED_EVENT
} from "../mission/evaluators";

export type {
  QuestDirection,
  QuestDefinition,
  QuestState,
  QuestUpdatedPayload,
  QuestCompletedPayload
} from "../mission/evaluators";
