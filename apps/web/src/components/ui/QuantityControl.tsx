"use client";

import { FC } from "react";

export interface QuantityControlProps {
  value: number;
  min?: number;
  max?: number;
  stock?: number;
  stockThreshold?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export const QuantityControl: FC<QuantityControlProps> = ({
  value,
  min = 0,
  max = 99,
  stock,
  stockThreshold = 5,
  onChange,
  disabled = false,
  size = "md",
}) => {
  const isLowStock = stock !== undefined && stock <= stockThreshold && stock > 0;
  const isSoldOut = stock !== undefined && stock === 0;
  const effectiveMax = stock !== undefined ? Math.min(max, stock) : max;

  const decrease = () => {
    if (!disabled && value > min) onChange(value - 1);
  };

  const increase = () => {
    if (!disabled && value < effectiveMax) onChange(value + 1);
  };

  const btnSize = size === "sm" ? "w-7 h-7 text-sm" : "w-9 h-9 text-lg";
  const textSize = size === "sm" ? "w-8 text-sm" : "w-10 text-base";

  if (isSoldOut) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs font-bold text-danger-500">품절</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={decrease}
          disabled={disabled || value <= min}
          className={`
            ${btnSize} rounded-full border border-border
            flex items-center justify-center
            bg-bg-secondary text-foreground
            hover:bg-bg-tertiary active:scale-90
            transition-all duration-150 touch-feedback
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          -
        </button>

        <span
          className={`
            ${textSize} text-center font-bold text-foreground tabular-nums
            ${value > 0 ? "text-primary" : ""}
          `}
        >
          {value}
        </span>

        <button
          type="button"
          onClick={increase}
          disabled={disabled || value >= effectiveMax}
          className={`
            ${btnSize} rounded-full border border-primary-400
            flex items-center justify-center
            bg-primary-500 text-white font-bold
            hover:bg-primary-600 active:scale-90
            transition-all duration-150 touch-feedback
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          +
        </button>
      </div>

      {isLowStock && value > 0 && (
        <span className="text-2xs text-warning-500 font-bold animate-pulse-slow">
          {stock}개 남음
        </span>
      )}
    </div>
  );
};
