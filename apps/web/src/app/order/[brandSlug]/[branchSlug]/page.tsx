"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ProductCard,
  type ProductCardProduct,
  type ProductOption,
} from "@/components/ui/ProductCard";

// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  name: string;
  brandName?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
};

type Category = {
  id: string;
  name: string;
  sortOrder?: number;
};

type CartItem = {
  product: ProductCardProduct;
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

function calculateItemPrice(
  product: ProductCardProduct,
  selectedOptions: ProductOption[],
) {
  let price = product.discountPrice ?? product.price;
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
  const brandSlug = params?.brandSlug as string;
  const branchSlug = params?.branchSlug as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 장바구니
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // 상품 선택 모달
  const [selectedProduct, setSelectedProduct] = useState<ProductCardProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [qty, setQty] = useState(1);

  // 데이터 로드
  useEffect(() => {
    if (!brandSlug || !branchSlug) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const branchRes = await fetch(
          `${API_BASE}/public/brands/${encodeURIComponent(brandSlug)}/branches/${encodeURIComponent(branchSlug)}`,
        );
        if (!branchRes.ok) throw new Error("가게를 찾을 수 없습니다.");
        const branchData = await branchRes.json();
        setBranch(branchData);
        setBranchId(branchData.id);

        const productsRes = await fetch(
          `${API_BASE}/public/branches/${encodeURIComponent(branchData.id)}/products`,
        );
        if (!productsRes.ok) throw new Error("상품을 불러올 수 없습니다.");
        const productsData = await productsRes.json();

        // Map to ProductCardProduct format
        const mapped: ProductCardProduct[] = productsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          discountPrice: p.discountPrice,
          imageUrl: p.imageUrl || p.image_url || null,
          badges: p.badges,
          stock: p.stock,
          options: p.options,
        }));
        setProducts(mapped);

        // Fetch categories from API (sorted by server-defined order)
        const catsRes = await fetch(
          `${API_BASE}/public/branches/${encodeURIComponent(branchData.id)}/categories`,
        );
        if (catsRes.ok) {
          const catsData = await catsRes.json();
          setCategories(catsData);
        }
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [brandSlug, branchSlug]);

  // 카테고리 필터링
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p: any) => {
      const catId = p.categoryId || p.category_id;
      return catId === selectedCategory;
    });
  }, [products, selectedCategory]);

  // 수량 변경
  const handleQuantityChange = (productId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: quantity }));

    if (quantity === 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      setCart((prev) => {
        const existing = prev.findIndex((item) => item.product.id === productId);
        const itemPrice = product.discountPrice ?? product.price;

        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], qty: quantity, itemPrice };
          return updated;
        }

        return [...prev, { product, qty: quantity, selectedOptions: [], itemPrice }];
      });
    }
  };

  // 상품 클릭 (옵션 있으면 모달)
  const handleProductClick = (product: ProductCardProduct) => {
    if (product.options && product.options.length > 0) {
      setSelectedProduct(product);
      setSelectedOptions([]);
      setQty(1);
    }
  };

  // 옵션 토글
  const toggleOption = (option: ProductOption) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.id === option.id);
      if (exists) return prev.filter((o) => o.id !== option.id);
      return [...prev, option];
    });
  };

  // 장바구니 추가 (모달에서)
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

    setQuantities((prev) => ({
      ...prev,
      [selectedProduct.id]: (prev[selectedProduct.id] || 0) + qty,
    }));

    setSelectedProduct(null);
    setSelectedOptions([]);
    setQty(1);
  };

  // 장바구니에서 제거
  const removeFromCart = (index: number) => {
    const item = cart[index];
    setCart((prev) => prev.filter((_, i) => i !== index));
    if (item) {
      setQuantities((prev) => ({
        ...prev,
        [item.product.id]: Math.max(0, (prev[item.product.id] || 0) - item.qty),
      }));
    }
  };

  // 총액
  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // 주문하기
  const goToCheckout = () => {
    if (cart.length === 0) {
      alert("장바구니에 상품을 추가해 주세요.");
      return;
    }
    if (!branchId) {
      alert("가게 정보를 불러오는 중입니다.");
      return;
    }

    sessionStorage.setItem("orderCart", JSON.stringify(cart));
    sessionStorage.setItem("orderBranchId", branchId);
    sessionStorage.setItem("orderBrandSlug", brandSlug);
    sessionStorage.setItem("orderBranchSlug", branchSlug);
    router.push(`/order/${brandSlug}/${branchSlug}/checkout`);
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-lg mx-auto">
          <div className="p-4 border-b border-border">
            <div className="h-4 w-20 bg-bg-tertiary rounded animate-pulse mb-2" />
            <div className="h-6 w-40 bg-bg-tertiary rounded animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[140px] bg-bg-secondary rounded-md border border-border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-danger-500 text-lg font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background border-b border-border">
          {branch?.coverImageUrl && (
            <div className="h-32 -mb-4 relative">
              <img src={branch.coverImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}

          <div className="px-4 py-3 flex items-center gap-3">
            {branch?.logoUrl ? (
              <img
                src={branch.logoUrl}
                alt={branch?.name || ""}
                className="w-10 h-10 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-lg">
                🏪
              </div>
            )}
            <div>
              {branch?.brandName && (
                <div className="text-2xs text-text-tertiary font-medium">{branch.brandName}</div>
              )}
              <h1 className="text-lg font-bold text-foreground leading-tight">{branch?.name}</h1>
            </div>
          </div>
        </header>

        {/* Category Tabs */}
        {categories.length > 0 && (
          <div className="category-tabs sticky top-[56px] z-20 bg-background border-b border-border-light">
            <button
              className={`category-tab ${selectedCategory === null ? "category-tab-active" : ""}`}
              onClick={() => setSelectedCategory(null)}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`category-tab ${selectedCategory === cat.id ? "category-tab-active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products */}
        <main className="p-4 pb-36">
          <h2 className="text-base font-bold text-foreground mb-3">
            메뉴
            {filteredProducts.length > 0 && (
              <span className="text-text-tertiary text-sm font-normal ml-2">
                {filteredProducts.length}개
              </span>
            )}
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary">
              <div className="text-3xl mb-3">🍽</div>
              <p>등록된 상품이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] || 0}
                  onQuantityChange={(q) => handleQuantityChange(product.id, q)}
                  onCardClick={() => handleProductClick(product)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-bold text-foreground mb-2">장바구니</h3>
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-md bg-bg-secondary border border-border animate-fade-in">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.product.name}</div>
                    {item.selectedOptions.length > 0 && (
                      <div className="text-2xs text-text-tertiary">
                        옵션: {item.selectedOptions.map((o) => o.name).join(", ")}
                      </div>
                    )}
                    <div className="text-xs text-text-secondary mt-0.5">
                      {formatWon(item.itemPrice)} x {item.qty}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-foreground">{formatWon(item.itemPrice * item.qty)}</div>
                    <button className="text-2xs text-danger-500 font-medium mt-0.5" onClick={() => removeFromCart(idx)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Floating Cart Bar */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background rounded-t-lg shadow-2xl">
                <div>
                  <div className="text-xs opacity-70">{totalItems}개 상품</div>
                  <div className="text-lg font-extrabold">{formatWon(totalAmount)}</div>
                </div>
                <button
                  onClick={goToCheckout}
                  className="px-6 py-3 rounded-md bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 active:scale-95 transition-all duration-150 touch-feedback"
                >
                  주문하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center" onClick={() => setSelectedProduct(null)}>
            <div className="w-full max-w-lg bg-background rounded-t-xl p-5 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground mb-1">{selectedProduct.name}</h3>
              <div className="text-text-secondary mb-4">{formatWon(selectedProduct.discountPrice ?? selectedProduct.price)}</div>

              {selectedProduct.options && selectedProduct.options.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-bold text-foreground mb-2">옵션 선택</div>
                  {selectedProduct.options.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 py-3 border-b border-border-light cursor-pointer touch-feedback">
                      <input
                        type="checkbox"
                        checked={selectedOptions.some((o) => o.id === opt.id)}
                        onChange={() => toggleOption(opt)}
                        className="w-5 h-5 rounded accent-primary"
                      />
                      <span className="flex-1 text-sm text-foreground">{opt.name}</span>
                      <span className="text-sm text-text-secondary">
                        {opt.priceDelta > 0 ? `+${formatWon(opt.priceDelta)}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-bold text-foreground">수량</span>
                <div className="flex items-center gap-3">
                  <button
                    className="w-9 h-9 rounded-full border border-border bg-bg-secondary text-foreground flex items-center justify-center text-lg hover:bg-bg-tertiary active:scale-90 transition-all touch-feedback"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-foreground tabular-nums">{qty}</span>
                  <button
                    className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center text-lg font-bold hover:bg-primary-600 active:scale-90 transition-all touch-feedback"
                    onClick={() => setQty((q) => q + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 pt-3 border-t border-border">
                <span className="text-sm text-text-secondary">합계</span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatWon(calculateItemPrice(selectedProduct, selectedOptions) * qty)}
                </span>
              </div>

              <button
                className="w-full py-4 rounded-md bg-primary-500 text-white font-bold text-base hover:bg-primary-600 active:scale-95 transition-all touch-feedback"
                onClick={addToCart}
              >
                장바구니에 담기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
