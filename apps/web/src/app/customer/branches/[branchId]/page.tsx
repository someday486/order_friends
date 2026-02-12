"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ImageUpload } from "@/components/ui/ImageUpload";

// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  thumbnailUrl: string | null;
  myRole: string | null;
  createdAt: string;
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

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logoUrl: null as string | null,
    coverImageUrl: null as string | null,
    thumbnailUrl: null as string | null,
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadBranch = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch>(`/customer/branches/${branchId}`);
        setBranch(data);
        setFormData({
          name: data.name || "",
          slug: data.slug || "",
          logoUrl: data.logoUrl || null,
          coverImageUrl: data.coverImageUrl || null,
          thumbnailUrl: data.thumbnailUrl || null,
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "?? ?? ? ?? ??");
      } finally {
        setLoading(false);
      }
    };

    if (branchId) {
      loadBranch();
    }
  }, [branchId]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      const updatedBranch = await apiClient.patch<Branch>(`/customer/branches/${branchId}`, formData);
      setBranch(updatedBranch);
      setIsEditing(false);
      alert("?? ??? ???????.");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "?? ?? ? ?? ??");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/customer/branches/${branchId}`);
      setShowDeleteConfirm(false);
      router.replace("/customer/branches");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "?? ?? ? ?? ??");
    }
  };

  const canEdit = branch && (branch.myRole === "OWNER" || branch.myRole === "ADMIN");

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">지점 상세</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div>
        <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
          ← 뒤로 가기
        </button>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">지점 상세</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">
          {error || "지점을 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
        ← 뒤로 가기
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">지점 상세</h1>
        {canEdit && !isEditing && (
          <div className="flex gap-3">
            <button onClick={() => setIsEditing(true)} className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors">
              수정하기
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="py-2.5 px-5 rounded-lg border border-danger-500 bg-transparent text-danger-500 text-sm cursor-pointer font-semibold hover:bg-danger-500/10 transition-colors">
              삭제
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">지점명</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="지점명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">Slug (영문, 숫자, 하이픈만)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className="input-field w-full"
                placeholder="branch-slug"
                pattern="[a-z0-9-]+"
              />
              <div className="text-xs text-text-tertiary mt-1">
                소문자 영문, 숫자, 하이픈(-)만 사용 가능
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">
              <ImageUpload
                value={formData.logoUrl}
                onChange={(url) => setFormData({ ...formData, logoUrl: url })}
                folder="branches/logos"
                label="로고"
                aspectRatio="1/1"
              />
              <ImageUpload
                value={formData.coverImageUrl}
                onChange={(url) => setFormData({ ...formData, coverImageUrl: url })}
                folder="branches/covers"
                label="커버 이미지"
                aspectRatio="16/9"
              />
              <ImageUpload
                value={formData.thumbnailUrl}
                onChange={(url) => setFormData({ ...formData, thumbnailUrl: url })}
                folder="branches/thumbnails"
                label="썸네일"
                aspectRatio="1/1"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saveLoading} className="btn-primary flex-1 py-2.5 px-5 text-sm">
                {saveLoading ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: branch.name,
                    slug: branch.slug,
                    logoUrl: branch.logoUrl,
                    coverImageUrl: branch.coverImageUrl,
                    thumbnailUrl: branch.thumbnailUrl,
                  });
                }}
                disabled={saveLoading}
                className="flex-1 py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Cover image banner */}
            {branch.coverImageUrl && (
              <div className="mb-6">
                <Image
                  src={branch.coverImageUrl}
                  alt="?? ???"
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
                  🏪
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold mb-2 text-foreground">{branch.name}</h2>
                {branch.myRole && (
                  <div className="text-sm text-text-secondary">역할: {branch.myRole}</div>
                )}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">Slug</div>
              <div className="text-[15px] text-foreground">{branch.slug}</div>
            </div>

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">브랜드 ID</div>
              <div className="text-[15px] text-foreground font-mono">{branch.brandId}</div>
            </div>

            {branch.thumbnailUrl && (
              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">썸네일</div>
                <Image
                  src={branch.thumbnailUrl}
                  alt="???"
                  width={120}
                  height={120}
                  className="w-[120px] h-[120px] object-cover rounded-lg border border-border"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-[11px] text-text-tertiary mb-1">등록일</div>
                <div className="text-sm text-foreground">{new Date(branch.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-bg-secondary border border-border rounded-xl p-8 max-w-[500px] w-[90%] text-foreground" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-foreground">지점 삭제</h2>
            <p className="text-text-secondary mb-6">
              정말로 이 지점을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 py-2.5 px-5 rounded-lg border-none bg-danger-500 text-foreground text-sm cursor-pointer font-semibold hover:bg-danger-600 transition-colors">
                삭제
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
