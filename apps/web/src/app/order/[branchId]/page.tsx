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

type Branch = {
  id: string;
  name: string;
  brandName?: string;
};

type CartItem = {
  product: Product;
  qty: number;
  selectedOptions: ProductOption[];
  itemPrice: number; // 옵션 포함 단가
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

function calculateItemPrice(product: Product, selectedOptions: ProductOption[]) {
  let price = product.price;
  for (const opt of selectedOptions) {
    price += opt.priceDelta;
  }
  return price;
}

// ============================================================
// Component
// ============================================================

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 장바구니
  const [cart, setCart] = useState<CartItem[]>([]);

  // 상품 선택 모달
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [qty, setQty] = useState(1);

  // 데이터 로드
  useEffect(() => {
    if (!branchId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 가게 정보
        const branchRes = await fetch(`${API_BASE}/public/branches/${branchId}`);
        if (!branchRes.ok) throw new Error("가게를 찾을 수 없습니다.");
        const branchData = await branchRes.json();
        setBranch(branchData);

        // 상품 목록
        const productsRes = await fetch(`${API_BASE}/public/branches/${branchId}/products`);
        if (!productsRes.ok) throw new Error("상품을 불러올 수 없습니다.");
        const productsData = await productsRes.json();
        setProducts(productsData);
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  // 상품 선택
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions([]);
    setQty(1);
  };

  // 옵션 토글
  const toggleOption = (option: ProductOption) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.id === option.id);
      if (exists) {
        return prev.filter((o) => o.id !== option.id);
      } else {
        return [...prev, option];
      }
    });
  };

  // 장바구니에 추가
  const addToCart = () => {
    if (!selectedProduct) return;

    const itemPrice = calculateItemPrice(selectedProduct, selectedOptions);

    setCart((prev) => [
      ...prev,
      {
        product: selectedProduct,
        qty,
        selectedOptions: [...selectedOptions],
        itemPrice,
      },
    ]);

    setSelectedProduct(null);
    setSelectedOptions([]);
    setQty(1);
  };

  // 장바구니에서 제거
  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // 총액 계산
  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);

  // 주문하기
  const goToCheckout = () => {
    if (cart.length === 0) {
      alert("장바구니에 상품을 추가해주세요.");
      return;
    }

    // 장바구니 데이터를 sessionStorage에 저장
    sessionStorage.setItem("orderCart", JSON.stringify(cart));
    sessionStorage.setItem("orderBranchId", branchId);
    router.push(`/order/${branchId}/checkout`);
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "#aaa", textAlign: "center", padding: 40 }}>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "#ff8a8a", textAlign: "center", padding: 40 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      {/* Header */}
      <header style={header}>
        <div>
          <div style={{ fontSize: 12, color: "#888" }}>{branch?.brandName}</div>
          <h1 style={{ margin: "4px 0 0 0", fontSize: 20, fontWeight: 700 }}>{branch?.name}</h1>
        </div>
      </header>

      {/* Products */}
      <main style={{ padding: "16px 16px 120px 16px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>메뉴</h2>

        {products.length === 0 ? (
          <p style={{ color: "#666" }}>등록된 상품이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map((product) => (
              <div
                key={product.id}
                style={productCard}
                onClick={() => handleSelectProduct(product)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{product.name}</div>
                  {product.description && (
                    <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                      {product.description}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, color: "#fff" }}>{formatWon(product.price)}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Summary (Fixed Bottom) */}
      {cart.length > 0 && (
        <div style={cartBar}>
          <div>
            <div style={{ fontSize: 13, color: "#aaa" }}>장바구니 {cart.length}개</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{formatWon(totalAmount)}</div>
          </div>
          <button style={orderBtn} onClick={goToCheckout}>
            주문하기
          </button>
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <div style={modalOverlay} onClick={() => setSelectedProduct(null)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{selectedProduct.name}</h3>
            <div style={{ color: "#888", marginBottom: 16 }}>{formatWon(selectedProduct.price)}</div>

            {/* Options */}
            {selectedProduct.options.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>옵션 선택</div>
                {selectedProduct.options.map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.some((o) => o.id === opt.id)}
                      onChange={() => toggleOption(opt)}
                    />
                    <span style={{ flex: 1 }}>{opt.name}</span>
                    <span style={{ color: "#888" }}>
                      {opt.priceDelta > 0 ? `+${formatWon(opt.priceDelta)}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Quantity */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>수량</span>
              <button
                style={qtyBtn}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span style={{ width: 40, textAlign: "center" }}>{qty}</span>
              <button style={qtyBtn} onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span>합계</span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>
                {formatWon(calculateItemPrice(selectedProduct, selectedOptions) * qty)}
              </span>
            </div>

            {/* Add Button */}
            <button style={addBtn} onClick={addToCart}>
              장바구니에 담기
            </button>
          </div>
        </div>
      )}

      {/* Cart Detail (if needed) */}
      {cart.length > 0 && (
        <div style={{ padding: "0 16px 16px 16px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>장바구니</h3>
          {cart.map((item, idx) => (
            <div key={idx} style={cartItem}>
              <div style={{ flex: 1 }}>
                <div>{item.product.name}</div>
                {item.selectedOptions.length > 0 && (
                  <div style={{ fontSize: 12, color: "#888" }}>
                    옵션: {item.selectedOptions.map((o) => o.name).join(", ")}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                  {formatWon(item.itemPrice)} × {item.qty}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600 }}>{formatWon(item.itemPrice * item.qty)}</div>
                <button
                  style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => removeFromCart(idx)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  padding: "20px 16px",
  borderBottom: "1px solid #222",
};

const productCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0a0a0a",
  cursor: "pointer",
};

const cartBar: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  background: "#111",
  borderTop: "1px solid #333",
};

const orderBtn: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.8)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 100,
};

const modalContent: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "80vh",
  padding: 20,
  borderRadius: "16px 16px 0 0",
  background: "#111",
  overflowY: "auto",
};

const qtyBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
};

const addBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

const cartItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  marginBottom: 8,
  borderRadius: 10,
  background: "#0a0a0a",
  border: "1px solid #222",
};
