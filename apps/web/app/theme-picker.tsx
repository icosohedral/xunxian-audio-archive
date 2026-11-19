"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./locale-provider";
import { THEME_STORAGE_KEY } from "./theme";
import { usePopover } from "./use-popover";

const themes = ["green", "orange", "dark"] as const;

type ThemeValue = (typeof themes)[number];

function applyTheme(value: ThemeValue) {
  const root = document.documentElement;
  if (value === "green") delete root.dataset.theme;
  else root.dataset.theme = "orange";
  if (value === "dark") root.dataset.mode = "dark";
  else delete root.dataset.mode;
}

/** Shows the current theme's swatch; clicking it opens the other swatches to choose from. */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeValue>("green");
  const { open, setOpen, rootRef, triggerRef, closeAndFocus } = usePopover();
  const { t } = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    const current: ThemeValue = root.dataset.mode === "dark" ? "dark" : root.dataset.theme === "orange" ? "orange" : "green";
    queueMicrotask(() => setTheme(current));
  }, []);

  function choose(value: ThemeValue) {
    setTheme(value);
    closeAndFocus();
    applyTheme(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* storage unavailable: theme still applies for this visit */ }
  }

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-swatch theme-current"
        data-theme-value={theme}
        aria-label={t.theme.current(t.theme[theme])}
        title={t.theme[theme]}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div className="theme-popover" role="group" aria-label={t.theme.label}>
          {themes.map((value) => (
            <button key={value} type="button" className="theme-swatch" data-theme-value={value} aria-label={t.theme[value]} title={t.theme[value]} aria-pressed={theme === value} onClick={() => choose(value)} />
          ))}
        </div>
      )}
    </div>
  );
}
