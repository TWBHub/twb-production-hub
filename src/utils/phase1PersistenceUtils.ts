import {
  Client,
  Deliverable,
  DeliverableStatus,
  Payment,
  PaymentMode,
  Project,
  ProjectData,
  ProjectTeamAssignment,
} from '../types';
import { resolveBrandCode } from './companyUtils';
import {
  computeMilestonesOnStatusChange,
  computeMilestonesOnUpdate,
  parseDeliverableNotes,
  prepareDeliverableForCreate,
  resolveDeliverableStatusOnCreate,
  serializeDeliverableNotes,
  validateDeliverableStatus,
} from './deliverableMilestones';

export const PHASE1_STORAGE_PREFIX = 'twbhub_';

export interface Phase1StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const memoryPhase1Store: Record<string, string> = {};

export function getDefaultPhase1Storage(): Phase1StorageAdapter {
  return {
    getItem(key: string): string | null {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return Object.prototype.hasOwnProperty.call(memoryPhase1Store, key)
          ? memoryPhase1Store[key]
          : null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          memoryPhase1Store[key] = value;
        }
      } catch (err) {
        console.warn('LocalStorage cache write error:', err);
      }
    },
  };
}

/**
 * Reads a cached array from secondary localStorage without falling back to demo seed data.
 */
export function readCachedArray<T>(
  storage: Phase1StorageAdapter | null | undefined,
  key: string
): T[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PHASE1_STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Safely writes an array to secondary localStorage cache. Never throws on storage failure.
 */
export function writeCachedArray<T>(
  storage: Phase1StorageAdapter | null | undefined,
  key: string,
  items: T[]
): void {
  if (!storage) return;
  try {
    storage.setItem(PHASE1_STORAGE_PREFIX + key, JSON.stringify(items));
  } catch (err) {
    console.warn(`LocalStorage cache write failed for ${key}:`, err);
  }
}

/**
 * Reads localStorage or seeds initialFallback ONLY when Supabase is NOT configured.
 */
function readUnconfiguredOrInitial<T>(
  storage: Phase1StorageAdapter | null | undefined,
  key: string,
  initialFallback: T[]
): T[] {
  const existing = readCachedArray<T>(storage, key);
  if (existing !== null) return existing;
  writeCachedArray(storage, key, initialFallback);
  return initialFallback;
}

/**
 * Secondary cache helper for post-write updates (never reads Supabase, never throws).
 */
export function upsertItemInCache<T extends { id: string }>(
  storage: Phase1StorageAdapter | null | undefined,
  key: string,
  item: T,
  prepend: boolean = false
): void {
  const current = readCachedArray<T>(storage, key) || [];
  const exists = current.some(existing => existing.id === item.id);
  let next: T[];
  if (exists) {
    next = current.map(existing => (existing.id === item.id ? item : existing));
  } else {
    next = prepend ? [item, ...current] : [...current, item];
  }
  writeCachedArray(storage, key, next);
}

/**
 * Secondary cache helper for post-delete removal (never reads Supabase, never throws).
 */
export function removeItemFromCache<T extends { id: string }>(
  storage: Phase1StorageAdapter | null | undefined,
  key: string,
  id: string
): void {
  const current = readCachedArray<T>(storage, key);
  if (current === null) return;
  writeCachedArray(
    storage,
    key,
    current.filter(item => item.id !== id)
  );
}

export interface SimpleSelectAdapter {
  selectAll: () => Promise<{ data: any[] | null; error: any }>;
}

export interface PaymentsSupabaseAdapter {
  selectAll: () => Promise<{ data: any[] | null; error: any }>;
  selectProjectCompanyRows?: () => Promise<{
    data: Array<{ id: string; company_id?: string | null }> | null;
    error: any;
  }>;
}

export interface ProjectTeamDeleteAdapter {
  deleteAndReturn: (id: string) => Promise<{ data: any[] | null; error: any }>;
  existsById: (id: string) => Promise<{ exists: boolean; error: any }>;
}

export interface DeliverableMutationAdapter {
  selectById: (id: string) => Promise<{ data: any | null; error: any }>;
  updateAndReturn: (
    id: string,
    payload: Record<string, any>
  ) => Promise<{ data: any[] | null; error: any }>;
}

export interface DeliverableCreateAdapter {
  insertAndReturn: (
    payload: Record<string, any>
  ) => Promise<{ data: any[] | null; error: any }>;
}

/**
 * 1. Clients — Authoritative read when Supabase is configured.
 * Throws on Supabase errors; empty table returns []; never falls back to INITIAL_CLIENTS or localStorage on DB error.
 */
export async function fetchClientsWithSupabase(params: {
  adapter: SimpleSelectAdapter | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Client[];
}): Promise<Client[]> {
  const { adapter, storage = getDefaultPhase1Storage(), initialFallback = [] } = params;

  if (!adapter) {
    return readUnconfiguredOrInitial<Client>(storage, 'clients', initialFallback);
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load clients from Supabase: ${error.message}`);
  }

  const mapped: Client[] = (data || []).map((row: any) => ({
    ...row,
    company_id: resolveBrandCode(row.company_id),
  }));

  writeCachedArray(storage, 'clients', mapped);
  return mapped;
}

/**
 * 2. Deliverables — Authoritative read when Supabase is configured.
 * Throws on Supabase errors; empty table returns []; parses __METADATA__ notes cleanly.
 */
export async function fetchDeliverablesWithSupabase(params: {
  adapter: SimpleSelectAdapter | null;
  mapRow: (row: any) => Deliverable;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Deliverable[];
}): Promise<Deliverable[]> {
  const { adapter, mapRow, storage = getDefaultPhase1Storage(), initialFallback = [] } = params;

  if (!adapter) {
    const stored = readUnconfiguredOrInitial<Deliverable>(storage, 'deliverables', initialFallback);
    return stored.map(d => {
      if (d.notes && typeof d.notes === 'string' && d.notes.startsWith('__METADATA__:')) {
        const parsed = parseDeliverableNotes(d.notes);
        return {
          ...d,
          notes: parsed.userNotes,
          assigned_at: d.assigned_at || parsed.metadata?.assigned_at,
          first_submitted_at: d.first_submitted_at || parsed.metadata?.first_submitted_at,
          delivered_at: d.delivered_at || parsed.metadata?.delivered_at,
        };
      }
      return d;
    });
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load deliverables from Supabase: ${error.message}`);
  }

  const deliverables = (data || []).map(mapRow);
  writeCachedArray(storage, 'deliverables', deliverables);
  return deliverables;
}

/**
 * 3. Finance Payments — Authoritative read when Supabase is configured.
 * Respects that public.payments has no company_id column and resolves brand from project_id.
 * Throws on Supabase errors; empty table returns []; never falls back to INITIAL_PAYMENTS or localStorage on DB error.
 */
export async function fetchPaymentsWithSupabase(params: {
  adapter: PaymentsSupabaseAdapter | null;
  mapDbToPaymentMode: (mode?: string | null) => PaymentMode;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Payment[];
}): Promise<Payment[]> {
  const {
    adapter,
    mapDbToPaymentMode,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
  } = params;

  if (!adapter) {
    return readUnconfiguredOrInitial<Payment>(storage, 'payments', initialFallback);
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load payments from Supabase: ${error.message}`);
  }

  const rows = data || [];
  const cachedProjects = readCachedArray<Project>(storage, 'projects') || [];
  const projectCompanyMap = new Map<string, string>();
  cachedProjects.forEach(proj => {
    if (proj?.id && proj?.company_id) {
      projectCompanyMap.set(proj.id, proj.company_id);
    }
  });

  // If any returned payment references a project not yet in the projects cache,
  // try a lightweight Supabase lookup of (id, company_id) so brand resolution stays accurate on fresh browsers.
  const hasMissingProjectBrand = rows.some(
    (row: any) => !row.company_id && row.project_id && !projectCompanyMap.has(row.project_id)
  );

  if (hasMissingProjectBrand && adapter.selectProjectCompanyRows) {
    try {
      const projRes = await adapter.selectProjectCompanyRows();
      if (!projRes.error && projRes.data) {
        projRes.data.forEach(proj => {
          if (proj?.id && proj?.company_id) {
            projectCompanyMap.set(proj.id, proj.company_id);
          }
        });
      }
    } catch {
      // Non-fatal: AppContext.resolveItemCompanyId also resolves live project brand state
    }
  }

  const mapped: Payment[] = rows.map((row: any) => {
    const rawCompany =
      row.company_id ||
      (row.project_id ? projectCompanyMap.get(row.project_id) : undefined) ||
      'twb';

    return {
      ...row,
      company_id: resolveBrandCode(rawCompany),
      amount: Number(row.amount) || 0,
      payment_mode: mapDbToPaymentMode(row.payment_mode),
    } as Payment;
  });

  writeCachedArray(storage, 'payments', mapped);
  return mapped;
}

/**
 * 4. Project Data — Authoritative read when Supabase is configured.
 * Throws on Supabase errors; empty table returns []; never falls back to INITIAL_PROJECT_DATA or localStorage on DB error.
 */
export async function fetchProjectDataWithSupabase(params: {
  adapter: SimpleSelectAdapter | null;
  mapRow: (row: any) => ProjectData;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: ProjectData[];
}): Promise<ProjectData[]> {
  const { adapter, mapRow, storage = getDefaultPhase1Storage(), initialFallback = [] } = params;

  if (!adapter) {
    return readUnconfiguredOrInitial<ProjectData>(storage, 'project_data', initialFallback);
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load project data from Supabase: ${error.message}`);
  }

  const records = (data || []).map(mapRow);
  writeCachedArray(storage, 'project_data', records);
  return records;
}

/**
 * 5A. Team Availability / Project Team — Authoritative read when Supabase is configured.
 * Throws on Supabase errors; empty table returns []; normalizes assignment_role -> role.
 */
export async function fetchProjectTeamWithSupabase(params: {
  adapter: SimpleSelectAdapter | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: ProjectTeamAssignment[];
}): Promise<ProjectTeamAssignment[]> {
  const { adapter, storage = getDefaultPhase1Storage(), initialFallback = [] } = params;

  if (!adapter) {
    return readUnconfiguredOrInitial<ProjectTeamAssignment>(storage, 'project_team', initialFallback);
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(`Failed to load project team assignments from Supabase: ${error.message}`);
  }

  const normalized: ProjectTeamAssignment[] = (data || []).map((assignment: any) => ({
    ...assignment,
    role: assignment.assignment_role || assignment.role || '',
  }));

  writeCachedArray(storage, 'project_team', normalized);
  return normalized;
}

/**
 * 5B. Remove Team Assignment — Verified delete when Supabase is configured.
 * Checks for DB error and verifies that a row was actually deleted (detecting RLS 0-row blocks or missing rows).
 * Updates secondary localStorage cache ONLY after Supabase succeeds.
 */
export async function removeTeamAssignmentWithSupabase(params: {
  assignmentId: string;
  adapter: ProjectTeamDeleteAdapter | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: ProjectTeamAssignment[];
}): Promise<void> {
  const {
    assignmentId,
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
  } = params;

  const cleanId = assignmentId ? assignmentId.trim() : '';
  if (!cleanId) {
    throw new Error('Cannot remove team assignment: missing assignment ID.');
  }

  if (!adapter) {
    const current = readUnconfiguredOrInitial<ProjectTeamAssignment>(
      storage,
      'project_team',
      initialFallback
    );
    writeCachedArray(
      storage,
      'project_team',
      current.filter(a => a.id !== cleanId && a.id !== assignmentId)
    );
    return;
  }

  const { data, error } = await adapter.deleteAndReturn(cleanId);
  if (error) {
    throw new Error(`Could not remove team assignment from Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    const existsCheck = await adapter.existsById(cleanId);
    if (existsCheck.error) {
      throw new Error(
        `Could not verify team assignment deletion in Supabase: ${existsCheck.error.message}`
      );
    }
    if (existsCheck.exists) {
      throw new Error(
        `Supabase DELETE returned 0 deleted rows for team assignment "${cleanId}". Row Level Security (RLS) or permissions blocked deletion.`
      );
    }
    throw new Error(
      `Team assignment "${cleanId}" was not found in Supabase (0 rows affected). Please refresh the schedule.`
    );
  }

  removeItemFromCache<ProjectTeamAssignment>(storage, 'project_team', cleanId);
}

/**
 * 6. Deliverables Create — Validates workflow status against allowed DB constraint values,
 * defaults unassigned blank creation to 'Not Started' (or 'Assigned' when editor assigned),
 * never silently downgrades an invalid status to NULL, and updates cache only after DB confirmation.
 */
export async function createDeliverableWithSupabase(params: {
  deliverable: Omit<Deliverable, 'id' | 'last_updated'>;
  adapter: DeliverableCreateAdapter | null;
  mapRow: (row: any) => Deliverable;
  toCompanyUuid: (cid: 'twb' | 'golden_june' | string) => string;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Deliverable[];
  nowIso?: string;
  generateId?: () => string;
}): Promise<Deliverable> {
  const {
    deliverable,
    adapter,
    mapRow,
    toCompanyUuid,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
    generateId = () => crypto.randomUUID(),
  } = params;

  const resolvedStatus = resolveDeliverableStatusOnCreate(
    deliverable.status,
    deliverable.assigned_editor_id
  );

  const normalizedDeliverable: Omit<Deliverable, 'id' | 'last_updated'> = {
    ...deliverable,
    status: resolvedStatus,
  };

  const {
    userNotes,
    assigned_at: assignedAt,
    first_submitted_at: firstSubmittedAt,
    delivered_at: deliveredAt,
    serializedNotesForFallback,
  } = prepareDeliverableForCreate(normalizedDeliverable, nowIso);

  if (!adapter) {
    const newDeliverable: Deliverable = {
      ...normalizedDeliverable,
      id: generateId(),
      status: resolvedStatus,
      notes: userNotes,
      client_feedback:
        normalizedDeliverable.client_feedback && normalizedDeliverable.client_feedback.trim()
          ? normalizedDeliverable.client_feedback.trim()
          : undefined,
      last_updated: nowIso,
      assigned_at: assignedAt,
      first_submitted_at: firstSubmittedAt,
      delivered_at: deliveredAt,
    };

    const current = readUnconfiguredOrInitial<Deliverable>(storage, 'deliverables', initialFallback);
    writeCachedArray(
      storage,
      'deliverables',
      [newDeliverable, ...current.filter(d => d.id !== newDeliverable.id)]
    );
    return newDeliverable;
  }

  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const newId = generateId();
  const companyUuid = toCompanyUuid(normalizedDeliverable.company_id);
  const editorId =
    normalizedDeliverable.assigned_editor_id && normalizedDeliverable.assigned_editor_id.trim()
      ? normalizedDeliverable.assigned_editor_id.trim()
      : null;
  const dueDate = normalizedDeliverable.due_date || new Date().toISOString().split('T')[0];

  const insertPayload: Record<string, any> = {
    id: newId,
    project_id: normalizedDeliverable.project_id,
    company_id: companyUuid,
    name: normalizedDeliverable.deliverable_type,
    deliverable_type: normalizedDeliverable.deliverable_type,
    assigned_editor_id: isUuid(editorId) ? editorId : null,
    due_date: dueDate,
    status: resolvedStatus,
    priority: normalizedDeliverable.priority || 'Medium',
    external_link: normalizedDeliverable.external_link || null,
    client_feedback:
      normalizedDeliverable.client_feedback && normalizedDeliverable.client_feedback.trim()
        ? normalizedDeliverable.client_feedback.trim()
        : null,
    notes: userNotes || null,
    assigned_at: assignedAt || null,
    first_submitted_at: firstSubmittedAt || null,
    delivered_at: deliveredAt || null,
  };

  let { data, error } = await adapter.insertAndReturn(insertPayload);

  // Check 0: If milestone columns do not exist in Supabase schema, retry without them and embed in notes
  if (
    error &&
    (error.message?.includes('assigned_at') ||
      error.message?.includes('first_submitted_at') ||
      error.message?.includes('delivered_at') ||
      error.message?.includes('schema cache'))
  ) {
    delete insertPayload.assigned_at;
    delete insertPayload.first_submitted_at;
    delete insertPayload.delivered_at;
    insertPayload.notes = serializedNotesForFallback;
    const retry = await adapter.insertAndReturn(insertPayload);
    data = retry.data;
    error = retry.error;
  }

  // Check 1: If 'name' column does not exist or schema cache complaints
  if (
    error &&
    error.message?.toLowerCase().includes('name') &&
    (error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find'))
  ) {
    delete insertPayload.name;
    const retry = await adapter.insertAndReturn(insertPayload);
    data = retry.data;
    error = retry.error;
  }

  // Check 2: If 'deliverable_type' column does not exist or schema cache complaints
  if (
    error &&
    error.message?.toLowerCase().includes('deliverable_type') &&
    (error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find'))
  ) {
    delete insertPayload.deliverable_type;
    const retry = await adapter.insertAndReturn(insertPayload);
    data = retry.data;
    error = retry.error;
  }

  // Check 3: Foreign key on company_id (UUID vs text slug 'twb' / 'golden_june')
  if (
    error &&
    (error.message?.includes('company_id_fkey') || error.message?.toLowerCase().includes('company_id'))
  ) {
    insertPayload.company_id =
      insertPayload.company_id === companyUuid
        ? (normalizedDeliverable.company_id || 'twb')
        : companyUuid;
    const retry = await adapter.insertAndReturn(insertPayload);
    data = retry.data;
    error = retry.error;
  }

  // Check 4: Foreign key on assigned_editor_id
  if (
    error &&
    (error.message?.includes('assigned_editor_id_fkey') ||
      error.message?.toLowerCase().includes('assigned_editor_id'))
  ) {
    insertPayload.assigned_editor_id = null;
    const retry = await adapter.insertAndReturn(insertPayload);
    data = retry.data;
    error = retry.error;
  }

  // Never downgrade status to NULL on constraint/status errors — fail loudly instead
  if (error) {
    throw new Error(`Could not create deliverable in Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Supabase did not return the created deliverable record.');
  }

  const mapped = mapRow(data[0]);
  const newDeliverable: Deliverable = {
    ...mapped,
    notes: mapped.notes || userNotes,
    assigned_at: mapped.assigned_at || assignedAt,
    first_submitted_at: mapped.first_submitted_at || firstSubmittedAt,
    delivered_at: mapped.delivered_at || deliveredAt,
  };

  upsertItemInCache<Deliverable>(storage, 'deliverables', newDeliverable, true);
  return newDeliverable;
}

/**
 * 6A. Deliverables Milestone Update — Fetches authoritative baseline from Supabase before computing milestones.
 * Respects that public.deliverables stores milestone metadata inside notes (__METADATA__:...) rather than dedicated columns.
 * Verifies returned row; updates secondary cache only after Supabase confirms write.
 */
export async function updateDeliverableWithSupabase(params: {
  deliverable: Deliverable;
  adapter: DeliverableMutationAdapter | null;
  mapRow: (row: any) => Deliverable;
  toCompanyUuid: (cid: 'twb' | 'golden_june' | string) => string;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Deliverable[];
  nowIso?: string;
}): Promise<Deliverable> {
  const {
    deliverable,
    adapter,
    mapRow,
    toCompanyUuid,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
  } = params;

  const cleanNotesInput = (rawNotes?: string | null): string | undefined => {
    if (!rawNotes || typeof rawNotes !== 'string') return undefined;
    const trimmed = rawNotes.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('__METADATA__:')) {
      return parseDeliverableNotes(trimmed).userNotes;
    }
    return trimmed;
  };

  if (!adapter) {
    const current = readUnconfiguredOrInitial<Deliverable>(storage, 'deliverables', initialFallback);
    const existing = current.find(d => d.id === deliverable.id);
    const milestones = computeMilestonesOnUpdate(existing, deliverable, nowIso);
    const userNotes =
      deliverable.notes !== undefined ? cleanNotesInput(deliverable.notes) : existing?.notes;

    const updatedLocal: Deliverable = {
      ...deliverable,
      notes: userNotes,
      client_feedback:
        deliverable.client_feedback && deliverable.client_feedback.trim()
          ? deliverable.client_feedback.trim()
          : undefined,
      assigned_at: milestones.assigned_at,
      first_submitted_at: milestones.first_submitted_at,
      delivered_at: milestones.delivered_at,
      last_updated: nowIso,
    };

    writeCachedArray(
      storage,
      'deliverables',
      current.map(d => (d.id === updatedLocal.id ? updatedLocal : d))
    );
    return updatedLocal;
  }

  // 1. Read authoritative existing record from Supabase (never localStorage)
  const { data: existingRow, error: fetchError } = await adapter.selectById(deliverable.id);
  if (fetchError) {
    throw new Error(
      `Could not load deliverable "${deliverable.id}" from Supabase before updating: ${fetchError.message}`
    );
  }
  if (!existingRow) {
    throw new Error(`Deliverable "${deliverable.id}" was not found in Supabase.`);
  }

  const existing = mapRow(existingRow);

  // 2. Compute milestone timestamps against the authoritative Supabase baseline
  const milestones = computeMilestonesOnUpdate(existing, deliverable, nowIso);

  const userNotes =
    deliverable.notes !== undefined
      ? cleanNotesInput(deliverable.notes)
      : existing.notes;

  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const editorId =
    deliverable.assigned_editor_id && deliverable.assigned_editor_id.trim()
      ? deliverable.assigned_editor_id.trim()
      : null;

  const normalizedFeedback =
    deliverable.client_feedback && deliverable.client_feedback.trim()
      ? deliverable.client_feedback.trim()
      : null;

  // Store milestone metadata cleanly via the verified notes compatibility mechanism
  const serializedNotes = serializeDeliverableNotes(userNotes, milestones);

  const validatedStatus =
    deliverable.status && deliverable.status.trim()
      ? validateDeliverableStatus(deliverable.status)
      : null;

  const updatePayload: Record<string, any> = {
    project_id: deliverable.project_id,
    company_id: toCompanyUuid(deliverable.company_id),
    name: deliverable.deliverable_type,
    deliverable_type: deliverable.deliverable_type,
    assigned_editor_id: isUuid(editorId) ? editorId : null,
    due_date: deliverable.due_date || existing.due_date || new Date().toISOString().split('T')[0],
    status: validatedStatus,
    priority: deliverable.priority || existing.priority || 'Medium',
    external_link: deliverable.external_link || null,
    client_feedback: normalizedFeedback,
    notes: serializedNotes,
    updated_at: nowIso,
  };

  let activePayload = { ...updatePayload };
  let { data, error } = await adapter.updateAndReturn(deliverable.id, activePayload);

  const isMissingColumnError = (err: any, columnName: string) =>
    Boolean(
      err &&
        err.message?.toLowerCase().includes(columnName.toLowerCase()) &&
        (err.message?.includes('schema cache') ||
          err.message?.includes('does not exist') ||
          err.message?.includes('Could not find'))
    );

  // Column compatibility retries for legacy schemas ('name' vs 'deliverable_type', 'updated_at')
  if (isMissingColumnError(error, 'name')) {
    delete activePayload.name;
    const retry = await adapter.updateAndReturn(deliverable.id, activePayload);
    data = retry.data;
    error = retry.error;
  }
  if (isMissingColumnError(error, 'deliverable_type')) {
    delete activePayload.deliverable_type;
    const retry = await adapter.updateAndReturn(deliverable.id, activePayload);
    data = retry.data;
    error = retry.error;
  }
  if (isMissingColumnError(error, 'updated_at')) {
    delete activePayload.updated_at;
    const retry = await adapter.updateAndReturn(deliverable.id, activePayload);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(`Could not update deliverable in Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Could not update deliverable "${deliverable.id}" in Supabase: 0 rows affected (check permissions or record existence).`
    );
  }

  const mapped = mapRow(data[0]);
  const saved: Deliverable = {
    ...mapped,
    notes: deliverable.notes !== undefined ? userNotes : (mapped.notes !== undefined ? mapped.notes : userNotes),
    last_updated: data[0]?.updated_at || data[0]?.last_updated || mapped.last_updated || nowIso,
    assigned_at: mapped.assigned_at ?? milestones.assigned_at,
    first_submitted_at: mapped.first_submitted_at ?? milestones.first_submitted_at,
    delivered_at: mapped.delivered_at ?? milestones.delivered_at,
  };

  upsertItemInCache<Deliverable>(storage, 'deliverables', saved);
  return saved;
}

/**
 * 6B. Deliverables Quick Status Change — Fetches authoritative baseline from Supabase before computing milestones.
 * Verifies returned row; updates secondary cache only after Supabase confirms write.
 */
export async function updateDeliverableStatusWithSupabase(params: {
  deliverableId: string;
  newStatus: DeliverableStatus;
  adapter: DeliverableMutationAdapter | null;
  mapRow: (row: any) => Deliverable;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: Deliverable[];
  nowIso?: string;
}): Promise<Deliverable> {
  const {
    deliverableId,
    newStatus,
    adapter,
    mapRow,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
  } = params;

  if (!adapter) {
    const current = readUnconfiguredOrInitial<Deliverable>(storage, 'deliverables', initialFallback);
    let target = current.find(d => d.id === deliverableId);
    if (!target) {
      throw new Error(`Deliverable "${deliverableId}" was not found locally.`);
    }
    if (target.notes && typeof target.notes === 'string' && target.notes.startsWith('__METADATA__:')) {
      const parsed = parseDeliverableNotes(target.notes);
      target = {
        ...target,
        notes: parsed.userNotes,
        assigned_at: target.assigned_at || parsed.metadata?.assigned_at,
        first_submitted_at: target.first_submitted_at || parsed.metadata?.first_submitted_at,
        delivered_at: target.delivered_at || parsed.metadata?.delivered_at,
      };
    }

    const milestones = computeMilestonesOnStatusChange(target, newStatus, nowIso);
    const updatedLocal: Deliverable = {
      ...target,
      status: (newStatus || '') as DeliverableStatus,
      assigned_at: milestones.assigned_at,
      first_submitted_at: milestones.first_submitted_at,
      delivered_at: milestones.delivered_at,
      last_updated: nowIso,
    };

    writeCachedArray(
      storage,
      'deliverables',
      current.map(d => (d.id === deliverableId ? updatedLocal : d))
    );
    return updatedLocal;
  }

  // 1. Read authoritative baseline from Supabase (never stale localStorage)
  const { data: existingRow, error: fetchError } = await adapter.selectById(deliverableId);
  if (fetchError) {
    throw new Error(
      `Could not load deliverable "${deliverableId}" from Supabase before status change: ${fetchError.message}`
    );
  }
  if (!existingRow) {
    throw new Error(`Deliverable "${deliverableId}" was not found in Supabase.`);
  }

  const target = mapRow(existingRow);

  // 2. Compute milestones preserving existing assigned_at / first_submitted_at / delivered_at
  const milestones = computeMilestonesOnStatusChange(target, newStatus, nowIso);

  const statusValueForDb =
    newStatus && newStatus.trim() ? validateDeliverableStatus(newStatus) : null;
  const serializedNotes = serializeDeliverableNotes(target.notes, milestones);

  const updatePayload: Record<string, any> = {
    status: statusValueForDb,
    notes: serializedNotes,
    updated_at: nowIso,
  };

  let { data, error } = await adapter.updateAndReturn(deliverableId, updatePayload);
  if (
    error &&
    error.message?.toLowerCase().includes('updated_at') &&
    (error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find'))
  ) {
    const retryPayload = { ...updatePayload };
    delete retryPayload.updated_at;
    const retry = await adapter.updateAndReturn(deliverableId, retryPayload);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(`Could not update deliverable status in Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Could not update deliverable status for "${deliverableId}" in Supabase: 0 rows affected (check permissions or record existence).`
    );
  }

  const mapped = mapRow(data[0]);
  const saved: Deliverable = {
    ...mapped,
    notes: mapped.notes !== undefined ? mapped.notes : target.notes,
    last_updated: data[0]?.updated_at || data[0]?.last_updated || mapped.last_updated || nowIso,
    assigned_at: mapped.assigned_at ?? milestones.assigned_at,
    first_submitted_at: mapped.first_submitted_at ?? milestones.first_submitted_at,
    delivered_at: mapped.delivered_at ?? milestones.delivered_at,
  };

  upsertItemInCache<Deliverable>(storage, 'deliverables', saved);
  return saved;
}
