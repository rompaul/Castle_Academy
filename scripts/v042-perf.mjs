/**
 * V042-010 — 渲染性能测量脚本（纹理模式 vs 纯色基线模式）
 *
 * 前置：dev server 运行于 http://localhost:5173（?flat=1 走纯色基线路径）。
 * 用法：node scripts/v042-perf.mjs
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const FRAME_SAMPLES = 300; // ~5s @60fps

async function measure(page, url, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="game-canvas"]', { timeout: 15000 });
  await page.waitForTimeout(1500); // 等待首帧稳定

  const result = await page.evaluate((samples) => new Promise((resolve) => {
    const api = window.__CASTLE_TEST__;
    let times = [];
    let last = performance.now();
    let done = 0;
    function tick(now) {
      times.push(now - last);
      last = now;
      if (++done < samples) requestAnimationFrame(tick);
      else resolve({ times, info: api?.getRenderInfo?.() ?? null });
    }
    requestAnimationFrame(tick);
  }), FRAME_SAMPLES);

  const sorted = [...result.times].sort((a, b) => a - b);
  const avg = result.times.reduce((a, b) => a + b, 0) / result.times.length;
  const fps = 1000 / avg;
  const report = {
    mode: label,
    frames: result.times.length,
    avgFps: +fps.toFixed(1),
    avgFrameMs: +avg.toFixed(2),
    p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    maxFrameMs: +sorted[sorted.length - 1].toFixed(2),
    drawCalls: result.info?.drawCalls ?? "N/A",
    triangles: result.info?.triangles ?? "N/A",
    texturesInMemory: result.info?.textures ?? "N/A",
  };
  console.log(JSON.stringify(report));
  return report;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const flat = await measure(page, `${BASE_URL}/?flat=1`, "flat (V0.4.1 baseline path)");
const textured = await measure(page, `${BASE_URL}/`, "textured (V0.4.2)");
// 复测一次纹理模式，减少偶然性
const textured2 = await measure(page, `${BASE_URL}/`, "textured (run 2)");
await browser.close();

const delta = ((flat.avgFrameMs - textured.avgFrameMs) / flat.avgFrameMs * 100).toFixed(1);
console.log(`\nframe-time delta (textured vs flat): ${delta}% ${delta > 0 ? "slower" : "faster or equal"}`);
console.log("DONE");
