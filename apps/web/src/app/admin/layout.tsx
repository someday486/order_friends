"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { href: "/admin", label: "홈", icon: "🏠" },
  { href: "/admin/orders", label: "주문 관리", icon: "📋" },
  { href: "/admin/products", label: "상품 관리", icon: "📦" },
  { href: "/admin/stores", label: "가게 관리", icon: "🏪" },
  { href: "/admin/brand", label: "브랜드 관리", icon: "🏢" },
  { href: "/admin/members", label: "권한 관리", icon: "👥" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname?.startsWith(href);
  };

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <aside className="border-r border-border bg-bg-secondary flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <Link href="/admin" className="no-underline text-foreground">
            <div className="font-extrabold text-base">🍽️ OrderFriends</div>
            <div className="text-2xs text-text-tertiary mt-0.5">Admin</div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
