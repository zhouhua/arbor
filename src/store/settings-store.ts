"use client";

import { create } from "zustand";
import type { AppSettingsDoc, ThemePreference } from "@/types/tree";

export type LlmSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type SettingsState = LlmSettings & {
  theme: ThemePreference;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  hydrateFromDoc: (doc: Partial<AppSettingsDoc>) => void;
  patch: (patch: Partial<LlmSettings & { theme: ThemePreference }>) => void;
  clearSecrets: () => void;
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  apiKey: "",
  baseUrl: "",
  model: "",
  theme: "system",
  hydrated: false,
  setHydrated: (v) => set({ hydrated: v }),
  hydrateFromDoc: (doc) =>
    set((s) => ({
      apiKey: doc.apiKey ?? s.apiKey,
      baseUrl: doc.baseUrl ?? s.baseUrl,
      model: doc.model ?? s.model,
      theme: doc.theme ?? s.theme,
    })),
  patch: (patch) =>
    set((s) => ({
      apiKey: patch.apiKey ?? s.apiKey,
      baseUrl:
        patch.baseUrl !== undefined ? patch.baseUrl.trim() : s.baseUrl,
      model: patch.model !== undefined ? patch.model.trim() : s.model,
      theme: patch.theme ?? s.theme,
    })),
  clearSecrets: () => set({ apiKey: "", baseUrl: "", model: "" }),
}));

export function hasUserApiKey(settings?: Pick<LlmSettings, "apiKey">): boolean {
  const key = settings?.apiKey ?? useSettingsStore.getState().apiKey;
  return key.trim().length > 0;
}

export function getByokPayload() {
  const { apiKey, baseUrl, model } = useSettingsStore.getState();
  if (!apiKey.trim()) return {};
  return {
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.trim() || undefined,
    model: model.trim() || undefined,
  };
}
