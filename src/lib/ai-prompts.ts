import type { AiAction, AiRequest } from "@/types/tree";

export function buildSystemPrompt(action: AiAction): string {
  const common = `你是「枝脉」——一棵思维树助手。用户在无限画布上以树状节点思考问题。
请理解上下文（祖先链路、兄弟节点、当前节点与子节点），给出结构化结果。
文案使用简洁中文；标题短、内容具体可执行。不要输出 markdown 代码围栏。`;

  switch (action) {
    case "dialogue":
      return `${common}
任务：根据用户提示，从当前节点继续拆解，生成 2–4 个互补的下级节点（允许只生成 1 个）。
若已有子节点，你的输出将替换它们，请给出更优的整组下级。`;
    case "refine":
      return `${common}
任务：根据用户修正意图，对当前节点的子节点做微调：add / update / remove。
update/remove 必须使用上下文中真实存在的子节点 id。`;
    case "summarize":
      return `${common}
任务：把从根到当前节点的链路信息整合成一篇完整文章（markdown），贴合用户总结意图。`;
    case "regenerate":
      return `${common}
任务：重写当前节点；若存在子节点，同时给出新的下级节点集合（可为空数组表示叶子）。`;
  }
}

export function buildUserPrompt(req: AiRequest): string {
  return JSON.stringify(
    {
      prompt: req.prompt,
      current: req.current,
      ancestors: req.ancestors,
      siblings: req.siblings,
      children: req.children,
    },
    null,
    2
  );
}
