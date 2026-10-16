/**
 * Centralized Date Formatting Utility for TWBHub
 * Enforces strict 'dd-mm-yyyy' user-visible display format (e.g. 10-05-2026).
 *
 * Guarantees:
 * - Date-only strings ('YYYY-MM-DD') are parsed without timezone shift.
 * - Leading zeros are preserved for day and month (e.g. 01-04-2026).
 * - Timestamps preserve meaningful time while formatting the date portion as dd-mm-yyyy.
 * - Handles null, undefined, invalid, and reversed dates gracefully.
 */

/**
 * Formats any date input (YYYY-MM-DD string, ISO timestamp, Date object)
 * into standard 'dd-mm-yyyy' format.
 *
 * @param dateInput Raw date string, Date object, or null/undefined
 * @param fallback Fallback string when date is empty or invalid (defaults to '—')
 */
export function formatDisplayDate(
  dateInput?: string | Date | number | null,
  fallback: string = '—'
): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return fallback;
  }

  // Handle Date instance
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return fallback;
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = String(dateInput.getFullYear());
    return `${day}-${month}-${year}`;
  }

  // Handle number (timestamp)
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}-${month}-${year}`;
  }

  const str = String(dateInput).trim();
  if (!str) return fallback;

  // 1. Check for ISO date string starting with YYYY-MM-DD (e.g. 2026-10-14, 2026-10-14T12:00:00Z)
  // Direct extraction avoids UTC midnight timezone offset bugs
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  // 2. Check for already formatted DD-MM-YYYY (e.g. 14-10-2026 or 4-5-2026)
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}-${month}-${year}`;
  }

  // 3. Check for DD/MM/YYYY (e.g. 10/05/2026)
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${day}-${month}-${year}`;
  }

  // 4. Fallback: Parse with Date constructor if recognizable
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = String(parsed.getFullYear());
    return `${day}-${month}-${year}`;
  }

  return str || fallback;
}

/**
 * Formats a start and end date into standard 'dd-mm-yyyy to dd-mm-yyyy'.
 * If start and end are the same day, returns just the single formatted date.
 */
export function formatDisplayDateRange(
  startDate?: string | null,
  endDate?: string | null,
  fallback: string = '—'
): string {
  const startFmt = formatDisplayDate(startDate, '');
  const endFmt = formatDisplayDate(endDate, '');

  if (!startFmt && !endFmt) return fallback;
  if (startFmt && !endFmt) return startFmt;
  if (!startFmt && endFmt) return endFmt;
  if (startFmt === endFmt) return startFmt;

  return `${startFmt} to ${endFmt}`;
}

/**
 * Formats a timestamp into 'dd-mm-yyyy HH:MM', preserving meaningful times
 * without discarding hours and minutes.
 */
export function formatDisplayDateTime(
  dateInput?: string | Date | number | null,
  fallback: string = '—'
): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return fallback;
  }

  if (typeof dateInput === 'string') {
    const str = dateInput.trim();
    // Match date and time in string
    const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const hours = match[4].padStart(2, '0');
      const mins = match[5].padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${mins}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return formatDisplayDate(dateInput, fallback);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${mins}`;
}
