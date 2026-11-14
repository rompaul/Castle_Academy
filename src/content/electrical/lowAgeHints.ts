/**
 * DEV-616 — 活动 C 的低龄替代提示接入（2026-11-14 owner 裁定「选 A」）。
 *
 * `ELECTRICAL_LOW_AGE_PATHS`（C1 只看通电 / C2 只看阀门）原本只是数据常量，
 * 没有任何 UI/运行时引用。本模块把「按档案年龄带选哪套 3 级提示」做成纯函数，
 * 供 `MissionDetailPanel` 使用，也便于单测覆盖。
 *
 * 约束：不新增任务 ID、不改 schema、不改任务定义里的 3 级提示（AC-6741 仍逐字对齐规格）；
 * 只有 6-7 档查看活动 C 时切换到单系统子路径，其余年龄带与其余任务零 UI 变化。
 */

import type { AgeBand } from "../../plugins/learner/types";
import { ELECTRICAL_LOW_AGE_PATHS } from "../missions/electricalMissions";
import type { MissionDefinition } from "../missions/types";

export type LowAgePathId = "C1" | "C2";

export const LOW_AGE_ELECTRICAL_MISSION_ID = "mission.electric-power-pump.v1";

export const LOW_AGE_PATH_IDS: readonly LowAgePathId[] = Object.freeze(["C1", "C2"]);

/** 规格 §8：8 岁以下拆 C1/C2，避免并列 5 种失败原因。 */
export function isLowAgeElectricalMission(
  definitionId: string,
  ageBand: AgeBand | undefined
): boolean {
  return definitionId === LOW_AGE_ELECTRICAL_MISSION_ID && ageBand === "6-7";
}

export function getLowAgePathTitle(id: LowAgePathId): string {
  return ELECTRICAL_LOW_AGE_PATHS[id].title;
}

/** 返回本次应展示的 3 级提示；非低龄场景原样返回任务定义里的 hintLadder。 */
export function resolveHintLadder(
  definition: MissionDefinition,
  ageBand: AgeBand | undefined,
  path: LowAgePathId
): readonly string[] {
  if (!isLowAgeElectricalMission(definition.id, ageBand)) return definition.hintLadder;
  return ELECTRICAL_LOW_AGE_PATHS[path].hintLadder;
}
