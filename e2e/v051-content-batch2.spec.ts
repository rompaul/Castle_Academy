import { test, expect, type Page } from "@playwright/test";

/**
 * V51-016 — 任务批次 2（跨年龄带 6 个）验收（AC-230/231/232）。
 * 只用 `__CASTLE_TEST__` 公共钩子与真实 UI；不改 V0.5 / 批次 1 既有 E2E。
 */
const CROSS_AGE_IDS = [
  "mission.count-bridge.v1",
  "mission.symmetric-gate.v1",
  "mission.measure-tower.v1",
  "mission.section-detective.v1",
  "mission.material-budget.v1",
  "mission.my-design-note.v1"
];

async function boot(page: Page, openSidebar = true) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  const skip = page.getByRole("button", { name: /跳过 · 自由建造/ });
  if (await skip.count()) await skip.first().click();
  if (openSidebar) await page.getByRole("button", { name: "打开任务侧栏" }).click();
}

async function status(page: Page, id: string) {
  return page.evaluate(
    (missionId) => (window as any).__CASTLE_TEST__.getMissions()
      .find((m: { id: string }) => m.id === missionId)?.status,
    id
  );
}

test("Content Pack 15 个任务：批次 2 六个字段齐全，覆盖 4 个年龄带与全部表达形式（AC-230/231）", async ({ page }) => {
  await boot(page, false);
  const defs = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissionDefinitions().map((m: any) => ({
      id: m.id,
      ageScope: m.ageScope,
      forms: m.expressionForms,
      hintCount: m.hintLadder.length,
      evaluatorId: m.evaluatorId,
      reward: m.reward?.title
    }))
  );
  expect(defs).toHaveLength(15);
  expect(defs.slice(9).map((d: { id: string }) => d.id)).toEqual(CROSS_AGE_IDS);
  for (const def of defs.slice(9)) {
    expect(def.hintCount).toBeGreaterThanOrEqual(2);
    expect(def.evaluatorId).toMatch(/^evaluator\.[a-z0-9-]+$/);
    expect(def.reward.length).toBeGreaterThan(0);
  }
  expect(new Set(defs.map((d: { ageScope: string }) => d.ageScope)).size).toBe(4);
  // V0.51 覆盖 5 种表达形式；life-simulation 留待 V0.6（AC-231 只需 ≥3）
  expect(new Set(defs.flatMap((d: { forms: string[] }) => d.forms)).size).toBe(5);
  expect(defs.filter((d: { forms: string[] }) => d.forms.includes("communication"))).toHaveLength(1);
  // 种子世界不得让批次 2 任何任务伪完成
  for (const id of CROSS_AGE_IDS) expect(await status(page, id)).not.toBe("completed");
});

test("交流类任务：UI 文字证据只校验最短长度，不写入任何存档（AC-232）", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: /我的设计说明/ }).click();
  const detail = page.getByTestId("mission-detail");
  await expect(detail).toBeVisible();
  const input = page.getByTestId("evidence-input");
  await expect(input).toBeVisible();
  await expect(page.getByTestId("evidence-status")).toContainText("不评判内容");

  await input.fill("太短");
  await page.getByTestId("evidence-submit").click();
  expect(await status(page, "mission.my-design-note.v1")).not.toBe("completed");

  const note = "我先铺了一层石头地板，再把水源放在上面";
  await input.fill(note);
  await page.getByTestId("evidence-submit").click();
  await expect(page.getByTestId("reward-reveal")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("reward-reveal")).toContainText("我的设计说明完成了！");
  await expect(page.getByTestId("reward-title")).toContainText("设计记录者");
  expect(await status(page, "mission.my-design-note.v1")).toBe("completed");
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getTextEvidence("mission.my-design-note.v1"))).toBe(note);
  // 文字证据只在运行时内存：localStorage 不得出现任何片段
  const stored = await page.evaluate(() => Object.values(localStorage).map(String).join(""));
  expect(stored).not.toContain(note);
  expect(stored).not.toContain("我先铺了一层");
});

test("测量塔高：未测量不放行，量过之后 5 层塔确定性完成", async ({ page }) => {
  await boot(page, false);
  const placed = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return [1, 2, 3, 4, 5].map((y) => a.placeBlock(2, y, 2, "brick"));
  });
  expect(placed).toEqual([true, true, true, true, true]);
  await expect.poll(() => page.evaluate(() => (window as any).__CASTLE_TEST__.getWater().isConverged), { timeout: 10000 }).toBe(true);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.refreshMissions());
  expect(await status(page, "mission.measure-tower.v1")).not.toBe("completed");
  await page.evaluate(() => (window as any).__CASTLE_TEST__.emitMeasurementUsed());
  await expect.poll(() => status(page, "mission.measure-tower.v1"), { timeout: 10000 }).toBe("completed");
  await expect(page.getByTestId("reward-reveal")).toContainText("测量塔高完成了！");
});

test("剖面侦探：未开剖面不放行，开剖面后地下标记确定性完成", async ({ page }) => {
  await boot(page, false);
  const placed = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return [0, 1, 2].map((x) => a.placeBlock(x, -8, 0, "brick"));
  });
  expect(placed).toEqual([true, true, true]);
  await expect.poll(() => page.evaluate(() => (window as any).__CASTLE_TEST__.getWater().isConverged), { timeout: 10000 }).toBe(true);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.refreshMissions());
  expect(await status(page, "mission.section-detective.v1")).not.toBe("completed");
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setSectionView({ enabled: true }));
  await expect.poll(() => status(page, "mission.section-detective.v1"), { timeout: 10000 }).toBe("completed");
  await expect(page.getByTestId("reward-reveal")).toContainText("剖面侦探完成了！");
});
