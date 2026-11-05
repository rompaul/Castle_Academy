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
    expect(plugin.copyRegion({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBe(0);
    expect(plugin.pasteRegion({ x: 0, y: 0, z: 0 })).toBe(0);
    expect(plugin.getClipboard().length).toBe(0);
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

  it("copyRegion snapshots blocks relative to min corner", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    world.place({ x: 5, y: 5, z: 5 }, "grass");
    world.place({ x: 6, y: 5, z: 5 }, "dirt");

    const count = plugin.copyRegion({ x: 5, y: 5, z: 5 }, { x: 6, y: 5, z: 5 });
    expect(count).toBe(2);
    const clipboard = plugin.getClipboard();
    expect(clipboard.length).toBe(2);
    // Normalized relative to min corner (5,5,5)
    expect(clipboard.find((b) => b.x === 0 && b.y === 0 && b.z === 0)?.blockId).toBe("grass");
    expect(clipboard.find((b) => b.x === 1 && b.y === 0 && b.z === 0)?.blockId).toBe("dirt");
  });

  it("pasteRegion places clipboard at origin without overwriting existing", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();

    world.place({ x: 0, y: 0, z: 0 }, "grass");
    world.place({ x: 1, y: 0, z: 0 }, "dirt");
    plugin.copyRegion({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });

    // Paste at origin (5,5,5); existing grass at (0,0,0) should not be overwritten
    const pasted = plugin.pasteRegion({ x: 5, y: 5, z: 5 });
    expect(pasted).toBe(2);
    expect(world.has({ x: 5, y: 5, z: 5 })).toBe(true);
    expect(world.get({ x: 5, y: 5, z: 5 })?.blockId).toBe("grass");
    expect(world.get({ x: 6, y: 5, z: 5 })?.blockId).toBe("dirt");

    // Paste again at same origin: existing blocks not overwritten, count should be 0
    const pastedAgain = plugin.pasteRegion({ x: 5, y: 5, z: 5 });
    expect(pastedAgain).toBe(0);
  });

  it("clearClipboard empties the clipboard", () => {
    const { world, plugin } = makePlugin();
    plugin.activate();
    world.place({ x: 0, y: 0, z: 0 }, "grass");
    plugin.copyRegion({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(plugin.getClipboard().length).toBe(1);
    plugin.clearClipboard();
    expect(plugin.getClipboard().length).toBe(0);
  });
});
