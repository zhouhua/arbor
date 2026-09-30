import { toast } from "sonner";
import { requestAi } from "@/lib/ai-client";
import { expandNodeWithDialogue } from "@/lib/expand-node";
import {
  getAncestors,
  getChildren,
  getSiblings,
  toContextNode,
} from "@/lib/tree-utils";
import { useTreeStore } from "@/store/tree-store";
import type { AiAction } from "@/types/tree";

export type ComposerMode = "dialogue" | "refine" | "summarize";

/** 对指定节点执行 AI 动作（画布浮动输入 / 节点快捷栏共用） */
export async function runNodeAction(
  nodeId: string,
  action: AiAction,
  userPrompt: string
): Promise<boolean> {
  const store = useTreeStore.getState();
  const node = store.nodes[nodeId];
  if (!node) return false;

  if (action === "dialogue") {
    return expandNodeWithDialogue(nodeId, userPrompt);
  }

  store.setBusy(nodeId);
  try {
    const nodes = store.nodes;
    const result = await requestAi({
      action,
      prompt: userPrompt,
      current: toContextNode(node),
      ancestors: getAncestors(nodes, nodeId).map(toContextNode),
      siblings: getSiblings(nodes, nodeId).map(toContextNode),
      children: getChildren(nodes, nodeId).map(toContextNode),
    });

    if (result._source === "mock" || result._source === "mock_fallback") {
      toast.message("当前使用演示模型", {
        description: "可在右上角「模型设定」填写 OpenAI 兼容 Key",
      });
    }

    if (result.action === "regenerate") {
      if (result.current) {
        store.updateNode(
          nodeId,
          {
            title: result.current.title,
            content: result.current.content,
            prompt: userPrompt,
          },
          { silent: true }
        );
      }
      if (result.nodes.length > 0) {
        store.replaceChildren(nodeId, result.nodes, userPrompt);
      } else {
        store.pushHistory({
          type: "regenerate",
          label: `重新生成「${result.current?.title ?? node.title}」`,
          nodeId,
        });
      }
      toast.success("节点已重新生成");
      return true;
    }

    if (result.action === "refine") {
      store.applyRefine(nodeId, result.operations, userPrompt);
      toast.success(`已应用 ${result.operations.length} 项修正`);
      return true;
    }

    if (result.action === "summarize") {
      store.setArticle({
        title: result.title,
        article: result.article,
        nodeId,
      });
      toast.success("总结文章已生成");
      return true;
    }

    toast.error("操作未返回有效结果");
    return false;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "操作失败");
    return false;
  } finally {
    useTreeStore.getState().setBusy(null);
  }
}

/** 从浮动输入创建根议题并首轮拆解 */
export async function createRootAndExpand(
  title: string,
  content?: string
): Promise<string | null> {
  const topic = title.trim();
  if (!topic) return null;

  const body = content?.trim() || "从这里开始拆解与多角度探索。";
  const store = useTreeStore.getState();

  if (store.rootId) {
    store.syncCurrentIntoSessions();
    store.beginNewSession();
  } else if (!store.currentSessionId) {
    store.beginNewSession();
  }

  const id = store.createRoot(topic, body);
  toast.message("根节点已创建，正在拆解…");
  await expandNodeWithDialogue(
    id,
    `请围绕「${topic}」进行首轮拆解：从核心目标、多角度分析、可行路径等方向生成下级节点。背景：${body}`
  );
  return id;
}

export function focusComposer(mode?: ComposerMode) {
  window.dispatchEvent(
    new CustomEvent("arbor:focus-composer", {
      detail: { mode },
    })
  );
}
