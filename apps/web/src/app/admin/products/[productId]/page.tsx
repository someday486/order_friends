"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type ProductOption = {
  id?: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
};

type ProductDetail = {
  id: string;
  branchId: string;
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  sortOrder: number;
  options: ProductOption[];
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.productId as string;
  const isNew = productId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [options, setOptions] = useState<ProductOption[]>([]);

  // 상품 상세 조회 (수정 모드)
  useEffect(() => {
    if (isNew) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`상품 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductDetail;
        setBranchId(data.branchId);
        setName(data.name);
        setDescription(data.description ?? "");
        setPrice(data.price);
        setIsActive(data.isActive);
        setSortOrder(data.sortOrder);
        setOptions(data.options);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isNew]);

  // 저장
  const handleSave = async () => {
    if (!name.trim()) {
      alert("상품명을 입력하세요.");
      return;
    }

    if (isNew && !branchId.trim()) {
      alert("가게 ID를 입력하세요.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = await getAccessToken();

      if (isNew) {
        // 생성
        const res = await fetch(`${API_BASE}/admin/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            branchId,
            name,
            description: description || null,
            price,
            isActive,
            sortOrder,
            options: options.filter((o) => o.name.trim()),
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`생성 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductDetail;
        router.push(`/admin/products/${data.id}`);
      } else {
        // 수정
        const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            description: description || null,
            price,
            isActive,
            sortOrder,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`수정 실패: ${res.status} ${text}`);
        }

        alert("저장되었습니다.");
      }
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 옵션 추가
  const handleAddOption = () => {
    setOptions([
      ...options,
      { name: "", priceDelta: 0, isActive: true, sortOrder: options.length },
    ]);
  };

  // 옵션 삭제
  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // 옵션 수정
  const handleOptionChange = (
    index: number,
    field: keyof ProductOption,
    value: string | number | boolean
  ) => {
    setOptions(
      options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#aaa" }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/products" style={{ color: "white", textDecoration: "none" }}>
          ← 상품 목록
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 0 0" }}>
          {isNew ? "상품 등록" : "상품 수정"}
        </h1>
      </div>

      {/* Error */}
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {/* Form */}
      <div style={{ maxWidth: 600 }}>
        {/* 가게 ID (등록 시에만) */}
        {isNew && (
          <div style={formGroup}>
            <label style={label}>가게 ID *</label>
            <input
              type="text"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="Branch UUID"
              style={input}
            />
          </div>
        )}

        {/* 상품명 */}
        <div style={formGroup}>
          <label style={label}>상품명 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="상품명 입력"
            style={input}
          />
        </div>

        {/* 설명 */}
        <div style={formGroup}>
          <label style={label}>설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상품 설명 (선택)"
            rows={3}
            style={{ ...input, height: "auto", padding: "10px 12px" }}
          />
        </div>

        {/* 가격 */}
        <div style={formGroup}>
          <label style={label}>가격 (원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
            style={input}
          />
        </div>

        {/* 정렬 순서 */}
        <div style={formGroup}>
          <label style={label}>정렬 순서</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            style={input}
          />
        </div>

        {/* 활성 상태 */}
        <div style={formGroup}>
          <label style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            판매 활성화
          </label>
        </div>

        {/* 옵션 (등록 시에만) */}
        {isNew && (
          <div style={{ ...formGroup, marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={label}>옵션</label>
              <button type="button" onClick={handleAddOption} style={btnSmall}>
                + 옵션 추가
              </button>
            </div>

            {options.map((opt, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px auto",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type="text"
                  value={opt.name}
                  onChange={(e) => handleOptionChange(idx, "name", e.target.value)}
                  placeholder="옵션명"
                  style={input}
                />
                <input
                  type="number"
                  value={opt.priceDelta}
                  onChange={(e) => handleOptionChange(idx, "priceDelta", Number(e.target.value))}
                  placeholder="추가금액"
                  style={input}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  style={{ ...btnSmall, color: "#ef4444" }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 버튼 */}
        <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? "저장 중..." : isNew ? "등록" : "저장"}
          </button>
          <Link href="/admin/products">
            <button style={btnGhost}>취소</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const formGroup: React.CSSProperties = {
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "block",
  color: "#aaa",
  fontSize: 13,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  padding: "0 24px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const btnGhost: React.CSSProperties = {
  height: 40,
  padding: "0 24px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};

const btnSmall: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 12,
};
