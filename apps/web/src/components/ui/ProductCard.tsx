"use client";

import { FC, useState } from "react";
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
  imageUrl?: string | null;
  badges?: ProductBadge[];
  stock?: { available: number; threshold: number };
  options?: ProductOption[];
}

export interface ProductCardProps {
  product: ProductCardProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onCardClick?: () => void;
}

const badgeClasses: Record<ProductBadge["type"], string> = {
  recommended: "badge-recommended",
  event: "badge-event",
  new: "badge-new",
  hot: "badge-hot",
  "soldout-soon": "badge-soldout-soon",
};

export const ProductCard: FC<ProductCardProps> = ({
  product,
  quantity,
  onQuantityChange,
  onCardClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const hasDiscount =
    product.discountPrice !== undefined && product.discountPrice < product.price;
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
        <div
          className="col-start-1 row-start-1 p-3 flex flex-col gap-1 overflow-hidden cursor-pointer"
          onClick={onCardClick}
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
              <span className="text-xs font-bold text-danger-500">
                {discountRate}%
              </span>
            )}
            <span className="text-base font-extrabold text-foreground">
              {hasDiscount && (
                <span className="line-through text-xs text-text-tertiary mr-1 font-normal">
                  {product.price.toLocaleString()}
                </span>
              )}
              {finalPrice.toLocaleString()}
              <span className="text-xs font-medium ml-0.5">원</span>
            </span>

            {isLowStock && (
              <span className="text-2xs text-warning-500 font-bold animate-pulse-slow ml-1">
                품절임박
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <div
          className="col-start-2 row-start-1 w-[100px] h-[100px] relative bg-bg-tertiary overflow-hidden cursor-pointer group"
          onClick={onCardClick}
        >
          {product.imageUrl && !imgError ? (
            <Image
              src={product.imageUrl}
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
