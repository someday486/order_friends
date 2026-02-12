"use client";

import { useEffect } from "react";

export default function ErrorPage({
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
      <div className="w-full max-w-md text-center">
        <div className="text-4xl mb-3">?!</div>
        <h1 className="text-xl font-extrabold mb-2">오류가 발생했습니다</h1>
        <p className="text-sm text-text-secondary mb-6 break-words">
          {error.message || "알 수 없는 오류가 발생했습니다."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="btn-primary h-10 px-4 text-sm"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
