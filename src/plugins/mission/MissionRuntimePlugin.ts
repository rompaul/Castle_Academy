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
  type QuestUpdatedPayload,
  type WorldReadQuery
} from "./evaluators";
import {
  MISSION_EVENTS,
  type MissionActivatedPayload,
  type MissionCompletedPayload,
  type MissionOfferedPayload,
  type MissionProgressUpdatedPayload,
  type MissionUnlockedPayload
} from "./events";
import { isMissionUnlocked } from "../../content/knowledge/missionGraph";
import type { MasteryEvidenceRecord } from "../learner/types";

export interface MissionRuntimeOptions {
  missions?: readonly MissionDefinition[];
  evaluators?: EvaluatorRegistry;
  capabilities?: CapabilityRegistry;
  reward?: RewardPlugin;
  /** V51-007 默认内存实现；V51-008 注入学习者档案域适配器 */
  progressStore?: MissionProgressStore;
  /** V51-015+ 世界方块只读快照（建造/计数/对称类评估器）；不触碰稳定契约 */
  world?: WorldReadQuery;
  /** V51-016 剖面视图查询（剖面侦探）；未注入时恒为 false */
  sectionEnabled?: () => boolean;
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
  /**
   * 档案切换后抑制"继承别人的世界状态"直接完成任务（AC-202 互不串扰）：
   * 新档案必须等一次真实的世界变化（water.flow.updated / measurement.used）才允许判定完成。
   */
  private completionSuppressed = false;
  private active = false;
  private readonly unsubscribe: Array<() => void> = [];
  /** V51-015+ 学习者文字证据：只在运行时内存，绝不写入档案 / 世界存档（ADR-0006 字段最小化） */
  private readonly textEvidence = new Map<string, string>();
  /** V06-012：mission.unlocked 只在 locked → 可玩 转变时发射一次（确定性、可重放） */
  private readonly unlockedNotified = new Set<string>();
  /** V06-012：本轮会话中曾处于 locked 的任务（转变检测） */
  private readonly seenLocked = new Set<string>();
  /** 结构性变化（放置方块 / 剖面切换 / 提交文字）需要一次收敛后的重算 */
  private structuralDirty = false;
  private readonly world?: WorldReadQuery;
  private readonly sectionEnabled: () => boolean;

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
    this.world = options.world;
    this.sectionEnabled = options.sectionEnabled ?? (() => false);
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe.push(
      this.events.on("water.flow.updated", () => {
        this.completionSuppressed = false;
        this.evaluate();
      }),
      this.events.on("measurement.used", () => {
        this.completionSuppressed = false;
        if (!this.measurementUsed) {
          this.measurementUsed = true;
          this.evaluate();
        }
      }),
      // V51-015/016：结构性变化不改水域时 water.flow.updated 不会发射，
      // 用「收敛后的下一 tick」补一次重算，保证建造/剖面/文字证据类任务即时反馈。
      this.events.on("world.block.placed", () => { this.structuralDirty = true; }),
      this.events.on("world.block.removed", () => { this.structuralDirty = true; }),
      // 剖面切换不改变水域，WaterPlugin 不会发射任何 tick；此处直接重算一次。
      this.events.on("section.view.changed", () => {
        this.structuralDirty = true;
        this.evaluate();
      }),
      this.events.on("water.simulation.tick", () => {
        if (!this.structuralDirty) return;
        if (!this.water.getQuery().isConverged()) return;
        this.structuralDirty = false;
        this.evaluate();
      })
    );
    if (this.progressStore.onExternalChange) {
      this.unsubscribe.push(this.progressStore.onExternalChange(() => {
        this.everWet.clear();
        this.measurementUsed = false;
        this.allCompletedNotified = false;
        this.completionSuppressed = true;
        this.textEvidence.clear(); // 别人的文字证据不得串到新档案
        this.structuralDirty = false;
        this.seenLocked.clear(); // V06-012：解锁派生记忆随档案重置
        this.unlockedNotified.clear();
        this.reloadFromStore();
        this.emitOffered();
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
      // V06-011：locked 为纯派生视图态（前置未完成），不落持久化
      const locked = !unavailable
        && state.status !== "completed"
        && !isMissionUnlocked(mission.id, this.completedIds(), this.missions);
      const status = state.status === "completed"
        ? "completed"
        : unavailable ? "unavailable"
          : locked ? "locked"
            : state.status === "unavailable" ? "available" // 能力补齐后即时恢复
              : state.status;
      // V06-018（K3）：未完成前置的标题，按定义顺序；锁定文案「先完成〈任务名〉」
      const prerequisiteTitles = mission.prerequisiteMissionIds
        .filter((id) => !this.completedIds().has(id))
        .map((id) => this.missions.find((m) => m.id === id)?.title ?? id);
      return {
        id: mission.id,
        title: mission.title,
        status,
        progress: state.progress,
        progressText: status === "completed"
          ? "已完成"
          : status === "unavailable"
            ? "暂不可玩"
            : status === "locked"
              ? prerequisiteTitles.length > 0 ? `先完成〈${prerequisiteTitles[0]}〉` : "未解锁"
              : this.formatProgress(mission, state.done, state.total),
        ageScope: mission.ageScope,
        evaluatorId: mission.evaluatorId,
        successMessage: mission.successMessage,
        prerequisiteTitles
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

  /** available → active（能力缺失、已完成或前置未完成时拒绝，不抛错）。 */
  activateMission(missionId: string): boolean {
    const definition = this.getDefinition(missionId);
    const state = this.states.get(missionId);
    if (!definition || !state) return false;
    if (this.getMissingCapabilities(missionId).length > 0 || !this.evaluators.has(definition.evaluatorId)) return false;
    if (state.status === "completed" || state.status === "active") return false;
    if (!isMissionUnlocked(missionId, this.completedIds(), this.missions)) return false; // V06-011 locked 拒绝
    state.status = "active";
    this.progressStore.set(missionId, { status: "active" });
    this.events.emit<MissionActivatedPayload>(MISSION_EVENTS.activated, { missionId });
    this.emitOffered();
    return true;
  }

  /** 提示阶梯使用次数：只记录、不惩罚（V0.2 LEARNING_MODEL §6）。 */
  useHint(missionId: string): number {
    const state = this.states.get(missionId);
    // 无档案降级路径下 progressStore 不会持久化；此时以运行时状态为准继续累计
    const stored = this.progressStore.get(missionId);
    const next = (stored?.hintsUsed ?? state?.hintsUsed ?? 0) + 1;
    this.progressStore.set(missionId, { hintsUsed: next });
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
    this.completionSuppressed = false;
    this.seenLocked.clear();
    this.unlockedNotified.clear();
    this.reloadFromStore();
    this.evaluate();
  }

  /** 显式重算（测试与渲染器 reload 后调用）。 */
  refresh(): void {
    this.evaluate();
  }

  /**
   * V51-016 交流类任务证据：只做 trim + 非空存储，**不评判内容质量**（AC-232）。
   * 最短长度由评估器判定；文本只留在运行时内存，不写 localStorage / WorldSnapshot。
   */
  submitTextEvidence(missionId: string, text: string): boolean {
    if (!this.getDefinition(missionId)) return false;
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    this.textEvidence.set(missionId, trimmed);
    this.structuralDirty = true;
    this.evaluate();
    return true;
  }

  getTextEvidence(missionId: string): string | null {
    return this.textEvidence.get(missionId) ?? null;
  }

  /* ---------------- 内部 ---------------- */

  /** V06-011：已完成任务 ID 集合（locked 派生与解锁判定的唯一事实源） */
  private completedIds(): ReadonlySet<string> {
    return new Set(
      [...this.states.entries()].filter(([, s]) => s.status === "completed").map(([id]) => id)
    );
  }

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
      measurementDone: this.measurementUsed,
      world: this.world,
      textEvidence: this.textEvidence as ReadonlyMap<string, string>,
      sectionEnabled: this.sectionEnabled()
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

      // V06-012：locked → 可玩 转变检测与一次性 mission.unlocked 发射（确定性、可重放）
      const lockedNow = state.status !== "completed" && !unavailable
        && !isMissionUnlocked(mission.id, this.completedIds(), this.missions);
      if (lockedNow) {
        this.seenLocked.add(mission.id);
      } else if (this.seenLocked.has(mission.id) && !this.unlockedNotified.has(mission.id)) {
        this.seenLocked.delete(mission.id);
        this.unlockedNotified.add(mission.id);
        this.events.emit<MissionUnlockedPayload>(MISSION_EVENTS.unlocked, { missionId: mission.id });
      }

      this.events.emit<MissionProgressUpdatedPayload>(MISSION_EVENTS.progressUpdated, {
        missionId: mission.id,
        progress: state.progress,
        complete: state.status === "completed"
      });

      if (state.complete && !this.completionSuppressed && !unavailable && !this.completedNotified.has(mission.id)) {
        this.completedNotified.add(mission.id);
        state.status = "completed";
        this.states.set(mission.id, state);
        const completedAt = new Date().toISOString();
        this.progressStore.set(mission.id, {
          status: "completed",
          evidence: {
            completedAt,
            evaluatorId: mission.evaluatorId
          }
        });
        // V06-013/014：完成时按知识点落掌握证据（observation 为评估器产出的确定性摘要）
        const evidenceRecords: MasteryEvidenceRecord[] = (mission.knowledgePointIds ?? []).map((knowledgePointId) => ({
          missionId: mission.id,
          evaluatorId: mission.evaluatorId,
          knowledgePointId,
          completedAt,
          observation: evaluator?.evaluate(evaluatorQuery).evidence?.observation
            ?? `${state.done}/${state.total}`
        }));
        if (evidenceRecords.length > 0) this.progressStore.recordMasteryEvidence?.(evidenceRecords);

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
