"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Open state for a small popover anchored to a trigger button (the sidebar's theme and language menus).
 * Clicking outside `rootRef` closes it; Escape closes it and returns focus to the trigger.
 */
export function usePopover<Root extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<Root | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /** Closes after a choice and puts focus back on the trigger. */
  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return { open, setOpen, rootRef, triggerRef, closeAndFocus };
}
