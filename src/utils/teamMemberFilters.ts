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

/**
 * Checks whether a team member is an active/eligible production team member.
 * Preserves existing active/inactive eligibility rules:
 * - status !== 'Inactive'
 * - is_active !== false
 */
export function isEligibleProductionTeamMember(
  member?: Partial<TeamMember> | null
): boolean {
  if (!member) return false;
  if (member.status === 'Inactive' || member.is_active === false) return false;
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
  return member.categories.includes(EDITOR_CATEGORY);
}

/**
 * Checks whether a team member is an active/eligible deliverable editor.
 * Preserves existing active/inactive eligibility rules:
 * - status !== 'Inactive'
 * - is_active !== false
 */
export function isEligibleDeliverableEditor(
  member?: Partial<TeamMember> | null
): boolean {
  if (!member) return false;
  if (member.status === 'Inactive' || member.is_active === false) return false;
  return isDeliverableEditor(member);
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
