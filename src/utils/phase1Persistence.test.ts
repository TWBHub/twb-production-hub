import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  PHASE1_STORAGE_PREFIX,
  Phase1StorageAdapter,
  fetchClientsWithSupabase,
  fetchDeliverablesWithSupabase,
  fetchPaymentsWithSupabase,
  fetchProjectDataWithSupabase,
  fetchProjectTeamWithSupabase,
  removeTeamAssignmentWithSupabase,
  createDeliverableWithSupabase,
  updateDeliverableWithSupabase,
  updateDeliverableStatusWithSupabase,
  upsertItemInCache,
  removeItemFromCache,
  readCachedArray,
} from './phase1PersistenceUtils';
import {
  getDeliverableFeedbackText,
  buildDeliverableFeedbackFields,
  parseDeliverableNotes,
  DELIVERABLE_WORKFLOW_STATUSES,
  validateDeliverableStatus,
  resolveDeliverableStatusOnCreate,
  syncCreateStatusOnEditorChange,
} from './deliverableMilestones';
import {
  mapSupabaseDeliverableToModel,
  mapSupabaseProjectDataToModel,
  mapDbToPaymentMode,
  toCompanyUuid,
} from '../services/api';
import {
  INITIAL_CLIENTS,
  INITIAL_DELIVERABLES,
  INITIAL_PAYMENTS,
  INITIAL_PROJECT_DATA,
  INITIAL_PROJECT_TEAM,
} from '../services/seedData';
import { TWB_COMPANY_UUID, GJ_COMPANY_UUID } from './companyUtils';
import { Client, Deliverable, Payment, Project, ProjectData, ProjectTeamAssignment } from '../types';

function createMemoryPhase1Storage(initial: Record<string, string> = {}): Phase1StorageAdapter {
  const store: Record<string, string> = { ...initial };
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

describe('Phase 1 Persistence — Authoritative Supabase Reads, Empty Tables & Failure Isolation', () => {
  it('getClients: returns mapped Supabase rows, returns [] when empty, and throws on DB error without falling back to localStorage/INITIAL_CLIENTS', async () => {
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}clients`]: JSON.stringify(INITIAL_CLIENTS),
    });

    // 1. Successful read normalizes company_id and caches
    const liveRow = {
      id: '11111111-1111-4111-8111-111111111111',
      company_id: GJ_COMPANY_UUID,
      name: 'Live Client',
      email: 'live@example.com',
      phone: '9999999999',
      created_at: '2026-11-10T00:00:00.000Z',
    };
    const clients = await fetchClientsWithSupabase({
      adapter: { selectAll: async () => ({ data: [liveRow], error: null }) },
      storage,
      initialFallback: INITIAL_CLIENTS,
    });
    assert.strictEqual(clients.length, 1);
    assert.strictEqual(clients[0].id, liveRow.id);
    assert.strictEqual(clients[0].company_id, 'golden_june');
    assert.strictEqual(readCachedArray<Client>(storage, 'clients')?.length, 1);

    // 2. Empty table returns [] cleanly (never INITIAL_CLIENTS)
    const emptyClients = await fetchClientsWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      storage,
      initialFallback: INITIAL_CLIENTS,
    });
    assert.deepStrictEqual(emptyClients, []);
    assert.deepStrictEqual(readCachedArray<Client>(storage, 'clients'), []);

    // 3. DB error throws and never falls back to stale localStorage or INITIAL_CLIENTS
    storage.setItem(`${PHASE1_STORAGE_PREFIX}clients`, JSON.stringify([clients[0]]));
    await assert.rejects(
      () =>
        fetchClientsWithSupabase({
          adapter: {
            selectAll: async () => ({
              data: null,
              error: { message: 'permission denied for table clients' },
            }),
          },
          storage,
          initialFallback: INITIAL_CLIENTS,
        }),
      /Failed to load clients from Supabase: permission denied for table clients/
    );
    // Existing cache untouched on read error
    assert.strictEqual(readCachedArray<Client>(storage, 'clients')?.[0]?.id, liveRow.id);
  });

  it('getDeliverables: parses __METADATA__ notes, returns [] when empty, and throws on DB error without fallback', async () => {
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}deliverables`]: JSON.stringify(INITIAL_DELIVERABLES),
    });

    const liveDeliverableRow = {
      id: '22222222-2222-4222-8222-222222222222',
      project_id: '33333333-3333-4333-8333-333333333333',
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: '44444444-4444-4444-8444-444444444444',
      due_date: '2026-12-01',
      status: 'Submitted',
      priority: 'High',
      notes:
        '__METADATA__:{"user_notes":"Warm grade requested","assigned_at":"2026-11-01T10:00:00.000Z","first_submitted_at":"2026-11-05T15:30:00.000Z"}',
    };

    const result = await fetchDeliverablesWithSupabase({
      adapter: { selectAll: async () => ({ data: [liveDeliverableRow], error: null }) },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      initialFallback: INITIAL_DELIVERABLES,
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].notes, 'Warm grade requested');
    assert.strictEqual(result[0].assigned_at, '2026-11-01T10:00:00.000Z');
    assert.strictEqual(result[0].first_submitted_at, '2026-11-05T15:30:00.000Z');

    // Empty table -> []
    const empty = await fetchDeliverablesWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      initialFallback: INITIAL_DELIVERABLES,
    });
    assert.deepStrictEqual(empty, []);

    // DB error -> throws, no fallback
    await assert.rejects(
      () =>
        fetchDeliverablesWithSupabase({
          adapter: {
            selectAll: async () => ({ data: null, error: { message: 'RLS policy violation' } }),
          },
          mapRow: mapSupabaseDeliverableToModel,
          storage,
          initialFallback: INITIAL_DELIVERABLES,
        }),
      /Failed to load deliverables from Supabase: RLS policy violation/
    );
  });

  it('getPayments: resolves company_id via project relationship when payments lacks company_id, handles [], and throws on DB error', async () => {
    const projectId = '55555555-5555-4555-8555-555555555555';
    // Fresh browser: no cached projects in localStorage yet
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}payments`]: JSON.stringify(INITIAL_PAYMENTS),
    });

    const livePaymentRow = {
      id: '66666666-6666-4666-8666-666666666666',
      project_id: projectId,
      amount: 125000,
      payment_date: '2026-11-12',
      payment_mode: 'upi',
      description: 'Second Installment',
      receipt_number: 'REC-GJ-0012',
    };

    const payments = await fetchPaymentsWithSupabase({
      adapter: {
        selectAll: async () => ({ data: [livePaymentRow], error: null }),
        selectProjectCompanyRows: async () => ({
          data: [{ id: projectId, company_id: GJ_COMPANY_UUID }],
          error: null,
        }),
      },
      mapDbToPaymentMode,
      storage,
      initialFallback: INITIAL_PAYMENTS,
    });

    assert.strictEqual(payments.length, 1);
    assert.strictEqual(payments[0].company_id, 'golden_june');
    assert.strictEqual(payments[0].payment_mode, 'UPI');
    assert.strictEqual(payments[0].amount, 125000);

    // Also resolves from projects cache without needing extra query
    const storageWithCachedProjects = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}projects`]: JSON.stringify([
        { id: projectId, company_id: 'golden_june' } as Partial<Project>,
      ]),
    });
    let projectLookupCalled = false;
    const cachedResolved = await fetchPaymentsWithSupabase({
      adapter: {
        selectAll: async () => ({ data: [livePaymentRow], error: null }),
        selectProjectCompanyRows: async () => {
          projectLookupCalled = true;
          return { data: [], error: null };
        },
      },
      mapDbToPaymentMode,
      storage: storageWithCachedProjects,
      initialFallback: INITIAL_PAYMENTS,
    });
    assert.strictEqual(projectLookupCalled, false);
    assert.strictEqual(cachedResolved[0].company_id, 'golden_june');

    // Empty table -> []
    const empty = await fetchPaymentsWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      mapDbToPaymentMode,
      storage,
      initialFallback: INITIAL_PAYMENTS,
    });
    assert.deepStrictEqual(empty, []);

    // DB error -> throws
    await assert.rejects(
      () =>
        fetchPaymentsWithSupabase({
          adapter: {
            selectAll: async () => ({ data: null, error: { message: 'network timeout' } }),
          },
          mapDbToPaymentMode,
          storage,
          initialFallback: INITIAL_PAYMENTS,
        }),
      /Failed to load payments from Supabase: network timeout/
    );
  });

  it('getProjectData: maps authoritative rows, returns [] when empty, and throws on DB error without fallback', async () => {
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}project_data`]: JSON.stringify(INITIAL_PROJECT_DATA),
    });

    const row = {
      id: '77777777-7777-4777-8777-777777777777',
      project_id: '33333333-3333-4333-8333-333333333333',
      name: 'SanDisk 2TB A',
      data_type: 'SSD',
      status: 'Active',
      notes: JSON.stringify({
        user_notes: 'Master RAW',
        storage: "TWB's",
        location: 'Office',
        company_id: 'twb',
      }),
    };

    const loaded = await fetchProjectDataWithSupabase({
      adapter: { selectAll: async () => ({ data: [row], error: null }) },
      mapRow: mapSupabaseProjectDataToModel,
      storage,
      initialFallback: INITIAL_PROJECT_DATA,
    });
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].name, 'SanDisk 2TB A');
    assert.strictEqual(loaded[0].notes, 'Master RAW');

    const empty = await fetchProjectDataWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      mapRow: mapSupabaseProjectDataToModel,
      storage,
      initialFallback: INITIAL_PROJECT_DATA,
    });
    assert.deepStrictEqual(empty, []);

    await assert.rejects(
      () =>
        fetchProjectDataWithSupabase({
          adapter: {
            selectAll: async () => ({ data: null, error: { message: 'project_data read blocked' } }),
          },
          mapRow: mapSupabaseProjectDataToModel,
          storage,
          initialFallback: INITIAL_PROJECT_DATA,
        }),
      /Failed to load project data from Supabase: project_data read blocked/
    );
  });

  it('getProjectTeam: normalizes assignment_role -> role, returns [] on genuinely empty table, and throws on DB error', async () => {
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}project_team`]: JSON.stringify(INITIAL_PROJECT_TEAM),
    });

    const row = {
      id: '88888888-8888-4888-8888-888888888888',
      project_id: '33333333-3333-4333-8333-333333333333',
      team_member_id: '99999999-9999-4999-8999-999999999999',
      assignment_role: 'Lead Photographer',
      assignment_date: '2026-12-10',
      notes: 'Call time 6 AM',
    };

    const loaded = await fetchProjectTeamWithSupabase({
      adapter: { selectAll: async () => ({ data: [row], error: null }) },
      storage,
      initialFallback: INITIAL_PROJECT_TEAM,
    });
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].role, 'Lead Photographer');

    // Previously data.length === 0 fell back to INITIAL_PROJECT_TEAM — now must return []
    const empty = await fetchProjectTeamWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      storage,
      initialFallback: INITIAL_PROJECT_TEAM,
    });
    assert.deepStrictEqual(empty, []);
    assert.deepStrictEqual(readCachedArray<ProjectTeamAssignment>(storage, 'project_team'), []);

    // DB error -> throws and preserves existing cache
    storage.setItem(`${PHASE1_STORAGE_PREFIX}project_team`, JSON.stringify([loaded[0]]));
    await assert.rejects(
      () =>
        fetchProjectTeamWithSupabase({
          adapter: {
            selectAll: async () => ({ data: null, error: { message: 'jwt expired' } }),
          },
          storage,
          initialFallback: INITIAL_PROJECT_TEAM,
        }),
      /Failed to load project team assignments from Supabase: jwt expired/
    );
    assert.strictEqual(readCachedArray<ProjectTeamAssignment>(storage, 'project_team')?.length, 1);
  });
});

describe('Phase 1 Persistence — Verified Writes & No Misleading Cache Updates on Failure', () => {
  it('removeTeamAssignment: deletes verified row cleanly and rejects DB errors or RLS 0-row blocks without touching cache', async () => {
    const id1 = 'aaaa1111-1111-4111-8111-111111111111';
    const id2 = 'bbbb2222-2222-4222-8222-222222222222';
    const cached: ProjectTeamAssignment[] = [
      { id: id1, project_id: 'p1', team_member_id: 'm1', role: 'Lead Photo', assignment_date: '2026-12-01' },
      { id: id2, project_id: 'p1', team_member_id: 'm2', role: '2nd Cine', assignment_date: '2026-12-01' },
    ];
    const storage = createMemoryPhase1Storage({
      [`${PHASE1_STORAGE_PREFIX}project_team`]: JSON.stringify(cached),
    });

    // 1. DB error throws and leaves cache untouched
    await assert.rejects(
      () =>
        removeTeamAssignmentWithSupabase({
          assignmentId: id1,
          adapter: {
            deleteAndReturn: async () => ({ data: null, error: { message: 'permission denied' } }),
            existsById: async () => ({ exists: true, error: null }),
          },
          storage,
        }),
      /Could not remove team assignment from Supabase: permission denied/
    );
    assert.strictEqual(readCachedArray<ProjectTeamAssignment>(storage, 'project_team')?.length, 2);

    // 2. RLS 0-row delete while row still exists throws explicit RLS error and preserves cache
    await assert.rejects(
      () =>
        removeTeamAssignmentWithSupabase({
          assignmentId: id1,
          adapter: {
            deleteAndReturn: async () => ({ data: [], error: null }),
            existsById: async () => ({ exists: true, error: null }),
          },
          storage,
        }),
      /Row Level Security \(RLS\) or permissions blocked deletion/
    );
    assert.strictEqual(readCachedArray<ProjectTeamAssignment>(storage, 'project_team')?.length, 2);

    // 3. 0-row delete when row not found throws instead of faking success
    await assert.rejects(
      () =>
        removeTeamAssignmentWithSupabase({
          assignmentId: id1,
          adapter: {
            deleteAndReturn: async () => ({ data: [], error: null }),
            existsById: async () => ({ exists: false, error: null }),
          },
          storage,
        }),
      /was not found in Supabase \(0 rows affected\)/
    );
    assert.strictEqual(readCachedArray<ProjectTeamAssignment>(storage, 'project_team')?.length, 2);

    // 4. Verified delete returning affected row removes ONLY that row from cache
    await removeTeamAssignmentWithSupabase({
      assignmentId: id1,
      adapter: {
        deleteAndReturn: async () => ({ data: [{ id: id1 }], error: null }),
        existsById: async () => ({ exists: false, error: null }),
      },
      storage,
    });
    const remaining = readCachedArray<ProjectTeamAssignment>(storage, 'project_team');
    assert.strictEqual(remaining?.length, 1);
    assert.strictEqual(remaining?.[0].id, id2);
  });

  it('updateDeliverable: reads baseline from Supabase (even with empty localStorage), preserves milestones in notes metadata, and aborts on failure', async () => {
    const delId = 'cccc3333-3333-4333-8333-333333333333';
    const editorId = 'dddd4444-4444-4444-8444-444444444444';
    const projId = 'eeee5555-5555-4555-8555-555555555555';

    // Empty localStorage simulates logging in on a second Mac
    const storage = createMemoryPhase1Storage();

    const authoritativeDbRow = {
      id: delId,
      project_id: projId,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: editorId,
      due_date: '2026-12-20',
      status: 'Submitted',
      priority: 'High',
      external_link: 'https://frame.io/old',
      client_feedback: 'Look good',
      notes:
        '__METADATA__:{"user_notes":"Keep warm tones","assigned_at":"2026-10-01T09:00:00.000Z","first_submitted_at":"2026-10-10T14:00:00.000Z"}',
    };

    let capturedPayload: Record<string, any> | null = null;
    const saved = await updateDeliverableWithSupabase({
      deliverable: {
        id: delId,
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Highlight Film (4-5 mins)',
        assigned_editor_id: editorId, // Same editor retained!
        due_date: '2026-12-20',
        status: 'Changes Requested',
        priority: 'High',
        external_link: 'https://frame.io/v2',
        client_feedback: 'Tighten intro',
        last_updated: '2026-11-13T12:00:00.000Z',
        // Notice: caller omits assigned_at / first_submitted_at / notes to simulate stale/partial client payload
      },
      adapter: {
        selectById: async () => ({ data: authoritativeDbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          capturedPayload = payload;
          return {
            data: [{ ...authoritativeDbRow, ...payload }],
            error: null,
          };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso: '2026-11-13T12:00:00.000Z',
    });

    assert.ok(capturedPayload);
    // Does not send nonexistent milestone columns to DB
    assert.strictEqual('assigned_at' in capturedPayload!, false);
    assert.strictEqual('first_submitted_at' in capturedPayload!, false);
    assert.strictEqual('delivered_at' in capturedPayload!, false);
    // Preserved assigned_at, first_submitted_at, and user_notes from Supabase baseline inside notes metadata
    assert.strictEqual(saved.assigned_at, '2026-10-01T09:00:00.000Z');
    assert.strictEqual(saved.first_submitted_at, '2026-10-10T14:00:00.000Z');
    assert.strictEqual(saved.notes, 'Keep warm tones');
    assert.strictEqual(saved.external_link, 'https://frame.io/v2');

    // Failed DB update must throw and not overwrite cache
    await assert.rejects(
      () =>
        updateDeliverableWithSupabase({
          deliverable: { ...saved, status: 'Delivered' },
          adapter: {
            selectById: async () => ({ data: authoritativeDbRow, error: null }),
            updateAndReturn: async () => ({
              data: null,
              error: { message: 'new row violates check constraint deliverables_status_check' },
            }),
          },
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /Could not update deliverable in Supabase/
    );
    assert.strictEqual(readCachedArray<Deliverable>(storage, 'deliverables')?.[0]?.status, 'Changes Requested');

    // 0 rows affected on update must throw
    await assert.rejects(
      () =>
        updateDeliverableWithSupabase({
          deliverable: { ...saved, status: 'Approved' },
          adapter: {
            selectById: async () => ({ data: authoritativeDbRow, error: null }),
            updateAndReturn: async () => ({ data: [], error: null }),
          },
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /0 rows affected/
    );
  });

  it('updateDeliverableStatus: reads authoritative baseline from Supabase, records Delivered milestone without clobbering prior milestones/notes, and rejects failures', async () => {
    const delId = 'ffff6666-6666-4666-8666-666666666666';
    const editorId = 'dddd4444-4444-4444-8444-444444444444';
    const projId = 'eeee5555-5555-4555-8555-555555555555';

    // Empty localStorage
    const storage = createMemoryPhase1Storage();

    const authoritativeDbRow = {
      id: delId,
      project_id: projId,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Teaser / Reel (60s)',
      assigned_editor_id: editorId,
      due_date: '2026-12-20',
      status: 'Approved',
      priority: 'Medium',
      notes:
        '__METADATA__:{"user_notes":"Music licensed","assigned_at":"2026-10-02T08:00:00.000Z","first_submitted_at":"2026-10-08T11:00:00.000Z"}',
    };

    const delivered = await updateDeliverableStatusWithSupabase({
      deliverableId: delId,
      newStatus: 'Delivered',
      adapter: {
        selectById: async () => ({ data: authoritativeDbRow, error: null }),
        updateAndReturn: async (_id, payload) => ({
          data: [{ ...authoritativeDbRow, ...payload }],
          error: null,
        }),
      },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      nowIso: '2026-11-13T16:45:00.000Z',
    });

    assert.strictEqual(delivered.status, 'Delivered');
    assert.strictEqual(delivered.notes, 'Music licensed');
    assert.strictEqual(delivered.assigned_at, '2026-10-02T08:00:00.000Z');
    assert.strictEqual(delivered.first_submitted_at, '2026-10-08T11:00:00.000Z');
    assert.strictEqual(delivered.delivered_at, '2026-11-13T16:45:00.000Z');

    // Failure on status update must not alter cached deliverable status
    await assert.rejects(
      () =>
        updateDeliverableStatusWithSupabase({
          deliverableId: delId,
          newStatus: 'In Progress',
          adapter: {
            selectById: async () => ({ data: authoritativeDbRow, error: null }),
            updateAndReturn: async () => ({ data: [], error: null }),
          },
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /0 rows affected/
    );
    assert.strictEqual(readCachedArray<Deliverable>(storage, 'deliverables')?.[0]?.status, 'Delivered');
  });

  it('Secondary cache helpers never throw even when storage writes fail, keeping committed DB writes safe', () => {
    const failingStorage: Phase1StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    assert.doesNotThrow(() => {
      upsertItemInCache<Client>(failingStorage, 'clients', {
        id: '1',
        company_id: 'twb',
        name: 'A',
        email: 'a@example.com',
        phone: '123',
        created_at: '2026-01-01',
      });
      removeItemFromCache<ProjectData>(failingStorage, 'project_data', '1');
    });
  });

  it('Deliverable feedback compatibility: reads legacy client_feedback, edits both notes and client_feedback, clears feedback without losing milestones, and updates updated_at', async () => {
    const delId = 'c4a948d3-36c9-49ef-9227-57b91edd3ac4';
    const editorId = 'dddd4444-4444-4444-8444-444444444444';
    const projId = 'eeee5555-5555-4555-8555-555555555555';
    const storage = createMemoryPhase1Storage();

    // Exact legacy state confirmed in Supabase: client_feedback set, notes has only __METADATA__ milestones
    let dbRow: Record<string, any> = {
      id: delId,
      project_id: projId,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Drone Compilation',
      assigned_editor_id: editorId,
      due_date: '2026-12-20',
      status: 'Assigned',
      priority: 'Medium',
      external_link: null,
      client_feedback: 'SUPABASE EDIT TEST',
      notes:
        '__METADATA__:{"assigned_at":"2026-11-13T21:29:47.775Z","first_submitted_at":"2026-11-13T22:00:00.000Z","delivered_at":"2026-11-13T23:00:00.000Z"}',
      updated_at: '2026-11-13T21:26:43.549698+00:00',
    };

    // 1. Backward compatibility: UI helper reads legacy client_feedback cleanly when user_notes is absent
    const legacyMapped = mapSupabaseDeliverableToModel(dbRow);
    assert.strictEqual(legacyMapped.notes, undefined);
    assert.strictEqual(legacyMapped.client_feedback, 'SUPABASE EDIT TEST');
    assert.strictEqual(getDeliverableFeedbackText(legacyMapped), 'SUPABASE EDIT TEST');

    // 2. Editing feedback via shared UI helper writes user_notes + client_feedback, bumps updated_at, and preserves all milestones
    const editTime = '2026-11-14T08:00:00.000Z';
    let capturedEditPayload: Record<string, any> | null = null;
    const editedFields = buildDeliverableFeedbackFields('  Updated drone pacing note  ');
    const edited = await updateDeliverableWithSupabase({
      deliverable: {
        ...legacyMapped,
        notes: editedFields.notes,
        client_feedback: editedFields.client_feedback,
      },
      adapter: {
        selectById: async () => ({ data: dbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          capturedEditPayload = payload;
          dbRow = { ...dbRow, ...payload };
          return { data: [dbRow], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso: editTime,
    });

    assert.ok(capturedEditPayload);
    assert.strictEqual(capturedEditPayload!.client_feedback, 'Updated drone pacing note');
    assert.strictEqual(capturedEditPayload!.updated_at, editTime);
    const parsedAfterEdit = parseDeliverableNotes(capturedEditPayload!.notes);
    assert.strictEqual(parsedAfterEdit.userNotes, 'Updated drone pacing note');
    assert.strictEqual(parsedAfterEdit.metadata?.assigned_at, '2026-11-13T21:29:47.775Z');
    assert.strictEqual(parsedAfterEdit.metadata?.first_submitted_at, '2026-11-13T22:00:00.000Z');
    assert.strictEqual(parsedAfterEdit.metadata?.delivered_at, '2026-11-13T23:00:00.000Z');

    assert.strictEqual(edited.notes, 'Updated drone pacing note');
    assert.strictEqual(edited.client_feedback, 'Updated drone pacing note');
    assert.strictEqual(edited.last_updated, editTime);
    assert.strictEqual(getDeliverableFeedbackText(edited), 'Updated drone pacing note');

    // 3. Clearing feedback removes user_notes AND client_feedback while preserving milestone metadata and bumping updated_at
    const clearTime = '2026-11-14T08:15:00.000Z';
    let capturedClearPayload: Record<string, any> | null = null;
    const clearedFields = buildDeliverableFeedbackFields('   ');
    const cleared = await updateDeliverableWithSupabase({
      deliverable: {
        ...edited,
        notes: clearedFields.notes,
        client_feedback: clearedFields.client_feedback,
      },
      adapter: {
        selectById: async () => ({ data: dbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          capturedClearPayload = payload;
          dbRow = { ...dbRow, ...payload };
          return { data: [dbRow], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso: clearTime,
    });

    assert.ok(capturedClearPayload);
    assert.strictEqual(capturedClearPayload!.client_feedback, null);
    assert.strictEqual(capturedClearPayload!.updated_at, clearTime);
    const parsedAfterClear = parseDeliverableNotes(capturedClearPayload!.notes);
    assert.strictEqual(parsedAfterClear.userNotes, undefined);
    assert.strictEqual(parsedAfterClear.metadata?.assigned_at, '2026-11-13T21:29:47.775Z');
    assert.strictEqual(parsedAfterClear.metadata?.first_submitted_at, '2026-11-13T22:00:00.000Z');
    assert.strictEqual(parsedAfterClear.metadata?.delivered_at, '2026-11-13T23:00:00.000Z');

    assert.strictEqual(cleared.notes, undefined);
    assert.strictEqual(cleared.client_feedback, undefined);
    assert.strictEqual(getDeliverableFeedbackText(cleared), '');
    assert.strictEqual(cleared.last_updated, clearTime);
    assert.strictEqual(cleared.assigned_at, '2026-11-13T21:29:47.775Z');
    assert.strictEqual(cleared.first_submitted_at, '2026-11-13T22:00:00.000Z');
    assert.strictEqual(cleared.delivered_at, '2026-11-13T23:00:00.000Z');
  });

  it('Deliverable status change updates updated_at, preserves feedback & milestones, and retries cleanly if updated_at column is missing', async () => {
    const delId = '77777777-7777-4777-8777-777777777777';
    const projId = '88888888-8888-4888-8888-888888888888';
    const storage = createMemoryPhase1Storage();

    const dbRow = {
      id: delId,
      project_id: projId,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: '99999999-9999-4999-8999-999999999999',
      due_date: '2026-12-25',
      status: 'In Progress',
      priority: 'Medium',
      client_feedback: 'Keep warm skin tones',
      notes: '__METADATA__:{"user_notes":"Keep warm skin tones","assigned_at":"2026-11-10T10:00:00.000Z"}',
      updated_at: '2026-11-10T10:00:00.000Z',
    };

    const statusTime = '2026-11-14T09:00:00.000Z';
    let capturedStatusPayload: Record<string, any> | null = null;
    const submitted = await updateDeliverableStatusWithSupabase({
      deliverableId: delId,
      newStatus: 'Submitted',
      adapter: {
        selectById: async () => ({ data: dbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          capturedStatusPayload = payload;
          return { data: [{ ...dbRow, ...payload }], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      nowIso: statusTime,
    });

    assert.ok(capturedStatusPayload);
    assert.strictEqual(capturedStatusPayload!.status, 'Submitted');
    assert.strictEqual(capturedStatusPayload!.updated_at, statusTime);
    assert.strictEqual(submitted.last_updated, statusTime);
    assert.strictEqual(submitted.notes, 'Keep warm skin tones');
    assert.strictEqual(submitted.client_feedback, 'Keep warm skin tones');
    assert.strictEqual(submitted.assigned_at, '2026-11-10T10:00:00.000Z');
    assert.strictEqual(submitted.first_submitted_at, statusTime);

    // Schema compatibility retry if legacy table lacks updated_at column
    let attempts = 0;
    const fallbackSaved = await updateDeliverableStatusWithSupabase({
      deliverableId: delId,
      newStatus: 'Approved',
      adapter: {
        selectById: async () => ({ data: dbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          attempts += 1;
          if ('updated_at' in payload) {
            return {
              data: null,
              error: { message: "Could not find the 'updated_at' column of 'deliverables' in the schema cache" },
            };
          }
          return { data: [{ ...dbRow, ...payload }], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      nowIso: statusTime,
    });
    assert.strictEqual(attempts, 2);
    assert.strictEqual(fallbackSaved.status, 'Approved');
  });

  it('Deliverable creation (unassigned) explicitly defaults status to "Not Started" instead of NULL', async () => {
    const projId = '12121212-1212-4121-8121-121212121212';
    const storage = createMemoryPhase1Storage();
    let capturedInsertPayload: Record<string, any> | null = null;
    const nowIso = '2026-11-14T10:00:00.000Z';

    assert.strictEqual(resolveDeliverableStatusOnCreate('', ''), 'Not Started');
    assert.strictEqual(resolveDeliverableStatusOnCreate(undefined, undefined), 'Not Started');

    const created = await createDeliverableWithSupabase({
      deliverable: {
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Teaser / Reel (60s)',
        assigned_editor_id: '',
        due_date: '2026-12-15',
        status: '' as any,
        priority: 'Medium',
      },
      adapter: {
        insertAndReturn: async payload => {
          capturedInsertPayload = { ...payload };
          return {
            data: [
              {
                ...payload,
                created_at: nowIso,
                updated_at: nowIso,
              },
            ],
            error: null,
          };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso,
      generateId: () => '34343434-3434-4343-8343-343434343434',
    });

    assert.ok(capturedInsertPayload);
    assert.strictEqual(capturedInsertPayload!.status, 'Not Started');
    assert.strictEqual(capturedInsertPayload!.assigned_editor_id, null);
    assert.strictEqual(created.status, 'Not Started');

    // Also verify unconfigured local-storage mode stores 'Not Started'
    const localStorage = createMemoryPhase1Storage();
    const localCreated = await createDeliverableWithSupabase({
      deliverable: {
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Teaser / Reel (60s)',
        assigned_editor_id: '',
        due_date: '2026-12-15',
        status: '' as any,
        priority: 'Medium',
      },
      adapter: null,
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage: localStorage,
      nowIso,
      generateId: () => 'local-del-1',
    });
    assert.strictEqual(localCreated.status, 'Not Started');
  });

  it('Deliverable creation (assigned editor) defaults blank status to "Assigned" and records assigned_at', async () => {
    const projId = '23232323-2323-4232-8232-232323232323';
    const editorId = '45454545-4545-4454-8454-454545454545';
    const storage = createMemoryPhase1Storage();
    let capturedInsertPayload: Record<string, any> | null = null;
    const nowIso = '2026-11-14T10:05:00.000Z';

    assert.strictEqual(resolveDeliverableStatusOnCreate('', editorId), 'Assigned');

    const created = await createDeliverableWithSupabase({
      deliverable: {
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Highlight Film (4-5 mins)',
        assigned_editor_id: editorId,
        due_date: '2026-12-20',
        status: '' as any,
        priority: 'Medium',
      },
      adapter: {
        insertAndReturn: async payload => {
          capturedInsertPayload = { ...payload };
          return {
            data: [{ ...payload, updated_at: nowIso }],
            error: null,
          };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso,
      generateId: () => '56565656-5656-4565-8565-565656565656',
    });

    assert.ok(capturedInsertPayload);
    assert.strictEqual(capturedInsertPayload!.status, 'Assigned');
    assert.strictEqual(capturedInsertPayload!.assigned_editor_id, editorId);
    assert.strictEqual(capturedInsertPayload!.assigned_at, nowIso);
    assert.strictEqual(created.status, 'Assigned');
    assert.strictEqual(created.assigned_at, nowIso);
  });

  it('Deliverable creation preserves explicit valid workflow status across all allowed values', async () => {
    const projId = '67676767-6767-4676-8676-676767676767';
    const editorId = '78787878-7878-4787-8787-787878787878';
    const storage = createMemoryPhase1Storage();
    const nowIso = '2026-11-14T10:10:00.000Z';

    for (const explicitStatus of DELIVERABLE_WORKFLOW_STATUSES) {
      assert.strictEqual(validateDeliverableStatus(explicitStatus), explicitStatus);
      assert.strictEqual(resolveDeliverableStatusOnCreate(explicitStatus, editorId), explicitStatus);
      assert.strictEqual(resolveDeliverableStatusOnCreate(explicitStatus, ''), explicitStatus);
    }

    // Preserve explicit 'In Progress' on unassigned creation, even when Check 0 retries without milestone columns
    let capturedPayloads: Record<string, any>[] = [];
    const createdInProgress = await createDeliverableWithSupabase({
      deliverable: {
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Feature Film (20-30 mins)',
        assigned_editor_id: '',
        due_date: '2026-12-22',
        status: 'In Progress',
        priority: 'Medium',
      },
      adapter: {
        insertAndReturn: async payload => {
          capturedPayloads.push({ ...payload });
          if ('assigned_at' in payload) {
            return {
              data: null,
              error: { message: "Could not find the 'assigned_at' column of 'deliverables' in the schema cache" },
            };
          }
          return { data: [{ ...payload, updated_at: nowIso }], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso,
      generateId: () => '89898989-8989-4898-8898-898989898989',
    });

    assert.strictEqual(capturedPayloads.length, 2);
    assert.strictEqual(capturedPayloads[0].status, 'In Progress');
    assert.strictEqual(capturedPayloads[1].status, 'In Progress');
    assert.strictEqual(createdInProgress.status, 'In Progress');

    // Preserve explicit 'Not Started' even when an editor is selected
    let capturedAssignedNotStarted: Record<string, any> | null = null;
    const createdAssignedNotStarted = await createDeliverableWithSupabase({
      deliverable: {
        project_id: projId,
        company_id: 'twb',
        deliverable_type: 'Drone Compilation',
        assigned_editor_id: editorId,
        due_date: '2026-12-24',
        status: 'Not Started',
        priority: 'Medium',
      },
      adapter: {
        insertAndReturn: async payload => {
          capturedAssignedNotStarted = { ...payload };
          return { data: [{ ...payload, updated_at: nowIso }], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso,
      generateId: () => '90909090-9090-4909-8909-909090909090',
    });

    assert.ok(capturedAssignedNotStarted);
    assert.strictEqual(capturedAssignedNotStarted!.status, 'Not Started');
    assert.strictEqual(createdAssignedNotStarted.status, 'Not Started');
  });

  it('Deliverable creation fails loudly on invalid status and NEVER retries with status = NULL', async () => {
    const projId = 'abababab-abab-4aba-8aba-abababababab';
    const storage = createMemoryPhase1Storage();
    let dbAttempts = 0;

    // 1. Invalid client status fails before hitting Supabase
    await assert.rejects(
      () =>
        createDeliverableWithSupabase({
          deliverable: {
            project_id: projId,
            company_id: 'twb',
            deliverable_type: 'Teaser / Reel (60s)',
            assigned_editor_id: '',
            due_date: '2026-12-30',
            status: 'Pending Review' as any,
            priority: 'Medium',
          },
          adapter: {
            insertAndReturn: async () => {
              dbAttempts += 1;
              return { data: null, error: null };
            },
          },
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /Invalid deliverable status "Pending Review"/
    );
    assert.strictEqual(dbAttempts, 0);

    // 2. If Supabase itself returns a deliverables_status_check error, Check 5 MUST NOT retry with status: null
    const seenStatuses: Array<string | null | undefined> = [];
    await assert.rejects(
      () =>
        createDeliverableWithSupabase({
          deliverable: {
            project_id: projId,
            company_id: 'twb',
            deliverable_type: 'Teaser / Reel (60s)',
            assigned_editor_id: '',
            due_date: '2026-12-30',
            status: 'Not Started',
            priority: 'Medium',
          },
          adapter: {
            insertAndReturn: async payload => {
              seenStatuses.push(payload.status);
              return {
                data: null,
                error: {
                  message:
                    'new row for relation "deliverables" violates check constraint "deliverables_status_check"',
                },
              };
            },
          },
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /Could not create deliverable in Supabase:.*deliverables_status_check/
    );

    assert.deepStrictEqual(seenStatuses, ['Not Started']);
  });

  it('Both creation forms and all Deliverables displays follow consistent status defaults, editor sync, and non-disguised NULL status rendering', () => {
    // 1. State transition helper used by both creation forms
    assert.strictEqual(syncCreateStatusOnEditorChange('Not Started', 'editor-1'), 'Assigned');
    assert.strictEqual(syncCreateStatusOnEditorChange('', 'editor-1'), 'Assigned');
    assert.strictEqual(syncCreateStatusOnEditorChange('Assigned', ''), 'Not Started');
    assert.strictEqual(syncCreateStatusOnEditorChange('', ''), 'Not Started');
    assert.strictEqual(syncCreateStatusOnEditorChange('In Progress', 'editor-1'), 'In Progress');
    assert.strictEqual(syncCreateStatusOnEditorChange('In Progress', ''), 'In Progress');
    assert.strictEqual(syncCreateStatusOnEditorChange('Submitted', ''), 'Submitted');

    // 2. Verify both creation forms and display components in source wire helpers and avoid masking NULL as 'Not Started'
    const rootDir = path.resolve(process.cwd(), 'src');
    const deliverablesViewSrc = fs.readFileSync(
      path.join(rootDir, 'components/deliverables/DeliverablesView.tsx'),
      'utf8'
    );
    const workspaceSrc = fs.readFileSync(
      path.join(rootDir, 'components/projects/ProjectDetailWorkspace.tsx'),
      'utf8'
    );
    const editorsWorkloadSrc = fs.readFileSync(
      path.join(rootDir, 'components/team/EditorsWorkloadView.tsx'),
      'utf8'
    );

    // DeliverablesView create form uses 'Not Started' default, syncCreateStatusOnEditorChange, and resolveDeliverableStatusOnCreate
    assert.ok(deliverablesViewSrc.includes("setCreateStatus('Not Started')"));
    assert.ok(deliverablesViewSrc.includes('syncCreateStatusOnEditorChange(prev, newEditorId)'));
    assert.ok(deliverablesViewSrc.includes('resolveDeliverableStatusOnCreate(createStatus, assignedEditor)'));
    assert.ok(!deliverablesViewSrc.includes("del.status || 'Not Started'"));

    // ProjectDetailWorkspace create form has Workflow Status selector, 'Not Started' default, syncCreateStatusOnEditorChange, and resolveDeliverableStatusOnCreate
    assert.ok(workspaceSrc.includes('id="workspace-new-deliverable-status"'));
    assert.ok(workspaceSrc.includes("useState<DeliverableStatus>('Not Started')"));
    assert.ok(workspaceSrc.includes('syncCreateStatusOnEditorChange(prev, newEditorId)'));
    assert.ok(workspaceSrc.includes('resolveDeliverableStatusOnCreate(newDelStatus, editorId)'));
    assert.ok(!workspaceSrc.includes("del.status || 'Not Started'"));

    // EditorsWorkloadView does not disguise NULL/empty status as 'Not Started'
    assert.ok(!editorsWorkloadSrc.includes("del.status || 'Not Started'"));
    assert.ok(editorsWorkloadSrc.includes("del.status || 'No Status'"));
  });
});
