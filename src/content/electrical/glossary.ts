/**
 * V061-022 — 「电」术语表、6 类状态消息与安全文案（ADR-0013 / LEARNING_ACTIVITIES_SPEC §2/§3）。
 *
 * 纯数据模块：无副作用、不 import 运行时插件 / 渲染 / DOM。
 * 所有儿童可见文案统一「电」的命名（PD-013），不含等级 / 难度 / 年级 / 百分比标签，
 * 不含真实电气数值与可迁移到现实的操作步骤。
 * 三条安全文案经 owner（家长视角）于 2026-11-13 STOP GATE-1 审校通过，逐字不得改写。
 */

/** 儿童可见对象名（E1 热栏与任务文案的唯一来源）。 */
export const ELECTRICAL_CHILD_TERMS = Object.freeze({
  source: "电源",
  wire: "电线",
  switchOpen: "开关（断开）",
  switchClosed: "开关（合上）",
  lamp: "灯",
  beacon: "信标",
  pump: "水泵",
  valveOpen: "阀门（开）",
  valveClosed: "阀门（闭）"
} as const);

export type ElectricalStatusKey =
  | "powered"
  | "no-connection"
  | "switch-open"
  | "source-conflict"
  | "pump-not-powered"
  | "valve-closed";

/**
 * AC-6736：6 类状态消息齐全且互斥。图标 / 形状 + 文字并置，不只靠颜色（AC-6735）。
 * 文案逐字取自规格 §2「状态」允许列；其中「水泵没通电」「阀门关着」为任务 C 的诊断态。
 */
export const ELECTRICAL_STATUS_MESSAGES: Readonly<Record<ElectricalStatusKey, Readonly<{ icon: string; label: string }>>> =
  Object.freeze({
    powered: Object.freeze({ icon: "●", label: "通电了" }),
    "no-connection": Object.freeze({ icon: "○", label: "还没接通" }),
    "switch-open": Object.freeze({ icon: "◐", label: "开关断开" }),
    "source-conflict": Object.freeze({ icon: "◈", label: "电源冲突" }),
    "pump-not-powered": Object.freeze({ icon: "◇", label: "水泵没通电" }),
    "valve-closed": Object.freeze({ icon: "▣", label: "阀门关着" })
  });

/** 安全文案三条（R-628）：首次引导、帮助面板常驻、家长 / 教师说明。 */
export const ELECTRICAL_SAFETY_TEXTS = Object.freeze({
  firstGuide: "城堡里的电是游戏里的规则；现实里的电很危险，不要碰插座和电线。",
  helpPersistent: "城堡里的电只玩通和断，不学真实接线。现实里的电很危险，不要碰插座和电线。",
  parentTeacher: "本产品为虚构二值规则模型，不含真实电气知识，也不含任何可迁移到现实的操作步骤。建议成人陪同低龄儿童使用。"
} as const);

/**
 * 禁用词表（AC-6745/6747）：儿童可见的**对象名 / 机制词 / 任务文案 / 状态消息**零命中。
 * 注意：三条安全文案为 owner 审校通过的警示语句，必须逐字含「插座和电线」，
 * 因此扫描时单独豁免（见 `glossary.test.ts`），不得把警示语改写成不含警示对象的表述。
 */
export const ELECTRICAL_BANNED_WORDS: readonly string[] = Object.freeze([
  "红石", "Redstone", "redstone", "信号强度", "充能", "中继", "逻辑门",
  "电压", "电流", "电阻", "短路", "串联", "并联", "衰减",
  "插座", "家用布线", "能量石", "导能管", "信号石"
]);

/** 低龄档（6–7）不主动提的机制词；11+ 档的诊断文案也仍避免使用。 */
export const LOW_AGE_ONLY_TERMS: readonly string[] = Object.freeze(["回路"]);
