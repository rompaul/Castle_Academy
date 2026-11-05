import { describe, expect, it } from "vitest";
import { BlueprintPlugin, type StoredBlock } from "./BlueprintPlugin";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";
import type { BlockId } from "../../core/world/blocks";

function makePlugin() {
  const world = new WorldState();
  const events = new EventBus();
  const plugin = new BlueprintPlugin(world, events);
  return { world, events, plugin };
}

describe("BlueprintPlugin", () => {
  it("declares plugin contract fields", () => {
    const { plugin } = makePlugin();
    expect(plugin.id).toBe("blueprint");
    expect(plugin.name).toBe("Blueprint");
    expect(plugin.version).toBe("0.3.0");
  });

  it("rejects operations when not activated", () => {
    const { plugin } = makePlugin();
    expect(plugin.saveBlueprint("b1", [{ x: 0, y: 0, z: 0, blockId: "grass" }])).toBe(false);
    expect(plugin.loadBlueprint("b1")).toBeUndefined();
    expect(plugin.listBlueprints()).toEqual([]);
    expect(plugin.deleteBlueprint("b1")).toBe(false);
    expect(plugin.placeBlueprint("b1", { x: 0, y: 0, z: 0 })).toBe(0);
    expect(plugin.blueprintCount).toBe(0);
  });

  it("saves and lists a blueprint", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    const blocks: StoredBlock[] = [
      { x: 10, y: 10, z: 10, blockId: "grass" as BlockId },
      { x: 11, y: 10, z: 10, blockId: "dirt" as BlockId },
    ];
    expect(plugin.saveBlueprint("wall", blocks)).toBe(true);
    expect(plugin.listBlueprints()).toEqual(["wall"]);
    expect(plugin.hasBlueprint("wall")).toBe(true);
    expect(plugin.blueprintCount).toBe(1);
  });

  it("normalizes blueprint blocks relative to min corner", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    const blocks: StoredBlock[] = [
      { x: 5, y: 5, z: 5, blockId: "stone" as BlockId },
      { x: 6, y: 5, z: 5, blockId: "stone" as BlockId },
    ];
    plugin.saveBlueprint("norm", blocks);

    const loaded = plugin.loadBlueprint("norm");
    expect(loaded).toBeDefined();
    expect(loaded!.length).toBe(2);
    expect(loaded!.find((b) => b.x === 0 && b.y === 0 && b.z === 0)?.blockId).toBe("stone");
    expect(loaded!.find((b) => b.x === 1 && b.y === 0 && b.z === 0)?.blockId).toBe("stone");
  });

  it("rejects duplicate blueprint names", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    const blocks: StoredBlock[] = [{ x: 0, y: 0, z: 0, blockId: "grass" as BlockId }];
    expect(plugin.saveBlueprint("dup", blocks)).toBe(true);
    expect(plugin.saveBlueprint("dup", blocks)).toBe(false);
    expect(plugin.listBlueprints()).toEqual(["dup"]);
  });

  it("rejects empty blueprint", () => {
    const { plugin } = makePlugin();
    plugin.activate();
    expect(plugin.saveBlueprint("empty", [])).toBe(false);
    expect(plugin.listBlueprints()).toEqual([]);
  });

  it("loadBlueprint returns deep copy (mutating result does not affect storage)", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    const blocks: StoredBlock[] = [{ x: 0, y: 0, z: 0, blockId: "grass" as BlockId }];
    plugin.saveBlueprint("copy", blocks);

    const loaded = plugin.loadBlueprint("copy")!;
    loaded[0].x = 999;
    const again = plugin.loadBlueprint("copy")!;
    expect(again[0].x).toBe(0);
  });

  it("deletes a blueprint", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    plugin.saveBlueprint("del", [{ x: 0, y: 0, z: 0, blockId: "grass" }]);
    expect(plugin.deleteBlueprint("del")).toBe(true);
    expect(plugin.deleteBlueprint("del")).toBe(false);
    expect(plugin.loadBlueprint("del")).toBeUndefined();
    expect(plugin.listBlueprints()).toEqual([]);
    expect(plugin.blueprintCount).toBe(0);
  });

  it("places blueprint at origin without overwriting existing blocks", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    world.place({ x: 0, y: 0, z: 0 }, "grass");
    const blocks: StoredBlock[] = [
      { x: 0, y: 0, z: 0, blockId: "stone" as BlockId },
      { x: 1, y: 0, z: 0, blockId: "dirt" as BlockId },
    ];
    plugin.saveBlueprint("mix", blocks);

    const placed = plugin.placeBlueprint("mix", { x: 0, y: 0, z: 0 });
    // (0,0,0) already has grass, not overwritten; (1,0,0) gets dirt
    expect(placed).toBe(1);
    expect(world.get({ x: 0, y: 0, z: 0 })?.blockId).toBe("grass");
    expect(world.get({ x: 1, y: 0, z: 0 })?.blockId).toBe("dirt");
  });

  it("returns 0 for nonexistent blueprint", () => {
    const { plugin } = makePlugin();
    plugin.activate();
    expect(plugin.placeBlueprint("missing", { x: 0, y: 0, z: 0 })).toBe(0);
  });
});
