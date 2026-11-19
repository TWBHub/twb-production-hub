import { FunctionsHttpError, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import {
  EditorAccountStatusState,
  EditorAccountStatusSummary,
} from '../types';

export const EDITOR_ACCOUNT_FUNCTION_NAME = 'manage-editor-account';

export type { EditorAccountStatusState, EditorAccountStatusSummary };

export interface InviteEditorRequest {
  teamMemberId: string;
  email: string;
  redirectTo?: string;
}

export interface InviteEditorPartialState {
  auth_user_created: boolean | 'unknown' | 'unknown_unobserved';
  app_metadata_updated: boolean;
  profile_created: boolean;
  team_member_linked: boolean;
}

export interface InviteEditorResponse {
  success: true;
  action: 'invite_editor';
  team_member_id: string;
  profile_id: string;
  account_status: EditorAccountStatusState;
  email_sent: boolean;
  recovered_partial_provisioning: boolean;
  partial_state: InviteEditorPartialState;
  message: string;
}

export interface SingleEditorAccountStatusResponse
  extends EditorAccountStatusSummary {
  success: true;
  action: 'account_status';
}

export interface BatchEditorAccountStatusResponse {
  success: true;
  action: 'account_status';
  accounts: EditorAccountStatusSummary[];
}

export interface SetEditorAccountActiveRequest {
  teamMemberId: string;
  loginActive?: boolean;
  teamMemberActive?: boolean;
}

export interface SetEditorAccountActiveResponse
  extends EditorAccountStatusSummary {
  success: true;
  action: 'set_account_active';
}

export interface ResendEditorInviteResponse {
  success: boolean;
  action?: 'resend_invite';
  code?: string;
  error?: string;
  supported?: boolean;
  recoverable?: boolean;
  account_status?: EditorAccountStatusState;
  profile_id?: string | null;
}

export interface CompleteInvitePasswordSetupResponse {
  success: true;
  action: 'complete_invite_password_setup';
  team_member_id: string;
  profile_id: string;
  password_setup_required: boolean;
  email_confirmed: boolean;
  account_status: EditorAccountStatusState;
  message: string;
}

export interface EditorAccountErrorDetails {
  code?: string;
  status?: number;
  retryable?: boolean;
  retry_after_seconds?: number;
  account_status?: EditorAccountStatusState;
  recoverable?: boolean;
  manual_reconciliation_required?: boolean;
  manual_review_required?: boolean;
  supported?: boolean;
  partial_state?: InviteEditorPartialState;
  [key: string]: unknown;
}

export class EditorAccountApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly accountStatus?: EditorAccountStatusState;
  readonly details: EditorAccountErrorDetails;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      details?: EditorAccountErrorDetails;
    } = {}
  ) {
    super(message);
    this.name = 'EditorAccountApiError';
    this.details = options.details ?? {};
    this.code =
      options.code ||
      (typeof this.details.code === 'string' && this.details.code) ||
      'EDITOR_ACCOUNT_ERROR';
    this.status = options.status ?? this.details.status ?? 500;
    this.retryable = this.details.retryable === true;
    this.retryAfterSeconds =
      typeof this.details.retry_after_seconds === 'number'
        ? this.details.retry_after_seconds
        : undefined;
    this.accountStatus = this.details.account_status;
  }
}

function isSafeNonDevOriginUrl(rawUrl: unknown): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (
      parsed.protocol !== 'https:' &&
      !(isLocalhost && parsed.protocol === 'http:')
    ) {
      return undefined;
    }

    if (hostname.startsWith('ais-dev-')) {
      return undefined;
    }

    parsed.hash = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Resolves a safe invitation redirect URL without ever sending an `ais-dev-*`
 * developer preview origin. Returns `undefined` if no safe shared/production
 * origin can be determined so callers omit `redirect_to`.
 */
export function resolveSafeInviteRedirectTo(
  explicitRedirectTo?: string
): string | undefined {
  const fromExplicit = isSafeNonDevOriginUrl(explicitRedirectTo);
  if (fromExplicit) {
    return fromExplicit;
  }
  if (explicitRedirectTo !== undefined && explicitRedirectTo.trim() !== '') {
    // Caller explicitly supplied an unsafe URL (e.g. ais-dev-* or non-HTTPS): never send it
    return undefined;
  }

  const metaEnv =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ??
        undefined)
      : undefined;

  const configuredPublicUrl =
    isSafeNonDevOriginUrl(metaEnv?.VITE_PUBLIC_APP_URL) ||
    isSafeNonDevOriginUrl(metaEnv?.VITE_APP_URL);
  if (configuredPublicUrl) {
    return configuredPublicUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return isSafeNonDevOriginUrl(window.location.origin);
  }

  return undefined;
}

async function extractFunctionError(
  error: unknown
): Promise<EditorAccountApiError> {
  if (error instanceof EditorAccountApiError) {
    return error;
  }

  const errObj = error as {
    message?: string;
    context?: Response | { status?: number; json?: () => Promise<unknown>; clone?: () => Response };
  };

  const context = errObj?.context;
  const contextStatus =
    context && typeof context.status === 'number' ? context.status : 500;

  if (
    context &&
    (error instanceof FunctionsHttpError || typeof context.json === 'function')
  ) {
    try {
      const readable =
        typeof context.clone === 'function' ? context.clone() : context;
      const parsed = (await readable.json()) as EditorAccountErrorDetails | null;
      if (parsed && typeof parsed === 'object') {
        const message =
          typeof parsed.error === 'string' && parsed.error.trim()
            ? parsed.error
            : errObj?.message || 'Editor account request failed.';
        const code =
          typeof parsed.code === 'string' && parsed.code.trim()
            ? parsed.code
            : 'EDITOR_ACCOUNT_ERROR';
        return new EditorAccountApiError(message, {
          code,
          status: contextStatus,
          details: { ...parsed, status: contextStatus },
        });
      }
    } catch {
      // Fall through to generic error extraction if response body is not JSON
    }
  }

  return new EditorAccountApiError(
    errObj?.message || 'Unable to reach Editor account service.',
    {
      code: 'EDGE_FUNCTION_INVOKE_FAILED',
      status: contextStatus,
    }
  );
}

async function invokeManageEditorAccount<TResponse extends Record<string, any>>(
  body: Record<string, unknown>,
  client?: SupabaseClient | null
): Promise<TResponse> {
  const supabase = client !== undefined ? client : getSupabaseClient();
  if (!supabase) {
    throw new EditorAccountApiError('Supabase connection is not configured.', {
      code: 'SUPABASE_NOT_CONFIGURED',
      status: 0,
    });
  }

  const { data, error } = await supabase.functions.invoke<TResponse>(
    EDITOR_ACCOUNT_FUNCTION_NAME,
    { body }
  );

  if (error) {
    throw await extractFunctionError(error);
  }

  if (!data || typeof data !== 'object') {
    throw new EditorAccountApiError(
      'Received an empty response from the Editor account service.',
      {
        code: 'INVALID_RESPONSE',
        status: 502,
      }
    );
  }

  if ((data as { success?: unknown }).success === false) {
    const errPayload = data as unknown as EditorAccountErrorDetails & {
      error?: string;
    };
    throw new EditorAccountApiError(
      errPayload.error || 'Editor account request failed.',
      {
        code: errPayload.code || 'EDITOR_ACCOUNT_ERROR',
        status: typeof errPayload.status === 'number' ? errPayload.status : 400,
        details: errPayload,
      }
    );
  }

  return data;
}

export async function inviteEditor(
  params: InviteEditorRequest,
  client?: SupabaseClient | null
): Promise<InviteEditorResponse> {
  const safeRedirectTo = resolveSafeInviteRedirectTo(params.redirectTo);

  const payload: Record<string, unknown> = {
    action: 'invite_editor',
    team_member_id: params.teamMemberId,
    email: params.email,
  };

  if (safeRedirectTo) {
    payload.redirect_to = safeRedirectTo;
  }

  return invokeManageEditorAccount<InviteEditorResponse>(payload, client);
}

export async function getEditorAccountStatus(
  teamMemberId: string,
  client?: SupabaseClient | null
): Promise<SingleEditorAccountStatusResponse> {
  return invokeManageEditorAccount<SingleEditorAccountStatusResponse>(
    {
      action: 'account_status',
      team_member_id: teamMemberId,
    },
    client
  );
}

export async function getEditorAccountStatuses(
  teamMemberIds?: string[],
  client?: SupabaseClient | null
): Promise<EditorAccountStatusSummary[]> {
  if (Array.isArray(teamMemberIds) && teamMemberIds.length === 0) {
    return [];
  }

  const payload: Record<string, unknown> = {
    action: 'account_status',
  };

  if (Array.isArray(teamMemberIds)) {
    payload.team_member_ids = teamMemberIds;
  }

  const response =
    await invokeManageEditorAccount<BatchEditorAccountStatusResponse>(
      payload,
      client
    );

  return Array.isArray(response.accounts) ? response.accounts : [];
}

export async function setEditorAccountActive(
  params: SetEditorAccountActiveRequest,
  client?: SupabaseClient | null
): Promise<SetEditorAccountActiveResponse> {
  const payload: Record<string, unknown> = {
    action: 'set_account_active',
    team_member_id: params.teamMemberId,
  };

  if (typeof params.loginActive === 'boolean') {
    payload.login_active = params.loginActive;
  }
  if (typeof params.teamMemberActive === 'boolean') {
    payload.team_member_active = params.teamMemberActive;
  }

  return invokeManageEditorAccount<SetEditorAccountActiveResponse>(
    payload,
    client
  );
}

export async function resendEditorInvite(
  teamMemberId: string,
  client?: SupabaseClient | null
): Promise<ResendEditorInviteResponse> {
  return invokeManageEditorAccount<ResendEditorInviteResponse>(
    {
      action: 'resend_invite',
      team_member_id: teamMemberId,
    },
    client
  );
}

export async function completeInvitePasswordSetup(
  newPassword: string,
  client?: SupabaseClient | null
): Promise<CompleteInvitePasswordSetupResponse> {
  return invokeManageEditorAccount<CompleteInvitePasswordSetupResponse>(
    {
      action: 'complete_invite_password_setup',
      new_password: newPassword,
    },
    client
  );
}
