'use client';

const KEY = 'of:selectedBrandId';
const EVENT_NAME = 'of:selectedBrandId:changed';

export function getSelectedBrandId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setSelectedBrandId(brandId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, brandId);
  window.dispatchEvent(
    new CustomEvent<string | null>(EVENT_NAME, { detail: brandId }),
  );
}

export function clearSelectedBrandId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(
    new CustomEvent<string | null>(EVENT_NAME, { detail: null }),
  );
}

export function subscribeSelectedBrandIdChanged(
  callback: (brandId: string | null) => void,
) {
  if (typeof window === 'undefined') return () => {};

  const onChanged = (event: Event) => {
    const customEvent = event as CustomEvent<string | null>;
    callback(customEvent.detail ?? null);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) callback(event.newValue);
  };

  window.addEventListener(EVENT_NAME, onChanged as EventListener);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, onChanged as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}
