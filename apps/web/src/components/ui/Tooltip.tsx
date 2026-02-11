"use client";

import type { ReactNode } from "react";

type TooltipProps = {
  content: string;
  children: ReactNode;
};

export default function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="relative inline-flex items-center group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-0 z-50 max-w-[240px] -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-pre-line rounded-md border border-border bg-bg-secondary px-2 py-1 text-[11px] text-text-secondary shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
