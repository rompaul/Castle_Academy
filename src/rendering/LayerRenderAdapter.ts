import * as THREE from "three";
import { LayerPlugin } from "../plugins/layers/LayerPlugin";

/**
 * LayerRenderAdapter (V0.4)。
 *
 * 将 layerId 映射到 Three.js Group，负责按图层组织渲染对象。
 * 新建方块时根据 Layer Plugin 解析结果加入对应 Group；
 * 删除方块时从正确 Group 移除 Mesh；
 * 切换显隐只更新 group.visible，不重建 WorldState。
 *
 * 不依赖 WorldState，只依赖 LayerPlugin 的公开接口。
 */
export class LayerRenderAdapter {
  readonly scene: THREE.Scene;
  readonly layerPlugin: LayerPlugin;
  private readonly layerGroups = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene, layerPlugin: LayerPlugin) {
    this.scene = scene;
    this.layerPlugin = layerPlugin;
  }

  /** 确保指定图层的 Three.Group 存在，并应用当前可见性。 */
  ensureGroupForLayer(layerId: string): THREE.Group {
    let group = this.layerGroups.get(layerId);
    if (!group) {
      const def = this.layerPlugin.getLayer(layerId);
      group = new THREE.Group();
      group.name = layerId;
      group.userData.layerId = layerId;
      if (def) {
        group.userData.layerKind = def.kind;
      }
      this.scene.add(group);
      this.layerGroups.set(layerId, group);
      this.applyLayerVisibility(layerId);
    }
    return group;
  }

  /** 将 mesh 添加到指定图层的 Group 中。 */
  addMeshToLayer(mesh: THREE.Mesh, layerId: string): void {
    const group = this.ensureGroupForLayer(layerId);
    group.add(mesh);
  }

  /** 从指定图层的 Group 中移除 mesh。 */
  removeMeshFromLayer(mesh: THREE.Mesh, layerId: string): void {
    const group = this.layerGroups.get(layerId);
    if (group) {
      group.remove(mesh);
    }
  }

  /** 设置指定图层的显隐。 */
  setLayerVisible(layerId: string, visible: boolean): void {
    const group = this.layerGroups.get(layerId);
    if (group) {
      group.visible = visible;
    }
  }

  /** 根据 LayerPlugin 的当前状态重新应用图层可见性。 */
  applyLayerVisibility(layerId: string): void {
    const group = this.layerGroups.get(layerId);
    if (!group) return;
    group.visible = this.layerPlugin.isLayerEffectivelyVisible(layerId);
  }

  /** 应用所有已创建图层的可见性（视图模式切换时调用）。 */
  applyAllLayerVisibility(): void {
    for (const layerId of this.layerGroups.keys()) {
      this.applyLayerVisibility(layerId);
    }
  }

  /** 获取指定图层的 Group。 */
  getLayerGroup(layerId: string): THREE.Group | undefined {
    return this.layerGroups.get(layerId);
  }

  /** 移除指定图层的 Group。 */
  removeGroup(layerId: string): void {
    const group = this.layerGroups.get(layerId);
    if (group) {
      this.scene.remove(group);
      this.layerGroups.delete(layerId);
    }
  }

  /** 移除所有 Group。 */
  removeAllGroups(): void {
    for (const layerId of this.layerGroups.keys()) {
      this.removeGroup(layerId);
    }
  }
}
