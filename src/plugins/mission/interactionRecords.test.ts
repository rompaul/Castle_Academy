import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { WaterPlugin } from "../water/WaterPlugin";
import { MissionRuntimePlugin } from "./MissionRuntimePlugin";
import {
  INTERACTION_OVERFLOW_POLICY,
  INTERACTION_RECORD_LIMIT,
  InteractionRecords,
  type VariablePairInput
} from "./interactionRecords";

const p = (x: number, y: number, z: number) => ({ x, y, z });

const pair = (missionId: string, x = 1): VariablePairInput => ({
  missionId,
  position: p(x, 2, 3),
  stateA: "closed",
  stateB: "open",
  outcomeA: true,
  outcomeB: false
});

function harness() {
  const world = new WorldState();
  const events = new EventBus();
  const water = new WaterPlugin(world, events);
  water.activate();
  const runtime = new MissionRuntimePlugin(water, events);
  runtime.activate();
  return {
    runtime,
    dispose: () => {
      runtime.dispose();
      water.dispose();
    }
  };
}

describe("V07-005 有界运行时记录（ADR-0014 决策 7）", () => {
  it("每通道显式上限，溢出丢弃最旧；策略常量与上限均有确定值", () => {
    expect(INTERACTION_RECORD_LIMIT).toBe(128);
    expect(INTERACTION_OVERFLOW_POLICY).toBe("drop-oldest");
    const records = new InteractionRecords(3);
    for (const target of ["gate", "lamp", "pump", "moat"]) {
      expect(records.addObservation("mission.a.v1", target)).toBe(true);
    }
    expect(records.size.observationLog).toBe(3);
    expect(records.snapshot().observationLog.map((o) => o.target)).toEqual(["lamp", "pump", "moat"]);
    expect(records.snapshot().observationLog[0].sequence).toBe(2);

    for (let i = 0; i < 4; i++) records.addDecision("mission.a.v1", i + 1, `choice-${i}`);
    expect(records.size.decisionSequence).toBe(3);
    expect(records.snapshot().decisionSequence.map((d) => d.step)).toEqual([2, 3, 4]);
  });

  it("观察去重、两态对照去重、同一步决策可改一次", () => {
    const records = new InteractionRecords();
    expect(records.addObservation("mission.a.v1", "gate")).toBe(true);
    expect(records.addObservation("mission.a.v1", "gate")).toBe(false);
    expect(records.addObservation("mission.a.v1", "  ")).toBe(false);
    expect(records.addVariablePair(pair("mission.a.v1"))).toBe(true);
    expect(records.addVariablePair(pair("mission.a.v1"))).toBe(false);
    expect(records.addVariablePair(pair("mission.a.v1", 9))).toBe(true);
    expect(records.addDecision("mission.a.v1", 1, "share")).toBe(true);
    expect(records.addDecision("mission.a.v1", 1, "save")).toBe(true);
    expect(records.size).toEqual({
      observationLog: 1,
      variableComparison: 2,
      decisionSequence: 1
    });
    expect(records.snapshot().decisionSequence[0].choiceId).toBe("save");

    // V07-015：第 0 步保留给「当前假设」，可改、不惩罚；负数与非整数仍拒绝
    expect(records.addDecision("mission.b.v1", 0, "source")).toBe(true);
    expect(records.addDecision("mission.b.v1", 0, "break")).toBe(true);
    expect(records.addDecision("mission.b.v1", 0, "  ")).toBe(false);
    expect(records.addDecision("mission.b.v1", -1, "valve")).toBe(false);
    expect(records.addDecision("mission.b.v1", 1.5, "valve")).toBe(false);
    expect(records.snapshot().decisionSequence.filter((d) => d.missionId === "mission.b.v1"))
      .toEqual([{ missionId: "mission.b.v1", step: 0, choiceId: "break", sequence: expect.any(Number) }]);
  });

  it("快照冻结且记录未变时复用，clear() 彻底释放并重置序号", () => {
    const records = new InteractionRecords(2);
    records.addObservation("mission.a.v1", "gate", p(1, 2, 3));
    const first = records.snapshot();
    expect(records.snapshot()).toBe(first); // 无变化时零分配
    expect(Object.isFrozen(first.observationLog[0])).toBe(true);
    expect(Object.isFrozen(first.observationLog[0].position)).toBe(true);
    expect(() => {
      (first.observationLog[0].position as unknown as { x: number }).x = 99;
    }).toThrow(TypeError);

    records.addObservation("mission.a.v1", "lamp");
    const second = records.snapshot();
    expect(second).not.toBe(first);
    expect(first.observationLog).toHaveLength(1); // 旧快照不被后续写入改掉

    records.clear();
    expect(records.snapshot().observationLog).toEqual([]);
    expect(records.size).toEqual({ observationLog: 0, variableComparison: 0, decisionSequence: 0 });
    records.addObservation("mission.a.v1", "gate");
    expect(records.snapshot().observationLog[0].sequence).toBe(1);
  });

  it("记录容器零落盘 / 零时钟 / 零随机 / 零定时器", () => {
    const source = readFileSync(new URL("./interactionRecords.ts", import.meta.url), "utf8");
    for (const pattern of [
      /Math\.random/, /Date\.now/, /new Date\(/, /\bfetch\(/, /localStorage/,
      /window\./, /document\./, /setInterval|setTimeout/, /from ["']react/, /from ["']three/
    ]) {
      expect(source, String(pattern)).not.toMatch(pattern);
    }
  });
});

describe("V07-005 生命周期与运行时接线（DEV-701）", () => {
  it("三个通道经唯一 MissionRuntimePlugin 注入，未知任务不写入", () => {
    const h = harness();
    try {
      expect(h.runtime.submitObservation("mission.moat.v1", "gate", p(1, 2, 3))).toBe(true);
      expect(h.runtime.submitVariablePair(pair("mission.moat.v1"))).toBe(true);
      expect(h.runtime.submitDecision("mission.moat.v1", 1, "share")).toBe(true);
      expect(h.runtime.submitObservation("mission.not-exist.v1", "gate")).toBe(false);
      const snapshot = h.runtime.getInteractionSnapshot();
      expect(snapshot.observationLog).toHaveLength(1);
      expect(snapshot.variableComparison).toHaveLength(1);
      expect(snapshot.decisionSequence).toHaveLength(1);
      expect(Object.isFrozen(snapshot.observationLog)).toBe(true);
    } finally {
      h.dispose();
    }
  });

  it("读档 / 重置清空文字与全部交互记录；refresh() 只重算不清记录", () => {
    const h = harness();
    try {
      h.runtime.submitTextEvidence("mission.my-design-note.v1", "我这样设计是因为水会往下流");
      h.runtime.submitObservation("mission.moat.v1", "gate");
      expect(h.runtime.getTextEvidence("mission.my-design-note.v1")).not.toBeNull();
      expect(h.runtime.getInteractionSnapshot().observationLog).toHaveLength(1);

      h.runtime.refresh();
      expect(h.runtime.getTextEvidence("mission.my-design-note.v1")).not.toBeNull();
      expect(h.runtime.getInteractionSnapshot().observationLog).toHaveLength(1);

      h.runtime.resetEvaluation();
      expect(h.runtime.getTextEvidence("mission.my-design-note.v1")).toBeNull();
      expect(h.runtime.getInteractionSnapshot().observationLog).toEqual([]);
      expect(h.runtime.getInteractionSnapshot().variableComparison).toEqual([]);
      expect(h.runtime.getInteractionSnapshot().decisionSequence).toEqual([]);
    } finally {
      h.dispose();
    }
  });

  it("重复 activate 不重复订阅；dispose 清空后重复挂载无残留、无增长", () => {
    const h = harness();
    try {
      h.runtime.activate();
      h.runtime.activate();
      h.runtime.submitObservation("mission.moat.v1", "gate");
      expect(h.runtime.getInteractionSnapshot().observationLog).toHaveLength(1);
    } finally {
      h.dispose();
    }
    expect(h.runtime.getInteractionSnapshot().observationLog).toEqual([]);
    h.runtime.activate();
    try {
      h.runtime.submitObservation("mission.moat.v1", "gate");
      expect(h.runtime.getInteractionSnapshot().observationLog).toHaveLength(1);
    } finally {
      h.runtime.dispose();
      h.dispose();
    }
  });
});
