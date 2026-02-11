"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatWon } from "@/lib/format";

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
    router.push(`/order/branch/${branchId}/checkout`);
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-text-secondary text-center p-10">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-danger-500 text-center p-10">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="py-5 px-4 border-b border-border">
        <div>
          <div className="text-xs text-text-tertiary">{branch?.brandName}</div>
          <h1 className="mt-1 mb-0 text-xl font-bold text-foreground">{branch?.name}</h1>
        </div>
      </header>

      {/* Products */}
      <main className="p-4 pb-[120px]">
        <h2 className="text-base font-bold mb-3 text-foreground">메뉴</h2>

        {products.length === 0 ? (
          <p className="text-text-tertiary">등록된 상품이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary cursor-pointer hover:bg-bg-tertiary transition-colors"
                onClick={() => handleSelectProduct(product)}
              >
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{product.name}</div>
                  {product.description && (
                    <div className="text-[13px] text-text-tertiary mt-1">
                      {product.description}
                    </div>
                  )}
                </div>
                <div className="font-bold text-foreground">{formatWon(product.price)}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Summary (Fixed Bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between p-3 px-4 bg-bg-secondary border-t border-border">
          <div>
            <div className="text-[13px] text-text-secondary">장바구니 {cart.length}개</div>
            <div className="font-bold text-lg text-foreground">{formatWon(totalAmount)}</div>
          </div>
          <button className="py-3 px-6 rounded-[10px] border-none bg-foreground text-background font-bold text-sm cursor-pointer" onClick={goToCheckout}>
            주문하기
          </button>
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100]" onClick={() => setSelectedProduct(null)}>
          <div className="w-full max-w-[480px] max-h-[80vh] p-5 rounded-t-2xl bg-bg-secondary overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 mb-2 text-lg text-foreground">{selectedProduct.name}</h3>
            <div className="text-text-tertiary mb-4">{formatWon(selectedProduct.price)}</div>

            {/* Options */}
            {selectedProduct.options.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold mb-2 text-foreground">옵션 선택</div>
                {selectedProduct.options.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 py-2 cursor-pointer text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.some((o) => o.id === opt.id)}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="flex-1">{opt.name}</span>
                    <span className="text-text-tertiary">
                      {opt.priceDelta > 0 ? `+${formatWon(opt.priceDelta)}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-sm font-semibold text-foreground">수량</span>
              <button
                className="w-9 h-9 rounded-lg border border-border bg-transparent text-foreground text-lg cursor-pointer"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="w-10 text-center text-foreground">{qty}</span>
              <button className="w-9 h-9 rounded-lg border border-border bg-transparent text-foreground text-lg cursor-pointer" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>

            {/* Total */}
            <div className="flex justify-between mb-4 text-foreground">
              <span>합계</span>
              <span className="font-bold text-lg">
                {formatWon(calculateItemPrice(selectedProduct, selectedOptions) * qty)}
              </span>
            </div>

            {/* Add Button */}
            <button className="w-full py-3.5 rounded-[10px] border-none bg-foreground text-background font-bold text-[15px] cursor-pointer" onClick={addToCart}>
              장바구니에 담기
            </button>
          </div>
        </div>
      )}

      {/* Cart Detail (if needed) */}
      {cart.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold mb-2 text-foreground">장바구니</h3>
          {cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 mb-2 rounded-[10px] bg-bg-secondary border border-border">
              <div className="flex-1">
                <div className="text-foreground">{item.product.name}</div>
                {item.selectedOptions.length > 0 && (
                  <div className="text-xs text-text-tertiary">
                    옵션: {item.selectedOptions.map((o) => o.name).join(", ")}
                  </div>
                )}
                <div className="text-[13px] text-text-secondary mt-1">
                  {formatWon(item.itemPrice)} × {item.qty}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">{formatWon(item.itemPrice * item.qty)}</div>
                <button
                  className="text-xs text-danger-500 bg-transparent border-none cursor-pointer"
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
