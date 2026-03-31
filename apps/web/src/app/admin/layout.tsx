'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSelectedBrandId } from '@/lib/brandSelection';
import { getSelectedBranchId } from '@/lib/branchSelection';
import {
  prefetchAdminBrands,
  prefetchAdminBranches,
  prefetchAdminRouteData,
} from '@/lib/adminDataCache';
import {
  BrandIcon,
  HomeIcon,
  OrderIcon,
  ProductIcon,
  StoreIcon,
} from '@/components/ui/icons';

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: '메인',
    items: [
      { href: '/admin', label: '홈', icon: HomeIcon },
      { href: '/admin/members', label: '권한관리', icon: ShieldCheck },
    ],
  },
  {
    title: '브랜드',
    items: [
      { href: '/admin/brand', label: '브랜드관리', icon: BrandIcon },
      { href: '/admin/stores', label: '매장관리', icon: StoreIcon },
    ],
  },
  {
    title: '상품',
    items: [{ href: '/admin/products', label: '상품관리', icon: ProductIcon }],
  },
  {
    title: '주문',
    items: [
      { href: '/admin/orders', label: '주문관리', icon: OrderIcon },
      { href: '/admin/order', label: '주문페이지', icon: OrderIcon },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname?.startsWith(href);
  };

  const prefetchRoute = useCallback(
    (href: string) => {
      if (prefetchedRoutesRef.current.has(href)) return;
      prefetchedRoutesRef.current.add(href);
      void router.prefetch(href);
    },
    [router],
  );

  const warmMenuRoute = useCallback(
    (href: string) => {
      const selectedBrandId = getSelectedBrandId();
      const selectedBranchId = getSelectedBranchId();

      prefetchRoute(href);
      prefetchAdminBrands();
      prefetchAdminBranches(selectedBrandId);
      prefetchAdminRouteData(href, {
        brandId: selectedBrandId,
        branchId: selectedBranchId,
      });
    },
    [prefetchRoute],
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="md:grid md:grid-cols-[240px_1fr] min-h-screen">
      <div className="md:hidden sticky top-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <Link
          href="/admin"
          className="no-underline text-foreground font-extrabold text-base"
        >
          주문프렌즈
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded border border-border bg-transparent text-foreground cursor-pointer hover:bg-bg-tertiary transition-colors"
          aria-label="모바일 메뉴 열기"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
      </div>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:relative top-0 left-0 z-50 md:z-auto
          h-[100dvh] md:h-auto md:min-h-screen
          w-[240px]
          border-r border-border bg-bg-secondary flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="h-[72px] px-4 border-b border-border flex items-center justify-between">
          <Link
            href="/admin"
            className="no-underline text-foreground flex items-center gap-2"
          >
            <Image
              src={isDark ? '/logo2.png' : '/logo.png'}
              alt="주문프렌즈 로고"
              width={170}
              height={50}
              priority
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded border border-border bg-transparent text-foreground cursor-pointer"
            aria-label="모바일 메뉴 닫기"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {menuSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-2 text-2xs text-text-tertiary uppercase tracking-wider">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => warmMenuRoute(item.href)}
                    onFocus={() => warmMenuRoute(item.href)}
                    onPointerDown={() => warmMenuRoute(item.href)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center px-3 py-2.5 rounded-md text-sm no-underline
                      transition-all duration-150 touch-feedback
                      ${
                        isActive(item.href)
                          ? 'bg-bg-tertiary border border-border text-foreground font-semibold'
                          : 'border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                      }
                    `}
                  >
                    <item.icon size={18} className="mr-2 flex-shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-3">
          {user && (
            <div className="text-xs text-text-tertiary mb-2 overflow-hidden text-ellipsis">
              {user.email}
            </div>
          )}

          <button
            onClick={toggle}
            className="w-full py-2 px-3 rounded text-sm text-text-secondary border border-border bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer mb-2"
          >
            {isDark ? '라이트 모드' : '다크 모드'}
          </button>
          <button
            onClick={() => void signOut()}
            className="w-full py-2 px-3 rounded text-sm text-text-secondary border border-border bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="bg-background min-h-screen">
        <div className="hidden md:flex h-[72px] sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 items-center justify-end gap-2">
          <button
            onClick={toggle}
            className="py-2 px-4 rounded-md border border-border bg-transparent text-sm text-foreground hover:bg-bg-tertiary transition-colors"
          >
            {isDark ? '라이트 모드' : '다크 모드'}
          </button>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
