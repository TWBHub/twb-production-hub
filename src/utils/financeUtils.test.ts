import {
  getIndianFinancialYearBoundaries,
  resolveActiveDateRange,
  isDateInRange,
  matchesProjectOrClientSearch,
  matchesPaymentSearch,
  matchesExpenseSearch,
  sortPayments,
  sortExpenses,
  calculateProjectProfitItem,
  sortProjectProfitItems,
  calculateDashboardFinanceMetrics,
} from './financeUtils';
import { Project, Client, Payment, Expense } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Starting Finance Utilities Unit Tests ---');

// 1. Test Indian Financial Year Boundaries
{
  // Test reference date: 14 October 2026 (Month index 9)
  const oct2026 = new Date(2026, 9, 14);

  const thisFy = getIndianFinancialYearBoundaries(0, oct2026);
  assert(thisFy.startDate === '2026-04-01', 'October 2026: This FY start is 2026-04-01');
  assert(thisFy.endDate === '2027-03-31', 'October 2026: This FY end is 2027-03-31');
  assert(thisFy.fyShort === 'FY 2026–27', 'October 2026: Label short is FY 2026–27');

  const prevFy = getIndianFinancialYearBoundaries(-1, oct2026);
  assert(prevFy.startDate === '2025-04-01', 'October 2026: Prev FY start is 2025-04-01');
  assert(prevFy.endDate === '2026-03-31', 'October 2026: Prev FY end is 2026-03-31');
  assert(prevFy.fyShort === 'FY 2025–26', 'October 2026: Prev label short is FY 2025–26');

  // Test reference date: 15 February 2027 (Month index 1, still within FY 2026-27)
  const feb2027 = new Date(2027, 1, 15);
  const thisFyFeb = getIndianFinancialYearBoundaries(0, feb2027);
  assert(thisFyFeb.startDate === '2026-04-01', 'February 2027: This FY start is 2026-04-01');
  assert(thisFyFeb.endDate === '2027-03-31', 'February 2027: This FY end is 2027-03-31');

  // Test reference date: 1 April 2026 (boundary day)
  const apr1_2026 = new Date(2026, 3, 1);
  const thisFyApr1 = getIndianFinancialYearBoundaries(0, apr1_2026);
  assert(thisFyApr1.startDate === '2026-04-01', '1 April 2026: Starts FY 2026-27');
  assert(thisFyApr1.endDate === '2027-03-31', '1 April 2026: Ends FY 2026-27 on 2027-03-31');

  // Test reference date: 31 March 2026 (boundary day of prior FY)
  const mar31_2026 = new Date(2026, 2, 31);
  const thisFyMar31 = getIndianFinancialYearBoundaries(0, mar31_2026);
  assert(thisFyMar31.startDate === '2025-04-01', '31 March 2026: Belongs to FY 2025-26 start');
  assert(thisFyMar31.endDate === '2026-03-31', '31 March 2026: Belongs to FY 2025-26 end');
}

// 2. Test Date Range Resolution and Inclusivity
{
  const oct2026 = new Date(2026, 9, 14);

  // 'all' option
  const allRange = resolveActiveDateRange('all', '', '', oct2026);
  assert(!allRange.isActive, 'resolveActiveDateRange: all is not active');
  assert(allRange.displayLabel === 'All Time', 'resolveActiveDateRange: label is All Time');

  // 'this_fy' option
  const thisFyRange = resolveActiveDateRange('this_fy', '', '', oct2026);
  assert(thisFyRange.isActive, 'resolveActiveDateRange: this_fy is active');
  assert(thisFyRange.startDate === '2026-04-01', 'resolveActiveDateRange: this_fy start date');
  assert(thisFyRange.endDate === '2027-03-31', 'resolveActiveDateRange: this_fy end date');

  // 'custom' option: normal range
  const customNormal = resolveActiveDateRange('custom', '2026-05-01', '2026-06-30', oct2026);
  assert(customNormal.isActive, 'custom normal is active');
  assert(customNormal.startDate === '2026-05-01', 'custom normal start');
  assert(customNormal.endDate === '2026-06-30', 'custom normal end');

  // 'custom' option: reversed dates handled safely
  const customReversed = resolveActiveDateRange('custom', '2026-12-31', '2026-01-01', oct2026);
  assert(customReversed.startDate === '2026-01-01', 'custom reversed start swapped');
  assert(customReversed.endDate === '2026-12-31', 'custom reversed end swapped');

  // 'custom' option: incomplete dates (only start)
  const customOnlyStart = resolveActiveDateRange('custom', '2026-06-01', '', oct2026);
  assert(customOnlyStart.isActive, 'custom only start is active');
  assert(customOnlyStart.startDate === '2026-06-01', 'custom only start preserves start');
  assert(customOnlyStart.endDate === null, 'custom only start has null end');

  // 'custom' option: incomplete dates (only end)
  const customOnlyEnd = resolveActiveDateRange('custom', '', '2026-06-01', oct2026);
  assert(customOnlyEnd.isActive, 'custom only end is active');
  assert(customOnlyEnd.startDate === null, 'custom only end has null start');
  assert(customOnlyEnd.endDate === '2026-06-01', 'custom only end preserves end');

  // Inclusive boundary tests
  assert(isDateInRange('2026-04-01', '2026-04-01', '2027-03-31'), 'Boundary start date 2026-04-01 is inclusive');
  assert(isDateInRange('2027-03-31', '2026-04-01', '2027-03-31'), 'Boundary end date 2027-03-31 is inclusive');
  assert(isDateInRange('2026-10-14', '2026-04-01', '2027-03-31'), 'Mid-period date 2026-10-14 is included');
  assert(!isDateInRange('2026-03-31', '2026-04-01', '2027-03-31'), 'Prior day 2026-03-31 is excluded');
  assert(!isDateInRange('2027-04-01', '2026-04-01', '2027-03-31'), 'Next day 2027-04-01 is excluded');
}

// 3. Test Search Filtering Across Projects, Clients, and Expenses
{
  const mockClient: Client = {
    id: 'cli-1',
    company_id: 'twb',
    name: 'Aarav Sharma',
    partner_name: 'Pooja Kapoor',
    email: 'aarav@example.com',
    phone: '9876543210',
    created_at: '2026-01-01',
  };

  const mockProject: Project = {
    id: 'prj-1',
    company_id: 'twb',
    client_id: 'cli-1',
    name: 'Royal Udaipur Destination Wedding',
    wedding_date_start: '2026-11-20',
    wedding_date_end: '2026-11-22',
    venue: 'Taj Lake Palace',
    city: 'Udaipur',
    client_contact: { phone: '9876543210', email: 'aarav@example.com' },
    status: 'Booked',
    package_name: 'Royal Heritage',
    package_details: 'Full Photo & Cinema',
    booking_amount: 50000,
    total_amount: 300000,
    created_at: '2026-01-01',
  };

  // Search by project name
  assert(matchesProjectOrClientSearch('udaipur', mockProject, mockClient), 'Matches by project name (case-insensitive)');
  // Search by client name
  assert(matchesProjectOrClientSearch('aarav', mockProject, mockClient), 'Matches by client name (case-insensitive)');
  // Search by partner name
  assert(matchesProjectOrClientSearch('pooja', mockProject, mockClient), 'Matches by partner name (case-insensitive)');
  // Non-matching query
  assert(!matchesProjectOrClientSearch('neha', mockProject, mockClient), 'Rejects non-matching client/project name');

  // Payment search
  const mockPayment: Payment = {
    id: 'pay-1',
    project_id: 'prj-1',
    company_id: 'twb',
    payment_date: '2026-05-10',
    amount: 100000,
    payment_mode: 'Bank Transfer',
    description: 'First milestone payment',
    receipt_number: 'REC-TWB-0042',
    created_at: '2026-05-10T10:00:00Z',
  };

  assert(matchesPaymentSearch('pooja', mockPayment, mockProject, mockClient), 'Payment matches partner name via project');
  assert(matchesPaymentSearch('REC-TWB-0042', mockPayment, mockProject, mockClient), 'Payment matches receipt number');

  // Project-linked expense
  const mockLinkedExpense: Expense = {
    id: 'exp-1',
    project_id: 'prj-1',
    company_id: 'twb',
    expense_date: '2026-05-12',
    amount: 25000,
    category: 'Equipment Rental',
    description: 'Cinema camera package for Udaipur shoot',
    paid_to: 'ProGear Mumbai',
    created_at: '2026-05-12T12:00:00Z',
  };

  assert(matchesExpenseSearch('pooja', mockLinkedExpense, mockProject, mockClient), 'Linked expense matches partner name via project');
  assert(matchesExpenseSearch('ProGear', mockLinkedExpense, mockProject, mockClient), 'Linked expense matches payee');

  // General studio expense WITHOUT project
  const mockGeneralExpense: Expense = {
    id: 'exp-gen-1',
    project_id: '',
    company_id: 'twb',
    expense_date: '2026-06-01',
    amount: 15000,
    category: 'Studio Gear',
    description: 'SanDisk 2TB Extreme Pro SSD for studio library',
    paid_to: 'Amazon India',
    created_at: '2026-06-01T10:00:00Z',
  };

  // General studio expense with empty search must be visible
  assert(matchesExpenseSearch('', mockGeneralExpense, null, null), 'General expense matches empty search');
  // General studio expense matches its own description or payee
  assert(matchesExpenseSearch('sandisk', mockGeneralExpense, null, null), 'General expense matches description');
  assert(matchesExpenseSearch('amazon', mockGeneralExpense, null, null), 'General expense matches payee');
  // General studio expense must NOT match unrelated client or partner name!
  assert(!matchesExpenseSearch('pooja', mockGeneralExpense, null, null), 'General expense does NOT match unrelated partner name');
  assert(!matchesExpenseSearch('aarav', mockGeneralExpense, null, null), 'General expense does NOT match unrelated client name');
}

// 4. Test Deterministic Transaction Sorting (Newest & Oldest with tie-breakers)
{
  const p1: Payment = {
    id: 'p-1',
    project_id: 'prj-1',
    company_id: 'twb',
    payment_date: '2026-05-10',
    amount: 50000,
    payment_mode: 'Bank Transfer',
    description: 'P1',
    receipt_number: 'REC-001',
    created_at: '2026-05-10T09:00:00Z',
  };

  const p2: Payment = {
    id: 'p-2',
    project_id: 'prj-1',
    company_id: 'twb',
    payment_date: '2026-05-10', // Same date as p1!
    amount: 50000,
    payment_mode: 'UPI',
    description: 'P2',
    receipt_number: 'REC-002',
    created_at: '2026-05-10T14:00:00Z', // Later created_at
  };

  const p3: Payment = {
    id: 'p-3',
    project_id: 'prj-1',
    company_id: 'twb',
    payment_date: '2026-06-15', // Newer date
    amount: 75000,
    payment_mode: 'Credit Card',
    description: 'P3',
    receipt_number: 'REC-003',
    created_at: '2026-06-15T10:00:00Z',
  };

  const sortedNewest = sortPayments([p1, p2, p3], 'newest');
  assert(sortedNewest[0].id === 'p-3', 'Newest sort: newest date first (p3)');
  assert(sortedNewest[1].id === 'p-2', 'Newest sort: tie on same date broken by created_at (p2 > p1)');
  assert(sortedNewest[2].id === 'p-1', 'Newest sort: oldest created_at last (p1)');

  const sortedOldest = sortPayments([p1, p2, p3], 'oldest');
  assert(sortedOldest[0].id === 'p-1', 'Oldest sort: earliest created_at on earliest date first (p1)');
  assert(sortedOldest[1].id === 'p-2', 'Oldest sort: second created_at on earliest date (p2)');
  assert(sortedOldest[2].id === 'p-3', 'Oldest sort: newest date last (p3)');
}

// 5. Test Lifetime Pending Balance Correctness in Profitability Matrix
{
  const mockProject: Project = {
    id: 'prj-lifetime',
    company_id: 'twb',
    client_id: 'cli-1',
    name: 'Lifetime Accounting Test Project',
    wedding_date_start: '2026-11-20',
    wedding_date_end: '2026-11-22',
    venue: 'Goa',
    city: 'Goa',
    client_contact: { phone: '9876543210', email: 'test@example.com' },
    status: 'Booked',
    package_name: 'Diamond',
    package_details: 'Photo + Cinema',
    booking_amount: 50000,
    total_amount: 200000, // Total contract: 2,00,000
    created_at: '2025-05-01',
  };

  // Payment 1 in Previous FY: 50,000
  const pastPayment: Payment = {
    id: 'pay-past',
    project_id: 'prj-lifetime',
    company_id: 'twb',
    payment_date: '2025-10-15',
    amount: 50000,
    payment_mode: 'Bank Transfer',
    description: 'Booking Advance (FY 2025-26)',
    receipt_number: 'REC-001',
    created_at: '2025-10-15T10:00:00Z',
  };

  // Payment 2 in Current FY: 70,000
  const currentPayment: Payment = {
    id: 'pay-curr',
    project_id: 'prj-lifetime',
    company_id: 'twb',
    payment_date: '2026-07-20',
    amount: 70000,
    payment_mode: 'Bank Transfer',
    description: 'Milestone 2 (FY 2026-27)',
    receipt_number: 'REC-002',
    created_at: '2026-07-20T10:00:00Z',
  };

  const allPayments = [pastPayment, currentPayment]; // Total paid lifetime = 120,000
  const currentPeriodPayments = [currentPayment]; // Paid in FY 2026-27 = 70,000

  // When filtering for This Financial Year (FY 2026-27):
  const profitItem = calculateProjectProfitItem(
    mockProject,
    allPayments,
    currentPeriodPayments,
    [], // all expenses
    [], // period expenses
    true // isDateFilterActive
  );

  assert(profitItem.contract === 200000, 'Contract fee is full 2,00,000');
  assert(profitItem.received === 70000, 'Period collected is 70,000 (payments in selected period only)');
  // Pending Balance must be 200000 - 120000 = 80000 (NOT 200000 - 70000 = 130000!)
  assert(
    profitItem.balance === 80000,
    `Lifetime Pending Balance is correctly ₹80,000 based on all-time payments (was ${profitItem.balance})`
  );
  assert(profitItem.allTimeReceived === 120000, 'All-time received is 120,000');
}

// 6. Test Profitability Matrix Activity Sorting (Newest & Oldest with projects without activity and tie-breakers)
{
  const makeProject = (id: string, name: string, weddingDate: string): Project => ({
    id,
    company_id: 'twb',
    client_id: 'cli-1',
    name,
    wedding_date_start: weddingDate,
    wedding_date_end: weddingDate,
    venue: 'Mumbai',
    city: 'Mumbai',
    client_contact: { phone: '1234567890', email: 'test@test.com' },
    status: 'Booked',
    package_name: 'Gold',
    package_details: 'Photo',
    booking_amount: 10000,
    total_amount: 100000,
    created_at: '2026-01-01',
  });

  const pNew: Payment = {
    id: 'pay-new',
    project_id: 'prj-recent',
    company_id: 'twb',
    payment_date: '2026-09-15', // Latest activity: 2026-09-15
    amount: 50000,
    payment_mode: 'Bank Transfer',
    description: 'Recent payment',
    receipt_number: 'REC-01',
    created_at: '2026-09-15T10:00:00Z',
  };

  const pOld: Payment = {
    id: 'pay-old',
    project_id: 'prj-older',
    company_id: 'twb',
    payment_date: '2026-03-10', // Earliest & latest activity: 2026-03-10
    amount: 40000,
    payment_mode: 'UPI',
    description: 'Older payment',
    receipt_number: 'REC-02',
    created_at: '2026-03-10T10:00:00Z',
  };

  const eMid: Expense = {
    id: 'exp-mid',
    project_id: 'prj-mid',
    company_id: 'twb',
    expense_date: '2026-06-20', // Mid activity from expense: 2026-06-20
    amount: 15000,
    category: 'Equipment Rental',
    description: 'Rental',
    paid_to: 'Vendor',
    created_at: '2026-06-20T10:00:00Z',
  };

  const itemRecent = calculateProjectProfitItem(
    makeProject('prj-recent', 'Recent Activity Project', '2026-10-01'),
    [pNew],
    [pNew],
    [],
    [],
    false
  );

  const itemMid = calculateProjectProfitItem(
    makeProject('prj-mid', 'Mid Activity Project', '2026-11-01'),
    [],
    [],
    [eMid],
    [eMid],
    false
  );

  const itemOlder = calculateProjectProfitItem(
    makeProject('prj-older', 'Older Activity Project', '2026-12-01'),
    [pOld],
    [pOld],
    [],
    [],
    false
  );

  const itemNoActivityA = calculateProjectProfitItem(
    makeProject('prj-no-act-a', 'Alpha No Activity Project', '2026-05-01'),
    [],
    [],
    [],
    [],
    false
  );

  const itemNoActivityZ = calculateProjectProfitItem(
    makeProject('prj-no-act-z', 'Zeta No Activity Project', '2026-06-01'),
    [],
    [],
    [],
    [],
    false
  );

  // Verification 1: Newest First
  // Expect order: prj-recent (2026-09-15) -> prj-mid (2026-06-20) -> prj-older (2026-03-10) -> no activity projects at bottom
  const sortedNewest = sortProjectProfitItems(
    [itemOlder, itemNoActivityZ, itemRecent, itemNoActivityA, itemMid],
    'newest'
  );

  assert(sortedNewest[0].project.id === 'prj-recent', 'Profitability Matrix Newest: most recent activity first (prj-recent 2026-09-15)');
  assert(sortedNewest[1].project.id === 'prj-mid', 'Profitability Matrix Newest: second most recent (prj-mid 2026-06-20)');
  assert(sortedNewest[2].project.id === 'prj-older', 'Profitability Matrix Newest: oldest activity last among active (prj-older 2026-03-10)');
  assert(sortedNewest[3].project.id === 'prj-no-act-a', 'Profitability Matrix Newest: inactive project at bottom (alpha tie-break)');
  assert(sortedNewest[4].project.id === 'prj-no-act-z', 'Profitability Matrix Newest: second inactive project at bottom');

  // Verification 2: Oldest First
  // Expect order: prj-older (2026-03-10) -> prj-mid (2026-06-20) -> prj-recent (2026-09-15) -> no activity projects at bottom
  const sortedOldest = sortProjectProfitItems(
    [itemRecent, itemNoActivityA, itemOlder, itemNoActivityZ, itemMid],
    'oldest'
  );

  assert(sortedOldest[0].project.id === 'prj-older', 'Profitability Matrix Oldest: earliest activity first (prj-older 2026-03-10)');
  assert(sortedOldest[1].project.id === 'prj-mid', 'Profitability Matrix Oldest: mid activity second (prj-mid 2026-06-20)');
  assert(sortedOldest[2].project.id === 'prj-recent', 'Profitability Matrix Oldest: newest activity last among active (prj-recent 2026-09-15)');
  assert(sortedOldest[3].project.id === 'prj-no-act-a', 'Profitability Matrix Oldest: inactive projects consistently at bottom in oldest sort too');
  assert(sortedOldest[4].project.id === 'prj-no-act-z', 'Profitability Matrix Oldest: second inactive project at bottom');

  // Verification 3: Identical Activity Dates (Deterministic Tie-Breaker)
  const itemTie1 = calculateProjectProfitItem(
    makeProject('prj-tie-1', 'B Tie Project', '2026-08-10'),
    [pNew], // same payment date 2026-09-15
    [pNew],
    [],
    [],
    false
  );
  const itemTie2 = calculateProjectProfitItem(
    makeProject('prj-tie-2', 'A Tie Project', '2026-08-20'),
    [pNew], // same payment date 2026-09-15
    [pNew],
    [],
    [],
    false
  );

  const sortedTies = sortProjectProfitItems([itemTie1, itemTie2], 'newest');
  // Ties on same activity date are broken deterministically by wedding_date_start: 2026-08-20 before 2026-08-10 in newest
  assert(sortedTies[0].project.id === 'prj-tie-2', 'Identical dates deterministic tie-break works correctly');
  assert(sortedTies[1].project.id === 'prj-tie-1', 'Identical dates deterministic tie-break second place stable');

  // Verification 4: Date Filter Interaction
  // When date filter is active, only transactions within the period count as activity
  const itemPeriodFiltered = calculateProjectProfitItem(
    makeProject('prj-filter-test', 'Period Filter Test', '2026-10-01'),
    [pOld, pNew], // All-time payments has 2026-03-10 and 2026-09-15
    [pNew],       // Period payments only has 2026-09-15
    [],
    [],
    true          // isDateFilterActive = true
  );
  assert(itemPeriodFiltered.earliestActivityDate === '2026-09-15', 'Date filter active: earliest activity respects period filter');
  assert(itemPeriodFiltered.latestActivityDate === '2026-09-15', 'Date filter active: latest activity respects period filter');
}

// 7. Test Dashboard Financial Metrics with Period Filtering & Lifetime Integrity
{
  const mockProjects: Project[] = [
    {
      id: 'prj-dash-1',
      company_id: 'twb',
      client_id: 'cli-1',
      name: 'Royal Palace Wedding',
      wedding_date_start: '2026-11-20',
      wedding_date_end: '2026-11-22',
      venue: 'Palace',
      city: 'Jaipur',
      client_contact: { phone: '1234567890', email: 'test1@test.com' },
      status: 'Booked',
      package_name: 'Royal',
      package_details: 'Cinema',
      booking_amount: 50000,
      total_amount: 300000, // 3,00,000
      created_at: '2025-06-01',
    },
    {
      id: 'prj-dash-2',
      company_id: 'twb',
      client_id: 'cli-2',
      name: 'Beachside Wedding',
      wedding_date_start: '2026-12-10',
      wedding_date_end: '2026-12-12',
      venue: 'Resort',
      city: 'Goa',
      client_contact: { phone: '1234567891', email: 'test2@test.com' },
      status: 'Booked',
      package_name: 'Beach',
      package_details: 'Photo',
      booking_amount: 40000,
      total_amount: 200000, // 2,00,000
      created_at: '2025-08-01',
    },
  ];
  // Total Contract Pipeline = 3,00,000 + 2,00,000 = 5,00,000

  // Payment 1 in Previous FY (2025-10-15): 1,00,000 for prj-dash-1
  const payPast: Payment = {
    id: 'pay-dash-past',
    project_id: 'prj-dash-1',
    company_id: 'twb',
    payment_date: '2025-10-15',
    amount: 100000,
    payment_mode: 'Bank Transfer',
    description: 'Booking Advance',
    receipt_number: 'REC-01',
    created_at: '2025-10-15T10:00:00Z',
  };

  // Payment 2 in Current FY (2026-06-20): 1,50,000 for prj-dash-1
  const payCurr1: Payment = {
    id: 'pay-dash-curr-1',
    project_id: 'prj-dash-1',
    company_id: 'twb',
    payment_date: '2026-06-20',
    amount: 150000,
    payment_mode: 'Bank Transfer',
    description: 'Milestone 2',
    receipt_number: 'REC-02',
    created_at: '2026-06-20T10:00:00Z',
  };

  // Payment 3 in Current FY (2026-08-10): 80,000 for prj-dash-2
  const payCurr2: Payment = {
    id: 'pay-dash-curr-2',
    project_id: 'prj-dash-2',
    company_id: 'twb',
    payment_date: '2026-08-10',
    amount: 80000,
    payment_mode: 'UPI',
    description: 'Advance',
    receipt_number: 'REC-03',
    created_at: '2026-08-10T10:00:00Z',
  };
  // All-time payments received = 1,00,000 + 1,50,000 + 80,000 = 3,30,000
  // True lifetime Pending Receivables = 5,00,000 - 3,30,000 = 1,70,000

  // Expense 1 in Previous FY (2025-11-01): 30,000
  const expPast: Expense = {
    id: 'exp-dash-past',
    project_id: 'prj-dash-1',
    company_id: 'twb',
    expense_date: '2025-11-01',
    amount: 30000,
    category: 'Crew Travel',
    description: 'Advance flight booking',
    paid_to: 'Airline',
    created_at: '2025-11-01T10:00:00Z',
  };

  // Expense 2 in Current FY (2026-07-05): 50,000
  const expCurr: Expense = {
    id: 'exp-dash-curr',
    project_id: 'prj-dash-1',
    company_id: 'twb',
    expense_date: '2026-07-05',
    amount: 50000,
    category: 'Equipment Rental',
    description: 'Gimbal & lenses',
    paid_to: 'Camera Rental Co',
    created_at: '2026-07-05T10:00:00Z',
  };
  // All-time expenses = 30,000 + 50,000 = 80,000

  const allPayments = [payPast, payCurr1, payCurr2];
  const allExpenses = [expPast, expCurr];

  // Test Case A: All Dates Filter
  const allDatesRange = resolveActiveDateRange('all', '', '', new Date(2026, 9, 15));
  const allMetrics = calculateDashboardFinanceMetrics(mockProjects, allPayments, allExpenses, allDatesRange);

  assert(allMetrics.contractPipeline === 500000, 'All Dates: Contract Pipeline is lifetime 5,00,000');
  assert(allMetrics.periodPaymentsReceived === 330000, 'All Dates: Payments received is lifetime 3,30,000');
  assert(allMetrics.pendingReceivables === 170000, 'All Dates: Pending receivables is 1,70,000');
  assert(allMetrics.periodExpenses === 80000, 'All Dates: Expenses is lifetime 80,000');
  assert(allMetrics.operatingProfit === 250000, 'All Dates: Operating profit is 3,30,000 - 80,000 = 2,50,000');

  // Test Case B: This Financial Year (FY 2026–27: 2026-04-01 to 2027-03-31)
  const thisFyRange = resolveActiveDateRange('this_fy', '', '', new Date(2026, 9, 15));
  const fyMetrics = calculateDashboardFinanceMetrics(mockProjects, allPayments, allExpenses, thisFyRange);

  // Contract Pipeline MUST remain the lifetime total 5,00,000 (never changes with period filter)
  assert(fyMetrics.contractPipeline === 500000, 'FY Filter: Contract Pipeline remains full lifetime value 5,00,000');

  // Payments received must reflect only payments within FY 2026–27: payCurr1 (1,50,000) + payCurr2 (80,000) = 2,30,000
  assert(fyMetrics.periodPaymentsReceived === 230000, 'FY Filter: Period payments is 2,30,000');
  assert(fyMetrics.periodPaymentsCount === 2, 'FY Filter: 2 payments in period');

  // Pending Receivables MUST remain true lifetime outstanding balance: 5,00,000 - 3,30,000 = 1,70,000
  // It must NEVER be 5,00,000 - 2,30,000 = 2,70,000!
  assert(
    fyMetrics.pendingReceivables === 170000,
    `FY Filter: Pending Receivables protected as true lifetime balance 1,70,000 (got ${fyMetrics.pendingReceivables})`
  );

  // Production expenses must reflect only expenses within FY 2026–27: expCurr (50,000)
  assert(fyMetrics.periodExpenses === 50000, 'FY Filter: Period expenses is 50,000');
  assert(fyMetrics.periodExpensesCount === 1, 'FY Filter: 1 expense in period');

  // Operating Profit is selected-period payments minus selected-period expenses: 2,30,000 - 50,000 = 1,80,000
  assert(fyMetrics.operatingProfit === 180000, 'FY Filter: Operating profit is period payments minus period expenses (1,80,000)');

  // Test Case C: Custom Date Range (Inclusive: 2026-06-01 to 2026-07-31)
  // Contains payCurr1 (2026-06-20: 1,50,000) and expCurr (2026-07-05: 50,000)
  const customRange = resolveActiveDateRange('custom', '2026-06-01', '2026-07-31', new Date(2026, 9, 15));
  const customMetrics = calculateDashboardFinanceMetrics(mockProjects, allPayments, allExpenses, customRange);

  assert(customMetrics.contractPipeline === 500000, 'Custom Range: Pipeline remains 5,00,000');
  assert(customMetrics.periodPaymentsReceived === 150000, 'Custom Range: Period payments is 1,50,000 (payCurr1 only)');
  assert(customMetrics.periodExpenses === 50000, 'Custom Range: Period expenses is 50,000 (expCurr only)');
  assert(customMetrics.operatingProfit === 100000, 'Custom Range: Operating profit is 1,50,000 - 50,000 = 1,00,000');
  assert(customMetrics.pendingReceivables === 170000, 'Custom Range: Pending balance remains true lifetime 1,70,000');
}

console.log('--- All Finance Utilities Unit Tests Passed (0 failures) ---');
