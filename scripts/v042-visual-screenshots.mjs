/**
 * V042-009 — 游戏内视觉截图脚本（垂直切片 8 块）
 *
 * 前置：dev server 已在 http://localhost:5173 运行（npm run dev）。
 * 用法：node scripts/v042-visual-screenshots.mjs
 * 输出：docs/v0.4/screenshots/*.png + docs/v0.4/V042-009_Visual_Screenshot_Report.md 使用的原始截图
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const OUT_DIR = resolve(process.cwd(), "docs/v0.4/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

/** 垂直切片 8 块：草/土/层岩/蜜橡木/瓦砖/地基混凝土/窗框/石阶 */
const SLICE_BLOCKS = [
  { id: "grass", x: 0, y: 0, z: 0 },
  { id: "dirt", x: 1, y: 0, z: 0 },
  { id: "stone", x: 2, y: 0, z: 0 },
  { id: "wood", x: 3, y: 0, z: 0 },
  { id: "brick", x: 0, y: 0, z: 1 },
  { id: "foundation_concrete", x: 1, y: 0, z: 1 },
  { id: "window_frame", x: 2, y: 0, z: 1 },
  { id: "stair_stone", x: 3, y: 0, z: 1 },
  // 第二层展示 window_frame 立面效果
  { id: "brick", x: 0, y: 1, z: 1 },
  { id: "window_frame", x: 1, y: 1, z: 1 },
  { id: "stair_stone", x: 2, y: 1, z: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="game-canvas"]', { timeout: 15000 });

// 注入切片方块（__CASTLE_TEST__ 仅在 DEV 模式暴露）
const placed = await page.evaluate((blocks) => {
  const api = window.__CASTLE_TEST__;
  if (!api) return { ok: false, reason: "__CASTLE_TEST__ unavailable (need DEV mode)" };
  api.reset();
  let count = 0;
  for (const b of blocks) {
    if (api.placeBlock(b.x, b.y, b.z, b.id)) count++;
  }
  return { ok: true, placed: count, total: api.getBlockCount() };
}, SLICE_BLOCKS);
if (!placed.ok) {
  console.error("FATAL:", placed.reason);
  await browser.close();
  process.exit(1);
}
console.log("placed blocks:", placed.placed, "world total:", placed.total);

async function shot(name) {
  await page.waitForTimeout(400); // 等待渲染稳定
  await page.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
  console.log("saved", name);
}

// 近景：相机贴近切片
await page.evaluate(() => window.__CASTLE_TEST__.setPlayerPosition(1.5, 3.5, 4.5));
await shot("slice_close");

// 正常游戏距离
await page.evaluate(() => window.__CASTLE_TEST__.setPlayerPosition(1.5, 4.5, 9.5));
await shot("slice_normal");

// 远景
await page.evaluate(() => window.__CASTLE_TEST__.setPlayerPosition(1.5, 8, 16));
await shot("slice_distant");

// 地下室/剖面：隐藏 ground 层 + 开 X 轴剖面
await page.evaluate(() => {
  const api = window.__CASTLE_TEST__;
  api.setPlayerPosition(1.5, 4.5, 9.5);
  api.setLayerVisibility("ground", false);
});
await shot("slice_basement_layer_hidden");
await page.evaluate(() => {
  const api = window.__CASTLE_TEST__;
  api.setLayerVisibility("ground", true);
  api.setSectionView({ enabled: true, axis: "z", coordinate: 0, keptSide: "negative" });
});
await shot("slice_section_view");
await page.evaluate(() => window.__CASTLE_TEST__.setSectionView({ enabled: false }));

await browser.close();
console.log("DONE: screenshots in docs/v0.4/screenshots/");
