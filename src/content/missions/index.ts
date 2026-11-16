import { CASTLE_WATER_MISSIONS, LEGACY_QUEST_ID_BY_MISSION, MISSION_ID_BY_LEGACY_QUEST } from "./castleWaterMissions";
import { WATER_EXTENSION_MISSIONS } from "./waterExtensionMissions";
import { CROSS_AGE_MISSIONS } from "./crossAgeMissions";
import { ELECTRICAL_MISSIONS } from "./electricalMissions";
import { V07_MISSIONS } from "./interactiveMissions";
import { V071_MISSIONS } from "./v071Missions";
import type { MissionDefinition } from "./types";

/**
 * V51-006 — 任务内容总入口（Content Pack 注册表）。
 * V51-015/016 的新批次直接追加到 ALL_MISSIONS；运行时不硬编码任何任务列表。
 * 顺序约定：迁移 3 任务在最前（保持 V0.5 旧事件 / E2E 的 ID 顺序），新增批次按序号追加。
 * V0.6.1（DEV-613 裁定 A）：3 个电力任务**只追加到末尾**，既有 15 个 ID 与顺序零变更。
 * V0.7（V07-021）：6 个形式专属任务同样**只追加到末尾**，既有 18 个 ID 与顺序零变更；
 * 期望值适配逐条留痕见 docs/v0.7/V07-021_EXPECTATION_ADAPTATION.md。
 */
export const ALL_MISSIONS: readonly MissionDefinition[] = [
  ...CASTLE_WATER_MISSIONS,
  ...WATER_EXTENSION_MISSIONS,
  ...CROSS_AGE_MISSIONS,
  ...ELECTRICAL_MISSIONS,
  ...V07_MISSIONS,
  ...V071_MISSIONS
];

export function getMissionById(id: string): MissionDefinition | undefined {
  return ALL_MISSIONS.find((mission) => mission.id === id);
}

export function getMissionByEvaluatorId(evaluatorId: string): MissionDefinition | undefined {
  return ALL_MISSIONS.find((mission) => mission.evaluatorId === evaluatorId);
}

export { CASTLE_WATER_MISSIONS, WATER_EXTENSION_MISSIONS, CROSS_AGE_MISSIONS, ELECTRICAL_MISSIONS, V07_MISSIONS, V071_MISSIONS, LEGACY_QUEST_ID_BY_MISSION, MISSION_ID_BY_LEGACY_QUEST };
