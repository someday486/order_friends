"use client";

import { useEffect } from "react";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-danger-500/10 flex items-center justify-center mb-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-danger-500"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">오류가 발생했습니다</h2>
      <p className="text-sm text-text-secondary mb-6 max-w-md text-center">
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <button onClick={reset} className="btn-primary h-10 px-6 text-sm">
        다시 시도
      </button>
    </div>
  );
}
