import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../core/events/EventBus";
import { WorldState } from "../../core/world/WorldState";
import { BuildingPlugin } from "./BuildingPlugin";

describe("BuildingPlugin", () => {
  it("emits events only when a block operation succeeds", () => {
    const world = new WorldState();
    const events = new EventBus();
    const placed = vi.fn();
    const removed = vi.fn();
    events.on("world.block.placed", placed);
    events.on("world.block.removed", removed);
    const building = new BuildingPlugin(world, events);
    const position = { x: 1, y: 0, z: 1 };
    expect(building.place(position, "stone")).toBe(true);
    expect(building.place(position, "wood")).toBe(false);
    expect(building.remove(position)).toBe(true);
    expect(building.remove(position)).toBe(false);
    expect(placed).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledOnce();
  });
});
