import type { GridPosition } from "../../core/world/coordinates";

export type MeasurementType = "distance" | "area" | "volume";

export interface MeasurementResult {
  type: MeasurementType;
  value: number;
  unit: string;
  detail: string;
}

export interface MeasurementChallenge {
  type: MeasurementType;
  target: number;
  tolerance?: number;
  description?: string;
}

/**
 * Measurement plugin (V0.3).
 *
 * Computes distance, area, and volume between grid positions, and supports
 * pass/fail challenges against a target value. All calculations are pure
 * functions of coordinates — no world state mutation, no rendering dependency.
 *
 * Lifecycle: register() → initialize() → activate() → deactivate() → dispose().
 */
export class MeasurementPlugin {
  readonly id = "measurement";
  readonly name = "Measurement";
  readonly version = "0.3.0";

  private challenge?: MeasurementChallenge;

  constructor() {}

  register(): void {
    // No external dependencies to wire up.
  }

  initialize(): void {
    // Nothing async to prepare.
  }

  activate(): void {
    // Measurement calculations are pure and always available.
  }

  deactivate(): void {
    this.challenge = undefined;
  }

  dispose(): void {
    this.deactivate();
  }

  /* ---------- Measurements ---------- */

  /** Euclidean distance between two grid positions (in blocks). */
  measureDistance(a: GridPosition, b: GridPosition): MeasurementResult {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const value = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      type: "distance",
      value,
      unit: "blocks",
      detail: `(${a.x},${a.y},${a.z}) → (${b.x},${b.y},${b.z})`,
    };
  }

  /** Area of an axis-aligned rectangle on the XZ plane (in square blocks). */
  measureArea(min: GridPosition, max: GridPosition): MeasurementResult {
    const lo = cornerMin(min, max);
    const hi = cornerMax(min, max);
    const width = hi.x - lo.x + 1;
    const depth = hi.z - lo.z + 1;
    const value = width * depth;
    return {
      type: "area",
      value,
      unit: "square blocks",
      detail: `${width} × ${depth} at y=${lo.y}..${hi.y}`,
    };
  }

  /** Volume of an axis-aligned box (in cubic blocks). */
  measureVolume(min: GridPosition, max: GridPosition): MeasurementResult {
    const lo = cornerMin(min, max);
    const hi = cornerMax(min, max);
    const width = hi.x - lo.x + 1;
    const height = hi.y - lo.y + 1;
    const depth = hi.z - lo.z + 1;
    const value = width * height * depth;
    return {
      type: "volume",
      value,
      unit: "cubic blocks",
      detail: `${width} × ${height} × ${depth}`,
    };
  }

  /* ---------- Challenges ---------- */

  /** Set (or clear, when undefined) the active measurement challenge. */
  setChallenge(challenge: MeasurementChallenge | undefined): void {
    this.challenge = challenge;
  }

  /** Get the currently active challenge, if any. */
  getChallenge(): MeasurementChallenge | undefined {
    return this.challenge;
  }

  /**
   * Check a measurement result against the active challenge.
   * Returns { passed, result, message }.
   */
  checkChallenge(result: MeasurementResult): {
    passed: boolean | null;
    result: MeasurementResult;
    message: string;
  } {
    if (!this.challenge) {
      return { passed: null, result, message: "No active challenge." };
    }
    if (this.challenge.type !== result.type) {
      return {
        passed: false,
        result,
        message: `Challenge expects ${this.challenge.type}, measured ${result.type}.`,
      };
    }
    const tolerance = this.challenge.tolerance ?? 0;
    const passed = Math.abs(result.value - this.challenge.target) <= tolerance;
    const message = passed
      ? `Challenge complete: ${result.value} ${result.unit} (target ${this.challenge.target}).`
      : `Not yet: measured ${result.value.toFixed(2)} ${result.unit}, target ${this.challenge.target}${tolerance > 0 ? ` ±${tolerance}` : ""}.`;
    return { passed, result, message };
  }

  /** Clear the active challenge. */
  clearChallenge(): void {
    this.challenge = undefined;
  }
}

/* ---------- Helpers ---------- */

function cornerMin(a: GridPosition, b: GridPosition): GridPosition {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    z: Math.min(a.z, b.z),
  };
}

function cornerMax(a: GridPosition, b: GridPosition): GridPosition {
  return {
    x: Math.max(a.x, b.x),
    y: Math.max(a.y, b.y),
    z: Math.max(a.z, b.z),
  };
}
