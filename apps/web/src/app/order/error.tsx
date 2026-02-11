"use client";

import { useEffect } from "react";

export default function OrderError({
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="text-center">
        <h2 className="text-lg font-bold mb-2">오류가 발생했습니다</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || "알 수 없는 오류가 발생했습니다."}
        </p>
        <button onClick={reset} className="btn-primary h-10 px-6 text-sm">
          다시 시도
        </button>
      </div>
    </div>
  );
}
