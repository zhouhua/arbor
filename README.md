# 清照 Lucora

在无限画布上展开议题、拆解分支、修正与总结，把模糊问题照见成清晰结构。

## 功能

- **对话**：基于父级与兄弟节点上下文，拆解问题并生成多个下级节点；对非叶子节点会重新生成子节点
- **修正**：按提示增删或改写子节点
- **总结**：整合从根到当前节点的链路，生成完整文章
- **重新生成**：重写当前节点；若有下级则一并尝试重生成
- **删除**：删除节点及其子孙
- **无限画布**：缩放、平移、拖拽节点、小地图
- **历史 / Undo / Redo**：多棵思维树本地会话库（IndexedDB）+ 操作日志 + `⌘/Ctrl+Z` / `⌘/Ctrl+⇧Z`
- **模型设定（BYOK）**：自备 OpenAI 兼容 API Key / Endpoint / 模型，并可「测试连接」；设定与主题一并存 IndexedDB

## 本地运行

```bash
cp .env.example .env.local   # 可选；也可用设定面板填 Key
npm install
npm run dev
```

打开 [http://127.0.0.1:43123](http://127.0.0.1:43123)。

### 环境变量（与墨语 inkara 对齐）

| 变量 | 说明 |
|------|------|
| `MODEL_API_KEY` | 服务端默认 API Key（用户未自备时使用） |
| `MODEL_BASE_URL` | OpenAI 兼容接口 Base URL |
| `MODEL_NAME` | 模型名称 |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` / `DASHSCOPE_MODEL` | 同上备选 |
| `ALLOW_MOCK_AI` | 缺省开启；设为 `0` 时禁止 mock，必须配置真实模型 |

用户也可在应用右上角 **模型设定** 中填写自备凭据；请求会经本站 `/api/ai` 代发（与 inkara 相同：`@ai-sdk/openai-compatible` + `ai` SDK）。

未配置任何凭据时，默认回退内置 mock，便于演示画布交互。

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui · React Flow · Zustand（zundo）· Vercel AI SDK
