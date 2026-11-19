import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, getSupabaseClient } from './supabase';
import { Profile, UserRole } from '../types';

/**
 * Route & View Permission Map for TWBHub
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  Admin: 4,
  Manager: 3,
  'Team Member': 2,
  Editor: 1,
};

export const TAB_PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['Admin', 'Manager'],
  projects: ['Admin', 'Manager'],
  enquiries: ['Admin', 'Manager'],
  clients: ['Admin', 'Manager'],
  calendar: ['Admin', 'Manager'],
  'team-availability': ['Admin', 'Manager'],
  team: ['Admin', 'Manager'],
  'team-members': ['Admin', 'Manager'],
  editors: ['Admin', 'Manager', 'Editor'],
  finance: ['Admin', 'Manager'],
  data: ['Admin', 'Manager', 'Editor'],
  deliverables: ['Admin', 'Manager', 'Editor'],
  notifications: ['Admin', 'Manager'],
  settings: ['Admin', 'Manager'],
};

export interface AuthResponse<T = null> {
  data?: T;
  error: Error | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
}

export type ProfileLookupStatus =
  | 'ok'
  | 'not_found'
  | 'inactive'
  | 'unsupported_role'
  | 'temporary_error';

export interface ProfileLookupResult {
  status: ProfileLookupStatus;
  profile: Profile | null;
  error: Error | null;
  rawRole?: string | null;
}

/**
 * Resolves a raw role string from public.profiles to an active supported UserRole.
 * Only 'admin', 'manager', and 'editor' are supported.
 * Legacy 'team' and any null/unknown/unsupported values fail closed by returning null.
 */
export const resolveVerifiedUserRole = (role?: string | null): UserRole | null => {
  const norm = (role || '').trim().toLowerCase();
  if (norm === 'admin') return 'Admin';
  if (norm === 'manager') return 'Manager';
  if (norm === 'editor') return 'Editor';
  return null;
};

/**
 * Normalizes role strings for permission helpers.
 * Returns null when the role is missing or unsupported (never elevates/falls back to 'Team Member').
 */
export const normalizeUserRole = (role?: string | null): UserRole | null => {
  return resolveVerifiedUserRole(role);
};

/**
 * Retrieves current active Supabase auth session
 */
export const getSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('Error fetching Supabase session:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    console.warn('Failed to retrieve Supabase session:', err);
    return null;
  }
};

/**
 * Retrieves the currently authenticated Supabase user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) {
      const session = await getSession();
      return session?.user ?? null;
    }
    return user;
  } catch (err) {
    console.warn('Failed to retrieve current user:', err);
    return null;
  }
};

const isInvalidAuthSessionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { status?: number; code?: string; message?: string };
  const status = errObj.status;
  const code = (errObj.code || '').toLowerCase();
  const msg = (errObj.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    code === 'user_not_found' ||
    code === 'session_not_found' ||
    code === 'user_banned' ||
    msg.includes('invalid jwt') ||
    msg.includes('user from sub claim') ||
    msg.includes('session from session_id claim') ||
    msg.includes('banned')
  );
};

/**
 * Fetches fresh server-side Auth user metadata via getUser() without falling back to cached JWTs.
 */
export const getAuthoritativeAuthUser = async (): Promise<{
  user: User | null;
  invalidSession: boolean;
  error: Error | null;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      user: null,
      invalidSession: false,
      error: new Error('Supabase connection is not configured.'),
    };
  }
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error) {
      return {
        user: null,
        invalidSession: isInvalidAuthSessionError(error),
        error: new Error(error.message),
      };
    }
    return { user: user ?? null, invalidSession: !user, error: null };
  } catch (err: any) {
    return {
      user: null,
      invalidSession: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

export interface RefreshAuthSessionResult {
  session: Session | null;
  user: User | null;
  authoritativeUser: User | null;
  invalidSession: boolean;
  error: Error | null;
}

/**
 * Refreshes the active Supabase Auth session and fetches authoritative user metadata
 * so updated server-controlled app_metadata flags are reflected immediately without trusting stale tokens.
 */
export const refreshAuthSession = async (): Promise<RefreshAuthSessionResult> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      session: null,
      user: null,
      authoritativeUser: null,
      invalidSession: false,
      error: new Error('Supabase connection is not configured.'),
    };
  }
  try {
    const { data, error } = await client.auth.refreshSession();
    if (error) {
      return {
        session: null,
        user: null,
        authoritativeUser: null,
        invalidSession: isInvalidAuthSessionError(error),
        error: new Error(error.message),
      };
    }

    const refreshedSession = data.session ?? null;
    let freshUser = data.user ?? refreshedSession?.user ?? null;
    let authoritativeUser: User | null = null;
    let lookupError: Error | null = null;

    if (refreshedSession) {
      const userCheck = await getAuthoritativeAuthUser();
      if (userCheck.invalidSession) {
        return {
          session: null,
          user: null,
          authoritativeUser: null,
          invalidSession: true,
          error: userCheck.error ?? new Error('Session is no longer valid.'),
        };
      }
      if (userCheck.user) {
        authoritativeUser = userCheck.user;
        freshUser = userCheck.user;
      } else if (userCheck.error) {
        lookupError = userCheck.error;
      }
    }

    return {
      session: refreshedSession
        ? freshUser
          ? { ...refreshedSession, user: freshUser }
          : refreshedSession
        : null,
      user: freshUser,
      authoritativeUser,
      invalidSession: false,
      error: lookupError,
    };
  } catch (err: any) {
    return {
      session: null,
      user: null,
      authoritativeUser: null,
      invalidSession: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

/**
 * Subscribes to Supabase auth state changes (sign in, sign out, token refresh, password recovery)
 */
export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } => {
  const client = getSupabaseClient() || supabase;
  try {
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(callback);
    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  } catch (err) {
    console.warn('Could not establish auth state listener:', err);
    return { unsubscribe: () => {} };
  }
};

/**
 * Sign in using email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: Error | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      user: null,
      session: null,
      error: new Error('Supabase connection is not configured.'),
    };
  }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { user: null, session: null, error: new Error(error.message) };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return {
      user: null,
      session: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

/**
 * Sign out of current Supabase session
 */
export const signOut = async (): Promise<{ error: Error | null }> => {
  const client = getSupabaseClient() || supabase;
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Requests a password recovery email (delivering a one-time recovery code via Supabase Email Template).
 * Avoids relying on window.location.origin email-link redirects in embedded/iframe environments.
 */
export const resetPasswordForEmail = async (
  email: string,
  redirectTo?: string
): Promise<{ error: Error | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase connection is not configured.') };
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { error: new Error('Please enter your studio email address.') };
  }
  try {
    const options = redirectTo ? { redirectTo } : undefined;
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, options);
    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('security purposes')) {
        return {
          error: new Error('Too many reset requests. Please wait a minute before requesting another code.'),
        };
      }
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Verifies a 6-digit password recovery OTP code via Supabase Auth and establishes a recovery session.
 * Does NOT alter the user's password; updateUserPassword() must still be called explicitly afterward.
 */
export const verifyRecoveryOtp = async (
  email: string,
  token: string
): Promise<{ user: User | null; session: Session | null; error: Error | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      user: null,
      session: null,
      error: new Error('Supabase connection is not configured.'),
    };
  }

  const cleanEmail = email.trim();
  const cleanToken = token.replace(/\s+/g, '');

  if (!cleanEmail) {
    return {
      user: null,
      session: null,
      error: new Error('Please enter your studio email address.'),
    };
  }

  if (!/^\d{6,8}$/.test(cleanToken)) {
    return {
      user: null,
      session: null,
      error: new Error('Please enter the 6-digit numeric recovery code from your email.'),
    };
  }

  try {
    const { data, error } = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'recovery',
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const code = ((error as any).code || '').toLowerCase();

      if (code === 'otp_expired' || msg.includes('expired')) {
        return {
          user: null,
          session: null,
          error: new Error(
            'This recovery code has expired or has already been used. Please request a new code.'
          ),
        };
      }

      if (msg.includes('invalid') || msg.includes('token') || code.includes('otp')) {
        return {
          user: null,
          session: null,
          error: new Error(
            'Invalid, expired, or already-used recovery code. Please check the code or request a new one.'
          ),
        };
      }

      if (msg.includes('rate limit') || msg.includes('too many')) {
        return {
          user: null,
          session: null,
          error: new Error(
            'Too many verification attempts. Please wait a moment and request a new recovery code.'
          ),
        };
      }

      return {
        user: null,
        session: null,
        error: new Error(error.message || 'Recovery code verification failed.'),
      };
    }

    if (!data?.session) {
      return {
        user: null,
        session: null,
        error: new Error(
          'Recovery verification did not establish a valid session. Please request a new recovery code.'
        ),
      };
    }

    return {
      user: data.user ?? data.session.user ?? null,
      session: data.session,
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      session: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

/**
 * Updates the password for the active Supabase recovery/authenticated session
 */
export const updateUserPassword = async (
  newPassword: string
): Promise<{ error: Error | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase connection is not configured.') };
  }
  if (!newPassword || newPassword.length < 6) {
    return { error: new Error('Password must be at least 6 characters long.') };
  }
  try {
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Retrieves the verified user profile strictly from Supabase public.profiles by user ID.
 * Never fabricates profiles, never falls back to user_metadata or seed data,
 * and distinguishes missing profiles, unsupported roles, and temporary query errors.
 */
export const getUserProfile = async (
  userId?: string
): Promise<ProfileLookupResult> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'temporary_error',
      profile: null,
      error: new Error('Supabase connection is not configured.'),
    };
  }

  let targetId = userId;
  if (!targetId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return {
        status: 'not_found',
        profile: null,
        error: new Error('No authenticated user session found.'),
      };
    }
    targetId = currentUser.id;
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (error) {
      return {
        status: 'temporary_error',
        profile: null,
        error: new Error(error.message || 'Temporary error querying studio profile.'),
      };
    }

    if (!data) {
      return {
        status: 'not_found',
        profile: null,
        error: new Error('No application profile exists for this account.'),
      };
    }

    if (data.is_active === false) {
      return {
        status: 'inactive',
        profile: null,
        rawRole: data.role ?? null,
        error: new Error(
          'Your account has been deactivated. Please contact an administrator.'
        ),
      };
    }

    const verifiedRole = resolveVerifiedUserRole(data.role);
    if (!verifiedRole) {
      return {
        status: 'unsupported_role',
        profile: null,
        rawRole: data.role ?? null,
        error: new Error(
          `Unsupported or unassigned studio role${data.role ? ` ("${data.role}")` : ''}.`
        ),
      };
    }

    const row = data as Profile;
    return {
      status: 'ok',
      profile: {
        ...row,
        role: verifiedRole,
        is_active: data.is_active !== false,
      },
      rawRole: data.role,
      error: null,
    };
  } catch (err: any) {
    return {
      status: 'temporary_error',
      profile: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

/**
 * Retrieves the verified user's role strictly from public.profiles.
 * Returns null if no verified profile or supported role exists.
 */
export const getUserRole = async (userId?: string): Promise<UserRole | null> => {
  const result = await getUserProfile(userId);
  if (result.status !== 'ok' || !result.profile) {
    return null;
  }
  return result.profile.role;
};

/**
 * Route / View Guarding Utilities
 */

/**
 * Validates whether a user's role matches any allowed role.
 */
export const hasRole = (
  userRole: UserRole | string | null | undefined,
  allowedRoles: UserRole[]
): boolean => {
  const normalized = normalizeUserRole(userRole);
  if (!normalized) return false;
  return allowedRoles.includes(normalized);
};

/**
 * Returns the authoritative default landing tab for a verified studio role.
 * Fails closed to 'dashboard' (which requires verified Admin/Manager role access)
 * when role is missing or unsupported.
 */
export const getDefaultLandingTab = (
  role?: UserRole | string | null
): string => {
  const normalized = normalizeUserRole(role);
  if (normalized === 'Editor') return 'deliverables';
  return 'dashboard';
};

/**
 * Performs a comprehensive route guard evaluation.
 * Unknown or unrecognized tab IDs fail closed for all roles.
 */
export const checkRouteAccess = (
  tab: string,
  role?: UserRole | string | null
): { allowed: boolean; reason?: string; requiredRoles?: UserRole[] } => {
  const normalized = normalizeUserRole(role);
  if (!normalized) {
    return {
      allowed: false,
      reason: 'Access denied: Missing or unsupported studio role.',
    };
  }

  const isKnownTab =
    typeof tab === 'string' &&
    Object.prototype.hasOwnProperty.call(TAB_PERMISSIONS, tab);
  if (!isKnownTab) {
    return {
      allowed: false,
      reason: `Access denied: Unknown or unrecognized section "${String(tab ?? '')}".`,
    };
  }

  const allowedRoles = TAB_PERMISSIONS[tab];
  const allowed = allowedRoles.includes(normalized);
  return {
    allowed,
    reason: allowed ? undefined : `Access to ${tab} requires one of: ${allowedRoles.join(', ')}.`,
    requiredRoles: allowedRoles,
  };
};

/**
 * Validates whether a user's role has access to a specific navigation tab or view.
 * Always consistent with checkRouteAccess() and fails closed on unknown tabs.
 */
export const canAccessTab = (
  tab: string,
  role: UserRole | string | null | undefined
): boolean => {
  return checkRouteAccess(tab, role).allowed;
};

/**
 * High-level auth & role check helper strictly verifying public.profiles.
 */
export const checkAuthAndRole = async (
  allowedRoles?: UserRole[]
): Promise<{
  isAuthenticated: boolean;
  isAuthorized: boolean;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
}> => {
  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated || !user) {
    return {
      isAuthenticated: false,
      isAuthorized: false,
      user: null,
      profile: null,
      role: null,
    };
  }

  const lookup = await getUserProfile(user.id);
  if (lookup.status !== 'ok' || !lookup.profile) {
    return {
      isAuthenticated: true,
      isAuthorized: false,
      user,
      profile: null,
      role: null,
    };
  }

  const role = lookup.profile.role;
  const isAuthorized = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);

  return {
    isAuthenticated: true,
    isAuthorized,
    user,
    profile: lookup.profile,
    role,
  };
};
