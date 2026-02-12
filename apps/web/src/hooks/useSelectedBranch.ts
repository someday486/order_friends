'use client';

import { useEffect, useState } from 'react';
import {
  getSelectedBranchId,
  setSelectedBranchId,
  clearSelectedBranchId,
  subscribeSelectedBranchIdChanged,
} from '@/lib/branchSelection';

export function useSelectedBranch() {
  const [branchId, setBranchIdState] = useState<string | null>(() =>
    getSelectedBranchId(),
  );
  const ready = true;

  useEffect(() => {
    return subscribeSelectedBranchIdChanged(setBranchIdState);
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
