'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KakaoQuickLoginButton } from '@/components/auth/KakaoQuickLoginButton';
import { AuthEntryFooter } from '@/components/auth/AuthEntryFooter';
import { LoginForm } from '@/components/auth/LoginForm';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';

function isOrderLoginPath(value: string) {
  return value.startsWith('/order/');
}

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
  const isOrderLogin = isOrderLoginPath(next);

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
          <div className="text-2xl font-bold text-foreground">환영합니다</div>
          <h1 className="text-2xl font-extrabold text-foreground">
            OrderFriends
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            {isOrderLogin
              ? '주문을 계속하려면 카카오 로그인이 필요해요'
              : '계정으로 로그인해 주세요'}
          </p>
        </div>

        <div className="card p-6">
          {registered ? (
            <div className="mb-4 rounded-md bg-success-50 p-3 text-sm text-success-600">
              회원가입이 완료되었어요. 이메일 확인 후 로그인해 주세요.
            </div>
          ) : null}
          {isOrderLogin ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-bg-secondary px-4 py-4">
                <div className="text-sm font-semibold text-foreground">
                  카카오 로그인으로 주문을 이어갈 수 있어요
                </div>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  잠시 뒤 카카오 로그인 화면으로 이동하고, 원하지 않으면 아래
                  버튼으로 직접 진행할 수 있어요.
                </p>
              </div>
              <KakaoQuickLoginButton
                redirectPath={next}
                autoStart
                className="w-full"
              />
            </div>
          ) : (
            <LoginForm />
          )}
          <AuthEntryFooter mode="login" signupHref={signupHref} />
        </div>
      </div>
    </div>
  );
}
