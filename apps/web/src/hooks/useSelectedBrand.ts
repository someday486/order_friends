'use client';

import { useSyncExternalStore } from 'react';
import {
  clearSelectedBrandId,
  getSelectedBrandId,
  setSelectedBrandId,
  subscribeSelectedBrandIdChanged,
} from '@/lib/brandSelection';

export function useSelectedBrand() {
  const brandId = useSyncExternalStore(
    subscribeSelectedBrandIdChanged,
    getSelectedBrandId,
    () => null,
  );

  return {
    brandId,
    ready: true,
    selectBrand: (id: string) => {
      setSelectedBrandId(id);
    },
    clearBrand: () => {
      clearSelectedBrandId();
    },
  };
}
