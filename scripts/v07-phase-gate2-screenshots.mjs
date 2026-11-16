/**
 * V07-022 — STOP GATE-2 截图材料（只产出截图与只读诊断，不做像素判定、不改 canonical）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173（由外部临时启动，脚本结束前须显式停止）
 * 用法：node scripts/v07-phase-gate2-screenshots.mjs
 * 产出：docs/v0.7/screenshots/gate2/*.png（14 张，对应 03_UI/V07_Screen_Inventory.md S1~S14）
 * 参考图：03_UI/references/m1~m8.svg
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = resolve(process.cwd(), "docs/v0.7/screenshots/gate2");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

const shotNames = [];
const failures = [];

async function shot(name) {
  try {
    await page.screenshot({ path: resolve(OUT, `${name}.png`) });
    shotNames.push(name);
    console.log(`SHOT ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error)}`);
    console.log(`SHOT FAIL ${name}: ${String(error)}`);
  }
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (error) {
    failures.push(`${name}: ${String(error)}`);
    console.log(`STEP FAIL ${name}: ${String(error)}`);
  }
}

async function dismissIfVisible(locator) {
  try {
    if (await locator.count() && await locator.first().isVisible()) {
      await locator.first().click();
      await page.waitForTimeout(200);
    }
  } catch { /* 非阻断 */ }
}

async function closeDetail() {
  await dismissIfVisible(page.getByRole("button", { name: "关闭任务详情" }));
}

async function dismissOverlays() {
  await dismissIfVisible(page.getByTestId("electrical-safety-dismiss"));
  // 同一次重算可能同时完成多个任务，奖励卡会排队逐张出现，需逐张关掉
  for (let i = 0; i < 6; i++) {
    const reward = page.getByTestId("reward-reveal");
    if (!(await reward.count()) || !(await reward.first().isVisible())) break;
    const free = reward.getByRole("button", { name: "自由建造" });
    if (!(await free.count())) break;
    await free.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * 奖励卡的「自由建造」会触发 closeNow()，把 pinned / explicitOpen / hovered 全部清掉，
 * 侧栏随之收起（data-open=false、任务卡卸载）。这里用始终渲染在 {open && ...} 之外的
 * .ca-sidebar-toggle 走官方 onToggleOpen 重新展开，再按需固定；固定按钮用 exact 匹配，
 * 避免误命中 aria-label="取消固定侧栏" 把已固定状态翻回未固定。
 */
async function ensureSidebarOpen() {
  const sidebar = page.locator('[data-testid="mission-sidebar"]');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await sidebar.getAttribute("data-open") === "true") break;
    // .ca-sidebar 外层是 pointer-events:none，直接 hover 该元素不会派发 onMouseEnter；
    // 只有左缘 16px 的 .ca-sidebar-strip 有 pointer-events:auto，移到这里才会触发官方 onOpen。
    await page.mouse.move(6, 300);
    await page.waitForTimeout(180);
    if (await sidebar.getAttribute("data-open") !== "true") {
      // 兜底：仅当热区没生效时才点 toggle（避免 mouseenter 已展开后又点一次被 toggleOpen 收起）
      await page.locator(".ca-sidebar-toggle").click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(180);
    }
  }
  const pin = page.getByRole("button", { name: "固定侧栏", exact: true }).first();
  if (await pin.count() && await pin.first().isVisible()) {
    await pin.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function openMission(title) {
  // 先清掉模态奖励卡，否则背景遮罩会拦住「关闭任务详情」与侧栏按钮
  await dismissOverlays();
  await closeDetail();
  await ensureSidebarOpen();
  const sidebarState = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="mission-sidebar"]');
    const toggle = document.querySelector(".ca-sidebar-toggle");
    return {
      open: sidebar?.getAttribute("data-open") ?? null,
      cards: document.querySelectorAll(".ca-mission-card").length,
      toggleLabel: toggle?.getAttribute("aria-label") ?? null,
      rewards: document.querySelectorAll('[data-testid="reward-reveal"]').length,
      detail: document.querySelectorAll('[data-testid="mission-detail"]').length,
      evidence: document.querySelectorAll(".ca-evidence-panel").length
    };
  });
  console.log(`OPEN ${title} ${JSON.stringify(sidebarState)}`);
  const card = page.getByRole("button", { name: new RegExp(title) }).first();
  await card.scrollIntoViewIfNeeded({ timeout: 8000 });
  await card.click();
  await page.waitForTimeout(350);
  await dismissOverlays();
}

async function scrollDetailToBottom() {
  await page.locator('[data-testid="mission-detail"]')
    .evaluate((el) => { el.scrollTop = el.scrollHeight; })
    .catch(() => {});
  await page.waitForTimeout(200);
}

/** 形式专属组件挂在详情面板反射提示之后，必须滚到面板底部才能拍到。 */
async function shotFormArea(name) {
  await scrollDetailToBottom();
  await shot(name);
}

async function scrollSidebarToBottom() {
  await page.locator('[data-testid="mission-sidebar"] .ca-sidebar-panel')
    .evaluate((el) => { el.scrollTop = el.scrollHeight; })
    .catch(() => {});
  await page.waitForTimeout(250);
}

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
await page.waitForTimeout(900);
await page.addStyleTag({
  content: `
    .welcome-overlay { display: none !important; }
    /* S1 只临时隐藏首次建档引导卡，取证后立即移除；不改动产品状态 */
    body.ca-shot-clean .ca-onboarding { display: none !important; }
  `
});

/* S1 干净世界主视图（3D 零变化区域） */
await page.evaluate(() => document.body.classList.add("ca-shot-clean"));
await shot("v07-clean-world");
await page.evaluate(() => document.body.classList.remove("ca-shot-clean"));

/* 建档进入世界并固定侧栏（沿用 V0.6.1 引导路径） */
await safe("onboarding", async () => {
  await page.getByTestId("onboarding-nickname").fill("小小工程师");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "年龄段 8-10" }).click();
  await page.getByRole("button", { name: /进入世界/ }).click();
  await page.waitForTimeout(600);
  const collapse = page.getByRole("button", { name: "收起任务侧栏" });
  if (!(await collapse.count()) || !(await collapse.first().isVisible())) {
    await page.getByRole("button", { name: "打开任务侧栏" }).first().click();
  }
  await page.getByRole("button", { name: "固定侧栏" }).first().click();
  await page.waitForTimeout(350);
});

/* S2 任务侧栏展开（24 条） */
await shot("v07-s1-mission-sidebar");

/* S3 侧栏末尾六个形式专属任务（本版未做「按形式浏览」独立页，见对照报告） */
await safe("sidebar-bottom", async () => {
  await scrollSidebarToBottom();
});
await shot("v07-s2-six-forms");

/* S12 先决条件锁定态（必须在解锁前拍） */
await safe("locked", async () => {
  await openMission("给城堡选一条水路");
  await page.waitForTimeout(200);
  await shot("v07-s11-locked");
});

/* S4 Exploration 观察清单 + 顺手完成以解锁 life-simulation */
await safe("observation", async () => {
  await openMission("水在哪里出现");
  await shotFormArea("v07-s3-observation-list");
  for (const target of ["water-source", "channel-end", "moat-side"]) {
    const chip = page.getByTestId(`v07-observe-${target}`);
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(180);
    }
  }
  await page.waitForTimeout(500);
  await dismissOverlays();
});

/* S5 Experiment 两态对照：同一位置合上 / 断开 + 灯亮 / 不亮 */
await safe("variable-compare", async () => {
  await openMission("同一个开关，按两下");
  await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    t.placeBlock(0, 2, 0, "power_source_low_voltage");
    t.placeBlock(1, 2, 0, "wire_basic");
    t.placeBlock(2, 2, 0, "switch_closed");
    t.placeBlock(3, 2, 0, "wire_basic");
    t.placeBlock(4, 2, 0, "lamp_basic");
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const t = window.__CASTLE_TEST__;
    t.removeBlock(2, 2, 0);
    t.placeBlock(2, 2, 0, "switch_open");
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__CASTLE_TEST__.refreshMissions());
  await page.waitForTimeout(900);
  const switchState = await page.evaluate(() => ({
    observations: window.__CASTLE_TEST__.getElectrical().switchObservations,
    mission: window.__CASTLE_TEST__.getMissions()
      .find((m) => m.id === "mission.switch-compare.v1")
  }));
  console.log(`SWITCH_STATE ${JSON.stringify(switchState)}`);
  // V0.7 修复 completionSuppressed 后本任务会真的完成，完成弹层会盖住画面中央。
  // 关掉弹层（其「自由建造」会收起详情）后重新打开同一任务，两态数据仍来自电力插件内存。
  await dismissOverlays();
  await openMission("同一个开关，按两下");
  await shotFormArea("v07-s4-variable-compare");
});

/* S6 Problem-solving 假设切换 */
await safe("hypothesis", async () => {
  await openMission("花园为什么没水");
  await scrollDetailToBottom();
  const chip = page.getByTestId("v07-hypothesis-break");
  if (await chip.count()) await chip.click();
  await page.waitForTimeout(250);
  await shotFormArea("v07-s5-hypothesis");
});

/* S7 Life simulation 情境决策（已在上面解锁） */
await safe("decision", async () => {
  await openMission("给城堡选一条水路");
  await scrollDetailToBottom();
  const choice = page.getByTestId("v07-choice-near-stream");
  if (await choice.count()) await choice.click();
  await page.waitForTimeout(250);
  await shotFormArea("v07-s6-decision");
});

/* S8 Communication 本地解释卡 + 既有文字证据输入 */
await safe("explanation", async () => {
  await openMission("把我的理由说清楚");
  await shotFormArea("v07-s7-local-explanation");
});

/* S9 反思输入（可选、可跳过）：单独取景到「说一说」卡片，避免与 S8 截图重复 */
await safe("reflection", async () => {
  await page.locator('[data-testid="mission-detail"]').evaluate((el) => {
    const node = document.getElementById("v07-reflection");
    if (!node) return;
    const top = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTop = Math.max(0, top - 48);
  });
  await page.locator("#v07-reflection").focus().catch(() => {});
  await page.waitForTimeout(250);
  await shot("v07-s8-reflection");
});

/* S10 本地证据面板展开（家长 / 教师人工回看，无等级 / 百分比） */
await safe("evidence", async () => {
  const summary = page.getByText("看看我留下了什么（给大人看）");
  if (await summary.count()) await summary.first().click();
  await page.waitForTimeout(250);
  await scrollDetailToBottom();
  await shot("v07-s9-evidence-panel");
});

/* S11 3 级提示展开 */
await safe("hints", async () => {
  await openMission("城堡里的一天");
  for (let i = 0; i < 3; i++) {
    const reveal = page.getByTestId("reveal-hint");
    if (await reveal.count()) await reveal.click();
    await page.waitForTimeout(120);
  }
  await page.locator('[data-testid="mission-detail"]')
    .evaluate((el) => { el.scrollTop = 0; }).catch(() => {});
  await shot("v07-s10-hints");
});

/* 附加：既有「我的证据」只读面板（掌握证据句卡，M8 主要比对对象） */
await safe("mastery-evidence", async () => {
  await closeDetail();
  const toggle = page.getByTestId("evidence-toggle");
  if (await toggle.count() && await toggle.first().isVisible()) {
    await toggle.first().click();
    await page.waitForTimeout(350);
    await shot("v07-s14-mastery-evidence");
    await toggle.first().click();
    await page.waitForTimeout(200);
  }
});

/* S13 电力帮助面板 + MC 式 9 格栏 / 分类面板（DDR-0002 白名单，零变化） */
await safe("hud", async () => {
  await closeDetail();
  await dismissOverlays();
  await page.keyboard.press("e");
  await page.waitForTimeout(350);
  await shot("v07-s12-hud-unchanged");
  await page.keyboard.press("e");
});

/* S14 空态 / 跳过反思：未写任何反思时中性确认 */
await safe("empty-skip", async () => {
  await openMission("水在哪里出现");
  await scrollDetailToBottom();
  await shot("v07-s13-empty-skip");
});

/* S14 空态 / 跳过反思 */
/* 只读诊断（含 WCAG 对比度实测） */
const diagnostics = await page.evaluate(() => {
  const parseRgb = (value) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const luminance = ([r, g, b]) => {
    const channel = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (fg, bg) => {
    const a = luminance(fg), b = luminance(bg);
    return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
  };
  // 用离屏探针一次性取到全部新增类的计算样式，避免受「当前打开哪种形式」影响
  const probe = document.createElement("div");
  probe.className = "ca-v07-section";
  probe.style.cssText = "position:absolute;left:-9999px;top:0;width:220px;";
  const classes = ["ca-v07-label", "ca-v07-empty", "ca-v07-pair-state", "ca-v07-chip", "ca-v07-list"];
  for (const cls of classes) {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = "对比度探针";
    probe.appendChild(el);
  }
  document.body.appendChild(probe);
  const sectionBg = parseRgb(getComputedStyle(probe).backgroundColor);
  const contrast = classes.map((cls) => {
    const el = probe.querySelector(`.${cls}`);
    const style = getComputedStyle(el);
    const ownBgRaw = style.backgroundColor;
    const ownBg = /transparent|rgba\(0, 0, 0, 0\)/.test(ownBgRaw)
      ? sectionBg : (parseRgb(ownBgRaw) ?? sectionBg);
    const fg = parseRgb(style.color);
    return {
      selector: `.${cls}`,
      fg: style.color,
      bg: /transparent|rgba\(0, 0, 0, 0\)/.test(ownBgRaw)
        ? getComputedStyle(probe).backgroundColor : ownBgRaw,
      ratio: fg && sectionBg ? ratio(fg, ownBg) : null
    };
  });
  probe.remove();

  const defs = window.__CASTLE_TEST__.getMissionDefinitions();
  const v07 = defs.slice(18).map((d) => ({
    id: d.id,
    title: d.title,
    form: d.expressionForms[0],
    ageScope: d.ageScope,
    hintCount: d.hintLadder.length
  }));
  const detail = document.querySelector('[data-testid="mission-detail"]');
  return {
    totalMissions: defs.length,
    forms: [...new Set(defs.flatMap((d) => d.expressionForms))].sort(),
    v07,
    reflectionInputPresent: Boolean(document.getElementById("v07-reflection")),
    localEvidencePresent: Boolean(document.querySelector('[data-testid="v07-local-evidence"]')),
    contrast,
    detailText: (detail?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1200)
  };
});

writeFileSync(resolve(OUT, "gate2-diagnostics.json"), JSON.stringify({
  url: BASE_URL,
  screenshotCount: shotNames.length,
  screenshots: shotNames,
  pageErrors,
  stepFailures: failures,
  diagnostics
}, null, 2));

console.log(`SHOTS ${shotNames.length}/14`);
console.log(`PAGE_ERRORS ${JSON.stringify(pageErrors)}`);
console.log(`STEP_FAILURES ${JSON.stringify(failures)}`);
console.log(`FORMS ${JSON.stringify(diagnostics.forms)}`);
await browser.close();
