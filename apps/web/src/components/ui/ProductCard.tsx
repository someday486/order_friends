"use client";

import { FC, useMemo, useState } from "react";
import Image from "next/image";
import { QuantityControl } from "./QuantityControl";

export interface ProductBadge {
  type: "recommended" | "event" | "soldout-soon" | "new" | "hot";
  label: string;
}

export interface ProductOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ProductCardProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number;
  urgentDiscountEndAt?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  categoryId?: string | null;
  sortOrder?: number | null;
  badges?: ProductBadge[];
  stock?: { available: number; threshold: number };
  options?: ProductOption[];
}

export interface ProductCardProps {
  product: ProductCardProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onCardClick?: () => void;
  nowTs?: number;
}

const badgeClasses: Record<ProductBadge["type"], string> = {
  recommended: "badge-recommended",
  event: "badge-event",
  new: "badge-new",
  hot: "badge-hot",
  "soldout-soon": "badge-soldout-soon",
};

function formatUrgentDiscountDeadline(urgentDiscountEndAt: string, nowTs: number) {
  const endDate = new Date(urgentDiscountEndAt);
  if (Number.isNaN(endDate.getTime())) return null;

  const nowDate = new Date(nowTs);
  const isSameYear = endDate.getFullYear() === nowDate.getFullYear();
  const isSameMonth = endDate.getMonth() === nowDate.getMonth();
  const isSameDate = endDate.getDate() === nowDate.getDate();
  const hh = String(endDate.getHours()).padStart(2, "0");
  const mm = String(endDate.getMinutes()).padStart(2, "0");

  if (isSameYear && isSameMonth && isSameDate) {
    return `오늘 ${hh}:${mm} 마감`;
  }
  return `${endDate.getMonth() + 1}/${endDate.getDate()} ${hh}:${mm} 마감`;
}

function formatUrgentDiscountCountdown(diffMs: number) {
  if (diffMs <= 0) return "00:00:00";

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const remain = totalSeconds % 86400;
  const hours = Math.floor(remain / 3600);
  const minutes = Math.floor((remain % 3600) / 60);
  const seconds = remain % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (days > 0) {
    return `${days}일 ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

function getUrgentDiscountChipMeta(
  urgentDiscountEndAt: string | null | undefined,
  nowTs: number,
) {
  if (!Number.isFinite(nowTs) || nowTs <= 0) return null;
  if (!urgentDiscountEndAt) return null;
  const endTs = Date.parse(urgentDiscountEndAt);
  if (Number.isNaN(endTs)) return null;

  const deadlineLabel = formatUrgentDiscountDeadline(urgentDiscountEndAt, nowTs);
  if (!deadlineLabel) return null;
  const countdownLabel = formatUrgentDiscountCountdown(endTs - nowTs);
  return { deadlineLabel, countdownLabel };
}

export const ProductCard: FC<ProductCardProps> = ({
  product,
  quantity,
  onQuantityChange,
  onCardClick,
  nowTs,
}) => {
  const [imgError, setImgError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const canOpenDetail = typeof onCardClick === "function";
  const effectiveNowTs = nowTs ?? 0;

  const imageUrls = useMemo(() => {
    const list = Array.isArray(product.imageUrls)
      ? product.imageUrls
          .filter((url): url is string => Boolean(url && url.trim()))
          .map((url) => url.trim())
      : [];
    if (list.length > 0) return list;
    if (product.imageUrl && product.imageUrl.trim()) return [product.imageUrl.trim()];
    return [];
  }, [product.imageUrl, product.imageUrls]);

  const safeImageIndex =
    imageUrls.length > 0
      ? Math.min(currentImageIndex, imageUrls.length - 1)
      : 0;
  const currentImageUrl = imageUrls[safeImageIndex] ?? null;

  const hasDiscount =
    product.discountPrice !== undefined && product.discountPrice < product.price;
  const urgentDiscountChipMeta = hasDiscount
    ? getUrgentDiscountChipMeta(product.urgentDiscountEndAt, effectiveNowTs)
    : null;
  const discountRate = hasDiscount
    ? Math.round(
        ((product.price - product.discountPrice!) / product.price) * 100,
      )
    : 0;
  const finalPrice = hasDiscount ? product.discountPrice! : product.price;

  const isSoldOut = product.stock?.available === 0;
  const isLowStock =
    product.stock &&
    product.stock.available <= product.stock.threshold &&
    product.stock.available > 0;

  return (
    <div className="relative w-full animate-fade-in">
      <div
        className={`
          card grid grid-cols-[1fr_100px] grid-rows-[auto_auto] min-h-[120px]
          overflow-hidden transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-lg
          ${isSoldOut ? "opacity-60" : ""}
        `}
      >
        {/* Product Info */}
        <button
          type="button"
          className={`col-start-1 row-start-1 p-3 flex flex-col gap-1 overflow-hidden text-left border-0 bg-transparent ${
            canOpenDetail ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={onCardClick}
          disabled={!canOpenDetail}
          aria-label={`${product.name} 상세 보기`}
        >
          {/* Badges */}
          {product.badges && product.badges.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {product.badges.map((badge, idx) => (
                <span key={idx} className={badgeClasses[badge.type]}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
          {hasDiscount && (
            <div className="flex gap-1 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-danger-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse-slow">
                ⚡ 긴급할인
              </span>
              {urgentDiscountChipMeta && (
                <>
                  <span className="inline-flex items-center rounded-full bg-danger-500/10 border border-danger-500/30 px-2 py-0.5 text-[10px] font-semibold text-danger-600">
                    {urgentDiscountChipMeta.deadlineLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-warning-500/15 border border-warning-500/40 px-2 py-0.5 text-[10px] font-extrabold text-warning-600">
                    ⏱ {urgentDiscountChipMeta.countdownLabel}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Name */}
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 break-keep">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-xs text-text-tertiary line-clamp-1">
              {product.description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-center gap-1 flex-wrap mt-auto pt-1">
            {hasDiscount && (
              <span className="text-sm font-extrabold text-danger-500">
                {discountRate}%
              </span>
            )}
            {hasDiscount ? (
              <span className="flex items-end gap-1.5">
                <span className="line-through text-xs text-text-tertiary">
                  {product.price.toLocaleString()}원
                </span>
                <span className="text-lg font-extrabold text-danger-500">
                  {finalPrice.toLocaleString()}
                  <span className="text-xs font-medium ml-0.5">원</span>
                </span>
              </span>
            ) : (
              <span className="text-base font-extrabold text-foreground">
                {finalPrice.toLocaleString()}
                <span className="text-xs font-medium ml-0.5">원</span>
              </span>
            )}

            {isLowStock && (
              <span className="text-2xs text-warning-500 font-bold animate-pulse-slow ml-1">
                품절임박
              </span>
            )}
          </div>
        </button>

        {/* Thumbnail */}
        <div
          role={canOpenDetail ? "button" : undefined}
          tabIndex={canOpenDetail ? 0 : -1}
          className={`col-start-2 row-start-1 w-[100px] h-[100px] relative bg-bg-tertiary overflow-hidden group border-0 p-0 ${
            canOpenDetail ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={canOpenDetail ? onCardClick : undefined}
          onKeyDown={
            canOpenDetail
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCardClick?.();
                  }
                }
              : undefined
          }
          aria-label={`${product.name} 이미지 상세 보기`}
        >
          {currentImageUrl && !imgError ? (
            <Image
              src={currentImageUrl}
              alt={product.name}
              width={100}
              height={100}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-text-tertiary">
              🍽
            </div>
          )}

          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImgError(false);
                  setCurrentImageIndex((prev) =>
                    prev === 0 ? imageUrls.length - 1 : prev - 1,
                  );
                }}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/55 text-white text-[11px] leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="이전 이미지"
              >
                {"<"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImgError(false);
                  setCurrentImageIndex((prev) =>
                    prev === imageUrls.length - 1 ? 0 : prev + 1,
                  );
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/55 text-white text-[11px] leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="다음 이미지"
              >
                {">"}
              </button>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
                {imageUrls.slice(0, 5).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full ${
                      idx === safeImageIndex ? "bg-white" : "bg-white/45"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Sold Out Overlay */}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-sm font-bold">품절</span>
            </div>
          )}
        </div>

        {/* Quantity Control Row */}
        <div className="col-span-2 row-start-2 border-t border-border flex items-center justify-between px-3 py-2">
          <div className="text-xs text-text-secondary">
            {quantity > 0 && (
              <span className="font-semibold text-foreground">
                소계: {(finalPrice * quantity).toLocaleString()}원
              </span>
            )}
          </div>
          <QuantityControl
            value={quantity}
            min={0}
            max={product.stock?.available ?? 99}
            stock={product.stock?.available}
            stockThreshold={product.stock?.threshold}
            onChange={onQuantityChange}
            disabled={isSoldOut}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
};

/* Grid wrapper */
export interface ProductGridProps {
  products: ProductCardProduct[];
  quantities: Record<string, number>;
  onQuantityChange: (productId: string, quantity: number) => void;
  onProductClick?: (product: ProductCardProduct) => void;
}

export const ProductGrid: FC<ProductGridProps> = ({
  products,
  quantities,
  onQuantityChange,
  onProductClick,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          quantity={quantities[product.id] || 0}
          onQuantityChange={(qty) => onQuantityChange(product.id, qty)}
          onCardClick={() => onProductClick?.(product)}
        />
      ))}
    </div>
  );
};
