"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./locale-provider";
import { THEME_STORAGE_KEY } from "./theme";

const themes = ["green", "orange", "dark"] as const;

type ThemeValue = (typeof themes)[number];

function applyTheme(value: ThemeValue) {
  const root = document.documentElement;
  if (value === "green") delete root.dataset.theme;
  else root.dataset.theme = "orange";
  if (value === "dark") root.dataset.mode = "dark";
  else delete root.dataset.mode;
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeValue>("green");
  const { t } = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    const current: ThemeValue = root.dataset.mode === "dark" ? "dark" : root.dataset.theme === "orange" ? "orange" : "green";
    queueMicrotask(() => setTheme(current));
  }, []);

  function choose(value: ThemeValue) {
    setTheme(value);
    applyTheme(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* storage unavailable: theme still applies for this visit */ }
  }

  return (
    <div className="theme-picker" role="group" aria-label={t.theme.label}>
      {themes.map((value) => (
        <button key={value} type="button" className="theme-swatch" data-theme-value={value} aria-label={t.theme[value]} title={t.theme[value]} aria-pressed={theme === value} onClick={() => choose(value)} />
      ))}
    </div>
  );
}
