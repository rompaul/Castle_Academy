/**
 * V0.4 空间与图层数据合同（CA-TECH-003 / ADR-0004）。
 *
 * 定义多层建筑与地下空间的图层模型、视图模式和剖面状态。
 * 图层是“视图与组织维度”，不是另一份方块数据库；WorldState  remains
 * 唯一的方块位置与 blockId 事实源。
 */

/** 图层种类 */
export type LayerKind =
  | "ground-floor"
  | "upper-floor"
  | "basement"
  | "foundation"
  | "passage";

/** 单个图层定义：Y 范围（minY 包含，maxYExclusive 不含）与可见/可建造属性。 */
export interface LayerDefinition {
  id: string;
  label: string;
  kind: LayerKind;
  minY: number;          // inclusive integer
  maxYExclusive: number; // exclusive integer
  order: number;
  defaultVisible: boolean;
  buildable: boolean;
}

/** 视图模式：全显 / 仅地上 / 仅地下 / 仅当前层 / 自定义勾选组合。 */
export type ViewMode =
  | { type: "all" }
  | { type: "above-ground" }
  | { type: "underground" }
  | { type: "current-layer" }
  | { type: "custom" };

/** 图层运行时状态：当前活动层、各层可见性、当前视图模式。 */
export interface LayerState {
  activeLayerId: string;
  visibilityByLayer: Record<string, boolean>;
  viewMode: ViewMode;
  section: SectionViewState;
}

/** 剖面轴：X、Y 或 Z 轴对齐切面。 */
export type SectionAxis = "x" | "y" | "z";

/** 剖面保留侧：正侧或负侧，另一侧从视图与射线命中中隐藏。 */
export type SectionKeptSide = "positive" | "negative";

/** 剖面视图状态：启停、轴、网格位置（整数体素边界）、保留方向。 */
export interface SectionViewState {
  enabled: boolean;
  axis: SectionAxis;
  coordinate: number; // integer voxel boundary
  keptSide: SectionKeptSide;
}
