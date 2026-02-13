"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
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

const canCreateBrand = (
  role: string,
  loading: boolean,
  brands: Brand[],
  membershipsLoading: boolean,
) => {
  if (loading || membershipsLoading) return false;
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

  const { role, loading: roleLoading } = useUserRole();

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<Brand[]>('/customer/brands');
      setBrands(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load brands.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands().catch(() => null);
  }, []);

  const allowAdd = canCreateBrand(role, roleLoading, brands, roleLoading);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">Brand Management</h1>
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
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">Brand Management</h1>
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">Brand Management</h1>
        {allowAdd ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            + Add Brand
          </button>
        ) : null}
      </div>

      {brands.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">No brand found.</div>
          <div className="text-sm">If you need access, request brand membership or create a new brand.</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBrandModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadBrands().catch(() => null);
          }}
        />
      )}
    </div>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
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
          {brand.slug && <div className="text-xs text-text-tertiary">Slug: {brand.slug}</div>}
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
  onSuccess: () => void;
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
      await apiClient.post('/customer/brands', {
        name: formData.name,
        slug: formData.slug || null,
        biz_name: formData.biz_name || null,
        biz_reg_no: formData.biz_reg_no || null,
      });

      toast.success('Brand has been added.');
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to add brand.');
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
        <h2 className="text-xl font-bold mb-6">Add Brand</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className="input-field"
              placeholder="Enter brand name"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">Brand Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))
              }
              className="input-field"
              placeholder="brand-slug"
            />
            <div className="text-xs text-text-tertiary mt-1">Letters, numbers, and hyphens only.</div>
          </div>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">Business Name</label>
            <input
              type="text"
              value={formData.biz_name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, biz_name: event.target.value }))
              }
              className="input-field"
              placeholder="Business name (optional)"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">Business Registration No.</label>
            <input
              type="text"
              value={formData.biz_reg_no}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, biz_reg_no: event.target.value }))
              }
              className="input-field"
              placeholder="000-00-00000"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-2.5"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
