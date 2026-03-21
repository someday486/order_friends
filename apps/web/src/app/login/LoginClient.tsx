'use client';

import { AuthEntryFooter } from '@/components/auth/AuthEntryFooter';
import { LoginForm } from '@/components/auth/LoginForm';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginClient({
  next,
  registered = false,
}: {
  next: string;
  registered?: boolean;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const signupHref = `/signup?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const redirectAuthenticatedUser = async () => {
      let destination = next;
      if (next === '/app') {
        try {
          destination = await resolveAuthenticatedDestination();
        } catch (error) {
          console.warn('[auth] failed to resolve login redirect:', error);
        }
      }

      if (cancelled) return;
      router.replace(destination);
      router.refresh();
    };

    void redirectAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [status, router, next]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">환영합니다</div>
          <h1 className="text-2xl font-extrabold text-foreground">
            OrderFriends
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            계정으로 로그인해 주세요
          </p>
        </div>

        <div className="card p-6">
          {registered ? (
            <div className="mb-4 rounded-md bg-success-50 p-3 text-sm text-success-600">
              회원가입이 완료되었습니다. 이메일 확인 후 로그인해 주세요.
            </div>
          ) : null}
          <LoginForm redirectTo={next} />
          <AuthEntryFooter mode="login" signupHref={signupHref} />
        </div>
      </div>
    </div>
  );
}
