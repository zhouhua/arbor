import { toast } from "sonner";
import { requestAi } from "@/lib/ai-client";
import {
  getAncestors,
  getChildren,
  getSiblings,
  toContextNode,
} from "@/lib/tree-utils";
import { useTreeStore } from "@/store/tree-store";

/**
 * 对指定节点发起「对话」拆解并挂上子节点。
 * 创建根节点后应立即调用；侧栏「对话」也可复用同一逻辑。
 */
export async function expandNodeWithDialogue(
  nodeId: string,
  prompt: string
): Promise<boolean> {
  const store = useTreeStore.getState();
  const node = store.nodes[nodeId];
  if (!node) return false;

  const userPrompt =
    prompt.trim() ||
    `请围绕「${node.title}」进行多角度拆解，生成若干互补的下级节点。`;

  store.setBusy(nodeId);
  try {
    const nodes = store.nodes;
    const existingChildren = getChildren(nodes, nodeId);
    const result = await requestAi({
      action: "dialogue",
      prompt: userPrompt,
      current: toContextNode(node),
      ancestors: getAncestors(nodes, nodeId).map(toContextNode),
      siblings: getSiblings(nodes, nodeId).map(toContextNode),
      children: existingChildren.map(toContextNode),
    });

    if (result._source === "mock" || result._source === "mock_fallback") {
      toast.message("当前使用演示模型", {
        description: "可在右上角「模型设定」填写 OpenAI 兼容 Key",
      });
    }

    if (result.action !== "dialogue" || !result.nodes?.length) {
      toast.error("未能生成下级节点");
      return false;
    }

    if (existingChildren.length > 0) {
      store.replaceChildren(nodeId, result.nodes, userPrompt);
      toast.success(`已重新生成 ${result.nodes.length} 个下级节点`);
    } else {
      store.addChildren(nodeId, result.nodes, userPrompt, "dialogue", `拆解生成 ${result.nodes.length} 个下级`);
      toast.success(`已拆解为 ${result.nodes.length} 个下级节点`);
    }
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "拆解失败");
    return false;
  } finally {
    useTreeStore.getState().setBusy(null);
  }
}
