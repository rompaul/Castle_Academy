import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EXPRESSION_FORMS, type ExpressionForm } from "../../content/missions/types";
import type { SwitchObservation } from "../../plugins/electrical/query";
import { V07_MISSION_IDS } from "../../content/missions/v07MissionContracts";
import { ALL_MISSIONS } from "../../content/missions";
import { V07FormInteraction } from "./V07FormInteractions";
import { FORBIDDEN_CHILD_WORDS } from "./v07InteractionModel";

const pair: SwitchObservation[] = [
  { position: { x: 1, y: 2, z: 3 }, state: "closed", lampPowered: true, sequence: 1 },
  { position: { x: 1, y: 2, z: 3 }, state: "open", lampPowered: false, sequence: 2 }
];

function render(form: ExpressionForm, switchObservations: SwitchObservation[] = pair) {
  return renderToStaticMarkup(
    V07FormInteraction({
      missionId: "mission.find-the-pattern.v1",
      form,
      switchObservations,
      counts: { observationLog: 0, variableComparison: 0, decisionSequence: 0 }
    })
  );
}

describe("V07-013~019 形式组件渲染（服务端静态标记，无 DOM 依赖）", () => {
  it("六类主形式各渲染专属区，且都带可选反思与本地证据回看", () => {
    const expected: Record<ExpressionForm, string> = {
      exploration: "v07-observation-checklist",
      experiment: "v07-two-state-comparison",
      "problem-solving": "v07-hypothesis-switcher",
      "life-simulation": "v07-scenario-decisions",
      communication: "v07-local-explanation",
      creation: "v07-creation-hint"
    };
    for (const form of EXPRESSION_FORMS) {
      const html = render(form);
      expect(html, form).toContain(`data-testid="${expected[form]}"`);
      expect(html, form).toContain('data-testid="v07-reflection-input"');
      expect(html, form).toContain('data-testid="v07-local-evidence"');
      expect(html, form).toContain("v07-form-interaction");
    }
  });

  it("两态不只靠颜色区分：合上/断开与灯亮/不亮都用文字写出", () => {
    const html = render("experiment");
    expect(html).toContain("合上 · 灯亮");
    expect(html).toContain("断开 · 灯不亮");
    expect(html).toContain("两种都看到了");
    expect(html).toContain('aria-label="合上时灯亮"');
    expect(html).toContain('data-testid="v07-pair-record"');
    expect(html).toContain("记下这组对照");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|hsl\(/);
  });

  it("Problem-solving：改猜想与按猜想验证并存，文案不含惩罚词", () => {
    const html = render("problem-solving");
    expect(html).toContain('data-testid="v07-hypothesis-source"');
    expect(html).toContain('data-testid="v07-hypothesis-check"');
    expect(html).toContain("改猜想没关系");
    expect(html).not.toMatch(FORBIDDEN_CHILD_WORDS);
  });

  it("反思可跳过、明确零落盘、零评分；证据面板无对错与分数", () => {
    const html = render("exploration");
    expect(html).toContain("说一说（可以不写）");
    expect(html).toContain("不写也没关系，不影响任务。");
    expect(html).toContain("不会保存、不会打分、不会上传");
    expect(html).toContain("只在这次游戏里保留");
    expect(html).toContain("系统不判断写得好不好");
    expect(html).not.toMatch(FORBIDDEN_CHILD_WORDS);
  });

  it("空态可用、键盘可达、无硬编码颜色与 emoji", () => {
    for (const form of EXPRESSION_FORMS) {
      const html = render(form, []);
      expect(html, form).toContain("ca-v07-empty");
      expect(html, form).toContain('type="button"');
      expect(html, form).toContain('id="v07-reflection"');
      expect(html, form).not.toMatch(/style="[^"]*(color|background)/);
      expect(html, form).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  it("V07-021 后白名单恰好等于末尾 6 个新任务；既有 18 个一个都不在内", () => {
    expect(ALL_MISSIONS).toHaveLength(25);
    expect(V07_MISSION_IDS).toHaveLength(6);
    expect(ALL_MISSIONS.slice(18, 24).map((m) => m.id)).toEqual(V07_MISSION_IDS);
    for (const mission of ALL_MISSIONS.slice(0, 18)) {
      expect(V07_MISSION_IDS).not.toContain(mission.id);
    }
  });
});
