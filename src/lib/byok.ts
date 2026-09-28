export function validateByokFields(input: {
  apiKey: string;
  baseUrl: string;
}): { apiKey?: string; baseUrl?: string } {
  const errors: { apiKey?: string; baseUrl?: string } = {};
  if (!input.apiKey.trim()) errors.apiKey = "请填写 API Key";
  const url = input.baseUrl.trim();
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errors.baseUrl = "Endpoint 需为 http(s) URL";
      }
    } catch {
      errors.baseUrl = "Endpoint 格式无效";
    }
  }
  return errors;
}

export async function probeConnection(body: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}): Promise<{ ok: true } | { ok: false; error: string; message?: string }> {
  try {
    const res = await fetch("/api/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
    };
    if (res.ok && data.ok) return { ok: true };
    return {
      ok: false,
      error: data.error || "upstream_error",
      message: data.message,
    };
  } catch {
    return { ok: false, error: "request_failed", message: "网络请求失败" };
  }
}

export function describeProbeError(error: string): string {
  switch (error) {
    case "missing_api_key":
      return "请填写 API Key";
    case "missing_base_url":
      return "缺少 Endpoint（可在设定填写，或由服务端默认提供）";
    case "missing_model":
      return "缺少模型名（可在设定填写，或由服务端默认提供）";
    case "unauthorized":
      return "鉴权失败，请检查 API Key";
    case "upstream_error":
      return "上游模型服务异常";
    case "request_failed":
      return "无法连接本站探测接口";
    default:
      return "测试失败，请检查配置";
  }
}
