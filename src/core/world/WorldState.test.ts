import { describe, expect, it } from "vitest";
import { isGridPosition, isInsideBuildArea } from "./coordinates";
import { WorldState } from "./WorldState";

describe("grid coordinates", () => {
  it("accepts only finite integer coordinates", () => {
    expect(isGridPosition({ x: 0, y: 1, z: -2 })).toBe(true);
    expect(isGridPosition({ x: 1.5, y: 0, z: 0 })).toBe(false);
    expect(isGridPosition({ x: Number.NaN, y: 0, z: 0 })).toBe(false);
    expect(isGridPosition({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 })).toBe(false);
  });

  it("enforces inclusive lower and exclusive upper build bounds", () => {
    // X/Z 边界（保留 V0.1 [-16, 16)）
    expect(isInsideBuildArea({ x: -16, y: 0, z: -16 })).toBe(true);
    expect(isInsideBuildArea({ x: 15, y: 63, z: 15 })).toBe(true);
    expect(isInsideBuildArea({ x: 16, y: 0, z: 0 })).toBe(false);
    expect(isInsideBuildArea({ x: 0, y: 64, z: 0 })).toBe(false);
    // Y 边界（V0.4 扩展到 [-32, 64)，支持地下空间）
    expect(isInsideBuildArea({ x: 0, y: -32, z: 0 })).toBe(true);
    expect(isInsideBuildArea({ x: 0, y: -1, z: 0 })).toBe(true);
    expect(isInsideBuildArea({ x: 0, y: -33, z: 0 })).toBe(false);
  });
});

describe("WorldState", () => {
  it("places and retrieves a block", () => {
    const world = new WorldState();
    expect(world.place({ x: 1, y: 0, z: 2 }, "grass")).toBe(true);
    expect(world.get({ x: 1, y: 0, z: 2 })?.blockId).toBe("grass");
  });

  it("rejects duplicates, invalid coordinates, invalid ids, and out-of-bounds placement", () => {
    const world = new WorldState();
    expect(world.place({ x: 0, y: 0, z: 0 }, "stone")).toBe(true);
    expect(world.place({ x: 0, y: 0, z: 0 }, "wood")).toBe(false);
    expect(world.place({ x: 1.5, y: 0, z: 0 }, "wood")).toBe(false);
    expect(world.place({ x: 20, y: 0, z: 0 }, "wood")).toBe(false);
    expect(world.place({ x: 2, y: 0, z: 0 }, "not-a-block" as never)).toBe(false);
  });

  it("removes blocks and rejects invalid removal coordinates", () => {
    const world = new WorldState();
    world.place({ x: 0, y: 0, z: 0 }, "brick");
    expect(world.remove({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(world.remove({ x: 0.5, y: 0, z: 0 })).toBe(false);
    expect(world.size).toBe(0);
  });

  it("returns defensive copies from all()", () => {
    const world = new WorldState();
    world.place({ x: 1, y: 2, z: 3 }, "wood");
    const records = world.all();
    records[0].position.x = 99;
    expect(world.has({ x: 1, y: 2, z: 3 })).toBe(true);
  });

  it("supports negative Y (underground) CRUD within world bounds", () => {
    const world = new WorldState();

    // 放置负 Y 方块（地下空间）
    expect(world.place({ x: 0, y: -1, z: 0 }, "stone")).toBe(true);
    expect(world.place({ x: 0, y: -4, z: 0 }, "dirt")).toBe(true);
    expect(world.place({ x: 0, y: -8, z: 0 }, "wood")).toBe(true);
    expect(world.place({ x: 0, y: -32, z: 0 }, "stone")).toBe(true); // 下界包含

    // 获取并验证
    expect(world.get({ x: 0, y: -1, z: 0 })?.blockId).toBe("stone");
    expect(world.get({ x: 0, y: -4, z: 0 })?.blockId).toBe("dirt");
    expect(world.get({ x: 0, y: -8, z: 0 })?.blockId).toBe("wood");
    expect(world.get({ x: 0, y: -32, z: 0 })?.blockId).toBe("stone");
    expect(world.has({ x: 0, y: -1, z: 0 })).toBe(true);
    expect(world.size).toBe(4);

    // all() 包含负 Y 方块
    const records = world.all();
    const negativeYRecords = records.filter((r) => r.position.y < 0);
    expect(negativeYRecords.length).toBe(4);

    // 越界负 Y 放置失败
    expect(world.place({ x: 0, y: -33, z: 0 }, "grass")).toBe(false);
    expect(world.size).toBe(4);

    // 移除负 Y 方块
    expect(world.remove({ x: 0, y: -4, z: 0 })).toBe(true);
    expect(world.has({ x: 0, y: -4, z: 0 })).toBe(false);
    expect(world.size).toBe(3);

    // clear 后负 Y 方块也被清除
    world.clear();
    expect(world.size).toBe(0);
    expect(world.get({ x: 0, y: -1, z: 0 })).toBeUndefined();
  });
});
