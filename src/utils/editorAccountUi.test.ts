import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorAccountApiError } from '../services/editorAccounts';
import { TeamMember } from '../types';
import {
  buildLoginToggleRequest,
  canManageEditorAccounts,
  formatEditorAccountActionError,
  getEditorPortalAction,
  getInvitePrerequisiteIssue,
  isDirectoryMemberActive,
} from './editorAccountUi';

function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Aarav Editor',
    email: 'aarav@example.com',
    phone: '9999999999',
    role_title: 'Lead Editor',
    categories: ['Editor'],
    is_active: true,
    status: 'Active',
    ...overrides,
  };
}

test('canManageEditorAccounts permits Admin and Manager only and denies Editor', () => {
  assert.equal(canManageEditorAccounts('Admin'), true);
  assert.equal(canManageEditorAccounts('Manager'), true);
  assert.equal(canManageEditorAccounts('admin'), true);
  assert.equal(canManageEditorAccounts('manager'), true);
  assert.equal(canManageEditorAccounts('Editor'), false);
  assert.equal(canManageEditorAccounts('editor'), false);
  assert.equal(canManageEditorAccounts('Team Member'), false);
  assert.equal(canManageEditorAccounts(null), false);
  assert.equal(canManageEditorAccounts(undefined), false);
});

test('getEditorPortalAction maps all four portal states for Admin/Manager and blocks unauthorized callers', () => {
  assert.equal(getEditorPortalAction('Not Invited', true), 'invite');
  assert.equal(getEditorPortalAction('Invitation Pending', true), 'resend');
  assert.equal(getEditorPortalAction('Login Active', true), 'disable_login');
  assert.equal(getEditorPortalAction('Login Disabled', true), 'enable_login');
  assert.equal(getEditorPortalAction(undefined, true), null);

  assert.equal(getEditorPortalAction('Not Invited', false), null);
  assert.equal(getEditorPortalAction('Login Active', false), null);
});

test('getInvitePrerequisiteIssue enforces Editor category, non-empty email, and Active directory status', () => {
  assert.equal(getInvitePrerequisiteIssue(makeMember()), null);

  assert.match(
    getInvitePrerequisiteIssue(makeMember({ categories: ['Photo'] })) || '',
    /Editor category/i
  );
  assert.match(
    getInvitePrerequisiteIssue(makeMember({ email: '   ' })) || '',
    /email address/i
  );
  assert.match(
    getInvitePrerequisiteIssue(
      makeMember({ is_active: false, status: 'Inactive' })
    ) || '',
    /Inactive/i
  );
});

test('buildLoginToggleRequest changes loginActive only and never passes teamMemberActive', () => {
  const disableReq = buildLoginToggleRequest('tm-1', false);
  assert.deepEqual(disableReq, { teamMemberId: 'tm-1', loginActive: false });
  assert.equal('teamMemberActive' in disableReq, false);

  const enableReq = buildLoginToggleRequest('tm-1', true);
  assert.deepEqual(enableReq, { teamMemberId: 'tm-1', loginActive: true });
  assert.equal('teamMemberActive' in enableReq, false);
});

test('isDirectoryMemberActive treats is_active=false or status=Inactive as inactive', () => {
  assert.equal(isDirectoryMemberActive(makeMember()), true);
  assert.equal(
    isDirectoryMemberActive(makeMember({ is_active: false, status: 'Active' })),
    false
  );
  assert.equal(
    isDirectoryMemberActive(makeMember({ is_active: true, status: 'Inactive' })),
    false
  );
});

test('formatEditorAccountActionError handles 422 INVITE_RESEND_UNSUPPORTED honestly without false success', () => {
  const err = new EditorAccountApiError(
    'Automatic invite resending is not supported without custom SMTP.',
    {
      code: 'INVITE_RESEND_UNSUPPORTED',
      status: 422,
      details: {
        supported: false,
        recoverable: true,
        account_status: 'Invitation Pending',
      },
    }
  );

  const formatted = formatEditorAccountActionError(err, 'Fallback error');
  assert.equal(formatted.tone, 'warning');
  assert.equal(formatted.isResendUnsupported, true);
  assert.match(formatted.title, /unavailable/i);
  assert.match(formatted.message, /custom SMTP/i);
  assert.match(formatted.message, /never delete or recreate/i);
});

test('formatEditorAccountActionError formats rate limits and generic errors', () => {
  const rateLimited = new EditorAccountApiError('Too many requests.', {
    code: 'RETRY_RATE_LIMITED',
    status: 429,
    details: { retry_after_seconds: 12 },
  });
  const formattedRate = formatEditorAccountActionError(
    rateLimited,
    'Fallback'
  );
  assert.equal(formattedRate.tone, 'error');
  assert.equal(formattedRate.isResendUnsupported, false);
  assert.match(formattedRate.message, /12 seconds/);

  const unknownErr = formatEditorAccountActionError(
    new Error('Network timeout'),
    'Fallback'
  );
  assert.equal(unknownErr.tone, 'error');
  assert.equal(unknownErr.message, 'Network timeout');
});
