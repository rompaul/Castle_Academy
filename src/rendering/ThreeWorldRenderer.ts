import * as THREE from "three";
import { WorldState } from "../core/world/WorldState";
import { BLOCKS, type BlockId } from "../core/world/blocks";
import { WORLD_BOUNDS, type GridPosition, samePosition } from "../core/world/coordinates";
import { PlayerController } from "../plugins/player-controller/PlayerController";
import { BuildingPlugin } from "../plugins/building/BuildingPlugin";
import { BuildingToolsPlugin } from "../plugins/building-tools/BuildingToolsPlugin";
import { BlueprintPlugin } from "../plugins/blueprint/BlueprintPlugin";
import { MeasurementPlugin } from "../plugins/measurement/MeasurementPlugin";
import { LayerPlugin } from "../plugins/layers/LayerPlugin";
import { LayerRegistry } from "../plugins/layers/LayerRegistry";
import { LayerRenderAdapter } from "./LayerRenderAdapter";
import type { SectionViewState } from "../plugins/layers/LayerTypes";
import { EventBus } from "../core/events/EventBus";

const BLOCK_SIZE = 1;

export class ThreeWorldRenderer {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly world = new WorldState();
  readonly events = new EventBus();
  readonly building = new BuildingPlugin(this.world, this.events);
  readonly buildingTools = new BuildingToolsPlugin(this.world, this.events);
  readonly blueprint = new BlueprintPlugin(this.world, this.events);
  readonly measurement = new MeasurementPlugin();
  readonly player: PlayerController;
  readonly layerPlugin: LayerPlugin;
  readonly layerRenderAdapter: LayerRenderAdapter;
  private readonly blockMeshes = new Map<string, THREE.Mesh>();
  private lineStart: GridPosition | null = null;
  private fillStart: GridPosition | null = null;
  private readonly unsubscribeLayerEvents = new Array<() => void>();
  private readonly geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  private readonly materials = new Map<BlockId, THREE.MeshStandardMaterial>();
  private readonly ground: THREE.Mesh;
  private readonly groundGeometry: THREE.BoxGeometry;
  private readonly groundMaterial: THREE.MeshStandardMaterial;
  private readonly grid: THREE.GridHelper;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly outline: THREE.LineSegments;
  private targetPosition: GridPosition | null = null;
  private animationFrame = 0;
  private previousTime = 0;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onMessage: (text: string) => void,
    layerPlugin?: LayerPlugin,
    layerRenderAdapter?: LayerRenderAdapter
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x9eb6b5);
    this.host.appendChild(this.renderer.domElement);

    const registry = new LayerRegistry();
    if (!layerPlugin) {
      registry.register({ id: "basement-1", label: "Basement 1", kind: "basement", minY: -4, maxYExclusive: 0, order: -1, defaultVisible: true, buildable: true });
      registry.register({ id: "ground", label: "Ground", kind: "ground-floor", minY: 0, maxYExclusive: 4, order: 0, defaultVisible: true, buildable: true });
      registry.register({ id: "level-1", label: "Level 1", kind: "upper-floor", minY: 4, maxYExclusive: 8, order: 1, defaultVisible: true, buildable: true });
    }
    this.layerPlugin = layerPlugin ?? new LayerPlugin(this.events, registry);
    this.layerRenderAdapter = layerRenderAdapter ?? new LayerRenderAdapter(this.scene, this.layerPlugin);

    // 订阅图层可见性与视图模式变化，更新 Three.js 场景显隐
    this.unsubscribeLayerEvents.push(
      this.events.on<{ layerId: string }>("layer.visibility.changed", (event) => {
        this.layerRenderAdapter.applyLayerVisibility(event.payload.layerId);
      }),
      this.events.on("view.mode.changed", () => {
        this.layerRenderAdapter.applyAllLayerVisibility();
      }),
      this.events.on<{ section: SectionViewState }>("section.view.changed", (event) => {
        this.applySectionView(event.payload.section);
      })
    );

    this.scene.background = new THREE.Color(0x9eb6b5);
    this.scene.fog = new THREE.Fog(0x9eb6b5, 24, 72);

    const hemi = new THREE.HemisphereLight(0xe7f2e8, 0x65745b, 2.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d5, 2.2);
    sun.position.set(-12, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    this.groundGeometry = new THREE.BoxGeometry(32, 1, 32);
    this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0x66834f, roughness: 1 });
    this.ground = new THREE.Mesh(this.groundGeometry, this.groundMaterial);
    this.ground.position.y = WORLD_BOUNDS.minY - 0.5;
    this.ground.receiveShadow = true;
    this.ground.userData.kind = "ground";
    this.scene.add(this.ground);

    this.grid = new THREE.GridHelper(32, 32, 0x526c47, 0x789267);
    this.grid.position.y = 0.01;
    this.scene.add(this.grid);

    const outlineGeometry = new THREE.EdgesGeometry(this.geometry);
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.95 });
    this.outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    this.outline.visible = false;
    this.scene.add(this.outline);

    BLOCKS.forEach((block) => {
      this.materials.set(block.id, new THREE.MeshStandardMaterial({
        color: block.color,
        roughness: block.id === "glass" ? 0.22 : 0.88,
        metalness: 0,
        transparent: block.id === "glass",
        opacity: block.id === "glass" ? 0.48 : 1
      }));
    });

    this.player = new PlayerController(this.renderer.domElement, this.world, this.onMessage);
    this.buildingTools.activate();
    this.blueprint.activate();
    this.measurement.activate();
    this.renderer.domElement.dataset.testid = "game-canvas";
    this.resize();
    window.addEventListener("resize", this.resize);
    this.renderer.domElement.addEventListener("contextmenu", this.preventContextMenu);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.seedWorld();
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __CASTLE_TEST__: {
          getBlockCount: () => this.world.size,
          hasBlock: (x: number, y: number, z: number) => this.world.has({ x, y, z }),
          placeBlock: (x: number, y: number, z: number, blockId: BlockId) => this.addBlock({ x, y, z }, blockId),
          removeBlock: (x: number, y: number, z: number) => this.removeBlock({ x, y, z }),
          reset: () => this.reset(),
          getPlayerPosition: () => this.player.camera.position.toArray(),
          setPlayerPosition: (x: number, y: number, z: number) => this.player.camera.position.set(x, y, z)
        }
      });
    }
    this.animate(0);
  }

  private readonly preventContextMenu = (event: Event) => event.preventDefault();

  private seedWorld(): void {
    // A few visual landmarks make the empty world feel legible.
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        if (Math.abs(x) === 4 || Math.abs(z) === 4) {
          this.addBlock({ x, y: 0, z }, "grass");
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      this.addBlock({ x: -7, y: i, z: -5 }, "wood");
      this.addBlock({ x: -7, y: i, z: -4 }, "wood");
    }
    this.addBlock({ x: -7, y: 5, z: -5 }, "grass");
    this.addBlock({ x: -7, y: 5, z: -4 }, "grass");
  }

  private key(position: GridPosition): string {
    return `${position.x},${position.y},${position.z}`;
  }

  private addBlock(position: GridPosition, blockId: BlockId): boolean {
    if (!this.building.place(position, blockId)) return false;
    const layerId = this.layerPlugin.resolveLayerId(position.y) ?? this.layerPlugin.getDefaultLayerId() ?? "ground";
    const mesh = new THREE.Mesh(this.geometry, this.materials.get(blockId)!);
    mesh.position.set(position.x, position.y + 0.5, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = "block";
    mesh.userData.position = position;
    mesh.userData.layerId = layerId;
    this.layerRenderAdapter.addMeshToLayer(mesh, layerId);
    this.applySectionToMesh(mesh);
    this.blockMeshes.set(this.key(position), mesh);
    return true;
  }

  private removeBlock(position: GridPosition): boolean {
    if (!this.building.remove(position)) return false;
    const mesh = this.blockMeshes.get(this.key(position));
    if (mesh) {
      const layerId = mesh.userData.layerId as string | undefined;
      if (layerId) {
        this.layerRenderAdapter.removeMeshFromLayer(mesh, layerId);
      } else {
        this.scene.remove(mesh);
      }
    }
    this.blockMeshes.delete(this.key(position));
    return true;
  }

  /** Rebuild all block meshes from the current world state (used after load). */
  reloadFromWorld(): void {
    this.layerRenderAdapter.removeAllGroups();
    this.blockMeshes.clear();
    this.targetPosition = null;
    this.outline.visible = false;

    for (const record of this.world.all()) {
      const mesh = new THREE.Mesh(this.geometry, this.materials.get(record.blockId)!);
      mesh.position.set(record.position.x, record.position.y + 0.5, record.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.kind = "block";
      mesh.userData.position = record.position;
      const layerId = this.layerPlugin.resolveLayerId(record.position.y) ?? this.layerPlugin.getDefaultLayerId() ?? "ground";
      mesh.userData.layerId = layerId;
      this.layerRenderAdapter.addMeshToLayer(mesh, layerId);
      this.blockMeshes.set(this.key(record.position), mesh);
    }
    this.layerRenderAdapter.applyAllLayerVisibility();
    this.applySectionView(this.layerPlugin.getSectionView());
  }

  /** 根据当前剖面状态设置单个 mesh 的显隐。 */
  private applySectionToMesh(mesh: THREE.Mesh): void {
    const section = this.layerPlugin.getSectionView();
    this.applySectionViewSingle(mesh, section);
  }

  /** 应用剖面状态到所有方块 mesh，并同步 outline/目标位置。 */
  private applySectionView(section: SectionViewState): void {
    let targetStillValid = false;
    for (const mesh of this.blockMeshes.values()) {
      const position = mesh.userData.position as GridPosition;
      let keep = true;
      if (section.enabled) {
        if (section.axis === "x") {
          keep = section.keptSide === "positive" ? position.x >= section.coordinate : position.x <= section.coordinate;
        } else if (section.axis === "y") {
          keep = section.keptSide === "positive" ? position.y >= section.coordinate : position.y <= section.coordinate;
        } else {
          keep = section.keptSide === "positive" ? position.z >= section.coordinate : position.z <= section.coordinate;
        }
      }
      mesh.visible = keep;
      if (keep && this.targetPosition && samePosition(position, this.targetPosition)) {
        targetStillValid = true;
      }
    }
    if (this.targetPosition && !targetStillValid) {
      this.targetPosition = null;
      this.outline.visible = false;
    }
  }

  /** 根据剖面状态设置单个 mesh 显隐。 */
  private applySectionViewSingle(mesh: THREE.Mesh, section: SectionViewState): void {
    const position = mesh.userData.position as GridPosition;
    let keep = true;
    if (section.enabled) {
      if (section.axis === "x") {
        keep = section.keptSide === "positive" ? position.x >= section.coordinate : position.x <= section.coordinate;
      } else {
        keep = section.keptSide === "positive" ? position.z >= section.coordinate : position.z <= section.coordinate;
      }
    }
    mesh.visible = keep;
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button === 0 && document.pointerLockElement !== this.renderer.domElement) {
      this.player.requestPointerLock();
      return;
    }
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.updateRay(event);
    if (!this.targetPosition) return;

    if (event.button === 0) {
      const position = this.adjacentPosition();
      if (!position) return;
      const selected = (this.host.closest("[data-selected-block]") as HTMLElement | null)?.dataset.selectedBlock;
      const blockId = (selected || "grass") as BlockId;

      const tool = this.buildingTools.getTool();

      // Clear pending state for tools that are not currently selected.
      if (tool !== "line") this.lineStart = null;
      if (tool !== "fill") this.fillStart = null;

      if (tool === "line") {
        if (!this.lineStart) {
          this.lineStart = position;
          this.onMessage(`Line start set at (${position.x},${position.y},${position.z}). Click again to place line.`);
          return;
        }
        const count = this.buildingTools.placeLine(this.lineStart, position, blockId);
        this.lineStart = null;
        this.reloadFromWorld();
        this.onMessage(`Line placed: ${count} blocks.`);
        return;
      }

      if (tool === "fill") {
        if (!this.fillStart) {
          this.fillStart = position;
          this.onMessage(`Fill start set at (${position.x},${position.y},${position.z}). Click again to fill rectangle.`);
          return;
        }
        const count = this.buildingTools.fillRectangle(this.fillStart, position, blockId);
        this.fillStart = null;
        this.reloadFromWorld();
        this.onMessage(`Fill placed: ${count} blocks.`);
        return;
      }

      // Default: place a single block.
      this.addBlock(position, blockId);
    } else if (event.button === 2) {
      this.removeBlock(this.targetPosition);
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    this.updateRay(event);
  };

  private updateRay(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (document.pointerLockElement === this.renderer.domElement) {
      this.pointer.set(0, 0);
    } else {
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    }
    this.raycaster.setFromCamera(this.pointer, this.player.camera);
    const visibleMeshes = [...this.blockMeshes.values()].filter((mesh) => {
      const layerId = mesh.userData.layerId as string | undefined;
      if (!layerId) return true;
      return this.layerPlugin.isLayerEffectivelyVisible(layerId);
    });
    const targets = [...visibleMeshes, this.ground];
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) {
      this.targetPosition = null;
      this.outline.visible = false;
      return;
    }

    if (hit.object.userData.kind === "block") {
      const position = hit.object.userData.position as GridPosition;
      this.targetPosition = position;
      this.outline.position.set(position.x, position.y + 0.5, position.z);
      this.outline.visible = true;
    } else {
      const point = hit.point;
      this.targetPosition = {
        x: Math.floor(point.x + 0.5),
        y: 0,
        z: Math.floor(point.z + 0.5)
      };
      this.outline.position.set(this.targetPosition.x, 0.5, this.targetPosition.z);
      this.outline.visible = true;
    }
  }

  private adjacentPosition(): GridPosition | null {
    if (!this.targetPosition) return null;
    // Placement on a selected block uses the face normal cached by raycast.
    const visibleMeshes = [...this.blockMeshes.values()].filter((mesh) => {
      const layerId = mesh.userData.layerId as string | undefined;
      if (!layerId) return true;
      return this.layerPlugin.isLayerEffectivelyVisible(layerId);
    });
    const hit = this.raycaster.intersectObjects([...visibleMeshes, this.ground], false)[0];
    if (!hit) return null;
    if (hit.object.userData.kind === "ground") {
      return { x: this.targetPosition.x, y: 0, z: this.targetPosition.z };
    }
    const normal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
    if (!normal) return null;
    return {
      x: this.targetPosition.x + Math.round(normal.x),
      y: (this.targetPosition as GridPosition).y + Math.round(normal.y),
      z: this.targetPosition.z + Math.round(normal.z)
    };
  }

  private resize = (): void => {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.player.resize(width, height);
  };

  private animate = (time: number): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min((time - (this.previousTime || time)) / 1000, 0.05);
    this.previousTime = time;
    this.player.update(delta);
    this.renderer.render(this.scene, this.player.camera);
  };

  reset(): void {
    for (const record of this.world.all()) {
      const mesh = this.blockMeshes.get(this.key(record.position));
      if (mesh) this.scene.remove(mesh);
    }
    this.world.clear();
    this.blockMeshes.clear();
    this.targetPosition = null;
    this.outline.visible = false;
    this.seedWorld();
    this.player.reset();
    this.onMessage("World reset.");
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    this.renderer.domElement.removeEventListener("contextmenu", this.preventContextMenu);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.player.dispose();
    this.unsubscribeLayerEvents.forEach((unsub) => unsub());
    if (import.meta.env.DEV) delete (window as Window & { __CASTLE_TEST__?: unknown }).__CASTLE_TEST__;
    this.scene.remove(this.ground, this.grid, this.outline);
    this.groundGeometry.dispose();
    this.groundMaterial.dispose();
    this.grid.geometry.dispose();
    this.disposeMaterial(this.grid.material);
    this.outline.geometry.dispose();
    this.disposeMaterial(this.outline.material);
    this.geometry.dispose();
    this.materials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.host.removeChild(this.renderer.domElement);
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
  }
}
