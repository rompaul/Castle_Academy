/**
 * V07-010 — 六个新任务的低龄提示子路径（ADR-0015 / `06_LEARNING` §4）。
 *
 * 沿用 V0.6.1 `DEV-616` 的口径：**同一任务内切换提示，不新增任务 ID、不改 schema、
 * 不改任务定义里的 3 级提示**。只有 6-7 档查看两个低龄主形式任务时换成更短的句子，
 * 每条只指向一类主要东西，避免并列多种失败原因；其余年龄档与其余任务零变化。
 */
import type { AgeBand } from "../../plugins/learner/types";
import type { MissionDefinition } from "./types";

export const V07_LOW_AGE_HINT_PATHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "mission.find-the-pattern.v1": Object.freeze([
    "有的地方有水，有的地方没有。",
    "去水源旁边看看。",
    "按「记下我看到」，一处按一次。"
  ]),
  "mission.story-map.v1": Object.freeze([
    "地图里要放三个地方。",
    "先想想早上在哪里。",
    "每个地方放一个标记方块。"
  ])
});

export const V07_LOW_AGE_MISSION_IDS: readonly string[] = Object.freeze(
  Object.keys(V07_LOW_AGE_HINT_PATHS)
);

/** 返回本次应展示的 3 级提示；非低龄场景原样返回定义里的 hintLadder（同一引用）。 */
export function resolveV07HintLadder(
  definition: MissionDefinition,
  ageBand: AgeBand | undefined
): readonly string[] {
  if (ageBand !== "6-7") return definition.hintLadder;
  return V07_LOW_AGE_HINT_PATHS[definition.id] ?? definition.hintLadder;
}
