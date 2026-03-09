'use client';

import { useEffect, useState } from 'react';
import {
  getSelectedBrandId,
  setSelectedBrandId,
  clearSelectedBrandId,
  subscribeSelectedBrandIdChanged,
} from '@/lib/brandSelection';

export function useSelectedBrand() {
  const [brandId, setBrandIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBrandIdState(getSelectedBrandId());
    setReady(true);

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
