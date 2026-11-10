/**
 * V51-014 准备 — V0.51 canonical 截图 + 世界视图视觉回归。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v051-visual-regression.mjs
 * 产出：docs/v0.51/screenshots/canonical/*.png、diffs/*.png、visual-regression.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const CANON = resolve(process.cwd(), "docs/v0.51/screenshots/canonical");
const DIFFS = resolve(process.cwd(), "docs/v0.51/screenshots/diffs");
mkdirSync(CANON, { recursive: true });
mkdirSync(DIFFS, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const shots = [];

async function shot(name) {
  const path = resolve(CANON, `${name}.png`);
  await page.screenshot({ path });
  shots.push(name);
  console.log(`SHOT ${name}`);
}

/**
 * 隐藏欢迎页/帮助面板，使截图与 S4~S8 参考图（世界画布 + 任务 UI）一致。
 * 不点击 Enter World：该按钮会请求 pointer lock，锁定后所有 DOM 点击都会被 canvas 截获。
 * 这与 V0.5 canonical 截图（点击 Enter World 后）视觉状态等价。
 */
async function hideWelcome() {
  await page.addStyleTag({ content: ".welcome-overlay, .help-panel { display: none !important; }" });
}

async function boot() {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await hideWelcome();
}

/* ---------- S1 / S2：首次进入引导 ---------- */
await boot();
await shot("s1-onboarding-nickname");
await page.getByTestId("onboarding-nickname").fill("小小工程师");
await page.getByRole("button", { name: "下一步" }).click();
await page.waitForTimeout(250);
await shot("s2-onboarding-ageband");
await page.getByRole("button", { name: "年龄段 8-10" }).click();
await page.getByRole("button", { name: /进入世界/ }).click();
await page.waitForTimeout(600);

/* ---------- S3：多档案选择 ---------- */
await page.evaluate(() => (window).__CASTLE_TEST__.setProfile("塔楼设计师", "11-12"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.waitForTimeout(700);
await hideWelcome();
await shot("s3-profile-switch");
await page.getByRole("button", { name: "进入世界" }).click();
await page.waitForTimeout(300);

/* ---------- S4：侧栏展开固定 ---------- */
await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.getByRole("button", { name: "固定侧栏" }).click();
await page.waitForTimeout(350);
await shot("s4-world-mission-sidebar");

/* ---------- S5：折叠态 ---------- */
await page.getByRole("button", { name: "收起任务侧栏" }).first().click();
await page.waitForTimeout(350);
await shot("s5-sidebar-collapsed");

/* ---------- S6：任务详情 + 提示阶梯 ---------- */
await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.getByRole("button", { name: /注满护城河/ }).click();
await page.getByTestId("reveal-hint").click();
await page.waitForTimeout(250);
await shot("s6-mission-detail");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* ---------- S8：暂不可玩 ---------- */
await page.evaluate(() => (window).__CASTLE_TEST__.setCapabilityAvailable("measurement.distance", false));
await page.getByRole("button", { name: /城堡水井/ }).click();
await page.waitForTimeout(250);
await shot("s8-mission-unavailable");
await page.evaluate(() => (window).__CASTLE_TEST__.setCapabilityAvailable("measurement.distance", true));
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* ---------- S7：完成 + 奖励 ---------- */
await page.evaluate(() => {
  const a = (window).__CASTLE_TEST__;
  a.placeWaterSource(5, 1, 0);
  a.placeWaterSource(-5, 1, 0);
  a.placeWaterSource(0, 1, 5);
  a.placeWaterSource(0, 1, -5);
});
await page.getByTestId("reward-reveal").waitFor({ state: "visible", timeout: 15000 });
await page.waitForTimeout(300);
await shot("s7-mission-complete-reward");
await page.getByTestId("reward-reveal").getByRole("button", { name: "自由建造" }).click();

/* ---------- 世界主视图：与 V0.5 canonical 相同的 UI 集合（只隐藏本版新增 .ca-root） ---------- */
await page.addStyleTag({ content: ".ca-root { display: none !important; }" });
await page.setViewportSize({ width: 1280, height: 720 });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.addStyleTag({ content: ".ca-root { display: none !important; }" });
await hideWelcome();
// 与 V0.5 canonical 一致的等待窗口；并等待外部字体（D-1）加载完成，
// 否则顶栏英文文字字形/字宽差异会被误判为布局回归。
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);
const mainPath = resolve(DIFFS, "world-main-v051.png");
await page.screenshot({ path: mainPath });
shots.push("world-main-v051(diffs)");
// 无 UI 叠加的纯净世界视图：作为 V0.6 视觉回归锚点
await page.addStyleTag({ content: ".quest-panel, .hover-info, .world-label, .bottom-hud, .crosshair { display: none !important; }" });
await page.waitForTimeout(400);
const cleanPath = resolve(CANON, "world-clean-v051.png");
await page.screenshot({ path: cleanPath });
shots.push("world-clean-v051");

/* 用浏览器 canvas 做像素级对比（无需额外依赖）；容差 8/通道抵消抗锯齿 */
const baselinePath = resolve(process.cwd(), "docs/v0.5/screenshots/quest_panel_stage.png");
let regression;
try {
  const baseline = readFileSync(baselinePath).toString("base64");
  const current = readFileSync(mainPath).toString("base64");
  regression = await page.evaluate(async ({ baseline, current }) => {
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
    let differing = 0;
    const regions = {
      topbar: { x0: 0, y0: 0, x1: a.width, y1: 76, diff: 0, total: 0 },
      footer: { x0: 0, y0: a.height - 36, x1: a.width, y1: a.height, diff: 0, total: 0 },
      questPanel: { x0: 0, y0: 72, x1: 300, y1: 460, diff: 0, total: 0 },
      worldCanvas: { x0: 320, y0: 76, x1: a.width, y1: a.height - 36, diff: 0, total: 0 }
    };
    const regionAt = (x, y) => {
      if (y < 76) return regions.topbar;
      if (y >= a.height - 36) return regions.footer;
      if (x < 300 && y < 460) return regions.questPanel;
      if (x >= 320) return regions.worldCanvas;
      return null;
    };
    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = a.width; diffCanvas.height = a.height;
    const dctx = diffCanvas.getContext("2d");
    dctx.drawImage(a, 0, 0);
    const diffImage = dctx.getImageData(0, 0, a.width, a.height);
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
      comparable: true,
      width: a.width, height: a.height,
      totalPixels: a.width * a.height,
      differingPixels: differing,
      diffRatio: +(differing / (a.width * a.height) * 100).toFixed(3),
      regionRatios,
      diffPng: diffCanvas.toDataURL("image/png").split(",")[1]
    };
  }, { baseline, current });
} catch (error) {
  regression = { comparable: false, reason: String(error) };
}
if (regression?.comparable && regression.diffPng) {
  writeFileSync(resolve(DIFFS, "world-main-diff.png"), Buffer.from(regression.diffPng, "base64"));
  delete regression.diffPng;
}

const report = {
  date: new Date().toISOString(),
  viewportCanonical: "1280x800",
  viewportWorldView: "1280x720",
  screenshots: shots,
  worldViewRegression: regression,
  note: "世界视图为动态水模拟 + 相机会话状态，像素差仅作回归参考；零容差判定以渲染代码零改动 + 布局/尺寸不变为准。"
};
writeFileSync(resolve(DIFFS, "visual-regression.json"), JSON.stringify(report, null, 2));
console.log("REGRESSION", JSON.stringify(regression));
console.log("DONE", shots.length, "screenshots");
await browser.close();
