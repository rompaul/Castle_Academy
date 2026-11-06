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
  const plugin = new PersistencePlugin(w, events, { storageKey: "test-world", storageKeyView: "test-view", enabled: true }, store);
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
    const sourcePlugin = new PersistencePlugin(source, sourceEvents, { storageKey: "shared", storageKeyView: "shared-view", enabled: true }, store);
    sourcePlugin.activate();
    expect(sourcePlugin.saveWorld()).toBe(true);

    const target = new WorldState();
    const targetEvents = new EventBus();
    const targetPlugin = new PersistencePlugin(target, targetEvents, { storageKey: "shared", storageKeyView: "shared-view", enabled: true }, store);
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
    const plugin = new PersistencePlugin(world, events, { storageKey: "corrupt", storageKeyView: "corrupt-view", enabled: true }, store);
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
    const plugin2 = new PersistencePlugin(world2, events2, { storageKey: "test-world", storageKeyView: "test-view", enabled: true }, store);
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

  it("旧存档（version 1，含负 Y 坐标）直接加载，坐标与 blockId 不变", () => {
    const store = new MapStorage();
    const source = new WorldState();
    source.place({ x: 0, y: 0, z: 0 }, "grass");
    source.place({ x: 0, y: -4, z: 0 }, "stone");   // 负 Y（B1）
    source.place({ x: 0, y: -8, z: -5 }, "wood");    // 负 Y（B2）

    const sourceEvents = new EventBus();
    const sourcePlugin = new PersistencePlugin(source, sourceEvents, { storageKey: "legacy", storageKeyView: "legacy-view", enabled: true }, store);
    sourcePlugin.activate();
    expect(sourcePlugin.saveWorld()).toBe(true);

    // 确认存档为 version 1，不含 layer/section 字段（V0.4 不扩展 schema）
    const raw = store.getItem("legacy")!;
    const snapshot = JSON.parse(raw);
    expect(snapshot.version).toBe(1);
    expect(snapshot.blocks.length).toBe(3);

    // 加载到新世界
    const target = new WorldState();
    const targetEvents = new EventBus();
    const targetPlugin = new PersistencePlugin(target, targetEvents, { storageKey: "legacy", storageKeyView: "legacy-view", enabled: true }, store);
    targetPlugin.activate();
    expect(targetPlugin.loadWorld()).toBe(true);

    // 迁移前后 block count、blockId、position 三元组一致
    expect(target.serialize()).toEqual(source.serialize());
    expect(target.get({ x: 0, y: -4, z: 0 })?.blockId).toBe("stone");
    expect(target.get({ x: 0, y: -8, z: -5 })?.blockId).toBe("wood");
  });

  it("存档加载幂等：重复加载同一存档结果一致", () => {
    const store = new MapStorage();
    const source = new WorldState();
    source.place({ x: 5, y: -1, z: 3 }, "glass");
    source.place({ x: -2, y: -32, z: 0 }, "stone"); // Y 下界

    const sourcePlugin = new PersistencePlugin(source, new EventBus(), { storageKey: "idempotent", storageKeyView: "idempotent-view", enabled: true }, store);
    sourcePlugin.activate();
    expect(sourcePlugin.saveWorld()).toBe(true);

    // 第一次加载
    const world1 = new WorldState();
    const plugin1 = new PersistencePlugin(world1, new EventBus(), { storageKey: "idempotent", storageKeyView: "idempotent-view", enabled: true }, store);
    plugin1.activate();
    expect(plugin1.loadWorld()).toBe(true);
    const first = world1.serialize();

    // 第二次加载（同一存档，新世界）
    const world2 = new WorldState();
    const plugin2 = new PersistencePlugin(world2, new EventBus(), { storageKey: "idempotent", storageKeyView: "idempotent-view", enabled: true }, store);
    plugin2.activate();
    expect(plugin2.loadWorld()).toBe(true);
    const second = world2.serialize();

    expect(second).toEqual(first);
    expect(world2.size).toBe(2);
  });
});
