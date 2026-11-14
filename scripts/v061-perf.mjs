/**
 * V061-026 — D-2 同机同脚本 ABBA 性能配对（不改 v042-perf.mjs / v051-perf.mjs）
 *
 * A = 干净世界（无电力方块）；B = 通电电路场景（5 个电力方块）。
 * 顺序 A1 → B1 → B2 → A2，同一 page / 同一脚本 / 同帧数采样，抵消线性漂移。
 * 判定：A 的 drawCalls 与 V0.6 干净世界基线 329 一致即「不回归」；
 *       B 的实际值单独记录并归因，不套用失真绝对阈值（DEV-603 / D-2）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v061-perf.mjs
 * 产出：docs/v0.6.1/V061_Performance_Paired.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const FRAME_SAMPLES = 180;
const OUT_DIR = resolve(process.cwd(), "docs/v0.6.1");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.addStyleTag({ content: ".welcome-overlay, .help-panel, .ca-root { display: none !important; }" });
await page.waitForTimeout(1800); // 首帧稳定

const CIRCUIT = [
  [0, 2, 0, "power_source_low_voltage"],
  [1, 2, 0, "wire_basic"],
  [2, 2, 0, "switch_closed"],
  [3, 2, 0, "wire_basic"],
  [4, 2, 0, "lamp_basic"],
];

async function setCircuit(present) {
  await page.evaluate(({ blocks, present }) => {
    const t = window.__CASTLE_TEST__;
    for (const [x, y, z, id] of blocks) {
      if (present) t.placeBlock(x, y, z, id);
      else t.removeBlock(x, y, z);
    }
  }, { blocks: CIRCUIT, present });
  await page.waitForTimeout(800); // 等电力重算与 overlay 稳定
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
await setCircuit(true);
const B1 = await measure("B1 powered circuit");
const B2 = await measure("B2 powered circuit (repeat)");
await setCircuit(false);
const A2 = await measure("A2 clean world (repeat)");

const mean = (a, b) => +((a + b) / 2).toFixed(2);
const A = { avgFrameMs: mean(A1.avgFrameMs, A2.avgFrameMs), drawCalls: A1.drawCalls, repeatDrawCalls: A2.drawCalls };
const B = { avgFrameMs: mean(B1.avgFrameMs, B2.avgFrameMs), drawCalls: B1.drawCalls, repeatDrawCalls: B2.drawCalls };
const deltaPercent = +((B.avgFrameMs - A.avgFrameMs) / A.avgFrameMs * 100).toFixed(2);

const report = {
  date: new Date().toISOString(),
  task: "V061-026 / D-2 ABBA paired measurement",
  method: "same machine, same script, same page, ABBA order, 180 rAF frames per run, software WebGL",
  order: ["A1", "B1", "B2", "A2"],
  runs: { A1, B1, B2, A2 },
  paired: { A, B, frameTimeDeltaPercent: deltaPercent },
  baselineCleanWorldDrawCalls: 329,
  verdict: {
    cleanWorldDrawCallsNoRegression: A.drawCalls === 329 && A.repeatDrawCalls === 329 ? "PASS" : "REVIEW",
    poweredSceneDrawCalls: `${B.drawCalls} (recorded and attributed, no absolute threshold applied)`,
    note: "帧时间按 D-2 用同机同脚本配对判定；不套用 DEV-603 记录的失真绝对阈值。"
  },
  pageErrors
};
writeFileSync(resolve(OUT_DIR, "V061_Performance_Paired.json"), JSON.stringify(report, null, 2));
console.log("PAIRED", JSON.stringify(report.paired, null, 2));
console.log("VERDICT", JSON.stringify(report.verdict, null, 2));
await browser.close();
