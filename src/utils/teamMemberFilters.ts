import { TeamMember, TeamMemberCategory } from '../types';

/**
 * Production categories eligible for Team Availability & Project Crew assignment.
 * A team member must have at least one of these categories to appear.
 */
export const PRODUCTION_CATEGORIES: TeamMemberCategory[] = [
  'Photo',
  'Video',
  'Same Day',
  'Drone',
  'Other',
];

export const EDITOR_CATEGORY: TeamMemberCategory = 'Editor';

/**
 * Checks whether a team member qualifies for production team assignments.
 * Rules:
 * - Must have at least one production category: Photo, Video, Same Day, Drone, or Other.
 * - Excludes members tagged only 'Editor' (or having no categories).
 * - Multi-category members with Editor + any production category (e.g. Editor + Video + Same Day) are included.
 */
export function isProductionTeamMember(
  member?: Partial<TeamMember> | null
): boolean {
  if (!member || !Array.isArray(member.categories)) return false;
  return member.categories.some(cat => PRODUCTION_CATEGORIES.includes(cat));
}

export function isActiveTeamMemberDirectoryRecord(
  member?: (Partial<TeamMember> & { active?: unknown }) | null
): boolean {
  if (!member) return false;
  if (member.active === false) return false;
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
 * Checks whether a team member is an active/eligible production team member.
 * Preserves existing active/inactive eligibility rules:
 * - status !== 'Inactive' (case-insensitive)
 * - active !== false and is_active !== false
 */
export function isEligibleProductionTeamMember(
  member?: (Partial<TeamMember> & { active?: unknown }) | null
): boolean {
  if (!isActiveTeamMemberDirectoryRecord(member)) return false;
  return isProductionTeamMember(member);
}

/**
 * Checks whether a team member qualifies for deliverable editor assignments.
 * Rules:
 * - Must have 'Editor' in categories.
 * - Excludes members who do not have the 'Editor' category, even if they have Photo, Video, Same Day, Drone, or Other.
 * - Multi-category members that include 'Editor' remain eligible.
 */
export function isDeliverableEditor(
  member?: Partial<TeamMember> | null
): boolean {
  if (!member || !Array.isArray(member.categories)) return false;
  return member.categories.some(
    cat => typeof cat === 'string' && cat.trim().toLowerCase() === 'editor'
  );
}

/**
 * Checks whether a team member is an active/eligible deliverable editor.
 * Preserves existing active/inactive eligibility rules:
 * - status !== 'Inactive' (case-insensitive)
 * - active !== false and is_active !== false
 */
export function isEligibleDeliverableEditor(
  member?: (Partial<TeamMember> & { active?: unknown }) | null
): boolean {
  if (!isActiveTeamMemberDirectoryRecord(member)) return false;
  return isDeliverableEditor(member);
}

export interface DeliverableEditorAssignmentValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether `targetEditorId` can be assigned on a deliverable create or update.
 * - Unassigned (`null`, `undefined`, or `''`) is always valid.
 * - Preserving an unchanged `assigned_editor_id` (`targetEditorId === previousEditorId`) is valid
 *   so existing assignments to later-deactivated Team Members remain intact on non-reassignment edits.
 * - New assignments (create, or update changing `assigned_editor_id`) require an active Team Member
 *   with the `Editor` category.
 */
export function validateDeliverableEditorAssignment(params: {
  targetEditorId?: string | null;
  previousEditorId?: string | null;
  targetMember?: (Partial<TeamMember> & { active?: unknown }) | null;
  teamMembers?: readonly (TeamMember & { active?: unknown })[];
}): DeliverableEditorAssignmentValidationResult {
  const cleanTargetId =
    typeof params.targetEditorId === 'string' ? params.targetEditorId.trim() : '';
  if (!cleanTargetId) {
    return { valid: true };
  }

  const cleanPreviousId =
    typeof params.previousEditorId === 'string' ? params.previousEditorId.trim() : '';
  if (cleanPreviousId && cleanTargetId === cleanPreviousId) {
    return { valid: true };
  }

  const resolvedMember =
    params.targetMember !== undefined
      ? params.targetMember
      : params.teamMembers?.find(member => member.id === cleanTargetId) ?? null;

  if (!resolvedMember) {
    return {
      valid: false,
      reason: 'Assigned editor team member record was not found.',
    };
  }

  if (!isActiveTeamMemberDirectoryRecord(resolvedMember)) {
    return {
      valid: false,
      reason:
        'Inactive team members cannot be assigned to new or reassigned deliverables.',
    };
  }

  if (!isDeliverableEditor(resolvedMember)) {
    return {
      valid: false,
      reason: 'Selected team member does not include the Editor category.',
    };
  }

  return { valid: true };
}

/**
 * Filters a list of team members for production team assignment (Team Availability and Project Crew).
 * - Returns only active members with at least one production category (Photo, Video, Same Day, Drone, Other).
 * - Excludes editor-only members.
 * - If currentMemberId is provided (e.g. editing an existing assignment), ensures that member remains in the list.
 */
export function filterProductionTeamMembers(
  teamMembers: TeamMember[],
  options?: { currentMemberId?: string }
): TeamMember[] {
  if (!Array.isArray(teamMembers)) return [];
  return teamMembers
    .filter(member => {
      if (options?.currentMemberId && member.id === options.currentMemberId) {
        return true;
      }
      return isEligibleProductionTeamMember(member);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filters a list of team members for deliverable editor assignment.
 * - Returns only active members with 'Editor' category.
 * - Excludes members without 'Editor' category.
 * - If currentEditorId is provided (e.g. editing an existing deliverable), ensures that editor remains in the list.
 */
export function filterDeliverableEditors(
  teamMembers: TeamMember[],
  options?: { currentEditorId?: string }
): TeamMember[] {
  if (!Array.isArray(teamMembers)) return [];
  return teamMembers
    .filter(member => {
      if (options?.currentEditorId && member.id === options.currentEditorId) {
        return true;
      }
      return isEligibleDeliverableEditor(member);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
