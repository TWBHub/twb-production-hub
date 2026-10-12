# Final Implementation Plan: TWBHub Financial Bug Repairs & Verification

## Title & Summary
Final diagnostic and safe repair plan for financial reporting in TWBHub. Covers: (1) surfacing captured booking-retainer insertion errors with duplicate-protected manual confirmation, (2) establishing verified Supabase payment records as the sole source of truth for PDF and project balances, and (3) documenting the explicitly unresolved status of the ₹16 contract amount discrepancy.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The live Supabase database cannot be queried from this environment due to role permissions (`42501: permission denied for table projects` on anon key). Database column presence, constraint definitions, and live row values remain unverified.

- **Confirmed Decision 1 (Retainer Warning Distinction)**:
  - The UI will explicitly distinguish between:
    - **Confirmed Insertion Failure**: The project object contains a captured `booking_payment_error`. The UI renders a dedicated alert displaying the exact captured error message without implying unverified causes.
    - **Unpaid / Zero Records State**: The project has `booking_amount > 0` but no payment records and no insertion error. This is standard pending status, not an insertion failure.
- **Confirmed Decision 2 (Manual Confirmation & Duplicate Protection)**:
  - No automatic background retries or automatic payment creation.
  - Any manual action to record a payment must require explicit user confirmation (via the standard payment confirmation modal) and must check for existing payment records for that `project_id` to prevent duplicate receipts.
- **Confirmed Decision 3 (Payment Records as Sole Source of Truth)**:
  - `generateOrderFormPDF` will accept `payments: Payment[]` and compute advance received and balance due strictly from real payment records (`payments.filter(p => p.project_id === project.id)`). Stale fallbacks to `project.booking_amount` as proof of payment are removed.
- **Confirmed Decision 4 (₹16 Discrepancy Explicitly Unresolved)**:
  - The root cause of the ₹16 discrepancy (₹2,00,000 displaying ₹1,99,984) remains **explicitly unresolved**. We do not modify existing contract values, nor do we claim that modifying future payloads resolves historical data in Supabase.
- **Confirmed Decision 5 (Payment Mode Unchanged)**:
  - Payment mode insertion format remains unchanged in code until authorized verification of the live `payments_payment_mode_check` constraint is completed.

---

## 1. Root Cause & Architecture Analysis

### Bug 1: Contract Discrepancy (₹2,00,000 vs. ₹1,99,984) — Explicitly Unresolved
1. **Confirmed Code Trace**:
   - `mapSupabaseProjectToModel` (`src/services/api.ts`, lines 149–152):
     ```ts
     total_amount:
       Number(meta.total_amount ?? row.total_amount) ||
       Number(row.booking_amount) ||
       0
     ```
     `meta.total_amount` (from `row.notes` JSON) takes precedence over `row.total_amount`.
   - In JavaScript (IEEE-754), `200000` is an exact integer.
   - There is no `- 16` calculation, fee deduction, tax math, or precision truncation anywhere in the application code.
2. **Status**:
   - **Explicitly Unresolved**: Because the unauthenticated environment cannot inspect live rows in `public.projects`, the exact stored content of `row.notes` and `row.total_amount` for the affected project remains unknown. No historical data will be altered, and no unverified claims will be made regarding future payload changes fixing past records.

---

### Bug 2: Booking Retainer Inconsistencies & PDF Balances

1. **Captured Insertion Error Swallowing (Confirmed from Code)**:
   - In `src/services/api.ts` (`createProject`, lines 884–901), when `createPayment` fails, `createProject` catches the error, sets `(newProject as any).booking_payment_error = payErr?.message || String(payErr)`, and continues without alerting the user.
   - `ProjectsView.tsx` ignores `booking_payment_error` and opens `ProjectDetailWorkspace`.
   - The user sees `Paid: ₹0` with no explanation that the retainer insertion failed.
2. **Stale PDF Fallback (Confirmed from Code)**:
   - In `src/utils/pdfGenerator.ts` (`generateOrderFormPDF`, lines 1091–1094 & 1476–1493):
     ```ts
     const totalContractFee = Number(project.total_amount) || 0;
     const bookingRetainer = Number(project.booking_amount) || 0;
     const remainingBalance = Math.max(0, totalContractFee - bookingRetainer);
     ```
   - `generateOrderFormPDF` hardcoded `bookingRetainer = project.booking_amount` under "ADVANCE / PAYMENT RECEIVED".
   - If a payment was never recorded or if a receipt was deleted, the PDF erroneously displayed ₹20,000 paid.
3. **Live Constraint Status (Unverified Blocker)**:
   - The live definition of `payments_payment_mode_check` cannot be queried without authorized access. Payment mode formatting in `createPayment` will remain untouched.

---

## 2. Safe Proposed Repairs

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       System State & Notification Flow                     │
└────────────────────────────────────────────────────────────────────────────┘

  [ Project Loaded in Workspace ]
         │
         ├── Does `project.booking_payment_error` exist?
         │      ├── YES ──► Display dedicated alert banner:
         │      │           "Booking Retainer Recording Failed"
         │      │           Displays exact captured error string.
         │      │           Manual "Record Payment" button (triggers standard modal).
         │      │
         │      └── NO  ──► Standard workspace view (Paid ₹0, Pending Balance).
         │                  (No false failure alert).
         │
  [ Manual Retainer Recording Action ]
         │
         ├── Check for existing payments for `project_id` (Duplicate Guard)
         └── Require user confirmation through standard payment modal.
             (Zero automatic retries).

  [ Production Order Form PDF & Metrics ]
         │
         └── Computes Total Paid = SUM(payments.amount WHERE project_id = project.id)
             Computes Balance Due = MAX(0, Total Contract - Total Paid)
             (Zero reliance on stale `project.booking_amount` as proof of payment).
```

### Exact Files to Modify:

1. **`src/components/projects/ProjectDetailWorkspace.tsx`**:
   - Render a dedicated error alert **only** when `project.booking_payment_error` is present:
     - Clearly states that automated recording of the booking retainer encountered an error during project creation.
     - Displays the exact string from `project.booking_payment_error`.
     - Provides an action that opens the standard payment creation modal with pre-filled retainer details, prompting the user for explicit confirmation.
     - Checks that no existing payment record already exists for this project before submitting.
   - Pass `projectPayments` (the filtered list of payments for this project) into `generateOrderFormPDF`.
2. **`src/utils/pdfGenerator.ts`**:
   - Update `generateOrderFormPDF` signature to accept `payments: Payment[] = []`.
   - Derive `actualPaid = payments.filter(p => p.project_id === project.id).reduce((sum, p) => sum + p.amount, 0)`.
   - Derive `remainingBalance = Math.max(0, totalContractFee - actualPaid)`.
   - Under "ADVANCE / PAYMENT RECEIVED", display `actualPaid`.
   - Under "BALANCE DUE", display `remainingBalance`.
3. **`src/components/projects/ProjectsView.tsx` & `src/components/projects/ProjectTermsEditor.tsx`**:
   - Update calls to `generateOrderFormPDF` to pass existing project payments.

---

## 3. Strict Safety & Verification Plan

### Testable Safely in this Environment:
1. **Compilation & Static Analysis**: Run `compile_applet` and `lint_applet` to verify TypeScript types, imports, and component props.
2. **PDF Calculation Verification**:
   - Verify that when `payments` is empty (`[]`), the PDF renders `Advance / Payment Received: ₹0` and `Balance Due: ₹2,00,000`.
   - Verify that when a payment record of ₹20,000 is passed, the PDF renders `Advance / Payment Received: ₹20,000` and `Balance Due: ₹1,80,000`.
3. **UI Retainer Error State Verification**:
   - Verify that a project with `booking_payment_error` renders the captured error text.
   - Verify that a project without `booking_payment_error` does not render an error banner.
4. **Duplicate Prevention Logic**:
   - Verify that the payment recording flow verifies existing payments before creating a new receipt.

### Out-of-Scope / Requires Authorized Verification:
1. Querying live Supabase constraints (`payments_payment_mode_check`).
2. Modifying or inspecting the live project row containing the ₹199,984 value.
3. Making database DDL/schema modifications.

### GitHub Repository Protection:
- Branch `main` on `TWBHub/twb-production-hub` will remain intact. No git reset, revert, force push, or branch alterations will occur.
