import { test, expect } from "@playwright/test";

/**
 * V51-008 — 档案域 / 任务运行时测试钩子 E2E（AC-201/202/211/215）。
 * 只用 `__CASTLE_TEST__` 暴露的公共钩子，不改 V0.5 任何既有 E2E。
 */

test("V0.51 测试钩子：三任务、默认无档案、独立 localStorage key", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  const result = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return {
      missions: a.getMissions().map((m: { id: string; status: string }) => ({ id: m.id, status: m.status })),
      profile: a.getActiveProfile(),
      quests: a.getQuests().length,
      keys: Object.keys(localStorage).sort()
    };
  });
  expect(result.missions).toHaveLength(9);
  expect(result.missions.slice(0, 3).map((m: { id: string }) => m.id)).toEqual([
    "mission.moat.v1", "mission.well.v1", "mission.dungeon.v1"
  ]);
  expect(result.quests).toBe(3); // 旧 quest.updated 契约仍可用
  expect(result.profile).toBeNull();
  expect(result.keys).not.toContain("castle.academy.learner");
});

test("创建档案写入独立 key，刷新后恢复；世界存档无档案字段", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  const created = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    const result = a.setProfile("小小工程师", "8-10");
    a.activateMission("mission.moat.v1");
    a.useHint("mission.moat.v1");
    return { ok: result.ok, nickname: result.profile?.nickname };
  });
  expect(created).toEqual({ ok: true, nickname: "小小工程师" });

  const stored = await page.evaluate(() => ({
    learner: localStorage.getItem("castle.academy.learner"),
    world: localStorage.getItem("castle-academy-world-v1")
  }));
  expect(stored.learner).toContain("小小工程师");
  expect(stored.learner).toContain('"hintsUsed":1');
  expect(stored.world ?? "").not.toContain("小小工程师");

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  const restored = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return {
      nickname: a.getActiveProfile()?.nickname,
      status: a.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status,
      hints: a.getHintsUsed("mission.moat.v1")
    };
  });
  expect(restored).toEqual({ nickname: "小小工程师", status: "active", hints: 1 });
});

test("多档案切换：任务进度按档案隔离", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  const result = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    const first = a.setProfile("甲", "6-7");
    a.activateMission("mission.moat.v1");
    const second = a.setProfile("乙", "11-12");
    const afterB = a.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status;
    a.switchProfile(first.profile.id);
    const afterA = a.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status;
    return { afterA, afterB, profiles: a.listProfiles().length, secondOk: second.ok };
  });
  expect(result).toEqual({ afterA: "active", afterB: "available", profiles: 2, secondOk: true });
});

test("档案损坏：容错重置且应用照常启动", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("castle.academy.learner", "{broken-json");
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  const result = await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    return { notice: a.consumeLearnerNotice(), missions: a.getMissions().length, profile: a.getActiveProfile() };
  });
  expect(result.notice).toContain("已重置");
  expect(result.missions).toBe(9);
  expect(result.profile).toBeNull();
  expect(pageErrors).toEqual([]);
});
