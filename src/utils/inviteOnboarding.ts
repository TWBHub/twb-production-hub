import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { ProfileLookupResult, RefreshAuthSessionResult } from '../lib/auth';
import { EditorAccountApiError } from '../services/editorAccounts';
import { Profile, UserRole } from '../types';

export const INVITE_PASSWORD_MIN_LENGTH = 8;
export const INVITE_PASSWORD_MAX_LENGTH = 128;

export interface ParsedAuthUrlError {
  hasError: boolean;
  message: string | null;
  errorCode: string | null;
  isRecoveryError: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Checks the server-controlled app_metadata flag indicating an invited Editor
 * has not yet completed mandatory password setup. Never trusts user_metadata.
 */
export function isInvitePasswordSetupUser(
  user: Pick<User, 'app_metadata'> | { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return user?.app_metadata?.password_setup_required === true;
}

/**
 * Verifies that server-controlled app_metadata explicitly cleared the onboarding gate.
 */
export function isInvitePasswordSetupCompleted(
  user: Pick<User, 'app_metadata'> | { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return user?.app_metadata?.password_setup_required === false;
}

function collectLocationParams(locationLike?: {
  hash?: string;
  search?: string;
}): URLSearchParams {
  const merged = new URLSearchParams();
  if (!locationLike) return merged;

  const rawSearch = (locationLike.search || '').replace(/^\?/, '');
  const rawHash = (locationLike.hash || '').replace(/^#/, '');

  if (rawSearch) {
    const searchParams = new URLSearchParams(rawSearch);
    searchParams.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);
    hashParams.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

export function isRecoveryUrlPresent(locationLike?: {
  hash?: string;
  search?: string;
}): boolean {
  const params = collectLocationParams(locationLike);
  return params.get('type') === 'recovery';
}

export function isInviteUrlPresent(locationLike?: {
  hash?: string;
  search?: string;
}): boolean {
  const params = collectLocationParams(locationLike);
  return params.get('type') === 'invite';
}

/**
 * Parses Supabase auth error parameters from URL hash fragments or query strings,
 * distinguishing password-recovery errors from invitation / link errors.
 */
export function parseSupabaseAuthUrlError(locationLike?: {
  hash?: string;
  search?: string;
}): ParsedAuthUrlError {
  const params = collectLocationParams(locationLike);
  const rawError = params.get('error')?.trim() || '';
  const rawErrorCode = params.get('error_code')?.trim() || '';
  const rawDescription = params.get('error_description')?.trim() || '';
  const typeParam = params.get('type')?.trim().toLowerCase() || '';
  const isRecoveryError = typeParam === 'recovery';

  if (!rawError && !rawErrorCode && !rawDescription) {
    return {
      hasError: false,
      message: null,
      errorCode: null,
      isRecoveryError: false,
    };
  }

  const normalizedCode = rawErrorCode.toLowerCase();
  const normalizedDesc = rawDescription.toLowerCase();
  const isExpiredOrInvalid =
    normalizedCode === 'otp_expired' ||
    normalizedDesc.includes('expired') ||
    normalizedDesc.includes('invalid');

  if (isRecoveryError) {
    return {
      hasError: true,
      errorCode: rawErrorCode || rawError || null,
      isRecoveryError: true,
      message: isExpiredOrInvalid
        ? 'This password recovery link is invalid or has expired. Request a new 6-digit recovery code below.'
        : rawDescription || 'Password recovery link could not be verified.',
    };
  }

  if (isExpiredOrInvalid) {
    return {
      hasError: true,
      errorCode: rawErrorCode || rawError || null,
      isRecoveryError: false,
      message:
        'This invitation link is invalid or has expired. Ask an Administrator or Manager to check your account status in TWB Hub.',
    };
  }

  return {
    hasError: true,
    errorCode: rawErrorCode || rawError || null,
    isRecoveryError: false,
    message:
      rawDescription ||
      'Unable to complete studio sign-in from this link. Please request a fresh invitation or contact an administrator.',
  };
}

const SUPABASE_AUTH_URL_KEYS = new Set([
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'provider_token',
  'provider_refresh_token',
  'type',
  'code',
  'token',
  'token_hash',
  'error',
  'error_code',
  'error_description',
]);

export function hasAuthRedirectParams(locationLike?: {
  hash?: string;
  search?: string;
}): boolean {
  const params = collectLocationParams(locationLike);
  for (const key of params.keys()) {
    if (SUPABASE_AUTH_URL_KEYS.has(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a clean relative URL path stripping Supabase auth hash fragments and auth query params,
 * while preserving any unrelated non-auth query parameters.
 */
export function buildCleanedAuthRedirectUrl(locationLike: {
  pathname: string;
  search?: string;
}): string {
  const searchParams = new URLSearchParams(
    (locationLike.search || '').replace(/^\?/, '')
  );
  for (const key of Array.from(searchParams.keys())) {
    if (SUPABASE_AUTH_URL_KEYS.has(key)) {
      searchParams.delete(key);
    }
  }
  const remaining = searchParams.toString();
  return remaining ? `${locationLike.pathname}?${remaining}` : locationLike.pathname;
}

/**
 * Validates an invited Editor's new password against backend constraints (8-128 chars,
 * non-whitespace-only, no null/newline/carriage-return control characters).
 */
export function validateInviteSetupPassword(
  rawPassword: unknown
): PasswordValidationResult {
  if (typeof rawPassword !== 'string' || !rawPassword) {
    return { valid: false, error: 'A new password is required.' };
  }
  if (rawPassword.length < INVITE_PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${INVITE_PASSWORD_MIN_LENGTH} characters long.`,
    };
  }
  if (rawPassword.length > INVITE_PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be ${INVITE_PASSWORD_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (rawPassword.trim().length === 0) {
    return {
      valid: false,
      error: 'Password cannot consist solely of whitespace.',
    };
  }
  if (/[\0\r\n]/.test(rawPassword)) {
    return {
      valid: false,
      error: 'Password contains invalid control characters.',
    };
  }
  return { valid: true };
}

export interface SessionGateInput {
  isPasswordRecovery: boolean;
  bypassRecoveryCheck?: boolean;
  authUser: Pick<User, 'app_metadata'> | { app_metadata?: Record<string, unknown> } | null | undefined;
  authoritativeUserMissing?: boolean;
  isInviteGateActive?: boolean;
  cachedAuthUser?: Pick<User, 'app_metadata'> | { app_metadata?: Record<string, unknown> } | null | undefined;
  profileStatus: 'ok' | 'not_found' | 'inactive' | 'unsupported_role' | 'temporary_error';
  profileRole?: string | null;
}

export type SessionGateOutcome =
  | { mode: 'password_recovery'; allowAppAccess: false; shouldSignOut: false }
  | { mode: 'invite_password_setup'; allowAppAccess: false; shouldSignOut: false }
  | { mode: 'temporary_error'; allowAppAccess: false; shouldSignOut: false }
  | { mode: 'denied'; allowAppAccess: false; shouldSignOut: true; reason: string }
  | { mode: 'authenticated'; allowAppAccess: true; shouldSignOut: false };

/**
 * Authoritative decision table enforcing that:
 * - Existing password recovery continues unchanged.
 * - Temporary profile or authoritative Auth lookup errors do NOT sign the user out and NEVER grant app access from cached JWTs.
 * - Inactive/missing/unsupported profiles fail closed with sign-out.
 * - Active invite gates remain active across transient errors or token refreshes until a fresh authoritative user
 *   explicitly confirms app_metadata.password_setup_required === false AND active Editor profile verification succeeds.
 */
export function resolveAuthSessionGate(
  input: SessionGateInput
): SessionGateOutcome {
  if (input.isPasswordRecovery && !input.bypassRecoveryCheck) {
    return {
      mode: 'password_recovery',
      allowAppAccess: false,
      shouldSignOut: false,
    };
  }

  if (input.profileStatus === 'temporary_error') {
    return {
      mode: 'temporary_error',
      allowAppAccess: false,
      shouldSignOut: false,
    };
  }

  if (input.profileStatus !== 'ok') {
    const reason =
      input.profileStatus === 'inactive'
        ? 'Your account has been deactivated. Please contact an administrator.'
        : input.profileStatus === 'unsupported_role'
          ? 'Access denied: Your account role is not supported for TWBHub access. Please contact your administrator.'
          : 'Access denied: No studio profile was found for this account. Please contact your administrator.';

    return {
      mode: 'denied',
      allowAppAccess: false,
      shouldSignOut: true,
      reason,
    };
  }

  const normalizedRole = (input.profileRole || '').trim().toLowerCase();

  // Never trust stale cached JWT claims if authoritative server getUser() failed transiently
  if (input.authoritativeUserMissing) {
    if (input.isInviteGateActive || isInvitePasswordSetupUser(input.cachedAuthUser)) {
      if (normalizedRole !== 'editor') {
        return {
          mode: 'denied',
          allowAppAccess: false,
          shouldSignOut: true,
          reason:
            'Access denied: Invitation onboarding is restricted to active Editor accounts. Please contact your administrator.',
        };
      }
      return {
        mode: 'invite_password_setup',
        allowAppAccess: false,
        shouldSignOut: false,
      };
    }

    return {
      mode: 'temporary_error',
      allowAppAccess: false,
      shouldSignOut: false,
    };
  }

  if (isInvitePasswordSetupUser(input.authUser)) {
    if (normalizedRole !== 'editor') {
      return {
        mode: 'denied',
        allowAppAccess: false,
        shouldSignOut: true,
        reason:
          'Access denied: Invitation onboarding is restricted to active Editor accounts. Please contact your administrator.',
      };
    }

    return {
      mode: 'invite_password_setup',
      allowAppAccess: false,
      shouldSignOut: false,
    };
  }

  // An active invite gate may only clear when fresh authoritative metadata explicitly
  // confirms password_setup_required === false AND active Editor profile verification succeeds.
  if (input.isInviteGateActive) {
    if (normalizedRole !== 'editor') {
      return {
        mode: 'denied',
        allowAppAccess: false,
        shouldSignOut: true,
        reason:
          'Access denied: Invitation onboarding is restricted to active Editor accounts. Please contact your administrator.',
      };
    }

    if (!isInvitePasswordSetupCompleted(input.authUser)) {
      return {
        mode: 'invite_password_setup',
        allowAppAccess: false,
        shouldSignOut: false,
      };
    }
  }

  return {
    mode: 'authenticated',
    allowAppAccess: true,
    shouldSignOut: false,
  };
}

export type ProfileVerificationState = 'idle' | 'verified' | 'temporary_error';

export interface AuthOnboardingCoordinatorDeps {
  initialIsPasswordRecovery?: boolean;
  getSession: () => Promise<Session | null>;
  getAuthoritativeAuthUser: () => Promise<{
    user: User | null;
    invalidSession: boolean;
    error: Error | null;
  }>;
  refreshAuthSession: () => Promise<RefreshAuthSessionResult>;
  getUserProfile: (userId: string) => Promise<ProfileLookupResult>;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyRecoveryOtp: (
    email: string,
    token: string
  ) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  updateUserPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  completeInvitePasswordSetup: (newPassword: string) => Promise<unknown>;
  canAccessTab: (tab: string, role: UserRole) => boolean;
  getDefaultLandingTab: (role?: UserRole | string | null) => string;
  getActiveTab: () => string;
  setActiveTab: (tab: string) => void;
  getLocation?: () => { hash?: string; search?: string; pathname: string } | undefined;
  replaceUrl?: (cleanedPath: string) => void;
  onSessionChange: (session: Session | null) => void;
  onCurrentUserChange: (profile: Profile | null) => void;
  onAuthLoadingChange: (loading: boolean) => void;
  onAuthErrorChange: (error: string | null) => void;
  onProfileVerificationStateChange: (state: ProfileVerificationState) => void;
  onPasswordRecoveryChange: (recovery: boolean) => void;
  onInvitePasswordSetupRequiredChange: (required: boolean) => void;
  onInviteSyncPendingChange: (pending: boolean) => void;
  onClearDomainData: () => void;
}

export interface VerifySessionOptions {
  redirectOnSuccess?: boolean;
  bypassRecoveryCheck?: boolean;
  freshAuthUser?: User | null;
  precomputedLookup?: ProfileLookupResult;
  expectedVersion?: number;
}

/**
 * Race-safe authentication and Editor invite onboarding coordinator.
 * Shared identically by AppProvider and automated lifecycle/concurrency tests.
 */
export function createAuthOnboardingCoordinator(deps: AuthOnboardingCoordinatorDeps) {
  let isMounted = true;
  let session: Session | null = null;
  let currentUser: Profile | null = null;
  let profileVerificationState: ProfileVerificationState = 'idle';
  let isPasswordRecovery = Boolean(deps.initialIsPasswordRecovery);
  let isInvitePasswordSetupRequired = false;
  let isInviteSyncPending = false;

  let authStateVersion = 0;
  let activeLoginVersion = 0;
  let inviteSetupRequestVersion = 0;
  let activeInviteSetupVersion = 0;

  let loginInFlight = false;
  let otpRecoveryInFlight = false;
  let inviteSetupInFlight = false;
  let preserveAuthError = false;

  let inviteGatedUserId: string | null = null;
  let inviteBackendCompletedUserId: string | null = null;

  const scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

  const setSessionState = (next: Session | null) => {
    session = next;
    deps.onSessionChange(next);
  };

  const setCurrentUserState = (next: Profile | null) => {
    currentUser = next;
    deps.onCurrentUserChange(next);
  };

  const setProfileVerification = (next: ProfileVerificationState) => {
    profileVerificationState = next;
    deps.onProfileVerificationStateChange(next);
  };

  const setPasswordRecoveryState = (next: boolean) => {
    isPasswordRecovery = next;
    deps.onPasswordRecoveryChange(next);
  };

  const setInviteGateState = (next: boolean) => {
    isInvitePasswordSetupRequired = next;
    deps.onInvitePasswordSetupRequiredChange(next);
  };

  const setInviteSyncPendingState = (next: boolean) => {
    isInviteSyncPending = next;
    deps.onInviteSyncPendingChange(next);
  };

  const setAuthErrorState = (next: string | null) => {
    deps.onAuthErrorChange(next);
  };

  const setAuthLoadingState = (next: boolean) => {
    deps.onAuthLoadingChange(next);
  };

  const cleanAuthUrlIfNeeded = (options?: { skipIfRecovery?: boolean }) => {
    const loc = deps.getLocation?.();
    if (!loc || !deps.replaceUrl) return;
    if (options?.skipIfRecovery && isRecoveryUrlPresent(loc)) return;
    if (hasAuthRedirectParams(loc) || loc.hash) {
      deps.replaceUrl(buildCleanedAuthRedirectUrl(loc));
    }
  };

  const clearAuthenticatedAppState = () => {
    currentUser = null;
    inviteGatedUserId = null;
    inviteBackendCompletedUserId = null;
    setInviteSyncPendingState(false);
    setInviteGateState(false);
    setSessionState(null);
    deps.onCurrentUserChange(null);
    setProfileVerification('idle');
    deps.setActiveTab('dashboard');
    deps.onClearDomainData();
  };

  const clearAuthError = () => {
    preserveAuthError = false;
    setAuthErrorState(null);
  };

  const verifyAndApplySessionProfile = async (
    targetSession: Session,
    options?: VerifySessionOptions
  ): Promise<{ success: boolean; error?: string }> => {
    const opVersion =
      options?.expectedVersion !== undefined
        ? options.expectedVersion
        : ++authStateVersion;

    const isStale = () => !isMounted || authStateVersion !== opVersion;

    if (isStale()) {
      return { success: false };
    }

    if (isPasswordRecovery && !options?.bypassRecoveryCheck) {
      inviteGatedUserId = null;
      inviteBackendCompletedUserId = null;
      setInviteSyncPendingState(false);
      setInviteGateState(false);
      setSessionState(targetSession);
      setCurrentUserState(null);
      setProfileVerification('idle');
      setAuthErrorState(null);
      return { success: true };
    }

    let authoritativeUser: User | null = options?.freshAuthUser ?? null;
    let authoritativeUserMissing = false;

    if (!authoritativeUser) {
      const authCheck = await deps.getAuthoritativeAuthUser();
      if (isStale()) {
        return { success: false };
      }
      if (authCheck.invalidSession) {
        const invalidMsg =
          'Your studio session is no longer valid or has been disabled. Please sign in again.';
        preserveAuthError = true;
        setPasswordRecoveryState(false);
        clearAuthenticatedAppState();
        setAuthErrorState(invalidMsg);
        try {
          await deps.signOut();
        } catch (err) {
          console.warn('Sign out after invalid session:', err);
        }
        if (!isStale()) {
          setAuthErrorState(invalidMsg);
        }
        return { success: false, error: invalidMsg };
      }
      if (authCheck.user) {
        authoritativeUser = authCheck.user;
      } else {
        authoritativeUserMissing = true;
      }
    }

    const userIdToVerify = authoritativeUser?.id ?? targetSession.user?.id;
    if (!userIdToVerify) {
      const invalidMsg =
        'Your studio session is no longer valid or has been disabled. Please sign in again.';
      preserveAuthError = true;
      setPasswordRecoveryState(false);
      clearAuthenticatedAppState();
      setAuthErrorState(invalidMsg);
      return { success: false, error: invalidMsg };
    }

    const effectiveSession: Session = authoritativeUser
      ? { ...targetSession, user: authoritativeUser }
      : targetSession;

    const isInviteGateActiveForUser =
      isInvitePasswordSetupRequired &&
      (!inviteGatedUserId || inviteGatedUserId === userIdToVerify);

    const lookup =
      options?.precomputedLookup ?? (await deps.getUserProfile(userIdToVerify));

    if (isStale()) {
      return { success: false };
    }

    const gate = resolveAuthSessionGate({
      isPasswordRecovery,
      bypassRecoveryCheck: options?.bypassRecoveryCheck,
      authUser: authoritativeUser,
      authoritativeUserMissing,
      isInviteGateActive: isInviteGateActiveForUser,
      cachedAuthUser: targetSession.user,
      profileStatus: lookup.status,
      profileRole: lookup.profile?.role ?? null,
    });

    if (gate.mode === 'temporary_error') {
      const msg =
        lookup.error?.message ||
        (authoritativeUserMissing
          ? 'Temporary authentication verification error while verifying your studio session. Please retry.'
          : 'Temporary database or network error while verifying your studio profile. Please retry.');
      preserveAuthError = false;
      setSessionState(effectiveSession);
      setCurrentUserState(null);
      if (isInviteGateActiveForUser || isInvitePasswordSetupUser(targetSession.user)) {
        inviteGatedUserId = userIdToVerify;
        setInviteGateState(true);
      }
      setProfileVerification('temporary_error');
      setAuthErrorState(msg);
      return { success: false, error: msg };
    }

    if (gate.mode === 'invite_password_setup') {
      // Mandatory gate: invited Editor cannot reach Navigation, DeliverablesView, or refreshAllData
      preserveAuthError = false;
      inviteGatedUserId = userIdToVerify;
      setSessionState(effectiveSession);
      setCurrentUserState(null);
      setProfileVerification('idle');
      setInviteGateState(true);
      if (!isInviteSyncPending) {
        setAuthErrorState(null);
      }
      return { success: true };
    }

    if (
      gate.mode === 'authenticated' &&
      authoritativeUser &&
      lookup.profile &&
      (!isInviteGateActiveForUser || isInvitePasswordSetupCompleted(authoritativeUser))
    ) {
      preserveAuthError = false;
      inviteGatedUserId = null;
      inviteBackendCompletedUserId = null;
      setInviteSyncPendingState(false);
      setInviteGateState(false);
      setSessionState(effectiveSession);
      setCurrentUserState(lookup.profile);
      setProfileVerification('verified');
      setAuthErrorState(null);

      const defaultTab = deps.getDefaultLandingTab(lookup.profile.role);
      if (options?.redirectOnSuccess) {
        deps.setActiveTab(defaultTab);
      } else if (!deps.canAccessTab(deps.getActiveTab(), lookup.profile.role)) {
        deps.setActiveTab(defaultTab);
      }

      return { success: true };
    }

    // Denied: inactive account, missing profile, unsupported role, or non-editor with invite metadata
    const denialMessage =
      gate.mode === 'denied'
        ? gate.reason
        : 'Access denied: Unable to verify studio profile.';

    preserveAuthError = true;
    setPasswordRecoveryState(false);
    clearAuthenticatedAppState();
    setAuthErrorState(denialMessage);

    try {
      await deps.signOut();
    } catch (err) {
      console.warn('Sign out after failed profile verification:', err);
    }

    if (isStale()) {
      return { success: false, error: denialMessage };
    }

    setAuthErrorState(denialMessage);
    return { success: false, error: denialMessage };
  };

  const refreshUserProfile = async (): Promise<Profile | null> => {
    const opVersion = ++authStateVersion;
    const activeSession = session || (await deps.getSession());
    if (!isMounted || authStateVersion !== opVersion) {
      return null;
    }
    if (!activeSession?.user) return null;
    const result = await verifyAndApplySessionProfile(activeSession, {
      expectedVersion: opVersion,
    });
    if (result.success && isMounted && authStateVersion === opVersion) {
      return currentUser;
    }
    return null;
  };

  const retryProfileVerification = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const opVersion = ++authStateVersion;
    const activeSession = session || (await deps.getSession());
    if (!isMounted || authStateVersion !== opVersion) {
      return { success: false };
    }
    if (!activeSession?.user) {
      const msg = 'Your session is no longer active. Please sign in again.';
      clearAuthenticatedAppState();
      setAuthErrorState(msg);
      return { success: false, error: msg };
    }
    return verifyAndApplySessionProfile(activeSession, {
      redirectOnSuccess: true,
      expectedVersion: opVersion,
    });
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const loginVersion = ++authStateVersion;
    activeLoginVersion = loginVersion;
    loginInFlight = true;
    preserveAuthError = false;
    inviteGatedUserId = null;
    inviteBackendCompletedUserId = null;
    setInviteSyncPendingState(false);
    setAuthErrorState(null);
    setPasswordRecoveryState(false);
    setInviteGateState(false);

    try {
      const result = await deps.signInWithEmail(email, password);
      if (!isMounted || authStateVersion !== loginVersion) {
        return { success: false };
      }

      if (result.error) {
        setAuthErrorState(result.error.message);
        return { success: false, error: result.error.message };
      }

      if (result.session && result.user) {
        return await verifyAndApplySessionProfile(result.session, {
          redirectOnSuccess: true,
          expectedVersion: loginVersion,
        });
      }

      const fallbackMsg = 'No session established. Please verify your credentials.';
      setAuthErrorState(fallbackMsg);
      return { success: false, error: fallbackMsg };
    } catch (err: any) {
      if (!isMounted || authStateVersion !== loginVersion) {
        return { success: false };
      }
      const msg = err?.message || 'Login attempt failed.';
      setAuthErrorState(msg);
      return { success: false, error: msg };
    } finally {
      if (activeLoginVersion === loginVersion) {
        loginInFlight = false;
      }
    }
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await deps.resetPasswordForEmail(email);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const verifyPasswordRecoveryOtp = async (
    email: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (otpRecoveryInFlight) {
      return { success: false, error: 'Verification is already in progress. Please wait.' };
    }

    const otpVersion = ++authStateVersion;
    otpRecoveryInFlight = true;
    preserveAuthError = false;
    setAuthErrorState(null);

    try {
      const result = await deps.verifyRecoveryOtp(email, token);
      if (!isMounted || authStateVersion !== otpVersion) {
        return { success: false };
      }
      if (result.error || !result.session) {
        return {
          success: false,
          error: result.error?.message || 'Failed to verify recovery code. Please try again.',
        };
      }

      inviteGatedUserId = null;
      inviteBackendCompletedUserId = null;
      setInviteSyncPendingState(false);
      setInviteGateState(false);
      setPasswordRecoveryState(true);
      setSessionState(result.session);
      setCurrentUserState(null);
      setProfileVerification('idle');
      setAuthErrorState(null);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Recovery code verification failed.',
      };
    } finally {
      otpRecoveryInFlight = false;
    }
  };

  const completePasswordRecovery = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const recoveryVersion = ++authStateVersion;
    const { error } = await deps.updateUserPassword(newPassword);
    if (!isMounted || authStateVersion !== recoveryVersion) {
      return { success: false };
    }
    if (error) {
      return { success: false, error: error.message };
    }

    setPasswordRecoveryState(false);
    cleanAuthUrlIfNeeded({ skipIfRecovery: false });

    const activeSession = (await deps.getSession()) || session;
    if (!isMounted || authStateVersion !== recoveryVersion) {
      return { success: false };
    }
    if (!activeSession?.user) {
      const msg = 'Password updated. Please sign in with your new password.';
      clearAuthenticatedAppState();
      setAuthErrorState(null);
      return { success: true, error: msg };
    }

    return verifyAndApplySessionProfile(activeSession, {
      redirectOnSuccess: true,
      bypassRecoveryCheck: true,
      expectedVersion: recoveryVersion,
    });
  };

  const completeEditorInvitePasswordSetup = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (inviteSetupInFlight) {
      return {
        success: false,
        error: 'Account setup is already in progress. Please wait.',
      };
    }

    const setupVersion = ++authStateVersion;
    const setupRequestVersion = ++inviteSetupRequestVersion;
    activeInviteSetupVersion = setupRequestVersion;
    inviteSetupInFlight = true;
    preserveAuthError = false;
    setAuthErrorState(null);

    const isAborted = () =>
      !isMounted ||
      authStateVersion !== setupVersion ||
      activeInviteSetupVersion !== setupRequestVersion;

    try {
      // Query authoritative metadata BEFORE sending another completeInvitePasswordSetup request
      const preAuthCheck = await deps.getAuthoritativeAuthUser();
      if (isAborted()) {
        return { success: false };
      }

      if (preAuthCheck.invalidSession) {
        const invalidMsg =
          'Your invitation session is no longer valid or has been disabled. Please request a fresh invitation or sign in.';
        preserveAuthError = true;
        setPasswordRecoveryState(false);
        clearAuthenticatedAppState();
        setAuthErrorState(invalidMsg);
        try {
          await deps.signOut();
        } catch (err) {
          console.warn('Sign out after invalid invite setup session:', err);
        }
        return { success: false, error: invalidMsg };
      }

      const currentSessionUserId = preAuthCheck.user?.id ?? session?.user?.id ?? null;
      const preConfirmedCompleted = Boolean(
        preAuthCheck.user && isInvitePasswordSetupCompleted(preAuthCheck.user)
      );
      const alreadyMarkedCompletedInSession =
        isInviteSyncPending ||
        Boolean(
          inviteBackendCompletedUserId &&
            currentSessionUserId &&
            inviteBackendCompletedUserId === currentSessionUserId
        );

      if (preConfirmedCompleted) {
        if (currentSessionUserId) {
          inviteBackendCompletedUserId = currentSessionUserId;
        }
        setInviteSyncPendingState(true);
      } else if (!alreadyMarkedCompletedInSession) {
        const validation = validateInviteSetupPassword(newPassword);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error || 'Please provide a valid password.',
          };
        }

        try {
          await deps.completeInvitePasswordSetup(newPassword);
          if (isAborted()) {
            return { success: false };
          }
          if (currentSessionUserId) {
            inviteBackendCompletedUserId = currentSessionUserId;
          }
          setInviteSyncPendingState(true);
        } catch (err: any) {
          if (isAborted()) {
            return { success: false };
          }
          if (
            err instanceof EditorAccountApiError &&
            err.code === 'PASSWORD_SETUP_NOT_REQUIRED'
          ) {
            if (currentSessionUserId) {
              inviteBackendCompletedUserId = currentSessionUserId;
            }
            setInviteSyncPendingState(true);
          } else {
            throw err;
          }
        }
      }

      cleanAuthUrlIfNeeded({ skipIfRecovery: true });

      const refreshed = await deps.refreshAuthSession();
      if (isAborted()) {
        return { success: false };
      }

      if (refreshed.invalidSession) {
        clearAuthenticatedAppState();
        setAuthErrorState(null);
        return {
          success: true,
          error: 'Password created successfully. Please sign in with your new password.',
        };
      }

      let syncSession: Session | null = refreshed.session;
      let authoritativeUser: User | null = refreshed.authoritativeUser;

      if (refreshed.error || !syncSession?.user || !authoritativeUser) {
        const [fallbackSession, userCheck] = await Promise.all([
          syncSession?.user ? Promise.resolve(syncSession) : deps.getSession(),
          authoritativeUser
            ? Promise.resolve({
                user: authoritativeUser,
                invalidSession: false,
                error: null,
              })
            : deps.getAuthoritativeAuthUser(),
        ]);

        if (isAborted()) {
          return { success: false };
        }

        if (userCheck.invalidSession) {
          clearAuthenticatedAppState();
          setAuthErrorState(null);
          return {
            success: true,
            error: 'Password created successfully. Please sign in with your new password.',
          };
        }

        if (!syncSession?.user && fallbackSession?.user) {
          syncSession = fallbackSession;
        }

        if (userCheck.user) {
          authoritativeUser = userCheck.user;
        } else if (preConfirmedCompleted && preAuthCheck.user) {
          authoritativeUser = preAuthCheck.user;
        }
      }

      if (!syncSession?.user) {
        clearAuthenticatedAppState();
        setAuthErrorState(null);
        return {
          success: true,
          error: 'Password created successfully. Please sign in with your new password.',
        };
      }

      if (!authoritativeUser) {
        // Temporary failure looking up authoritative metadata: preserve invite session & gate without locking out
        inviteGatedUserId = syncSession.user.id;
        setSessionState(syncSession);
        setCurrentUserState(null);
        setProfileVerification('idle');
        setInviteGateState(true);
        setInviteSyncPendingState(true);
        const retryMsg =
          'Your password was saved, but session confirmation is temporarily unavailable. Click Retry Session Sync in a moment — no need to re-enter your password.';
        setAuthErrorState(retryMsg);
        return { success: false, error: retryMsg };
      }

      if (!isInvitePasswordSetupCompleted(authoritativeUser)) {
        // Authoritative metadata still says true (or missing false): preserve setup screen & never bypass gate
        const updatedSession: Session = { ...syncSession, user: authoritativeUser };
        inviteGatedUserId = authoritativeUser.id;
        setSessionState(updatedSession);
        setCurrentUserState(null);
        setProfileVerification('idle');
        setInviteGateState(true);
        const staleMsg =
          isInviteSyncPending ||
          inviteBackendCompletedUserId === authoritativeUser.id
            ? 'Your password was saved, and your account confirmation is still syncing. Click Retry Session Sync in a moment — no need to re-enter your password.'
            : 'Your account setup confirmation has not finished syncing yet. Please retry in a moment.';
        setAuthErrorState(staleMsg);
        return { success: false, error: staleMsg };
      }

      const verifiedSession: Session = { ...syncSession, user: authoritativeUser };
      return verifyAndApplySessionProfile(verifiedSession, {
        redirectOnSuccess: true,
        freshAuthUser: authoritativeUser,
        expectedVersion: setupVersion,
      });
    } catch (err: any) {
      if (isAborted()) {
        return { success: false };
      }

      const message =
        err instanceof EditorAccountApiError
          ? err.retryable && typeof err.retryAfterSeconds === 'number'
            ? `${err.message} (Retry in about ${err.retryAfterSeconds} seconds.)`
            : err.message
          : err?.message ||
            'Could not complete Editor account setup. Please try again.';

      return { success: false, error: message };
    } finally {
      if (activeInviteSetupVersion === setupRequestVersion) {
        inviteSetupInFlight = false;
      }
    }
  };

  const retryEditorInviteSessionSync = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return completeEditorInvitePasswordSetup('');
  };

  const logout = async (): Promise<void> => {
    authStateVersion += 1;
    activeLoginVersion = authStateVersion;
    inviteSetupRequestVersion += 1;
    activeInviteSetupVersion = inviteSetupRequestVersion;
    preserveAuthError = false;
    otpRecoveryInFlight = false;
    loginInFlight = false;
    inviteSetupInFlight = false;
    setPasswordRecoveryState(false);
    clearAuthenticatedAppState();
    setAuthErrorState(null);
    setAuthLoadingState(false);

    try {
      await deps.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
  };

  const scheduleDeferredAuthTask = (task: () => Promise<void> | void) => {
    const timerId = setTimeout(() => {
      scheduledTimers.delete(timerId);
      if (!isMounted) return;
      void Promise.resolve(task()).catch(err => {
        console.warn('Deferred auth verification error:', err);
      });
    }, 0);
    scheduledTimers.add(timerId);
  };

  const restoreSession = async (): Promise<void> => {
    const restoreVersion = ++authStateVersion;
    try {
      setAuthLoadingState(true);

      const loc = deps.getLocation?.();
      if (loc) {
        const urlError = parseSupabaseAuthUrlError(loc);
        if (urlError.hasError && urlError.message) {
          preserveAuthError = true;
          setAuthErrorState(urlError.message);
          deps.replaceUrl?.(buildCleanedAuthRedirectUrl(loc));
        }
      }

      const existingSession = await deps.getSession();
      if (!isMounted || authStateVersion !== restoreVersion) {
        return;
      }

      if (existingSession?.user) {
        await verifyAndApplySessionProfile(existingSession, {
          expectedVersion: restoreVersion,
        });

        if (isMounted && authStateVersion === restoreVersion) {
          cleanAuthUrlIfNeeded({ skipIfRecovery: true });
        }
      }
    } catch (err) {
      console.warn('Session restoration failed:', err);
    } finally {
      if (isMounted && authStateVersion === restoreVersion) {
        setAuthLoadingState(false);
      }
    }
  };

  const handleAuthStateChange = (
    event: AuthChangeEvent,
    changedSession: Session | null
  ): void => {
    if (!isMounted) return;

    if (event === 'PASSWORD_RECOVERY') {
      authStateVersion += 1;
      preserveAuthError = false;
      inviteGatedUserId = null;
      inviteBackendCompletedUserId = null;
      setInviteSyncPendingState(false);
      setInviteGateState(false);
      setPasswordRecoveryState(true);
      setSessionState(changedSession);
      setCurrentUserState(null);
      setProfileVerification('idle');
      setAuthErrorState(null);
      setAuthLoadingState(false);
      return;
    }

    if (event === 'SIGNED_OUT') {
      authStateVersion += 1;
      activeLoginVersion = authStateVersion;
      inviteSetupRequestVersion += 1;
      activeInviteSetupVersion = inviteSetupRequestVersion;
      loginInFlight = false;
      otpRecoveryInFlight = false;
      inviteSetupInFlight = false;
      setPasswordRecoveryState(false);
      clearAuthenticatedAppState();
      setAuthLoadingState(false);
      if (!preserveAuthError) {
        setAuthErrorState(null);
      }
      return;
    }

    if (
      event === 'INITIAL_SESSION' ||
      event === 'SIGNED_IN' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'USER_UPDATED'
    ) {
      if (!changedSession?.user) return;

      if (otpRecoveryInFlight || isPasswordRecovery) {
        setPasswordRecoveryState(true);
        setSessionState(changedSession);
        setCurrentUserState(null);
        setProfileVerification('idle');
        setAuthLoadingState(false);
        return;
      }

      if (inviteSetupInFlight) {
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && loginInFlight) {
        return;
      }

      const isActiveUserTokenRefresh =
        event === 'TOKEN_REFRESHED' &&
        !isInvitePasswordSetupRequired &&
        !isInvitePasswordSetupUser(changedSession.user) &&
        Boolean(currentUser && currentUser.id === changedSession.user.id);

      if (isActiveUserTokenRefresh) {
        setSessionState(changedSession);
      }

      const eventVersion = ++authStateVersion;

      scheduleDeferredAuthTask(async () => {
        if (!isMounted || authStateVersion !== eventVersion) {
          return;
        }

        try {
          if (isActiveUserTokenRefresh) {
            const [authCheck, refreshLookup] = await Promise.all([
              deps.getAuthoritativeAuthUser(),
              deps.getUserProfile(changedSession.user.id),
            ]);
            if (!isMounted || authStateVersion !== eventVersion) {
              return;
            }

            if (
              authCheck.invalidSession ||
              (authCheck.user && isInvitePasswordSetupUser(authCheck.user))
            ) {
              await verifyAndApplySessionProfile(changedSession, {
                freshAuthUser: authCheck.user,
                precomputedLookup: refreshLookup,
                expectedVersion: eventVersion,
              });
              return;
            }

            if (refreshLookup.status === 'ok' && refreshLookup.profile) {
              setCurrentUserState(refreshLookup.profile);
            } else if (
              refreshLookup.status === 'inactive' ||
              refreshLookup.status === 'not_found' ||
              refreshLookup.status === 'unsupported_role'
            ) {
              await verifyAndApplySessionProfile(changedSession, {
                freshAuthUser: authCheck.user,
                precomputedLookup: refreshLookup,
                expectedVersion: eventVersion,
              });
            }
            return;
          }

          await verifyAndApplySessionProfile(changedSession, {
            expectedVersion: eventVersion,
          });

          if (
            isMounted &&
            authStateVersion === eventVersion &&
            (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')
          ) {
            cleanAuthUrlIfNeeded({ skipIfRecovery: true });
          }
        } finally {
          if (isMounted && authStateVersion === eventVersion) {
            setAuthLoadingState(false);
          }
        }
      });
    }
  };

  const activate = () => {
    isMounted = true;
  };

  const dispose = () => {
    isMounted = false;
    authStateVersion += 1;
    activeLoginVersion = authStateVersion;
    inviteSetupRequestVersion += 1;
    activeInviteSetupVersion = inviteSetupRequestVersion;
    scheduledTimers.forEach(timerId => clearTimeout(timerId));
    scheduledTimers.clear();
  };

  return {
    verifyAndApplySessionProfile,
    refreshUserProfile,
    retryProfileVerification,
    login,
    requestPasswordReset,
    verifyPasswordRecoveryOtp,
    completePasswordRecovery,
    completeEditorInvitePasswordSetup,
    retryEditorInviteSessionSync,
    logout,
    clearAuthError,
    clearAuthenticatedAppState,
    restoreSession,
    handleAuthStateChange,
    activate,
    dispose,
    getSnapshot: () => ({
      session,
      currentUser,
      profileVerificationState,
      isPasswordRecovery,
      isInvitePasswordSetupRequired,
      isInviteSyncPending,
      authStateVersion,
      inviteSetupRequestVersion,
      activeInviteSetupVersion,
      inviteSetupInFlight,
      loginInFlight,
    }),
  };
}

