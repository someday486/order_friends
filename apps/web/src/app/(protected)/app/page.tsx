'use client';

import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type MeResponse = {
  user: {
    id: string;
    email?: string;
    role: string;
  };
  memberships: unknown[];
  ownedBrands: unknown[];
  isSystemAdmin?: boolean;
};

function isMembershipPendingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('No active brand or branch memberships found') ||
    message.includes('Admin users cannot access customer area')
  );
}

export default function AppPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const resolveDestination = async () => {
      try {
        setErrorMsg(null);
        const me = await apiClient.get<MeResponse>('/me');
        if (cancelled) return;

        if (me.isSystemAdmin || me.user.role === 'system_admin') {
          router.replace('/admin');
          router.refresh();
          return;
        }

        const hasActiveAccess =
          me.memberships.length > 0 || me.ownedBrands.length > 0;

        router.replace(hasActiveAccess ? '/customer' : '/approval-pending');
        router.refresh();
      } catch (error) {
        if (cancelled) return;

        if (isMembershipPendingError(error)) {
          router.replace('/approval-pending');
          router.refresh();
          return;
        }

        setErrorMsg(
          error instanceof Error
            ? error.message
            : '로그인 상태를 확인하지 못했습니다.',
        );
      }
    };

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [router, status]);

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
          로그인 정보와 연결된 권한을 확인한 뒤 맞는 화면으로 자동 이동합니다.
        </p>
        {errorMsg ? (
          <div className="mt-4 rounded-md bg-danger-50 p-3 text-sm text-danger-500">
            {errorMsg}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-border bg-bg-secondary p-3 text-sm text-text-tertiary">
            잠시만 기다려 주세요.
          </div>
        )}
      </div>
    </div>
  );
}
