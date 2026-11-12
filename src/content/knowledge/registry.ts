/**
 * V0.6 知识点 Registry（ADR-0008，Approved 2026-11-12，基线 768769b）。
 *
 * 纯数据模块：无副作用、不 import 运行时插件、不持有学习者状态。
 * ID 格式 `kp.<domain>.<concept>.<aspect>`（冻结正则见 KNOWLEDGE_POINT_ID_PATTERN；
 * 允许 3~4 段、段内下划线/连字符 —— 依据 owner 已批准的 19 个 ID 实际形态，
 * ADR-0008 建议正则的 4 段限制与其批准 ID 矛盾，实现期按 ADR「正则实现期冻结」条款定案）。
 *
 * 不可变性：ID 发布后只能追加或标 deprecated，不重命名、不删除（ADR-0008 决策 6）。
 * `kp.electric.*` 本版仅预留前缀，不注册具体点（ADR-0008 决策 3）。
 * 儿童可见字段（label/summary）不含等级、难度、年级或掌握状态词（ADR-0008 决策 7）。
 */

export interface KnowledgePointDefinition {
  /** 稳定 ID：kp.<domain>.<concept>(.<aspect>)，发布后不可变更 */
  readonly id: string;
  /** 儿童可见短名，平实语言 */
  readonly label: string;
  /** 儿童可见一句话说明 */
  readonly summary: string;
  /** 领域段（从 ID 拆出，便于聚合） */
  readonly domain: string;
  /** 概念段 */
  readonly concept: string;
  /** 侧面段（3 段 ID 为空字符串） */
  readonly aspect: string;
  /** 仅允许 active / deprecated，不提供删除 */
  readonly status: 'active' | 'deprecated';
}

/**
 * 冻结的 ID 正则：全小写、点分段、3~4 段、段内下划线或连字符。
 * 例：kp.water.flow.range / kp.system.continuous_path
 */
export const KNOWLEDGE_POINT_ID_PATTERN =
  /^kp\.[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,2}$/;

/** 本版预留、不注册的领域前缀（V0.6.1 电力直接引用，避免届时重命名） */
export const RESERVED_KNOWLEDGE_POINT_DOMAIN_PREFIXES: readonly string[] = [
  'kp.electric.',
];

/**
 * 已注册知识点（owner 签核清单，来源 docs/v0.6/audit/V06_MISSION_AND_EVALUATOR_ID_MAP.md §4；
 * 去重后 19 个唯一 ID，映射表标注「21 个」为跨任务复用重复计数，偏差已在任务报告登记）。
 */
export const KNOWLEDGE_POINTS: readonly KnowledgePointDefinition[] = [
  {
    id: 'kp.water.flow.range',
    label: '水流范围',
    summary: '水从高处往低处流，流动的范围是有限的。',
    domain: 'water',
    concept: 'flow',
    aspect: 'range',
    status: 'active',
  },
  {
    id: 'kp.system.continuous_path',
    label: '连通路径',
    summary: '水要流过去，整条路径需要一路连通。',
    domain: 'system',
    concept: 'continuous_path',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.water.gravity.downhill',
    label: '水往低处流',
    summary: '没有东西挡住时，水总是往更低的地方流。',
    domain: 'water',
    concept: 'gravity',
    aspect: 'downhill',
    status: 'active',
  },
  {
    id: 'kp.engineering.design_loop',
    label: '设计—尝试—改进',
    summary: '先想一个办法，试一试，再把它变得更好。',
    domain: 'engineering',
    concept: 'design_loop',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.water.barrier.redirect',
    label: '改变水的去向',
    summary: '用障碍物可以挡住水，让水流到别的方向。',
    domain: 'water',
    concept: 'barrier',
    aspect: 'redirect',
    status: 'active',
  },
  {
    id: 'kp.reasoning.cause_effect',
    label: '原因和结果',
    summary: '一件事发生了，会带来另一件事的变化。',
    domain: 'reasoning',
    concept: 'cause_effect',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.water.surface.support',
    label: '水面托住',
    summary: '水能停住并托住放在它上面的东西。',
    domain: 'water',
    concept: 'surface',
    aspect: 'support',
    status: 'active',
  },
  {
    id: 'kp.measurement.counting',
    label: '数一数',
    summary: '用数数的方法知道有多少。',
    domain: 'measurement',
    concept: 'counting',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.water.channel.absorb',
    label: '引导和挡住',
    summary: '渠能把水引到需要的地方，坝能把水挡住。',
    domain: 'water',
    concept: 'channel',
    aspect: 'absorb',
    status: 'active',
  },
  {
    id: 'kp.experiment.control',
    label: '一次只改一件事',
    summary: '比较的时候，一次只改一个地方，才能知道是什么在起作用。',
    domain: 'experiment',
    concept: 'control',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.engineering.planning',
    label: '先想后做',
    summary: '动手之前，先想清楚需要什么、按什么顺序做。',
    domain: 'engineering',
    concept: 'planning',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.reasoning.diagnosis',
    label: '找出问题在哪',
    summary: '顺着水流一段一段查，找到出问题的地方。',
    domain: 'reasoning',
    concept: 'diagnosis',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.measurement.volume_units',
    label: '容量单位',
    summary: '用一样大的格子量水，数格子就知道装了多少。',
    domain: 'measurement',
    concept: 'volume_units',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.geometry.axis_symmetry',
    label: '对称',
    summary: '沿一条线对折，两边能重合的形状就是对称的。',
    domain: 'geometry',
    concept: 'axis_symmetry',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.measurement.height',
    label: '量高度',
    summary: '用统一的单位比较东西有多高。',
    domain: 'measurement',
    concept: 'height',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.spatial.section_view',
    label: '剖面看结构',
    summary: '从侧面切开看，能发现从外面看不到的结构。',
    domain: 'spatial',
    concept: 'section_view',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.spatial.underground',
    label: '地下空间',
    summary: '地面下面也可以有安排好的空间和通道。',
    domain: 'spatial',
    concept: 'underground',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.arithmetic.partition',
    label: '分一分',
    summary: '把一个总数拆成几份，合起来还是原来的数。',
    domain: 'arithmetic',
    concept: 'partition',
    aspect: '',
    status: 'active',
  },
  {
    id: 'kp.communication.explain_reason',
    label: '说出理由',
    summary: '把自己的想法和为什么这样做讲给别人听。',
    domain: 'communication',
    concept: 'explain_reason',
    aspect: '',
    status: 'active',
  },
];

export type KnowledgePointValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};

/** 结构化校验单个知识点定义（ADR-0008 决策 4）；不抛错，返回结构化结果 */
export function validateKnowledgePoint(
  kp: KnowledgePointDefinition
): KnowledgePointValidationResult {
  const errors: string[] = [];

  if (!KNOWLEDGE_POINT_ID_PATTERN.test(kp.id)) {
    errors.push(
      `id "${kp.id}" 不符合冻结正则 ${KNOWLEDGE_POINT_ID_PATTERN.source}`
    );
  }

  const segments = kp.id.split('.');
  if (segments.length < 3 || segments.length > 4) {
    errors.push(`id "${kp.id}" 必须为 3~4 段`);
  } else {
    const [, domain, concept, aspect = ''] = segments;
    if (kp.domain !== domain) {
      errors.push(`domain "${kp.domain}" 与 id 段 "${domain}" 不一致`);
    }
    if (kp.concept !== concept) {
      errors.push(`concept "${kp.concept}" 与 id 段 "${concept}" 不一致`);
    }
    if (kp.aspect !== aspect) {
      errors.push(`aspect "${kp.aspect}" 与 id 段 "${aspect ?? ''}" 不一致`);
    }
  }

  if (typeof kp.label !== 'string' || kp.label.trim().length === 0) {
    errors.push('label 必填且不能为空');
  }
  if (typeof kp.summary !== 'string' || kp.summary.trim().length === 0) {
    errors.push('summary 必填且不能为空');
  }
  if (kp.status !== 'active' && kp.status !== 'deprecated') {
    errors.push(`status "${String(kp.status)}" 只允许 active / deprecated`);
  }

  return { valid: errors.length === 0, errors };
}

export function getKnowledgePointById(
  id: string
): KnowledgePointDefinition | undefined {
  return KNOWLEDGE_POINTS.find((kp) => kp.id === id);
}

export function isRegisteredKnowledgePoint(id: string): boolean {
  return KNOWLEDGE_POINTS.some((kp) => kp.id === id);
}

/** 是否命中预留前缀（已预留但未注册的领域，如 kp.electric.*） */
export function isReservedKnowledgePointPrefix(id: string): boolean {
  return RESERVED_KNOWLEDGE_POINT_DOMAIN_PREFIXES.some((p) =>
    id.startsWith(p)
  );
}
