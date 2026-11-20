import { Deliverable, Editor, TeamMember } from '../types';
import { resolveEffectiveLinkedEditorId } from './deliverablePermissions';
import { isDeliverableEditor } from './teamMemberFilters';

export interface UnifiedEditorInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  is_active: boolean;
  effectiveCapacity: number;
  notes?: string;
}

export interface EditorWorkloadStats {
  activeDeliverables: Deliverable[];
  completedDeliverables: Deliverable[];
  totalActiveCount: number;
  utilizationPercent: number;
  earliestActiveAssignmentDate: string | null;
  latestActiveAssignmentDate: string | null;
}

export interface EditorsWorkloadSummaryMetrics {
  activeEditorsCount: number;
  totalEditorsCount: number;
  totalActiveDeliverables: number;
  totalCompletedDeliverables: number;
  atOrOverCapacityCount: number;
  unassignedCount: number;
}

export interface VisibleWorkloadEditorsResult {
  editors: UnifiedEditorInfo[];
  linkedEditorId: string | null;
  hasLinkedEditorProfile: boolean;
}

/**
 * Resolves the editors visible in Editors & Workload for the current role:
 * - Admin / Manager (`isEditorOnly === false`): compiles all editors from `teamMembers` and `editors`
 *   using the existing roster logic without modification.
 * - Editor (`isEditorOnly === true`): resolves strictly to the single linked Team Member card via
 *   `linkedEditorTeamMember` and `linkedEditorTeamMemberId` (`team_members.profile_id === currentUser.id`).
 *   Uses exact ID matching only (never email, name, or role_title fallback) and preserves visibility
 *   when the linked Team Member directory record is inactive (`is_active === false` / `status === 'Inactive'`).
 */
export function resolveVisibleWorkloadEditors(params: {
  isEditorOnly: boolean;
  teamMembers: readonly TeamMember[];
  editors: readonly Editor[];
  linkedEditorTeamMember?: TeamMember | null;
  linkedEditorTeamMemberId?: string | null;
}): VisibleWorkloadEditorsResult {
  const {
    isEditorOnly,
    teamMembers,
    editors,
    linkedEditorTeamMember,
    linkedEditorTeamMemberId,
  } = params;

  if (isEditorOnly) {
    const effectiveLinkedId = resolveEffectiveLinkedEditorId({
      linkedEditorTeamMember,
      linkedEditorTeamMemberId,
    });

    if (!effectiveLinkedId || !linkedEditorTeamMember) {
      return {
        editors: [],
        linkedEditorId: null,
        hasLinkedEditorProfile: false,
      };
    }

    // Exact ID match only for capacity/specialization metadata; never match by email or name.
    const matchingEd = Array.isArray(editors)
      ? editors.find(e => typeof e.id === 'string' && e.id.trim() === effectiveLinkedId)
      : undefined;

    const effectiveCap =
      matchingEd?.max_active_deliverables ||
      matchingEd?.max_concurrent_projects ||
      4;

    const ownEditor: UnifiedEditorInfo = {
      id: effectiveLinkedId,
      name: linkedEditorTeamMember.name,
      email: linkedEditorTeamMember.email || '',
      phone: linkedEditorTeamMember.phone || '',
      specialization:
        linkedEditorTeamMember.role_title ||
        matchingEd?.specialization ||
        'Post-Production Editor',
      is_active:
        linkedEditorTeamMember.status !== 'Inactive' &&
        linkedEditorTeamMember.is_active !== false,
      effectiveCapacity: effectiveCap,
      notes: linkedEditorTeamMember.notes || matchingEd?.notes || '',
    };

    return {
      editors: [ownEditor],
      linkedEditorId: effectiveLinkedId,
      hasLinkedEditorProfile: true,
    };
  }

  const map = new Map<string, UnifiedEditorInfo>();

  // 1. From teamMembers with category 'Editor' or role/title containing 'Editor'
  if (Array.isArray(teamMembers)) {
    teamMembers.forEach(tm => {
      const isEditorCategory = isDeliverableEditor(tm);
      const isEditorTitle =
        (!tm.categories || tm.categories.length === 0) &&
        ((tm.role_title && tm.role_title.toLowerCase().includes('editor')) ||
          tm.role === 'Editor');

      if (isEditorCategory || isEditorTitle) {
        const matchingEd = Array.isArray(editors)
          ? editors.find(e => e.id === tm.id || e.email === tm.email)
          : undefined;
        const effectiveCap =
          matchingEd?.max_active_deliverables ||
          matchingEd?.max_concurrent_projects ||
          4;

        map.set(tm.id, {
          id: tm.id,
          name: tm.name,
          email: tm.email || '',
          phone: tm.phone || '',
          specialization: tm.role_title || matchingEd?.specialization || 'Post-Production Editor',
          is_active: tm.status !== 'Inactive' && tm.is_active !== false,
          effectiveCapacity: effectiveCap,
          notes: tm.notes || matchingEd?.notes || '',
        });
      }
    });
  }

  // 2. From editors in AppContext (only include if matched to a real team member or non-placeholder)
  if (Array.isArray(editors)) {
    editors.forEach(ed => {
      const isFictional = ed.email?.endsWith('.internal') || ed.phone?.includes('555-01');
      const matchingTm = Array.isArray(teamMembers)
        ? teamMembers.find(m => m.id === ed.id || m.email === ed.email)
        : undefined;

      // In connected studio, do not inject fictional demo editors
      if (!isFictional || matchingTm) {
        if (!map.has(ed.id)) {
          const effectiveCap = ed.max_active_deliverables || ed.max_concurrent_projects || 4;
          map.set(ed.id, {
            id: ed.id,
            name: ed.name,
            email: ed.email || matchingTm?.email || '',
            phone: ed.phone || matchingTm?.phone || '',
            specialization: ed.specialization || matchingTm?.role_title || 'Post-Production Editor',
            is_active: ed.is_active !== false,
            effectiveCapacity: effectiveCap,
            notes: ed.notes || '',
          });
        }
      }
    });
  }

  return {
    editors: Array.from(map.values()),
    linkedEditorId: null,
    hasLinkedEditorProfile: true,
  };
}

/**
 * Filters already-brand-scoped deliverables for the current role in Editors & Workload.
 * - Admin / Manager: sees all brand-scoped deliverables.
 * - Editor: sees strictly deliverables assigned to their verified `linkedEditorId` (exact ID match).
 */
export function filterWorkloadDeliverablesForRole(params: {
  isEditorOnly: boolean;
  brandScopedDeliverables: readonly Deliverable[];
  linkedEditorId: string | null;
}): Deliverable[] {
  const { isEditorOnly, brandScopedDeliverables, linkedEditorId } = params;
  if (!Array.isArray(brandScopedDeliverables)) return [];

  if (!isEditorOnly) {
    return [...brandScopedDeliverables];
  }

  if (!linkedEditorId) {
    return [];
  }

  return brandScopedDeliverables.filter(
    del =>
      typeof del.assigned_editor_id === 'string' &&
      del.assigned_editor_id.trim() === linkedEditorId
  );
}

/**
 * Computes per-editor workload stats (active deliverables, delivered deliverables,
 * capacity utilization %, and earliest/latest active assignment dates).
 */
export function buildEditorWorkloadMap(
  visibleEditors: readonly UnifiedEditorInfo[],
  roleScopedDeliverables: readonly Deliverable[]
): Map<string, EditorWorkloadStats> {
  const result = new Map<string, EditorWorkloadStats>();

  visibleEditors.forEach(ed => {
    const assigned = roleScopedDeliverables.filter(
      d => typeof d.assigned_editor_id === 'string' && d.assigned_editor_id.trim() === ed.id
    );
    const active = assigned.filter(d => d.status !== 'Delivered');
    const completed = assigned.filter(d => d.status === 'Delivered');
    const cap = Math.max(1, ed.effectiveCapacity);
    const percent = Math.round((active.length / cap) * 100);

    let earliest: string | null = null;
    let latest: string | null = null;
    active.forEach(d => {
      const dateVal = d.assigned_at || d.last_updated;
      if (dateVal) {
        if (!earliest || dateVal < earliest) earliest = dateVal;
        if (!latest || dateVal > latest) latest = dateVal;
      }
    });

    result.set(ed.id, {
      activeDeliverables: active,
      completedDeliverables: completed,
      totalActiveCount: active.length,
      utilizationPercent: percent,
      earliestActiveAssignmentDate: earliest,
      latestActiveAssignmentDate: latest,
    });
  });

  return result;
}

/**
 * Computes summary metrics scoped strictly to the visible editors and deliverables for the role.
 * `unassignedCount` is always forced to 0 for Editors so unassigned studio counts are never leaked.
 */
export function computeWorkloadSummaryMetrics(params: {
  isEditorOnly: boolean;
  visibleEditors: readonly UnifiedEditorInfo[];
  roleScopedDeliverables: readonly Deliverable[];
  editorWorkloadMap: ReadonlyMap<string, EditorWorkloadStats>;
}): EditorsWorkloadSummaryMetrics {
  const { isEditorOnly, visibleEditors, roleScopedDeliverables, editorWorkloadMap } = params;

  const activeEditors = visibleEditors.filter(e => e.is_active);
  const totalActiveDels = roleScopedDeliverables.filter(d => d.status !== 'Delivered');
  const totalCompletedDels = roleScopedDeliverables.filter(d => d.status === 'Delivered');

  const atOrOverCapacityCount = visibleEditors.filter(ed => {
    const stats = editorWorkloadMap.get(ed.id);
    const activeCnt = stats?.totalActiveCount || 0;
    return activeCnt >= ed.effectiveCapacity;
  }).length;

  const unassignedCount = isEditorOnly
    ? 0
    : roleScopedDeliverables.filter(
        d => (!d.assigned_editor_id || d.assigned_editor_id.trim() === '') && d.status !== 'Delivered'
      ).length;

  return {
    activeEditorsCount: activeEditors.length,
    totalEditorsCount: visibleEditors.length,
    totalActiveDeliverables: totalActiveDels.length,
    totalCompletedDeliverables: totalCompletedDels.length,
    atOrOverCapacityCount,
    unassignedCount,
  };
}
