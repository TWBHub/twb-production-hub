import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, getSupabaseClient, isSupabaseConfigured } from './supabase';
import { Profile, UserRole } from '../types';
import { INITIAL_PROFILES } from '../services/seedData';

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
  dashboard: ['Admin', 'Manager', 'Team Member', 'Editor'],
  projects: ['Admin', 'Manager', 'Team Member', 'Editor'],
  deliverables: ['Admin', 'Manager', 'Team Member', 'Editor'],
  data: ['Admin', 'Manager', 'Team Member', 'Editor'],
  calendar: ['Admin', 'Manager', 'Team Member'],
  enquiries: ['Admin', 'Manager'],
  clients: ['Admin', 'Manager'],
  finance: ['Admin', 'Manager'],
  team: ['Admin', 'Manager'],
  editors: ['Admin', 'Manager'],
  notifications: ['Admin', 'Manager', 'Team Member', 'Editor'],
  settings: ['Admin'],
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
  role: UserRole;
  loading: boolean;
}

/**
 * Retrieves current active Supabase auth session
 */
export const getSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient() || supabase;
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
  const client = getSupabaseClient() || supabase;
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      // Fall back to session user if direct getUser is unauthenticated
      const session = await getSession();
      return session?.user ?? null;
    }
    return user;
  } catch (err) {
    console.warn('Failed to retrieve current user:', err);
    return null;
  }
};

/**
 * Subscribes to Supabase auth state changes (sign in, sign out, token refresh)
 */
export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } => {
  const client = getSupabaseClient() || supabase;
  try {
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
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
  const client = getSupabaseClient() || supabase;
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
    return { user: null, session: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Register a new user account and provision their profile entry
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  options?: {
    fullName?: string;
    role?: UserRole;
    companyId?: 'twb' | 'golden_june' | 'both';
    phone?: string;
  }
): Promise<{ user: User | null; session: Session | null; error: Error | null }> => {
  const client = getSupabaseClient() || supabase;
  const fullName = options?.fullName || email.split('@')[0];
  const role: UserRole = options?.role || 'Team Member';
  const companyId = options?.companyId || 'both';

  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          company_id: companyId,
          phone: options?.phone || '',
        },
      },
    });

    if (error) {
      return { user: null, session: null, error: new Error(error.message) };
    }

    // Upsert the profile in the profiles table if user ID exists
    if (data.user?.id) {
      await upsertProfile({
        id: data.user.id,
        email: data.user.email || email,
        full_name: fullName,
        role,
        company_id: companyId,
        phone: options?.phone,
        status: 'Active',
      });
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err instanceof Error ? err : new Error(String(err)) };
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
 * Sends a password reset email
 */
export const resetPasswordForEmail = async (
  email: string,
  redirectTo?: string
): Promise<{ error: Error | null }> => {
  const client = getSupabaseClient() || supabase;
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || window.location.origin,
    });
    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Retrieves the user profile from Supabase PostgreSQL 'profiles' table.
 * Falls back to user metadata or initial seed profiles if database is offline.
 */
export const getUserProfile = async (
  userId?: string
): Promise<{ profile: Profile | null; error: Error | null }> => {
  const client = getSupabaseClient() || supabase;
  
  let targetId = userId;
  let targetEmail = '';

  if (!targetId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { profile: null, error: null };
    }
    targetId = currentUser.id;
    targetEmail = currentUser.email || '';
  }

  // 1. Attempt database query
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (!error && data) {
      return { profile: data as Profile, error: null };
    }

    // Try matching by email if ID didn't return a record
    if (targetEmail) {
      const { data: emailData, error: emailErr } = await client
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

      if (!emailErr && emailData) {
        return { profile: emailData as Profile, error: null };
      }
    }
  } catch (err) {
    console.warn('Could not query profiles from Supabase:', err);
  }

  // 2. If authenticated user does not have a profile row in 'profiles', persist one
  const user = await getCurrentUser();
  if (user && user.id === targetId) {
    const meta = user.user_metadata || {};
    const newProfile: Profile = {
      id: user.id,
      email: user.email || targetEmail || '',
      full_name: meta.full_name || user.email?.split('@')[0] || 'User',
      role: (meta.role as UserRole) || 'Team Member',
      phone: meta.phone || '',
      company_id: meta.company_id || 'both',
      status: 'Active',
    };

    // Persist to Supabase profiles table
    try {
      await client.from('profiles').upsert(newProfile);
    } catch (persistErr) {
      console.warn('Could not automatically persist profile row:', persistErr);
    }

    return { profile: newProfile, error: null };
  }

  // 3. Fallback check for pre-seeded profiles if offline
  const localMatch = INITIAL_PROFILES.find(
    p => p.id === targetId || (targetEmail && p.email.toLowerCase() === targetEmail.toLowerCase())
  );

  if (localMatch) {
    return { profile: localMatch, error: null };
  }

  return { profile: null, error: null };
};

/**
 * Retrieves the user's role (Admin, Manager, Team Member, Editor).
 * Defaults to 'Team Member' if unspecified.
 */
export const getUserRole = async (userId?: string): Promise<UserRole> => {
  const { profile } = await getUserProfile(userId);
  return profile?.role || 'Team Member';
};

/**
 * Creates or updates a profile record in Supabase
 */
export const upsertProfile = async (
  profile: Partial<Profile> & { id: string; email: string; full_name: string }
): Promise<{ profile: Profile | null; error: Error | null }> => {
  const client = getSupabaseClient() || supabase;
  const payload: Profile = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role || 'Team Member',
    avatar_url: profile.avatar_url,
    phone: profile.phone,
    company_id: profile.company_id || 'both',
    status: profile.status || 'Active',
  };

  try {
    const { data, error } = await client
      .from('profiles')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      return { profile: payload, error: new Error(error.message) };
    }

    return { profile: (data as Profile) || payload, error: null };
  } catch (err: any) {
    return { profile: payload, error: err instanceof Error ? err : new Error(String(err)) };
  }
};

/**
 * Route / View Guarding Utilities
 */

/**
 * Validates whether a user's role matches any allowed role.
 */
export const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole);
};

/**
 * Validates whether a user's role has access to a specific navigation tab or view.
 */
export const canAccessTab = (tab: string, role: UserRole): boolean => {
  const allowedRoles = TAB_PERMISSIONS[tab];
  if (!allowedRoles) {
    // Unknown tabs default to Admin and Manager only
    return role === 'Admin' || role === 'Manager';
  }
  return allowedRoles.includes(role);
};

/**
 * Performs a comprehensive route guard evaluation.
 */
export const checkRouteAccess = (
  tab: string,
  role: UserRole = 'Team Member'
): { allowed: boolean; reason?: string; requiredRoles?: UserRole[] } => {
  const allowedRoles = TAB_PERMISSIONS[tab];
  if (!allowedRoles) {
    return {
      allowed: role === 'Admin',
      reason: 'Restricted view requires administrative privileges.',
      requiredRoles: ['Admin'],
    };
  }

  const allowed = allowedRoles.includes(role);
  return {
    allowed,
    reason: allowed ? undefined : `Access to ${tab} requires one of: ${allowedRoles.join(', ')}.`,
    requiredRoles: allowedRoles,
  };
};

/**
 * High-level auth & role check helper for components and views.
 */
export const checkAuthAndRole = async (
  allowedRoles?: UserRole[]
): Promise<{
  isAuthenticated: boolean;
  isAuthorized: boolean;
  user: User | null;
  profile: Profile | null;
  role: UserRole;
}> => {
  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      isAuthorized: false,
      user: null,
      profile: null,
      role: 'Team Member',
    };
  }

  const { profile } = await getUserProfile(user!.id);
  const role: UserRole = profile?.role || (user!.user_metadata?.role as UserRole) || 'Team Member';
  const isAuthorized = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role);

  return {
    isAuthenticated: true,
    isAuthorized,
    user,
    profile,
    role,
  };
};
