"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";

type InventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  branch_id: string;
  branch_name?: string;
  qty_available: number;
  qty_reserved: number;
  qty_sold: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  image_url?: string;
};

type Branch = {
  id: string;
  name: string;
  brandId: string;
  myRole: string;
};

const TRANSACTION_TYPES = [
  { value: "RESTOCK", label: "재입고" },
  { value: "ADJUSTMENT", label: "재고 조정" },
  { value: "DAMAGE", label: "손상/폐기" },
  { value: "RETURN", label: "반품" },
];

function isLowStock(item: InventoryItem): boolean {
  return item.is_low_stock;
}

export default function CustomerInventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [branchSearch, setBranchSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkType, setBulkType] = useState("ADJUSTMENT");
  const [bulkSaving, setBulkSaving] = useState(false);

  const manageRoles = new Set(["OWNER", "ADMIN", "BRANCH_OWNER", "BRANCH_ADMIN"]);
  const canManage =
    selectedBranchIds.size > 0 &&
    Array.from(selectedBranchIds).every((id) => {
      const role = branches.find((b) => b.id === id)?.myRole;
      return role ? manageRoles.has(role) : false;
    });

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  const allSelected =
    inventory.length > 0 && inventory.every((item) => selectedInventoryIds.has(item.id));

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchIds(new Set([data[0].id]));
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    const loadInventory = async () => {
      if (selectedBranchIds.size === 0) {
        setInventory([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const branchIds = Array.from(selectedBranchIds);
        const responses = await Promise.all(
          branchIds.map((branchId) =>
            apiClient
              .get<InventoryItem[]>(`/customer/inventory?branchId=${encodeURIComponent(branchId)}`)
              .catch(() => []),
          ),
        );
        const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));
        const merged = responses
          .flat()
          .map((item) => ({
            ...item,
            branch_name: item.branch_name || branchMap.get(item.branch_id) || "-",
          }))
          .sort((a, b) => {
            const branchCompare = (a.branch_name || "").localeCompare(b.branch_name || "");
            if (branchCompare !== 0) return branchCompare;
            return (a.product_name || "").localeCompare(b.product_name || "");
          });

        setInventory(merged);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "재고 목록을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, [selectedBranchIds, branches]);

  useEffect(() => {
    setSelectedInventoryIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(inventory.map((item) => item.id));
      return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
    });
  }, [inventory]);

  const handleBulkAdjust = async () => {
    const qty = Number.parseInt(bulkQty, 10);
    if (Number.isNaN(qty) || qty === 0) {
      toast.error("유효한 조정 수량을 입력하세요");
      return;
    }
    if (selectedInventoryIds.size === 0) {
      toast.error("대상을 선택하세요");
      return;
    }

    try {
      setBulkSaving(true);
      const targets = inventory.filter((item) => selectedInventoryIds.has(item.id));
      await Promise.all(
        targets.map((item) =>
          apiClient.post(
            `/customer/inventory/${item.product_id}/adjust?branchId=${encodeURIComponent(item.branch_id)}`,
            {
              transaction_type: bulkType,
              qty_change: qty,
              notes: bulkNotes || undefined,
            },
          ),
        ),
      );

      toast.success(`${targets.length}개 상품 재고를 일괄 조정했습니다`);
      setSelectedInventoryIds(new Set());
      setBulkQty("");
      setBulkNotes("");
      setSelectedBranchIds((prev) => new Set(prev));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 조정에 실패했습니다");
    } finally {
      setBulkSaving(false);
    }
  };

  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">재고 관리</h1>
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[840px]">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-foreground">재고 관리</h1>
          <p className="text-text-secondary mt-1 mb-0 text-[13px]">
            {inventory.length > 0 && `총 ${inventory.length}개 상품`}
            {inventory.filter(isLowStock).length > 0 &&
              ` · 재고 부족 ${inventory.filter(isLowStock).length}개`}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-[13px] text-text-secondary mb-2 font-semibold">매장 선택</label>
        <div className="max-w-[520px] space-y-2">
          <input
            type="text"
            value={branchSearch}
            onChange={(e) => setBranchSearch(e.target.value)}
            placeholder="매장 검색..."
            className="input-field w-full"
          />
          <div className="max-h-44 overflow-y-auto border border-border rounded-lg p-2 bg-bg-secondary">
            <div className="flex flex-col gap-1">
              {filteredBranches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary cursor-pointer text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranchIds.has(branch.id)}
                    onChange={(e) => {
                      setSelectedBranchIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(branch.id);
                        else next.delete(branch.id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span>{branch.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {canManage && selectedInventoryIds.size > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-primary-500/20 bg-primary-500/5">
          <div className="text-sm font-medium text-foreground mb-3">
            선택된 {selectedInventoryIds.size}개 상품 일괄 조정
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[180px_180px_1fr_auto] gap-2">
            <select
              value={bulkType}
              onChange={(e) => setBulkType(e.target.value)}
              className="input-field"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={bulkQty}
              onChange={(e) => setBulkQty(e.target.value)}
              placeholder="수량 (+/-)"
              className="input-field"
            />
            <input
              type="text"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="메모 (선택)"
              className="input-field"
            />
            <button
              onClick={handleBulkAdjust}
              disabled={bulkSaving}
              className="btn-primary px-4 py-2 text-sm"
            >
              {bulkSaving ? "처리 중..." : "일괄 적용"}
            </button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">등록된 매장이 없습니다</div>
          <div className="text-[13px] text-text-tertiary">먼저 매장을 등록해주세요</div>
        </div>
      ) : selectedBranchIds.size === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">매장을 1개 이상 선택하세요</div>
        </div>
      ) : loading ? (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[840px]">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      ) : inventory.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">재고 정보가 없습니다</div>
          <div className="text-[13px] text-text-tertiary">상품을 추가하면 자동으로 재고가 생성됩니다</div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[840px]">
            <thead className="bg-bg-tertiary">
              <tr>
                {canManage && (
                  <th className="w-10 py-3 px-3.5 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) setSelectedInventoryIds(new Set());
                        else setSelectedInventoryIds(new Set(inventory.map((item) => item.id)));
                      }}
                      className="w-4 h-4 rounded accent-primary"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const lowStock = isLowStock(item);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border cursor-pointer hover:bg-bg-tertiary transition-colors"
                    onClick={() =>
                      router.push(
                        `/customer/inventory/${item.product_id}?branchId=${encodeURIComponent(item.branch_id)}`,
                      )
                    }
                  >
                    {canManage && (
                      <td
                        className="py-3 px-3.5"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedInventoryIds.has(item.id)}
                          onChange={() => {
                            setSelectedInventoryIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded accent-primary"
                        />
                      </td>
                    )}
                    <td className="py-3 px-3.5 text-[13px] text-foreground whitespace-nowrap">
                      {item.branch_name || "-"}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <Image
                            src={item.image_url}
                            alt={item.product_name || "상품 이미지"}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover border border-border"
                          />
                        )}
                        <div className="font-semibold text-sm">
                          {item.product_name || "상품명 없음"}
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-3.5 text-[13px] text-right font-bold ${lowStock ? "text-danger-500" : "text-success"}`}>
                      {item.qty_available}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_reserved}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_sold}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.low_stock_threshold}</td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      {lowStock ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-danger-500/20 text-danger-500 text-xs font-semibold">재고 부족</span>
                      ) : (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-success/20 text-success text-xs font-semibold">정상</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
