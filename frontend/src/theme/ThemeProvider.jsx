import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./ThemeContext";

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizePreference(value) {
  const next = typeof value === "string" ? value.toLowerCase() : "system";
  if (next === "light" || next === "dark") {
    return next;
  }
  return "system";
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState("system");
  const [theme, setTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    if (preference === "system") {
      setTheme(getSystemTheme());
      return;
    }
    setTheme(preference);
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches) => {
      setTheme(matches ? "dark" : "light");
    };

    apply(media.matches);

    const handler = (event) => {
      const matches =
        typeof event?.matches === "boolean" ? event.matches : media.matches;
      apply(matches);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }

    if (typeof media.addListener === "function") {
      media.addListener(handler);
      return () => media.removeListener(handler);
    }

    return undefined;
  }, [preference]);

  const setPreference = useCallback((nextPreference) => {
    const normalized = normalizePreference(nextPreference);
    setPreferenceState((prev) => (prev === normalized ? prev : normalized));
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "dark";
      return theme === "dark" ? "light" : "dark";
    });
  }, [theme]);

  const useSystemTheme = useCallback(() => {
    setPreferenceState("system");
  }, []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      toggleTheme,
      useSystemTheme,
      isSystemTheme: preference === "system",
    }),
    [theme, preference, setPreference, toggleTheme, useSystemTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
