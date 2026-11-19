"use client";

import { SearchX } from "lucide-react";
import { useLocale } from "./locale-provider";

/** Shown in place of the list when search or filters match nothing; carries the usage hint. */
export function EmptyResults({ onReset }: { onReset: () => void }) {
  const { t } = useLocale();
  return (
    <div className="empty-results" role="status">
      <SearchX size={22} aria-hidden="true" />
      <strong>{t.empty.title}</strong>
      <p>{t.empty.hint}</p>
      <button type="button" onClick={onReset}>{t.empty.reset}</button>
    </div>
  );
}
