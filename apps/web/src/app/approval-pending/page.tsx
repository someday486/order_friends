'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const nextSteps = [
  '이메일 인증을 완료했는지 먼저 확인합니다.',
  '시스템 관리자에게 현재 계정 이메일 또는 사용자 ID를 전달합니다.',
  '브랜드 또는 매장 권한이 부여되면 다시 로그인합니다.',
];

export default function ApprovalPendingPage() {
  const { user, signOut, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-text-secondary">
          승인 상태를 확인하는 중입니다.
        </p>
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
      <div className="card w-full max-w-2xl p-6">
        <div className="text-sm font-semibold tracking-[0.18em] text-text-secondary">
          APPROVAL PENDING
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">
          아직 운영 권한 부여가 완료되지 않았습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          계정 생성은 완료되었지만 브랜드 또는 매장 멤버십이 아직 연결되지
          않아 운영 화면으로 들어갈 수 없습니다.
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
              에서 이 계정을 브랜드 멤버 또는 매장 멤버로 추가해야 합니다.
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
