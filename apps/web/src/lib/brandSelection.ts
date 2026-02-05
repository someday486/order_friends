'use client';

const KEY = 'of:selectedBrandId';

export function getSelectedBrandId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setSelectedBrandId(brandId: string) {
  localStorage.setItem(KEY, brandId);
}

export function clearSelectedBrandId() {
  localStorage.removeItem(KEY);
}
