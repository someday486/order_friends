'use client';

import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
} from 'lucide-react';
import { businessProducts, type BusinessProduct } from '@/lib/businessMockData';

const ALL_CATEGORY = '전체보기';
const PAGE_SIZE = 36;

const PRODUCT_COPY_BY_ID: Record<string, Partial<BusinessProduct>> = {
  'prod-1': {
    name: '성주 꿀참외 3kg',
    category: '국내과일',
    supplier: '미남과일',
    shippingFee: '무료',
    cutoffLabel: '오전 10:30 마감',
    stockLabel: '재고 안정',
    emoji: '🍈',
    note: '주 3회 고정 입고 / 당도 선별 출고',
  },
  'prod-2': {
    name: '고당도 블랙오렌지 4kg',
    category: '수입과일',
    supplier: '오렌지허브',
    shippingFee: '무료',
    cutoffLabel: '오전 09:00 마감',
    stockLabel: '예약 주문',
    emoji: '🍊',
    note: '카페 납품용으로 많이 찾는 대표 과일',
  },
  'prod-3': {
    name: '당일출고 제주 햇당근 5kg',
    category: '농산물',
    supplier: '제주굿소싱',
    shippingFee: '합배송',
    cutoffLabel: '오전 10:30 마감',
    stockLabel: '재고 충분',
    emoji: '🥕',
    note: '대량 주문도 묶음 출고 가능한 기본 품목',
  },
  'prod-4': {
    name: '완도 활전복 1kg',
    category: '수산',
    supplier: '완도마켓',
    shippingFee: '무료',
    cutoffLabel: '오전 09:30 마감',
    stockLabel: '당일 확인',
    emoji: '🦪',
    note: '입고일 기준 선별 포장 / 신선도 우선',
  },
  'prod-5': {
    name: '수제 과일청 베이스 2L',
    category: '가공',
    supplier: '판교 라운지',
    shippingFee: '3,000원',
    cutoffLabel: '오후 2:00 마감',
    stockLabel: '재고 안정',
    emoji: '🍓',
    note: '카페 시즌 메뉴용 레시피 카드 포함',
  },
  'prod-6': {
    name: '한우 국거리 2kg',
    category: '축산',
    supplier: '육지발송',
    shippingFee: '무료',
    cutoffLabel: '오전 11:00 마감',
    stockLabel: '한정 수량',
    emoji: '🥩',
    note: '브랜드 행사 운영용으로 자주 묶는 품목',
  },
};

const CATALOG_VARIANTS = [
  '행사특가',
  '스토어기본',
  '카페납품',
  '주간추천',
  '당일출고',
  '대용량',
  '소분형',
  '사전예약',
];

const STOCK_LABELS = ['재고 충분', '재고 안정', '당일 확인', '한정 수량'];
const SHIPPING_LABELS = ['무료', '합배송', '3,000원'];
const CUTOFF_LABELS = ['오전 09:30 마감', '오전 10:30 마감', '오후 12:00 마감', '오후 2:00 마감'];
const CATEGORY_ORDER = ['국내과일', '수입과일', '농산물', '수산', '가공', '축산'];

function formatWon(value: number) {
  return `${value.toLocaleString()}원`;
}

function buildCatalogProducts(source: BusinessProduct[]) {
  const normalized = source.map((product) => ({
    ...product,
    ...(PRODUCT_COPY_BY_ID[product.id] ?? {}),
  }));

  return CATALOG_VARIANTS.flatMap((variant, variantIndex) =>
    normalized.map((product, productIndex) => ({
      ...product,
      id: `${product.id}-${variantIndex + 1}`,
      name: variantIndex === 0 ? product.name : `${product.name} · ${variant}`,
      price: product.price + variantIndex * 900 + (productIndex % 3) * 400,
      stockLabel: STOCK_LABELS[(variantIndex + productIndex) % STOCK_LABELS.length],
      shippingFee: SHIPPING_LABELS[(variantIndex + productIndex) % SHIPPING_LABELS.length],
      cutoffLabel: CUTOFF_LABELS[(variantIndex + productIndex) % CUTOFF_LABELS.length],
      note:
        variantIndex === 0
          ? product.note
          : `${variant} 운영에 맞춘 ${product.category} 납품형 구성`,
    })),
  );
}

function getVisiblePageNumbers(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (page >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  }

  return [page - 2, page - 1, page, page + 1, page + 2];
}

export default function BusinessProductsPage() {
  const catalogProducts = useMemo(() => buildCatalogProducts(businessProducts), []);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const allCategories = useMemo(() => {
    const categories = Array.from(new Set(catalogProducts.map((product) => product.category))).sort(
      (left, right) => {
        const leftIndex = CATEGORY_ORDER.indexOf(left);
        const rightIndex = CATEGORY_ORDER.indexOf(right);

        if (leftIndex === -1 && rightIndex === -1) {
          return left.localeCompare(right, 'ko');
        }

        if (leftIndex === -1) {
          return 1;
        }

        if (rightIndex === -1) {
          return -1;
        }

        return leftIndex - rightIndex;
      },
    );

    return [ALL_CATEGORY, ...categories];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((product) => {
      const byCategory = selectedCategory === ALL_CATEGORY || product.category === selectedCategory;
      const byKeyword =
        keyword.trim().length === 0 ||
        `${product.name} ${product.supplier} ${product.note}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase());

      return byCategory && byKeyword;
    });
  }, [catalogProducts, keyword, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredProducts]);

  const startIndex = filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = filteredProducts.length === 0 ? 0 : startIndex + pagedProducts.length - 1;

  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6">
      <section className="rounded-[28px] border border-border bg-bg-secondary p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-2xl">
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              className="input-field h-14 rounded-2xl pl-12 text-sm"
              placeholder="검색하기 · 상품명, 공급처, 메모를 입력하세요"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-tertiary">
              <Search size={18} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-[13px] text-text-secondary">
              전체상품 <span className="font-black text-foreground">{filteredProducts.length}개</span>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-[13px] text-text-secondary">
              현재페이지 <span className="font-black text-foreground">{currentPage}</span> / {totalPages}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
            >
              <Download size={16} />
              전체상품 엑셀 다운로드
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {allCategories.map((category) => {
            const active = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setSelectedCategory(category);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'border border-border bg-background text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-bg-secondary p-5 md:p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground">상품 리스트</h1>
            <p className="mt-1 text-[13px] leading-5 text-text-secondary">
              한 페이지에 36개씩, 6열 기준으로 빠르게 훑어볼 수 있게 정리했습니다.
            </p>
          </div>
          <div className="text-[13px] text-text-secondary">
            {filteredProducts.length === 0
              ? '검색 결과가 없습니다.'
              : `${startIndex} - ${endIndex} / ${filteredProducts.length}개 표시 중`}
          </div>
        </div>

        {pagedProducts.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-border bg-background text-sm text-text-secondary">
            조건에 맞는 상품이 없습니다. 검색어나 카테고리를 다시 확인해 주세요.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {pagedProducts.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-[24px] border border-border bg-background transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
                >
                  <div
                    className={`flex h-32 items-end justify-between bg-gradient-to-br ${product.accentClass} p-4`}
                  >
                    <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold text-stone-900 backdrop-blur">
                      {product.cutoffLabel}
                    </span>
                    <span className="text-3xl">{product.emoji}</span>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                        {product.category}
                      </div>
                      <h2 className="min-h-[2.5rem] break-keep text-[15px] font-black leading-5 text-foreground">
                        {product.name}
                      </h2>
                      <p className="min-h-[3rem] overflow-hidden text-[12px] leading-4 text-text-secondary">
                        {product.note}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-bg-secondary p-3">
                      <InfoBlock label="공급처" value={product.supplier} />
                      <InfoBlock label="최소수량" value={`${product.minOrderQty}박스`} />
                      <InfoBlock label="배송비" value={product.shippingFee} />
                      <InfoBlock label="재고" value={product.stockLabel} />
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-text-tertiary">공급가</div>
                        <div className="mt-1 text-lg font-black text-rose-600">
                          {formatWon(product.price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-2xl bg-foreground px-3 py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
                      >
                        발주 담기
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="첫 페이지"
                >
                  <ChevronsLeft size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="mx-2 flex items-center gap-1">
                  {visiblePageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`h-9 w-9 rounded-full text-sm font-bold transition-all duration-150 ${
                        currentPage === pageNumber
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-secondary text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="마지막 페이지"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-tertiary">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-foreground">{value}</div>
    </div>
  );
}
