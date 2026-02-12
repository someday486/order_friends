"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { formatWon } from "@/lib/format";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";

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
  image_url?: string | null;
  category_name?: string | null;
  categoryName?: string | null;
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
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 장바구니
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // 상품 선택 모달
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [qty, setQty] = useState(1);

  const categories = useMemo(() => {
    const names = products
      .map((product) => product.category_name ?? product.categoryName)
      .filter((name): name is string => Boolean(name));
    return ["전체", ...Array.from(new Set(names))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "전체") return products;
    return products.filter((product) => {
      const name = product.category_name ?? product.categoryName;
      return name === selectedCategory;
    });
  }, [products, selectedCategory]);

  // 데이터 로드
  useEffect(() => {
    if (!branchId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 가게 정보
        const branchData = await apiClient.get<Branch>(`/public/branches/${branchId}`, { auth: false });
        setBranch(branchData);

        // 상품 목록
        const productsData = await apiClient.get<Product[]>(`/public/branches/${branchId}/products`, { auth: false });
        setProducts(productsData);
      } catch (e: unknown) {
        const message = (e as Error)?.message ?? "오류가 발생했습니다.";
        setError(message.includes("404") ? "가게를 찾을 수 없습니다." : message);
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
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // 주문하기
  const goToCheckout = () => {
    if (cart.length === 0) {
      toast.error("장바구니에 상품을 추가해주세요.");
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

        {categories.length > 1 && (
          <div className="category-tabs mb-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`category-tab ${selectedCategory === category ? "category-tab-active" : ""}`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <p className="text-text-tertiary">등록된 상품이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary cursor-pointer hover:bg-bg-tertiary transition-colors"
                onClick={() => handleSelectProduct(product)}
              >
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
                      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
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

      {/* Floating Cart Bar with expandable cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-lg mx-auto">
            {/* Expandable Cart Items */}
            {cartOpen && (
              <>
                <div className="fixed inset-0 bg-black/40 -z-10" onClick={() => setCartOpen(false)} />
                <div className="bg-background border border-border border-b-0 rounded-t-xl max-h-[50vh] overflow-y-auto shadow-2xl">
                  <div className="sticky top-0 bg-background px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">장바구니 ({totalItems})</h3>
                    <button
                      onClick={() => setCartOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{item.product.name}</div>
                          {item.selectedOptions.length > 0 && (
                            <div className="text-2xs text-text-tertiary">
                              {item.selectedOptions.map((o) => o.name).join(", ")}
                            </div>
                          )}
                          <div className="text-xs text-text-secondary mt-0.5">
                            {formatWon(item.itemPrice)} × {item.qty}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{formatWon(item.itemPrice * item.qty)}</div>
                          <button className="text-2xs text-danger-500 font-medium mt-0.5 bg-transparent border-none cursor-pointer" onClick={() => removeFromCart(idx)}>
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Bottom Bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-foreground text-background shadow-2xl">
              <button
                onClick={() => setCartOpen((v) => !v)}
                className="flex items-center gap-2 flex-1 min-w-0 text-background"
              >
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center leading-none">
                    {totalItems}
                  </span>
                </div>
                <div className="ml-1 text-left">
                  <div className="text-lg font-extrabold leading-tight">{formatWon(totalAmount)}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`ml-1 opacity-60 transition-transform ${cartOpen ? "rotate-180" : ""}`}>
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
              <button
                onClick={goToCheckout}
                className="px-6 py-3 rounded-lg bg-primary-500 text-white font-bold text-sm cursor-pointer flex-shrink-0"
              >
                주문하기
              </button>
            </div>
          </div>
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
    </div>
  );
}
