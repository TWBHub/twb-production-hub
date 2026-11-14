import {
  Deliverable,
  DeliverableBrandScope,
  DeliverableCatalogueCategory,
  DeliverableCatalogueItem,
  Enquiry,
} from '../types';
import {
  GJ_COMPANY_UUID,
  TWB_COMPANY_UUID,
  isGoldenJune,
  isTWB,
} from './companyUtils';
import {
  PHASE1_STORAGE_PREFIX,
  Phase1StorageAdapter,
  getDefaultPhase1Storage,
  readCachedArray,
  removeItemFromCache,
  upsertItemInCache,
  writeCachedArray,
} from './phase1PersistenceUtils';

export const DELIVERABLE_CATALOGUE_STORAGE_KEY = 'deliverable_catalogue';

export const DELIVERABLE_CATALOGUE_CATEGORIES: DeliverableCatalogueCategory[] = [
  'Film',
  'Cinematography',
  'Photography',
  'Album & Print',
  'Specialty',
  'Add-on',
  'Other',
];

export interface DeliverableCatalogueReadAdapter {
  selectAll: () => Promise<{ data: any[] | null; error: any }>;
}

export interface DeliverableCatalogueWriteAdapter {
  insertAndReturn: (
    payload: Record<string, any>
  ) => Promise<{ data: any[] | null; error: any }>;
  updateAndReturn: (
    id: string,
    payload: Record<string, any>
  ) => Promise<{ data: any[] | null; error: any }>;
  deleteAndReturn: (
    id: string
  ) => Promise<{ data: any[] | null; error: any }>;
  existsById: (
    id: string
  ) => Promise<{ exists: boolean; error: any }>;
}

export function normalizeDeliverableCatalogueName(name?: string | null): string {
  return (name || '').trim().toLowerCase();
}

export function normalizeDeliverableCatalogueCategory(
  category?: string | null
): DeliverableCatalogueCategory {
  const trimmed = (category || '').trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'addon' || lower === 'add-on') return 'Add-on';
  if (lower === 'album' || lower === 'album & print') return 'Album & Print';
  const matched = DELIVERABLE_CATALOGUE_CATEGORIES.find(
    c => c.toLowerCase() === lower
  );
  return matched || 'Film';
}

export function resolveCatalogueBrandLabel(brand: DeliverableBrandScope): string {
  if (brand === 'twb') return 'The Wedding Booth';
  if (brand === 'golden_june') return 'Golden June Films';
  return 'All Brands';
}

export function resolveCompanyIdForCatalogueBrand(
  brand: DeliverableBrandScope
): string | null {
  if (brand === 'twb') return TWB_COMPANY_UUID;
  if (brand === 'golden_june') return GJ_COMPANY_UUID;
  return null;
}

export function normalizeCatalogueBrandScope(
  brand?: string | null,
  companyId?: string | null
): DeliverableBrandScope {
  const cleanBrand = (brand || '').trim().toLowerCase();
  if (cleanBrand === 'twb' || isTWB(companyId)) return 'twb';
  if (cleanBrand === 'golden_june' || isGoldenJune(companyId)) return 'golden_june';
  if (cleanBrand === 'all' || !companyId) return 'all';
  return 'all';
}

/**
 * Role helpers aligned with live Supabase RLS policies:
 * - public.current_user_role() IN ('admin', 'manager') for INSERT
 * - public.is_admin() = true for UPDATE & DELETE
 */
export function canAddDeliverableCatalogueEntry(role?: string | null): boolean {
  const norm = (role || '').trim().toLowerCase();
  return norm === 'admin' || norm === 'manager';
}

export function canEditDeliverableCatalogueEntry(role?: string | null): boolean {
  const norm = (role || '').trim().toLowerCase();
  return norm === 'admin';
}

export function mapSupabaseDeliverableCatalogueToModel(
  row: any
): DeliverableCatalogueItem {
  const applicableBrand = normalizeCatalogueBrandScope(
    row.applicable_brand,
    row.company_id
  );
  const resolvedCompanyId = resolveCompanyIdForCatalogueBrand(applicableBrand);

  return {
    id: row.id,
    name: (row.name || '').trim(),
    category: normalizeDeliverableCatalogueCategory(row.category),
    description:
      typeof row.description === 'string' && row.description.trim()
        ? row.description.trim()
        : undefined,
    company_id: resolvedCompanyId,
    applicable_brand: applicableBrand,
    is_active: row.is_active !== false,
    sort_order: Number.isFinite(Number(row.sort_order))
      ? Math.trunc(Number(row.sort_order))
      : 0,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

export function buildDeliverableCataloguePayload(
  input: {
    name: string;
    category?: string;
    description?: string;
    applicable_brand: DeliverableBrandScope;
    is_active?: boolean;
    sort_order?: number;
  },
  nowIso: string = new Date().toISOString(),
  isUpdate: boolean = false
): Record<string, any> {
  const trimmedName = (input.name || '').trim();
  if (!trimmedName) {
    throw new Error('Deliverable name is required.');
  }

  const applicableBrand = normalizeCatalogueBrandScope(input.applicable_brand);
  const companyId = resolveCompanyIdForCatalogueBrand(applicableBrand);
  const category = normalizeDeliverableCatalogueCategory(input.category);
  const sortOrder = Number.isFinite(Number(input.sort_order))
    ? Math.trunc(Number(input.sort_order))
    : 0;

  const payload: Record<string, any> = {
    name: trimmedName,
    category,
    description:
      typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null,
    company_id: companyId,
    applicable_brand: applicableBrand,
    is_active: input.is_active !== false,
    sort_order: sortOrder,
  };

  if (isUpdate) {
    payload.updated_at = nowIso;
  }

  return payload;
}

export function sortDeliverableCatalogue(
  items: DeliverableCatalogueItem[]
): DeliverableCatalogueItem[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Filters active catalogue entries applicable to a project's brand
 * ('all' + projectBrand), sorted by sort_order ASC then name ASC.
 */
export function filterDeliverableCatalogueForBrand(
  items: DeliverableCatalogueItem[],
  projectBrand: 'twb' | 'golden_june'
): DeliverableCatalogueItem[] {
  return sortDeliverableCatalogue(
    items.filter(
      item =>
        item.is_active &&
        (item.applicable_brand === 'all' || item.applicable_brand === projectBrand)
    )
  );
}

/**
 * Filters catalogue entries for the Settings management view.
 * - brandFilter:
 *   - 'all': shows all entries across All Brands, TWB, and Golden June
 *   - 'shared': shows only 'All Brands' shared entries
 *   - 'twb': shows TWB-specific + All Brands entries
 *   - 'golden_june': shows Golden June-specific + All Brands entries
 * - statusFilter: 'all' | 'active' | 'inactive'
 */
export function filterDeliverableCatalogueForSettings(
  items: DeliverableCatalogueItem[],
  filters: {
    brandFilter?: 'all' | 'shared' | 'twb' | 'golden_june';
    statusFilter?: 'all' | 'active' | 'inactive';
  }
): DeliverableCatalogueItem[] {
  const { brandFilter = 'all', statusFilter = 'all' } = filters;
  return sortDeliverableCatalogue(
    items.filter(item => {
      const matchesBrand =
        brandFilter === 'all'
          ? true
          : brandFilter === 'shared'
          ? item.applicable_brand === 'all'
          : item.applicable_brand === 'all' || item.applicable_brand === brandFilter;

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? item.is_active
          : !item.is_active;

      return matchesBrand && matchesStatus;
    })
  );
}

/**
 * Checks effective-brand duplicate rules (mirroring PostgreSQL trigger & unique index):
 * - Case-insensitive and trimmed name comparison.
 * - Checks BOTH active and inactive rows so reactivation cannot create ambiguity.
 * - Blocks duplicates within the same brand scope, AND blocks coexistence between
 *   'all' and either 'twb' or 'golden_june'.
 * - Allows 'twb' and 'golden_june' to share a name when no 'all' row exists.
 */
export function findEffectiveBrandDuplicate(
  items: DeliverableCatalogueItem[],
  name: string,
  applicableBrand: DeliverableBrandScope,
  excludeId?: string
): DeliverableCatalogueItem | undefined {
  const norm = normalizeDeliverableCatalogueName(name);
  if (!norm) return undefined;

  return items.find(item => {
    if (excludeId && item.id === excludeId) return false;
    if (normalizeDeliverableCatalogueName(item.name) !== norm) return false;

    return (
      item.applicable_brand === applicableBrand ||
      applicableBrand === 'all' ||
      item.applicable_brand === 'all'
    );
  });
}

export function buildDuplicateDeliverableCatalogueError(
  name: string,
  targetBrand: DeliverableBrandScope,
  conflict?: DeliverableCatalogueItem
): string {
  const cleanName = name.trim();
  if (conflict) {
    const conflictScope = resolveCatalogueBrandLabel(conflict.applicable_brand);
    const statusLabel = conflict.is_active ? 'active' : 'deactivated (inactive)';
    if (conflict.applicable_brand === targetBrand) {
      return `A ${statusLabel} deliverable named "${conflict.name}" already exists for ${conflictScope}. ${
        conflict.is_active
          ? 'Please use or edit the existing entry instead.'
          : 'Reactivate or rename the existing entry in Settings instead of creating a duplicate.'
      }`;
    }
    return `Deliverable "${cleanName}" conflicts with an existing ${statusLabel} entry "${conflict.name}" scoped to ${conflictScope}. Shared (All Brands) and brand-specific entries cannot share the same name.`;
  }

  return `Deliverable "${cleanName}" already exists in the effective ${resolveCatalogueBrandLabel(
    targetBrand
  )} catalogue (including inactive entries).`;
}

export function formatDeliverableCatalogueDbError(
  error: any,
  action: 'create' | 'update' | 'delete' | 'reorder',
  itemName?: string,
  targetBrand: DeliverableBrandScope = 'all',
  existingItems: DeliverableCatalogueItem[] = []
): string {
  const msg = String(error?.message || error || 'Unknown database error');
  const code = String(error?.code || '');
  const lower = msg.toLowerCase();

  if (
    code === '23505' ||
    lower.includes('duplicate') ||
    lower.includes('unique constraint') ||
    lower.includes('idx_deliverable_catalogue_unique_name_brand')
  ) {
    const conflict = itemName
      ? findEffectiveBrandDuplicate(existingItems, itemName, targetBrand)
      : undefined;
    return buildDuplicateDeliverableCatalogueError(
      itemName || 'Deliverable',
      targetBrand,
      conflict
    );
  }

  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    if (action === 'create') {
      return 'Permission denied by database security policy. Only Admins and Managers can add entries to the Shared Deliverables Catalogue.';
    }
    return `Permission denied by database security policy. Only Admins can ${action} entries in the Shared Deliverables Catalogue.`;
  }

  return `Could not ${action} deliverable catalogue entry in Supabase: ${msg}`;
}

export function getReferencingDeliverablesForCatalogueItem(
  deliverables: Deliverable[],
  itemName?: string | null
): Deliverable[] {
  const norm = normalizeDeliverableCatalogueName(itemName);
  if (!norm) return [];
  return deliverables.filter(
    d => normalizeDeliverableCatalogueName(d.deliverable_type) === norm
  );
}

export function getReferencingLeadsForCatalogueItem(
  enquiries: Enquiry[],
  itemName?: string | null
): Enquiry[] {
  const norm = normalizeDeliverableCatalogueName(itemName);
  if (!norm) return [];
  return enquiries.filter(
    e =>
      Array.isArray(e.services) &&
      e.services.some(s => normalizeDeliverableCatalogueName(s) === norm)
  );
}

export interface CatalogueItemReferencesResult {
  deliverables: Deliverable[];
  leads: Enquiry[];
  totalCount: number;
  isInUse: boolean;
}

export function getCatalogueItemReferences(params: {
  deliverables: Deliverable[];
  enquiries: Enquiry[];
  itemName?: string | null;
}): CatalogueItemReferencesResult {
  const deliverables = getReferencingDeliverablesForCatalogueItem(
    params.deliverables,
    params.itemName
  );
  const leads = getReferencingLeadsForCatalogueItem(
    params.enquiries,
    params.itemName
  );
  const totalCount = deliverables.length + leads.length;
  return {
    deliverables,
    leads,
    totalCount,
    isInUse: totalCount > 0,
  };
}

export function getNextDeliverableSortOrder(
  items: DeliverableCatalogueItem[]
): number {
  if (!items || items.length === 0) return 10;
  const maxOrder = items.reduce(
    (max, item) => Math.max(max, Number(item.sort_order) || 0),
    0
  );
  return maxOrder + 10;
}

/**
 * Authoritative Read — throws on Supabase errors when configured;
 * returns [] for a genuinely empty table; uses localStorage only as cache
 * (or offline fallback when Supabase is unconfigured).
 */
export async function fetchDeliverableCatalogueWithSupabase(params: {
  adapter: DeliverableCatalogueReadAdapter | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: DeliverableCatalogueItem[];
}): Promise<DeliverableCatalogueItem[]> {
  const {
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
  } = params;

  if (!adapter) {
    const cached = readCachedArray<DeliverableCatalogueItem>(
      storage,
      DELIVERABLE_CATALOGUE_STORAGE_KEY
    );
    if (cached !== null) {
      return sortDeliverableCatalogue(
        cached.map(mapSupabaseDeliverableCatalogueToModel)
      );
    }
    const seeded = sortDeliverableCatalogue(initialFallback);
    writeCachedArray(storage, DELIVERABLE_CATALOGUE_STORAGE_KEY, seeded);
    return seeded;
  }

  const { data, error } = await adapter.selectAll();
  if (error) {
    throw new Error(
      `Failed to load Shared Deliverables Catalogue from Supabase: ${error.message}`
    );
  }

  const mapped = sortDeliverableCatalogue(
    (data || []).map(mapSupabaseDeliverableCatalogueToModel)
  );
  writeCachedArray(storage, DELIVERABLE_CATALOGUE_STORAGE_KEY, mapped);
  return mapped;
}

/**
 * Authoritative Create — enforces duplicate rules, relies on Supabase UUID & constraints,
 * verifies returned row, updates cache only after DB confirmation.
 */
export async function createDeliverableCatalogueWithSupabase(params: {
  item: {
    name: string;
    category?: DeliverableCatalogueCategory | string;
    description?: string;
    applicable_brand: DeliverableBrandScope;
    is_active?: boolean;
    sort_order?: number;
  };
  existingItems: DeliverableCatalogueItem[];
  adapter: Pick<DeliverableCatalogueWriteAdapter, 'insertAndReturn'> | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: DeliverableCatalogueItem[];
  nowIso?: string;
  generateId?: () => string;
}): Promise<DeliverableCatalogueItem> {
  const {
    item,
    existingItems,
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
    generateId = () => crypto.randomUUID(),
  } = params;

  const trimmedName = (item.name || '').trim();
  if (!trimmedName) {
    throw new Error('Deliverable name is required.');
  }

  const targetBrand = normalizeCatalogueBrandScope(item.applicable_brand);
  const duplicate = findEffectiveBrandDuplicate(
    existingItems,
    trimmedName,
    targetBrand
  );
  if (duplicate) {
    throw new Error(
      buildDuplicateDeliverableCatalogueError(trimmedName, targetBrand, duplicate)
    );
  }

  const payload = buildDeliverableCataloguePayload(
    {
      ...item,
      name: trimmedName,
      applicable_brand: targetBrand,
      sort_order:
        item.sort_order !== undefined
          ? item.sort_order
          : getNextDeliverableSortOrder(existingItems),
    },
    nowIso,
    false
  );

  if (!adapter) {
    const cached =
      readCachedArray<DeliverableCatalogueItem>(
        storage,
        DELIVERABLE_CATALOGUE_STORAGE_KEY
      ) || initialFallback;
    const localDup = findEffectiveBrandDuplicate(cached, trimmedName, targetBrand);
    if (localDup) {
      throw new Error(
        buildDuplicateDeliverableCatalogueError(trimmedName, targetBrand, localDup)
      );
    }

    const created: DeliverableCatalogueItem = {
      id: generateId(),
      name: payload.name,
      category: payload.category,
      description: payload.description || undefined,
      company_id: payload.company_id,
      applicable_brand: payload.applicable_brand,
      is_active: payload.is_active,
      sort_order: payload.sort_order,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const next = sortDeliverableCatalogue([...cached, created]);
    writeCachedArray(storage, DELIVERABLE_CATALOGUE_STORAGE_KEY, next);
    return created;
  }

  const { data, error } = await adapter.insertAndReturn(payload);
  if (error) {
    throw new Error(
      formatDeliverableCatalogueDbError(
        error,
        'create',
        trimmedName,
        targetBrand,
        existingItems
      )
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Supabase did not return the created deliverable catalogue entry.'
    );
  }

  const created = mapSupabaseDeliverableCatalogueToModel(data[0]);
  upsertItemInCache<DeliverableCatalogueItem>(
    storage,
    DELIVERABLE_CATALOGUE_STORAGE_KEY,
    created
  );
  return created;
}

/**
 * Authoritative Update — verifies returned row (catching Admin-only RLS blocks or missing rows)
 * and keeps existing deliverable records untouched.
 */
export async function updateDeliverableCatalogueWithSupabase(params: {
  item: DeliverableCatalogueItem;
  existingItems: DeliverableCatalogueItem[];
  adapter: Pick<DeliverableCatalogueWriteAdapter, 'updateAndReturn'> | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: DeliverableCatalogueItem[];
  nowIso?: string;
}): Promise<DeliverableCatalogueItem> {
  const {
    item,
    existingItems,
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
  } = params;

  const trimmedName = (item.name || '').trim();
  if (!trimmedName) {
    throw new Error('Deliverable name is required.');
  }

  const targetBrand = normalizeCatalogueBrandScope(
    item.applicable_brand,
    item.company_id
  );
  const duplicate = findEffectiveBrandDuplicate(
    existingItems,
    trimmedName,
    targetBrand,
    item.id
  );
  if (duplicate) {
    throw new Error(
      buildDuplicateDeliverableCatalogueError(trimmedName, targetBrand, duplicate)
    );
  }

  const payload = buildDeliverableCataloguePayload(
    {
      ...item,
      name: trimmedName,
      applicable_brand: targetBrand,
    },
    nowIso,
    true
  );

  if (!adapter) {
    const cached =
      readCachedArray<DeliverableCatalogueItem>(
        storage,
        DELIVERABLE_CATALOGUE_STORAGE_KEY
      ) || initialFallback;
    const updatedLocal: DeliverableCatalogueItem = {
      ...item,
      name: payload.name,
      category: payload.category,
      description: payload.description || undefined,
      company_id: payload.company_id,
      applicable_brand: payload.applicable_brand,
      is_active: payload.is_active,
      sort_order: payload.sort_order,
      updated_at: nowIso,
    };
    const next = sortDeliverableCatalogue(
      cached.map(existing =>
        existing.id === updatedLocal.id ? updatedLocal : existing
      )
    );
    writeCachedArray(storage, DELIVERABLE_CATALOGUE_STORAGE_KEY, next);
    return updatedLocal;
  }

  const { data, error } = await adapter.updateAndReturn(item.id, payload);
  if (error) {
    throw new Error(
      formatDeliverableCatalogueDbError(
        error,
        'update',
        trimmedName,
        targetBrand,
        existingItems
      )
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Could not update catalogue entry "${trimmedName}" in Supabase (0 rows affected — Admin permissions are required).`
    );
  }

  const updated = mapSupabaseDeliverableCatalogueToModel(data[0]);
  upsertItemInCache<DeliverableCatalogueItem>(
    storage,
    DELIVERABLE_CATALOGUE_STORAGE_KEY,
    updated
  );
  return updated;
}

/**
 * Authoritative Delete — blocks deletion if any deliverable OR any lead uses this entry's name,
 * checks DB errors and verifies 1 row was deleted (detecting Admin-only RLS blocks).
 */
export async function deleteDeliverableCatalogueWithSupabase(params: {
  id: string;
  itemName: string;
  existingDeliverables: Deliverable[];
  existingEnquiries?: Enquiry[];
  adapter: Pick<DeliverableCatalogueWriteAdapter, 'deleteAndReturn' | 'existsById'> | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: DeliverableCatalogueItem[];
}): Promise<void> {
  const {
    id,
    itemName,
    existingDeliverables,
    existingEnquiries = [],
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
  } = params;

  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new Error('Cannot delete catalogue entry: missing ID.');
  }

  const refs = getCatalogueItemReferences({
    deliverables: existingDeliverables,
    enquiries: existingEnquiries,
    itemName,
  });
  if (refs.isInUse) {
    const parts: string[] = [];
    if (refs.deliverables.length > 0) {
      parts.push(
        `${refs.deliverables.length} existing deliverable${refs.deliverables.length > 1 ? 's' : ''}`
      );
    }
    if (refs.leads.length > 0) {
      parts.push(
        `${refs.leads.length} existing lead${refs.leads.length > 1 ? 's' : ''}`
      );
    }
    throw new Error(
      `Cannot permanently delete "${itemName}" because it is referenced by ${parts.join(' and ')}. Deactivate it instead so existing Leads, Quotations, and Deliverables remain intact.`
    );
  }

  if (!adapter) {
    const cached =
      readCachedArray<DeliverableCatalogueItem>(
        storage,
        DELIVERABLE_CATALOGUE_STORAGE_KEY
      ) || initialFallback;
    writeCachedArray(
      storage,
      DELIVERABLE_CATALOGUE_STORAGE_KEY,
      cached.filter(c => c.id !== cleanId)
    );
    return;
  }

  const { data, error } = await adapter.deleteAndReturn(cleanId);
  if (error) {
    throw new Error(
      formatDeliverableCatalogueDbError(error, 'delete', itemName)
    );
  }

  if (!data || data.length === 0) {
    const existsCheck = await adapter.existsById(cleanId);
    if (existsCheck.error) {
      throw new Error(
        `Could not verify deletion of "${itemName}" in Supabase: ${existsCheck.error.message}`
      );
    }
    if (existsCheck.exists) {
      throw new Error(
        `Permission denied or RLS blocked deleting "${itemName}". Only Admins can permanently delete Shared Deliverables Catalogue entries.`
      );
    }
    throw new Error(
      `Catalogue entry "${itemName}" was not found in Supabase (0 rows affected).`
    );
  }

  removeItemFromCache<DeliverableCatalogueItem>(
    storage,
    DELIVERABLE_CATALOGUE_STORAGE_KEY,
    cleanId
  );
}

/**
 * Helper to check if localStorage cache key exists without throwing in SSR/Node tests.
 */
export function hasDeliverableCatalogueCache(
  storage: Phase1StorageAdapter | null | undefined = getDefaultPhase1Storage()
): boolean {
  if (!storage) return false;
  return Boolean(
    storage.getItem(PHASE1_STORAGE_PREFIX + DELIVERABLE_CATALOGUE_STORAGE_KEY)
  );
}

/**
 * Computes swapped sort_order values for adjacent items when reordering in Settings.
 * Handles identical sort_order values deterministically so order always flips.
 */
export function computeSwappedDeliverableSortOrders(
  orderedItems: DeliverableCatalogueItem[],
  itemId: string,
  direction: 'up' | 'down'
): [DeliverableCatalogueItem, DeliverableCatalogueItem] | null {
  const index = orderedItems.findIndex(i => i.id === itemId);
  if (index === -1) return null;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedItems.length) return null;

  const current = orderedItems[index];
  const neighbor = orderedItems[targetIndex];

  let nextCurrentOrder = neighbor.sort_order ?? 0;
  let nextNeighborOrder = current.sort_order ?? 0;

  if (nextCurrentOrder === nextNeighborOrder) {
    // Re-space cleanly based on desired new positions
    const base = Math.max(0, Math.min(index, targetIndex) * 10);
    if (direction === 'up') {
      nextCurrentOrder = base;
      nextNeighborOrder = base + 10;
    } else {
      nextNeighborOrder = base;
      nextCurrentOrder = base + 10;
    }
  }

  return [
    { ...current, sort_order: nextCurrentOrder },
    { ...neighbor, sort_order: nextNeighborOrder },
  ];
}

/**
 * Persists swapped sort_order values for two catalogue entries sequentially,
 * enforcing Admin-only RLS checks and returning the updated pair.
 */
export async function reorderDeliverableCatalogueWithSupabase(params: {
  updatedPair: [DeliverableCatalogueItem, DeliverableCatalogueItem];
  existingItems: DeliverableCatalogueItem[];
  adapter: Pick<DeliverableCatalogueWriteAdapter, 'updateAndReturn'> | null;
  storage?: Phase1StorageAdapter | null;
  initialFallback?: DeliverableCatalogueItem[];
  nowIso?: string;
}): Promise<DeliverableCatalogueItem[]> {
  const {
    updatedPair,
    existingItems,
    adapter,
    storage = getDefaultPhase1Storage(),
    initialFallback = [],
    nowIso = new Date().toISOString(),
  } = params;

  const results: DeliverableCatalogueItem[] = [];
  for (const itemToUpdate of updatedPair) {
    const saved = await updateDeliverableCatalogueWithSupabase({
      item: itemToUpdate,
      existingItems,
      adapter,
      storage,
      initialFallback,
      nowIso,
    });
    results.push(saved);
  }
  return results;
}

export interface DeliverableTypeOptionsResult {
  brandItems: DeliverableCatalogueItem[];
  historicalValue?: string;
  isHistoricalPreserved: boolean;
  historicalSuffix?: string;
  shouldDefaultToCustom: boolean;
}

/**
 * Computes active brand-filtered options for Deliverable Type selectors
 * in both Create and Edit modals, preserving historical/custom/inactive names on Edit
 * and signaling custom fallback when catalogue failed to load or has no active entries.
 */
export function getDeliverableTypeOptions(params: {
  items: DeliverableCatalogueItem[];
  projectBrand: 'twb' | 'golden_june';
  historicalValue?: string;
  catalogueError?: string | null;
}): DeliverableTypeOptionsResult {
  const { items, projectBrand, historicalValue, catalogueError } = params;
  const brandItems = filterDeliverableCatalogueForBrand(items, projectBrand);

  const trimmedHistorical = (historicalValue || '').trim();
  const normHistorical = normalizeDeliverableCatalogueName(trimmedHistorical);

  let isHistoricalPreserved = false;
  let historicalSuffix: string | undefined;

  if (normHistorical) {
    const inActiveBrandList = brandItems.some(
      item => normalizeDeliverableCatalogueName(item.name) === normHistorical
    );
    if (!inActiveBrandList) {
      isHistoricalPreserved = true;
      const matchedAny = items.find(
        item => normalizeDeliverableCatalogueName(item.name) === normHistorical
      );
      if (matchedAny && !matchedAny.is_active) {
        historicalSuffix = 'Inactive in catalogue';
      } else if (matchedAny) {
        historicalSuffix = `Scoped to ${resolveCatalogueBrandLabel(matchedAny.applicable_brand)}`;
      } else {
        historicalSuffix = 'Custom / Historical';
      }
    }
  }

  return {
    brandItems,
    historicalValue: trimmedHistorical || undefined,
    isHistoricalPreserved,
    historicalSuffix,
    shouldDefaultToCustom: Boolean(catalogueError) || brandItems.length === 0,
  };
}

export interface HistoricalLeadServiceTag {
  name: string;
  status: 'inactive' | 'other_brand' | 'custom';
  detailLabel: string;
}

export interface LeadServiceOptionsResult {
  brandItems: DeliverableCatalogueItem[];
  historicalSelected: HistoricalLeadServiceTag[];
}

/**
 * Computes active brand-filtered catalogue options for Lead service selection
 * while preserving historical selections (including deactivated, other-brand, or custom names).
 */
export function getLeadServiceOptions(params: {
  items: DeliverableCatalogueItem[];
  projectBrand: 'twb' | 'golden_june';
  selectedServices: string[];
}): LeadServiceOptionsResult {
  const { items, projectBrand, selectedServices } = params;
  const brandItems = filterDeliverableCatalogueForBrand(items, projectBrand);

  const historicalSelected: HistoricalLeadServiceTag[] = [];
  for (const srvName of selectedServices) {
    const norm = normalizeDeliverableCatalogueName(srvName);
    if (!norm) continue;
    const inActiveBrandList = brandItems.some(
      item => normalizeDeliverableCatalogueName(item.name) === norm
    );
    if (inActiveBrandList) continue;

    const matchedAny = items.find(
      item => normalizeDeliverableCatalogueName(item.name) === norm
    );
    if (matchedAny && !matchedAny.is_active) {
      historicalSelected.push({
        name: srvName,
        status: 'inactive',
        detailLabel: 'inactive',
      });
    } else if (matchedAny) {
      historicalSelected.push({
        name: srvName,
        status: 'other_brand',
        detailLabel: resolveCatalogueBrandLabel(matchedAny.applicable_brand),
      });
    } else {
      historicalSelected.push({
        name: srvName,
        status: 'custom',
        detailLabel: 'custom',
      });
    }
  }

  return {
    brandItems,
    historicalSelected,
  };
}

export interface QuotationCataloguePreset {
  id: string;
  name: string;
  category: DeliverableCatalogueCategory;
  description?: string;
  scopeText: string;
}

export function formatCataloguePresetScopeText(
  item: Pick<DeliverableCatalogueItem, 'name' | 'description'>
): string {
  const name = (item.name || '').trim();
  const desc = (item.description || '').trim();
  return desc ? `${name} — ${desc}` : name;
}

/**
 * Computes active brand-filtered quick-add scope presets for QuotationBuilderModal
 * from the unified catalogue, using both names and descriptions.
 */
export function getQuotationCataloguePresets(
  items: DeliverableCatalogueItem[],
  companyBrand: 'twb' | 'golden_june'
): QuotationCataloguePreset[] {
  return filterDeliverableCatalogueForBrand(items, companyBrand).map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    scopeText: formatCataloguePresetScopeText(item),
  }));
}
