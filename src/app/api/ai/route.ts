import { APICallError, generateText, Output } from "ai";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai-prompts";
import {
  dialogueOutputSchema,
  regenerateOutputSchema,
  refineOutputSchema,
  summarizeOutputSchema,
} from "@/lib/ai-schema";
import { createLlmModel, resolveLlmCredentials } from "@/lib/llm";
import { mockAiRespond } from "@/lib/mock-ai";
import type { AiRequest, AiResponse } from "@/types/tree";

export const runtime = "nodejs";
export const maxDuration = 60;

type AiBody = AiRequest & {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export async function POST(request: Request) {
  let body: AiBody;
  try {
    body = (await request.json()) as AiBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body?.action || !body.current) {
    return Response.json({ error: "无效请求" }, { status: 400 });
  }

  const resolved = resolveLlmCredentials({
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
    model: body.model,
  });

  if (!resolved.ok) {
    // 无服务端/用户凭据时回退 mock，便于本地演示；与 inkara 正式缺 Key 不同。
    if (process.env.ALLOW_MOCK_AI !== "0") {
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
      return Response.json({
        ...mockAiRespond(body),
        _source: "mock",
      });
    }
    return Response.json(
      { error: resolved.error, message: resolved.message },
      { status: 500 }
    );
  }

  try {
    const result = await callArborModel(body, resolved.creds);
    return Response.json({ ...result, _source: "llm" });
  } catch (error) {
    console.error("Arbor AI failed:", error);
    if (APICallError.isInstance(error)) {
      const status = error.statusCode;
      if (status === 401 || status === 403) {
        return Response.json(
          { error: "unauthorized", message: "鉴权失败" },
          { status: 401 }
        );
      }
      return Response.json(
        { error: "upstream_error", message: "上游模型服务异常" },
        { status: 502 }
      );
    }

    // 开发期兜底：真实调用失败时仍给 mock，避免阻塞画布操作
    if (process.env.NODE_ENV !== "production") {
      return Response.json({
        ...mockAiRespond(body),
        _source: "mock_fallback",
      });
    }

    return Response.json(
      {
        error: "request_failed",
        message: error instanceof Error ? error.message : "unknown",
      },
      { status: 502 }
    );
  }
}

async function callArborModel(
  body: AiRequest,
  creds: { apiKey: string; baseUrl: string; model: string }
): Promise<AiResponse> {
  const model = createLlmModel(creds);
  const system = buildSystemPrompt(body.action);
  const prompt = buildUserPrompt(body);

  switch (body.action) {
    case "dialogue": {
      const { output } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 2400,
        output: Output.object({
          name: "ArborDialogue",
          description: "Tree dialogue: child nodes to attach under current",
          schema: dialogueOutputSchema,
        }),
      });
      if (!output) throw new Error("empty_output");
      return output;
    }
    case "regenerate": {
      const { output } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 2400,
        output: Output.object({
          name: "ArborRegenerate",
          description: "Regenerate current node and optional children",
          schema: regenerateOutputSchema,
        }),
      });
      if (!output) throw new Error("empty_output");
      return output;
    }
    case "refine": {
      const { output } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.55,
        maxOutputTokens: 2000,
        output: Output.object({
          name: "ArborRefine",
          description: "Refine child nodes with add/update/remove ops",
          schema: refineOutputSchema,
        }),
      });
      if (!output) throw new Error("empty_output");
      return output;
    }
    case "summarize": {
      const { output } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.65,
        maxOutputTokens: 3200,
        output: Output.object({
          name: "ArborSummarize",
          description: "Path summary as a full markdown article",
          schema: summarizeOutputSchema,
        }),
      });
      if (!output) throw new Error("empty_output");
      return output;
    }
  }
}
