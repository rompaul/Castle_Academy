import { test, expect } from "@playwright/test";

/**
 * V51-015 — 任务批次 1（水主题延伸 6 个）验收（AC-230/212/214）。
 * 只用 `__CASTLE_TEST__` 公共钩子；不改 V0.5 任何既有 E2E。
 */
const NEW_IDS = [
  "mission.water-flow.v1",
  "mission.seven-steps.v1",
  "mission.channel-dam.v1",
  "mission.garden-water.v1",
  "mission.broken-pipe.v1",
  "mission.reservoir.v1"
];

async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
}

test("Content Pack 15 个任务：迁移 3 个在前、批次 1 六个字段齐全且种子世界不伪完成", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return {
      definitions: a.getMissionDefinitions().map((m: any) => ({
        id: m.id,
        title: m.title,
        ageScope: m.ageScope,
        hintCount: m.hintLadder.length,
        evaluatorId: m.evaluatorId,
        progressLanguage: m.progressLanguage,
        reward: m.reward?.title
      })),
      statuses: a.getMissions().map((m: { id: string; status: string }) => ({ id: m.id, status: m.status }))
    };
  });
  expect(result.definitions).toHaveLength(15);
  expect(result.definitions.slice(0, 3).map((m: { id: string }) => m.id)).toEqual([
    "mission.moat.v1", "mission.well.v1", "mission.dungeon.v1"
  ]);
  const added = result.definitions.slice(3, 9);
  expect(added.map((m: { id: string }) => m.id)).toEqual(NEW_IDS);
  for (const mission of added) {
    expect(mission.title.length).toBeGreaterThan(2);
    expect(mission.hintCount).toBeGreaterThanOrEqual(2);
    expect(mission.evaluatorId).toMatch(/^evaluator\.[a-z0-9-]+$/);
    expect(mission.progressLanguage).toContain("{done}");
    expect(mission.reward.length).toBeGreaterThan(0);
  }
  expect(new Set(result.definitions.map((m: { ageScope: string }) => m.ageScope)).size).toBeGreaterThanOrEqual(3);
  // 种子世界不得让任何新任务自动完成
  for (const id of NEW_IDS) {
    expect(result.statuses.find((s: { id: string }) => s.id === id)?.status).not.toBe("completed");
  }
});

test("V0.5 护城河完成动作不会连带完成任何新增任务（AC-215 兼容回归）", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    a.placeWaterSource(5, 1, 0);
    a.placeWaterSource(-5, 1, 0);
    a.placeWaterSource(0, 1, 5);
    a.placeWaterSource(0, 1, -5);
  });
  await expect(page.getByTestId("reward-reveal")).toBeVisible({ timeout: 15000 });
  const statuses = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().map((m: { id: string; status: string }) => ({ id: m.id, status: m.status }))
  );
  expect(statuses.find((s: { id: string }) => s.id === "mission.moat.v1")?.status).toBe("completed");
  for (const id of NEW_IDS) {
    expect(statuses.find((s: { id: string }) => s.id === id)?.status, id).not.toBe("completed");
  }
  // 幂等用例会再追加一个 (5,2,0) 水源，同样不得误完成
  await page.getByTestId("reward-reveal").getByRole("button", { name: "自由建造" }).click();
  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeWaterSource(5, 2, 0));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().filter((m: { status: string }) => m.status === "completed").map((m: { id: string }) => m.id)
  );
  expect(after).toEqual(["mission.moat.v1"]);
});

test("渠与坝的选择：造出渠 + 砖坝后确定性完成，奖励只发一次", async ({ page }) => {
  await boot(page);
  const placed = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return [
      a.placeBlock(0, 2, 0, "drain_channel"),
      a.placeBlock(0, 1, 0, "brick"),
      a.placeBlock(1, 1, 0, "brick"),
      a.placeBlock(2, 1, 0, "brick")
    ];
  });
  expect(placed).toEqual([true, true, true, true]);
  await expect.poll(() => page.evaluate(() => (window as any).__CASTLE_TEST__.getWater().isConverged), { timeout: 10000 }).toBe(true);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.refreshMissions());
  await expect(page.getByTestId("reward-reveal")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("reward-reveal")).toContainText("渠与坝的选择完成了！");
  await expect(page.getByTestId("reward-title")).toContainText("渠坝试验师");
  await expect.poll(() => page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().find((m: { id: string }) => m.id === "mission.channel-dam.v1")?.status
  )).toBe("completed");
  await page.evaluate(() => (window as any).__CASTLE_TEST__.refreshMissions());
  await expect(page.getByTestId("reward-reveal")).toHaveCount(1); // 幂等，不重复发奖
});
