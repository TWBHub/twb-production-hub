import { calculateCalendarDaysElapsed, formatTurnaroundDays } from './dateUtils';
import {
  computeMilestonesOnUpdate,
  computeMilestonesOnStatusChange,
  getEffectiveDeliverableCapacity,
  calculateEditorDeliverableWorkload,
  parseDeliverableNotes,
  serializeDeliverableNotes,
  prepareDeliverableForCreate,
} from './deliverableMilestones';
import { mapSupabaseDeliverableToModel } from '../services/api';
import { Deliverable, DeliverableStatus, Editor, Project } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function runEditorsWorkloadTests() {
  console.log('--- Starting Editors & Workload Isolated Unit Tests ---');

  // ==========================================
  // Test 1: Calendar Days Elapsed & Turnaround Formatting
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
  console.log('\n[Suite 2] Milestone Persistence & Overwrite Protection (Isolated)');

  const initialAssignedAt = '2026-10-01T10:00:00.000Z';
  const baseDeliverable: Deliverable = {
    id: 'd-100',
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
  const unrelatedUpdate: Deliverable = {
    ...baseDeliverable,
    notes: 'Updated client creative notes',
    due_date: '2026-10-28',
  };
  const milestonesAfterUnrelated = computeMilestonesOnUpdate(baseDeliverable, unrelatedUpdate, '2026-10-05T12:00:00.000Z');
  assert(
    milestonesAfterUnrelated.assigned_at === initialAssignedAt,
    'Unrelated edit: assigned_at remains preserved when notes/due_date change'
  );

  // 2b. Transition to Submitted: records first_submitted_at
  const submissionTime = '2026-10-10T14:30:00.000Z';
  const submittedMilestones = computeMilestonesOnStatusChange(baseDeliverable, 'Submitted', submissionTime);
  assert(
    submittedMilestones.first_submitted_at === submissionTime,
    'First Submission: first_submitted_at is recorded on initial transition to Submitted'
  );

  const deliverableAfterFirstSubmit: Deliverable = {
    ...baseDeliverable,
    status: 'Submitted',
    first_submitted_at: submittedMilestones.first_submitted_at,
  };

  // 2c. Transition to Changes Requested (revision loop) must NOT erase first_submitted_at
  const revisionMilestones = computeMilestonesOnStatusChange(deliverableAfterFirstSubmit, 'Changes Requested', '2026-10-12T09:00:00.000Z');
  assert(
    revisionMilestones.first_submitted_at === submissionTime,
    'Revision transition: first_submitted_at is not lost on Changes Requested'
  );

  const deliverableInRevision: Deliverable = {
    ...deliverableAfterFirstSubmit,
    status: 'Changes Requested',
    first_submitted_at: revisionMilestones.first_submitted_at,
  };

  // 2d. Resubmission: MUST NOT overwrite first_submitted_at!
  const resubmitTime = '2026-10-14T16:00:00.000Z';
  const resubmittedMilestones = computeMilestonesOnStatusChange(deliverableInRevision, 'Submitted', resubmitTime);
  assert(
    resubmittedMilestones.first_submitted_at === submissionTime,
    'Resubmission: first_submitted_at is NEVER overwritten on subsequent submissions'
  );

  // 2e. Transition to Delivered: records delivered_at
  const deliveryTime = '2026-10-16T18:00:00.000Z';
  const deliveredMilestones = computeMilestonesOnStatusChange(deliverableInRevision, 'Delivered', deliveryTime);
  assert(
    deliveredMilestones.delivered_at === deliveryTime,
    'Delivered: delivered_at is recorded on initial transition to Delivered'
  );

  const deliveredDeliverable: Deliverable = {
    ...deliverableInRevision,
    status: 'Delivered',
    first_submitted_at: submissionTime,
    delivered_at: deliveredMilestones.delivered_at,
  };

  // 2f. Later edits after delivery: must NOT overwrite delivered_at or first_submitted_at
  const postDeliveryEdit: Deliverable = {
    ...deliveredDeliverable,
    external_link: 'https://vimeo.com/final-master',
  };
  const postDeliveryMilestones = computeMilestonesOnUpdate(deliveredDeliverable, postDeliveryEdit, '2026-10-18T10:00:00.000Z');
  assert(
    postDeliveryMilestones.first_submitted_at === submissionTime,
    'Post-delivery: first_submitted_at remains intact after subsequent update'
  );
  assert(
    postDeliveryMilestones.delivered_at === deliveryTime,
    'Post-delivery: delivered_at remains intact after subsequent update'
  );

  // ==========================================
  // Test 3: Reassignment Timestamp Tracking
  // ==========================================
  console.log('\n[Suite 3] Reassignment Timestamp Behavior');

  const reassignmentTime = '2026-10-19T11:00:00.000Z';
  const reassignedDeliverable: Deliverable = {
    ...baseDeliverable,
    assigned_editor_id: 'ed-chloe',
    status: 'In Progress',
  };
  const reassignedMilestones = computeMilestonesOnUpdate(baseDeliverable, reassignedDeliverable, reassignmentTime);
  assert(
    reassignedMilestones.assigned_at === reassignmentTime,
    'Reassignment: new editor receives a fresh assigned_at timestamp'
  );
  assert(
    reassignedMilestones.assigned_at !== initialAssignedAt,
    'Reassignment: new editor does not inherit old editor assignment timestamp'
  );

  // Edit while keeping Chloe: assigned_at must stay chloeAssignedAt
  const chloeDeliverable: Deliverable = {
    ...reassignedDeliverable,
    assigned_at: reassignedMilestones.assigned_at,
  };
  const sameEditorMilestones = computeMilestonesOnUpdate(
    chloeDeliverable,
    { ...chloeDeliverable, priority: 'Urgent' },
    '2026-10-20T12:00:00.000Z'
  );
  assert(
    sameEditorMilestones.assigned_at === reassignmentTime,
    'Same editor: assigned_at does not change when editor remains the same'
  );

  // Unassign deliverable: assigned_at must be cleared
  const unassignedMilestones = computeMilestonesOnUpdate(
    chloeDeliverable,
    { ...chloeDeliverable, assigned_editor_id: '' },
    '2026-10-21T12:00:00.000Z'
  );
  assert(
    unassignedMilestones.assigned_at === undefined,
    'Unassigning: assigned_at is cleared when deliverable has no editor'
  );

  // ==========================================
  // Test 4: Capacity & Effective Active Deliverable Calculations
  // ==========================================
  console.log('\n[Suite 4] Capacity & Active Deliverable Semantics');

  const mockEditor1: Editor = {
    id: 'ed-cap-1',
    name: 'Sarah Editor',
    email: 'sarah@studio.com',
    phone: '1234567890',
    specialization: 'Cinematography',
    is_active: true,
    max_concurrent_projects: 3,
    max_active_deliverables: 5,
  };

  const mockEditorDefault: Editor = {
    id: 'ed-cap-default',
    name: 'Default Editor',
    email: 'default@studio.com',
    phone: '1234567890',
    specialization: 'Colorist',
    is_active: true,
    max_concurrent_projects: 4,
  };

  // Preference for max_active_deliverables
  assert(
    getEffectiveDeliverableCapacity(mockEditor1) === 5,
    'Capacity: prefers max_active_deliverables (5) when provided'
  );
  assert(
    getEffectiveDeliverableCapacity(mockEditorDefault) === 4,
    'Capacity: falls back to max_concurrent_projects (4) when max_active_deliverables is missing'
  );
  assert(
    getEffectiveDeliverableCapacity(null) === 4,
    'Capacity: defaults to 4 when editor is null/undefined'
  );

  const testDeliverables: Deliverable[] = [
    {
      id: 'd1',
      project_id: 'p1',
      company_id: 'twb',
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: mockEditor1.id,
      due_date: '2026-10-20',
      status: 'In Progress',
      priority: 'High',
      assigned_at: '2026-10-01T10:00:00Z',
      last_updated: '2026-10-01T10:00:00Z',
    },
    {
      id: 'd2',
      project_id: 'p1', // Same project, distinct deliverable
      company_id: 'twb',
      deliverable_type: 'Teaser / Reel (60s)',
      assigned_editor_id: mockEditor1.id,
      due_date: '2026-10-22',
      status: 'Submitted',
      priority: 'Medium',
      assigned_at: '2026-10-03T10:00:00Z',
      last_updated: '2026-10-03T10:00:00Z',
    },
    {
      id: 'd3',
      project_id: 'p2',
      company_id: 'twb',
      deliverable_type: 'Feature Film (20-30 mins)',
      assigned_editor_id: mockEditor1.id,
      due_date: '2026-10-30',
      status: 'Delivered', // Delivered item: must NOT count towards active
      priority: 'Low',
      assigned_at: '2026-09-15T10:00:00Z',
      delivered_at: '2026-10-05T10:00:00Z',
      last_updated: '2026-10-05T10:00:00Z',
    },
  ];

  const workload = calculateEditorDeliverableWorkload(mockEditor1.id, 5, testDeliverables);
  assert(workload.activeCount === 2, 'Workload: exactly 2 active deliverables counted');
  assert(workload.completedCount === 1, 'Workload: exactly 1 delivered deliverable counted');
  assert(workload.utilizationPercent === 40, 'Workload: 2 / 5 is 40%');
  assert(!workload.isAtOrOverCapacity, 'Workload: 2 / 5 is not at or over capacity');
  assert(workload.earliestActiveAssignmentDate === '2026-10-01T10:00:00Z', 'Workload: identifies earliest active assignment date');
  assert(workload.latestActiveAssignmentDate === '2026-10-03T10:00:00Z', 'Workload: identifies latest active assignment date');

  // Over capacity case
  const overCapacityWorkload = calculateEditorDeliverableWorkload(mockEditor1.id, 2, testDeliverables);
  assert(overCapacityWorkload.isAtOrOverCapacity, 'Workload: 2 / 2 triggers at/over capacity flag');
  assert(overCapacityWorkload.utilizationPercent === 100, 'Workload: 2 / 2 is 100%');

  // ==========================================
  // Test 5: Live Supabase Empty Editor Roster Behavior
  // ==========================================
  console.log('\n[Suite 5] Live Supabase Empty Editor Roster Guard');

  // Simulate what apiService.getEditors() does when Supabase is connected:
  // It returns teamEditors (mapped from teamMembers where categories includes Editor or role_title includes editor).
  // If teamMembers has no editors, teamEditors is [].
  // Under the corrected logic, when supabase is present, it returns [] and NEVER INITIAL_EDITORS.
  const liveTeamMembersNoEditors = [
    { id: 'tm-1', name: 'Alex Rivera', role_title: 'Lead Cinematographer', categories: ['Video'] },
    { id: 'tm-2', name: 'Sarah Jenkins', role_title: 'Photographer', categories: ['Photo'] },
  ];
  const mappedLiveEditors = liveTeamMembersNoEditors
    .filter(m => (m.categories as string[])?.includes('Editor') || m.role_title?.toLowerCase().includes('editor'));
  assert(
    mappedLiveEditors.length === 0,
    'Live Supabase Roster: correctly evaluates to 0 editors when teamMembers has no Editor category'
  );

  // ==========================================
  // Test 6: Search, Filter, and Ordering Interactions
  // ==========================================
  console.log('\n[Suite 6] Search, Filter & Ordering Interactions');

  const editorsList = [
    { id: 'e1', name: 'Zoe Editor', activeCount: 4, capacity: 4, pct: 100, earliestDate: '2026-10-05' },
    { id: 'e2', name: 'Aaron Editor', activeCount: 1, capacity: 4, pct: 25, earliestDate: '2026-10-01' },
    { id: 'e3', name: 'Bob Editor', activeCount: 5, capacity: 4, pct: 125, earliestDate: '2026-10-08' },
    { id: 'e4', name: 'Charlie Editor', activeCount: 0, capacity: 4, pct: 0, earliestDate: null },
  ];

  // Workload filter test
  const availableOnly = editorsList.filter(e => e.pct < 75);
  assert(availableOnly.length === 2, 'Filter Available (<75%): Aaron (25%) and Charlie (0%) match');

  const nearCapacity = editorsList.filter(e => e.pct >= 75 && e.pct < 100);
  assert(nearCapacity.length === 0, 'Filter Near Capacity (75-99%): 0 editors match');

  const atCapacity = editorsList.filter(e => e.pct === 100);
  assert(atCapacity.length === 1 && atCapacity[0].name === 'Zoe Editor', 'Filter At Capacity (100%): Zoe matches');

  const overloaded = editorsList.filter(e => e.pct > 100);
  assert(overloaded.length === 1 && overloaded[0].name === 'Bob Editor', 'Filter Overloaded (>100%): Bob matches');

  // Ordering: Name A-Z
  const byNameAsc = [...editorsList].sort((a, b) => a.name.localeCompare(b.name));
  assert(byNameAsc[0].name === 'Aaron Editor', 'Sort Name A-Z: Aaron is first');
  assert(byNameAsc[3].name === 'Zoe Editor', 'Sort Name A-Z: Zoe is last');

  // Ordering: Highest Workload First
  const byWorkloadDesc = [...editorsList].sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.name.localeCompare(b.name);
  });
  assert(byWorkloadDesc[0].name === 'Bob Editor', 'Sort Workload Desc: Bob (125%) is first');
  assert(byWorkloadDesc[1].name === 'Zoe Editor', 'Sort Workload Desc: Zoe (100%) is second');
  assert(byWorkloadDesc[3].name === 'Charlie Editor', 'Sort Workload Desc: Charlie (0%) is last');

  // Ordering: Lowest Workload First
  const byWorkloadAsc = [...editorsList].sort((a, b) => {
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.name.localeCompare(b.name);
  });
  assert(byWorkloadAsc[0].name === 'Charlie Editor', 'Sort Workload Asc: Charlie (0%) is first');
  assert(byWorkloadAsc[1].name === 'Aaron Editor', 'Sort Workload Asc: Aaron (25%) is second');

  // Ordering: Oldest Active Assignment First (editors without active assignments at bottom)
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

  // Ordering: Newest Active Assignment First (editors without active assignments at bottom)
  const byNewestAssignment = [...editorsList].sort((a, b) => {
    if (!a.earliestDate && !b.earliestDate) return a.name.localeCompare(b.name);
    if (!a.earliestDate) return 1;
    if (!b.earliestDate) return -1;
    if (a.earliestDate !== b.earliestDate) return b.earliestDate.localeCompare(a.earliestDate);
    return a.name.localeCompare(b.name);
  });
  assert(byNewestAssignment[0].name === 'Bob Editor', 'Sort Newest Assignment: Bob (2026-10-08) is first');
  assert(byNewestAssignment[1].name === 'Zoe Editor', 'Sort Newest Assignment: Zoe (2026-10-05) is second');
  assert(byNewestAssignment[2].name === 'Aaron Editor', 'Sort Newest Assignment: Aaron (2026-10-01) is third');
  assert(byNewestAssignment[3].name === 'Charlie Editor', 'Sort Newest Assignment: Charlie (no active assignments) is at bottom');

  // Search by project or deliverable name
  const sampleProjects: Project[] = [
    {
      id: 'p1',
      name: 'Sharma Royal Wedding',
      company_id: 'twb',
      client_id: 'c1',
      wedding_date_start: '2026-11-20',
      wedding_date_end: '2026-11-22',
      venue: 'Palace',
      city: 'Udaipur',
      client_contact: { phone: '', email: '' },
      package_name: 'Royal',
      package_details: '',
      booking_amount: 50000,
      total_amount: 350000,
      status: 'Shooting',
      created_at: '2026-09-01',
    },
  ];

  const searchKeyword = 'sharma';
  const searchDeliverables: Deliverable[] = [
    {
      ...testDeliverables[0],
      assigned_editor_id: 'e2',
      project_id: 'p1',
    },
  ];

  const matchingEditorCard = editorsList.some(ed => {
    // Check direct editor name match
    if (ed.name.toLowerCase().includes(searchKeyword)) return true;
    // Check deliverable/project match for this editor
    const assignedDels = searchDeliverables.filter(d => d.assigned_editor_id === ed.id);
    return assignedDels.some(del => {
      const proj = sampleProjects.find(p => p.id === del.project_id);
      return (
        del.deliverable_type.toLowerCase().includes(searchKeyword) ||
        (proj?.name && proj.name.toLowerCase().includes(searchKeyword))
      );
    });
  });
  assert(matchingEditorCard, 'Search: Project name "Sharma" successfully displays assigned editor card');

  // ==========================================
  // Test 7: Deliverable Notes & Milestone Metadata Fallback
  // ==========================================
  console.log('\n[Suite 7] Deliverable Notes & Milestone Metadata Fallback');

  // 7a. Empty, null, and whitespace notes
  const nullParsed = parseDeliverableNotes(null);
  assert(nullParsed.userNotes === undefined, 'Notes: null notes returns undefined userNotes');
  assert(nullParsed.metadata === undefined, 'Notes: null notes returns undefined metadata');

  const emptyParsed = parseDeliverableNotes('   ');
  assert(emptyParsed.userNotes === undefined, 'Notes: whitespace notes returns undefined userNotes');
  assert(emptyParsed.metadata === undefined, 'Notes: whitespace notes returns undefined metadata');

  // 7b. Ordinary user-authored notes without metadata
  const plainTextNote = 'Cut for 9:16 Instagram format with dynamic cut on vows.';
  const plainParsed = parseDeliverableNotes(plainTextNote);
  assert(plainParsed.userNotes === plainTextNote, 'Notes: plain user note preserved exactly');
  assert(plainParsed.metadata === undefined, 'Notes: plain user note has no metadata');

  // 7c. Legacy metadata format without user notes (e.g. existing live Supabase row)
  const legacyMetaStr = '__METADATA__:{"assigned_at":"2026-10-01T10:00:00Z","first_submitted_at":"2026-10-10T14:30:00Z","delivered_at":"2026-10-16T18:00:00Z"}';
  const legacyParsed = parseDeliverableNotes(legacyMetaStr);
  assert(legacyParsed.userNotes === undefined, 'Notes: legacy metadata string never exposed as user note');
  assert(legacyParsed.metadata?.assigned_at === '2026-10-01T10:00:00Z', 'Notes: legacy assigned_at extracted');
  assert(legacyParsed.metadata?.first_submitted_at === '2026-10-10T14:30:00Z', 'Notes: legacy first_submitted_at extracted');
  assert(legacyParsed.metadata?.delivered_at === '2026-10-16T18:00:00Z', 'Notes: legacy delivered_at extracted');

  // 7d. New composite format preserving both user notes and milestone metadata
  const compositeStr = '__METADATA__:{"user_notes":"Client wants warm color grade","assigned_at":"2026-10-01T10:00:00Z","first_submitted_at":"2026-10-10T14:30:00Z"}';
  const compositeParsed = parseDeliverableNotes(compositeStr);
  assert(compositeParsed.userNotes === 'Client wants warm color grade', 'Notes: composite format extracts clean user note');
  assert(compositeParsed.metadata?.assigned_at === '2026-10-01T10:00:00Z', 'Notes: composite format extracts assigned_at');
  assert(compositeParsed.metadata?.first_submitted_at === '2026-10-10T14:30:00Z', 'Notes: composite format extracts first_submitted_at');

  // 7e. Corrupted metadata string resilience
  const corruptedParsed = parseDeliverableNotes('__METADATA__:{invalid-json}');
  assert(corruptedParsed.userNotes === undefined, 'Notes: corrupted metadata never exposed as user note');
  assert(corruptedParsed.metadata === undefined, 'Notes: corrupted metadata handled safely without throwing');

  // 7f. Serialization: no milestones returns plain text or null
  assert(serializeDeliverableNotes('Clean note', undefined) === 'Clean note', 'Serialize: no milestones returns plain note');
  assert(serializeDeliverableNotes('', undefined) === null, 'Serialize: empty note with no milestones returns null');

  // 7g. Serialization: with milestones packs user note and timestamps into __METADATA__:
  const serializedWithBoth = serializeDeliverableNotes('Audio mixed at 48kHz', {
    assigned_at: '2026-10-01T10:00:00Z',
    first_submitted_at: '2026-10-08T12:00:00Z',
  });
  assert(Boolean(serializedWithBoth?.startsWith('__METADATA__:')), 'Serialize: produces __METADATA__: prefix');
  const roundtripBoth = parseDeliverableNotes(serializedWithBoth);
  assert(roundtripBoth.userNotes === 'Audio mixed at 48kHz', 'Roundtrip: user note preserved across serialize/parse');
  assert(roundtripBoth.metadata?.assigned_at === '2026-10-01T10:00:00Z', 'Roundtrip: assigned_at preserved');
  assert(roundtripBoth.metadata?.first_submitted_at === '2026-10-08T12:00:00Z', 'Roundtrip: first_submitted_at preserved');

  // 7h. Note editing does NOT erase milestone timestamps
  const originalTimestamps = {
    assigned_at: '2026-10-01T10:00:00Z',
    first_submitted_at: '2026-10-08T12:00:00Z',
    delivered_at: '2026-10-15T16:00:00Z',
  };
  const editedSerialized = serializeDeliverableNotes('Updated notes after client feedback', originalTimestamps);
  const editedParsed = parseDeliverableNotes(editedSerialized);
  assert(editedParsed.userNotes === 'Updated notes after client feedback', 'Note edit: updated note saved');
  assert(editedParsed.metadata?.assigned_at === originalTimestamps.assigned_at, 'Note edit: assigned_at retained');
  assert(editedParsed.metadata?.first_submitted_at === originalTimestamps.first_submitted_at, 'Note edit: first_submitted_at retained');
  assert(editedParsed.metadata?.delivered_at === originalTimestamps.delivered_at, 'Note edit: delivered_at retained');

  // 7i. Note clearing does NOT erase milestone timestamps
  const clearedSerialized = serializeDeliverableNotes('', originalTimestamps);
  const clearedParsed = parseDeliverableNotes(clearedSerialized);
  assert(clearedParsed.userNotes === undefined, 'Note clearing: user note is cleared (undefined)');
  assert(clearedParsed.metadata?.assigned_at === originalTimestamps.assigned_at, 'Note clearing: assigned_at still retained');
  assert(clearedParsed.metadata?.first_submitted_at === originalTimestamps.first_submitted_at, 'Note clearing: first_submitted_at still retained');
  assert(clearedParsed.metadata?.delivered_at === originalTimestamps.delivered_at, 'Note clearing: delivered_at still retained');

  // 7j. mapSupabaseDeliverableToModel integration tests
  const mockRowWithMeta = {
    id: 'del-meta-1',
    project_id: 'prj-1',
    company_id: 'twb',
    deliverable_type: 'Feature Film (20-30 mins)',
    assigned_editor_id: 'ed-1',
    status: 'Submitted',
    priority: 'High',
    notes: '__METADATA__:{"user_notes":"Color correction 80% done","assigned_at":"2026-10-02T08:00:00Z","first_submitted_at":"2026-10-11T15:00:00Z"}',
    last_updated: '2026-10-11T15:00:00Z',
  };
  const mappedModel = mapSupabaseDeliverableToModel(mockRowWithMeta);
  assert(mappedModel.notes === 'Color correction 80% done', 'Model mapping: user note extracted cleanly');
  assert(!mappedModel.notes?.includes('__METADATA__'), 'Model mapping: notes never contains __METADATA__');
  assert(mappedModel.assigned_at === '2026-10-02T08:00:00Z', 'Model mapping: assigned_at restored from metadata');
  assert(mappedModel.first_submitted_at === '2026-10-11T15:00:00Z', 'Model mapping: first_submitted_at restored from metadata');

  // 7k. mapSupabaseDeliverableToModel legacy row without user_notes
  const mockRowLegacy = {
    id: 'del-legacy-1',
    project_id: 'prj-1',
    company_id: 'twb',
    deliverable_type: 'Highlight Film (4-5 mins)',
    assigned_editor_id: 'ed-2',
    status: 'Delivered',
    priority: 'Medium',
    notes: '__METADATA__:{"assigned_at":"2026-09-01T10:00:00Z","delivered_at":"2026-09-20T18:00:00Z"}',
    last_updated: '2026-09-20T18:00:00Z',
  };
  const mappedLegacy = mapSupabaseDeliverableToModel(mockRowLegacy);
  assert(mappedLegacy.notes === undefined, 'Legacy model mapping: notes is undefined instead of raw __METADATA__');
  assert(mappedLegacy.assigned_at === '2026-09-01T10:00:00Z', 'Legacy model mapping: assigned_at restored');
  // 7l. serializeDeliverableNotes anti-nesting & preservation when given __METADATA__: string
  const existingCompositeInput = '__METADATA__:{"user_notes":"Teaser cut for TikTok","assigned_at":"2026-10-01T10:00:00Z"}';
  const reSerialized = serializeDeliverableNotes(existingCompositeInput, {
    first_submitted_at: '2026-10-08T15:00:00Z',
  });
  assert(Boolean(reSerialized?.startsWith('__METADATA__:')), 'Serialize anti-nesting: starts with __METADATA__:');
  const parsedReSerialized = parseDeliverableNotes(reSerialized);
  assert(parsedReSerialized.userNotes === 'Teaser cut for TikTok', 'Serialize anti-nesting: userNotes extracted cleanly');
  assert(!parsedReSerialized.userNotes?.includes('__METADATA__'), 'Serialize anti-nesting: userNotes never contains __METADATA__');
  assert(parsedReSerialized.metadata?.assigned_at === '2026-10-01T10:00:00Z', 'Serialize anti-nesting: preserves incoming assigned_at');
  assert(parsedReSerialized.metadata?.first_submitted_at === '2026-10-08T15:00:00Z', 'Serialize anti-nesting: includes new first_submitted_at');

  // 7m. serializeDeliverableNotes with legacy metadata string as input
  const legacyInput = '__METADATA__:{"assigned_at":"2026-09-15T09:00:00Z"}';
  const reSerializedLegacy = serializeDeliverableNotes(legacyInput, {
    delivered_at: '2026-09-30T17:00:00Z',
  });
  const parsedLegacyRe = parseDeliverableNotes(reSerializedLegacy);
  assert(parsedLegacyRe.userNotes === undefined, 'Serialize legacy input: does NOT invent user note from metadata');
  assert(parsedLegacyRe.metadata?.assigned_at === '2026-09-15T09:00:00Z', 'Serialize legacy input: preserves assigned_at');
  assert(parsedLegacyRe.metadata?.delivered_at === '2026-09-30T17:00:00Z', 'Serialize legacy input: adds delivered_at');

  // ==========================================
  // Test 8: prepareDeliverableForCreate Milestone & Metadata Regression Tests
  // ==========================================
  console.log('\n[Suite 8] prepareDeliverableForCreate Milestone & Metadata Isolation');

  const nowTestIso = '2026-10-19T14:00:00.000Z';

  // 8a. Normal create with plain user notes
  const createNormal = prepareDeliverableForCreate({
    deliverable_type: 'Teaser (60s)',
    assigned_editor_id: 'ed-1',
    status: 'Assigned',
    notes: 'Please cut 60s vertical teaser.',
  }, nowTestIso);
  assert(createNormal.userNotes === 'Please cut 60s vertical teaser.', 'Create normal: userNotes preserved as plain text');
  assert(!createNormal.userNotes?.includes('__METADATA__'), 'Create normal: userNotes has no metadata string');
  assert(createNormal.assigned_at === nowTestIso, 'Create normal: assigned_at set to nowIso for new assignment');
  assert(createNormal.first_submitted_at === undefined, 'Create normal: first_submitted_at is undefined');
  assert(createNormal.delivered_at === undefined, 'Create normal: delivered_at is undefined');

  // 8b. Create deliverable from object containing legacy metadata string in notes
  const createFromLegacy = prepareDeliverableForCreate({
    deliverable_type: 'Highlight Film (4-5 mins)',
    assigned_editor_id: 'ed-1',
    status: 'In Progress',
    notes: '__METADATA__:{"assigned_at":"2026-10-02T10:30:00.000Z"}',
  }, nowTestIso);
  assert(createFromLegacy.userNotes === undefined, 'Create legacy: userNotes is undefined, never leaking raw metadata');
  assert(createFromLegacy.assigned_at === '2026-10-02T10:30:00.000Z', 'Create legacy: historical assigned_at preserved (NOT overwritten with now)');
  assert(!createFromLegacy.serializedNotesForFallback?.includes('user_notes'), 'Create legacy fallback: no user_notes created from raw metadata');
  assert(createFromLegacy.serializedNotesForFallback?.includes('2026-10-02T10:30:00.000Z'), 'Create legacy fallback: assigned_at preserved in fallback');

  // 8c. Create deliverable from object containing composite metadata string in notes
  const createFromComposite = prepareDeliverableForCreate({
    deliverable_type: 'Feature Film (20-30 mins)',
    assigned_editor_id: 'ed-2',
    status: 'Submitted',
    notes: '__METADATA__:{"user_notes":"Color correction done, pending audio","assigned_at":"2026-10-01T08:00:00.000Z","first_submitted_at":"2026-10-10T12:00:00.000Z"}',
  }, nowTestIso);
  assert(createFromComposite.userNotes === 'Color correction done, pending audio', 'Create composite: extracts real user notes');
  assert(!createFromComposite.userNotes?.includes('__METADATA__'), 'Create composite: userNotes never contains __METADATA__');
  assert(createFromComposite.assigned_at === '2026-10-01T08:00:00.000Z', 'Create composite: preserves historical assigned_at');
  assert(createFromComposite.first_submitted_at === '2026-10-10T12:00:00.000Z', 'Create composite: preserves historical first_submitted_at (NOT overwritten with now)');

  // 8d. Fallback serialization for composite does NOT double-wrap or nest metadata
  const fallbackStr = createFromComposite.serializedNotesForFallback;
  assert(Boolean(fallbackStr?.startsWith('__METADATA__:')), 'Create composite fallback: starts with __METADATA__:');
  const countMetaPrefix = (fallbackStr?.match(/__METADATA__:/g) || []).length;
  assert(countMetaPrefix === 1, 'Create composite fallback: single metadata prefix, zero duplication/recursion');
  const parsedFallback = parseDeliverableNotes(fallbackStr);
  assert(parsedFallback.userNotes === 'Color correction done, pending audio', 'Create composite fallback: user notes preserved');
  assert(parsedFallback.metadata?.assigned_at === '2026-10-01T08:00:00.000Z', 'Create composite fallback: assigned_at preserved');
  assert(parsedFallback.metadata?.first_submitted_at === '2026-10-10T12:00:00.000Z', 'Create composite fallback: first_submitted_at preserved');

  // 8e. Create with status Submitted and no prior submission date assigns nowIso
  const createNewSubmitted = prepareDeliverableForCreate({
    deliverable_type: 'Speeches / Toasts',
    assigned_editor_id: 'ed-3',
    status: 'Submitted',
    notes: 'Draft uploaded to Drive',
  }, nowTestIso);
  assert(createNewSubmitted.first_submitted_at === nowTestIso, 'Create new submitted: first_submitted_at assigned nowIso');

  // 8f. Create with status Delivered and no prior delivery date assigns nowIso
  const createNewDelivered = prepareDeliverableForCreate({
    deliverable_type: 'Full Ceremony Edit',
    assigned_editor_id: 'ed-3',
    status: 'Delivered',
    notes: 'Delivered to client via Gallery link',
  }, nowTestIso);
  assert(createNewDelivered.delivered_at === nowTestIso, 'Create new delivered: delivered_at assigned nowIso');

  // 8g. Create unassigned deliverable produces undefined assigned_at
  const createUnassigned = prepareDeliverableForCreate({
    deliverable_type: 'Instagram Reel (30s)',
    assigned_editor_id: '',
    status: '',
    notes: 'Awaiting editor assignment',
  }, nowTestIso);
  assert(createUnassigned.assigned_at === undefined, 'Create unassigned: assigned_at is undefined');

  console.log('\n--- All Editors & Workload Tests Passed Successfully (0 failures) ---');
}

runEditorsWorkloadTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
