"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
  orderNo?: string | null;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
};

// ============================================================
// Constants
// ============================================================

const STATUS_OPTIONS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "CREATED", label: "접수" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
  { value: "REFUNDED", label: "환불" },
];

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

const statusVariant: Record<OrderStatus, "info" | "success" | "warning" | "danger" | "default"> = {
  CREATED: "info",
  CONFIRMED: "info",
  PREPARING: "warning",
  READY: "success",
  COMPLETED: "default",
  CANCELLED: "danger",
  REFUNDED: "danger",
};

// ============================================================
// Helpers
// ============================================================

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

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const initialBranchId = useMemo(
    () => searchParams?.get("branchId") ?? "",
    [searchParams]
  );

  const { branchId, selectBranch } = useSelectedBranch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  useEffect(() => {
    const fetchOrders = async (bid: string) => {
      try {
        setLoading(true);
        setErr(null);

        const response = await apiClient.get<{ data?: Order[] } | Order[]>(
          `/admin/orders?branchId=${encodeURIComponent(bid)}`
        );
        const data = (response as { data?: Order[] }).data
          ? (response as { data: Order[] }).data
          : (Array.isArray(response) ? response : []);
        setOrders(data);
      } catch (e: unknown) {
        const error = e as Error;
        setErr(error?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    if (!branchId) {
      setOrders([]);
      return;
    }

    fetchOrders(branchId);
  }, [branchId]);

  useEffect(() => {
    if (statusFilter === "ALL") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((o) => o.status === statusFilter));
    }
  }, [orders, statusFilter]);

  const handleRefresh = async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      setErr(null);

      const response = await apiClient.get<{ data?: Order[] } | Order[]>(
        `/admin/orders?branchId=${encodeURIComponent(branchId)}`
      );
      const data = (response as { data?: Order[] }).data
        ? (response as { data: Order[] }).data
        : (Array.isArray(response) ? response : []);
      setOrders(data);
    } catch (e: unknown) {
      const error = e as Error;
      setErr(error?.message ?? "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold m-0">주문 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            총 {filteredOrders.length}건
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <BranchSelector />
          <Button
            onClick={handleRefresh}
            disabled={loading || !branchId}
            size="md"
          >
            {loading ? "로딩..." : "조회"}
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            variant={statusFilter === opt.value ? "secondary" : "outline"}
            size="sm"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Error */}
      {err && <p className="text-danger mb-4">{err}</p>}
      {!branchId && (
        <p className="text-muted mb-4">
          가게를 선택하면 주문 목록이 표시됩니다.
        </p>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-card">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground">주문번호</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground">고객명</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground">상태</th>
              <th className="text-right py-3 px-4 text-xs font-bold text-muted-foreground">금액</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-foreground">주문일시</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="py-3 px-4 text-sm text-center text-muted">
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && filteredOrders.length === 0 && branchId && (
              <tr>
                <td colSpan={5} className="py-3 px-4 text-sm text-center text-muted">
                  주문이 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              filteredOrders.map((order) => (
                <tr key={order.id} className="border-t border-border hover:bg-card-hover transition-colors">
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/orders/${order.id}?branchId=${encodeURIComponent(branchId || '')}`}
                      className="text-white hover:underline"
                    >
                      {order.orderNo ?? order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/orders/${order.id}?branchId=${encodeURIComponent(branchId || '')}`}
                      className="text-white hover:underline"
                    >
                      {order.customerName || "-"}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Badge variant={statusVariant[order.status]}>
                      {statusLabel[order.status]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <Link
                      href={`/admin/orders/${order.id}?branchId=${encodeURIComponent(branchId || '')}`}
                      className="text-white hover:underline"
                    >
                      {formatWon(order.totalAmount)}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    <Link
                      href={`/admin/orders/${order.id}?branchId=${encodeURIComponent(branchId || '')}`}
                      className="hover:underline"
                    >
                      {formatDateTime(order.orderedAt)}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
