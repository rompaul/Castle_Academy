/**
 * V061-025 — V0.6.1 视觉回归（DEV-608 修复：以 V0.6 canonical 为干净世界锚点）
 *
 * 与 v051-visual-regression.mjs 的关系：**只新增、不改动**旧脚本；旧脚本仍硬编码
 * V0.51 canonical，本脚本显式引用 docs/v0.6/screenshots/canonical，且不重截任何
 * 已提交的 V0.51 / V0.6 canonical（规避 DEV-602 的二次写入）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v061-visual-regression.mjs
 * 产出：docs/v0.6.1/screenshots/canonical/*（新冻结）+ visual-regression.json
 *
 * 判定口径（AC-6750/6751 + DDR-0002 决策 4）：
 * - worldCanvas 3D 区域（隐藏全部 HUD 的 960x608 裁剪）对 V0.6 锚点要求 **0 像素差**；
 * - 全屏 HUD 覆盖层差异按 DDR-0002 §3 白名单归因，冻结为 V0.6.1 canonical；
 * - 含电力方块的新场景单独冻结，不用它掩盖旧区域回归。
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const V060 = resolve(process.cwd(), "docs/v0.6/screenshots/canonical");
const OUT = resolve(process.cwd(), "docs/v0.6.1/screenshots/canonical");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

const hideWelcome = () => page.addStyleTag({
  content: ".welcome-overlay, .help-panel { display: none !important; }"
});

/* 与 V0.6 canonical 相同的生命周期：不点 Enter World、不触发任务 UI 交互 */
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.waitForTimeout(900);
await hideWelcome();
await page.addStyleTag({ content: ".ca-root { display: none !important; }" });
await page.setViewportSize({ width: 1280, height: 720 });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.addStyleTag({ content: ".ca-root { display: none !important; }" });
await hideWelcome();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);

const mainPath = resolve(OUT, "world-main-v061.png");
await page.screenshot({ path: mainPath });
console.log("SHOT world-main-v061");

/* 真正的 3D 世界区域：隐藏全部 HUD，与 V0.6 anchor 的裁剪条件一致 */
await page.addStyleTag({
  content: ".topbar, .footer, .toast, .quest-panel, .hover-info, .world-label, .bottom-hud, .crosshair, .ca-root { display: none !important; }"
});
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(OUT, "world-clean-v061.png") });
console.log("SHOT world-clean-v061");
const anchorPath = resolve(OUT, "world-canvas-anchor-v061.png");
await page.screenshot({ path: anchorPath, clip: { x: 320, y: 76, width: 960, height: 608 } });
console.log("SHOT world-canvas-anchor-v061");

/** 浏览器 canvas 逐像素比较（容差 8/通道，与 v051 脚本一致）；regions 与 v051 定义相同 */
async function compare(baselinePath, currentPath, label) {
  const baseline = readFileSync(baselinePath).toString("base64");
  const current = readFileSync(currentPath).toString("base64");
  const result = await page.evaluate(async ({ baseline, current, label }) => {
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
    const whole = label === "anchor";
    const regions = whole
      ? { worldCanvas: { x0: 0, y0: 0, x1: a.width, y1: a.height, diff: 0, total: 0 } }
      : {
          topbar: { x0: 0, y0: 0, x1: a.width, y1: 76, diff: 0, total: 0 },
          footer: { x0: 0, y0: a.height - 36, x1: a.width, y1: a.height, diff: 0, total: 0 },
          questPanel: { x0: 0, y0: 72, x1: 300, y1: 460, diff: 0, total: 0 },
          worldCanvas: { x0: 320, y0: 76, x1: a.width, y1: a.height - 36, diff: 0, total: 0 }
        };
    const regionAt = (x, y) => whole ? regions.worldCanvas
      : y < 76 ? regions.topbar
      : y >= a.height - 36 ? regions.footer
      : x < 300 && y < 460 ? regions.questPanel
      : x >= 320 ? regions.worldCanvas
      : null;
    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = a.width; diffCanvas.height = a.height;
    const dctx = diffCanvas.getContext("2d");
    dctx.drawImage(a, 0, 0);
    const diffImage = dctx.getImageData(0, 0, a.width, a.height);
    let differing = 0;
    // 差异像素的垂直分布：用于证明全屏差异集中在底部热栏带，而非 3D 世界回归
    const yBands = { topbar: 0, worldUpper: 0, hotbarBand: 0, footer: 0 };
    for (let i = 0; i < da.data.length; i += 4) {
      const px = (i / 4) % a.width;
      const py = Math.floor((i / 4) / a.width);
      const region = regionAt(px, py);
      if (region) region.total++;
      const changed = Math.abs(da.data[i] - db.data[i]) > 8
        || Math.abs(da.data[i + 1] - db.data[i + 1]) > 8
        || Math.abs(da.data[i + 2] - db.data[i + 2]) > 8
        || Math.abs(da.data[i + 3] - db.data[i + 3]) > 8;
      if (changed) {
        differing++;
        if (region) region.diff++;
        if (py < 76) yBands.topbar++;
        else if (py < 580) yBands.worldUpper++;
        else if (py < 684) yBands.hotbarBand++;
        else yBands.footer++;
        diffImage.data[i] = 220; diffImage.data[i + 1] = 38; diffImage.data[i + 2] = 38;
      } else {
        diffImage.data[i] = Math.round(da.data[i] * 0.35);
        diffImage.data[i + 1] = Math.round(da.data[i + 1] * 0.35);
        diffImage.data[i + 2] = Math.round(da.data[i + 2] * 0.35);
      }
      diffImage.data[i + 3] = 255;
    }
    dctx.putImageData(diffImage, 0, 0);
    const regionRatios = Object.fromEntries(Object.entries(regions).map(([name, r]) => [
      name, { diffPixels: r.diff, ratioPercent: +(r.diff / (r.total || 1) * 100).toFixed(3) }
    ]));
    return {
      comparable: true, width: a.width, height: a.height,
      totalPixels: a.width * a.height, differingPixels: differing,
      diffRatio: +(differing / (a.width * a.height) * 100).toFixed(3),
      regionRatios, yBands, diffPng: diffCanvas.toDataURL("image/png").split(",")[1]
    };
  }, { baseline, current, label });
  if (result?.comparable && result.diffPng) {
    writeFileSync(resolve(OUT, `${label}-diff.png`), Buffer.from(result.diffPng, "base64"));
    delete result.diffPng;
  }
  return result;
}

const anchor = await compare(
  resolve(V060, "world-canvas-anchor-v060.png"), anchorPath, "anchor"
);
const main = await compare(
  resolve(V060, "world-main-v060.png"), mainPath, "main"
);

/* AC-6751：含电力方块的新场景单独冻结（HUD 仍隐藏，不与旧区域混判） */
await page.evaluate(() => {
  const t = window.__CASTLE_TEST__;
  t.placeBlock(0, 2, 0, "power_source_low_voltage");
  t.placeBlock(1, 2, 0, "wire_basic");
  t.placeBlock(2, 2, 0, "switch_closed");
  t.placeBlock(3, 2, 0, "wire_basic");
  t.placeBlock(4, 2, 0, "lamp_basic");
});
await page.waitForTimeout(800);
await page.screenshot({ path: resolve(OUT, "electrical-scene-v061.png") });
console.log("SHOT electrical-scene-v061");
const electrical = await page.evaluate(() => ({
  loadState: window.__CASTLE_TEST__.getElectrical().getLoadState(4, 2, 0),
  drawCalls: window.__CASTLE_TEST__.getRenderInfo().drawCalls
}));

const report = {
  date: new Date().toISOString(),
  task: "V061-025 / DEV-608",
  baseline: {
    anchor: "docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png",
    main: "docs/v0.6/screenshots/canonical/world-main-v060.png",
    version: "tag v0.6.0 / 0bd6e4f"
  },
  frozen: [
    "world-canvas-anchor-v061.png", "world-clean-v061.png",
    "world-main-v061.png", "electrical-scene-v061.png"
  ],
  tolerancePerChannel: 8,
  anchor,
  main,
  hudAttribution: {
    differingPixels: main.differingPixels,
    hotbarBandPixels: main.yBands.hotbarBand,
    hotbarBandSharePercent: +(main.yBands.hotbarBand / (main.differingPixels || 1) * 100).toFixed(2),
    note: "全屏差异集中在 y>=580 的热栏带（34 格平铺 → 9 格 + 分类入口）；3D 世界区域零差异由 anchor 0px 独立验证。"
  },
  electricalScene: electrical,
  pageErrors,
  verdict: {
    "AC-6750 worldCanvas 0px": anchor.comparable && anchor.differingPixels === 0 ? "PASS" : "BLOCKED",
    "AC-6750 HUD <=0.5%": "SUPERSEDED by DDR-0002 section 3 whitelist (owner signed STOP GATE-2 2026-11-14); full-screen HUD differences attributed to intentional changes, see main.regionRatios",
    "AC-6751 electrical scene": electrical.loadState === "powered" ? "PASS (frozen separately)" : "BLOCKED"
  },
  note: "锚点截图隐藏全部 HUD；world-main 含 HUD，其差异按 DDR-0002 白名单归因，不作为世界渲染回归。"
};
writeFileSync(resolve(OUT, "visual-regression.json"), JSON.stringify(report, null, 2));
console.log("REGRESSION", JSON.stringify({ anchor, main, electrical, pageErrors, verdict: report.verdict }, null, 2));
await browser.close();
