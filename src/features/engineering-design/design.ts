/**
 * V0.7.1 P2 — 桥梁设计纯函数（BR-01~BR-08）。
 *
 * 不读 DOM / 时间 / 随机 / localStorage / WorldSnapshot；同一输入必得同一输出。
 * UI 只展示这里的结果，不自行保存另一份可编辑的计算副本。
 */
import type { BlockId } from "../../core/world/blocks";
import type { GridPosition } from "../../core/world/coordinates";
import type {
  BridgeBlueprint,
  BridgeCell,
  BridgeDesignComputed,
  BridgeDesignInput,
  BridgeScenario,
  ConstructionEvidence,
  DesignIssue,
  DesignValidationResult
} from "./types";

/** 有效网格计数：正整数且有限；非整数 / NaN / 负数一律无效。 */
export function isValidGridCount(value: number): boolean {
  return Number.isInteger(value) && value > 0 && Number.isFinite(value);
}

/**
 * 由河宽和桥长反推搭接。右岸搭接固定，左岸搭接 = 桥长 - 河宽 - 右岸搭接。
 * 这样桥的右端始终落在 rightBankX，合法长度 8~10 都不会越出世界边界。
 */
export function deriveLeftLanding(scenario: BridgeScenario, input: BridgeDesignInput): number {
  return input.deckLength - input.measuredRiverSpan - scenario.rightLanding;
}

export function computeBridgeDesign(
  scenario: BridgeScenario,
  input: BridgeDesignInput
): BridgeDesignComputed {
  const leftLanding = deriveLeftLanding(scenario, input);
  const deckArea = input.deckLength * input.deckWidth;
  const requiredPlanks = deckArea * scenario.planksPerCell;
  // 最小桥长 = 河宽 + 左岸至少 1 格 + 右岸固定搭接；不是学习者当前选择的桥长。
  const requiredDeckLength =
    input.measuredRiverSpan + 1 + scenario.rightLanding;
  return {
    requiredDeckLength,
    leftLanding,
    rightLanding: scenario.rightLanding,
    deckArea,
    requiredPlanks,
    availablePlanks: scenario.materialBudget,
    remainingPlanks: scenario.materialBudget - requiredPlanks
  };
}

function issue(
  code: string,
  messageKey: string,
  relatedField?: string,
  severity: DesignIssue["severity"] = "error"
): DesignIssue {
  return relatedField
    ? { code, severity, messageKey, relatedField }
    : { code, severity, messageKey };
}

/** BR-01~BR-08：失败提示只给 messageKey，文案由内容包映射。 */
export function validateBridgeDesign(
  scenario: BridgeScenario,
  input: BridgeDesignInput
): DesignValidationResult {
  const issues: DesignIssue[] = [];
  const computed = computeBridgeDesign(scenario, input);
  const [minLength, maxLength] = scenario.deckLengthRange;
  const [minWidth, maxWidth] = scenario.deckWidthRange;

  // BR-01 有效测量值必须存在且大于 0
  if (!isValidGridCount(input.measuredRiverSpan)) {
    issues.push(issue("BR-01", "BR-01", "measuredRiverSpan"));
  } else if (input.measuredRiverSpan !== scenario.riverSpan) {
    // 有效但不是本施工点的河宽：仍可用于计算，但给出可定位的提醒。
    issues.push(issue("BR-01", "BR-01", "measuredRiverSpan", "warning"));
  }

  // BR-02 桥长 ≥ 河宽 + 左右搭接
  if (isValidGridCount(input.deckLength)
    && input.deckLength < computed.requiredDeckLength) {
    issues.push(issue("BR-02", "BR-02", "deckLength"));
  }

  // BR-03 桥宽 ≥ 最小宽度
  if (isValidGridCount(input.deckWidth) && input.deckWidth < scenario.minDeckWidth) {
    issues.push(issue("BR-03", "BR-03", "deckWidth"));
  }

  // BR-04 桥长范围与整数性
  if (!isValidGridCount(input.deckLength)
    || input.deckLength < minLength || input.deckLength > maxLength) {
    issues.push(issue("BR-04", "BR-04", "deckLength"));
  }

  // BR-05 桥宽范围与整数性
  if (!isValidGridCount(input.deckWidth)
    || input.deckWidth < minWidth || input.deckWidth > maxWidth) {
    issues.push(issue("BR-05", "BR-05", "deckWidth"));
  }

  // BR-06 材料预算
  if (computed.requiredPlanks > scenario.materialBudget) {
    issues.push(issue("BR-06", "BR-06", "deckWidth"));
  }

  // BR-07 蓝图格子连续：生成的矩形蓝图不允许缺格。
  const blueprint = createBridgeBlueprint(scenario, input, "validation-probe");
  if (!isBlueprintContinuous(blueprint)) {
    issues.push(issue("BR-07", "BR-07"));
  }

  // BR-08 两端搭接区必须覆盖指定岸边格
  if (computed.leftLanding < 1 || computed.rightLanding < 1
    || !coversBothBanks(scenario, blueprint)) {
    issues.push(issue("BR-08", "BR-08"));
  }

  const hasError = issues.some((item) => item.severity === "error");
  return { passed: !hasError, issues };
}

/** 生成矩形桥面蓝图；每个目标格只记录相对坐标与材料 ID。 */
export function createBridgeBlueprint(
  scenario: BridgeScenario,
  input: BridgeDesignInput,
  blueprintId: string
): BridgeBlueprint {
  const leftLanding = deriveLeftLanding(scenario, input);
  const origin: GridPosition = {
    x: scenario.riverMinX - leftLanding,
    y: scenario.deckY,
    z: scenario.deckZStart
  };
  const cells: BridgeCell[] = [];
  if (isValidGridCount(input.deckLength) && isValidGridCount(input.deckWidth)) {
    for (let dx = 0; dx < input.deckLength; dx++) {
      for (let dz = 0; dz < input.deckWidth; dz++) {
        cells.push({ dx, dy: 0, dz, materialBlockId: input.materialBlockId });
      }
    }
  }
  return Object.freeze({
    blueprintId,
    scenarioId: scenario.scenarioId,
    origin,
    orientation: scenario.orientation,
    deckLength: input.deckLength,
    deckWidth: input.deckWidth,
    materialBlockId: input.materialBlockId,
    requiredCells: Object.freeze(cells)
  });
}

/** 目标格 → 世界坐标的唯一映射入口；UI 不得自行拼接坐标。 */
export function cellWorldPosition(
  blueprint: BridgeBlueprint,
  cell: BridgeCell
): GridPosition {
  return {
    x: blueprint.origin.x + cell.dx,
    y: blueprint.origin.y + cell.dy,
    z: blueprint.origin.z + cell.dz
  };
}

/** 当前设计在局部地图 / 世界中的矩形边界（纯派生，不另存状态）。 */
export function bridgeDeckBounds(
  scenario: BridgeScenario,
  computed: BridgeDesignComputed,
  input: BridgeDesignInput
): Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }> {
  const minX = scenario.riverMinX - computed.leftLanding;
  return Object.freeze({
    minX,
    maxX: minX + input.deckLength - 1,
    minZ: scenario.deckZStart,
    maxZ: scenario.deckZStart + input.deckWidth - 1
  });
}

/** 矩形桥面不允许缺格；同时检查相对坐标无重复。 */
export function isBlueprintContinuous(blueprint: BridgeBlueprint): boolean {
  const seen = new Set<string>();
  for (const cell of blueprint.requiredCells) {
    const key = `${cell.dx},${cell.dy},${cell.dz}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  for (let dx = 0; dx < blueprint.deckLength; dx++) {
    for (let dz = 0; dz < blueprint.deckWidth; dz++) {
      if (!seen.has(`${dx},0,${dz}`)) return false;
    }
  }
  return seen.size === blueprint.deckLength * blueprint.deckWidth;
}

/** 蓝图是否真的覆盖河槽两岸各至少一格。 */
export function coversBothBanks(
  scenario: BridgeScenario,
  blueprint: BridgeBlueprint
): boolean {
  const minX = blueprint.origin.x;
  const maxX = blueprint.origin.x + blueprint.deckLength - 1;
  const minZ = blueprint.origin.z;
  const maxZ = blueprint.origin.z + blueprint.deckWidth - 1;
  const overlapsRiverZ = maxZ >= scenario.riverMinZ && minZ <= scenario.riverMaxZ;
  return overlapsRiverZ
    && minX <= scenario.riverMinX - 1
    && maxX >= scenario.riverMaxX + 1;
}

/** 施工证据：evaluator 只读，不自行查 WorldState。 */
export function createConstructionEvidence(
  blueprint: BridgeBlueprint,
  blockAt: (position: GridPosition) => BlockId | undefined
): ConstructionEvidence {
  const missingCells: Array<{ dx: number; dz: number }> = [];
  const invalidMaterialCells: Array<{ dx: number; dz: number }> = [];
  let placedRequiredCells = 0;

  for (const cell of blueprint.requiredCells) {
    const position = cellWorldPosition(blueprint, cell);
    const actual = blockAt(position);
    if (actual === undefined) {
      missingCells.push({ dx: cell.dx, dz: cell.dz });
    } else if (actual !== cell.materialBlockId) {
      invalidMaterialCells.push({ dx: cell.dx, dz: cell.dz });
    } else {
      placedRequiredCells++;
    }
  }

  return Object.freeze({
    blueprintId: blueprint.blueprintId,
    placedRequiredCells,
    totalRequiredCells: blueprint.requiredCells.length,
    missingCells: Object.freeze(missingCells),
    invalidMaterialCells: Object.freeze(invalidMaterialCells)
  });
}

/** 纯函数：蓝图格是否全部由正确材料完成。 */
export function isConstructionComplete(evidence: ConstructionEvidence): boolean {
  return evidence.totalRequiredCells > 0
    && evidence.placedRequiredCells === evidence.totalRequiredCells
    && evidence.missingCells.length === 0
    && evidence.invalidMaterialCells.length === 0;
}
