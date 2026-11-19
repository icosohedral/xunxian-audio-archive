"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { htmlLang, LOCALE_COOKIE, messages, tagLabel, type Locale, type Messages } from "./i18n";

type LocaleState = {
  locale: Locale;
  t: Messages;
  /** Display label for a category tag in the current language. */
  tag: (tag: string) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleState | null>(null);

/** Holds the page language. The server picks the first one, so the first paint is already in that language. */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = htmlLang(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<LocaleState>(() => ({
    locale,
    t: messages[locale],
    tag: (tag: string) => tagLabel(locale, tag),
    setLocale,
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

/** Header button that switches between Chinese and English. */
export function LanguageToggle() {
  const { locale, t, setLocale } = useLocale();
  return (
    <button type="button" className="lang-toggle" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} aria-label={t.language.switchTo} title={t.language.switchTo} lang={locale === "zh" ? "en" : "zh-CN"}>
      <Languages size={14} aria-hidden="true" />
      <span>{t.language.short}</span>
    </button>
  );
}
