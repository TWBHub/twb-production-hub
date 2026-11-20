import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildEditorWorkloadMap,
  computeWorkloadSummaryMetrics,
  filterWorkloadDeliverablesForRole,
  resolveVisibleWorkloadEditors,
} from './editorsWorkloadVisibility';
import { resolveLinkedEditorTeamMember } from './deliverablePermissions';
import { Deliverable, Editor, Profile, TeamMember } from '../types';

const RIYA_PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const RIYA_MEMBER_ID = 'tm-riya';
const KABIR_MEMBER_ID = 'tm-kabir';
const UNLINKED_PROFILE_ID = '22222222-2222-4222-8222-222222222222';

const riyaProfile: Profile = {
  id: RIYA_PROFILE_ID,
  email: 'riya@twb.studio',
  full_name: 'Riya Sharma',
  role: 'Editor',
  is_active: true,
  status: 'Active',
};

const unlinkedProfile: Profile = {
  id: UNLINKED_PROFILE_ID,
  email: 'same-email-no-link@twb.studio',
  full_name: 'Same Name',
  role: 'Editor',
  is_active: true,
  status: 'Active',
};

const teamMembersFixture: TeamMember[] = [
  {
    id: RIYA_MEMBER_ID,
    profile_id: RIYA_PROFILE_ID,
    name: 'Riya Sharma',
    email: 'riya@twb.studio',
    phone: '+91 9800000001',
    role_title: 'Senior Highlight Editor',
    categories: ['Editor'],
    is_active: true,
    status: 'Active',
    notes: 'Riya private directory note',
  },
  {
    id: KABIR_MEMBER_ID,
    profile_id: '33333333-3333-4333-8333-333333333333',
    name: 'Kabir Mehta',
    email: 'kabir@twb.studio',
    phone: '+91 9800000002',
    role_title: 'Feature Film Editor',
    categories: ['Editor'],
    is_active: true,
    status: 'Active',
    notes: 'Kabir private directory note',
  },
  {
    // Unlinked member whose email, name, and role_title look identical to `unlinkedProfile`,
    // verifying that Editors & Workload NEVER falls back to email, name, or role_title.
    id: 'tm-same-email-unlinked',
    name: 'Same Name',
    email: 'same-email-no-link@twb.studio',
    phone: '+91 9800000003',
    role_title: 'Lead Editor',
    categories: ['Editor'],
    is_active: true,
    status: 'Active',
  },
];

const editorsFixture: Editor[] = [
  {
    id: RIYA_MEMBER_ID,
    name: 'Riya Sharma',
    email: 'riya@twb.studio',
    phone: '+91 9800000001',
    specialization: 'Highlight & Teaser',
    is_active: true,
    max_concurrent_projects: 4,
    max_active_deliverables: 5,
  },
  {
    id: KABIR_MEMBER_ID,
    name: 'Kabir Mehta',
    email: 'kabir@twb.studio',
    phone: '+91 9800000002',
    specialization: 'Feature Films',
    is_active: true,
    max_concurrent_projects: 4,
    max_active_deliverables: 3,
  },
  {
    // Separate editor entry sharing Riya's email with a different ID and capacity;
    // Editor mode must match by exact ID only and ignore email collisions.
    id: 'ed-email-collision',
    name: 'Email Collision Entry',
    email: 'riya@twb.studio',
    phone: '+91 9800000099',
    specialization: 'Should Not Match',
    is_active: true,
    max_concurrent_projects: 10,
    max_active_deliverables: 10,
  },
];

const deliverablesFixture: Deliverable[] = [
  {
    id: 'del-riya-active-1',
    project_id: 'prj-1',
    company_id: 'twb',
    deliverable_type: 'Highlight Film',
    assigned_editor_id: RIYA_MEMBER_ID,
    due_date: '2026-11-25',
    status: 'In Progress',
    priority: 'High',
    assigned_at: '2026-11-10T10:00:00Z',
    last_updated: '2026-11-12T10:00:00Z',
  },
  {
    id: 'del-riya-active-2',
    project_id: 'prj-2',
    company_id: 'twb',
    deliverable_type: 'Teaser 60s',
    assigned_editor_id: RIYA_MEMBER_ID,
    due_date: '2026-11-28',
    status: 'Submitted',
    priority: 'Medium',
    assigned_at: '2026-11-14T10:00:00Z',
    first_submitted_at: '2026-11-18T12:00:00Z',
    last_updated: '2026-11-18T12:00:00Z',
  },
  {
    id: 'del-riya-delivered-1',
    project_id: 'prj-1',
    company_id: 'twb',
    deliverable_type: 'Instagram Reel',
    assigned_editor_id: RIYA_MEMBER_ID,
    due_date: '2026-11-15',
    status: 'Delivered',
    priority: 'Low',
    assigned_at: '2026-11-01T10:00:00Z',
    delivered_at: '2026-11-08T16:00:00Z',
    last_updated: '2026-11-08T16:00:00Z',
  },
  {
    id: 'del-kabir-active-1',
    project_id: 'prj-3',
    company_id: 'twb',
    deliverable_type: 'Feature Film',
    assigned_editor_id: KABIR_MEMBER_ID,
    due_date: '2026-11-30',
    status: 'In Progress',
    priority: 'Urgent',
    assigned_at: '2026-11-05T09:00:00Z',
    last_updated: '2026-11-15T09:00:00Z',
  },
  {
    id: 'del-unassigned-1',
    project_id: 'prj-4',
    company_id: 'twb',
    deliverable_type: 'Full Ceremony Edit',
    assigned_editor_id: '',
    due_date: '2026-12-01',
    status: 'Not Started',
    priority: 'High',
    last_updated: '2026-11-16T09:00:00Z',
  },
];

describe('Editors & Workload role-based visibility helpers', () => {
  it('Admin/Manager sees all editors, all brand deliverables, unassigned alerts, and roster metrics', () => {
    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: false,
      teamMembers: teamMembersFixture,
      editors: editorsFixture,
      linkedEditorTeamMember: null,
      linkedEditorTeamMemberId: null,
    });

    assert.equal(visible.hasLinkedEditorProfile, true);
    assert.equal(visible.editors.length, 4);
    assert.ok(visible.editors.some(e => e.id === RIYA_MEMBER_ID));
    assert.ok(visible.editors.some(e => e.id === KABIR_MEMBER_ID));

    const roleDeliverables = filterWorkloadDeliverablesForRole({
      isEditorOnly: false,
      brandScopedDeliverables: deliverablesFixture,
      linkedEditorId: visible.linkedEditorId,
    });
    assert.equal(roleDeliverables.length, deliverablesFixture.length);

    const workloadMap = buildEditorWorkloadMap(visible.editors, roleDeliverables);
    const metrics = computeWorkloadSummaryMetrics({
      isEditorOnly: false,
      visibleEditors: visible.editors,
      roleScopedDeliverables: roleDeliverables,
      editorWorkloadMap: workloadMap,
    });

    assert.equal(metrics.totalEditorsCount, 4);
    assert.equal(metrics.totalActiveDeliverables, 4);
    assert.equal(metrics.totalCompletedDeliverables, 1);
    assert.equal(metrics.unassignedCount, 1);
  });

  it('Linked Editor sees ONLY their own Team Member card and own assigned deliverables/metrics', () => {
    const linkedMember = resolveLinkedEditorTeamMember({
      currentUser: riyaProfile,
      profileVerificationState: 'verified',
      teamMembers: teamMembersFixture,
    });
    assert.ok(linkedMember);
    assert.equal(linkedMember.id, RIYA_MEMBER_ID);

    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: true,
      teamMembers: teamMembersFixture,
      editors: editorsFixture,
      linkedEditorTeamMember: linkedMember,
      linkedEditorTeamMemberId: linkedMember.id,
    });

    assert.equal(visible.hasLinkedEditorProfile, true);
    assert.equal(visible.linkedEditorId, RIYA_MEMBER_ID);
    assert.equal(visible.editors.length, 1);
    assert.equal(visible.editors[0].id, RIYA_MEMBER_ID);
    assert.equal(visible.editors[0].name, 'Riya Sharma');
    assert.equal(visible.editors[0].effectiveCapacity, 5);

    const roleDeliverables = filterWorkloadDeliverablesForRole({
      isEditorOnly: true,
      brandScopedDeliverables: deliverablesFixture,
      linkedEditorId: visible.linkedEditorId,
    });

    // Only Riya's 3 deliverables (2 active + 1 delivered); Kabir's and unassigned are excluded.
    assert.equal(roleDeliverables.length, 3);
    assert.ok(roleDeliverables.every(d => d.assigned_editor_id === RIYA_MEMBER_ID));

    const workloadMap = buildEditorWorkloadMap(visible.editors, roleDeliverables);
    const riyaStats = workloadMap.get(RIYA_MEMBER_ID);
    assert.ok(riyaStats);
    assert.equal(riyaStats.totalActiveCount, 2);
    assert.equal(riyaStats.completedDeliverables.length, 1);
    assert.equal(riyaStats.utilizationPercent, 40);
    assert.equal(riyaStats.earliestActiveAssignmentDate, '2026-11-10T10:00:00Z');
    assert.equal(riyaStats.latestActiveAssignmentDate, '2026-11-14T10:00:00Z');

    const metrics = computeWorkloadSummaryMetrics({
      isEditorOnly: true,
      visibleEditors: visible.editors,
      roleScopedDeliverables: roleDeliverables,
      editorWorkloadMap: workloadMap,
    });

    assert.equal(metrics.totalEditorsCount, 1);
    assert.equal(metrics.totalActiveDeliverables, 2);
    assert.equal(metrics.totalCompletedDeliverables, 1);
    assert.equal(metrics.unassignedCount, 0);
  });

  it('Unlinked Editor sees 0 cards and 0 deliverables even if email/name/role_title match another record', () => {
    const linkedMember = resolveLinkedEditorTeamMember({
      currentUser: unlinkedProfile,
      profileVerificationState: 'verified',
      teamMembers: teamMembersFixture,
    });
    assert.equal(linkedMember, null);

    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: true,
      teamMembers: teamMembersFixture,
      editors: editorsFixture,
      linkedEditorTeamMember: linkedMember,
      linkedEditorTeamMemberId: null,
    });

    assert.equal(visible.hasLinkedEditorProfile, false);
    assert.equal(visible.linkedEditorId, null);
    assert.equal(visible.editors.length, 0);

    const roleDeliverables = filterWorkloadDeliverablesForRole({
      isEditorOnly: true,
      brandScopedDeliverables: deliverablesFixture,
      linkedEditorId: visible.linkedEditorId,
    });
    assert.equal(roleDeliverables.length, 0);

    const workloadMap = buildEditorWorkloadMap(visible.editors, roleDeliverables);
    const metrics = computeWorkloadSummaryMetrics({
      isEditorOnly: true,
      visibleEditors: visible.editors,
      roleScopedDeliverables: roleDeliverables,
      editorWorkloadMap: workloadMap,
    });

    assert.equal(metrics.totalEditorsCount, 0);
    assert.equal(metrics.totalActiveDeliverables, 0);
    assert.equal(metrics.totalCompletedDeliverables, 0);
    assert.equal(metrics.unassignedCount, 0);
  });

  it('Fails closed if linkedEditorTeamMember and linkedEditorTeamMemberId conflict', () => {
    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: true,
      teamMembers: teamMembersFixture,
      editors: editorsFixture,
      linkedEditorTeamMember: teamMembersFixture[0],
      linkedEditorTeamMemberId: KABIR_MEMBER_ID,
    });

    assert.equal(visible.hasLinkedEditorProfile, false);
    assert.equal(visible.editors.length, 0);
  });

  it('Does not match capacity metadata by email when Editor ID differs', () => {
    const customLinkedMember: TeamMember = {
      id: 'tm-custom-riya',
      profile_id: RIYA_PROFILE_ID,
      name: 'Riya Custom',
      email: 'riya@twb.studio', // collides with ed-email-collision (capacity 10)
      phone: '',
      role_title: 'Editor',
      categories: ['Editor'],
      is_active: true,
      status: 'Active',
    };

    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: true,
      teamMembers: [customLinkedMember],
      editors: editorsFixture,
      linkedEditorTeamMember: customLinkedMember,
      linkedEditorTeamMemberId: customLinkedMember.id,
    });

    assert.equal(visible.editors.length, 1);
    assert.equal(visible.editors[0].id, 'tm-custom-riya');
    // Defaults to 4 because no `editors` item shares exact id `tm-custom-riya`.
    assert.equal(visible.editors[0].effectiveCapacity, 4);
  });

  it('Preserves visibility for directory-inactive but portal-active Editors', () => {
    const inactiveDirectoryMembers: TeamMember[] = [
      {
        ...teamMembersFixture[0],
        is_active: false,
        status: 'Inactive',
      },
      teamMembersFixture[1],
    ];

    const linkedMember = resolveLinkedEditorTeamMember({
      currentUser: riyaProfile,
      profileVerificationState: 'verified',
      teamMembers: inactiveDirectoryMembers,
    });
    assert.ok(linkedMember);

    const visible = resolveVisibleWorkloadEditors({
      isEditorOnly: true,
      teamMembers: inactiveDirectoryMembers,
      editors: editorsFixture,
      linkedEditorTeamMember: linkedMember,
      linkedEditorTeamMemberId: linkedMember.id,
    });

    assert.equal(visible.hasLinkedEditorProfile, true);
    assert.equal(visible.editors.length, 1);
    assert.equal(visible.editors[0].id, RIYA_MEMBER_ID);
    assert.equal(visible.editors[0].is_active, false);

    const roleDeliverables = filterWorkloadDeliverablesForRole({
      isEditorOnly: true,
      brandScopedDeliverables: deliverablesFixture,
      linkedEditorId: visible.linkedEditorId,
    });
    assert.equal(roleDeliverables.length, 3);
  });

  it('EditorsWorkloadView wires role-gating for unassigned banner, metrics, and unlinked empty state', () => {
    const viewSource = fs.readFileSync(
      path.resolve('src/components/team/EditorsWorkloadView.tsx'),
      'utf8'
    );

    assert.ok(viewSource.includes('isEditorOnly'));
    assert.ok(viewSource.includes('linkedEditorTeamMember'));
    assert.ok(viewSource.includes('linkedEditorTeamMemberId'));
    assert.ok(viewSource.includes('{!isEditorOnly && metrics.unassignedCount > 0'));
    assert.ok(viewSource.includes('No Linked Editor Profile Found'));
    assert.ok(viewSource.includes('!isEditorOnly && canOpenTeamMembers'));
  });
});
