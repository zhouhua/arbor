import { APICallError, generateText } from "ai";
import { createLlmModel, resolveLlmCredentials } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

type ProbeBody = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export async function POST(req: Request) {
  let body: ProbeBody;
  try {
    body = (await req.json()) as ProbeBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const resolved = resolveLlmCredentials({
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
    model: body.model,
    requireUserApiKey: true,
  });
  if (!resolved.ok) {
    const status = resolved.error === "missing_api_key" ? 400 : 500;
    return Response.json(
      { error: resolved.error, message: resolved.message },
      { status }
    );
  }

  try {
    const { text } = await generateText({
      model: createLlmModel(resolved.creds),
      temperature: 0,
      maxOutputTokens: 8,
      prompt: "ping",
    });
    if (typeof text !== "string") {
      return Response.json(
        { error: "upstream_error", message: "upstream" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Probe failed:", error);
    if (APICallError.isInstance(error)) {
      const status = error.statusCode;
      if (status === 401 || status === 403) {
        return Response.json(
          { error: "unauthorized", message: "unauthorized" },
          { status: 401 }
        );
      }
      return Response.json(
        { error: "upstream_error", message: "upstream" },
        { status: 502 }
      );
    }
    return Response.json({ error: "request_failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
