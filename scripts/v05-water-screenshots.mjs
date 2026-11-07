/**
 * V05-008 — 游戏内水渲染验证截图
 * 前置：dev server 于 http://localhost:5173
 * 用法：node scripts/v05-water-screenshots.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const OUT_DIR = resolve(process.cwd(), "docs/v0.5/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="game-canvas"]', { timeout: 15000 });

const result = await page.evaluate(async () => {
  const api = window.__CASTLE_TEST__;
  if (!api) return { ok: false, reason: "__CASTLE_TEST__ unavailable" };
  api.reset();
  // 平台：y=0 石板 12x12，水源在 (0,1,0)
  for (let x = -6; x <= 6; x++) {
    for (let z = -6; z <= 6; z++) api.placeBlock(x, 0, z, "stone");
  }
  // 一道墙挡在 x=3（观察阻挡）
  for (let z = -6; z <= 2; z++) api.placeBlock(3, 1, z, "brick");
  api.placeBlock(0, 1, 0, "water_source");
  // 等待水 tick 收敛
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (api.getWater().isConverged) break;
  }
  return {
    ok: true,
    waterCells: api.getWater().cells.length,
    converged: api.getWater().isConverged,
    probe: api.getWater().hasWater(0, 1, 3),
  };
});
console.log("setup:", JSON.stringify(result));
if (!result.ok) { await browser.close(); process.exit(1); }

async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
  console.log("saved", name);
}

await page.evaluate(() => window.__CASTLE_TEST__.setPlayerPosition(0.5, 5, 9));
await shot("water_flow_normal");
await page.evaluate(() => window.__CASTLE_TEST__.setPlayerPosition(0.5, 8, 14));
await shot("water_flow_distant");
// 剖面切过水域
await page.evaluate(() => {
  window.__CASTLE_TEST__.setPlayerPosition(0.5, 5, 9);
  window.__CASTLE_TEST__.setSectionView({ enabled: true, axis: "z", coordinate: 2, keptSide: "negative" });
});
await shot("water_section_view");
await page.evaluate(() => window.__CASTLE_TEST__.setSectionView({ enabled: false }));

// 验证剖面后恢复 + 水数据不变
const after = await page.evaluate(() => ({
  cells: window.__CASTLE_TEST__.getWater().cells.length,
  worldBlocks: window.__CASTLE_TEST__.getBlockCount(),
}));
console.log("after section:", JSON.stringify(after));
await browser.close();
console.log("DONE");
