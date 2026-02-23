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
  PICKUP: "?ъ옣",
  DELIVERY: "諛곕떖",
  DINE_IN: "留ㅼ옣",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: "移대뱶",
  TRANSFER: "怨꾩쥖?댁껜",
  CASH: "?꾧툑",
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

    return (
      name.trim() !== branch.name ||
      slug.trim() !== (branch.slug ?? "") ||
      !sameFulfillment ||
      !samePayments ||
      !sameTransferInfo
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
        selectBranch(data.id);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "留ㅼ옣 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
        setMembersError(err?.message ?? "留ㅼ옣 硫ㅻ쾭瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
  };

  const handleSave = async () => {
    if (!branch) return;

    if (!name.trim()) {
      toast.error("留ㅼ옣紐낆쓣 ?낅젰?섏꽭??");
      return;
    }

    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      toast.error("二쇰Ц URL 媛믪쓣 ?낅젰?섏꽭??");
      return;
    }

    if (!isValidSlug(normalizedSlug)) {
      toast.error("二쇰Ц URL? ?곷Ц/?レ옄/?섏씠??-)留??ъ슜?????덉뒿?덈떎.");
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

      toast.success("留ㅼ옣 ?ㅼ젙????ν뻽?듬땲??");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "留ㅼ옣 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    const confirmed = confirm(`"${branch.name}" 留ㅼ옣????젣?좉퉴??\n??젣 ??蹂듦뎄?????놁뒿?덈떎.`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      await apiClient.delete(`/admin/branches/${branch.id}`);
      router.replace("/admin/stores");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "留ㅼ옣 ??젣???ㅽ뙣?덉뒿?덈떎.");
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
          ??留ㅼ옣 紐⑸줉?쇰줈 ?뚯븘媛湲?
        </Link>
        <h1 className="text-[22px] font-extrabold mt-2 text-foreground">{branch?.name ?? "留ㅼ옣 ?곸꽭"}</h1>
        <p className="text-text-secondary mt-1 text-[13px]">
          {branch ? buildOrderUrl(brandSlug, branch.slug, branch.id) : "-"}
        </p>
      </div>

      {loading && <p className="text-text-tertiary">遺덈윭?ㅻ뒗 以?..</p>}
      {error && <p className="text-danger-500">{error}</p>}

      {!loading && branch && (
        <div className="grid gap-3">
          <div className="card p-4">
            <div className="text-xs text-text-secondary">留ㅼ옣 湲곕낯 ?뺣낫</div>
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
                <label className="block mb-1.5 text-xs text-text-secondary">二쇰Ц URL</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                  className="input-field w-full"
                  placeholder="?? gangnam-main"
                />
                <div className="text-xs text-text-tertiary mt-1.5">
                  ?곷Ц/?レ옄/?섏씠??-)留?媛?ν빀?덈떎.
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">留ㅼ옣 ID</label>
                <div className="text-[13px] text-foreground font-mono">{branch.id}</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">생성일</label>
                <div className="text-[13px] text-foreground">{formatDateTime(branch.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">二쇰Ц ?ㅼ젙</div>

            <div className="mt-3">
              <div className="text-[13px] font-semibold text-foreground mb-2">?뚮퉬?먯뿉寃??몄텧??二쇰Ц 諛⑹떇</div>
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
              <div className="text-[13px] font-semibold text-foreground mb-2">?뚮퉬?먯뿉寃??몄텧??寃곗젣 ?섎떒</div>
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
              <div className="mt-1.5 text-xs text-text-tertiary">
                怨꾩쥖?댁껜 寃곗젣 ?붾㈃???몄텧?섎뒗 ?뺣낫?낅땲??
              </div>
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
                蹂寃?痍⑥냼
              </button>
              <button
                className="h-9 px-4 rounded-lg border border-danger-500 bg-transparent text-danger-500 font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "??젣 以?.." : "留ㅼ옣 ??젣"}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-text-secondary">留ㅼ옣 硫ㅻ쾭</div>
            {membersLoading && <p className="text-text-tertiary mt-2">遺덈윭?ㅻ뒗 以?..</p>}
            {membersError && <p className="text-danger-500 mt-2">{membersError}</p>}
            {!membersLoading && !membersError && members.length === 0 && (
              <p className="text-text-tertiary mt-2">?깅줉??硫ㅻ쾭媛 ?놁뒿?덈떎.</p>
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
                      {member.role} 쨌 {member.status}
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
