"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { HALF_HOUR_TIME_OF_DAY_OPTIONS } from "@/lib/pickup-time";
import {
  BUSINESS_HOUR_DAY_KEYS,
  BUSINESS_HOUR_DAY_LABELS,
  createBusinessHoursFormState,
  formatBusinessHoursSummary,
  serializeBusinessHoursForm,
  type BusinessHoursFormState,
  type WeeklyBusinessHours,
} from "@/lib/business-hours";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN" | "SHIPPING";
type PaymentMethod = "CARD" | "TRANSFER";

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string | null;
  isActive?: boolean;
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
  pickupTimeConfig?: {
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  businessHours?: WeeklyBusinessHours;
  orderNotice?: string | null;
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
  depositSheetName?: string | null;
  depositSheetUrl?: string | null;
};

type Brand = {
  id: string;
  slug: string | null;
};

const ALL_FULFILLMENT_TYPES: FulfillmentType[] = ["PICKUP", "DELIVERY", "DINE_IN", "SHIPPING"];
const ALL_PAYMENT_METHODS: PaymentMethod[] = ["CARD", "TRANSFER"];

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "포장",
  DELIVERY: "배달",
  DINE_IN: "매장",
  SHIPPING: "택배",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function hasBusinessHoursRows(businessHours?: WeeklyBusinessHours) {
  return formatBusinessHoursSummary(businessHours).length > 0;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-3">
      {children}
    </div>
  );
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
  const [depositSheetName, setDepositSheetName] = useState("");
  const [depositSheetUrl, setDepositSheetUrl] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("");
  const [pickupEndTime, setPickupEndTime] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHoursFormState>(
    () => createBusinessHoursFormState(),
  );
  const [orderNotice, setOrderNotice] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState("");

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
    const originPayments = branch.allowedPaymentMethods ?? ["CARD", "TRANSFER"];

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
    const samePickupTimeConfig =
      pickupStartTime.trim() === (branch.pickupTimeConfig?.startTime ?? "") &&
      pickupEndTime.trim() === (branch.pickupTimeConfig?.endTime ?? "");
    const sameBusinessHours =
      JSON.stringify(serializeBusinessHoursForm(businessHours)) ===
      JSON.stringify(branch.businessHours ?? null);
    const sameOrderNotice = orderNotice.trim() === (branch.orderNotice ?? "");
    const sameContactPhone = contactPhone.trim() === (branch.contactPhone ?? "");
    const sameKakaoChannelUrl =
      kakaoChannelUrl.trim() === (branch.kakaoChannelUrl ?? "");
    const sameDepositSheetName =
      depositSheetName.trim() === (branch.depositSheetName ?? "");
    const sameDepositSheetUrl =
      depositSheetUrl.trim() === (branch.depositSheetUrl ?? "");

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      logoUrl !== (branch.logoUrl ?? null) ||
      coverImageUrl !== (branch.coverImageUrl ?? null) ||
      !sameFulfillment ||
      !samePayments ||
      !sameTransferInfo ||
      !samePickupTimeConfig ||
      !sameBusinessHours ||
      !sameOrderNotice ||
      !sameContactPhone ||
      !sameKakaoChannelUrl ||
      !sameDepositSheetName ||
      !sameDepositSheetUrl
    );
  }, [
    allowedPaymentMethods,
    businessHours,
    branch,
    coverImageUrl,
    enabledFulfillmentTypes,
    logoUrl,
    name,
    slug,
    transferAccountHolder,
    transferAccountNumber,
    transferBankName,
    pickupEndTime,
    pickupStartTime,
    orderNotice,
    contactPhone,
    kakaoChannelUrl,
    depositSheetName,
    depositSheetUrl,
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
        : ["CARD", "TRANSFER"],
    );
    setTransferBankName(source.transferAccount?.bankName ?? "");
    setTransferAccountNumber(source.transferAccount?.accountNumber ?? "");
    setTransferAccountHolder(source.transferAccount?.accountHolder ?? "");
    setDepositSheetName(source.depositSheetName ?? "");
    setDepositSheetUrl(source.depositSheetUrl ?? "");
    setPickupStartTime(source.pickupTimeConfig?.startTime ?? "");
    setPickupEndTime(source.pickupTimeConfig?.endTime ?? "");
    setBusinessHours(
      createBusinessHoursFormState(
        source.businessHours,
        source.pickupTimeConfig ?? null,
      ),
    );
    setOrderNotice(source.orderNotice ?? "");
    setContactPhone(source.contactPhone ?? "");
    setKakaoChannelUrl(source.kakaoChannelUrl ?? "");
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

  const updateBusinessHours = <K extends keyof BusinessHoursFormState["monday"]>(
    dayKey: (typeof BUSINESS_HOUR_DAY_KEYS)[number],
    field: K,
    value: BusinessHoursFormState["monday"][K],
  ) => {
    setBusinessHours((current) => ({
      ...current,
      [dayKey]: {
        ...current[dayKey],
        [field]: value,
      },
    }));
  };

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

    if (
      allowedPaymentMethods.includes("TRANSFER") &&
      (!transferBankName.trim() ||
        !transferAccountNumber.trim() ||
        !transferAccountHolder.trim())
    ) {
      toast.error("계좌이체를 사용하려면 은행명, 계좌번호, 예금주를 모두 입력해 주세요.");
      return;
    }

    if (
      (pickupStartTime.trim() && !pickupEndTime.trim()) ||
      (!pickupStartTime.trim() && pickupEndTime.trim())
    ) {
      toast.error("픽업 가능 시작/종료 시간을 모두 입력해주세요.");
      return;
    }

    if (
      pickupStartTime.trim() &&
      pickupEndTime.trim() &&
      timeToMinutes(pickupEndTime) <= timeToMinutes(pickupStartTime)
    ) {
      toast.error("픽업 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    for (const dayKey of BUSINESS_HOUR_DAY_KEYS) {
      const day = businessHours[dayKey];
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
        depositSheetName: depositSheetName.trim() || null,
        depositSheetUrl: depositSheetUrl.trim() || null,
        orderNotice: orderNotice.trim() || null,
        contactPhone: contactPhone.trim() || null,
        kakaoChannelUrl: kakaoChannelUrl.trim() || null,
        pickupTimeConfig:
          pickupStartTime.trim() && pickupEndTime.trim()
            ? {
                startTime: pickupStartTime.trim(),
                endTime: pickupEndTime.trim(),
              }
            : null,
        businessHours: serializeBusinessHoursForm(businessHours),
      });

      setBranch(updated);
      resetForm(updated);
      setIsEditing(false);
      toast.success("지점을 수정했습니다.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "지점 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(
      `"${branch.name}" 지점을 비활성화하시겠습니까?
비활성화 후에는 주문 페이지에서 숨겨지며, 상세 화면에서 다시 활성화할 수 있습니다.`,
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/customer/branches/${branchId}`);
      setBranch((prev) => (prev ? { ...prev, isActive: false } : prev));
      toast.success("\uC9C0\uC810\uC744 \uBE44\uD65C\uC131\uD654\uD588\uC2B5\uB2C8\uB2E4.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "\uC9C0\uC810 \uBE44\uD65C\uC131\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    }
  };

  const handleReactivate = async () => {
    if (!branch) return;

    try {
      const updated = await apiClient.patch<Branch>(`/customer/branches/${branchId}`, {
        isActive: true,
      });
      setBranch(updated);
      resetForm(updated);
      toast.success("\uC9C0\uC810\uC744 \uB2E4\uC2DC \uD65C\uC131\uD654\uD588\uC2B5\uB2C8\uB2E4.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "\uC9C0\uC810 \uD65C\uC131\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
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
          뒤로 가기
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
        뒤로 가기
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold m-0 text-foreground">{"\uC9C0\uC810 \uC0C1\uC138"}</h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              branch.isActive === false
                ? "bg-neutral-500/15 text-text-secondary"
                : "bg-success/15 text-success"
            }`}
          >
            {branch.isActive === false ? "\uBE44\uD65C\uC131" : "\uC6B4\uC601\uC911"}
          </span>
        </div>
        {canEdit && !isEditing && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="py-2 px-4 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm font-semibold hover:bg-bg-secondary transition-colors"
            >
              {"\uC218\uC815\uD558\uAE30"}
            </button>
            {branch.isActive === false && (
              <button
                onClick={handleReactivate}
                className="py-2 px-4 rounded-lg border border-success bg-success/10 text-success text-sm font-semibold hover:bg-success/20 transition-colors"
              >
                {"\uB2E4\uC2DC \uD65C\uC131\uD654"}
              </button>
            )}
            <button
              onClick={handleDelete}
              className="py-2 px-4 rounded-lg border border-danger-500 bg-transparent text-danger-500 text-sm font-semibold hover:bg-danger-500/10 transition-colors"
            >
              {"\uBE44\uD65C\uC131\uD654"}
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div className="space-y-8">
            <section>
              <SectionHeading>기본 정보</SectionHeading>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] text-text-secondary mb-1.5 font-semibold">지점명</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field w-full"
                    placeholder="지점명을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-text-secondary mb-1.5 font-semibold">주문 URL (slug)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                    className="input-field w-full"
                    placeholder="예: gangnam-main"
                    pattern="[a-z0-9-]+"
                  />
                  <p className="text-xs text-text-tertiary mt-1">영문/숫자/하이픈(-)만 사용 가능합니다.</p>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading>이미지 설정</SectionHeading>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
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
            </section>

            <section>
              <SectionHeading>주문 설정</SectionHeading>
              <div className="space-y-4">
                <div>
                  <div className="text-[13px] font-semibold text-foreground mb-2">고객에게 노출할 주문 방식</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {ALL_FULFILLMENT_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer hover:bg-bg-tertiary transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={enabledFulfillmentTypes.includes(type)}
                          onChange={() => setEnabledFulfillmentTypes((prev) => toggleItem(prev, type))}
                        />
                        <span className="text-sm text-foreground">{FULFILLMENT_LABEL[type]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] font-semibold text-foreground mb-2">고객에게 노출할 결제 수단</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {ALL_PAYMENT_METHODS.map((method) => (
                      <label
                        key={method}
                        className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer hover:bg-bg-tertiary transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={allowedPaymentMethods.includes(method)}
                          onChange={() => setAllowedPaymentMethods((prev) => toggleItem(prev, method))}
                        />
                        <span className="text-sm text-foreground">{PAYMENT_LABEL[method]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading>기본 픽업 시간</SectionHeading>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={pickupStartTime}
                  onChange={(e) => setPickupStartTime(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">시작 시간 선택</option>
                  {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                    <option key={`pickup-start-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={pickupEndTime}
                  onChange={(e) => setPickupEndTime(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">종료 시간 선택</option>
                  {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                    <option key={`pickup-end-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">
                요일별 영업일을 따로 설정하지 않으면 이 시간대로 모든 날짜가 열립니다.
              </p>
            </section>

            <section>
              <SectionHeading>요일별 영업일 설정</SectionHeading>
              <div className="space-y-2">
                {BUSINESS_HOUR_DAY_KEYS.map((dayKey) => {
                  const day = businessHours[dayKey];
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
                        className="input-field w-full disabled:opacity-60"
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
                        className="input-field w-full disabled:opacity-60"
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
              <p className="text-xs text-text-tertiary mt-1.5">
                예: 월요일 휴무, 화요일 09:00~18:00, 수~일 10:00~20:00처럼 요일별로 다르게 설정할 수 있습니다.
              </p>
            </section>

            <section>
              <SectionHeading>주문창 상단 공지사항</SectionHeading>
              <textarea
                value={orderNotice}
                onChange={(e) => setOrderNotice(e.target.value)}
                className="input-field w-full min-h-[96px] resize-y py-3"
                placeholder="예: 재료 소진 시 일부 메뉴가 조기 마감될 수 있습니다."
              />
              <p className="text-xs text-text-tertiary mt-1.5">
                주문 메뉴 화면 상단에 노출되는 안내 문구입니다.
              </p>
            </section>

            <section>
              <SectionHeading>고객 문의 정보</SectionHeading>
              <div className="grid gap-2">
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="input-field w-full"
                  placeholder="문의 전화번호"
                />
                <input
                  value={kakaoChannelUrl}
                  onChange={(e) => setKakaoChannelUrl(e.target.value)}
                  className="input-field w-full"
                  placeholder="https://pf.kakao.com/_example/chat"
                />
                <input
                  value={depositSheetName}
                  onChange={(e) => setDepositSheetName(e.target.value)}
                  className="input-field w-full"
                  placeholder="입금기록 시트명 (예: 시트1)"
                />
                <input
                  value={depositSheetUrl}
                  onChange={(e) => setDepositSheetUrl(e.target.value)}
                  className="input-field w-full"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">
                공개 주문 페이지와 주문 조회 페이지에 노출되는 문의 수단입니다.
              </p>
            </section>

            {allowedPaymentMethods.includes("TRANSFER") && (
              <section>
                <SectionHeading>계좌이체 입금 정보</SectionHeading>
                <div className="grid gap-2">
                  <input
                    value={transferBankName}
                    onChange={(e) => setTransferBankName(e.target.value)}
                    className="input-field w-full"
                    placeholder="은행명"
                  />
                  <input
                    value={transferAccountNumber}
                    onChange={(e) => setTransferAccountNumber(e.target.value)}
                    className="input-field w-full"
                    placeholder="계좌번호"
                  />
                  <input
                    value={transferAccountHolder}
                    onChange={(e) => setTransferAccountHolder(e.target.value)}
                    className="input-field w-full"
                    placeholder="예금주"
                  />
                </div>
              </section>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setIsEditing(false);
                  resetForm(branch);
                }}
                disabled={saving}
                className="py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm font-medium cursor-pointer hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="btn-primary py-2.5 px-6 text-sm"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {branch.coverImageUrl && (
              <div className="mb-6 -mx-6 -mt-6 overflow-hidden rounded-t-xl">
                <Image
                  src={branch.coverImageUrl}
                  alt="커버 이미지"
                  width={1200}
                  height={675}
                  className="h-44 w-full object-cover md:h-56"
                />
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              {branch.logoUrl ? (
                <Image
                  src={branch.logoUrl}
                  alt={branch.name}
                  width={72}
                  height={72}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-bg-tertiary flex items-center justify-center text-[36px] flex-shrink-0">
                  🏪
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{branch.name}</h2>
                {branch.myRole && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-bg-tertiary border border-border text-text-secondary">
                    {branch.myRole}
                  </span>
                )}
              </div>
            </div>

            <section className="mb-6">
              <SectionHeading>기본 정보</SectionHeading>
              <div>
                <div className="text-[13px] text-text-secondary mb-1.5">주문 URL</div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border min-w-0">
                  <span className="font-mono text-sm text-foreground break-all flex-1 min-w-0">{orderUrl}</span>
                  <button
                    type="button"
                    title="복사"
                    onClick={() => {
                      void navigator.clipboard.writeText(orderUrl);
                      toast.success("URL이 복사됐습니다.");
                    }}
                    className="shrink-0 text-xs text-text-tertiary hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border bg-bg-secondary"
                  >
                    복사
                  </button>
                </div>
              </div>
            </section>

            <section className="mb-6">
              <SectionHeading>주문 설정</SectionHeading>
              <div className="space-y-4">
                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">주문 방식</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(branch.enabledFulfillmentTypes ?? ["PICKUP"]).map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg-tertiary border border-border text-foreground"
                      >
                        {FULFILLMENT_LABEL[item]}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">결제 수단</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(branch.allowedPaymentMethods ?? ["CARD", "TRANSFER"]).map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg-tertiary border border-border text-foreground"
                      >
                        {PAYMENT_LABEL[item]}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">주문창 상단 공지사항</div>
                  <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm text-foreground whitespace-pre-wrap">
                    {branch.orderNotice?.trim() || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">고객 문의 전화번호</div>
                  <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm text-foreground">
                    {branch.contactPhone?.trim() || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">카카오톡 상담 URL</div>
                  <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm text-foreground break-all">
                    {branch.kakaoChannelUrl?.trim() || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">기본 픽업 시간</div>
                  <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm text-foreground">
                    {branch.pickupTimeConfig?.startTime && branch.pickupTimeConfig?.endTime
                      ? `${branch.pickupTimeConfig.startTime} - ${branch.pickupTimeConfig.endTime}`
                      : "-"}
                  </div>
                </div>

                <div>
                  <div className="text-[13px] text-text-secondary mb-1.5">요일별 영업일</div>
                  <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border space-y-1">
                    {hasBusinessHoursRows(branch.businessHours) ? (
                      formatBusinessHoursSummary(branch.businessHours).map((line) => (
                        <div key={line} className="text-sm text-foreground">
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-foreground">-</div>
                    )}
                  </div>
                </div>

                {(branch.allowedPaymentMethods ?? []).includes("TRANSFER") && (
                  <div>
                    <div className="text-[13px] text-text-secondary mb-1.5">계좌이체 입금 정보</div>
                    <div className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-tertiary w-16 shrink-0">은행명</span>
                        <span className="text-foreground">{branch.transferAccount?.bankName?.trim() || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-tertiary w-16 shrink-0">계좌번호</span>
                        <span className="text-foreground font-mono">{branch.transferAccount?.accountNumber?.trim() || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-tertiary w-16 shrink-0">예금주</span>
                        <span className="text-foreground">{branch.transferAccount?.accountHolder?.trim() || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-tertiary w-16 shrink-0">시트명</span>
                        <span className="text-foreground">{branch.depositSheetName?.trim() || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-tertiary w-16 shrink-0">?쒗듃留곹겕</span>
                        <span className="text-foreground break-all">{branch.depositSheetUrl?.trim() || "-"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-1">
              <div className="text-[12px] text-text-tertiary">
                생성일: {new Date(branch.createdAt).toLocaleString("ko-KR")}
              </div>
              <div className="text-[12px] text-text-tertiary font-mono truncate">
                ID: {branch.brandId}
              </div>
            </div>
          </div>
        )}
      </div>

      {canEdit && stampLoaded && (
        <div className="card p-6 mt-6">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="text-xl">🎫</span>
            <h2 className="text-lg font-bold text-foreground m-0">스탬프 카드 설정</h2>
          </div>

          <section className="mb-6">
            <SectionHeading>활성 여부</SectionHeading>
            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <div
                className={`relative w-10 h-6 rounded-full transition-colors ${stampActive ? "bg-foreground" : "bg-bg-tertiary border border-border"}`}
                onClick={() => setStampActive((v) => !v)}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${stampActive ? "translate-x-5" : "translate-x-1"}`}
                />
              </div>
              <span className="text-sm font-semibold text-foreground">
                {stampActive ? "활성화됨" : "비활성화됨"}
              </span>
            </label>
          </section>

          <section className="mb-6">
            <SectionHeading>적립 설정</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] text-text-secondary mb-1.5 font-semibold">
                  주문 1회당 적립 스탬프 수 (1~10)
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
                <label className="block text-[13px] text-text-secondary mb-1.5 font-semibold">
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
            </div>
          </section>

          <section className="mb-6">
            <SectionHeading>보상 설정</SectionHeading>
            <div>
              <label className="block text-[13px] text-text-secondary mb-1.5 font-semibold">보상 설명</label>
              <input
                type="text"
                value={stampRewardDesc}
                onChange={(e) => setStampRewardDesc(e.target.value)}
                className="input-field w-full"
                placeholder="예: 아메리카노 무료 증정"
              />
            </div>
          </section>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={handleStampSave}
              disabled={stampSaving}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              {stampSaving ? "저장 중..." : "스탬프 설정 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
