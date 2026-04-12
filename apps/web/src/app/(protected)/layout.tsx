'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';

function AccessState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="text-xs font-semibold tracking-[0.18em] text-text-secondary">
          CHECKING ACCESS
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const { role, userData, loading: roleLoading, error: roleError } =
    useUserRole();

  const hasOperationalAccess =
    role === 'system_admin' ||
    (userData?.memberships?.length ?? 0) > 0 ||
    (userData?.ownedBrands?.length ?? 0) > 0;

  useEffect(() => {
    if (status !== 'unauthenticated') return;

    const next = pathname || '/app';
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [pathname, router, status]);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      roleLoading ||
      roleError ||
      hasOperationalAccess
    ) {
      return;
    }

    let cancelled = false;

    const redirectToDestination = async () => {
      try {
        const destination = await resolveAuthenticatedDestination();
        if (cancelled) return;

        router.replace(destination);
      } catch {
        if (cancelled) return;
        router.replace('/approval-pending');
      }
    };

    void redirectToDestination();

    return () => {
      cancelled = true;
    };
  }, [hasOperationalAccess, roleError, roleLoading, router, status]);

  if (status === 'loading' || (status === 'authenticated' && roleLoading)) {
    return (
      <AccessState
        title="접근 권한을 확인하고 있습니다"
        description="로그인 정보와 연결된 브랜드 또는 매장 권한을 확인한 뒤 이동합니다."
      />
    );
  }

  if (status === 'unauthenticated') {
    return (
      <AccessState
        title="로그인 페이지로 이동하고 있습니다"
        description="로그인이 필요한 화면이라 로그인 페이지로 안내하고 있습니다."
      />
    );
  }

  if (roleError) {
    return (
      <AccessState
        title="권한을 확인하지 못했습니다"
        description="권한 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
      />
    );
  }

  if (!hasOperationalAccess) {
    return (
      <AccessState
        title="이동할 화면을 확인하고 있습니다"
        description="현재 계정에 맞는 운영 화면으로 자동 이동하고 있습니다."
      />
    );
  }

  return <>{children}</>;
}
