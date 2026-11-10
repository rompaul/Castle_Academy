/**
 * V51-005 — 学习者档案域类型（ADR-0006）。
 *
 * 唯一持久化位置：localStorage `castle.academy.learner`，version 1。
 * 与世界存档（WorldSnapshot version 1）完全隔离：任何档案字段都不得进入世界快照。
 */

export type AgeBand = "6-7" | "8-10" | "11-12" | "13-15";

export const AGE_BANDS: readonly AgeBand[] = ["6-7", "8-10", "11-12", "13-15"];

export type MissionStatus = "available" | "active" | "completed";

export interface MissionProgressEntry {
  status: MissionStatus;
  /** 确定性证据摘要（评估器产出），仅 completed 时写入 */
  evidence?: { completedAt: string; evaluatorId: string };
  /** 提示阶梯累计使用次数；只记录、不惩罚 */
  hintsUsed: number;
}

export interface LearnerProfile {
  id: string;
  nickname: string;
  ageBand: AgeBand;
  createdAt: string;
  missionProgress: Record<string, MissionProgressEntry>;
}

export interface LearnerProfileStore {
  version: 1;
  activeProfileId: string;
  profiles: LearnerProfile[];
}

/** 与 PersistencePlugin 一致的可注入存储接口，便于单测内存化。 */
export interface LearnerStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LEARNER_STORAGE_KEY = "castle.academy.learner";

/** 新增 learner.* 事件名（契约 §3；recovered 为损坏容错补充，已登记） */
export const LEARNER_EVENTS = {
  created: "learner.profile.created",
  switched: "learner.profile.switched",
  recovered: "learner.profile.recovered"
} as const;

export interface LearnerProfileCreatedPayload {
  profileId: string;
  nickname: string;
  ageBand: AgeBand;
}

export interface LearnerProfileSwitchedPayload {
  profileId: string;
}

export interface LearnerProfileRecoveredPayload {
  reason: "corrupt" | "unsupported-version" | "storage-error";
  message: string;
}

export const NICKNAME_MIN = 1;
export const NICKNAME_MAX = 16;

/** 昵称校验：1~16 字符（trim 后），不收集真实姓名，不做字符白名单限制。 */
export function validateNickname(input: string): { ok: true; nickname: string } | { ok: false; reason: string } {
  const nickname = (input ?? "").trim();
  if (nickname.length < NICKNAME_MIN) return { ok: false, reason: "请输入昵称（1~16 字）" };
  if (nickname.length > NICKNAME_MAX) return { ok: false, reason: "昵称最多 16 个字" };
  return { ok: true, nickname };
}

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}

/** 结构化校验：任何字段异常都判定为损坏，走容错重置而不是崩溃。 */
export function isLearnerProfileStore(value: unknown): value is LearnerProfileStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const store = value as Record<string, unknown>;
  if (store.version !== 1) return false;
  if (typeof store.activeProfileId !== "string") return false;
  if (!Array.isArray(store.profiles)) return false;
  return store.profiles.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const profile = item as Record<string, unknown>;
    if (typeof profile.id !== "string" || typeof profile.nickname !== "string") return false;
    if (!isAgeBand(profile.ageBand) || typeof profile.createdAt !== "string") return false;
    if (!profile.missionProgress || typeof profile.missionProgress !== "object" || Array.isArray(profile.missionProgress)) return false;
    return Object.values(profile.missionProgress as Record<string, unknown>).every((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const e = entry as Record<string, unknown>;
      return (e.status === "available" || e.status === "active" || e.status === "completed")
        && typeof e.hintsUsed === "number" && Number.isFinite(e.hintsUsed) && e.hintsUsed >= 0;
    });
  });
}

export function emptyStore(): LearnerProfileStore {
  return { version: 1, activeProfileId: "", profiles: [] };
}
