import { Enquiry, EnquiryStatus, ProjectEvent, Quotation, QuotationStatus } from '../types';
import { INITIAL_ENQUIRIES } from '../services/seedData';
import { isUuid, resolveBrandCode, resolveCompanyUuid } from './companyUtils';
import type { SupabaseConnectionDiagnostics } from '../lib/supabase';

export const LEADS_STORAGE_KEY = 'twbhub_enquiries';
export const QUOTATIONS_STORAGE_KEY = 'twbhub_quotations';
export const LEADS_BACKUPS_STORAGE_KEY = 'twbhub_leads_backups_v1';
export const LEADS_MIGRATION_RECEIPT_KEY = 'twbhub_leads_migration_receipt_v1';

export type DbEnquiryStatus =
  | 'new'
  | 'contacted'
  | 'follow_up'
  | 'quotation_sent'
  | 'converted'
  | 'lost';

export interface LeadMigrationReceiptEntry {
  legacy_local_id: string;
  supabase_uuid: string;
  migrated_at: string;
  display_name: string;
  verified: boolean;
}

export interface LeadMigrationItemResult {
  legacy_local_id: string;
  supabase_uuid?: string;
  display_name: string;
  status: 'migrated' | 'already_migrated' | 'failed';
  linked_quotations_preserved: number;
  error?: string;
}

export interface LeadsMigrationReport {
  started_at: string;
  completed_at: string;
  attempted_count: number;
  migrated_count: number;
  already_migrated_count: number;
  failed_count: number;
  results: LeadMigrationItemResult[];
  backup_version_used: number | null;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LeadsBackupSnapshot {
  backup_id: string;
  version: number;
  created_at: string;
  reason: 'auto_pre_recovery' | 'manual_snapshot';
  raw_enquiries_json: string | null;
  raw_quotations_json: string | null;
  enquiries: Enquiry[];
  quotations: Quotation[];
  enquiries_count: number;
  quotations_count: number;
  fingerprint: string;
}

export interface LeadRecoveryCandidate {
  lead: Enquiry;
  category: 'local_only' | 'modified_seed' | 'already_in_supabase' | 'unchanged_seed';
  reason: string;
  hasValidUuid: boolean;
  linkedLocalQuotations: Quotation[];
  matchedSupabaseLeadId?: string;
}

export interface LeadsRecoveryPreview {
  generated_at: string;
  supabase_reachable: boolean;
  supabase_error?: string;
  supabase_count: number;
  local_total_count: number;
  local_quotations_total_count: number;
  candidates_to_migrate: LeadRecoveryCandidate[];
  already_in_supabase: LeadRecoveryCandidate[];
  unchanged_seeds_excluded: LeadRecoveryCandidate[];
  linked_quotations_count: number;
  all_local_leads_raw: Enquiry[];
}

export function getDefaultStorageAdapter(): StorageAdapter | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function computeRawFingerprint(
  rawEnquiriesJson: string | null,
  rawQuotationsJson: string | null
): string {
  const input = `${rawEnquiriesJson ?? 'NULL'}||${rawQuotationsJson ?? 'NULL'}`;
  // Deterministic 53-bit FNV-1a-like hex fingerprint (no crypto dependency needed)
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getLeadsBackupSnapshots(storage: StorageAdapter | null = getDefaultStorageAdapter()): LeadsBackupSnapshot[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LEADS_BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LeadsBackupSnapshot[];
  } catch {
    return [];
  }
}

/**
 * Creates a versioned, non-overwriting backup snapshot of raw local Leads
 * (`twbhub_enquiries`) and local Quotations (`twbhub_quotations`).
 *
 * - Never overwrites or clears `twbhub_enquiries` or `twbhub_quotations`.
 * - Never overwrites prior backup versions in `twbhub_leads_backups_v1`.
 * - For `auto_pre_recovery`, avoids appending a duplicate version if the raw
 *   storage fingerprint matches the most recent snapshot.
 */
export function createVersionedBackupSnapshot(
  storage: StorageAdapter | null = getDefaultStorageAdapter(),
  reason: 'auto_pre_recovery' | 'manual_snapshot' = 'auto_pre_recovery',
  nowIso: string = new Date().toISOString()
): { snapshot: LeadsBackupSnapshot | null; createdNew: boolean; allSnapshots: LeadsBackupSnapshot[] } {
  if (!storage) {
    return { snapshot: null, createdNew: false, allSnapshots: [] };
  }

  const rawEnquiriesJson = storage.getItem(LEADS_STORAGE_KEY);
  const rawQuotationsJson = storage.getItem(QUOTATIONS_STORAGE_KEY);
  const existing = getLeadsBackupSnapshots(storage);

  if (reason === 'auto_pre_recovery' && rawEnquiriesJson === null && rawQuotationsJson === null) {
    return {
      snapshot: existing.length > 0 ? existing[existing.length - 1] : null,
      createdNew: false,
      allSnapshots: existing,
    };
  }

  const fingerprint = computeRawFingerprint(rawEnquiriesJson, rawQuotationsJson);
  const latest = existing.length > 0 ? existing[existing.length - 1] : null;

  if (reason === 'auto_pre_recovery' && latest && latest.fingerprint === fingerprint) {
    return {
      snapshot: latest,
      createdNew: false,
      allSnapshots: existing,
    };
  }

  const enquiries = safeParseArray<Enquiry>(rawEnquiriesJson);
  const quotations = safeParseArray<Quotation>(rawQuotationsJson);
  const nextVersion = existing.reduce((max, b) => Math.max(max, b.version || 0), 0) + 1;
  const compactTs = nowIso.replace(/[-:.TZ]/g, '').slice(0, 14);

  const snapshot: LeadsBackupSnapshot = {
    backup_id: `leads-backup-v${nextVersion}-${compactTs}`,
    version: nextVersion,
    created_at: nowIso,
    reason,
    raw_enquiries_json: rawEnquiriesJson,
    raw_quotations_json: rawQuotationsJson,
    enquiries,
    quotations,
    enquiries_count: enquiries.length,
    quotations_count: quotations.length,
    fingerprint,
  };

  const updatedSnapshots = [...existing, snapshot];
  storage.setItem(LEADS_BACKUPS_STORAGE_KEY, JSON.stringify(updatedSnapshots));

  return {
    snapshot,
    createdNew: true,
    allSnapshots: updatedSnapshots,
  };
}

export function buildBackupDownloadPayload(
  snapshot: LeadsBackupSnapshot,
  diagnostics: SupabaseConnectionDiagnostics
) {
  return {
    export_format: 'twbhub_leads_backup_v1',
    exported_at: new Date().toISOString(),
    backup_id: snapshot.backup_id,
    backup_version: snapshot.version,
    backup_created_at: snapshot.created_at,
    backup_reason: snapshot.reason,
    fingerprint: snapshot.fingerprint,
    browser_supabase_diagnostics: {
      project_url: diagnostics.projectUrl,
      credential_source: diagnostics.credentialSource,
      has_url_override: diagnostics.hasUrlOverride,
      has_key_override: diagnostics.hasKeyOverride,
      is_configured: diagnostics.isConfigured,
      note: diagnostics.note,
    },
    counts: {
      enquiries_count: snapshot.enquiries_count,
      quotations_count: snapshot.quotations_count,
    },
    raw_storage: {
      twbhub_enquiries: snapshot.raw_enquiries_json,
      twbhub_quotations: snapshot.raw_quotations_json,
    },
    enquiries: snapshot.enquiries,
    quotations: snapshot.quotations,
  };
}

export function getBackupDownloadFilename(snapshot: LeadsBackupSnapshot): string {
  const datePart = snapshot.created_at.slice(0, 19).replace(/[:T]/g, '-');
  return `twbhub-leads-backup-v${snapshot.version}-${datePart}.json`;
}

const normalizeStr = (val?: string | null): string => (val ?? '').trim().toLowerCase();

const normalizeEventsForCompare = (events?: Enquiry['events']): string => {
  if (!Array.isArray(events) || events.length === 0) return '[]';
  return JSON.stringify(
    events.map(ev => ({
      event_name: (ev.event_name || '').trim(),
      event_date: ev.event_date || '',
      event_time: (ev.event_time || '').trim(),
      event_address: (ev.event_address || '').trim(),
      team: (ev.team || '').trim(),
      event_notes: (ev.event_notes || '').trim(),
    }))
  );
};

const normalizeServicesForCompare = (services?: string[]): string => {
  if (!Array.isArray(services) || services.length === 0) return '[]';
  return JSON.stringify(services.map(s => s.trim()));
};

/**
 * Returns true ONLY if the local record matches an initial seed entry's ID AND
 * has not been edited/customized by the user.
 */
export function isUnchangedSeedEnquiry(
  lead: Enquiry,
  initialSeeds: Enquiry[] = INITIAL_ENQUIRIES
): boolean {
  const seed = initialSeeds.find(s => s.id === lead.id);
  if (!seed) return false;

  return (
    resolveBrandCode(lead.company_id) === resolveBrandCode(seed.company_id) &&
    normalizeStr(lead.title) === normalizeStr(seed.title) &&
    normalizeStr(lead.client_name) === normalizeStr(seed.client_name) &&
    normalizeStr(lead.partner_name) === normalizeStr(seed.partner_name) &&
    normalizeStr(lead.email) === normalizeStr(seed.email) &&
    normalizeStr(lead.phone) === normalizeStr(seed.phone) &&
    normalizeStr(lead.instagram) === normalizeStr(seed.instagram) &&
    normalizeStr(lead.event_date) === normalizeStr(seed.event_date) &&
    normalizeStr(lead.venue) === normalizeStr(seed.venue) &&
    normalizeStr(lead.city) === normalizeStr(seed.city) &&
    normalizeStr(lead.lead_source) === normalizeStr(seed.lead_source) &&
    normalizeStr(lead.requirements) === normalizeStr(seed.requirements) &&
    normalizeStr(lead.package_interest) === normalizeStr(seed.package_interest) &&
    Number(lead.estimated_budget || 0) === Number(seed.estimated_budget || 0) &&
    normalizeStr(lead.status) === normalizeStr(seed.status) &&
    normalizeStr(lead.follow_up_date) === normalizeStr(seed.follow_up_date) &&
    normalizeStr(lead.consultation_date) === normalizeStr(seed.consultation_date) &&
    normalizeStr(lead.assigned_to) === normalizeStr(seed.assigned_to) &&
    normalizeStr(lead.notes) === normalizeStr(seed.notes) &&
    normalizeStr(lead.client_preferences) === normalizeStr(seed.client_preferences) &&
    normalizeStr(lead.logistics_notes) === normalizeStr(seed.logistics_notes) &&
    normalizeStr(lead.quotation_status) === normalizeStr(seed.quotation_status) &&
    Boolean(lead.is_archived) === Boolean(seed.is_archived) &&
    normalizeServicesForCompare(lead.services) === normalizeServicesForCompare(seed.services) &&
    normalizeEventsForCompare(lead.events) === normalizeEventsForCompare(seed.events)
  );
}

export function getLeadsMigrationReceipts(
  storage: StorageAdapter | null = getDefaultStorageAdapter()
): LeadMigrationReceiptEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LEADS_MIGRATION_RECEIPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeadMigrationReceiptEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordLeadMigrationReceipt(
  entry: LeadMigrationReceiptEntry,
  storage: StorageAdapter | null = getDefaultStorageAdapter()
): LeadMigrationReceiptEntry[] {
  if (!storage) return [entry];
  const existing = getLeadsMigrationReceipts(storage);
  const filtered = existing.filter(e => e.legacy_local_id !== entry.legacy_local_id);
  const updated = [...filtered, entry];
  storage.setItem(LEADS_MIGRATION_RECEIPT_KEY, JSON.stringify(updated));
  return updated;
}

export function mapEnquiryStatusToDb(status?: string | null): DbEnquiryStatus {
  const clean = (status || '').trim().toLowerCase();
  switch (clean) {
    case 'new':
      return 'new';
    case 'contacted':
      return 'contacted';
    case 'meeting scheduled':
    case 'meeting_scheduled':
    case 'follow_up':
    case 'follow up':
      return 'follow_up';
    case 'proposal sent':
    case 'proposal_sent':
    case 'quotation_sent':
    case 'quotation sent':
      return 'quotation_sent';
    case 'won':
    case 'converted':
      return 'converted';
    case 'lost':
      return 'lost';
    default:
      return 'new';
  }
}

export function mapDbToEnquiryStatus(status?: string | null): EnquiryStatus {
  const clean = (status || '').trim().toLowerCase();
  switch (clean) {
    case 'new':
      return 'New';
    case 'contacted':
      return 'Contacted';
    case 'follow_up':
    case 'follow up':
    case 'meeting scheduled':
    case 'meeting_scheduled':
      return 'Meeting Scheduled';
    case 'quotation_sent':
    case 'quotation sent':
    case 'proposal sent':
    case 'proposal_sent':
      return 'Proposal Sent';
    case 'converted':
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    default:
      return 'New';
  }
}

function normalizeOptionalString(val?: string | null): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDateOrNull(val?: string | null): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  const datePrefix = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePrefix) ? datePrefix : null;
}

function normalizeProjectEvents(events?: any): ProjectEvent[] {
  if (!Array.isArray(events)) return [];
  return events.map((ev: any, idx: number) => ({
    id: ev?.id || `evt-${idx + 1}`,
    event_name: typeof ev?.event_name === 'string' && ev.event_name.trim() ? ev.event_name.trim() : `Event ${idx + 1}`,
    event_date: typeof ev?.event_date === 'string' ? ev.event_date : '',
    event_time: normalizeOptionalString(ev?.event_time) || undefined,
    event_address: normalizeOptionalString(ev?.event_address) || undefined,
    team: normalizeOptionalString(ev?.team) || undefined,
    event_notes: normalizeOptionalString(ev?.event_notes) || undefined,
    sort_order: typeof ev?.sort_order === 'number' ? ev.sort_order : idx,
  }));
}

/**
 * Maps a raw Supabase `public.enquiries` row into the frontend `Enquiry` model.
 * - Keeps `venue` and `city` separate; only falls back to legacy `event_location`
 *   when BOTH `venue` and `city` are absent on untouched pre-upgrade rows.
 * - Falls back `title` and `client_name` safely to legacy `name`.
 * - Preserves `NULL` `estimated_budget` as `undefined` (never coerces to 0).
 */
export function mapSupabaseEnquiryToModel(row: any): Enquiry {
  const legacyName = normalizeOptionalString(row?.name);
  const title = normalizeOptionalString(row?.title) ?? legacyName ?? undefined;
  const clientName = normalizeOptionalString(row?.client_name) ?? legacyName ?? undefined;

  const explicitVenue = normalizeOptionalString(row?.venue);
  const explicitCity = normalizeOptionalString(row?.city);
  const hasExplicitVenueOrCity = row?.venue != null || row?.city != null;
  const venue = explicitVenue ?? (!hasExplicitVenueOrCity ? normalizeOptionalString(row?.event_location) : null) ?? undefined;
  const city = explicitCity ?? undefined;

  const hasBudget =
    row?.estimated_budget !== null &&
    row?.estimated_budget !== undefined &&
    row?.estimated_budget !== '' &&
    !Number.isNaN(Number(row.estimated_budget));

  return {
    id: String(row.id),
    company_id: resolveBrandCode(row.company_id),
    title,
    client_name: clientName,
    partner_name: normalizeOptionalString(row?.partner_name) ?? undefined,
    email: normalizeOptionalString(row?.email) ?? undefined,
    phone: normalizeOptionalString(row?.phone) ?? undefined,
    instagram: normalizeOptionalString(row?.instagram) ?? undefined,
    event_date: normalizeDateOrNull(row?.event_date) ?? undefined,
    venue,
    city,
    lead_source: normalizeOptionalString(row?.lead_source) ?? normalizeOptionalString(row?.source) ?? undefined,
    requirements: normalizeOptionalString(row?.requirements) ?? undefined,
    package_interest: normalizeOptionalString(row?.package_interest) ?? undefined,
    estimated_budget: hasBudget ? Number(row.estimated_budget) : undefined,
    status: mapDbToEnquiryStatus(row?.status),
    follow_up_date: normalizeDateOrNull(row?.follow_up_date) ?? undefined,
    consultation_date: normalizeDateOrNull(row?.consultation_date) ?? undefined,
    assigned_to: normalizeOptionalString(row?.assigned_to) ?? undefined,
    services: Array.isArray(row?.services) ? row.services.map((s: any) => String(s)) : [],
    events: normalizeProjectEvents(row?.events),
    notes: row?.notes != null && String(row.notes).trim() !== '' ? String(row.notes) : undefined,
    client_preferences: normalizeOptionalString(row?.client_preferences) ?? undefined,
    logistics_notes: normalizeOptionalString(row?.logistics_notes) ?? undefined,
    quotation_status: (normalizeOptionalString(row?.quotation_status) || 'Draft') as QuotationStatus,
    is_archived: Boolean(row?.is_archived ?? row?.archived ?? false),
    currency: row?.currency === 'USD' ? 'USD' : 'INR',
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || undefined,
  };
}

/**
 * Builds a complete, schema-compatible `public.enquiries` write payload
 * preserving all TWBHub fields, multi-event objects, separate venue/city,
 * nullable estimated_budget, and legacy column compatibility (`name`, `enquiry_date`,
 * `source`, `event_location`).
 */
export function buildEnquirySupabasePayload(
  lead: Enquiry | Omit<Enquiry, 'id' | 'created_at'>,
  idOverride?: string,
  options?: { preserveTimestamps?: boolean }
) {
  const preserveTimestamps = options?.preserveTimestamps ?? true;
  const recordId =
    idOverride || ('id' in lead && isUuid(lead.id) ? lead.id : crypto.randomUUID());

  const title = normalizeOptionalString(lead.title);
  const clientName = normalizeOptionalString(lead.client_name) ?? title;
  const legacyName = title ?? clientName ?? 'Untitled Lead';

  const venue = normalizeOptionalString(lead.venue);
  const city = normalizeOptionalString(lead.city);
  const eventLocation = [venue, city].filter(Boolean).join(', ') || null;

  const leadSource = normalizeOptionalString(lead.lead_source);
  const nowIso = new Date().toISOString();
  const createdAt =
    preserveTimestamps && 'created_at' in lead && lead.created_at
      ? lead.created_at
      : nowIso;
  const updatedAt =
    preserveTimestamps && 'updated_at' in lead && lead.updated_at
      ? lead.updated_at
      : preserveTimestamps && 'created_at' in lead && lead.created_at
      ? lead.created_at
      : nowIso;
  const enquiryDate = normalizeDateOrNull(createdAt) || nowIso.slice(0, 10);

  const hasBudget =
    lead.estimated_budget !== null &&
    lead.estimated_budget !== undefined &&
    (lead.estimated_budget as any) !== '' &&
    !Number.isNaN(Number(lead.estimated_budget));

  return {
    id: recordId,
    company_id: resolveCompanyUuid(lead.company_id),
    name: legacyName,
    title,
    client_name: clientName,
    partner_name: normalizeOptionalString(lead.partner_name),
    email: normalizeOptionalString(lead.email),
    phone: normalizeOptionalString(lead.phone),
    instagram: normalizeOptionalString(lead.instagram),
    enquiry_date: enquiryDate,
    event_date: normalizeDateOrNull(lead.event_date),
    venue,
    city,
    event_location: eventLocation,
    source: leadSource,
    lead_source: leadSource,
    requirements: normalizeOptionalString(lead.requirements),
    package_interest: normalizeOptionalString(lead.package_interest),
    estimated_budget: hasBudget ? Number(lead.estimated_budget) : null,
    status: mapEnquiryStatusToDb(lead.status),
    follow_up_date: normalizeDateOrNull(lead.follow_up_date),
    consultation_date: normalizeDateOrNull(lead.consultation_date),
    assigned_to: normalizeOptionalString(lead.assigned_to),
    services: Array.isArray(lead.services) ? lead.services : [],
    events: normalizeProjectEvents(lead.events),
    notes: lead.notes && String(lead.notes).trim() !== '' ? String(lead.notes) : null,
    client_preferences: normalizeOptionalString(lead.client_preferences),
    logistics_notes: normalizeOptionalString(lead.logistics_notes),
    quotation_status: normalizeOptionalString(lead.quotation_status) || 'Draft',
    is_archived: Boolean(lead.is_archived),
    currency: lead.currency === 'USD' ? 'USD' : 'INR',
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function timestampsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const msA = Date.parse(a);
  const msB = Date.parse(b);
  if (Number.isNaN(msA) || Number.isNaN(msB)) {
    return normalizeStr(a) === normalizeStr(b);
  }
  return Math.abs(msA - msB) <= 2000;
}

/**
 * Checks whether a local lead already exists in the Supabase dataset.
 * Checks verified migration receipts first, then exact ID, then conservative
 * name/title + contact or parsed epoch timestamp matching to prevent duplicates.
 */
export function findMatchingSupabaseLead(
  localLead: Enquiry,
  supabaseLeads: Enquiry[],
  receipts: LeadMigrationReceiptEntry[] = []
): Enquiry | null {
  const receipt = receipts.find(r => r.legacy_local_id === localLead.id && r.verified);
  if (receipt) {
    const byReceipt = supabaseLeads.find(s => s.id === receipt.supabase_uuid);
    if (byReceipt) return byReceipt;
  }

  const byId = supabaseLeads.find(s => s.id === localLead.id);
  if (byId) return byId;

  const localClient = normalizeStr(localLead.client_name);
  const localTitle = normalizeStr(localLead.title);
  const localEmail = normalizeStr(localLead.email);
  const localPhone = (localLead.phone || '').replace(/\D/g, '');

  return (
    supabaseLeads.find(sb => {
      const sbClient = normalizeStr(sb.client_name);
      const sbTitle = normalizeStr(sb.title);
      const nameMatches =
        (localClient && sbClient && localClient === sbClient) ||
        (localTitle && sbTitle && localTitle === sbTitle) ||
        (localTitle && sbClient && localTitle === sbClient);

      if (!nameMatches) return false;

      if (localEmail && normalizeStr(sb.email) === localEmail) return true;
      if (localPhone.length >= 7 && (sb.phone || '').replace(/\D/g, '').endsWith(localPhone.slice(-10))) return true;
      if (timestampsMatch(localLead.created_at, sb.created_at)) return true;

      return false;
    }) || null
  );
}

/**
 * Builds a strictly read-only Recovery Preview comparing local Leads & Quotations
 * against current Supabase rows without mutating any data.
 */
export function buildLeadsRecoveryPreview(params: {
  localLeads: Enquiry[];
  localQuotations: Quotation[];
  supabaseLeads: Enquiry[];
  initialSeeds?: Enquiry[];
  migrationReceipts?: LeadMigrationReceiptEntry[];
  supabaseReachable: boolean;
  supabaseError?: string;
  generatedAt?: string;
}): LeadsRecoveryPreview {
  const {
    localLeads,
    localQuotations,
    supabaseLeads,
    initialSeeds = INITIAL_ENQUIRIES,
    migrationReceipts = [],
    supabaseReachable,
    supabaseError,
    generatedAt = new Date().toISOString(),
  } = params;

  const candidates_to_migrate: LeadRecoveryCandidate[] = [];
  const already_in_supabase: LeadRecoveryCandidate[] = [];
  const unchanged_seeds_excluded: LeadRecoveryCandidate[] = [];

  for (const lead of localLeads) {
    const linkedLocalQuotations = localQuotations.filter(q => q.enquiry_id === lead.id);
    const matchedSb = supabaseReachable
      ? findMatchingSupabaseLead(lead, supabaseLeads, migrationReceipts)
      : null;

    if (matchedSb) {
      const viaReceipt = migrationReceipts.some(
        r => r.legacy_local_id === lead.id && r.supabase_uuid === matchedSb.id && r.verified
      );
      already_in_supabase.push({
        lead,
        category: 'already_in_supabase',
        reason: viaReceipt
          ? 'Verified migrated record in Supabase'
          : matchedSb.id === lead.id
          ? 'Exact ID match found in Supabase'
          : 'Matching client/title & contact/timestamp found in Supabase',
        hasValidUuid: isUuid(lead.id),
        linkedLocalQuotations,
        matchedSupabaseLeadId: matchedSb.id,
      });
      continue;
    }

    if (isUnchangedSeedEnquiry(lead, initialSeeds)) {
      unchanged_seeds_excluded.push({
        lead,
        category: 'unchanged_seed',
        reason: 'Default unchanged sample/seed record',
        hasValidUuid: isUuid(lead.id),
        linkedLocalQuotations,
      });
      continue;
    }

    const isSeedId = initialSeeds.some(s => s.id === lead.id);
    candidates_to_migrate.push({
      lead,
      category: isSeedId ? 'modified_seed' : 'local_only',
      reason: isSeedId
        ? 'Sample record modified locally — not present in Supabase'
        : isUuid(lead.id)
        ? 'Local lead with UUID not found in Supabase'
        : 'Manually created local lead (legacy non-UUID ID) not in Supabase',
      hasValidUuid: isUuid(lead.id),
      linkedLocalQuotations,
    });
  }

  const linkedQuotationsCount = candidates_to_migrate.reduce(
    (sum, item) => sum + item.linkedLocalQuotations.length,
    0
  );

  return {
    generated_at: generatedAt,
    supabase_reachable: supabaseReachable,
    supabase_error: supabaseError,
    supabase_count: supabaseLeads.length,
    local_total_count: localLeads.length,
    local_quotations_total_count: localQuotations.length,
    candidates_to_migrate,
    already_in_supabase,
    unchanged_seeds_excluded,
    linked_quotations_count: linkedQuotationsCount,
    all_local_leads_raw: localLeads,
  };
}

/**
 * Checks whether raw `twbhub_enquiries` contains any local-only or modified-seed leads
 * that have not yet been confirmed in Supabase.
 */
export function hasUnsyncedLocalLeads(
  localLeads: Enquiry[],
  supabaseLeads: Enquiry[],
  initialSeeds: Enquiry[] = INITIAL_ENQUIRIES,
  migrationReceipts: LeadMigrationReceiptEntry[] = []
): boolean {
  const preview = buildLeadsRecoveryPreview({
    localLeads,
    localQuotations: [],
    supabaseLeads,
    initialSeeds,
    migrationReceipts,
    supabaseReachable: true,
  });
  return preview.candidates_to_migrate.length > 0;
}

/**
 * Reads the best available raw local leads and quotations without altering storage.
 * Prefers live `twbhub_enquiries` / `twbhub_quotations`, falling back to latest backup if needed.
 */
export function readRawLocalLeadsAndQuotations(
  storage: StorageAdapter | null = getDefaultStorageAdapter()
): { localLeads: Enquiry[]; localQuotations: Quotation[] } {
  if (!storage) return { localLeads: [], localQuotations: [] };

  const rawEnq = storage.getItem(LEADS_STORAGE_KEY);
  const rawQuo = storage.getItem(QUOTATIONS_STORAGE_KEY);
  let localLeads = safeParseArray<Enquiry>(rawEnq);
  let localQuotations = safeParseArray<Quotation>(rawQuo);

  if (localLeads.length === 0 || localQuotations.length === 0) {
    const backups = getLeadsBackupSnapshots(storage);
    const latest = backups.length > 0 ? backups[backups.length - 1] : null;
    if (latest) {
      if (localLeads.length === 0 && latest.enquiries.length > 0) {
        localLeads = latest.enquiries;
      }
      if (localQuotations.length === 0 && latest.quotations.length > 0) {
        localQuotations = latest.quotations;
      }
    }
  }

  return { localLeads, localQuotations };
}

export interface SupabaseQueryResult<T = any> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}

export interface EnquiriesSupabaseClientAdapter {
  selectAll(): Promise<SupabaseQueryResult<any[]>>;
  insertAndReturn(payload: Record<string, any>): Promise<SupabaseQueryResult<any>>;
  updateAndReturn(id: string, payload: Record<string, any>): Promise<SupabaseQueryResult<any>>;
  deleteById(id: string): Promise<{ error: { message: string; code?: string } | null }>;
}

/**
 * Returns true when raw local storage still holds unmigrated recovery records
 * (non-UUID manual leads or locally modified seed leads without verified receipts).
 * Used to guarantee Stage 4 cache writes never overwrite unmigrated local recovery data.
 */
export function hasUnverifiedLocalRecoveryRecords(
  localLeads: Enquiry[],
  receipts: LeadMigrationReceiptEntry[],
  initialSeeds: Enquiry[] = INITIAL_ENQUIRIES
): boolean {
  return localLeads.some(lead => {
    if (isUuid(lead.id)) return false;
    if (isUnchangedSeedEnquiry(lead, initialSeeds)) return false;
    const hasVerifiedReceipt = receipts.some(
      r => r.legacy_local_id === lead.id && r.verified
    );
    return !hasVerifiedReceipt;
  });
}

function writeCacheIfSafe(
  storage: StorageAdapter | null,
  updatedCache: Enquiry[],
  initialSeeds: Enquiry[] = INITIAL_ENQUIRIES
): void {
  if (!storage) return;
  const { localLeads } = readRawLocalLeadsAndQuotations(storage);
  const receipts = getLeadsMigrationReceipts(storage);
  if (hasUnverifiedLocalRecoveryRecords(localLeads, receipts, initialSeeds)) {
    // Preserve original local recovery records untouched until migration is complete
    return;
  }
  storage.setItem(LEADS_STORAGE_KEY, JSON.stringify(updatedCache));
}

/**
 * Stage 4 authoritative Read:
 * - Preserves a non-destructive pre-recovery snapshot first.
 * - When Supabase is configured, queries Supabase directly and throws on any error
 *   (never silently falling back to localStorage).
 * - Merges any still-unsynced local recovery candidates read-only for visibility
 *   without overwriting `twbhub_enquiries` while unmigrated records exist.
 */
export async function fetchEnquiriesWithSupabase(params: {
  adapter: EnquiriesSupabaseClientAdapter | null;
  storage?: StorageAdapter | null;
  fallbackUnconfigured?: () => Enquiry[];
  initialSeeds?: Enquiry[];
}): Promise<Enquiry[]> {
  const {
    adapter,
    storage = getDefaultStorageAdapter(),
    fallbackUnconfigured,
    initialSeeds = INITIAL_ENQUIRIES,
  } = params;

  createVersionedBackupSnapshot(storage, 'auto_pre_recovery');

  if (!adapter) {
    return fallbackUnconfigured ? fallbackUnconfigured() : [];
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load Leads from Supabase: ${error.message}`);
  }

  const supabaseLeads = (data || []).map((row: any) => mapSupabaseEnquiryToModel(row));
  const { localLeads } = readRawLocalLeadsAndQuotations(storage);
  const migrationReceipts = getLeadsMigrationReceipts(storage);

  if (hasUnsyncedLocalLeads(localLeads, supabaseLeads, initialSeeds, migrationReceipts)) {
    const preview = buildLeadsRecoveryPreview({
      localLeads,
      localQuotations: [],
      supabaseLeads,
      initialSeeds,
      migrationReceipts,
      supabaseReachable: true,
    });
    const unsyncedLocal = preview.candidates_to_migrate.map(c => c.lead);
    return [...unsyncedLocal, ...supabaseLeads];
  }

  writeCacheIfSafe(storage, supabaseLeads, initialSeeds);
  return supabaseLeads;
}

/**
 * Stage 4 authoritative Create:
 * - Reuses `buildEnquirySupabasePayload` & `mapSupabaseEnquiryToModel`.
 * - Generates a valid UUID and inserts into Supabase with `.select().single()`.
 * - Throws immediately on failure; never silently writes a failed lead to localStorage.
 * - Returns the actual mapped row returned by Supabase.
 */
export async function createEnquiryWithSupabase(params: {
  enquiry: Omit<Enquiry, 'id' | 'created_at'>;
  adapter: EnquiriesSupabaseClientAdapter | null;
  storage?: StorageAdapter | null;
  fallbackUnconfiguredCreate?: (enquiry: Omit<Enquiry, 'id' | 'created_at'>) => Enquiry;
  initialSeeds?: Enquiry[];
}): Promise<Enquiry> {
  const {
    enquiry,
    adapter,
    storage = getDefaultStorageAdapter(),
    fallbackUnconfiguredCreate,
    initialSeeds = INITIAL_ENQUIRIES,
  } = params;

  if (!adapter) {
    if (fallbackUnconfiguredCreate) {
      return fallbackUnconfiguredCreate(enquiry);
    }
    throw new Error('Supabase is not configured in this browser. Cannot create Lead.');
  }

  const newUuid = crypto.randomUUID();
  const payload = buildEnquirySupabasePayload(enquiry, newUuid, {
    preserveTimestamps: false,
  });

  const { data, error } = await adapter.insertAndReturn(payload);
  if (error || !data) {
    throw new Error(
      `Failed to save Lead to Supabase: ${error?.message || 'Database did not return the created Lead.'}`
    );
  }

  const savedLead = mapSupabaseEnquiryToModel(data);

  if (storage) {
    const { localLeads } = readRawLocalLeadsAndQuotations(storage);
    const updatedCache = [savedLead, ...localLeads.filter(e => e.id !== savedLead.id)];
    writeCacheIfSafe(storage, updatedCache, initialSeeds);
  }

  return savedLead;
}

/**
 * Stage 4 authoritative Update:
 * - Reuses `buildEnquirySupabasePayload` & `mapSupabaseEnquiryToModel`.
 * - Rejects edits on unmigrated non-UUID local recovery records with clear guidance
 *   instead of silently mutating localStorage or failing with confusing UUID errors.
 * - Uses the actual row returned by Supabase `.update(...).eq('id', ...).select().single()`.
 * - Throws on failure and never pretends a failed update succeeded.
 */
export async function updateEnquiryWithSupabase(params: {
  enquiry: Enquiry;
  adapter: EnquiriesSupabaseClientAdapter | null;
  storage?: StorageAdapter | null;
  fallbackUnconfiguredUpdate?: (enquiry: Enquiry) => Enquiry;
  initialSeeds?: Enquiry[];
}): Promise<Enquiry> {
  const {
    enquiry,
    adapter,
    storage = getDefaultStorageAdapter(),
    fallbackUnconfiguredUpdate,
    initialSeeds = INITIAL_ENQUIRIES,
  } = params;

  if (!adapter) {
    if (fallbackUnconfiguredUpdate) {
      return fallbackUnconfiguredUpdate(enquiry);
    }
    throw new Error('Supabase is not configured in this browser. Cannot update Lead.');
  }

  if (!isUuid(enquiry.id)) {
    throw new Error(
      'This Lead is a local-only recovery record and has not been migrated to Supabase yet. Migrate it via Backup & Recovery Preview before editing it in Supabase.'
    );
  }

  const leadWithUpdatedAt: Enquiry = {
    ...enquiry,
    updated_at: new Date().toISOString(),
  };

  const fullPayload = buildEnquirySupabasePayload(leadWithUpdatedAt, enquiry.id, {
    preserveTimestamps: true,
  });
  const { id: _id, created_at: _createdAt, ...updatePayload } = fullPayload;

  const { data, error } = await adapter.updateAndReturn(enquiry.id, updatePayload);
  if (error || !data) {
    throw new Error(
      `Failed to update Lead in Supabase: ${error?.message || 'Lead was not found or update was rejected.'}`
    );
  }

  const savedLead = mapSupabaseEnquiryToModel(data);

  if (storage) {
    const { localLeads } = readRawLocalLeadsAndQuotations(storage);
    const updatedCache = localLeads.map(e => (e.id === savedLead.id ? savedLead : e));
    writeCacheIfSafe(storage, updatedCache, initialSeeds);
  }

  return savedLead;
}

/**
 * Stage 4 authoritative Delete:
 * - Deletes from Supabase directly when configured and throws on any error.
 * - Rejects deleting unmigrated non-UUID local recovery records so recovery data is never lost.
 */
export async function deleteEnquiryWithSupabase(params: {
  id: string;
  adapter: EnquiriesSupabaseClientAdapter | null;
  storage?: StorageAdapter | null;
  fallbackUnconfiguredDelete?: (id: string) => void;
  initialSeeds?: Enquiry[];
}): Promise<void> {
  const {
    id,
    adapter,
    storage = getDefaultStorageAdapter(),
    fallbackUnconfiguredDelete,
    initialSeeds = INITIAL_ENQUIRIES,
  } = params;

  if (!adapter) {
    if (fallbackUnconfiguredDelete) {
      fallbackUnconfiguredDelete(id);
      return;
    }
    throw new Error('Supabase is not configured in this browser. Cannot delete Lead.');
  }

  if (!isUuid(id)) {
    throw new Error(
      'This Lead is a local-only recovery record and is not in Supabase yet. Recovery records are preserved and cannot be deleted via Supabase CRUD.'
    );
  }

  const { error } = await adapter.deleteById(id);
  if (error) {
    throw new Error(`Failed to delete Lead from Supabase: ${error.message}`);
  }

  if (storage) {
    const { localLeads } = readRawLocalLeadsAndQuotations(storage);
    const updatedCache = localLeads.filter(e => e.id !== id);
    writeCacheIfSafe(storage, updatedCache, initialSeeds);
  }
}

