'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';

function formatAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('API Network Error: /me')) {
    return '권한 확인 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';
  }

  return message || '로그인 상태를 확인하지 못했습니다.';
}

export default function AppPage() {
  const router = useRouter();
  const { status, signOut } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const resolveDestination = async () => {
      try {
        setErrorMsg(null);
        const destination = await resolveAuthenticatedDestination();
        if (cancelled) return;

        router.replace(destination);
        router.refresh();
      } catch (error) {
        if (cancelled) return;
        setErrorMsg(formatAccessError(error));
      }
    };

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [retryKey, router, status]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="text-xs font-semibold tracking-[0.18em] text-text-secondary">
          CHECKING ACCESS
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-foreground">
          계정 상태를 확인하고 있습니다
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          로그인 정보와 연결된 권한을 확인한 뒤 알맞은 화면으로 자동 이동합니다.
        </p>
        {errorMsg ? (
          <>
            <div className="mt-4 rounded-md bg-danger-50 p-3 text-sm text-danger-500">
              {errorMsg}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setRetryKey((current) => current + 1)}
                className="inline-flex flex-1 items-center justify-center rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-white"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground"
              >
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-md border border-border bg-bg-secondary p-3 text-sm text-text-tertiary">
            잠시만 기다려 주세요.
          </div>
        )}
      </div>
    </div>
  );
}
