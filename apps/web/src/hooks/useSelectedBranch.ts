"use client";

import { useEffect, useState } from "react";
import {
  getSelectedBranchId,
  setSelectedBranchId,
  clearSelectedBranchId,
} from "@/lib/branchSelection";

export function useSelectedBranch() {
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBranchIdState(getSelectedBranchId());
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "of:selectedBranchId") setBranchIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    branchId,
    ready,
    selectBranch: (id: string) => {
      setSelectedBranchId(id);
      setBranchIdState(id);
    },
    clearBranch: () => {
      clearSelectedBranchId();
      setBranchIdState(null);
    },
  };
}
