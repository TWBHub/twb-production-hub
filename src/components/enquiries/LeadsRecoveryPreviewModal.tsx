import React, { useState } from 'react';
import {
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  History,
  Lock,
  FileText,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import type { SupabaseConnectionDiagnostics } from '../../lib/supabase';
import {
  LeadsBackupSnapshot,
  LeadsRecoveryPreview,
  LeadMigrationReceiptEntry,
  LeadsMigrationReport,
  buildBackupDownloadPayload,
  getBackupDownloadFilename,
} from '../../utils/leadsPersistenceUtils';

interface LeadsRecoveryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  migrating: boolean;
  error: string | null;
  diagnostics: SupabaseConnectionDiagnostics | null;
  latestBackup: LeadsBackupSnapshot | null;
  backups: LeadsBackupSnapshot[];
  preview: LeadsRecoveryPreview | null;
  migrationReceipts?: LeadMigrationReceiptEntry[];
  migrationReport: LeadsMigrationReport | null;
  quotationsTableStatus: { exists: boolean; count: number; error?: string } | null;
  onRefreshPreview: () => Promise<void>;
  onCreateManualBackup: () => void;
  onExecuteMigration: () => Promise<void>;
}

const SOURCE_LABELS: Record<SupabaseConnectionDiagnostics['credentialSource'], string> = {
  environment: 'Environment (.env)',
  localStorage_override: 'Browser localStorage Override',
  mixed: 'Mixed (localStorage + Environment)',
  unconfigured: 'Not Configured',
};

export const LeadsRecoveryPreviewModal: React.FC<LeadsRecoveryPreviewModalProps> = ({
  isOpen,
  onClose,
  loading,
  migrating,
  error,
  diagnostics,
  latestBackup,
  backups,
  preview,
  migrationReceipts = [],
  migrationReport,
  quotationsTableStatus,
  onRefreshPreview,
  onCreateManualBackup,
  onExecuteMigration,
}) => {
  const [showExcluded, setShowExcluded] = useState(false);
  const [showMatched, setShowMatched] = useState(false);
  const [downloadedVersion, setDownloadedVersion] = useState<number | null>(null);
  const [approvalChecked, setApprovalChecked] = useState(false);

  if (!isOpen) return null;

  const handleDownloadSnapshot = (snap: LeadsBackupSnapshot) => {
    if (!diagnostics) return;
    const payload = buildBackupDownloadPayload(snap, diagnostics);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getBackupDownloadFilename(snap);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedVersion(snap.version);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Leads Backup, Recovery Preview &amp; Stage 3 Migration
              </h2>
              <p className="text-xs text-slate-500">
                Inspect this browser&apos;s Supabase project, download versioned backups, review unsynced local Leads, and run Stage 3 migration only upon explicit approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshPreview}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Preview Inspection Error</div>
                <div className="mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* 1. Active Browser Supabase Verification */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>1. Active Supabase Configuration (This Browser Only)</span>
              </div>
              {diagnostics && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    diagnostics.credentialSource === 'environment'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : diagnostics.credentialSource === 'unconfigured'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {SOURCE_LABELS[diagnostics.credentialSource]}
                </span>
              )}
            </div>

            {diagnostics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Supabase Project URL
                  </div>
                  <div className="font-mono text-slate-900 mt-0.5 break-all">
                    {diagnostics.projectUrl || 'Not configured'}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Browser localStorage Overrides
                  </div>
                  <div className="text-slate-800 mt-0.5">
                    URL Override: <strong>{diagnostics.hasUrlOverride ? 'Yes' : 'No'}</strong> &middot; Key Override:{' '}
                    <strong>{diagnostics.hasKeyOverride ? 'Yes (hidden)' : 'No'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500">Loading diagnostics...</div>
            )}

            <p className="text-[11px] text-slate-600">
              {diagnostics?.note || 'Verify the Office Mac separately to confirm it connects to this exact same Project URL.'}
            </p>
          </div>

          {/* 2. Versioned Non-Overwriting Backups */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <History className="w-4 h-4 text-blue-600" />
                <span>2. Versioned Local Backups (Non-Overwriting)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onCreateManualBackup}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  + Create New Snapshot
                </button>
                {latestBackup && (
                  <button
                    type="button"
                    onClick={() => handleDownloadSnapshot(latestBackup)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Backup v{latestBackup.version} (.json)</span>
                  </button>
                )}
              </div>
            </div>

            {downloadedVersion !== null && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Backup <strong>v{downloadedVersion}</strong> downloaded. Please inspect the JSON file before approving Stage 3 migration.
                </span>
              </div>
            )}

            {backups.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Version</th>
                      <th className="px-3 py-2 font-semibold">Created Timestamp</th>
                      <th className="px-3 py-2 font-semibold">Trigger</th>
                      <th className="px-3 py-2 font-semibold">Raw Leads</th>
                      <th className="px-3 py-2 font-semibold">Raw Quotations</th>
                      <th className="px-3 py-2 font-semibold text-right">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...backups].reverse().map(snap => (
                      <tr key={snap.backup_id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">v{snap.version}</td>
                        <td className="px-3 py-2 text-slate-600">{new Date(snap.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {snap.reason === 'auto_pre_recovery' ? 'Auto Snapshot' : 'Manual Snapshot'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{snap.enquiries_count}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{snap.quotations_count}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadSnapshot(snap)}
                            className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>JSON</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-slate-500">
                No raw localStorage snapshots stored yet. Click &ldquo;Create New Snapshot&rdquo; to save a snapshot.
              </div>
            )}
          </div>

          {/* 3. Read-Only Recovery Preview */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>3. Recovery Preview (Local vs. Supabase)</span>
              </div>
              {preview && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    preview.supabase_reachable
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {preview.supabase_reachable ? 'Supabase Enquiries Readable' : 'Supabase Read Error'}
                </span>
              )}
            </div>

            {preview?.supabase_error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800">
                Supabase `enquiries` query error: <strong>{preview.supabase_error}</strong>
              </div>
            )}

            {quotationsTableStatus && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                <span>
                  Supabase <code className="font-mono font-bold">quotations</code> table check (read-only):
                </span>
                <span className="font-semibold">
                  {quotationsTableStatus.exists
                    ? `Exists (${quotationsTableStatus.count} rows)`
                    : `Unavailable (${quotationsTableStatus.error || 'Not provisioned'})`}
                </span>
              </div>
            )}

            {preview && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60">
                    <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                      To Recover / Migrate
                    </div>
                    <div className="text-xl font-bold text-amber-900 mt-0.5">
                      {preview.candidates_to_migrate.length}
                    </div>
                    <div className="text-[10px] text-amber-700">Local-only or modified leads</div>
                  </div>
                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
                      In Supabase DB
                    </div>
                    <div className="text-xl font-bold text-emerald-900 mt-0.5">{preview.supabase_count}</div>
                    <div className="text-[10px] text-emerald-700">
                      {preview.already_in_supabase.length} matched locally
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Unchanged Seeds Excluded
                    </div>
                    <div className="text-xl font-bold text-slate-800 mt-0.5">
                      {preview.unchanged_seeds_excluded.length}
                    </div>
                    <div className="text-[10px] text-slate-500">Original demo seeds</div>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                    <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold">
                      Linked Local Quotations
                    </div>
                    <div className="text-xl font-bold text-blue-900 mt-0.5">
                      {preview.linked_quotations_count}
                    </div>
                    <div className="text-[10px] text-blue-700">Preserved untouched</div>
                  </div>
                </div>

                {/* Candidates List */}
                {preview.candidates_to_migrate.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-semibold text-slate-700">
                      Leads Identified for Migration ({preview.candidates_to_migrate.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50/60 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Lead / Client</th>
                            <th className="px-3 py-2 font-semibold">Brand</th>
                            <th className="px-3 py-2 font-semibold">Status &amp; Event</th>
                            <th className="px-3 py-2 font-semibold">Local ID</th>
                            <th className="px-3 py-2 font-semibold">Quotes</th>
                            <th className="px-3 py-2 font-semibold">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.candidates_to_migrate.map(item => (
                            <tr key={item.lead.id} className="hover:bg-slate-50/60">
                              <td className="px-3 py-2">
                                <div className="font-bold text-slate-900">
                                  {item.lead.title || item.lead.client_name || 'Untitled Lead'}
                                </div>
                                {item.lead.title && item.lead.client_name && item.lead.title !== item.lead.client_name && (
                                  <div className="text-[10px] text-slate-500">{item.lead.client_name}</div>
                                )}
                                <div className="text-[10px] text-slate-400">
                                  Created: {item.lead.created_at ? new Date(item.lead.created_at).toLocaleString() : 'Unknown'}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                                    item.lead.company_id === 'golden_june'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-blue-100 text-blue-900'
                                  }`}
                                >
                                  {item.lead.company_id === 'golden_june' ? 'Golden June' : 'TWB'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                <div>{item.lead.status}</div>
                                <div className="text-[10px] text-slate-500">
                                  {item.lead.event_date || 'No event date'}
                                  {item.lead.estimated_budget
                                    ? ` · ₹${Number(item.lead.estimated_budget).toLocaleString('en-IN')}`
                                    : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{item.lead.id}</td>
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {item.linkedLocalQuotations.length}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      No unsynced local-only Leads were found in this browser&apos;s storage.
                    </span>
                  </div>
                )}

                {/* Collapsible details for matched / excluded */}
                <div className="flex flex-wrap gap-3 pt-1">
                  {preview.already_in_supabase.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMatched(v => !v)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showMatched ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Already in Supabase ({preview.already_in_supabase.length})</span>
                    </button>
                  )}
                  {preview.unchanged_seeds_excluded.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowExcluded(v => !v)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showExcluded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Excluded Unchanged Demo Seeds ({preview.unchanged_seeds_excluded.length})</span>
                    </button>
                  )}
                </div>

                {showMatched && preview.already_in_supabase.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className="font-semibold text-slate-700">Already Matched in Supabase:</div>
                    {preview.already_in_supabase.map(m => (
                      <div key={m.lead.id} className="text-slate-600">
                        • {m.lead.title || m.lead.client_name} (<code className="font-mono">{m.lead.id}</code>) — {m.reason}
                      </div>
                    ))}
                  </div>
                )}

                {showExcluded && preview.unchanged_seeds_excluded.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className="font-semibold text-slate-700">Excluded Unchanged Demo Seeds:</div>
                    {preview.unchanged_seeds_excluded.map(s => (
                      <div key={s.lead.id} className="text-slate-600">
                        • {s.lead.client_name} (<code className="font-mono">{s.lead.id}</code>)
                      </div>
                    ))}
                  </div>
                )}

                {migrationReceipts.length > 0 && (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-[11px]">
                    <div className="font-bold text-emerald-900">
                      Verified Stage 3 Migration Receipts ({migrationReceipts.length})
                    </div>
                    <div className="space-y-1">
                      {migrationReceipts.map(r => (
                        <div key={r.legacy_local_id} className="text-emerald-800 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{r.display_name}:</span>
                          <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                            {r.legacy_local_id}
                          </code>
                          <span>&rarr;</span>
                          <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                            {r.supabase_uuid}
                          </code>
                          <span className="text-[10px] text-emerald-700">
                            (Verified {new Date(r.migrated_at).toLocaleString()})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 4. Stage 3: Explicit User-Gated Migration Execution & Report */}
          {(migrationReport || (preview?.supabase_reachable && preview.candidates_to_migrate.length > 0)) && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <UploadCloud className="w-4 h-4 text-amber-700" />
                  <span>4. Stage 3 Lead Migration (Explicit Approval Required)</span>
                </div>
              </div>

              {preview?.supabase_reachable && preview.candidates_to_migrate.length > 0 && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-white border border-amber-200 text-[11px] text-slate-700 space-y-1">
                    <div>
                      • <strong>Sequential &amp; Verified:</strong> Each Lead receives a valid UUID, retains all fields &amp; multiple events, keeps <code className="font-mono">venue</code>/<code className="font-mono">city</code> separate, keeps blank <code className="font-mono">estimated_budget</code> as <code className="font-mono">NULL</code>, and is verified via read-back before recording a receipt.
                    </div>
                    <div>
                      • <strong>Non-Destructive Guarantee:</strong> Original <code className="font-mono">twbhub_enquiries</code>, <code className="font-mono">twbhub_quotations</code>, and all quotation <code className="font-mono">enquiry_id</code> links remain completely untouched. Failed insertions stay safely in local storage.
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={approvalChecked}
                      onChange={e => setApprovalChecked(e.target.checked)}
                      disabled={migrating}
                      className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>
                      I have reviewed the Recovery Preview, downloaded/verified the JSON backup, and explicitly approve migrating{' '}
                      <strong>{preview.candidates_to_migrate.length}</strong> Lead
                      {preview.candidates_to_migrate.length === 1 ? '' : 's'} to Supabase (without modifying quotations).
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!approvalChecked || migrating || loading}
                      onClick={async () => {
                        await onExecuteMigration();
                        setApprovalChecked(false);
                      }}
                      className="px-4 py-2 text-xs font-bold bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {migrating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Migrating &amp; Verifying Leads...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Execute Stage 3 Migration ({preview.candidates_to_migrate.length} Leads)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {migrationReport && (
                <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-900">
                      Stage 3 Migration Result
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Backup v{migrationReport.backup_version_used ?? '—'} &middot; Completed{' '}
                      {new Date(migrationReport.completed_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <div className="text-slate-500">Attempted</div>
                      <div className="font-bold text-slate-900 text-sm">{migrationReport.attempted_count}</div>
                    </div>
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                      <div className="text-emerald-700">Migrated &amp; Verified</div>
                      <div className="font-bold text-emerald-900 text-sm">{migrationReport.migrated_count}</div>
                    </div>
                    <div className="p-2 rounded bg-blue-50 border border-blue-200">
                      <div className="text-blue-700">Already Present</div>
                      <div className="font-bold text-blue-900 text-sm">{migrationReport.already_migrated_count}</div>
                    </div>
                    <div
                      className={`p-2 rounded border ${
                        migrationReport.failed_count > 0
                          ? 'bg-red-50 border-red-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className={migrationReport.failed_count > 0 ? 'text-red-700' : 'text-slate-500'}>
                        Failed (Retained Locally)
                      </div>
                      <div
                        className={`font-bold text-sm ${
                          migrationReport.failed_count > 0 ? 'text-red-900' : 'text-slate-900'
                        }`}
                      >
                        {migrationReport.failed_count}
                      </div>
                    </div>
                  </div>

                  {migrationReport.results.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-2.5 py-1.5 font-semibold">Lead</th>
                            <th className="px-2.5 py-1.5 font-semibold">Local ID</th>
                            <th className="px-2.5 py-1.5 font-semibold">Supabase UUID</th>
                            <th className="px-2.5 py-1.5 font-semibold">Quotes Preserved</th>
                            <th className="px-2.5 py-1.5 font-semibold">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {migrationReport.results.map(item => (
                            <tr key={item.legacy_local_id}>
                              <td className="px-2.5 py-1.5 font-semibold text-slate-900">{item.display_name}</td>
                              <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-600">{item.legacy_local_id}</td>
                              <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-700">
                                {item.supabase_uuid || '—'}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-700">{item.linked_quotations_preserved}</td>
                              <td className="px-2.5 py-1.5">
                                {item.status === 'migrated' && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                    Migrated &amp; Verified
                                  </span>
                                )}
                                {item.status === 'already_migrated' && (
                                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                                    Already in Supabase
                                  </span>
                                )}
                                {item.status === 'failed' && (
                                  <div className="text-red-700 font-semibold text-[10px]">
                                    Failed: {item.error || 'Unknown error'} (Local record preserved)
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Safe Mode:</strong> Local Leads, quotations, and quotation links are never deleted or overwritten during Stage 3.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors self-end sm:self-auto cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
