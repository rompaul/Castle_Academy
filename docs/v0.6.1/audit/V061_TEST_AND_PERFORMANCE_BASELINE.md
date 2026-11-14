# V061-005 测试与性能基线（V0.6.1）

**审计基线**：tag `v0.6.0` / `0bd6e4f`（测试运行于工作树 `1052a24`，源码与发布提交一致，仅 2 个 docs-only 提交）
**日期**：2026-11-13
**原则**：逐条记录实际命令与退出码；未运行项写 NOT RUN，绝不写 PASS。

## 1. 本轮实际运行的命令

| # | 命令 | 退出码 | 结果摘要 |
|---|---|---|---|
| 1 | `git status --short` | 0 | 工作树干净 |
| 2 | `npm run typecheck` | **0** | `tsc -b --pretty false` 无错误 |
| 3 | `npm run build` | **0** | `✓ built in 6.31s`；既有 chunk >500 kB 警告（V0.5.1 起既有现象） |
| 4 | `npm test -- --no-file-parallelism` | **0** | **30 文件 / 256 测试全通过**（7.50s） |
| 5 | `npx playwright test --workers=1` | **0** | **47/47**（4.3m）；Playwright 自管 webServer，端口 5173 无遗留进程 |
| 6 | `node scripts/v051-visual-regression.mjs` | **0** | 11 张截图；见 §2 |
| 7 | `node scripts/v051-perf.mjs` | **0** | 见 §3 |
| 8 | `node scripts/v042-perf.mjs` | **0** | 见 §3 |
| 9 | `npm run verify:source` | **1** | 既有 DEV-601，见 §5 |
| 10 | `git ls-remote origin ...` | 0 | 远程 master `1052a24` / tag peeled `0bd6e4f` |

**运行前提**：视觉与性能脚本需要 dev server，本轮用 `npx vite --host 127.0.0.1 --port 5173 --strictPort`（后台任务）启动，HTTP=200 后串行运行，结束后停止服务。E2E 由 Playwright config 的 `webServer` 自管，**未与 build 并行**。

## 2. 视觉回归（FACT）

输出 `REGRESSION`：

```json
{"comparable":true,"width":1280,"height":720,"totalPixels":921600,
 "differingPixels":11353,"diffRatio":1.232,
 "regionRatios":{
   "topbar":{"diffPixels":9948,"ratioPercent":10.226},
   "footer":{"diffPixels":1341,"ratioPercent":2.91},
   "questPanel":{"diffPixels":12,"ratioPercent":0.01},
   "worldCanvas":{"diffPixels":0,"ratioPercent":0}}}
```

- **worldCanvas 0 像素差** ✅（V0.6.1 干净世界硬门槛的当前基准）
- questPanel 0.01%（≤0.5%）✅
- topbar 10.226% / footer 2.91%：既有 **O-1** 外链字体噪声 + V0.6.0 版本文本，与 V0.6 Phase 4 的 10.2% / 2.8% 同型，非本轮回归。

**DEV-602 处置**：脚本 `shot()`（`:27-32`）无条件写 `docs/v0.51/screenshots/canonical/`，且 `:140-142` 无条件重截 `world-canvas-anchor-v051.png`；`--clean-only` 只跳过 S1~S8 与报告改写，仍会重截锚点且拿不到像素差。故本轮采用「备份 → 完整模式 → 逐字节恢复」：备份 10 张 canonical + 3 个 diffs 文件；运行后恢复；锚点 SHA `53b02a9b5493ccfc` 与 `git show HEAD:` 一致，`visual-regression.json` date 回到 `2026-11-10T11:36:23.138Z`，`git status --short` 为空。

**DEV-608（新发现，重要）**：`scripts/v051-visual-regression.mjs:15-16` 硬编码 `docs/v0.51/screenshots/canonical` 与 `diffs`；`:147` 硬编码 `docs/v0.5/screenshots/quest_panel_stage.png`。**V0.6 canonical 已产出（`docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png`、`world-main-v060.png`）但脚本未引用**。V061-025「以 V0.6 canonical 为干净世界锚点」必须新增/改造脚本，否则无法兑现；登记为实现期必修项，不阻塞 Phase 0。

## 3. 性能基线（FACT）

`scripts/v051-perf.mjs`：

- `missions: 15`、`drawCalls: 329`
- DOM 延迟：`profileRead` p95 0.035ms；其余项 p95 最高 0.9ms（详见脚本输出）

`scripts/v042-perf.mjs`（300 帧 × 3 组，同机同脚本）：

| 模式 | avgFrameMs | p95FrameMs | drawCalls | triangles | textures |
|---|---|---|---|---|---|
| flat（V0.4.1 path） | 45.15 | 50.1 | 329 | 3936 | 1 |
| textured（V0.4.2） | 46.90 | 50.1 | 329 | 3936 | 2 |
| textured run 2 | 46.39 | 50.1 | 329 | 3936 | 2 |

`frame-time delta (textured vs flat): -3.9% faster or equal`。

**D-2 口径（FACT + 决策）**：V0.6 Phase 0 曾实测同机同脚本 p95 差约 30 倍（1.4ms vs 96.2ms），因此**绝对帧时间阈值不适用**；V061-026 必须用同机同脚本 ABBA 配对判定，并记录干净世界 draw calls 不回归（当前 329）与新电力场景的单独实测值。

## 4. 基线数字汇总（供 GATE-1 与后续对比）

| 指标 | V0.6.1 Phase 0 基线 | 备注 |
|---|---|---|
| typecheck / build | 0 / 0 | — |
| 单测 | **256** | V0.5.1 为 215；不得把 215 当本版基线 |
| E2E | **47** | 含 V0.5 基线 20 条，一行未改 |
| worldCanvas 像素差 | **0** | 干净世界门槛 |
| draw calls | **329** | 干净世界 |
| localStorage key | 3 | 世界 / 视图 / 学习者 |
| AI 依赖 | 0 | — |

## 5. 已知失败与分类

| ID | 命令 | 退出码 | 性质 | 处置 |
|---|---|---|---|---|
| **DEV-601** | `npm run verify:source` | 1 | V0.5 遗留：`scripts/v05-quest-screenshots.mjs:5` import 未声明的 `playwright`（仅装了 `@playwright/test`）；脚本未被任何 npm script / config 引用 | 只读登记，**不修复**（V0.6 Phase 0 已按治理原则定案），不阻塞 V0.6.1 发布门禁 |
| **O-1** | 视觉回归 topbar/footer | — | 外链字体噪声 | 保留 canonical，留独立 DDR |
| E2E `load` 超时 | — | — | V0.6 期间偶发 dev server 冷编译抖动，复跑即过 | 本轮 47/47 一次通过，无抖动 |

## 6. NOT RUN 清单（本轮未运行，绝不写 PASS）

- V061-007 运行时 `buildBlockAtlas()` 的 `next` 实测（Phase 0 只读，未创建临时测试；本轮用静态解析给 31/64，见 `V061_BLOCK_ID_AND_ATLAS_MAP.md` §3）。
- 双态方案 Q-1 的 draw call 实测（须实现后 V061-012 记录）。
- 含电力方块新场景的 canonical 冻结与性能（V061-025/026）。
- 角色 B 独立验收（V061-024）。

## 7. 产物清理

`dist/`、`test-results/` 已移出仓库并删除；`docs/v0.51/screenshots/{canonical,diffs}` 恢复；后台 dev server 已停止。最终 `git status --short` 为空（随后仅新增 `docs/v0.6.1/audit/` 报告）。
