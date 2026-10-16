import { formatDisplayDate, formatDisplayDateRange, formatDisplayDateTime } from './dateUtils';

function runTests() {
  console.log('Running dateUtils unit tests...');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      process.exit(1);
    }
    passed++;
  }

  // 1. Direct YYYY-MM-DD parsing (no timezone shifting)
  assert(formatDisplayDate('2026-10-14') === '14-10-2026', '2026-10-14 -> 14-10-2026');
  assert(formatDisplayDate('2026-05-10') === '10-05-2026', '2026-05-10 -> 10-05-2026');
  assert(formatDisplayDate('2026-01-01') === '01-01-2026', '2026-01-01 -> 01-01-2026');
  assert(formatDisplayDate('2026-12-31') === '31-12-2026', '2026-12-31 -> 31-12-2026');

  // Leap years
  assert(formatDisplayDate('2024-02-29') === '29-02-2024', 'Leap year 2024-02-29 -> 29-02-2024');

  // Existing user formats required in prompt conversions
  assert(formatDisplayDate('10/05/2026') === '10-05-2026', '10/05/2026 -> 10-05-2026');
  assert(formatDisplayDate('14-10-2026') === '14-10-2026', '14-10-2026 remains 14-10-2026');
  assert(formatDisplayDate('14 Oct 2026') === '14-10-2026', '14 Oct 2026 -> 14-10-2026');

  // 2. ISO timestamp strings with time
  assert(formatDisplayDate('2026-10-14T00:00:00Z') === '14-10-2026', 'ISO timestamp with Z -> 14-10-2026');
  assert(formatDisplayDate('2026-10-14T23:59:59') === '14-10-2026', 'ISO timestamp with time -> 14-10-2026');

  // 3. Fallbacks and falsy values
  assert(formatDisplayDate('') === '—', 'Empty string -> fallback');
  assert(formatDisplayDate(null) === '—', 'null -> fallback');
  assert(formatDisplayDate(undefined) === '—', 'undefined -> fallback');
  assert(formatDisplayDate('', 'N/A') === 'N/A', 'Custom fallback');

  // 4. Date instances
  const sampleDate = new Date(2026, 9, 14); // Note: month 9 is October (0-indexed)
  assert(formatDisplayDate(sampleDate) === '14-10-2026', 'Date instance formatting');

  // 5. Date range formatting
  assert(
    formatDisplayDateRange('2026-04-01', '2026-09-30') === '01-04-2026 to 30-09-2026',
    'Range 2026-04-01 to 2026-09-30'
  );
  assert(
    formatDisplayDateRange('2026-04-01', '2026-04-01') === '01-04-2026',
    'Same-day range collapses to single date'
  );
  assert(
    formatDisplayDateRange('2026-04-01', null) === '01-04-2026',
    'Start date only range'
  );
  assert(
    formatDisplayDateRange(null, '2026-09-30') === '30-09-2026',
    'End date only range'
  );
  assert(
    formatDisplayDateRange(null, null, 'No dates') === 'No dates',
    'Empty range fallback'
  );

  // 6. DateTime formatting (preserving meaningful time)
  assert(
    formatDisplayDateTime('2026-09-20T10:00') === '20-09-2026 10:00',
    'Preserve time from ISO string 2026-09-20T10:00'
  );
  assert(
    formatDisplayDateTime('2026-09-20 18:30') === '20-09-2026 18:30',
    'Preserve time from spaced string 2026-09-20 18:30'
  );

  console.log(`✅ All ${passed}/${total} dateUtils tests passed successfully!`);
}

runTests();
