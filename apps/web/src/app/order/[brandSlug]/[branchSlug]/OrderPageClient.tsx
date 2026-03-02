"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { formatWon } from "@/lib/format";
import { saveCheckoutDraft, loadLastOrderRecord } from "@/lib/order-session";
import { KakaoQuickLoginButton } from "@/components/auth/KakaoQuickLoginButton";
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
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
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
// Props
// ============================================================

type OrderPageClientProps = {
  branch: Branch;
  products: ProductCardProduct[];
  categories: Category[];
  brandSlug: string;
  branchSlug: string;
};

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

export default function OrderPageClient({
  branch,
  products,
  categories,
  brandSlug,
  branchSlug,
}: OrderPageClientProps) {
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<ProductCardProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  // 재주문 배너
  const [lastOrderCart, setLastOrderCart] = useState<CartItem[] | null>(null);
  const [reorderDismissed, setReorderDismissed] = useState(false);

  useEffect(() => {
    const lastRecord = loadLastOrderRecord({ brandSlug, branchSlug });
    if (lastRecord && typeof lastRecord === "object") {
      const rec = lastRecord as Record<string, unknown>;
      if (Array.isArray(rec.cartSnapshot) && rec.cartSnapshot.length > 0) {
        setLastOrderCart(rec.cartSnapshot as CartItem[]);
      }
    }
  }, [brandSlug, branchSlug]);

  const handleReorder = () => {
    if (!lastOrderCart) return;
    const newQuantities: Record<string, number> = {};
    for (const item of lastOrderCart) {
      newQuantities[item.product.id] = (newQuantities[item.product.id] || 0) + item.qty;
    }
    setCart(lastOrderCart);
    setQuantities(newQuantities);
    setReorderDismissed(true);
    toast.success("저번 주문 내역을 장바구니에 담았어요!");
  };

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

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

  const handleProductClick = (product: ProductCardProduct) => {
    if (product.options && product.options.length > 0) {
      setSelectedProduct(product);
      setSelectedOptions([]);
      setQty(1);
    }
  };

  const toggleOption = (option: ProductOption) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.id === option.id);
      if (exists) return prev.filter((o) => o.id !== option.id);
      return [...prev, option];
    });
  };

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

  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const enabledFulfillmentTypes =
    branch.enabledFulfillmentTypes && branch.enabledFulfillmentTypes.length > 0
      ? branch.enabledFulfillmentTypes
      : ["PICKUP"];
  const allowedPaymentMethods =
    branch.allowedPaymentMethods && branch.allowedPaymentMethods.length > 0
      ? branch.allowedPaymentMethods
      : ["CARD", "TRANSFER", "CASH"];

  const goToCheckout = () => {
    if (cart.length === 0) {
      toast.error("장바구니에 상품을 추가해 주세요.");
      return;
    }

    saveCheckoutDraft({
      cart,
      branchId: branch.id,
      brandSlug,
      branchSlug,
      enabledFulfillmentTypes,
      allowedPaymentMethods,
      selectedFulfillmentType: enabledFulfillmentTypes[0] ?? "PICKUP",
      selectedPaymentMethod: allowedPaymentMethods[0] ?? "CARD",
    });
    router.push(`/order/${brandSlug}/${branchSlug}/checkout`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background border-b border-border">
          {branch?.coverImageUrl && (
            <div className="h-32 -mb-4 relative">
              <Image
                src={branch.coverImageUrl}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}

          <div className="px-4 py-3 flex items-center gap-3">
            {branch?.logoUrl ? (
              <Image
                src={branch.logoUrl}
                alt={branch?.name || ""}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-lg">
                B
              </div>
            )}
            <div>
              {branch?.brandName && (
                <div className="text-2xs text-text-tertiary font-medium">{branch.brandName}</div>
              )}
              <h1 className="text-lg font-bold text-foreground leading-tight">{branch?.name}</h1>
            </div>
          </div>
          <div className="px-4 pb-3">
            <KakaoQuickLoginButton />
          </div>
        </header>

        {/* ── 재주문 배너 ── */}
        {lastOrderCart && lastOrderCart.length > 0 && !reorderDismissed && cart.length === 0 && (
          <div className="mx-4 mt-4 rounded-xl border border-border bg-bg-secondary p-3 flex items-center gap-3">
            <div className="text-xl">🔄</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">저번 주문 다시 담기</div>
              <div className="text-xs text-text-tertiary truncate">
                {lastOrderCart.map((i) => `${i.product.name}×${i.qty}`).join(", ")}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleReorder}
                className="text-xs font-bold text-white bg-foreground px-3 py-1.5 rounded-lg"
              >
                담기
              </button>
              <button
                onClick={() => setReorderDismissed(true)}
                className="text-xs text-text-tertiary px-2 py-1.5"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
              <div className="text-3xl mb-3">!</div>
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
                </>
              )}

              {/* Bottom Bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-foreground text-background shadow-2xl">
                <button
                  onClick={() => setCartOpen((v) => !v)}
                  className="flex items-center gap-2 flex-1 min-w-0"
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
                  className="px-6 py-3 rounded-lg bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 active:scale-95 transition-all duration-150 touch-feedback flex-shrink-0"
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
