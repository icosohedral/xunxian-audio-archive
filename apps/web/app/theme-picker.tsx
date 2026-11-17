"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "./theme";

const themes = [
  { value: "green", label: "青绿主题" },
  { value: "orange", label: "陶土橙主题" },
  { value: "dark", label: "深色主题" },
] as const;

type ThemeValue = (typeof themes)[number]["value"];

function applyTheme(value: ThemeValue) {
  const root = document.documentElement;
  if (value === "green") delete root.dataset.theme;
  else root.dataset.theme = "orange";
  if (value === "dark") root.dataset.mode = "dark";
  else delete root.dataset.mode;
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeValue>("green");

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
    <div className="theme-picker" role="group" aria-label="配色主题">
      {themes.map(({ value, label }) => (
        <button key={value} type="button" className="theme-swatch" data-theme-value={value} aria-label={label} title={label} aria-pressed={theme === value} onClick={() => choose(value)} />
      ))}
    </div>
  );
}
