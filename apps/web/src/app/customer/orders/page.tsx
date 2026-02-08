"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  orderedAt: string;
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
  { value: "CREATED", label: "주문접수" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "주문접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

const statusClass: Record<OrderStatus, string> = {
  CREATED: "bg-warning-500/20 text-warning-500",
  CONFIRMED: "bg-primary-500/20 text-primary-500",
  PREPARING: "bg-primary-500/20 text-primary-500",
  READY: "bg-success/20 text-success",
  COMPLETED: "bg-neutral-500/20 text-text-secondary",
  CANCELLED: "bg-danger-500/20 text-danger-500",
  REFUNDED: "bg-pink-500/20 text-pink-400",
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
        setOrders(data.data || data.items || data);
        setTotal(data.pagination?.total || data.total || 0);
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
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">주문 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-foreground">주문 관리</h1>
          <p className="text-text-secondary mt-1 text-sm">
            총 {total}건
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3 flex-wrap items-center">
        <select
          value={branchFilter}
          onChange={(e) => {
            setBranchFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 rounded border border-border bg-bg-secondary text-foreground text-sm cursor-pointer"
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
          className="h-9 px-3 rounded border border-border bg-bg-secondary text-foreground text-sm cursor-pointer"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>}

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">주문이 없습니다</div>
          <div className="text-sm">필터를 변경해보세요</div>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문번호</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">고객명</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">금액</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문일시</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-3 px-3.5 text-sm text-foreground">
                      <Link
                        href={`/customer/orders/${order.id}`}
                        className="text-foreground no-underline hover:text-primary-500 transition-colors"
                      >
                        {order.orderNo ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 px-3.5 text-sm text-foreground">{order.customerName || "-"}</td>
                    <td className="py-3 px-3.5 text-sm">
                      <span
                        className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${statusClass[order.status]}`}
                      >
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-sm text-foreground text-right">{formatWon(order.totalAmount)}</td>
                    <td className="py-3 px-3.5 text-sm text-text-secondary">{formatDateTime(order.orderedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-4 rounded border border-border bg-bg-secondary text-foreground font-semibold cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
              >
                이전
              </button>
              <span className="flex items-center px-4 text-text-secondary text-sm">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 px-4 rounded border border-border bg-bg-secondary text-foreground font-semibold cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
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
