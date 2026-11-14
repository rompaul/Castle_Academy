# V061-007 Atlas 运行时容量实测（AC-6732）

**日期**：2026-11-13
**基线**：tag `v0.6.0` / `0bd6e4f`（工作树含 V061-004~007 未提交改动）
**性质**：FACT —— 真实调用 `buildBlockAtlas()` 的运行时实测，取代 Phase 0 的静态解析推导。

## 1. 实测方法

`src/rendering/electricalTextures.test.ts` 在 node 环境安装最小 Canvas 2D stub（记录 `fillRect` 像素序列、`drawImage` 空实现），
然后**真实调用** `buildBlockAtlas()`，按 `uvMap` 中的 `(col,row)` 去重统计唯一瓦片：

```bash
cd Castle_Academy_V0.1_Source
npx vitest run src/rendering/electricalTextures.test.ts --no-file-parallelism
# stdout | [V061-007] atlas runtime unique tiles = 49/64 (31 baseline + 18 electrical)
# exit 0，6/6 PASS
```

stub 只替换 DOM/canvas，不替换 `slotByFn` 去重逻辑，因此统计口径与浏览器运行时一致。

## 2. 结果

| 项 | Phase 0 静态解析 | **V061-007 运行时实测** | 结论 |
|---|---|---|---|
| V0.6 既有唯一瓦片 | 31 | **31** | 一致，DEV-607 修正的估算值成立 |
| V0.6.1 新增专属绘制函数 | — | **18**（9 类 × top + side） | 与 Q-4「每类 ≤2 个」定案一致 |
| bottom 复用既有共享函数 | — | **0 新增** | 9 个 bottom 全部指向既有函数 |
| **唯一瓦片总数** | 31 | **49 / 64** | ✅ ≤64，未溢出，余量 15 |
| `uvMap` 键数 | 75 | **102**（34 块 × 3 面） | 每块三面齐全 |
| 双态纹理键 | — | **0** | 未烘焙第二套纹理（AC-6733） |

`next` 实际值 49，`ATLAS_COLS = 8` / `ATLAS_ROWS = 8` 未改动，UV 归一化不变，干净世界视觉基线不受影响。

## 3. 双态实现边界

通电 / 断电不是图集内容：Q-1 批准的「派生 overlay 网格（导线逐段点亮）+ 独立材质实例 emissive」由 V061-012 落地。
本次实测确认 9 类方块每个只有 `top/side/bottom` 三个键，无任何 `powered` / `on` / `off` / `lit_` 变体键；
3 个共享材质未被修改。

## 4. 确定性证据（AC-6731）

同一面两次 `generateBlockTexture()` 的 16×16 像素序列逐字节一致（9 类全测），
9 类 top 像素序列两两不同；`switch_open` ≠ `switch_closed`、`water_valve_open` ≠ `water_valve_closed`，
两态由触点 / 闸板形状区分，不依赖动画或单一颜色（AC-6735 的纹理层证据）。

## 5. 未覆盖 / 后续

- 浏览器内真实像素渲染与风格板对照截图 → V061-023 / V061-024（GATE-2）。
- draw call 实测 → V061-012 / V061-026。
- 本轮未改 `ATLAS_COLS/ROWS`，未新增 DDR，未改 3 个共享材质。
