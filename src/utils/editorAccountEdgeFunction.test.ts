import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';

interface MockTeamMemberRow {
  id: string;
  profile_id: string | null;
  name: string;
  email: string | null;
  active: boolean | null;
  status: string | null;
  categories: string[] | null;
  updated_at?: string;
}

interface MockProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
}

interface MockAuthUser {
  id: string;
  email: string;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

function createEdgeHarness(seed: {
  teamMembers?: MockTeamMemberRow[];
  profiles?: MockProfileRow[];
  authUsers?: MockAuthUser[];
  tokens?: Record<string, string>;
}) {
  const state = {
    teamMembers: (seed.teamMembers || []).map(row => ({ ...row })),
    profiles: (seed.profiles || []).map(row => ({ ...row })),
    authUsers: (seed.authUsers || []).map(u => ({
      ...u,
      app_metadata: u.app_metadata ? { ...u.app_metadata } : {},
      user_metadata: u.user_metadata ? { ...u.user_metadata } : {},
    })) as MockAuthUser[],
    tokens: { ...(seed.tokens || {}) },
    invitesSent: [] as Array<{ email: string; options: Record<string, any> }>,
    updateUserCalls: [] as Array<{ id: string; attrs: Record<string, any> }>,
  };

  const makeQueryBuilder = (table: 'team_members' | 'profiles') => {
    const filters: Array<(row: Record<string, any>) => boolean> = [];
    let pendingUpdate: Record<string, any> | null = null;
    let pendingInsert: Record<string, any> | null = null;
    let rangeSlice: [number, number] | null = null;
    let limitCount: number | null = null;

    const getCollection = () =>
      table === 'team_members' ? state.teamMembers : state.profiles;

    const execute = async (): Promise<{ data: any; error: any }> => {
      if (pendingInsert) {
        const row = { ...pendingInsert };
        if (table === 'profiles') {
          state.profiles.push(row as MockProfileRow);
        } else {
          state.teamMembers.push(row as MockTeamMemberRow);
        }
        return { data: [row], error: null };
      }

      let matched = getCollection().filter(row => filters.every(fn => fn(row)));

      if (pendingUpdate) {
        matched = matched.map(row => {
          Object.assign(row, pendingUpdate);
          return { ...row };
        });
        return { data: matched, error: null };
      }

      if (rangeSlice) {
        matched = matched.slice(rangeSlice[0], rangeSlice[1] + 1);
      }
      if (limitCount !== null) {
        matched = matched.slice(0, limitCount);
      }
      return { data: matched.map(r => ({ ...r })), error: null };
    };

    const builder: any = {
      select: () => builder,
      insert: (payload: Record<string, any>) => {
        pendingInsert = payload;
        return builder;
      },
      update: (payload: Record<string, any>) => {
        pendingUpdate = payload;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        filters.push(row => row[col] === val);
        return builder;
      },
      neq: (col: string, val: unknown) => {
        filters.push(row => row[col] !== val);
        return builder;
      },
      is: (col: string, val: unknown) => {
        filters.push(row => (val === null ? row[col] === null || row[col] === undefined : row[col] === val));
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push(row => vals.includes(row[col]));
        return builder;
      },
      range: (from: number, to: number) => {
        rangeSlice = [from, to];
        return builder;
      },
      limit: (n: number) => {
        limitCount = n;
        return builder;
      },
      maybeSingle: async () => {
        const res = await execute();
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        return { data: first, error: res.error };
      },
      single: async () => {
        const res = await execute();
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        return { data: first, error: first ? res.error : { message: 'Row not found' } };
      },
      then: (resolve: any, reject: any) => execute().then(resolve, reject),
    };

    return builder;
  };

  const createClient = (
    _url: string,
    key: string,
    options?: { global?: { headers?: Record<string, string> } }
  ) => {
    const authHeader = options?.global?.headers?.Authorization || '';
    const isAdmin = key === 'secret-key-mock';

    if (!isAdmin) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const userId = state.tokens[token];
      const user = state.authUsers.find(u => u.id === userId) || null;
      return {
        auth: {
          getUser: async () =>
            user
              ? { data: { user: { ...user } }, error: null }
              : { data: { user: null }, error: { message: 'Invalid JWT' } },
        },
      };
    }

    return {
      from: (table: 'team_members' | 'profiles') => makeQueryBuilder(table),
      auth: {
        admin: {
          listUsers: async () => ({
            data: { users: state.authUsers.map(u => ({ ...u })), nextPage: null },
            error: null,
          }),
          getUserById: async (id: string) => {
            const found = state.authUsers.find(u => u.id === id) || null;
            return { data: { user: found ? { ...found } : null }, error: null };
          },
          inviteUserByEmail: async (email: string, inviteOpts: Record<string, any>) => {
            const newId = `aaaaaaaa-aaaa-4aaa-8aaa-${String(state.authUsers.length + 1).padStart(12, '0')}`;
            const user: MockAuthUser = {
              id: newId,
              email,
              invited_at: '2026-11-17T10:00:00.000Z',
              email_confirmed_at: null,
              app_metadata: {},
              user_metadata: inviteOpts?.data || {},
            };
            state.authUsers.push(user);
            state.invitesSent.push({ email, options: inviteOpts });
            return { data: { user: { ...user } }, error: null };
          },
          updateUserById: async (id: string, attrs: Record<string, any>) => {
            state.updateUserCalls.push({ id, attrs: { ...attrs } });
            const target = state.authUsers.find(u => u.id === id);
            if (!target) {
              return { data: { user: null }, error: { message: 'User not found' } };
            }
            if (attrs.app_metadata) {
              target.app_metadata = { ...attrs.app_metadata };
            }
            if (attrs.ban_duration === 'none') {
              target.banned_until = null;
            } else if (typeof attrs.ban_duration === 'string') {
              target.banned_until = '2099-01-01T00:00:00.000Z';
            }
            if (attrs.email_confirm === true) {
              target.email_confirmed_at = target.email_confirmed_at || '2026-11-17T11:00:00.000Z';
            }
            return { data: { user: { ...target } }, error: null };
          },
        },
      },
    };
  };

  // Load and transpile the real Supabase Edge Function source without altering its Deno entrypoint
  const edgePath = path.join(process.cwd(), 'supabase/functions/manage-editor-account/index.ts');
  const rawSource = fs.readFileSync(edgePath, 'utf8');
  const strippedSource = rawSource.replace(
    /^\s*import\s+\{\s*createClient\s*\}\s+from\s+['"][^'"]+['"];\s*/m,
    ''
  );
  const transformed = transformSync(strippedSource, {
    loader: 'ts',
    format: 'cjs',
    target: 'es2022',
  });

  let registeredHandler: ((req: Request) => Promise<Response>) | null = null;
  const mockDeno = {
    env: {
      get: (name: string) => {
        if (name === 'SUPABASE_URL') return 'https://example.supabase.co';
        if (name === 'SUPABASE_PUBLISHABLE_KEYS') return JSON.stringify({ default: 'pub-key-mock' });
        if (name === 'SUPABASE_SECRET_KEYS') return JSON.stringify({ default: 'secret-key-mock' });
        return undefined;
      },
    },
    serve: (fn: (req: Request) => Promise<Response>) => {
      registeredHandler = fn;
    },
  };

  const runner = new Function('Deno', 'createClient', transformed.code);
  runner(mockDeno, createClient);

  if (!registeredHandler) {
    throw new Error('Edge Function did not register a Deno.serve handler.');
  }

  const invoke = async (token: string, body: Record<string, unknown>) => {
    const req = new Request('https://example.supabase.co/functions/v1/manage-editor-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const res = await registeredHandler!(req);
    const json = await res.json();
    return { status: res.status, json };
  };

  const confirmInviteEmail = (
    userId: string,
    confirmedAt = '2026-11-17T10:30:00.000Z'
  ) => {
    const target = state.authUsers.find(u => u.id === userId);
    if (!target) {
      throw new Error(`Mock auth user ${userId} not found.`);
    }
    target.email_confirmed_at = confirmedAt;
  };

  return { state, invoke, confirmInviteEmail };
}

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

const TM_ACTIVE_LOGIN_ACTIVE = '11111111-1111-4111-8111-111111111111';
const PROF_ACTIVE_LOGIN_ACTIVE = '21111111-1111-4111-8111-111111111111';

const TM_INACTIVE_LOGIN_ACTIVE = '11111111-1111-4111-8111-222222222222';
const PROF_INACTIVE_LOGIN_ACTIVE = '21111111-1111-4111-8111-222222222222';

const TM_ACTIVE_LOGIN_DISABLED = '11111111-1111-4111-8111-333333333333';
const PROF_ACTIVE_LOGIN_DISABLED = '21111111-1111-4111-8111-333333333333';

const TM_INACTIVE_LOGIN_DISABLED = '11111111-1111-4111-8111-444444444444';
const PROF_INACTIVE_LOGIN_DISABLED = '21111111-1111-4111-8111-444444444444';

const TM_PENDING_INACTIVE_DIR = '11111111-1111-4111-8111-555555555555';
const PROF_PENDING_INACTIVE_DIR = '21111111-1111-4111-8111-555555555555';

const TM_UNINVITED_INACTIVE_DIR = '11111111-1111-4111-8111-666666666666';

describe('manage-editor-account Edge Function — Directory Activity vs Portal Login Independence (Scenarios 1-5)', () => {
  it('Scenarios 1-4: computeEditorAccountStatus distinguishes all four Team Member vs Portal Login combinations accurately', async () => {
    const harness = createEdgeHarness({
      profiles: [
        {
          id: ADMIN_ID,
          email: 'admin@twb.studio',
          full_name: 'Studio Admin',
          role: 'admin',
          is_active: true,
        },
        {
          id: PROF_ACTIVE_LOGIN_ACTIVE,
          email: 'ed1@twb.studio',
          full_name: 'Editor One',
          role: 'editor',
          is_active: true,
        },
        {
          id: PROF_INACTIVE_LOGIN_ACTIVE,
          email: 'ed2@twb.studio',
          full_name: 'Editor Two',
          role: 'editor',
          is_active: true,
        },
        {
          id: PROF_ACTIVE_LOGIN_DISABLED,
          email: 'ed3@twb.studio',
          full_name: 'Editor Three',
          role: 'editor',
          is_active: false,
        },
        {
          id: PROF_INACTIVE_LOGIN_DISABLED,
          email: 'ed4@twb.studio',
          full_name: 'Editor Four',
          role: 'editor',
          is_active: false,
        },
      ],
      authUsers: [
        { id: ADMIN_ID, email: 'admin@twb.studio', email_confirmed_at: '2026-10-01T00:00:00Z' },
        {
          id: PROF_ACTIVE_LOGIN_ACTIVE,
          email: 'ed1@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
          app_metadata: { password_setup_required: false, invited_team_member_id: TM_ACTIVE_LOGIN_ACTIVE },
        },
        {
          id: PROF_INACTIVE_LOGIN_ACTIVE,
          email: 'ed2@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
          app_metadata: { password_setup_required: false, invited_team_member_id: TM_INACTIVE_LOGIN_ACTIVE },
        },
        {
          id: PROF_ACTIVE_LOGIN_DISABLED,
          email: 'ed3@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
          banned_until: '2099-01-01T00:00:00Z',
          app_metadata: { password_setup_required: false, invited_team_member_id: TM_ACTIVE_LOGIN_DISABLED },
        },
        {
          id: PROF_INACTIVE_LOGIN_DISABLED,
          email: 'ed4@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
          banned_until: '2099-01-01T00:00:00Z',
          app_metadata: { password_setup_required: false, invited_team_member_id: TM_INACTIVE_LOGIN_DISABLED },
        },
      ],
      teamMembers: [
        // 1. Active Team Member + active login
        {
          id: TM_ACTIVE_LOGIN_ACTIVE,
          profile_id: PROF_ACTIVE_LOGIN_ACTIVE,
          name: 'Editor One',
          email: 'ed1@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Editor'],
        },
        // 2. Inactive Team Member + active login
        {
          id: TM_INACTIVE_LOGIN_ACTIVE,
          profile_id: PROF_INACTIVE_LOGIN_ACTIVE,
          name: 'Editor Two',
          email: 'ed2@twb.studio',
          active: false,
          status: 'Inactive',
          categories: ['Editor'],
        },
        // 3. Active Team Member + disabled login
        {
          id: TM_ACTIVE_LOGIN_DISABLED,
          profile_id: PROF_ACTIVE_LOGIN_DISABLED,
          name: 'Editor Three',
          email: 'ed3@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Editor'],
        },
        // 4. Inactive Team Member + disabled login
        {
          id: TM_INACTIVE_LOGIN_DISABLED,
          profile_id: PROF_INACTIVE_LOGIN_DISABLED,
          name: 'Editor Four',
          email: 'ed4@twb.studio',
          active: false,
          status: 'Inactive',
          categories: ['Editor'],
        },
      ],
      tokens: {
        'admin-token': ADMIN_ID,
      },
    });

    const res = await harness.invoke('admin-token', {
      action: 'account_status',
      team_member_ids: [
        TM_ACTIVE_LOGIN_ACTIVE,
        TM_INACTIVE_LOGIN_ACTIVE,
        TM_ACTIVE_LOGIN_DISABLED,
        TM_INACTIVE_LOGIN_DISABLED,
      ],
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);

    const byId = new Map<string, any>(
      (res.json.accounts as any[]).map(item => [item.team_member_id, item])
    );

    // Scenario 1: Active Team Member + active login
    const s1 = byId.get(TM_ACTIVE_LOGIN_ACTIVE);
    assert.strictEqual(s1.account_status, 'Login Active');
    assert.strictEqual(s1.team_member_active, true);
    assert.strictEqual(s1.team_member_directory_active, true);
    assert.strictEqual(s1.profile_is_active, true);
    assert.strictEqual(s1.auth_banned, false);
    assert.strictEqual(s1.integrity_warning, null);

    // Scenario 2: Inactive Team Member + active login (must remain Login Active!)
    const s2 = byId.get(TM_INACTIVE_LOGIN_ACTIVE);
    assert.strictEqual(s2.account_status, 'Login Active');
    assert.strictEqual(s2.team_member_active, false);
    assert.strictEqual(s2.team_member_directory_active, false);
    assert.strictEqual(s2.profile_is_active, true);
    assert.strictEqual(s2.auth_banned, false);
    assert.strictEqual(s2.integrity_warning, null);

    // Scenario 3: Active Team Member + disabled login
    const s3 = byId.get(TM_ACTIVE_LOGIN_DISABLED);
    assert.strictEqual(s3.account_status, 'Login Disabled');
    assert.strictEqual(s3.team_member_active, true);
    assert.strictEqual(s3.team_member_directory_active, true);
    assert.strictEqual(s3.profile_is_active, false);
    assert.strictEqual(s3.auth_banned, true);

    // Scenario 4: Inactive Team Member + disabled login
    const s4 = byId.get(TM_INACTIVE_LOGIN_DISABLED);
    assert.strictEqual(s4.account_status, 'Login Disabled');
    assert.strictEqual(s4.team_member_active, false);
    assert.strictEqual(s4.team_member_directory_active, false);
    assert.strictEqual(s4.profile_is_active, false);
    assert.strictEqual(s4.auth_banned, true);
  });

  it('Scenario 5: Inactive Team Member with active Editor profile and unbanned Auth account completes invitation password setup', async () => {
    const harness = createEdgeHarness({
      profiles: [
        {
          id: ADMIN_ID,
          email: 'admin@twb.studio',
          full_name: 'Studio Admin',
          role: 'admin',
          is_active: true,
        },
        {
          id: PROF_PENDING_INACTIVE_DIR,
          email: 'pending@twb.studio',
          full_name: 'Pending Editor',
          role: 'editor',
          is_active: true,
        },
      ],
      authUsers: [
        {
          id: ADMIN_ID,
          email: 'admin@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
        },
        {
          id: PROF_PENDING_INACTIVE_DIR,
          email: 'pending@twb.studio',
          invited_at: '2026-11-16T09:00:00Z',
          email_confirmed_at: null,
          banned_until: null,
          app_metadata: {
            password_setup_required: true,
            onboarding_role: 'editor',
            invited_team_member_id: TM_PENDING_INACTIVE_DIR,
          },
        },
      ],
      teamMembers: [
        {
          id: TM_PENDING_INACTIVE_DIR,
          profile_id: PROF_PENDING_INACTIVE_DIR,
          name: 'Pending Editor',
          email: 'pending@twb.studio',
          active: false,
          status: 'Inactive',
          categories: ['Editor'],
        },
        {
          id: TM_UNINVITED_INACTIVE_DIR,
          profile_id: null,
          name: 'Uninvited Inactive',
          email: 'uninvited@twb.studio',
          active: false,
          status: 'Inactive',
          categories: ['Editor'],
        },
      ],
      tokens: {
        'admin-token': ADMIN_ID,
        'pending-editor-token': PROF_PENDING_INACTIVE_DIR,
      },
    });

    // Before email confirmation or setup, account_status is Invitation Pending (not Login Disabled)
    const beforeStatus = await harness.invoke('admin-token', {
      action: 'account_status',
      team_member_id: TM_PENDING_INACTIVE_DIR,
    });
    assert.strictEqual(beforeStatus.status, 200);
    assert.strictEqual(beforeStatus.json.account_status, 'Invitation Pending');
    assert.strictEqual(beforeStatus.json.team_member_directory_active, false);

    // Unconfirmed Auth user MUST NOT be able to complete password setup or clear password_setup_required
    const unconfirmedSetupRes = await harness.invoke('pending-editor-token', {
      action: 'complete_invite_password_setup',
      new_password: 'StrongStudioPassword!2026',
    });
    assert.strictEqual(unconfirmedSetupRes.status, 403);
    assert.strictEqual(unconfirmedSetupRes.json.code, 'EMAIL_NOT_CONFIRMED');
    assert.strictEqual(harness.state.updateUserCalls.length, 0);
    assert.strictEqual(
      harness.state.authUsers.find(u => u.id === PROF_PENDING_INACTIVE_DIR)?.app_metadata
        ?.password_setup_required,
      true
    );

    // Explicitly simulate opening the Supabase invite link confirming email_confirmed_at
    harness.confirmInviteEmail(PROF_PENDING_INACTIVE_DIR);

    // Completing invitation password setup MUST succeed even when Team Member is directory-inactive
    const setupRes = await harness.invoke('pending-editor-token', {
      action: 'complete_invite_password_setup',
      new_password: 'StrongStudioPassword!2026',
    });
    assert.strictEqual(setupRes.status, 200);
    assert.strictEqual(setupRes.json.success, true);
    assert.strictEqual(setupRes.json.password_setup_required, false);
    assert.strictEqual(setupRes.json.email_confirmed, true);
    assert.strictEqual(setupRes.json.account_status, 'Login Active');
    assert.strictEqual(harness.state.updateUserCalls.length, 1);
    assert.strictEqual(
      harness.state.authUsers.find(u => u.id === PROF_PENDING_INACTIVE_DIR)?.app_metadata
        ?.password_setup_required,
      false
    );

    // Verify NEW invite_editor STILL requires Active Team Member directory status
    const newInviteInactiveRes = await harness.invoke('admin-token', {
      action: 'invite_editor',
      team_member_id: TM_UNINVITED_INACTIVE_DIR,
      email: 'uninvited@twb.studio',
    });
    assert.strictEqual(newInviteInactiveRes.status, 409);
    assert.strictEqual(newInviteInactiveRes.json.code, 'TEAM_MEMBER_INACTIVE');
    assert.strictEqual(harness.state.invitesSent.length, 0);
  });

  it('rejects password setup when portal login is disabled (profiles.is_active=false or Auth banned) or Editor category is missing', async () => {
    const harness = createEdgeHarness({
      profiles: [
        {
          id: PROF_ACTIVE_LOGIN_DISABLED,
          email: 'disabled-prof@twb.studio',
          full_name: 'Disabled Prof',
          role: 'editor',
          is_active: false,
        },
        {
          id: PROF_INACTIVE_LOGIN_ACTIVE,
          email: 'noncat@twb.studio',
          full_name: 'Photo Only',
          role: 'editor',
          is_active: true,
        },
      ],
      authUsers: [
        {
          id: PROF_ACTIVE_LOGIN_DISABLED,
          email: 'disabled-prof@twb.studio',
          invited_at: '2026-11-16T09:00:00Z',
          app_metadata: {
            password_setup_required: true,
            invited_team_member_id: TM_ACTIVE_LOGIN_DISABLED,
          },
        },
        {
          id: PROF_INACTIVE_LOGIN_ACTIVE,
          email: 'noncat@twb.studio',
          invited_at: '2026-11-16T09:00:00Z',
          app_metadata: {
            password_setup_required: true,
            invited_team_member_id: TM_INACTIVE_LOGIN_ACTIVE,
          },
        },
      ],
      teamMembers: [
        {
          id: TM_ACTIVE_LOGIN_DISABLED,
          profile_id: PROF_ACTIVE_LOGIN_DISABLED,
          name: 'Disabled Prof',
          email: 'disabled-prof@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Editor'],
        },
        {
          id: TM_INACTIVE_LOGIN_ACTIVE,
          profile_id: PROF_INACTIVE_LOGIN_ACTIVE,
          name: 'Photo Only',
          email: 'noncat@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Photo'],
        },
      ],
      tokens: {
        'disabled-token': PROF_ACTIVE_LOGIN_DISABLED,
        'noncat-token': PROF_INACTIVE_LOGIN_ACTIVE,
      },
    });

    const disabledRes = await harness.invoke('disabled-token', {
      action: 'complete_invite_password_setup',
      new_password: 'StrongStudioPassword!2026',
    });
    assert.strictEqual(disabledRes.status, 403);
    assert.strictEqual(disabledRes.json.code, 'ACCOUNT_INACTIVE');

    const nonCatRes = await harness.invoke('noncat-token', {
      action: 'complete_invite_password_setup',
      new_password: 'StrongStudioPassword!2026',
    });
    assert.strictEqual(nonCatRes.status, 403);
    assert.strictEqual(nonCatRes.json.code, 'TEAM_MEMBER_INELIGIBLE');
  });

  it('rejects complete_invite_password_setup with 403 EMAIL_NOT_CONFIRMED without mutating password or metadata when email_confirmed_at is null', async () => {
    const harness = createEdgeHarness({
      profiles: [
        {
          id: PROF_ACTIVE_LOGIN_ACTIVE,
          email: 'unconfirmed@twb.studio',
          full_name: 'Unconfirmed Editor',
          role: 'editor',
          is_active: true,
        },
      ],
      authUsers: [
        {
          id: PROF_ACTIVE_LOGIN_ACTIVE,
          email: 'unconfirmed@twb.studio',
          invited_at: '2026-11-16T09:00:00Z',
          email_confirmed_at: null,
          banned_until: null,
          app_metadata: {
            password_setup_required: true,
            onboarding_role: 'editor',
            invited_team_member_id: TM_ACTIVE_LOGIN_ACTIVE,
          },
        },
      ],
      teamMembers: [
        {
          id: TM_ACTIVE_LOGIN_ACTIVE,
          profile_id: PROF_ACTIVE_LOGIN_ACTIVE,
          name: 'Unconfirmed Editor',
          email: 'unconfirmed@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Editor'],
        },
      ],
      tokens: {
        'editor-token': PROF_ACTIVE_LOGIN_ACTIVE,
      },
    });

    const res = await harness.invoke('editor-token', {
      action: 'complete_invite_password_setup',
      new_password: 'StrongStudioPassword!2026',
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.code, 'EMAIL_NOT_CONFIRMED');
    assert.strictEqual(harness.state.updateUserCalls.length, 0);
    const storedUser = harness.state.authUsers.find(u => u.id === PROF_ACTIVE_LOGIN_ACTIVE);
    assert.strictEqual(storedUser?.email_confirmed_at, null);
    assert.strictEqual(storedUser?.app_metadata?.password_setup_required, true);
  });

  it('returns empty accounts array immediately when team_member_ids is []', async () => {
    const harness = createEdgeHarness({
      profiles: [
        {
          id: ADMIN_ID,
          email: 'admin@twb.studio',
          full_name: 'Studio Admin',
          role: 'admin',
          is_active: true,
        },
      ],
      authUsers: [
        {
          id: ADMIN_ID,
          email: 'admin@twb.studio',
          email_confirmed_at: '2026-10-01T00:00:00Z',
        },
      ],
      teamMembers: [
        {
          id: TM_ACTIVE_LOGIN_ACTIVE,
          profile_id: PROF_ACTIVE_LOGIN_ACTIVE,
          name: 'Editor One',
          email: 'ed1@twb.studio',
          active: true,
          status: 'Active',
          categories: ['Editor'],
        },
      ],
      tokens: {
        'admin-token': ADMIN_ID,
      },
    });

    const res = await harness.invoke('admin-token', {
      action: 'account_status',
      team_member_ids: [],
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.json, {
      success: true,
      action: 'account_status',
      accounts: [],
    });
  });
});
