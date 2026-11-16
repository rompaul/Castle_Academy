import { describe, expect, it } from "vitest";
import {
  V071_PROGRESS_STORAGE_KEY,
  isV071RewardUnlocked,
  loadV071Progress,
  unlockV071Reward,
  type StorageLike
} from "./V071ProgressStore";

function memoryStore(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  return {
    data: { ...initial },
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = value; }
  };
}

describe("V0.7.1 progress store", () => {
  it("starts empty and writes only the dedicated key", () => {
    const store = memoryStore({ "castle.academy.learner": "keep-me" });
    expect(loadV071Progress(store).unlockedRewardIds).toEqual([]);
    expect(unlockV071Reward("resourceKit.masonry_basic", "mission.bridge-repair.v1", store)).toBe(true);
    expect(Object.keys(store.data).sort()).toEqual([
      "castle.academy.learner",
      V071_PROGRESS_STORAGE_KEY
    ]);
  });

  it("is idempotent and never duplicates ids", () => {
    const store = memoryStore();
    expect(unlockV071Reward("kit", "mission.a", store)).toBe(true);
    expect(unlockV071Reward("kit", "mission.a", store)).toBe(false);
    const state = loadV071Progress(store);
    expect(state.unlockedRewardIds).toEqual(["kit"]);
    expect(state.completedMissionIds).toEqual(["mission.a"]);
    expect(isV071RewardUnlocked("kit", store)).toBe(true);
  });

  it("recovers from corrupted json and self-heals on next write", () => {
    const store = memoryStore({ [V071_PROGRESS_STORAGE_KEY]: "{not-json" });
    expect(loadV071Progress(store)).toEqual({
      version: 1,
      completedMissionIds: [],
      unlockedRewardIds: []
    });
    expect(unlockV071Reward("kit", "mission.b", store)).toBe(true);
    expect(JSON.parse(store.data[V071_PROGRESS_STORAGE_KEY]).version).toBe(1);
  });

  it("rejects wrong schema versions", () => {
    const store = memoryStore({
      [V071_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 2, unlockedRewardIds: ["kit"] })
    });
    expect(loadV071Progress(store).unlockedRewardIds).toEqual([]);
  });
});
