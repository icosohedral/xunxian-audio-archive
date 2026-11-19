"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { UNCATEGORIZED } from "./i18n";
import { useLocale } from "./locale-provider";

const VISIBLE_TAGS = 5;

type CategoryChipsProps = {
  /** Tag names, most-used first. */
  tags: string[];
  counts: Record<string, number>;
  total: number;
  category: string;
  onSelect: (category: string) => void;
};

/** Shows "All" plus the top tags as chips; everything else lives in a "More" menu. Only the active chip shows its count. */
export function CategoryChips({ tags, counts, total, category, onSelect }: CategoryChipsProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const { t, tag: label } = useLocale();
  const visible = tags.slice(0, VISIBLE_TAGS);
  const hidden = [UNCATEGORIZED, ...tags.slice(VISIBLE_TAGS)];
  const activeHidden = hidden.includes(category) ? category : null;

  useEffect(() => {
    function close(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.removeAttribute("open");
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(value: string) {
    menuRef.current?.removeAttribute("open");
    onSelect(value);
  }

  const chip = (value: string, label: string, count: number) => {
    const active = category === value;
    return <button key={value} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => choose(value)}>{label}{active && <span>{count.toLocaleString()}</span>}</button>;
  };

  return (
    <div className="filter-chips">
      {chip("all", t.chips.all, total)}
      {visible.map((tag) => chip(tag, label(tag), counts[tag] ?? 0))}
      <details ref={menuRef} className="chip-menu">
        <summary className={activeHidden ? "active" : ""}>
          {activeHidden ? <>{label(activeHidden)}<span>{(counts[activeHidden] ?? 0).toLocaleString()}</span></> : t.chips.more}
          <ChevronDown size={13} aria-hidden="true" />
        </summary>
        <div className="chip-menu-list">
          {hidden.map((tag) => (
            <button key={tag} type="button" className={category === tag ? "active" : ""} aria-pressed={category === tag} onClick={() => choose(tag)}>
              <span>{label(tag)}</span><small>{(counts[tag] ?? 0).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
