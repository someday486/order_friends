"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { HALF_HOUR_TIME_OF_DAY_OPTIONS } from "@/lib/pickup-time";
import {
  getBillingTierCheckoutDescription,
  getBillingTierLabel,
  isManualTransferTier,
  resolveBillingTier,
} from "@/lib/billing-tier";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import { type FulfillmentType } from "@/types/common";

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string | null;
  createdAt: string;
  enabledFulfillmentTypes?: FulfillmentType[];
  allowedPaymentMethods?: string[];
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  pickupTimeConfig?: {
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  orderNotice?: string | null;
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
  depositSheetName?: string | null;
  depositSheetUrl?: string | null;
};

type Brand = {
  id: string;
  slug?: string | null;
  billingTier?: "PG" | "NON_PG" | null;
};

type BranchMember = {
  id?: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: string;
  status: string;
};

const ALL_FULFILLMENT_TYPES: FulfillmentType[] = ["PICKUP", "DELIVERY", "DINE_IN", "SHIPPING"];

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "포장",
  DELIVERY: "배달",
  DINE_IN: "직접 수령",
  SHIPPING: "택배",
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

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/.test(value);
}

function buildOrderUrl(brandSlug: string | null, branchSlug: string | null | undefined, branchId: string) {
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

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { brandId, ready } = useSelectedBrand();
  const { selectBranch } = useSelectedBranch();

  const storeId = (params?.storeId as string) ?? "";

  const [branch, setBranch] = useState<Branch | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [brandBillingTier, setBrandBillingTier] = useState<Brand["billingTier"]>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<FulfillmentType[]>(["PICKUP"]);
  const [transferBankName, setTransferBankName] = useState("");
  const [transferAccountNumber, setTransferAccountNumber] = useState("");
  const [transferAccountHolder, setTransferAccountHolder] = useState("");
  const [depositSheetName, setDepositSheetName] = useState("");
  const [depositSheetUrl, setDepositSheetUrl] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("");
  const [pickupEndTime, setPickupEndTime] = useState("");
  const [orderNotice, setOrderNotice] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState("");

  const [members, setMembers] = useState<BranchMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  const effectiveBillingTier = useMemo(
    () => resolveBillingTier(brandBillingTier, branch?.allowedPaymentMethods ?? null),
    [brandBillingTier, branch?.allowedPaymentMethods],
  );
  const isTransferEnabled = isManualTransferTier(effectiveBillingTier);

  const isDirty = useMemo(() => {
    if (!branch) return false;

    const branchFulfillment = branch.enabledFulfillmentTypes ?? ["PICKUP"];
    const sameFulfillment =
      enabledFulfillmentTypes.length === branchFulfillment.length &&
      enabledFulfillmentTypes.every((item) => branchFulfillment.includes(item));
    const sameTransferInfo =
      transferBankName.trim() === (branch.transferAccount?.bankName ?? "") &&
      transferAccountNumber.trim() === (branch.transferAccount?.accountNumber ?? "") &&
      transferAccountHolder.trim() === (branch.transferAccount?.accountHolder ?? "");
    const samePickupTimeConfig =
      pickupStartTime.trim() === (branch.pickupTimeConfig?.startTime ?? "") &&
      pickupEndTime.trim() === (branch.pickupTimeConfig?.endTime ?? "");
    const sameOrderNotice = orderNotice.trim() === (branch.orderNotice ?? "");
    const sameContactPhone = contactPhone.trim() === (branch.contactPhone ?? "");
    const sameKakaoChannelUrl = kakaoChannelUrl.trim() === (branch.kakaoChannelUrl ?? "");
    const sameDepositSheetName = depositSheetName.trim() === (branch.depositSheetName ?? "");
    const sameDepositSheetUrl = depositSheetUrl.trim() === (branch.depositSheetUrl ?? "");

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      !sameFulfillment ||
      !sameTransferInfo ||
      !samePickupTimeConfig ||
      !sameOrderNotice ||
      !sameContactPhone ||
      !sameKakaoChannelUrl ||
      !sameDepositSheetName ||
      !sameDepositSheetUrl
    );
  }, [
    branch,
    contactPhone,
    depositSheetName,
    depositSheetUrl,
    enabledFulfillmentTypes,
    kakaoChannelUrl,
    name,
    orderNotice,
    pickupEndTime,
    pickupStartTime,
    slug,
    transferAccountHolder,
    transferAccountNumber,
    transferBankName,
  ]);

  useEffect(() => {
    if (!ready) return;
    if (!brandId) {
      router.replace("/admin/brand");
      return;
    }

    const loadBranch = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch>(`/admin/branches/${storeId}`);
        setBranch(data);
        setName(data.name ?? "");
        setSlug(data.slug ?? "");
        setEnabledFulfillmentTypes(
          data.enabledFulfillmentTypes && data.enabledFulfillmentTypes.length > 0
            ? data.enabledFulfillmentTypes
            : ["PICKUP"],
        );
        setTransferBankName(data.transferAccount?.bankName ?? "");
        setTransferAccountNumber(data.transferAccount?.accountNumber ?? "");
        setTransferAccountHolder(data.transferAccount?.accountHolder ?? "");
        setDepositSheetName(data.depositSheetName ?? "");
        setDepositSheetUrl(data.depositSheetUrl ?? "");
        setPickupStartTime(data.pickupTimeConfig?.startTime ?? "");
        setPickupEndTime(data.pickupTimeConfig?.endTime ?? "");
        setOrderNotice(data.orderNotice ?? "");
        setContactPhone(data.contactPhone ?? "");
        setKakaoChannelUrl(data.kakaoChannelUrl ?? "");
        selectBranch(data.id);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "스토어/출고지 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadBranch();
  }, [brandId, ready, router, selectBranch, storeId]);

  useEffect(() => {
    if (!ready || !brandId) return;

    const loadBrands = async () => {
      try {
        const brands = await apiClient.get<Brand[]>("/admin/brands");
        const current = brands.find((item) => item.id === brandId);
        setBrandSlug(current?.slug ?? null);
        setBrandBillingTier(current?.billingTier ?? null);
      } catch {
        setBrandSlug(null);
        setBrandBillingTier(null);
      }
    };

    void loadBrands();
  }, [brandId, ready]);

  useEffect(() => {
    if (!branch?.id) return;

    const loadMembers = async () => {
      try {
        setMembersLoading(true);
        setMembersError(null);
        const data = await apiClient.get<BranchMember[]>(`/admin/members/branch/${branch.id}`);
        setMembers(data);
      } catch (e: unknown) {
        const err = e as Error;
        setMembersError(err?.message ?? "스토어 멤버를 불러오지 못했습니다.");
      } finally {
        setMembersLoading(false);
      }
    };

    void loadMembers();
  }, [branch?.id]);

  const handleReset = () => {
    if (!branch) return;
    setName(branch.name ?? "");
    setSlug(branch.slug ?? "");
    setEnabledFulfillmentTypes(
      branch.enabledFulfillmentTypes && branch.enabledFulfillmentTypes.length > 0
        ? branch.enabledFulfillmentTypes
        : ["PICKUP"],
    );
    setTransferBankName(branch.transferAccount?.bankName ?? "");
    setTransferAccountNumber(branch.transferAccount?.accountNumber ?? "");
    setTransferAccountHolder(branch.transferAccount?.accountHolder ?? "");
    setDepositSheetName(branch.depositSheetName ?? "");
    setDepositSheetUrl(branch.depositSheetUrl ?? "");
    setPickupStartTime(branch.pickupTimeConfig?.startTime ?? "");
    setPickupEndTime(branch.pickupTimeConfig?.endTime ?? "");
    setOrderNotice(branch.orderNotice ?? "");
    setContactPhone(branch.contactPhone ?? "");
    setKakaoChannelUrl(branch.kakaoChannelUrl ?? "");
  };

  const handleSave = async () => {
    if (!branch) return;

    if (!name.trim()) {
      toast.error("스토어/출고지명을 입력해 주세요.");
      return;
    }

    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      toast.error("주문 URL 값을 입력해 주세요.");
      return;
    }

    if (!isValidSlug(normalizedSlug)) {
      toast.error("주문 URL은 영문, 숫자, 하이픈(-)만 사용할 수 있습니다.");
      return;
    }

    if (enabledFulfillmentTypes.length === 0) {
      toast.error("주문 방식은 최소 1개 이상 선택해 주세요.");
      return;
    }

    if (
      isTransferEnabled &&
      (!transferBankName.trim() || !transferAccountNumber.trim() || !transferAccountHolder.trim())
    ) {
      toast.error("무통장 입금을 사용하려면 은행명, 계좌번호, 예금주를 모두 입력해 주세요.");
      return;
    }

    if (
      (pickupStartTime.trim() && !pickupEndTime.trim()) ||
      (!pickupStartTime.trim() && pickupEndTime.trim())
    ) {
      toast.error("영업 가능 시간은 시작/종료 시간을 모두 입력해 주세요.");
      return;
    }

    if (
      pickupStartTime.trim() &&
      pickupEndTime.trim() &&
      timeToMinutes(pickupEndTime) <= timeToMinutes(pickupStartTime)
    ) {
      toast.error("영업 종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    try {
      setSaving(true);
      const updated = await apiClient.patch<Branch>(`/admin/branches/${branch.id}`, {
        name: name.trim(),
        slug: normalizedSlug,
        enabledFulfillmentTypes,
        transferAccount: isTransferEnabled
          ? {
              bankName: transferBankName.trim(),
              accountNumber: transferAccountNumber.trim(),
              accountHolder: transferAccountHolder.trim(),
            }
          : {
              bankName: null,
              accountNumber: null,
              accountHolder: null,
            },
        depositSheetName: isTransferEnabled ? depositSheetName.trim() || null : null,
        depositSheetUrl: isTransferEnabled ? depositSheetUrl.trim() || null : null,
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
      });

      setBranch(updated);
      setName(updated.name ?? "");
      setSlug(updated.slug ?? "");
      setEnabledFulfillmentTypes(
        updated.enabledFulfillmentTypes && updated.enabledFulfillmentTypes.length > 0
          ? updated.enabledFulfillmentTypes
          : ["PICKUP"],
      );
      setTransferBankName(updated.transferAccount?.bankName ?? "");
      setTransferAccountNumber(updated.transferAccount?.accountNumber ?? "");
      setTransferAccountHolder(updated.transferAccount?.accountHolder ?? "");
      setDepositSheetName(updated.depositSheetName ?? "");
      setDepositSheetUrl(updated.depositSheetUrl ?? "");
      setPickupStartTime(updated.pickupTimeConfig?.startTime ?? "");
      setPickupEndTime(updated.pickupTimeConfig?.endTime ?? "");
      setOrderNotice(updated.orderNotice ?? "");
      setContactPhone(updated.contactPhone ?? "");
      setKakaoChannelUrl(updated.kakaoChannelUrl ?? "");
      toast.success("스토어 설정을 저장했습니다.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "스토어 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(`"${branch.name}" 스토어/출고지를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      await apiClient.delete(`/admin/branches/${branch.id}`);
      router.replace("/admin/stores");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "스토어/출고지 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  if (!ready || !brandId) {
    return null;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/stores" className="text-text-secondary text-xs hover:text-foreground transition-colors">
          스토어 목록으로 돌아가기
        </Link>
        <h1 className="text-[22px] font-extrabold mt-2 text-foreground">{branch?.name ?? "스토어 상세"}</h1>
        <p className="text-text-secondary mt-1 text-[13px]">
          {branch ? buildOrderUrl(brandSlug, branch.slug, branch.id) : "-"}
        </p>
        <p className="mt-1 text-[13px] font-semibold text-text-secondary">
          결제 운영 방식: {getBillingTierLabel(effectiveBillingTier)}
        </p>
      </div>

      {loading && <p className="text-text-tertiary">불러오는 중...</p>}
      {error && <p className="text-danger-500">{error}</p>}

      {!loading && branch ? (
        <div className="grid gap-3">
          <div className="card p-4">
            <div className="text-xs text-text-secondary">스토어 기본 정보</div>
            <div className="mt-2 grid gap-2.5">
              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">스토어/출고지명</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full"
                  placeholder="스토어 또는 출고지명을 입력해 주세요."
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">주문 URL</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                  className="input-field w-full"
                  placeholder="예: gangnam-main"
                />
                <div className="text-xs text-text-tertiary mt-1.5">영문, 숫자, 하이픈(-)만 사용할 수 있습니다.</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">스토어 ID</label>
                <div className="text-[13px] text-foreground font-mono">{branch.id}</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">생성일</label>
                <div className="text-[13px] text-foreground">{formatDateTime(branch.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">입금기록 시트 설정</div>
            <div className="mt-2.5 grid gap-2">
              <input
                value={depositSheetName}
                onChange={(e) => setDepositSheetName(e.target.value)}
                className="input-field w-full"
                placeholder="입금기록 시트명 (예: 시트1)"
                disabled={!isTransferEnabled}
              />
              <input
                value={depositSheetUrl}
                onChange={(e) => setDepositSheetUrl(e.target.value)}
                className="input-field w-full"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={!isTransferEnabled}
              />
              <div className="text-xs text-text-tertiary">
                {isTransferEnabled
                  ? "무통장 입금 주문의 자동 매칭에 사용하는 구글 시트 정보입니다."
                  : "PG 이용 브랜드는 무통장 입금 시트 설정을 사용하지 않습니다."}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">주문 설정</div>

            <div className="mt-3">
              <div className="text-[13px] font-semibold text-foreground mb-2">고객에게 노출할 주문 방식</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ALL_FULFILLMENT_TYPES.map((type) => {
                  const checked = enabledFulfillmentTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEnabledFulfillmentTypes((prev) => toggleItem(prev, type))}
                      />
                      <span className="text-sm text-foreground">{FULFILLMENT_LABEL[type]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">고객에게 노출될 결제 운영 방식</div>
              <div className="rounded-xl border border-border bg-bg-secondary px-3 py-3 text-sm text-text-secondary">
                <div className="font-semibold text-foreground">{getBillingTierLabel(effectiveBillingTier)}</div>
                <div className="mt-1">{getBillingTierCheckoutDescription(effectiveBillingTier)}</div>
                <div className="mt-2 text-xs">
                  결제 방식은 브랜드 정책에 따라 자동으로 결정되며, 스토어 화면에서는 직접 변경하지 않습니다.
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">영업 가능 시간</div>
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
              <div className="mt-1.5 text-xs text-text-tertiary">
                30분 단위로 고객이 선택할 수 있는 영업 시간을 설정합니다.
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">주문창 상단 공지사항</div>
              <textarea
                value={orderNotice}
                onChange={(e) => setOrderNotice(e.target.value)}
                className="input-field w-full min-h-[96px] resize-y py-3"
                placeholder="예: 포장은 20분 전에 미리 주문해 주세요."
              />
              <div className="mt-1.5 text-xs text-text-tertiary">
                주문 메뉴 상단에 고객에게 보여줄 안내 문구입니다.
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">고객 문의 정보</div>
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
              </div>
              <div className="mt-1.5 text-xs text-text-tertiary">
                온라인샵 주문 링크와 주문 조회 페이지에 노출되는 문의 정보입니다.
              </div>
            </div>

            {isTransferEnabled ? (
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-foreground mb-2">무통장 입금 정보</div>
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
                <div className="mt-1.5 text-xs text-text-tertiary">
                  무통장 입금 주문 화면에 노출되는 정보입니다.
                </div>
              </div>
            ) : null}
          </div>

          <div className="card p-4">
            <div className="flex gap-2">
              <button
                className="btn-primary h-9 px-4 text-[13px]"
                onClick={handleSave}
                disabled={saving || deleting || !isDirty}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
                onClick={handleReset}
                disabled={saving || deleting || !isDirty}
              >
                변경 취소
              </button>
              <button
                className="h-9 px-4 rounded-lg border border-danger-500 bg-transparent text-danger-500 font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "삭제 중..." : "스토어 삭제"}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">스토어 멤버</div>
            {membersLoading && <p className="text-text-tertiary mt-2">불러오는 중...</p>}
            {membersError && <p className="text-danger-500 mt-2">{membersError}</p>}
            {!membersLoading && !membersError && members.length === 0 ? (
              <p className="text-text-tertiary mt-2">등록된 멤버가 없습니다.</p>
            ) : null}
            {!membersLoading && members.length > 0 ? (
              <div className="mt-2 grid gap-1.5">
                {members.map((member) => (
                  <div
                    key={member.id ?? member.userId}
                    className="flex items-center justify-between py-2.5 px-3 border border-border rounded-lg bg-bg-secondary"
                  >
                    <div>
                      <div className="text-[13px] text-foreground">
                        {member.displayName ?? member.email ?? member.userId}
                      </div>
                      <div className="text-xs text-text-tertiary">{member.userId}</div>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {member.role} / {member.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
