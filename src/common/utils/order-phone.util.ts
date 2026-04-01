export const ORDER_PHONE_REGEX = /^\d{3}-\d{4}-\d{4}$/;

export function formatOrderPhone(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}
