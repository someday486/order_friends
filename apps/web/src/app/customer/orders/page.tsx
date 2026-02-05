"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

type Order = {
  id: string;
  order_no: string | null;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  branch?: {
    id: string;
    name: string;
  };
};

type Branch = {
  id: string;
  name: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const STATUS_OPTIONS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "PENDING", label: "대기" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "대기",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const statusColor: Record<OrderStatus, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#3b82f6",
  READY: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
};

// ============================================================
// Helpers
// ============================================================

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Component
// ============================================================

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/customer/brands`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`브랜드 목록 조회 실패: ${res.status}`);
        }

        const brands = await res.json();
        const branchList: Branch[] = [];

        // Get branches from each brand
        for (const brand of brands) {
          const branchRes = await fetch(`${API_BASE}/customer/brands/${brand.id}/branches`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (branchRes.ok) {
            const branchData = await branchRes.json();
            branchList.push(...branchData);
          }
        }

        setBranches(branchList);
      } catch (e) {
        console.error(e);
      }
    };

    loadBranches();
  }, []);

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (branchFilter !== "ALL") {
          params.append("branchId", branchFilter);
        }

        if (statusFilter !== "ALL") {
          params.append("status", statusFilter);
        }

        const res = await fetch(`${API_BASE}/customer/orders?${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`주문 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setOrders(data.items || data);
        setTotal(data.total || data.length || 0);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "주문 목록 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [page, limit, branchFilter, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  if (loading && orders.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>주문 관리</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>주문 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            총 {total}건
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={branchFilter}
          onChange={(e) => {
            setBranchFilter(e.target.value);
            setPage(1);
          }}
          style={selectStyle}
        >
          <option value="ALL">모든 지점</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "ALL");
            setPage(1);
          }}
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>주문이 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>필터를 변경해보세요</div>
        </div>
      ) : (
        <>
          <div style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  <th style={th}>주문번호</th>
                  <th style={th}>고객명</th>
                  <th style={th}>연락처</th>
                  <th style={th}>지점</th>
                  <th style={th}>상태</th>
                  <th style={{ ...th, textAlign: "right" }}>금액</th>
                  <th style={th}>주문일시</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderTop: "1px solid #222" }}>
                    <td style={td}>
                      <Link
                        href={`/customer/orders/${order.id}`}
                        style={{ color: "white", textDecoration: "none" }}
                      >
                        {order.order_no ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={td}>{order.customer_name || "-"}</td>
                    <td style={td}>{order.customer_phone || "-"}</td>
                    <td style={td}>{order.branch?.name || "-"}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: 24,
                          padding: "0 10px",
                          borderRadius: 999,
                          background: statusColor[order.status] + "20",
                          color: statusColor[order.status],
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{formatWon(order.total_amount)}</td>
                    <td style={{ ...td, color: "#aaa" }}>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={paginationBtn}
              >
                이전
              </button>
              <span style={{ display: "flex", alignItems: "center", padding: "0 16px", color: "#aaa" }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={paginationBtn}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#aaa",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "white",
};

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#0f0f0f",
  color: "white",
  fontSize: 13,
  cursor: "pointer",
};

const paginationBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#0f0f0f",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const emptyBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 48,
  background: "#0a0a0a",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
  marginBottom: 16,
};
