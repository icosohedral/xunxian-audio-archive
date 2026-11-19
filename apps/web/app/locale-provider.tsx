"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Check, Languages } from "lucide-react";
import { htmlLang, LOCALE_COOKIE, LOCALE_NAMES, LOCALE_SHORT, LOCALES, messages, tagLabel, type Locale, type Messages } from "./i18n";
import { usePopover } from "./use-popover";

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

/** Sidebar button showing the current language; clicking it opens a menu of the languages. */
export function LanguagePicker() {
  const { locale, t, setLocale } = useLocale();
  const { open, setOpen, rootRef, triggerRef, closeAndFocus } = usePopover();

  function choose(next: Locale) {
    closeAndFocus();
    if (next !== locale) setLocale(next);
  }

  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="lang-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={t.language.current(LOCALE_NAMES[locale])}
        title={LOCALE_NAMES[locale]}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Languages size={14} aria-hidden="true" />
        <span>{LOCALE_SHORT[locale]}</span>
      </button>
      {open && (
        <div className="lang-popover" role="group" aria-label={t.language.label}>
          {LOCALES.map((value) => (
            <button key={value} type="button" lang={htmlLang(value)} aria-pressed={value === locale} onClick={() => choose(value)}>
              <span>{LOCALE_NAMES[value]}</span>
              {value === locale && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
