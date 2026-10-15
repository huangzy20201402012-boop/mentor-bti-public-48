"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

export interface SheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Bottom sheet used by every feedback entry. Rendered into a portal so the
 * fixed positioning never lands inside a transformed ancestor (the result page
 * animates several blocks with `transform`, which would otherwise become the
 * containing block). Handles Escape, a focus trap, focus restoration to the
 * trigger and a body scroll lock while open.
 */
export function Sheet({ open, title, description, onClose, children, footer }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => setMounted(true), []);

  // focus / scroll-lock / trap all depend on `mounted` too: the portal is absent
  // on the first render, so an effect keyed only on `open` would skip focusing
  // a panel that mounts with `open` already true.
  useEffect(() => {
    if (!mounted || !open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => restoreFocusRef.current?.focus();
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || !open) return;
    function focusableItems(): HTMLElement[] {
      if (!panelRef.current) return [];
      return Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((item) => item.offsetParent !== null);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, open, onClose]);

  useEffect(() => {
    if (!mounted || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [mounted, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={panelRef}
      >
        <div className="sheet-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p className="sheet-description" id={descriptionId}>{description}</p> : null}
          </div>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="关闭">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
