import assert from 'node:assert/strict';
import test from 'node:test';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  completeInvitePasswordSetup,
  EDITOR_ACCOUNT_FUNCTION_NAME,
  EditorAccountApiError,
  getEditorAccountStatus,
  getEditorAccountStatuses,
  inviteEditor,
  resendEditorInvite,
  resolveSafeInviteRedirectTo,
  setEditorAccountActive,
} from '../services/editorAccounts';

interface RecordedInvoke {
  fnName: string;
  body: Record<string, unknown>;
}

function createMockSupabaseClient(
  handler: (
    fnName: string,
    options?: { body?: Record<string, unknown> }
  ) => Promise<{ data: unknown; error: unknown }>
): { client: SupabaseClient; calls: RecordedInvoke[] } {
  const calls: RecordedInvoke[] = [];
  const client = {
    functions: {
      invoke: async (
        fnName: string,
        options?: { body?: Record<string, unknown> }
      ) => {
        calls.push({ fnName, body: options?.body ?? {} });
        return handler(fnName, options);
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test('resolveSafeInviteRedirectTo rejects ais-dev-* origins and non-HTTPS URLs', () => {
  assert.equal(
    resolveSafeInviteRedirectTo(
      'https://ais-dev-gbwhagdl3bssyloecoydt5-2401289148.asia-east1.run.app'
    ),
    undefined
  );
  assert.equal(
    resolveSafeInviteRedirectTo('http://portal.example.com/invite'),
    undefined
  );
  assert.equal(
    resolveSafeInviteRedirectTo(
      'https://ais-pre-gbwhagdl3bssyloecoydt5-2401289148.asia-east1.run.app/#hash-ignored'
    ),
    'https://ais-pre-gbwhagdl3bssyloecoydt5-2401289148.asia-east1.run.app/'
  );
  assert.equal(
    resolveSafeInviteRedirectTo('https://hub.twbweddings.com/login'),
    'https://hub.twbweddings.com/login'
  );
  assert.equal(
    resolveSafeInviteRedirectTo('http://localhost:3000'),
    'http://localhost:3000/'
  );
});

test('inviteEditor omits redirect_to when window origin is ais-dev-*', async () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    location: {
      origin:
        'https://ais-dev-gbwhagdl3bssyloecoydt5-2401289148.asia-east1.run.app',
    },
  };

  try {
    const { client, calls } = createMockSupabaseClient(async () => ({
      data: {
        success: true,
        action: 'invite_editor',
        team_member_id: 'tm-1',
        profile_id: 'prof-1',
        account_status: 'Invitation Pending',
        email_sent: true,
        recovered_partial_provisioning: false,
        partial_state: {
          auth_user_created: true,
          app_metadata_updated: true,
          profile_created: true,
          team_member_linked: true,
        },
        message: 'Invitation sent.',
      },
      error: null,
    }));

    const result = await inviteEditor(
      { teamMemberId: 'tm-1', email: 'editor@example.com' },
      client
    );

    assert.equal(result.account_status, 'Invitation Pending');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fnName, EDITOR_ACCOUNT_FUNCTION_NAME);
    assert.deepEqual(calls[0].body, {
      action: 'invite_editor',
      team_member_id: 'tm-1',
      email: 'editor@example.com',
    });
    assert.equal('redirect_to' in calls[0].body, false);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
});

test('getEditorAccountStatuses short-circuits empty array without invoking Edge Function', async () => {
  const { client, calls } = createMockSupabaseClient(async () => {
    throw new Error('Should not be called for empty array');
  });

  const result = await getEditorAccountStatuses([], client);
  assert.deepEqual(result, []);
  assert.equal(calls.length, 0);
});

test('getEditorAccountStatuses batches team_member_ids into a single request', async () => {
  const summary = {
    team_member_id: 'tm-1',
    profile_id: 'prof-1',
    account_status: 'Login Active',
    team_member_active: false,
    team_member_directory_active: false,
    team_member_status: 'Inactive',
    is_editor_category: true,
    profile_role: 'editor',
    profile_is_active: true,
    auth_banned: false,
    email_confirmed: true,
    password_setup_required: false,
    invited_at: '2026-01-01T00:00:00Z',
    last_sign_in_at: '2026-01-02T00:00:00Z',
    integrity_warning: null,
  };

  const { client, calls } = createMockSupabaseClient(async () => ({
    data: {
      success: true,
      action: 'account_status',
      accounts: [summary],
    },
    error: null,
  }));

  const accounts = await getEditorAccountStatuses(['tm-1', 'tm-2'], client);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    action: 'account_status',
    team_member_ids: ['tm-1', 'tm-2'],
  });
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].account_status, 'Login Active');
  assert.equal(accounts[0].team_member_directory_active, false);
});

test('typed helpers cover single account_status, set_account_active, resend_invite, and complete_invite_password_setup', async () => {
  const { client, calls } = createMockSupabaseClient(async (_fn, options) => ({
    data: { success: true, action: options?.body?.action },
    error: null,
  }));

  await getEditorAccountStatus('tm-1', client);
  await setEditorAccountActive(
    { teamMemberId: 'tm-1', loginActive: false },
    client
  );
  await resendEditorInvite('tm-1', client);
  await completeInvitePasswordSetup('StrongPass!123', client);

  assert.deepEqual(
    calls.map(c => c.body),
    [
      { action: 'account_status', team_member_id: 'tm-1' },
      {
        action: 'set_account_active',
        team_member_id: 'tm-1',
        login_active: false,
      },
      { action: 'resend_invite', team_member_id: 'tm-1' },
      {
        action: 'complete_invite_password_setup',
        new_password: 'StrongPass!123',
      },
    ]
  );
});

test('extracts structured backend errors from FunctionsHttpError', async () => {
  const errorResponse = new Response(
    JSON.stringify({
      success: false,
      code: 'RATE_LIMITED',
      error: 'Please wait before retrying.',
      retryable: true,
      retry_after_seconds: 45,
      account_status: 'Invitation Pending',
    }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const { client } = createMockSupabaseClient(async () => ({
    data: null,
    error: new FunctionsHttpError(errorResponse),
  }));

  await assert.rejects(
    () => resendEditorInvite('tm-1', client),
    (err: unknown) => {
      assert(err instanceof EditorAccountApiError);
      assert.equal(err.code, 'RATE_LIMITED');
      assert.equal(err.status, 429);
      assert.equal(err.retryable, true);
      assert.equal(err.retryAfterSeconds, 45);
      assert.equal(err.accountStatus, 'Invitation Pending');
      assert.equal(err.message, 'Please wait before retrying.');
      return true;
    }
  );
});

test('throws clear SUPABASE_NOT_CONFIGURED error when client is null', async () => {
  await assert.rejects(
    () => getEditorAccountStatuses(['tm-1'], null),
    (err: unknown) => {
      assert(err instanceof EditorAccountApiError);
      assert.equal(err.code, 'SUPABASE_NOT_CONFIGURED');
      return true;
    }
  );
});
