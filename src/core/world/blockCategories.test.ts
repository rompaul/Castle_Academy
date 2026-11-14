import { describe, expect, it } from "vitest";
import { BLOCKS } from "./blocks";
import {
  BLOCK_GROUPS,
  DEFAULT_QUICK_SLOTS,
  QUICK_SLOT_COUNT,
  assignToSlot,
} from "./blockCategories";

const ELECTRICAL_IDS = [
  "power_source_low_voltage", "wire_basic",
  "switch_open", "switch_closed",
  "lamp_basic", "signal_beacon",
  "water_pump_basic", "water_valve_open", "water_valve_closed",
] as const;

describe("blockCategories", () => {
  it("covers all 34 blocks exactly once, in BLOCKS order", () => {
    const flat = BLOCK_GROUPS.flatMap((group) => group.blockIds);
    expect(flat).toEqual(BLOCKS.map((block) => block.id));
    expect(new Set(flat).size).toBe(BLOCKS.length);
    expect(BLOCKS.length).toBe(34);
  });

  it("splits the 9 electrical blocks into the four E1 groups", () => {
    const electricGroups = BLOCK_GROUPS.filter((group) => group.id.startsWith("electric-"));
    expect(electricGroups.map((group) => group.label)).toEqual([
      "电 · 供电与导电", "电 · 控制", "电 · 负载", "电 · 水联动",
    ]);
    expect(electricGroups.flatMap((group) => group.blockIds)).toEqual([...ELECTRICAL_IDS]);
  });

  it("keeps V0.5 baseline: default quick slots are BLOCKS[0..8] and unique", () => {
    expect(DEFAULT_QUICK_SLOTS).toEqual(BLOCKS.slice(0, QUICK_SLOT_COUNT).map((block) => block.id));
    expect(new Set(DEFAULT_QUICK_SLOTS).size).toBe(QUICK_SLOT_COUNT);
    expect(DEFAULT_QUICK_SLOTS[1]).toBe("dirt");
    expect(DEFAULT_QUICK_SLOTS[5]).toBe("brick");
  });
});

describe("assignToSlot", () => {
  it("puts a new block into the active slot without touching the others", () => {
    const next = assignToSlot(DEFAULT_QUICK_SLOTS, 0, "lamp_basic");
    expect(next[0]).toBe("lamp_basic");
    expect(next.slice(1)).toEqual(DEFAULT_QUICK_SLOTS.slice(1));
    expect(DEFAULT_QUICK_SLOTS[0]).toBe("grass");
  });

  it("swaps when the block already sits in another quick slot", () => {
    const next = assignToSlot(DEFAULT_QUICK_SLOTS, 0, "brick");
    expect(next[0]).toBe("brick");
    expect(next[5]).toBe("grass");
    expect(new Set(next).size).toBe(QUICK_SLOT_COUNT);
  });

  it("is a no-op for repeated assignment and out-of-range slots", () => {
    expect(assignToSlot(DEFAULT_QUICK_SLOTS, 1, "dirt")).toEqual(DEFAULT_QUICK_SLOTS);
    expect(assignToSlot(DEFAULT_QUICK_SLOTS, -1, "lamp_basic")).toEqual(DEFAULT_QUICK_SLOTS);
    expect(assignToSlot(DEFAULT_QUICK_SLOTS, 9, "lamp_basic")).toEqual(DEFAULT_QUICK_SLOTS);
  });

  it("stays duplicate-free across a sequence of assignments", () => {
    let slots = DEFAULT_QUICK_SLOTS;
    for (const [index, id] of [[0, "lamp_basic"], [2, "brick"], [8, "lamp_basic"], [4, "water_pump_basic"]] as const) {
      slots = assignToSlot(slots, index, id);
      expect(slots).toHaveLength(QUICK_SLOT_COUNT);
      expect(new Set(slots).size).toBe(QUICK_SLOT_COUNT);
    }
    expect(slots[8]).toBe("lamp_basic");
  });
});
