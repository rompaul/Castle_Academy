import { describe, expect, it } from 'vitest';

import {
  KNOWLEDGE_POINTS,
  KNOWLEDGE_POINT_ID_PATTERN,
  RESERVED_KNOWLEDGE_POINT_DOMAIN_PREFIXES,
  getKnowledgePointById,
  isRegisteredKnowledgePoint,
  isReservedKnowledgePointPrefix,
  validateKnowledgePoint,
  type KnowledgePointDefinition,
} from './registry';

const KP_ID = /^kp\.[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,2}$/;

function makeKp(overrides: Partial<KnowledgePointDefinition> = {}): KnowledgePointDefinition {
  return {
    id: 'kp.water.test.point',
    label: '测试点',
    summary: '测试用知识点。',
    domain: 'water',
    concept: 'test',
    aspect: 'point',
    status: 'active',
    ...overrides,
  };
}

describe('知识点 ID 正则（冻结）', () => {
  it('接受已批准的 4 段 ID 形态', () => {
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.water.flow.range')).toBe(true);
  });

  it('接受已批准的 3 段 ID 形态（含下划线）', () => {
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.system.continuous_path')).toBe(true);
  });

  it('拒绝大写、空段、2 段、5 段与非法字符', () => {
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.Water.flow.range')).toBe(false);
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.water..range')).toBe(false);
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.water')).toBe(false);
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.water.flow.range.extra')).toBe(false);
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('kp.water.flow.range!')).toBe(false);
    expect(KNOWLEDGE_POINT_ID_PATTERN.test('mission.moat.v1')).toBe(false);
  });

  it('正则导出与任务报告冻结口径一致', () => {
    expect(KNOWLEDGE_POINT_ID_PATTERN.source).toBe(KP_ID.source);
  });
});

describe('Registry 数据完整性', () => {
  it('注册了 19 个唯一 ID（映射表去重后实际数量）', () => {
    expect(new Set(KNOWLEDGE_POINTS.map((kp) => kp.id)).size).toBe(KNOWLEDGE_POINTS.length);
    expect(KNOWLEDGE_POINTS.length).toBe(19);
  });

  it('全部条目通过结构化校验', () => {
    for (const kp of KNOWLEDGE_POINTS) {
      const result = validateKnowledgePoint(kp);
      expect(result.errors, kp.id).toEqual([]);
      expect(result.valid, kp.id).toBe(true);
    }
  });

  it('必填字段齐全且不含等级/难度/年级词（ADR-0008 决策 7）', () => {
    const forbidden = /等级|难度|年级|tier|level|percent|百分比|掌握度/i;
    for (const kp of KNOWLEDGE_POINTS) {
      expect(kp.label.trim().length, kp.id).toBeGreaterThan(0);
      expect(kp.summary.trim().length, kp.id).toBeGreaterThan(0);
      expect(forbidden.test(kp.label + kp.summary), kp.id).toBe(false);
    }
  });

  it('ID 段与 domain/concept/aspect 字段一致', () => {
    for (const kp of KNOWLEDGE_POINTS) {
      const [, domain, concept, aspect = ''] = kp.id.split('.');
      expect({ domain: kp.domain, concept: kp.concept, aspect: kp.aspect }, kp.id).toEqual({
        domain,
        concept,
        aspect,
      });
    }
  });

  it('kp.electric.* 仅预留、未注册具体点', () => {
    expect(KNOWLEDGE_POINTS.some((kp) => kp.id.startsWith('kp.electric.'))).toBe(false);
    expect(isReservedKnowledgePointPrefix('kp.electric.circuit.closed')).toBe(true);
    expect(RESERVED_KNOWLEDGE_POINT_DOMAIN_PREFIXES).toContain('kp.electric.');
    expect(isReservedKnowledgePointPrefix('kp.water.flow.range')).toBe(false);
  });

  it('涵盖全部 15 个任务引用所需的 19 个 ID', () => {
    const ids = new Set(KNOWLEDGE_POINTS.map((kp) => kp.id));
    // 每个任务的引用清单（映射表 §4）
    const required = [
      'kp.water.flow.range', 'kp.system.continuous_path',
      'kp.water.gravity.downhill', 'kp.engineering.design_loop',
      'kp.water.barrier.redirect', 'kp.reasoning.cause_effect',
      'kp.water.surface.support', 'kp.measurement.counting',
      'kp.water.channel.absorb', 'kp.experiment.control',
      'kp.engineering.planning', 'kp.reasoning.diagnosis',
      'kp.measurement.volume_units', 'kp.geometry.axis_symmetry',
      'kp.measurement.height', 'kp.spatial.section_view',
      'kp.spatial.underground', 'kp.arithmetic.partition',
      'kp.communication.explain_reason',
    ];
    for (const id of required) expect(ids.has(id), id).toBe(true);
  });
});

describe('查询与引用约束', () => {
  it('按 ID 查询返回定义，未注册 ID 返回 undefined', () => {
    expect(getKnowledgePointById('kp.water.flow.range')?.label).toBe('水流范围');
    expect(getKnowledgePointById('kp.unknown.thing.thing')).toBeUndefined();
  });

  it('isRegisteredKnowledgePoint 只认已注册 ID', () => {
    expect(isRegisteredKnowledgePoint('kp.measurement.counting')).toBe(true);
    expect(isRegisteredKnowledgePoint('kp.electric.circuit.closed')).toBe(false);
    expect(isRegisteredKnowledgePoint('kp.not.registered')).toBe(false);
  });
});

describe('validateKnowledgePoint 结构化校验', () => {
  it('合法定义返回 valid', () => {
    expect(validateKnowledgePoint(makeKp()).valid).toBe(true);
  });

  it('拒绝不符合正则的 ID', () => {
    const r = validateKnowledgePoint(makeKp({ id: 'KP.Bad_ID' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('正则'))).toBe(true);
  });

  it('拒绝空 label / 空 summary（必填字段）', () => {
    expect(validateKnowledgePoint(makeKp({ label: '  ' })).valid).toBe(false);
    expect(validateKnowledgePoint(makeKp({ summary: '' })).valid).toBe(false);
  });

  it('拒绝非法 status', () => {
    const r = validateKnowledgePoint(makeKp({ status: 'archived' as never }));
    expect(r.valid).toBe(false);
  });

  it('拒绝字段与 ID 段不一致', () => {
    const r = validateKnowledgePoint(makeKp({ domain: 'system' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('domain'))).toBe(true);
  });

  it('不抛错，始终返回结构化结果', () => {
    const r = validateKnowledgePoint(makeKp({ id: '', label: '', summary: '' }));
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('追加不重命名（ADR-0008 决策 6）', () => {
  it('已注册 ID 集合是快照的超集（发布后只追加，不重命名/不删除）', () => {
    // V0.6 发布快照：19 个 ID。未来版本追加后此断言仍应通过；
    // 若任何 ID 改名/删除，此测试失败，强迫走 ADR 变更。
    const snapshot = [
      'kp.water.flow.range', 'kp.system.continuous_path',
      'kp.water.gravity.downhill', 'kp.engineering.design_loop',
      'kp.water.barrier.redirect', 'kp.reasoning.cause_effect',
      'kp.water.surface.support', 'kp.measurement.counting',
      'kp.water.channel.absorb', 'kp.experiment.control',
      'kp.engineering.planning', 'kp.reasoning.diagnosis',
      'kp.measurement.volume_units', 'kp.geometry.axis_symmetry',
      'kp.measurement.height', 'kp.spatial.section_view',
      'kp.spatial.underground', 'kp.arithmetic.partition',
      'kp.communication.explain_reason',
    ];
    const registered = new Set(KNOWLEDGE_POINTS.map((kp) => kp.id));
    for (const id of snapshot) expect(registered.has(id), `被改名或删除: ${id}`).toBe(true);
  });
});
