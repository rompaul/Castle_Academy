import type { EventBus } from "../../core/events/EventBus";
import { ALL_MISSIONS, LEGACY_QUEST_ID_BY_MISSION } from "../../content/missions";
import type { MissionDefinition, MissionSummary } from "../../content/missions/types";
import type { WaterPlugin } from "../water/WaterPlugin";
import {
  CapabilityRegistry,
  InMemoryMissionProgressStore,
  createV051Capabilities,
  type MissionProgressStore
} from "./CapabilityRegistry";
import { RewardPlugin } from "./RewardPlugin";
import {
  ALL_QUESTS_COMPLETE_EVENT,
  QUEST_COMPLETED_EVENT,
  QUEST_UPDATED_EVENT,
  QUEST_DEFINITIONS,
  createDefaultEvaluatorRegistry,
  evaluateQuests,
  type EvaluatorRegistry,
  type QuestCompletedPayload,
  type QuestState,
  type QuestUpdatedPayload
} from "./evaluators";
import {
  MISSION_EVENTS,
  type MissionActivatedPayload,
  type MissionCompletedPayload,
  type MissionOfferedPayload,
  type MissionProgressUpdatedPayload
} from "./events";

export interface MissionRuntimeOptions {
  missions?: readonly MissionDefinition[];
  evaluators?: EvaluatorRegistry;
  capabilities?: CapabilityRegistry;
  reward?: RewardPlugin;
  /** V51-007 默认内存实现；V51-008 注入学习者档案域适配器 */
  progressStore?: MissionProgressStore;
}

interface MissionState {
  status: "available" | "active" | "completed" | "unavailable";
  progress: number;
  done: number;
  total: number;
  complete: boolean;
  hintsUsed: number;
}

/**
 * V51-007 — MissionRuntimePlugin（ADR-0007）。
 *
 * 单一权威所有者：任务状态机 available → active → completed；
 * 判定只调用 EvaluatorRegistry 中的确定性评估器（不重写 V0.5 逻辑）。
 * 迁移期**单点发射**新 `mission.*` 与旧 `quest.*` 事件（R-603）：
 * 旧面板、旧 E2E、旧 toast 零改动继续工作；STOP GATE-2 后移除旧事件发射。
 *
 * 不触碰 WorldState / WorldSnapshot / 渲染器；只在领域事件后评估（AC-212）。
 */
export class MissionRuntimePlugin {
  readonly id = "mission-runtime";

  private readonly missions: readonly MissionDefinition[];
  private readonly evaluators: EvaluatorRegistry;
  private readonly capabilities: CapabilityRegistry;
  private readonly reward: RewardPlugin;
  private readonly progressStore: MissionProgressStore;

  private readonly states = new Map<string, MissionState>();
  private readonly completedNotified = new Set<string>();
  /** 曾经积过水的 drain 任务（V0.5 防伪完成缺陷修复，AC-216） */
  private readonly everWet = new Set<string>();
  /** 水井测量门槛（V0.5 F-2 缺陷修复，AC-216） */
  private measurementUsed = false;
  private allCompletedNotified = false;
  private active = false;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    private readonly water: WaterPlugin,
    private readonly events: EventBus,
    options: MissionRuntimeOptions = {}
  ) {
    this.missions = options.missions ?? ALL_MISSIONS;
    this.evaluators = options.evaluators ?? createDefaultEvaluatorRegistry();
    this.capabilities = options.capabilities ?? createV051Capabilities();
    this.reward = options.reward ?? new RewardPlugin(events);
    this.progressStore = options.progressStore ?? new InMemoryMissionProgressStore();
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe.push(
      this.events.on("water.flow.updated", () => this.evaluate()),
      this.events.on("measurement.used", () => {
        if (!this.measurementUsed) {
          this.measurementUsed = true;
          this.evaluate();
        }
      })
    );
    if (this.progressStore.onExternalChange) {
      this.unsubscribe.push(this.progressStore.onExternalChange(() => {
        this.reloadFromStore();
        this.evaluate();
      }));
    }
    this.reloadFromStore();
    this.emitOffered();
    this.evaluate();
  }

  dispose(): void {
    this.active = false;
    while (this.unsubscribe.length > 0) this.unsubscribe.pop()?.();
  }

  /** 侧栏/详情初始化快照 + 测试钩子 getMissions() 数据源。 */
  getMissions(): MissionSummary[] {
    return this.missions.map((mission) => {
      const state = this.states.get(mission.id) ?? this.freshState(0, 0);
      const unavailable = this.getMissingCapabilities(mission.id).length > 0
        || !this.evaluators.has(mission.evaluatorId);
      const status = state.status === "completed"
        ? "completed"
        : unavailable ? "unavailable"
          : state.status === "unavailable" ? "available" // 能力补齐后即时恢复
            : state.status;
      return {
        id: mission.id,
        title: mission.title,
        status,
        progress: state.progress,
        progressText: status === "completed"
          ? "已完成"
          : status === "unavailable"
            ? "暂不可玩"
            : this.formatProgress(mission, state.done, state.total),
        ageScope: mission.ageScope,
        evaluatorId: mission.evaluatorId,
        successMessage: mission.successMessage
      };
    });
  }

  getMission(missionId: string): MissionSummary | null {
    return this.getMissions().find((m) => m.id === missionId) ?? null;
  }

  getDefinition(missionId: string): MissionDefinition | undefined {
    return this.missions.find((m) => m.id === missionId);
  }

  getDefinitions(): readonly MissionDefinition[] {
    return this.missions;
  }

  /** 旧面板 / V0.5 E2E 的兼容查询：与 CastleQuestPlugin.getQuests() 语义完全一致。 */
  getQuests(): QuestState[] {
    return evaluateQuests(this.water.getQuery(), this.everWet, this.measurementUsed);
  }

  isAllCompleted(): boolean {
    return this.getMissions().length > 0 && this.getMissions().every((m) => m.status === "completed");
  }

  /** available → active（能力缺失或已完成时拒绝，不抛错）。 */
  activateMission(missionId: string): boolean {
    const definition = this.getDefinition(missionId);
    const state = this.states.get(missionId);
    if (!definition || !state) return false;
    if (this.getMissingCapabilities(missionId).length > 0 || !this.evaluators.has(definition.evaluatorId)) return false;
    if (state.status === "completed" || state.status === "active") return false;
    state.status = "active";
    this.progressStore.set(missionId, { status: "active" });
    this.events.emit<MissionActivatedPayload>(MISSION_EVENTS.activated, { missionId });
    this.emitOffered();
    return true;
  }

  /** 提示阶梯使用次数：只记录、不惩罚（V0.2 LEARNING_MODEL §6）。 */
  useHint(missionId: string): number {
    const current = this.progressStore.get(missionId);
    const next = (current?.hintsUsed ?? 0) + 1;
    this.progressStore.set(missionId, { hintsUsed: next });
    const state = this.states.get(missionId);
    if (state) state.hintsUsed = next;
    return next;
  }

  getHintsUsed(missionId: string): number {
    return this.states.get(missionId)?.hintsUsed ?? this.progressStore.get(missionId)?.hintsUsed ?? 0;
  }

  getMissingCapabilities(missionId: string): string[] {
    const definition = this.getDefinition(missionId);
    return definition ? this.capabilities.missing(definition.requiredCapabilities) : ["unknown-mission"];
  }

  /** 测试钩子：切换能力可用性以覆盖 S8「暂不可玩」态。 */
  setCapabilityAvailable(id: string, available: boolean): void {
    this.capabilities.setAvailable(id, available);
    this.evaluate();
    this.emitOffered();
  }

  /**
   * 世界被整体替换（存档加载/重置）后调用：
   * 只清世界相关派生记忆（everWet / 测量门槛 / allCompleted），
   * **完成态从进度存储恢复**（D-4：ADR-0007 要求完成状态持久化）。
   */
  resetEvaluation(): void {
    this.everWet.clear();
    this.measurementUsed = false;
    this.allCompletedNotified = false;
    this.reloadFromStore();
    this.evaluate();
  }

  /** 显式重算（测试与渲染器 reload 后调用）。 */
  refresh(): void {
    this.evaluate();
  }

  /* ---------------- 内部 ---------------- */

  private freshState(total: number, hintsUsed: number): MissionState {
    return { status: "available", progress: 0, done: 0, total, complete: false, hintsUsed };
  }

  private reloadFromStore(): void {
    this.states.clear();
    this.completedNotified.clear();
    const completed: string[] = [];
    for (const mission of this.missions) {
      const entry = this.progressStore.get(mission.id);
      const status: MissionState["status"] = entry?.status === "completed"
        ? "completed"
        : entry?.status === "active" ? "active" : "available";
      const evaluator = this.evaluators.get(mission.evaluatorId);
      const total = evaluator
        ? evaluator.describe(this.baseQuery()).total
        : 0;
      this.states.set(mission.id, {
        ...this.freshState(total, entry?.hintsUsed ?? 0),
        status,
        complete: status === "completed",
        progress: status === "completed" ? 1 : 0
      });
      if (status === "completed") {
        this.completedNotified.add(mission.id);
        completed.push(mission.id);
      }
    }
    this.reward.restore(completed);
  }

  private baseQuery() {
    return {
      water: this.water.getQuery(),
      everWet: this.everWet as ReadonlySet<string>,
      measurementDone: this.measurementUsed
    };
  }

  private evaluate(): void {
    const query = this.water.getQuery();
    if (!query.isConverged()) return; // 只在收敛时判定，避免中途误判（与 V0.5 一致）

    for (const definition of QUEST_DEFINITIONS) {
      if (definition.direction === "drain" && definition.region.some((cell) => query.hasWater(cell))) {
        this.everWet.add(definition.id);
      }
    }

    // 旧事件兼容：payload 与 V0.5 CastleQuestPlugin 完全一致（AC-215）
    const quests = evaluateQuests(query, this.everWet, this.measurementUsed);
    this.events.emit<QuestUpdatedPayload>(QUEST_UPDATED_EVENT, { quests });

    const evaluatorQuery = this.baseQuery();
    for (const mission of this.missions) {
      const evaluator = this.evaluators.get(mission.evaluatorId);
      const state = this.states.get(mission.id) ?? this.freshState(0, 0);
      if (evaluator) {
        const result = evaluator.evaluate(evaluatorQuery);
        const described = evaluator.describe(evaluatorQuery);
        state.progress = result.progress;
        state.complete = result.complete;
        state.done = described.done;
        state.total = described.total;
      }
      const unavailable = this.getMissingCapabilities(mission.id).length > 0 || !evaluator;
      if (state.status !== "completed") {
        state.status = unavailable ? "unavailable" : state.status === "active" ? "active" : "available";
      }
      this.states.set(mission.id, state);

      this.events.emit<MissionProgressUpdatedPayload>(MISSION_EVENTS.progressUpdated, {
        missionId: mission.id,
        progress: state.progress,
        complete: state.status === "completed"
      });

      if (state.complete && !unavailable && !this.completedNotified.has(mission.id)) {
        this.completedNotified.add(mission.id);
        state.status = "completed";
        this.states.set(mission.id, state);
        this.progressStore.set(mission.id, {
          status: "completed",
          evidence: {
            completedAt: new Date().toISOString(),
            evaluatorId: mission.evaluatorId
          }
        });

        this.events.emit<MissionCompletedPayload>(MISSION_EVENTS.completed, {
          missionId: mission.id,
          successMessage: mission.successMessage,
          reward: mission.reward
        });
        // 旧 toast 兼容（旧面板订阅），ID 保持 V0.5 的 quest-*
        this.events.emit<QuestCompletedPayload>(QUEST_COMPLETED_EVENT, {
          id: LEGACY_QUEST_ID_BY_MISSION[mission.id] ?? mission.id,
          title: mission.title,
          successMessage: mission.successMessage
        });
        this.reward.grant(mission.id, mission.reward);
      }
    }

    this.emitOffered();
    if (!this.allCompletedNotified && this.isAllCompleted()) {
      this.allCompletedNotified = true;
      this.events.emit(ALL_QUESTS_COMPLETE_EVENT, {});
    }
  }

  private emitOffered(): void {
    this.events.emit<MissionOfferedPayload>(MISSION_EVENTS.offered, { missions: this.getMissions() });
  }

  private formatProgress(mission: MissionDefinition, done: number, total: number): string {
    return mission.progressLanguage
      .replace("{done}", String(Math.max(0, Math.min(done, total))))
      .replace("{total}", String(total));
  }
}
