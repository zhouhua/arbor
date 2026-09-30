import type { ThemePreference } from "@/types/tree";

let themeCache: ThemePreference = "system";

export function setThemeCache(theme: ThemePreference) {
  themeCache = theme;
}

export function getThemeCache(): ThemePreference {
  return themeCache;
}
