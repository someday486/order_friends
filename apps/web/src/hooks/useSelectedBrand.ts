"use client";

import { useEffect, useState } from "react";
import {
  getSelectedBrandId,
  setSelectedBrandId,
  clearSelectedBrandId,
} from "@/lib/brandSelection";

export function useSelectedBrand() {
  const [brandId, setBrandIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBrandIdState(getSelectedBrandId());
    setReady(true);

    // 다른 탭/창에서 바뀐 경우 동기화
    const onStorage = (e: StorageEvent) => {
      if (e.key === "of:selectedBrandId") setBrandIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    brandId,
    ready,
    selectBrand: (id: string) => {
      setSelectedBrandId(id);
      setBrandIdState(id);
    },
    clearBrand: () => {
      clearSelectedBrandId();
      setBrandIdState(null);
    },
  };
}
