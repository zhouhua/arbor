import { z } from "zod";

export const nodeDraftSchema = z.object({
  title: z.string().describe("节点短标题，宜 4–16 字"),
  content: z.string().describe("节点正文，一两段清晰可执行的说明"),
});

export const dialogueOutputSchema = z.object({
  action: z.literal("dialogue"),
  nodes: z
    .array(nodeDraftSchema)
    .min(1)
    .max(5)
    .describe("根据用户提示拆解出的下级节点，通常 2–4 个"),
});

export const regenerateOutputSchema = z.object({
  action: z.literal("regenerate"),
  current: nodeDraftSchema.describe("重写后的当前节点"),
  nodes: z
    .array(nodeDraftSchema)
    .describe("若当前非叶子，同时给出新的下级；叶子则空数组"),
});

export const refineOutputSchema = z.object({
  action: z.literal("refine"),
  operations: z
    .array(
      z.object({
        type: z.enum(["add", "update", "remove"]),
        nodeId: z
          .string()
          .optional()
          .describe("update/remove 时必填，对应已有子节点 id"),
        title: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .min(1)
    .describe("对子节点的增删改操作列表"),
});

export const summarizeOutputSchema = z.object({
  action: z.literal("summarize"),
  title: z.string().describe("文章标题"),
  article: z.string().describe("完整 markdown 文章"),
});

export type DialogueOutput = z.infer<typeof dialogueOutputSchema>;
export type RegenerateOutput = z.infer<typeof regenerateOutputSchema>;
export type RefineOutput = z.infer<typeof refineOutputSchema>;
export type SummarizeOutput = z.infer<typeof summarizeOutputSchema>;
