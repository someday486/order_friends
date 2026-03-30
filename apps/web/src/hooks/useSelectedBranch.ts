'use client';

import { useSyncExternalStore } from 'react';
import {
  clearSelectedBranchId,
  getSelectedBranchId,
  setSelectedBranchId,
  subscribeSelectedBranchIdChanged,
} from '@/lib/branchSelection';

export function useSelectedBranch() {
  const branchId = useSyncExternalStore(
    subscribeSelectedBranchIdChanged,
    getSelectedBranchId,
    () => null,
  );

  return {
    branchId,
    ready: true,
    selectBranch: (id: string) => {
      setSelectedBranchId(id);
    },
    clearBranch: () => {
      clearSelectedBranchId();
    },
  };
}
