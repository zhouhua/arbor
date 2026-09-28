import type { AiRequest, AiResponse } from "@/types/tree";
import { getByokPayload } from "@/store/settings-store";

export type AiClientResponse = AiResponse & {
  _source?: "llm" | "mock" | "mock_fallback";
};

export async function requestAi(
  body: AiRequest
): Promise<AiClientResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      ...getByokPayload(),
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data.message ||
      (data.error === "unauthorized"
        ? "鉴权失败，请检查设定中的 API Key"
        : data.error === "missing_api_key"
          ? "未配置模型凭据：请在设定中填写 API Key，或配置服务端 MODEL_*"
          : data.error) ||
      "AI 请求失败";
    throw new Error(message);
  }

  return data as AiClientResponse;
}
