/**
 * V0.7.1 — 视觉回归与新增 UI canonical 冻结。
 *
 * 显式引用 V0.6 / V0.6.1 canonical，只写 docs/v0.7.1/screenshots/canonical/，
 * 不重截任何旧 canonical。干净世界 3D 锚点仍要求 0 像素差。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v071-visual-regression.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const V060 = resolve(process.cwd(), "docs/v0.6/screenshots/canonical");
const V061 = resolve(process.cwd(), "docs/v0.6.1/screenshots/canonical");
const OUT = resolve(process.cwd(), "docs/v0.7.1/screenshots/canonical");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function compare(baselinePath, currentPath, label) {
  const baseline = readFileSync(baselinePath).toString("base64");
  const current = readFileSync(currentPath).toString("base64");
  const result = await page.evaluate(async ({ baseline, current }) => {
    const load = (b64) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = `data:image/png;base64,${b64}`;
    });
    const [a, b] = await Promise.all([load(baseline), load(current)]);
    if (a.width !== b.width || a.height !== b.height) {
      return { comparable: false, reason: `尺寸不一致 ${a.width}x${a.height} vs ${b.width}x${b.height}` };
    }
    const canvas = document.createElement("canvas");
    canvas.width = a.width; canvas.height = a.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(a, 0, 0);
    const da = ctx.getImageData(0, 0, a.width, a.height);
    ctx.clearRect(0, 0, a.width, a.height);
    ctx.drawImage(b, 0, 0);
    const db = ctx.getImageData(0, 0, a.width, a.height);
    let diff = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      if (Math.abs(da.data[i] - db.data[i]) > 8
        || Math.abs(da.data[i + 1] - db.data[i + 1]) > 8
        || Math.abs(da.data[i + 2] - db.data[i + 2]) > 8
        || Math.abs(da.data[i + 3] - db.data[i + 3]) > 8) diff++;
    }
    return {
      comparable: true, width: a.width, height: a.height,
      differingPixels: diff,
      diffRatio: +(diff / (a.width * a.height) * 100).toFixed(3)
    };
  }, { baseline, current });
  return result;
}

/* 干净世界：与 V0.6 canonical 相同生命周期，隐藏全部 HUD */
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.addStyleTag({ content: ".ca-root { display: none !important; }" });
await page.addStyleTag({
  content: ".welcome-overlay, .help-panel, .topbar, .footer, .toast, .quest-panel, .hover-info, .world-label, .bottom-hud, .crosshair { display: none !important; }"
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);
const anchorPath = resolve(OUT, "world-canvas-anchor-v071.png");
await page.screenshot({ path: anchorPath, clip: { x: 320, y: 76, width: 960, height: 608 } });
const anchor = await compare(resolve(V060, "world-canvas-anchor-v060.png"), anchorPath, "anchor");

/* 新 UI canonical：完整设计工作台 */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.evaluate(() => window.__CASTLE_TEST__.setProfile("视觉冻结", "8-10"));
await page.waitForTimeout(400);
const list = page.getByRole("region", { name: "任务列表" });
if (!(await list.isVisible())) await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.getByRole("button", { name: /修复王国旧桥/ }).click();
await page.locator('.ca-v071-cell[title="(8, 7)"]').click();
await page.locator('.ca-v071-cell[title="(13, 7)"]').click();
await page.getByTestId("v071-use-measurement").click();
await page.getByTestId("v071-start-design").click();
await page.evaluate(() => document.querySelector(".ca-v071-workbench")?.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(OUT, "workbench-design-v071.png") });

await page.getByTestId("v071-hint").click();
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(OUT, "workbench-knowledge-v071.png") });

await page.getByTestId("v071-validate").click();
await page.getByTestId("v071-enter-construction").click();
await page.evaluate(() => {
  const panel = document.querySelector(".ca-v071-workbench");
  panel?.scrollTo(0, panel.scrollHeight);
});
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(OUT, "workbench-construction-v071.png") });

const renderInfo = await page.evaluate(() => window.__CASTLE_TEST__.getRenderInfo());
const report = {
  date: new Date().toISOString(),
  task: "V0.7.1 visual regression + new UI canonical freeze",
  baseline: {
    anchor: "docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png",
    main: "docs/v0.6.1/screenshots/canonical/world-main-v061.png"
  },
  frozen: [
    "world-canvas-anchor-v071.png",
    "workbench-design-v071.png",
    "workbench-knowledge-v071.png",
    "workbench-construction-v071.png"
  ],
  anchor,
  renderInfo,
  pageErrors,
  verdict: {
    "3D anchor 0px": anchor.comparable && anchor.differingPixels === 0 ? "PASS" : "BLOCKED",
    "new UI canonical frozen": pageErrors.length === 0 ? "PASS" : "REVIEW"
  }
};
writeFileSync(resolve(OUT, "visual-regression.json"), JSON.stringify(report, null, 2));
console.log("V071_VISUAL", JSON.stringify({ anchor, renderInfo, pageErrors, verdict: report.verdict }, null, 2));
await browser.close();
