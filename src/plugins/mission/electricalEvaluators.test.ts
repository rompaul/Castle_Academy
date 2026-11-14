/**
 * V061-021 — 电力评估器确定性 / AI 边界验收（AC-6711~6714/6739）。
 *
 * 纯 Node 单测：注入只读 `ElectricalQuery` / `WaterQuery` mock，
 * 验证同输入同输出、无历史记忆、未注入电力查询时安全降级为 0 进度。
 */
import { describe, expect, it } from "vitest";

import { positionKey, type GridPosition } from "../../core/world/coordinates";
import type { ElectricalQuery, SwitchObservation } from "../electrical/query";
import type { EvaluatorQuery, MissionEvaluator } from "./evaluators";
import { ELECTRICAL_EVALUATORS } from "./electricalEvaluators";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });
type Cell = { position: GridPosition; blockId: string };

interface Fixture {
  blocks?: Cell[];
  water?: GridPosition[];
  powered?: GridPosition[];
  pumpActive?: GridPosition[];
  includeElectrical?: boolean;
  textEvidence?: ReadonlyMap<string, string>;
  /** DEV-615：插件给出的成对观察痕迹；默认空（没按过开关） */
  switchObservations?: SwitchObservation[];
}

const observation = (
  position: GridPosition, state: "open" | "closed", lampPowered: boolean, sequence = 1
): SwitchObservation => ({ position, state, lampPowered, sequence });

function makeQuery(fixture: Fixture): EvaluatorQuery {
  const cells = fixture.blocks ?? [];
  const powered = new Set((fixture.powered ?? []).map(positionKey));
  const pumpActive = new Set((fixture.pumpActive ?? []).map(positionKey));
  const water = new Set((fixture.water ?? []).map(positionKey));
  const electrical: ElectricalQuery = {
    isPowered: (position) => powered.has(positionKey(position)),
    getLoadState: () => null,
    isConductorPowered: () => false,
    isPumpOutputActive: (position) => pumpActive.has(positionKey(position)),
    getPoweredConductors: () => [],
    getLoadStates: () => [],
    getStatus: () => "ok",
    getStats: () => ({ cellCount: 0, edgeCount: 0, operationCount: 0 }),
    getSwitchObservations: () => Object.freeze([...(fixture.switchObservations ?? [])]),
    getRecomputeCount: () => 0
  };
  return {
    water: {
      hasWater: (position) => water.has(positionKey(position)),
      getWaterCells: () => [...(fixture.water ?? [])],
      isPipeFlowing: () => false,
      isConverged: () => true
    },
    everWet: new Set(),
    measurementDone: false,
    world: {
      blockAt: (position) => cells.find((cell) => positionKey(cell.position) === positionKey(position))?.blockId,
      all: () => cells
    },
    sectionEnabled: false,
    textEvidence: fixture.textEvidence,
    electrical: fixture.includeElectrical === false ? undefined : electrical
  };
}

const byId = new Map<string, MissionEvaluator>(ELECTRICAL_EVALUATORS.map((e) => [e.id, e]));
const A = byId.get("evaluator.electric-light-beacon")!;
const B = byId.get("evaluator.electric-switch-magic")!;
const C = byId.get("evaluator.electric-power-pump")!;

describe("V061-021 电力评估器（AC-6711/6712/6739）", () => {
  it("活动 A：电源 + 信标通电才完成，缺一项只给部分进度", () => {
    const beacon = p(4, 1, 0);
    expect(A.evaluate(makeQuery({})).evidence?.observation).toBe("0/2");
    expect(A.evaluate(makeQuery({ blocks: [{ position: p(0, 1, 0), blockId: "power_source_low_voltage" }] })).evidence?.observation).toBe("1/2");
    const full = A.evaluate(makeQuery({
      blocks: [
        { position: p(0, 1, 0), blockId: "power_source_low_voltage" },
        { position: beacon, blockId: "signal_beacon" }
      ],
      powered: [beacon]
    }));
    expect(full.complete).toBe(true);
    expect(full.evidence?.observation).toBe("2/2");
    expect(A.describe(makeQuery({
      blocks: [
        { position: p(0, 1, 0), blockId: "power_source_low_voltage" },
        { position: beacon, blockId: "signal_beacon" }
      ],
      powered: [beacon]
    }))).toEqual({ done: 2, total: 2 });
  });

  it("DEV-615 活动 B：同一个开关按一下开、再按一下关，两态配对才算看全", () => {
    const sw = p(2, 1, 0);
    // 世界里没有任何观察痕迹 → 只是摆着方块不算完成
    expect(B.evaluate(makeQuery({
      blocks: [
        { position: sw, blockId: "switch_open" },
        { position: p(3, 1, 0), blockId: "lamp_basic" }
      ]
    })).evidence?.observation).toBe("0/2");

    // 只按过一次（断开、灯灭）→ 部分进度
    const onlyOpen = B.evaluate(makeQuery({
      switchObservations: [observation(sw, "open", false)]
    }));
    expect(onlyOpen.complete).toBe(false);
    expect(onlyOpen.evidence?.observation).toBe("1/2");

    // 同一位置成对出现：断开时灯灭 + 合上时灯亮 → 完成
    const paired = B.evaluate(makeQuery({
      switchObservations: [
        observation(sw, "closed", true, 1),
        observation(sw, "open", false, 2)
      ]
    }));
    expect(paired.complete).toBe(true);
    expect(paired.evidence?.observation).toBe("2/2");
    expect(B.describe(makeQuery({
      switchObservations: [
        observation(sw, "closed", true, 1),
        observation(sw, "open", false, 2)
      ]
    }))).toEqual({ done: 2, total: 2 });

    // 旧口径漏洞已封堵：两个不同位置各摆一个开关不构成「同一个开关」
    expect(B.evaluate(makeQuery({
      switchObservations: [
        observation(p(1, 1, 0), "open", false),
        observation(p(2, 1, 0), "closed", true)
      ]
    })).complete).toBe(false);

    // 观察与因果不符（合上时灯没亮 / 断开时灯却亮）不算证据
    expect(B.evaluate(makeQuery({
      switchObservations: [
        observation(sw, "closed", false),
        observation(sw, "open", true)
      ]
    })).evidence?.observation).toBe("0/2");
  });

  it("活动 C：泵通电 + 阀门开 + 出口有水三步齐全才完成", () => {
    const pump = p(1, 1, 0);
    const outlet = p(1, 2, 0);
    const base = {
      blocks: [
        { position: pump, blockId: "water_pump_basic" },
        { position: p(3, 1, 0), blockId: "water_valve_open" }
      ],
      pumpActive: [pump],
      water: [outlet]
    };
    expect(C.evaluate(makeQuery(base)).complete).toBe(true);
    expect(C.evaluate(makeQuery(base)).evidence?.observation).toBe("3/3");
    expect(C.evaluate(makeQuery({ ...base, water: [] })).complete).toBe(false);
    expect(C.evaluate(makeQuery({ ...base, pumpActive: [] })).complete).toBe(false);
    expect(C.evaluate(makeQuery({ ...base, blocks: base.blocks.filter((b) => b.blockId !== "water_valve_open") })).complete).toBe(false);
  });

  it("确定性：同输入两次结果字节等价，且不受文字证据 / UI 输入影响", () => {
    const fixture: Fixture = {
      blocks: [
        { position: p(0, 1, 0), blockId: "power_source_low_voltage" },
        { position: p(4, 1, 0), blockId: "signal_beacon" }
      ],
      powered: [p(4, 1, 0)]
    };
    const first = A.evaluate(makeQuery(fixture));
    const second = A.evaluate(makeQuery(fixture));
    expect(first).toEqual(second);
    expect(A.evaluate(makeQuery({ ...fixture, textEvidence: new Map([["anything", "随便写点什么"]]) }))).toEqual(first);
  });

  it("未注入电力查询时安全降级为 0 进度，绝不静默判完成", () => {
    for (const evaluator of ELECTRICAL_EVALUATORS) {
      const result = evaluator.evaluate(makeQuery({
        includeElectrical: false,
        blocks: [
          { position: p(0, 1, 0), blockId: "power_source_low_voltage" },
          { position: p(1, 1, 0), blockId: "signal_beacon" },
          { position: p(2, 1, 0), blockId: "switch_closed" },
          { position: p(3, 1, 0), blockId: "lamp_basic" }
        ]
      }));
      expect(result.complete, evaluator.id).toBe(false);
      expect(result.progress, evaluator.id).toBe(0);
    }
  });
});
