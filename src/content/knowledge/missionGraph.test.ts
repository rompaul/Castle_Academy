import { describe, expect, it } from "vitest";

import { ALL_MISSIONS } from "../missions";
import {
  isMissionUnlocked,
  resolveMissionGraph,
} from "./missionGraph";

function m(id: string, pres: string[] = []) {
  return { id, prerequisiteMissionIds: pres };
}

describe("resolveMissionGraph 纯函数", () => {
  it("空图返回空序、零错误", () => {
    expect(resolveMissionGraph([])).toEqual({ order: [], errors: [] });
  });

  it("单链产生确定性拓扑序（前置在前）", () => {
    const r = resolveMissionGraph([
      m("mission.c.v1", ["mission.b.v1"]),
      m("mission.b.v1", ["mission.a.v1"]),
      m("mission.a.v1"),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.order).toEqual([
      "mission.a.v1",
      "mission.b.v1",
      "mission.c.v1",
    ]);
  });

  it("diamond（菱形依赖）解析合法且前置先于后继", () => {
    const r = resolveMissionGraph([
      m("mission.top.v1", ["mission.left.v1", "mission.right.v1"]),
      m("mission.left.v1", ["mission.base.v1"]),
      m("mission.right.v1", ["mission.base.v1"]),
      m("mission.base.v1"),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.order[0]).toBe("mission.base.v1");
    expect(r.order[3]).toBe("mission.top.v1");
    expect(r.order.indexOf("mission.left.v1")).toBeLessThan(3);
    expect(r.order.indexOf("mission.right.v1")).toBeLessThan(3);
  });

  it("成环报错且不放行", () => {
    const r = resolveMissionGraph([
      m("mission.a.v1", ["mission.b.v1"]),
      m("mission.b.v1", ["mission.a.v1"]),
    ]);
    expect(r.order).toEqual([]);
    expect(r.errors.map((e) => e.kind)).toContain("cycle");
    expect(r.errors.length).toBe(2); // 环上两个成员都报告
  });

  it("悬空引用报错（前置 ID 不存在）", () => {
    const r = resolveMissionGraph([m("mission.a.v1", ["mission.ghost.v1"])]);
    expect(r.order).toEqual([]);
    expect(r.errors[0].kind).toBe("dangling");
    expect(r.errors[0].detail).toContain("mission.ghost.v1");
  });

  it("自引用报错", () => {
    const r = resolveMissionGraph([m("mission.a.v1", ["mission.a.v1"])]);
    expect(r.errors.map((e) => e.kind)).toContain("self-reference");
    expect(r.order).toEqual([]);
  });

  it("乱序输入置换不变：同一集合不同插入顺序得到同一拓扑序", () => {
    const set1 = [
      m("mission.water-flow.v1"),
      m("mission.seven-steps.v1", ["mission.water-flow.v1"]),
      m("mission.broken-pipe.v1", ["mission.seven-steps.v1"]),
      m("mission.count-bridge.v1"),
      m("mission.material-budget.v1", ["mission.count-bridge.v1"]),
    ];
    const set2 = [
      m("mission.material-budget.v1", ["mission.count-bridge.v1"]),
      m("mission.broken-pipe.v1", ["mission.seven-steps.v1"]),
      m("mission.count-bridge.v1"),
      m("mission.seven-steps.v1", ["mission.water-flow.v1"]),
      m("mission.water-flow.v1"),
    ];
    expect(resolveMissionGraph(set1)).toEqual(resolveMissionGraph(set2));
  });

  it("15 个真实任务定义通过：无环、无悬空、恰为批准的 3 条边", () => {
    const r = resolveMissionGraph(ALL_MISSIONS);
    expect(r.errors).toEqual([]);
    expect(r.order).toHaveLength(15);
    const edges = ALL_MISSIONS.flatMap((m) =>
      m.prerequisiteMissionIds.map((pre) => [pre, m.id] as const)
    ).sort();
    expect(edges).toEqual([
      ["mission.count-bridge.v1", "mission.material-budget.v1"],
      ["mission.seven-steps.v1", "mission.broken-pipe.v1"],
      ["mission.water-flow.v1", "mission.seven-steps.v1"],
    ]);
  });

  it("真实内容拓扑序符合预期链", () => {
    const order = resolveMissionGraph(ALL_MISSIONS).order;
    expect(order.indexOf("mission.water-flow.v1")).toBeLessThan(
      order.indexOf("mission.seven-steps.v1")
    );
    expect(order.indexOf("mission.seven-steps.v1")).toBeLessThan(
      order.indexOf("mission.broken-pipe.v1")
    );
    expect(order.indexOf("mission.count-bridge.v1")).toBeLessThan(
      order.indexOf("mission.material-budget.v1")
    );
  });
});

describe("isMissionUnlocked 纯函数", () => {
  const missions = [
    m("mission.water-flow.v1"),
    m("mission.seven-steps.v1", ["mission.water-flow.v1"]),
  ];

  it("无前置任务始终解锁", () => {
    expect(isMissionUnlocked("mission.water-flow.v1", new Set(), missions)).toBe(true);
  });

  it("前置未完成 → 锁定；前置完成 → 解锁", () => {
    expect(isMissionUnlocked("mission.seven-steps.v1", new Set(), missions)).toBe(false);
    expect(
      isMissionUnlocked(
        "mission.seven-steps.v1",
        new Set(["mission.water-flow.v1"]),
        missions
      )
    ).toBe(true);
  });

  it("未知任务返回 false（不抛错）", () => {
    expect(isMissionUnlocked("mission.ghost.v1", new Set(), missions)).toBe(false);
  });
});
