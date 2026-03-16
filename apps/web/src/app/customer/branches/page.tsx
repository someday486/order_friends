"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";
import { CardSkeleton } from "@/components/ui/Skeleton";


// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string | null;
  brandSlug?: string | null;
  myRole: string | null;
  createdAt: string;
};

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  myRole?: string | null;
  shop_payment_methods?: string[] | null;
};

type BranchPaymentMethod = "CARD" | "TRANSFER" | "CASH";

// ============================================================
// Constants
// ============================================================

const SHOP_PAYMENT_METHOD_OPTIONS = [
  { value: "CARD", label: "카드" },
  { value: "TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
] as const;

const BRANCH_PAYMENT_METHOD_OPTIONS: Array<{ value: BranchPaymentMethod; label: string }> = [
  { value: "CARD", label: "카드" },
  { value: "TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
];

// ============================================================
// Helpers
// ============================================================

function normalizeShopPaymentMethods(value: unknown): string[] {
  const allowed = new Set(SHOP_PAYMENT_METHOD_OPTIONS.map((item) => item.value));
  if (!Array.isArray(value)) {
    return SHOP_PAYMENT_METHOD_OPTIONS.map((item) => item.value);
  }
  const unique = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.toUpperCase().trim() : ""))
        .filter((item) => allowed.has(item as (typeof SHOP_PAYMENT_METHOD_OPTIONS)[number]["value"])),
    ),
  );
  return unique.length > 0
    ? unique
    : SHOP_PAYMENT_METHOD_OPTIONS.map((item) => item.value);
}

function canManageBrand(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function getBranchOrderUrl(
  brandSlug: string | null | undefined,
  branchSlug: string | null,
  branchId: string,
): string {
  if (brandSlug && branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }

  return `/order/branch/${branchId}`;
}

function getBrandShopUrl(brandSlug: string | null | undefined): string | null {
  if (!brandSlug) return null;
  return `/shop/${encodeURIComponent(brandSlug)}`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isInternalOnlineShopBranch(branch: Branch, brandName?: string | null): boolean {
  if (branch.slug) return false;
  const branchName = (branch.name ?? "").trim();
  if (!branchName) return false;
  const normalizedBranchName = branchName.toLowerCase();
  const normalizedBrandName = (brandName ?? "").trim().toLowerCase();

  if (normalizedBrandName && normalizedBranchName === `${normalizedBrandName} 온라인샵`) {
    return true;
  }
  return normalizedBranchName.endsWith("온라인샵");
}

// ============================================================
// Component
// ============================================================

export default function CustomerBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [shopPaymentMethods, setShopPaymentMethods] = useState<string[]>(
    SHOP_PAYMENT_METHOD_OPTIONS.map((item) => item.value),
  );
  const [savingShopPaymentMethods, setSavingShopPaymentMethods] = useState(false);
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const visibleBranches = branches.filter(
    (branch) => !isInternalOnlineShopBranch(branch, selectedBrand?.name),
  );
  const canManageBrandSettings =
    canManageBrand(selectedBrand?.myRole) || canManageBrand(branches[0]?.myRole);

  useEffect(() => {
    setShopPaymentMethods(normalizeShopPaymentMethods(selectedBrand?.shop_payment_methods));
  }, [selectedBrand?.id, selectedBrand?.shop_payment_methods]);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const data = await apiClient.get<Brand[]>("/customer/brands");
        setBrands(data);

        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록을 불러올 수 없습니다");
      }
    };

    loadBrands();
  }, []);

  useEffect(() => {
    if (!selectedBrandId) {
      setLoading(false);
      return;
    }

    const loadBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch[]>(`/customer/branches?brandId=${selectedBrandId}`);
        const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
        setBranches(
          data.map((branch) => ({
            ...branch,
            brandSlug: selectedBrand?.slug ?? null,
          })),
        );
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, [selectedBrandId, brands]);

  const canAddBranch = branches.length > 0
    ? branches[0]?.myRole === "OWNER" || branches[0]?.myRole === "ADMIN"
    : brands.find((brand) => brand.id === selectedBrandId) !== undefined;

  const toggleShopPaymentMethod = (method: string) => {
    setShopPaymentMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) {
        next.delete(method);
      } else {
        next.add(method);
      }
      return Array.from(next);
    });
  };

  const formData = {
    pickupStartTime: "",
    pickupEndTime: "",
  };

  const handleSaveShopPaymentMethods = async () => {
    if (!selectedBrandId) return;
    if (shopPaymentMethods.length === 0) {
      toast.error("온라인샵 결제수단은 1개 이상 선택해야 합니다.");
      return;
    }

    if (
      (formData.pickupStartTime.trim() && !formData.pickupEndTime.trim()) ||
      (!formData.pickupStartTime.trim() && formData.pickupEndTime.trim())
    ) {
      toast.error("픽업 시간은 시작과 종료를 모두 입력해주세요.");
      return;
    }
    if (
      formData.pickupStartTime.trim() &&
      formData.pickupEndTime.trim() &&
      timeToMinutes(formData.pickupEndTime) <= timeToMinutes(formData.pickupStartTime)
    ) {
      toast.error("픽업 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    try {
      setSavingShopPaymentMethods(true);
      const updated = await apiClient.patch<Brand>(`/customer/brands/${selectedBrandId}`, {
        shop_payment_methods: shopPaymentMethods,
      });
      const normalized = normalizeShopPaymentMethods(updated.shop_payment_methods);
      setBrands((prev) =>
        prev.map((brand) =>
          brand.id === selectedBrandId
            ? { ...brand, shop_payment_methods: normalized }
            : brand,
        ),
      );
      setShopPaymentMethods(normalized);
      toast.success("온라인샵 결제수단을 저장했습니다.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "온라인샵 결제수단 저장에 실패했습니다.");
    } finally {
      setSavingShopPaymentMethods(false);
    }
  };

  if (brands.length === 0 && !loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">매장 관리</h1>
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 브랜드가 없습니다</div>
          <div className="text-sm">먼저 브랜드 멤버십을 요청하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── 1. 상단 헤더: 제목만, 버튼 제거 ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">매장 관리</h1>
      </div>

      {/* 브랜드 선택 */}
      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-2 font-semibold">브랜드 선택</label>
        <select
          value={selectedBrandId}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          className="input-field max-w-[400px]"
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── 3. 온라인샵 설정: BrandShopCard + 결제수단을 하나의 섹션으로 묶음 ── */}
      {selectedBrand && (
        <div className="mb-8">
          <div className="text-sm font-semibold text-foreground mb-3">온라인샵 설정</div>
          {/* divide-y로 두 카드를 divider 하나로 자연스럽게 연결 */}
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            <BrandShopCard brand={selectedBrand} grouped />
            {canManageBrandSettings && (
              <div className="p-4 bg-bg-secondary text-foreground">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="text-sm font-bold m-0">결제수단 노출</h2>
                  <button
                    type="button"
                    onClick={handleSaveShopPaymentMethods}
                    disabled={savingShopPaymentMethods}
                    className="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-3">
                  온라인샵 주문 화면에 노출할 결제수단을 선택하세요.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SHOP_PAYMENT_METHOD_OPTIONS.map((option) => {
                    const checked = shopPaymentMethods.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleShopPaymentMethod(option.value)}
                        disabled={savingShopPaymentMethods}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          checked
                            ? "border-primary-500 bg-primary-500/10 text-primary-500"
                            : "border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. 지점 목록 섹션 헤더: 제목 + 건수 + 추가 버튼 ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-foreground">지점 목록</div>
          {!loading && (
            <div className="text-xs text-text-tertiary mt-0.5">
              총 {visibleBranches.length}개 지점
            </div>
          )}
        </div>
        {canAddBranch && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            + 지점 추가
          </button>
        )}
      </div>

      {/* 지점 목록 본문 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">{error}</div>
      ) : visibleBranches.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 지점이 없습니다</div>
          <div className="text-sm">새로운 지점을 추가해보세요</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {visibleBranches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBranchModal
          brandId={selectedBrandId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function BranchCard({ branch }: { branch: Branch }) {
  const orderUrl = getBranchOrderUrl(branch.brandSlug, branch.slug, branch.id);

  return (
    <div className="p-5 rounded-xl border border-border bg-bg-secondary text-foreground">
      {/* 상단: 아이콘 + 지점명/역할 + 외부링크 아이콘 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center text-2xl flex-shrink-0">
            🏪
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base mb-1 truncate">{branch.name}</div>
            {branch.myRole && (
              <div className="text-xs text-text-secondary">역할: {branch.myRole}</div>
            )}
          </div>
        </div>

        {/* 외부링크: 고객 주문 페이지 (새 탭) */}
        <a
          href={orderUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="고객 주문 페이지 열기"
          aria-label={`${branch.name} 고객 주문 페이지 열기`}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* 등록일 */}
      <div className="text-xs text-text-tertiary mb-4">
        등록일: {new Date(branch.createdAt).toLocaleDateString("ko-KR")}
      </div>

      {/* 하단: 내부 관리 페이지 이동 버튼 */}
      <div className="flex justify-end">
        <Link
          href={`/customer/branches/${branch.id}`}
          className="inline-flex items-center h-8 px-3 rounded-lg border border-border bg-bg-tertiary text-xs font-medium text-text-secondary hover:text-foreground transition-colors"
        >
          관리하기
        </Link>
      </div>
    </div>
  );
}

// ── 3. BrandShopCard: grouped prop으로 섹션 내 렌더링 지원 ──
function BrandShopCard({ brand, grouped = false }: { brand: Brand; grouped?: boolean }) {
  const shopUrl = getBrandShopUrl(brand.slug);

  // grouped=true일 때: 외부 border/radius 제거 (부모 섹션이 담당)
  const containerClass = grouped
    ? "p-4 bg-bg-secondary text-foreground"
    : "p-5 rounded-xl border border-border bg-bg-secondary text-foreground";

  if (!shopUrl) {
    return (
      <div className={grouped ? "p-4 bg-bg-secondary text-foreground" : "p-5 rounded-xl border border-border bg-bg-secondary text-foreground"}>
        <div className="font-bold text-base mb-1">온라인샵</div>
        <div className="text-sm text-text-secondary">
          브랜드 URL이 없어 온라인샵 주소를 만들 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center text-2xl">
            🛒
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base mb-1">온라인샵</div>
            <div className="text-xs text-text-secondary">브랜드 하위 온라인 판매 채널</div>
          </div>
        </div>

        <Link
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="온라인샵 페이지 열기"
          aria-label="온라인샵 페이지 열기"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      <div className="text-sm text-text-secondary">브랜드 온라인샵</div>
    </div>
  );
}

function AddBranchModal({
  brandId,
  onClose,
  onSuccess,
}: {
  brandId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    allowedPaymentMethods: ["CARD", "TRANSFER", "CASH"] as BranchPaymentMethod[],
    transferBankName: "",
    transferAccountNumber: "",
    transferAccountHolder: "",
    pickupStartTime: "",
    pickupEndTime: "",
  });
  const [saving, setSaving] = useState(false);

  const isTransferEnabled = formData.allowedPaymentMethods.includes("TRANSFER");

  const togglePaymentMethod = (method: BranchPaymentMethod) => {
    setFormData((prev) => {
      const next = new Set(prev.allowedPaymentMethods);
      if (next.has(method)) {
        next.delete(method);
      } else {
        next.add(method);
      }
      return { ...prev, allowedPaymentMethods: Array.from(next) as BranchPaymentMethod[] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error("모든 필드를 입력해주세요");
      return;
    }
    if (formData.allowedPaymentMethods.length === 0) {
      toast.error("결제수단은 1개 이상 선택해야 합니다.");
      return;
    }
    if (
      (formData.pickupStartTime.trim() && !formData.pickupEndTime.trim()) ||
      (!formData.pickupStartTime.trim() && formData.pickupEndTime.trim())
    ) {
      toast.error("픽업 시간은 시작과 종료를 모두 입력해주세요.");
      return;
    }
    if (
      formData.pickupStartTime.trim() &&
      formData.pickupEndTime.trim() &&
      timeToMinutes(formData.pickupEndTime) <= timeToMinutes(formData.pickupStartTime)
    ) {
      toast.error("픽업 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    if (
      isTransferEnabled &&
      (!formData.transferBankName.trim() ||
        !formData.transferAccountNumber.trim() ||
        !formData.transferAccountHolder.trim())
    ) {
      toast.error("계좌이체를 사용하려면 은행명, 계좌번호, 예금주를 입력해주세요.");
      return;
    }

    try {
      setSaving(true);
      await apiClient.post("/customer/branches", {
        brandId,
        name: formData.name,
        slug: formData.slug,
        allowedPaymentMethods: formData.allowedPaymentMethods,
        transferAccount: {
          bankName: formData.transferBankName.trim(),
          accountNumber: formData.transferAccountNumber.trim(),
          accountHolder: formData.transferAccountHolder.trim(),
        },
        pickupTimeConfig:
          formData.pickupStartTime.trim() && formData.pickupEndTime.trim()
            ? {
                startTime: formData.pickupStartTime.trim(),
                endTime: formData.pickupEndTime.trim(),
              }
            : null,
      });

      toast.success("지점이 추가되었습니다.");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "지점 추가에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-md p-8 max-w-[500px] w-[90%] text-foreground" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">지점 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">지점명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="지점명을 입력하세요"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">URL (영문, 숫자, 하이픈만)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="input-field"
              placeholder="branch-url"
              pattern="[a-z0-9-]+"
              required
            />
            <div className="text-xs text-text-tertiary mt-1">
              소문자 영문, 숫자, 하이픈(-)만 사용 가능
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">결제수단 노출</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_PAYMENT_METHOD_OPTIONS.map((option) => {
                const checked = formData.allowedPaymentMethods.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => togglePaymentMethod(option.value)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                      checked
                        ? "border-primary-500 bg-primary-500/10 text-primary-500"
                        : "border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">픽업 가능 시간</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="time"
                step={1800}
                value={formData.pickupStartTime}
                onChange={(e) => setFormData({ ...formData, pickupStartTime: e.target.value })}
                className="input-field"
              />
              <input
                type="time"
                step={1800}
                value={formData.pickupEndTime}
                onChange={(e) => setFormData({ ...formData, pickupEndTime: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">계좌이체 입금 정보</label>
            <div className="grid gap-2">
              <input
                type="text"
                value={formData.transferBankName}
                onChange={(e) => setFormData({ ...formData, transferBankName: e.target.value })}
                className="input-field"
                placeholder="은행명"
              />
              <input
                type="text"
                value={formData.transferAccountNumber}
                onChange={(e) => setFormData({ ...formData, transferAccountNumber: e.target.value })}
                className="input-field"
                placeholder="계좌번호"
              />
              <input
                type="text"
                value={formData.transferAccountHolder}
                onChange={(e) => setFormData({ ...formData, transferAccountHolder: e.target.value })}
                className="input-field"
                placeholder="예금주"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? "추가 중..." : "추가"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
