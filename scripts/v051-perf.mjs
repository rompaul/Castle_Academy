/**
 * V51-018 — 任务体验 DOM 交互 / 档案读写延迟测量。
 *
 * 前置：dev server 运行于 BASE_URL（默认 http://127.0.0.1:5173）。
 * 用法：node scripts/v051-perf.mjs
 * 口径：《V0.51_Acceptance_Test_Plan》§4 —— 侧栏展开/折叠 <50ms、档案读写同步 <16ms。
 * 帧率 / draw calls 由 `scripts/v042-perf.mjs` 同机同脚本测量（D-2）。
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const SAMPLES = 20;
// 单次档案读取远低于 performance.now() 的浏览器计时精度，按批测量再摊到每次操作。
const READ_BATCH = 100;

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.waitForTimeout(800);

const result = await page.evaluate(({ samples, readBatch }) => {
  const api = window.__CASTLE_TEST__;
  const sidebar = document.querySelector('[data-testid="mission-sidebar"]');
  const stat = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      samples: values.length,
      avgMs: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3),
      p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
      maxMs: +sorted[sorted.length - 1].toFixed(3)
    };
  };

  const openTimes = [];
  const closeTimes = [];
  const readTimes = [];
  const writeTimes = [];

  /** React state → DOM 提交耗时：直接派发 click 并监听 data-open 变化 */
  const toggle = (wantOpen) => new Promise((resolve) => {
    const label = wantOpen ? "打开任务侧栏" : "收起任务侧栏";
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((b) => (b.getAttribute("aria-label") || "").includes(label))
      ?? buttons.find((b) => b.textContent?.includes(wantOpen ? "任务" : "任务"));
    if (!button || !sidebar) { resolve(NaN); return; }
    const start = performance.now();
    const observer = new MutationObserver(() => {
      if (sidebar.getAttribute("data-open") === String(wantOpen)) {
        observer.disconnect();
        resolve(performance.now() - start);
      }
    });
    observer.observe(sidebar, { attributes: true, attributeFilter: ["data-open"] });
    button.click();
    setTimeout(() => { observer.disconnect(); resolve(performance.now() - start); }, 1000);
  });

  const run = async () => {
    for (let i = 0; i < samples; i++) {
      openTimes.push(await toggle(true));
      closeTimes.push(await toggle(false));
    }
    for (let i = 0; i < samples; i++) {
      const t0 = performance.now();
      api.setProfile(`计时档案${i}`, "8-10");
      writeTimes.push(performance.now() - t0);
      const t1 = performance.now();
      for (let j = 0; j < readBatch; j++) {
        api.getLearnerSnapshot();
        api.listProfiles();
      }
      readTimes.push((performance.now() - t1) / readBatch);
    }
  };

  // 记录当前页面 performance.now() 的实际分辨率，便于解释亚毫秒读数。
  const probeStart = performance.now();
  while (performance.now() === probeStart) { /* spin until the clock ticks */ }
  const timerResolutionMs = performance.now() - probeStart;

  return run().then(() => ({
    timerResolutionMs: +timerResolutionMs.toFixed(3),
    readBatchSize: readBatch,
    sidebarOpenColdMs: +(openTimes[0] ?? 0).toFixed(3),
    sidebarOpenWarm: stat(openTimes.slice(1).filter(Number.isFinite)),
    sidebarOpen: stat(openTimes.filter(Number.isFinite)),
    sidebarClose: stat(closeTimes.filter(Number.isFinite)),
    profileWrite: stat(writeTimes),
    profileRead: stat(readTimes),
    missions: api.getMissions().length,
    drawCalls: api.getRenderInfo().drawCalls
  }));
}, { samples: SAMPLES, readBatch: READ_BATCH });

console.log(JSON.stringify(result, null, 2));
await browser.close();
