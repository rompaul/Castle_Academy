/**
 * V061-008 — 开关 / 阀门状态与存档往返（AC-6716~6722 的本任务范围）。
 *
 * 验证：切换走 WorldState 公共 API；save/load 后两态保留；
 * `WorldSnapshot v1` 字段零变化（0 个 powered / energized / orientation）；
 * 派生态不入档；旧存档与未知 ID 的原子拒绝行为不变。
 */

import { describe, expect, it } from "vitest";
import { computeElectricalNetwork } from "../electrical";
import { toggleElectricalState, ELECTRICAL_STATE_PAIRS } from "./electricalBlockState";
import { WorldState, type WorldSnapshot } from "./WorldState";

const p = (x: number, y: number, z: number) => ({ x, y, z });

/** 一条完整电力链 + 一个阀门，供状态切换与序列化检查共用。 */
function scene(): WorldState {
  const world = new WorldState();
  world.place(p(0, 0, 0), "power_source_low_voltage");
  world.place(p(1, 0, 0), "wire_basic");
  world.place(p(2, 0, 0), "switch_open");
  world.place(p(3, 0, 0), "wire_basic");
  world.place(p(4, 0, 0), "lamp_basic");
  world.place(p(5, 0, 0), "water_valve_open");
  return world;
}

function roundTrip(world: WorldState): WorldState {
  const json = JSON.stringify(world.serialize());
  const restored = new WorldState();
  expect(restored.load(JSON.parse(json) as WorldSnapshot)).toBe(true);
  return restored;
}

describe("V061-008 开关 / 阀门状态与存档往返", () => {
  it("AC-6716 开关切换走 WorldState 公共 API，替换 blockId 且不动其他格", () => {
    const world = scene();
    const before = world.all().length;
    expect(world.get(p(2, 0, 0))!.blockId).toBe("switch_open");
    expect(toggleElectricalState(world, p(2, 0, 0))).toBe(true);
    expect(world.get(p(2, 0, 0))!.blockId).toBe("switch_closed");
    expect(world.all()).toHaveLength(before);
    expect(world.get(p(1, 0, 0))!.blockId).toBe("wire_basic");
    expect(toggleElectricalState(world, p(2, 0, 0))).toBe(true);
    expect(world.get(p(2, 0, 0))!.blockId).toBe("switch_open");
    // 非两态方块不可切换
    expect(toggleElectricalState(world, p(1, 0, 0))).toBe(false);
    expect(toggleElectricalState(world, p(9, 0, 9))).toBe(false);
    expect(ELECTRICAL_STATE_PAIRS["switch_open"]).toBe("switch_closed");
  });

  it("AC-6716 切换后电力规则结果随新 blockId 立即改变（派生态随世界重建）", () => {
    const world = scene();
    const asNetworkInput = () => ({ cells: world.all().map((record) => ({
      position: record.position,
      blockId: record.blockId,
    })) });
    const open = computeElectricalNetwork(asNetworkInput());
    expect(open.loadStates.get("4,0,0")).toBe("switch-open");
    toggleElectricalState(world, p(2, 0, 0));
    const closed = computeElectricalNetwork(asNetworkInput());
    expect(closed.loadStates.get("4,0,0")).toBe("powered");
    expect(open).not.toBe(closed); // 每次重算派生，无缓存
  });

  it("AC-6717 阀门开 / 闭 survives save/load，位置与其余方块不变", () => {
    const world = scene();
    expect(world.get(p(5, 0, 0))!.blockId).toBe("water_valve_open");
    expect(toggleElectricalState(world, p(5, 0, 0))).toBe(true);
    const restored = roundTrip(world);
    expect(restored.get(p(5, 0, 0))!.blockId).toBe("water_valve_closed");
    expect(restored.all().sort((a, b) => `${a.position.x}`.localeCompare(`${b.position.x}`)))
      .toEqual(world.all().sort((a, b) => `${a.position.x}`.localeCompare(`${b.position.x}`)));
    expect(toggleElectricalState(restored, p(5, 0, 0))).toBe(true);
    expect(restored.get(p(5, 0, 0))!.blockId).toBe("water_valve_open");
  });

  it("AC-6717 / AC-6718 开关状态往返一致，通电态不入档且读档可重建", () => {
    const world = scene();
    toggleElectricalState(world, p(2, 0, 0)); // 闭合
    const restored = roundTrip(world);
    expect(restored.get(p(2, 0, 0))!.blockId).toBe("switch_closed");
    const result = computeElectricalNetwork({
      cells: restored.all().map((record) => ({ position: record.position, blockId: record.blockId })),
    });
    expect(result.loadStates.get("4,0,0")).toBe("powered"); // 读档后由世界重建，非从存档恢复
  });

  it("AC-6719 WorldSnapshot v1 结构与字段零变化；0 个派生 / 朝向字段", () => {
    const world = scene();
    const snapshot = world.serialize() as WorldSnapshot & Record<string, unknown>;
    expect(snapshot.version).toBe(1);
    expect(Object.keys(snapshot).sort()).toEqual(["blocks", "version"]);
    for (const block of snapshot.blocks) {
      expect(Object.keys(block).sort()).toEqual(["blockId", "x", "y", "z"]);
    }
    const json = JSON.stringify(snapshot);
    for (const forbidden of ["powered", "energized", "orientation", "pumpActive", "componentOf"]) {
      expect(json.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("AC-6720 不含电力方块的 V0.6 旧存档加载后行为不变", () => {
    const legacy: WorldSnapshot = {
      version: 1,
      blocks: [
        { x: 0, y: 0, z: 0, blockId: "stone" },
        { x: 0, y: 1, z: 0, blockId: "water_source" },
        { x: 1, y: 0, z: 0, blockId: "water_pipe_blue" },
      ],
    };
    const world = new WorldState();
    expect(world.load(legacy)).toBe(true);
    expect(world.all()).toHaveLength(3);
    expect(world.get(p(0, 1, 0))!.blockId).toBe("water_source");
    const result = computeElectricalNetwork({
      cells: world.all().map((record) => ({ position: record.position, blockId: record.blockId })),
    });
    expect(result.stats.cellCount).toBe(0); // 纯水场景不进电力图
    expect(result.poweredLoads.size).toBe(0);
  });

  it("AC-6721 / AC-6722 未知电力 ID 的存档整体原子拒绝，原世界不被修改", () => {
    const world = scene();
    const before = JSON.stringify(world.serialize());
    const malformed = JSON.parse(before) as WorldSnapshot;
    (malformed.blocks[2] as { blockId: string }).blockId = "wire_unknown_v2";
    expect(world.load(malformed)).toBe(false);
    expect(JSON.stringify(world.serialize())).toBe(before);

    // 畸形电力元数据进入领域模型时安全降级，绝不静默通电。
    const network = computeElectricalNetwork({
      cells: [
        { position: p(0, 0, 0), blockId: "power_source_low_voltage" },
        { position: p(1, 0, 0), blockId: "wire_unknown_v2" },
        { position: p(2, 0, 0), blockId: "lamp_basic" },
      ],
    });
    expect(network.status).toBe("invalid-input");
    expect(network.loadStates.get("2,0,0")).toBe("unknown");
    expect(network.poweredLoads.size).toBe(0);
  });
});
