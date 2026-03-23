"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getAdminBrands,
  getAdminBranches,
  type AdminBrandSummary,
  type AdminBranchSummary,
} from "@/lib/adminDataCache";
import {
  FULFILLMENT_TYPE_LABEL,
  ORDER_STATUS_DISPLAY_LABEL,
  getOrderStatusDisplay,
  type FulfillmentType,
  type OrderStatus,
  type OrderStatusDisplay,
} from "@/types/common";

type Order = {
  id: string;
  orderNo?: string | null;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  fulfillmentType?: FulfillmentType | null;
  branchId?: string | null;
  branchName?: string | null;
};

const ALL_BRANCHES_VALUE = "__ALL_BRANCHES__";

const STATUS_OPTIONS: { value: OrderStatusDisplay | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "RECEIVED", label: "주문접수" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "CANCELLED", label: "취소" },
];

const FULFILLMENT_OPTIONS: {
  value: FulfillmentType | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "전체 방식" },
  { value: "PICKUP", label: "포장" },
  { value: "DELIVERY", label: "배달" },
  { value: "DINE_IN", label: "매장" },
  { value: "SHIPPING", label: "택배" },
];

const STATUS_VARIANT: Record<
  OrderStatusDisplay,
  "info" | "success" | "warning" | "danger" | "default"
> = {
  RECEIVED: "info",
  PREPARING: "warning",
  READY: "success",
  CANCELLED: "danger",
};

const FULFILLMENT_VARIANT: Record<
  FulfillmentType,
  "info" | "success" | "warning" | "danger" | "default"
> = {
  PICKUP: "info",
  DELIVERY: "warning",
  DINE_IN: "default",
  SHIPPING: "success",
};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const initialBrandId = useMemo(
    () => searchParams?.get("brandId") ?? "",
    [searchParams],
  );
  const initialBranchId = useMemo(
    () => searchParams?.get("branchId") ?? "",
    [searchParams],
  );

  const {
    brandId,
    ready: brandReady,
    selectBrand,
    clearBrand,
  } = useSelectedBrand();
  const {
    branchId,
    ready: branchReady,
    selectBranch,
    clearBranch,
  } = useSelectedBranch();

  const [brands, setBrands] = useState<AdminBrandSummary[]>([]);
  const [branches, setBranches] = useState<AdminBranchSummary[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatusDisplay | "ALL">(
    "ALL",
  );
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    FulfillmentType | "ALL"
  >("ALL");
  const selectedBranchValue = branchId ?? "";
  const isAllBranchesSelected = selectedBranchValue === ALL_BRANCHES_VALUE;

  useEffect(() => {
    const loadBrands = async () => {
      try {
        setLoadingBrands(true);
        setError(null);
        setBrands(await getAdminBrands());
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "브랜드 목록을 불러오지 못했습니다.");
      } finally {
        setLoadingBrands(false);
      }
    };

    void loadBrands();
  }, []);

  useEffect(() => {
    if (!brandReady || !branchReady) return;

    if (initialBrandId && !brandId) {
      selectBrand(initialBrandId);
      return;
    }

    if (initialBranchId && !branchId) {
      selectBranch(initialBranchId);
    }
  }, [
    brandId,
    brandReady,
    branchId,
    branchReady,
    initialBrandId,
    initialBranchId,
    selectBrand,
    selectBranch,
  ]);

  useEffect(() => {
    if (!brandReady || !branchReady) return;

    if (!brandId) {
      setBranches([]);
      setOrders([]);
      setLoadingBranches(false);
      setLoadingOrders(false);
      clearBranch();
      return;
    }

    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        setError(null);
        const nextBranches = await getAdminBranches(brandId);
        setBranches(nextBranches);

        if (
          branchId &&
          branchId !== ALL_BRANCHES_VALUE &&
          !nextBranches.some((branch) => branch.id === branchId)
        ) {
          clearBranch();
          setOrders([]);
        }
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "매장 목록을 불러오지 못했습니다.");
        setBranches([]);
        setOrders([]);
      } finally {
        setLoadingBranches(false);
      }
    };

    void loadBranches();
  }, [brandId, brandReady, branchId, branchReady, clearBranch]);

  const fetchOrders = useCallback(async () => {
    if (!branchId) {
      setOrders([]);
      return;
    }

    try {
      setLoadingOrders(true);
      setError(null);

      const appendFilters = (params: URLSearchParams) => {
        if (fulfillmentFilter !== "ALL") {
          params.append("fulfillmentType", fulfillmentFilter);
        }
      };

      let nextOrders: Order[] = [];

      if (branchId === ALL_BRANCHES_VALUE) {
        const perBranchRows = await Promise.all(
          branches.map(async (branch) => {
            const params = new URLSearchParams({ branchId: branch.id });
            appendFilters(params);

            const response = await apiClient.get<{ data?: Order[] } | Order[]>(
              `/admin/orders?${params.toString()}`,
            );
            const rows = Array.isArray(response) ? response : response.data ?? [];

            return rows.map((order) => ({
              ...order,
              branchId: order.branchId ?? branch.id,
              branchName: order.branchName ?? branch.name,
            }));
          }),
        );

        nextOrders = perBranchRows.flat().sort((left, right) => {
          return (
            new Date(right.orderedAt).getTime() -
            new Date(left.orderedAt).getTime()
          );
        });
      } else {
        const params = new URLSearchParams({ branchId });
        appendFilters(params);

        const response = await apiClient.get<{ data?: Order[] } | Order[]>(
          `/admin/orders?${params.toString()}`,
        );
        nextOrders = Array.isArray(response) ? response : response.data ?? [];
      }

      setOrders(nextOrders);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "주문 목록을 불러오지 못했습니다.");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [branchId, branches, fulfillmentFilter]);

  useEffect(() => {
    if (!brandReady || !branchReady) return;

    if (!branchId) {
      setOrders([]);
      return;
    }

    void fetchOrders();
  }, [brandReady, branchReady, branchId, fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "ALL") return orders;

    return orders.filter(
      (order) => getOrderStatusDisplay(order.status) === statusFilter,
    );
  }, [orders, statusFilter]);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId) ?? null,
    [brands, brandId],
  );

  if (!brandReady || !branchReady) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold text-foreground">
            주문관리
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            표시 {filteredOrders.length}건
            {selectedBrand ? ` · ${selectedBrand.name}` : ""}
          </p>
        </div>

        <Button
          onClick={() => void fetchOrders()}
          disabled={loadingOrders || !branchId}
          size="md"
        >
          {loadingOrders ? "불러오는 중..." : "새로고침"}
        </Button>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-bg-secondary p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(220px,260px)_160px_160px]">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              브랜드
            </label>
            <select
              value={brandId ?? ""}
              onChange={(event) => {
                const nextBrandId = event.target.value;

                clearBranch();
                setOrders([]);

                if (!nextBrandId) {
                  clearBrand();
                  setBranches([]);
                  return;
                }

                selectBrand(nextBrandId);
              }}
              className="input-field h-9 w-full text-sm"
              disabled={loadingBrands}
            >
              <option value="">브랜드를 선택하세요</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              매장
            </label>
            <select
              value={selectedBranchValue}
              onChange={(event) => {
                const nextBranchId = event.target.value;
                if (!nextBranchId) {
                  clearBranch();
                  setOrders([]);
                  return;
                }

                selectBranch(nextBranchId);
              }}
              className="input-field h-9 w-full text-sm"
              disabled={!brandId || loadingBranches}
            >
              <option value="">
                {brandId
                  ? "매장을 선택하세요"
                  : "먼저 브랜드를 선택하세요"}
              </option>
              <option value={ALL_BRANCHES_VALUE}>전체</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as OrderStatusDisplay | "ALL")
              }
              className="input-field h-9 w-full text-sm"
              disabled={!branchId}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              주문방식
            </label>
            <select
              value={fulfillmentFilter}
              onChange={(event) =>
                setFulfillmentFilter(
                  event.target.value as FulfillmentType | "ALL",
                )
              }
              className="input-field h-9 w-full text-sm"
              disabled={!branchId}
            >
              {FULFILLMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger-500 bg-danger-500/10 p-3 text-danger-500">
          {error}
        </div>
      )}

      {!brandId && (
        <p className="mb-4 text-text-tertiary">
          브랜드를 선택하면 해당 브랜드의 매장과 주문을 볼 수 있습니다.
        </p>
      )}

      {brandId && !branchId && (
        <p className="mb-4 text-text-tertiary">
          매장을 선택하면 주문 목록이 표시됩니다.
        </p>
      )}

      {brandId && isAllBranchesSelected && (
        <p className="mb-4 text-text-tertiary">
          선택한 브랜드의 전체 매장 주문을 함께 표시하고 있습니다.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-card">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                주문번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                고객명
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                주문방식
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                상태
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">
                금액
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">
                주문일시
              </th>
            </tr>
          </thead>
          <tbody>
            {loadingOrders && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-3 text-center text-sm text-muted"
                >
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loadingOrders && filteredOrders.length === 0 && branchId && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-3 text-center text-sm text-muted"
                >
                  주문이 없습니다.
                </td>
              </tr>
            )}

            {!loadingOrders &&
              filteredOrders.map((order) => {
                const displayStatus = getOrderStatusDisplay(order.status);
                const orderHref = `/admin/orders/${order.id}?branchId=${encodeURIComponent(order.branchId ?? branchId ?? "")}&brandId=${encodeURIComponent(brandId ?? "")}`;

                return (
                  <tr
                    key={order.id}
                    className="border-t border-border transition-colors hover:bg-card-hover"
                  >
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={orderHref}
                        className="text-foreground hover:text-primary-500 hover:underline"
                      >
                        {order.orderNo ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={orderHref}
                        className="text-foreground hover:text-primary-500 hover:underline"
                      >
                        {order.customerName || "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.fulfillmentType ? (
                        <Badge variant={FULFILLMENT_VARIANT[order.fulfillmentType]}>
                          {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={STATUS_VARIANT[displayStatus]}>
                        {ORDER_STATUS_DISPLAY_LABEL[displayStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={orderHref}
                        className="text-foreground hover:text-primary-500 hover:underline"
                      >
                        {formatWon(order.totalAmount)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <Link href={orderHref} className="hover:underline">
                        {formatDateTime(order.orderedAt)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
