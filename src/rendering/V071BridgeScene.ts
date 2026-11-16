/**
 * V0.7.1 — 桥梁任务动态场景（ADR-V071-1）。
 *
 * 河道、桥头与半透明蓝图只存在于 Three.js 场景中的临时 Group：
 * 不写 WorldState、不改 WorldSnapshot、不进任何存档。任务关闭时整体移除。
 */
import * as THREE from "three";
import type { BridgeBlueprint, BridgeScenario, ConstructionEvidence } from "../features/engineering-design/types";
import { cellWorldPosition } from "../features/engineering-design/design";

function cellKey(dx: number, dz: number): string {
  return `${dx},${dz}`;
}

export class V071BridgeScene {
  private group: THREE.Group | null = null;
  private readonly ghostGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fd3f4,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  private readonly invalidMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2a19b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  private readonly ghostMeshes = new Map<string, THREE.Mesh>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly scenario: BridgeScenario
  ) {}

  setActive(active: boolean): void {
    if (active && !this.group) this.buildScene();
    if (!active && this.group) this.clearScene();
  }

  private buildScene(): void {
    const group = new THREE.Group();
    group.name = "v071-bridge-scene";

    const riverWidth = this.scenario.riverMaxX - this.scenario.riverMinX + 1;
    const riverDepth = this.scenario.riverMaxZ - this.scenario.riverMinZ + 1;
    const waterGeometry = new THREE.PlaneGeometry(riverWidth, riverDepth);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a95b8,
      transparent: true,
      opacity: 0.72,
      roughness: 0.35
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(
      (this.scenario.riverMinX + this.scenario.riverMaxX) / 2,
      0.04,
      (this.scenario.riverMinZ + this.scenario.riverMaxZ) / 2
    );
    water.receiveShadow = true;
    water.userData.kind = "v071-river";
    group.add(water);

    const bankGeometry = new THREE.BoxGeometry(1, 0.14, riverDepth);
    const bankMaterial = new THREE.MeshStandardMaterial({ color: 0xb7a06a, roughness: 1 });
    for (const x of [this.scenario.riverMinX - 1, this.scenario.riverMaxX + 1]) {
      const bank = new THREE.Mesh(bankGeometry, bankMaterial);
      bank.position.set(x, 0.07, (this.scenario.riverMinZ + this.scenario.riverMaxZ) / 2);
      bank.receiveShadow = true;
      bank.userData.kind = "v071-bank";
      group.add(bank);
    }

    const postGeometry = new THREE.BoxGeometry(0.5, 1.1, 0.5);
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x8c8b86, roughness: 1 });
    for (const x of [this.scenario.riverMinX - 1, this.scenario.riverMaxX + 1]) {
      for (const z of [this.scenario.deckZStart, this.scenario.deckZStart + this.scenario.deckWidthRange[1] - 1]) {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, 0.55, z);
        post.userData.kind = "v071-old-bridge-post";
        group.add(post);
      }
    }

    this.scene.add(group);
    this.group = group;
  }

  setBlueprint(blueprint: BridgeBlueprint | null): void {
    this.clearGhosts();
    if (!this.group || !blueprint) return;
    for (const cell of blueprint.requiredCells) {
      const position = cellWorldPosition(blueprint, cell);
      const ghost = new THREE.Mesh(this.ghostGeometry, this.ghostMaterial);
      ghost.position.set(position.x, position.y + 0.5, position.z);
      ghost.userData.kind = "v071-ghost";
      ghost.userData.cellKey = cellKey(cell.dx, cell.dz);
      this.group.add(ghost);
      this.ghostMeshes.set(cellKey(cell.dx, cell.dz), ghost);
    }
  }

  updateEvidence(evidence: ConstructionEvidence | null): void {
    if (!evidence) return;
    const missing = new Set(evidence.missingCells.map((cell) => cellKey(cell.dx, cell.dz)));
    const invalid = new Set(evidence.invalidMaterialCells.map((cell) => cellKey(cell.dx, cell.dz)));
    for (const [key, mesh] of this.ghostMeshes) {
      mesh.material = invalid.has(key) ? this.invalidMaterial : this.ghostMaterial;
      mesh.visible = invalid.has(key) || missing.has(key);
    }
  }

  private clearGhosts(): void {
    for (const mesh of this.ghostMeshes.values()) {
      this.group?.remove(mesh);
    }
    this.ghostMeshes.clear();
  }

  private clearScene(): void {
    this.clearGhosts();
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.geometry !== this.ghostGeometry) object.geometry.dispose();
      if (object.material !== this.ghostMaterial && object.material !== this.invalidMaterial) {
        const material = object.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    });
    this.group = null;
  }

  dispose(): void {
    this.clearScene();
    this.ghostGeometry.dispose();
    this.ghostMaterial.dispose();
    this.invalidMaterial.dispose();
  }
}
