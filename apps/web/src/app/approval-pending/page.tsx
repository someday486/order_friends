'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { recoverFromAuthError } from '@/lib/auth/client';
import { supabaseBrowser } from '@/lib/supabase/client';
import { invalidateSessionCache } from '@/lib/auth/client';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';

const nextSteps = [
  '이메일 인증을 완료했는지 먼저 확인합니다.',
  '브랜드 승인을 받은 경우 승인 상태를 다시 확인합니다.',
  '여전히 접근이 안 되면 로그아웃 후 다시 로그인합니다.',
];

export default function ApprovalPendingPage() {
  const router = useRouter();
  const { user, signOut, status, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecheck = async () => {
    try {
      setChecking(true);
      setError(null);

      invalidateSessionCache();
      apiClient.clearCache();

      const { error: refreshSessionError } =
        await supabaseBrowser.auth.refreshSession();

      if (refreshSessionError) {
        if (await recoverFromAuthError(refreshSessionError)) {
          await refresh();
          router.replace('/login?reason=session-expired');
          return;
        }

        throw refreshSessionError;
      }

      await refresh();

      invalidateSessionCache();
      apiClient.clearCache();

      const destination = await resolveAuthenticatedDestination();
      router.replace(destination);
    } catch (err) {
      if (await recoverFromAuthError(err)) {
        await refresh();
        router.replace('/login?reason=session-expired');
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : '승인 상태를 다시 확인하지 못했습니다.',
      );
    } finally {
      setChecking(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">
          승인 상태를 확인하는 중입니다.
        </p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="card w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-extrabold text-foreground">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            승인 상태를 보려면 먼저 로그인해 주세요.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-white"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="card w-full max-w-2xl p-6">
        <div className="text-sm font-semibold tracking-[0.18em] text-text-secondary">
          APPROVAL PENDING
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">
          아직 운영 권한 부여가 완료되지 않았습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          계정 생성은 완료되었지만 아직 사용할 수 있는 운영 권한이 연결되지
          않았습니다. 새 사업자 계정으로 브랜드 승인을 받은 경우 아래 버튼으로
          승인 상태를 다시 확인해 주세요.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-xs font-semibold text-text-secondary">
              현재 로그인한 계정
            </div>
            <div className="mt-2 text-base font-bold text-foreground">
              {user?.email ?? '이메일 정보 없음'}
            </div>
            <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-[11px] leading-5 text-text-secondary">
              시스템 관리자가
              <span className="px-1 font-semibold text-foreground">
                /admin/members
              </span>
              에서 이 계정을 브랜드 생성 가능 계정으로 승인하거나, 기존 브랜드
              또는 매장 멤버로 추가해야 합니다.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-xs font-semibold text-text-secondary">
              다음 단계
            </div>
            <ol className="mt-2 space-y-2 text-sm text-foreground">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-[11px] font-bold">
                    {index + 1}
                  </span>
                  <span className="leading-5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-600">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleRecheck()}
            disabled={checking}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checking ? '승인 상태 확인 중...' : '승인 상태 다시 확인'}
          </button>
          <Link
            href="/shop"
            className="inline-flex flex-1 items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground"
          >
            공개 주문 화면으로 가기
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
