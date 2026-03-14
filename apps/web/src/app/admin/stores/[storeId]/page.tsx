"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";
type PaymentMethod = "CARD" | "TRANSFER" | "CASH";

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string | null;
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
};

type Brand = {
  id: string;
  slug?: string | null;
};

type BranchMember = {
  id?: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: string;
  status: string;
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

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/.test(value);
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDateTime(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
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

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { brandId, ready } = useSelectedBrand();
  const { selectBranch } = useSelectedBranch();

  const storeId = (params?.storeId as string) ?? "";

  const [branch, setBranch] = useState<Branch | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<FulfillmentType[]>(["PICKUP"]);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<PaymentMethod[]>(["CARD"]);
  const [transferBankName, setTransferBankName] = useState("");
  const [transferAccountNumber, setTransferAccountNumber] = useState("");
  const [transferAccountHolder, setTransferAccountHolder] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("");
  const [pickupEndTime, setPickupEndTime] = useState("");

  const [members, setMembers] = useState<BranchMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!branch) return false;

    const branchFulfillment = branch.enabledFulfillmentTypes ?? ["PICKUP"];
    const branchPayments = branch.allowedPaymentMethods ?? ["CARD", "TRANSFER", "CASH"];

    const sameFulfillment =
      enabledFulfillmentTypes.length === branchFulfillment.length &&
      enabledFulfillmentTypes.every((item) => branchFulfillment.includes(item));

    const samePayments =
      allowedPaymentMethods.length === branchPayments.length &&
      allowedPaymentMethods.every((item) => branchPayments.includes(item));
    const sameTransferInfo =
      transferBankName.trim() === (branch.transferAccount?.bankName ?? "") &&
      transferAccountNumber.trim() === (branch.transferAccount?.accountNumber ?? "") &&
      transferAccountHolder.trim() === (branch.transferAccount?.accountHolder ?? "");
    const samePickupTimeConfig =
      pickupStartTime.trim() === (branch.pickupTimeConfig?.startTime ?? "") &&
      pickupEndTime.trim() === (branch.pickupTimeConfig?.endTime ?? "");

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      !sameFulfillment ||
      !samePayments ||
      !sameTransferInfo ||
      !samePickupTimeConfig
    );
  }, [
    allowedPaymentMethods,
    branch,
    enabledFulfillmentTypes,
    name,
    slug,
    transferAccountHolder,
    transferAccountNumber,
    transferBankName,
    pickupEndTime,
    pickupStartTime,
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
        setAllowedPaymentMethods(
          data.allowedPaymentMethods && data.allowedPaymentMethods.length > 0
            ? data.allowedPaymentMethods
            : ["CARD", "TRANSFER", "CASH"],
        );
        setTransferBankName(data.transferAccount?.bankName ?? "");
        setTransferAccountNumber(data.transferAccount?.accountNumber ?? "");
        setTransferAccountHolder(data.transferAccount?.accountHolder ?? "");
        setPickupStartTime(data.pickupTimeConfig?.startTime ?? "");
        setPickupEndTime(data.pickupTimeConfig?.endTime ?? "");
        selectBranch(data.id);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "매장 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadBranch();
  }, [storeId, brandId, ready, router, selectBranch]);

  useEffect(() => {
    if (!ready || !brandId) return;

    const loadBrandSlug = async () => {
      try {
        const brands = await apiClient.get<Brand[]>("/admin/brands");
        const current = brands.find((item) => item.id === brandId);
        setBrandSlug(current?.slug ?? null);
      } catch {
        setBrandSlug(null);
      }
    };

    loadBrandSlug();
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
        setMembersError(err?.message ?? "매장 멤버를 불러오지 못했습니다.");
      } finally {
        setMembersLoading(false);
      }
    };

    loadMembers();
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
    setAllowedPaymentMethods(
      branch.allowedPaymentMethods && branch.allowedPaymentMethods.length > 0
        ? branch.allowedPaymentMethods
        : ["CARD", "TRANSFER", "CASH"],
    );
    setTransferBankName(branch.transferAccount?.bankName ?? "");
    setTransferAccountNumber(branch.transferAccount?.accountNumber ?? "");
    setTransferAccountHolder(branch.transferAccount?.accountHolder ?? "");
    setPickupStartTime(branch.pickupTimeConfig?.startTime ?? "");
    setPickupEndTime(branch.pickupTimeConfig?.endTime ?? "");
  };

  const handleSave = async () => {
    if (!branch) return;

    if (!name.trim()) {
      toast.error("매장명을 입력하세요.");
      return;
    }

    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      toast.error("주문 URL 값을 입력하세요.");
      return;
    }

    if (!isValidSlug(normalizedSlug)) {
      toast.error("주문 URL은 영문/숫자/하이픈(-)만 사용할 수 있습니다.");
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
      toast.error("픽업 가능 시간의 시작/종료 시간을 모두 입력해 주세요.");
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

    try {
      setSaving(true);
      const updated = await apiClient.patch<Branch>(`/admin/branches/${branch.id}`, {
        name: name.trim(),
        slug: normalizedSlug,
        enabledFulfillmentTypes,
        allowedPaymentMethods,
        transferAccount: {
          bankName: transferBankName.trim(),
          accountNumber: transferAccountNumber.trim(),
          accountHolder: transferAccountHolder.trim(),
        },
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
      setAllowedPaymentMethods(
        updated.allowedPaymentMethods && updated.allowedPaymentMethods.length > 0
          ? updated.allowedPaymentMethods
          : ["CARD", "TRANSFER", "CASH"],
      );
      setTransferBankName(updated.transferAccount?.bankName ?? "");
      setTransferAccountNumber(updated.transferAccount?.accountNumber ?? "");
      setTransferAccountHolder(updated.transferAccount?.accountHolder ?? "");
      setPickupStartTime(updated.pickupTimeConfig?.startTime ?? "");
      setPickupEndTime(updated.pickupTimeConfig?.endTime ?? "");

      toast.success("매장을 수정했습니다.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "매장 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(`"${branch.name}" 매장을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      await apiClient.delete(`/admin/branches/${branch.id}`);
      router.replace("/admin/stores");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "매장 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  if (!ready) return null;
  if (!brandId) return null;

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/stores" className="text-text-secondary text-xs hover:text-foreground transition-colors">
          매장 목록으로 돌아가기
        </Link>
        <h1 className="text-[22px] font-extrabold mt-2 text-foreground">{branch?.name ?? "매장 상세"}</h1>
        <p className="text-text-secondary mt-1 text-[13px]">
          {branch ? buildOrderUrl(brandSlug, branch.slug, branch.id) : "-"}
        </p>
      </div>

      {loading && <p className="text-text-tertiary">불러오는 중...</p>}
      {error && <p className="text-danger-500">{error}</p>}

      {!loading && branch && (
        <div className="grid gap-3">
          <div className="card p-4">
            <div className="text-xs text-text-secondary">매장 기본 정보</div>
            <div className="mt-2 grid gap-2.5">
              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">매장명</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full"
                  placeholder="매장명을 입력하세요"
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
                <div className="text-xs text-text-tertiary mt-1.5">영문/숫자/하이픈(-)만 가능합니다.</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">매장 ID</label>
                <div className="text-[13px] text-foreground font-mono">{branch.id}</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">생성일</label>
                <div className="text-[13px] text-foreground">{formatDateTime(branch.createdAt)}</div>
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
              <div className="text-[13px] font-semibold text-foreground mb-2">고객에게 노출할 결제 수단</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {ALL_PAYMENT_METHODS.map((method) => {
                  const checked = allowedPaymentMethods.includes(method);
                  return (
                    <label
                      key={method}
                      className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-bg-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setAllowedPaymentMethods((prev) => toggleItem(prev, method))}
                      />
                      <span className="text-sm text-foreground">{PAYMENT_LABEL[method]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">픽업 가능 시간</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="time"
                  step={1800}
                  value={pickupStartTime}
                  onChange={(e) => setPickupStartTime(e.target.value)}
                  className="input-field w-full"
                />
                <input
                  type="time"
                  step={1800}
                  value={pickupEndTime}
                  onChange={(e) => setPickupEndTime(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="mt-1.5 text-xs text-text-tertiary">
                30분 단위로 고객이 선택할 수 있는 픽업 시간을 설정합니다.
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-foreground mb-2">계좌이체 입금 정보</div>
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
              <div className="mt-1.5 text-xs text-text-tertiary">계좌이체 결제 화면에 노출되는 정보입니다.</div>
            </div>
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
                {deleting ? "삭제 중..." : "매장 삭제"}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">매장 멤버</div>
            {membersLoading && <p className="text-text-tertiary mt-2">불러오는 중...</p>}
            {membersError && <p className="text-danger-500 mt-2">{membersError}</p>}
            {!membersLoading && !membersError && members.length === 0 && (
              <p className="text-text-tertiary mt-2">등록된 멤버가 없습니다.</p>
            )}
            {!membersLoading && members.length > 0 && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
