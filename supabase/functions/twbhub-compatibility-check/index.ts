// @ts-nocheck — Deno Edge Function runtime (excluded from browser bundle; verified separately in Deno)
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CompatibilityCheckResponse {
  caller_authenticated: boolean;
  caller_is_admin: boolean;
  admin_api_success: boolean;
  privileged_profile_read_success: boolean;
  profile_role: string | null;
  profile_is_active: boolean | null;
  effective_database_role: string | null;
  database_current_user: string | null;
  errors: string[];
}

function jsonResponse(payload: CompatibilityCheckResponse, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        database_current_user: null,
        errors: ['Method not allowed.'],
      },
      405
    );
  }

  const errors: string[] = [];

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
  const publishableKey = parseDefaultKeyFromJsonEnv('SUPABASE_PUBLISHABLE_KEYS');
  const secretKey = parseDefaultKeyFromJsonEnv('SUPABASE_SECRET_KEYS');

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        database_current_user: null,
        errors: ['Required Edge Function configuration is missing.'],
      },
      500
    );
  }

  // Extract incoming caller Bearer token
  const rawAuthHeader = req.headers.get('Authorization') || '';
  const bearerToken = rawAuthHeader.toLowerCase().startsWith('bearer ')
    ? rawAuthHeader.slice(7).trim()
    : '';

  if (!bearerToken) {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        database_current_user: null,
        errors: ['Missing or invalid Bearer Authorization header.'],
      },
      401
    );
  }

  // Client 1: Isolated Caller Client (publishable key + incoming Authorization header only)
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

  // Client 2: Isolated Privileged Client (SUPABASE_SECRET_KEYS.default; NEVER receives caller Authorization header)
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  // Check A: Authenticate caller JWT via callerClient.auth.getUser()
  let callerUserId: string | null = null;
  try {
    const { data, error } = await callerClient.auth.getUser();
    if (error || !data?.user?.id) {
      return jsonResponse(
        {
          caller_authenticated: false,
          caller_is_admin: false,
          admin_api_success: false,
          privileged_profile_read_success: false,
          profile_role: null,
          profile_is_active: null,
          effective_database_role: null,
          database_current_user: null,
          errors: ['Caller authentication failed.'],
        },
        401
      );
    }
    callerUserId = data.user.id;
  } catch {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        database_current_user: null,
        errors: ['Caller authentication failed.'],
      },
      401
    );
  }

  // Check C: Read caller's actual database profile via privileged client (read-only).
  let privilegedProfileReadSuccess = false;
  let profileRole: string | null = null;
  let profileIsActive: boolean | null = null;

  try {
    const { data: profileRow, error: profileErr } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerUserId)
      .maybeSingle();

    if (profileErr) {
      errors.push('Privileged profile lookup failed.');
    } else if (!profileRow) {
      errors.push('No profile found for authenticated caller.');
    } else {
      privilegedProfileReadSuccess = true;
      profileRole = typeof profileRow.role === 'string' ? profileRow.role : null;
      profileIsActive = typeof profileRow.is_active === 'boolean' ? profileRow.is_active : null;
    }
  } catch {
    errors.push('Privileged profile lookup failed.');
  }

  const callerIsAdmin =
    privilegedProfileReadSuccess &&
    profileIsActive === true &&
    (profileRole || '').trim().toLowerCase() === 'admin';

  if (!callerIsAdmin) {
    errors.push('Forbidden: an active Admin profile is required.');
    return jsonResponse(
      {
        caller_authenticated: true,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: privilegedProfileReadSuccess,
        profile_role: profileRole,
        profile_is_active: profileIsActive,
        effective_database_role: null,
        database_current_user: null,
        errors,
      },
      403
    );
  }

  // Check B: Harmless read-only Auth Admin endpoint (1-user page; never returns user PII)
  let adminApiSuccess = false;
  try {
    const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (!listErr && Array.isArray(listData?.users)) {
      adminApiSuccess = true;
    } else {
      errors.push('Auth Admin API request failed.');
    }
  } catch {
    errors.push('Auth Admin API request failed.');
  }

  // Check D: Verify effective PostgreSQL role via read-only diagnostic RPC
  let effectiveDatabaseRole: string | null = null;
  let databaseCurrentUser: string | null = null;
  try {
    const { data: roleDiag, error: roleDiagErr } = await adminClient.rpc('twbhub_diag_db_role');
    if (roleDiagErr || !roleDiag || typeof roleDiag !== 'object' || Array.isArray(roleDiag)) {
      errors.push('Database role diagnostic RPC failed.');
    } else {
      const diagRecord = roleDiag as Record<string, unknown>;
      const authRole = typeof diagRecord.auth_role === 'string' ? diagRecord.auth_role : null;
      const currentDbUser =
        typeof diagRecord.current_user === 'string' ? diagRecord.current_user : null;

      if (authRole === null && currentDbUser === null) {
        errors.push('Database role diagnostic RPC failed.');
      } else {
        effectiveDatabaseRole = authRole;
        databaseCurrentUser = currentDbUser;
      }
    }
  } catch {
    effectiveDatabaseRole = null;
    databaseCurrentUser = null;
    errors.push('Database role diagnostic RPC failed.');
  }

  return jsonResponse(
    {
      caller_authenticated: true,
      caller_is_admin: true,
      admin_api_success: adminApiSuccess,
      privileged_profile_read_success: privilegedProfileReadSuccess,
      profile_role: profileRole,
      profile_is_active: profileIsActive,
      effective_database_role: effectiveDatabaseRole,
      database_current_user: databaseCurrentUser,
      errors,
    },
    200
  );
});
