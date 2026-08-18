export function normalizeLocalCvv(value: string) {
  const digits = value.trim();
  if (!/^\d{3,4}$/.test(digits)) throw new Error('INVALID_CVV');
  return digits;
}
