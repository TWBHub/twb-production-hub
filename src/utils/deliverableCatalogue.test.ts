import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  DELIVERABLE_CATALOGUE_CATEGORIES,
  DELIVERABLE_CATALOGUE_STORAGE_KEY,
  buildDeliverableCataloguePayload,
  canAddDeliverableCatalogueEntry,
  canEditDeliverableCatalogueEntry,
  computeSwappedDeliverableSortOrders,
  createDeliverableCatalogueWithSupabase,
  deleteDeliverableCatalogueWithSupabase,
  fetchDeliverableCatalogueWithSupabase,
  filterDeliverableCatalogueForBrand,
  filterDeliverableCatalogueForSettings,
  findEffectiveBrandDuplicate,
  formatDeliverableCatalogueDbError,
  getCatalogueItemReferences,
  getDeliverableTypeOptions,
  getLeadServiceOptions,
  getNextDeliverableSortOrder,
  getQuotationCataloguePresets,
  getReferencingDeliverablesForCatalogueItem,
  mapSupabaseDeliverableCatalogueToModel,
  normalizeDeliverableCatalogueCategory,
  reorderDeliverableCatalogueWithSupabase,
  updateDeliverableCatalogueWithSupabase,
} from './deliverableCatalogueUtils';
import {
  PHASE1_STORAGE_PREFIX,
  Phase1StorageAdapter,
} from './phase1PersistenceUtils';
import { INITIAL_DELIVERABLE_CATALOGUE } from '../services/seedData';
import { TWB_COMPANY_UUID, GJ_COMPANY_UUID } from './companyUtils';
import { Deliverable, DeliverableCatalogueItem, Enquiry } from '../types';
import { canAccessTab, checkRouteAccess, hasRole } from '../lib/auth';

const createMemoryStorage = (
  initialEntries: Record<string, string> = {}
): Phase1StorageAdapter => {
  const store = new Map<string, string>(Object.entries(initialEntries));
  return {
    getItem: key => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
};

describe('Shared Deliverables Catalogue', () => {
  const sampleItems: DeliverableCatalogueItem[] = [
    {
      id: 'dc-1',
      name: 'Highlight Film (4-5 mins)',
      category: 'Film',
      description: 'Core highlight reel',
      company_id: null,
      applicable_brand: 'all',
      is_active: true,
      sort_order: 10,
    },
    {
      id: 'dc-2',
      name: 'Teaser / Reel (60s)',
      category: 'Film',
      company_id: TWB_COMPANY_UUID,
      applicable_brand: 'twb',
      is_active: true,
      sort_order: 20,
    },
    {
      id: 'dc-3',
      name: 'Super 8 Vintage Reel',
      category: 'Specialty',
      company_id: GJ_COMPANY_UUID,
      applicable_brand: 'golden_june',
      is_active: true,
      sort_order: 30,
    },
    {
      id: 'dc-4',
      name: 'Legacy DVD Box Set',
      category: 'Album & Print',
      company_id: null,
      applicable_brand: 'all',
      is_active: false,
      sort_order: 40,
    },
  ];

  it('1. Reads catalogue entries from Supabase, sorts them, and resolves company UUIDs', async () => {
    const storage = createMemoryStorage();
    const rawRows = [
      {
        id: 'dc-2',
        name: 'Teaser / Reel (60s)',
        category: 'Film',
        company_id: TWB_COMPANY_UUID,
        applicable_brand: 'twb',
        is_active: true,
        sort_order: 20,
      },
      {
        id: 'dc-1',
        name: 'Highlight Film (4-5 mins)',
        category: 'Film',
        company_id: null,
        applicable_brand: 'all',
        is_active: true,
        sort_order: 10,
      },
      {
        id: 'dc-3',
        name: 'Super 8 Vintage Reel',
        category: 'Specialty',
        company_id: GJ_COMPANY_UUID,
        applicable_brand: 'golden_june',
        is_active: false,
        sort_order: 30,
      },
    ];

    const result = await fetchDeliverableCatalogueWithSupabase({
      adapter: { selectAll: async () => ({ data: rawRows, error: null }) },
      storage,
      initialFallback: INITIAL_DELIVERABLE_CATALOGUE,
    });

    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(
      result.map(r => r.name),
      ['Highlight Film (4-5 mins)', 'Teaser / Reel (60s)', 'Super 8 Vintage Reel']
    );
    assert.strictEqual(result[0].company_id, null);
    assert.strictEqual(result[1].company_id, TWB_COMPANY_UUID);
    assert.strictEqual(result[2].company_id, GJ_COMPANY_UUID);
    assert.strictEqual(result[2].is_active, false);

    // Cache populated only after authoritative Supabase read
    const cached = storage.getItem(
      PHASE1_STORAGE_PREFIX + DELIVERABLE_CATALOGUE_STORAGE_KEY
    );
    assert.ok(cached);
  });

  it('2. Throws cleanly on Supabase failure instead of silently falling back to stale localStorage', async () => {
    const staleCache = JSON.stringify([sampleItems[0]]);
    const storage = createMemoryStorage({
      [PHASE1_STORAGE_PREFIX + DELIVERABLE_CATALOGUE_STORAGE_KEY]: staleCache,
    });

    await assert.rejects(
      () =>
        fetchDeliverableCatalogueWithSupabase({
          adapter: {
            selectAll: async () => ({
              data: null,
              error: { message: 'relation "public.deliverable_catalogue" permission denied' },
            }),
          },
          storage,
          initialFallback: INITIAL_DELIVERABLE_CATALOGUE,
        }),
      /Failed to load Shared Deliverables Catalogue from Supabase/
    );
  });

  it('3. Returns genuinely empty [] from Supabase without reverting to seed data', async () => {
    const storage = createMemoryStorage();
    const result = await fetchDeliverableCatalogueWithSupabase({
      adapter: { selectAll: async () => ({ data: [], error: null }) },
      storage,
      initialFallback: INITIAL_DELIVERABLE_CATALOGUE,
    });
    assert.deepStrictEqual(result, []);
  });

  it('4. Brand filtering returns active entries for (all + project brand) sorted by sort_order', () => {
    const twbList = filterDeliverableCatalogueForBrand(sampleItems, 'twb');
    assert.deepStrictEqual(
      twbList.map(i => i.name),
      ['Highlight Film (4-5 mins)', 'Teaser / Reel (60s)']
    );

    const gjList = filterDeliverableCatalogueForBrand(sampleItems, 'golden_june');
    assert.deepStrictEqual(
      gjList.map(i => i.name),
      ['Highlight Film (4-5 mins)', 'Super 8 Vintage Reel']
    );
  });

  it('5. Settings filtering supports brandFilter (all, shared, twb, golden_june) and statusFilter (all, active, inactive)', () => {
    assert.strictEqual(
      filterDeliverableCatalogueForSettings(sampleItems, {
        brandFilter: 'all',
        statusFilter: 'all',
      }).length,
      4
    );
    assert.deepStrictEqual(
      filterDeliverableCatalogueForSettings(sampleItems, {
        brandFilter: 'shared',
        statusFilter: 'inactive',
      }).map(i => i.name),
      ['Legacy DVD Box Set']
    );
    assert.deepStrictEqual(
      filterDeliverableCatalogueForSettings(sampleItems, {
        brandFilter: 'golden_june',
        statusFilter: 'active',
      }).map(i => i.name),
      ['Highlight Film (4-5 mins)', 'Super 8 Vintage Reel']
    );
  });

  it('6. Adding custom entry persists to Supabase with proper brand UUID / NULL and appends sort_order', async () => {
    const storage = createMemoryStorage();
    let capturedPayload: Record<string, any> | null = null;

    const created = await createDeliverableCatalogueWithSupabase({
      item: {
        name: '  Sangeet Dance Cut  ',
        category: 'Film',
        description: 'Multi-cam edit',
        applicable_brand: 'golden_june',
      },
      existingItems: sampleItems,
      adapter: {
        insertAndReturn: async payload => {
          capturedPayload = payload;
          return {
            data: [
              {
                id: 'uuid-created-1',
                ...payload,
                created_at: '2026-11-14T15:00:00Z',
                updated_at: '2026-11-14T15:00:00Z',
              },
            ],
            error: null,
          };
        },
      },
      storage,
    });

    assert.ok(capturedPayload);
    assert.strictEqual(capturedPayload.name, 'Sangeet Dance Cut');
    assert.strictEqual(capturedPayload.company_id, GJ_COMPANY_UUID);
    assert.strictEqual(capturedPayload.applicable_brand, 'golden_june');
    assert.strictEqual(capturedPayload.sort_order, 50);
    assert.strictEqual(capturedPayload.created_at, undefined);
    assert.strictEqual(created.id, 'uuid-created-1');
    assert.strictEqual(created.company_id, GJ_COMPANY_UUID);
  });

  it('7. Duplicate checks block case/whitespace duplicates, shared-vs-brand overlap, and inactive collisions; allows separate TWB and GJ entries', async () => {
    // Case + trim duplicate in same brand
    const sameBrandDup = findEffectiveBrandDuplicate(
      sampleItems,
      '  highlight film (4-5 mins)  ',
      'all'
    );
    assert.strictEqual(sameBrandDup?.id, 'dc-1');

    // Overlap: 'all' entry conflicts with 'twb'
    const sharedVsBrandDup = findEffectiveBrandDuplicate(
      sampleItems,
      'Highlight Film (4-5 mins)',
      'twb'
    );
    assert.strictEqual(sharedVsBrandDup?.id, 'dc-1');

    // Overlap: brand-specific entry conflicts with adding 'all'
    const brandVsSharedDup = findEffectiveBrandDuplicate(
      sampleItems,
      'Teaser / Reel (60s)',
      'all'
    );
    assert.strictEqual(brandVsSharedDup?.id, 'dc-2');

    // Inactive entry conflict
    const inactiveDup = findEffectiveBrandDuplicate(
      sampleItems,
      'legacy dvd box set',
      'golden_june'
    );
    assert.strictEqual(inactiveDup?.id, 'dc-4');

    // Allowed: TWB and Golden June CAN share the same name when no 'all' row exists
    const allowedCrossBrand = findEffectiveBrandDuplicate(
      sampleItems,
      'Teaser / Reel (60s)',
      'golden_june'
    );
    assert.strictEqual(allowedCrossBrand, undefined);

    // Enforcement during create throws descriptive error before calling adapter
    await assert.rejects(
      () =>
        createDeliverableCatalogueWithSupabase({
          item: { name: 'legacy dvd box set', applicable_brand: 'twb' },
          existingItems: sampleItems,
          adapter: {
            insertAndReturn: async () => {
              throw new Error('Should not have reached adapter');
            },
          },
          storage: createMemoryStorage(),
        }),
      /deactivated \(inactive\).*Legacy DVD Box Set/
    );

    // Formatting DB unique violation 23505
    const formatted23505 = formatDeliverableCatalogueDbError(
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_deliverable_catalogue_unique_name_brand"',
      },
      'create',
      'Highlight Film (4-5 mins)',
      'twb',
      sampleItems
    );
    assert.match(formatted23505, /conflicts with an existing active entry/i);
  });

  it('8. Editing & deactivating updates Supabase with updated_at and surfaces RLS 0-row denials clearly', async () => {
    const storage = createMemoryStorage();
    let updatePayload: Record<string, any> | null = null;

    const updated = await updateDeliverableCatalogueWithSupabase({
      item: {
        ...sampleItems[1],
        name: 'Teaser / Vertical Reel (60s)',
        is_active: false,
      },
      existingItems: sampleItems,
      adapter: {
        updateAndReturn: async (_id, payload) => {
          updatePayload = payload;
          return {
            data: [{ id: 'dc-2', ...payload }],
            error: null,
          };
        },
      },
      storage,
      nowIso: '2026-11-14T16:00:00.000Z',
    });

    assert.ok(updatePayload?.updated_at);
    assert.strictEqual(updated.name, 'Teaser / Vertical Reel (60s)');
    assert.strictEqual(updated.is_active, false);

    // If Manager tries to update and Supabase RLS returns 0 rows
    await assert.rejects(
      () =>
        updateDeliverableCatalogueWithSupabase({
          item: { ...sampleItems[1], is_active: false },
          existingItems: sampleItems,
          adapter: {
            updateAndReturn: async () => ({ data: [], error: null }),
          },
          storage,
        }),
      /Admin permissions are required/
    );
  });

  it('9. Reordering swaps sort_order deterministically (including equal sort_order ties) and persists via Supabase', async () => {
    const tiedList: DeliverableCatalogueItem[] = [
      { ...sampleItems[0], sort_order: 10 },
      { ...sampleItems[1], sort_order: 10 },
    ];
    const pair = computeSwappedDeliverableSortOrders(tiedList, 'dc-2', 'up');
    assert.ok(pair);
    assert.ok(pair[0].sort_order < pair[1].sort_order);

    const updatedIds: string[] = [];
    const saved = await reorderDeliverableCatalogueWithSupabase({
      updatedPair: pair,
      existingItems: tiedList,
      adapter: {
        updateAndReturn: async (id, payload) => {
          updatedIds.push(id);
          return { data: [{ id, ...payload }], error: null };
        },
      },
      storage: createMemoryStorage(),
    });

    assert.deepStrictEqual(updatedIds, ['dc-2', 'dc-1']);
    assert.strictEqual(saved.length, 2);
  });

  it('10. Delete safeguard blocks permanent deletion when deliverables use the name, and allows unused deletion when Admin', async () => {
    const deliverables: Deliverable[] = [
      {
        id: 'del-1',
        project_id: 'prj-1',
        company_id: 'twb',
        deliverable_type: '  teaser / reel (60s) ',
        assigned_editor_id: '',
        due_date: '2026-12-01',
        status: 'Not Started',
        priority: 'Medium',
        last_updated: '2026-11-14T10:00:00Z',
      },
    ];

    assert.strictEqual(
      getReferencingDeliverablesForCatalogueItem(deliverables, 'Teaser / Reel (60s)').length,
      1
    );

    // In-use entry rejected cleanly without hitting delete adapter
    await assert.rejects(
      () =>
        deleteDeliverableCatalogueWithSupabase({
          id: 'dc-2',
          itemName: 'Teaser / Reel (60s)',
          existingDeliverables: deliverables,
          adapter: {
            deleteAndReturn: async () => {
              throw new Error('Should not delete in-use item');
            },
            existsById: async () => ({ exists: true, error: null }),
          },
          storage: createMemoryStorage(),
        }),
      /Cannot permanently delete "Teaser \/ Reel \(60s\)".*Deactivate it instead/
    );

    // RLS 0-row delete detected via existsById check
    await assert.rejects(
      () =>
        deleteDeliverableCatalogueWithSupabase({
          id: 'dc-3',
          itemName: 'Super 8 Vintage Reel',
          existingDeliverables: deliverables,
          adapter: {
            deleteAndReturn: async () => ({ data: [], error: null }),
            existsById: async () => ({ exists: true, error: null }),
          },
          storage: createMemoryStorage(),
        }),
      /Only Admins can permanently delete/
    );

    // Unused item deletes cleanly for Admin
    await deleteDeliverableCatalogueWithSupabase({
      id: 'dc-3',
      itemName: 'Super 8 Vintage Reel',
      existingDeliverables: deliverables,
      adapter: {
        deleteAndReturn: async id => ({ data: [{ id }], error: null }),
        existsById: async () => ({ exists: false, error: null }),
      },
      storage: createMemoryStorage(),
    });
  });

  it('11. Historical deliverable names and inactive/other-brand entries remain preserved in Edit options, and empty/failure states default to custom entry', () => {
    // Inactive catalogue entry on existing deliverable -> Edit preserves it!
    const inactiveHistoricalOpts = getDeliverableTypeOptions({
      items: sampleItems,
      projectBrand: 'twb',
      historicalValue: 'Legacy DVD Box Set',
    });
    assert.strictEqual(inactiveHistoricalOpts.isHistoricalPreserved, true);
    assert.strictEqual(inactiveHistoricalOpts.historicalSuffix, 'Inactive in catalogue');
    assert.strictEqual(inactiveHistoricalOpts.shouldDefaultToCustom, false);

    // Custom project-only deliverable -> Edit preserves it!
    const customHistoricalOpts = getDeliverableTypeOptions({
      items: sampleItems,
      projectBrand: 'twb',
      historicalValue: 'One-Off Engagement Film',
    });
    assert.strictEqual(customHistoricalOpts.isHistoricalPreserved, true);
    assert.strictEqual(customHistoricalOpts.historicalSuffix, 'Custom / Historical');

    // Empty catalogue or fetch failure -> Create gracefully defaults to custom mode
    const failedOpts = getDeliverableTypeOptions({
      items: [],
      projectBrand: 'golden_june',
      catalogueError: 'Supabase connection timeout',
    });
    assert.strictEqual(failedOpts.brandItems.length, 0);
    assert.strictEqual(failedOpts.shouldDefaultToCustom, true);
  });

  it('12. Role checks support lowercase Supabase DB roles (admin, manager, editor) as well as Title Case', () => {
    assert.strictEqual(canAddDeliverableCatalogueEntry('admin'), true);
    assert.strictEqual(canAddDeliverableCatalogueEntry('manager'), true);
    assert.strictEqual(canAddDeliverableCatalogueEntry('Manager'), true);
    assert.strictEqual(canAddDeliverableCatalogueEntry('editor'), false);

    assert.strictEqual(canEditDeliverableCatalogueEntry('admin'), true);
    assert.strictEqual(canEditDeliverableCatalogueEntry('Admin'), true);
    assert.strictEqual(canEditDeliverableCatalogueEntry('manager'), false);
    assert.strictEqual(canEditDeliverableCatalogueEntry('editor'), false);

    assert.strictEqual(canAccessTab('settings', 'admin'), true);
    assert.strictEqual(canAccessTab('settings', 'manager'), true);
    assert.strictEqual(canAccessTab('settings', 'editor'), false);
    assert.strictEqual(canAccessTab('deliverables', 'editor'), true);
    assert.strictEqual(hasRole('manager', ['Admin', 'Manager']), true);
    assert.strictEqual(checkRouteAccess('settings', 'admin').allowed, true);
  });

  it('13. UI integration verification: SettingsView, LeadFormModal, QuotationBuilderModal, DeliverablesView, ProjectDetailWorkspace, api.ts, and AppContext are wired to unified Shared Catalogue', () => {
    const settingsSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/settings/SettingsView.tsx'),
      'utf8'
    );
    const deliverablesSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/deliverables/DeliverablesView.tsx'),
      'utf8'
    );
    const workspaceSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/projects/ProjectDetailWorkspace.tsx'),
      'utf8'
    );
    const leadModalSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/enquiries/LeadFormModal.tsx'),
      'utf8'
    );
    const quotationModalSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/components/enquiries/QuotationBuilderModal.tsx'),
      'utf8'
    );
    const apiSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/services/api.ts'),
      'utf8'
    );
    const contextSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/context/AppContext.tsx'),
      'utf8'
    );

    // Settings has ONLY "Shared Catalogue" and "Two-Brand Configuration", without schema overview or legacy recovery banner
    assert.ok(settingsSrc.includes('Two-Brand Configuration'));
    assert.ok(settingsSrc.includes('Shared Catalogue'));
    assert.ok(!settingsSrc.includes('Supabase PostgreSQL Backend Schema'));
    assert.ok(!settingsSrc.includes('twbhub_service_catalogue'));
    assert.ok(!settingsSrc.includes('custom browser-local service'));
    assert.ok(!settingsSrc.includes('Shared Service Catalogue'));
    assert.ok(!settingsSrc.includes('Shared Deliverables Catalogue'));
    assert.ok(!settingsSrc.includes("name: 'service_catalogue'"));
    assert.ok(settingsSrc.includes('Cannot Permanently Delete Entry in Use'));

    // Leads & Quotations use unified deliverableCatalogue instead of legacy services / TEMPLATE_PRESETS
    assert.ok(leadModalSrc.includes('deliverableCatalogue'));
    assert.ok(leadModalSrc.includes('createDeliverableCatalogueItem'));
    assert.ok(!leadModalSrc.includes('createService'));
    assert.ok(quotationModalSrc.includes('getQuotationCataloguePresets'));
    assert.ok(!quotationModalSrc.includes('TEMPLATE_PRESETS'));

    // Deliverables selectors
    assert.ok(deliverablesSrc.includes('DeliverableTypeSelector'));
    assert.ok(!deliverablesSrc.includes('const DELIVERABLE_TYPES:'));
    assert.ok(workspaceSrc.includes('DeliverableTypeSelector'));
    assert.ok(workspaceSrc.includes('projectBrand'));

    // Legacy service CRUD retired cleanly
    assert.ok(!apiSrc.includes('getServices'));
    assert.ok(!apiSrc.includes('createService'));
    assert.ok(!contextSrc.includes('createService'));

    // Verify Company UUID resolution
    assert.strictEqual(
      buildDeliverableCataloguePayload({
        name: 'Album',
        applicable_brand: 'twb',
      }).company_id,
      TWB_COMPANY_UUID
    );
    assert.strictEqual(
      mapSupabaseDeliverableCatalogueToModel({
        id: '1',
        name: 'Album',
        applicable_brand: 'all',
        company_id: null,
        is_active: true,
        sort_order: 10,
      }).company_id,
      null
    );
  });

  it('14. Supports all 7 unified categories including Cinematography and Add-on, and INITIAL_DELIVERABLE_CATALOGUE holds all 19 entries', () => {
    assert.deepStrictEqual(DELIVERABLE_CATALOGUE_CATEGORIES, [
      'Film',
      'Cinematography',
      'Photography',
      'Album & Print',
      'Specialty',
      'Add-on',
      'Other',
    ]);
    assert.strictEqual(normalizeDeliverableCatalogueCategory('Cinematography'), 'Cinematography');
    assert.strictEqual(normalizeDeliverableCatalogueCategory('cinematography'), 'Cinematography');
    assert.strictEqual(normalizeDeliverableCatalogueCategory('Add-on'), 'Add-on');
    assert.strictEqual(normalizeDeliverableCatalogueCategory('addon'), 'Add-on');
    assert.strictEqual(INITIAL_DELIVERABLE_CATALOGUE.length, 19);
  });

  it('15. Lead service options & Quotation presets reflect brand filtering, descriptions, and preserve historical/inactive/custom Lead selections', () => {
    const leadOpts = getLeadServiceOptions({
      items: sampleItems,
      projectBrand: 'twb',
      selectedServices: [
        'Highlight Film (4-5 mins)',
        'Legacy DVD Box Set',
        'Super 8 Vintage Reel',
        'Custom Drone Ballet',
      ],
    });

    assert.deepStrictEqual(
      leadOpts.brandItems.map(i => i.name),
      ['Highlight Film (4-5 mins)', 'Teaser / Reel (60s)']
    );
    assert.deepStrictEqual(leadOpts.historicalSelected, [
      { name: 'Legacy DVD Box Set', status: 'inactive', detailLabel: 'inactive' },
      { name: 'Super 8 Vintage Reel', status: 'other_brand', detailLabel: 'Golden June Films' },
      { name: 'Custom Drone Ballet', status: 'custom', detailLabel: 'custom' },
    ]);

    const twbPresets = getQuotationCataloguePresets(sampleItems, 'twb');
    assert.strictEqual(twbPresets.length, 2);
    assert.strictEqual(twbPresets[0].scopeText, 'Highlight Film (4-5 mins) — Core highlight reel');
    assert.strictEqual(twbPresets[1].scopeText, 'Teaser / Reel (60s)');
  });

  it('16. Combined deletion safeguard blocks permanent deletion if referenced by EITHER a Lead service OR a Deliverable type', async () => {
    const enquiries: Enquiry[] = [
      {
        id: 'enq-1',
        company_id: 'twb',
        title: 'Aarav & Mira',
        services: ['  highlight film (4-5 mins) '],
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-14T10:00:00Z',
      },
    ];
    const deliverables: Deliverable[] = [
      {
        id: 'del-1',
        project_id: 'prj-1',
        company_id: 'twb',
        deliverable_type: 'Teaser / Reel (60s)',
        assigned_editor_id: '',
        due_date: '2026-12-01',
        status: 'Not Started',
        priority: 'Medium',
        last_updated: '2026-11-14T10:00:00Z',
      },
    ];

    const leadRefCheck = getCatalogueItemReferences({
      deliverables,
      enquiries,
      itemName: 'Highlight Film (4-5 mins)',
    });
    assert.strictEqual(leadRefCheck.leads.length, 1);
    assert.strictEqual(leadRefCheck.deliverables.length, 0);
    assert.strictEqual(leadRefCheck.totalCount, 1);
    assert.strictEqual(leadRefCheck.isInUse, true);

    // Referenced only by Lead -> still blocked!
    await assert.rejects(
      () =>
        deleteDeliverableCatalogueWithSupabase({
          id: 'dc-1',
          itemName: 'Highlight Film (4-5 mins)',
          existingDeliverables: deliverables,
          existingEnquiries: enquiries,
          adapter: {
            deleteAndReturn: async () => {
              throw new Error('Should not delete entry referenced by a Lead');
            },
            existsById: async () => ({ exists: true, error: null }),
          },
          storage: createMemoryStorage(),
        }),
      /referenced by 1 existing lead/i
    );

    // Referenced by neither -> deletes cleanly
    await deleteDeliverableCatalogueWithSupabase({
      id: 'dc-4',
      itemName: 'Legacy DVD Box Set',
      existingDeliverables: deliverables,
      existingEnquiries: enquiries,
      adapter: {
        deleteAndReturn: async id => ({ data: [{ id }], error: null }),
        existsById: async () => ({ exists: false, error: null }),
      },
      storage: createMemoryStorage(),
    });
  });
});

