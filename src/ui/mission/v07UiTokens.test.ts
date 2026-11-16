import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../v07Forms.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./V07FormInteractions.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../../main.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./v07InteractionModel.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../../app/App.tsx", import.meta.url), "utf8");

describe("V07-020 UI token / 无障碍 / 零副作用", () => {
  it("新样式只用 --ca-* token，零硬编码颜色、零固定定位", () => {
    expect(css).toContain("var(--ca-");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).toContain("focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(main).toContain('import "./ui/v07Forms.css"');
  });

  it("组件源码无颜色字面量、无 emoji、无存档 / 网络 / 时钟 / 渲染器依赖", () => {
    for (const pattern of [
      /#[0-9a-fA-F]{3,8}\b/, /rgb\(/, /localStorage/, /window\./, /document\./,
      /\bfetch\(/, /Date\.now/, /Math\.random/, /from ["']three/
    ]) {
      expect(component, String(pattern)).not.toMatch(pattern);
    }
    expect(component).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(model).not.toMatch(/localStorage|window\.|document\./);
  });

  it("V07-018 / DEV-704：App.tsx 键盘与滚轮统一走 typing guard", () => {
    expect(app).toContain("isTypingTarget");
    const keydown = app.slice(app.indexOf("const onKeyDown"), app.indexOf("window.addEventListener(\"keydown\""));
    const wheel = app.slice(app.indexOf("const onWheel"), app.indexOf("window.addEventListener(\"wheel\""));
    expect(keydown).toContain("if (isTypingTarget(target)) return;");
    expect(keydown.indexOf("isTypingTarget(target)")).toBeLessThan(keydown.indexOf("Number(event.key)"));
    expect(wheel).toContain("isTypingTarget(target)");
  });

  it("存量 HUD 类未被删除，tokens.css 色值零改动", () => {
    const missionCss = readFileSync(new URL("../mission.css", import.meta.url), "utf8");
    const stylesCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const tokens = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    for (const className of [".topbar", ".hotbar", ".quest-panel", ".ca-detail", ".ca-btn"]) {
      expect(missionCss + stylesCss, className).toContain(className);
    }
    expect(tokens).toContain("--ca-teal-600: #0F766E");
    expect(tokens).toContain("--ca-cream-050: #FAF6EF");
  });
});
