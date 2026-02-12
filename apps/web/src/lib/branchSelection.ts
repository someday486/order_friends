const KEY = 'of:selectedBranchId';

export function getSelectedBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setSelectedBranchId(branchId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, branchId);
}

export function clearSelectedBranchId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
