"use client";

import { useEffect, useRef, useState } from "react";

const KAKAO_POSTCODE_SCRIPT_ID = "kakao-postcode-script";
const KAKAO_POSTCODE_SCRIPT_SRC =
  "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type PostcodeAddressData = {
  address: string;
  userSelectedType: "R" | "J";
  bname: string;
  buildingName: string;
  apartment: "Y" | "N";
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
};

type PostcodeApi = {
  Postcode: new (options: {
    oncomplete: (data: PostcodeAddressData) => void;
  }) => {
    open: (options?: { popupTitle?: string; popupKey?: string }) => void;
  };
};

type WindowWithKakao = Window & {
  kakao?: PostcodeApi;
};

type AddressSearchFieldsProps = {
  addressLabel: string;
  showLabel?: boolean;
  address1: string;
  address2: string;
  onAddress1Change: (value: string) => void;
  onAddress2Change: (value: string) => void;
  address1Placeholder?: string;
  address2Placeholder?: string;
  address1TestId?: string;
  className?: string;
};

function ensureScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const win = window as WindowWithKakao;
  if (win.kakao?.Postcode) {
    return Promise.resolve();
  }

  const existing = document.getElementById(
    KAKAO_POSTCODE_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다.")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = KAKAO_POSTCODE_SCRIPT_ID;
    script.src = KAKAO_POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () =>
      reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function buildPrimaryAddress(data: PostcodeAddressData): string {
  const baseAddress = data.roadAddress || data.jibunAddress || data.address;
  if (!baseAddress) {
    return "";
  }

  if (data.userSelectedType !== "R") {
    return baseAddress;
  }

  const extras = [data.bname, data.apartment === "Y" ? data.buildingName : ""]
    .map((value) => value.trim())
    .filter(Boolean);

  if (extras.length === 0) {
    return baseAddress;
  }

  return `${baseAddress} (${extras.join(", ")})`;
}

export function AddressSearchFields({
  addressLabel,
  showLabel = true,
  address1,
  address2,
  onAddress1Change,
  onAddress2Change,
  address1Placeholder = "기본 주소",
  address2Placeholder = "상세 주소 (동/호수 등)",
  address1TestId = "customer-address1-input",
  className = "",
}: AddressSearchFieldsProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [zonecode, setZonecode] = useState("");
  const detailAddressRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await ensureScript();
        if (cancelled) return;
        setScriptReady(true);
        setScriptError(null);
      } catch (error) {
        if (cancelled) return;
        setScriptReady(false);
        setScriptError(
          error instanceof Error
            ? error.message
            : "주소 검색을 준비하지 못했습니다.",
        );
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddressSearch = () => {
    const win = window as WindowWithKakao;
    if (!win.kakao?.Postcode) {
      setScriptError("주소 검색을 준비하지 못했습니다.");
      return;
    }

    new win.kakao.Postcode({
      oncomplete: (data) => {
        onAddress1Change(buildPrimaryAddress(data));
        setZonecode(data.zonecode ?? "");
        detailAddressRef.current?.focus();
      },
    }).open({
      popupTitle: "주소 검색",
      popupKey: "order-friends-address-search",
    });
  };

  return (
    <div className={className}>
      {showLabel ? (
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
          {addressLabel} <span className="text-danger-500">*</span>
        </label>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={address1}
          onChange={(e) => onAddress1Change(e.target.value)}
          data-testid={address1TestId}
          placeholder={address1Placeholder}
          className="input-field h-12 flex-1"
        />
        <button
          type="button"
          onClick={handleAddressSearch}
          disabled={!scriptReady}
          className="h-12 shrink-0 rounded-xl border border-border bg-bg-secondary px-4 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          주소 검색
        </button>
      </div>

      {zonecode ? (
        <p className="mt-2 text-xs text-text-tertiary">우편번호 {zonecode}</p>
      ) : null}

      <input
        ref={detailAddressRef}
        type="text"
        value={address2}
        onChange={(e) => onAddress2Change(e.target.value)}
        placeholder={address2Placeholder}
        className="input-field w-full h-12 mt-2"
      />

      {scriptError ? (
        <p className="mt-2 text-xs text-danger-500">{scriptError}</p>
      ) : (
        <p className="mt-2 text-xs text-text-tertiary">
          주소 검색으로 기본 주소를 채우고, 상세 주소를 이어서 입력해 주세요.
        </p>
      )}
    </div>
  );
}
