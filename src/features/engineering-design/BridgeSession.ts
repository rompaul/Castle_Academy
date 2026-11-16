/**
 * V0.7.1 — 桥梁任务会话控制器（内存态，零落盘）。
 *
 * 只持有当前设计参数、阶段和由纯函数派生出的结果；不碰 WorldState、
 * 不写任何 localStorage key。刷新页面后从委托阶段重新开始（规格允许会话草稿）。
 */
import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import {
  computeBridgeDesign,
  createBridgeBlueprint,
  createConstructionEvidence,
  validateBridgeDesign
} from "./design";
import { transitionStage } from "./session";
import type {
  BridgeBlueprint,
  BridgeDesignComputed,
  BridgeDesignInput,
  BridgeScenario,
  ConstructionEvidence,
  DesignStage,
  DesignValidationResult
} from "./types";

export interface BridgeSessionSnapshot {
  readonly stage: DesignStage;
  readonly input: BridgeDesignInput;
  readonly computed: BridgeDesignComputed;
  readonly validation: DesignValidationResult;
  readonly blueprint: BridgeBlueprint | null;
  readonly evidence: ConstructionEvidence | null;
  readonly measurementDone: boolean;
  readonly hintLevel: number;
  /** 河道是否已在 3D 场景中显示；任务开始即 true，干净世界仍为 false。 */
  readonly sceneActive: boolean;
}

export type BridgeSessionListener = (snapshot: BridgeSessionSnapshot) => void;

export class BridgeSession {
  private stage: DesignStage = "briefing";
  private input: BridgeDesignInput;
  private blueprint: BridgeBlueprint | null = null;
  private evidence: ConstructionEvidence | null = null;
  private measurementDone = false;
  private hintLevel = 0;
  private sceneActive = false;
  private readonly listeners = new Set<BridgeSessionListener>();

  constructor(
    private readonly scenario: BridgeScenario,
    private readonly blueprintId: string
  ) {
    this.input = this.initialInput();
    this.emit();
  }

  private initialInput(): BridgeDesignInput {
    return {
      scenarioId: this.scenario.scenarioId,
      measuredRiverSpan: 0,
      deckLength: this.scenario.deckLengthRange[0],
      deckWidth: this.scenario.deckWidthRange[0],
      materialBlockId: this.scenario.materialBlockId
    };
  }

  getSnapshot(): BridgeSessionSnapshot {
    const computed = computeBridgeDesign(this.scenario, this.input);
    return Object.freeze({
      stage: this.stage,
      input: this.input,
      computed,
      validation: validateBridgeDesign(this.scenario, this.input),
      blueprint: this.blueprint,
      evidence: this.evidence,
      measurementDone: this.measurementDone,
      hintLevel: this.hintLevel,
      sceneActive: this.sceneActive
    });
  }

  subscribe(listener: BridgeSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  /** 进入任务：河道动态出现，但还没有测量值。 */
  start(): void {
    this.sceneActive = true;
    this.stage = "briefing";
    this.emit();
  }

  setMeasuredRiverSpan(value: number): boolean {
    if (!Number.isFinite(value) || value <= 0) return false;
    this.input = { ...this.input, measuredRiverSpan: value };
    this.measurementDone = true;
    // 第一次测量就是从委托跨入现场测绘的自然动作。
    if (this.stage === "briefing") this.goStage("site-survey");
    else this.emit();
    return true;
  }

  setDeckLength(value: number): boolean {
    if (!Number.isInteger(value)) return false;
    this.input = { ...this.input, deckLength: value };
    this.emit();
    return true;
  }

  setDeckWidth(value: number): boolean {
    if (!Number.isInteger(value)) return false;
    this.input = { ...this.input, deckWidth: value };
    this.emit();
    return true;
  }

  setMaterialBlockId(blockId: BlockId): void {
    this.input = { ...this.input, materialBlockId: blockId };
    this.emit();
  }

  setHintLevel(level: number): void {
    this.hintLevel = Math.max(0, Math.min(level, 4));
    this.emit();
  }

  /** 阶段跳转；非法跳转返回 false 且不改变状态。 */
  goStage(to: DesignStage): boolean {
    const next = transitionStage(this.stage, to);
    if (next === this.stage) return false;
    this.stage = next;
    if (next === "site-survey") this.sceneActive = true;
    this.emit();
    return true;
  }

  /** 设计检查通过后才生成施工蓝图，并进入施工阶段。 */
  enterConstruction(): boolean {
    if (this.stage !== "design-validation") return false;
    const validation = validateBridgeDesign(this.scenario, this.input);
    if (!validation.passed) return false;
    this.blueprint = createBridgeBlueprint(this.scenario, this.input, this.blueprintId);
    this.evidence = createConstructionEvidence(this.blueprint, () => undefined);
    return this.goStage("construction");
  }

  /** 用世界只读查询刷新施工证据；evaluator 之后只读这份快照。 */
  syncEvidence(blockAt: (position: GridPosition) => BlockId | undefined): void {
    if (!this.blueprint) return;
    this.evidence = createConstructionEvidence(this.blueprint, blockAt);
    this.emit();
  }

  completeConstruction(): boolean {
    return this.goStage("construction-validation");
  }

  markCompleted(): boolean {
    return this.goStage("completed");
  }

  /** 返回设计工作台时显式丢弃旧蓝图/证据（UI 必须先向学习者确认）。 */
  returnToDesign(): boolean {
    const ok = this.goStage("guided-design");
    if (ok) {
      this.blueprint = null;
      this.evidence = null;
      this.emit();
    }
    return ok;
  }

  reset(): void {
    this.stage = "briefing";
    this.input = this.initialInput();
    this.blueprint = null;
    this.evidence = null;
    this.measurementDone = false;
    this.hintLevel = 0;
    this.sceneActive = false;
    this.emit();
  }

  dispose(): void {
    this.listeners.clear();
  }
}
