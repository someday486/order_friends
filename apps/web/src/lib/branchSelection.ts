const KEY = 'of:selectedBranchId';
const EVENT_NAME = 'of:selectedBranchId:changed';

export function getSelectedBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

function emitSelectedBranchIdChanged(branchId: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<string | null>(EVENT_NAME, { detail: branchId }),
  );
}

export function setSelectedBranchId(branchId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, branchId);
  emitSelectedBranchIdChanged(branchId);
}

export function clearSelectedBranchId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  emitSelectedBranchIdChanged(null);
}

export function subscribeSelectedBranchIdChanged(
  callback: (branchId: string | null) => void,
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
