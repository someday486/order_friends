'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  CreditCard,
  Store,
} from 'lucide-react';
import { resolveAuthenticatedDestination } from '@/lib/auth/redirect';
import { useAuth } from '@/hooks/useAuth';

const serviceHighlights = [
  {
    title: '브랜드 온라인샵을 빠르게 열기',
    description:
      '상품을 노출하고 주문 링크를 공유해 자체 고객을 바로 주문 흐름으로 연결합니다.',
  },
  {
    title: '셀러 운영을 한 곳에서 관리',
    description:
      '브랜드, 스토어/출고지, 상품, 주문, 결제, 정산을 흩어놓지 않고 한 워크스페이스에서 관리합니다.',
  },
  {
    title: '테이블오더가 아닌 온라인 판매',
    description:
      '매장 내 테이블 주문이 아니라 링크 기반 온라인샵과 주문 운영에 초점을 둡니다.',
  },
];

const workflowSteps = [
  {
    label: '01',
    title: '온라인샵 개설',
    description:
      '브랜드 URL과 상품 노출 정책을 설정해 공개 판매 페이지를 준비합니다.',
    icon: Store,
  },
  {
    label: '02',
    title: '상품 판매',
    description:
      '고객은 온라인샵 또는 주문 링크에서 상품, 옵션, 수령/배송 방식을 선택합니다.',
    icon: Boxes,
  },
  {
    label: '03',
    title: '주문 운영',
    description:
      '운영자는 주문 상태, 결제/입금, 재고, 고객 문의를 한 흐름 안에서 처리합니다.',
    icon: ClipboardList,
  },
  {
    label: '04',
    title: '결제와 정산',
    description:
      'PG 결제, 무통장 입금, 구독 빌링, 판매 정산을 구분해 추적합니다.',
    icon: CreditCard,
  },
];

const operatingPoints = [
  '브랜드별 온라인샵과 주문 링크 운영',
  '스토어/출고지와 상품 구성을 한 곳에서 관리',
  '주문, 결제, 재고, 정산 데이터를 연결',
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
            온라인마켓 운영 화면을 준비하고 있습니다.
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
              Online market operations
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
              온라인샵 보기
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
                온라인샵 개설부터 주문 접수,
                <br />
                결제와 정산까지 하나의 흐름으로.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f574c] sm:text-lg">
                오더프렌즈는 브랜드와 셀러가 자체 온라인샵을 열고 상품 판매,
                주문 처리, 결제/입금, 재고, 정산을 하나의 운영 경험으로 연결할 수
                있게 돕는 온라인마켓 운영 플랫폼입니다.
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
                  온라인샵 둘러보기
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
                      온라인 판매 운영 흐름이
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
                    셀러에게는 선명한 운영 동선을 제공합니다.
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
                같은 화면에서 이해할 수 있는 온라인 판매 동선.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#5f574c]">
                첫 화면에서 서비스 정체성을 보여주고, 온라인샵 진입부터 주문,
                결제, 정산까지 이어지는 단계를 구조적으로 정리합니다. 첫 화면만
                봐도 테이블오더가 아닌 셀러용 온라인 주문 운영 플랫폼임을 알 수
                있도록 구성했습니다.
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
                여러 브랜드와 스토어를 다루는 운영팀에 맞춘 시작 화면.
              </h2>
            </div>
            <div className="grid gap-8 text-sm leading-6 text-[#5f574c] sm:grid-cols-3">
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  온라인샵
                </h3>
                <p className="mt-2">
                  브랜드의 상품과 주문 진입점을 한 화면에 정리해 고객 전환과
                  운영 신뢰를 함께 챙깁니다.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  주문 운영
                </h3>
                <p className="mt-2">
                  상품 판매에서 끝나지 않고 주문, 결제, 입금 확인, 상태 변경까지
                  이어지는 운영 경로를 분명하게 설계합니다.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1f1b16]">
                  운영 일관성
                </h3>
                <p className="mt-2">
                  브랜드/셀러 관리, 온라인샵, 공개 주문, 후속 운영까지 제품의 톤과
                  구조가 하나로 이어집니다.
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
                온라인마켓 운영 플랫폼의 얼굴을 먼저 세웁니다.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                셀러용 온라인 주문 운영 서비스인지, 고객이 어디서 주문을 시작하는지,
                운영자는 어디로 들어가야 하는지를 첫 화면에서 바로 이해할 수 있도록
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
