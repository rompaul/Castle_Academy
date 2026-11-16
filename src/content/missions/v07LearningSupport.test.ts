import { describe, expect, it } from "vitest";

import { ALL_MISSIONS } from "./index";
import { V07_MISSIONS } from "./interactiveMissions";
import {
  V07_LOW_AGE_HINT_PATHS,
  V07_LOW_AGE_MISSION_IDS,
  resolveV07HintLadder
} from "./v07LowAgeHints";
import { resolveMissionGraph } from "../knowledge/missionGraph";
import type { AgeBand } from "../../plugins/learner/types";

const FORBIDDEN = /等级|难度|年级|百分比|Tier|掌握度|红石|正确率|星级|分数|扣分/;
const V05_BASELINE_IDS = ["mission.moat.v1", "mission.well.v1", "mission.dungeon.v1"];

describe("V07-010 三级提示、年龄分档与低龄子路径", () => {
  it("六个新任务各恰好 3 级提示，4 个年龄档全覆盖", () => {
    for (const mission of V07_MISSIONS) {
      expect(mission.hintLadder, mission.id).toHaveLength(3);
      expect(mission.hintLadder.every((hint) => hint.trim().length > 0), mission.id).toBe(true);
    }
    expect(new Set(V07_MISSIONS.map((m) => m.ageScope))).toEqual(
      new Set(["6-7", "8-10", "11-12", "13-15"])
    );
  });

  it("低龄子路径只影响两个 6-7 任务，不新增任务 ID、不改定义", () => {
    expect(V07_LOW_AGE_MISSION_IDS).toHaveLength(2);
    for (const id of V07_LOW_AGE_MISSION_IDS) {
      expect(V07_MISSIONS.some((m) => m.id === id), id).toBe(true);
      expect(V07_MISSIONS.filter((m) => m.id.startsWith(id.replace(/\.v\d+$/, "")))).toHaveLength(1);
    }
    const bands: Array<AgeBand | undefined> = ["6-7", "8-10", "11-12", "13-15", undefined];
    for (const mission of V07_MISSIONS) {
      if (!V07_LOW_AGE_MISSION_IDS.includes(mission.id)) {
        for (const band of bands) {
          expect(resolveV07HintLadder(mission, band), `${mission.id}/${band}`).toBe(mission.hintLadder);
        }
      }
    }
    const lowAge = V07_MISSIONS.find((m) => m.id === V07_LOW_AGE_MISSION_IDS[0])!;
    expect(resolveV07HintLadder(lowAge, "6-7")).toEqual(V07_LOW_AGE_HINT_PATHS[lowAge.id]);
    expect(resolveV07HintLadder(lowAge, "8-10")).toBe(lowAge.hintLadder);
    expect(resolveV07HintLadder(lowAge, undefined)).toBe(lowAge.hintLadder);
  });

  it("低龄提示每套 3 级、句子短、只指向一类东西、无禁用词", () => {
    for (const [id, hints] of Object.entries(V07_LOW_AGE_HINT_PATHS)) {
      expect(hints, id).toHaveLength(3);
      for (const hint of hints) {
        expect(hint.length, `${id}/${hint}`).toBeLessThanOrEqual(24);
        expect(hint, `${id}/${hint}`).not.toMatch(FORBIDDEN);
        expect(hint, `${id}/${hint}`).not.toMatch(/、|或者|同时/);
      }
    }
  });
});

describe("V07-011 先决条件链（最多 1 条新链）", () => {
  // V07-021 后 ALL_MISSIONS 已含 6 个新任务，不再重复拼接（否则 30 个 / 6 条边）
  const combined = ALL_MISSIONS;

  it("恰好 1 条新链，两端都不是 V0.5 基线三任务", () => {
    const withPrereq = V07_MISSIONS.filter((m) => m.prerequisiteMissionIds.length > 0);
    expect(withPrereq).toHaveLength(1);
    expect(withPrereq[0].id).toBe("mission.choose-water-route.v1");
    expect(withPrereq[0].prerequisiteMissionIds).toEqual(["mission.find-the-pattern.v1"]);
    expect(V05_BASELINE_IDS).not.toContain(withPrereq[0].id);
    expect(V05_BASELINE_IDS).not.toContain(withPrereq[0].prerequisiteMissionIds[0]);
  });

  it("合并图无环 / 无悬空 / 无自引用，共 5 条边，前置在拓扑序之前", () => {
    const graph = resolveMissionGraph(combined);
    expect(graph.errors).toEqual([]);
    expect(graph.order).toHaveLength(24);
    const edgeCount = combined.reduce((sum, m) => sum + m.prerequisiteMissionIds.length, 0);
    expect(edgeCount).toBe(5);
    expect(graph.order.indexOf("mission.find-the-pattern.v1"))
      .toBeLessThan(graph.order.indexOf("mission.choose-water-route.v1"));
    // resolveMissionGraph() 零改动：乱序输入置换不变
    expect(resolveMissionGraph([...combined].reverse()).order).toEqual(graph.order);
  });

  it("锁定只作用于可选任务：V0.5 三任务仍无前置、始终可玩", () => {
    const baseline = combined.filter((m) => V05_BASELINE_IDS.includes(m.id));
    expect(baseline).toHaveLength(3);
    for (const mission of baseline) {
      expect(mission.prerequisiteMissionIds, mission.id).toEqual([]);
    }
  });
});
