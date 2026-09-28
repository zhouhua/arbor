"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LlmSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type SettingsState = LlmSettings & {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  patch: (patch: Partial<LlmSettings>) => void;
  clearSecrets: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      baseUrl: "",
      model: "",
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      patch: (patch) =>
        set((s) => ({
          apiKey: patch.apiKey ?? s.apiKey,
          baseUrl: patch.baseUrl !== undefined ? patch.baseUrl.trim() : s.baseUrl,
          model: patch.model !== undefined ? patch.model.trim() : s.model,
        })),
      clearSecrets: () => set({ apiKey: "", baseUrl: "", model: "" }),
    }),
    {
      name: "arbor-llm-settings-v1",
      partialize: (s) => ({
        apiKey: s.apiKey,
        baseUrl: s.baseUrl,
        model: s.model,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

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
