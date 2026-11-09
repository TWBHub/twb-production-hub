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

import { Enquiry, ProjectEvent } from '../types';

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

/**
 * Calculates calendar days elapsed between two date strings (ISO or YYYY-MM-DD).
 * Uses UTC date values to prevent timezone and daylight saving offset issues.
 * Returns null if either date is missing or invalid.
 */
export function calculateCalendarDaysElapsed(
  startDateStr?: string | null,
  endDateStr?: string | null
): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  const diffDays = Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Returns a human-friendly string representing calendar days turnaround:
 * e.g. "Same day", "1 calendar day", "5 calendar days", or fallback.
 */
export function formatTurnaroundDays(
  startDateStr?: string | null,
  endDateStr?: string | null,
  pendingFallback: string = '—'
): string {
  const days = calculateCalendarDaysElapsed(startDateStr, endDateStr);
  if (days === null) return pendingFallback;
  if (days === 0) return 'Same day (0 days)';
  if (days === 1) return '1 calendar day';
  return `${days} calendar days`;
}

/**
 * Returns today's date in local 'YYYY-MM-DD' format.
 * Prevents UTC timezone shifts caused by Date.toISOString().
 *
 * @param refDate Optional reference date (defaults to current system/browser local time)
 */
export function getLocalTodayDateString(refDate: Date = new Date()): string {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  const d = String(refDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks whether a given calendar year, 0-indexed month, and day number
 * match the local today's date.
 *
 * @param year Full year (e.g. 2026)
 * @param month 0-indexed month (0 = January, 10 = November)
 * @param dayNum Day of the month (1-31)
 * @param refDate Optional reference date (defaults to current system/browser local time)
 */
export function isLocalToday(
  year: number,
  month: number,
  dayNum: number,
  refDate: Date = new Date()
): boolean {
  return (
    dayNum === refDate.getDate() &&
    month === refDate.getMonth() &&
    year === refDate.getFullYear()
  );
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface ParsedDateParts {
  day: number;
  monthIdx: number;
  monthShort: string;
  monthFull: string;
  year: number;
}

export function parseDateParts(dateInput?: string | Date | null): ParsedDateParts | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return {
      day: dateInput.getDate(),
      monthIdx: dateInput.getMonth(),
      monthShort: SHORT_MONTHS[dateInput.getMonth()],
      monthFull: FULL_MONTHS[dateInput.getMonth()],
      year: dateInput.getFullYear(),
    };
  }
  const str = String(dateInput).trim();
  if (!str) return null;

  // 1. ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31) {
      return {
        day,
        monthIdx,
        monthShort: SHORT_MONTHS[monthIdx],
        monthFull: FULL_MONTHS[monthIdx],
        year,
      };
    }
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31) {
      return {
        day,
        monthIdx,
        monthShort: SHORT_MONTHS[monthIdx],
        monthFull: FULL_MONTHS[monthIdx],
        year,
      };
    }
  }

  // Fallback to Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      day: d.getDate(),
      monthIdx: d.getMonth(),
      monthShort: SHORT_MONTHS[d.getMonth()],
      monthFull: FULL_MONTHS[d.getMonth()],
      year: d.getFullYear(),
    };
  }

  return null;
}

/**
 * Formats a date into "20 December 2026" long format for proposals.
 */
export function formatProposalEventDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const parsed = parseDateParts(dateInput);
  if (parsed) {
    return `${parsed.day} ${parsed.monthFull} ${parsed.year}`;
  }
  return formatDisplayDate(dateInput, '');
}

export interface ProposalScheduleItem {
  dateStr: string;
  eventName?: string;
  formattedLine: string;
}

/**
 * Reads all event records belonging to the lead and generates the Commissioned Event Schedule.
 * - Preserves original event order.
 * - Supports non-consecutive dates.
 * - If event name is unavailable, displays its date without inventing a name.
 * - If no events array exists, falls back to enquiry.event_date.
 */
export function getCommissionedEventSchedule(enquiry: Enquiry): ProposalScheduleItem[] {
  const events = enquiry.events;
  if (events && events.length > 0) {
    const items: ProposalScheduleItem[] = [];
    events.forEach(ev => {
      const rawDate = ev.event_date ? ev.event_date.trim() : '';
      const rawName = ev.event_name ? ev.event_name.trim() : '';

      if (rawDate) {
        const dateStr = formatProposalEventDate(rawDate);
        const formattedLine = rawName ? `${dateStr} — ${rawName}` : dateStr;
        items.push({ dateStr, eventName: rawName || undefined, formattedLine });
      } else if (rawName) {
        items.push({ dateStr: '', eventName: rawName, formattedLine: rawName });
      }
    });

    if (items.length > 0) {
      return items;
    }
  }

  if (enquiry.event_date && enquiry.event_date.trim()) {
    const dateStr = formatProposalEventDate(enquiry.event_date);
    return [{ dateStr, formattedLine: dateStr }];
  }

  return [{ dateStr: 'Date TBD', formattedLine: 'Date TBD' }];
}

export interface LeadsTableDateDisplay {
  text: string;
  isSet: boolean;
  count: number;
}

/**
 * Formats the Wedding Date & Venue column date display for the Leads table:
 * - Single event: simple date display, e.g. "20 Dec 2026"
 * Formats the Wedding Date & Venue column date display for the Leads table:
 * - 1 event: 10 Nov 2026
 * - 2 events: 10 & 12 Nov 2026
 * - 3 events: 10, 11 & 12 Nov 2026
 * - 4 events: 10, 11, 12 & 13 Nov 2026
 * - Across different months: 28 Nov, 2 & 5 Dec 2026
 * - Across different years: 28 Dec 2026 & 2 Jan 2027 or 28 Dec 2026, 2 & 5 Jan 2027
 * - Preserves event order without inventing or inferring dates.
 */
function formatDaysList(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return String(days[0]);
  if (days.length === 2) return `${days[0]} & ${days[1]}`;
  return `${days.slice(0, -1).join(', ')} & ${days[days.length - 1]}`;
}

export function formatLeadsTableEventDates(enquiry: Enquiry): LeadsTableDateDisplay {
  const eventsWithDates = (enquiry.events || []).filter(
    e => e.event_date && e.event_date.trim()
  );

  if (eventsWithDates.length === 0) {
    if (enquiry.event_date && enquiry.event_date.trim()) {
      const parsed = parseDateParts(enquiry.event_date);
      const text = parsed
        ? `${parsed.day} ${parsed.monthShort} ${parsed.year}`
        : formatDisplayDate(enquiry.event_date);
      return { text, isSet: true, count: 1 };
    }
    return { text: 'No dates set', isSet: false, count: 0 };
  }

  // Parse all dates
  interface ParsedEventEntry {
    parsed: ParsedDateParts | null;
    raw: string;
  }
  const parsedEntries: ParsedEventEntry[] = eventsWithDates.map(ev => ({
    parsed: parseDateParts(ev.event_date),
    raw: ev.event_date!.trim(),
  }));

  // If any date could not be parsed, fallback safely to standard format
  if (parsedEntries.some(e => !e.parsed)) {
    const pieces = parsedEntries.map(e =>
      e.parsed ? `${e.parsed.day} ${e.parsed.monthShort} ${e.parsed.year}` : formatDisplayDate(e.raw)
    );
    return {
      text: pieces.join(', '),
      isSet: true,
      count: eventsWithDates.length,
    };
  }

  // Group events into month-year clusters while preserving encounter order
  interface MonthCluster {
    year: number;
    monthIdx: number;
    monthShort: string;
    days: number[];
  }

  const monthClusters: MonthCluster[] = [];
  for (const entry of parsedEntries) {
    const p = entry.parsed!;
    const lastCluster = monthClusters[monthClusters.length - 1];
    if (lastCluster && lastCluster.year === p.year && lastCluster.monthIdx === p.monthIdx) {
      if (!lastCluster.days.includes(p.day)) {
        lastCluster.days.push(p.day);
      }
    } else {
      monthClusters.push({
        year: p.year,
        monthIdx: p.monthIdx,
        monthShort: p.monthShort,
        days: [p.day],
      });
    }
  }

  // Group month clusters into year clusters
  interface YearCluster {
    year: number;
    months: MonthCluster[];
  }

  const yearClusters: YearCluster[] = [];
  for (const mc of monthClusters) {
    const lastYc = yearClusters[yearClusters.length - 1];
    if (lastYc && lastYc.year === mc.year) {
      lastYc.months.push(mc);
    } else {
      yearClusters.push({
        year: mc.year,
        months: [mc],
      });
    }
  }

  // Format each YearCluster
  const formattedYears: string[] = yearClusters.map(yc => {
    if (yc.months.length === 1) {
      const m = yc.months[0];
      return `${formatDaysList(m.days)} ${m.monthShort} ${yc.year}`;
    }

    // Multiple months in the same year: e.g. "28 Nov, 2 & 5 Dec 2026" or "28 Nov & 2 Dec 2026"
    const monthTexts = yc.months.map(m => `${formatDaysList(m.days)} ${m.monthShort}`);
    const anyHasAnd = monthTexts.some(t => t.includes('&'));

    if (anyHasAnd) {
      return `${monthTexts.join(', ')} ${yc.year}`;
    }
    // If none contain '&', format like "28 Nov & 2 Dec 2026" or "15 Oct, 28 Nov & 2 Dec 2026"
    return `${monthTexts.slice(0, -1).join(', ')} & ${monthTexts[monthTexts.length - 1]} ${yc.year}`;
  });

  // Combine across multiple years
  let finalText: string;
  if (formattedYears.length === 1) {
    finalText = formattedYears[0];
  } else {
    // Check if any year string has '&'
    const anyYearHasAnd = formattedYears.some(y => y.includes('&'));
    if (formattedYears.length === 2 && !anyYearHasAnd) {
      finalText = `${formattedYears[0]} & ${formattedYears[1]}`;
    } else {
      finalText = formattedYears.join(', ');
    }
  }

  return {
    text: finalText,
    isSet: true,
    count: eventsWithDates.length,
  };
}
