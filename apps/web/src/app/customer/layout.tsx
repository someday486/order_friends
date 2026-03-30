'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { NotificationProvider } from '@/providers/NotificationProvider';
import {
  HomeIcon,
  TrendIcon,
  BrandIcon,
  StoreIcon,
  ProductIcon,
  TagIcon,
  InventoryIcon,
  OrderIcon,
  PencilIcon,
} from '@/components/ui/icons';
import { ShieldCheck } from 'lucide-react';
import { getSelectedBrandId } from '@/lib/brandSelection';
import { getSelectedBranchId } from '@/lib/branchSelection';
import { prefetchCustomerRouteData } from '@/lib/customerDataCache';

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  allowedRoles?: UserRole[];
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: '메인',
    items: [{ href: '/customer', label: '홈', icon: HomeIcon }],
  },
  {
    title: '분석',
    items: [
      {
        href: '/customer/analytics/brand',
        label: '대시보드',
        icon: TrendIcon,
        allowedRoles: ['system_admin', 'brand_owner'],
      },
    ],
  },
  {
    title: '브랜드',
    items: [
      {
        href: '/customer/brands',
        label: '브랜드관리',
        icon: BrandIcon,
        allowedRoles: ['system_admin', 'brand_owner'],
      },
      {
        href: '/customer/branches',
        label: '매장관리',
        icon: StoreIcon,
        allowedRoles: ['system_admin', 'brand_owner'],
      },
      {
        href: '/customer/permissions',
        label: '권한관리',
        icon: ShieldCheck,
        allowedRoles: ['system_admin', 'brand_owner'],
      },
    ],
  },
  {
    title: '상품',
    items: [
      {
        href: '/customer/categories',
        label: '카테고리',
        icon: TagIcon,
        allowedRoles: ['system_admin', 'brand_owner'],
      },
      {
        href: '/customer/products',
        label: '상품관리',
        icon: ProductIcon,
        allowedRoles: ['system_admin', 'brand_owner', 'branch_manager'],
      },
      {
        href: '/customer/inventory',
        label: '재고관리',
        icon: InventoryIcon,
        allowedRoles: ['system_admin', 'brand_owner', 'branch_manager'],
      },
    ],
  },
  {
    title: '주문',
    items: [
      {
        href: '/customer/orders',
        label: '주문관리',
        icon: OrderIcon,
        allowedRoles: [
          'system_admin',
          'brand_owner',
          'branch_manager',
          'staff',
        ],
      },
      {
        href: '/customer/order',
        label: '주문페이지',
        icon: OrderIcon,
        allowedRoles: [
          'system_admin',
          'brand_owner',
          'branch_manager',
          'staff',
        ],
      },
    ],
  },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { role, userData } = useUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggle } = useDarkMode();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const isBrandCreatorOnboarding =
    userData?.canCreateBrand === true &&
    (userData.memberships?.length ?? 0) === 0 &&
    (userData.ownedBrands?.length ?? 0) === 0;

  const effectiveRole: UserRole = isBrandCreatorOnboarding
    ? 'brand_owner'
    : role;

  const isActive = (href: string) => {
    if (href === '/customer') return pathname === '/customer';
    return pathname?.startsWith(href);
  };

  const visibleSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            !item.allowedRoles || item.allowedRoles.includes(effectiveRole),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [effectiveRole]);

  const getOnboardingDisabledMessage = useCallback((href: string) => {
    if (href === '/customer/branches') {
      return '브랜드를 먼저 등록하세요.';
    }

    if (href === '/customer' || href === '/customer/brands') {
      return null;
    }

    return '브랜드와 매장을 먼저 등록하세요.';
  }, []);

  const isOnboardingItemDisabled = useCallback(
    (href: string) => {
      if (!isBrandCreatorOnboarding) return false;
      return getOnboardingDisabledMessage(href) !== null;
    },
    [getOnboardingDisabledMessage, isBrandCreatorOnboarding],
  );

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
      prefetchCustomerRouteData(href, {
        brandId: selectedBrandId,
        branchId: selectedBranchId,
      });
    },
    [prefetchRoute],
  );

  return (
    <NotificationProvider>
      <div className="md:grid md:grid-cols-[240px_1fr] min-h-screen">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
          <Link
            href="/customer"
            className="no-underline text-foreground font-extrabold text-base"
          >
            주문프렌즈
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
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
        </div>

        {/* Sidebar Overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
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
          {/* Logo */}
          <div className="h-[72px] px-4 border-b border-border flex items-center justify-between">
            <Link
              href="/customer"
              className="no-underline text-foreground flex items-center gap-2"
            >
              <Image
                src={isDark ? '/logo2.png' : '/logo.png'}
                alt="주문프렌즈 로고"
                width={170}
                height={50}
                priority
              />
              {/* <div>
                <div className="font-extrabold text-base">주문프렌즈</div>
                <div className="text-2xs text-text-tertiary mt-0.5">Customer</div>
              </div> */}
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded border border-border bg-transparent text-foreground cursor-pointer"
              aria-label="모바일 메뉴 닫기"
            >
              ×
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {visibleSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 pb-2 text-2xs text-text-tertiary uppercase tracking-wider">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                       onMouseEnter={() => {
                         if (!isOnboardingItemDisabled(item.href)) {
                           warmMenuRoute(item.href);
                         }
                       }}
                       onFocus={() => {
                         if (!isOnboardingItemDisabled(item.href)) {
                           warmMenuRoute(item.href);
                         }
                       }}
                       onPointerDown={() => {
                         if (!isOnboardingItemDisabled(item.href)) {
                           warmMenuRoute(item.href);
                         }
                       }}
                       onClick={(event) => {
                        const disabledMessage = getOnboardingDisabledMessage(
                          item.href,
                        );

                        if (
                          isBrandCreatorOnboarding &&
                          disabledMessage !== null
                        ) {
                          event.preventDefault();
                          toast(disabledMessage, {
                            icon: 'i',
                          });
                          return;
                        }

                        setSidebarOpen(false);
                      }}
                      className={`
                        flex items-center px-3 py-2.5 rounded-md text-sm no-underline
                        transition-all duration-150 touch-feedback
                        ${
                          isOnboardingItemDisabled(item.href)
                            ? 'cursor-not-allowed border border-transparent text-text-tertiary opacity-60 hover:bg-transparent hover:text-text-tertiary'
                            : isActive(item.href)
                            ? 'bg-bg-tertiary border border-border text-foreground font-semibold'
                            : 'border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                        }
                      `}
                      aria-disabled={isOnboardingItemDisabled(item.href)}
                    >
                      <item.icon size={18} className="mr-2 flex-shrink-0" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User / Quick Actions */}
          <div className="mt-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-3">
            {user && (
              <div className="text-xs text-text-tertiary mb-2 overflow-hidden text-ellipsis">
                {user.email}
              </div>
            )}

             <Link
               href="/customer/mypage"
               onMouseEnter={() => warmMenuRoute('/customer/mypage')}
               onFocus={() => warmMenuRoute('/customer/mypage')}
               onPointerDown={() => warmMenuRoute('/customer/mypage')}
               onClick={() => setSidebarOpen(false)}
               className={`
                flex items-center justify-center px-3 py-2.5 rounded-md text-sm no-underline
                transition-all duration-150 touch-feedback mb-2
                ${
                  isActive('/customer/mypage')
                    ? 'bg-bg-tertiary border border-border text-foreground font-semibold'
                    : 'border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                }
              `}
            >
              <PencilIcon size={18} className="mr-2 flex-shrink-0" />
              마이페이지
            </Link>
            <div className="border-t border-border my-2" />

            <button
              onClick={toggle}
              className="w-full py-2 px-3 rounded text-sm text-text-secondary border border-border bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer mb-2"
            >
              {isDark ? '라이트 모드' : '다크 모드'}
            </button>
            <button
              onClick={signOut}
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
            <NotificationBell />
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </NotificationProvider>
  );
}
