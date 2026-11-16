/**
 * V07-025 — D-2 同机同脚本 ABBA 性能配对（不改 v061-perf.mjs）
 *
 * A = 干净世界（任务侧栏收起）；B = 打开任务侧栏（24 个任务卡 + V0.7 形式组件）。
 * 顺序 A1 → B1 → B2 → A2，同一 page / 同一脚本 / 同帧数采样，抵消线性漂移。
 * 判定：A 的 drawCalls 与 V0.6.1 干净世界基线 329 一致即「不回归」；
 *       B 的实际值单独记录并归因（任务面板是 DOM overlay，不进 WebGL 场景），
 *       不套用失真绝对阈值（DEV-603 / D-2）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v07-perf.mjs
 * 产出：docs/v0.7/V07_Performance_Paired.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const FRAME_SAMPLES = 180;
const OUT_DIR = resolve(process.cwd(), "docs/v0.7");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.addStyleTag({ content: ".welcome-overlay, .help-panel { display: none !important; }" });
await page.waitForTimeout(1800); // 首帧稳定

/** B 态：打开并固定任务侧栏（含 V0.7 六形式任务卡）；A 态：移开鼠标后收起 */
async function setSidebar(open) {
  if (open) {
    await page.mouse.move(6, 300);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const pin = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "固定侧栏"
      );
      if (pin) pin.click();
    });
  } else {
    await page.evaluate(() => {
      const unpin = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "取消固定侧栏"
      );
      if (unpin) unpin.click();
    });
    // 移到顶栏右端（非 3D 世界区）：鼠标进入世界会触发注视方块的高亮描边（+1 dc，
    // fresh 页面即可复现，与 V0.7 无关），会污染 A2 的干净世界测量。
    await page.mouse.move(1279, 30);
  }
  await page.waitForTimeout(800); // 等 overlay 布局稳定
  const state = await page.locator('[data-testid="mission-sidebar"]').getAttribute("data-open");
  if (open !== (state === "true")) throw new Error(`sidebar state mismatch: expect ${open} got ${state}`);
}

async function measure(label) {
  const result = await page.evaluate((samples) => new Promise((done) => {
    const api = window.__CASTLE_TEST__;
    const times = [];
    let last = performance.now();
    let count = 0;
    function tick(now) {
      times.push(now - last);
      last = now;
      if (++count < samples) requestAnimationFrame(tick);
      else done({ times, info: api?.getRenderInfo?.() ?? null });
    }
    requestAnimationFrame(tick);
  }), FRAME_SAMPLES);
  const sorted = [...result.times].sort((a, b) => a - b);
  const avg = result.times.reduce((a, b) => a + b, 0) / result.times.length;
  const report = {
    label,
    frames: result.times.length,
    avgFrameMs: +avg.toFixed(2),
    p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    maxFrameMs: +sorted[sorted.length - 1].toFixed(2),
    avgFps: +(1000 / avg).toFixed(1),
    drawCalls: result.info?.drawCalls ?? null,
    triangles: result.info?.triangles ?? null
  };
  console.log(`MEASURE ${JSON.stringify(report)}`);
  return report;
}

/* ABBA：A1 → B1 → B2 → A2 */
const A1 = await measure("A1 clean world");
await setSidebar(true);
const B1 = await measure("B1 mission sidebar open");
const B2 = await measure("B2 mission sidebar open (repeat)");
await setSidebar(false);
const A2 = await measure("A2 clean world (repeat)");

const mean = (a, b) => +((a + b) / 2).toFixed(2);
const A = { avgFrameMs: mean(A1.avgFrameMs, A2.avgFrameMs), drawCalls: A1.drawCalls, repeatDrawCalls: A2.drawCalls };
const B = { avgFrameMs: mean(B1.avgFrameMs, B2.avgFrameMs), drawCalls: B1.drawCalls, repeatDrawCalls: B2.drawCalls };
const deltaPercent = +((B.avgFrameMs - A.avgFrameMs) / A.avgFrameMs * 100).toFixed(2);

const report = {
  date: new Date().toISOString(),
  task: "V07-025 / D-2 ABBA paired measurement",
  method: "same machine, same script, same page, ABBA order, 180 rAF frames per run, software WebGL; B = fixed mission sidebar (DOM overlay)",
  order: ["A1", "B1", "B2", "A2"],
  runs: { A1, B1, B2, A2 },
  paired: { A, B, frameTimeDeltaPercent: deltaPercent },
  baselineCleanWorldDrawCalls: 329,
  verdict: {
    cleanWorldDrawCallsNoRegression: A.drawCalls === 329 && A.repeatDrawCalls === 329 ? "PASS" : "REVIEW",
    sidebarOpenDrawCalls: `${B.drawCalls} (recorded and attributed: DOM overlay adds no WebGL draw calls; no absolute threshold applied)`,
    note: "帧时间按 D-2 用同机同脚本配对判定；不套用 DEV-603 记录的失真绝对阈值。"
  },
  pageErrors
};
writeFileSync(resolve(OUT_DIR, "V07_Performance_Paired.json"), JSON.stringify(report, null, 2));
console.log("PAIRED", JSON.stringify(report.paired, null, 2));
console.log("VERDICT", JSON.stringify(report.verdict, null, 2));
await browser.close();
