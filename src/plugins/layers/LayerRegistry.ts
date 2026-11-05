import type { LayerDefinition } from "./LayerTypes";

/**
 * 图层注册表（V0.4）。
 *
 * 管理图层定义的注册与校验：
 * - Layer ID 全局唯一
 * - 不同 Layer 的 Y 范围不得重叠
 * - minY 必须小于 maxYExclusive
 * - 必须存在至少一个默认层（首个注册的层）
 *
 * 纯数据层，不依赖 Three.js/React/DOM。
 */
export class LayerRegistry {
  private readonly layers = new Map<string, LayerDefinition>();
  private defaultLayerId: string | null = null;

  /** 注册图层定义。违反唯一性/不重叠/有效范围时抛出错误。 */
  register(definition: LayerDefinition): void {
    if (definition.minY >= definition.maxYExclusive) {
      throw new Error(
        `Invalid layer range: minY ${definition.minY} must be less than maxYExclusive ${definition.maxYExclusive}`
      );
    }
    if (this.layers.has(definition.id)) {
      throw new Error(`Duplicate layer id: ${definition.id}`);
    }
    for (const existing of this.layers.values()) {
      if (definition.minY < existing.maxYExclusive && existing.minY < definition.maxYExclusive) {
        throw new Error(
          `Layer range overlaps with existing layer: ${existing.id} [${existing.minY}, ${existing.maxYExclusive})`
        );
      }
    }
    this.layers.set(definition.id, definition);
    if (this.defaultLayerId === null) {
      this.defaultLayerId = definition.id;
    }
  }

  /** 按 id 查找图层，不存在返回 undefined。 */
  get(id: string): LayerDefinition | undefined {
    return this.layers.get(id);
  }

  /** 是否存在指定 id 的图层。 */
  has(id: string): boolean {
    return this.layers.has(id);
  }

  /** 获取所有图层，按 order 升序排列。 */
  getAll(): LayerDefinition[] {
    return [...this.layers.values()].sort((a, b) => a.order - b.order);
  }

  /** 获取默认层 id（首个注册的层）。无图层时返回 null。 */
  getDefaultLayerId(): string | null {
    return this.defaultLayerId;
  }

  /** 根据 y 坐标解析到所属图层 id。不在任何层范围内时返回 undefined。 */
  resolveLayerId(y: number): string | undefined {
    for (const def of this.layers.values()) {
      if (y >= def.minY && y < def.maxYExclusive) {
        return def.id;
      }
    }
    return undefined;
  }

  /** 更新图层定义（不允许改 id）。违反校验时抛出错误。 */
  update(id: string, partial: Partial<Omit<LayerDefinition, "id">>): void {
    const existing = this.layers.get(id);
    if (!existing) {
      throw new Error(`Layer not found: ${id}`);
    }
    const merged: LayerDefinition = { ...existing, ...partial };
    if (merged.minY >= merged.maxYExclusive) {
      throw new Error(
        `Invalid layer range: minY ${merged.minY} must be less than maxYExclusive ${merged.maxYExclusive}`
      );
    }
    for (const other of this.layers.values()) {
      if (other.id === id) continue;
      if (merged.minY < other.maxYExclusive && other.minY < merged.maxYExclusive) {
        throw new Error(
          `Layer range overlaps with existing layer: ${other.id} [${other.minY}, ${other.maxYExclusive})`
        );
      }
    }
    this.layers.set(id, merged);
  }

  /** 移除图层。不能移除唯一层或默认层。 */
  remove(id: string): void {
    if (!this.layers.has(id)) {
      throw new Error(`Layer not found: ${id}`);
    }
    if (this.layers.size === 1) {
      throw new Error("Cannot remove the only layer");
    }
    if (id === this.defaultLayerId) {
      throw new Error(`Cannot remove the default layer: ${id}`);
    }
    this.layers.delete(id);
  }
}
