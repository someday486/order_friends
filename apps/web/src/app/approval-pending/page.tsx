'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function ApprovalPendingPage() {
  const { user, signOut, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-text-secondary">상태를 확인하는 중...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-extrabold text-foreground">
            로그인이 필요합니다
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            승인 대기 상태를 보려면 먼저 로그인해 주세요.
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="card w-full max-w-xl p-6">
        <div className="text-sm font-semibold text-text-secondary">
          APPROVAL PENDING
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">
          관리자 승인 대기 중입니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          가입한 계정은 확인되었지만, 아직 브랜드 또는 매장 멤버십이 연결되지
          않아 운영 화면에 접근할 수 없습니다.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-bg-secondary p-4">
          <div className="text-xs text-text-tertiary">현재 로그인 계정</div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {user?.email ?? '이메일 정보 없음'}
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
          시스템 관리자에게 이 계정의 사용자 ID를 전달해
          <span className="font-semibold text-foreground">
            {' '}
            /admin/members{' '}
          </span>
          에서 브랜드 멤버 또는 매장 멤버로 추가해 달라고 요청해 주세요. 승인 후
          다시 로그인하면 운영 화면으로 이동합니다.
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-white"
          >
            승인 상태 다시 확인
          </Link>
          <Link
            href="/shop"
            className="inline-flex flex-1 items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground"
          >
            소비자 주문하러 가기
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
