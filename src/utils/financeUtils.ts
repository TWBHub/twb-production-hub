import { Payment, Expense, Project, Client } from '../types';
import { formatDisplayDate } from './dateUtils';

export type DateFilterOption = 'all' | 'this_fy' | 'prev_fy' | 'custom';
export type SortOrderOption = 'newest' | 'oldest';

export interface ResolvedDateRange {
  isActive: boolean;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  displayLabel: string;
}

/**
 * Calculates Indian Financial Year boundaries (1 April to 31 March).
 * In India, FY runs from April 1 of year Y to March 31 of year Y+1.
 * @param offsetYears 0 for current FY, -1 for previous FY
 * @param refDate Reference date, defaults to current time
 */
export function getIndianFinancialYearBoundaries(
  offsetYears: number = 0,
  refDate: Date = new Date()
): {
  startDate: string;
  endDate: string;
  label: string;
  fyShort: string;
} {
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr, 9 = Oct
  
  // If current month is April or later (>= 3), current FY began April 1 of currentYear.
  // If current month is Jan-Mar (< 3), current FY began April 1 of (currentYear - 1).
  const baseStartYear = (currentMonth >= 3 ? currentYear : currentYear - 1) + offsetYears;
  const startYear = baseStartYear;
  const endYear = baseStartYear + 1;

  const startDate = `${startYear}-04-01`;
  const endDate = `${endYear}-03-31`;
  const fyShort = `FY ${startYear}–${String(endYear).slice(-2)}`;
  const label = offsetYears === 0
    ? `This Financial Year (${fyShort})`
    : `Previous Financial Year (${fyShort})`;

  return { startDate, endDate, label, fyShort };
}

/**
 * Resolves the active date range from the selected filter and custom inputs.
 * Gracefully handles reversed dates, incomplete dates, and empty inputs.
 */
export function resolveActiveDateRange(
  option: DateFilterOption,
  customStart?: string,
  customEnd?: string,
  refDate: Date = new Date()
): ResolvedDateRange {
  if (option === 'all') {
    return {
      isActive: false,
      startDate: null,
      endDate: null,
      displayLabel: 'All Time',
    };
  }

  if (option === 'this_fy') {
    const fy = getIndianFinancialYearBoundaries(0, refDate);
    return {
      isActive: true,
      startDate: fy.startDate,
      endDate: fy.endDate,
      displayLabel: fy.label,
    };
  }

  if (option === 'prev_fy') {
    const fy = getIndianFinancialYearBoundaries(-1, refDate);
    return {
      isActive: true,
      startDate: fy.startDate,
      endDate: fy.endDate,
      displayLabel: fy.label,
    };
  }

  if (option === 'custom') {
    let start = customStart?.trim() || null;
    let end = customEnd?.trim() || null;

    // Handle reversed range safely
    if (start && end && start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const hasDates = Boolean(start || end);
    let label = 'Custom Range';
    if (start && end) {
      label = `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
    } else if (start) {
      label = `From ${formatDisplayDate(start)}`;
    } else if (end) {
      label = `Up to ${formatDisplayDate(end)}`;
    }

    return {
      isActive: hasDates,
      startDate: start,
      endDate: end,
      displayLabel: label,
    };
  }

  return {
    isActive: false,
    startDate: null,
    endDate: null,
    displayLabel: 'All Time',
  };
}

/**
 * Checks if a transaction date string is within the inclusive [startDate, endDate] range.
 */
export function isDateInRange(
  dateStr: string | undefined | null,
  startDate?: string | null,
  endDate?: string | null
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (startDate && d < startDate.slice(0, 10)) return false;
  if (endDate && d > endDate.slice(0, 10)) return false;
  return true;
}

/**
 * Searches case-insensitively across Project name, Client name, and Partner name.
 */
export function matchesProjectOrClientSearch(
  query: string,
  project?: Project | null,
  client?: Client | null
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (project?.name && project.name.toLowerCase().includes(q)) return true;
  if (client?.name && client.name.toLowerCase().includes(q)) return true;
  if (client?.partner_name && client.partner_name.toLowerCase().includes(q)) return true;

  return false;
}

/**
 * Searches Payments case-insensitively.
 * Matches linked project name, client name, partner name, plus receipt number or description.
 */
export function matchesPaymentSearch(
  query: string,
  payment: Payment,
  project?: Project | null,
  client?: Client | null
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (matchesProjectOrClientSearch(q, project, client)) return true;
  if (payment.receipt_number && payment.receipt_number.toLowerCase().includes(q)) return true;
  if (payment.description && payment.description.toLowerCase().includes(q)) return true;

  return false;
}

/**
 * Searches Expenses case-insensitively.
 * For project-linked expenses, matches the linked project/client/partner, payee, description, or category.
 * For general studio expenses without a project, matches ONLY their own meaningful text fields
 * (payee, description, category) without associating with unrelated clients.
 */
export function matchesExpenseSearch(
  query: string,
  expense: Expense,
  project?: Project | null,
  client?: Client | null
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // If linked to a project, allow matching through linked project and client/partner
  if (expense.project_id && project) {
    if (matchesProjectOrClientSearch(q, project, client)) return true;
  }

  // Always check expense's own meaningful text fields
  if (expense.paid_to && expense.paid_to.toLowerCase().includes(q)) return true;
  if (expense.description && expense.description.toLowerCase().includes(q)) return true;
  if (expense.category && expense.category.toLowerCase().includes(q)) return true;

  return false;
}

/**
 * Deterministically sorts payments by payment_date, with tie-breakers.
 */
export function sortPayments(
  payments: Payment[],
  order: SortOrderOption
): Payment[] {
  return [...payments].sort((a, b) => {
    const dateCmp = a.payment_date.localeCompare(b.payment_date);
    if (dateCmp !== 0) {
      return order === 'newest' ? -dateCmp : dateCmp;
    }
    // Tie-breaker 1: created_at
    if (a.created_at && b.created_at) {
      const createdCmp = a.created_at.localeCompare(b.created_at);
      if (createdCmp !== 0) {
        return order === 'newest' ? -createdCmp : createdCmp;
      }
    }
    // Tie-breaker 2: receipt_number or id
    const idA = a.receipt_number || a.id;
    const idB = b.receipt_number || b.id;
    const idCmp = idA.localeCompare(idB);
    return order === 'newest' ? -idCmp : idCmp;
  });
}

/**
 * Deterministically sorts expenses by expense_date, with tie-breakers.
 */
export function sortExpenses(
  expenses: Expense[],
  order: SortOrderOption
): Expense[] {
  return [...expenses].sort((a, b) => {
    const dateCmp = a.expense_date.localeCompare(b.expense_date);
    if (dateCmp !== 0) {
      return order === 'newest' ? -dateCmp : dateCmp;
    }
    // Tie-breaker 1: created_at
    if (a.created_at && b.created_at) {
      const createdCmp = a.created_at.localeCompare(b.created_at);
      if (createdCmp !== 0) {
        return order === 'newest' ? -createdCmp : createdCmp;
      }
    }
    // Tie-breaker 2: id
    const idCmp = a.id.localeCompare(b.id);
    return order === 'newest' ? -idCmp : idCmp;
  });
}

export interface ProjectProfitItem {
  project: Project;
  contract: number;
  received: number;      // Period collected when date filter active, else lifetime collected
  cost: number;          // Period expenses when date filter active, else lifetime expenses
  profit: number;        // Period profit (received - cost)
  balance: number;       // True lifetime outstanding balance (contract - allTimeReceived)
  allTimeReceived: number;
  hasActivityInPeriod: boolean;
  latestActivityDate: string | null;
  earliestActivityDate: string | null;
}

/**
 * Calculates project profitability metrics for a given project.
 * Enforces the critical accounting rule:
 * - Pending Balance is ALWAYS the true lifetime outstanding balance from all-time payments.
 * - When a date range is active, Collected and Expenses reflect the selected period.
 * - Extracts earliest and latest financial activity dates based on relevant transactions.
 */
export function calculateProjectProfitItem(
  project: Project,
  allPaymentsForProject: Payment[],
  periodPaymentsForProject: Payment[],
  allExpensesForProject: Expense[],
  periodExpensesForProject: Expense[],
  isDateFilterActive: boolean
): ProjectProfitItem {
  const contract = project.total_amount;
  const allTimeReceived = allPaymentsForProject.reduce((sum, p) => sum + p.amount, 0);
  const lifetimeBalance = Math.max(0, contract - allTimeReceived);

  const received = isDateFilterActive
    ? periodPaymentsForProject.reduce((sum, p) => sum + p.amount, 0)
    : allTimeReceived;

  const cost = isDateFilterActive
    ? periodExpensesForProject.reduce((sum, e) => sum + e.amount, 0)
    : allExpensesForProject.reduce((sum, e) => sum + e.amount, 0);

  const profit = received - cost;
  const hasActivityInPeriod = periodPaymentsForProject.length > 0 || periodExpensesForProject.length > 0;

  // Relevant payments & expenses for activity date determination (respecting date filter)
  const relevantPayments = isDateFilterActive ? periodPaymentsForProject : allPaymentsForProject;
  const relevantExpenses = isDateFilterActive ? periodExpensesForProject : allExpensesForProject;

  const activityDates = [
    ...relevantPayments.map(p => p.payment_date?.slice(0, 10)),
    ...relevantExpenses.map(e => e.expense_date?.slice(0, 10)),
  ].filter((d): d is string => Boolean(d && d.length >= 10));

  let latestActivityDate: string | null = null;
  let earliestActivityDate: string | null = null;

  if (activityDates.length > 0) {
    activityDates.sort();
    earliestActivityDate = activityDates[0];
    latestActivityDate = activityDates[activityDates.length - 1];
  }

  return {
    project,
    contract,
    received,
    cost,
    profit,
    balance: lifetimeBalance,
    allTimeReceived,
    hasActivityInPeriod,
    latestActivityDate,
    earliestActivityDate,
  };
}

/**
 * Sorts Project Profitability Matrix items by their financial activity dates:
 * - 'newest': latest activity date descending (most recent financial activity first).
 * - 'oldest': earliest activity date ascending (earliest financial activity first).
 * - Projects with no financial activity consistently appear at the bottom in both directions.
 * - Deterministic tie-breakers: wedding_date_start, project.name, project.id.
 */
export function sortProjectProfitItems(
  items: ProjectProfitItem[],
  order: SortOrderOption
): ProjectProfitItem[] {
  return [...items].sort((a, b) => {
    const aDate = order === 'newest' ? a.latestActivityDate : a.earliestActivityDate;
    const bDate = order === 'newest' ? b.latestActivityDate : b.earliestActivityDate;

    // Rule: Projects with no financial activity consistently appear at the bottom in both directions
    if (!aDate && !bDate) {
      const nameCmp = a.project.name.localeCompare(b.project.name);
      if (nameCmp !== 0) return nameCmp;
      return a.project.id.localeCompare(b.project.id);
    }
    if (!aDate) return 1;  // a has no activity -> goes to bottom
    if (!bDate) return -1; // b has no activity -> goes to bottom

    // Both have activity
    const dateCmp = aDate.localeCompare(bDate);
    if (dateCmp !== 0) {
      return order === 'newest' ? -dateCmp : dateCmp;
    }

    // Deterministic tie-breaker 1: Project wedding date (if available)
    if (a.project.wedding_date_start && b.project.wedding_date_start) {
      const weddingCmp = a.project.wedding_date_start.localeCompare(b.project.wedding_date_start);
      if (weddingCmp !== 0) {
        return order === 'newest' ? -weddingCmp : weddingCmp;
      }
    }

    // Deterministic tie-breaker 2: Project name
    const nameCmp = a.project.name.localeCompare(b.project.name);
    if (nameCmp !== 0) return nameCmp;

    // Deterministic tie-breaker 3: Project id
    return a.project.id.localeCompare(b.project.id);
  });
}

export interface DashboardFinanceMetrics {
  contractPipeline: number;
  periodPaymentsReceived: number;
  periodExpenses: number;
  operatingProfit: number;
  pendingReceivables: number;
  periodPaymentsCount: number;
  periodExpensesCount: number;
}

/**
 * Calculates financial metrics for the main Dashboard:
 * - contractPipeline: Lifetime total contract value. Does not change with selected period.
 * - periodPaymentsReceived: Sum of payments whose payment dates fall within the selected period.
 * - periodExpenses: Sum of expenses whose expense dates fall within the selected period.
 * - operatingProfit: Selected-period payments received minus selected-period expenses.
 * - pendingReceivables: True lifetime outstanding balance (contractPipeline - allTimePayments). Never calculated from only period payments.
 * - For All Dates, matches equivalent lifetime totals.
 */
export function calculateDashboardFinanceMetrics(
  projects: Project[],
  payments: Payment[],
  expenses: Expense[],
  resolvedDateRange: ResolvedDateRange
): DashboardFinanceMetrics {
  // 1. Contract Pipeline: Lifetime total contract value
  const contractPipeline = projects.reduce((acc, p) => acc + p.total_amount, 0);

  // 2. All-time payments received (brand-filtered) for true lifetime pending balance
  const allTimePaymentsReceived = payments.reduce((sum, pm) => sum + pm.amount, 0);

  // 3. Pending Receivables: True lifetime outstanding balance
  const pendingReceivables = Math.max(0, contractPipeline - allTimePaymentsReceived);

  // 4. Period payments received
  const periodPayments = resolvedDateRange.isActive
    ? payments.filter(p => isDateInRange(p.payment_date, resolvedDateRange.startDate, resolvedDateRange.endDate))
    : payments;
  const periodPaymentsReceived = periodPayments.reduce((sum, pm) => sum + pm.amount, 0);

  // 5. Period production expenses
  const periodExpensesList = resolvedDateRange.isActive
    ? expenses.filter(e => isDateInRange(e.expense_date, resolvedDateRange.startDate, resolvedDateRange.endDate))
    : expenses;
  const periodExpenses = periodExpensesList.reduce((acc, e) => acc + e.amount, 0);

  // 6. Operating Profit: Selected-period payments received minus selected-period expenses
  const operatingProfit = periodPaymentsReceived - periodExpenses;

  return {
    contractPipeline,
    periodPaymentsReceived,
    periodExpenses,
    operatingProfit,
    pendingReceivables,
    periodPaymentsCount: periodPayments.length,
    periodExpensesCount: periodExpensesList.length,
  };
}

export interface FinanceViewMetrics {
  totalPipeline: number;
  totalReceived: number;
  totalExpenses: number;
  businessOverheads: number;
  productionExpenses: number;
  pendingReceivables: number;
  netMargin: number;
  marginPercentage: number;
}

/**
 * Calculates finance KPI metrics for the Main Finance View:
 * - totalPipeline: Lifetime total contract value across the entire selected brand portfolio.
 *   Does not shrink when date filter or search query is applied.
 * - totalReceived: Inflow from payment records matching active brand filter, date filter, and search.
 *   Correctly reflects payments matching receipt numbers or descriptions.
 * - totalExpenses: Inflow outflow from expense records matching brand filter, date filter, and search.
 * - pendingReceivables: True lifetime outstanding balance (totalPipeline - allTimeBrandPayments).
 *   Protected against period or search shrinking, with non-negative balance preserved.
 * - netMargin: Selected-period/filtered payments received minus selected-period/filtered expenses.
 * - marginPercentage: Operational margin percentage based on totalReceived.
 */

export function calculateFinanceViewMetrics(
  brandProjects: Project[],
  allBrandPayments: Payment[],
  displayedPayments: Payment[],
  displayedExpenses: Expense[]
): FinanceViewMetrics {
  const totalPipeline = brandProjects.reduce(
    (sum, p) => sum + p.total_amount,
    0
  );

  const totalReceived = displayedPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

    const businessOverheads = displayedExpenses
    .filter(e => e.expense_type === 'business')
    .reduce((sum, e) => sum + e.amount, 0);

  const productionExpenses = displayedExpenses
    .filter(e => e.expense_type !== 'business')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpenses = businessOverheads + productionExpenses;

  const allTimePaymentsReceived = allBrandPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const pendingReceivables = Math.max(
    0,
    totalPipeline - allTimePaymentsReceived
  );

  const netMargin = totalReceived - totalExpenses;

  const marginPercentage =
    totalReceived > 0
      ? Math.round((netMargin / totalReceived) * 100)
      : 0;

      return {
    totalPipeline,
    totalReceived,
    totalExpenses,
    businessOverheads,
    productionExpenses,
    pendingReceivables,
    netMargin,
    marginPercentage,
  };
}