"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { useState } from "react";

type MenuItem = {
  href: string;
  label: string;
  icon: string;
  allowedRoles?: UserRole[];
};

const menuItems: MenuItem[] = [
  { href: "/customer", label: "대시보드", icon: "📊" },
  {
    href: "/customer/analytics/brand",
    label: "브랜드 분석",
    icon: "📈",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/brands",
    label: "브랜드 관리",
    icon: "🏢",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/branches",
    label: "매장 관리",
    icon: "🏪",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/products",
    label: "상품 관리",
    icon: "📦",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
  },
  {
    href: "/customer/categories",
    label: "카테고리 관리",
    icon: "🏷",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/inventory",
    label: "재고 관리",
    icon: "📊",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
  },
  {
    href: "/customer/orders",
    label: "주문 관리",
    icon: "📋",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
  },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/customer") return pathname === "/customer";
    return pathname?.startsWith(href);
  };

  const visibleMenuItems = roleLoading
    ? []
    : menuItems.filter(
        (item) => !item.allowedRoles || item.allowedRoles.includes(role),
      );

  return (
    <div className="md:grid md:grid-cols-[240px_1fr] min-h-screen">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/customer" className="no-underline text-foreground font-extrabold text-base">
          🍽️ OrderFriends
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded border border-border bg-transparent text-foreground cursor-pointer hover:bg-bg-tertiary transition-colors"
          aria-label="메뉴 열기"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
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
          fixed md:sticky top-0 left-0 z-50 h-screen w-[240px]
          border-r border-border bg-bg-secondary flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Link href="/customer" className="no-underline text-foreground">
            <div className="font-extrabold text-base">🍽️ OrderFriends</div>
            <div className="text-2xs text-text-tertiary mt-0.5">Customer</div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded border border-border bg-transparent text-foreground cursor-pointer"
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {roleLoading && (
            <div className="text-xs text-text-tertiary px-3 py-2">
              메뉴 로딩 중...
            </div>
          )}
          {visibleMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center px-3 py-2.5 rounded-md text-sm no-underline
                transition-all duration-150 touch-feedback
                ${
                  isActive(item.href)
                    ? "bg-bg-tertiary border border-border text-foreground font-semibold"
                    : "border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-foreground"
                }
              `}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t border-border">
          {user && (
            <div className="text-xs text-text-tertiary mb-2 overflow-hidden text-ellipsis">
              {user.email}
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full py-2 px-3 rounded text-sm text-text-secondary border border-border bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="bg-background min-h-screen">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
