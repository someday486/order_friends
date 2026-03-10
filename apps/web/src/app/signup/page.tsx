import Link from 'next/link';
import { SignupForm } from '@/components/auth/SignupForm';
import { AuthEntryFooter } from '@/components/auth/AuthEntryFooter';

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next?.trim();
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">[+]</div>
          <h1 className="text-2xl font-extrabold text-foreground">
            관리자 회원가입
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            브랜드/매장 관리자용 계정을 먼저 만든 뒤, 운영 승인 후 관리 권한을
            연결합니다.
          </p>
        </div>

        <div className="card p-6">
          <SignupForm loginHref={loginHref} />
          <AuthEntryFooter mode="signup" loginHref={loginHref} />
        </div>

        <div className="mt-4 text-center text-xs text-text-tertiary">
          일반 소비자 주문은{' '}
          <Link
            href="/shop"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            /shop
          </Link>
          에서 시작해 주세요.
        </div>
      </div>
    </div>
  );
}
