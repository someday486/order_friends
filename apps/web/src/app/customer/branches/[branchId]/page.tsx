"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { ImageUpload } from "@/components/ui/ImageUpload";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";
type PaymentMethod = "CARD" | "TRANSFER" | "CASH";

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  myRole: string | null;
  createdAt: string;
  enabledFulfillmentTypes?: FulfillmentType[];
  allowedPaymentMethods?: PaymentMethod[];
};

type Brand = {
  id: string;
  slug: string | null;
};

const ALL_FULFILLMENT_TYPES: FulfillmentType[] = ["PICKUP", "DELIVERY", "DINE_IN"];
const ALL_PAYMENT_METHODS: PaymentMethod[] = ["CARD", "TRANSFER", "CASH"];

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "포장",
  DELIVERY: "배달",
  DINE_IN: "매장",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  CASH: "현금",
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildOrderUrl(brandSlug: string | null, branchSlug: string | null, branchId: string): string {
  if (brandSlug && branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }
  return `/order/branch/${branchId}`;
}

function toggleItem<T extends string>(items: T[], value: T): T[] {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }
  return [...items, value];
}

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<FulfillmentType[]>(["PICKUP"]);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<PaymentMethod[]>(["CARD"]);

  const canEdit = useMemo(
    () => branch && (branch.myRole === "OWNER" || branch.myRole === "ADMIN"),
    [branch],
  );

  const orderUrl = useMemo(
    () => (branch ? buildOrderUrl(brandSlug, branch.slug, branch.id) : "-"),
    [branch, brandSlug],
  );

  const isDirty = useMemo(() => {
    if (!branch) return false;

    const originFulfillment = branch.enabledFulfillmentTypes ?? ["PICKUP"];
    const originPayments = branch.allowedPaymentMethods ?? ["CARD", "TRANSFER", "CASH"];

    const sameFulfillment =
      enabledFulfillmentTypes.length === originFulfillment.length &&
      enabledFulfillmentTypes.every((item) => originFulfillment.includes(item));

    const samePayments =
      allowedPaymentMethods.length === originPayments.length &&
      allowedPaymentMethods.every((item) => originPayments.includes(item));

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      logoUrl !== (branch.logoUrl ?? null) ||
      coverImageUrl !== (branch.coverImageUrl ?? null) ||
      !sameFulfillment ||
      !samePayments
    );
  }, [allowedPaymentMethods, branch, coverImageUrl, enabledFulfillmentTypes, logoUrl, name, slug]);

  const resetForm = (source: Branch) => {
    setName(source.name ?? "");
    setSlug(source.slug ?? "");
    setLogoUrl(source.logoUrl ?? null);
    setCoverImageUrl(source.coverImageUrl ?? null);
    setEnabledFulfillmentTypes(
      source.enabledFulfillmentTypes && source.enabledFulfillmentTypes.length > 0
        ? source.enabledFulfillmentTypes
        : ["PICKUP"],
    );
    setAllowedPaymentMethods(
      source.allowedPaymentMethods && source.allowedPaymentMethods.length > 0
        ? source.allowedPaymentMethods
        : ["CARD", "TRANSFER", "CASH"],
    );
  };

  useEffect(() => {
    if (!branchId) return;

    const loadBranch = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch>(`/customer/branches/${branchId}`);
        setBranch(data);
        resetForm(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "지점 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadBranch();
  }, [branchId]);

  useEffect(() => {
    if (!branch?.brandId) return;

    const loadBrandSlug = async () => {
      try {
        const brands = await apiClient.get<Brand[]>("/customer/brands");
        const currentBrand = brands.find((item) => item.id === branch.brandId);
        setBrandSlug(currentBrand?.slug ?? null);
      } catch {
        setBrandSlug(null);
      }
    };

    loadBrandSlug();
  }, [branch?.brandId]);

  const handleSave = async () => {
    if (!branch) return;

    if (!name.trim()) {
      toast.error("지점명을 입력하세요.");
      return;
    }

    if (!slug.trim()) {
      toast.error("주문 URL 값을 입력하세요.");
      return;
    }

    if (enabledFulfillmentTypes.length === 0) {
      toast.error("주문 방식을 최소 1개 이상 선택하세요.");
      return;
    }

    if (allowedPaymentMethods.length === 0) {
      toast.error("결제 수단을 최소 1개 이상 선택하세요.");
      return;
    }

    try {
      setSaving(true);

      const updated = await apiClient.patch<Branch>(`/customer/branches/${branchId}`, {
        name: name.trim(),
        slug: normalizeSlug(slug),
        logoUrl,
        coverImageUrl,
        enabledFulfillmentTypes,
        allowedPaymentMethods,
      });

      setBranch(updated);
      resetForm(updated);
      setIsEditing(false);
      toast.success("지점 설정을 저장했습니다.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "지점 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(`"${branch.name}" 지점을 삭제할까요?\n삭제 후 복구할 수 없습니다.`);
    if (!confirmed) return;

    try {
      await apiClient.delete(`/customer/branches/${branchId}`);
      router.replace("/customer/branches");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "지점 삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">지점</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors"
        >
          ← 뒤로 가기
        </button>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">지점</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">
          {error || "지점을 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors"
      >
        ← 뒤로 가기
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">지점 상세</h1>
        {canEdit && !isEditing && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors"
            >
              수정하기
            </button>
            <button
              onClick={handleDelete}
              className="py-2.5 px-5 rounded-lg border border-danger-500 bg-transparent text-danger-500 text-sm cursor-pointer font-semibold hover:bg-danger-500/10 transition-colors"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">지점명</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
                placeholder="지점명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">주문 URL</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                className="input-field w-full"
                placeholder="예: gangnam-main"
                pattern="[a-z0-9-]+"
              />
              <div className="text-xs text-text-tertiary mt-1">영문/숫자/하이픈(-)만 사용 가능합니다.</div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                folder="branches/logos"
                label="로고"
                aspectRatio="1/1"
              />
              <ImageUpload
                value={coverImageUrl}
                onChange={setCoverImageUrl}
                folder="branches/covers"
                label="커버 이미지"
                aspectRatio="16/9"
              />
            </div>

            <div className="mb-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">소비자에게 노출할 주문 방식</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ALL_FULFILLMENT_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabledFulfillmentTypes.includes(type)}
                      onChange={() => setEnabledFulfillmentTypes((prev) => toggleItem(prev, type))}
                    />
                    <span className="text-sm text-foreground">{FULFILLMENT_LABEL[type]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[13px] font-semibold text-foreground mb-2">소비자에게 노출할 결제 수단</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ALL_PAYMENT_METHODS.map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={allowedPaymentMethods.includes(method)}
                      onChange={() => setAllowedPaymentMethods((prev) => toggleItem(prev, method))}
                    />
                    <span className="text-sm text-foreground">{PAYMENT_LABEL[method]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="btn-primary flex-1 py-2.5 px-5 text-sm"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  resetForm(branch);
                }}
                disabled={saving}
                className="flex-1 py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            {branch.coverImageUrl && (
              <div className="mb-6">
                <Image
                  src={branch.coverImageUrl}
                  alt="커버 이미지"
                  width={1200}
                  height={675}
                  className="w-full rounded-lg object-cover"
                  style={{ aspectRatio: "16/9" }}
                />
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              {branch.logoUrl ? (
                <Image
                  src={branch.logoUrl}
                  alt={branch.name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-bg-tertiary flex items-center justify-center text-[40px]">
                  🏪
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold mb-2 text-foreground">{branch.name}</h2>
                {branch.myRole && <div className="text-sm text-text-secondary">역할: {branch.myRole}</div>}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">주문 URL</div>
              <div className="text-[15px] text-foreground">{orderUrl}</div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">주문 방식</div>
              <div className="text-[15px] text-foreground">
                {(branch.enabledFulfillmentTypes ?? ["PICKUP"]).map((item) => FULFILLMENT_LABEL[item]).join(", ")}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">결제 수단</div>
              <div className="text-[15px] text-foreground">
                {(branch.allowedPaymentMethods ?? ["CARD", "TRANSFER", "CASH"]).map((item) => PAYMENT_LABEL[item]).join(", ")}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">브랜드 ID</div>
              <div className="text-[15px] text-foreground font-mono">{branch.brandId}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-[11px] text-text-tertiary mb-1">등록일</div>
                <div className="text-sm text-foreground">{new Date(branch.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
