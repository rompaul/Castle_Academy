import type { GridPosition } from "../../core/world/coordinates";
import type { LayerDefinition, LayerState } from "./LayerTypes";

/**
 * 图层规则纯函数（V0.4）。
 *
 * 不依赖 Three.js/React/DOM，仅对坐标、层定义和层状态进行只读判断。
 * 有效可见性规则：基础可见性（用户勾选）AND 视图模式过滤。
 */

export interface LayerRulesContext {
  definitions: Map<string, LayerDefinition>;
  state: LayerState;
}

/**
 * 根据 y 坐标解析到所属图层 id。
 * 不在任何层范围内时返回 undefined。
 */
export function resolveLayerId(
  y: number,
  definitions: Map<string, LayerDefinition>
): string | undefined {
  for (const def of definitions.values()) {
    if (y >= def.minY && y < def.maxYExclusive) {
      return def.id;
    }
  }
  return undefined;
}

/**
 * 判断指定图层是否可见。
 * visibilityByLayer 缺少某 ID 时使用 LayerDefinition.defaultVisible。
 */
export function isLayerVisible(
  layerId: string,
  context: LayerRulesContext
): boolean {
  const { definitions, state } = context;
  const def = definitions.get(layerId);
  if (!def) return false;
  const userVisible = state.visibilityByLayer[layerId] ?? def.defaultVisible;
  return userVisible && isLayerVisibleByViewMode(layerId, state.activeLayerId, state.viewMode, definitions);
}

/**
 * 根据视图模式判断图层是否可见。
 */
function isLayerVisibleByViewMode(
  layerId: string,
  activeLayerId: string,
  mode: LayerState["viewMode"],
  definitions: Map<string, LayerDefinition>
): boolean {
  const def = definitions.get(layerId);
  if (!def) return false;

  switch (mode.type) {
    case "all":
      return true;
    case "above-ground":
      return def.minY >= 0;
    case "underground":
      return def.maxYExclusive <= 0;
    case "current-layer":
      return layerId === activeLayerId;
    case "custom":
      return true;
    default:
      return false;
  }
}

/**
 * 判断指定位置是否可见（结合层可见性和视图模式）。
 * 不在任何层范围内的位置返回 false。
 */
export function isPositionVisible(
  position: GridPosition,
  context: LayerRulesContext
): boolean {
  const { definitions } = context;
  const layerId = resolveLayerId(position.y, definitions);
  if (!layerId) return false;
  return isLayerVisible(layerId, context);
}

/**
 * 计算当前视图模式下所有可见图层的 id 集合。
 */
export function getVisibleLayerIds(context: LayerRulesContext): string[] {
  const { definitions } = context;
  const visible: string[] = [];
  for (const def of definitions.values()) {
    if (isLayerVisible(def.id, context)) {
      visible.push(def.id);
    }
  }
  return visible;
}
