import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LayerRenderAdapter } from "./LayerRenderAdapter";
import { LayerPlugin } from "../plugins/layers/LayerPlugin";
import { LayerRegistry } from "../plugins/layers/LayerRegistry";
import { EventBus } from "../core/events/EventBus";
import type { LayerDefinition } from "../plugins/layers/LayerTypes";

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

function makeAdapter() {
  const scene = new THREE.Scene();
  const events = new EventBus();
  const registry = new LayerRegistry();
  const layerPlugin = new LayerPlugin(events, registry);
  const adapter = new LayerRenderAdapter(scene, layerPlugin);
  return { scene, events, registry, layerPlugin, adapter };
}

describe("LayerRenderAdapter", () => {
  it("creates and retrieves layer group", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    const group = adapter.ensureGroupForLayer("ground");
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe("ground");
    expect(group.userData.layerId).toBe("ground");

    const retrieved = adapter.getLayerGroup("ground");
    expect(retrieved).toBe(group);
  });

  it("does not create duplicate groups for same layer", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    const g1 = adapter.ensureGroupForLayer("ground");
    const g2 = adapter.ensureGroupForLayer("ground");
    expect(g1).toBe(g2);
  });

  it("adds and removes mesh from layer group", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    adapter.addMeshToLayer(mesh, "ground");

    const group = adapter.getLayerGroup("ground")!;
    expect(group.children).toContain(mesh);

    adapter.removeMeshFromLayer(mesh, "ground");
    expect(group.children).not.toContain(mesh);
  });

  it("setLayerVisible toggles group visibility", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    const group = adapter.ensureGroupForLayer("ground");
    expect(group.visible).toBe(true);

    adapter.setLayerVisible("ground", false);
    expect(group.visible).toBe(false);

    adapter.setLayerVisible("ground", true);
    expect(group.visible).toBe(true);
  });

  it("applyLayerVisibility uses LayerPlugin effective visibility", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());
    layerPlugin.registerLayer(level1Layer());

    adapter.ensureGroupForLayer("ground");
    adapter.ensureGroupForLayer("level-1");

    // all mode: both visible
    expect(adapter.getLayerGroup("ground")!.visible).toBe(true);
    expect(adapter.getLayerGroup("level-1")!.visible).toBe(true);

    // switch to above-ground: level-1 visible, ground visible too (y>=0)
    layerPlugin.setViewMode({ type: "above-ground" });
    adapter.applyAllLayerVisibility();
    expect(adapter.getLayerGroup("ground")!.visible).toBe(true);
    expect(adapter.getLayerGroup("level-1")!.visible).toBe(true);

    // switch to underground: both hidden (ground is y>=0)
    layerPlugin.setViewMode({ type: "underground" });
    adapter.applyAllLayerVisibility();
    expect(adapter.getLayerGroup("ground")!.visible).toBe(false);
    expect(adapter.getLayerGroup("level-1")!.visible).toBe(false);
  });

  it("removes group", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    adapter.ensureGroupForLayer("ground");
    expect(adapter.getLayerGroup("ground")).toBeDefined();

    adapter.removeGroup("ground");
    expect(adapter.getLayerGroup("ground")).toBeUndefined();
  });

  it("removes all groups", () => {
    const { adapter, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());
    layerPlugin.registerLayer(level1Layer());

    adapter.ensureGroupForLayer("ground");
    adapter.ensureGroupForLayer("level-1");
    expect(adapter.getLayerGroup("ground")).toBeDefined();
    expect(adapter.getLayerGroup("level-1")).toBeDefined();

    adapter.removeAllGroups();
    expect(adapter.getLayerGroup("ground")).toBeUndefined();
    expect(adapter.getLayerGroup("level-1")).toBeUndefined();
  });

  it("mesh added to layer is part of scene", () => {
    const { adapter, scene, layerPlugin } = makeAdapter();
    layerPlugin.registerLayer(groundLayer());

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    adapter.addMeshToLayer(mesh, "ground");

    // mesh should be reachable from scene (via group)
    expect(scene.children).toContain(adapter.getLayerGroup("ground"));
    expect(adapter.getLayerGroup("ground")!.children).toContain(mesh);
  });
});
