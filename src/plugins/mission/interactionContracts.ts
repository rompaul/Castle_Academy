/**
 * V07-004 — 交互契约与只读查询通道（ADR-0014 决策 4 / ADR-0015 决策 2）。
 *
 * 本文件只有类型与纯函数：不碰界面、渲染与浏览器存储，不持有状态，
 * 不产生副作用。三个通道都是「运行时派生 → 不可变只读快照」，评估器只能读，
 * 写不回运行时记录；记录本身永不序列化，永不进 WorldSnapshot / LearnerProfile。
 *
 * 上限常量与溢出策略由 V07-009 冻结；生命周期清空由 V07-005 实现。
 */
import type { GridPosition } from "../../core/world/coordinates";

/** 既有二值规则的状态名（电：open / closed；水：wet / dry）。不含任何物理量。 */
export type BinaryState = "open" | "closed" | "wet" | "dry";

/** Exploration：一条去重后的观察条目；target 是受控选项标识，不是自由文本。 */
export interface ObservationEntry {
  readonly missionId: string;
  readonly target: string;
  /** 可选的世界格坐标，便于把观察与位置关联；同样只读 */
  readonly position?: Readonly<GridPosition>;
  readonly sequence: number;
}

/** Experiment：同一位置的两个二值状态对照，复用既有开 / 关、湿 / 干规则。 */
export interface VariablePair {
  readonly missionId: string;
  readonly position: Readonly<GridPosition>;
  readonly stateA: BinaryState;
  readonly stateB: BinaryState;
  /** 两态下的二值结果（例如灯是否通电），不是数值测量 */
  readonly outcomeA: boolean;
  readonly outcomeB: boolean;
  readonly sequence: number;
}

/** Life simulation：一次情境选择；不写 WorldState。 */
export interface DecisionEntry {
  readonly missionId: string;
  readonly step: number;
  readonly choiceId: string;
  readonly sequence: number;
}

/** 三个只读通道的派生快照。 */
export interface InteractionSnapshot {
  readonly observationLog: ReadonlyArray<ObservationEntry>;
  readonly variableComparison: ReadonlyArray<VariablePair>;
  readonly decisionSequence: ReadonlyArray<DecisionEntry>;
}

/** 允许部分注入：只给其中几个通道也能投影出完整快照。 */
export interface InteractionSnapshotSource {
  readonly observationLog?: ReadonlyArray<ObservationEntry>;
  readonly variableComparison?: ReadonlyArray<VariablePair>;
  readonly decisionSequence?: ReadonlyArray<DecisionEntry>;
}

/** 未注入任何通道时的稳定回退：三个空数组均已冻结。 */
export const EMPTY_INTERACTION_SNAPSHOT: InteractionSnapshot = Object.freeze({
  observationLog: Object.freeze([] as ObservationEntry[]) as ReadonlyArray<ObservationEntry>,
  variableComparison: Object.freeze([] as VariablePair[]) as ReadonlyArray<VariablePair>,
  decisionSequence: Object.freeze([] as DecisionEntry[]) as ReadonlyArray<DecisionEntry>
});

function freezePlainObject(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  // 只冻结普通字面量对象（例如 position），绝不触碰 Map / Set / Date 等运行时容器
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

function freezeRecord<T extends object>(record: T): T {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    copy[key] = freezePlainObject(value);
  }
  return Object.freeze(copy) as unknown as T;
}

/**
 * 纯函数：把一组可变运行时记录投影成冻结的只读快照。
 * 不修改输入、不共享引用；同一输入多次调用产出等价结果。
 */
export function toInteractionSnapshot(source: InteractionSnapshotSource = {}): InteractionSnapshot {
  const project = <T extends object>(entries: ReadonlyArray<T> | undefined): ReadonlyArray<T> =>
    Object.freeze((entries ?? []).map((entry) => freezeRecord(entry))) as ReadonlyArray<T>;
  return Object.freeze({
    observationLog: project(source.observationLog),
    variableComparison: project(source.variableComparison),
    decisionSequence: project(source.decisionSequence)
  });
}
