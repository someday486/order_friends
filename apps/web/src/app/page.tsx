'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BellRing,
  Boxes,
  ClipboardList,
  Store,
} from 'lucide-react';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';

const serviceHighlights = [
  {
    title: '브랜드 소개와 주문 진입을 한 화면에서',
    description:
      '고객이 브랜드를 이해하고 바로 주문 페이지로 이동할 수 있도록 첫 화면의 흐름을 정리합니다.',
  },
  {
    title: '운영팀을 위한 한 번의 정리',
    description:
      '브랜드, 매장, 상품, 주문 관리를 각각 흩어놓지 않고 운영자가 필요한 화면으로 곧바로 이어지게 만듭니다.',
  },
  {
    title: '실사용 동선이 드러나는 구조',
    description:
      '서비스 소개, 주문 시작, 주문 확인까지 이어지는 흐름이 보여 카카오 비즈채널 심사 대응에도 유리합니다.',
  },
];

const workflowSteps = [
  {
    label: '01',
    title: '브랜드 소개',
    description:
      '첫 화면에서 서비스 성격과 운영 브랜드의 결을 전달합니다.',
    icon: Store,
  },
  {
    label: '02',
    title: '주문 페이지 진입',
    description:
      '고객은 브랜드 또는 매장별 주문 동선으로 자연스럽게 이동합니다.',
    icon: Boxes,
  },
  {
    label: '03',
    title: '주문 접수와 확인',
    description:
      '운영자는 주문 내역, 상태, 수령 방식까지 한 흐름 안에서 관리합니다.',
    icon: ClipboardList,
  },
  {
    label: '04',
    title: '알림과 후속 운영',
    description:
      '주문 후속 안내와 운영 커뮤니케이션까지 연결되는 구조를 준비합니다.',
    icon: BellRing,
  },
];

const operatingPoints = [
  '브랜드별 공개 주문 페이지 운영',
  '매장과 상품 구성을 한 곳에서 관리',
  '주문 이력과 운영 대시보드 연결',
];

export default function HomePage() {
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
        console.warn('[auth] failed to resolve root redirect:', error);
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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-6">
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b6f47]">
            OrderFriends
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1f1b16]">
            브랜드 운영 화면을 준비하고 있습니다.
          </p>
          <p className="mt-2 text-sm text-[#6f6558]">잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#f4f1eb] text-[#1f1b16]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_transparent_42%),radial-gradient(circle_at_85%_20%,_rgba(220,189,142,0.28),_transparent_28%),linear-gradient(180deg,_#f8f3ec_0%,_#efe6da_55%,_#f5efe8_100%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-[42vw] bg-[linear-gradient(180deg,rgba(64,47,28,0.08),rgba(64,47,28,0.02))] lg:block" />

      <header className="relative z-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-8 lg:px-10">
          <Link href="/" className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6f47]">
              Brand order operations
            </span>
            <span className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#1f1b16]">
              오더프렌즈
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/shop"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-[#5b5245] transition hover:bg-white/70 sm:inline-flex"
            >
              고객 주문 화면
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#1f1b16] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#31281f]"
            >
              운영자 로그인
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex min-h-[calc(100svh-84px)] w-full max-w-7xl items-center px-6 pb-16 pt-6 sm:px-8 lg:px-10">
          <div className="grid w-full gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#8b6f47]">
                OrderFriends Project
              </p>
              <h1 className="mt-5 max-w-4xl text-[3.15rem] font-semibold leading-[0.95] tracking-[-0.07em] text-[#1f1b16] sm:text-[4.25rem] lg:text-[5.5rem]">
                브랜드 소개부터 주문 접수,
                <br />
                운영 관리까지 하나의 흐름으로.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f574c] sm:text-lg">
                오더프렌즈는 브랜드와 매장이 고객에게 보이는 첫 화면, 실제
                주문이 일어나는 공개 페이지, 그리고 운영자가 매일 확인하는 관리
                화면을 하나의 서비스 경험으로 연결합니다.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1f1b16] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#31281f]"
                >
                  운영자 시작하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center rounded-full border border-[#cfc0ab] bg-white/70 px-6 py-3 text-sm font-semibold text-[#3b342c] transition hover:bg-white"
                >
                  고객 주문 화면 보기
                </Link>
              </div>

              <div className="mt-12 grid gap-6 border-t border-[#d8cbbb] pt-8 md:grid-cols-3">
                {serviceHighlights.map((item) => (
                  <div key={item.title} className="max-w-sm">
                    <h2 className="text-base font-semibold text-[#1f1b16]">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#6a6258]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-10 h-28 w-28 rounded-full bg-[#d9b98a]/35 blur-3xl" />
              <div className="absolute bottom-0 right-10 h-32 w-32 rounded-full bg-white/80 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(247,241,232,0.98))] p-6 shadow-[0_40px_120px_rgba(48,37,23,0.14)] backdrop-blur">
                <div className="flex items-start justify-between gap-4 border-b border-[#dfd4c6] pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6f47]">
                      Today&apos;s operating flow
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#1f1b16]">
                      메인에서 서비스 성격이
                      <br />
                      바로 드러나게 설계합니다.
                    </p>
                  </div>
                  <div className="rounded-full bg-[#1f1b16] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                    live
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {workflowSteps.slice(0, 3).map((step) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.label}
                        className="flex items-start gap-4 rounded-[1.5rem] border border-[#e5dbce] bg-white/80 px-4 py-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1e4d1] text-[#6c5532]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6f47]">
                              {step.label}
                            </span>
                            <h2 className="text-base font-semibold text-[#1f1b16]">
                              {step.title}
                            </h2>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#6a6258]">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[1.6rem] bg-[#1f1b16] px-5 py-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d0b188]">
                    Why this matters
                  </p>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em]">
                    고객에게는 쉬운 진입을,
                    <br />
                    운영팀에는 선명한 관리 동선을 제공합니다.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-white/78">
                    {operatingPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#d8cbbb]/90 bg-white/45">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6f47]">
                Service flow
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#1f1b16] sm:text-4xl">
                심사자도, 고객도,
                <br />
                같은 화면에서 이해할 수 있는 동선.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#5f574c]">
                메인 소개 화면에서 서비스 정체성을 보여주고, 주문 시작부터 운영
                확인까지 이어지는 단계를 구조적으로 정리합니다. 첫 화면만 봐도
                무엇을 제공하는 서비스인지 설명이 되도록 구성했습니다.
              </p>
            </div>

            <div className="space-y-6">
              {workflowSteps.map((step) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.label}
                    className="flex gap-5 border-b border-[#e2d8cb] pb-6 last:border-b-0 last:pb-0"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#d9cbb8] bg-white/85 text-[#6c5532]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b6f47]">
                          {step.label}
                        </span>
                        <h3 className="text-lg font-semibold text-[#1f1b16]">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#6a6258]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6f47]">
                For operators
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#1f1b16] sm:text-4xl">
                여러 브랜드와 매장을 다루는 운영팀에 맞춘 시작 화면.
              </h2>
            </div>
            <div className="grid gap-8 text-sm leading-6 text-[#5f574c] sm:grid-cols-3">
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  브랜드 소개
                </h3>
                <p className="mt-2">
                  프로젝트와 브랜드의 성격을 첫 화면에서 정리해 고객 신뢰와
                  심사 대응을 동시에 챙깁니다.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  주문 전환
                </h3>
                <p className="mt-2">
                  소개에서 끝나지 않고 실제 주문 화면으로 넘어가는 행동 경로를
                  분명하게 설계합니다.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  운영 일관성
                </h3>
                <p className="mt-2">
                  관리자 로그인, 공개 주문, 후속 운영까지 제품의 톤과 구조가
                  하나로 이어집니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#d8cbbb]/90 bg-[#201913] text-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d0b188]">
                Launch the first impression
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                소개형 메인페이지로 프로젝트의 얼굴을 먼저 세웁니다.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                브랜드 운영 서비스인지, 고객이 어디서 주문을 시작하는지, 운영자는
                어디로 들어가야 하는지를 첫 화면에서 바로 이해할 수 있도록
                구성했습니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1f1b16] transition hover:bg-[#f5ede2]"
              >
                회원가입
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                로그인으로 이동
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
