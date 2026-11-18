"use client";

import type { KeyboardEvent, ReactNode } from "react";

/** Previous / next buttons with an editable page number for jumping straight to a page. */
export function Pagination({ page, pages, onChange, note }: { page: number; pages: number; onChange: (page: number) => void; note?: ReactNode }) {
  if (pages <= 1) return null;

  const commit = (input: HTMLInputElement) => {
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value)) {
      input.value = String(page);
      return;
    }
    const target = Math.min(pages, Math.max(1, value));
    input.value = String(target);
    if (target !== page) onChange(target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit(event.currentTarget);
      event.currentTarget.select();
    } else if (event.key === "Escape") {
      event.currentTarget.value = String(page);
      event.currentTarget.blur();
    }
  };

  return (
    <nav className="pagination" aria-label="分页">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>上一页</button>
      <span className="page-jump">
        第
        <input
          key={page}
          type="text"
          inputMode="numeric"
          defaultValue={page}
          aria-label={`页码，共 ${pages} 页，输入后按回车跳转`}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={onKeyDown}
          onBlur={(event) => commit(event.currentTarget)}
        />
        / {pages} 页{note}
      </span>
      <button type="button" disabled={page === pages} onClick={() => onChange(page + 1)}>下一页</button>
    </nav>
  );
}
