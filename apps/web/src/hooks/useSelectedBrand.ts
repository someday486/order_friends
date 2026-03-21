'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const selectBrand = useCallback((id: string) => {
    setSelectedBrandId(id);
    setBrandIdState(id);
  }, []);

  const clearBrand = useCallback(() => {
    clearSelectedBrandId();
    setBrandIdState(null);
  }, []);

  return {
    brandId,
    ready,
    selectBrand,
    clearBrand,
  };
}
