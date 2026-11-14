/**
 * V061-012 / V061-013 — 双态视觉与图层兼容的运行时实测脚本。
 *
 * 前置：dev server 运行于 BASE_URL（默认 http://127.0.0.1:5173，DEV 模式需 `window.__CASTLE_TEST__`）。
 * 用法：node scripts/v061-electrical-visual.mjs
 *
 * 记录：干净世界 draw calls（应与 V0.6 基线 329 一致）、通电场景 overlay 段数 /
 * 独立材质数 / draw calls 增量、剖面视图下 overlay 仍按既有路径裁切且无异常。
 * 正式 D-2 同机同脚本 ABBA 配对判定归 V061-026，本脚本只做 V061-012 的单点实测。
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

try {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
  await page.waitForTimeout(1000);

  const clean = await page.evaluate(() => ({
    render: window.__CASTLE_TEST__.getRenderInfo(),
    electrical: window.__CASTLE_TEST__.getElectrical(),
  }));

  // 在 seed 世界之上（y=2）放一条完整链路，避开既有方块。
  await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    t.placeBlock(0, 2, 0, "power_source_low_voltage");
    t.placeBlock(1, 2, 0, "wire_basic");
    t.placeBlock(2, 2, 0, "switch_closed");
    t.placeBlock(3, 2, 0, "wire_basic");
    t.placeBlock(4, 2, 0, "lamp_basic");
  });
  await page.waitForTimeout(600);
  const powered = await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    const e = t.getElectrical();
    return {
      render: t.getRenderInfo(),
      overlaySegments: e.overlaySegments,
      litMaterials: e.litMaterials,
      status: e.status,
      lampPowered: e.isPowered(4, 2, 0),
      recomputeCount: e.recomputeCount,
    };
  });

  // 断开开关 → 双态可逆；剖面 → overlay 走既有裁切路径（数量不变、无异常）。
  await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    t.removeBlock(2, 2, 0);
    t.placeBlock(2, 2, 0, "switch_open");
  });
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => {
    const e = window.__CASTLE_TEST__.getElectrical();
    return { overlaySegments: e.overlaySegments, lampState: e.getLoadState(4, 2, 0) };
  });

  await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    t.removeBlock(2, 2, 0);
    t.placeBlock(2, 2, 0, "switch_closed");
    t.setSectionView({ enabled: true, axis: "x", coordinate: 2, keptSide: "positive" });
  });
  await page.waitForTimeout(600);
  const sectioned = await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    const e = t.getElectrical();
    return {
      render: t.getRenderInfo(),
      overlaySegments: e.overlaySegments,
      sectionEnabled: t.getSectionView().enabled,
    };
  });

  const report = {
    clean: { drawCalls: clean.render.drawCalls, overlaySegments: clean.electrical.overlaySegments,
      litMaterials: clean.electrical.litMaterials, status: clean.electrical.status },
    powered: { drawCalls: powered.render.drawCalls, overlaySegments: powered.overlaySegments,
      litMaterials: powered.litMaterials, lampPowered: powered.lampPowered,
      recomputeCount: powered.recomputeCount },
    switchOpen: opened,
    sectioned: { drawCalls: sectioned.render.drawCalls, overlaySegments: sectioned.overlaySegments,
      sectionEnabled: sectioned.sectionEnabled },
    drawCallDelta: powered.render.drawCalls - clean.render.drawCalls,
    pageErrors: errors,
  };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error);
  await browser.close();
  process.exitCode = 1;
}
