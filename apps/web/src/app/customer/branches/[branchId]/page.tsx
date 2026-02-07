"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ============================================================
// Helpers
// ============================================================

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

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
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/branches/${branchId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`지점 조회 실패: ${res.status}`);
        }

        const data = await res.json();
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
        setError(e instanceof Error ? e.message : "지점 조회 중 오류 발생");
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
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/branches/${branchId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `지점 수정 실패: ${res.status}`);
      }

      const updated = await res.json();
      setBranch(updated);
      setIsEditing(false);
      alert("지점 정보가 수정되었습니다");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "지점 수정 중 오류 발생");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/branches/${branchId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `지점 삭제 실패: ${res.status}`);
      }

      alert("지점이 삭제되었습니다");
      router.push("/customer/branches");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "지점 삭제 중 오류 발생");
    }
  };

  const canEdit = branch && (branch.myRole === "OWNER" || branch.myRole === "ADMIN");

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>지점 상세</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div>
        <button onClick={() => router.back()} style={backButton}>
          ← 뒤로 가기
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>지점 상세</h1>
        <div style={errorBox}>{error || "지점을 찾을 수 없습니다"}</div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} style={backButton}>
        ← 뒤로 가기
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>지점 상세</h1>
        {canEdit && !isEditing && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setIsEditing(true)} style={editButton}>
              수정하기
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={deleteButton}>
              삭제
            </button>
          </div>
        )}
      </div>

      <div style={contentBox}>
        {isEditing ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>지점명</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="지점명을 입력하세요"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Slug (영문, 숫자, 하이픈만)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                style={inputStyle}
                placeholder="branch-slug"
                pattern="[a-z0-9-]+"
              />
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                소문자 영문, 숫자, 하이픈(-)만 사용 가능
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
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

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleSave} disabled={saveLoading} style={saveButton}>
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
                style={cancelButton}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Cover image banner */}
            {branch.coverImageUrl && (
              <div style={{ marginBottom: 24 }}>
                <img
                  src={branch.coverImageUrl}
                  alt="커버 이미지"
                  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 8 }}
                />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              {branch.logoUrl ? (
                <img
                  src={branch.logoUrl}
                  alt={branch.name}
                  style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    background: "#222",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                  }}
                >
                  🏪
                </div>
              )}
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0" }}>{branch.name}</h2>
                {branch.myRole && (
                  <div style={{ fontSize: 14, color: "#aaa" }}>역할: {branch.myRole}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>Slug</div>
              <div style={{ fontSize: 15, color: "#fff" }}>{branch.slug}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>브랜드 ID</div>
              <div style={{ fontSize: 15, color: "#fff", fontFamily: "monospace" }}>{branch.brandId}</div>
            </div>

            {branch.thumbnailUrl && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>썸네일</div>
                <img
                  src={branch.thumbnailUrl}
                  alt="썸네일"
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #333" }}
                />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>등록일</div>
                <div style={{ fontSize: 14, color: "#fff" }}>{new Date(branch.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>지점 삭제</h2>
            <p style={{ color: "#aaa", marginBottom: 24 }}>
              정말로 이 지점을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleDelete} style={confirmDeleteButton}>
                삭제
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} style={cancelButton}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const backButton: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#aaa",
  fontSize: 14,
  cursor: "pointer",
  marginBottom: 24,
};

const editButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const deleteButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #ff4444",
  background: "transparent",
  color: "#ff4444",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const saveButton: React.CSSProperties = {
  flex: 1,
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0070f3",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const cancelButton: React.CSSProperties = {
  flex: 1,
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#aaa",
  fontSize: 14,
  cursor: "pointer",
};

const contentBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 24,
  background: "#0f0f0f",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContent: React.CSSProperties = {
  background: "#0f0f0f",
  border: "1px solid #222",
  borderRadius: 12,
  padding: 32,
  maxWidth: 500,
  width: "90%",
  color: "white",
};

const confirmDeleteButton: React.CSSProperties = {
  flex: 1,
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#ff4444",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};
