import { normalizeUserRole } from '../lib/auth';
import { EditorAccountApiError } from '../services/editorAccounts';
import { EditorAccountStatusState, TeamMember } from '../types';
import { isDeliverableEditor } from './teamMemberFilters';

export type EditorPortalActionType =
  | 'invite'
  | 'resend'
  | 'disable_login'
  | 'enable_login';

export interface EditorAccountFeedback {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  memberId?: string;
  isResendUnsupported?: boolean;
}

export function canManageEditorAccounts(
  role: string | null | undefined
): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === 'Admin' || normalized === 'Manager';
}

export function isDirectoryMemberActive(member: TeamMember): boolean {
  return member.is_active !== false && member.status !== 'Inactive';
}

export function getEditorPortalAction(
  accountStatus: EditorAccountStatusState | undefined,
  canManage: boolean
): EditorPortalActionType | null {
  if (!canManage || !accountStatus) {
    return null;
  }

  switch (accountStatus) {
    case 'Not Invited':
      return 'invite';
    case 'Invitation Pending':
      return 'resend';
    case 'Login Active':
      return 'disable_login';
    case 'Login Disabled':
      return 'enable_login';
    default:
      return null;
  }
}

export function getInvitePrerequisiteIssue(member: TeamMember): string | null {
  if (!isDeliverableEditor(member)) {
    return 'This Team Member must include the Editor category before they can be invited to the Editor portal.';
  }
  if (!member.email || !member.email.trim()) {
    return 'Add a valid email address for this Team Member (via Edit) before sending a portal invitation.';
  }
  if (!isDirectoryMemberActive(member)) {
    return 'This Team Member is currently Inactive in the directory. Activate their directory record first before sending an initial invitation.';
  }
  return null;
}

export function buildLoginToggleRequest(
  teamMemberId: string,
  loginActive: boolean
): { teamMemberId: string; loginActive: boolean } {
  return {
    teamMemberId,
    loginActive,
  };
}

export function formatEditorAccountActionError(
  err: unknown,
  fallbackMessage: string
): Omit<EditorAccountFeedback, 'memberId'> {
  if (err instanceof EditorAccountApiError) {
    if (
      err.code === 'INVITE_RESEND_UNSUPPORTED' ||
      (err.status === 422 && err.details?.supported === false)
    ) {
      return {
        tone: 'warning',
        title: 'Automatic resend is unavailable',
        message:
          'Supabase cannot automatically resend an invitation without custom SMTP, and this system will never delete or recreate an existing account. Ask the Editor to check their original invite email or spam folder, or configure custom SMTP if automated resends are required.',
        isResendUnsupported: true,
      };
    }

    if (err.code === 'RETRY_RATE_LIMITED' || err.status === 429) {
      const waitSuffix =
        typeof err.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0
          ? ` Wait about ${err.retryAfterSeconds} seconds before retrying.`
          : '';
      return {
        tone: 'error',
        title: 'Request rate limited',
        message: `${err.message}${waitSuffix}`.trim(),
        isResendUnsupported: false,
      };
    }

    return {
      tone: 'error',
      title: 'Editor account update failed',
      message: err.message || fallbackMessage,
      isResendUnsupported: false,
    };
  }

  return {
    tone: 'error',
    title: 'Editor account update failed',
    message:
      err instanceof Error && err.message ? err.message : fallbackMessage,
    isResendUnsupported: false,
  };
}
