import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createAppDeliverableActions } from '../context/AppContext';
import {
  DeliverableRow,
  getDeliverableRowPermissionState,
} from '../components/deliverables/DeliverablesView';
import {
  EDITOR_ALLOWED_DELIVERABLE_STATUSES,
  EDITOR_EDITABLE_DELIVERABLE_FIELDS,
  PROTECTED_DELIVERABLE_FIELDS,
  canCreateDeliverable,
  canDeleteDeliverable,
  canEditDeliverable,
  canManageAllDeliverables,
  canSetDeliverableStatus,
  canViewDeliverables,
  extractEditorDeliverableChanges,
  getAllowedDeliverableStatusesForUser,
  isActiveDeliverableTeamMember,
  isDeliverableOwnedByEditor,
  resolveLinkedEditorTeamMember,
  validateDeliverableUpdateFields,
} from './deliverablePermissions';
import {
  DELIVERABLE_WORKFLOW_STATUSES,
  serializeDeliverableNotes,
} from './deliverableMilestones';
import {
  PHASE1_STORAGE_PREFIX,
  Phase1StorageAdapter,
  createDeliverableWithSupabase,
  getDefaultPhase1Storage,
  readCachedArray,
  updateDeliverableAsEditorWithSupabase,
  updateDeliverableWithSupabase,
  writeCachedArray,
} from './phase1PersistenceUtils';
import {
  filterDeliverableEditors,
  isEligibleDeliverableEditor,
  validateDeliverableEditorAssignment,
} from './teamMemberFilters';
import {
  apiService,
  mapSupabaseDeliverableToModel,
  toCompanyUuid,
} from '../services/api';
import { TWB_COMPANY_UUID } from './companyUtils';
import { Deliverable, Profile, TeamMember } from '../types';

function createMemoryStorage(initial: Record<string, string> = {}): Phase1StorageAdapter {
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

const EDITOR_PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const EDITOR_MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_EDITOR_MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DELIVERABLE_OWN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DELIVERABLE_OTHER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DELIVERABLE_UNASSIGNED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const editorProfile: Profile = {
  id: EDITOR_PROFILE_ID,
  email: 'riya.editor@twb.studio',
  full_name: 'Riya Sharma',
  role: 'Editor',
  is_active: true,
  status: 'Active',
};

const activeEditorMember: TeamMember = {
  id: EDITOR_MEMBER_ID,
  profile_id: EDITOR_PROFILE_ID,
  name: 'Riya Sharma',
  email: 'riya.editor@twb.studio',
  phone: '9999999999',
  role: 'Editor',
  role_title: 'Senior Film Editor',
  is_active: true,
  status: 'Active',
};

const otherEditorMember: TeamMember = {
  id: OTHER_EDITOR_MEMBER_ID,
  profile_id: OTHER_PROFILE_ID,
  name: 'Kabir Verma',
  email: 'kabir.editor@twb.studio',
  phone: '8888888888',
  role: 'Editor',
  role_title: 'Editor',
  is_active: true,
  status: 'Active',
};

const ownDeliverable: Deliverable = {
  id: DELIVERABLE_OWN_ID,
  project_id: PROJECT_ID,
  company_id: 'twb',
  deliverable_type: 'Highlight Film (4-5 mins)',
  assigned_editor_id: EDITOR_MEMBER_ID,
  due_date: '2026-12-15',
  status: 'Assigned',
  priority: 'High',
  external_link: 'https://frame.io/initial',
  notes: 'Keep vows audio clean and warm film grain.',
  client_feedback: 'Couple loved the teaser pacing.',
  assigned_at: '2026-11-01T10:00:00.000Z',
  last_updated: '2026-11-01T10:00:00.000Z',
};

const otherDeliverable: Deliverable = {
  ...ownDeliverable,
  id: DELIVERABLE_OTHER_ID,
  assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
};

const unassignedDeliverable: Deliverable = {
  ...ownDeliverable,
  id: DELIVERABLE_UNASSIGNED_ID,
  assigned_editor_id: '',
  status: 'Not Started',
  assigned_at: undefined,
};

describe('Stage 2B.3B — Deliverable Permission Helpers & Authoritative Ownership', () => {
  it('allows Admin and Manager full deliverable management while keeping Editor list visibility distinct from editing', () => {
    for (const role of ['Admin', 'Manager', 'admin', 'manager'] as const) {
      assert.strictEqual(canViewDeliverables(role), true);
      assert.strictEqual(canManageAllDeliverables(role), true);
      assert.strictEqual(canCreateDeliverable(role), true);
      assert.strictEqual(canDeleteDeliverable(role), true);
      assert.strictEqual(
        canEditDeliverable({ role, deliverable: ownDeliverable, linkedEditorTeamMemberId: null }),
        true
      );
      assert.strictEqual(
        canEditDeliverable({ role, deliverable: otherDeliverable, linkedEditorTeamMemberId: null }),
        true
      );
      assert.strictEqual(
        canEditDeliverable({
          role,
          deliverable: unassignedDeliverable,
          linkedEditorTeamMemberId: null,
        }),
        true
      );
    }

    // Editor can view ALL deliverables but cannot manage all / create / delete
    assert.strictEqual(canViewDeliverables('Editor'), true);
    assert.strictEqual(canManageAllDeliverables('Editor'), false);
    assert.strictEqual(canCreateDeliverable('Editor'), false);
    assert.strictEqual(canDeleteDeliverable('Editor'), false);

    // Inactive, unknown, or legacy roles fail closed
    assert.strictEqual(canViewDeliverables('Team Member'), false);
    assert.strictEqual(canViewDeliverables(null), false);
    assert.strictEqual(canManageAllDeliverables('Admin', false), false);
    assert.strictEqual(
      canEditDeliverable({ role: 'Admin', deliverable: ownDeliverable, isUserActive: false }),
      false
    );
    assert.strictEqual(
      canEditDeliverable({ role: 'Team Member', deliverable: ownDeliverable }),
      false
    );
  });

  it('resolves linked Editor identity strictly via unique active team_members.profile_id === currentUser.id with zero email/name fallback', () => {
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'verified',
        teamMembers: [activeEditorMember, otherEditorMember],
      })?.id,
      EDITOR_MEMBER_ID
    );

    // Same email & name, but missing/wrong profile_id -> MUST return null (no fallback)
    const emailMatchedWithoutProfileId: TeamMember = {
      ...activeEditorMember,
      profile_id: undefined,
    };
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'verified',
        teamMembers: [emailMatchedWithoutProfileId],
      }),
      null
    );

    // Inactive Team Member directory record with active Editor profile -> STILL resolves linked Editor identity
    // (directory activity is independent of portal login activity)
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'verified',
        teamMembers: [{ ...activeEditorMember, is_active: false, status: 'Inactive' }],
      })?.id,
      EDITOR_MEMBER_ID
    );
    assert.strictEqual(
      isActiveDeliverableTeamMember({ ...activeEditorMember, status: 'Inactive' }),
      false
    );

    // Non-Editor category on Team Member record -> null
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'verified',
        teamMembers: [{ ...activeEditorMember, categories: ['Photo'] }],
      }),
      null
    );

    // Unverified profile state or inactive profile -> null
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'idle',
        teamMembers: [activeEditorMember],
      }),
      null
    );
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: { ...editorProfile, is_active: false },
        profileVerificationState: 'verified',
        teamMembers: [activeEditorMember],
      }),
      null
    );

    // Ambiguous multiple matches for same profile_id -> null (fail closed)
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: editorProfile,
        profileVerificationState: 'verified',
        teamMembers: [activeEditorMember, { ...otherEditorMember, profile_id: EDITOR_PROFILE_ID }],
      }),
      null
    );

    // Admin/Manager profiles never resolve as linked Editor
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: { ...editorProfile, role: 'Admin' },
        profileVerificationState: 'verified',
        teamMembers: [activeEditorMember],
      }),
      null
    );
  });

  it('allows Editor to edit ONLY own assigned deliverables and fails closed for others, unassigned, or unlinked accounts', () => {
    assert.strictEqual(
      isDeliverableOwnedByEditor({
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
      }),
      true
    );
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
      }),
      true
    );

    // Assigned to another editor -> false
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: otherDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
      }),
      false
    );

    // Unassigned -> false
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: unassignedDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
      }),
      false
    );

    // Unlinked editor -> false
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: null,
        linkedEditorTeamMember: null,
      }),
      false
    );

    // Directory-inactive linked Team Member with active portal login -> retains access to existing assigned deliverables
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: { ...activeEditorMember, status: 'Inactive', is_active: false },
        isUserActive: true,
      }),
      true
    );

    // Disabled portal login -> false regardless of Team Member directory status
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
        isUserActive: false,
      }),
      false
    );

    // Conflicting linkedEditorTeamMemberId vs linkedEditorTeamMember.id -> false
    assert.strictEqual(
      canEditDeliverable({
        role: 'Editor',
        deliverable: ownDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: otherEditorMember,
      }),
      false
    );
  });

  it('permits ALL SEVEN canonical workflow statuses for Editors on their own assigned deliverables', () => {
    assert.strictEqual(EDITOR_ALLOWED_DELIVERABLE_STATUSES.length, 7);
    assert.deepStrictEqual([...EDITOR_ALLOWED_DELIVERABLE_STATUSES], [...DELIVERABLE_WORKFLOW_STATUSES]);

    const allowedForOwn = getAllowedDeliverableStatusesForUser({
      role: 'Editor',
      deliverable: ownDeliverable,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: activeEditorMember,
    });
    assert.deepStrictEqual(allowedForOwn, [...DELIVERABLE_WORKFLOW_STATUSES]);

    for (const status of DELIVERABLE_WORKFLOW_STATUSES) {
      assert.strictEqual(
        canSetDeliverableStatus({
          role: 'Editor',
          deliverable: ownDeliverable,
          status,
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
        }),
        true,
        `Editor must be allowed to set own deliverable to status "${status}"`
      );

      // Must be denied on another editor's or unassigned deliverable
      assert.strictEqual(
        canSetDeliverableStatus({
          role: 'Editor',
          deliverable: otherDeliverable,
          status,
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
        }),
        false
      );
      assert.strictEqual(
        canSetDeliverableStatus({
          role: 'Editor',
          deliverable: unassignedDeliverable,
          status,
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
        }),
        false
      );
    }

    // Invalid or empty status denied
    assert.strictEqual(
      canSetDeliverableStatus({
        role: 'Editor',
        deliverable: ownDeliverable,
        status: 'BogusStatus',
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      }),
      false
    );
    assert.strictEqual(
      canSetDeliverableStatus({
        role: 'Editor',
        deliverable: ownDeliverable,
        status: '',
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      }),
      false
    );
    assert.deepStrictEqual(
      getAllowedDeliverableStatusesForUser({
        role: 'Editor',
        deliverable: otherDeliverable,
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      }),
      []
    );
  });

  it('validateDeliverableUpdateFields & extractEditorDeliverableChanges reject protected fields and sanitize allowed Editor updates', () => {
    assert.deepStrictEqual([...EDITOR_EDITABLE_DELIVERABLE_FIELDS], ['status', 'external_link']);

    // Allowed: status + external_link on own deliverable
    const validBoth = validateDeliverableUpdateFields({
      role: 'Editor',
      deliverable: ownDeliverable,
      updatedFields: { status: 'Approved', external_link: '  https://vimeo.com/12345  ' },
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: activeEditorMember,
    });
    assert.strictEqual(validBoth.allowed, true);
    assert.deepStrictEqual(validBoth.sanitizedEditorPatch, {
      status: 'Approved',
      external_link: 'https://vimeo.com/12345',
    });

    // Rejects every protected field when supplied by an Editor
    for (const protectedField of PROTECTED_DELIVERABLE_FIELDS) {
      if (protectedField === 'id' || protectedField === 'created_at' || protectedField === 'updated_at') {
        // Still rejected even if present!
      }
      const res = validateDeliverableUpdateFields({
        role: 'Editor',
        deliverable: ownDeliverable,
        updatedFields: { [protectedField]: 'tampered', status: 'In Progress' },
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
      });
      assert.strictEqual(
        res.allowed,
        false,
        `Protected field "${protectedField}" must be rejected for Editor`
      );
    }

    // Rejects invalid status value
    const badStatus = validateDeliverableUpdateFields({
      role: 'Editor',
      deliverable: ownDeliverable,
      updatedFields: { status: 'CustomInvalid' },
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
    });
    assert.strictEqual(badStatus.allowed, false);

    // Rejects empty fields object
    const emptyPatch = validateDeliverableUpdateFields({
      role: 'Editor',
      deliverable: ownDeliverable,
      updatedFields: {},
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
    });
    assert.strictEqual(emptyPatch.allowed, false);

    // extractEditorDeliverableChanges identifies allowed changes & protected field tampering
    const cleanCandidate: Deliverable = {
      ...ownDeliverable,
      status: 'Submitted',
      external_link: 'https://frame.io/v2',
    };
    const cleanDiff = extractEditorDeliverableChanges(ownDeliverable, cleanCandidate);
    assert.deepStrictEqual(cleanDiff.disallowedFields, []);
    assert.deepStrictEqual(cleanDiff.changes, {
      status: 'Submitted',
      external_link: 'https://frame.io/v2',
    });

    const tamperedCandidate: Deliverable = {
      ...ownDeliverable,
      status: 'Submitted',
      priority: 'Urgent',
      notes: 'Overwritten by Editor',
    };
    const tamperedDiff = extractEditorDeliverableChanges(ownDeliverable, tamperedCandidate);
    assert.ok(tamperedDiff.disallowedFields.includes('priority'));
    assert.ok(tamperedDiff.disallowedFields.includes('notes'));
  });
});

describe('Stage 2B.3B — Dedicated Editor-Safe Deliverable Persistence & Admin Preservation', () => {
  it('persists ALL 7 workflow statuses on own deliverable while preserving Admin notes, client_feedback, and existing milestones', async () => {
    const storage = createMemoryStorage();
    const dbSerializedNotes = serializeDeliverableNotes(ownDeliverable.notes, {
      assigned_at: '2026-11-01T10:00:00.000Z',
    });

    let currentDbRow: Record<string, any> = {
      id: DELIVERABLE_OWN_ID,
      project_id: PROJECT_ID,
      company_id: TWB_COMPANY_UUID,
      name: ownDeliverable.deliverable_type,
      deliverable_type: ownDeliverable.deliverable_type,
      assigned_editor_id: EDITOR_MEMBER_ID,
      due_date: ownDeliverable.due_date,
      status: 'Assigned',
      priority: 'High',
      external_link: 'https://frame.io/initial',
      client_feedback: 'Couple loved the teaser pacing.',
      notes: dbSerializedNotes,
      updated_at: '2026-11-01T10:00:00.000Z',
    };

    const recordedPayloads: Record<string, any>[] = [];

    const adapter = {
      selectById: async (id: string) => ({
        data: id === DELIVERABLE_OWN_ID ? currentDbRow : null,
        error: null,
      }),
      updateAndReturn: async (_id: string, payload: Record<string, any>) => {
        recordedPayloads.push(payload);
        currentDbRow = { ...currentDbRow, ...payload };
        return { data: [currentDbRow], error: null };
      },
    };

    // Exercise ALL 7 statuses sequentially
    for (let i = 0; i < DELIVERABLE_WORKFLOW_STATUSES.length; i++) {
      const targetStatus = DELIVERABLE_WORKFLOW_STATUSES[i];
      const stepIso = `2026-11-${String(10 + i).padStart(2, '0')}T12:00:00.000Z`;
      const saved = await updateDeliverableAsEditorWithSupabase({
        deliverableId: DELIVERABLE_OWN_ID,
        changes: { status: targetStatus },
        actorRole: 'Editor',
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
        adapter,
        mapRow: mapSupabaseDeliverableToModel,
        storage,
        nowIso: stepIso,
      });

      assert.strictEqual(saved.status, targetStatus);
      assert.strictEqual(saved.notes, ownDeliverable.notes);
      assert.strictEqual(saved.client_feedback, ownDeliverable.client_feedback);
      assert.strictEqual(saved.assigned_at, '2026-11-01T10:00:00.000Z');
      assert.strictEqual(saved.external_link, 'https://frame.io/initial');
    }

    assert.strictEqual(recordedPayloads.length, 7);
    // Verify no payload ever included protected fields or client_feedback
    for (const payload of recordedPayloads) {
      for (const forbidden of [
        'project_id',
        'company_id',
        'name',
        'deliverable_type',
        'assigned_editor_id',
        'due_date',
        'priority',
        'client_feedback',
      ]) {
        assert.strictEqual(
          Object.prototype.hasOwnProperty.call(payload, forbidden),
          false,
          `Editor update payload must NEVER include protected column "${forbidden}"`
        );
      }
    }

    // Verify first_submitted_at was set at Submitted step (index 3 -> Nov 13) and NOT overwritten later
    const cached = readCachedArray<Deliverable>(storage, 'deliverables')?.[0];
    assert.strictEqual(cached?.first_submitted_at, '2026-11-13T12:00:00.000Z');
    assert.strictEqual(cached?.delivered_at, '2026-11-16T12:00:00.000Z');
  });

  it('external_link-only update sends only external_link + updated_at and never modifies notes, status, or client_feedback', async () => {
    const storage = createMemoryStorage();
    const dbSerializedNotes = serializeDeliverableNotes('Admin private note', {
      assigned_at: '2026-11-01T10:00:00.000Z',
    });

    const currentDbRow: Record<string, any> = {
      id: DELIVERABLE_OWN_ID,
      project_id: PROJECT_ID,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: EDITOR_MEMBER_ID,
      due_date: '2026-12-15',
      status: 'In Progress',
      priority: 'High',
      external_link: null,
      client_feedback: 'Keep warm colors',
      notes: dbSerializedNotes,
      updated_at: '2026-11-01T10:00:00.000Z',
    };

    let capturedPayload: Record<string, any> | null = null;
    const adapter = {
      selectById: async () => ({ data: currentDbRow, error: null }),
      updateAndReturn: async (_id: string, payload: Record<string, any>) => {
        capturedPayload = payload;
        return { data: [{ ...currentDbRow, ...payload }], error: null };
      },
    };

    const saved = await updateDeliverableAsEditorWithSupabase({
      deliverableId: DELIVERABLE_OWN_ID,
      changes: { external_link: '  https://frame.io/cut-v3  ' },
      actorRole: 'Editor',
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: activeEditorMember,
      adapter,
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      nowIso: '2026-11-12T15:00:00.000Z',
    });

    assert.deepStrictEqual(capturedPayload, {
      external_link: 'https://frame.io/cut-v3',
      updated_at: '2026-11-12T15:00:00.000Z',
    });
    assert.strictEqual(saved.external_link, 'https://frame.io/cut-v3');
    assert.strictEqual(saved.status, 'In Progress');
    assert.strictEqual(saved.notes, 'Admin private note');
    assert.strictEqual(saved.client_feedback, 'Keep warm colors');
    assert.strictEqual(saved.assigned_at, '2026-11-01T10:00:00.000Z');
  });

  it('rejects unassigned, other-editor, unlinked, inactive, disallowed-field, and invalid-status attempts with ZERO DB writes', async () => {
    const storage = createMemoryStorage();
    let selectCount = 0;
    let updateCount = 0;

    const makeAdapter = (row: Record<string, any> | null) => ({
      selectById: async () => {
        selectCount++;
        return { data: row, error: null };
      },
      updateAndReturn: async (_id: string, _payload: Record<string, any>) => {
        updateCount++;
        return { data: [row], error: null };
      },
    });

    // 1. Assigned to another editor (verified via authoritative DB row) -> throws, 0 writes
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OTHER_ID,
          changes: { status: 'In Progress' },
          actorRole: 'Editor',
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
          adapter: makeAdapter({
            id: DELIVERABLE_OTHER_ID,
            project_id: PROJECT_ID,
            company_id: TWB_COMPANY_UUID,
            deliverable_type: 'Highlight Film (4-5 mins)',
            assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
            status: 'Assigned',
          }),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /assigned to their own linked team member/i
    );
    assert.strictEqual(selectCount, 1);
    assert.strictEqual(updateCount, 0);

    // 2. Unassigned deliverable -> throws, 0 writes
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_UNASSIGNED_ID,
          changes: { status: 'Submitted' },
          actorRole: 'Editor',
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
          adapter: makeAdapter({
            id: DELIVERABLE_UNASSIGNED_ID,
            project_id: PROJECT_ID,
            company_id: TWB_COMPANY_UUID,
            deliverable_type: 'Highlight Film (4-5 mins)',
            assigned_editor_id: null,
            status: 'Not Started',
          }),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /assigned to their own linked team member/i
    );
    assert.strictEqual(updateCount, 0);

    // 3. Unlinked Editor -> throws before DB write
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OWN_ID,
          changes: { status: 'In Progress' },
          actorRole: 'Editor',
          linkedEditorTeamMemberId: null,
          linkedEditorTeamMember: null,
          adapter: makeAdapter(null),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /not linked to an active Team Member/i
    );
    assert.strictEqual(updateCount, 0);

    // 4. Non-Editor category linked Team Member -> throws with 0 DB writes
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OWN_ID,
          changes: { status: 'In Progress' },
          actorRole: 'Editor',
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: { ...activeEditorMember, categories: ['Photo'] },
          adapter: makeAdapter(null),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /not linked/i
    );
    assert.strictEqual(updateCount, 0);

    // 5. Inactive user account or unauthorized role -> throws
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OWN_ID,
          changes: { status: 'In Progress' },
          actorRole: 'Editor',
          isActorActive: false,
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          adapter: makeAdapter(null),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /Inactive accounts/i
    );
    await assert.rejects(
      () =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OWN_ID,
          changes: { status: 'In Progress' },
          actorRole: 'Team Member',
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          adapter: makeAdapter(null),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        }),
      /Editor role/i
    );
    assert.strictEqual(updateCount, 0);

    // 6. Attempted modification of protected fields -> throws with 0 DB writes
    for (const badChanges of [
      { assigned_editor_id: OTHER_EDITOR_MEMBER_ID },
      { priority: 'Urgent' },
      { due_date: '2027-01-01' },
      { deliverable_type: 'Teaser / Reel (60s)' },
      { notes: 'Tampered notes' },
      { client_feedback: 'Tampered feedback' },
      { project_id: 'other-project' },
      { status: 'InvalidWorkflowStatus' },
    ] as Record<string, unknown>[]) {
      await assert.rejects(() =>
        updateDeliverableAsEditorWithSupabase({
          deliverableId: DELIVERABLE_OWN_ID,
          changes: badChanges,
          actorRole: 'Editor',
          linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
          linkedEditorTeamMember: activeEditorMember,
          adapter: makeAdapter({
            id: DELIVERABLE_OWN_ID,
            assigned_editor_id: EDITOR_MEMBER_ID,
            status: 'Assigned',
          }),
          mapRow: mapSupabaseDeliverableToModel,
          storage,
        })
      );
      assert.strictEqual(updateCount, 0);
    }
  });

  it('keeps Admin/Manager full-row updateDeliverableWithSupabase path completely intact', async () => {
    const storage = createMemoryStorage();
    const existingDbRow: Record<string, any> = {
      id: DELIVERABLE_OWN_ID,
      project_id: PROJECT_ID,
      company_id: TWB_COMPANY_UUID,
      name: 'Highlight Film (4-5 mins)',
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: EDITOR_MEMBER_ID,
      due_date: '2026-12-15',
      status: 'Assigned',
      priority: 'Medium',
      notes: serializeDeliverableNotes('Old note', { assigned_at: '2026-11-01T10:00:00.000Z' }),
      client_feedback: null,
    };

    let adminPayload: Record<string, any> | null = null;
    const saved = await updateDeliverableWithSupabase({
      deliverable: {
        ...ownDeliverable,
        assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
        priority: 'Urgent',
        due_date: '2026-12-20',
        deliverable_type: 'Feature Film (20-30 mins)',
        status: 'Changes Requested',
        notes: 'Admin updated note',
        client_feedback: 'Please trim ceremony intro.',
        external_link: 'https://frame.io/admin-link',
      },
      adapter: {
        selectById: async () => ({ data: existingDbRow, error: null }),
        updateAndReturn: async (_id: string, payload: Record<string, any>) => {
          adminPayload = payload;
          return { data: [{ ...existingDbRow, ...payload }], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
      nowIso: '2026-11-16T10:00:00.000Z',
    });

    assert.ok(adminPayload);
    assert.strictEqual(adminPayload!.assigned_editor_id, OTHER_EDITOR_MEMBER_ID);
    assert.strictEqual(adminPayload!.priority, 'Urgent');
    assert.strictEqual(adminPayload!.due_date, '2026-12-20');
    assert.strictEqual(adminPayload!.deliverable_type, 'Feature Film (20-30 mins)');
    assert.strictEqual(adminPayload!.client_feedback, 'Please trim ceremony intro.');
    assert.strictEqual(saved.status, 'Changes Requested');
    assert.strictEqual(saved.notes, 'Admin updated note');
  });

  it('keeps apiService.updateDeliverableAsEditor resilient when best-effort notification or project lookup fails', async () => {
    const seedDeliverable: Deliverable = {
      ...ownDeliverable,
      id: 'local-editor-del-1',
    };

    const storage = getDefaultPhase1Storage();
    const previousCached = readCachedArray<Deliverable>(storage, 'deliverables');
    writeCachedArray(storage, 'deliverables', [seedDeliverable]);

    const origGetProjects = apiService.getProjects;
    const origCreateNotification = apiService.createNotification;
    let notificationCalls = 0;

    try {
      apiService.getProjects = async () => {
        throw new Error('RLS denied projects read for Editor');
      };
      apiService.createNotification = async () => {
        notificationCalls++;
        throw new Error('RLS denied notifications insert');
      };

      const saved = await apiService.updateDeliverableAsEditor({
        deliverableId: seedDeliverable.id,
        changes: {
          status: 'Submitted',
          external_link: 'https://frame.io/submitted-cut',
        },
        actorRole: 'Editor',
        updaterName: 'Riya Sharma',
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
        nowIso: '2026-11-16T14:00:00.000Z',
      });

      assert.strictEqual(saved.status, 'Submitted');
      assert.strictEqual(saved.external_link, 'https://frame.io/submitted-cut');
      assert.strictEqual(notificationCalls, 1);

      // External-link-only update does not attempt notification creation
      const savedLinkOnly = await apiService.updateDeliverableAsEditor({
        deliverableId: seedDeliverable.id,
        changes: {
          external_link: 'https://frame.io/revised-cut',
        },
        actorRole: 'Editor',
        updaterName: 'Riya Sharma',
        linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
        linkedEditorTeamMember: activeEditorMember,
        nowIso: '2026-11-16T14:30:00.000Z',
      });
      assert.strictEqual(savedLinkOnly.external_link, 'https://frame.io/revised-cut');
      assert.strictEqual(notificationCalls, 1);
    } finally {
      apiService.getProjects = origGetProjects;
      apiService.createNotification = origCreateNotification;
      writeCachedArray(storage, 'deliverables', previousCached || []);
    }
  });
});

describe('Stage 2B.3C — AppContext Deliverable & Catalogue Permission Guards', () => {
  const adminProfile: Profile = {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin@twb.studio',
    full_name: 'Studio Admin',
    role: 'Admin',
    is_active: true,
    status: 'Active',
  };

  const managerProfile: Profile = {
    id: '88888888-8888-4888-8888-888888888888',
    email: 'manager@twb.studio',
    full_name: 'Studio Manager',
    role: 'Manager',
    is_active: true,
    status: 'Active',
  };

  const createSpyActions = (overrides: {
    currentUser: Profile | null;
    userRole: 'Admin' | 'Manager' | 'Editor' | 'Team Member' | null;
    isUserActive?: boolean;
    linkedEditorTeamMember?: TeamMember | null;
    linkedEditorTeamMemberId?: string | null;
  }) => {
    const calls = {
      createDeliverable: 0,
      updateDeliverable: 0,
      updateDeliverableStatus: 0,
      updateDeliverableAsEditor: [] as any[],
      deleteDeliverable: 0,
      createCatalogue: 0,
      updateCatalogue: 0,
      reorderCatalogue: 0,
      deleteCatalogue: 0,
      refreshAllData: 0,
    };

    let stateDeliverables = [ownDeliverable, otherDeliverable, unassignedDeliverable];

    const actions = createAppDeliverableActions({
      currentUser: overrides.currentUser,
      userRole: overrides.userRole,
      isUserActive: overrides.isUserActive ?? true,
      deliverables: stateDeliverables,
      deliverableCatalogue: [],
      enquiries: [],
      linkedEditorTeamMember:
        overrides.linkedEditorTeamMember !== undefined
          ? overrides.linkedEditorTeamMember
          : null,
      linkedEditorTeamMemberId:
        overrides.linkedEditorTeamMemberId !== undefined
          ? overrides.linkedEditorTeamMemberId
          : null,
      api: {
        createDeliverable: async d => {
          calls.createDeliverable++;
          return { ...ownDeliverable, ...d, id: 'created-del-1' };
        },
        updateDeliverable: async d => {
          calls.updateDeliverable++;
          return d;
        },
        updateDeliverableStatus: async (id, status) => {
          calls.updateDeliverableStatus++;
          const base = stateDeliverables.find(item => item.id === id) || ownDeliverable;
          return { ...base, status };
        },
        updateDeliverableAsEditor: async params => {
          calls.updateDeliverableAsEditor.push(params);
          const base =
            stateDeliverables.find(item => item.id === params.deliverableId) || ownDeliverable;
          return {
            ...base,
            status: params.changes.status ?? base.status,
            external_link:
              params.changes.external_link !== undefined
                ? params.changes.external_link || undefined
                : base.external_link,
          };
        },
        deleteDeliverable: async () => {
          calls.deleteDeliverable++;
        },
        createDeliverableCatalogueItem: async item => {
          calls.createCatalogue++;
          return {
            id: 'cat-1',
            name: item.name,
            category: 'Film',
            company_id: null,
            applicable_brand: item.applicable_brand,
            is_active: true,
            sort_order: 10,
          };
        },
        updateDeliverableCatalogueItem: async item => {
          calls.updateCatalogue++;
          return item;
        },
        reorderDeliverableCatalogue: async pair => {
          calls.reorderCatalogue++;
          return pair;
        },
        deleteDeliverableCatalogueItem: async () => {
          calls.deleteCatalogue++;
        },
      },
      setDeliverables: updater => {
        stateDeliverables =
          typeof updater === 'function' ? updater(stateDeliverables) : updater;
      },
      setDeliverableCatalogue: () => {},
      refreshAllData: async () => {
        calls.refreshAllData++;
      },
    });

    return { actions, calls, getStateDeliverables: () => stateDeliverables };
  };

  it('retains full deliverable CRUD & status updates for Admin and Manager', async () => {
    for (const [profile, role] of [
      [adminProfile, 'Admin'],
      [managerProfile, 'Manager'],
    ] as const) {
      const { actions, calls } = createSpyActions({
        currentUser: profile,
        userRole: role,
      });

      await actions.createDeliverable({
        project_id: PROJECT_ID,
        company_id: 'twb',
        deliverable_type: 'Teaser / Reel (60s)',
        assigned_editor_id: EDITOR_MEMBER_ID,
        due_date: '2026-12-15',
        status: 'Assigned',
        priority: 'High',
      });
      await actions.updateDeliverable({
        ...otherDeliverable,
        priority: 'Urgent',
        notes: 'Manager/Admin updated note',
      });
      await actions.updateDeliverableStatus(unassignedDeliverable.id, 'Approved');
      await actions.deleteDeliverable(otherDeliverable.id);
      await actions.createDeliverableCatalogueItem({
        name: 'Custom Drone Reel',
        applicable_brand: 'twb',
      });

      assert.strictEqual(calls.createDeliverable, 1);
      assert.strictEqual(calls.updateDeliverable, 1);
      assert.strictEqual(calls.updateDeliverableStatus, 1);
      assert.strictEqual(calls.deleteDeliverable, 1);
      assert.strictEqual(calls.createCatalogue, 1);
      assert.strictEqual(calls.updateDeliverableAsEditor.length, 0);
    }
  });

  it('routes Editor own status (all 7 statuses) and external_link updates exclusively through apiService.updateDeliverableAsEditor', async () => {
    const { actions, calls } = createSpyActions({
      currentUser: editorProfile,
      userRole: 'Editor',
      linkedEditorTeamMember: activeEditorMember,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
    });

    // All 7 workflow statuses succeed via updateDeliverableAsEditor and updateDeliverableStatus
    for (const st of DELIVERABLE_WORKFLOW_STATUSES) {
      await actions.updateDeliverableStatus(DELIVERABLE_OWN_ID, st);
    }

    // Direct external_link update succeeds via updateDeliverableAsEditor
    const updatedLink = await actions.updateDeliverableAsEditor(DELIVERABLE_OWN_ID, {
      external_link: 'https://frame.io/editor-cut-final',
    });
    assert.strictEqual(updatedLink.external_link, 'https://frame.io/editor-cut-final');

    // Calling generic updateDeliverable with ONLY allowed change also safely routes through updateDeliverableAsEditor
    const updatedViaGeneric = await actions.updateDeliverable({
      ...ownDeliverable,
      status: 'Submitted',
      external_link: 'https://frame.io/generic-safe',
    });
    assert.strictEqual(updatedViaGeneric.status, 'Submitted');
    assert.strictEqual(updatedViaGeneric.external_link, 'https://frame.io/generic-safe');

    // NEVER invokes Admin/Manager full update functions
    assert.strictEqual(calls.updateDeliverable, 0);
    assert.strictEqual(calls.updateDeliverableStatus, 0);
    assert.strictEqual(calls.updateDeliverableAsEditor.length, 9);
  });

  it('rejects Editor create, delete, other/unassigned row edits, protected fields, catalogue writes, and unlinked/inactive identities with ZERO DB calls', async () => {
    const { actions, calls } = createSpyActions({
      currentUser: editorProfile,
      userRole: 'Editor',
      linkedEditorTeamMember: activeEditorMember,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
    });

    await assert.rejects(
      () =>
        actions.createDeliverable({
          project_id: PROJECT_ID,
          company_id: 'twb',
          deliverable_type: 'Highlight Film (4-5 mins)',
          assigned_editor_id: EDITOR_MEMBER_ID,
          due_date: '2026-12-15',
          status: 'Assigned',
          priority: 'Medium',
        }),
      /Only Admins and Managers can create deliverables/i
    );

    await assert.rejects(
      () => actions.deleteDeliverable(DELIVERABLE_OWN_ID),
      /Only Admins and Managers can delete deliverables/i
    );

    // Other editor's deliverable & unassigned deliverable rejected via all 3 update methods
    for (const target of [otherDeliverable, unassignedDeliverable]) {
      await assert.rejects(
        () => actions.updateDeliverableStatus(target.id, 'Submitted'),
        /own linked team member/i
      );
      await assert.rejects(
        () =>
          actions.updateDeliverableAsEditor(target.id, {
            external_link: 'https://frame.io/hijack',
          }),
        /own linked team member/i
      );
      await assert.rejects(
        () =>
          actions.updateDeliverable({
            ...target,
            status: 'In Progress',
          }),
        /own linked team member/i
      );
    }

    // Protected field tampering rejected via both updateDeliverable & updateDeliverableAsEditor
    await assert.rejects(
      () =>
        actions.updateDeliverable({
          ...ownDeliverable,
          priority: 'Urgent',
        }),
      /protected deliverable fields.*priority/i
    );
    await assert.rejects(
      () =>
        actions.updateDeliverable({
          ...ownDeliverable,
          notes: 'Editor overwriting Admin notes',
        }),
      /protected deliverable fields.*notes/i
    );
    await assert.rejects(
      () =>
        actions.updateDeliverable({
          ...ownDeliverable,
          assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
        }),
      /protected deliverable fields.*assigned_editor_id/i
    );
    await assert.rejects(
      () =>
        actions.updateDeliverableAsEditor(DELIVERABLE_OWN_ID, {
          status: 'Submitted',
          client_feedback: 'Injected feedback',
        }),
      /protected deliverable field "client_feedback"/i
    );

    // Catalogue mutations rejected for Editor
    await assert.rejects(
      () =>
        actions.createDeliverableCatalogueItem({
          name: 'Unauthorized Item',
          applicable_brand: 'twb',
        }),
      /Only Admins and Managers/i
    );
    await assert.rejects(
      () =>
        actions.updateDeliverableCatalogueItem({
          id: 'cat-1',
          name: 'Item',
          category: 'Film',
          company_id: null,
          applicable_brand: 'all',
          is_active: false,
          sort_order: 10,
        }),
      /Only Admins/i
    );
    await assert.rejects(
      () =>
        actions.reorderDeliverableCatalogue([
          {
            id: 'cat-1',
            name: 'A',
            category: 'Film',
            company_id: null,
            applicable_brand: 'all',
            is_active: true,
            sort_order: 20,
          },
          {
            id: 'cat-2',
            name: 'B',
            category: 'Film',
            company_id: null,
            applicable_brand: 'all',
            is_active: true,
            sort_order: 10,
          },
        ]),
      /Only Admins/i
    );
    await assert.rejects(
      () => actions.deleteDeliverableCatalogueItem('cat-1', 'Item'),
      /Only Admins/i
    );

    // Unlinked & inactive Editor identities fail closed
    const unlinked = createSpyActions({
      currentUser: editorProfile,
      userRole: 'Editor',
      linkedEditorTeamMember: null,
      linkedEditorTeamMemberId: null,
    });
    await assert.rejects(
      () => unlinked.actions.updateDeliverableStatus(DELIVERABLE_OWN_ID, 'Submitted'),
      /not linked/i
    );
    await assert.rejects(
      () =>
        unlinked.actions.updateDeliverableAsEditor(DELIVERABLE_OWN_ID, {
          external_link: 'https://frame.io/x',
        }),
      /not linked/i
    );

    const inactive = createSpyActions({
      currentUser: { ...editorProfile, is_active: false },
      userRole: 'Editor',
      isUserActive: false,
      linkedEditorTeamMember: activeEditorMember,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
    });
    await assert.rejects(
      () => inactive.actions.updateDeliverableStatus(DELIVERABLE_OWN_ID, 'Submitted'),
      /active verified account/i
    );

    // Assert ZERO DB/API calls occurred across all rejected attempts
    assert.strictEqual(calls.createDeliverable, 0);
    assert.strictEqual(calls.updateDeliverable, 0);
    assert.strictEqual(calls.updateDeliverableStatus, 0);
    assert.strictEqual(calls.updateDeliverableAsEditor.length, 0);
    assert.strictEqual(calls.deleteDeliverable, 0);
    assert.strictEqual(calls.createCatalogue, 0);
    assert.strictEqual(calls.updateCatalogue, 0);
    assert.strictEqual(calls.reorderCatalogue, 0);
    assert.strictEqual(calls.deleteCatalogue, 0);
    assert.strictEqual(unlinked.calls.updateDeliverableAsEditor.length, 0);
    assert.strictEqual(inactive.calls.updateDeliverableAsEditor.length, 0);
  });
});

describe('Stage 2B.3C — Deliverables UI Row Controls & Modal Isolation', () => {
  const renderRowHtml = (params: {
    role: 'Admin' | 'Manager' | 'Editor';
    del: Deliverable;
    linkedEditorTeamMemberId?: string | null;
    linkedEditorTeamMember?: TeamMember | null;
  }): { html: string; perms: ReturnType<typeof getDeliverableRowPermissionState> } => {
    const perms = getDeliverableRowPermissionState({
      role: params.role,
      deliverable: params.del,
      linkedEditorTeamMemberId: params.linkedEditorTeamMemberId,
      linkedEditorTeamMember: params.linkedEditorTeamMember,
      isUserActive: true,
    });

    const html = renderToStaticMarkup(
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(DeliverableRow, {
            del: params.del,
            editorName:
              params.del.assigned_editor_id === EDITOR_MEMBER_ID
                ? 'Riya Sharma'
                : params.del.assigned_editor_id === OTHER_EDITOR_MEMBER_ID
                ? 'Kabir Verma'
                : null,
            canManage: perms.canManageAll,
            canEditStatus: perms.canEditStatus,
            canEditExternalLink: perms.canEditExternalLink,
            canOpenAdminEditModal: perms.canOpenAdminEditModal,
            canDeleteRow: perms.canDeleteRow,
            isOwnedByCurrentEditor: perms.isOwnedByCurrentEditor,
            allowedStatuses: perms.allowedStatuses,
            availableEditors: [
              { id: EDITOR_MEMBER_ID, name: 'Riya Sharma' },
              { id: OTHER_EDITOR_MEMBER_ID, name: 'Kabir Verma' },
            ],
            onEdit: () => {},
            onDelete: () => {},
            onStatusChange: async () => {},
            onEditorExternalLinkChange: async () => {},
            onActionError: () => {},
          })
        )
      )
    );

    return { html, perms };
  };

  it('renders enabled all-7-status selector and external-link editor ONLY on Editor own assigned rows, without Admin Edit/Delete controls', () => {
    const { html, perms } = renderRowHtml({
      role: 'Editor',
      del: ownDeliverable,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: activeEditorMember,
    });

    assert.strictEqual(perms.isOwnedByCurrentEditor, true);
    assert.strictEqual(perms.canEditStatus, true);
    assert.strictEqual(perms.canEditExternalLink, true);
    assert.strictEqual(perms.canOpenAdminEditModal, false);
    assert.strictEqual(perms.canDeleteRow, false);
    assert.deepStrictEqual(perms.allowedStatuses, [...DELIVERABLE_WORKFLOW_STATUSES]);

    // Enabled status <select> with ALL 7 workflow statuses
    assert.ok(html.includes(`id="deliverable-status-${ownDeliverable.id}"`));
    for (const status of DELIVERABLE_WORKFLOW_STATUSES) {
      assert.ok(
        html.includes(`value="${status}"`),
        `Own row status dropdown must contain option "${status}"`
      );
    }

    // External link editing button present; existing notes/feedback text remains visible read-only
    assert.ok(html.includes(`id="editor-edit-link-btn-${ownDeliverable.id}"`));
    assert.ok(html.includes('Keep vows audio clean and warm film grain.'));
    assert.ok(html.includes('Riya Sharma'));

    // Admin/Manager modal trigger, delete action, and inline editor reassignment dropdown MUST NOT exist
    assert.strictEqual(html.includes(`id="action-btn-${ownDeliverable.id}"`), false);
    assert.strictEqual(html.includes(`id="delete-btn-${ownDeliverable.id}"`), false);
    assert.strictEqual(html.includes(`id="deliverable-editor-${ownDeliverable.id}"`), false);
  });

  it('renders non-editable status, read-only URL, and zero edit/delete actions on other Editors, unassigned, and unlinked rows', () => {
    for (const scenario of [
      {
        label: "other editor's deliverable",
        del: otherDeliverable,
        memberId: EDITOR_MEMBER_ID,
        member: activeEditorMember,
      },
      {
        label: 'unassigned deliverable',
        del: unassignedDeliverable,
        memberId: EDITOR_MEMBER_ID,
        member: activeEditorMember,
      },
      {
        label: 'unlinked editor viewing own-looking deliverable',
        del: ownDeliverable,
        memberId: null,
        member: null,
      },
    ]) {
      const { html, perms } = renderRowHtml({
        role: 'Editor',
        del: scenario.del,
        linkedEditorTeamMemberId: scenario.memberId,
        linkedEditorTeamMember: scenario.member,
      });

      assert.strictEqual(perms.canEditStatus, false, scenario.label);
      assert.strictEqual(perms.canEditExternalLink, false, scenario.label);
      assert.strictEqual(perms.canOpenAdminEditModal, false, scenario.label);
      assert.strictEqual(perms.canDeleteRow, false, scenario.label);

      // Non-editable status badge instead of <select>
      assert.ok(
        html.includes(`id="deliverable-status-readonly-${scenario.del.id}"`),
        `${scenario.label} must show read-only status`
      );
      assert.strictEqual(
        html.includes(`id="deliverable-status-${scenario.del.id}"`),
        false,
        `${scenario.label} must NOT render status <select>`
      );

      // No link edit control, no Admin action button, no inline editor dropdown
      assert.strictEqual(html.includes(`id="editor-edit-link-btn-${scenario.del.id}"`), false);
      assert.strictEqual(html.includes(`id="action-btn-${scenario.del.id}"`), false);
      assert.strictEqual(html.includes(`id="deliverable-editor-${scenario.del.id}"`), false);
      assert.ok(html.includes('View only'));
    }
  });

  it('preserves Admin and Manager full row controls and verifies DeliverablesView keeps all deliverables visible and Admin modals gated', () => {
    for (const role of ['Admin', 'Manager'] as const) {
      const { html, perms } = renderRowHtml({
        role,
        del: otherDeliverable,
      });

      assert.strictEqual(perms.canManageAll, true);
      assert.strictEqual(perms.canOpenAdminEditModal, true);
      assert.strictEqual(perms.canDeleteRow, true);
      assert.ok(html.includes(`id="deliverable-editor-${otherDeliverable.id}"`));
      assert.ok(html.includes(`id="deliverable-status-${otherDeliverable.id}"`));
      assert.ok(html.includes(`id="action-btn-${otherDeliverable.id}"`));
    }

    const viewSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/deliverables/DeliverablesView.tsx'),
      'utf8'
    );
    const contextSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/context/AppContext.tsx'),
      'utf8'
    );

    // Visibility invariant: DeliverablesView does not filter out other editors' deliverables
    assert.strictEqual(viewSrc.includes('!currentUser ||\n    canAddDeliverableCatalogueEntry'), false);
    assert.ok(viewSrc.includes('canManageAllDeliverables(effectiveRole, isUserActive)'));
    assert.ok(viewSrc.includes('{canManage && editingDeliverable && ('));
    assert.ok(viewSrc.includes('{canManage && showCreateModal && ('));
    assert.ok(viewSrc.includes('{canManage && deletingDeliverable && ('));
    assert.ok(viewSrc.includes('updateDeliverableAsEditor'));

    // AppContext keeps full visibility while protecting mutations
    assert.ok(contextSrc.includes('const filteredDeliverables = deliverables.filter(d => matchBrand(d.company_id));'));
    assert.ok(contextSrc.includes('createAppDeliverableActions'));
    assert.ok(contextSrc.includes('updateDeliverableAsEditor'));
  });
});

describe('Directory Activity vs Portal Login Independence & Assignment Eligibility (Scenarios 6, 7, 8)', () => {
  const activeSupabaseEditor: TeamMember & { active?: boolean } = {
    id: EDITOR_MEMBER_ID,
    profile_id: EDITOR_PROFILE_ID,
    name: 'Riya Sharma',
    email: 'riya.editor@twb.studio',
    phone: '9999999999',
    role: 'Editor',
    role_title: 'Senior Film Editor',
    categories: ['Editor'],
    active: true,
    is_active: true,
    status: 'Active',
  };

  const inactiveDirectoryEditor: TeamMember & { active?: boolean } = {
    ...activeSupabaseEditor,
    active: false,
    is_active: false,
    status: 'Inactive',
  };

  const otherActiveEditor: TeamMember & { active?: boolean } = {
    ...otherEditorMember,
    categories: ['Editor'],
    active: true,
    is_active: true,
    status: 'Active',
  };

  const nonEditorActiveMember: TeamMember & { active?: boolean } = {
    id: '99998888-7777-4666-8555-444433332222',
    name: 'Arjun Photo',
    email: 'arjun@twb.studio',
    phone: '7777777777',
    role_title: 'Lead Photographer',
    categories: ['Photo'],
    active: true,
    is_active: true,
    status: 'Active',
  };

  it('Scenario 6: Inactive Team Member with active Editor portal login retains full access to existing assigned deliverables', async () => {
    const resolved = resolveLinkedEditorTeamMember({
      currentUser: editorProfile,
      profileVerificationState: 'verified',
      teamMembers: [inactiveDirectoryEditor, otherActiveEditor],
    });
    assert.strictEqual(resolved?.id, EDITOR_MEMBER_ID);

    const rowPerms = getDeliverableRowPermissionState({
      role: 'Editor',
      deliverable: ownDeliverable,
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: inactiveDirectoryEditor,
      isUserActive: true,
    });
    assert.strictEqual(rowPerms.isOwnedByCurrentEditor, true);
    assert.strictEqual(rowPerms.canEditStatus, true);
    assert.strictEqual(rowPerms.canEditExternalLink, true);
    assert.deepStrictEqual(rowPerms.allowedStatuses, [...DELIVERABLE_WORKFLOW_STATUSES]);

    // Persistence succeeds on own deliverable even when Team Member record is directory-inactive
    const storage = createMemoryStorage();
    let dbRow: Record<string, any> = {
      id: DELIVERABLE_OWN_ID,
      project_id: PROJECT_ID,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: EDITOR_MEMBER_ID,
      due_date: '2026-12-15',
      status: 'Assigned',
      priority: 'High',
      external_link: 'https://frame.io/initial',
      notes: 'Admin notes kept intact',
      updated_at: '2026-11-01T10:00:00.000Z',
    };

    const updated = await updateDeliverableAsEditorWithSupabase({
      deliverableId: DELIVERABLE_OWN_ID,
      changes: {
        status: 'Submitted',
        external_link: 'https://frame.io/inactive-member-still-works',
      },
      actorRole: 'Editor',
      linkedEditorTeamMemberId: EDITOR_MEMBER_ID,
      linkedEditorTeamMember: inactiveDirectoryEditor,
      isActorActive: true,
      adapter: {
        selectById: async () => ({ data: dbRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          dbRow = { ...dbRow, ...payload };
          return { data: [dbRow], error: null };
        },
      },
      mapRow: mapSupabaseDeliverableToModel,
      storage,
      nowIso: '2026-11-17T10:00:00.000Z',
    });

    assert.strictEqual(updated.status, 'Submitted');
    assert.strictEqual(updated.external_link, 'https://frame.io/inactive-member-still-works');
    assert.strictEqual(updated.notes, 'Admin notes kept intact');

    // Portal login disabled (profiles.is_active === false) still blocks access immediately
    assert.strictEqual(
      resolveLinkedEditorTeamMember({
        currentUser: { ...editorProfile, is_active: false },
        profileVerificationState: 'verified',
        teamMembers: [inactiveDirectoryEditor],
      }),
      null
    );
  });

  it('Scenario 7 & 8: Rejects inactive Team Members for new/reassigned deliverables across UI filters, AppContext, persistence, and API while keeping active Editors eligible and existing assignments editable', async () => {
    // UI selector checks (including raw Supabase `active: false` rows!)
    const supabaseActiveFalseOnly: TeamMember & { active?: boolean } = {
      ...activeSupabaseEditor,
      id: '12121212-1212-4121-8121-121212121212',
      active: false,
      is_active: undefined,
      status: 'Active',
    };
    assert.strictEqual(isEligibleDeliverableEditor(activeSupabaseEditor), true);
    assert.strictEqual(isEligibleDeliverableEditor(inactiveDirectoryEditor), false);
    assert.strictEqual(isEligibleDeliverableEditor(supabaseActiveFalseOnly), false);
    assert.strictEqual(isEligibleDeliverableEditor(nonEditorActiveMember), false);

    const selectable = filterDeliverableEditors([
      inactiveDirectoryEditor,
      supabaseActiveFalseOnly,
      otherActiveEditor,
      nonEditorActiveMember,
    ]);
    assert.deepStrictEqual(
      selectable.map(m => m.id),
      [OTHER_EDITOR_MEMBER_ID]
    );

    // Edit modal preserves ONLY current assigned editor so existing assignments stay intact
    const editSelectable = filterDeliverableEditors(
      [inactiveDirectoryEditor, otherActiveEditor],
      { currentEditorId: EDITOR_MEMBER_ID }
    );
    assert.deepStrictEqual(
      new Set(editSelectable.map(m => m.id)),
      new Set([EDITOR_MEMBER_ID, OTHER_EDITOR_MEMBER_ID])
    );

    // Direct validation helper checks
    assert.strictEqual(
      validateDeliverableEditorAssignment({
        targetEditorId: EDITOR_MEMBER_ID,
        previousEditorId: null,
        teamMembers: [inactiveDirectoryEditor],
      }).valid,
      false
    );
    assert.strictEqual(
      validateDeliverableEditorAssignment({
        targetEditorId: EDITOR_MEMBER_ID,
        previousEditorId: EDITOR_MEMBER_ID,
        teamMembers: [inactiveDirectoryEditor],
      }).valid,
      true
    );
    assert.strictEqual(
      validateDeliverableEditorAssignment({
        targetEditorId: OTHER_EDITOR_MEMBER_ID,
        previousEditorId: null,
        teamMembers: [otherActiveEditor],
      }).valid,
      true
    );

    // Persistence layer: reject inactive & non-Editor on create/reassignment with 0 DB writes
    const storage = createMemoryStorage();
    let insertCalls = 0;
    let updateCalls = 0;
    const roster = [inactiveDirectoryEditor, otherActiveEditor, nonEditorActiveMember];
    const resolveTeamMemberById = async (id: string) =>
      roster.find(member => member.id === id) ?? null;

    await assert.rejects(
      () =>
        createDeliverableWithSupabase({
          deliverable: {
            project_id: PROJECT_ID,
            company_id: 'twb',
            deliverable_type: 'Teaser / Reel (60s)',
            assigned_editor_id: EDITOR_MEMBER_ID,
            due_date: '2026-12-20',
            status: 'Assigned',
            priority: 'Medium',
          },
          adapter: {
            insertAndReturn: async payload => {
              insertCalls++;
              return { data: [payload], error: null };
            },
          },
          resolveTeamMemberById,
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /Inactive team members cannot be assigned/i
    );
    assert.strictEqual(insertCalls, 0);

    // Check 4 regression check: DB trigger error citing assigned_editor_id must fail loudly, NEVER silently null out assigned_editor_id
    await assert.rejects(
      () =>
        createDeliverableWithSupabase({
          deliverable: {
            project_id: PROJECT_ID,
            company_id: 'twb',
            deliverable_type: 'Teaser / Reel (60s)',
            assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
            due_date: '2026-12-20',
            status: 'Assigned',
            priority: 'Medium',
          },
          adapter: {
            insertAndReturn: async () => ({
              data: null,
              error: {
                message:
                  'Cannot assign deliverable assigned_editor_id to an inactive or non-Editor team member.',
              },
            }),
          },
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /inactive or non-Editor team member/i
    );

    // Scenario 8: Active Editor succeeds on create
    const createdActive = await createDeliverableWithSupabase({
      deliverable: {
        project_id: PROJECT_ID,
        company_id: 'twb',
        deliverable_type: 'Teaser / Reel (60s)',
        assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
        due_date: '2026-12-20',
        status: 'Assigned',
        priority: 'Medium',
      },
      adapter: {
        insertAndReturn: async payload => {
          insertCalls++;
          return { data: [{ ...payload, updated_at: '2026-11-17T10:00:00.000Z' }], error: null };
        },
      },
      resolveTeamMemberById,
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
    });
    assert.strictEqual(insertCalls, 1);
    assert.strictEqual(createdActive.assigned_editor_id, OTHER_EDITOR_MEMBER_ID);

    // Update: reject reassigning deliverable from otherActiveEditor -> inactiveDirectoryEditor
    let existingRow: Record<string, any> = {
      id: DELIVERABLE_OTHER_ID,
      project_id: PROJECT_ID,
      company_id: TWB_COMPANY_UUID,
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
      due_date: '2026-12-15',
      status: 'Assigned',
      priority: 'High',
    };
    await assert.rejects(
      () =>
        updateDeliverableWithSupabase({
          deliverable: {
            ...otherDeliverable,
            assigned_editor_id: EDITOR_MEMBER_ID,
          },
          adapter: {
            selectById: async () => ({ data: existingRow, error: null }),
            updateAndReturn: async (_id, payload) => {
              updateCalls++;
              return { data: [{ ...existingRow, ...payload }], error: null };
            },
          },
          resolveTeamMemberById,
          mapRow: mapSupabaseDeliverableToModel,
          toCompanyUuid,
          storage,
        }),
      /Inactive team members cannot be assigned/i
    );
    assert.strictEqual(updateCalls, 0);

    // Existing deliverable already assigned to inactiveDirectoryEditor stays editable on non-reassignment fields
    existingRow = { ...existingRow, id: DELIVERABLE_OWN_ID, assigned_editor_id: EDITOR_MEMBER_ID };
    const preservedExistingEdit = await updateDeliverableWithSupabase({
      deliverable: {
        ...ownDeliverable,
        status: 'Approved',
        priority: 'Urgent',
      },
      adapter: {
        selectById: async () => ({ data: existingRow, error: null }),
        updateAndReturn: async (_id, payload) => {
          updateCalls++;
          return { data: [{ ...existingRow, ...payload }], error: null };
        },
      },
      resolveTeamMemberById,
      mapRow: mapSupabaseDeliverableToModel,
      toCompanyUuid,
      storage,
    });
    assert.strictEqual(updateCalls, 1);
    assert.strictEqual(preservedExistingEdit.assigned_editor_id, EDITOR_MEMBER_ID);
    assert.strictEqual(preservedExistingEdit.status, 'Approved');

    // AppContext admin actions guard against inactive Editor assignment while allowing active Editor & non-reassignment updates
    let apiCreateCalls = 0;
    let apiUpdateCalls = 0;
    const adminProfile: Profile = {
      id: '99999999-9999-4999-8999-999999999999',
      email: 'admin@twb.studio',
      full_name: 'Studio Admin',
      role: 'Admin',
      is_active: true,
      status: 'Active',
    };
    const appActions = createAppDeliverableActions({
      currentUser: adminProfile,
      userRole: 'Admin',
      isUserActive: true,
      deliverables: [ownDeliverable, otherDeliverable],
      deliverableCatalogue: [],
      enquiries: [],
      teamMembers: roster,
      linkedEditorTeamMember: null,
      linkedEditorTeamMemberId: null,
      api: {
        createDeliverable: async d => {
          apiCreateCalls++;
          return { ...ownDeliverable, ...d, id: 'new-del-1' };
        },
        updateDeliverable: async d => {
          apiUpdateCalls++;
          return d;
        },
        updateDeliverableStatus: async (_id, status) => ({ ...ownDeliverable, status }),
        updateDeliverableAsEditor: async () => ownDeliverable,
        deleteDeliverable: async () => {},
        createDeliverableCatalogueItem: async item => ({
          id: 'cat-1',
          name: item.name,
          category: 'Film',
          company_id: null,
          applicable_brand: item.applicable_brand,
          is_active: true,
          sort_order: 10,
        }),
        updateDeliverableCatalogueItem: async item => item,
        reorderDeliverableCatalogue: async pair => pair,
        deleteDeliverableCatalogueItem: async () => {},
      },
      setDeliverables: () => {},
      setDeliverableCatalogue: () => {},
      refreshAllData: async () => {},
    });

    await assert.rejects(
      () =>
        appActions.createDeliverable({
          project_id: PROJECT_ID,
          company_id: 'twb',
          deliverable_type: 'Highlight Film (4-5 mins)',
          assigned_editor_id: EDITOR_MEMBER_ID,
          due_date: '2026-12-20',
          status: 'Assigned',
          priority: 'Medium',
        }),
      /Inactive team members cannot be assigned/i
    );
    await assert.rejects(
      () =>
        appActions.updateDeliverable({
          ...otherDeliverable,
          assigned_editor_id: EDITOR_MEMBER_ID,
        }),
      /Inactive team members cannot be assigned/i
    );
    assert.strictEqual(apiCreateCalls, 0);
    assert.strictEqual(apiUpdateCalls, 0);

    await appActions.createDeliverable({
      project_id: PROJECT_ID,
      company_id: 'twb',
      deliverable_type: 'Highlight Film (4-5 mins)',
      assigned_editor_id: OTHER_EDITOR_MEMBER_ID,
      due_date: '2026-12-20',
      status: 'Assigned',
      priority: 'Medium',
    });
    await appActions.updateDeliverable({
      ...ownDeliverable,
      status: 'Delivered',
    });
    assert.strictEqual(apiCreateCalls, 1);
    assert.strictEqual(apiUpdateCalls, 1);
  });
});

