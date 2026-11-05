import { describe, expect, it } from "vitest";
import { LayerRegistry } from "./LayerRegistry";
import type { LayerDefinition } from "./LayerTypes";

function groundLayer(): LayerDefinition {
  return {
    id: "ground",
    label: "Ground",
    kind: "ground-floor",
    minY: 0,
    maxYExclusive: 4,
    order: 0,
    defaultVisible: true,
    buildable: true,
  };
}

function level1Layer(): LayerDefinition {
  return {
    id: "level-1",
    label: "Level 1",
    kind: "upper-floor",
    minY: 4,
    maxYExclusive: 8,
    order: 1,
    defaultVisible: true,
    buildable: true,
  };
}

function basement1Layer(): LayerDefinition {
  return {
    id: "basement-1",
    label: "Basement 1",
    kind: "basement",
    minY: -4,
    maxYExclusive: 0,
    order: -1,
    defaultVisible: true,
    buildable: true,
  };
}

describe("LayerRegistry", () => {
  it("registers and retrieves a valid layer", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    expect(registry.has("ground")).toBe(true);
    const def = registry.get("ground");
    expect(def).toBeDefined();
    expect(def!.id).toBe("ground");
    expect(def!.kind).toBe("ground-floor");
  });

  it("rejects duplicate layer id", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    expect(() => registry.register(groundLayer())).toThrow(/Duplicate layer id/);
  });

  it("rejects overlapping Y ranges", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer()); // [0, 4)
    // 改用一个真正重叠的层
    const overlapping: LayerDefinition = {
      id: "overlap",
      label: "Overlap",
      kind: "upper-floor",
      minY: 2,
      maxYExclusive: 6,
      order: 5,
      defaultVisible: true,
      buildable: true,
    };
    expect(() => registry.register(overlapping)).toThrow(/overlaps/);
  });

  it("rejects invalid range where minY >= maxYExclusive", () => {
    const registry = new LayerRegistry();
    const invalid: LayerDefinition = {
      id: "invalid",
      label: "Invalid",
      kind: "upper-floor",
      minY: 5,
      maxYExclusive: 3,
      order: 5,
      defaultVisible: true,
      buildable: true,
    };
    expect(() => registry.register(invalid)).toThrow(/must be less than/);
  });

  it("allows adjacent but non-overlapping ranges", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer()); // [0, 4)
    registry.register(level1Layer()); // [4, 8)，与 ground 相邻不重叠
    expect(registry.has("level-1")).toBe(true);
  });

  it("resolveLayerId maps y to correct layer", () => {
    const registry = new LayerRegistry();
    registry.register(basement1Layer()); // [-4, 0)
    registry.register(groundLayer());   // [0, 4)
    registry.register(level1Layer());   // [4, 8)

    expect(registry.resolveLayerId(-3)).toBe("basement-1");
    expect(registry.resolveLayerId(-1)).toBe("basement-1");
    expect(registry.resolveLayerId(0)).toBe("ground");
    expect(registry.resolveLayerId(3)).toBe("ground");
    expect(registry.resolveLayerId(4)).toBe("level-1");
    expect(registry.resolveLayerId(7)).toBe("level-1");
    // 超出所有层范围
    expect(registry.resolveLayerId(100)).toBeUndefined();
    expect(registry.resolveLayerId(-100)).toBeUndefined();
  });

  it("getAll returns layers sorted by order", () => {
    const registry = new LayerRegistry();
    registry.register(level1Layer());   // order 1
    registry.register(groundLayer());   // order 0
    registry.register(basement1Layer()); // order -1

    const all = registry.getAll();
    expect(all.length).toBe(3);
    expect(all[0].id).toBe("basement-1"); // order -1
    expect(all[1].id).toBe("ground");     // order 0
    expect(all[2].id).toBe("level-1");    // order 1
  });

  it("getDefaultLayerId returns the first registered layer", () => {
    const registry = new LayerRegistry();
    expect(registry.getDefaultLayerId()).toBeNull();
    registry.register(level1Layer());
    expect(registry.getDefaultLayerId()).toBe("level-1");
    registry.register(groundLayer());
    expect(registry.getDefaultLayerId()).toBe("level-1"); // 不变，仍是首个
  });

  it("removes a non-default layer", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    registry.register(level1Layer());
    registry.remove("level-1");
    expect(registry.has("level-1")).toBe(false);
    expect(registry.get("ground")).toBeDefined();
  });

  it("rejects removing the only layer", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    expect(() => registry.remove("ground")).toThrow(/only layer/);
  });

  it("rejects removing the default layer", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    registry.register(level1Layer());
    expect(() => registry.remove("ground")).toThrow(/default layer/);
  });

  it("updates layer definition without changing id", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer());
    registry.update("ground", { label: "New Ground", buildable: false });
    const def = registry.get("ground")!;
    expect(def.label).toBe("New Ground");
    expect(def.buildable).toBe(false);
    expect(def.id).toBe("ground");
    expect(def.minY).toBe(0); // 未变更的字段保持不变
  });

  it("update rejects invalid range and overlapping range", () => {
    const registry = new LayerRegistry();
    registry.register(groundLayer()); // [0, 4)
    registry.register(basement1Layer()); // [-4, 0)

    // 更新 ground 到无效范围
    expect(() => registry.update("ground", { minY: 5, maxYExclusive: 3 })).toThrow(/must be less than/);
    // 更新 ground 使其与 basement-1 重叠
    expect(() => registry.update("ground", { minY: -2, maxYExclusive: 2 })).toThrow(/overlaps/);
  });
});
