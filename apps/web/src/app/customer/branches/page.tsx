"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

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
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/brands`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`브랜드 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setBrands(data);

        // Auto-select first brand
        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록 조회 중 오류 발생");
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
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/branches?brandId=${selectedBrandId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`지점 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setBranches(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록 조회 중 오류 발생");
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
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>지점 관리</h1>
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>등록된 브랜드가 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>먼저 브랜드 멤버십을 요청하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>지점 관리</h1>
        {canAddBranch && (
          <button onClick={() => setShowAddModal(true)} style={addButton}>
            + 지점 추가
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>브랜드 선택</label>
        <select
          value={selectedBrandId}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          style={selectStyle}
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>로딩 중...</div>
      ) : error ? (
        <div style={errorBox}>{error}</div>
      ) : branches.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>등록된 지점이 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>새로운 지점을 추가해보세요</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
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
            // Reload branches
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
    <Link href={`/customer/branches/${branch.id}`} style={branchCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: "#222",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          🏪
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{branch.name}</div>
          {branch.myRole && (
            <div style={{ fontSize: 12, color: "#aaa" }}>역할: {branch.myRole}</div>
          )}
        </div>
      </div>
      {branch.slug && (
        <div style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>Slug: {branch.slug}</div>
      )}
      <div style={{ fontSize: 11, color: "#666" }}>
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
      alert("모든 필드를 입력해주세요");
      return;
    }

    try {
      setSaving(true);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/branches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandId,
          name: formData.name,
          slug: formData.slug,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `지점 추가 실패: ${res.status}`);
      }

      alert("지점이 추가되었습니다");
      onSuccess();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "지점 추가 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>지점 추가</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>지점명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={inputStyle}
              placeholder="지점명을 입력하세요"
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Slug (영문, 숫자, 하이픈만)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              style={inputStyle}
              placeholder="branch-slug"
              pattern="[a-z0-9-]+"
              required
            />
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              소문자 영문, 숫자, 하이픈(-)만 사용 가능
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" disabled={saving} style={saveButton}>
              {saving ? "추가 중..." : "추가"}
            </button>
            <button type="button" onClick={onClose} disabled={saving} style={cancelButton}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const branchCardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
  transition: "all 0.15s",
};

const emptyBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 48,
  background: "#0a0a0a",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
};

const addButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0070f3",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  cursor: "pointer",
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
