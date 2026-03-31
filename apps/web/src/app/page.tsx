'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthEntryFooter } from '@/components/auth/AuthEntryFooter';
import { LoginForm } from '@/components/auth/LoginForm';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const redirectAuthenticatedUser = async () => {
      let destination = '/app';

      try {
        destination = await resolveAuthenticatedDestination();
      } catch (error) {
        console.warn('[auth] failed to resolve root login redirect:', error);
      }

      if (cancelled) return;
      router.replace(destination);
    };

    void redirectAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-2xl font-bold text-foreground">환영합니다</div>
          <p className="text-text-secondary text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-foreground">환영합니다</div>
          <h1 className="text-2xl font-extrabold text-foreground">
            OrderFriends
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            계정으로 로그인해 주세요
          </p>
        </div>

        <div className="card p-6">
          <LoginForm />
          <AuthEntryFooter mode="login" />
        </div>
      </div>
    </div>
  );
}
