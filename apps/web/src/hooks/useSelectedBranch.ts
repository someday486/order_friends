'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const selectBranch = useCallback((id: string) => {
    setSelectedBranchId(id);
    setBranchIdState(id);
  }, []);

  const clearBranch = useCallback(() => {
    clearSelectedBranchId();
    setBranchIdState(null);
  }, []);

  return {
    branchId,
    ready,
    selectBranch,
    clearBranch,
  };
}
