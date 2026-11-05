import { describe, expect, it } from "vitest";
import { PersistencePlugin } from "./PersistencePlugin";
import { WorldState } from "../../core/world/WorldState";
import { EventBus, type DomainEvent } from "../../core/events/EventBus";

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MapStorage implements Store {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function makeWorldWithBlocks() {
  const world = new WorldState();
  world.place({ x: 0, y: 0, z: 0 }, "grass");
  world.place({ x: 1, y: 1, z: 0 }, "stone");
  world.place({ x: -2, y: 3, z: 4 }, "wood");
  return world;
}

function makePlugin(store: Store, world?: WorldState) {
  const w = world ?? new WorldState();
  const events = new EventBus();
  const plugin = new PersistencePlugin(w, events, { storageKey: "test-world", enabled: true }, store);
  return { world: w, events, plugin };
}

describe("PersistencePlugin", () => {
  it("declares plugin contract fields", () => {
    const { plugin } = makePlugin(new MapStorage());
    expect(plugin.id).toBe("persistence");
    expect(plugin.name).toBe("World Persistence");
    expect(plugin.version).toBe("0.2.0");
  });

  it("rejects save/load when not activated", () => {
    const { world, plugin } = makePlugin(new MapStorage());
    expect(plugin.saveWorld()).toBe(false);
    expect(plugin.loadWorld()).toBe(false);
    expect(plugin.hasSavedWorld()).toBe(false);

    world.place({ x: 0, y: 0, z: 0 }, "grass");
    expect(plugin.saveWorld()).toBe(false);
  });

  it("saves and loads a world snapshot round-trip across two plugins sharing storage", () => {
    const store = new MapStorage();
    const source = makeWorldWithBlocks();
    const sourceEvents = new EventBus();
    const sourcePlugin = new PersistencePlugin(source, sourceEvents, { storageKey: "shared", enabled: true }, store);
    sourcePlugin.activate();
    expect(sourcePlugin.saveWorld()).toBe(true);

    const target = new WorldState();
    const targetEvents = new EventBus();
    const targetPlugin = new PersistencePlugin(target, targetEvents, { storageKey: "shared", enabled: true }, store);
    targetPlugin.activate();

    let reloadCalled = false;
    targetPlugin.setReloadHandler(() => {
      reloadCalled = true;
    });

    expect(targetPlugin.loadWorld()).toBe(true);
    expect(target.serialize()).toEqual(source.serialize());
    expect(reloadCalled).toBe(true);
  });

  it("returns false when there is no saved world", () => {
    const { plugin } = makePlugin(new MapStorage());
    plugin.activate();
    expect(plugin.loadWorld()).toBe(false);
    expect(plugin.hasSavedWorld()).toBe(false);
  });

  it("returns false for a corrupted or unsupported snapshot and does not mutate the world", () => {
    const store = new MapStorage();
    const world = makeWorldWithBlocks();
    const events = new EventBus();
    const plugin = new PersistencePlugin(world, events, { storageKey: "corrupt", enabled: true }, store);
    plugin.activate();
    const before = world.serialize();

    store.setItem("corrupt", "{not json");
    expect(plugin.loadWorld()).toBe(false);

    store.setItem("corrupt", JSON.stringify({ version: 999, blocks: [] }));
    expect(plugin.loadWorld()).toBe(false);

    expect(world.serialize()).toEqual(before);
  });

  it("emits world.saved and world.loaded events", () => {
    const store = new MapStorage();
    const { world, events, plugin } = makePlugin(store);
    plugin.activate();

    const saved: DomainEvent<{ blockCount: number }>[] = [];
    const loaded: DomainEvent<{ blockCount: number }>[] = [];
    events.on<{ blockCount: number }>("world.saved", (e) => saved.push(e));
    events.on<{ blockCount: number }>("world.loaded", (e) => loaded.push(e));

    world.place({ x: 0, y: 0, z: 0 }, "glass");
    expect(plugin.saveWorld()).toBe(true);
    expect(saved.length).toBe(1);
    expect(saved[0].payload.blockCount).toBe(1);

    const world2 = new WorldState();
    const events2 = new EventBus();
    const plugin2 = new PersistencePlugin(world2, events2, { storageKey: "test-world", enabled: true }, store);
    plugin2.activate();
    let reloadCalled = false;
    plugin2.setReloadHandler(() => {
      reloadCalled = true;
    });
    events2.on<{ blockCount: number }>("world.loaded", (e) => loaded.push(e));
    expect(plugin2.loadWorld()).toBe(true);
    expect(world2.size).toBe(1);
    expect(loaded.length).toBe(1);
    expect(loaded[0].payload.blockCount).toBe(1);
    expect(reloadCalled).toBe(true);
  });
});
