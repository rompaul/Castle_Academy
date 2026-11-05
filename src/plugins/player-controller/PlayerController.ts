import * as THREE from "three";
import type { WorldState } from "../../core/world/WorldState";

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export const PLAYER_RADIUS = 0.28;
export const PLAYER_EYE_HEIGHT = 1.65;
const PLAYER_HEAD_CLEARANCE = 0.15;
const MIN_XZ = -15.5;
const MAX_XZ = 15.5;

/** Pure horizontal circle-vs-voxel-AABB overlap used by the controller and tests. */
export function circleIntersectsBlock(x: number, z: number, radius: number, blockX: number, blockZ: number): boolean {
  const closestX = THREE.MathUtils.clamp(x, blockX - 0.5, blockX + 0.5);
  const closestZ = THREE.MathUtils.clamp(z, blockZ - 0.5, blockZ + 0.5);
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

export function playerIntersectsBlock(
  x: number, eyeY: number, z: number,
  blockX: number, blockY: number, blockZ: number
): boolean {
  const feetY = eyeY - PLAYER_EYE_HEIGHT;
  const headY = eyeY + PLAYER_HEAD_CLEARANCE;
  const verticalOverlap = feetY < blockY + 1 && headY > blockY;
  return verticalOverlap && circleIntersectsBlock(x, z, PLAYER_RADIUS, blockX, blockZ);
}

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = -0.18;
  private pointerLocked = false;
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022, -1.45, 1.45);
  };

  constructor(
    private readonly domElement: HTMLElement,
    private readonly world: WorldState,
    private readonly onMessage: (message: string) => void,
    start = new THREE.Vector3(0, 2.2, 7)
  ) {
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 150);
    this.camera.position.copy(start);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    this.updateLook();
  }

  private readonly onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  };

  requestPointerLock(): void {
    try {
      const result: unknown = this.domElement.requestPointerLock();
      if (result && typeof (result as Promise<void>).catch === "function") {
        void (result as Promise<void>).catch(() => this.onMessage("Mouse capture was blocked. Click the world to try again."));
      }
    } catch {
      this.onMessage("Mouse capture is unavailable. Try clicking the world again or use a supported desktop browser.");
    }
  }

  update(deltaSeconds: number): void {
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.05);
    if (dt === 0) return;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const direction = new THREE.Vector3();
    if (this.keys.has("KeyW")) direction.add(forward);
    if (this.keys.has("KeyS")) direction.sub(forward);
    if (this.keys.has("KeyD")) direction.add(right);
    if (this.keys.has("KeyA")) direction.sub(right);
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = this.keys.has("ShiftLeft") ? 9 : 5.5;
      const distance = speed * dt;
      this.tryMoveHorizontal(direction.x * distance, direction.z * distance);
    }

    const verticalSpeed = (this.keys.has("Space") ? 1 : 0) -
      (this.keys.has("ControlLeft") || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 1 : 0);
    if (verticalSpeed !== 0) this.tryMoveVertical(verticalSpeed * (this.keys.has("ShiftLeft") ? 9 : 5.5) * dt);
    this.updateLook();
  }

  private tryMoveHorizontal(dx: number, dz: number): void {
    const p = this.camera.position;
    const nextX = THREE.MathUtils.clamp(p.x + dx, MIN_XZ, MAX_XZ);
    if (!this.collides(nextX, p.y, p.z)) p.x = nextX;
    const nextZ = THREE.MathUtils.clamp(p.z + dz, MIN_XZ, MAX_XZ);
    if (!this.collides(p.x, p.y, nextZ)) p.z = nextZ;
  }

  private tryMoveVertical(dy: number): void {
    const nextY = THREE.MathUtils.clamp(this.camera.position.y + dy, PLAYER_EYE_HEIGHT, 24);
    if (!this.collides(this.camera.position.x, nextY, this.camera.position.z)) this.camera.position.y = nextY;
  }

  private collides(x: number, eyeY: number, z: number): boolean {
    return this.world.all().some((block) => playerIntersectsBlock(
      x, eyeY, z, block.position.x, block.position.y, block.position.z
    ));
  }

  private updateLook(): void {
    const direction = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.camera.lookAt(this.camera.position.clone().add(direction));
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.keys.clear();
    this.camera.position.set(0, 2.2, 7);
    this.yaw = 0;
    this.pitch = -0.18;
    this.updateLook();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }
}
