import { CASTLE_WATER_MISSIONS, LEGACY_QUEST_ID_BY_MISSION, MISSION_ID_BY_LEGACY_QUEST } from "./castleWaterMissions";
import { WATER_EXTENSION_MISSIONS } from "./waterExtensionMissions";
import type { MissionDefinition } from "./types";

/**
 * V51-006 — 任务内容总入口（Content Pack 注册表）。
 * V51-015/016 的新批次直接追加到 ALL_MISSIONS；运行时不硬编码任何任务列表。
 * 顺序约定：迁移 3 任务在最前（保持 V0.5 旧事件 / E2E 的 ID 顺序），新增批次按序号追加。
 */
export const ALL_MISSIONS: readonly MissionDefinition[] = [
  ...CASTLE_WATER_MISSIONS,
  ...WATER_EXTENSION_MISSIONS
];

export function getMissionById(id: string): MissionDefinition | undefined {
  return ALL_MISSIONS.find((mission) => mission.id === id);
}

export function getMissionByEvaluatorId(evaluatorId: string): MissionDefinition | undefined {
  return ALL_MISSIONS.find((mission) => mission.evaluatorId === evaluatorId);
}

export { CASTLE_WATER_MISSIONS, WATER_EXTENSION_MISSIONS, LEGACY_QUEST_ID_BY_MISSION, MISSION_ID_BY_LEGACY_QUEST };
