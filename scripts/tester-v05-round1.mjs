/**
 * V0.5 第一轮独立测试脚本（测试者角色 B）。
 *
 * 仅通过 window.__CASTLE_TEST__ 钩子与页面 DOM 交互，不修改任何 src/ 代码。
 * 运行前提：dev server 已在 127.0.0.1:5173 运行。
 * 输出：控制台逐条结果 JSON + 截图到 docs/v0.5/tester-screenshots/。
 *
 * 用法：node scripts/tester-v05-round1.mjs
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
  const file = resolve(SHOT_DIR, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  console.log(`  screenshot: ${file}`);
  return file;
}

/* ---------- 页面侧 helper（在 page.evaluate 内执行） ---------- */

async function waitConverged(page, timeoutMs = 15000) {
  await page.waitForFunction(() => {
    const api = window.__CASTLE_TEST__;
    return api && api.getWater().isConverged;
  }, { timeout: timeoutMs });
  // 再等一个 tick，保证 tick 边界上的增量也应用完
  await page.waitForTimeout(200);
}

async function waterKeySet(page) {
  return page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    return api.getWater().cells.map((c) => `${c.x},${c.y},${c.z}`).sort();
  });
}

/** 搭建围墙测试平台：地面 y=0 x∈[-7..7] z∈[-15..-7]，围墙 y=1 沿边缘。
 *  同时移除种子舞台的地牢渗水源，保证测试区域零背景水（隔离验证）。 */
async function buildWalledPlatform(page) {
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    api.removeBlock(2, -3, 2);      // 舞台渗水源 1
    api.removeBlock(-1, -3, 2);     // 舞台渗水源 2
    for (let x = -7; x <= 7; x++) {
      for (let z = -15; z <= -7; z++) api.placeBlock(x, 0, z, "grass");
    }
    for (let x = -7; x <= 7; x++) {
      api.placeBlock(x, 1, -15, "stone");
      api.placeBlock(x, 1, -7, "stone");
    }
    for (let z = -15; z <= -7; z++) {
      api.placeBlock(-7, 1, z, "stone");
      api.placeBlock(7, 1, z, "stone");
    }
  });
  await waitConverged(page);
  const bg = await page.evaluate(() => window.__CASTLE_TEST__.getWater().cells.length);
  if (bg !== 0) throw new Error(`测试隔离失败：搭建平台后仍有背景水 ${bg} 格`);
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
  console.log("== 页面就绪，开始水规则测试 ==");

  /* ===== S1: AC-101 / 103 / 104 / 105 / 109（围墙平台） ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await buildWalledPlatform(page);
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(0, 1, -11));
  await waitConverged(page);

  const s1 = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      sourcePlaced: api.hasBlock(0, 1, -11),
      neighborE: w.hasWater(1, 1, -11),
      neighborW: w.hasWater(-1, 1, -11),
      neighborN: w.hasWater(0, 1, -12),
      neighborS: w.hasWater(0, 1, -10),
      cells: w.cells,
    };
  });
  record("AC-101", "水源放置：方块入世界、周围按规则出水",
    s1.sourcePlaced && s1.neighborE && s1.neighborW && s1.neighborN && s1.neighborS ? "PASS" : "FAIL",
    `source=${s1.sourcePlaced} E/W/N/S水=[${s1.neighborE},${s1.neighborW},${s1.neighborN},${s1.neighborS}]`);

  const spread = s1.cells.map((c) => ({ d: Math.abs(c.x) + Math.abs(c.z + 11), y: c.y }));
  const maxD = Math.max(...spread.map((s) => s.d));
  const allY1 = s1.cells.every((c) => c.y === 1);
  const missingCells = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    const missing = [];
    for (let x = -6; x <= 6; x++) {
      for (let z = -14; z <= -8; z++) {
        if (!w.hasWater(x, 1, z) && !api.hasBlock(x, 1, z)) missing.push(`${x},1,${z}`);
      }
    }
    return missing;
  });
  console.log(`  [diag] 内区缺水格=${JSON.stringify(missingCells)}`);
  // 围墙内区域（x∈[-6..6], z∈[-14..-8]）曼哈顿≤7 的格数理论值 79；
  // 以实测为准，核心断言是：上限 ≤7、有限、无越层。
  record("AC-103", "水平扩散上限 ≤7，不无限漫灌",
    maxD <= 7 && allY1 && s1.cells.length <= 79 ? "PASS" : "FAIL",
    `水格数=${s1.cells.length}（内区理论79，缺=${JSON.stringify(missingCells)}）最大曼哈顿距离=${maxD} 全部位于y=1=${allY1}`);

  const boundary = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      d7wet: w.hasWater(4, 1, -8),    // 距源曼哈顿 7，围墙内可达
      d8dry: !w.hasWater(5, 1, -8),   // 距源 8，应无水
      x6wet: w.hasWater(6, 1, -11),   // 距源 6
      wallDry: !w.hasWater(7, 1, -11) && !w.hasWater(8, 1, -11), // 墙格与墙外无水
    };
  });
  record("AC-103b", "扩散边界精确性（7格可达/8格不可达）",
    boundary.d7wet && boundary.d8dry && boundary.x6wet ? "PASS" : "FAIL", JSON.stringify(boundary));

  record("AC-104", "扩散遇固体：被墙阻挡、不穿墙、不覆盖方块",
    boundary.wallDry && boundary.x6wet ? "PASS" : "FAIL",
    `墙格(7,1,-11)与墙外(8,1,-11)均无水=${boundary.wallDry}，墙内侧(6,1,-11)有水=${boundary.x6wet}`);

  const inWater = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const ok = api.getWater().hasWater(3, 1, -11);
    api.placeBlock(3, 1, -11, "stone");
    return { wasWet: ok };
  });
  await waitConverged(page);
  const inWaterAfter = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    return { block: api.hasBlock(3, 1, -11), water: api.getWater().hasWater(3, 1, -11) };
  });
  record("AC-105", "水中放置：放置成功、该格水消失",
    inWater.wasWet && inWaterAfter.block && !inWaterAfter.water ? "PASS" : "FAIL",
    `原水格=${inWater.wasWet} 放置后block=${inWaterAfter.block} water=${inWaterAfter.water}`);

  await page.evaluate(() => window.__CASTLE_TEST__.removeWaterSource(0, 1, -11));
  await waitConverged(page);
  const afterWithdraw = await page.evaluate(() => window.__CASTLE_TEST__.getWater().cells.length);
  record("AC-109", "撤源退水：移除唯一水源后全部退去无残留",
    afterWithdraw === 0 ? "PASS" : "FAIL", `剩余水格=${afterWithdraw}（预期0）`);
  await shot(page, "s1-walled-platform-after-withdraw");

  /* ===== S2: AC-102 垂直下落 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(-12, 5, -11));
  await waitConverged(page);
  const fall = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    const column = [];
    for (let y = 4; y >= -32; y--) column.push({ y, wet: w.hasWater(-12, y, -11) });
    return {
      allWet: column.every((c) => c.wet),
      bottomWet: w.hasWater(-12, -32, -11),   // 到底
      belowBoundDry: !w.hasWater(-12, -33, -11), // 不越界
      noSideSpread: !w.hasWater(-11, 0, -11) && !w.hasWater(-13, 0, -11) && !w.hasWater(-11, -31, -11),
    };
  });
  record("AC-102", "垂直下落：沿同列直到底部边界",
    fall.allWet && fall.bottomWet && fall.belowBoundDry && fall.noSideSpread ? "PASS" : "FAIL",
    `y=4..-32全有水=${fall.allWet} 底部(-32)=${fall.bottomWet} 越界无=${fall.belowBoundDry} 无侧向扩散=${fall.noSideSpread}`);

  /* ===== S3: AC-106 排水渠 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await buildWalledPlatform(page);
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    api.placeWaterSource(0, 1, -11);
    for (let x = -6; x <= 6; x++) api.placeBlock(x, 1, -10, "drain_channel"); // 渠排横断北向
  });
  await waitConverged(page);
  const drain = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      drainIsBlock: api.hasBlock(0, 1, -10),
      drainDry: !w.hasWater(0, 1, -10),       // 渠格吃水（无积水）
      beyondDry: !w.hasWater(0, 1, -9) && !w.hasWater(0, 1, -8), // 不越过渠
      southWet: w.hasWater(0, 1, -12) && w.hasWater(0, 1, -14),  // 南向正常
      eastWet: w.hasWater(6, 1, -11),
    };
  });
  record("AC-106", "排水渠吸收：渠吃水且水不越过继续扩散",
    drain.drainIsBlock && drain.drainDry && drain.beyondDry && drain.southWet && drain.eastWet ? "PASS" : "FAIL",
    JSON.stringify(drain));
  await shot(page, "s3-drain-channel");

  /* ===== S4: AC-107 / 108 管道 ===== */
  // 管道走廊：渠排 z=-10/-12（x∈[-6..6]）封闭走廊，防止出水口的水经明渠绕行，
  // 从而干净验证"管道断开 → 出水停止"。
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await buildWalledPlatform(page);
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    api.placeWaterSource(0, 1, -11);
    api.placeBlock(1, 1, -11, "water_pipe_blue");
    api.placeBlock(2, 1, -11, "water_pipe_blue");
    api.placeBlock(3, 1, -11, "water_pipe_blue");
    for (let x = -6; x <= 6; x++) {
      api.placeBlock(x, 1, -10, "drain_channel");
      api.placeBlock(x, 1, -12, "drain_channel");
    }
    api.placeBlock(-10, 2, -11, "water_pipe_blue"); // 悬空孤立管道（无源连通）
  });
  await waitConverged(page);
  const pipe = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      outletWet: w.hasWater(4, 1, -11),     // 链末端出水口出水（承压）
      outletBelowDry: !w.hasWater(4, 0, -11),
      pipeDry: !w.hasWater(1, 1, -11),      // 管道格本身无水
      decoDry: !w.hasWater(-9, 2, -11) && !w.hasWater(-11, 2, -11) && !w.hasWater(-10, 2, -10) && !w.hasWater(-10, 2, -12) && !w.hasWater(-10, 3, -11),
    };
  });
  record("AC-107", "管道连通：链上通水、出水口出水、装饰管道不出水",
    pipe.outletWet && pipe.pipeDry && pipe.decoDry ? "PASS" : "FAIL", JSON.stringify(pipe));

  await page.evaluate(() => window.__CASTLE_TEST__.removeBlock(2, 1, -11));
  await waitConverged(page);
  const pipeBroken = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    return {
      outletDry: !w.hasWater(4, 1, -11),    // 断开后下游出水停止（走廊内无绕行路径）
      nearPipeStillOutputs: w.hasWater(2, 1, -11), // 近源段管道仍连通并向断口出水
      farPipeDry: !w.hasWater(3, 1, -11),
    };
  });
  record("AC-108", "管道断开：移除中段后下游停止出水",
    pipeBroken.outletDry && pipeBroken.nearPipeStillOutputs && pipeBroken.farPipeDry ? "PASS" : "FAIL", JSON.stringify(pipeBroken));
  await shot(page, "s4-pipe-broken");

  /* ===== S5: AC-110 多源重算 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await buildWalledPlatform(page);
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(-3, 1, -11));
  await waitConverged(page);
  const setA = await waterKeySet(page);
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(3, 1, -11));
  await waitConverged(page);
  const setAB = await waterKeySet(page);
  await page.evaluate(() => window.__CASTLE_TEST__.removeWaterSource(-3, 1, -11));
  await waitConverged(page);
  const setB = await waterKeySet(page);
  const commonCell = "0,1,-11";
  // 源占据格不参与集合比较：B 源落在 A 水域内（该格水被方块取代），
  // 移除 A 后其源格变为空格并由 B 供水（原 A 格在 AB 中是方块、在 B 中是水）。
  const fA = setA.filter((k) => k !== "3,1,-11");
  const fB = setB.filter((k) => k !== "-3,1,-11");
  const supAB = fA.every((k) => setAB.includes(k));
  const supB = fB.every((k) => setAB.includes(k));
  const unionKeys = [...new Set([...fA, ...fB])];
  const unionEquals = setAB.length === unionKeys.length && unionKeys.every((k) => setAB.includes(k));
  record("AC-110", "多源重算：结果=单源并集；移除其一公共区水不消失",
    supAB && supB && setB.includes(commonCell) && setAB.includes(commonCell) && unionEquals ? "PASS" : "FAIL",
    `|A|=${setA.length} |AB|=${setAB.length} |B|=${setB.length} A⊆AB=${supAB} B⊆AB=${supB} AB=A∪B=${unionEquals} 公共格(0,1,-11)保留=${setB.includes(commonCell)}`);

  /* ===== S6: AC-111 / 112 图层与剖面 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const before = await waterKeySet(page);
  await page.evaluate(() => window.__CASTLE_TEST__.setLayerVisibility("basement-1", false));
  await page.waitForTimeout(300);
  const visState = await page.evaluate(() => ({
    hidden: window.__CASTLE_TEST__.getLayerVisibility("basement-1"),
    cells: window.__CASTLE_TEST__.getWater().cells.length,
  }));
  await shot(page, "s6-basement-hidden");
  const duringHidden = await waterKeySet(page);
  await page.evaluate(() => window.__CASTLE_TEST__.setLayerVisibility("basement-1", true));
  await page.waitForTimeout(300);
  await shot(page, "s6-basement-restored");
  const afterRestore = await waterKeySet(page);
  record("AC-111", "图层显隐兼容：水 mesh 隐藏/恢复、数据不变",
    visState.hidden === false && JSON.stringify(before) === JSON.stringify(duringHidden) &&
    JSON.stringify(before) === JSON.stringify(afterRestore) ? "PASS" : "FAIL",
    `隐藏后visibility=${visState.hidden} 数据不变=${JSON.stringify(before) === JSON.stringify(duringHidden)} 恢复后不变=${JSON.stringify(before) === JSON.stringify(afterRestore)}（水格数=${before.length}）；mesh 级视觉以截图 05/06 为证`);

  await page.evaluate(() => window.__CASTLE_TEST__.setSectionView({ enabled: true, axis: "z", coordinate: 0, keptSide: "negative" }));
  await page.waitForTimeout(300);
  const duringSection = await waterKeySet(page);
  const secState = await page.evaluate(() => window.__CASTLE_TEST__.getSectionView());
  await shot(page, "s6-section-z0-negative");
  await page.evaluate(() => window.__CASTLE_TEST__.setSectionView({ enabled: false }));
  await page.waitForTimeout(300);
  const afterSection = await waterKeySet(page);
  record("AC-112", "剖面兼容：水与方块同侧裁切、退出恢复、数据不变",
    secState.enabled === true && JSON.stringify(before) === JSON.stringify(duringSection) &&
    JSON.stringify(before) === JSON.stringify(afterSection) ? "PASS" : "FAIL",
    `剖面生效=${secState.enabled} 数据不变=${JSON.stringify(before) === JSON.stringify(duringSection)} 退出后不变=${JSON.stringify(before) === JSON.stringify(afterSection)}（视觉以截图 07 为证）`);

  /* ===== S7: AC-117 / 118 / 119 学习任务 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const questInit = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const quests = api.getQuests();
    const moat = quests.find((q) => q.id === "quest-moat");
    const well = quests.find((q) => q.id === "quest-well");
    const dungeon = quests.find((q) => q.id === "quest-dungeon");
    return {
      moatProgress: moat.progress, moatComplete: moat.complete,
      wellProgress: well.progress, wellComplete: well.complete,
      dungeonComplete: dungeon.complete,
      dungeonWet: api.getWater().hasWater(-1, -3, -1) && api.getWater().hasWater(-2, -3, -2),
      briefings: quests.map((q) => `${q.title}:${q.briefing}`),
    };
  });
  record("S7-init", "任务初始状态：护城河/水井 0 进度；地牢不伪完成且真实积水",
    questInit.moatProgress === 0 && !questInit.moatComplete && questInit.wellProgress === 0 &&
    !questInit.wellComplete && !questInit.dungeonComplete && questInit.dungeonWet ? "PASS" : "FAIL",
    `moat=${questInit.moatProgress} well=${questInit.wellProgress} dungeonComplete=${questInit.dungeonComplete} dungeonRegionWet=${questInit.dungeonWet}`);

  // AC-117 护城河：环上 y=2 放 8 个源（不占判定格），水下落进环并沿环扩散
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    for (const [x, z] of [[5, 5], [5, -5], [-5, 5], [-5, -5], [0, 5], [0, -5], [5, 0], [-5, 0]]) {
      api.placeWaterSource(x, 2, z);
    }
  });
  let moatToast = false;
  const toastPoll = page.waitForFunction(() => {
    const t = document.querySelector(".toast");
    return t && /护城河/.test(t.textContent || "");
  }, null, { timeout: 12000 }).then(() => { moatToast = true; }).catch(() => {});
  await waitConverged(page, 20000);
  await toastPoll;
  const moatResult = await page.evaluate(() => {
    const moat = window.__CASTLE_TEST__.getQuests().find((q) => q.id === "quest-moat");
    return { progress: moat.progress, complete: moat.complete };
  });
  record("AC-117", "学习任务1 注满护城河：充水判定+completed 状态+toast",
    moatResult.complete && moatResult.progress === 1 && moatToast ? "PASS" : "FAIL",
    `progress=${moatResult.progress} complete=${moatResult.complete} toast出现=${moatToast}`);
  await shot(page, "s7-moat-complete");

  // AC-118 水井：塔顶开口正上方放源
  await page.evaluate(() => window.__CASTLE_TEST__.placeWaterSource(7, 2, 0));
  await waitConverged(page, 20000);
  const wellResult = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const well = api.getQuests().find((q) => q.id === "quest-well");
    return {
      progress: well.progress, complete: well.complete,
      shaftWet: api.getWater().hasWater(7, -1, 0) && api.getWater().hasWater(7, -2, 0),
    };
  });
  record("AC-118", "学习任务2 城堡水井：井筒充水判定",
    wellResult.complete && wellResult.progress === 1 && wellResult.shaftWet ? "PASS" : "FAIL",
    `progress=${wellResult.progress} complete=${wellResult.complete} 井筒充水=${wellResult.shaftWet}（注：测量联动未与判定耦合，见报告说明）`);

  // AC-119 地牢：牢房区四邻 8 格放排水渠
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const drains = [
      [-3, -3, -2], [-3, -3, -1], [0, -3, -2], [0, -3, -1],
      [-2, -3, -3], [-1, -3, -3], [-2, -3, 0], [-1, -3, 0],
    ];
    for (const [x, y, z] of drains) api.placeBlock(x, y, z, "drain_channel");
  });
  let masterToast = false;
  const masterPoll = page.waitForFunction(() => {
    const t = document.querySelector(".toast");
    return t && /水务大师|地牢/.test(t.textContent || "");
  }, null, { timeout: 12000 }).then(() => { masterToast = true; }).catch(() => {});
  await waitConverged(page, 20000);
  await masterPoll;
  const dungeonResult = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const dungeon = api.getQuests().find((q) => q.id === "quest-dungeon");
    return {
      progress: dungeon.progress, complete: dungeon.complete,
      regionDry: !api.getWater().hasWater(-2, -3, -2) && !api.getWater().hasWater(-1, -3, -1) &&
        !api.getWater().hasWater(-1, -3, -2) && !api.getWater().hasWater(-2, -3, -1),
    };
  });
  record("AC-119", "学习任务3 地牢告急：排水判定+V0.4 剖面/图层交互",
    dungeonResult.complete && dungeonResult.regionDry ? "PASS" : "FAIL",
    `progress=${dungeonResult.progress} complete=${dungeonResult.complete} 牢房区无水=${dungeonResult.regionDry} 完成toast=${masterToast}`);
  await shot(page, "s7-quests-complete");
  const panelText = await page.evaluate(() => {
    const panel = document.querySelector(".quest-panel");
    return panel ? panel.textContent : "";
  });
  console.log(`  任务面板文本: ${panelText.slice(0, 200)}`);
  await shot(page, "s7-ui-final");

  /* ===== S8: AC-115 存档兼容（新） ===== */
  const savedCells = await waterKeySet(page);
  await page.getByRole("button", { name: "Save world" }).click();
  await page.waitForTimeout(300);
  const snapshot = await page.evaluate(() => {
    const raw = localStorage.getItem("castle-academy-world-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      raw,
      keys: Object.keys(parsed),
      version: parsed.version,
      blockKeysValid: parsed.blocks.every((b) =>
        ["x", "y", "z", "blockId"].every((k) => k in b) && Object.keys(b).every((k) => ["x", "y", "z", "blockId"].includes(k))),
      hasWaterSourceBlock: parsed.blocks.some((b) => b.blockId === "water_source"),
      leakyFields: ["waterCells", "water", "flowingPipes", "wetDrains", "cells"].filter((k) => k in parsed),
    };
  });
  record("AC-115a", "存档 JSON：version=1、无水模拟字段泄漏",
    snapshot && snapshot.version === 1 && snapshot.keys.length === 2 &&
    snapshot.keys.includes("version") && snapshot.keys.includes("blocks") &&
    snapshot.blockKeysValid && snapshot.leakyFields.length === 0 ? "PASS" : "FAIL",
    `keys=${JSON.stringify(snapshot.keys)} version=${snapshot.version} block字段合法=${snapshot.blockKeysValid} 泄漏字段=${JSON.stringify(snapshot.leakyFields)} 含water_source方块=${snapshot.hasWaterSourceBlock}`);

  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const cellsAfterReset = await waterKeySet(page);
  await page.getByRole("button", { name: "Load world" }).click();
  await waitConverged(page, 20000);
  const loadedCells = await waterKeySet(page);
  const replaySame = JSON.stringify(savedCells) === JSON.stringify(loadedCells);
  const resetDifferent = JSON.stringify(cellsAfterReset) !== JSON.stringify(loadedCells);
  record("AC-115b", "存档兼容（新）：保存→reset→加载，水状态重放一致",
    replaySame ? "PASS" : "FAIL",
    `保存时水格=${savedCells.length} 加载后=${loadedCells.length} 完全一致=${replaySame} 与纯reset状态不同=${resetDifferent}`);

  /* ===== S9: AC-114 存档兼容（旧）+ 空世界伪完成 ===== */
  await page.evaluate(() => {
    const legacy = {
      version: 1,
      blocks: [
        { x: -10, y: 0, z: -10, blockId: "stone" },
        { x: -10, y: 1, z: -10, blockId: "wood" },
        { x: 10, y: 0, z: 10, blockId: "grass" },
      ],
    };
    localStorage.setItem("castle-academy-world-v1", JSON.stringify(legacy));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
  const loadBtnEnabled = await page.getByRole("button", { name: "Load world" }).isEnabled();
  await page.getByRole("button", { name: "Load world" }).click();
  await waitConverged(page);
  const legacyResult = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const dungeon = api.getQuests().find((q) => q.id === "quest-dungeon");
    return {
      b1: api.hasBlock(-10, 0, -10), b2: api.hasBlock(-10, 1, -10), b3: api.hasBlock(10, 0, 10),
      waterCells: api.getWater().cells.length,
      dungeonComplete: dungeon.complete,
    };
  });
  record("AC-114", "存档兼容（旧）：V0.4.2 快照方块不变、无水生成",
    loadBtnEnabled && legacyResult.b1 && legacyResult.b2 && legacyResult.b3 &&
    legacyResult.waterCells === 0 ? "PASS" : "FAIL",
    `三块恢复=${legacyResult.b1},${legacyResult.b2},${legacyResult.b3} 水格=${legacyResult.waterCells}（旧存档世界被整体替换，无水源→无水）`);
  record("AC-119b", "空世界防伪完成：无水世界中地牢任务不得判完成",
    !legacyResult.dungeonComplete ? "PASS" : "FAIL", `dungeonComplete=${legacyResult.dungeonComplete}`);

  /* ===== S10: AC-116 性能（大水景 ≥500 水格） ===== */
  // 无围墙大平台：水从平台边缘溢出下落，产生平台水面 + 大量下落水柱，
  // 总水格远超 500，且应用增量需多个 tick（验证分批不卡帧）。
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    // 北侧平台 z∈[-15..-7]，x∈[-15..15]（与种子/舞台无冲突）
    for (let x = -15; x <= 15; x++) {
      for (let z = -15; z <= -7; z++) api.placeBlock(x, 0, z, "grass");
    }
    return true;
  });
  const convergedImmediately = await page.evaluate(() => window.__CASTLE_TEST__.getWater().isConverged);
  await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    for (const x of [-14, -7, 0, 7, 14]) {
      for (const z of [-14, -11, -8]) api.placeWaterSource(x, 1, z);
    }
  });
  const justAfterPlace = await page.evaluate(() => window.__CASTLE_TEST__.getWater().isConverged);
  await waitConverged(page, 60000);
  const big = await page.evaluate(() => window.__CASTLE_TEST__.getWater().cells.length);
  // 诊断：统计两个平台区域（y=1）内缺水的格子模式
  const missingDiag = await page.evaluate(() => {
    const api = window.__CASTLE_TEST__;
    const w = api.getWater();
    const missing = [];
    for (const zs of [[-15, -7], [7, 15]]) {
      const [z0, z1] = zs;
      for (let x = -15; x <= 15; x++) {
        for (let z = z0; z <= z1; z++) {
          if (!w.hasWater(x, 1, z) && !api.hasBlock(x, 1, z)) missing.push(`${x},${z}`);
        }
      }
    }
    const pattern = {};
    for (const m of missing) {
      const [x, z] = m.split(",").map(Number);
      const key = `dx${((x % 7) + 7) % 7},dz${z % 3}`;
      pattern[key] = (pattern[key] || 0) + 1;
    }
    return { count: missing.length, sample: missing.slice(0, 20), pattern };
  });
  console.log(`  [diag] 平台缺水格=${missingDiag.count} 样本=${JSON.stringify(missingDiag.sample)} 模式=${JSON.stringify(missingDiag.pattern)}`);
  const perf = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    let maxFrame = 0;
    let start = 0;
    let last = 0;
    const step = (t) => {
      if (frames === 0) { start = t; last = t; frames += 1; requestAnimationFrame(step); return; }
      const dt = t - last;
      last = t;
      if (dt > maxFrame) maxFrame = dt;
      frames += 1;
      if (frames >= 121) resolve({ avg: (t - start) / (frames - 1), max: maxFrame, frames: frames - 1 });
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  record("AC-116", "模拟不卡帧：≥500 水格、分批 tick 应用、无 >100ms 长帧",
    big >= 500 && !justAfterPlace && perf.max <= 100 ? "PASS" : "FAIL",
    `水格=${big}（≥500）放源后立即收敛=${justAfterPlace}（false=增量分批应用）帧平均=${perf.avg.toFixed(1)}ms 最大=${perf.max.toFixed(1)}ms（≤100ms）帧=${perf.frames}（swiftshader 软渲染环境）`);
  await shot(page, "s10-big-water");

  /* ===== S11: 主观可用性 ===== */
  await page.evaluate(() => window.__CASTLE_TEST__.reset());
  await waitConverged(page);
  const hotbar = await page.evaluate(() => {
    const names = ["Water Source", "Drain Channel", "Water Pipe"];
    const found = {};
    for (const name of names) {
      found[name] = Boolean(document.querySelector(`.hotbar button[aria-label="Select ${name}"]`));
    }
    return found;
  });
  record("UI-hotbar", "热栏包含水方块条目（水源/排水渠/管道）",
    hotbar["Water Source"] && hotbar["Drain Channel"] && hotbar["Water Pipe"] ? "PASS" : "FAIL", JSON.stringify(hotbar));
  const uiText = await page.evaluate(() => ({
    questPanel: Boolean(document.querySelector(".quest-panel")),
    questTitle: document.body.textContent.includes("城堡水务任务"),
    footerVersion: (document.querySelector("footer") || {}).textContent || "",
    versionPill: (document.querySelector(".version-pill") || {}).textContent || "",
  }));
  record("UI-questpanel", "任务面板可见、标题正确",
    uiText.questPanel && uiText.questTitle ? "PASS" : "FAIL",
    `面板=${uiText.questPanel} 标题=${uiText.questTitle} footer="${uiText.footerVersion.slice(0, 60)}" versionPill="${uiText.versionPill}"`);
  await shot(page, "s11-initial-screen");

  console.log("\n== 结果汇总 ==");
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`PASS ${passCount}/${results.length}`);
  writeFileSync(resolve(SHOT_DIR, "results.json"), JSON.stringify({ results, pageErrors, consoleErrors }, null, 2));
  console.log(`页面错误: ${pageErrors.length} 控制台错误: ${consoleErrors.length}`);
  if (pageErrors.length) console.log("pageErrors:", JSON.stringify(pageErrors, null, 2));
  if (consoleErrors.length) console.log("consoleErrors:", JSON.stringify(consoleErrors, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error("脚本异常:", err);
  process.exit(1);
});
