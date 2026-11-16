/**
 * V0.7.1 — 桥梁任务会话状态机（纯函数，无副作用）。
 *
 * 允许的回退严格按开发规格 §11.4；施工开始后回设计必须由 UI 显式确认
 * 重置施工进度，状态机本身只负责拒绝非法跳转。
 */
import type { DesignStage } from "./types";

export const DESIGN_STAGE_ORDER: readonly DesignStage[] = Object.freeze([
  "briefing",
  "site-survey",
  "guided-design",
  "design-validation",
  "construction",
  "construction-validation",
  "completed"
]);

const ALLOWED: Readonly<Record<DesignStage, readonly DesignStage[]>> = Object.freeze({
  briefing: Object.freeze(["site-survey"] as DesignStage[]),
  "site-survey": Object.freeze(["briefing", "guided-design"] as DesignStage[]),
  "guided-design": Object.freeze(["site-survey", "design-validation"] as DesignStage[]),
  "design-validation": Object.freeze(["guided-design", "construction"] as DesignStage[]),
  construction: Object.freeze(["guided-design", "construction-validation"] as DesignStage[]),
  "construction-validation": Object.freeze(["construction", "completed"] as DesignStage[]),
  completed: Object.freeze([] as DesignStage[])
});

export function canTransition(from: DesignStage, to: DesignStage): boolean {
  return ALLOWED[from].includes(to);
}

/** 非法转换返回原状态；调用方据此给出「还不能去这一步」的提示。 */
export function transitionStage(from: DesignStage, to: DesignStage): DesignStage {
  return canTransition(from, to) ? to : from;
}

export function isTerminalStage(stage: DesignStage): boolean {
  return stage === "completed";
}
