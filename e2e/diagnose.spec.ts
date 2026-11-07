import { test, expect } from "@playwright/test";

test("diagnose: check block count and underground visibility", async ({ page }) => {
  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => consoleLogs.push(`pageerror: ${err.message}`));

  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  // 1. 检查初始方块计数（应包含地下边框，共 44+32=76）
  const initialCount = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());
  console.log(`INITIAL_BLOCK_COUNT: ${initialCount}`);

  // 2. 进入世界
  await page.getByRole("button", { name: /Enter World/i }).click();
  await page.waitForTimeout(1000);

  // 3. 再次检查方块计数
  const countAfterEnter = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());
  console.log(`BLOCK_COUNT_AFTER_ENTER: ${countAfterEnter}`);

  // 4. 检查地下边框位置（y=-4 边框，不包括中心）
  const hasUndergroundEdge = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.hasBlock(4, -4, 0)
  );
  const hasUndergroundCenter = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.hasBlock(0, -4, 0)
  );
  console.log(`HAS_BLOCK_AT_Y_MINUS_4_EDGE_X4: ${hasUndergroundEdge}`);
  console.log(`HAS_BLOCK_AT_Y_MINUS_4_CENTER: ${hasUndergroundCenter}`);

  // 5. 检查视图模式
  const sectionView = await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView());
  console.log(`SECTION_VIEW: ${JSON.stringify(sectionView)}`);

  // 6. 检查图层可见性
  const groundVis = await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("ground"));
  const basementVis = await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("basement-1"));
  console.log(`GROUND_VISIBILITY: ${groundVis}`);
  console.log(`BASEMENT_VISIBILITY: ${basementVis}`);

  // 7. 在地下放置一个测试方块
  const placed = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.placeBlock(0, -4, 0, "grass")
  );
  console.log(`PLACE_BLOCK_AT_Y_MINUS_4: ${placed}`);

  const countAfterPlace = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());
  console.log(`BLOCK_COUNT_AFTER_PLACE: ${countAfterPlace}`);

  // 8. 截图保存
  await page.screenshot({ path: "/tmp/castle-diagnosis.png", fullPage: true });
  console.log("SCREENSHOT_SAVED: /tmp/castle-diagnosis.png");

  // 9. 输出所有控制台日志
  console.log("CONSOLE_LOGS:");
  consoleLogs.forEach((log) => console.log(log));

  // 断言：地下 y=-4 边框应该有方块（来自 seedWorld）
  expect(hasUndergroundEdge).toBe(true);
});
