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
  errors: string[];
}

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  return raw
    .replace(/sb_(secret|publishable|temp)_[A-Za-z0-9._-]+/g, '[REDACTED_API_KEY]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .slice(0, 240);
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

function parseDefaultKeyFromJsonEnv(envName: string): { key: string | null; error: string | null } {
  const raw = Deno.env.get(envName);
  if (!raw) {
    return { key: null, error: `Missing ${envName} environment variable.` };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = typeof parsed?.default === 'string' ? parsed.default.trim() : '';
    if (!defaultKey) {
      return { key: null, error: `Missing "default" key entry inside ${envName}.` };
    }
    return { key: defaultKey, error: null };
  } catch {
    return { key: null, error: `Invalid JSON format in ${envName}.` };
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
        errors: ['Method not allowed. Use POST.'],
      },
      405
    );
  }

  const errors: string[] = [];

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
  if (!supabaseUrl) {
    errors.push('Missing SUPABASE_URL environment variable.');
  }

  const publishableResult = parseDefaultKeyFromJsonEnv('SUPABASE_PUBLISHABLE_KEYS');
  if (publishableResult.error) errors.push(publishableResult.error);

  const secretResult = parseDefaultKeyFromJsonEnv('SUPABASE_SECRET_KEYS');
  if (secretResult.error) errors.push(secretResult.error);

  if (!supabaseUrl || !publishableResult.key || !secretResult.key) {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        errors,
      },
      500
    );
  }

  // Extract incoming caller Bearer token
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ') || authHeader.length <= 7) {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        errors: ['Missing or invalid Bearer Authorization header.'],
      },
      401
    );
  }

  // Client 1: Isolated Caller Client (publishable key + incoming Authorization header only)
  const callerClient = createClient(supabaseUrl, publishableResult.key, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  // Client 2: Isolated Privileged Client (SUPABASE_SECRET_KEYS.default; NEVER receives caller Authorization header)
  const adminClient = createClient(supabaseUrl, secretResult.key, {
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
          errors: [
            error
              ? `Caller authentication failed: ${sanitizeErrorMessage(error)}`
              : 'Caller token did not resolve to an active user.',
          ],
        },
        401
      );
    }
    callerUserId = data.user.id;
  } catch (err) {
    return jsonResponse(
      {
        caller_authenticated: false,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
        errors: [`Caller authentication error: ${sanitizeErrorMessage(err)}`],
      },
      401
    );
  }

  // Check C (used to authorize Check A strictly against public.profiles, never user_metadata):
  // Read caller's actual database profile via privileged client (read-only).
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
      errors.push(`Privileged profile read failed: ${sanitizeErrorMessage(profileErr)}`);
    } else if (!profileRow) {
      errors.push('No public.profiles row found for authenticated caller.');
    } else {
      privilegedProfileReadSuccess = true;
      profileRole = typeof profileRow.role === 'string' ? profileRow.role : null;
      profileIsActive = typeof profileRow.is_active === 'boolean' ? profileRow.is_active : null;
    }
  } catch (err) {
    errors.push(`Privileged profile read error: ${sanitizeErrorMessage(err)}`);
  }

  const callerIsAdmin =
    privilegedProfileReadSuccess &&
    profileIsActive === true &&
    (profileRole || '').trim().toLowerCase() === 'admin';

  if (!callerIsAdmin) {
    errors.push('Forbidden: an active Admin profile in public.profiles is required.');
    return jsonResponse(
      {
        caller_authenticated: true,
        caller_is_admin: false,
        admin_api_success: false,
        privileged_profile_read_success: false,
        profile_role: null,
        profile_is_active: null,
        effective_database_role: null,
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
    if (listErr) {
      errors.push(`Auth Admin listUsers failed: ${sanitizeErrorMessage(listErr)}`);
    } else if (Array.isArray(listData?.users)) {
      adminApiSuccess = true;
    } else {
      errors.push('Auth Admin listUsers returned an unexpected response shape.');
    }
  } catch (err) {
    errors.push(`Auth Admin API error: ${sanitizeErrorMessage(err)}`);
  }

  // Check D: Effective PostgreSQL role via PostgREST
  // No safe read-only SQL diagnostic RPC exists in public schema yet, and no DB changes
  // are permitted in Stage 0.5 without explicit approval. Never assume service_role.
  const effectiveDatabaseRole: string | null = null;
  errors.push(
    'effective_database_role not verified: no pre-existing read-only PostgREST diagnostic function exposes auth.role() / current_user without creating a temporary SQL function.'
  );

  return jsonResponse(
    {
      caller_authenticated: true,
      caller_is_admin: true,
      admin_api_success: adminApiSuccess,
      privileged_profile_read_success: privilegedProfileReadSuccess,
      profile_role: profileRole,
      profile_is_active: profileIsActive,
      effective_database_role: effectiveDatabaseRole,
      errors,
    },
    200
  );
});
