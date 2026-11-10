import type { DomainEvent, EventBus } from "../../core/events/EventBus";
import {
  LEARNER_STORAGE_KEY,
  LEARNER_EVENTS,
  emptyStore,
  isLearnerProfileStore,
  validateNickname,
  isAgeBand,
  type AgeBand,
  type LearnerProfile,
  type LearnerProfileCreatedPayload,
  type LearnerProfileRecoveredPayload,
  type LearnerProfileStore,
  type LearnerProfileSwitchedPayload,
  type LearnerStore,
  type MissionProgressEntry
} from "./types";

/**
 * V51-005 — LearnerProfilePlugin（ADR-0006）。
 *
 * 职责：本地多档案（昵称 + 年龄段）创建/切换/持久化；承载任务进度与提示使用次数。
 * 红线：只写 `castle.academy.learner`，绝不触碰 WorldState / WorldSnapshot / PersistencePlugin 的 key。
 * 容错：损坏 JSON、未知版本、存储抛异常一律降级为内存可用状态 + 一次性提示，不阻塞进入世界（R-607）。
 * 无网络、无账号（CA-TECH-005 / PD-008）。
 */
export class LearnerProfilePlugin {
  readonly id = "learner-profile";

  private state: LearnerProfileStore = emptyStore();
  private notice: string | null = null;
  private active = false;
  private readonly store: LearnerStore | null;

  constructor(
    private readonly events: EventBus,
    store?: LearnerStore | null,
    private readonly storageKey: string = LEARNER_STORAGE_KEY
  ) {
    this.store = store === undefined
      ? (typeof localStorage !== "undefined" ? (localStorage as unknown as LearnerStore) : null)
      : store;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.load();
  }

  dispose(): void {
    this.active = false;
  }

  /** 当前档案（深拷贝，防止外部绕过插件直接改内存状态）。 */
  getActiveProfile(): LearnerProfile | null {
    const profile = this.state.profiles.find((p) => p.id === this.state.activeProfileId);
    return profile ? this.cloneProfile(profile) : null;
  }

  listProfiles(): LearnerProfile[] {
    return this.state.profiles.map((p) => this.cloneProfile(p));
  }

  hasProfiles(): boolean {
    return this.state.profiles.length > 0;
  }

  createProfile(
    nickname: string,
    ageBand: AgeBand
  ): { ok: true; profile: LearnerProfile } | { ok: false; reason: string } {
    const name = validateNickname(nickname);
    if (!name.ok) return name;
    if (!isAgeBand(ageBand)) return { ok: false, reason: "请选择年龄段" };

    const profile: LearnerProfile = {
      id: this.newId(),
      nickname: name.nickname,
      ageBand,
      createdAt: new Date().toISOString(),
      missionProgress: {}
    };
    this.state.profiles.push(profile);
    this.state.activeProfileId = profile.id;
    this.persist();
    this.events.emit<LearnerProfileCreatedPayload>(LEARNER_EVENTS.created, {
      profileId: profile.id,
      nickname: profile.nickname,
      ageBand
    });
    return { ok: true, profile: this.cloneProfile(profile) };
  }

  switchProfile(profileId: string): boolean {
    if (!this.state.profiles.some((p) => p.id === profileId)) return false;
    if (this.state.activeProfileId === profileId) return true;
    this.state.activeProfileId = profileId;
    this.persist();
    this.events.emit<LearnerProfileSwitchedPayload>(LEARNER_EVENTS.switched, { profileId });
    return true;
  }

  /** 只更新当前档案的任务进度；无档案时静默忽略（降级直进世界仍可建造）。 */
  updateMissionProgress(missionId: string, patch: Partial<MissionProgressEntry>): void {
    const profile = this.state.profiles.find((p) => p.id === this.state.activeProfileId);
    if (!profile) return;
    const current = profile.missionProgress[missionId] ?? { status: "available" as const, hintsUsed: 0 };
    profile.missionProgress[missionId] = { ...current, ...patch };
    this.persist();
  }

  getMissionProgress(missionId: string): MissionProgressEntry | null {
    const entry = this.state.profiles
      .find((p) => p.id === this.state.activeProfileId)?.missionProgress[missionId];
    return entry ? { ...entry, evidence: entry.evidence ? { ...entry.evidence } : undefined } : null;
  }

  recordHintUsed(missionId: string): number {
    const current = this.getMissionProgress(missionId);
    const next = (current?.hintsUsed ?? 0) + 1;
    this.updateMissionProgress(missionId, { hintsUsed: next });
    return next;
  }

  /** 一次性提示（档案损坏/存储不可用），UI 消费后清空。 */
  consumeNotice(): string | null {
    const message = this.notice;
    this.notice = null;
    return message;
  }

  /** 供测试/“清除浏览器数据”路径使用：清空档案（不影响世界存档）。 */
  reset(): void {
    this.state = emptyStore();
    this.persist();
  }

  /** 读取存储结构（单测与数据安全抽查用；不暴露内部可变引用）。 */
  snapshot(): LearnerProfileStore {
    return JSON.parse(JSON.stringify(this.state)) as LearnerProfileStore;
  }

  /* ---------------- 内部 ---------------- */

  private load(): void {
    if (!this.store) {
      this.state = emptyStore();
      return;
    }
    let raw: string | null;
    try {
      raw = this.store.getItem(this.storageKey);
    } catch {
      this.state = emptyStore();
      this.recover("storage-error", "浏览器存储暂时不可用，本局进度不会保存（不影响建造）");
      return;
    }
    if (raw === null) {
      this.state = emptyStore();
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.state = emptyStore();
      this.recover("corrupt", "档案数据读取失败，已重置；可以重新创建铭牌");
      return;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).version !== 1) {
      this.state = emptyStore();
      this.recover("unsupported-version", "档案来自较新版本，已重置；可以重新创建铭牌");
      return;
    }
    if (!isLearnerProfileStore(parsed)) {
      this.state = emptyStore();
      this.recover("corrupt", "档案数据读取失败，已重置；可以重新创建铭牌");
      return;
    }
    this.state = parsed;
    // activeProfileId 指向不存在的档案时回退到第一个，保证 UI 永远有确定状态
    if (!parsed.profiles.some((p) => p.id === parsed.activeProfileId)) {
      this.state.activeProfileId = parsed.profiles[0]?.id ?? "";
    }
  }

  private recover(reason: LearnerProfileRecoveredPayload["reason"], message: string): void {
    this.notice = message;
    if (this.store) {
      try {
        this.store.setItem(this.storageKey, JSON.stringify(this.state));
      } catch {
        /* 存储不可用时仅保留内存状态，不再递归提示 */
      }
    }
    this.events.emit<LearnerProfileRecoveredPayload>(LEARNER_EVENTS.recovered, { reason, message });
  }

  private persist(): void {
    if (!this.store) return;
    try {
      this.store.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      this.notice = "浏览器存储不可用，本局进度不会保存（不影响建造）";
    }
  }

  private newId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private cloneProfile(profile: LearnerProfile): LearnerProfile {
    return {
      ...profile,
      missionProgress: Object.fromEntries(
        Object.entries(profile.missionProgress).map(([id, entry]) => [id, { ...entry }])
      )
    };
  }
}

/** 便于 UI/测试订阅：事件回调参数类型即 DomainEvent 信封。 */
export type LearnerDomainEvent<T> = DomainEvent<T>;
