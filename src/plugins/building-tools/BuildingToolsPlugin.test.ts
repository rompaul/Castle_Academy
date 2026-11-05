import { describe, expect, it } from "vitest";
import { BuildingToolsPlugin } from "./BuildingToolsPlugin";
import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

function makePlugin() {
  const world = new WorldState();
  const events = new EventBus();
  const plugin = new BuildingToolsPlugin(world, events);
  return { world, events, plugin };
}

describe("BuildingToolsPlugin", () => {
  it("declares plugin contract fields", () => {
    const { plugin } = makePlugin();
    expect(plugin.id).toBe("building-tools");
    expect(plugin.name).toBe("Building Tools");
    expect(plugin.version).toBe("0.3.0");
  });

  it("rejects operations when not activated", () => {
    const { plugin } = makePlugin();
    expect(plugin.placeLine({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, "grass")).toBe(0);
    expect(plugin.fillRectangle({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, "stone")).toBe(0);
  });

  it("places blocks along a 3D line", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    const count = plugin.placeLine({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, "brick");
    expect(count).toBe(4);
    expect(world.has({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(world.has({ x: 3, y: 0, z: 0 })).toBe(true);
    expect(world.get({ x: 0, y: 0, z: 0 })?.blockId).toBe("brick");
  });

  it("places blocks along a diagonal line", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    const count = plugin.placeLine({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, "glass");
    expect(count).toBe(3);
    expect(world.has({ x: 1, y: 1, z: 1 })).toBe(true);
    expect(world.get({ x: 1, y: 1, z: 1 })?.blockId).toBe("glass");
  });

  it("fills a solid rectangle box", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    const count = plugin.fillRectangle({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, "stone");
    // 2x2x2 = 8 blocks
    expect(count).toBe(8);
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          expect(world.has({ x, y, z })).toBe(true);
          expect(world.get({ x, y, z })?.blockId).toBe("stone");
        }
      }
    }
  });

  it("fillRectangle accepts corners in any order", () => {
    const { plugin } = makePlugin();
    plugin.activate();

    const count = plugin.fillRectangle({ x: 2, y: 2, z: 2 }, { x: 0, y: 0, z: 0 }, "wood");
    // min=(0,0,0), max=(2,2,2) => 3x3x3 = 27 blocks
    expect(count).toBe(27);
  });
});
