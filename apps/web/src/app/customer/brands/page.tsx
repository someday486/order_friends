'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { useUserRole } from '@/hooks/useUserRole';
import { parseApiErrorMessage } from '@/lib/api-error';
import { apiClient } from '@/lib/api-client';
import { formatBusinessNumberInput } from '@/lib/format';

type BillingTier = 'PG' | 'NON_PG';

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  biz_name: string | null;
  logo_url: string | null;
  created_at: string;
  billing_tier?: BillingTier;
  myRole?: string;
};

type BrandCreateForm = {
  name: string;
  slug: string;
  biz_name: string;
  biz_reg_no: string;
  billingTier: BillingTier;
};

function getBrandShopUrl(slug: string | null): string | null {
  if (!slug) return null;
  return `/shop/${encodeURIComponent(slug)}`;
}

function canCreateBrand(
  role: string,
  loading: boolean,
  brands: Brand[],
  membershipsLoading: boolean,
  canCreateBrandDirectly?: boolean,
) {
  if (loading || membershipsLoading) return false;
  if (canCreateBrandDirectly) return true;
  if (role === 'system_admin' || role === 'brand_owner') return true;

  return brands.some((brand) => brand.myRole === 'OWNER' || brand.myRole === 'ADMIN');
}

function createInitialForm(): BrandCreateForm {
  return {
    name: '',
    slug: '',
    biz_name: '',
    biz_reg_no: '',
    billingTier: 'PG',
  };
}

export default function CustomerBrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { role, userData, loading: roleLoading } = useUserRole();
  const { selectBrand } = useSelectedBrand();

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<Brand[]>('/customer/brands');
      setBrands(data);
    } catch (loadError) {
      console.error(loadError);
      setError(
        parseApiErrorMessage(loadError, '브랜드 목록을 불러오지 못했습니다.'),
      );
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
        <h1 className="mb-8 text-2xl font-extrabold text-foreground">
          브랜드/셀러 관리
        </h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <h1 className="mb-4 text-2xl font-extrabold text-foreground">
          브랜드/셀러 관리
        </h1>
        <div className="rounded-md border border-danger-500 bg-danger-500/10 p-4 text-danger-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-extrabold text-foreground">
          브랜드/셀러 관리
        </h1>
        {allowAdd ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            + 브랜드/셀러 등록
          </button>
        ) : null}
      </div>

      {brands.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="mb-2 text-base">등록된 브랜드/셀러가 없습니다.</div>
          <div className="text-sm">
            운영 권한이 필요하면 브랜드 멤버 초대를 요청하거나 새 브랜드/셀러를
            만들어 주세요.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}

      {showAddModal ? (
        <AddBrandModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(createdBrand) => {
            setShowAddModal(false);
            selectBrand(createdBrand.id);
            setBrands((prev) => {
              const deduped = prev.filter((brand) => brand.id !== createdBrand.id);
              return [createdBrand, ...deduped];
            });
            loadBrands().catch(() => null);

            if (createdBrand.billing_tier === 'NON_PG') {
              router.push(
                `/customer/billing/setup?brandId=${encodeURIComponent(createdBrand.id)}`,
              );
              return;
            }

            router.push(`/customer/brands/${encodeURIComponent(createdBrand.id)}`);
          }}
        />
      ) : null}
    </div>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  const brandShopUrl = getBrandShopUrl(brand.slug);
  const billingTierLabel =
    brand.billing_tier === 'NON_PG' ? '무통장 전용' : 'PG 이용';

  return (
    <Link
      href={`/customer/brands/${brand.id}`}
      className="block rounded-md border border-border bg-bg-secondary p-4 text-foreground no-underline transition-colors hover:bg-bg-tertiary"
    >
      <div className="mb-3 flex items-center gap-3">
        {brand.logo_url ? (
          <Image
            src={brand.logo_url}
            alt={brand.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-bg-tertiary text-lg font-semibold text-text-tertiary">
            {brand.name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1">
          <div className="mb-1 text-base font-bold">{brand.name}</div>
          {brandShopUrl ? (
            <div className="text-xs text-text-tertiary">온라인샵: {brandShopUrl}</div>
          ) : null}
          <div className="text-xs text-text-secondary">
            결제 운영 방식: {billingTierLabel}
          </div>
          {brand.myRole ? (
            <div className="text-xs text-text-secondary">권한: {brand.myRole}</div>
          ) : null}
        </div>
      </div>
      <div className="text-2xs text-text-tertiary">
        등록일: {new Date(brand.created_at).toLocaleDateString()}
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
  const [formData, setFormData] = useState<BrandCreateForm>(createInitialForm);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error('브랜드명은 필수입니다.');
      return;
    }

    try {
      setSaving(true);
      const createdBrand = await apiClient.post<Brand>('/customer/brands', {
        name: formData.name,
        slug: formData.slug || null,
        biz_name: formData.biz_name || null,
        biz_reg_no: formData.biz_reg_no || null,
        billingTier: formData.billingTier,
      });

      toast.success('브랜드를 등록했습니다.');
      onSuccess(createdBrand);
    } catch (saveError) {
      console.error(saveError);
      toast.error(
        parseApiErrorMessage(saveError, '브랜드/셀러 등록에 실패했습니다.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[560px] rounded-md border border-border bg-bg-secondary p-8 text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-6 text-xl font-bold">브랜드/셀러 등록</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              브랜드/셀러명
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, name: event.target.value }))
              }
              className="input-field"
              placeholder="브랜드명, 셀러명 또는 상호명을 입력해 주세요"
              required
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              결제 운영 방식
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, billingTier: 'PG' }))
                }
                className={`rounded-md border p-3 text-left transition-colors ${
                  formData.billingTier === 'PG'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-bg-tertiary text-text-secondary'
                }`}
              >
                <div className="font-semibold">PG 이용</div>
                <div className="mt-1 text-xs leading-5">
                  온라인샵에서 토스페이먼츠 결제로 주문을 받고 매출 건당 수수료 기준으로
                  운영합니다.
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, billingTier: 'NON_PG' }))
                }
                className={`rounded-md border p-3 text-left transition-colors ${
                  formData.billingTier === 'NON_PG'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-bg-tertiary text-text-secondary'
                }`}
              >
                <div className="font-semibold">무통장 전용</div>
                <div className="mt-1 text-xs leading-5">
                  고객은 온라인샵에서 계좌이체로 주문하고 브랜드/셀러는 월 이용료 기준으로
                  운영합니다.
                </div>
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              사용 URL
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  slug: event.target.value.toLowerCase(),
                }))
              }
              className="input-field"
              placeholder="사용할 URL을 입력해 주세요"
            />
            <div className="mt-1 text-xs text-text-tertiary">
              영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.
            </div>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              사업자명
            </label>
            <input
              type="text"
              value={formData.biz_name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, biz_name: event.target.value }))
              }
              className="input-field"
              placeholder="사업자등록증 상의 사업자명을 입력해 주세요"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">
              사업자번호
            </label>
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
              {saving ? '등록 중...' : '등록하기'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded border border-border bg-transparent py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
