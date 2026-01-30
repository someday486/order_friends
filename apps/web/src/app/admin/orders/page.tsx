// import Link from "next/link";

// export default function AdminHome() {
//   return (
//     <div>
//       <h1 style={{ fontSize: 22, fontWeight: 700 }}>관리자</h1>
//       <p style={{ color: "#aaa" }}>메뉴를 선택하세요.</p>
//       <Link href="/admin/orders" style={{ color: "#fff" }}>
//         주문 관리로 이동 →
//       </Link>
//     </div>
//   );
// }

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type Order = {
  id: string;       // uuid
  orderNo?: string; // 표시용(있으면)
  status: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr(null);

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/orders`, {
          headers: {
            Authorization: `Bearer ${token}`, // ✅ 핵심
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`주문 목록 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as Order[];
        console.log("orders raw >>>", data);
        setOrders(data);
      } catch (e: any) {
        setErr(e?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  console.log("ORDERS_RAW", orders);
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>주문 목록</h1>
      <p style={{ color: "#aaa" }}>주문을 클릭하면 상세로 이동합니다.</p>

      {loading ? <p style={{ color: "#aaa", marginTop: 16 }}>불러오는 중...</p> : null}
      {err ? <p style={{ color: "#ff8a8a", marginTop: 16 }}>{err}</p> : null}

      <ul style={{ marginTop: 16 }}>
        {orders.map((o) => (
          <li key={o.id} style={{ marginBottom: 10 }}>
            <Link href={`/admin/orders/${o.id}`} style={{ color: "white" }}>
              {o.orderNo ? `${o.orderNo} / ` : ""}
              {o.status}
              <span style={{ color: "#777" }}> ({o.id})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
