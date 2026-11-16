/**
 * V061-022/023 — 电力内容、术语表、安全文案与状态消息验收（AC-6739~6748）。
 *
 * 纯 Node 单测：不启浏览器、不读 DOM；扫描范围是所有儿童可见文案。
 * 三条安全文案为 owner 审校通过的警示语句，逐字断言且单独豁免「插座」警示对象。
 */
import { describe, expect, it } from "vitest";

import {
  ELECTRICAL_BANNED_WORDS,
  ELECTRICAL_CHILD_TERMS,
  ELECTRICAL_SAFETY_TEXTS,
  ELECTRICAL_STATUS_MESSAGES,
  LOW_AGE_ONLY_TERMS,
  type ElectricalStatusKey
} from "./glossary";
import { deriveElectricalStatus } from "./status";
import { ELECTRICAL_MISSIONS, ELECTRICAL_LOW_AGE_PATHS } from "../missions/electricalMissions";
import { ALL_MISSIONS } from "../missions";
import { validateMissionDefinition } from "../missions/types";
import { isRegisteredKnowledgePoint } from "../knowledge/registry";
import { resolveMissionGraph } from "../knowledge/missionGraph";
import { createV051Capabilities } from "../../plugins/mission/CapabilityRegistry";

const FORBIDDEN_LABELS = /等级|难度|年级|Tier|百分比|%/i;
const REAL_ELECTRICAL_VALUES = /\d+\s*(V|伏|安|欧|Ω)/;

function childVisibleText(mission: (typeof ELECTRICAL_MISSIONS)[number]): string {
  return [
    mission.title, mission.context, mission.goal, mission.successMessage,
    mission.reflectionPrompt, mission.accessibilityNote, mission.progressLanguage,
    mission.unavailableReason, mission.learningGoal,
    ...mission.hintLadder, mission.reward?.title ?? ""
  ].join("\n");
}

function assertClean(label: string, text: string): void {
  for (const word of ELECTRICAL_BANNED_WORDS) {
    expect(text.includes(word), `${label} 命中禁用词「${word}」`).toBe(false);
  }
  expect(FORBIDDEN_LABELS.test(text), `${label} 出现等级/难度/百分比标签`).toBe(false);
  expect(REAL_ELECTRICAL_VALUES.test(text), `${label} 出现真实电气数值`).toBe(false);
  for (const word of LOW_AGE_ONLY_TERMS) {
    expect(text.includes(word), `${label} 出现低龄禁用机制词「${word}」`).toBe(false);
  }
}

describe("V061-022 术语表与安全文案（AC-6745~6748）", () => {
  it("儿童可见对象名统一「电」，9 类齐全且无禁用词", () => {
    expect(Object.keys(ELECTRICAL_CHILD_TERMS)).toHaveLength(9);
    assertClean("术语表", Object.values(ELECTRICAL_CHILD_TERMS).join("\n"));
  });

  it("三条安全文案逐字与 owner 审校稿一致（警示对象不改写）", () => {
    expect(ELECTRICAL_SAFETY_TEXTS.firstGuide)
      .toBe("城堡里的电是游戏里的规则；现实里的电很危险，不要碰插座和电线。");
    expect(ELECTRICAL_SAFETY_TEXTS.helpPersistent)
      .toBe("城堡里的电只玩通和断，不学真实接线。现实里的电很危险，不要碰插座和电线。");
    expect(ELECTRICAL_SAFETY_TEXTS.parentTeacher)
      .toBe("本产品为虚构二值规则模型，不含真实电气知识，也不含任何可迁移到现实的操作步骤。建议成人陪同低龄儿童使用。");
  });

  it("6 类状态消息齐全且互斥，图标 + 文字并置", () => {
    const keys: ElectricalStatusKey[] = [
      "powered", "no-connection", "switch-open",
      "source-conflict", "pump-not-powered", "valve-closed"
    ];
    expect(Object.keys(ELECTRICAL_STATUS_MESSAGES).sort()).toEqual([...keys].sort());
    const labels = new Set<string>();
    for (const key of keys) {
      const message = ELECTRICAL_STATUS_MESSAGES[key];
      expect(message.icon.length, key).toBeGreaterThan(0);
      expect(message.label.length, key).toBeGreaterThan(0);
      labels.add(message.label);
      assertClean(`状态消息 ${key}`, message.label);
    }
    expect(labels.size).toBe(6);
  });

  it("3 个电力任务的全部儿童可见文案零禁用词、零等级标签、零电气数值", () => {
    for (const mission of ELECTRICAL_MISSIONS) assertClean(mission.id, childVisibleText(mission));
  });
});

describe("V061-018/019/020 电力任务 schema v2 与内容质量（AC-6739~6744/6748）", () => {
  it("3 个任务全部 schemaVersion 2、通过内容校验、知识点引用均已注册", () => {
    expect(ELECTRICAL_MISSIONS).toHaveLength(3);
    for (const mission of ELECTRICAL_MISSIONS) {
      expect(mission.schemaVersion, mission.id).toBe(2);
      expect(validateMissionDefinition(mission), mission.id).toEqual({ ok: true });
      expect(mission.knowledgePointIds!.length, mission.id).toBeGreaterThan(0);
      for (const id of mission.knowledgePointIds!) {
        expect(isRegisteredKnowledgePoint(id), `${mission.id} → ${id}`).toBe(true);
      }
    }
  });

  it("每任务恰好 3 级提示（现象 → 位置 → 操作），逐字与规格一致", () => {
    expect(ELECTRICAL_MISSIONS[0].hintLadder).toEqual([
      "信标还没亮，电还没走到它那里。",
      "沿着电线从电源慢慢看过去，中间有一处没接上。",
      "选中电线，把缺口那格补上，再看看信标。"
    ]);
    expect(ELECTRICAL_MISSIONS[1].hintLadder).toEqual([
      "灯现在是灭的。",
      "看看路径上的开关，它现在是断开的样子。",
      "点一下开关让它合上，再看看灯。"
    ]);
    expect(ELECTRICAL_MISSIONS[2].hintLadder).toEqual([
      "出水点还没有水。",
      "先看看泵有没有通电，再看阀门是不是开着。",
      "把断开的开关合上，或者把阀门切换成开，然后重新看水。"
    ]);
    for (const mission of ELECTRICAL_MISSIONS) expect(mission.hintLadder).toHaveLength(3);
  });

  it("年龄分档三档 + 活动 C 标 11+，低龄 C1/C2 是单系统子路径且不新增任务", () => {
    expect(ELECTRICAL_MISSIONS.map((m) => m.ageScope)).toEqual(["6-7", "8-10", "11-12"]);
    expect(ELECTRICAL_MISSIONS[0].expressionForms).toEqual(["exploration"]);
    expect(ELECTRICAL_MISSIONS[2].expressionForms).toEqual(["experiment"]);
    expect(ELECTRICAL_LOW_AGE_PATHS.C1.system).toBe("electric");
    expect(ELECTRICAL_LOW_AGE_PATHS.C2.system).toBe("water");
    expect(ELECTRICAL_LOW_AGE_PATHS.C1.hintLadder).toHaveLength(3);
    expect(ELECTRICAL_LOW_AGE_PATHS.C2.hintLadder).toHaveLength(3);
    // Q-3 只批 3 个电力任务（15 → 18）；V0.7 再在末尾追加 6 个形式任务（18 → 24），
    // 电力三任务仍固定占第 15~17 位，既有 ID 与顺序零变更。
    expect(ALL_MISSIONS).toHaveLength(24);
    expect(ALL_MISSIONS.slice(15, 18).map((m) => m.id))
      .toEqual(ELECTRICAL_MISSIONS.map((m) => m.id));
  });

  it("先决条件恰为 1 条链 A→B、无环无悬空，既有 3 条边逐字保留", () => {
    expect(ELECTRICAL_MISSIONS[0].prerequisiteMissionIds).toEqual([]);
    expect(ELECTRICAL_MISSIONS[1].prerequisiteMissionIds).toEqual(["mission.electric-light-beacon.v1"]);
    expect(ELECTRICAL_MISSIONS[2].prerequisiteMissionIds).toEqual([]);
    const graph = resolveMissionGraph(ALL_MISSIONS);
    expect(graph.errors).toEqual([]);
    expect(graph.order).toHaveLength(24);
    const edges = ALL_MISSIONS.flatMap((m) =>
      m.prerequisiteMissionIds.map((pre) => [pre, m.id] as const)
    ).sort();
    expect(edges).toHaveLength(5); // V07-011 新增第 5 条链
    expect(edges).toContainEqual(["mission.electric-light-beacon.v1", "mission.electric-switch-magic.v1"]);
  });

  it("electric.basic 已在 CapabilityRegistry 注册，3 个任务的能力引用有效", () => {
    const capabilities = createV051Capabilities();
    expect(capabilities.isAvailable("electric.basic")).toBe(true);
    for (const mission of ELECTRICAL_MISSIONS) {
      expect(capabilities.missing(mission.requiredCapabilities), mission.id).toEqual([]);
    }
  });
});

describe("V061-023 状态派生（AC-6736）", () => {
  const p = (x: number, y: number, z: number) => ({ x, y, z });
  const one = (state: "powered" | "no-connection" | "switch-open" | "source-conflict") =>
    [{ position: p(0, 0, 0), state }];

  it("6 类状态按优先级互斥派生", () => {
    expect(deriveElectricalStatus({ loadStates: one("source-conflict"), blocks: [] })).toBe("source-conflict");
    expect(deriveElectricalStatus({
      loadStates: [{ position: p(1, 0, 0), state: "no-connection" }],
      blocks: [{ position: p(1, 0, 0), blockId: "water_pump_basic" }]
    })).toBe("pump-not-powered");
    expect(deriveElectricalStatus({
      loadStates: [],
      blocks: [{ position: p(2, 0, 0), blockId: "water_valve_closed" }]
    })).toBe("valve-closed");
    expect(deriveElectricalStatus({ loadStates: one("switch-open"), blocks: [] })).toBe("switch-open");
    expect(deriveElectricalStatus({ loadStates: one("powered"), blocks: [] })).toBe("powered");
    expect(deriveElectricalStatus({ loadStates: one("no-connection"), blocks: [] })).toBe("no-connection");
  });

  it("无电力方块时返回 null；泵通电且阀门开时不误报", () => {
    expect(deriveElectricalStatus({ loadStates: [], blocks: [] })).toBeNull();
    expect(deriveElectricalStatus({
      loadStates: [{ position: p(1, 0, 0), state: "powered" }],
      blocks: [
        { position: p(1, 0, 0), blockId: "water_pump_basic" },
        { position: p(2, 0, 0), blockId: "water_valve_open" }
      ]
    })).toBe("powered");
  });
});
