"use client";

import { forwardRef } from "react";

type DragHandleProps = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors ${className}`}
        aria-label="드래그하여 순서 변경"
        {...props}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>
    );
  },
);

DragHandle.displayName = "DragHandle";

export { DragHandle };
export type { DragHandleProps };
