/**
 * V061-004 窄测试：验证纯领域模型的核心不变量（确定性、六邻接、终端取电、
 * 开关诊断、多源冲突、有界降级、畸形元数据）。
 * 这不是 AC-6701~6710 的全量验收用例 —— 全量映射由 V061-005 在本文件基础上补齐。
 */

import { describe, expect, it } from "vitest";
import { positionKey, type GridPosition } from "../world/coordinates";
import { computeElectricalNetwork } from "./graph";
import type { ElectricalCell, ElectricalNetworkResult } from "./types";

const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });
const key = (x: number, y: number, z: number): string => positionKey(p(x, y, z));
const c = (x: number, y: number, z: number, blockId: string): ElectricalCell => ({
  position: p(x, y, z),
  blockId,
});

const simulate = (cells: ElectricalCell[]) => computeElectricalNetwork({ cells });

/** 结果的稳定投影：用于比较「插入顺序置换后字节等价」。 */
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

const SOURCE = "power_source_low_voltage";
const WIRE = "wire_basic";
const LAMP = "lamp_basic";

describe("V061-004 纯电力领域模型（窄测试）", () => {
  it("确定性：插入顺序置换（含无关方块与阀门）结果字节等价", () => {
    const cells = [
      c(0, 0, 0, SOURCE),
      c(1, 0, 0, WIRE),
      c(2, 0, 0, "switch_closed"),
      c(3, 0, 0, WIRE),
      c(4, 0, 0, LAMP),
      c(0, 1, 0, "stone"),
      c(0, 0, 1, "water_valve_open"),
    ];
    const forward = simulate(cells);
    const reversed = simulate([...cells].reverse());
    expect(forward.status).toBe("ok");
    expect(projection(reversed)).toEqual(projection(forward));
    expect(forward.loadStates.get(key(4, 0, 0))).toBe("powered");
  });

  it("六正交邻接 + 负载取电：电源→电线→灯通电，±Y/±Z 同样连通", () => {
    const horizontal = simulate([c(0, 0, 0, SOURCE), c(1, 0, 0, WIRE), c(2, 0, 0, LAMP)]);
    expect(horizontal.components).toHaveLength(1);
    expect(horizontal.components[0].sourceCount).toBe(1);
    expect(horizontal.poweredConductors.has(key(1, 0, 0))).toBe(true);
    expect(horizontal.loadStates.get(key(2, 0, 0))).toBe("powered");
    expect(horizontal.poweredLoads.has(key(2, 0, 0))).toBe(true);

    const vertical = simulate([
      c(0, 0, 0, SOURCE),
      c(0, 1, 0, WIRE),
      c(0, 1, 1, "signal_beacon"),
    ]);
    expect(vertical.loadStates.get(key(0, 1, 1))).toBe("powered");
  });

  it("对角不连通 / 缺线：断开的导线不会被靠近的带电块误判为通电", () => {
    const diagonal = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 1, 0, WIRE),
      c(2, 1, 0, LAMP),
    ]);
    expect(diagonal.poweredConductors.has(key(1, 1, 0))).toBe(false);
    expect(diagonal.loadStates.get(key(2, 1, 0))).toBe("no-connection");

    const gap = simulate([c(0, 0, 0, SOURCE), c(2, 0, 0, WIRE), c(3, 0, 0, LAMP)]);
    expect(gap.loadStates.get(key(3, 0, 0))).toBe("no-connection");
  });

  it("断开开关 → switch-open；换成闭合开关 → powered", () => {
    const head = [c(0, 0, 0, SOURCE), c(1, 0, 0, WIRE)];
    const tail = [c(3, 0, 0, WIRE), c(4, 0, 0, LAMP)];
    const open = simulate([...head, c(2, 0, 0, "switch_open"), ...tail]);
    expect(open.loadStates.get(key(4, 0, 0))).toBe("switch-open");
    expect(open.poweredConductors.has(key(3, 0, 0))).toBe(false);

    const closed = simulate([...head, c(2, 0, 0, "switch_closed"), ...tail]);
    expect(closed.loadStates.get(key(4, 0, 0))).toBe("powered");
  });

  it("同一分量 2 个电源 → source-conflict，导体与负载都不供电", () => {
    const result = simulate([
      c(0, 0, 0, SOURCE),
      c(1, 0, 0, WIRE),
      c(2, 0, 0, SOURCE),
      c(3, 0, 0, LAMP),
    ]);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].status).toBe("source-conflict");
    expect(result.poweredConductors.size).toBe(0);
    expect(result.loadStates.get(key(3, 0, 0))).toBe("source-conflict");
  });

  it("无关方块不改变结果；超限与畸形元数据安全回退 unknown / 未通电", () => {
    const plain = [c(0, 0, 0, SOURCE), c(1, 0, 0, WIRE), c(2, 0, 0, LAMP)];
    const noisy = simulate([c(0, 0, 1, "stone"), ...plain, c(0, 1, 0, "water_valve_closed")]);
    expect(noisy.status).toBe("ok");
    expect(projection(noisy)).toEqual(projection(simulate(plain)));

    const limited = computeElectricalNetwork(
      { cells: plain },
      { maxCells: 2, maxEdges: 100, maxOperations: 100 },
    );
    expect(limited.status).toBe("limit-exceeded");
    expect(limited.poweredConductors.size).toBe(0);
    expect(limited.loadStates.get(key(2, 0, 0))).toBe("unknown");

    const malformed = simulate([...plain, c(0, 0, 5, "wire_unknown")]);
    expect(malformed.status).toBe("invalid-input");
    expect(malformed.loadStates.get(key(2, 0, 0))).toBe("unknown");
  });
});
