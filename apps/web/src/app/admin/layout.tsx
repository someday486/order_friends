import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside
        style={{
          borderRight: "1px solid #222",
          padding: 16,
          background: "#0b0b0b",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 16 }}>OrderFriends Admin</div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/admin/orders" style={navLink}>
            주문 관리
          </Link>
        </nav>
      </aside>

      <main style={{ background: "#000" }}>
        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}

const navLink: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #222",
  color: "white",
  textDecoration: "none",
};
