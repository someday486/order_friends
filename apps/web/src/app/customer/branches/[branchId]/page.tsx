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
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
};

type Brand = {
  id: string;
  slug: string | null;
};

const ALL_FULFILLMENT_TYPES: FulfillmentType[] = ["PICKUP", "DELIVERY", "DINE_IN"];
const ALL_PAYMENT_METHODS: PaymentMethod[] = ["CARD", "TRANSFER", "CASH"];

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "?ъ옣",
  DELIVERY: "諛곕떖",
  DINE_IN: "留ㅼ옣",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: "移대뱶",
  TRANSFER: "怨꾩쥖?댁껜",
  CASH: "?꾧툑",
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
  const [transferBankName, setTransferBankName] = useState("");
  const [transferAccountNumber, setTransferAccountNumber] = useState("");
  const [transferAccountHolder, setTransferAccountHolder] = useState("");

  // ── 스탬프 카드 설정 ──
  const [stampActive, setStampActive] = useState(false);
  const [stampPerOrder, setStampPerOrder] = useState(1);
  const [stampThreshold, setStampThreshold] = useState(10);
  const [stampRewardDesc, setStampRewardDesc] = useState("스탬프 적립 완료 보상");
  const [stampSaving, setStampSaving] = useState(false);
  const [stampLoaded, setStampLoaded] = useState(false);

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
    const sameTransferInfo =
      transferBankName.trim() === (branch.transferAccount?.bankName ?? "") &&
      transferAccountNumber.trim() === (branch.transferAccount?.accountNumber ?? "") &&
      transferAccountHolder.trim() === (branch.transferAccount?.accountHolder ?? "");

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      logoUrl !== (branch.logoUrl ?? null) ||
      coverImageUrl !== (branch.coverImageUrl ?? null) ||
      !sameFulfillment ||
      !samePayments ||
      !sameTransferInfo
    );
  }, [
    allowedPaymentMethods,
    branch,
    coverImageUrl,
    enabledFulfillmentTypes,
    logoUrl,
    name,
    slug,
    transferAccountHolder,
    transferAccountNumber,
    transferBankName,
  ]);

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
    setTransferBankName(source.transferAccount?.bankName ?? "");
    setTransferAccountNumber(source.transferAccount?.accountNumber ?? "");
    setTransferAccountHolder(source.transferAccount?.accountHolder ?? "");
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
        setError(err?.message ?? "吏???뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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

  useEffect(() => {
    if (!branchId || !canEdit) return;
    apiClient
      .get<{ isActive: boolean; stampsPerOrder: number; rewardThreshold: number; rewardDescription: string } | null>(
        `/customer/branches/${branchId}/stamp-card`,
      )
      .then((data) => {
        if (data) {
          setStampActive(data.isActive ?? false);
          setStampPerOrder(data.stampsPerOrder ?? 1);
          setStampThreshold(data.rewardThreshold ?? 10);
          setStampRewardDesc(data.rewardDescription ?? "스탬프 적립 완료 보상");
        }
        setStampLoaded(true);
      })
      .catch(() => setStampLoaded(true));
  }, [branchId, canEdit]);

  const handleStampSave = async () => {
    setStampSaving(true);
    try {
      await apiClient.put(`/customer/branches/${branchId}/stamp-card`, {
        isActive: stampActive,
        stampsPerOrder: stampPerOrder,
        rewardThreshold: stampThreshold,
        rewardDescription: stampRewardDesc || "스탬프 적립 완료 보상",
      });
      toast.success("스탬프 카드 설정이 저장됐어요.");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "저장에 실패했습니다.");
    } finally {
      setStampSaving(false);
    }
  };

  const handleSave = async () => {
    if (!branch) return;

    if (!name.trim()) {
      toast.error("吏?먮챸???낅젰?섏꽭??");
      return;
    }

    if (!slug.trim()) {
      toast.error("二쇰Ц URL 媛믪쓣 ?낅젰?섏꽭??");
      return;
    }

    if (enabledFulfillmentTypes.length === 0) {
      toast.error("二쇰Ц 諛⑹떇??理쒖냼 1媛??댁긽 ?좏깮?섏꽭??");
      return;
    }

    if (allowedPaymentMethods.length === 0) {
      toast.error("寃곗젣 ?섎떒??理쒖냼 1媛??댁긽 ?좏깮?섏꽭??");
      return;
    }

    if (
      allowedPaymentMethods.includes("TRANSFER") &&
      (!transferBankName.trim() ||
        !transferAccountNumber.trim() ||
        !transferAccountHolder.trim())
    ) {
      toast.error("怨꾩쥖?댁껜 ?ъ슜 ????됰챸, 怨꾩쥖踰덊샇, ?덇툑二쇰? 紐⑤몢 ?낅젰??二쇱꽭??");
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
        transferAccount: {
          bankName: transferBankName.trim(),
          accountNumber: transferAccountNumber.trim(),
          accountHolder: transferAccountHolder.trim(),
        },
      });

      setBranch(updated);
      resetForm(updated);
      setIsEditing(false);
      toast.success("吏???ㅼ젙????ν뻽?듬땲??");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "吏????μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(`"${branch.name}" 吏?먯쓣 ??젣?좉퉴??\n??젣 ??蹂듦뎄?????놁뒿?덈떎.`);
    if (!confirmed) return;

    try {
      await apiClient.delete(`/customer/branches/${branchId}`);
      router.replace("/customer/branches");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "吏????젣???ㅽ뙣?덉뒿?덈떎.");
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">吏??</h1>
        <div className="text-text-secondary">濡쒕뵫 以?..</div>
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
          ???ㅻ줈 媛湲?
        </button>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">吏??</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">
          {error || "吏?먯쓣 李얠쓣 ???놁뒿?덈떎."}
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
        ???ㅻ줈 媛湲?
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">吏???곸꽭</h1>
        {canEdit && !isEditing && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors"
            >
              ?섏젙?섍린
            </button>
            <button
              onClick={handleDelete}
              className="py-2.5 px-5 rounded-lg border border-danger-500 bg-transparent text-danger-500 text-sm cursor-pointer font-semibold hover:bg-danger-500/10 transition-colors"
            >
              ??젣
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">吏?먮챸</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
                placeholder="지점명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">二쇰Ц URL</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                className="input-field w-full"
                placeholder="?? gangnam-main"
                pattern="[a-z0-9-]+"
              />
              <div className="text-xs text-text-tertiary mt-1">?곷Ц/?レ옄/?섏씠??-)留??ъ슜 媛?ν빀?덈떎.</div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                folder="branches/logos"
                label="濡쒓퀬"
                aspectRatio="1/1"
              />
              <ImageUpload
                value={coverImageUrl}
                onChange={setCoverImageUrl}
                folder="branches/covers"
                label="而ㅻ쾭 ?대?吏"
                aspectRatio="16/9"
              />
            </div>

            <div className="mb-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">?뚮퉬?먯뿉寃??몄텧??二쇰Ц 諛⑹떇</div>
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
              <div className="text-[13px] font-semibold text-foreground mb-2">?뚮퉬?먯뿉寃??몄텧??寃곗젣 ?섎떒</div>
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

            <div className="mb-6">
              <div className="text-[13px] font-semibold text-foreground mb-2">怨꾩쥖?댁껜 ?낃툑 ?뺣낫</div>
              <div className="grid gap-2">
                <input
                  value={transferBankName}
                  onChange={(e) => setTransferBankName(e.target.value)}
                  className="input-field w-full"
                  placeholder="??됰챸"
                />
                <input
                  value={transferAccountNumber}
                  onChange={(e) => setTransferAccountNumber(e.target.value)}
                  className="input-field w-full"
                  placeholder="怨꾩쥖踰덊샇"
                />
                <input
                  value={transferAccountHolder}
                  onChange={(e) => setTransferAccountHolder(e.target.value)}
                  className="input-field w-full"
                  placeholder="예금주"
                />
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
                痍⑥냼
              </button>
            </div>
          </div>
        ) : (
          <div>
            {branch.coverImageUrl && (
              <div className="mb-6">
                <Image
                  src={branch.coverImageUrl}
                  alt="而ㅻ쾭 ?대?吏"
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
                  ?룵
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold mb-2 text-foreground">{branch.name}</h2>
                {branch.myRole && <div className="text-sm text-text-secondary">??븷: {branch.myRole}</div>}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">二쇰Ц URL</div>
              <div className="text-[15px] text-foreground">{orderUrl}</div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">二쇰Ц 諛⑹떇</div>
              <div className="text-[15px] text-foreground">
                {(branch.enabledFulfillmentTypes ?? ["PICKUP"]).map((item) => FULFILLMENT_LABEL[item]).join(", ")}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">寃곗젣 ?섎떒</div>
              <div className="text-[15px] text-foreground">
                {(branch.allowedPaymentMethods ?? ["CARD", "TRANSFER", "CASH"]).map((item) => PAYMENT_LABEL[item]).join(", ")}
              </div>
            </div>
            {(branch.allowedPaymentMethods ?? ["CARD", "TRANSFER", "CASH"]).includes("TRANSFER") ? (
              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">계좌이체 입금 정보</div>
                <div className="grid gap-1 text-[15px] text-foreground">
                  <div>은행명: {branch.transferAccount?.bankName?.trim() || "-"}</div>
                  <div>계좌번호: {branch.transferAccount?.accountNumber?.trim() || "-"}</div>
                  <div>예금주: {branch.transferAccount?.accountHolder?.trim() || "-"}</div>
                </div>
              </div>
            ) : null}


            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">釉뚮옖??ID</div>
              <div className="text-[15px] text-foreground font-mono">{branch.brandId}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-[11px] text-text-tertiary mb-1">?깅줉??</div>
                <div className="text-sm text-foreground">{new Date(branch.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 스탬프 카드 설정 ── */}
      {canEdit && stampLoaded && (
        <div className="card p-6 mt-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xl">🎫</span>
            <h2 className="text-lg font-bold text-foreground m-0">스탬프 카드 설정</h2>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-10 h-6 rounded-full transition-colors ${stampActive ? "bg-foreground" : "bg-bg-tertiary border border-border"}`}
                onClick={() => setStampActive((v) => !v)}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${stampActive ? "translate-x-5" : "translate-x-1"}`}
                />
              </div>
              <span className="text-sm font-semibold text-foreground">
                스탬프 카드 {stampActive ? "활성화됨" : "비활성화됨"}
              </span>
            </label>
          </div>

          <div className="grid gap-4 mb-4">
            <div>
              <label className="block text-[13px] text-text-secondary mb-1 font-semibold">
                주문 1회당 스탬프 적립 수 (1~10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={stampPerOrder}
                onChange={(e) => setStampPerOrder(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[13px] text-text-secondary mb-1 font-semibold">
                보상 기준 스탬프 수 (2~100)
              </label>
              <input
                type="number"
                min={2}
                max={100}
                value={stampThreshold}
                onChange={(e) => setStampThreshold(Math.max(2, Math.min(100, Number(e.target.value))))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[13px] text-text-secondary mb-1 font-semibold">보상 설명</label>
              <input
                type="text"
                value={stampRewardDesc}
                onChange={(e) => setStampRewardDesc(e.target.value)}
                className="input-field w-full"
                placeholder="예: 아메리카노 무료 증정"
              />
            </div>
          </div>

          <button
            onClick={handleStampSave}
            disabled={stampSaving}
            className="btn-primary py-2.5 px-6 text-sm"
          >
            {stampSaving ? "저장 중..." : "스탬프 설정 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
