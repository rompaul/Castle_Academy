import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const mission = readFileSync(new URL("./mission.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("V51-009 DDR-0001 设计 token 落地", () => {
  it("10 个规范颜色 + 间距/圆角/字体 token 全部定义且值锁定", () => {
    const expected: Array<[string, string]> = [
      ["--ca-navy-900", "#1E2A3A"], ["--ca-navy-700", "#2A3441"],
      ["--ca-teal-600", "#0F766E"], ["--ca-teal-100", "#E6FFFA"],
      ["--ca-gold-500", "#F59E0B"], ["--ca-coral-500", "#F97316"],
      ["--ca-cream-050", "#FAF6EF"], ["--ca-slate-600", "#475569"],
      ["--ca-green-600", "#16A34A"], ["--ca-red-600", "#DC2626"]
    ];
    for (const [name, value] of expected) {
      expect(tokens, name).toMatch(new RegExp(`${name}\\s*:\\s*${value}`));
    }
    for (const name of ["--ca-space-1", "--ca-space-6", "--ca-radius-sm", "--ca-radius-pill", "--ca-font-heading", "--ca-font-body", "--ca-text-xl"]) {
      expect(tokens).toContain(name);
    }
    expect(tokens).toMatch(/--ca-space-1:\s*4px/);
  });

  it("新任务 UI 样式无任何硬编码颜色，只引用 token", () => {
    expect(mission).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(mission).not.toMatch(/rgba?\(/);
    expect(mission.match(/var\(--ca-/g)?.length ?? 0).toBeGreaterThan(80);
  });

  it("样式基线：tokens.css 被导入，存量 HUD 类与 V0.5 任务面板零删除", () => {
    expect(styles.indexOf('@import "./tokens.css"')).toBeGreaterThan(0);
    expect(styles.indexOf('@import "./tokens.css"')).toBeLessThan(styles.indexOf(":root"));
    for (const selector of [".topbar", ".brand-mark", ".hotbar", ".layer-panel", ".quest-panel", ".hover-info", ".footer", ".welcome-overlay"]) {
      expect(styles, selector).toContain(selector);
    }
    // 存量 HUD 的既有色值未被改写（token 兼容桥值相同，computed style 不变）
    expect(tokens).toContain("--ca-legacy-shell");
    expect(tokens).toMatch(/--ca-legacy-shell:\s*#18221d/);
    expect(styles).toContain("#18221d");
  });

  it("图标族为纯 SVG、统一描边、无 emoji 永久图标", () => {
    const icons = readFileSync(new URL("./icons.tsx", import.meta.url), "utf8");
    expect(icons).toContain('stroke="currentColor"');
    expect(icons).toContain('strokeLinecap="round"');
    expect(icons).toContain('aria-hidden="true"');
    expect(icons).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
