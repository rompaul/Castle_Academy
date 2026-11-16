/**
 * V0.7.1 — 任务级资源解锁（ADR-V071-2，owner 授权新增第 4 个 key）。
 *
 * 只存任务 ID 与奖励 ID，不存儿童自由文本、不存坐标、不上传。
 * 损坏数据回退空状态并在下一次写入时自愈；重复解锁返回 false（幂等）。
 */
import type { V071ProgressState } from "./types";

export const V071_PROGRESS_STORAGE_KEY = "castle.academy.v071.progress";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultV071Progress(): V071ProgressState {
  return Object.freeze({
    version: 1 as const,
    completedMissionIds: Object.freeze([] as string[]),
    unlockedRewardIds: Object.freeze([] as string[])
  });
}

function defaultStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isState(value: unknown): value is V071ProgressState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const validIds = (ids: unknown): boolean =>
    Array.isArray(ids) && ids.every((id) => typeof id === "string" && id.length > 0);
  return state.version === 1
    && validIds(state.completedMissionIds)
    && validIds(state.unlockedRewardIds);
}

export function loadV071Progress(storage: StorageLike | undefined = defaultStorage()): V071ProgressState {
  if (!storage) return defaultV071Progress();
  try {
    const raw = storage.getItem(V071_PROGRESS_STORAGE_KEY);
    if (!raw) return defaultV071Progress();
    const parsed: unknown = JSON.parse(raw);
    if (!isState(parsed)) return defaultV071Progress();
    return Object.freeze({
      version: 1 as const,
      completedMissionIds: Object.freeze([...new Set(parsed.completedMissionIds)]),
      unlockedRewardIds: Object.freeze([...new Set(parsed.unlockedRewardIds)])
    });
  } catch {
    return defaultV071Progress();
  }
}

export function saveV071Progress(
  state: V071ProgressState,
  storage: StorageLike | undefined = defaultStorage()
): boolean {
  if (!storage) return false;
  const safe: V071ProgressState = {
    version: 1,
    completedMissionIds: [...new Set(state.completedMissionIds)],
    unlockedRewardIds: [...new Set(state.unlockedRewardIds)]
  };
  try {
    storage.setItem(V071_PROGRESS_STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

/** 幂等解锁：首次返回 true；已解锁只补全任务 ID 并返回 false。 */
export function unlockV071Reward(
  rewardId: string,
  missionId: string,
  storage: StorageLike | undefined = defaultStorage()
): boolean {
  const current = loadV071Progress(storage);
  const alreadyUnlocked = current.unlockedRewardIds.includes(rewardId);
  const nextCompleted = [...new Set([...current.completedMissionIds, missionId])];
  const nextRewards = alreadyUnlocked
    ? current.unlockedRewardIds
    : [...current.unlockedRewardIds, rewardId];
  if (alreadyUnlocked
    && nextCompleted.length === current.completedMissionIds.length) {
    return false;
  }
  saveV071Progress({
    version: 1,
    completedMissionIds: nextCompleted,
    unlockedRewardIds: nextRewards
  }, storage);
  return !alreadyUnlocked;
}

export function isV071RewardUnlocked(
  rewardId: string,
  storage: StorageLike | undefined = defaultStorage()
): boolean {
  return loadV071Progress(storage).unlockedRewardIds.includes(rewardId);
}
