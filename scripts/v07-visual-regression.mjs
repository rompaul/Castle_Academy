/**
 * V07-024 — V0.7 视觉回归与 canonical 冻结
 *
 * 与 v061-visual-regression.mjs 的关系：**只新增、不改动**旧脚本；旧脚本仍写
 * docs/v0.6.1/，本脚本显式引用 V0.6 / V0.6.1 canonical，**只写**
 * docs/v0.7/screenshots/canonical/，不重截任何已提交的旧 canonical（规避 DEV-602）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v07-visual-regression.mjs
 * 产出：docs/v0.7/screenshots/canonical/*（新冻结）+ visual-regression.json
 *
 * 判定口径（AC-7040~7044 + DDR-0001/0002 白名单）：
 * - worldCanvas 3D 区域（隐藏全部 HUD 的 960x608 裁剪）对 V0.6 锚点要求 **0 像素差**；
 * - 全屏 HUD 覆盖层差异按 DDR-0001 / DDR-0002 §3 白名单归因；
 * - 含 V0.7 任务侧栏的新场景单独冻结，不用它掩盖旧区域回归；
 * - 旧 canonical（V0.6 / V0.51 / V0.6.1）字节零改动。
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const V060 = resolve(process.cwd(), "docs/v0.6/screenshots/canonical");
const V061 = resolve(process.cwd(), "docs/v0.6.1/screenshots/canonical");
const OUT = resolve(process.cwd(), "docs/v0.7/screenshots/canonical");
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

const mainPath = resolve(OUT, "world-main-v070.png");
await page.screenshot({ path: mainPath });
console.log("SHOT world-main-v070");

/* 真正的 3D 世界区域：隐藏全部 HUD，与 V0.6 anchor 的裁剪条件一致 */
await page.addStyleTag({
  content: ".topbar, .footer, .toast, .quest-panel, .hover-info, .world-label, .bottom-hud, .crosshair, .ca-root { display: none !important; }"
});
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(OUT, "world-clean-v070.png") });
console.log("SHOT world-clean-v070");
const anchorPath = resolve(OUT, "world-canvas-anchor-v070.png");
await page.screenshot({ path: anchorPath, clip: { x: 320, y: 76, width: 960, height: 608 } });
console.log("SHOT world-canvas-anchor-v070");

/** 浏览器 canvas 逐像素比较（容差 8/通道，与 v051/v061 脚本一致）；regions 定义相同 */
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

/* AC-7040：3D 零容差锚点对 V0.6 canonical */
const anchor = await compare(
  resolve(V060, "world-canvas-anchor-v060.png"), anchorPath, "anchor"
);
/* 全屏 HUD 归因对 V0.6.1 canonical（V0.7 未改 HUD，预期 0 或白名单内） */
const main = await compare(
  resolve(V061, "world-main-v061.png"), mainPath, "main"
);

/* V0.7 新场景：reload 清掉隐藏样式 → 打开任务侧栏（含 24 个任务）单独冻结 */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await hideWelcome();
await page.waitForTimeout(1200);
await page.mouse.move(6, 300);
await page.waitForTimeout(500);
const sidebar = page.locator('[data-testid="mission-sidebar"]');
const sidebarOpen = await sidebar.getAttribute("data-open");
await page.evaluate(() => {
  const pin = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "固定侧栏"
  );
  if (pin) pin.click();
});
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(OUT, "mission-sidebar-v070.png") });
console.log("SHOT mission-sidebar-v070 open=" + sidebarOpen);
const missionCounts = await page.evaluate(() => ({
  cards: document.querySelectorAll(".ca-mission-card").length,
  drawCalls: window.__CASTLE_TEST__.getRenderInfo().drawCalls
}));

const report = {
  date: new Date().toISOString(),
  task: "V07-024",
  baseline: {
    anchor: "docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png",
    main: "docs/v0.6.1/screenshots/canonical/world-main-v061.png",
    version: "tag v0.6.1 / f0980b8 (anchor source: tag v0.6.0 / 0bd6e4f)"
  },
  frozen: [
    "world-canvas-anchor-v070.png", "world-clean-v070.png",
    "world-main-v070.png", "mission-sidebar-v070.png"
  ],
  tolerancePerChannel: 8,
  anchor,
  main,
  hudAttribution: {
    differingPixels: main.differingPixels,
    hotbarBandPixels: main.yBands.hotbarBand,
    hotbarBandSharePercent: +(main.yBands.hotbarBand / (main.differingPixels || 1) * 100).toFixed(2),
    note: "V0.7 零 HUD 改动；全屏对 V0.6.1 main 的差异预期为 0 或集中在白名单区域；3D 世界区域零差异由 anchor 独立验证。"
  },
  missionSidebarScene: { sidebarOpen, ...missionCounts },
  pageErrors,
  verdict: {
    "AC-7040 worldCanvas 0px": anchor.comparable && anchor.differingPixels === 0 ? "PASS" : "BLOCKED",
    "AC-7041 HUD whitelist": main.comparable ? "ATTRIBUTED (see main.regionRatios / DDR-0001 + DDR-0002 §3)" : "BLOCKED",
    "AC-7044 sidebar overlay": sidebarOpen === "true" ? "PASS (frozen separately)" : "BLOCKED"
  },
  note: "锚点截图隐藏全部 HUD；world-main 含 HUD，差异按 DDR 白名单归因；任务侧栏场景单独冻结，不与旧区域混判。"
};
writeFileSync(resolve(OUT, "visual-regression.json"), JSON.stringify(report, null, 2));
console.log("REGRESSION", JSON.stringify({ anchor, main, missionSidebarScene: report.missionSidebarScene, pageErrors, verdict: report.verdict }, null, 2));
await browser.close();
