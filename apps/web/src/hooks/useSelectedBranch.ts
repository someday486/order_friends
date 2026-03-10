'use client';

import { useEffect, useState } from 'react';
import {
  getSelectedBranchId,
  setSelectedBranchId,
  clearSelectedBranchId,
  subscribeSelectedBranchIdChanged,
} from '@/lib/branchSelection';

export function useSelectedBranch() {
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBranchIdState(getSelectedBranchId());
    setReady(true);

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
