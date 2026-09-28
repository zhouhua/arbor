import type {
  AiRequest,
  AiResponse,
  GeneratedNodeDraft,
  RefineOperation,
} from "@/types/tree";

function pickAngles(prompt: string): GeneratedNodeDraft[] {
  const topic = prompt.trim() || "这个问题";
  const angles: GeneratedNodeDraft[] = [
    {
      title: "拆解核心目标",
      content: `围绕「${topic}」，先明确真正要解决的问题、成功标准和约束条件，避免过早陷入细节。`,
    },
    {
      title: "多角度分析",
      content: `从用户、业务、技术与风险四个侧面审视「${topic}」，找出冲突点与可协同的机会。`,
    },
    {
      title: "可行路径",
      content: `给出 2–3 条可落地的推进路径，比较投入、收益与不确定性，并建议优先尝试的一条。`,
    },
    {
      title: "潜在盲区",
      content: `列出容易被忽略的前提假设、依赖与失败模式，并为每项补充一个快速验证方式。`,
    },
  ];

  // Vary count based on prompt length for a more natural feel
  const count = prompt.length < 12 ? 2 : prompt.length > 80 ? 4 : 3;
  return angles.slice(0, count);
}

function refineOps(req: AiRequest): RefineOperation[] {
  const ops: RefineOperation[] = [];
  const prompt = req.prompt.toLowerCase();
  const wantsDelete =
    /删|移除|去掉|减少|不要/.test(req.prompt) && req.children.length > 0;
  const wantsAdd = /加|增加|补充|新增|再来|扩展/.test(req.prompt);
  const wantsModify = /改|修改|调整|优化|重写|更清晰/.test(req.prompt);

  if (wantsDelete) {
    const last = req.children[req.children.length - 1];
    ops.push({ type: "remove", nodeId: last.id });
  }

  if (wantsAdd || ops.length === 0) {
    ops.push({
      type: "add",
      title: "补充视角",
      content: `根据「${req.prompt}」，新增一个与现有分支互补的分析角度，强调可执行的下一步。`,
    });
  }

  if (wantsModify && req.children[0]) {
    const target = req.children[0];
    ops.push({
      type: "update",
      nodeId: target.id,
      title: target.title,
      content: `${target.content}\n\n【微调】${req.prompt}`,
    });
  }

  return ops;
}

function buildArticle(req: AiRequest): { title: string; article: string } {
  const path = [...req.ancestors, req.current];
  const title = `关于「${req.current.title}」的整合文章`;
  const sections = path
    .map(
      (n, i) =>
        `## ${i + 1}. ${n.title}\n\n${n.content}${
          n.id === req.current.id && req.children.length
            ? `\n\n### 下级要点\n\n${req.children
                .map((c) => `- **${c.title}**：${c.content}`)
                .join("\n")}`
            : ""
        }`
    )
    .join("\n\n");

  const article = `# ${title}

> 用户意图：${req.prompt || "把当前链路整理成一篇完整文章"}

${sections}

## 结语

以上内容沿思维树从根到当前节点整理而成，可继续对任意分支展开对话、修正或再总结。
`;

  return { title, article };
}

export function mockAiRespond(req: AiRequest): AiResponse {
  switch (req.action) {
    case "dialogue": {
      return {
        action: "dialogue",
        nodes: pickAngles(req.prompt || req.current.title),
      };
    }
    case "regenerate": {
      const regenerated: GeneratedNodeDraft = {
        title: req.current.title.replace(/（重生成）$/, "") + "（重生成）",
        content: `基于上下文重新思考「${req.prompt || req.current.title}」：保留原有问题意识，但换一套更清晰、更可执行的表达。\n\n原意摘要：${req.current.content.slice(0, 120)}`,
      };
      return {
        action: "regenerate",
        current: regenerated,
        nodes:
          req.children.length > 0
            ? pickAngles(req.prompt || regenerated.title)
            : [],
      };
    }
    case "refine": {
      return { action: "refine", operations: refineOps(req) };
    }
    case "summarize": {
      const { title, article } = buildArticle(req);
      return { action: "summarize", title, article };
    }
  }
}
