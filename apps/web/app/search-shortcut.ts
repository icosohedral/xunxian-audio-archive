"use client";

import { useEffect, useState, type RefObject } from "react";

/** Focuses the given search input on ⌘K / Ctrl+K and returns the label to display for it. */
export function useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  const [label, setLabel] = useState("⌘ K");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) queueMicrotask(() => setLabel("Ctrl K"));
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);

  return label;
}
