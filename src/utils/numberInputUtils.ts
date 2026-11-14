/**
 * Numeric and currency input handling utilities for TWBHub forms.
 * Prevents leading zeros (e.g. 020000), allows clearing inputs to genuinely empty strings,
 * and parses values reliably with custom fallbacks.
 */

/**
 * Sanitizes raw string or number input for numeric form fields.
 * - Strips leading zeros when followed by digits (e.g. "020000" -> "20000", "05" -> "5")
 * - Preserves lone zero ("0") and decimal values ("0.5", "0.")
 * - Strips invalid characters (allows only digits and a single decimal point)
 * - Returns "" if the field is cleared or empty.
 */
export function sanitizeNumericInput(rawValue: string | number | null | undefined): string {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  const str = String(rawValue).trim();
  if (str === '') {
    return '';
  }

  // Remove all characters except digits and periods
  let cleaned = str.replace(/[^0-9.]/g, '');
  if (cleaned === '') {
    return '';
  }

  // Handle multiple decimal points - keep only first
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  // Handle leading zeros on the integer part
  if (cleaned.includes('.')) {
    const [intPart, decPart] = cleaned.split('.');
    let normalizedInt = intPart.replace(/^0+(?=\d)/, '');
    if (normalizedInt === '' && intPart !== '') {
      normalizedInt = '0';
    }
    return `${normalizedInt}.${decPart}`;
  } else {
    // If multiple zeros like "000", reduce to "0"
    if (/^0+$/.test(cleaned)) {
      return '0';
    }
    // Remove leading zeros before any non-zero digit
    return cleaned.replace(/^0+(?=[1-9])/, '');
  }
}

/**
 * Safely parses a numeric input value to a number.
 * Returns `fallback` (default 0) if the value is empty, invalid, or null/undefined.
 */
export function parseNumericInput(
  val: string | number | null | undefined,
  fallback: number = 0
): number {
  if (val === null || val === undefined || val === '') {
    return fallback;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  const parsed = parseFloat(String(val).trim());
  return isNaN(parsed) ? fallback : parsed;
}
