import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Database,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getSupabaseConfig, saveSupabaseConfig } from '../../lib/supabase';

export const LoginView: React.FC = () => {
  const {
    login,
    logout,
    supabaseStatus,
    checkSupabase,
    authError,
    clearAuthError,
    profileVerificationState,
    retryProfileVerification,
    isPasswordRecovery,
    requestPasswordReset,
    verifyPasswordRecoveryOtp,
    completePasswordRecovery,
  } = useApp();

  const [mode, setMode] = useState<'signin' | 'forgot' | 'verify_otp'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Form Fields (otpCode is kept strictly in ephemeral component state and never persisted)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingVerification, setIsRetryingVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Supabase Configuration Drawer/Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const currentConfig = getSupabaseConfig();
  const [configUrl, setConfigUrl] = useState(currentConfig.url || '');
  const [configKey, setConfigKey] = useState(currentConfig.key || '');
  const [configSuccess, setConfigSuccess] = useState(false);

  const displayedError = errorMessage || authError;

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success && result.error) {
        setErrorMessage(result.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    if (!email.trim()) {
      setErrorMessage('Please enter your studio email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.success) {
        setOtpCode('');
        setMode('verify_otp');
        setSuccessMessage(
          'If an active studio account exists for that email, a 6-digit recovery code has been sent. Enter it below to continue.'
        );
      } else {
        setErrorMessage(result.error || 'Failed to send recovery code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send recovery code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    const cleanEmail = email.trim();
    const cleanOtp = otpCode.replace(/\s+/g, '');

    if (!cleanEmail) {
      setErrorMessage('Please enter your studio email address.');
      return;
    }

    if (!/^\d{6,8}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit numeric recovery code from your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyPasswordRecoveryOtp(cleanEmail, cleanOtp);
      if (result.success) {
        // Clear OTP from memory immediately and prepare fresh Set New Password form
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage(
          'Recovery code verified. Enter a new password below, or click Cancel & Sign Out to keep your existing password.'
        );
      } else {
        setErrorMessage(
          result.error ||
            'Invalid, expired, or already-used recovery code. Please check the code or request a new one.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Recovery code verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    if (!email.trim()) {
      setErrorMessage('Please enter your studio email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.success) {
        setOtpCode('');
        setSuccessMessage(
          'A new 6-digit recovery code has been sent if an active studio account exists for that email.'
        );
      } else {
        setErrorMessage(result.error || 'Failed to resend recovery code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend recovery code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    clearAuthError();

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please confirm your new password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completePasswordRecovery(newPassword);
      if (result.success) {
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        if (result.error) {
          // Password updated, user needs to sign in again because no active session remained
          setSuccessMessage(result.error);
          setMode('signin');
        }
      } else {
        setErrorMessage(result.error || 'Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryVerification = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRetryingVerification(true);
    try {
      const result = await retryProfileVerification();
      if (!result.success && result.error) {
        setErrorMessage(result.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to verify studio profile right now.');
    } finally {
      setIsRetryingVerification(false);
    }
  };

  const handleManualSignOut = async () => {
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    await logout();
    setMode('signin');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(configUrl.trim(), configKey.trim());
    setConfigSuccess(true);
    await checkSupabase();
    setTimeout(() => {
      setConfigSuccess(false);
      setShowConfigModal(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F1D099]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-[#F1D099] animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-[#F1D099]">
              The Wedding Booth & Golden June
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>TWB</span>
            <span className="text-[#F1D099] font-serif italic">Hub</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Wedding Photography & Films Production Portal
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 backdrop-blur-xl">
          {/* Card Header */}
          <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {isPasswordRecovery
                  ? 'Set New Password'
                  : profileVerificationState === 'temporary_error'
                    ? 'Profile Verification Unavailable'
                    : mode === 'forgot'
                      ? 'Reset Studio Password'
                      : mode === 'verify_otp'
                        ? 'Verify Recovery Code'
                        : 'Studio Sign In'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isPasswordRecovery
                  ? 'Choose a strong password for your studio account.'
                  : profileVerificationState === 'temporary_error'
                    ? 'Your session is active, but your studio profile could not be verified.'
                    : mode === 'forgot'
                      ? 'Enter your studio email to receive a 6-digit recovery code.'
                      : mode === 'verify_otp'
                        ? 'Enter the 6-digit code sent to your studio email.'
                        : 'Invitation-only access verified against studio records.'}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#F1D099] shrink-0" />
          </div>

          {/* Alert Messages */}
          {displayedError && (
            <div
              id="auth-error-alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{displayedError}</div>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-alert"
              className="mb-5 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* View 1: Password Recovery (Set New Password) */}
          {isPasswordRecovery ? (
            <form onSubmit={handleSetNewPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    New Password <span className="text-[#F1D099]">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Min. 6 characters</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm New Password <span className="text-[#F1D099]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                id="btn-recovery-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F1D099] hover:bg-[#e7c385] active:bg-[#dbb573] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-lg shadow-[#F1D099]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                id="btn-recovery-cancel"
                type="button"
                onClick={handleManualSignOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cancel & Sign Out</span>
              </button>
            </form>
          ) : profileVerificationState === 'temporary_error' ? (
            /* View 2: Temporary Profile Verification Error (No fabricated access, safe retry/sign-out) */
            <div className="space-y-3">
              <button
                id="btn-retry-profile-verification"
                type="button"
                disabled={isRetryingVerification}
                onClick={handleRetryVerification}
                className="w-full py-3 px-4 rounded-xl bg-[#F1D099] hover:bg-[#e7c385] active:bg-[#dbb573] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-lg shadow-[#F1D099]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isRetryingVerification ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Retrying Verification...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Profile Verification</span>
                  </>
                )}
              </button>

              <button
                id="btn-temp-error-signout"
                type="button"
                onClick={handleManualSignOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : mode === 'forgot' ? (
            /* View 3: Forgot Password (Request 6-digit Email OTP) */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Studio Email Address <span className="text-[#F1D099]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@theweddingbooth.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                id="btn-forgot-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F1D099] hover:bg-[#e7c385] active:bg-[#dbb573] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-lg shadow-[#F1D099]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Sending Recovery Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                id="btn-enter-existing-otp"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setOtpCode('');
                  setMode('verify_otp');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  clearAuthError();
                }}
                className="w-full py-2 text-[11px] text-[#F1D099] hover:underline disabled:opacity-50 cursor-pointer"
              >
                Already have a recovery code? Enter it here
              </button>

              <button
                id="btn-back-to-signin"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setOtpCode('');
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  clearAuthError();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </form>
          ) : mode === 'verify_otp' ? (
            /* View 3B: Verify 6-Digit Recovery OTP Code */
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Studio Email Address <span className="text-[#F1D099]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-otp-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@theweddingbooth.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    6-Digit Recovery Code <span className="text-[#F1D099]">*</span>
                  </label>
                  <button
                    id="btn-resend-otp"
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleResendOtp}
                    className="text-[11px] text-[#F1D099] hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Resend code
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={8}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/[^\d\s]/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs tracking-[0.25em] font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                id="btn-verify-otp-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F1D099] hover:bg-[#e7c385] active:bg-[#dbb573] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-lg shadow-[#F1D099]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Recovery Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Recovery Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                id="btn-back-to-signin-from-otp"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setOtpCode('');
                  setMode('signin');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  clearAuthError();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </form>
          ) : (
            /* View 4: Standard Sign In */
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Studio Email Address <span className="text-[#F1D099]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@theweddingbooth.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password <span className="text-[#F1D099]">*</span>
                  </label>
                  <button
                    id="btn-forgot-password"
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      clearAuthError();
                    }}
                    className="text-[11px] text-[#F1D099] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-auth-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F1D099] hover:bg-[#e7c385] active:bg-[#dbb573] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-lg shadow-[#F1D099]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating with Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Studio Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Session persistence & invitation-only guarantee */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center space-y-1">
            <p className="text-[11px] text-slate-400">
              Invitation-only studio portal. Accounts are provisioned by an administrator.
            </p>
            <p className="text-[11px] text-slate-500">
              Persistent session encrypted and managed by Supabase PostgreSQL Auth.
            </p>
          </div>
        </div>

        {/* Supabase Connection Status Footer */}
        <div className="mt-6 flex items-center justify-between px-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <span>Supabase Auth:</span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                supabaseStatus.connected ? 'text-emerald-400' : 'text-[#F1D099]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseStatus.connected ? 'bg-emerald-400' : 'bg-[#F1D099] animate-pulse'
                }`}
              />
              {supabaseStatus.connected ? 'Connected' : 'Credentials Ready'}
            </span>
          </div>

          <button
            id="btn-open-supabase-config"
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="text-[11px] text-slate-400 hover:text-[#F1D099] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>
        </div>
      </div>

      {/* Supabase Credentials Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Database className="w-4 h-4 text-[#F1D099]" />
                <span>Supabase Configuration</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide your Supabase Project URL and Anon Public Key. Values can also be set in <code className="text-[#F1D099]">.env</code> as <code className="text-[#F1D099]">VITE_SUPABASE_URL</code> and <code className="text-[#F1D099]">VITE_SUPABASE_ANON_KEY</code>.
            </p>

            {configSuccess && (
              <div className="p-2.5 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings saved and applied!</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={configUrl}
                  onChange={e => setConfigUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#F1D099]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Supabase Anon Public Key
                </label>
                <input
                  type="text"
                  value={configKey}
                  onChange={e => setConfigKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#F1D099]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F1D099] hover:bg-[#e7c385] text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Save & Reconnect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
