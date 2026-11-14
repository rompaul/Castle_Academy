/**
 * V061-006 — 9 个电力 / 水联动方块注册表验收（AC-6715 注册层 / AC-6716 / AC-6719 契约）。
 *
 * 重点断言「只追加」：既有 25 个 ID 的字符串与顺序逐字不变；
 * 新增 9 个 ID 与纯领域模块 ELECTRICAL_BLOCK_ROLES 一一对应；
 * 全部 orientation: "fixed"，无朝向字段、无新增快照字段。
 */

import { describe, expect, it } from "vitest";
import {
  ELECTRICAL_BLOCK_IDS,
  ELECTRICAL_BLOCK_ROLES,
} from "../electrical";
import { ASSET_MANIFEST, BLOCKS, getBlockDefinition } from "./blocks";

/** V0.6.0 发布对象中的 25 个既有 ID，顺序锁定（来自 V061_BLOCK_ID_AND_ATLAS_MAP.md §1）。 */
const V060_BLOCK_IDS: readonly string[] = Object.freeze([
  "grass", "dirt", "stone", "wood", "sand", "brick", "glass",
  "sandstone_warm", "rock_moss", "gravel", "wood_walnut", "brick_limestone",
  "tile_slate", "foundation_concrete", "footing_carved", "wall_plaster",
  "wall_timber_frame", "tunnel_lining", "pillar_corner", "arch_keystone",
  "stair_stone", "window_frame",
  "water_source", "drain_channel", "water_pipe_blue",
]);

const V061_IDS: readonly string[] = Object.freeze([
  "power_source_low_voltage",
  "wire_basic",
  "switch_open",
  "switch_closed",
  "lamp_basic",
  "signal_beacon",
  "water_pump_basic",
  "water_valve_open",
  "water_valve_closed",
]);

describe("V061-006 电力方块注册表", () => {
  it("只追加：前 25 个 ID 的字符串与顺序逐字不变，总数 34", () => {
    const ids = BLOCKS.map((block) => block.id);
    expect(ids).toHaveLength(34);
    expect(ids.slice(0, 25)).toEqual([...V060_BLOCK_IDS]);
    expect(new Set(ids).size).toBe(34);
  });

  it("9 个新 ID 与领域角色表完全一致（无多余、无遗漏）", () => {
    expect(BLOCKS.slice(25).map((block) => block.id)).toEqual([...V061_IDS]);
    expect([...ELECTRICAL_BLOCK_IDS]).toEqual([...V061_IDS]);
    for (const id of V061_IDS) {
      expect(ELECTRICAL_BLOCK_ROLES[id], id).toBeDefined();
    }
    expect(ELECTRICAL_BLOCK_ROLES["water_valve_open"]).toBe("valve");
    expect(ELECTRICAL_BLOCK_ROLES["water_valve_closed"]).toBe("valve");
    expect(ELECTRICAL_BLOCK_ROLES["power_source_low_voltage"]).toBe("source");
    expect(ELECTRICAL_BLOCK_ROLES["wire_basic"]).toBe("conductor");
    expect(ELECTRICAL_BLOCK_ROLES["lamp_basic"]).toBe("load");
  });

  it("全部新块 orientation: fixed、texelSize 16、三面材质齐全、行为三项为 true", () => {
    for (const block of BLOCKS.slice(25)) {
      expect(block.model.orientation, block.id).toBe("fixed");
      expect(block.model.type, block.id).toBe("cube");
      expect(block.material.texelSize, block.id).toBe(16);
      expect(block.material.top, block.id).toContain(block.id);
      expect(block.material.side, block.id).toContain(block.id);
      expect(block.material.bottom, block.id).toContain(block.id);
      expect(block.behavior.collidable, block.id).toBe(true);
      expect(block.behavior.selectable, block.id).toBe(true);
      expect(block.behavior.placeable, block.id).toBe(true);
    }
  });

  it("开关 / 阀门两态是两个独立 ID，不新增字段、不改快照结构", () => {
    const open = getBlockDefinition("switch_open");
    const closed = getBlockDefinition("switch_closed");
    expect(open.id).not.toBe(closed.id);
    expect(getBlockDefinition("water_valve_open").id)
      .not.toBe(getBlockDefinition("water_valve_closed").id);
    // 注册表条目只有 id/name/color/swatch/model/material/behavior，无任何状态字段。
    for (const block of BLOCKS.slice(25)) {
      expect(Object.keys(block).sort()).toEqual([
        "behavior", "color", "id", "material", "model", "name", "swatch",
      ]);
    }
  });

  it("ASSET_MANIFEST 覆盖 34 个条目，schemaVersion 仍为 1", () => {
    expect(Object.keys(ASSET_MANIFEST.entries)).toHaveLength(34);
    expect(ASSET_MANIFEST.schemaVersion).toBe(1);
    for (const id of V061_IDS) {
      expect(ASSET_MANIFEST.entries[id], id).toBeDefined();
    }
  });

  it("儿童可见名统一用「电」的词族，不含真实电气数值与禁用词", () => {
    for (const block of BLOCKS.slice(25)) {
      expect(block.name).not.toMatch(/红石|Redstone|信号强度|充能|中继|逻辑门|电压|电流|电阻/);
    }
    expect(getBlockDefinition("power_source_low_voltage").name).toBe("电源");
    expect(getBlockDefinition("wire_basic").name).toBe("电线");
  });
});
