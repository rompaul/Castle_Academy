/**
 * V07-013~020 — 形式交互的纯数据模型（无 React / DOM / 渲染依赖）。
 *
 * 受控选项标签、两态对照行、决策回看行、空态文案与输入焦点守卫都在此集中，
 * 便于单测；UI 组件只负责渲染与回调，不自行推导判定依据。
 */
import type { ExpressionForm } from "../../content/missions/types";
import type { DecisionEntry } from "../../plugins/mission/interactionContracts";
import type { SwitchObservation } from "../../plugins/electrical/query";

export const OBSERVATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "water-source": "水源旁边",
  "channel-end": "水沟尽头",
  "moat-side": "护城河边"
});

export const HYPOTHESIS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  source: "水源那边",
  break: "水路断开",
  valve: "阀门关着"
});

export const ROUTE_CHOICE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "near-stream": "靠近水源",
  "save-material": "省着用材料",
  "care-garden": "照顾花园",
  "share-water": "分水给别处",
  "steady-flow": "让水稳稳地流"
});

/** 儿童可见文案禁用词（AC-7055 / ADR-0016），UI 与内容共用同一份口径。 */
export const FORBIDDEN_CHILD_WORDS =
  /等级|难度|年级|百分比|Tier|掌握度|红石|正确率|星级|得分|扣分|分数/;

export function hasForbiddenChildWording(text: string): boolean {
  return FORBIDDEN_CHILD_WORDS.test(text);
}

export interface PairRow {
  readonly key: string;
  readonly label: string;
  /** 同一位置的格子坐标；供「记下这组对照」回写成只读取证记录。 */
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly closedPowered: boolean;
  readonly openUnpowered: boolean;
  readonly both: boolean;
}

/** 同一位置的两种二值状态；零物理量，只有「灯亮 / 不亮」这类既有观察。 */
export function buildPairRows(observations: readonly SwitchObservation[]): PairRow[] {
  const groups = new Map<string, { closedPowered: boolean; openUnpowered: boolean }>();
  for (const observation of observations) {
    const key = `${observation.position.x},${observation.position.y},${observation.position.z}`;
    const row = groups.get(key) ?? { closedPowered: false, openUnpowered: false };
    if (observation.state === "closed" && observation.lampPowered) row.closedPowered = true;
    if (observation.state === "open" && !observation.lampPowered) row.openUnpowered = true;
    groups.set(key, row);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => {
      const [x, y, z] = key.split(",").map(Number);
      return {
        key,
        label: `第 ${key.split(",").join(" · ")} 格`,
        position: { x, y, z },
        closedPowered: row.closedPowered,
        openUnpowered: row.openUnpowered,
        both: row.closedPowered && row.openUnpowered
      };
    });
}

export function recordedTargets(
  entries: readonly { readonly missionId: string; readonly target: string }[],
  missionId: string
): string[] {
  return [...new Set(entries.filter((e) => e.missionId === missionId).map((e) => e.target))];
}

export interface DecisionRow {
  readonly step: number;
  readonly choiceId: string | null;
  readonly label: string;
}

export function decisionRows(
  entries: readonly DecisionEntry[],
  missionId: string,
  stepCount: number,
  choices: readonly string[]
): DecisionRow[] {
  const latest = new Map<number, DecisionEntry>();
  for (const entry of entries) {
    if (entry.missionId !== missionId || entry.step < 1 || entry.step > stepCount) continue;
    const current = latest.get(entry.step);
    if (!current || entry.sequence >= current.sequence) latest.set(entry.step, entry);
  }
  void choices;
  return Array.from({ length: stepCount }, (_, index) => {
    const step = index + 1;
    const choiceId = latest.get(step)?.choiceId ?? null;
    return {
      step,
      choiceId,
      label: choiceId ? ROUTE_CHOICE_LABELS[choiceId] ?? choiceId : "还没选"
    };
  });
}

export function emptyStateText(form: ExpressionForm): string {
  switch (form) {
    case "exploration": return "还没有记下观察，去三个地方看一看。";
    case "experiment": return "还没看到两种样子。盯着同一个开关按两下。";
    case "problem-solving": return "先选一个猜想，再去查一查。";
    case "life-simulation": return "还没有做选择，从第一步开始。";
    case "communication": return "还没有留下解释，想写的时候再写。";
    case "creation": return "还没有放标记方块，先去造一张小地图。";
    default: return "这里还空着，随时可以开始。";
  }
}

/** V07-018 / DEV-704：输入框内不得触发任何世界快捷键；滚轮守卫复用同一判定。 */
export function isTypingTarget(
  target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null | undefined
): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
}

export function choicesForStep(choices: readonly string[], step: number): string[] {
  if (choices.length <= 3) return [...choices];
  const offset = (step - 1) % choices.length;
  return [0, 1, 2].map((i) => choices[(offset + i) % choices.length]);
}
