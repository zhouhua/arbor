"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  describeProbeError,
  probeConnection,
  validateByokFields,
} from "@/lib/byok";
import { useSettingsStore } from "@/store/settings-store";

type ProbeUi = "idle" | "testing" | "ok" | "fail";

export function SettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiKey = useSettingsStore((s) => s.apiKey);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const model = useSettingsStore((s) => s.model);
  const patch = useSettingsStore((s) => s.patch);
  const clearSecrets = useSettingsStore((s) => s.clearSecrets);

  const [fieldErrors, setFieldErrors] = useState<{
    apiKey?: string;
    baseUrl?: string;
  }>({});
  const [probeUi, setProbeUi] = useState<ProbeUi>("idle");
  const [probeMessage, setProbeMessage] = useState("");

  const resetProbe = () => {
    setProbeUi("idle");
    setProbeMessage("");
    setFieldErrors({});
  };

  const onTest = async () => {
    const errors = validateByokFields({ apiKey, baseUrl });
    setFieldErrors(errors);
    if (errors.apiKey || errors.baseUrl) {
      setProbeUi("idle");
      setProbeMessage("");
      return;
    }

    setProbeUi("testing");
    setProbeMessage("正在测试连接…");
    const result = await probeConnection({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
    });
    if (result.ok) {
      setProbeUi("ok");
      setProbeMessage("连接成功");
      return;
    }
    setProbeUi("fail");
    setProbeMessage(describeProbeError(result.error));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetProbe();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>模型设定</DialogTitle>
          <DialogDescription>
            与墨语 inkara 相同：OpenAI 兼容接口。可自备 Key / Endpoint /
            模型；留空则使用服务端 MODEL_* 默认值。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-700">API Key</span>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => {
                resetProbe();
                patch({ apiKey: e.target.value });
              }}
            />
            {fieldErrors.apiKey ? (
              <span className="text-xs text-red-600">{fieldErrors.apiKey}</span>
            ) : null}
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-700">Endpoint（Base URL）</span>
            <Input
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => {
                resetProbe();
                patch({ baseUrl: e.target.value });
              }}
            />
            {fieldErrors.baseUrl ? (
              <span className="text-xs text-red-600">{fieldErrors.baseUrl}</span>
            ) : null}
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-700">模型</span>
            <Input
              autoComplete="off"
              spellCheck={false}
              placeholder="例如 gpt-4o-mini / qwen-plus"
              value={model}
              onChange={(e) => {
                resetProbe();
                patch({ model: e.target.value });
              }}
            />
          </label>

          {probeMessage ? (
            <p
              className={`text-xs ${
                probeUi === "ok"
                  ? "text-teal-700"
                  : probeUi === "fail"
                    ? "text-red-600"
                    : "text-slate-500"
              }`}
            >
              {probeMessage}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              未配置时开发环境会使用内置 mock；正式部署请配置服务端或自备
              Key。
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearSecrets();
              resetProbe();
            }}
          >
            清空
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={probeUi === "testing"}
              onClick={onTest}
            >
              {probeUi === "testing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  测试中
                </>
              ) : (
                "测试连接"
              )}
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
