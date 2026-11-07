import * as THREE from "three";
import type { GridPosition } from "../core/world/coordinates";
import { positionKey } from "../core/world/coordinates";
import { LayerRenderAdapter } from "./LayerRenderAdapter";

/**
 * V05-008 — WaterRenderAdapter：水格渲染适配层（ADR-0005）。
 *
 * - 水格不是方块：不进 BLOCKS 材质路径、不进射线目标、无碰撞。
 * - 但水格归属其 Y 所在图层：通过 LayerRenderAdapter 的 Group 获得显隐/剖面兼容。
 * - 共享几何体与材质（全部水格 2 个 GPU 资源），每格一个 Mesh；
 *   若 Phase 6 性能门实测超标，此处是升级 InstancedMesh 的唯一改动点（R-503）。
 */
export class WaterRenderAdapter {
  private readonly geometry: THREE.BoxGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  /** key → { mesh, layerId } */
  private readonly waterMeshes = new Map<string, { mesh: THREE.Mesh; layerId: string }>();

  constructor(
    private readonly layerRenderAdapter: LayerRenderAdapter,
    resolveLayerId: (y: number) => string
  ) {
    // 水面略低于整格（7/8 格高），视觉上区分于实体方块
    this.geometry = new THREE.BoxGeometry(1, 0.875, 1);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x3b7dd8,
      transparent: true,
      opacity: 0.62,
      roughness: 0.25,
      metalness: 0,
    });
    this.resolveLayerId = resolveLayerId;
  }

  private readonly resolveLayerId: (y: number) => string;

  /** 应用水域增量（water.flow.updated） */
  applyDiff(added: GridPosition[], removed: GridPosition[]): void {
    for (const position of removed) {
      this.removeWater(positionKey(position));
    }
    for (const position of added) {
      this.addWater(position);
    }
  }

  addWater(position: GridPosition): void {
    const key = positionKey(position);
    if (this.waterMeshes.has(key)) return;
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.set(position.x, position.y + 0.4375, position.z);
    mesh.renderOrder = 1; // 半透明水在方块之后绘制
    const layerId = this.resolveLayerId(position.y);
    mesh.userData.kind = "water";
    mesh.userData.layerId = layerId;
    mesh.userData.position = position;
    this.layerRenderAdapter.addMeshToLayer(mesh, layerId);
    this.waterMeshes.set(key, { mesh, layerId });
  }

  removeWater(key: string): void {
    const entry = this.waterMeshes.get(key);
    if (!entry) return;
    this.layerRenderAdapter.removeMeshFromLayer(entry.mesh, entry.layerId);
    this.waterMeshes.delete(key);
  }

  clear(): void {
    for (const key of [...this.waterMeshes.keys()]) {
      this.removeWater(key);
    }
  }

  /** 供剖面视图遍历水格（与方块同规则裁切） */
  forEachMesh(callback: (mesh: THREE.Mesh) => void): void {
    for (const { mesh } of this.waterMeshes.values()) {
      callback(mesh);
    }
  }

  get size(): number {
    return this.waterMeshes.size;
  }

  dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}
