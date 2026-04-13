"use client";

import React, { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { HALF_HOUR_TIME_OF_DAY_OPTIONS } from "@/lib/pickup-time";
import { type BillingTier, type FulfillmentType } from "@/types/common";
import {
  getAllowedPaymentMethodsForBillingTier,
  getBillingTierLabel,
  isManualTransferTier,
} from "@/lib/billing-tier";

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
  billingTier: BillingTier | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    slug: string;
    enabledFulfillmentTypes: FulfillmentType[];
    transferAccount: TransferAccountInput;
    pickupTimeConfig: PickupTimeConfigInput;
    depositSheetName: string;
    depositSheetUrl: string;
    contactPhone: string;
    kakaoChannelUrl: string;
  }) => Promise<void>;
  adding: boolean;
};

const FULFILLMENT_OPTIONS: Array<{ value: FulfillmentType; label: string }> = [
  { value: "PICKUP", label: "포장" },
  { value: "DELIVERY", label: "배달" },
  { value: "DINE_IN", label: "매장" },
  { value: "SHIPPING", label: "택배" },
];

function normalizeSlug(value: string) {
  return value
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

export default function AddStoreModal({
  open,
  brandId,
  billingTier,
  onClose,
  onSubmit,
  adding,
}: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<FulfillmentType[]>([
    "PICKUP",
  ]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [depositSheetName, setDepositSheetName] = useState("");
  const [depositSheetUrl, setDepositSheetUrl] = useState("");
  const [pickupStartTime, setPickupStartTime] = useState("");
  const [pickupEndTime, setPickupEndTime] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState("");

  const resolvedBillingTier = billingTier ?? "PG";
  const isTransferEnabled = isManualTransferTier(resolvedBillingTier);

  const toggleFulfillmentType = (type: FulfillmentType) => {
    setEnabledFulfillmentTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const disabled = useMemo(
    () =>
      Boolean(
        adding ||
          !brandId ||
          !name.trim() ||
          !slug.trim() ||
          enabledFulfillmentTypes.length === 0 ||
          (isTransferEnabled &&
            (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim())) ||
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
      bankName,
      brandId,
      enabledFulfillmentTypes.length,
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
            className="h-9 rounded-lg border border-border bg-transparent px-4 text-[13px] font-bold text-foreground transition-colors hover:bg-bg-tertiary"
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
                enabledFulfillmentTypes,
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
                depositSheetName: depositSheetName.trim(),
                depositSheetUrl: depositSheetUrl.trim(),
                contactPhone: contactPhone.trim(),
                kakaoChannelUrl: kakaoChannelUrl.trim(),
              })
            }
            disabled={disabled}
          >
            {adding ? "등록 중..." : "등록하기"}
          </button>
        </>
      }
    >
      <div className="card p-3.5">
        <div className="mb-3 text-[13px] font-extrabold text-foreground">기본 정보</div>

        <label className="mb-1.5 block text-xs text-text-secondary">매장명</label>
        <input
          className="input-field w-full"
          placeholder="예: 강남 본점"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label className="mb-1.5 mt-3 block text-xs text-text-secondary">매장 고유 주소(URL)</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-bg-secondary">
          <div className="flex h-[38px] items-center whitespace-nowrap border-r border-border px-2.5 text-xs text-text-tertiary">
            openoda.com/store/
          </div>
          <input
            className="h-[38px] flex-1 border-none bg-transparent px-3 text-[13px] text-foreground outline-none"
            placeholder="예: dongtan-main"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
          />
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs text-text-secondary">주문방식 노출</label>
          <div className="flex flex-wrap gap-2">
            {FULFILLMENT_OPTIONS.map((option) => {
              const checked = enabledFulfillmentTypes.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleFulfillmentType(option.value)}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
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

        <div className="mt-3">
          <label className="mb-1.5 block text-xs text-text-secondary">결제 운영 방식</label>
          <div className="rounded-xl border border-border bg-bg-secondary px-3 py-3 text-sm text-text-secondary">
            <div className="font-semibold text-foreground">
              {getBillingTierLabel(resolvedBillingTier)}
            </div>
            <div className="mt-1">
              {isTransferEnabled
                ? "이 브랜드는 무통장 입금만 사용할 수 있어요."
                : "이 브랜드는 토스페이먼츠 결제만 사용할 수 있어요."}
            </div>
            <div className="mt-1 text-xs">
              주문에는 {getAllowedPaymentMethodsForBillingTier(resolvedBillingTier).join(", ")} 방식만 적용됩니다.
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <label className="mb-0 block text-xs text-text-secondary">기본 영업 시간</label>
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

          {isTransferEnabled && (
            <>
              <label className="mb-0 block text-xs text-text-secondary">계좌이체 입금 정보</label>
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
              <input
                className="input-field w-full"
                placeholder="입금기록 시트명 (예: 시트1)"
                value={depositSheetName}
                onChange={(e) => setDepositSheetName(e.target.value)}
              />
              <input
                className="input-field w-full"
                placeholder="입금기록 링크 (Google Sheets URL)"
                value={depositSheetUrl}
                onChange={(e) => setDepositSheetUrl(e.target.value)}
              />
            </>
          )}

          <label className="mb-0 block text-xs text-text-secondary">고객 문의 정보</label>
          <input
            className="input-field w-full"
            placeholder="문의 전화번호"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <input
            className="input-field w-full"
            placeholder="https://pf.kakao.com/_example/chat"
            value={kakaoChannelUrl}
            onChange={(e) => setKakaoChannelUrl(e.target.value)}
          />
        </div>

        <div className="mt-2.5 text-xs leading-relaxed text-text-tertiary">
          {isTransferEnabled
            ? "무통장 브랜드는 은행명, 계좌번호, 예금주를 입력해 주세요."
            : "PG 브랜드는 결제 방식이 토스페이먼츠로 고정됩니다."}
          <br />
          URL은 <b>영문/숫자/하이픈(-)</b>만 사용할 수 있습니다.
        </div>
      </div>
    </Modal>
  );
}
