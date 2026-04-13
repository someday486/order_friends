'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  Boxes,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  PackageSearch,
  SlidersHorizontal,
  Truck,
  Users2,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDarkMode } from '@/hooks/useDarkMode';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { businessTopSummary } from '@/lib/businessMockData';

type MenuItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: '메인',
    items: [{ href: '/business', label: '대시보드', icon: LayoutDashboard }],
  },
  {
    title: '상품',
    items: [{ href: '/business/products', label: '상품 리스트', icon: PackageSearch }],
  },
  {
    title: '주문·결제',
    items: [
      {
        href: '/business/orders/upload',
        label: '주문서 업로드',
        icon: FileSpreadsheet,
      },
      { href: '/business/orders/history', label: '주문 내역', icon: ClipboardList },
    ],
  },
  {
    title: '운영 관리',
    items: [
      { href: '/business/suppliers', label: '공급처', icon: Users2 },
      { href: '/business/shipments', label: '송장 매칭', icon: Truck },
      { href: '/business/receipts', label: '입고 현황', icon: Warehouse },
      { href: '/business/settings', label: '운영 설정', icon: SlidersHorizontal },
    ],
  },
];

export default function BusinessLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sections = useMemo(() => menuSections, []);

  const isActive = (href: string) => {
    if (href === '/business') {
      return pathname === '/business';
    }
    return pathname?.startsWith(href);
  };

  return (
    <NotificationProvider>
      <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-transparent text-foreground"
            aria-label="B2B 메뉴 열기"
          >
            <Menu size={18} />
          </button>
          <div className="text-[13px] font-black tracking-[0.18em] text-foreground">
            ORDER FRIENDS B2B
          </div>
          <NotificationBell />
        </div>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[260px] flex-col border-r border-border bg-bg-secondary transition-transform duration-200 md:relative md:h-auto md:min-h-screen md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-[72px] items-center justify-between border-b border-border px-4">
            <Link
              href="/business"
              className="flex items-center gap-3 text-foreground no-underline"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                <Boxes size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
                  Order Friends
                </div>
                <div className="text-[15px] font-black tracking-tight">B2B 운영센터</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-transparent text-foreground md:hidden"
              aria-label="B2B 메뉴 닫기"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {sections.map((section) => (
              <div key={section.title} className="mb-5 last:mb-0">
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-[13px] transition-colors ${
                        isActive(item.href)
                          ? 'border border-border bg-bg-tertiary font-semibold text-foreground'
                          : 'border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon size={18} />
                        {item.label}
                      </span>
                      <ChevronRight size={16} className="opacity-60" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="space-y-3 border-t border-border p-3">
            <SidebarNotice
              title="오늘 발주 가이드"
              body="오전 10:30 이전 주문은 당일 오전 입고 기준으로 묶어 처리하는 흐름을 권장합니다."
              tone="amber"
            />
            <SidebarNotice
              title="송장 매칭 체크"
              body="주문번호와 송장번호 컬럼이 맞는지 먼저 확인하면 업로드 오류를 크게 줄일 수 있습니다."
              tone="slate"
            />

            {user ? (
              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <div className="text-xs text-text-tertiary">로그인 계정</div>
                <div className="mt-1 truncate text-[13px] font-semibold text-foreground">
                  {user.email}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggle}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
              >
                {isDark ? '라이트' : '다크'}
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
              >
                로그아웃
              </button>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-background">
          <div className="sticky top-0 z-30 hidden h-[72px] items-center justify-between gap-4 border-b border-border bg-background/90 px-6 backdrop-blur md:flex">
            <div className="relative w-full max-w-xl flex-1">
              <input
                type="search"
                className="input-field h-12 rounded-2xl pl-12 text-sm"
                placeholder="빠른 검색 · 상품명 / 주문번호 / 공급처"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-tertiary">
                <PackageSearch size={18} />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
              <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border bg-bg-secondary px-4 py-3 text-[13px] text-text-secondary">
                <TopMetric label="입치기" value={businessTopSummary.deposit} />
                <TopMetric label="상품 대기" value={businessTopSummary.points} />
                <TopMetric label="결제 대기" value={businessTopSummary.paymentPending} />
                <TopMetric label="미매칭 송장" value={businessTopSummary.unmatchedWaybills} />
              </div>

              <div className="max-w-[140px] shrink-0 truncate text-[13px] font-semibold text-foreground">
                {user?.email?.split('@')[0] || '운영자'} 로그인 중
              </div>

              <button
                type="button"
                onClick={toggle}
                className="shrink-0 whitespace-nowrap rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
              >
                {isDark ? '라이트 모드' : '다크 모드'}
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="shrink-0 whitespace-nowrap rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
              >
                로그아웃
              </button>
              <NotificationBell />
            </div>
          </div>

          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </NotificationProvider>
  );
}

function SidebarNotice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: 'amber' | 'slate';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-slate-700 bg-slate-900 text-slate-100';

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[13px] font-black">{title}</div>
      <div className="mt-1 text-[12px] leading-5 opacity-90">{body}</div>
    </div>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="whitespace-nowrap">
      <span className="text-[12px] text-text-tertiary">{label}:</span>{' '}
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
