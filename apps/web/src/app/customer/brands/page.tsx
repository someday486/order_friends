"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { parseApiErrorMessage } from "@/lib/api-error";
import { formatBusinessNumberInput } from "@/lib/format";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useUserRole } from "@/hooks/useUserRole";

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  biz_name: string | null;
  logo_url: string | null;
  created_at: string;
  myRole?: string;
};

function getBrandShopUrl(slug: string | null): string | null {
  if (!slug) return null;
  return `/shop/${encodeURIComponent(slug)}`;
}

const canCreateBrand = (
  role: string,
  loading: boolean,
  brands: Brand[],
  membershipsLoading: boolean,
  canCreateBrandDirectly?: boolean,
) => {
  if (loading || membershipsLoading) return false;
  if (canCreateBrandDirectly) return true;
  if (role === "system_admin" || role === "brand_owner") return true;

  return brands.some(
    (b) => b.myRole === "OWNER" || b.myRole === "ADMIN",
  );
};

export default function CustomerBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { role, userData, loading: roleLoading } = useUserRole();

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<Brand[]>('/customer/brands');
      setBrands(data);
    } catch (e) {
      console.error(e);
      setError(parseApiErrorMessage(e, "브랜드 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands().catch(() => null);
  }, []);

  const allowAdd = canCreateBrand(
    role,
    roleLoading,
    brands,
    roleLoading,
    userData?.canCreateBrand,
  );

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">브랜드관리</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">브랜드관리</h1>
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">브랜드관리</h1>
        {allowAdd ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            + 브랜드등록
          </button>
        ) : null}
      </div>

      {brands.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">브랜드가 없습니다.</div>
          <div className="text-sm">접근 권한이 필요하면 브랜드 멤버십을 요청하거나 새 브랜드를 생성하세요.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBrandModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(createdBrand) => {
            setShowAddModal(false);
            setBrands((prev) => {
              const deduped = prev.filter((brand) => brand.id !== createdBrand.id);
              return [createdBrand, ...deduped];
            });
            loadBrands().catch(() => null);
          }}
        />
      )}
    </div>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  const brandShopUrl = getBrandShopUrl(brand.slug);

  return (
    <Link
      href={`/customer/brands/${brand.id}`}
      className="block p-4 rounded-md border border-border bg-bg-secondary text-foreground no-underline transition-colors hover:bg-bg-tertiary"
    >
      <div className="flex items-center gap-3 mb-3">
        {brand.logo_url ? (
          <Image
            src={brand.logo_url}
            alt={brand.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-bg-tertiary flex items-center justify-center text-2xl">
            
          </div>
        )}
        <div className="flex-1">
          <div className="font-bold text-base mb-1">{brand.name}</div>
          {brandShopUrl && (
            <div className="text-xs text-text-tertiary">
              온라인샵: {brandShopUrl}
            </div>
          )}
          {brand.myRole && (
            <div className="text-xs text-text-secondary">Role: {brand.myRole}</div>
          )}
        </div>
      </div>
      <div className="text-2xs text-text-tertiary">
        Registered: {new Date(brand.created_at).toLocaleDateString()}
      </div>
    </Link>
  );
}

function AddBrandModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (createdBrand: Brand) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    biz_name: '',
    biz_reg_no: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Brand name is required.');
      return;
    }

    try {
      setSaving(true);
      const createdBrand = await apiClient.post<Brand>('/customer/brands', {
        name: formData.name,
        slug: formData.slug || null,
        biz_name: formData.biz_name || null,
        biz_reg_no: formData.biz_reg_no || null,
      });

      toast.success('Brand has been added.');
      onSuccess(createdBrand);
    } catch (e) {
      console.error(e);
      toast.error(parseApiErrorMessage(e, "브랜드 추가에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-md p-8 max-w-[520px] w-[90%] text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-6">브랜드등록</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">브랜드명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className="input-field"
              placeholder="브랜드명은 사업자명과 달라도 됩니다."
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">사용 URL</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))
              }
              className="input-field"
              placeholder="사용하실 url을 입력해주세요."
            />
            <div className="text-xs text-text-tertiary mt-1">문자, 숫자, 하이픈(-)만 사용</div>
          </div>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">사업자명</label>
            <input
              type="text"
              value={formData.biz_name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, biz_name: event.target.value }))
              }
              className="input-field"
              placeholder="사업자등록증에 명시된 사업자명을 입력해주세요."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">사업자번호</label>
            <input
              type="text"
              value={formData.biz_reg_no}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  biz_reg_no: formatBusinessNumberInput(event.target.value),
                }))
              }
              className="input-field"
              placeholder="000-00-00000"
              inputMode="numeric"
              maxLength={12}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-2.5"
            >
              {saving ? 'Adding...' : '저장'}
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
