import React, { useState } from 'react';
import {
  Film,
  Lock,
  Mail,
  User,
  Shield,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  Database,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { getSupabaseConfig, saveSupabaseConfig } from '../../lib/supabase';

export const LoginView: React.FC = () => {
  const { login, signUp, supabaseStatus, checkSupabase } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Admin');
  const [companyId, setCompanyId] = useState<'both' | 'twb' | 'golden_june'>('both');
  const [phone, setPhone] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Supabase Configuration Drawer/Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const currentConfig = getSupabaseConfig();
  const [configUrl, setConfigUrl] = useState(currentConfig.url || '');
  const [configKey, setConfigKey] = useState(currentConfig.key || '');
  const [configSuccess, setConfigSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await login(email.trim(), password);
        if (!result.success) {
          setErrorMessage(result.error || 'Invalid email or password. Please try again.');
        }
      } else {
        const result = await signUp(email.trim(), password, {
          fullName: fullName.trim(),
          role,
          companyId,
          phone: phone.trim(),
        });

        if (result.success) {
          if (result.sessionEstablished) {
            setSuccessMessage('Account created and verified! Redirecting to dashboard...');
          } else {
            setSuccessMessage(
              'Account created! A confirmation email has been sent if required, or you can now sign in.'
            );
            setMode('signin');
          }
        } else {
          setErrorMessage(result.error || 'Failed to create account. Please check your credentials.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
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
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800 mb-6">
            <button
              id="tab-signin-mode"
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-slate-800 text-[#F1D099] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup-mode"
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-slate-800 text-[#F1D099] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Alert Messages */}
          {errorMessage && (
            <div
              id="auth-error-alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name <span className="text-[#F1D099]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Tanvi Sharma"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Assigned Role
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <select
                        id="signup-role"
                        value={role}
                        onChange={e => setRole(e.target.value as UserRole)}
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent cursor-pointer"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Team Member">Team Member</option>
                        <option value="Editor">Editor</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Studio Brand
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <select
                        id="signup-brand"
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value as any)}
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#F1D099] focus:border-transparent cursor-pointer"
                      >
                        <option value="both">Both Brands</option>
                        <option value="twb">The Wedding Booth</option>
                        <option value="golden_june">Golden June</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

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
                {mode === 'signup' && (
                  <span className="text-[11px] text-slate-500">Min. 6 characters</span>
                )}
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
                  <span>{mode === 'signin' ? 'Authenticating with Supabase...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Studio Portal' : 'Create Studio Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Help for Roles */}
          {mode === 'signup' && (
            <div className="mt-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Access Capabilities:</span>
              <p>
                <strong className="text-[#F1D099]">Admin/Manager:</strong> Financials, team scheduling, project contracts.
              </p>
              <p>
                <strong className="text-[#F1D099]">Editor:</strong> Post-production pipeline, raw footage, deliverables review.
              </p>
              <p>
                <strong className="text-[#F1D099]">Team Member:</strong> Shoot calendar, crew availability, wedding events.
              </p>
            </div>
          )}

          {/* Session persistence guarantee */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
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
