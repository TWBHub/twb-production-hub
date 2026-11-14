import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  LEADS_STORAGE_KEY,
  QUOTATIONS_STORAGE_KEY,
  LEADS_BACKUPS_STORAGE_KEY,
  LEADS_MIGRATION_RECEIPT_KEY,
  StorageAdapter,
  createVersionedBackupSnapshot,
  getLeadsBackupSnapshots,
  buildBackupDownloadPayload,
  getBackupDownloadFilename,
  isUnchangedSeedEnquiry,
  buildLeadsRecoveryPreview,
  hasUnsyncedLocalLeads,
  mapEnquiryStatusToDb,
  mapDbToEnquiryStatus,
  buildEnquirySupabasePayload,
  mapSupabaseEnquiryToModel,
  recordLeadMigrationReceipt,
  getLeadsMigrationReceipts,
  EnquiriesSupabaseClientAdapter,
  fetchEnquiriesWithSupabase,
  createEnquiryWithSupabase,
  updateEnquiryWithSupabase,
  deleteEnquiryWithSupabase,
} from './leadsPersistenceUtils';
import { getSupabaseConnectionDiagnostics } from '../lib/supabase';
import { TWB_COMPANY_UUID, GJ_COMPANY_UUID, isUuid } from './companyUtils';
import { INITIAL_ENQUIRIES } from '../services/seedData';
import { Enquiry, EnquiryStatus, Quotation } from '../types';

function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const store: Record<string, string> = { ...initial };
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

describe('Leads Persistence — Stage 1 (Backup & Diagnostics) and Stage 2 (Recovery Preview)', () => {
  const manualLead: Enquiry = {
    id: 'enq-1763000123456',
    company_id: 'twb',
    title: 'Riya & Arjun Wedding',
    client_name: 'Riya Sharma',
    partner_name: 'Arjun Kapoor',
    email: 'riya@example.com',
    phone: '+91 9876543210',
    event_date: '2026-12-18',
    venue: 'Taj Lake Palace',
    city: 'Udaipur',
    estimated_budget: 450000,
    status: 'New',
    quotation_status: 'Draft',
    created_at: '2026-11-10T09:15:00.000Z',
  };

  const linkedQuotation: Quotation = {
    id: 'quote-1763000999999',
    enquiry_id: manualLead.id,
    company_id: 'twb',
    quotation_number: 'QT-TWB-2026-0009',
    version: 1,
    issue_date: '2026-11-10',
    items: [],
    subtotal: 450000,
    discount: 0,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 450000,
    total: 450000,
    status: 'Draft',
    created_at: '2026-11-10T10:00:00.000Z',
  };

  it('Stage 1: creates versioned non-overwriting backups preserving raw enquiries and quotations', () => {
    const rawEnq = JSON.stringify([manualLead, INITIAL_ENQUIRIES[0]]);
    const rawQuote = JSON.stringify([linkedQuotation]);
    const storage = createMemoryStorage({
      [LEADS_STORAGE_KEY]: rawEnq,
      [QUOTATIONS_STORAGE_KEY]: rawQuote,
    });

    // 1. Auto pre-recovery creates v1
    const first = createVersionedBackupSnapshot(storage, 'auto_pre_recovery', '2026-11-13T09:00:00.000Z');
    assert.strictEqual(first.createdNew, true);
    assert.strictEqual(first.snapshot?.version, 1);
    assert.strictEqual(first.snapshot?.raw_enquiries_json, rawEnq);
    assert.strictEqual(first.snapshot?.raw_quotations_json, rawQuote);
    assert.strictEqual(first.snapshot?.enquiries_count, 2);
    assert.strictEqual(first.snapshot?.quotations_count, 1);

    // Original raw keys remain untouched
    assert.strictEqual(storage.getItem(LEADS_STORAGE_KEY), rawEnq);
    assert.strictEqual(storage.getItem(QUOTATIONS_STORAGE_KEY), rawQuote);

    // 2. Repeated auto_pre_recovery with unchanged fingerprint does not duplicate v1
    const repeat = createVersionedBackupSnapshot(storage, 'auto_pre_recovery', '2026-11-13T09:05:00.000Z');
    assert.strictEqual(repeat.createdNew, false);
    assert.strictEqual(repeat.allSnapshots.length, 1);

    // 3. Manual snapshot appends v2 without overwriting v1
    const manual = createVersionedBackupSnapshot(storage, 'manual_snapshot', '2026-11-13T09:10:00.000Z');
    assert.strictEqual(manual.createdNew, true);
    assert.strictEqual(manual.snapshot?.version, 2);

    const allStored = getLeadsBackupSnapshots(storage);
    assert.strictEqual(allStored.length, 2);
    assert.strictEqual(allStored[0].version, 1);
    assert.strictEqual(allStored[1].version, 2);
    assert.ok(storage.getItem(LEADS_BACKUPS_STORAGE_KEY));
  });

  it('Stage 1: backup download payload & diagnostics never expose anon keys', () => {
    const storage = createMemoryStorage({
      [LEADS_STORAGE_KEY]: JSON.stringify([manualLead]),
      [QUOTATIONS_STORAGE_KEY]: JSON.stringify([linkedQuotation]),
    });
    const { snapshot } = createVersionedBackupSnapshot(storage, 'manual_snapshot', '2026-11-13T09:30:00.000Z');
    assert.ok(snapshot);

    const diagnostics = getSupabaseConnectionDiagnostics();
    assert.strictEqual('anonKey' in (diagnostics as any), false);
    assert.strictEqual('key' in (diagnostics as any), false);

    const fakeDiag = {
      projectUrl: 'https://demo-project.supabase.co',
      credentialSource: 'environment' as const,
      hasUrlOverride: false,
      hasKeyOverride: false,
      isConfigured: true,
      note: 'Verified for this browser only.',
    };
    const payload = buildBackupDownloadPayload(snapshot, fakeDiag);
    const jsonStr = JSON.stringify(payload);
    assert.ok(jsonStr.includes('https://demo-project.supabase.co'));
    assert.ok(jsonStr.includes(manualLead.id));
    assert.ok(jsonStr.includes(linkedQuotation.id));
    assert.strictEqual(getBackupDownloadFilename(snapshot), 'twbhub-leads-backup-v1-2026-11-13-09-30-00.json');
  });

  it('Stage 2: excludes only unchanged seed records and retains modified seed records', () => {
    const unchangedSeed = { ...INITIAL_ENQUIRIES[0] };
    const modifiedSeed: Enquiry = {
      ...INITIAL_ENQUIRIES[1],
      notes: 'User edited this seed note locally!',
      estimated_budget: 999999,
    };

    assert.strictEqual(isUnchangedSeedEnquiry(unchangedSeed), true);
    assert.strictEqual(isUnchangedSeedEnquiry(modifiedSeed), false);
    assert.strictEqual(isUnchangedSeedEnquiry(manualLead), false);
  });

  it('Stage 2: recovery preview accurately identifies local-only leads, modified seeds, matched Supabase rows, and linked quotations', () => {
    const unchangedSeed = { ...INITIAL_ENQUIRIES[0] };
    const modifiedSeed: Enquiry = {
      ...INITIAL_ENQUIRIES[1],
      notes: 'Updated locally on Home MacBook',
    };
    const alreadySyncedLocal: Enquiry = {
      ...manualLead,
      id: 'enq-1763000000001',
      title: 'Already Synced Couple',
      client_name: 'Meera Nair',
      email: 'meera@example.com',
    };
    const supabaseEquivalent: Enquiry = {
      ...alreadySyncedLocal,
      id: '11111111-2222-3333-4444-555555555555',
    };

    const preview = buildLeadsRecoveryPreview({
      localLeads: [manualLead, unchangedSeed, modifiedSeed, alreadySyncedLocal],
      localQuotations: [linkedQuotation],
      supabaseLeads: [supabaseEquivalent],
      supabaseReachable: true,
      generatedAt: '2026-11-13T09:40:00.000Z',
    });

    assert.strictEqual(preview.candidates_to_migrate.length, 2);
    assert.strictEqual(preview.candidates_to_migrate[0].lead.id, manualLead.id);
    assert.strictEqual(preview.candidates_to_migrate[0].category, 'local_only');
    assert.strictEqual(preview.candidates_to_migrate[0].linkedLocalQuotations.length, 1);

    assert.strictEqual(preview.candidates_to_migrate[1].lead.id, modifiedSeed.id);
    assert.strictEqual(preview.candidates_to_migrate[1].category, 'modified_seed');

    assert.strictEqual(preview.unchanged_seeds_excluded.length, 1);
    assert.strictEqual(preview.unchanged_seeds_excluded[0].lead.id, unchangedSeed.id);

    assert.strictEqual(preview.already_in_supabase.length, 1);
    assert.strictEqual(preview.already_in_supabase[0].matchedSupabaseLeadId, supabaseEquivalent.id);

    assert.strictEqual(preview.linked_quotations_count, 1);
    assert.strictEqual(hasUnsyncedLocalLeads([manualLead], [supabaseEquivalent]), true);
    assert.strictEqual(hasUnsyncedLocalLeads([unchangedSeed], [supabaseEquivalent]), false);
  });

  it('Stage 3: maps all 6 UI Lead statuses bijectively to/from DB check constraint values', () => {
    const pairs: Array<[EnquiryStatus, string]> = [
      ['New', 'new'],
      ['Contacted', 'contacted'],
      ['Meeting Scheduled', 'follow_up'],
      ['Proposal Sent', 'quotation_sent'],
      ['Won', 'converted'],
      ['Lost', 'lost'],
    ];

    for (const [uiStatus, dbStatus] of pairs) {
      assert.strictEqual(mapEnquiryStatusToDb(uiStatus), dbStatus);
      assert.strictEqual(mapDbToEnquiryStatus(dbStatus), uiStatus);
    }
  });

  it('Stage 3: preserves all Lead fields, multi-event objects, separate venue/city, and nullable estimated_budget', () => {
    const fullLocalLead: Enquiry = {
      id: 'enq-1763000555555',
      company_id: 'golden_june',
      title: 'Aanya & Vikram Destination Wedding',
      client_name: 'Aanya Menon',
      partner_name: 'Vikram Rao',
      email: 'aanya@example.com',
      phone: '+91 9988776655',
      instagram: '@aanyamenon',
      event_date: '2027-01-20',
      venue: 'Alila Diwa',
      city: 'Goa',
      lead_source: 'Instagram',
      requirements: '2-day wedding coverage + drone + same-day edit',
      package_interest: 'Golden June Bespoke',
      estimated_budget: undefined, // blank must remain NULL/undefined, never 0
      status: 'Meeting Scheduled',
      follow_up_date: '2026-11-20',
      consultation_date: '2026-11-18',
      assigned_to: 'Reuben',
      services: ['Candid Photography', 'Cinematography', 'Drone'],
      events: [
        {
          id: 'evt-1',
          event_name: 'Haldi & Pool Party',
          event_date: '2027-01-20',
          event_time: '10:30 AM',
          event_address: 'Alila Lawns, Goa',
          team: '2 Photo + 2 Video',
          event_notes: 'Keep coverage candid and warm',
          sort_order: 0,
        },
        {
          id: 'evt-2',
          event_name: 'Phere & Reception',
          event_date: '2027-01-21',
          event_time: '05:00 PM',
          event_address: 'Beachfront Deck, Goa',
          team: '3 Photo + 3 Video',
          event_notes: 'Sunset portraits at 5:30 PM',
          sort_order: 1,
        },
      ],
      notes: 'Client prefers editorial documentary tones.',
      client_preferences: 'Avoid harsh flash',
      logistics_notes: 'Crew flights from BLR',
      quotation_status: 'Draft',
      is_archived: true,
      currency: 'INR',
      created_at: '2026-11-05T08:15:30.123Z',
      updated_at: '2026-11-12T12:00:00.000Z',
    };

    const targetUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const payload = buildEnquirySupabasePayload(fullLocalLead, targetUuid, { preserveTimestamps: true });

    assert.strictEqual(payload.id, targetUuid);
    assert.strictEqual(payload.company_id, GJ_COMPANY_UUID);
    assert.strictEqual(payload.name, fullLocalLead.title);
    assert.strictEqual(payload.enquiry_date, '2026-11-05');
    assert.strictEqual(payload.status, 'follow_up');
    assert.strictEqual(payload.estimated_budget, null);
    assert.strictEqual(payload.venue, 'Alila Diwa');
    assert.strictEqual(payload.city, 'Goa');
    assert.strictEqual(payload.event_location, 'Alila Diwa, Goa');
    assert.strictEqual(payload.events.length, 2);
    assert.strictEqual(payload.services.length, 3);
    assert.strictEqual(payload.is_archived, true);

    // Simulate PostgreSQL returning +00:00 timestamp and ensure event_location does NOT overwrite separate venue/city
    const dbRow = {
      ...payload,
      created_at: '2026-11-05T08:15:30.123+00:00',
      updated_at: '2026-11-12T12:00:00+00:00',
    };
    const roundTripped = mapSupabaseEnquiryToModel(dbRow);

    assert.strictEqual(roundTripped.id, targetUuid);
    assert.strictEqual(roundTripped.company_id, 'golden_june');
    assert.strictEqual(roundTripped.title, fullLocalLead.title);
    assert.strictEqual(roundTripped.client_name, fullLocalLead.client_name);
    assert.strictEqual(roundTripped.partner_name, fullLocalLead.partner_name);
    assert.strictEqual(roundTripped.venue, 'Alila Diwa');
    assert.strictEqual(roundTripped.city, 'Goa');
    assert.strictEqual(roundTripped.estimated_budget, undefined);
    assert.strictEqual(roundTripped.status, 'Meeting Scheduled');
    assert.strictEqual(roundTripped.events?.length, 2);
    assert.strictEqual(roundTripped.events?.[1].event_address, 'Beachfront Deck, Goa');
    assert.strictEqual(roundTripped.services?.length, 3);
    assert.strictEqual(roundTripped.is_archived, true);

    // Legacy row compatibility: null venue & city falls back to event_location, null title/client_name falls back to name
    const legacyRow = {
      id: '99999999-8888-4777-8666-555555555555',
      company_id: TWB_COMPANY_UUID,
      name: 'Legacy Enquiry Couple',
      email: 'legacy@example.com',
      phone: null,
      enquiry_date: '2026-10-01',
      event_date: '2026-12-01',
      event_location: 'Taj Falaknuma, Hyderabad',
      venue: null,
      city: null,
      estimated_budget: null,
      source: 'Referral',
      status: 'quotation_sent',
      created_at: '2026-10-01T10:00:00+00:00',
    };
    const mappedLegacy = mapSupabaseEnquiryToModel(legacyRow);
    assert.strictEqual(mappedLegacy.company_id, 'twb');
    assert.strictEqual(mappedLegacy.title, 'Legacy Enquiry Couple');
    assert.strictEqual(mappedLegacy.client_name, 'Legacy Enquiry Couple');
    assert.strictEqual(mappedLegacy.venue, 'Taj Falaknuma, Hyderabad');
    assert.strictEqual(mappedLegacy.city, undefined);
    assert.strictEqual(mappedLegacy.lead_source, 'Referral');
    assert.strictEqual(mappedLegacy.status, 'Proposal Sent');
    assert.strictEqual(mappedLegacy.estimated_budget, undefined);
  });

  it('Stage 3: migration receipts and PostgreSQL +00:00 timestamps prevent duplicate Leads after migration', () => {
    const storage = createMemoryStorage();
    const migratedUuid = '12345678-1234-4123-8123-123456789abc';

    recordLeadMigrationReceipt(
      {
        legacy_local_id: manualLead.id,
        supabase_uuid: migratedUuid,
        migrated_at: '2026-11-13T12:00:00.000Z',
        display_name: manualLead.title!,
        verified: true,
      },
      storage
    );

    const receipts = getLeadsMigrationReceipts(storage);
    assert.strictEqual(receipts.length, 1);
    assert.ok(storage.getItem(LEADS_MIGRATION_RECEIPT_KEY));

    const supabaseRowMapped = mapSupabaseEnquiryToModel({
      ...buildEnquirySupabasePayload(manualLead, migratedUuid, { preserveTimestamps: true }),
      created_at: '2026-11-10T09:15:00+00:00',
    });

    const preview = buildLeadsRecoveryPreview({
      localLeads: [manualLead],
      localQuotations: [linkedQuotation],
      supabaseLeads: [supabaseRowMapped],
      migrationReceipts: receipts,
      supabaseReachable: true,
    });

    assert.strictEqual(preview.candidates_to_migrate.length, 0);
    assert.strictEqual(preview.already_in_supabase.length, 1);
    assert.strictEqual(preview.already_in_supabase[0].matchedSupabaseLeadId, migratedUuid);
    assert.strictEqual(
      hasUnsyncedLocalLeads([manualLead], [supabaseRowMapped], INITIAL_ENQUIRIES, receipts),
      false
    );
  });

  it('Stage 4 CRUD (Create): uses Stage 3 payload builder, returns authoritative Supabase row, and preserves unmigrated local recovery records', async () => {
    const rawOriginalLocal = JSON.stringify([manualLead]);
    const storage = createMemoryStorage({
      [LEADS_STORAGE_KEY]: rawOriginalLocal,
      [QUOTATIONS_STORAGE_KEY]: JSON.stringify([linkedQuotation]),
    });

    let capturedPayload: Record<string, any> | null = null;
    const authoritativeUuid = '11111111-aaaa-4bbb-8ccc-222222222222';
    const adapter: EnquiriesSupabaseClientAdapter = {
      selectAll: async () => ({ data: [], error: null }),
      insertAndReturn: async payload => {
        capturedPayload = payload;
        return {
          data: {
            ...payload,
            id: authoritativeUuid,
            created_at: '2026-11-13T12:15:00+00:00',
            updated_at: '2026-11-13T12:15:00+00:00',
          },
          error: null,
        };
      },
      updateAndReturn: async () => ({ data: null, error: null }),
      deleteById: async () => ({ error: null }),
    };

    const created = await createEnquiryWithSupabase({
      enquiry: {
        company_id: 'golden_june',
        title: 'SYNC TEST - LIVE',
        client_name: 'Riya Verma',
        venue: 'Taj Falaknuma',
        city: 'Hyderabad',
        status: 'New',
        estimated_budget: undefined,
        services: ['Candid Photography'],
        events: [],
        quotation_status: 'Draft',
      },
      adapter,
      storage,
    });

    assert.ok(capturedPayload);
    assert.ok(isUuid(capturedPayload!.id));
    assert.strictEqual(capturedPayload!.company_id, GJ_COMPANY_UUID);
    assert.strictEqual(capturedPayload!.status, 'new');
    assert.strictEqual(capturedPayload!.estimated_budget, null);
    assert.strictEqual('archived' in capturedPayload!, false);

    // Authoritative row from Supabase is returned
    assert.strictEqual(created.id, authoritativeUuid);
    assert.strictEqual(created.company_id, 'golden_june');
    assert.strictEqual(created.venue, 'Taj Falaknuma');
    assert.strictEqual(created.city, 'Hyderabad');
    assert.strictEqual(created.estimated_budget, undefined);

    // Original unmigrated local recovery data MUST NOT be overwritten
    assert.strictEqual(storage.getItem(LEADS_STORAGE_KEY), rawOriginalLocal);
  });

  it('Stage 4 CRUD (Create failure): throws Supabase error and NEVER silently falls back to localStorage', async () => {
    const cleanCache = JSON.stringify([]);
    const storage = createMemoryStorage({
      [LEADS_STORAGE_KEY]: cleanCache,
    });

    const failingAdapter: EnquiriesSupabaseClientAdapter = {
      selectAll: async () => ({ data: [], error: null }),
      insertAndReturn: async () => ({
        data: null,
        error: { message: 'new row violates check constraint "enquiries_status_check"', code: '23514' },
      }),
      updateAndReturn: async () => ({ data: null, error: null }),
      deleteById: async () => ({ error: null }),
    };

    await assert.rejects(
      () =>
        createEnquiryWithSupabase({
          enquiry: {
            company_id: 'twb',
            title: 'Should Fail Save',
            client_name: 'Failed Lead',
            status: 'New',
            quotation_status: 'Draft',
          },
          adapter: failingAdapter,
          storage,
        }),
      /Failed to save Lead to Supabase: .*enquiries_status_check/
    );

    // Must remain unchanged in localStorage
    assert.strictEqual(storage.getItem(LEADS_STORAGE_KEY), cleanCache);
  });

  it('Stage 4 CRUD (Update & Delete): uses authoritative Supabase rows on success, throws on failure, and blocks unmigrated local-only IDs', async () => {
    const existingUuid = '22222222-3333-4444-8555-666666666666';
    const existingLead: Enquiry = {
      id: existingUuid,
      company_id: 'twb',
      title: 'Kabir & Tara',
      client_name: 'Kabir Singh',
      venue: 'Oberoi Udaivilas',
      city: 'Udaipur',
      status: 'New',
      quotation_status: 'Draft',
      created_at: '2026-11-10T10:00:00+00:00',
    };

    const storage = createMemoryStorage({
      [LEADS_STORAGE_KEY]: JSON.stringify([existingLead]),
    });

    let updatedPayload: Record<string, any> | null = null;
    const successAdapter: EnquiriesSupabaseClientAdapter = {
      selectAll: async () => ({ data: [], error: null }),
      insertAndReturn: async () => ({ data: null, error: null }),
      updateAndReturn: async (id, payload) => {
        updatedPayload = payload;
        return {
          data: {
            id,
            ...payload,
            created_at: existingLead.created_at,
            updated_at: '2026-11-13T12:20:00+00:00',
          },
          error: null,
        };
      },
      deleteById: async () => ({ error: null }),
    };

    const updated = await updateEnquiryWithSupabase({
      enquiry: { ...existingLead, status: 'Proposal Sent', estimated_budget: 750000 },
      adapter: successAdapter,
      storage,
    });

    assert.ok(updatedPayload);
    assert.strictEqual(updatedPayload!.status, 'quotation_sent');
    assert.strictEqual('archived' in updatedPayload!, false);
    assert.strictEqual('id' in updatedPayload!, false);
    assert.strictEqual(updated.status, 'Proposal Sent');
    assert.strictEqual(updated.estimated_budget, 750000);
    assert.strictEqual(updated.updated_at, '2026-11-13T12:20:00+00:00');

    // Unmigrated local-only non-UUID lead cannot be silently updated or deleted via Supabase CRUD
    await assert.rejects(
      () => updateEnquiryWithSupabase({ enquiry: manualLead, adapter: successAdapter, storage }),
      /local-only recovery record/
    );
    await assert.rejects(
      () => deleteEnquiryWithSupabase({ id: manualLead.id, adapter: successAdapter, storage }),
      /local-only recovery record/
    );

    // Supabase failure on update & delete throws and preserves cache untouched
    const failingAdapter: EnquiriesSupabaseClientAdapter = {
      selectAll: async () => ({ data: null, error: { message: 'permission denied for table enquiries', code: '42501' } }),
      insertAndReturn: async () => ({ data: null, error: { message: 'permission denied' } }),
      updateAndReturn: async () => ({ data: null, error: { message: 'permission denied for table enquiries' } }),
      deleteById: async () => ({ error: { message: 'permission denied for table enquiries' } }),
    };

    await assert.rejects(
      () => updateEnquiryWithSupabase({ enquiry: updated, adapter: failingAdapter, storage }),
      /Failed to update Lead in Supabase: permission denied/
    );
    await assert.rejects(
      () => deleteEnquiryWithSupabase({ id: existingUuid, adapter: failingAdapter, storage }),
      /Failed to delete Lead from Supabase: permission denied/
    );
    await assert.rejects(
      () =>
        fetchEnquiriesWithSupabase({
          adapter: failingAdapter,
          storage,
          fallbackUnconfigured: () => [manualLead],
        }),
      /Failed to load Leads from Supabase: permission denied/
    );

    // Successful delete updates cache when no unmigrated recovery records exist
    await deleteEnquiryWithSupabase({ id: existingUuid, adapter: successAdapter, storage });
    assert.strictEqual(storage.getItem(LEADS_STORAGE_KEY), '[]');
  });
});
