'use client';

import { useEffect, useState } from 'react';
import {
  getSelectedBrandId,
  setSelectedBrandId,
  clearSelectedBrandId,
  subscribeSelectedBrandIdChanged,
} from '@/lib/brandSelection';

export function useSelectedBrand() {
  const [brandId, setBrandIdState] = useState<string | null>(() =>
    getSelectedBrandId(),
  );
  const ready = true;

  useEffect(() => {
    return subscribeSelectedBrandIdChanged(setBrandIdState);
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
