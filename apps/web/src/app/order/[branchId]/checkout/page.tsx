"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  options: ProductOption[];
};

type CartItem = {
  product: Product;
  qty: number;
  selectedOptions: ProductOption[];
  itemPrice: number;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

// ============================================================
// Component
// ============================================================

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고객 정보
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress1, setCustomerAddress1] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "TRANSFER" | "CASH">("CARD");

  // 장바구니 로드
  useEffect(() => {
    const savedCart = sessionStorage.getItem("orderCart");
    const savedBranchId = sessionStorage.getItem("orderBranchId");

    if (!savedCart || savedBranchId !== branchId) {
      router.replace(`/order/${branchId}`);
      return;
    }

    try {
      setCart(JSON.parse(savedCart));
    } catch {
      router.replace(`/order/${branchId}`);
    }
  }, [branchId, router]);

  // 총액 계산
  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);

  // 주문 제출
  const handleSubmit = async () => {
    if (!customerName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const orderData = {
        branchId,
        customerName,
        customerPhone: customerPhone || undefined,
        customerAddress1: customerAddress1 || undefined,
        customerAddress2: customerAddress2 || undefined,
        customerMemo: customerMemo || undefined,
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          options: item.selectedOptions.map((opt) => ({ optionId: opt.id })),
        })),
      };

      const res = await fetch(`${API_BASE}/public/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`주문 실패: ${res.status} ${text}`);
      }

      const result = await res.json();

      // 장바구니 클리어
      sessionStorage.removeItem("orderCart");
      sessionStorage.removeItem("orderBranchId");

      // 완료 페이지로 이동
      sessionStorage.setItem("lastOrder", JSON.stringify(result));
      router.push(`/order/${branchId}/complete`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "주문 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (cart.length === 0) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "#aaa", textAlign: "center", padding: 40 }}>장바구니가 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      {/* Header */}
      <header style={header}>
        <Link href={`/order/${branchId}`} style={{ color: "#fff", textDecoration: "none" }}>
          ← 돌아가기
        </Link>
        <h1 style={{ margin: "12px 0 0 0", fontSize: 20, fontWeight: 700 }}>주문서 작성</h1>
      </header>

      <main style={{ padding: 16 }}>
        {/* 주문 내역 */}
        <section style={section}>
          <h2 style={sectionTitle}>주문 내역</h2>
          {cart.map((item, idx) => (
            <div key={idx} style={orderItem}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                {item.selectedOptions.length > 0 && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {item.selectedOptions.map((o) => o.name).join(", ")}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                  {formatWon(item.itemPrice)} × {item.qty}개
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatWon(item.itemPrice * item.qty)}</div>
            </div>
          ))}
          <div style={totalRow}>
            <span>총 결제금액</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{formatWon(totalAmount)}</span>
          </div>
        </section>

        {/* 고객 정보 */}
        <section style={section}>
          <h2 style={sectionTitle}>고객 정보</h2>

          <div style={formGroup}>
            <label style={label}>이름 *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="홍길동"
              style={input}
            />
          </div>

          <div style={formGroup}>
            <label style={label}>연락처</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-1234-5678"
              style={input}
            />
          </div>

          <div style={formGroup}>
            <label style={label}>주소</label>
            <input
              type="text"
              value={customerAddress1}
              onChange={(e) => setCustomerAddress1(e.target.value)}
              placeholder="기본 주소"
              style={input}
            />
            <input
              type="text"
              value={customerAddress2}
              onChange={(e) => setCustomerAddress2(e.target.value)}
              placeholder="상세 주소"
              style={{ ...input, marginTop: 8 }}
            />
          </div>

          <div style={formGroup}>
            <label style={label}>요청사항</label>
            <textarea
              value={customerMemo}
              onChange={(e) => setCustomerMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요"
              rows={2}
              style={{ ...input, height: "auto", padding: "10px 12px" }}
            />
          </div>
        </section>

        {/* 결제 수단 */}
        <section style={section}>
          <h2 style={sectionTitle}>결제 수단</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {(["CARD", "TRANSFER", "CASH"] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                style={{
                  ...paymentBtn,
                  background: paymentMethod === method ? "#333" : "transparent",
                  borderColor: paymentMethod === method ? "#555" : "#333",
                }}
              >
                {method === "CARD" && "카드"}
                {method === "TRANSFER" && "계좌이체"}
                {method === "CASH" && "현금"}
              </button>
            ))}
          </div>
        </section>

        {/* Error */}
        {error && <p style={{ color: "#ff8a8a", marginTop: 16 }}>{error}</p>}

        {/* Submit */}
        <button
          style={submitBtn}
          onClick={handleSubmit}
          disabled={loading || !customerName.trim()}
        >
          {loading ? "주문 중..." : `${formatWon(totalAmount)} 결제하기`}
        </button>
      </main>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const pageContainer: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
};

const header: React.CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #222",
};

const section: React.CSSProperties = {
  padding: "16px 0",
  borderBottom: "1px solid #222",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 12,
  color: "#aaa",
};

const orderItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
};

const totalRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 16,
  paddingTop: 16,
  borderTop: "1px solid #333",
};

const formGroup: React.CSSProperties = {
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "#fff",
  fontSize: 15,
};

const paymentBtn: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const submitBtn: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  marginTop: 24,
  borderRadius: 12,
  border: "none",
  background: "#fff",
  color: "#000",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
