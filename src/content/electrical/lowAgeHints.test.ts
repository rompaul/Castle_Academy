/** DEV-616 — 低龄提示路径选择纯函数验收（AC-6742/6743、R-630）。 */
import { describe, expect, it } from "vitest";

import { ALL_MISSIONS } from "../missions";
import { ELECTRICAL_LOW_AGE_PATHS } from "../missions/electricalMissions";
import {
  getLowAgePathTitle, isLowAgeElectricalMission, LOW_AGE_PATH_IDS,
  LOW_AGE_ELECTRICAL_MISSION_ID, resolveHintLadder,
} from "./lowAgeHints";

const pump = ALL_MISSIONS.find((m) => m.id === LOW_AGE_ELECTRICAL_MISSION_ID)!;
const beacon = ALL_MISSIONS.find((m) => m.id === "mission.electric-light-beacon.v1")!;

describe("DEV-616 活动 C 低龄替代提示", () => {
  it("只有 6-7 档查看活动 C 才启用低龄路径", () => {
    expect(isLowAgeElectricalMission(pump.id, "6-7")).toBe(true);
    for (const band of ["8-10", "11-12", "13-15", undefined] as const) {
      expect(isLowAgeElectricalMission(pump.id, band), String(band)).toBe(false);
    }
    expect(isLowAgeElectricalMission(beacon.id, "6-7")).toBe(false);
  });

  it("C1 / C2 各 3 级、只涉及一个系统，且不新增任务 ID", () => {
    expect(LOW_AGE_PATH_IDS).toEqual(["C1", "C2"]);
    expect(pump.hintLadder).toHaveLength(3); // 任务定义原文不动
    for (const id of LOW_AGE_PATH_IDS) {
      const path = ELECTRICAL_LOW_AGE_PATHS[id];
      expect(path.hintLadder).toHaveLength(3);
      expect(path.system).toBe(id === "C1" ? "electric" : "water");
      expect(getLowAgePathTitle(id)).toBe(path.title);
      expect(resolveHintLadder(pump, "6-7", id)).toEqual(path.hintLadder);
    }
    // C1 不提阀门/水路，C2 不提电线/开关，避免并列 5 因
    expect(ELECTRICAL_LOW_AGE_PATHS.C1.hintLadder.join("")).not.toContain("阀门");
    expect(ELECTRICAL_LOW_AGE_PATHS.C2.hintLadder.join("")).not.toContain("电线");
  });

  it("其余年龄带 / 其余任务逐字返回原 hintLadder，零 UI 行为变化", () => {
    expect(resolveHintLadder(pump, "11-12", "C1")).toBe(pump.hintLadder);
    expect(resolveHintLadder(pump, undefined, "C2")).toBe(pump.hintLadder);
    expect(resolveHintLadder(beacon, "6-7", "C1")).toBe(beacon.hintLadder);
  });
});
