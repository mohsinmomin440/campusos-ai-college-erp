/**
 * Authoritative money utilities using integer minor units (e.g., paise/cents).
 * Never uses floating-point arithmetic for authoritative ledger calculations.
 */

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);

export function getMinorUnitMultiplier(currency = 'INR') {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/**
 * Parses a decimal string (e.g. "12500.50") into integer minor units without float math.
 */
export function parseDecimalToMinorUnits(rawValue, currency = 'INR') {
  const value = String(rawValue ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error('Amount must be a valid non-negative number with at most 2 decimal places.');
  }
  const multiplier = getMinorUnitMultiplier(currency);
  if (multiplier === 1) {
    if (value.includes('.')) {
      throw new Error(`Currency ${currency} does not support fractional units.`);
    }
    return Number.parseInt(value, 10);
  }
  const [wholePart, fracPart = ''] = value.split('.');
  const paddedFrac = (fracPart + '00').slice(0, 2);
  return Number.parseInt(wholePart, 10) * 100 + Number.parseInt(paddedFrac, 10);
}

export function formatMinorUnits(amountMinor, currency = 'INR', locale = 'en-IN') {
  const safeMinor = Number.isInteger(amountMinor) ? amountMinor : 0;
  const multiplier = getMinorUnitMultiplier(currency);
  const major = safeMinor / multiplier;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: multiplier === 1 ? 0 : 2,
      maximumFractionDigits: multiplier === 1 ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency.toUpperCase()} ${major.toFixed(multiplier === 1 ? 0 : 2)}`;
  }
}

export function sumMinorUnits(items) {
  return items.reduce((acc, val) => acc + (Number.isInteger(val) ? val : 0), 0);
}
