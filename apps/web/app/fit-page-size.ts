"use client";

import { useEffect, useState, type RefObject } from "react";

/** Rows may shrink by at most this much to fit one more row on the page. */
const MAX_ROW_SHRINK = 0.1;

/**
 * How many list items fit in the list card without scrolling, and stretches/shrinks the rows so they
 * fill the card exactly.
 *
 * On desktop the list card has a fixed height (it fills down to the sidebar's bottom edge). The page size
 * is the number of rows that fit, times the grid's column count. If the space left over is more than half
 * a row and one more row fits by shrinking rows at most 10%, that extra row is added. The list element
 * gets `data-fit` and `--fit-row-height` so CSS can give every row the same height and leave no gap at the
 * bottom. On narrow screens the list has no fixed height (`overflow-y: visible`), the page scrolls as
 * usual, `fallback` is used and rows keep their natural height.
 *
 * Re-measures whenever the list's box changes size (window resize, player appearing, rule panel opening)
 * and when `ready` turns true (rows exist to be measured).
 */
export function useFitPageSize(listRef: RefObject<HTMLElement | null>, itemSelector: string, fallback: number, ready: boolean) {
  const [pageSize, setPageSize] = useState(fallback);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !ready) return;
    const clearFit = () => {
      delete list.dataset.fit;
      list.style.removeProperty("--fit-row-height");
    };
    const measure = () => {
      const style = getComputedStyle(list);
      if (style.overflowY === "visible") {
        clearFit();
        setPageSize(fallback);
        return;
      }
      // Measure rows at their natural height, not the height a previous fit gave them.
      clearFit();
      const items = list.querySelectorAll<HTMLElement>(itemSelector);
      if (!items.length) return;
      const columns = style.display === "grid" ? style.gridTemplateColumns.split(" ").filter(Boolean).length : 1;
      const first = items[0];
      const nextRow = items[columns];
      const rowHeight = nextRow ? nextRow.offsetTop - first.offsetTop : first.offsetHeight;
      if (rowHeight <= 0) return;
      // Space above the first row (a sticky table head, for example) is not available to rows.
      const headSpace = first.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop + list.scrollTop;
      const available = list.clientHeight - headSpace;
      let rows = Math.max(1, Math.floor(available / rowHeight));
      if (available - rows * rowHeight >= rowHeight / 2 && available / (rows + 1) >= rowHeight * (1 - MAX_ROW_SHRINK)) rows += 1;
      list.dataset.fit = "";
      list.style.setProperty("--fit-row-height", `${available / rows}px`);
      setPageSize(rows * columns);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      observer.disconnect();
      clearFit();
    };
  }, [listRef, itemSelector, fallback, ready]);

  return pageSize;
}
