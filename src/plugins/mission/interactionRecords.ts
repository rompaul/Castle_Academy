/**
 * V07-005 / V07-009 / V07-018 — 有界运行时交互记录（ADR-0014 决策 7 / ADR-0015 决策 2）。
 *
 * 与 `MissionRuntimePlugin.textEvidence` 同族：只在运行时内存，绝不序列化、
 * 绝不写浏览器存储 / 世界存档 / 学习者档案。由唯一 MissionRuntimePlugin
 * 实例持有，不新建平行子系统；不注册事件、不设定时器、不做每帧扫描。
 *
 * 三个通道各有显式上限，溢出策略冻结为「丢弃最旧」（AC-7032）。
 * 反思文本单独存放：**不进 snapshot()、不进 EvaluatorQuery、不参与任何判定**，
 * 但与其它会话记录共用同一套读档 / 重置 / 卸载清空生命周期。
 */
import type { GridPosition } from "../../core/world/coordinates";
import {
  EMPTY_INTERACTION_SNAPSHOT,
  toInteractionSnapshot,
  type BinaryState,
  type DecisionEntry,
  type InteractionSnapshot,
  type ObservationEntry,
  type VariablePair
} from "./interactionContracts";

/** 每通道显式上限，与 V0.6.1 `MAX_SWITCH_OBSERVATIONS = 128` 同量级。 */
export const OBSERVATION_LOG_LIMIT = 128;
export const VARIABLE_COMPARISON_LIMIT = 128;
export const DECISION_SEQUENCE_LIMIT = 128;
/** 兼容别名：三个通道默认同值。 */
export const INTERACTION_RECORD_LIMIT = 128;
/** 溢出行为：丢弃最旧（与 `ElectricalPlugin` 的开关观察一致），不拒绝新增。 */
export const INTERACTION_OVERFLOW_POLICY = "drop-oldest" as const;

export interface VariablePairInput {
  readonly missionId: string;
  readonly position: Readonly<GridPosition>;
  readonly stateA: BinaryState;
  readonly stateB: BinaryState;
  readonly outcomeA: boolean;
  readonly outcomeB: boolean;
}

const samePosition = (a: Readonly<GridPosition>, b: Readonly<GridPosition>): boolean =>
  a.x === b.x && a.y === b.y && a.z === b.z;

export class InteractionRecords {
  private readonly observations: ObservationEntry[] = [];
  private readonly pairs: VariablePair[] = [];
  private readonly decisions: DecisionEntry[] = [];
  /** V07-018：只供本地展示，绝不投影到评估器查询 */
  private readonly reflections = new Map<string, string>();
  private readonly observationLimit: number;
  private readonly variableLimit: number;
  private readonly decisionLimit: number;
  private sequence = 0;
  private cached: InteractionSnapshot = EMPTY_INTERACTION_SNAPSHOT;
  private dirty = false;

  /** 仅测试可用数字参数统一缩小上限；产品路径一律使用三个显式常量。 */
  constructor(limit?: number) {
    const override = typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : undefined;
    this.observationLimit = override ?? OBSERVATION_LOG_LIMIT;
    this.variableLimit = override ?? VARIABLE_COMPARISON_LIMIT;
    this.decisionLimit = override ?? DECISION_SEQUENCE_LIMIT;
  }

  /** Exploration：受控选项去重，重复观察不新增、不推进序号。 */
  addObservation(missionId: string, target: string, position?: Readonly<GridPosition>): boolean {
    const key = target.trim();
    if (!missionId || !key) return false;
    if (this.observations.some((o) => o.missionId === missionId && o.target === key)) return false;
    this.pushBounded(this.observations, {
      missionId,
      target: key,
      ...(position ? { position: { ...position } } : {}),
      sequence: ++this.sequence
    }, this.observationLimit);
    this.invalidate();
    return true;
  }

  /** Experiment：同一位置 / 同一对二值状态只记一次，零物理量。 */
  addVariablePair(input: VariablePairInput): boolean {
    if (!input.missionId) return false;
    const duplicate = this.pairs.some((pair) => pair.missionId === input.missionId
      && samePosition(pair.position, input.position)
      && pair.stateA === input.stateA && pair.stateB === input.stateB);
    if (duplicate) return false;
    this.pushBounded(this.pairs, {
      missionId: input.missionId,
      position: { ...input.position },
      stateA: input.stateA,
      stateB: input.stateB,
      outcomeA: input.outcomeA,
      outcomeB: input.outcomeB,
      sequence: ++this.sequence
    }, this.variableLimit);
    this.invalidate();
    return true;
  }

  /**
   * 决策通道：step >= 1 为 Life simulation 的情境步骤，step === 0 保留给
   * Problem-solving 的「当前假设」（V07-015）；两者都是同一步可改、覆盖而不新增，
   * 改猜想不惩罚。负数与非整数仍拒绝。
   */
  addDecision(missionId: string, step: number, choiceId: string): boolean {
    const choice = choiceId.trim();
    if (!missionId || !choice || !Number.isInteger(step) || step < 0) return false;
    const index = this.decisions.findIndex((d) => d.missionId === missionId && d.step === step);
    if (index >= 0) {
      this.decisions[index] = {
        ...this.decisions[index],
        choiceId: choice,
        sequence: ++this.sequence
      };
    } else {
      this.pushBounded(this.decisions, {
        missionId,
        step,
        choiceId: choice,
        sequence: ++this.sequence
      }, this.decisionLimit);
    }
    this.invalidate();
    return true;
  }

  /** V07-018：反思只 trim + 非空，不评判内容；与判定通道完全隔离。 */
  setReflection(missionId: string, text: string): boolean {
    if (!missionId) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    this.reflections.set(missionId, trimmed);
    return true;
  }

  getReflection(missionId: string): string | null {
    return this.reflections.get(missionId) ?? null;
  }

  /** 冻结的只读派生快照；反思文本**不在**其中。 */
  snapshot(): InteractionSnapshot {
    if (!this.dirty) return this.cached;
    this.cached = toInteractionSnapshot({
      observationLog: this.observations,
      variableComparison: this.pairs,
      decisionSequence: this.decisions
    });
    this.dirty = false;
    return this.cached;
  }

  /** 读档 / 重置 / 档案切换 / 卸载统一走这里：彻底释放，不残留。 */
  clear(): void {
    this.observations.length = 0;
    this.pairs.length = 0;
    this.decisions.length = 0;
    this.reflections.clear();
    this.sequence = 0;
    this.dirty = false;
    this.cached = EMPTY_INTERACTION_SNAPSHOT;
  }

  get size(): { observationLog: number; variableComparison: number; decisionSequence: number } {
    return {
      observationLog: this.observations.length,
      variableComparison: this.pairs.length,
      decisionSequence: this.decisions.length
    };
  }

  private pushBounded<T>(list: T[], entry: T, limit: number): void {
    if (list.length >= limit) list.shift();
    list.push(entry);
  }

  private invalidate(): void {
    this.dirty = true;
  }
}
