import { calculateCalendarDaysElapsed, formatTurnaroundDays } from './dateUtils';
import { apiService } from '../services/api';
import { Deliverable, DeliverableStatus, Editor } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function runEditorsWorkloadTests() {
  console.log('--- Starting Editors & Workload Tests ---');

  // ==========================================
  // Test 1: Calendar Days Elapsed & Turnaround
  // ==========================================
  console.log('\n[Suite 1] Turnaround Calculations & Missing Dates');
  assert(calculateCalendarDaysElapsed('2026-10-10', '2026-10-15') === 5, 'Elapsed days: 10th to 15th is 5 calendar days');
  assert(calculateCalendarDaysElapsed('2026-10-10', '2026-10-10') === 0, 'Elapsed days: same date is 0 calendar days');
  assert(calculateCalendarDaysElapsed('2026-10-15', '2026-10-10') === 0, 'Elapsed days: reversed dates clamp safely to 0');
  assert(calculateCalendarDaysElapsed(null, '2026-10-15') === null, 'Elapsed days: null start returns null');
  assert(calculateCalendarDaysElapsed('2026-10-10', undefined) === null, 'Elapsed days: undefined end returns null');
  assert(calculateCalendarDaysElapsed('', '') === null, 'Elapsed days: empty strings return null');
  assert(calculateCalendarDaysElapsed('invalid-date', '2026-10-10') === null, 'Elapsed days: invalid start returns null');

  assert(formatTurnaroundDays('2026-10-10', '2026-10-10') === 'Same day (0 days)', 'Format turnaround: same day produces "Same day (0 days)"');
  assert(formatTurnaroundDays('2026-10-10', '2026-10-11') === '1 calendar day', 'Format turnaround: 1 day produces "1 calendar day"');
  assert(formatTurnaroundDays('2026-10-10', '2026-10-17') === '7 calendar days', 'Format turnaround: 7 days produces "7 calendar days"');
  assert(formatTurnaroundDays(undefined, '2026-10-10', 'In progress') === 'In progress', 'Format turnaround: missing start produces fallback');
  assert(formatTurnaroundDays('2026-10-10', undefined, 'Pending delivery') === 'Pending delivery', 'Format turnaround: missing end produces fallback');

  // ==========================================
  // Test 2: Milestone Timestamp Persistence & Overwrite Protection
  // ==========================================
  console.log('\n[Suite 2] Milestone Persistence & Overwrite Protection');

  // Clean test deliverable in memory
  const testDelId = 'test-del-' + Date.now();
  const initialAssignedAt = '2026-10-01T10:00:00.000Z';
  const initialDeliverable: Deliverable = {
    id: testDelId,
    project_id: 'prj-test-1',
    company_id: 'twb',
    deliverable_type: 'Highlight Film (4-5 mins)',
    assigned_editor_id: 'ed-marcus',
    due_date: '2026-10-25',
    status: 'In Progress',
    priority: 'High',
    assigned_at: initialAssignedAt,
    last_updated: initialAssignedAt,
  };

  // 2a. Unrelated edit must NOT change assigned_at
  const updatedNotes = await apiService.updateDeliverable({
    ...initialDeliverable,
    notes: 'Updated client creative notes',
    due_date: '2026-10-28',
  });
  assert(
    updatedNotes.assigned_at === initialAssignedAt,
    'Unrelated edit: assigned_at remains preserved when notes/due_date change'
  );

  // 2b. Transition to Submitted: records first_submitted_at
  const submitted = await apiService.updateDeliverableStatus(
    testDelId,
    'Submitted',
    'Admin',
    'Test Runner'
  );
  assert(Boolean(submitted.first_submitted_at), 'First Submission: first_submitted_at is recorded');
  const recordedFirstSubmitted = submitted.first_submitted_at;

  // 2c. Transition to Changes Requested (revision loop)
  const revised = await apiService.updateDeliverableStatus(
    testDelId,
    'Changes Requested',
    'Admin',
    'Test Runner'
  );
  assert(
    revised.first_submitted_at === recordedFirstSubmitted,
    'Revision transition: first_submitted_at is not lost on Changes Requested'
  );

  // 2d. Resubmission: MUST NOT overwrite first_submitted_at!
  const resubmitted = await apiService.updateDeliverableStatus(
    testDelId,
    'Submitted',
    'Admin',
    'Test Runner'
  );
  assert(
    resubmitted.first_submitted_at === recordedFirstSubmitted,
    'Resubmission: first_submitted_at is NEVER overwritten on subsequent submissions'
  );

  // 2e. Transition to Delivered: records delivered_at
  const delivered = await apiService.updateDeliverableStatus(
    testDelId,
    'Delivered',
    'Admin',
    'Test Runner'
  );
  assert(Boolean(delivered.delivered_at), 'Delivered: delivered_at is recorded');
  const recordedDeliveredAt = delivered.delivered_at;

  // 2f. Later edits after delivery: must NOT overwrite delivered_at or first_submitted_at
  const postDeliveryEdit = await apiService.updateDeliverable({
    ...delivered,
    external_link: 'https://vimeo.com/final-master',
  });
  assert(
    postDeliveryEdit.first_submitted_at === recordedFirstSubmitted,
    'Post-delivery: first_submitted_at remains intact'
  );
  assert(
    postDeliveryEdit.delivered_at === recordedDeliveredAt,
    'Post-delivery: delivered_at remains intact'
  );

  // ==========================================
  // Test 3: Reassignment Timestamp Tracking
  // ==========================================
  console.log('\n[Suite 3] Reassignment Timestamp Behavior');

  // Reassign to a different editor
  const reassigned = await apiService.updateDeliverable({
    ...postDeliveryEdit,
    assigned_editor_id: 'ed-chloe',
    status: 'In Progress',
  });
  assert(
    reassigned.assigned_at !== initialAssignedAt,
    'Reassignment: new editor receives a fresh assigned_at timestamp'
  );
  assert(
    Boolean(reassigned.assigned_at),
    'Reassignment: assigned_at is non-empty for new editor'
  );
  const chloeAssignedAt = reassigned.assigned_at;

  // Edit while keeping Chloe: assigned_at must stay chloeAssignedAt
  const sameEditorEdit = await apiService.updateDeliverable({
    ...reassigned,
    priority: 'Urgent',
  });
  assert(
    sameEditorEdit.assigned_at === chloeAssignedAt,
    'Same editor: assigned_at does not change when editor remains the same'
  );

  // Unassign deliverable: assigned_at should clear
  const unassigned = await apiService.updateDeliverable({
    ...sameEditorEdit,
    assigned_editor_id: '',
    status: 'Not Started',
  });
  assert(
    !unassigned.assigned_at,
    'Unassigning: assigned_at is cleared when deliverable has no editor'
  );

  // Clean up test deliverable
  await apiService.deleteDeliverable(testDelId);

  // ==========================================
  // Test 4: Capacity & Effective Active Deliverable Calculations
  // ==========================================
  console.log('\n[Suite 4] Capacity & Active Deliverable Semantics');

  const mockEditor: Editor = {
    id: 'ed-cap-test',
    name: 'Capacity Tester',
    email: 'tester@studio.com',
    phone: '1234567890',
    specialization: 'Cinematography',
    is_active: true,
    max_concurrent_projects: 4,
    max_active_deliverables: 4,
  };

  const mockDeliverables: Deliverable[] = [
    {
      id: 'd1',
      project_id: 'p1',
      company_id: 'twb',
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: mockEditor.id,
      due_date: '2026-10-20',
      status: 'In Progress',
      priority: 'High',
      last_updated: '2026-10-01',
    },
    {
      id: 'd2',
      project_id: 'p1', // Same project, distinct deliverable
      company_id: 'twb',
      deliverable_type: 'Teaser / Reel (60s)',
      assigned_editor_id: mockEditor.id,
      due_date: '2026-10-22',
      status: 'Submitted',
      priority: 'Medium',
      last_updated: '2026-10-02',
    },
    {
      id: 'd3',
      project_id: 'p2',
      company_id: 'twb',
      deliverable_type: 'Feature Film (20-30 mins)',
      assigned_editor_id: mockEditor.id,
      due_date: '2026-10-30',
      status: 'Delivered', // Delivered item
      priority: 'Low',
      last_updated: '2026-10-03',
    },
  ];

  const activeDels = mockDeliverables.filter(
    d => d.assigned_editor_id === mockEditor.id && d.status !== 'Delivered'
  );
  const completedDels = mockDeliverables.filter(
    d => d.assigned_editor_id === mockEditor.id && d.status === 'Delivered'
  );

  const effectiveCapacity = mockEditor.max_active_deliverables || mockEditor.max_concurrent_projects || 4;
  const utilizationPercent = Math.round((activeDels.length / effectiveCapacity) * 100);

  assert(activeDels.length === 2, 'Active deliverables: 2 items in progress/submitted');
  assert(completedDels.length === 1, 'Completed deliverables: 1 item delivered');
  assert(effectiveCapacity === 4, 'Effective capacity defaults to 4');
  assert(utilizationPercent === 50, 'Utilization percent: 2 / 4 is 50%');

  // ==========================================
  // Test 5: Ordering Logic
  // ==========================================
  console.log('\n[Suite 5] Ordering & Tie-Breaking Logic');

  const editorsList = [
    { id: 'e1', name: 'Zoe Editor', activeCount: 3, earliestDate: '2026-10-05' },
    { id: 'e2', name: 'Aaron Editor', activeCount: 1, earliestDate: '2026-10-01' },
    { id: 'e3', name: 'Bob Editor', activeCount: 3, earliestDate: '2026-10-08' },
    { id: 'e4', name: 'Charlie Editor', activeCount: 0, earliestDate: null },
  ];

  // Name A-Z
  const byNameAsc = [...editorsList].sort((a, b) => a.name.localeCompare(b.name));
  assert(byNameAsc[0].name === 'Aaron Editor', 'Sort Name A-Z: Aaron is first');
  assert(byNameAsc[3].name === 'Zoe Editor', 'Sort Name A-Z: Zoe is last');

  // Workload Descending (ties broken by name)
  const byWorkloadDesc = [...editorsList].sort((a, b) => {
    if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
    return a.name.localeCompare(b.name);
  });
  assert(byWorkloadDesc[0].name === 'Bob Editor', 'Sort Workload Desc: Bob Editor (3 active) beats Zoe alphabetically');
  assert(byWorkloadDesc[1].name === 'Zoe Editor', 'Sort Workload Desc: Zoe Editor (3 active) is second');
  assert(byWorkloadDesc[3].name === 'Charlie Editor', 'Sort Workload Desc: Charlie (0 active) is last');

  // Oldest Active Assignment First (no active assignments go to bottom)
  const byOldestAssignment = [...editorsList].sort((a, b) => {
    if (!a.earliestDate && !b.earliestDate) return a.name.localeCompare(b.name);
    if (!a.earliestDate) return 1;
    if (!b.earliestDate) return -1;
    if (a.earliestDate !== b.earliestDate) return a.earliestDate.localeCompare(b.earliestDate);
    return a.name.localeCompare(b.name);
  });
  assert(byOldestAssignment[0].name === 'Aaron Editor', 'Sort Oldest Assignment: Aaron (2026-10-01) is first');
  assert(byOldestAssignment[1].name === 'Zoe Editor', 'Sort Oldest Assignment: Zoe (2026-10-05) is second');
  assert(byOldestAssignment[2].name === 'Bob Editor', 'Sort Oldest Assignment: Bob (2026-10-08) is third');
  assert(byOldestAssignment[3].name === 'Charlie Editor', 'Sort Oldest Assignment: Charlie (no active assignments) is at bottom');

  console.log('\n--- All Editors & Workload Tests Passed Successfully (0 failures) ---');
}

runEditorsWorkloadTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
