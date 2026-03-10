'use client';

import Link from 'next/link';

type AuthEntryFooterProps = {
  mode: 'login' | 'signup';
  signupHref?: string;
  loginHref?: string;
};

export function AuthEntryFooter({
  mode,
  signupHref = '/signup',
  loginHref = '/login',
}: AuthEntryFooterProps) {
  if (mode === 'signup') {
    return (
      <div className="mt-6 border-t border-border pt-4 text-center">
        <p className="text-sm text-text-secondary">이미 계정이 있나요?</p>
        <Link
          href={loginHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-bg-secondary"
        >
          로그인으로 돌아가기
        </Link>
        <p className="mt-3 text-xs leading-5 text-text-tertiary">
          일반 소비자는 <code>/shop</code> 또는 주문 페이지에서 카카오
          간편로그인을 이용해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4 text-center">
      <p className="text-sm text-text-secondary">
        브랜드 또는 매장 관리자 계정이 필요하신가요?
      </p>
      <Link
        href={signupHref}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-bg-secondary"
      >
        회원가입
      </Link>
      <p className="mt-3 text-xs leading-5 text-text-tertiary">
        일반 소비자는 <code>/shop</code> 또는 주문 페이지에서 카카오
        간편로그인을 이용해 주세요.
      </p>
    </div>
  );
}
