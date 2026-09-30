"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useSettingsStore } from "@/store/settings-store";

function ThemeIdbSync({ children }: { children: React.ReactNode }) {
  const { setTheme, theme } = useTheme();
  const storeTheme = useSettingsStore((s) => s.theme);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const patch = useSettingsStore((s) => s.patch);
  const synced = React.useRef(false);

  React.useEffect(() => {
    if (!hydrated || synced.current) return;
    synced.current = true;
    setTheme(storeTheme);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("lucora-theme");
      window.localStorage.removeItem("theme");
    }
  }, [hydrated, setTheme, storeTheme]);

  React.useEffect(() => {
    if (!hydrated || !synced.current || !theme) return;
    if (theme === "light" || theme === "dark" || theme === "system") {
      if (theme !== storeTheme) patch({ theme });
    }
  }, [theme, hydrated, patch, storeTheme]);

  return children;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider storageKey="lucora-theme" {...props}>
      <ThemeIdbSync>{children}</ThemeIdbSync>
    </NextThemesProvider>
  );
}
