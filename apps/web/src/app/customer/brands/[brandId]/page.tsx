"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AddressSearchFields } from "@/components/order/AddressSearchFields";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { apiClient } from "@/lib/api-client";
import { parseApiErrorMessage } from "@/lib/api-error";
import {
  formatBusinessNumberInput,
  formatCashReceiptProvider,
} from "@/lib/format";

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  biz_name: string | null;
  biz_reg_no: string | null;
  rep_name: string | null;
  address: string | null;
  biz_cert_url: string | null;
  bizCertUrl?: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  cash_receipt_enabled: boolean | null;
  cash_receipt_provider: string | null;
  cash_receipt_merchant_id: string | null;
  cash_receipt_issue_timing: string | null;
  cash_receipt_self_issue_enabled: boolean | null;
  cash_receipt_contact_name: string | null;
  cash_receipt_contact_phone: string | null;
  myRole: string;
  created_at: string;
};

type BrandFormData = {
  name: string;
  slug: string;
  biz_name: string;
  biz_reg_no: string;
  rep_name: string;
  address: string;
  bizCertUrl: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  cash_receipt_enabled: boolean;
  cash_receipt_provider: string | null;
  cash_receipt_issue_timing: string;
  cash_receipt_self_issue_enabled: boolean;
  cash_receipt_contact_name: string;
  cash_receipt_contact_phone: string;
};

function getBrandOrderUrl(slug: string | null): string | null {
  if (!slug) return null;
  return `/order/${encodeURIComponent(slug)}`;
}

function getCashReceiptIssueTimingLabel(value: string | null): string {
  if (value === "ORDER_COMPLETED") return "주문 완료 후 발급";
  return value ?? "-";
}

function isPdfUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\.pdf($|[?#])/i.test(value);
}

function createFormData(brand: Brand): BrandFormData {
  return {
    name: brand.name || "",
    slug: brand.slug || "",
    biz_name: brand.biz_name || "",
    biz_reg_no: brand.biz_reg_no || "",
    rep_name: brand.rep_name || "",
    address: brand.address || "",
    bizCertUrl: brand.biz_cert_url || brand.bizCertUrl || null,
    logo_url: brand.logo_url || null,
    cover_image_url: brand.cover_image_url || null,
    cash_receipt_enabled: brand.cash_receipt_enabled === true,
    cash_receipt_provider: brand.cash_receipt_provider || null,
    cash_receipt_issue_timing:
      brand.cash_receipt_issue_timing || "ORDER_COMPLETED",
    cash_receipt_self_issue_enabled:
      brand.cash_receipt_self_issue_enabled === true,
    cash_receipt_contact_name: brand.cash_receipt_contact_name || "",
    cash_receipt_contact_phone: brand.cash_receipt_contact_phone || "",
  };
}

function splitBusinessAddress(address: string | null | undefined): {
  addressLine1: string;
  addressLine2: string;
} {
  const normalized = address?.trim() ?? "";
  if (!normalized) {
    return { addressLine1: "", addressLine2: "" };
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { addressLine1: "", addressLine2: "" };
  }

  return {
    addressLine1: lines[0],
    addressLine2: lines.slice(1).join(" "),
  };
}

function combineBusinessAddress(addressLine1: string, addressLine2: string): string {
  const primary = addressLine1.trim();
  const detail = addressLine2.trim();

  if (!primary) return detail;
  if (!detail) return primary;
  return `${primary}\n${detail}`;
}

const emptyFormData: BrandFormData = {
  name: "",
  slug: "",
  biz_name: "",
  biz_reg_no: "",
  rep_name: "",
  address: "",
  bizCertUrl: null,
  logo_url: null,
  cover_image_url: null,
  cash_receipt_enabled: false,
  cash_receipt_provider: null,
  cash_receipt_issue_timing: "ORDER_COMPLETED",
  cash_receipt_self_issue_enabled: false,
  cash_receipt_contact_name: "",
  cash_receipt_contact_phone: "",
};

export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params?.brandId as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<BrandFormData>(emptyFormData);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [businessAddress1, setBusinessAddress1] = useState("");
  const [businessAddress2, setBusinessAddress2] = useState("");
  const [bizCertUploading, setBizCertUploading] = useState(false);
  const [bizCertUploadError, setBizCertUploadError] = useState<string | null>(
    null,
  );
  const bizCertInputRef = useRef<HTMLInputElement>(null);

  const syncBrandForm = (nextBrand: Brand) => {
    const nextFormData = createFormData(nextBrand);
    const nextAddress = splitBusinessAddress(nextFormData.address);
    setBrand(nextBrand);
    setFormData(nextFormData);
    setBusinessAddress1(nextAddress.addressLine1);
    setBusinessAddress2(nextAddress.addressLine2);
  };

  useEffect(() => {
    const loadBrand = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Brand>(`/customer/brands/${brandId}`);
        syncBrandForm(data);
      } catch (e) {
        console.error(e);
        setError(
          parseApiErrorMessage(e, "브랜드 정보를 불러오지 못했습니다."),
        );
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      void loadBrand();
    }
  }, [brandId]);

  const canEdit = brand && (brand.myRole === "OWNER" || brand.myRole === "ADMIN");
  const brandOrderUrl = useMemo(
    () => getBrandOrderUrl(brand?.slug ?? null),
    [brand?.slug],
  );

  const editingBizCertIsPdf = isPdfUrl(formData.bizCertUrl);
  const bizCertIsPdf = isPdfUrl(brand?.biz_cert_url);

  const handleBizCertUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setBizCertUploadError("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    if (file.type === "application/pdf") {
      try {
        setBizCertUploadError(null);
        setBizCertUploading(true);

        const uploadBody = new FormData();
        uploadBody.append("file", file);
        uploadBody.append("folder", "biz-certs");

        const uploaded = await apiClient.post<{ url: string }>(
          "/upload/image",
          uploadBody,
        );
        setFormData((prev) => ({ ...prev, bizCertUrl: uploaded.url }));
      } catch (e) {
        console.error(e);
        setBizCertUploadError(
          e instanceof Error
            ? e.message
            : "?ъ뾽?먮벑濡앹쬆 ?낅줈?쒖뿉 ?ㅽ뙣?덉뒿?덈떎.",
        );
      } finally {
        setBizCertUploading(false);
      }

      return;
    }

    if (!file.type.startsWith("image/")) {
      setBizCertUploadError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setBizCertUploadError(null);
      setBizCertUploading(true);

      const uploadBody = new FormData();
      uploadBody.append("file", file);
      uploadBody.append("folder", "biz-certs");

      const uploaded = await apiClient.post<{ url: string }>(
        "/upload/image",
        uploadBody,
      );
      setFormData((prev) => ({ ...prev, bizCertUrl: uploaded.url }));
    } catch (e) {
      console.error(e);
        setBizCertUploadError(
          parseApiErrorMessage(e, "사업자등록증 업로드에 실패했습니다."),
        );
    } finally {
      setBizCertUploading(false);
    }
  };

  const handleBizCertFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await handleBizCertUpload(file);
    event.target.value = "";
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      const payload = {
        ...formData,
        slug: formData.slug || null,
        biz_name: formData.biz_name || null,
        biz_reg_no: formData.biz_reg_no || null,
        rep_name: formData.rep_name || null,
        address:
          combineBusinessAddress(businessAddress1, businessAddress2) || null,
        cash_receipt_provider:
          formData.cash_receipt_enabled && formData.cash_receipt_provider
            ? formData.cash_receipt_provider
            : null,
        cash_receipt_contact_name: formData.cash_receipt_contact_name || null,
        cash_receipt_contact_phone: formData.cash_receipt_contact_phone || null,
      };

      const updatedBrand = await apiClient.patch<Brand>(
        `/customer/brands/${brandId}`,
        payload,
      );

      syncBrandForm(updatedBrand);
      setIsEditing(false);
      toast.success("브랜드 정보가 저장되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error(parseApiErrorMessage(e, "브랜드 정보 저장에 실패했습니다."));
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="mb-8 text-2xl font-extrabold text-foreground">
          브랜드 상세
        </h1>
        <div className="text-text-secondary">불러오는 중입니다.</div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div>
        <button
          onClick={() => router.back()}
          className="mb-6 rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary"
        >
          뒤로 가기
        </button>
        <h1 className="mb-4 text-2xl font-extrabold text-foreground">
          브랜드 상세
        </h1>
        <div className="rounded-xl border border-danger-500 bg-danger-500/10 p-4 text-danger-500">
          {error || "브랜드를 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-6 rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary"
      >
        뒤로 가기
      </button>

      <div className="mb-8 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-extrabold text-foreground">
          브랜드 상세
        </h1>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-border bg-bg-tertiary px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-bg-secondary"
          >
            수정하기
          </button>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                브랜드명
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="input-field w-full"
                placeholder="브랜드명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                브랜드 URL
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase(),
                  }))
                }
                className="input-field w-full"
                placeholder="brand-url"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                상호
              </label>
              <input
                type="text"
                value={formData.biz_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, biz_name: e.target.value }))
                }
                className="input-field w-full"
                placeholder="상호명"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                사업자등록번호
              </label>
              <input
                type="text"
                value={formData.biz_reg_no}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    biz_reg_no: formatBusinessNumberInput(e.target.value),
                  }))
                }
                className="input-field w-full"
                placeholder="000-00-00000"
                inputMode="numeric"
                maxLength={12}
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                대표자명
              </label>
              <input
                type="text"
                value={formData.rep_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, rep_name: e.target.value }))
                }
                className="input-field w-full"
                placeholder="대표자명"
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                주소
              </label>
              <input
                type="hidden"
                value={combineBusinessAddress(businessAddress1, businessAddress2)}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="input-field w-full"
                placeholder="사업장 주소"
              />
              <AddressSearchFields
                showLabel={false}
                addressLabel="사업장 주소"
                address1={businessAddress1}
                address2={businessAddress2}
                onAddress1Change={setBusinessAddress1}
                onAddress2Change={setBusinessAddress2}
                address1Placeholder="사업장 기본 주소"
                address2Placeholder="상세 주소"
                className="mt-3"
              />
            </div>

            <div className="mb-6 rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <div className="mb-4">
                <div className="text-sm font-semibold text-foreground">
                  현금영수증 설정
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  자동 발행을 사용하려면 사업자 정보와 담당자 연락처를 함께 입력해 주세요.
                </div>
              </div>

              <label className="mb-4 flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formData.cash_receipt_enabled}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cash_receipt_enabled: e.target.checked,
                      cash_receipt_provider: e.target.checked
                        ? (prev.cash_receipt_provider ?? "POPBILL")
                        : null,
                      cash_receipt_self_issue_enabled: e.target.checked
                        ? prev.cash_receipt_self_issue_enabled
                        : false,
                    }))
                  }
                />
                현금영수증 자동 발행 사용
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                    발급사
                  </label>
                  <select
                    value={formData.cash_receipt_provider ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cash_receipt_provider: e.target.value || null,
                      }))
                    }
                    className="input-field w-full"
                    disabled={!formData.cash_receipt_enabled}
                  >
                    <option value="">선택 안 함</option>
                    <option value="POPBILL">Popbill</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                    발급 시점
                  </label>
                  <select
                    value={formData.cash_receipt_issue_timing}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cash_receipt_issue_timing: e.target.value,
                      }))
                    }
                    className="input-field w-full"
                    disabled={!formData.cash_receipt_enabled}
                  >
                    <option value="ORDER_COMPLETED">주문 완료 후 발급</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                    담당자명
                  </label>
                  <input
                    type="text"
                    value={formData.cash_receipt_contact_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cash_receipt_contact_name: e.target.value,
                      }))
                    }
                    className="input-field w-full"
                    placeholder="담당자 이름"
                    disabled={!formData.cash_receipt_enabled}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                    담당자 연락처
                  </label>
                  <input
                    type="text"
                    value={formData.cash_receipt_contact_phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cash_receipt_contact_phone: e.target.value,
                      }))
                    }
                    className="input-field w-full"
                    placeholder="010-0000-0000"
                    disabled={!formData.cash_receipt_enabled}
                  />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formData.cash_receipt_self_issue_enabled}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cash_receipt_self_issue_enabled: e.target.checked,
                    }))
                  }
                  disabled={!formData.cash_receipt_enabled}
                />
                고객 식별정보가 없으면 자진발급 사용
              </label>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ImageUpload
                value={formData.logo_url}
                onChange={(url) =>
                  setFormData((prev) => ({ ...prev, logo_url: url }))
                }
                folder="brands/logos"
                label="로고"
                aspectRatio="1/1"
              />
              <ImageUpload
                value={formData.cover_image_url}
                onChange={(url) =>
                  setFormData((prev) => ({ ...prev, cover_image_url: url }))
                }
                folder="brands/covers"
                label="커버 이미지"
                aspectRatio="16/9"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                사업자등록증
              </label>
              <div className="flex items-start gap-3">
                {formData.bizCertUrl ? (
                  <a
                    href={formData.bizCertUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block overflow-hidden rounded-lg border border-border"
                  >
                    {editingBizCertIsPdf ? (
                      <div className="flex h-[120px] w-[180px] flex-col items-center justify-center gap-2 bg-bg-tertiary px-4 text-center">
                        <div className="text-lg font-bold text-foreground">PDF</div>
                        <div className="text-xs text-text-secondary">
                          클릭해서 사업자등록증 파일 열기
                        </div>
                      </div>
                    ) : (
                    <Image
                      src={formData.bizCertUrl}
                      alt="사업자등록증"
                      width={180}
                      height={120}
                      className="h-[120px] w-[180px] object-cover"
                    />
                    )}
                  </a>
                ) : (
                  <div className="flex h-[120px] w-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-bg-tertiary text-xs text-text-tertiary">
                    미리보기 없음
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    ref={bizCertInputRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={handleBizCertFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bizCertInputRef.current?.click()}
                    disabled={bizCertUploading}
                    className="rounded border border-border bg-bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bizCertUploading
                      ? "업로드 중..."
                      : formData.bizCertUrl
                        ? "파일 변경"
                        : "파일 선택"}
                  </button>
                  {bizCertUploading && (
                    <span className="text-xs text-text-secondary">
                      업로드 중입니다.
                    </span>
                  )}
                </div>
              </div>
              {bizCertUploadError && (
                <div className="mt-2 text-xs text-danger-500">
                  {bizCertUploadError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  const nextFormData = createFormData(brand);
                  const nextAddress = splitBusinessAddress(nextFormData.address);
                  setFormData(nextFormData);
                  setBusinessAddress1(nextAddress.addressLine1);
                  setBusinessAddress2(nextAddress.addressLine2);
                  setBizCertUploadError(null);
                }}
                disabled={saveLoading}
                className="rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                {saveLoading ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {brand.biz_cert_url && (
              <div className="mb-5">
                <div className="mb-2 text-[13px] text-text-secondary">
                  사업자등록증
                </div>
                <a
                  href={brand.biz_cert_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  {bizCertIsPdf ? (
                    <div className="flex h-[120px] w-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 text-center transition-opacity hover:opacity-90">
                      <div className="text-lg font-bold text-foreground">PDF</div>
                      <div className="text-xs text-text-secondary">
                        클릭해서 사업자등록증 파일 열기
                      </div>
                    </div>
                  ) : (
                  <Image
                    src={brand.biz_cert_url}
                    alt="사업자등록증"
                    width={180}
                    height={120}
                    className="h-[120px] w-[180px] rounded-lg border border-border object-cover transition-opacity hover:opacity-90"
                  />
                  )}
                </a>
              </div>
            )}

            {brand.cover_image_url && (
              <div className="mb-6">
                <div className="w-full max-w-[560px]">
                  <Image
                    src={brand.cover_image_url}
                    alt="커버 이미지"
                    width={1200}
                    height={675}
                    className="w-full rounded-lg border border-border object-cover"
                    style={{ aspectRatio: "16/9" }}
                  />
                </div>
              </div>
            )}

            <div className="mb-6 flex items-center gap-4">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-bg-tertiary text-[32px] text-text-secondary">
                  B
                </div>
              )}
              <div>
                <h2 className="mb-2 text-xl font-bold text-foreground">
                  {brand.name}
                </h2>
                <div className="text-sm text-text-secondary">
                  내 권한: {brand.myRole}
                </div>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-[13px] text-text-secondary">
                브랜드 URL
              </div>
              <div className="text-[15px] text-foreground">
                {brandOrderUrl ?? "-"}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {brand.biz_name && (
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    상호
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.biz_name}
                  </div>
                </div>
              )}
              {brand.biz_reg_no && (
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    사업자등록번호
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.biz_reg_no}
                  </div>
                </div>
              )}
              {brand.rep_name && (
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    대표자명
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.rep_name}
                  </div>
                </div>
              )}
              {brand.address && (
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    주소
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.address}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-bg-tertiary/30 p-4">
              <div className="mb-3 text-sm font-semibold text-foreground">
                현금영수증 설정
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    자동 발행
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.cash_receipt_enabled ? "사용" : "미사용"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    발급사
                  </div>
                  <div className="text-[15px] text-foreground">
                    {formatCashReceiptProvider(brand.cash_receipt_provider)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    발급 시점
                  </div>
                  <div className="text-[15px] text-foreground">
                    {getCashReceiptIssueTimingLabel(
                      brand.cash_receipt_issue_timing,
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    자진발급
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.cash_receipt_self_issue_enabled ? "사용" : "미사용"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    담당자명
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.cash_receipt_contact_name ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    담당자 연락처
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.cash_receipt_contact_phone ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[13px] text-text-secondary">
                    연동 사업자번호
                  </div>
                  <div className="text-[15px] text-foreground">
                    {brand.cash_receipt_merchant_id ?? "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] text-text-tertiary">
                  등록일
                </div>
                <div className="text-sm text-foreground">
                  {new Date(brand.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
