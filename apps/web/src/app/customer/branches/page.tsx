"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";

// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  myRole: string | null;
  createdAt: string;
};

type Brand = {
  id: string;
  name: string;
};

// ============================================================
// Constants
// ============================================================

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Component
// ============================================================

export default function CustomerBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const data = await apiClient.get<Brand[]>("/customer/brands");
        setBrands(data);

        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록을 불러올 수 없습니다");
      }
    };

    loadBrands();
  }, []);

  useEffect(() => {
    if (!selectedBrandId) {
      setLoading(false);
      return;
    }

    const loadBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch[]>(`/customer/branches?brandId=${selectedBrandId}`);
        setBranches(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, [selectedBrandId]);

  const canAddBranch = branches.length > 0
    ? branches[0]?.myRole === "OWNER" || branches[0]?.myRole === "ADMIN"
    : brands.find(b => b.id === selectedBrandId) !== undefined;

  if (brands.length === 0 && !loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">지점 관리</h1>
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 브랜드가 없습니다</div>
          <div className="text-sm">먼저 브랜드 멤버십을 요청하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">지점 관리</h1>
        {canAddBranch && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary px-5 py-2.5 text-sm">
            + 지점 추가
          </button>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-2 font-semibold">브랜드 선택</label>
        <select
          value={selectedBrandId}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          className="input-field max-w-[400px]"
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-text-secondary">로딩 중...</div>
      ) : error ? (
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">{error}</div>
      ) : branches.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 지점이 없습니다</div>
          <div className="text-sm">새로운 지점을 추가해보세요</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBranchModal
          brandId={selectedBrandId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function BranchCard({ branch }: { branch: Branch }) {
  return (
    <Link
      href={`/customer/branches/${branch.id}`}
      className="block p-4 rounded-md border border-border bg-bg-secondary text-foreground no-underline transition-colors hover:bg-bg-tertiary"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded bg-bg-tertiary flex items-center justify-center text-2xl">
          🏪
        </div>
        <div className="flex-1">
          <div className="font-bold text-base mb-1">{branch.name}</div>
          {branch.myRole && (
            <div className="text-xs text-text-secondary">역할: {branch.myRole}</div>
          )}
        </div>
      </div>
      {branch.slug && (
        <div className="text-sm text-text-secondary mb-2">Slug: {branch.slug}</div>
      )}
      <div className="text-2xs text-text-tertiary">
        등록일: {new Date(branch.createdAt).toLocaleDateString()}
      </div>
    </Link>
  );
}

function AddBranchModal({
  brandId,
  onClose,
  onSuccess,
}: {
  brandId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error("모든 필드를 입력해주세요");
      return;
    }

    try {
      setSaving(true);
      await apiClient.post("/customer/branches", {
        brandId,
        name: formData.name,
        slug: formData.slug,
      });

      toast.success("지점이 추가되었습니다.");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "지점 추가에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-md p-8 max-w-[500px] w-[90%] text-foreground" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">지점 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">지점명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="지점명을 입력하세요"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">Slug (영문, 숫자, 하이픈만)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="input-field"
              placeholder="branch-slug"
              pattern="[a-z0-9-]+"
              required
            />
            <div className="text-xs text-text-tertiary mt-1">
              소문자 영문, 숫자, 하이픈(-)만 사용 가능
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? "추가 중..." : "추가"}
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
