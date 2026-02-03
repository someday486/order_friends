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
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(href);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside
        style={{
          borderRight: "1px solid #222",
          background: "#0b0b0b",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo */}
        <div style={{ padding: 16, borderBottom: "1px solid #222" }}>
          <Link href="/admin" style={{ textDecoration: "none", color: "white" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🍽️ OrderFriends</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Admin</div>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...navLink,
                background: isActive(item.href) ? "#1a1a1a" : "transparent",
                borderColor: isActive(item.href) ? "#333" : "transparent",
              }}
            >
              <span style={{ marginRight: 8 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User / Logout */}
        <div style={{ padding: 12, borderTop: "1px solid #222" }}>
          {user && (
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.email}
            </div>
          )}
          <button onClick={signOut} style={logoutBtn}>
            로그아웃
          </button>
        </div>
      </aside>

      <main style={{ background: "#000", minHeight: "100vh" }}>
        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}

const navLink: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  color: "white",
  textDecoration: "none",
  fontSize: 14,
  transition: "all 0.15s",
};

const logoutBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#aaa",
  fontSize: 13,
  cursor: "pointer",
};
