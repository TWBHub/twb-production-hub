// @ts-nocheck — Deno Edge Function runtime (excluded from browser bundle; verified separately in Deno)
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AccountStatusState =
  | 'Not Invited'
  | 'Invitation Pending'
  | 'Login Active'
  | 'Login Disabled';

type ActionName =
  | 'invite_editor'
  | 'account_status'
  | 'set_account_active'
  | 'complete_invite_password_setup'
  | 'resend_invite';

interface TeamMemberRow {
  id: string;
  profile_id: string | null;
  name: string;
  email: string | null;
  active: boolean | null;
  status: string | null;
  categories: string[] | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PERMANENT_BAN_DURATION = '876000h';

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
): Response {
  return jsonResponse(
    {
      success: false,
      code,
      error: message,
      ...extra,
    },
    status
  );
}

function parseDefaultKeyFromJsonEnv(envName: string): string | null {
  const raw = Deno.env.get(envName);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = typeof parsed?.default === 'string' ? parsed.default.trim() : '';
    return defaultKey || null;
  } catch {
    return null;
  }
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function normalizeRole(role: unknown): string {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

function isAdminOrManagerRole(role: unknown): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'manager';
}

function isEditorRole(role: unknown): boolean {
  return normalizeRole(role) === 'editor';
}

function isTeamMemberActive(member: TeamMemberRow | null | undefined): boolean {
  if (!member) return false;
  const statusNorm = typeof member.status === 'string' ? member.status.trim().toLowerCase() : '';
  return member.active === true && statusNorm === 'active';
}

function hasEditorCategory(categories: unknown): boolean {
  if (!Array.isArray(categories)) return false;
  return categories.some(
    cat => typeof cat === 'string' && cat.trim().toLowerCase() === 'editor'
  );
}

function normalizeAndValidateEmail(rawEmail: unknown): {
  valid: boolean;
  email: string;
  error?: string;
} {
  if (typeof rawEmail !== 'string') {
    return { valid: false, email: '', error: 'Invitation email address is required.' };
  }
  const normalized = rawEmail.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, email: '', error: 'Invitation email address cannot be empty.' };
  }
  if (normalized.length > 254 || /[\r\n\0]/.test(normalized) || !EMAIL_REGEX.test(normalized)) {
    return { valid: false, email: '', error: 'Please provide a valid email address.' };
  }
  return { valid: true, email: normalized };
}

function validateRedirectTo(rawRedirect: unknown): {
  valid: boolean;
  redirectTo?: string;
  error?: string;
} {
  if (rawRedirect === undefined || rawRedirect === null || rawRedirect === '') {
    return { valid: true, redirectTo: undefined };
  }
  if (typeof rawRedirect !== 'string') {
    return { valid: false, error: 'redirect_to must be a valid HTTPS URL string.' };
  }

  const trimmed = rawRedirect.trim();
  if (!trimmed) {
    return { valid: true, redirectTo: undefined };
  }

  try {
    const parsed = new URL(trimmed);
    const isLocalhost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(isLocalhost && parsed.protocol === 'http:')) {
      return { valid: false, error: 'redirect_to must use HTTPS.' };
    }
    if (parsed.hostname.toLowerCase().startsWith('ais-dev-')) {
      return {
        valid: false,
        error:
          'Developer preview URLs (ais-dev-*) are blocked for external users. Use the shared preview or production HTTPS URL.',
      };
    }
    parsed.hash = '';
    return { valid: true, redirectTo: parsed.toString() };
  } catch {
    return { valid: false, error: 'redirect_to is not a valid URL.' };
  }
}

function validateNewPassword(rawPassword: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof rawPassword !== 'string' || !rawPassword) {
    return { valid: false, error: 'A new password is required.' };
  }
  if (rawPassword.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (rawPassword.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer.' };
  }
  if (rawPassword.trim().length === 0) {
    return { valid: false, error: 'Password cannot consist solely of whitespace.' };
  }
  if (/[\0\r\n]/.test(rawPassword)) {
    return { valid: false, error: 'Password contains invalid control characters.' };
  }
  return { valid: true };
}

function isAuthUserBanned(authUser: Record<string, any> | null | undefined): boolean {
  if (!authUser || typeof authUser.banned_until !== 'string' || !authUser.banned_until) {
    return false;
  }
  const bannedUntilMs = Date.parse(authUser.banned_until);
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > Date.now();
}

function isAuthUserNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: unknown; code?: unknown; message?: unknown };
  if (err.code === 'user_not_found' || err.status === 404) {
    return true;
  }
  const msg = typeof err.message === 'string' ? err.message.trim().toLowerCase() : '';
  return msg === 'user not found';
}

async function lookupAuthUserById(
  adminClient: any,
  userId: string
): Promise<{ user: Record<string, any> | null; error: boolean }> {
  try {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error) {
      if (isAuthUserNotFoundError(error)) {
        return { user: null, error: false };
      }
      return { user: null, error: true };
    }
    return { user: data?.user ?? null, error: false };
  } catch {
    return { user: null, error: true };
  }
}

function computeEditorAccountStatus(params: {
  teamMember: TeamMemberRow;
  profile: ProfileRow | null;
  authUser: Record<string, any> | null;
}): {
  account_status: AccountStatusState;
  profile_is_active: boolean | null;
  auth_banned: boolean;
  email_confirmed: boolean;
  password_setup_required: boolean;
  invited_at: string | null;
  last_sign_in_at: string | null;
  integrity_warning: string | null;
} {
  const { teamMember, profile, authUser } = params;

  if (!teamMember.profile_id) {
    return {
      account_status: 'Not Invited',
      profile_is_active: null,
      auth_banned: false,
      email_confirmed: false,
      password_setup_required: false,
      invited_at: null,
      last_sign_in_at: null,
      integrity_warning: null,
    };
  }

  const profileIsActive = profile ? profile.is_active === true : null;
  const authBanned = isAuthUserBanned(authUser);
  const emailConfirmed = Boolean(authUser?.email_confirmed_at);
  const passwordSetupRequired = authUser?.app_metadata?.password_setup_required === true;
  const invitedAt = typeof authUser?.invited_at === 'string' ? authUser.invited_at : null;
  const lastSignInAt =
    typeof authUser?.last_sign_in_at === 'string' ? authUser.last_sign_in_at : null;

  const invitedTag =
    typeof authUser?.app_metadata?.invited_team_member_id === 'string'
      ? authUser.app_metadata.invited_team_member_id.trim()
      : '';
  const hasMismatchedInviteTag = Boolean(invitedTag && invitedTag !== teamMember.id);
  const missingEditorCategory = !hasEditorCategory(teamMember.categories);

  const warnings: string[] = [];
  if (!profile && !authUser) {
    warnings.push('Linked profile and auth user records were not found.');
  } else {
    if (!profile) {
      warnings.push('Linked profile record was not found.');
    }
    if (!authUser) {
      warnings.push('Linked auth user record was not found.');
    }
  }
  if (profile && !isEditorRole(profile.role)) {
    warnings.push(`Linked profile has non-editor role "${profile.role || 'unknown'}".`);
  }
  if (missingEditorCategory) {
    warnings.push('Linked Team Member does not include Editor in categories.');
  }
  if (hasMismatchedInviteTag) {
    warnings.push('Auth invitation metadata targets a different Team Member ID.');
  }

  const integrityWarning: string | null = warnings.length > 0 ? warnings.join(' ') : null;
  const hasInvalidRelationship =
    !profile ||
    !authUser ||
    !isEditorRole(profile.role) ||
    missingEditorCategory ||
    hasMismatchedInviteTag;

  if (hasInvalidRelationship || profileIsActive !== true || authBanned) {
    return {
      account_status: 'Login Disabled',
      profile_is_active: profileIsActive,
      auth_banned: authBanned,
      email_confirmed: emailConfirmed,
      password_setup_required: passwordSetupRequired,
      invited_at: invitedAt,
      last_sign_in_at: lastSignInAt,
      integrity_warning: integrityWarning,
    };
  }

  if (!emailConfirmed || passwordSetupRequired) {
    return {
      account_status: 'Invitation Pending',
      profile_is_active: profileIsActive,
      auth_banned: authBanned,
      email_confirmed: emailConfirmed,
      password_setup_required: passwordSetupRequired,
      invited_at: invitedAt,
      last_sign_in_at: lastSignInAt,
      integrity_warning: integrityWarning,
    };
  }

  return {
    account_status: 'Login Active',
    profile_is_active: profileIsActive,
    auth_banned: authBanned,
    email_confirmed: emailConfirmed,
    password_setup_required: passwordSetupRequired,
    invited_at: invitedAt,
    last_sign_in_at: lastSignInAt,
    integrity_warning: integrityWarning,
  };
}

async function listAllAuthUsers(
  adminClient: any
): Promise<{ users: Record<string, any>[]; error: string | null }> {
  const users: Record<string, any>[] = [];
  let page = 1;
  const perPage = 1000;

  while (page <= 50) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      return { users: [], error: 'Failed to query Auth user directory.' };
    }
    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);
    if (!data?.nextPage || batch.length === 0) {
      break;
    }
    page = data.nextPage;
  }

  return { users, error: null };
}

async function findProfilesByNormalizedEmail(
  adminClient: any,
  normalizedEmail: string
): Promise<{ profiles: ProfileRow[]; error: string | null }> {
  const matched: ProfileRow[] = [];
  const pageSize = 1000;
  let from = 0;

  for (let i = 0; i < 50; i += 1) {
    const to = from + pageSize - 1;
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .range(from, to);

    if (error) {
      return { profiles: [], error: 'Failed to inspect studio profiles.' };
    }

    const rows = Array.isArray(data) ? (data as ProfileRow[]) : [];
    for (const row of rows) {
      if ((row.email || '').trim().toLowerCase() === normalizedEmail) {
        matched.push(row);
      }
    }

    if (rows.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { profiles: matched, error: null };
}

async function authenticateCaller(
  req: Request,
  supabaseUrl: string,
  publishableKey: string,
  adminClient: any,
  options: { allowPendingInviteProfile?: boolean } = {}
) {
  const rawAuthHeader = req.headers.get('Authorization') || '';
  const bearerToken = rawAuthHeader.toLowerCase().startsWith('bearer ')
    ? rawAuthHeader.slice(7).trim()
    : '';

  if (!bearerToken) {
    return {
      ok: false as const,
      response: errorResponse(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Bearer Authorization header.'),
    };
  }

  // Client 1: Isolated caller client (publishable key + incoming caller JWT only)
  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  let callerAuthUser: Record<string, any> | null = null;
  try {
    const { data, error } = await callerClient.auth.getUser();
    if (error || !data?.user?.id) {
      return {
        ok: false as const,
        response: errorResponse(401, 'UNAUTHORIZED', 'Caller authentication failed.'),
      };
    }
    callerAuthUser = data.user;
  } catch {
    return {
      ok: false as const,
      response: errorResponse(401, 'UNAUTHORIZED', 'Caller authentication failed.'),
    };
  }

  if (isAuthUserBanned(callerAuthUser)) {
    return {
      ok: false as const,
      response: errorResponse(403, 'ACCOUNT_INACTIVE', 'Your studio account is currently disabled.'),
    };
  }

  // Fetch authoritative caller profile via privileged client (never trust client-supplied roles)
  let callerProfile: ProfileRow | null = null;
  try {
    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', callerAuthUser.id)
      .maybeSingle();

    if (profileError) {
      return {
        ok: false as const,
        response: errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Privileged caller profile lookup failed.'),
      };
    }
    callerProfile = (profileData as ProfileRow | null) ?? null;
  } catch {
    return {
      ok: false as const,
      response: errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Privileged caller profile lookup failed.'),
    };
  }

  if (!callerProfile) {
    const isFreshInvitedAccount =
      options.allowPendingInviteProfile === true &&
      typeof callerAuthUser.invited_at === 'string' &&
      callerAuthUser.invited_at.length > 0 &&
      callerAuthUser.app_metadata?.password_setup_required !== false &&
      !callerAuthUser.app_metadata?.password_setup_completed_at;

    if (isFreshInvitedAccount) {
      return {
        ok: false as const,
        response: errorResponse(
          503,
          'PROVISIONING_IN_PROGRESS',
          'Your studio Editor profile is still being finalized. Please wait a few seconds and retry setting your password.',
          {
            retryable: true,
            retry_after_seconds: 3,
          }
        ),
      };
    }

    return {
      ok: false as const,
      response: errorResponse(403, 'PROFILE_NOT_FOUND', 'No studio profile exists for this account.'),
    };
  }

  if (callerProfile.is_active !== true) {
    return {
      ok: false as const,
      response: errorResponse(403, 'ACCOUNT_INACTIVE', 'Your studio account is currently disabled.'),
    };
  }

  return {
    ok: true as const,
    callerAuthUser,
    callerProfile,
  };
}

function buildStatusSummaryPayload(params: {
  teamMember: TeamMemberRow;
  profile: ProfileRow | null;
  authUser: Record<string, any> | null;
}) {
  const { teamMember, profile, authUser } = params;
  const computed = computeEditorAccountStatus({ teamMember, profile, authUser });
  return {
    team_member_id: teamMember.id,
    profile_id: teamMember.profile_id || null,
    account_status: computed.account_status,
    team_member_active: isTeamMemberActive(teamMember),
    team_member_directory_active: teamMember.active === true,
    team_member_status: teamMember.status || null,
    is_editor_category: hasEditorCategory(teamMember.categories),
    profile_role: profile?.role ? normalizeRole(profile.role) : null,
    profile_is_active: computed.profile_is_active,
    auth_banned: computed.auth_banned,
    email_confirmed: computed.email_confirmed,
    password_setup_required: computed.password_setup_required,
    invited_at: computed.invited_at,
    last_sign_in_at: computed.last_sign_in_at,
    integrity_warning: computed.integrity_warning,
  };
}

async function handleInviteEditor(adminClient: any, body: Record<string, unknown>) {
  // Reject any attempt to supply a non-editor or free-form role
  if (
    body.role !== undefined &&
    body.role !== null &&
    String(body.role).trim().toLowerCase() !== 'editor'
  ) {
    return errorResponse(
      400,
      'INVALID_ROLE_SCOPE',
      'Only Editor accounts may be invited through this onboarding endpoint.'
    );
  }

  const teamMemberId = typeof body.team_member_id === 'string' ? body.team_member_id.trim() : '';
  if (!isValidUuid(teamMemberId)) {
    return errorResponse(400, 'INVALID_TEAM_MEMBER_ID', 'A valid team_member_id UUID is required.');
  }

  const emailCheck = normalizeAndValidateEmail(body.email);
  if (!emailCheck.valid) {
    return errorResponse(400, 'INVALID_EMAIL', emailCheck.error || 'Invalid invitation email.');
  }
  const normalizedEmail = emailCheck.email;

  const redirectCheck = validateRedirectTo(body.redirect_to);
  if (!redirectCheck.valid) {
    return errorResponse(400, 'INVALID_REDIRECT_URL', redirectCheck.error || 'Invalid redirect URL.');
  }
  const redirectTo = redirectCheck.redirectTo;

  // 1. Load exact Team Member record by ID (never match by name or email)
  const { data: tmData, error: tmErr } = await adminClient
    .from('team_members')
    .select('id, profile_id, name, email, active, status, categories')
    .eq('id', teamMemberId)
    .maybeSingle();

  if (tmErr) {
    return errorResponse(500, 'TEAM_MEMBER_LOOKUP_FAILED', 'Could not load Team Member record.');
  }
  if (!tmData) {
    return errorResponse(404, 'TEAM_MEMBER_NOT_FOUND', 'Selected Team Member record was not found.');
  }

  const teamMember = tmData as TeamMemberRow;

  if (!isTeamMemberActive(teamMember)) {
    return errorResponse(
      409,
      'TEAM_MEMBER_INACTIVE',
      'Only active Team Members with status Active can be invited to the portal.'
    );
  }

  if (!hasEditorCategory(teamMember.categories)) {
    return errorResponse(
      400,
      'TEAM_MEMBER_NOT_EDITOR',
      'Selected Team Member must include Editor in their categories.'
    );
  }

  // If Team Member already has profile_id linked, do not re-invite or overwrite
  if (teamMember.profile_id) {
    const [{ data: existingProfile }, { data: existingAuthData }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', teamMember.profile_id)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(teamMember.profile_id),
    ]);

    const statusInfo = computeEditorAccountStatus({
      teamMember,
      profile: (existingProfile as ProfileRow | null) ?? null,
      authUser: existingAuthData?.user ?? null,
    });

    const isPending = statusInfo.account_status === 'Invitation Pending';
    return errorResponse(
      409,
      isPending ? 'INVITATION_ALREADY_PENDING' : 'TEAM_MEMBER_ALREADY_LINKED',
      isPending
        ? 'An invitation has already been provisioned for this Team Member and is awaiting password setup.'
        : 'This Team Member is already linked to an existing portal account.',
      {
        account_status: statusInfo.account_status,
        profile_id: teamMember.profile_id,
      }
    );
  }

  // 2. Inspect existing Auth users and profiles before calling inviteUserByEmail
  const [authListResult, profileMatchResult] = await Promise.all([
    listAllAuthUsers(adminClient),
    findProfilesByNormalizedEmail(adminClient, normalizedEmail),
  ]);

  if (authListResult.error || profileMatchResult.error) {
    return errorResponse(
      500,
      'PRECHECK_FAILED',
      authListResult.error || profileMatchResult.error || 'Could not inspect existing accounts.'
    );
  }

  const matchingAuthUsers = authListResult.users.filter(
    u => (u.email || '').trim().toLowerCase() === normalizedEmail
  );
  if (matchingAuthUsers.length > 1) {
    return errorResponse(
      409,
      'AMBIGUOUS_AUTH_ACCOUNTS',
      'Multiple Auth records match this email. Manual review is required before provisioning.'
    );
  }

  const existingAuthUser = matchingAuthUsers[0] || null;
  const matchingProfiles = profileMatchResult.profiles;
  if (matchingProfiles.length > 1) {
    return errorResponse(
      409,
      'AMBIGUOUS_PROFILE_ACCOUNTS',
      'Multiple profile records match this email. Manual review is required before provisioning.'
    );
  }
  const existingEmailProfile = matchingProfiles[0] || null;

  if (
    existingEmailProfile &&
    existingAuthUser &&
    existingEmailProfile.id !== existingAuthUser.id
  ) {
    return errorResponse(
      409,
      'PROFILE_AUTH_MISMATCH',
      'An existing profile for this email does not match the Auth user ID. Resolve manually before inviting.'
    );
  }

  if (existingEmailProfile && !isEditorRole(existingEmailProfile.role)) {
    return errorResponse(
      409,
      'EXISTING_NON_EDITOR_ACCOUNT',
      'This email already belongs to a non-editor studio profile and cannot be provisioned as an Editor.'
    );
  }

  const candidateExistingId = existingAuthUser?.id || existingEmailProfile?.id || null;
  if (candidateExistingId) {
    const { data: linkedElsewhere, error: linkedElsewhereErr } = await adminClient
      .from('team_members')
      .select('id')
      .eq('profile_id', candidateExistingId)
      .neq('id', teamMember.id)
      .limit(1);

    if (linkedElsewhereErr) {
      return errorResponse(500, 'LINK_CHECK_FAILED', 'Could not verify existing Team Member links.');
    }

    if (Array.isArray(linkedElsewhere) && linkedElsewhere.length > 0) {
      return errorResponse(
        409,
        'EMAIL_LINKED_TO_OTHER_MEMBER',
        'This email is already linked to a different Team Member record.'
      );
    }
  }

  // Determine whether an existing Auth user is an unconfirmed partial-provisioning match for THIS Team Member
  let targetUserId: string | null = null;
  let targetAppMetadata: Record<string, any> = {};
  let emailSent = false;
  let recoveredPartialProvisioning = false;

  if (existingAuthUser) {
    const alreadyConfirmedOrSignedIn = Boolean(
      existingAuthUser.email_confirmed_at || existingAuthUser.last_sign_in_at
    );
    // Trust ONLY server-controlled app_metadata (never user_metadata) for recovery identity
    const serverTaggedMemberId =
      typeof existingAuthUser.app_metadata?.invited_team_member_id === 'string'
        ? existingAuthUser.app_metadata.invited_team_member_id.trim()
        : null;

    if (alreadyConfirmedOrSignedIn || isAuthUserBanned(existingAuthUser)) {
      return errorResponse(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An Auth account with this email already exists. Use a different email or resolve the existing account first.'
      );
    }

    if (!serverTaggedMemberId || serverTaggedMemberId !== teamMember.id) {
      return errorResponse(
        409,
        'MANUAL_RECONCILIATION_REQUIRED',
        serverTaggedMemberId
          ? 'An unconfirmed Auth account with this email carries server invitation metadata for a different Team Member. Automatic linking was blocked; reconcile manually without deleting active accounts.'
          : 'An unconfirmed Auth account with this email exists without a server-authorized invited_team_member_id marker. Automatic recovery was blocked for security; reconcile manually in Supabase before retrying.',
        {
          recoverable: false,
          manual_reconciliation_required: true,
        }
      );
    }

    // Safe idempotent recovery of a prior partial failure for this exact Team Member
    targetUserId = existingAuthUser.id;
    targetAppMetadata =
      existingAuthUser.app_metadata && typeof existingAuthUser.app_metadata === 'object'
        ? { ...existingAuthUser.app_metadata }
        : {};
    recoveredPartialProvisioning = true;
  } else {
    if (existingEmailProfile) {
      return errorResponse(
        409,
        'ORPHAN_PROFILE_EXISTS',
        'A studio profile already exists for this email without a matching Auth user. Resolve manually before inviting.'
      );
    }

    // 3. Issue invitation via Supabase inviteUserByEmail()
    const inviteOptions: Record<string, any> = {
      data: {
        full_name: teamMember.name,
        team_member_id: teamMember.id,
      },
    };
    if (redirectTo) {
      inviteOptions.redirectTo = redirectTo;
    }

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, inviteOptions);

    if (inviteError || !inviteData?.user?.id) {
      // Do not assume auth_user_created is false: Supabase Auth may create an unconfirmed user before email delivery fails
      let observedAuthUser: Record<string, any> | null = null;
      let postCheckIndeterminate = false;
      try {
        const postAuthList = await listAllAuthUsers(adminClient);
        if (postAuthList.error) {
          postCheckIndeterminate = true;
        } else {
          observedAuthUser =
            postAuthList.users.find(
              u => (u.email || '').trim().toLowerCase() === normalizedEmail
            ) || null;
        }
      } catch {
        postCheckIndeterminate = true;
      }

      const authUserCreatedState = observedAuthUser
        ? true
        : postCheckIndeterminate
          ? 'unknown'
          : 'unknown_unobserved';

      return errorResponse(
        502,
        'INVITE_DELIVERY_FAILED',
        observedAuthUser
          ? 'Invitation email delivery reported an error after Supabase created an unconfirmed Auth user without server onboarding metadata. Reconcile manually in Supabase Auth before retrying (do not delete accounts automatically).'
          : 'Supabase reported an invitation delivery failure and it cannot be verified automatically whether the Auth record was persisted. Inspect Supabase Auth users for this email and reconcile manually before retrying.',
        {
          recoverable: false,
          manual_reconciliation_required: true,
          partial_state: {
            auth_user_created: authUserCreatedState,
            app_metadata_updated: false,
            profile_created: false,
            team_member_linked: false,
          },
          reconciliation_guidance:
            'Verify whether an unconfirmed Auth user exists for this email in Supabase Authentication, check Auth email/rate-limit logs, and confirm no orphan profile or partial account exists before retrying.',
        }
      );
    }

    targetUserId = inviteData.user.id;
    targetAppMetadata =
      inviteData.user.app_metadata && typeof inviteData.user.app_metadata === 'object'
        ? { ...inviteData.user.app_metadata }
        : {};
    emailSent = true;
  }

  // 4. Mark app_metadata.password_setup_required = true via privileged Auth Admin API
  let appMetadataUpdated = false;
  let profileReady = false;
  let teamMemberLinked = false;

  const { error: metaErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
    app_metadata: {
      ...targetAppMetadata,
      password_setup_required: true,
      onboarding_role: 'editor',
      invited_team_member_id: teamMember.id,
    },
  });

  if (metaErr) {
    return errorResponse(
      502,
      'PARTIAL_PROVISIONING_FAILURE',
      'Invitation user exists, but onboarding security metadata could not be saved. No user or profile was deleted; retry Invite to complete provisioning.',
      {
        recoverable: true,
        profile_id: targetUserId,
        email_sent: emailSent,
        partial_state: {
          auth_user_created: true,
          app_metadata_updated: false,
          profile_created: Boolean(existingEmailProfile),
          team_member_linked: false,
        },
      }
    );
  }
  appMetadataUpdated = true;

  // 5. Explicitly create (or verify) the Editor profile row in public.profiles (role='editor', is_active=true)
  const { data: profileById, error: profileByIdErr } = await adminClient
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileByIdErr) {
    return errorResponse(
      502,
      'PARTIAL_PROVISIONING_FAILURE',
      'Invitation user exists, but studio profile lookup failed before linking. Retry Invite safely to finish provisioning.',
      {
        recoverable: true,
        profile_id: targetUserId,
        email_sent: emailSent,
        partial_state: {
          auth_user_created: true,
          app_metadata_updated: appMetadataUpdated,
          profile_created: false,
          team_member_linked: false,
        },
      }
    );
  }

  if (profileById) {
    const existingRow = profileById as ProfileRow;
    if (!isEditorRole(existingRow.role)) {
      return errorResponse(
        409,
        'PROFILE_ROLE_CONFLICT',
        'An existing studio profile with a non-editor role uses this ID. Provisioning stopped without overwriting.'
      );
    }

    if (existingRow.is_active !== true) {
      return errorResponse(
        409,
        'PROFILE_DISABLED_CONFLICT',
        'An existing Editor profile for this account is disabled (is_active = false). Provisioning will not automatically reactivate a disabled profile; explicit Admin/Manager review is required.',
        {
          recoverable: false,
          manual_review_required: true,
          profile_id: targetUserId,
          partial_state: {
            auth_user_created: true,
            app_metadata_updated: appMetadataUpdated,
            profile_created: true,
            team_member_linked: false,
          },
        }
      );
    }

    if (
      (existingRow.email || '').trim().toLowerCase() !== normalizedEmail ||
      (existingRow.full_name || '').trim() !== teamMember.name.trim()
    ) {
      const { error: repairProfileErr } = await adminClient
        .from('profiles')
        .update({
          email: normalizedEmail,
          full_name: teamMember.name,
        })
        .eq('id', targetUserId);

      if (repairProfileErr) {
        return errorResponse(
          502,
          'PARTIAL_PROVISIONING_FAILURE',
          'Could not finalize the Editor profile record. Retry Invite safely to finish provisioning.',
          {
            recoverable: true,
            profile_id: targetUserId,
            email_sent: emailSent,
            partial_state: {
              auth_user_created: true,
              app_metadata_updated: appMetadataUpdated,
              profile_created: true,
              team_member_linked: false,
            },
          }
        );
      }
    }
    profileReady = true;
  } else {
    const { error: insertProfileErr } = await adminClient
      .from('profiles')
      .insert({
        id: targetUserId,
        email: normalizedEmail,
        full_name: teamMember.name,
        role: 'editor',
        is_active: true,
      });

    if (insertProfileErr) {
      return errorResponse(
        502,
        'PARTIAL_PROVISIONING_FAILURE',
        'Invitation Auth account was created, but creating the Editor profile record failed. Retry Invite safely to complete linking without deleting the user.',
        {
          recoverable: true,
          profile_id: targetUserId,
          email_sent: emailSent,
          partial_state: {
            auth_user_created: true,
            app_metadata_updated: appMetadataUpdated,
            profile_created: false,
            team_member_linked: false,
          },
        }
      );
    }
    profileReady = true;
  }

  // 6. Link the exact Team Member row via profile_id (atomic compare-and-set where profile_id IS NULL)
  const { data: linkedTeamMember, error: linkErr } = await adminClient
    .from('team_members')
    .update({
      profile_id: targetUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teamMember.id)
    .is('profile_id', null)
    .select('id, profile_id')
    .maybeSingle();

  if (linkErr || !linkedTeamMember || linkedTeamMember.profile_id !== targetUserId) {
    return errorResponse(
      502,
      'PARTIAL_PROVISIONING_FAILURE',
      'Editor Auth account and profile exist, but linking profile_id on the Team Member failed. Retry Invite safely to complete linking.',
      {
        recoverable: true,
        profile_id: targetUserId,
        email_sent: emailSent,
        partial_state: {
          auth_user_created: true,
          app_metadata_updated: appMetadataUpdated,
          profile_created: profileReady,
          team_member_linked: false,
        },
      }
    );
  }
  teamMemberLinked = true;

  return jsonResponse({
    success: true,
    action: 'invite_editor',
    team_member_id: teamMember.id,
    profile_id: targetUserId,
    account_status: 'Invitation Pending',
    email_sent: emailSent,
    recovered_partial_provisioning: recoveredPartialProvisioning,
    partial_state: {
      auth_user_created: true,
      app_metadata_updated: appMetadataUpdated,
      profile_created: profileReady,
      team_member_linked: teamMemberLinked,
    },
    message: recoveredPartialProvisioning
      ? 'Existing pending Editor onboarding records were linked safely (no duplicate invite email was sent).'
      : 'Editor invitation email sent and studio profile linked successfully.',
  });
}

async function handleResendInvite(adminClient: any, body: Record<string, unknown>) {
  const teamMemberId = typeof body.team_member_id === 'string' ? body.team_member_id.trim() : '';
  if (!isValidUuid(teamMemberId)) {
    return errorResponse(400, 'INVALID_TEAM_MEMBER_ID', 'A valid team_member_id UUID is required.');
  }

  const { data: tmData, error: tmErr } = await adminClient
    .from('team_members')
    .select('id, profile_id, name, email, active, status, categories')
    .eq('id', teamMemberId)
    .maybeSingle();

  if (tmErr) {
    return errorResponse(500, 'TEAM_MEMBER_LOOKUP_FAILED', 'Could not load Team Member record.');
  }
  if (!tmData) {
    return errorResponse(404, 'TEAM_MEMBER_NOT_FOUND', 'Team Member record was not found.');
  }

  const teamMember = tmData as TeamMemberRow;
  if (!teamMember.profile_id) {
    return errorResponse(
      409,
      'NOT_INVITED',
      'This Team Member has not been invited yet. Use invite_editor instead.',
      { account_status: 'Not Invited', recoverable: true }
    );
  }

  const [{ data: profileData, error: profErr }, authLookup] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', teamMember.profile_id)
      .maybeSingle(),
    lookupAuthUserById(adminClient, teamMember.profile_id),
  ]);

  if (profErr) {
    return errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Could not load linked studio profile.');
  }
  if (authLookup.error) {
    return errorResponse(
      502,
      'AUTH_LOOKUP_FAILED',
      'Failed to verify linked Auth user status. Please retry.'
    );
  }

  const profile = (profileData as ProfileRow | null) ?? null;
  if (profile && !isEditorRole(profile.role)) {
    return errorResponse(
      403,
      'NON_EDITOR_SCOPE',
      'Only Editor accounts are managed by this function.'
    );
  }

  const statusInfo = computeEditorAccountStatus({
    teamMember,
    profile,
    authUser: authLookup.user,
  });

  if (statusInfo.account_status !== 'Invitation Pending') {
    return errorResponse(
      409,
      'INVITE_NOT_PENDING',
      statusInfo.account_status === 'Login Disabled'
        ? 'This Editor login is currently disabled. Re-enable portal login rather than resending an invite.'
        : 'This Editor has already activated their portal login.',
      {
        account_status: statusInfo.account_status,
        supported: false,
        recoverable: true,
      }
    );
  }

  // Never delete an existing Auth user to work around Supabase built-in inviteUserByEmail limits
  return errorResponse(
    422,
    'INVITE_RESEND_UNSUPPORTED',
    'Automatic invite resending is not supported without custom SMTP because Supabase inviteUserByEmail() rejects already-registered unconfirmed users and deleting accounts is unsafe. Ask the Editor to check their original invite email/spam folder, or configure custom SMTP if automated resends are required.',
    {
      supported: false,
      recoverable: true,
      account_status: statusInfo.account_status,
      profile_id: teamMember.profile_id,
    }
  );
}

async function handleAccountStatus(adminClient: any, body: Record<string, unknown>) {
  const singleId = typeof body.team_member_id === 'string' ? body.team_member_id.trim() : '';
  const rawList = Array.isArray(body.team_member_ids) ? body.team_member_ids : null;

  if (body.team_member_id !== undefined && !isValidUuid(singleId)) {
    return errorResponse(400, 'INVALID_TEAM_MEMBER_ID', 'team_member_id must be a valid UUID.');
  }

  let requestedIds: string[] | null = null;
  if (singleId) {
    requestedIds = [singleId];
  } else if (rawList) {
    const cleaned: string[] = [];
    for (const item of rawList) {
      if (!isValidUuid(item)) {
        return errorResponse(400, 'INVALID_TEAM_MEMBER_ID', 'All team_member_ids entries must be valid UUIDs.');
      }
      cleaned.push(item.trim());
    }
    requestedIds = Array.from(new Set(cleaned));
  }

  if (requestedIds && requestedIds.length === 0) {
    return jsonResponse({
      success: true,
      action: 'account_status',
      accounts: [],
    });
  }

  let tmQuery = adminClient
    .from('team_members')
    .select('id, profile_id, name, email, active, status, categories');

  if (requestedIds && requestedIds.length > 0) {
    tmQuery = tmQuery.in('id', requestedIds);
  }

  const { data: tmRows, error: tmErr } = await tmQuery;
  if (tmErr) {
    return errorResponse(500, 'TEAM_MEMBER_LOOKUP_FAILED', 'Could not load Team Member records.');
  }

  const teamMembers = (Array.isArray(tmRows) ? tmRows : []) as TeamMemberRow[];
  if (singleId && teamMembers.length === 0) {
    return errorResponse(404, 'TEAM_MEMBER_NOT_FOUND', 'Team Member record was not found.');
  }

  const linkedProfileIds = Array.from(
    new Set(
      teamMembers
        .map(tm => tm.profile_id)
        .filter((pid): pid is string => typeof pid === 'string' && pid.trim().length > 0)
    )
  );

  const profileMap = new Map<string, ProfileRow>();
  const authUserMap = new Map<string, Record<string, any>>();

  if (linkedProfileIds.length > 0) {
    const { data: profileRows, error: profErr } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .in('id', linkedProfileIds);

    if (profErr) {
      return errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Could not load linked studio profiles.');
    }

    for (const row of (profileRows || []) as ProfileRow[]) {
      profileMap.set(row.id, row);
    }

    if (linkedProfileIds.length <= 10) {
      const authLookups = await Promise.all(
        linkedProfileIds.map(async pid => ({
          pid,
          result: await lookupAuthUserById(adminClient, pid),
        }))
      );
      for (const { pid, result } of authLookups) {
        if (result.error) {
          return errorResponse(
            502,
            'AUTH_LOOKUP_FAILED',
            'Failed to verify linked Auth user status. Please retry.'
          );
        }
        if (result.user) {
          authUserMap.set(pid, result.user);
        }
      }
    } else {
      const authListResult = await listAllAuthUsers(adminClient);
      if (authListResult.error) {
        return errorResponse(500, 'AUTH_LOOKUP_FAILED', authListResult.error);
      }
      for (const user of authListResult.users) {
        if (user?.id) {
          authUserMap.set(user.id, user);
        }
      }
    }
  }

  const statuses = teamMembers.map(tm =>
    buildStatusSummaryPayload({
      teamMember: tm,
      profile: tm.profile_id ? profileMap.get(tm.profile_id) ?? null : null,
      authUser: tm.profile_id ? authUserMap.get(tm.profile_id) ?? null : null,
    })
  );

  if (singleId) {
    return jsonResponse({
      success: true,
      action: 'account_status',
      ...statuses[0],
    });
  }

  return jsonResponse({
    success: true,
    action: 'account_status',
    accounts: statuses,
  });
}

async function handleSetAccountActive(
  adminClient: any,
  callerUserId: string,
  body: Record<string, unknown>
) {
  const teamMemberId = typeof body.team_member_id === 'string' ? body.team_member_id.trim() : '';
  if (!isValidUuid(teamMemberId)) {
    return errorResponse(400, 'INVALID_TEAM_MEMBER_ID', 'A valid team_member_id UUID is required.');
  }

  const hasLoginActive = typeof body.login_active === 'boolean';
  const hasTeamMemberActive = typeof body.team_member_active === 'boolean';

  if (!hasLoginActive && !hasTeamMemberActive) {
    return errorResponse(
      400,
      'MISSING_ACTIVE_FLAGS',
      'Provide boolean login_active and/or team_member_active.'
    );
  }

  const loginActive = hasLoginActive ? (body.login_active as boolean) : undefined;
  const teamMemberActive = hasTeamMemberActive ? (body.team_member_active as boolean) : undefined;

  const { data: tmData, error: tmErr } = await adminClient
    .from('team_members')
    .select('id, profile_id, name, email, active, status, categories')
    .eq('id', teamMemberId)
    .maybeSingle();

  if (tmErr) {
    return errorResponse(500, 'TEAM_MEMBER_LOOKUP_FAILED', 'Could not load Team Member record.');
  }
  if (!tmData) {
    return errorResponse(404, 'TEAM_MEMBER_NOT_FOUND', 'Team Member record was not found.');
  }

  let teamMember = tmData as TeamMemberRow;
  let linkedProfile: ProfileRow | null = null;
  let linkedAuthUser: Record<string, any> | null = null;

  if (teamMember.profile_id) {
    if (teamMember.profile_id === callerUserId) {
      return errorResponse(
        403,
        'SELF_MODIFICATION_FORBIDDEN',
        'You cannot enable or disable your own portal account using this endpoint.'
      );
    }

    const [{ data: profData, error: profErr }, { data: authData, error: authErr }] =
      await Promise.all([
        adminClient
          .from('profiles')
          .select('id, email, full_name, role, is_active')
          .eq('id', teamMember.profile_id)
          .maybeSingle(),
        adminClient.auth.admin.getUserById(teamMember.profile_id),
      ]);

    if (profErr || authErr) {
      return errorResponse(
        500,
        'LINKED_ACCOUNT_LOOKUP_FAILED',
        'Could not inspect the linked Editor account.'
      );
    }

    linkedProfile = (profData as ProfileRow | null) ?? null;
    linkedAuthUser = authData?.user ?? null;

    if (!linkedProfile) {
      return errorResponse(
        409,
        'LINKED_PROFILE_MISSING',
        'The linked profile record could not be found.'
      );
    }

    if (!isEditorRole(linkedProfile.role)) {
      return errorResponse(
        403,
        'NON_EDITOR_SCOPE',
        'Only Editor accounts can be modified via this endpoint.'
      );
    }
  } else if (loginActive !== undefined) {
    return errorResponse(
      409,
      'NOT_INVITED',
      'Cannot change portal login state because this Team Member has not been invited yet.',
      { account_status: 'Not Invited' }
    );
  }

  // Update Team Member directory status only when explicitly requested
  if (teamMemberActive !== undefined) {
    const { data: updatedTm, error: tmUpdateErr } = await adminClient
      .from('team_members')
      .update({
        active: teamMemberActive,
        status: teamMemberActive ? 'Active' : 'Inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamMember.id)
      .select('id, profile_id, name, email, active, status, categories')
      .single();

    if (tmUpdateErr || !updatedTm) {
      return errorResponse(
        500,
        'TEAM_MEMBER_UPDATE_FAILED',
        'Could not update Team Member directory activity status.'
      );
    }
    teamMember = updatedTm as TeamMemberRow;
  }

  // Update portal login activity (profiles.is_active + Auth ban_duration) without deleting any records
  if (loginActive !== undefined && teamMember.profile_id) {
    if (!linkedAuthUser) {
      return errorResponse(
        409,
        'LINKED_AUTH_MISSING',
        'The linked Auth user could not be found.'
      );
    }

    const nextBanDuration = loginActive ? 'none' : PERMANENT_BAN_DURATION;
    const { data: updatedAuth, error: authUpdateErr } =
      await adminClient.auth.admin.updateUserById(teamMember.profile_id, {
        ban_duration: nextBanDuration,
      });

    if (authUpdateErr || !updatedAuth?.user) {
      return errorResponse(
        502,
        'AUTH_BAN_UPDATE_FAILED',
        'Could not update portal login restriction in Supabase Auth. Retry safely.',
        { recoverable: true }
      );
    }
    linkedAuthUser = updatedAuth.user;

    const { data: updatedProfile, error: profUpdateErr } = await adminClient
      .from('profiles')
      .update({ is_active: loginActive })
      .eq('id', teamMember.profile_id)
      .select('id, email, full_name, role, is_active')
      .single();

    if (profUpdateErr || !updatedProfile) {
      return errorResponse(
        502,
        'PROFILE_ACTIVE_UPDATE_FAILED',
        'Auth ban state was updated, but profiles.is_active could not be saved. Retry safely to synchronize.',
        { recoverable: true }
      );
    }
    linkedProfile = updatedProfile as ProfileRow;
  }

  return jsonResponse({
    success: true,
    action: 'set_account_active',
    ...buildStatusSummaryPayload({
      teamMember,
      profile: linkedProfile,
      authUser: linkedAuthUser,
    }),
  });
}

async function handleCompleteInvitePasswordSetup(
  adminClient: any,
  callerAuthUser: Record<string, any>,
  callerProfile: ProfileRow,
  body: Record<string, unknown>
) {
  if (!isEditorRole(callerProfile.role) || callerProfile.is_active !== true) {
    return errorResponse(
      403,
      'FORBIDDEN_ROLE',
      'Only an active invited Editor account can complete Editor password setup.'
    );
  }

  // Reject attempts to submit role or protected metadata changes
  if (
    body.role !== undefined ||
    body.app_metadata !== undefined ||
    body.user_metadata !== undefined ||
    body.profile_id !== undefined
  ) {
    return errorResponse(
      400,
      'PROTECTED_FIELDS_FORBIDDEN',
      'Role and metadata fields cannot be supplied during password setup.'
    );
  }

  // Fetch authoritative Auth record to check live app_metadata & ban status
  const { data: freshAuthData, error: freshAuthErr } =
    await adminClient.auth.admin.getUserById(callerAuthUser.id);

  if (freshAuthErr || !freshAuthData?.user) {
    return errorResponse(
      403,
      'AUTH_ACCOUNT_UNAVAILABLE',
      'Unable to verify your invitation account.'
    );
  }

  const freshAuthUser = freshAuthData.user;
  if (isAuthUserBanned(freshAuthUser)) {
    return errorResponse(
      403,
      'ACCOUNT_DISABLED',
      'Your portal login has been disabled. Contact an Administrator or Manager.'
    );
  }

  if (freshAuthUser.app_metadata?.password_setup_required !== true) {
    const alreadyCompleted =
      freshAuthUser.app_metadata?.password_setup_required === false ||
      Boolean(freshAuthUser.app_metadata?.password_setup_completed_at);

    if (!alreadyCompleted && typeof freshAuthUser.invited_at === 'string' && freshAuthUser.invited_at.length > 0) {
      return errorResponse(
        503,
        'PROVISIONING_IN_PROGRESS',
        'Your invitation onboarding security metadata is still being finalized. Please wait a few seconds and retry setting your password.',
        {
          retryable: true,
          retry_after_seconds: 3,
        }
      );
    }

    return errorResponse(
      403,
      'PASSWORD_SETUP_NOT_REQUIRED',
      'Initial invitation password setup is not pending for this account.'
    );
  }

  // Verify unique linked Editor Team Member record (directory activity is independent of portal login)
  const { data: linkedMembers, error: linkedErr } = await adminClient
    .from('team_members')
    .select('id, profile_id, name, email, active, status, categories')
    .eq('profile_id', callerAuthUser.id);

  if (linkedErr) {
    return errorResponse(
      500,
      'TEAM_MEMBER_LOOKUP_FAILED',
      'Could not verify linked Team Member eligibility.'
    );
  }

  const matches = Array.isArray(linkedMembers) ? (linkedMembers as TeamMemberRow[]) : [];
  if (matches.length === 0) {
    return errorResponse(
      503,
      'PROVISIONING_IN_PROGRESS',
      'Your Editor account link is still being finalized. Please wait a few seconds and retry; if this persists, ask an Admin or Manager to complete your invite setup.',
      {
        retryable: true,
        retry_after_seconds: 3,
      }
    );
  }

  if (matches.length > 1) {
    return errorResponse(
      403,
      'TEAM_MEMBER_LINK_INVALID',
      'Your Editor account is not uniquely linked to a Team Member record.'
    );
  }

  const linkedMember = matches[0];
  if (linkedMember.profile_id !== callerAuthUser.id || !hasEditorCategory(linkedMember.categories)) {
    return errorResponse(
      403,
      'TEAM_MEMBER_INELIGIBLE',
      'Your linked Team Member record must include the Editor category and match your portal account to complete setup.'
    );
  }

  const expectedMemberId = freshAuthUser.app_metadata?.invited_team_member_id;
  if (typeof expectedMemberId !== 'string' || !expectedMemberId || expectedMemberId !== linkedMember.id) {
    return errorResponse(
      403,
      'TEAM_MEMBER_LINK_MISMATCH',
      'Invitation metadata is missing or does not match the linked Team Member record.'
    );
  }

  const isEmailConfirmed =
    typeof freshAuthUser.email_confirmed_at === 'string' &&
    freshAuthUser.email_confirmed_at.trim().length > 0;
  if (!isEmailConfirmed) {
    return errorResponse(
      403,
      'EMAIL_NOT_CONFIRMED',
      'Please open the invitation link sent to your email address to confirm your email before creating a password.'
    );
  }

  const passwordCheck = validateNewPassword(body.new_password);
  if (!passwordCheck.valid) {
    return errorResponse(
      400,
      'INVALID_PASSWORD',
      passwordCheck.error || 'Please provide a valid password.'
    );
  }

  const newPassword = body.new_password as string;
  const existingAppMeta =
    freshAuthUser.app_metadata && typeof freshAuthUser.app_metadata === 'object'
      ? { ...freshAuthUser.app_metadata }
      : {};

  // Single atomic Auth Admin update setting password and clearing password_setup_required together
  const { data: updatedUserResp, error: updateErr } =
    await adminClient.auth.admin.updateUserById(callerAuthUser.id, {
      password: newPassword,
      app_metadata: {
        ...existingAppMeta,
        password_setup_required: false,
        password_setup_completed_at: new Date().toISOString(),
      },
    });

  if (
    updateErr ||
    !updatedUserResp?.user ||
    updatedUserResp.user.app_metadata?.password_setup_required !== false
  ) {
    return errorResponse(
      500,
      'PASSWORD_SETUP_FAILED',
      'Could not save your password cleanly. Please try again.'
    );
  }

  // Verify resulting Auth user confirmation without blindly setting email_confirm: true
  // so unverified email addresses are never force-confirmed.
  const resultStatus = computeEditorAccountStatus({
    teamMember: linkedMember,
    profile: callerProfile,
    authUser: updatedUserResp.user,
  });

  if (!resultStatus.email_confirmed) {
    return jsonResponse({
      success: true,
      action: 'complete_invite_password_setup',
      team_member_id: linkedMember.id,
      profile_id: callerAuthUser.id,
      password_setup_required: false,
      email_confirmed: false,
      account_status: resultStatus.account_status,
      message:
        'Password saved, but email confirmation is still pending before portal login becomes active.',
    });
  }

  return jsonResponse({
    success: true,
    action: 'complete_invite_password_setup',
    team_member_id: linkedMember.id,
    profile_id: callerAuthUser.id,
    password_setup_required: false,
    email_confirmed: true,
    account_status: resultStatus.account_status,
    message: 'Password created successfully.',
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (req.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const publishableKey =
      parseDefaultKeyFromJsonEnv('SUPABASE_PUBLISHABLE_KEYS') ||
      Deno.env.get('SUPABASE_ANON_KEY')?.trim() ||
      '';
    const secretKey = parseDefaultKeyFromJsonEnv('SUPABASE_SECRET_KEYS') || '';

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return errorResponse(
        500,
        'SERVER_CONFIGURATION_MISSING',
        'Required Edge Function configuration is missing.'
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return errorResponse(400, 'INVALID_JSON_BODY', 'Request body must be a JSON object.');
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return errorResponse(400, 'INVALID_JSON_BODY', 'Malformed JSON request body.');
    }

    const rawAction = typeof body.action === 'string' ? body.action.trim() : '';
    const supportedActions: ActionName[] = [
      'invite_editor',
      'account_status',
      'set_account_active',
      'complete_invite_password_setup',
      'resend_invite',
    ];

    if (!supportedActions.includes(rawAction as ActionName)) {
      return errorResponse(400, 'INVALID_ACTION', 'Unsupported or missing account action.');
    }
    const action = rawAction as ActionName;

    // Client 2: Isolated Privileged Client (SUPABASE_SECRET_KEYS.default; NEVER receives caller headers)
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const authResult = await authenticateCaller(req, supabaseUrl, publishableKey, adminClient, {
      allowPendingInviteProfile: action === 'complete_invite_password_setup',
    });
    if (!authResult.ok) {
      return authResult.response;
    }

    const { callerAuthUser, callerProfile } = authResult;

    if (action === 'complete_invite_password_setup') {
      return await handleCompleteInvitePasswordSetup(
        adminClient,
        callerAuthUser,
        callerProfile,
        body
      );
    }

    // All management actions require active Admin or Manager profile
    if (!isAdminOrManagerRole(callerProfile.role)) {
      return errorResponse(
        403,
        'FORBIDDEN_ROLE',
        'Only active Admin and Manager accounts may manage Editor portal accounts.'
      );
    }

    switch (action) {
      case 'invite_editor':
        return await handleInviteEditor(adminClient, body);
      case 'account_status':
        return await handleAccountStatus(adminClient, body);
      case 'set_account_active':
        return await handleSetAccountActive(adminClient, callerAuthUser.id, body);
      case 'resend_invite':
        return await handleResendInvite(adminClient, body);
    }
  } catch {
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while processing the request.'
    );
  }
});
