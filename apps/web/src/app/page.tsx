'use client';

import { AuthEntryFooter } from '@/components/auth/AuthEntryFooter';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();

  // roleLoading 대기 없이 인증 확인 즉시 이동 (role fetch 완료 불필요)
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/app');
      router.refresh();
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-4xl mb-4">🍽️</div>
          <p className="text-text-secondary text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-extrabold text-foreground">
            OrderFriends
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            계정에 로그인하세요
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
