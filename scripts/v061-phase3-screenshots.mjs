/**
 * V061-024 准备 — STOP GATE-2 截图材料（只产出截图，不做像素判定 / 不改 canonical）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v061-phase3-screenshots.mjs
 * 产出：docs/v0.6.1/screenshots/gate2/*.png
 * 对应参考图：E1（热栏/帮助常驻）、E2（通电）、E3（缺口）、E7（3 级提示与锁定链）、
 * R-628（首次引导）。2026-11-14 追加 E10（6-7 档 C1/C2 低龄路径）、
 * E11（同一开关按一下开、再按一下关的断开态与成对观察，DEV-615）、
 * E12（DDR-0002：MC 式 9 格快捷栏 + 分类面板打开态）、E13（滚动到电力四组）。
 * 只产出截图与只读诊断，不做像素判定 / 不改 canonical。
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = resolve(process.cwd(), "docs/v0.6.1/screenshots/gate2");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function shot(name) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  console.log(`SHOT ${name}`);
}

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
await page.waitForTimeout(900);
// 只隐藏欢迎覆盖层；帮助面板保持可见（常驻安全条目是评审对象）
await page.addStyleTag({ content: ".welcome-overlay { display: none !important; }" });

/* E1：首屏 + 帮助面板常驻安全条目 + 热栏（9 个电力方块只追加 ID） */
await shot("e1-help-safety-and-hotbar");

/* 建档进入世界 */
await page.getByTestId("onboarding-nickname").fill("小小工程师");
await page.getByRole("button", { name: "下一步" }).click();
await page.getByRole("button", { name: "年龄段 8-10" }).click();
await page.getByRole("button", { name: /进入世界/ }).click();
await page.waitForTimeout(600);

const collapseBtn = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await collapseBtn.first().isVisible())) {
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
}
await page.getByRole("button", { name: "固定侧栏" }).click();
await page.waitForTimeout(350);

/* E7-1：首次安全引导（选中电力任务时会话内一次） */
await page.getByRole("button", { name: /点亮信标/ }).first().click();
await page.waitForTimeout(350);
await shot("e7-first-safety-guide");
await page.getByTestId("electrical-safety-dismiss").click();

/* E7-2：3 级提示阶梯 + 知识点卡 + 详情内常驻安全提示 */
for (let i = 0; i < 3; i++) {
  const reveal = page.getByTestId("reveal-hint");
  if (await reveal.count()) await reveal.click();
}
await page.waitForTimeout(250);
await shot("e7-three-level-hints");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* E7-3：先决条件链锁定态（A 未完成 → B locked） */
await page.getByRole("button", { name: /^开关的魔法/ }).first().click();
await page.waitForTimeout(300);
await shot("e7-prerequisite-locked");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* E2：连通电路（电源 → 电线 → 闭合开关 → 电线 → 灯）+ 状态条「通电了」 */
await page.evaluate(() => {
  const t = window.__CASTLE_TEST__;
  t.placeBlock(0, 2, 0, "power_source_low_voltage");
  t.placeBlock(1, 2, 0, "wire_basic");
  t.placeBlock(2, 2, 0, "switch_closed");
  t.placeBlock(3, 2, 0, "wire_basic");
  t.placeBlock(4, 2, 0, "lamp_basic");
});
await page.waitForTimeout(800);
const powered = await page.evaluate(() => ({
  status: document.querySelector("[data-testid=electrical-status]")?.textContent ?? null,
  loadState: window.__CASTLE_TEST__.getElectrical().getLoadState(4, 2, 0),
  drawCalls: window.__CASTLE_TEST__.getRenderInfo().drawCalls
}));
await shot("e2-circuit-connected");

/* E3：移除一段电线 → 缺口 → 状态条「还没接通」 */
await page.evaluate(() => window.__CASTLE_TEST__.removeBlock(3, 2, 0));
await page.waitForTimeout(800);
const gap = await page.evaluate(() => ({
  status: document.querySelector("[data-testid=electrical-status]")?.textContent ?? null,
  loadState: window.__CASTLE_TEST__.getElectrical().getLoadState(4, 2, 0)
}));
await shot("e3-circuit-gap");

/* E11（DEV-615）：补回电线，把同一个开关「按一下」切到断开，断言成对观察 */
await page.evaluate(() => window.__CASTLE_TEST__.placeBlock(3, 2, 0, "wire_basic"));
await page.waitForTimeout(400);
await page.evaluate(() => {
  const t = window.__CASTLE_TEST__;
  t.removeBlock(2, 2, 0);
  t.placeBlock(2, 2, 0, "switch_open");
});
await page.waitForTimeout(700);
const paired = await page.evaluate(() => ({
  status: document.querySelector("[data-testid=electrical-status]")?.textContent ?? null,
  loadState: window.__CASTLE_TEST__.getElectrical().getLoadState(4, 2, 0),
  observations: window.__CASTLE_TEST__.getElectrical().switchObservations
}));
await shot("e11-switch-open-paired-observation");

/* E10（DEV-616）：独立 6-7 档案 → 活动 C 的单系统子路径 C1/C2 */
const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page2 = await context2.newPage();
page2.on("pageerror", (error) => errors.push(error.message));
await page2.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page2.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
await page2.waitForTimeout(900);
await page2.addStyleTag({ content: ".welcome-overlay { display: none !important; }" });
await page2.getByTestId("onboarding-nickname").fill("小工匠");
await page2.getByRole("button", { name: "下一步" }).click();
await page2.getByRole("button", { name: "年龄段 6-7" }).click();
await page2.getByRole("button", { name: /进入世界/ }).click();
await page2.waitForTimeout(600);
const collapse2 = page2.getByRole("button", { name: "收起任务侧栏" });
if (!(await collapse2.first().isVisible())) {
  await page2.getByRole("button", { name: "打开任务侧栏" }).click();
}
await page2.getByRole("button", { name: "固定侧栏" }).click();
await page2.waitForTimeout(350);
await page2.getByRole("button", { name: /给水泵通电/ }).first().click();
await page2.waitForTimeout(400);
const lowAge = await page2.evaluate(() => ({
  ageBand: window.__CASTLE_TEST__.getActiveProfile()?.ageBand ?? null,
  pathButtons: [...document.querySelectorAll("[data-testid^=low-age-path-]")].map((node) => node.textContent?.trim()),
  hasFullVersionHint: (document.querySelector("[data-testid=hint-ladder]")?.textContent ?? "").includes("先看看泵有没有通电")
}));
await page2.screenshot({ path: resolve(OUT, "e10-low-age-c1-c2.png") });
console.log("SHOT e10-low-age-c1-c2");
await context2.close();

/* E12（DDR-0002）：MC 式 9 格快捷栏 + 分类面板打开态；只读诊断快捷格与分组 */
await page.getByRole("button", { name: "All blocks", exact: true }).click();
await page.waitForTimeout(250);
const mcBar = await page.evaluate(() => ({
  quickSlots: [...document.querySelectorAll(".hotbar-slot[aria-label^='Select ']")].map((node) => node.getAttribute("aria-label")),
  groupLabels: [...document.querySelectorAll(".block-palette-group-label")].map((node) => node.textContent?.trim()),
  paletteItems: document.querySelectorAll(".block-palette-item").length
}));
await shot("e12-mc-block-palette");
/* 面板可滚动；再拍一张滚到底部的电力四组，供 E1 参考图评审 */
await page.evaluate(() => {
  const panel = document.querySelector(".block-palette");
  if (panel instanceof HTMLElement) panel.scrollTop = panel.scrollHeight;
});
await page.waitForTimeout(200);
await shot("e13-mc-electric-groups");
await page.getByRole("button", { name: "Close all blocks" }).click();

console.log(JSON.stringify({ powered, gap, lowAge, paired, mcBar, pageErrors: errors }, null, 2));
await browser.close();
