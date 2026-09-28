"use client";

import { useState } from "react";
import {
  MessageSquare,
  PenLine,
  FileText,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

type PanelMode = "dialogue" | "refine" | "summarize" | null;

const prompts: Record<Exclude<PanelMode, null>, { title: string; hint: string; placeholder: string }> = {
  dialogue: {
    title: "对话展开",
    hint: "上下文会包含父级与兄弟节点。若已有子节点，将重新生成下级。",
    placeholder: "例如：从用户体验与商业可行性两个方向继续拆解…",
  },
  refine: {
    title: "修正子树",
    hint: "可要求增加、删除或改写某些子节点。",
    placeholder: "例如：删掉最后一个分支，再补充一个关于风险的视角…",
  },
  summarize: {
    title: "链路总结",
    hint: "将从根到当前节点的信息整合成一篇文章。",
    placeholder: "例如：写成一篇面向产品团队的简报…",
  },
};

export function NodeActionPanel() {
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const nodes = useTreeStore((s) => s.nodes);
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
  const setBusy = useTreeStore((s) => s.setBusy);
  const replaceChildren = useTreeStore((s) => s.replaceChildren);
  const applyRefine = useTreeStore((s) => s.applyRefine);
  const updateNode = useTreeStore((s) => s.updateNode);
  const deleteNode = useTreeStore((s) => s.deleteNode);
  const setArticle = useTreeStore((s) => s.setArticle);

  const [mode, setMode] = useState<PanelMode>(null);
  const [prompt, setPrompt] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const children = node ? getChildren(nodes, node.id) : [];
  const isLeaf = children.length === 0;
  const busy = busyNodeId === selectedNodeId;

  if (!node) {
    return (
      <aside className="flex h-full flex-col justify-center border-l border-teal-900/10 bg-white/70 px-5 text-sm text-slate-500 backdrop-blur-md">
        <p className="font-[family-name:var(--font-display)] text-lg text-slate-800">
          选中一个节点
        </p>
        <p className="mt-2 leading-relaxed">
          在画布上点击节点后，可进行对话、修正、总结、重生成或删除。
        </p>
      </aside>
    );
  }

  async function runAction(action: AiAction, userPrompt: string) {
    if (!node) return;

    if (action === "dialogue") {
      await expandNodeWithDialogue(node.id, userPrompt);
      setMode(null);
      setPrompt("");
      return;
    }

    setBusy(node.id);
    try {
      const payload = {
        action,
        prompt: userPrompt,
        current: toContextNode(node),
        ancestors: getAncestors(nodes, node.id).map(toContextNode),
        siblings: getSiblings(nodes, node.id).map(toContextNode),
        children: getChildren(nodes, node.id).map(toContextNode),
      };

      const result = await requestAi(payload);

      if (result._source === "mock" || result._source === "mock_fallback") {
        toast.message("当前使用演示模型", {
          description: "可在右上角「模型设定」填写 OpenAI 兼容 Key",
        });
      }

      if (result.action === "regenerate") {
        if (result.current) {
          updateNode(
            node.id,
            {
              title: result.current.title,
              content: result.current.content,
              prompt: userPrompt,
            },
            { silent: true }
          );
        }
        if (result.nodes.length > 0) {
          replaceChildren(node.id, result.nodes, userPrompt);
        } else {
          useTreeStore.getState().pushHistory({
            type: "regenerate",
            label: `重新生成「${result.current?.title ?? node.title}」`,
            nodeId: node.id,
          });
        }
        toast.success("节点已重新生成");
      } else if (result.action === "refine") {
        applyRefine(node.id, result.operations, userPrompt);
        toast.success(`已应用 ${result.operations.length} 项修正`);
      } else if (result.action === "summarize") {
        setArticle({
          title: result.title,
          article: result.article,
          nodeId: node.id,
        });
        toast.success("总结文章已生成");
      }

      setMode(null);
      setPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-teal-900/10 bg-white/75 backdrop-blur-md">
      <div className="space-y-2 border-b border-teal-900/10 px-4 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-teal-800/70">
          当前节点
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight text-slate-900">
          {node.title}
        </h2>
        <ScrollArea className="max-h-28">
          <p className="pr-3 text-sm leading-relaxed text-slate-600">
            {node.content}
          </p>
        </ScrollArea>
      </div>

      <div className="space-y-2 px-4 py-4">
        <ActionButton
          icon={<MessageSquare className="h-4 w-4" />}
          label="对话"
          desc={isLeaf ? "拆解并生成下级" : "重新生成下级节点"}
          onClick={() => {
            setMode("dialogue");
            setPrompt("");
          }}
          disabled={busy}
        />
        <ActionButton
          icon={<PenLine className="h-4 w-4" />}
          label="修正"
          desc="增删或改写子节点"
          onClick={() => {
            setMode("refine");
            setPrompt("");
          }}
          disabled={busy || isLeaf}
        />
        <ActionButton
          icon={<FileText className="h-4 w-4" />}
          label="总结"
          desc="整合链路写成文章"
          onClick={() => {
            setMode("summarize");
            setPrompt("");
          }}
          disabled={busy}
        />
        <ActionButton
          icon={<RefreshCw className="h-4 w-4" />}
          label="重新生成"
          desc={isLeaf ? "重写本节点" : "重写本节点及下级"}
          onClick={() => runAction("regenerate", node.prompt || node.title)}
          disabled={busy}
        />
        <Separator className="my-2" />
        <ActionButton
          icon={<Trash2 className="h-4 w-4" />}
          label="删除"
          desc="删除本节点及所有子孙"
          destructive
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
        />
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          {mode && (
            <>
              <DialogHeader>
                <DialogTitle>{prompts[mode].title}</DialogTitle>
                <DialogDescription>{prompts[mode].hint}</DialogDescription>
              </DialogHeader>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={prompts[mode].placeholder}
                rows={5}
                className="resize-none"
                autoFocus
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setMode(null)}>
                  取消
                </Button>
                <Button
                  disabled={busy || !prompt.trim()}
                  onClick={() => mode && runAction(mode, prompt.trim())}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成中
                    </>
                  ) : (
                    "确认"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除？</DialogTitle>
            <DialogDescription>
              将删除「{node.title}」及其全部子孙节点，此操作可通过撤销恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteNode(node.id);
                setConfirmDelete(false);
                toast.success("节点已删除");
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function ActionButton({
  icon,
  label,
  desc,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        destructive
          ? "border-red-200/80 bg-red-50/50 hover:bg-red-50 disabled:opacity-50"
          : "border-teal-900/10 bg-white/60 hover:border-teal-700/30 hover:bg-teal-50/60 disabled:opacity-50"
      }`}
    >
      <span
        className={`mt-0.5 ${destructive ? "text-red-600" : "text-teal-800"}`}
      >
        {icon}
      </span>
      <span>
        <span
          className={`block text-sm font-medium ${
            destructive ? "text-red-700" : "text-slate-900"
          }`}
        >
          {label}
        </span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  );
}
