import { resolveVerifiedUserRole } from '../lib/auth';
import {
  Deliverable,
  DeliverableStatus,
  Profile,
  TeamMember,
  UserRole,
} from '../types';
import {
  DELIVERABLE_WORKFLOW_STATUSES,
  ValidDeliverableStatus,
  isValidDeliverableStatus,
} from './deliverableMilestones';

/**
 * Authoritative Stage 2B.3B Deliverable Permissions Policy
 *
 * - Admin & Manager: Full deliverable access (create, edit all fields, assign, change status, delete).
 * - Editor:
 *   - View ALL deliverables matching the brand (assigned to anyone, unassigned, or when unlinked).
 *   - Edit ONLY deliverables assigned to their own active linked TeamMember record (`assigned_editor_id === linkedEditorTeamMemberId`).
 *   - Ownership is established exclusively via `team_members.profile_id === currentUser.id` (never email or name matching).
 *   - Editable fields for Editor: `status` (ALL 7 canonical workflow statuses) and `external_link` ONLY.
 */

export const EDITOR_ALLOWED_DELIVERABLE_STATUSES: readonly ValidDeliverableStatus[] = [
  ...DELIVERABLE_WORKFLOW_STATUSES,
];

export const EDITOR_EDITABLE_DELIVERABLE_FIELDS = ['status', 'external_link'] as const;
export type EditorEditableDeliverableField = (typeof EDITOR_EDITABLE_DELIVERABLE_FIELDS)[number];

export const PROTECTED_DELIVERABLE_FIELDS = [
  'id',
  'project_id',
  'company_id',
  'name',
  'deliverable_type',
  'assigned_editor_id',
  'due_date',
  'priority',
  'notes',
  'client_feedback',
  'review_status',
  'assigned_at',
  'first_submitted_at',
  'delivered_at',
  'last_updated',
  'created_at',
  'updated_at',
] as const;

export interface DeliverablePermissionContext {
  role?: UserRole | string | null;
  deliverable?: Pick<Deliverable, 'id' | 'assigned_editor_id'> | null;
  linkedEditorTeamMemberId?: string | null;
  linkedEditorTeamMember?: TeamMember | null;
  isUserActive?: boolean;
}

export interface EditorDeliverablePatch {
  status?: ValidDeliverableStatus;
  external_link?: string | null;
}

export interface DeliverableFieldValidationResult {
  allowed: boolean;
  reason?: string;
  normalizedRole: UserRole | null;
  sanitizedEditorPatch?: EditorDeliverablePatch;
}

const isUserProfileActive = (profile?: Profile | null): boolean => {
  if (!profile) return false;
  if (profile.is_active === false) return false;
  if (
    typeof profile.status === 'string' &&
    profile.status.trim().toLowerCase() === 'inactive'
  ) {
    return false;
  }
  return true;
};

const hasDeliverableEditorCategory = (member?: TeamMember | null): boolean => {
  if (!member) return false;
  if (Array.isArray(member.categories)) {
    return member.categories.some(
      cat => typeof cat === 'string' && cat.trim().toLowerCase() === 'editor'
    );
  }
  return typeof member.role === 'string' && member.role.trim().toLowerCase() === 'editor';
};

/**
 * Checks whether a TeamMember directory record is marked Active.
 * Used for directory/new-assignment eligibility, NOT for blocking an existing
 * portal-active Editor from their assigned deliverables.
 */
export function isActiveDeliverableTeamMember(member?: TeamMember | null): boolean {
  if (!member || typeof member.id !== 'string' || !member.id.trim()) {
    return false;
  }
  const rawActive = (member as TeamMember & { active?: unknown }).active;
  if (rawActive === false) return false;
  if (member.is_active === false) return false;
  if (
    typeof member.status === 'string' &&
    member.status.trim().toLowerCase() === 'inactive'
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the authoritative linked TeamMember record for an Editor profile.
 * Strictly uses `team_members.profile_id === currentUser.id` with a unique Editor-category match.
 * Team Member directory activity (`active`/`is_active`/`status`) is independent of portal login
 * activity (`profiles.is_active`), so an inactive Team Member with an active Editor profile retains
 * access to existing assigned deliverables. Never falls back to email or display-name matching.
 */
export function resolveLinkedEditorTeamMember(params: {
  currentUser: Profile | null | undefined;
  profileVerificationState?: 'idle' | 'verified' | 'temporary_error';
  teamMembers: readonly TeamMember[];
}): TeamMember | null {
  const { currentUser, profileVerificationState, teamMembers } = params;

  if (!currentUser || typeof currentUser.id !== 'string' || !currentUser.id.trim()) {
    return null;
  }
  if (profileVerificationState && profileVerificationState !== 'verified') {
    return null;
  }
  if (!isUserProfileActive(currentUser)) {
    return null;
  }
  if (resolveVerifiedUserRole(currentUser.role) !== 'Editor') {
    return null;
  }

  const userId = currentUser.id.trim();
  const matches = teamMembers.filter(
    member =>
      typeof member.id === 'string' &&
      member.id.trim().length > 0 &&
      typeof member.profile_id === 'string' &&
      member.profile_id.trim() === userId &&
      hasDeliverableEditorCategory(member)
  );

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}

/**
 * Resolves the effective linked TeamMember ID when `linkedEditorTeamMember`
 * and/or `linkedEditorTeamMemberId` are supplied. Fails closed on missing,
 * non-Editor-category, or conflicting identities (directory activity is independent).
 */
export function resolveEffectiveLinkedEditorId(params: {
  linkedEditorTeamMemberId?: string | null;
  linkedEditorTeamMember?: TeamMember | null;
}): string | null {
  const { linkedEditorTeamMemberId, linkedEditorTeamMember } = params;
  const trimmedId =
    typeof linkedEditorTeamMemberId === 'string' ? linkedEditorTeamMemberId.trim() : '';

  if (linkedEditorTeamMember !== undefined) {
    if (
      !linkedEditorTeamMember ||
      typeof linkedEditorTeamMember.id !== 'string' ||
      !linkedEditorTeamMember.id.trim() ||
      !hasDeliverableEditorCategory(linkedEditorTeamMember)
    ) {
      return null;
    }
    const memberId = linkedEditorTeamMember.id.trim();
    if (trimmedId && trimmedId !== memberId) {
      return null;
    }
    return memberId;
  }

  return trimmedId || null;
}

/**
 * Visibility helper — keeps Deliverables list visibility distinct from row editing.
 * Admin, Manager, and Editor (linked or unlinked) can view all brand-filtered deliverables.
 */
export function canViewDeliverables(role?: UserRole | string | null): boolean {
  return resolveVerifiedUserRole(role) !== null;
}

/**
 * Whether the role has full administrative/managerial deliverable privileges.
 */
export function canManageAllDeliverables(
  role?: UserRole | string | null,
  isUserActive: boolean = true
): boolean {
  if (!isUserActive) return false;
  const normalized = resolveVerifiedUserRole(role);
  return normalized === 'Admin' || normalized === 'Manager';
}

export function canCreateDeliverable(
  role?: UserRole | string | null,
  isUserActive: boolean = true
): boolean {
  return canManageAllDeliverables(role, isUserActive);
}

export function canDeleteDeliverable(
  role?: UserRole | string | null,
  isUserActive: boolean = true
): boolean {
  return canManageAllDeliverables(role, isUserActive);
}

/**
 * Ownership check — returns true iff the deliverable is explicitly assigned to the
 * active linked TeamMember record (`deliverable.assigned_editor_id === linkedEditorTeamMemberId`).
 * Unassigned deliverables and unlinked/inactive/conflicting identities always return false.
 */
export function isDeliverableOwnedByEditor(params: {
  deliverable?: Pick<Deliverable, 'assigned_editor_id'> | null;
  linkedEditorTeamMemberId?: string | null;
  linkedEditorTeamMember?: TeamMember | null;
}): boolean {
  const { deliverable, linkedEditorTeamMemberId, linkedEditorTeamMember } = params;
  if (!deliverable) return false;

  const assignedEditorId =
    typeof deliverable.assigned_editor_id === 'string'
      ? deliverable.assigned_editor_id.trim()
      : '';
  if (!assignedEditorId) return false;

  const resolvedEditorId = resolveEffectiveLinkedEditorId({
    linkedEditorTeamMemberId,
    linkedEditorTeamMember,
  });
  if (!resolvedEditorId) return false;

  return assignedEditorId === resolvedEditorId;
}

/**
 * Whether the user is allowed to edit the given deliverable at all.
 * - Admin / Manager: true for any deliverable when active.
 * - Editor: true ONLY when owned by their active linked TeamMember record.
 * - Unlinked Editor / inactive / unknown / legacy role: false.
 */
export function canEditDeliverable(params: DeliverablePermissionContext): boolean {
  const { role, deliverable, isUserActive = true } = params;
  if (!isUserActive || !deliverable) return false;

  const normalizedRole = resolveVerifiedUserRole(role);
  if (!normalizedRole) return false;

  if (normalizedRole === 'Admin' || normalizedRole === 'Manager') {
    return true;
  }

  if (normalizedRole === 'Editor') {
    return isDeliverableOwnedByEditor(params);
  }

  return false;
}

/**
 * Whether the user is allowed to transition the given deliverable to `status`.
 * Authoritative rule: when an Editor can edit their own assigned deliverable,
 * ALL 7 canonical workflow statuses are permitted.
 */
export function canSetDeliverableStatus(
  params: DeliverablePermissionContext & {
    status?: DeliverableStatus | string | null;
  }
): boolean {
  if (!canEditDeliverable(params)) return false;

  const rawStatus = typeof params.status === 'string' ? params.status.trim() : '';
  if (!rawStatus) return false;

  return (EDITOR_ALLOWED_DELIVERABLE_STATUSES as readonly string[]).includes(rawStatus);
}

/**
 * Returns the exact list of workflow statuses the user may select for a deliverable.
 * Returns all 7 canonical statuses when `canEditDeliverable` passes, otherwise `[]`.
 */
export function getAllowedDeliverableStatusesForUser(
  params: DeliverablePermissionContext
): ValidDeliverableStatus[] {
  if (!canEditDeliverable(params)) return [];
  return [...EDITOR_ALLOWED_DELIVERABLE_STATUSES];
}

/**
 * Validates deliverable update fields for the given role and target deliverable.
 * - Admin & Manager: allowed to update full deliverable fields (validating non-blank status if supplied).
 * - Editor:
 *   - Must own the deliverable via active linked `team_members.profile_id === currentUser.id`.
 *   - Must contain at least one allowed field (`status` or `external_link`).
 *   - Rejects any attempt to modify protected fields (`project_id`, `company_id`, `name`,
 *     `deliverable_type`, `assigned_editor_id`, `due_date`, `priority`, `notes`,
 *     `client_feedback`, `assigned_at`, `first_submitted_at`, `delivered_at`, etc.).
 *   - Accepts ALL 7 canonical workflow statuses when `status` is supplied.
 */
export function validateDeliverableUpdateFields(
  params: DeliverablePermissionContext & {
    updatedFields: Record<string, unknown> | null | undefined;
  }
): DeliverableFieldValidationResult {
  const {
    role,
    deliverable,
    updatedFields,
    linkedEditorTeamMemberId,
    linkedEditorTeamMember,
    isUserActive = true,
  } = params;

  const normalizedRole = resolveVerifiedUserRole(role);

  if (!isUserActive) {
    return {
      allowed: false,
      reason: 'User account is inactive and cannot modify deliverables.',
      normalizedRole,
    };
  }

  if (!normalizedRole) {
    return {
      allowed: false,
      reason: 'User role is missing or unauthorized to modify deliverables.',
      normalizedRole: null,
    };
  }

  if (!deliverable) {
    return {
      allowed: false,
      reason: 'Target deliverable could not be verified.',
      normalizedRole,
    };
  }

  if (!updatedFields || typeof updatedFields !== 'object' || Array.isArray(updatedFields)) {
    return {
      allowed: false,
      reason: 'Deliverable update payload must be an object.',
      normalizedRole,
    };
  }

  if (normalizedRole === 'Admin' || normalizedRole === 'Manager') {
    if (Object.prototype.hasOwnProperty.call(updatedFields, 'status')) {
      const rawStatus = updatedFields.status;
      if (rawStatus !== undefined) {
        if (typeof rawStatus !== 'string') {
          return {
            allowed: false,
            reason: 'Deliverable status must be a valid workflow status string.',
            normalizedRole,
          };
        }
        const trimmedStatus = rawStatus.trim();
        if (trimmedStatus && !isValidDeliverableStatus(trimmedStatus)) {
          return {
            allowed: false,
            reason: `Invalid deliverable status "${rawStatus}". Allowed values: ${DELIVERABLE_WORKFLOW_STATUSES.join(', ')}.`,
            normalizedRole,
          };
        }
      }
    }

    return {
      allowed: true,
      normalizedRole,
    };
  }

  // Editor validation
  if (!isDeliverableOwnedByEditor({ deliverable, linkedEditorTeamMemberId, linkedEditorTeamMember })) {
    return {
      allowed: false,
      reason:
        'Editors can only update deliverables assigned to their own linked team member record.',
      normalizedRole,
    };
  }

  const definedEntries = Object.entries(updatedFields).filter(
    ([, value]) => value !== undefined
  );

  if (definedEntries.length === 0) {
    return {
      allowed: false,
      reason: 'No deliverable fields were provided for update.',
      normalizedRole,
    };
  }

  const allowedKeySet = new Set<string>(EDITOR_EDITABLE_DELIVERABLE_FIELDS);
  for (const [key] of definedEntries) {
    if (!allowedKeySet.has(key)) {
      return {
        allowed: false,
        reason: `Editors cannot modify protected deliverable field "${key}". Only status and external_link may be updated.`,
        normalizedRole,
      };
    }
  }

  const sanitizedEditorPatch: EditorDeliverablePatch = {};

  if (Object.prototype.hasOwnProperty.call(updatedFields, 'status') && updatedFields.status !== undefined) {
    const rawStatus = updatedFields.status;
    if (typeof rawStatus !== 'string') {
      return {
        allowed: false,
        reason: 'Deliverable status must be a valid workflow status string.',
        normalizedRole,
      };
    }
    const trimmedStatus = rawStatus.trim();
    if (
      !trimmedStatus ||
      !(EDITOR_ALLOWED_DELIVERABLE_STATUSES as readonly string[]).includes(trimmedStatus)
    ) {
      return {
        allowed: false,
        reason: `Invalid deliverable status "${rawStatus}". Allowed values: ${EDITOR_ALLOWED_DELIVERABLE_STATUSES.join(', ')}.`,
        normalizedRole,
      };
    }
    sanitizedEditorPatch.status = trimmedStatus as ValidDeliverableStatus;
  }

  if (
    Object.prototype.hasOwnProperty.call(updatedFields, 'external_link') &&
    updatedFields.external_link !== undefined
  ) {
    const rawLink = updatedFields.external_link;
    if (rawLink === null) {
      sanitizedEditorPatch.external_link = null;
    } else if (typeof rawLink === 'string') {
      const trimmedLink = rawLink.trim();
      sanitizedEditorPatch.external_link = trimmedLink || null;
    } else {
      return {
        allowed: false,
        reason: 'External link must be a string or null.',
        normalizedRole,
      };
    }
  }

  if (
    sanitizedEditorPatch.status === undefined &&
    sanitizedEditorPatch.external_link === undefined
  ) {
    return {
      allowed: false,
      reason: 'No valid editable deliverable fields were provided.',
      normalizedRole,
    };
  }

  return {
    allowed: true,
    normalizedRole,
    sanitizedEditorPatch,
  };
}

const normalizeComparableText = (value?: string | null): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Extracts Editor-editable changes (`status` and `external_link`) between an existing
 * Deliverable baseline and a candidate Deliverable object, while reporting any protected
 * fields that differ between the two records.
 */
export function extractEditorDeliverableChanges(
  existing: Deliverable,
  candidate: Deliverable
): {
  changes: EditorDeliverablePatch;
  disallowedFields: string[];
} {
  const disallowedFields: string[] = [];

  if (existing.id !== candidate.id) disallowedFields.push('id');
  if ((existing.project_id || '') !== (candidate.project_id || '')) {
    disallowedFields.push('project_id');
  }
  if ((existing.company_id || '') !== (candidate.company_id || '')) {
    disallowedFields.push('company_id');
  }
  if (normalizeComparableText(existing.deliverable_type) !== normalizeComparableText(candidate.deliverable_type)) {
    disallowedFields.push('deliverable_type');
  }
  if (normalizeComparableText(existing.assigned_editor_id) !== normalizeComparableText(candidate.assigned_editor_id)) {
    disallowedFields.push('assigned_editor_id');
  }
  if (normalizeComparableText(existing.due_date) !== normalizeComparableText(candidate.due_date)) {
    disallowedFields.push('due_date');
  }
  if ((existing.priority || 'Medium') !== (candidate.priority || 'Medium')) {
    disallowedFields.push('priority');
  }
  if (normalizeComparableText(existing.notes) !== normalizeComparableText(candidate.notes)) {
    disallowedFields.push('notes');
  }
  if (normalizeComparableText(existing.client_feedback) !== normalizeComparableText(candidate.client_feedback)) {
    disallowedFields.push('client_feedback');
  }
  if (normalizeComparableText(existing.review_status) !== normalizeComparableText(candidate.review_status)) {
    disallowedFields.push('review_status');
  }
  if (normalizeComparableText(existing.assigned_at) !== normalizeComparableText(candidate.assigned_at)) {
    disallowedFields.push('assigned_at');
  }
  if (
    normalizeComparableText(existing.first_submitted_at) !==
    normalizeComparableText(candidate.first_submitted_at)
  ) {
    disallowedFields.push('first_submitted_at');
  }
  if (normalizeComparableText(existing.delivered_at) !== normalizeComparableText(candidate.delivered_at)) {
    disallowedFields.push('delivered_at');
  }

  const changes: EditorDeliverablePatch = {};
  if (normalizeComparableText(existing.status) !== normalizeComparableText(candidate.status)) {
    const trimmedStatus = normalizeComparableText(candidate.status);
    if (trimmedStatus && isValidDeliverableStatus(trimmedStatus)) {
      changes.status = trimmedStatus;
    } else if (candidate.status !== existing.status) {
      disallowedFields.push('status');
    }
  }

  if (normalizeComparableText(existing.external_link) !== normalizeComparableText(candidate.external_link)) {
    changes.external_link = normalizeComparableText(candidate.external_link) || null;
  }

  return { changes, disallowedFields };
}
