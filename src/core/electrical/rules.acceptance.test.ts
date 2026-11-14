/**
 * V061-005 — 电力规则全量验收单测（AC-6701~6710）。
 *
 * 口径：本文件是 `05_TESTS/ACCEPTANCE_TEST_PLAN.md` §A 的**实际执行载体**。
 * V061-004 的 `graph.test.ts` 是窄测试，不替代本文件；本文件每条用例都在标题里带上 AC ID，
 * fixture 只使用纯 `ElectricalCell`，不触碰 WorldState / UI / 渲染 / 存档。
 *
 * 状态映射（ADR-0011 + graph.ts 注释）：
 *   powered        → 「通电了」
 *   no-connection  → 「还没接通」
 *   switch-open    → 「开关断开」
 *   source-conflict→ 「电源冲突」
 *   unknown        → 安全降级（不计入儿童可见 6 类消息）
 */

import { describe, expect, it } from "vitest";
import { positionKey, type GridPosition } from "../world/coordinates";
import { computeElectricalNetwork } from "./graph";
import {
  DEFAULT_ELECTRICAL_SIM_LIMITS,
  ELECTRICAL_BLOCK_IDS,
  ELECTRICAL_BLOCK_ROLES,
  type ElectricalCell,
  type ElectricalNetworkResult,
  type ElectricalSimLimits,
} from "./types";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });
const key = (x: number, y: number, z: number): string => positionKey(p(x, y, z));
const c = (x: number, y: number, z: number, blockId: string): ElectricalCell => ({
  position: p(x, y, z),
  blockId,
});
const simulate = (cells: ElectricalCell[]): ElectricalNetworkResult =>
  computeElectricalNetwork({ cells });

const SOURCE = "power_source_low_voltage";
const WIRE = "wire_basic";
const LAMP = "lamp_basic";
const BEACON = "signal_beacon";
const PUMP = "water_pump_basic";
const SWITCH_OPEN = "switch_open";
const SWITCH_CLOSED = "switch_closed";

/** 与 V061-004 一致的稳定投影，用于「插入顺序置换字节等价」与「无关方块零影响」断言。 */
function projection(result: ElectricalNetworkResult): string {
  return JSON.stringify({
    status: result.status,
    reason: result.reason,
    poweredConductors: [...result.poweredConductors].sort(),
    componentOf: [...result.componentOf].sort(([a], [b]) => a.localeCompare(b)),
    components: result.components.map((component) => ({ ...component })),
    loadStates: [...result.loadStates].sort(([a], [b]) => a.localeCompare(b)),
    poweredLoads: [...result.poweredLoads].sort(),
    stats: result.stats,
  });
}

/** 一条完整链路：源 (0,0,0) → 电线 (1,0,0) → 闭合开关 (2,0,0) → 电线 (3,0,0) → 灯 (4,0,0)。 */
const chain = (switchId: string = SWITCH_CLOSED): ElectricalCell[] => [
  c(0, 0, 0, SOURCE),
  c(1, 0, 0, WIRE),
  c(2, 0, 0, switchId),
  c(3, 0, 0, WIRE),
  c(4, 0, 0, LAMP),
];

describe("V061-005 电力规则验收（AC-6701~6710）", () => {
  it("AC-6701 电源 + 相邻电线 + 相邻负载终端 → 通电（灯 / 信标 / 水泵三类负载）", () => {
    const result = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 0, 0, WIRE),
      c(2, 0, 0, LAMP),
      c(1, 1, 0, BEACON),
      c(1, -1, 0, PUMP),
    ]);
    expect(result.status).toBe("ok");
    expect(result.poweredConductors.has(key(0, 0, 0))).toBe(true);
    expect(result.poweredConductors.has(key(1, 0, 0))).toBe(true);
    expect(result.loadStates.get(key(2, 0, 0))).toBe("powered");
    expect(result.loadStates.get(key(1, 1, 0))).toBe("powered");
    expect(result.loadStates.get(key(1, -1, 0))).toBe("powered");
    expect(result.poweredLoads.size).toBe(3);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].status).toBe("powered");
  });

  it("AC-6702 缺一段电线 → 下游负载未通电，状态映射为「还没接通」", () => {
    const result = simulate([c(0, 0, 0, SOURCE), c(2, 0, 0, WIRE), c(3, 0, 0, LAMP)]);
    expect(result.status).toBe("ok");
    expect(result.loadStates.get(key(3, 0, 0))).toBe("no-connection");
    expect(result.poweredLoads.size).toBe(0);
    expect(result.poweredConductors.has(key(2, 0, 0))).toBe(false);
    // 消息文案映射由 V061-023 落地；此处固定状态枚举即「还没接通」的唯一入口。
    expect(result.loadStates.get(key(3, 0, 0))).not.toBe("powered");
  });

  it("AC-6703 路径中 switch_open → 未通电 /「开关断开」；换 switch_closed → 通电", () => {
    const open = simulate(chain(SWITCH_OPEN));
    expect(open.loadStates.get(key(4, 0, 0))).toBe("switch-open");
    expect(open.poweredLoads.size).toBe(0);
    expect(open.poweredConductors.has(key(3, 0, 0))).toBe(false);
    expect(open.components.find((component) => component.cellKeys.includes(key(3, 0, 0)))?.status)
      .toBe("unpowered");

    const closed = simulate(chain(SWITCH_CLOSED));
    expect(closed.loadStates.get(key(4, 0, 0))).toBe("powered");
    expect(closed.poweredConductors.has(key(3, 0, 0))).toBe(true);
  });

  it("AC-6704 断开的导线保持未通电，不因靠近通电块而误判", () => {
    // (2,0,1) 与 (1,0,0) 为对角（Δx=1,Δz=1），不是六正交邻居。
    const result = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 0, 0, WIRE),
      c(2, 0, 1, WIRE),
      c(3, 0, 1, LAMP),
      c(1, 0, 1, LAMP), // 与已通电电线正交相邻但不导电，仍应取电（终端规则）
    ]);
    expect(result.poweredConductors.has(key(2, 0, 1))).toBe(false);
    expect(result.loadStates.get(key(3, 0, 1))).toBe("no-connection");
    expect(result.loadStates.get(key(1, 0, 1))).toBe("powered");
    expect(result.components.some((component) => component.status === "unpowered")).toBe(true);
  });

  it("AC-6705 仅对角接触不连通；六正交 ±X/±Y/±Z 全部连通", () => {
    const diagonal = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 1, 1, WIRE),
      c(2, 1, 1, LAMP),
    ]);
    expect(diagonal.components.every((component) => component.cellKeys.length === 1)).toBe(true);
    expect(diagonal.loadStates.get(key(2, 1, 1))).toBe("no-connection");

    const deltas: ReadonlyArray<readonly [number, number, number]> = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const [dx, dy, dz] of deltas) {
      const result = simulate([
        c(0, 0, 0, SOURCE),
        c(dx, dy, dz, WIRE),
        c(dx * 2, dy * 2, dz * 2, LAMP),
      ]);
      expect(result.loadStates.get(key(dx * 2, dy * 2, dz * 2)), `${dx},${dy},${dz}`)
        .toBe("powered");
    }
  });

  it("AC-6706 同一连通分量 2 个电源 → source-conflict，该分量全部负载不供电", () => {
    const result = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 0, 0, WIRE),
      c(2, 0, 0, SOURCE),
      c(3, 0, 0, LAMP),
      c(1, 1, 0, BEACON),
    ]);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].sourceCount).toBe(2);
    expect(result.components[0].status).toBe("source-conflict");
    expect(result.components[0].powered).toBe(false);
    expect(result.poweredConductors.size).toBe(0);
    expect(result.loadStates.get(key(3, 0, 0))).toBe("source-conflict");
    expect(result.loadStates.get(key(1, 1, 0))).toBe("source-conflict");
    expect(result.poweredLoads.size).toBe(0);

    // 独立的第二个单源分量仍应正常通电（冲突不扩散到别的分量）。
    const isolated = simulate([
      ...chain().slice(0, 2),
      c(0, 0, 5, SOURCE),
      c(1, 0, 5, LAMP),
    ]);
    expect(isolated.loadStates.get(key(1, 0, 5))).toBe("powered");
  });

  it("AC-6707 移除电源 / 电线 / 开关使陈旧通电态失效（每次重算，无缓存）", () => {
    const full = simulate(chain());
    expect(full.loadStates.get(key(4, 0, 0))).toBe("powered");

    const noSource = simulate(chain().filter((cell) => cell.blockId !== SOURCE));
    expect(noSource.loadStates.get(key(4, 0, 0))).toBe("no-connection");
    expect(noSource.poweredConductors.size).toBe(0);

    const noWire = simulate(chain().filter((cell) => cell.position.x !== 3));
    expect(noWire.loadStates.get(key(4, 0, 0))).toBe("no-connection");

    const noSwitch = simulate(chain().filter((cell) => cell.position.x !== 2));
    expect(noSwitch.loadStates.get(key(4, 0, 0))).toBe("no-connection");
    expect(noSwitch.poweredConductors.has(key(3, 0, 0))).toBe(false);

    // 再放回 → 状态可恢复，证明没有陈旧通电态残留。
    expect(simulate(chain()).loadStates.get(key(4, 0, 0))).toBe("powered");
  });

  it("AC-6708 放置无关方块不改变电力结果（含阀门 / 石块 / 水）", () => {
    const plain = chain();
    const baseline = simulate(plain);
    const extra: ElectricalCell[] = [
      c(0, 1, 0, "stone"),
      c(2, 1, 0, "water"),
      c(3, 0, 1, "water_valve_open"),
      c(3, 0, 2, "water_valve_closed"),
      c(4, 1, 0, "glass"),
    ];
    const noisy = simulate([...extra, ...plain]);
    expect(noisy.status).toBe("ok");
    expect(projection(noisy)).toEqual(projection(baseline));
    expect(noisy.stats.cellCount).toBe(baseline.stats.cellCount);
  });

  it("AC-6709 不同插入顺序产生字节等价的逻辑结果（全排列抽样 + 乱序多次）", () => {
    const cells = [
      ...chain(),
      c(0, 0, 4, SOURCE),
      c(1, 0, 4, WIRE),
      c(2, 0, 4, LAMP),
      c(0, 2, 0, "stone"),
      c(0, 0, 2, "water_valve_open"),
    ];
    const baseline = projection(simulate(cells));
    for (const reversed of [[...cells].reverse(), [...cells].sort((a, b) => b.position.x - a.position.x)]) {
      expect(projection(simulate(reversed))).toEqual(baseline);
    }
    // 确定性伪乱序（固定 seed，无 Math.random）：Fisher–Yates 用固定 LCG。
    let seed = 20261113;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let round = 0; round < 12; round++) {
      const shuffled = [...cells];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = next() % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      expect(projection(simulate(shuffled)), `round ${round}`).toEqual(baseline);
    }
  });

  it("AC-6710 最大图边界强制生效（cells / edges / operations 三项）且安全降级", () => {
    const cells = chain();
    const cases: Array<{ limits: ElectricalSimLimits; label: string }> = [
      { label: "maxCells", limits: { maxCells: 2, maxEdges: 1000, maxOperations: 1000 } },
      { label: "maxEdges", limits: { maxCells: 1000, maxEdges: 1, maxOperations: 1000 } },
      { label: "maxOperations", limits: { maxCells: 1000, maxEdges: 1000, maxOperations: 3 } },
    ];
    for (const { label, limits } of cases) {
      const result = computeElectricalNetwork({ cells }, limits);
      expect(result.status, label).toBe("limit-exceeded");
      expect(result.poweredConductors.size, label).toBe(0);
      expect(result.poweredLoads.size, label).toBe(0);
      expect(result.loadStates.get(key(4, 0, 0)), label).toBe("unknown");
      expect(result.components, label).toHaveLength(0);
      expect(result.reason, label).toContain(label === "maxOperations" ? "maxOperations" : label);
    }

    // 默认上界内正常；重复调用不累积任何状态（无缓存、无每帧扫描）。
    expect(DEFAULT_ELECTRICAL_SIM_LIMITS.maxCells).toBe(4096);
    const first = simulate(cells);
    const second = simulate(cells);
    expect(projection(second)).toEqual(projection(first));
  });
});

describe("V061-005 附加不变量（不替代 §B 的 AC-6711~6714）", () => {
  it("9 个电力 Block ID 角色表完整且阀门不进电力图", () => {
    expect(ELECTRICAL_BLOCK_IDS).toHaveLength(9);
    for (const id of ELECTRICAL_BLOCK_IDS) {
      expect(ELECTRICAL_BLOCK_ROLES[id], id).toBeDefined();
    }
    const valveOnly = simulate([
      c(0, 0, 0, "water_valve_open"),
      c(1, 0, 0, "water_valve_closed"),
      c(2, 0, 0, LAMP),
    ]);
    expect(valveOnly.stats.cellCount).toBe(1); // 只有灯算电力格
    expect(valveOnly.loadStates.get(key(2, 0, 0))).toBe("no-connection");
  });

  it("结果对象冻结且只读视图不可被插件写回（派生态不落盘）", () => {
    const result = simulate(chain());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.components)).toBe(true);
    expect(Object.isFrozen(result.components[0])).toBe(true);
    expect((result as unknown as { poweredConductors: Set<string> }).poweredConductors)
      .toBeInstanceOf(Set);
  });
});
