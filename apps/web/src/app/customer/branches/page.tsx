"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { HALF_HOUR_TIME_OF_DAY_OPTIONS } from "@/lib/pickup-time";
import {
  getBillingTierLabel,
  isManualTransferTier,
} from "@/lib/billing-tier";
import {
  BUSINESS_HOUR_DAY_KEYS,
  BUSINESS_HOUR_DAY_LABELS,
  createBusinessHoursFormState,
  serializeBusinessHoursForm,
  type BusinessHoursFormState,
} from "@/lib/business-hours";
import toast from "react-hot-toast";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  type BillingTier,
  type FulfillmentType as BranchFulfillmentType,
} from "@/types/common";


// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string | null;
  isActive?: boolean;
  logoUrl?: string | null;
  brandSlug?: string | null;
  myRole: string | null;
  createdAt: string;
  depositSheetName?: string | null;
  depositSheetUrl?: string | null;
};

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  myRole?: string | null;
  billing_tier?: BillingTier | null;
};

// ============================================================
// Constants
// ============================================================

const BRANCH_FULFILLMENT_OPTIONS: Array<{
  value: BranchFulfillmentType;
  label: string;
}> = [
  { value: "PICKUP", label: "포장" },
  { value: "DELIVERY", label: "배달" },
  { value: "DINE_IN", label: "매장" },
  { value: "SHIPPING", label: "택배" },
];

// ============================================================
// Helpers
// ============================================================

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
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const visibleBranches = branches.filter(
    (branch) => !isInternalOnlineShopBranch(branch, selectedBrand?.name),
  );
  const canManageBrandSettings =
    canManageBrand(selectedBrand?.myRole) || canManageBrand(branches[0]?.myRole);

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

        const data = await apiClient.get<Branch[]>(
          `/customer/branches?brandId=${selectedBrandId}&includeInactive=true`,
        );
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

      {/* ── 3. 온라인샵 설정: BrandShopCard + 결제 운영 방식을 하나의 섹션으로 묶음 ── */}
      {selectedBrand && (
        <div className="mb-8">
          <div className="mb-3 rounded-xl border border-border bg-bg-secondary px-4 py-3">
            <div className="text-sm font-semibold text-foreground">온라인 판매 채널</div>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              온라인샵은 개별 지점과 분리된 브랜드 단위 주문 채널입니다.
              아래에서 온라인샵 주소와 결제 운영 방식을 함께 확인할 수 있습니다.
            </p>
          </div>
          <div className="text-sm font-semibold text-foreground mb-3">온라인샵 설정</div>
          {/* divide-y로 두 카드를 divider 하나로 자연스럽게 연결 */}
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            <ManagedBrandShopCard brand={selectedBrand} grouped />
            {canManageBrandSettings && (
              <div className="p-4 bg-bg-secondary text-foreground">
                <h2 className="text-sm font-bold m-0">결제 운영 방식</h2>
                <p className="mt-2 text-xs text-text-secondary">
                  온라인샵 결제 방식은 브랜드의 billing tier로 자동 결정됩니다.
                </p>
                <div className="mt-3 rounded-xl border border-border bg-bg-tertiary px-3 py-3 text-sm text-text-secondary">
                  <div className="font-semibold text-foreground">
                    {getBillingTierLabel(selectedBrand?.billing_tier)}
                  </div>
                  <div className="mt-1">
                    {isManualTransferTier(selectedBrand?.billing_tier)
                      ? "온라인샵 주문은 무통장 입금으로만 진행됩니다."
                      : "온라인샵 주문은 토스페이먼츠 결제로만 진행됩니다."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. 지점 목록 섹션 헤더: 제목 + 건수 + 추가 버튼 ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-foreground">오프라인 지점 목록</div>
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
            + 매장추가
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
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {visibleBranches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBranchModal
          brandId={selectedBrandId}
          billingTier={selectedBrand?.billing_tier ?? "PG"}
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
          {branch.logoUrl ? (
            <Image
              src={branch.logoUrl}
              alt={branch.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center text-2xl flex-shrink-0">
            🏪
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-bold text-base truncate">{branch.name}</div>
                <span
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-full min-w-[56px] px-3 py-0.5 text-[11px] font-semibold ${
                    branch.isActive === false
                      ? "bg-neutral-500/15 text-text-secondary"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {branch.isActive === false ? "비활성" : "운영중"}
                </span>

            </div>
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

function ManagedBrandShopCard({ brand, grouped = false }: { brand: Brand; grouped?: boolean }) {
  const shopUrl = getBrandShopUrl(brand.slug);
  const manageUrl = `/customer/brands/${brand.id}`;
  const containerClass = grouped
    ? "p-4 bg-bg-secondary text-foreground"
    : "p-5 rounded-xl border border-border bg-bg-secondary text-foreground";

  if (!shopUrl) {
    return (
      <div className={containerClass}>
        <div className="font-bold text-base mb-1">온라인샵</div>
        <div className="text-sm text-text-secondary">
          브랜드 URL이 없어 온라인샵 주소를 만들 수 없습니다.
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            href={manageUrl}
            className="inline-flex items-center h-8 px-3 rounded-lg border border-border bg-bg-tertiary text-xs font-medium text-text-secondary hover:text-foreground transition-colors"
          >
            관리하기
          </Link>
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
            <div className="text-xs text-text-secondary">브랜드 단위 온라인 주문 채널</div>
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

      <div className="text-sm text-text-secondary">브랜드 온라인샵 주소와 노출 설정을 관리합니다.</div>
      <div className="mt-4 flex justify-end">
        <Link
          href={manageUrl}
          className="inline-flex items-center h-8 px-3 rounded-lg border border-border bg-bg-tertiary text-xs font-medium text-text-secondary hover:text-foreground transition-colors"
        >
          관리하기
        </Link>
      </div>
    </div>
  );
}

function AddBranchModal({
  brandId,
  billingTier,
  onClose,
  onSuccess,
}: {
  brandId: string;
  billingTier: BillingTier;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    enabledFulfillmentTypes: BranchFulfillmentType[];
    transferBankName: string;
    transferAccountNumber: string;
    transferAccountHolder: string;
    depositSheetName: string;
    depositSheetUrl: string;
    contactPhone: string;
    kakaoChannelUrl: string;
    pickupStartTime: string;
    pickupEndTime: string;
    businessHours: BusinessHoursFormState;
  }>(() => ({
    name: "",
    slug: "",
    enabledFulfillmentTypes: ["PICKUP"],
    transferBankName: "",
    transferAccountNumber: "",
    transferAccountHolder: "",
    depositSheetName: "",
    depositSheetUrl: "",
    contactPhone: "",
    kakaoChannelUrl: "",
    pickupStartTime: "",
    pickupEndTime: "",
    businessHours: createBusinessHoursFormState(),
  }));
  const [saving, setSaving] = useState(false);

  const isTransferEnabled = isManualTransferTier(billingTier);

  const toggleFulfillmentType = (type: BranchFulfillmentType) => {
    setFormData((prev) => {
      const next = new Set(prev.enabledFulfillmentTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return {
        ...prev,
        enabledFulfillmentTypes: Array.from(next) as BranchFulfillmentType[],
      };
    });
  };

  const updateBusinessHours = <
    K extends keyof BusinessHoursFormState["monday"],
  >(
    dayKey: (typeof BUSINESS_HOUR_DAY_KEYS)[number],
    field: K,
    value: BusinessHoursFormState["monday"][K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [dayKey]: {
          ...prev.businessHours[dayKey],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error("모든 필드를 입력해주세요");
      return;
    }
    if (formData.enabledFulfillmentTypes.length === 0) {
      toast.error("주문방식을 1개 이상 선택해야 합니다.");
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
    for (const dayKey of BUSINESS_HOUR_DAY_KEYS) {
      const day = formData.businessHours[dayKey];
      if (!day.isOpen) {
        continue;
      }

      if (!day.openTime.trim() || !day.closeTime.trim()) {
        toast.error(`${BUSINESS_HOUR_DAY_LABELS[dayKey]}요일 영업시간을 모두 선택해 주세요.`);
        return;
      }

      if (timeToMinutes(day.closeTime) <= timeToMinutes(day.openTime)) {
        toast.error(`${BUSINESS_HOUR_DAY_LABELS[dayKey]}요일 마감 시간은 시작 시간보다 늦어야 합니다.`);
        return;
      }
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
        enabledFulfillmentTypes: formData.enabledFulfillmentTypes,
        transferAccount: {
          bankName: formData.transferBankName.trim(),
          accountNumber: formData.transferAccountNumber.trim(),
          accountHolder: formData.transferAccountHolder.trim(),
        },
        depositSheetName: formData.depositSheetName.trim() || null,
        depositSheetUrl: formData.depositSheetUrl.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        kakaoChannelUrl: formData.kakaoChannelUrl.trim() || null,
        pickupTimeConfig:
          formData.pickupStartTime.trim() && formData.pickupEndTime.trim()
            ? {
                startTime: formData.pickupStartTime.trim(),
                endTime: formData.pickupEndTime.trim(),
              }
            : null,
        businessHours: serializeBusinessHoursForm(formData.businessHours),
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
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-[500px] overflow-y-auto rounded-md border border-border bg-bg-secondary p-8 text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
            <label className="block text-sm text-text-secondary mb-2 font-semibold">주문방식 노출</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_FULFILLMENT_OPTIONS.map((option) => {
                const checked = formData.enabledFulfillmentTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleFulfillmentType(option.value)}
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
            <label className="block text-sm text-text-secondary mb-2 font-semibold">결제 운영 방식</label>
            <div className="rounded-xl border border-border bg-bg-secondary px-3 py-3 text-sm text-text-secondary">
              <div className="font-semibold text-foreground">{getBillingTierLabel(billingTier)}</div>
              <div className="mt-1">
                {isTransferEnabled
                  ? "이 브랜드는 무통장 입금만 사용할 수 있어요."
                  : "이 브랜드는 토스페이먼츠 결제만 사용할 수 있어요."}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">기본 픽업 시간</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={formData.pickupStartTime}
                onChange={(e) => setFormData({ ...formData, pickupStartTime: e.target.value })}
                className="input-field"
              >
                <option value="">시작 시간 선택</option>
                {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                  <option key={`pickup-start-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={formData.pickupEndTime}
                onChange={(e) => setFormData({ ...formData, pickupEndTime: e.target.value })}
                className="input-field"
              >
                <option value="">종료 시간 선택</option>
                {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                  <option key={`pickup-end-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              요일별 영업일을 따로 설정하지 않으면 이 시간대로 모든 날짜가 열립니다.
            </p>
          </div>
          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">요일별 영업일 설정</label>
            <div className="space-y-2">
              {BUSINESS_HOUR_DAY_KEYS.map((dayKey) => {
                const day = formData.businessHours[dayKey];
                return (
                  <div
                    key={dayKey}
                    className="grid gap-2 rounded-xl border border-border bg-bg-secondary p-3 sm:grid-cols-[72px_110px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {BUSINESS_HOUR_DAY_LABELS[dayKey]}요일
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={day.isOpen}
                        onChange={(e) => updateBusinessHours(dayKey, "isOpen", e.target.checked)}
                      />
                      영업
                    </label>
                    <select
                      value={day.openTime}
                      onChange={(e) => updateBusinessHours(dayKey, "openTime", e.target.value)}
                      disabled={!day.isOpen}
                      className="input-field disabled:opacity-60"
                    >
                      {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                        <option key={`${dayKey}-open-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={day.closeTime}
                      onChange={(e) => updateBusinessHours(dayKey, "closeTime", e.target.value)}
                      disabled={!day.isOpen}
                      className="input-field disabled:opacity-60"
                    >
                      {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                        <option key={`${dayKey}-close-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              예: 월요일 휴무, 화요일 09:00~18:00, 수~일 10:00~20:00처럼 설정할 수 있습니다.
            </p>
          </div>

          {isTransferEnabled && (
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
                <input
                  type="text"
                  value={formData.depositSheetName}
                  onChange={(e) => setFormData({ ...formData, depositSheetName: e.target.value })}
                  className="input-field"
                  placeholder="입금기록 시트명 (예: 시트1)"
                />
                <input
                  type="url"
                  value={formData.depositSheetUrl}
                  onChange={(e) => setFormData({ ...formData, depositSheetUrl: e.target.value })}
                  className="input-field"
                  placeholder="입금기록 링크 (Google Sheets URL)"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">고객 문의 정보</label>
            <div className="grid gap-2">
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="input-field"
                placeholder="문의 전화번호"
              />
              <input
                type="url"
                value={formData.kakaoChannelUrl}
                onChange={(e) => setFormData({ ...formData, kakaoChannelUrl: e.target.value })}
                className="input-field"
                placeholder="https://pf.kakao.com/_example/chat"
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
