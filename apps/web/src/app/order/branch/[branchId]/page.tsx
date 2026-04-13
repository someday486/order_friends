'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatPhone, formatWon } from '@/lib/format';
import { apiClient } from '@/lib/api-client';
import {
  getAllowedPaymentMethodsForBillingTier,
  resolveBillingTier,
} from '@/lib/billing-tier';
import { loadLastOrderRecord, saveCheckoutDraft } from '@/lib/order-session';
import toast from 'react-hot-toast';
import { PublicAuthActions } from '@/components/auth/PublicAuthActions';

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
  is_featured?: boolean;
  options: ProductOption[];
};

type Branch = {
  id: string;
  name: string;
  brandName?: string;
  billingTier?: 'PG' | 'NON_PG' | null;
  cashReceiptEnabled?: boolean | null;
  address?: string | null;
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
  isActive?: boolean;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  orderNotice?: string | null;
};

function toTelHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

type CartItem = {
  product: Product;
  qty: number;
  selectedOptions: ProductOption[];
  itemPrice: number;
};

// ============================================================
// Helpers
// ============================================================

function calculateItemPrice(
  product: Product,
  selectedOptions: ProductOption[],
) {
  let price = product.price;
  for (const opt of selectedOptions) {
    price += opt.priceDelta;
  }
  return price;
}

function getFulfillmentLabel(type: string) {
  if (type === 'PICKUP') return '포장';
  if (type === 'DELIVERY') return '배달';
  if (type === 'SHIPPING') return '택배';
  if (type === 'DINE_IN') return '매장';
  return type;
}

// ============================================================
// Skeleton Component
// ============================================================

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-bg-secondary border-b border-border p-4 pb-5">
        <div className="h-3 w-20 bg-bg-tertiary rounded mb-3" />
        <div className="h-7 w-48 bg-bg-tertiary rounded mb-2" />
        <div className="h-3 w-36 bg-bg-tertiary rounded mb-4" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
          <div className="h-6 w-12 bg-bg-tertiary rounded-full" />
        </div>
      </div>
      {/* Category tabs skeleton */}
      <div className="flex gap-2 px-4 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-16 bg-bg-tertiary rounded-full" />
        ))}
      </div>
      {/* Products skeleton */}
      <div className="p-4 flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex gap-3 p-4 rounded-xl border border-border bg-bg-secondary"
          >
            <div className="w-16 h-16 rounded-lg bg-bg-tertiary shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-32 bg-bg-tertiary rounded" />
              <div className="h-3 w-24 bg-bg-tertiary rounded" />
              <div className="h-3 w-16 bg-bg-tertiary rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 장바구니
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const isFirstAddRef = useRef(true);

  // 재주문 배너
  const [lastOrderCart, setLastOrderCart] = useState<CartItem[] | null>(null);
  const [reorderDismissed, setReorderDismissed] = useState(false);

  // 상품 선택 모달
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [qty, setQty] = useState(1);
  const productDialogTitleId = 'branch-order-product-dialog-title';

  useEffect(() => {
    const branchName = branch?.name?.trim();
    document.title = branchName
      ? `${branchName} | 오더프렌즈`
      : '오더프렌즈';
  }, [branch?.name]);

  const categories = useMemo(() => {
    const names = products
      .map((product) => product.category_name ?? product.categoryName)
      .filter((name): name is string => Boolean(name));
    return ['전체', ...Array.from(new Set(names))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === '전체') return products;
    return products.filter((product) => {
      const name = product.category_name ?? product.categoryName;
      return name === selectedCategory;
    });
  }, [products, selectedCategory]);

  const featuredProducts = useMemo(
    () => products.filter((p) => p.is_featured),
    [products],
  );

  // 데이터 로드
  useEffect(() => {
    if (!branchId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [branchData, productsData] = await Promise.all([
          apiClient.get<Branch>(`/public/branches/${branchId}`, {
            auth: false,
          }),
          apiClient.get<Product[]>(`/public/branches/${branchId}/products`, {
            auth: false,
          }),
        ]);
        setBranch(branchData);
        setProducts(productsData);

        // 재주문 배너 체크
        const lastRecord = loadLastOrderRecord({ branchId });
        if (lastRecord && typeof lastRecord === 'object') {
          const rec = lastRecord as Record<string, unknown>;
          if (Array.isArray(rec.cartSnapshot) && rec.cartSnapshot.length > 0) {
            setLastOrderCart(rec.cartSnapshot as CartItem[]);
          }
        }
      } catch (e: unknown) {
        const message = (e as Error)?.message ?? '오류가 발생했습니다.';
        setError(
          message.includes('404') ? '가게를 찾을 수 없습니다.' : message,
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
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
      if (exists) return prev.filter((o) => o.id !== option.id);
      return [...prev, option];
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

    // 첫 담기 때 bounce 애니메이션
    if (isFirstAddRef.current) {
      isFirstAddRef.current = false;
    }
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);

    setSelectedProduct(null);
    setSelectedOptions([]);
    setQty(1);
  };

  // 재주문: 저번 주문 다시 담기
  const handleReorder = () => {
    if (!lastOrderCart) return;
    setCart(lastOrderCart);
    setReorderDismissed(true);
    toast.success('저번 주문 내역을 장바구니에 담았어요!');
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);
  };

  useEffect(() => {
    if (!selectedProduct) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedProduct(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedProduct]);

  // 장바구니에서 제거
  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // 총액 계산
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.itemPrice * item.qty,
    0,
  );
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const enabledFulfillmentTypes =
    branch?.enabledFulfillmentTypes && branch.enabledFulfillmentTypes.length > 0
      ? branch.enabledFulfillmentTypes
      : ['PICKUP'];
  const effectiveBillingTier = resolveBillingTier(
    branch?.billingTier,
    branch?.allowedPaymentMethods,
  );
  const allowedPaymentMethods =
    getAllowedPaymentMethodsForBillingTier(effectiveBillingTier);

  // 주문하기
  const goToCheckout = () => {
    if (cart.length === 0) {
      toast.error('장바구니에 상품을 추가해주세요.');
      return;
    }

    saveCheckoutDraft({
      cart,
      branchId,
      enabledFulfillmentTypes,
      allowedPaymentMethods,
      selectedFulfillmentType: enabledFulfillmentTypes[0] ?? 'PICKUP',
      selectedPaymentMethod:
        getAllowedPaymentMethodsForBillingTier(effectiveBillingTier)[0] ??
        'CARD',
    });
    router.push(`/order/branch/${branchId}/checkout`);
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) return <MenuSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-danger-500 font-semibold mb-2">{error}</p>
          <p className="text-text-tertiary text-sm">
            링크를 다시 확인해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero Header ── */}
      <header className="bg-bg-secondary border-b border-border">
        <div className="p-4 pb-3">
          {branch?.brandName && (
            <div className="text-xs text-text-tertiary mb-1">
              {branch.brandName}
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-foreground mb-1 leading-tight">
            {branch?.name}
          </h1>
          {branch?.address && (
            <div className="flex items-start gap-1 text-xs text-text-secondary mb-3">
              <svg
                className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                />
              </svg>
              <span>{branch.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 영업 상태 */}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-600 bg-success-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
              영업중
            </span>
            {/* 주문 방식 태그 */}
            {enabledFulfillmentTypes.map((type) => (
              <span
                key={type}
                className="text-xs text-text-tertiary bg-bg-tertiary px-2.5 py-1 rounded-full"
              >
                {getFulfillmentLabel(type)}
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 pb-4">
          <PublicAuthActions />
        </div>
      </header>

      {/* ── 재주문 배너 ── */}
      {lastOrderCart &&
        lastOrderCart.length > 0 &&
        !reorderDismissed &&
        cart.length === 0 && (
          <div className="mx-4 mt-4 rounded-xl border border-border bg-bg-secondary p-3 flex items-center gap-3 animate-slide-down">
            <div className="text-xl">🔄</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">
                저번 주문 다시 담기
              </div>
              <div className="text-xs text-text-tertiary truncate">
                {lastOrderCart
                  .map((i) => `${i.product.name}×${i.qty}`)
                  .join(', ')}
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

      {branch?.orderNotice?.trim() && (
        <div
          data-testid="order-notice-banner"
          className="mx-4 mt-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none">📢</span>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wide text-warning-800">
                가게 공지
              </div>
              <p className="mt-1 text-sm text-warning-900 whitespace-pre-wrap break-words">
                {branch.orderNotice.trim()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {(branch?.contactPhone?.trim() || branch?.kakaoChannelUrl?.trim()) && (
        <div className="mx-4 mt-4 rounded-xl border border-border bg-bg-secondary px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
            문의 안내
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {branch?.contactPhone?.trim() && (
              <a
                href={toTelHref(branch.contactPhone.trim()) ?? undefined}
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-bg-tertiary transition-colors"
              >
                전화 문의 {formatPhone(branch.contactPhone.trim())}
              </a>
            )}
            {branch?.kakaoChannelUrl?.trim() && (
              <a
                href={branch.kakaoChannelUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-bg-tertiary transition-colors"
              >
                카카오톡 상담
              </a>
            )}
          </div>
        </div>
      )}

      <main className="p-4 pb-[120px]">
        {/* 추천 메뉴 섹션 */}
        {featuredProducts.length > 0 && selectedCategory === '전체' && (
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-2 text-text-secondary flex items-center gap-1">
              <span>⭐</span> 추천 메뉴
            </h2>
            <div className="flex flex-col gap-2">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={`featured-${product.id}`}
                  product={product}
                  isFeatured
                  onClick={() => handleSelectProduct(product)}
                />
              ))}
            </div>
          </div>
        )}

        <h2 className="text-sm font-bold mb-3 text-text-secondary">
          전체 메뉴
        </h2>

        {/* 카테고리 탭 (오른쪽 페이드 그라데이션) */}
        {categories.length > 1 && (
          <div className="relative mb-3 -mx-4">
            <div className="category-tabs">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-tab ${selectedCategory === category ? 'category-tab-active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
            {/* 오른쪽 페이드 - 더 많은 탭이 있음을 암시 */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent" />
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-3">🍽️</div>
            <p className="text-text-tertiary">등록된 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => handleSelectProduct(product)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Floating Cart Bar ── */}
      {cart.length > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 ${cartBounce ? 'animate-pop' : ''}`}
        >
          <div className="max-w-lg mx-auto">
            {/* Expandable Cart Items */}
            {cartOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/40 -z-10"
                  onClick={() => setCartOpen(false)}
                />
                <div className="bg-background border border-border border-b-0 rounded-t-xl max-h-[50vh] overflow-y-auto shadow-2xl">
                  <div className="sticky top-0 bg-background px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">
                      장바구니 ({totalItems})
                    </h3>
                    <button
                      onClick={() => setCartOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {cart.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary border border-border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {item.product.name}
                          </div>
                          {item.selectedOptions.length > 0 && (
                            <div className="text-2xs text-text-tertiary">
                              {item.selectedOptions
                                .map((o) => o.name)
                                .join(', ')}
                            </div>
                          )}
                          <div className="text-xs text-text-secondary mt-0.5">
                            {formatWon(item.itemPrice)} × {item.qty}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">
                            {formatWon(item.itemPrice * item.qty)}
                          </div>
                          <button
                            className="text-2xs text-danger-500 font-medium mt-0.5 bg-transparent border-none cursor-pointer"
                            onClick={() => removeFromCart(idx)}
                          >
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
            <div className="flex items-center gap-2 bg-foreground px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-background shadow-2xl">
              <button
                onClick={() => setCartOpen((v) => !v)}
                className="flex items-center gap-2 flex-1 min-w-0 text-background"
              >
                <div className="relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center leading-none">
                    {totalItems}
                  </span>
                </div>
                <div className="ml-1 text-left">
                  <div className="text-lg font-extrabold leading-tight">
                    {formatWon(totalAmount)}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-1 opacity-60 transition-transform ${cartOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                onClick={goToCheckout}
                className="px-6 py-3 rounded-lg bg-primary-500 text-white font-bold text-sm cursor-pointer flex-shrink-0 active:scale-95 transition-transform"
              >
                주문하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Modal ── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100]"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-[480px] max-h-[80vh] p-5 rounded-t-2xl bg-bg-secondary overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={productDialogTitleId}
          >
            {selectedProduct.image_url && (
              <Image
                src={selectedProduct.image_url}
                alt={selectedProduct.name}
                width={480}
                height={180}
                className="w-full h-36 object-cover rounded-xl mb-4"
              />
            )}
            <h3
              id={productDialogTitleId}
              className="m-0 mb-1 text-lg font-bold text-foreground"
            >
              {selectedProduct.name}
            </h3>
            {selectedProduct.description && (
              <p className="text-sm text-text-tertiary mb-3">
                {selectedProduct.description}
              </p>
            )}
            <div className="text-text-secondary mb-4 text-sm">
              {formatWon(selectedProduct.price)}
            </div>

            {/* 옵션 */}
            {selectedProduct.options.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold mb-2 text-foreground">
                  옵션 선택
                </div>
                {selectedProduct.options.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-3 py-2.5 cursor-pointer text-foreground border-b border-border last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.some((o) => o.id === opt.id)}
                      onChange={() => toggleOption(opt)}
                      className="w-4 h-4 accent-primary-500"
                    />
                    <span className="flex-1 text-sm">{opt.name}</span>
                    {opt.priceDelta > 0 && (
                      <span className="text-xs text-text-tertiary">
                        +{formatWon(opt.priceDelta)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* 수량 */}
            <div className="flex items-center gap-4 mb-5">
              <span className="text-sm font-semibold text-foreground">
                수량
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  className="w-10 h-10 rounded-xl border border-border bg-transparent text-foreground text-lg cursor-pointer active:bg-bg-tertiary touch-feedback"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="w-10 text-center font-semibold text-foreground text-base">
                  {qty}
                </span>
                <button
                  className="w-10 h-10 rounded-xl border border-border bg-transparent text-foreground text-lg cursor-pointer active:bg-bg-tertiary touch-feedback"
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-between mb-5 text-foreground">
              <span className="text-sm text-text-secondary">합계</span>
              <span className="font-extrabold text-xl text-foreground">
                {formatWon(
                  calculateItemPrice(selectedProduct, selectedOptions) * qty,
                )}
              </span>
            </div>

            {/* 담기 버튼 */}
            <button
              className="w-full py-4 rounded-xl border-none bg-foreground text-background font-bold text-base cursor-pointer active:opacity-80 transition-opacity"
              onClick={addToCart}
            >
              장바구니에 담기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ProductCard Sub-Component
// ============================================================

function ProductCard({
  product,
  isFeatured = false,
  onClick,
}: {
  product: Product;
  isFeatured?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors active:bg-bg-tertiary touch-feedback ${
        isFeatured
          ? 'border-primary-200 bg-primary-50'
          : 'border-border bg-bg-secondary hover:bg-bg-tertiary'
      }`}
      onClick={onClick}
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
          {/* 커피컵 아이콘 */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-text-tertiary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
            />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="font-semibold text-foreground text-sm">
            {product.name}
          </div>
          {isFeatured && (
            <span className="badge-recommended text-[10px] px-1.5 py-0.5">
              추천
            </span>
          )}
        </div>
        {product.description && (
          <div className="text-xs text-text-tertiary mt-0.5 line-clamp-1">
            {product.description}
          </div>
        )}
        <div className="font-bold text-foreground text-sm mt-1">
          {formatWon(product.price)}
        </div>
      </div>
      <div className="shrink-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-light">
        +
      </div>
    </div>
  );
}
