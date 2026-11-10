import { test, expect, type Page } from "@playwright/test";

/** V51-013 — 首次进入引导 / 多档案选择（AC-204/205/226、S1/S2/S3） */

async function boot(page: Page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await expect(page.getByTestId("onboarding-flow")).toBeVisible();
}

test("无档案 → 昵称引导；不自动聚焦；可跳过到自由建造", async ({ page }) => {
  await boot(page);
  const flow = page.getByTestId("onboarding-flow");
  await expect(flow).toContainText("创建你的工程师铭牌");
  await expect(flow).toContainText("只用昵称就好，不用真实姓名");
  await expect(flow).toContainText("本地保存 · 无账号 · 无网络");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).not.toBe("INPUT");

  await flow.getByRole("button", { name: /跳过/ }).click();
  await expect(page.getByTestId("onboarding-flow")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enter World/i })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("castle.academy.learner"))).toBeNull();
});

test("昵称校验 + 年龄段选择 + 创建档案；侧栏自动展开并高亮首个任务", async ({ page }) => {
  await boot(page);
  const flow = page.getByTestId("onboarding-flow");
  await flow.getByRole("button", { name: "下一步" }).click();
  await expect(flow.getByRole("alert")).toContainText("1~16");

  const input = page.getByTestId("onboarding-nickname");
  await input.fill("一二三四五六七八九十一二三四五六七"); // 17 字
  await flow.getByRole("button", { name: "下一步" }).click();
  await expect(flow.getByRole("alert")).toContainText("1~16");

  await input.fill("小小工程师");
  await flow.getByRole("button", { name: "下一步" }).click();
  await expect(flow).toContainText("你多大啦？");
  await expect(flow).toContainText("家长说明");
  await expect(flow).toContainText("不显示难度标签");

  await flow.getByRole("button", { name: /进入世界/ }).click();
  await expect(flow.getByRole("alert")).toContainText("请选择一个年龄段");
  await flow.getByRole("button", { name: "年龄段 8-10" }).click();
  await flow.getByRole("button", { name: /进入世界/ }).click();

  await expect(page.getByTestId("onboarding-flow")).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem("castle.academy.learner"));
  expect(stored).toContain("小小工程师");
  expect(stored).toContain('"ageBand":"8-10"');
  await expect(page.getByTestId("mission-sidebar")).toHaveAttribute("data-open", "true");
  const first = page.getByRole("button", { name: /注满护城河/ });
  await expect(first).toHaveAttribute("data-selected", "true");
});

test("已有档案 → 选择页；切换档案 / 新建铭牌 / 跳过均可用", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    a.setProfile("小小工程师", "8-10");
    a.setProfile("塔楼设计师", "11-12");
    a.switchProfile("__nonexistent__");
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  const flow = page.getByTestId("onboarding-flow");
  await expect(flow).toContainText("选择你的铭牌");
  await expect(flow).toContainText("小小工程师");
  await expect(flow).toContainText("塔楼设计师");

  await flow.getByRole("button", { name: "档案 小小工程师" }).click();
  await flow.getByRole("button", { name: "进入世界" }).click();
  await expect(flow).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getActiveProfile()?.nickname)).toBe("小小工程师");
});

test("新建铭牌入口可从选择页回到昵称步骤", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setProfile("甲", "6-7"));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.getByRole("button", { name: /新建铭牌/ }).click();
  await expect(page.getByTestId("onboarding-flow")).toContainText("创建你的工程师铭牌");
});
