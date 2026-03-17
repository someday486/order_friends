"use client";

import React, { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { HALF_HOUR_TIME_OF_DAY_OPTIONS } from "@/lib/pickup-time";

type PaymentMethod = "CARD" | "TRANSFER" | "CASH";

type TransferAccountInput = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type PickupTimeConfigInput = {
  startTime: string;
  endTime: string;
} | null;

type Props = {
  open: boolean;
  brandId: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    slug: string;
    allowedPaymentMethods: PaymentMethod[];
    transferAccount: TransferAccountInput;
    pickupTimeConfig: PickupTimeConfigInput;
  }) => Promise<void>;
  adding: boolean;
};

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CARD", label: "카드" },
  { value: "TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
];

function normalizeSlug(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function AddStoreModal({ open, brandId, onClose, onSubmit, adding }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<PaymentMethod[]>([
    "CARD",
    "TRANSFER",
    "CASH",
  ]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("");
  const [pickupEndTime, setPickupEndTime] = useState("");

  const isTransferEnabled = allowedPaymentMethods.includes("TRANSFER");

  const togglePaymentMethod = (method: PaymentMethod) => {
    setAllowedPaymentMethods((prev) => {
      if (prev.includes(method)) {
        return prev.filter((item) => item !== method);
      }
      return [...prev, method];
    });
  };

  const disabled = useMemo(
    () =>
      Boolean(
        adding ||
          !brandId ||
          !name.trim() ||
          !slug.trim() ||
          allowedPaymentMethods.length === 0 ||
          (isTransferEnabled &&
            (!bankName.trim() ||
              !accountNumber.trim() ||
              !accountHolder.trim())) ||
          ((pickupStartTime.trim() && !pickupEndTime.trim()) ||
            (!pickupStartTime.trim() && pickupEndTime.trim())) ||
          (pickupStartTime.trim() &&
            pickupEndTime.trim() &&
            timeToMinutes(pickupEndTime) <= timeToMinutes(pickupStartTime)),
      ),
    [
      accountHolder,
      accountNumber,
      adding,
      allowedPaymentMethods.length,
      bankName,
      brandId,
      isTransferEnabled,
      name,
      pickupEndTime,
      pickupStartTime,
      slug,
    ],
  );

  return (
    <Modal
      open={open}
      title="매장 등록"
      onClose={adding ? () => {} : onClose}
      footer={
        <>
          <button
            className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-bold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
            onClick={onClose}
            disabled={adding}
          >
            취소
          </button>
          <button
            className="btn-primary h-9 px-4 text-[13px]"
            onClick={() =>
              onSubmit({
                name,
                slug,
                allowedPaymentMethods,
                transferAccount: {
                  bankName: bankName.trim(),
                  accountNumber: accountNumber.trim(),
                  accountHolder: accountHolder.trim(),
                },
                pickupTimeConfig:
                  pickupStartTime.trim() && pickupEndTime.trim()
                    ? {
                        startTime: pickupStartTime.trim(),
                        endTime: pickupEndTime.trim(),
                      }
                    : null,
              })
            }
            disabled={disabled}
          >
            {adding ? "저장 중..." : "등록하기"}
          </button>
        </>
      }
    >
      <div className="card p-3.5">
        <div className="text-[13px] font-extrabold mb-3 text-foreground">기본 정보</div>

        <label className="block text-xs text-text-secondary mb-1.5">매장명</label>
        <input
          className="input-field w-full"
          placeholder="예: 동탄 본점"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label className="block text-xs text-text-secondary mb-1.5 mt-3">매장 고유 주소(URL)</label>
        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-bg-secondary">
          <div className="px-2.5 h-[38px] flex items-center text-xs text-text-tertiary border-r border-border whitespace-nowrap">
            openoda.com/store/
          </div>
          <input
            className="h-[38px] px-3 border-none outline-none bg-transparent text-foreground text-[13px] flex-1"
            placeholder="예: dongtan-main"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
          />
        </div>

        <div className="mt-3">
          <label className="block text-xs text-text-secondary mb-1.5">결제수단 노출</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const checked = allowedPaymentMethods.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePaymentMethod(option.value)}
                  className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    checked
                      ? "border-primary-500 bg-primary-500/10 text-primary-500"
                      : "border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <label className="block text-xs text-text-secondary mb-0">픽업 가능 시간</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="input-field w-full"
              value={pickupStartTime}
              onChange={(e) => setPickupStartTime(e.target.value)}
            >
              <option value="">시작 시간 선택</option>
              {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                <option key={`pickup-start-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="input-field w-full"
              value={pickupEndTime}
              onChange={(e) => setPickupEndTime(e.target.value)}
            >
              <option value="">종료 시간 선택</option>
              {HALF_HOUR_TIME_OF_DAY_OPTIONS.map((option) => (
                <option key={`pickup-end-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="block text-xs text-text-secondary mb-0">계좌이체 입금 정보</label>
          <input
            className="input-field w-full"
            placeholder="은행명"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <input
            className="input-field w-full"
            placeholder="계좌번호"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <input
            className="input-field w-full"
            placeholder="예금주"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
          />
        </div>

        <div className="mt-2.5 text-xs text-text-tertiary leading-relaxed">
          계좌이체를 노출할 경우 은행명, 계좌번호, 예금주를 입력해 주세요.
          <br />
          URL은 <b>영문/숫자/하이픈(-)</b>만 가능합니다.
        </div>
      </div>
    </Modal>
  );
}
