/**
 * V0.5 第二轮复验脚本（测试者角色 B，Round 2）。
 *
 * 目标：复验 Round 1 发现 F-1（页脚版本号）/ F-3（悬停水信息），
 * 并做游戏内抽查（水源→水流动→任务推进→保存/reset/加载重放一致）。
 * F-2 的单测核对由报告静态核对覆盖；本脚本额外做游戏内 F-2 验证
 * （未测量不完成 → 点 Check challenge 触发 measurement.used → 完成）。
 *
 * 悬停测试原理：DEV 模式相机是确定性的（pos(0,2.2,7) yaw=0 pitch=-0.18 fov70），
 * 脚本在 Node 侧复刻方块场景（种子世界 + 城堡舞台 + 测试舞台，顺序与页面一致），
 * 对候选瞄准点做射线-包围盒求交（与 three.js Raycaster 同规则：方块 mesh + 地面 box，
 * 水 mesh 不在拾取集合），只选择"首个命中即目标格"的瞄准点，再投影为屏幕坐标悬停。
 *
 * 仅通过 window.__CASTLE_TEST__ 与 DOM 交互，不修改任何 src/ 代码。
 * 运行前提：dev server 已在 127.0.0.1:5173 运行（且为最新代码）。
 * 输出：docs/v0.5/tester-screenshots/r2-*.png + r2-results.json
 *
 * 用法：node scripts/tester-v05-round2.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = resolve(__dirname, "..");
const SHOT_DIR = resolve(SOURCE_ROOT, "docs/v0.5/tester-screenshots");
mkdirSync(SHOT_DIR, { recursive: true });

const BASE_URL = "http://127.0.0.1:5173/";
const results = [];
const pageErrors = [];
const consoleErrors = [];

function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const mark = status === "PASS" ? "[PASS]" : status === "FAIL" ? "[FAIL]" : "[INFO]";
  console.log(`${mark} ${id} ${name} — ${detail}`);
}

let shotIndex = 0;
async function shot(page, label) {
  shotIndex += 1;
  const file = resolve(SHOT_DIR, `r2-${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  console.log(`  screenshot: ${file}`);
  return file;
}

async function waitConverged(page, timeoutMs = 20000) {
  await page.waitForFunction(() => {
    const api = window.__CASTLE_TEST__;
    return api && api.getWater().isConverged;
  }, { timeout: timeoutMs });
  await page.waitForTimeout(200);
}

async function waterKeySet(page) {
  return page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    return api.getWater().cells.map((c) => `${c.x},${c.y},${c.z}`).sort();
  });
}

/* ================= 相机与射线求交（Node 侧确定性复刻） ================= */

const CAM = { x: 0, y: 2.2, z: 7 };
const PITCH = -0.18;
const TAN_F = Math.tan((70 / 2) * (Math.PI / 180));

function cameraBasis() {
  const d = [0, Math.sin(PITCH), -Math.cos(PITCH)];
  const zAxis = [-d[0], -d[1], -d[2]];
  const up = [0, 1, 0];
  let xAxis = [
    up[1] * zAxis[2] - up[2] * zAxis[1],
    up[2] * zAxis[0] - up[0] * zAxis[2],
    up[0] * zAxis[1] - up[1] * zAxis[0],
  ];
  const len = Math.hypot(...xAxis);
  xAxis = xAxis.map((v) => v / len);
  const yAxis = [
    zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
    zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
    zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
  ];
  return { xAxis, yAxis, zAxis };
}
const BASIS = cameraBasis();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

/** 世界点 → 屏幕 NDC */
function worldToNdc(w) {
  const v = sub(w, [CAM.x, CAM.y, CAM.z]);
  const cx = dot(v, BASIS.xAxis), cy = dot(v, BASIS.yAxis), cz = dot(v, BASIS.zAxis);
  return { ndcX: (cx / -cz) / (TAN_F * ASPECT), ndcY: (cy / -cz) / TAN_F };
}
let ASPECT = 1280 / 688; // 运行时用 canvas 实际尺寸更新

/** 方块世界包围盒：格 (x,y,z) 中心 (x, y+0.5, z) */
function blockBox(x, y, z) {
  return { min: [x - 0.5, y, z - 0.5], max: [x + 0.5, y + 1, z + 0.5], cell: [x, y, z], kind: "block" };
}
const GROUND_BOX = { min: [-16, -1, -16], max: [16, 0, 16], kind: "ground" };

/** 射线-包围盒 slab 求交，返回进入距离 t（负表示不相交/在后方） */
function rayBoxT(origin, dir, box) {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-12) {
      if (origin[i] < box.min[i] || origin[i] > box.max[i]) return null;
      continue;
    }
    let t1 = (box.min[i] - origin[i]) / dir[i];
    let t2 = (box.max[i] - origin[i]) / dir[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmax >= Math.max(tmin, 0) ? Math.max(tmin, 0) : null;
}

/** 首个命中（与渲染器 pick 集合一致：方块 + 地面，水除外） */
function firstHit(origin, dir, blocks) {
  let best = null, bestT = Infinity;
  const groundT = rayBoxT(origin, dir, GROUND_BOX);
  if (groundT !== null && groundT < bestT) { bestT = groundT; best = { kind: "ground", t: groundT }; }
  for (const box of blocks.values()) {
    const t = rayBoxT(origin, dir, box);
    if (t !== null && t < bestT) { bestT = t; best = { kind: "block", cell: box.cell, t }; }
  }
  if (!best) return null;
  const p = [origin[0] + dir[0] * best.t, origin[1] + dir[1] * best.t, origin[2] + dir[2] * best.t];
  if (best.kind === "ground") {
    return { kind: "ground", cell: [Math.floor(p[0] + 0.5), 0, Math.floor(p[2] + 0.5)], point: p };
  }
  return { kind: "block", cell: best.cell, point: p };
}

/* ---------- 复刻场景（顺序与页面 evaluate 一致） ---------- */

function buildSceneMap() {
  const blocks = new Map();
  const place = (x, y, z, id) => blocks.set(`${x},${y},${z}`, blockBox(x, y, z));
  const remove = (x, y, z) => blocks.delete(`${x},${y},${z}`);
  const maxRing = (r, fn) => {
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (Math.max(Math.abs(x), Math.abs(z)) === r) fn(x, z);
  };

  // 种子世界（ThreeWorldRenderer.seedWorld）
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    if (Math.abs(x) === 4 || Math.abs(z) === 4) { place(x, 0, z, "grass"); place(x, -4, z, "grass"); }
  }
  for (let i = 0; i < 5; i++) { place(-7, i, -5, "wood"); place(-7, i, -4, "wood"); }
  place(-7, 5, -5, "grass"); place(-7, 5, -4, "grass");

  // 城堡舞台（castleStage.ts）
  maxRing(5, (x, z) => place(x, 0, z, "stone"));
  maxRing(4, (x, z) => place(x, 1, z, "stone"));
  maxRing(6, (x, z) => place(x, 1, z, "stone"));
  for (let y = -3; y <= 1; y++) for (let x = 6; x <= 8; x++) for (let z = -1; z <= 1; z++) {
    if (!(x === 7 && z === 0 && y >= -2)) place(x, y, z, "stone");
  }
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) place(x, -4, z, "stone");
  maxRing(4, (x, z) => place(x, -3, z, "stone"));
  place(2, -3, 2, "water_source"); place(-1, -3, 2, "water_source");

  // Round 2 悬停测试舞台（与页面 evaluate 完全一致的顺序）
  for (let x = -3; x <= 3; x++) for (let z = -10; z <= 7; z++) place(x, 0, z, "grass");
  for (let x = -1; x <= 1; x++) {
    for (let z = 3; z <= 5; z++) { remove(x, 0, z); remove(x, -1, z); place(x, -2, z, "stone"); }
    remove(x, 1, 4); remove(x, 1, 6);
  }
  place(-3, 1, 0, "water_source");
  place(-2, 1, 0, "drain_channel");
  place(0, 1, 0, "water_source");
  place(1, 1, 0, "water_pipe_blue");
  place(3, 1, 1, "water_pipe_blue");
  place(2, 1, -1, "stone");
  place(0, 3, 4, "water_source");
  return blocks;
}
const SCENE = buildSceneMap();

/** 在目标格可见面上采样，返回"首个命中=目标格"的瞄准点 */
function findAimPoint(targetCell) {
  const [cx, cy, cz] = targetCell;
  const faces = [
    { n: "front", p: [null, null, cz + 0.5], axis: 2 },  // z+
    { n: "top", p: [null, cy + 1, null], axis: 1 },      // y+
    { n: "left", p: [cx - 0.5, null, null], axis: 0 },   // x-
    { n: "right", p: [cx + 0.5, null, null], axis: 0 },  // x+
  ];
  const samples = [];
  for (const f of faces) {
    for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) {
      const u = -0.42 + (0.84 * i) / 8, v = -0.42 + (0.84 * j) / 8;
      let w;
      if (f.axis === 2) w = [cx + u, cy + v + 0.5, cz + 0.5];
      else if (f.axis === 1) w = [cx + u, cy + 1, cz + v];
      else w = [f.p[0], cy + u + 0.5, cz + v];
      const dir = norm(sub(w, [CAM.x, CAM.y, CAM.z]));
      const hit = firstHit([CAM.x, CAM.y, CAM.z], dir, SCENE);
      if (hit && hit.kind === "block" && hit.cell[0] === cx && hit.cell[1] === cy && hit.cell[2] === cz) {
        samples.push({ face: f.n, w, hit });
        break;
      }
    }
    if (samples.length) break;
  }
  return samples[0] || null;
}

/** 地面瞄准点：瞄准世界 (gx,0,gz)，模型求交首个命中=ground 且格与瞄准点同格 */
function findGroundAimPoint2(gx, gz) {
  const w = [gx, 0, gz];
  const dir = norm(sub(w, [CAM.x, CAM.y, CAM.z]));
  const hit = firstHit([CAM.x, CAM.y, CAM.z], dir, SCENE);
  if (hit && hit.kind === "ground" && hit.cell[0] === Math.floor(gx + 0.5) && hit.cell[2] === Math.floor(gz + 0.5)) {
    return { w, hit };
  }
  return null;
}

/* ---------- 悬停 ---------- */

/** 悬停某世界点并返回 hover-info 文本。
 *  用 canvas.dispatchEvent(PointerEvent) 直发 pointermove：与真实鼠标走同一事件
 *  处理器（onPointerMove 读 clientX/Y），但不受 welcome-card 等 DOM 覆盖层拦截。 */
async function hoverAim(page, rect, aim) {
  const { ndcX, ndcY } = worldToNdc(aim);
  const clientX = rect.left + ((ndcX + 1) / 2) * rect.width;
  const clientY = rect.top + ((1 - ndcY) / 2) * rect.height;
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    canvas.dispatchEvent(new PointerEvent("pointermove", {
      clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: "mouse",
    }));
  }, { x: clientX, y: clientY });
  await page.waitForTimeout(180);
  const text = await page.evaluate(() => {
    const el = document.querySelector(".hover-info");
    return el ? el.textContent : null;
  });
  return { text, clientX, clientY };
}

/* ---------- 主流程 ---------- */

async function main() {
  const browser = await chromium.launch({
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL);
  await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  console.log("== 页面就绪，开始 Round 2 复验 ==");

  /* ===== R2-F1: 页脚版本号 ===== */
  const footer = await page.evaluate(() => ({
    footer: (document.querySelector("footer") || {}).textContent || "",
    pill: (document.querySelector(".version-pill") || {}).textContent || "",
  }));
  record("R2-F1", "页脚版本号应为 CASTLE ACADEMY V0.5",
    /CASTLE ACADEMY\s*V0\.5/.test(footer.footer) && !/V0\.4/.test(footer.footer) ? "PASS" : "FAIL",
    `footer="${footer.footer.trim()}" versionPill="${footer.pill}"`);
  await shot(page, "footer-version");

  /* ===== R2-F3: 悬停水信息 ===== */
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    for (let x = -3; x <= 3; x++) {
      for (let z = -10; z <= 7; z++) api.placeBlock(x, 0, z, "grass");
    }
    for (let x = -1; x <= 1; x++) {
      for (let z = 3; z <= 5; z++) { api.removeBlock(x, 0, z); api.removeBlock(x, -1, z); api.placeBlock(x, -2, z, "stone"); } // 深水池（池底 y=-2）
      for (const z of [4, 6]) api.removeBlock(x, 1, z);           // 清除护城河墙在视线/水池上的格
    }
    api.placeWaterSource(-3, 1, 0);            // 悬停目标：水源
    api.placeBlock(-2, 1, 0, "drain_channel"); // 悬停目标：排水渠
    api.placeWaterSource(0, 1, 0);             // 驱动连通管道
    api.placeBlock(1, 1, 0, "water_pipe_blue");// 悬停目标：已通水管
    api.placeBlock(3, 1, 1, "water_pipe_blue");// 悬停目标：未通水管（孤立）
    api.placeBlock(2, 1, -1, "stone");         // 悬停目标：无关方块（应无提示）
    api.placeWaterSource(0, 3, 4);             // 池水源（深水池：水叠层 y=-1/0）
  });
  await waitConverged(page);

  const rectRaw = await page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  ASPECT = rectRaw.width / rectRaw.height;
  console.log(`  canvas rect: ${JSON.stringify(rectRaw)} aspect=${ASPECT.toFixed(3)}`);

  // 前置条件自检
  const pre = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      poolWet: w.hasWater(0, 0, 4),
      aboveWet: w.hasWater(0, 1, 1),
      outletWet: w.hasWater(2, 1, 0),
      sourcePlaced: api.hasBlock(-3, 1, 0),
      isolatedPipe: api.hasBlock(3, 1, 1),
    };
  });
  record("R2-F3-pre", "悬停舞台前置条件（池水/上方水/出水口）",
    pre.poolWet && pre.aboveWet && pre.outletWet && pre.sourcePlaced && pre.isolatedPipe ? "PASS" : "FAIL",
    JSON.stringify(pre));

  const hoverCases = [
    { id: "R2-F3a", name: "悬停水源方块 → 水源提示", cell: [-3, 1, 0], expect: "水源方块", shot: "hover-source" },
    { id: "R2-F3b", name: "悬停排水渠 → 排水渠提示", cell: [-2, 1, 0], expect: "排水渠", shot: "hover-drain" },
    { id: "R2-F3c", name: "悬停已连通水管 → 已通水", cell: [1, 1, 0], expect: "已通水", shot: "hover-pipe-flowing" },
    { id: "R2-F3d", name: "悬停孤立水管 → 未通水", cell: [3, 1, 1], expect: "未通水", shot: "hover-pipe-broken" },
    { id: "R2-F3e", name: "悬停被淹方块 → 上方有水", cell: [0, 0, 1], expect: "上方有水", shot: "hover-above-water" },
    { id: "R2-F3g", name: "悬停无关方块 → 无提示（瞄准点经求交验证）", cell: [2, 1, -1], expect: null, shot: "hover-none" },
  ];
  for (const c of hoverCases) {
    const aim = findAimPoint(c.cell);
    if (!aim) { record(c.id, c.name, "FAIL", "Node 侧求交未找到命中目标格的瞄准点（场景复刻与页面不一致？）"); continue; }
    const { text, clientX, clientY } = await hoverAim(page, rectRaw, aim.w);
    const ok = c.expect === null
      ? (text === null || text.trim() === "")
      : Boolean(text && text.includes(c.expect));
    record(c.id, c.name, ok ? "PASS" : "FAIL",
      `aim面=${aim.face} 命中格=(${aim.hit.cell}) hover-info="${text === null ? "<null>" : text}" 屏幕=(${clientX.toFixed(0)},${clientY.toFixed(0)})`);
    await shot(page, c.shot);
  }

  // 有水格：瞄准池水地面（探针扫描池内多个地面点，验证命中后提示"此处有水"）
  {
    const probes = [];
    let pass = false, passDetail = "";
    for (const gx of [-0.8, -0.4, 0, 0.4, 0.8]) {
      for (const gz of [3.3, 3.8, 4.3, 4.8]) {
        const aim = findGroundAimPoint2(gx, gz);
        if (!aim) continue;
        const { text, clientX, clientY } = await hoverAim(page, rectRaw, aim.w);
        probes.push({ aim: aim.hit.cell, text });
        if (text && text.includes("此处有水")) {
          pass = true;
          passDetail = `aim=${JSON.stringify(aim.w)} 命中=ground(${aim.hit.cell}) hover-info="${text}" 屏幕=(${clientX.toFixed(0)},${clientY.toFixed(0)})`;
          break;
        }
      }
      if (pass) break;
    }
    record("R2-F3f", "悬停有水格（池水地面）→ 此处有水", pass ? "PASS" : "FAIL",
      (passDetail || "无探针点返回此处的有水提示") + ` 探针表=${JSON.stringify(probes)}`);
    await shot(page, "hover-water-cell");
  }

  // hover-info 位置证据（在"此处有水"提示仍在时检查；条件渲染：无提示时元素不存在）
  const infoStyle = await page.evaluate(() => {
    const el = document.querySelector(".hover-info");
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { position: s.position, rectCenterX: (r.left + r.right) / 2, rectBottom: r.bottom, viewportW: window.innerWidth, viewportH: window.innerHeight, text: el.textContent };
  });
  const centered = infoStyle && infoStyle.position === "fixed" &&
    Math.abs(infoStyle.rectCenterX - infoStyle.viewportW / 2) < infoStyle.viewportW * 0.1 &&
    infoStyle.rectBottom > infoStyle.viewportH * 0.7;
  record("R2-F3-ui", "提示条位于页面底部中央（.hover-info fixed 水平居中、贴近底部）",
    centered ? "PASS" : "FAIL", JSON.stringify(infoStyle));

  /* ===== R2-F2 游戏内验证：水井需先测量 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(7, 2, 0));
  await waitConverged(page, 20000);
  const wellBefore = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const well = api.getQuests().find((q) => q.id === "quest-well");
    return { complete: well.complete, progress: well.progress,
      shaftWet: api.getWater().hasWater(7, -1, 0) && api.getWater().hasWater(7, -2, 0) };
  });
  await page.getByRole("button", { name: "Check challenge" }).click(); // 触发 measurement.used
  await page.waitForTimeout(400);
  const wellAfter = await page.evaluate(() => {
    const well = window.__CASTLE_TEST__.getQuests().find((q) => q.id === "quest-well");
    return { complete: well.complete, progress: well.progress };
  });
  record("R2-F2", "游戏内水井任务：井筒充水但未测量不完成 → 测量后完成",
    wellBefore.shaftWet && !wellBefore.complete && wellAfter.complete ? "PASS" : "FAIL",
    `井筒充水=${wellBefore.shaftWet} 测量前complete=${wellBefore.complete} 测量后complete=${wellAfter.complete} progress=${wellAfter.progress}`);
  await shot(page, "well-after-measure");

  /* ===== R2-S1 游戏内抽查：水源→水流动→任务面板推进 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const moatInit = await page.evaluate(() =>
    window.__CASTLE_TEST__.getQuests().find((q) => q.id === "quest-moat").progress);
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    for (const [x, z] of [[5, 5], [5, -5], [-5, 5], [-5, -5], [0, 5], [0, -5], [5, 0], [-5, 0]]) {
      api.placeWaterSource(x, 2, z);
    }
  });
  await waitConverged(page, 25000);
  const moatAfter = await page.evaluate(() => {
    const q = window.__CASTLE_TEST__.getQuests().find((x) => x.id === "quest-moat");
    return { progress: q.progress, complete: q.complete };
  });
  record("R2-S1", "抽查：放水源→水流动→护城河任务面板推进完成",
    moatInit === 0 && moatAfter.complete && moatAfter.progress === 1 ? "PASS" : "FAIL",
    `初始progress=${moatInit} 完成后progress=${moatAfter.progress} complete=${moatAfter.complete}`);
  await shot(page, "moat-quest-complete");

  /* ===== R2-S2 抽查：保存→reset→加载 水域重放一致 ===== */
  const savedCells = await waterKeySet(page);
  await page.getByRole("button", { name: "Save world" }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const cellsAfterReset = await waterKeySet(page);
  await page.getByRole("button", { name: "Load world" }).click();
  await waitConverged(page, 25000);
  const loadedCells = await waterKeySet(page);
  const replaySame = JSON.stringify(savedCells) === JSON.stringify(loadedCells);
  record("R2-S2", "抽查：保存→reset→加载后水域重放一致",
    replaySame && cellsAfterReset.length !== savedCells.length ? "PASS" : "FAIL",
    `保存时水格=${savedCells.length} reset后=${cellsAfterReset.length} 加载后=${loadedCells.length} 逐键一致=${replaySame}`);

  /* ===== 汇总 ===== */
  console.log("\n== Round 2 结果汇总 ==");
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`PASS ${passCount}/${results.length}`);
  writeFileSync(resolve(SHOT_DIR, "r2-results.json"),
    JSON.stringify({ results, pageErrors, consoleErrors }, null, 2));
  console.log(`页面错误: ${pageErrors.length} 控制台错误: ${consoleErrors.length}`);
  if (pageErrors.length) console.log("pageErrors:", JSON.stringify(pageErrors, null, 2));
  if (consoleErrors.length) console.log("consoleErrors:", JSON.stringify(consoleErrors, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error("脚本异常:", err);
  process.exit(1);
});
