# V0.7.1 存储白名单与隐私口径更新

**决定：** owner D2（2026-11-16）——材料包解锁单独新建一个存档位置。
**实现：** `src/features/engineering-design/V071ProgressStore.ts`

## 新增 key

| key | schema | 内容 | 写入时机 |
|---|---:|---|---|
| `castle.academy.v071.progress` | 1 | `completedMissionIds: string[]`、`unlockedRewardIds: string[]` | 桥梁任务完成、奖励首次发放 |

## 明确不写入

- 儿童昵称、年龄、自由文本反思；
- 坐标、方块列表、世界快照字段；
- 网络请求、LLM 调用、云端账号信息。

## 容错与幂等

- 读取损坏 JSON / 错误 schema → 返回空状态；下一次写入自愈为 version 1。
- 重复完成只补全任务 ID，不重复追加奖励 ID，返回 `false`。
- 与 `castle.academy.learner` / `castle-academy-world-v1` / `castle-academy-view-v1` 完全隔离。

## 白名单变更

V0.6.1 / V0.7 的「恒 3 key」安全基线在 V0.7.1 由 owner 授权改为 4 key。
历史脚本 `v061-safety-spotcheck.mjs`、`v07-safety-spotcheck.mjs` 与其历史 JSON 保持字节零改动；
本版新增 `scripts/v071-safety-spotcheck.mjs`，白名单为：

1. `castle.academy.learner`
2. `castle-academy-world-v1`
3. `castle-academy-view-v1`
4. `castle.academy.v071.progress`

实测结论见 `V071_Safety_Spotcheck.json`。
