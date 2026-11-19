import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import {
  canAccessTab,
  getDefaultLandingTab,
  ProfileLookupResult,
  RefreshAuthSessionResult,
} from '../lib/auth';
import { EditorAccountApiError } from '../services/editorAccounts';
import { Profile, UserRole } from '../types';
import {
  buildCleanedAuthRedirectUrl,
  createAuthOnboardingCoordinator,
  hasAuthRedirectParams,
  isInvitePasswordSetupCompleted,
  isInvitePasswordSetupUser,
  isInviteUrlPresent,
  isRecoveryUrlPresent,
  parseSupabaseAuthUrlError,
  resolveAuthSessionGate,
  validateInviteSetupPassword,
} from './inviteOnboarding';

function makeUser(
  id: string,
  appMetadata: Record<string, unknown> = {},
  email = 'editor@twbhub.test'
): User {
  return {
    id,
    email,
    app_metadata: appMetadata,
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-11-19T00:00:00Z',
  } as unknown as User;
}

function makeSession(user: User, accessToken = 'token-1'): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as unknown as Session;
}

function makeProfile(id: string, role: UserRole = 'Editor'): Profile {
  return {
    id,
    full_name: `${role} User`,
    email: `${role.toLowerCase()}@twbhub.test`,
    role,
    is_active: true,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flushTimers(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 15));
}

function createMockCoordinatorHarness(overrides?: {
  getSession?: () => Promise<Session | null>;
  getAuthoritativeAuthUser?: () => Promise<{
    user: User | null;
    invalidSession: boolean;
    error: Error | null;
  }>;
  refreshAuthSession?: () => Promise<RefreshAuthSessionResult>;
  getUserProfile?: (userId: string) => Promise<ProfileLookupResult>;
  signInWithEmail?: (
    email: string,
    password: string
  ) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  signOut?: () => Promise<{ error: Error | null }>;
  verifyRecoveryOtp?: (
    email: string,
    token: string
  ) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  updateUserPassword?: (newPassword: string) => Promise<{ error: Error | null }>;
  completeInvitePasswordSetup?: (newPassword: string) => Promise<unknown>;
}) {
  const editorUser = makeUser('editor-1', {
    password_setup_required: true,
    invited_team_member_id: 'tm-1',
  });
  const state = {
    session: null as Session | null,
    currentUser: null as Profile | null,
    authLoading: true,
    authError: null as string | null,
    profileVerificationState: 'idle' as 'idle' | 'verified' | 'temporary_error',
    isPasswordRecovery: false,
    isInvitePasswordSetupRequired: false,
    isInviteSyncPending: false,
    activeTab: 'dashboard',
    clearDomainCalls: 0,
    signOutCalls: 0,
  };

  const coordinator = createAuthOnboardingCoordinator({
    getSession: overrides?.getSession ?? (async () => makeSession(editorUser)),
    getAuthoritativeAuthUser:
      overrides?.getAuthoritativeAuthUser ??
      (async () => ({ user: editorUser, invalidSession: false, error: null })),
    refreshAuthSession:
      overrides?.refreshAuthSession ??
      (async () => {
        const updatedUser = makeUser('editor-1', { password_setup_required: false });
        return {
          session: makeSession(updatedUser),
          user: updatedUser,
          authoritativeUser: updatedUser,
          invalidSession: false,
          error: null,
        };
      }),
    getUserProfile:
      overrides?.getUserProfile ??
      (async (userId: string) => ({
        status: 'ok',
        profile: makeProfile(userId, 'Editor'),
        error: null,
      })),
    signInWithEmail:
      overrides?.signInWithEmail ??
      (async () => ({ user: null, session: null, error: new Error('Not configured') })),
    signOut:
      overrides?.signOut ??
      (async () => {
        state.signOutCalls += 1;
        return { error: null };
      }),
    resetPasswordForEmail: async () => ({ error: null }),
    verifyRecoveryOtp:
      overrides?.verifyRecoveryOtp ??
      (async () => ({ user: null, session: null, error: new Error('Not configured') })),
    updateUserPassword: overrides?.updateUserPassword ?? (async () => ({ error: null })),
    completeInvitePasswordSetup:
      overrides?.completeInvitePasswordSetup ?? (async () => ({ success: true })),
    canAccessTab: (tab: string, role: UserRole) => canAccessTab(tab, role),
    getDefaultLandingTab: (role?: UserRole | string | null) =>
      getDefaultLandingTab(role),
    getActiveTab: () => state.activeTab,
    setActiveTab: tab => {
      state.activeTab = tab;
    },
    onSessionChange: next => {
      state.session = next;
    },
    onCurrentUserChange: next => {
      state.currentUser = next;
    },
    onAuthLoadingChange: next => {
      state.authLoading = next;
    },
    onAuthErrorChange: next => {
      state.authError = next;
    },
    onProfileVerificationStateChange: next => {
      state.profileVerificationState = next;
    },
    onPasswordRecoveryChange: next => {
      state.isPasswordRecovery = next;
    },
    onInvitePasswordSetupRequiredChange: next => {
      state.isInvitePasswordSetupRequired = next;
    },
    onInviteSyncPendingChange: next => {
      state.isInviteSyncPending = next;
    },
    onClearDomainData: () => {
      state.clearDomainCalls += 1;
    },
  });

  return { coordinator, state, editorUser };
}

test('invitation metadata detection trusts only server-controlled app_metadata.password_setup_required', () => {
  assert.equal(
    isInvitePasswordSetupUser({ app_metadata: { password_setup_required: true } }),
    true
  );
  assert.equal(
    isInvitePasswordSetupUser({ app_metadata: { password_setup_required: false } }),
    false
  );
  assert.equal(
    isInvitePasswordSetupUser({
      app_metadata: {},
      user_metadata: { password_setup_required: true },
    } as unknown as { app_metadata?: Record<string, unknown> }),
    false
  );
  assert.equal(isInvitePasswordSetupUser(null), false);

  assert.equal(
    isInvitePasswordSetupCompleted({ app_metadata: { password_setup_required: false } }),
    true
  );
  assert.equal(
    isInvitePasswordSetupCompleted({ app_metadata: { password_setup_required: true } }),
    false
  );
  assert.equal(isInvitePasswordSetupCompleted({ app_metadata: {} }), false);
});

test('invitation URL error parsing handles expired/invalid invite fragments without confusing with password recovery', () => {
  const expiredInvite = parseSupabaseAuthUrlError({
    hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    search: '',
  });
  assert.equal(expiredInvite.hasError, true);
  assert.equal(expiredInvite.isRecoveryError, false);
  assert.equal(expiredInvite.errorCode, 'otp_expired');
  assert.match(expiredInvite.message || '', /invitation link is invalid or has expired/i);

  const recoveryError = parseSupabaseAuthUrlError({
    hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=recovery',
    search: '',
  });
  assert.equal(recoveryError.hasError, true);
  assert.equal(recoveryError.isRecoveryError, true);
  assert.match(recoveryError.message || '', /password recovery link/i);

  const noError = parseSupabaseAuthUrlError({
    hash: '#access_token=abc&type=invite',
    search: '',
  });
  assert.equal(noError.hasError, false);
  assert.equal(noError.message, null);

  assert.equal(isInviteUrlPresent({ hash: '#access_token=abc&type=invite' }), true);
  assert.equal(hasAuthRedirectParams({ hash: '#access_token=abc&expires_in=3600' }), true);
  assert.equal(hasAuthRedirectParams({ hash: '', search: '?view=portal' }), false);
  assert.equal(isRecoveryUrlPresent({ hash: '#access_token=abc&type=invite' }), false);
  assert.equal(isRecoveryUrlPresent({ hash: '#access_token=abc&type=recovery' }), true);

  assert.equal(
    buildCleanedAuthRedirectUrl({
      pathname: '/',
      search: '?error=access_denied&error_code=otp_expired&view=portal',
    }),
    '/?view=portal'
  );
  assert.equal(
    buildCleanedAuthRedirectUrl({
      pathname: '/',
      search: '?type=invite&code=123',
    }),
    '/'
  );
});

test('invite password validation strictly enforces 8-128 characters and rejects whitespace/control chars', () => {
  assert.equal(validateInviteSetupPassword('').valid, false);
  assert.equal(validateInviteSetupPassword('Short1!').valid, false);
  assert.equal(validateInviteSetupPassword('        ').valid, false);
  assert.equal(validateInviteSetupPassword('ValidPass1\n').valid, false);
  assert.equal(validateInviteSetupPassword('ValidPass1\r').valid, false);
  assert.equal(validateInviteSetupPassword('ValidPass1\0').valid, false);
  assert.equal(validateInviteSetupPassword('a'.repeat(129)).valid, false);

  assert.equal(validateInviteSetupPassword('12345678').valid, true);
  assert.equal(validateInviteSetupPassword('a'.repeat(128)).valid, true);
});

test('resolveAuthSessionGate never trusts stale cached JWTs on transient getUser failures and preserves active invite gates', () => {
  // 1. Persisted or restored invite session with password_setup_required: true stays gated
  const gatedOutcome = resolveAuthSessionGate({
    isPasswordRecovery: false,
    authUser: { app_metadata: { password_setup_required: true } },
    profileStatus: 'ok',
    profileRole: 'Editor',
  });
  assert.equal(gatedOutcome.mode, 'invite_password_setup');
  assert.equal(gatedOutcome.allowAppAccess, false);
  assert.equal(gatedOutcome.shouldSignOut, false);

  // 2. Transient getUser() failure with cached false MUST block access via temporary_error
  const transientWithCachedFalse = resolveAuthSessionGate({
    isPasswordRecovery: false,
    authUser: null,
    authoritativeUserMissing: true,
    isInviteGateActive: false,
    cachedAuthUser: { app_metadata: { password_setup_required: false } },
    profileStatus: 'ok',
    profileRole: 'Editor',
  });
  assert.equal(transientWithCachedFalse.mode, 'temporary_error');
  assert.equal(transientWithCachedFalse.allowAppAccess, false);
  assert.equal(transientWithCachedFalse.shouldSignOut, false);

  // 3. Transient getUser() failure while invite gate is ALREADY active preserves invite_password_setup
  const transientWhileGated = resolveAuthSessionGate({
    isPasswordRecovery: false,
    authUser: null,
    authoritativeUserMissing: true,
    isInviteGateActive: true,
    cachedAuthUser: { app_metadata: { password_setup_required: false } },
    profileStatus: 'ok',
    profileRole: 'Editor',
  });
  assert.equal(transientWhileGated.mode, 'invite_password_setup');
  assert.equal(transientWhileGated.allowAppAccess, false);
  assert.equal(transientWhileGated.shouldSignOut, false);

  // 4. Active invite gate only clears if fresh authoritative metadata explicitly has password_setup_required === false
  const missingFlagWhileGated = resolveAuthSessionGate({
    isPasswordRecovery: false,
    authUser: { app_metadata: {} },
    authoritativeUserMissing: false,
    isInviteGateActive: true,
    profileStatus: 'ok',
    profileRole: 'Editor',
  });
  assert.equal(missingFlagWhileGated.mode, 'invite_password_setup');
  assert.equal(missingFlagWhileGated.allowAppAccess, false);

  // 5. Inactive, missing, or unsupported profiles fail closed with sign-out
  for (const status of ['inactive', 'not_found', 'unsupported_role'] as const) {
    const denied = resolveAuthSessionGate({
      isPasswordRecovery: false,
      authUser: { app_metadata: { password_setup_required: true } },
      profileStatus: status,
      profileRole: null,
    });
    assert.equal(denied.mode, 'denied');
    assert.equal(denied.allowAppAccess, false);
    assert.equal(denied.shouldSignOut, true);
  }

  // 6. After backend setup succeeds AND authoritative metadata explicitly confirms password_setup_required: false
  const unlocked = resolveAuthSessionGate({
    isPasswordRecovery: false,
    authUser: { app_metadata: { password_setup_required: false } },
    isInviteGateActive: true,
    profileStatus: 'ok',
    profileRole: 'Editor',
  });
  assert.equal(unlocked.mode, 'authenticated');
  assert.equal(unlocked.allowAppAccess, true);
  assert.equal(unlocked.shouldSignOut, false);
  assert.equal(getDefaultLandingTab('Editor'), 'deliverables');
});

test('coordinator enforces invite gate when cached metadata says setup false but authoritative metadata says true', async () => {
  const staleCachedUser = makeUser('editor-1', { password_setup_required: false });
  const authoritativeUser = makeUser('editor-1', { password_setup_required: true });
  const staleSession = makeSession(staleCachedUser, 'stale-jwt');

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => staleSession,
    getAuthoritativeAuthUser: async () => ({
      user: authoritativeUser,
      invalidSession: false,
      error: null,
    }),
  });

  await coordinator.restoreSession();

  assert.equal(state.isInvitePasswordSetupRequired, true);
  assert.equal(state.currentUser, null);
  assert.equal(state.authLoading, false);
  assert.equal(state.activeTab, 'dashboard');
  coordinator.dispose();
});

test('coordinator blocks cached false session on transient getUser failure and preserves active invite gate across TOKEN_REFRESHED failures', async () => {
  const staleCachedUser = makeUser('editor-1', { password_setup_required: false });
  const authoritativeTrueUser = makeUser('editor-1', { password_setup_required: true });
  const authoritativeFalseUser = makeUser('editor-1', { password_setup_required: false });

  let getUserMode: 'transient_fail' | 'still_true' | 'cleared' = 'transient_fail';

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => makeSession(staleCachedUser),
    getAuthoritativeAuthUser: async () => {
      if (getUserMode === 'transient_fail') {
        return { user: null, invalidSession: false, error: new Error('Network timeout') };
      }
      if (getUserMode === 'still_true') {
        return { user: authoritativeTrueUser, invalidSession: false, error: null };
      }
      return { user: authoritativeFalseUser, invalidSession: false, error: null };
    },
  });

  // 1. Initial restore with cached=false and transient getUser error -> temporary_error, NO app access
  await coordinator.restoreSession();
  assert.equal(state.currentUser, null);
  assert.equal(state.profileVerificationState, 'temporary_error');
  assert.equal(state.signOutCalls, 0);

  // 2. Retry succeeds with authoritative=true -> enters invite setup gate
  getUserMode = 'still_true';
  await coordinator.retryProfileVerification();
  assert.equal(state.isInvitePasswordSetupRequired, true);
  assert.equal(state.currentUser, null);
  assert.equal(state.profileVerificationState, 'idle');

  // 3. Background TOKEN_REFRESHED arrives with stale cached=false while getUser transiently fails -> invite gate MUST remain active
  getUserMode = 'transient_fail';
  coordinator.handleAuthStateChange('TOKEN_REFRESHED', makeSession(staleCachedUser, 'refreshed-stale'));
  await flushTimers();

  assert.equal(state.isInvitePasswordSetupRequired, true);
  assert.equal(state.currentUser, null);

  // 4. Only once fresh authoritative metadata confirms password_setup_required === false does a subsequent check unlock
  getUserMode = 'cleared';
  coordinator.handleAuthStateChange('TOKEN_REFRESHED', makeSession(authoritativeFalseUser, 'refreshed-clean'));
  await flushTimers();

  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.currentUser?.id, 'editor-1');
  assert.equal(state.activeTab, 'deliverables');
  coordinator.dispose();
});

test('coordinator recovers when backend password setup succeeds but refreshSession fails transiently, and retry resumes without resubmitting password', async () => {
  const gatedUser = makeUser('editor-1', { password_setup_required: true });
  const clearedUser = makeUser('editor-1', { password_setup_required: false });

  let completeCalls = 0;
  let refreshShouldFail = true;
  let getUserPhase: 'true' | 'fail' | 'false' = 'true';

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => makeSession(gatedUser),
    getAuthoritativeAuthUser: async () => {
      if (getUserPhase === 'true') {
        return { user: gatedUser, invalidSession: false, error: null };
      }
      if (getUserPhase === 'fail') {
        return { user: null, invalidSession: false, error: new Error('Temporary Auth outage') };
      }
      return { user: clearedUser, invalidSession: false, error: null };
    },
    completeInvitePasswordSetup: async () => {
      completeCalls += 1;
      if (completeCalls > 1) {
        throw new EditorAccountApiError('Password setup is no longer required.', {
          code: 'PASSWORD_SETUP_NOT_REQUIRED',
          status: 403,
        });
      }
      // Backend updated user metadata, but next immediate getUser/refresh fails transiently
      getUserPhase = 'fail';
      return { success: true };
    },
    refreshAuthSession: async () => {
      if (refreshShouldFail) {
        return {
          session: null,
          user: null,
          authoritativeUser: null,
          invalidSession: false,
          error: new Error('Temporary refreshSession 503'),
        };
      }
      return {
        session: makeSession(clearedUser, 'fresh-token'),
        user: clearedUser,
        authoritativeUser: clearedUser,
        invalidSession: false,
        error: null,
      };
    },
  });

  await coordinator.restoreSession();
  assert.equal(state.isInvitePasswordSetupRequired, true);

  // Attempt 1: backend succeeds, refreshSession & fallback getUser fail transiently
  const firstAttempt = await coordinator.completeEditorInvitePasswordSetup('StrongPass123!');
  assert.equal(firstAttempt.success, false);
  assert.equal(completeCalls, 1);
  assert.equal(state.isInvitePasswordSetupRequired, true);
  assert.equal(state.isInviteSyncPending, true);
  assert.equal(state.currentUser, null);
  assert.notEqual(state.session, null);
  assert.match(firstAttempt.error || '', /retry session sync/i);

  // Retry resumes session sync without calling completeInvitePasswordSetup again
  getUserPhase = 'false';
  refreshShouldFail = false;
  const retryResult = await coordinator.retryEditorInviteSessionSync();
  assert.equal(retryResult.success, true);
  assert.equal(completeCalls, 1);
  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.isInviteSyncPending, false);
  assert.equal(state.currentUser?.id, 'editor-1');
  assert.equal(state.activeTab, 'deliverables');
  coordinator.dispose();
});

test('coordinator never unlocks when refreshSession returns stale password_setup_required: true after backend success, and retries cleanly without resubmitting password', async () => {
  const gatedUser = makeUser('editor-1', { password_setup_required: true });
  const clearedUser = makeUser('editor-1', { password_setup_required: false });

  let completeCalls = 0;
  let serverHasPropagated = false;

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => makeSession(gatedUser),
    getAuthoritativeAuthUser: async () => ({
      user: serverHasPropagated ? clearedUser : gatedUser,
      invalidSession: false,
      error: null,
    }),
    completeInvitePasswordSetup: async () => {
      completeCalls += 1;
      if (completeCalls > 1) {
        throw new EditorAccountApiError('Password setup is not required.', {
          code: 'PASSWORD_SETUP_NOT_REQUIRED',
          status: 403,
        });
      }
      return { success: true };
    },
    refreshAuthSession: async () => {
      const targetUser = serverHasPropagated ? clearedUser : gatedUser;
      return {
        session: makeSession(targetUser, 'refreshed-jwt'),
        user: targetUser,
        authoritativeUser: targetUser,
        invalidSession: false,
        error: null,
      };
    },
  });

  await coordinator.restoreSession();
  assert.equal(state.isInvitePasswordSetupRequired, true);

  // Attempt 1: backend succeeds, but refreshed metadata is stale (`true`)
  const firstAttempt = await coordinator.completeEditorInvitePasswordSetup('StrongPass123!');
  assert.equal(firstAttempt.success, false);
  assert.equal(completeCalls, 1);
  assert.equal(state.isInvitePasswordSetupRequired, true);
  assert.equal(state.isInviteSyncPending, true);
  assert.equal(state.currentUser, null);
  assert.equal(state.activeTab, 'dashboard');

  // Even calling completeEditorInvitePasswordSetup directly on retry skips backend resubmission
  serverHasPropagated = true;
  const secondAttempt = await coordinator.completeEditorInvitePasswordSetup('StrongPass123!');
  assert.equal(secondAttempt.success, true);
  assert.equal(completeCalls, 1);
  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.currentUser?.id, 'editor-1');
  assert.equal(state.activeTab, 'deliverables');
  coordinator.dispose();
});

test('coordinator rejects duplicate concurrent submit and scopes lock cleanup across logout + re-entry', async () => {
  const gatedUser = makeUser('editor-1', { password_setup_required: true });
  const clearedUser = makeUser('editor-1', { password_setup_required: false });
  const setupDeferred1 = createDeferred<unknown>();
  const setupDeferred2 = createDeferred<unknown>();
  let setupInvocation = 0;

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => makeSession(gatedUser),
    getAuthoritativeAuthUser: async () => ({
      user: setupInvocation === 2 && state.isInviteSyncPending ? clearedUser : gatedUser,
      invalidSession: false,
      error: null,
    }),
    completeInvitePasswordSetup: async () => {
      setupInvocation += 1;
      return setupInvocation === 1 ? setupDeferred1.promise : setupDeferred2.promise;
    },
  });

  await coordinator.restoreSession();
  assert.equal(state.isInvitePasswordSetupRequired, true);

  // Start request #1 (pending on completeInvitePasswordSetup)
  const req1Promise = coordinator.completeEditorInvitePasswordSetup('StrongPass123!');
  // Allow preAuthCheck microtask to advance into completeInvitePasswordSetup
  await Promise.resolve();
  assert.equal(coordinator.getSnapshot().inviteSetupInFlight, true);

  // Duplicate concurrent submit must fail immediately
  const duplicateResult = await coordinator.completeEditorInvitePasswordSetup('StrongPass123!');
  assert.equal(duplicateResult.success, false);
  assert.match(duplicateResult.error || '', /already in progress/i);
  assert.equal(setupInvocation, 1);

  // Logout while request #1 is pending clears lock & gate immediately
  await coordinator.logout();
  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.currentUser, null);
  assert.equal(state.session, null);
  assert.equal(coordinator.getSnapshot().inviteSetupInFlight, false);

  // Sign back in and start request #2 while request #1 is STILL pending
  await coordinator.verifyAndApplySessionProfile(makeSession(gatedUser));
  assert.equal(state.isInvitePasswordSetupRequired, true);
  const req2Promise = coordinator.completeEditorInvitePasswordSetup('AnotherPass123!');
  await Promise.resolve();
  assert.equal(setupInvocation, 2);
  assert.equal(coordinator.getSnapshot().inviteSetupInFlight, true);

  // Now stale request #1 finally resolves: it MUST NOT restore old state or clear request #2's lock
  setupDeferred1.resolve({ success: true });
  const req1Result = await req1Promise;
  assert.equal(req1Result.success, false);
  assert.equal(coordinator.getSnapshot().inviteSetupInFlight, true);

  // Complete request #2 cleanly
  setupDeferred2.resolve({ success: true });
  const req2Result = await req2Promise;
  assert.equal(req2Result.success, true);
  assert.equal(coordinator.getSnapshot().inviteSetupInFlight, false);
  assert.equal(state.currentUser?.id, 'editor-1');
  coordinator.dispose();
});

test('older auth verification or INITIAL_SESSION completing after newer SIGNED_OUT cannot restore authenticated state', async () => {
  const gatedUser = makeUser('editor-1', { password_setup_required: true });
  const adminUser = makeUser('admin-1', {}, 'admin@twbhub.test');
  const getUserDeferred = createDeferred<{
    user: User | null;
    invalidSession: boolean;
    error: Error | null;
  }>();

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => makeSession(adminUser),
    getAuthoritativeAuthUser: () => getUserDeferred.promise,
    getUserProfile: async (userId: string) => ({
      status: 'ok',
      profile: makeProfile(userId, userId === 'admin-1' ? 'Admin' : 'Editor'),
      error: null,
    }),
  });

  // Start restoreSession + emit INITIAL_SESSION closely together
  const restorePromise = coordinator.restoreSession();
  coordinator.handleAuthStateChange('INITIAL_SESSION', makeSession(gatedUser));
  await flushTimers();

  // Newer SIGNED_OUT event arrives before authoritative verification finishes
  coordinator.handleAuthStateChange('SIGNED_OUT' as AuthChangeEvent, null);
  assert.equal(state.currentUser, null);
  assert.equal(state.session, null);
  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.authLoading, false);

  // Older verification settles AFTER SIGNED_OUT — state must remain signed out
  getUserDeferred.resolve({ user: adminUser, invalidSession: false, error: null });
  await restorePromise;
  await flushTimers();

  assert.equal(state.currentUser, null);
  assert.equal(state.session, null);
  assert.equal(state.isInvitePasswordSetupRequired, false);
  coordinator.dispose();
});

test('existing Admin/Manager login and OTP password recovery flows remain unaffected', async () => {
  const adminUser = makeUser('admin-1', {}, 'admin@twbhub.test');
  let passwordUpdatedWith: string | null = null;

  const { coordinator, state } = createMockCoordinatorHarness({
    getSession: async () => null,
    getAuthoritativeAuthUser: async () => ({
      user: adminUser,
      invalidSession: false,
      error: null,
    }),
    getUserProfile: async (userId: string) => ({
      status: 'ok',
      profile: makeProfile(userId, 'Admin'),
      error: null,
    }),
    signInWithEmail: async () => ({
      user: adminUser,
      session: makeSession(adminUser, 'admin-jwt'),
      error: null,
    }),
    verifyRecoveryOtp: async () => ({
      user: adminUser,
      session: makeSession(adminUser, 'recovery-jwt'),
      error: null,
    }),
    updateUserPassword: async pwd => {
      passwordUpdatedWith = pwd;
      return { error: null };
    },
  });

  // 1. Standard Admin login
  const loginRes = await coordinator.login('admin@twbhub.test', 'AdminSecret1!');
  assert.equal(loginRes.success, true);
  assert.equal(state.currentUser?.role, 'Admin');
  assert.equal(state.activeTab, 'dashboard');
  assert.equal(state.isInvitePasswordSetupRequired, false);

  // 2. Password recovery OTP flow stays isolated from invite setup
  const otpRes = await coordinator.verifyPasswordRecoveryOtp('admin@twbhub.test', '123456');
  assert.equal(otpRes.success, true);
  assert.equal(state.isPasswordRecovery, true);
  assert.equal(state.isInvitePasswordSetupRequired, false);
  assert.equal(state.currentUser, null);

  // Completing password recovery uses updateUserPassword and restores Admin dashboard
  const completeRecoveryRes = await coordinator.completePasswordRecovery('NewAdminPass1!');
  assert.equal(completeRecoveryRes.success, true);
  assert.equal(passwordUpdatedWith, 'NewAdminPass1!');
  assert.equal(state.isPasswordRecovery, false);
  assert.equal(state.currentUser?.role, 'Admin');
  assert.equal(state.activeTab, 'dashboard');
  coordinator.dispose();
});

test('existing resolveAuthSessionGate password recovery decision table remains isolated', () => {
  const recoveryOutcome = resolveAuthSessionGate({
    isPasswordRecovery: true,
    bypassRecoveryCheck: false,
    authUser: { app_metadata: {} },
    profileStatus: 'ok',
    profileRole: 'Admin',
  });
  assert.equal(recoveryOutcome.mode, 'password_recovery');
  assert.equal(recoveryOutcome.allowAppAccess, false);
  assert.equal(recoveryOutcome.shouldSignOut, false);

  const afterRecoveryComplete = resolveAuthSessionGate({
    isPasswordRecovery: true,
    bypassRecoveryCheck: true,
    authUser: { app_metadata: {} },
    profileStatus: 'ok',
    profileRole: 'Admin',
  });
  assert.equal(afterRecoveryComplete.mode, 'authenticated');
  assert.equal(afterRecoveryComplete.allowAppAccess, true);
  assert.equal(getDefaultLandingTab('Admin'), 'dashboard');
});

test('AppContext, App, LoginView, and inviteOnboarding wire the hardened setup and recovery flows cleanly', () => {
  const appContextSource = fs.readFileSync(
    path.resolve('src/context/AppContext.tsx'),
    'utf8'
  );
  const onboardingSource = fs.readFileSync(
    path.resolve('src/utils/inviteOnboarding.ts'),
    'utf8'
  );
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  const loginViewSource = fs.readFileSync(
    path.resolve('src/components/auth/LoginView.tsx'),
    'utf8'
  );

  // AppContext delegates auth lifecycle cleanly through createAuthOnboardingCoordinator
  assert.match(appContextSource, /createAuthOnboardingCoordinator/);
  assert.match(appContextSource, /completeInvitePasswordSetup\(newPassword\)/);
  assert.match(appContextSource, /refreshAuthSession\(\)/);
  assert.match(appContextSource, /getAuthoritativeAuthUser\(\)/);
  assert.match(appContextSource, /updateUserPassword\(newPassword\)/);
  assert.match(appContextSource, /retryEditorInviteSessionSync/);

  // Coordinator enforces Edge Function setup without calling updateUserPassword for invite setup
  assert.match(onboardingSource, /deps\.completeInvitePasswordSetup\(newPassword\)/);
  assert.match(onboardingSource, /isInvitePasswordSetupCompleted\(/);

  // App.tsx explicitly blocks entry when isInvitePasswordSetupRequired is true
  assert.match(appSource, /isInvitePasswordSetupRequired/);

  // LoginView keeps Cancel & Sign Out enabled and supports passwordless Retry Session Sync
  assert.match(loginViewSource, /Complete Your TWB Hub Account Setup/);
  assert.match(loginViewSource, /completeEditorInvitePasswordSetup/);
  assert.match(loginViewSource, /retryEditorInviteSessionSync/);
  assert.match(loginViewSource, /validateInviteSetupPassword/);
  const cancelBtnMatch = loginViewSource.match(
    /id="btn-invite-setup-cancel"[\s\S]*?<\/button>/
  );
  assert.ok(cancelBtnMatch, 'Cancel button should exist in invite setup form');
  assert.doesNotMatch(cancelBtnMatch[0], /disabled=/);
});

