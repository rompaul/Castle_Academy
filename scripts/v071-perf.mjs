/**
 * V0.7.1 — D-2 同机同脚本 ABBA 性能配对。
 *
 * A = 干净世界；B = 桥梁任务施工态（动态河道 + ghost 蓝图 + DOM 工作台）。
 * 顺序 A1 → B1 → B2 → A2；A 的 WebGL drawCalls 必须与 V0.7 基线 329 一致。
 * B 的帧时间只记录并归因，不套绝对阈值（DEV-603 / D-2）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v071-perf.mjs
 * 产出：docs/v0.7.1/V071_Performance_Paired.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const FRAME_SAMPLES = 180;
const OUT_DIR = resolve(process.cwd(), "docs/v0.7.1");
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
await page.waitForTimeout(1800);

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
    avgFps: +(1000 / avg).toFixed(1),
    drawCalls: result.info?.drawCalls ?? null,
    triangles: result.info?.triangles ?? null
  };
  console.log(`MEASURE ${JSON.stringify(report)}`);
  return report;
}

const A1 = await measure("A1 clean world");

// B：打开桥梁任务 → 合法设计 → 进入施工（动态河道 + ghost 蓝图）
await page.evaluate(() => window.__CASTLE_TEST__.setProfile("性能配对", "8-10"));
await page.waitForTimeout(300);
const list = page.getByRole("region", { name: "任务列表" });
if (!(await list.isVisible())) await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.getByRole("button", { name: /修复王国旧桥/ }).click();
await page.locator('.ca-v071-cell[title="(8, 7)"]').click();
await page.locator('.ca-v071-cell[title="(13, 7)"]').click();
await page.getByTestId("v071-use-measurement").click();
await page.getByTestId("v071-start-design").click();
await page.getByTestId("v071-validate").click();
await page.getByTestId("v071-enter-construction").click();
await page.waitForTimeout(900);
const B1 = await measure("B1 bridge construction overlay");
const B2 = await measure("B2 bridge construction overlay (repeat)");

// A2：收起工作台、移除动态场景、恢复镜头与鼠标位置
await page.evaluate(() => {
  window.__CASTLE_TEST__.resetV071Bridge();
  window.__CASTLE_TEST__.setPlayerPosition(0, 2.2, 7);
});
const close = page.getByRole("button", { name: "收起工作台" });
if (await close.count()) await close.click();
await page.mouse.move(1279, 30);
await page.waitForTimeout(900);
const A2 = await measure("A2 clean world (repeat)");

const mean = (a, b) => +((a + b) / 2).toFixed(2);
const A = { avgFrameMs: mean(A1.avgFrameMs, A2.avgFrameMs), drawCalls: A1.drawCalls, repeatDrawCalls: A2.drawCalls };
const B = { avgFrameMs: mean(B1.avgFrameMs, B2.avgFrameMs), drawCalls: B1.drawCalls, repeatDrawCalls: B2.drawCalls };
const deltaPercent = +((B.avgFrameMs - A.avgFrameMs) / A.avgFrameMs * 100).toFixed(2);

const report = {
  date: new Date().toISOString(),
  task: "V0.7.1 / D-2 ABBA paired measurement",
  method: "same machine, same script, same page, ABBA order, 180 rAF frames per run, software WebGL; B = bridge site with ghost blueprint + DOM workbench",
  order: ["A1", "B1", "B2", "A2"],
  runs: { A1, B1, B2, A2 },
  paired: { A, B, frameTimeDeltaPercent: deltaPercent },
  baselineCleanWorldDrawCalls: 329,
  verdict: {
    cleanWorldDrawCallsNoRegression: A.drawCalls === 329 && A.repeatDrawCalls === 329 ? "PASS" : "REVIEW",
    bridgeOverlayDrawCalls: `${B.drawCalls} (recorded and attributed: task scene is derived overlay; no absolute threshold applied)`,
    note: "A/B 镜头位置不同（B 进入施工现场后会聚焦河道），帧时间只记录，不把 B 更快归因于 overlay；不套用失真绝对阈值。"
  },
  pageErrors
};
writeFileSync(resolve(OUT_DIR, "V071_Performance_Paired.json"), JSON.stringify(report, null, 2));
console.log("PAIRED", JSON.stringify(report.paired, null, 2));
console.log("VERDICT", JSON.stringify(report.verdict, null, 2));
await browser.close();
