import { describe, expect, it } from "vitest";
import { LayerPlugin } from "./LayerPlugin";
import { LayerRegistry } from "./LayerRegistry";
import { EventBus } from "../../core/events/EventBus";
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

function makePlugin() {
  const events = new EventBus();
  const registry = new LayerRegistry();
  const plugin = new LayerPlugin(events, registry);
  return { events, registry, plugin };
}

describe("LayerPlugin", () => {
  it("declares plugin contract fields", () => {
    const { plugin } = makePlugin();
    expect(plugin.id).toBe("layer");
    expect(plugin.name).toBe("Layer");
    expect(plugin.version).toBe("0.4.0");
  });

  it("lifecycle: register/initialize/activate/deactivate/dispose", () => {
    const { plugin } = makePlugin();
    plugin.register();
    plugin.initialize();
    plugin.activate();
    expect(plugin.isActive()).toBe(true);
    plugin.deactivate();
    expect(plugin.isActive()).toBe(false);
    expect(() => plugin.dispose()).not.toThrow();
    expect(plugin.isActive()).toBe(false);
  });

  it("registers and retrieves layers", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(groundLayer());
    plugin.registerLayer(level1Layer());

    expect(plugin.hasLayer("ground")).toBe(true);
    expect(plugin.hasLayer("nonexistent")).toBe(false);
    expect(plugin.getLayer("ground")?.id).toBe("ground");
    expect(plugin.getLayer("nonexistent")).toBeUndefined();

    const all = plugin.getAllLayers();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe("ground");
    expect(all[0].order).toBe(0);
    expect(all[1].id).toBe("level-1");
    expect(all[1].order).toBe(1);
  });

  it("rejects duplicate layer id", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(groundLayer());
    expect(() => plugin.registerLayer(groundLayer())).toThrow(/Duplicate layer id/);
  });

  it("rejects overlapping Y ranges", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(groundLayer()); // [0, 4)
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
    expect(() => plugin.registerLayer(overlapping)).toThrow(/overlaps/);
  });

  it("default layer id is the first registered layer", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(level1Layer());
    plugin.registerLayer(groundLayer());
    expect(plugin.getDefaultLayerId()).toBe("level-1");
  });

  it("setActiveLayer accepts buildable layer and emits event", () => {
    const { plugin, events } = makePlugin();
    plugin.registerLayer(groundLayer());
    plugin.registerLayer(level1Layer());
    plugin.activate();

    const eventsEmitted: unknown[] = [];
    events.on("layer.active.changed", (e) => eventsEmitted.push(e));

    expect(plugin.setActiveLayer("level-1")).toBe(true);
    expect(plugin.getActiveLayerId()).toBe("level-1");
    expect(eventsEmitted.length).toBe(1);

    // 不可建造层不可激活（使用不重叠的范围，避免与 ground 冲突）
    const nonBuildable: LayerDefinition = {
      id: "non-buildable",
      label: "Non Buildable",
      kind: "foundation",
      minY: -12,
      maxYExclusive: -8,
      order: -3,
      defaultVisible: true,
      buildable: false,
    };
    plugin.registerLayer(nonBuildable);
    expect(plugin.setActiveLayer("non-buildable")).toBe(false);
    expect(plugin.getActiveLayerId()).toBe("level-1");

    // 未知层不可激活
    expect(plugin.setActiveLayer("unknown")).toBe(false);
  });

  it("setLayerVisibility and getLayerVisibility", () => {
    const { plugin, events } = makePlugin();
    plugin.registerLayer(groundLayer());
    plugin.registerLayer(basement1Layer());
    plugin.activate();

    const eventsEmitted: unknown[] = [];
    events.on("layer.visibility.changed", (e) => eventsEmitted.push(e));

    expect(plugin.getLayerVisibility("ground")).toBeUndefined();
    expect(plugin.setLayerVisibility("ground", false)).toBe(true);
    expect(plugin.getLayerVisibility("ground")).toBe(false);
    expect(eventsEmitted.length).toBe(1);

    expect(plugin.setLayerVisibility("unknown", true)).toBe(false);
  });

  it("setViewMode emits event", () => {
    const { plugin, events } = makePlugin();
    plugin.registerLayer(groundLayer());
    plugin.registerLayer(basement1Layer());
    plugin.activate();

    const eventsEmitted: unknown[] = [];
    events.on("view.mode.changed", (e) => eventsEmitted.push(e));

    plugin.setViewMode({ type: "underground" });
    expect(plugin.getViewMode().type).toBe("underground");
    expect(eventsEmitted.length).toBe(1);
  });

  it("resolveLayerId maps y to layer", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(basement1Layer()); // [-4, 0)
    plugin.registerLayer(groundLayer());   // [0, 4)
    plugin.registerLayer(level1Layer());   // [4, 8)

    expect(plugin.resolveLayerId(-3)).toBe("basement-1");
    expect(plugin.resolveLayerId(0)).toBe("ground");
    expect(plugin.resolveLayerId(4)).toBe("level-1");
    expect(plugin.resolveLayerId(100)).toBeUndefined();
  });

  it("isPositionVisible combines layer visibility and view mode", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(basement1Layer()); // [-4, 0)
    plugin.registerLayer(groundLayer());   // [0, 4)

    // all mode: both visible
    expect(plugin.isPositionVisible({ x: 0, y: -3, z: 0 })).toBe(true);
    expect(plugin.isPositionVisible({ x: 0, y: 1, z: 0 })).toBe(true);
    expect(plugin.isPositionVisible({ x: 0, y: 100, z: 0 })).toBe(false);

    // above-ground: basement hidden
    plugin.setViewMode({ type: "above-ground" });
    expect(plugin.isPositionVisible({ x: 0, y: -3, z: 0 })).toBe(false);
    expect(plugin.isPositionVisible({ x: 0, y: 1, z: 0 })).toBe(true);

    // hide a layer
    plugin.setViewMode({ type: "all" });
    plugin.setLayerVisibility("ground", false);
    expect(plugin.isPositionVisible({ x: 0, y: 1, z: 0 })).toBe(false);
  });

  it("getVisibleLayerIds returns filtered ids", () => {
    const { plugin } = makePlugin();
    plugin.registerLayer(basement1Layer());
    plugin.registerLayer(groundLayer());
    plugin.registerLayer(level1Layer());

    expect(plugin.getVisibleLayerIds()).toEqual([
      "basement-1",
      "ground",
      "level-1",
    ]);

    plugin.setViewMode({ type: "above-ground" });
    expect(plugin.getVisibleLayerIds()).toEqual(["ground", "level-1"]);
  });

  it("does not depend on Three.js/React/DOM", () => {
    const { plugin } = makePlugin();
    expect(plugin).toBeDefined();
    expect(typeof plugin.registerLayer).toBe("function");
    expect(typeof plugin.setActiveLayer).toBe("function");
    expect(typeof plugin.setLayerVisibility).toBe("function");
    expect(typeof plugin.setViewMode).toBe("function");
    expect(typeof plugin.resolveLayerId).toBe("function");
    expect(typeof plugin.isPositionVisible).toBe("function");
    expect(typeof plugin.getVisibleLayerIds).toBe("function");
  });
});
