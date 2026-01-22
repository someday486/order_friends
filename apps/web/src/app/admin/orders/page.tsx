import Link from "next/link";

export default function AdminHome() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>관리자</h1>
      <p style={{ color: "#aaa" }}>메뉴를 선택하세요.</p>
      <Link href="/admin/orders" style={{ color: "#fff" }}>
        주문 관리로 이동 →
      </Link>
    </div>
  );
}
