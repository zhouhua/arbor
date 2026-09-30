# 思维树会话库（IndexedDB + Zustand）

日期：2026-09-30  
状态：已确认

## 目标

支持多棵思维树的本地历史：新建 / 清空时不丢树，可从历史面板切换回过往议题；当前会话变更自动持久化。

## 已确认决策

| 决策 | 选择 |
|------|------|
| 能力范围 | 思维树会话库（非仅增强操作日志） |
| 归档时机 | 新建根议题 / 清空画布时，当前非空树自动归档 |
| 打开历史 | 先 flush 并保留当前会话，再切换到目标会话 |
| 状态管理 | 单一 Zustand `tree-store`（不另建 sessions-store） |
| 持久化 | IndexedDB；去掉 localStorage 的 zustand `persist`（树与配置均走 IDB） |
| 当前会话 | 变更自动写入 IDB（防抖 + 页面隐藏/卸载时 flush） |
| 配置 / BYOK | `settings-store` 仍用 Zustand 管内存；持久化改走同一 IndexedDB，不再用 localStorage |

## 非目标

- 云同步 / 多端账号
- 持久化 undo/redo 栈（只持久化快照；刷新后 undo 清空）
- 会话内容搜索、导出导入（可后续加）
- 服务端存储

## 数据模型

```ts
interface TreeSession {
  id: string;
  title: string; // 根节点标题；空树可用「未命名议题」
  createdAt: number;
  updatedAt: number;
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  lastArticle: { title: string; article: string; nodeId: string } | null;
}
```

Zustand `tree-store` 内存态：

- `sessions: Record<string, TreeSession>`
- `currentSessionId: string | null`
- 当前画布仍暴露现有字段：`nodes` / `rootId` / `selectedNodeId` / `historyLog` / `lastArticle` / `busyNodeId` / `layoutTick` 及既有 actions
- 约定：当前画布字段与 `sessions[currentSessionId]` 保持同步；写操作先改当前字段，再回写对应 session 元数据（`title` / `updatedAt`）

## IndexedDB

- 库名：`lucora`
- Object store：`sessions`，keyPath = `id`
- 索引：`updatedAt`
- Object store：`meta`，固定 key `app`，值 `{ currentSessionId, version: 1 }`
- Object store：`settings`，固定 key `app`，值例如：
  `{ apiKey, baseUrl, model, theme }`（`theme`: `"light" | "dark" | "system"`）
- 封装：薄 `src/lib/idb.ts`，优先用轻量 `idb` 包；**仅 IO**，不含业务状态；提供 sessions / meta / settings 读写 API

## 配置（settings）

- `settings-store` 继续用 Zustand 管理 LLM/BYOK 内存态；**移除** localStorage `persist`（`arbor-llm-settings-v1`）
- 主题：`next-themes` 通过自定义 `storage` 适配同一 IDB `settings.app.theme`（或读写时合并进 settings 文档），**不**再使用其默认 localStorage
- 启动时与树会话一并从 IDB hydrate；settings 变更防抖写入（可与 session flush 共用页面隐藏时机）
- **迁移**：
  - `arbor-llm-settings-v1` → IDB settings
  - `next-themes` 旧 localStorage key（若存在）→ `settings.theme`
  - 导入成功后删除对应旧 key
- 目标：应用数据路径上不再依赖 localStorage（迁移期读一次旧值除外）

## 自动保存

1. `tree-store` 订阅（或 middleware）：结构性变更后防抖 300–500ms 将当前 session 写入 IDB，并更新 `meta.currentSessionId`
2. `visibilitychange` → `hidden`、`pagehide` / `beforeunload`：取消防抖并同步 flush
3. 触发保存的变更：创建根、增删改节点、refine、replaceChildren、organizeLayout、setArticle、切换会话后的载入结果等
4. 不单独为 `busyNodeId` / 纯 UI 状态写盘；`selectedNodeId` 可随快照一起保存
5. Undo/redo（zundo temporal）：作用于内存快照；每次 undo/redo 后同样走自动保存

## 会话生命周期

### 启动 hydrate

1. 打开 IDB，读取 `meta` + 全部 sessions（上限 50，体量可接受）
2. 若有 `currentSessionId` 且存在 → 载入该会话到画布字段
3. 否则取 `updatedAt` 最新的会话；若无 → `currentSessionId = null` 的空画布（首次编辑时再创建 session）
4. **迁移**：若存在旧 key `arbor-tree-v1`（localStorage），导入为一条 session，设为 current，写 IDB 成功后删除旧 key

### 新建根议题（替换）

1. Flush 当前
2. 若当前 `rootId` 非空：保留其 session 记录（已在 `sessions` 中）
3. 创建新 `sessionId`，`reset` 画布字段并 `createRoot`，写入新 session
4. `currentSessionId` 指向新会话；触发保存

### 清空画布

1. Flush 当前（非空 session 留在 `sessions` / IDB）
2. 画布重置为空：`currentSessionId = null`，清空画布字段；更新 `meta`
3. 不预创建空 session；用户下次创建根议题时再新建 session

### 切换历史会话

1. Flush 当前 session 到 `sessions` + IDB
2. `currentSessionId = targetId`，用目标快照覆盖画布字段
3. `temporal.clear()`（undo 栈不跨会话）
4. 更新 `meta` 并保存

### 删除历史会话

- 可删非当前；若删当前则等同「清空并移除该条」后进入空/新会话
- 同步删 IDB 记录

### 容量

- 上限 **50** 条 session；超出按 `updatedAt` 升序删除最旧（跳过当前）

## UI

- 工具栏「历史记录」打开面板，默认页签 **思维树**：列表项显示标题、节点数、`updatedAt`；点击切换；提供删除
- 当前会话在列表中标注「当前」
- 次级页签 **操作记录**：沿用现有 `historyLog` UI（仅当前会话）
- 视觉：保持现有 Dialog + 克制 chrome，不新开侧栏

## 与现有代码的关系

| 现有 | 变化 |
|------|------|
| `persist(..., localStorage)` on `tree-store` | 移除；改 IDB hydrate + 自动保存 |
| `settings-store` localStorage persist | 移除；改同一 IDB `settings` store |
| `HistoryPanel` | 改为双页签；主列表为会话 |
| `resetAll` / `createRootAndExpand` | 接入归档 + 新 session |
| `historyLog` / zundo | 保留；语义仍为「当前树内操作」 |

## 验收标准

1. 编辑树后刷新页面，内容与选中节点恢复
2. 新建根议题后，旧树出现在历史列表且可点回
3. 清空画布后旧树仍在历史中
4. 切换 A→B→A，两棵树内容均不丢
5. 旧 `arbor-tree-v1` / `arbor-llm-settings-v1` 用户首次打开可迁移到 IDB
6. 超过 50 条时最旧非当前会话被淘汰
7. 操作记录页签仍展示当前树的 `historyLog`
8. 修改模型设定后刷新，Key / Endpoint / 模型仍在
9. 切换主题后刷新，主题偏好仍在（且不依赖 localStorage）

## 实现顺序（概要）

1. `idb` IO（sessions / meta / settings）+ 类型
2. 扩展 `tree-store`：sessions / currentSessionId / switch / archive helpers；去掉 localStorage persist
3. `settings-store` 改 IDB hydrate + 自动保存；迁移旧 settings key
4. 启动 hydrate + 树迁移 + 防抖自动保存 + 页面 unload flush
5. 改 `node-actions` / toolbar 清空与新建路径
6. 改 `HistoryPanel` UI
7. 手动验收上述标准
