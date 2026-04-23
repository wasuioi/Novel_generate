"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
  // Which side of the trigger the popover anchors to. Default "left" opens
  // rightward; use "right" in narrow containers (e.g. Settings drawer) so
  // the panel stays within the container instead of overflowing.
  side?: "left" | "right";
};

export function HelpPopover({ children, ariaLabel = "Help", side = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[10px] leading-none text-zinc-400 hover:text-zinc-100 hover:border-zinc-400"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute ${side === "right" ? "right-0" : "left-0"} top-full mt-1 w-72 rounded border border-zinc-700 bg-zinc-800 p-3 text-xs text-zinc-200 shadow-lg z-30 whitespace-pre-line`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
