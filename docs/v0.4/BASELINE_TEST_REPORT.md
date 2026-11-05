# V0.4 Baseline Test Report — Task V04-002

**Task ID:** V04-002  
**Status:** PASS  
**Repository:** D:\data\project\Castle_Academy\Castle_Academy_V0.1_Source  
**Version:** 0.3.0  
**Environment:** Node v24.14.0, npm 11.9.0, node_modules 已安装（无需 npm ci）

## 1. Baseline Test Results

| 命令 | 结果 | 退出码 | 说明 |
|---|---|---|---|
| `npm run verify:source` | PASS | 0 | 33 源码/配置文件扫描，导入/包声明/脚本均解析 |
| `npm run typecheck` | PASS | 0 | `tsc -b --pretty false` 无类型错误 |
| `npm test` | PASS | 0 | vitest 9 个文件 / 46 个测试全部通过 |
| `npm run build` | PASS | 0 | `tsc -b && vite build` 成功，dist 产出正常（chunk size 提示仅为警告） |
| `npm run test:e2e` | 7/8 PASS | 1 | Playwright Chromium，8 项中 7 通过，1 项失败（见下方） |

## 2. E2E 失败详情（V0.3 已知缺陷，非 V0.4 新缺陷）

- 测试：`e2e\persistence.spec.ts` "save persists placed blocks across page reload"
- 失败点：页面 reload 后，`Load world` 按钮仍为 `disabled` 状态，未能从 `hasSavedWorld` React state 恢复。
- 原因分析：页面刷新后 React 组件重新挂载，`hasSavedWorld` state 重置为初始值 `false`；`onPersistenceReady` 回调在 `GameCanvas` 挂载时调用，但 state 更新时序导致按钮未及时启用。
- 判定：这是 V0.3 已存在的缺陷，与 V0.4 负 Y 坐标、图层、剖面等新功能无关，**不应阻断 V04-003 坐标调用点审计**。

## 3. Files Changed

无（基线测试，仅运行脚本，不修改源码）

## 4. Design / Interface Impact

无

## 5. Tests Added / Changed

无

## 6. Commands Actually Run & Exit Codes

| 命令 | 退出码 |
|---|---|
| `npm run verify:source` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run test:e2e` | 1（7/8 通过，1 项已知失败） |

## 7. Remaining Defects / Risks

- E2E 持久化跨页面刷新失败（Load 按钮未启用）：V0.3 已知缺陷，不归因于 V0.4，不阻断后续任务。
- 基线已建立，所有 V0.4 新缺陷将相对此基线比对。

## 8. Next Eligible Task ID

**V04-003 — Coordinate Call-site Audit**（全仓库搜索 `y >= 0`、`y < 64`、`isInsideBuildArea`、地面 mesh/terrain、raycaster target、玩家碰撞、保存/加载 schema 等调用点，输出 `docs/v0.4/COORDINATE_CALLSITE_AUDIT.md`）
