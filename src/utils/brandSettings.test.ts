import {
  TWB_COMPANY_UUID,
  GJ_COMPANY_UUID,
  isGoldenJune,
  isTWB,
  resolveCompany,
  prepareCompanyForUpdate,
  sanitizeCompany,
  VERIFIED_BRAND_DETAILS,
  extractSupabaseCompanyPayload,
  mergeSupabaseCompanyRow,
} from './companyUtils';
import {
  getOfficialCompanyInfo,
  VERIFIED_BRAND_DEFAULTS,
  getOrderFormFilename,
  getPaymentReceiptFilename,
  generateQuotationPDF,
} from './pdfGenerator';
import { INITIAL_COMPANIES } from '../services/seedData';
import { Company, Project, Client, Payment, Enquiry } from '../types';

function runTests() {
  console.log('--- Starting Two-Brand Settings & PDF Integration Tests ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (!condition) {
      console.error(`FAIL: ${testName} | Expected:`, expected, '| Got:', actual);
      failures++;
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  // =========================================================================
  // Suite 1: Safe Defaults in INITIAL_COMPANIES
  // =========================================================================
  console.log('\n[Suite 1] INITIAL_COMPANIES Defaults Verification');
  const twbDefault = INITIAL_COMPANIES.find(c => c.code === 'twb');
  const gjDefault = INITIAL_COMPANIES.find(c => c.code === 'golden_june');

  assert(Boolean(twbDefault), 'INITIAL_COMPANIES: TWB entry exists');
  assert(twbDefault?.name === 'The Wedding Booth', 'TWB name is "The Wedding Booth"', twbDefault?.name, 'The Wedding Booth');
  assert(twbDefault?.email === 'dweddingbooth@gmail.com', 'TWB email is verified Indian email', twbDefault?.email, 'dweddingbooth@gmail.com');
  assert(twbDefault?.phone === '+91 9074448850', 'TWB phone is +91 9074448850', twbDefault?.phone, '+91 9074448850');
  assert(twbDefault?.website === 'www.theweddingbooth.in', 'TWB website is www.theweddingbooth.in', twbDefault?.website, 'www.theweddingbooth.in');
  assert(twbDefault?.address === '', 'TWB address is blank', twbDefault?.address, '');

  assert(Boolean(gjDefault), 'INITIAL_COMPANIES: Golden June entry exists');
  assert(gjDefault?.name === 'Golden June Films', 'Golden June name is "Golden June Films"', gjDefault?.name, 'Golden June Films');
  assert(gjDefault?.email === 'goldenjunefilms@gmail.com', 'Golden June email is verified Indian email', gjDefault?.email, 'goldenjunefilms@gmail.com');
  assert(gjDefault?.phone === '+91 9074963370', 'Golden June phone is +91 9074963370', gjDefault?.phone, '+91 9074963370');
  assert(gjDefault?.website === 'www.goldenjunefilms.com', 'Golden June website is www.goldenjunefilms.com', gjDefault?.website, 'www.goldenjunefilms.com');
  assert(gjDefault?.address === '', 'Golden June address is blank', gjDefault?.address, '');

  // =========================================================================
  // Suite 2: Brand Identification & Company Lookup by Code & Database UUID
  // =========================================================================
  console.log('\n[Suite 2] Brand Identification & Lookup by Code / UUID');

  // isTWB and isGoldenJune
  assert(isTWB({ code: 'twb' }), 'isTWB: identifies by code "twb"');
  assert(isTWB({ id: 'twb' }), 'isTWB: identifies by id "twb"');
  assert(isTWB({ id: TWB_COMPANY_UUID }), 'isTWB: identifies by PostgreSQL UUID');
  assert(isTWB({ name: 'The Wedding Booth' }), 'isTWB: identifies by name "The Wedding Booth"');
  assert(!isTWB({ code: 'golden_june' }), 'isTWB: does not match Golden June code');

  assert(isGoldenJune({ code: 'golden_june' }), 'isGoldenJune: identifies by code "golden_june"');
  assert(isGoldenJune({ id: 'golden_june' }), 'isGoldenJune: identifies by id "golden_june"');
  assert(isGoldenJune({ id: GJ_COMPANY_UUID }), 'isGoldenJune: identifies by PostgreSQL UUID');
  assert(isGoldenJune({ name: 'Golden June Films' }), 'isGoldenJune: identifies by name "Golden June Films"');
  assert(!isGoldenJune({ code: 'twb' }), 'isGoldenJune: does not match TWB code');

  // resolveCompany with UUIDs from Supabase
  const dbCompanies: Company[] = [
    {
      id: TWB_COMPANY_UUID,
      code: 'twb',
      name: 'The Wedding Booth',
      tagline: 'Wedding Photography & Films',
      email: 'dweddingbooth@gmail.com',
      phone: '+91 9074448850',
      website: 'www.theweddingbooth.in',
      address: '',
      primary_color: '#0f172a',
      accent_color: '#2563eb',
      bank_details: { account_name: 'TWB LLC', account_number: '123', bank_name: 'Test Bank', routing_code: '456' },
      terms_conditions: 'Standard terms',
    },
    {
      id: GJ_COMPANY_UUID,
      code: 'golden_june',
      name: 'Golden June Films',
      tagline: 'Wedding Photography & Films',
      email: 'goldenjunefilms@gmail.com',
      phone: '+91 9074963370',
      website: 'www.goldenjunefilms.com',
      address: '',
      primary_color: '#3b2207',
      accent_color: '#d97706',
      bank_details: { account_name: 'GJ Inc', account_number: '789', bank_name: 'Test Bank 2', routing_code: '012' },
      terms_conditions: 'Standard terms GJ',
    },
  ];

  const resolvedTWB = resolveCompany(dbCompanies, 'twb');
  assert(resolvedTWB?.id === TWB_COMPANY_UUID, 'resolveCompany: resolves TWB with database UUID', resolvedTWB?.id, TWB_COMPANY_UUID);

  const resolvedGJ = resolveCompany(dbCompanies, 'golden_june');
  assert(resolvedGJ?.id === GJ_COMPANY_UUID, 'resolveCompany: resolves Golden June with database UUID', resolvedGJ?.id, GJ_COMPANY_UUID);

  // resolveCompany fallback when list is empty
  const fallbackTwb = resolveCompany([], 'twb', INITIAL_COMPANIES[0]);
  assert(fallbackTwb?.code === 'twb', 'resolveCompany: falls back to provided default on empty array', fallbackTwb?.code, 'twb');

  // =========================================================================
  // Suite 3: Preserving Database Primary Keys & Banking Details on Updates
  // =========================================================================
  console.log('\n[Suite 3] Primary Key & Data Preservation on Company Updates');

  // When form state has string code id 'twb', but existing DB has UUID, UUID MUST BE PRESERVED
  const twbEditedInForm: Company = {
    ...dbCompanies[0],
    id: 'twb', // Simulated form having code instead of UUID
    name: 'The Wedding Booth Studio',
    phone: '+91 9074448859',
  };

  const twbPrepared = prepareCompanyForUpdate(twbEditedInForm, dbCompanies);
  assert(
    twbPrepared.id === TWB_COMPANY_UUID,
    'prepareCompanyForUpdate: strictly preserves database UUID instead of overwriting with "twb"',
    twbPrepared.id,
    TWB_COMPANY_UUID
  );
  assert(twbPrepared.name === 'The Wedding Booth Studio', 'prepareCompanyForUpdate: applies updated name');
  assert(twbPrepared.phone === '+91 9074448859', 'prepareCompanyForUpdate: applies updated phone');
  assert(twbPrepared.bank_details.account_name === 'TWB LLC', 'prepareCompanyForUpdate: preserves bank details');
  assert(twbPrepared.terms_conditions === 'Standard terms', 'prepareCompanyForUpdate: preserves terms and conditions');

  // Similarly for Golden June
  const gjEditedInForm: Company = {
    ...dbCompanies[1],
    id: 'golden_june',
    email: 'newemail@goldenjunefilms.com',
  };
  const gjPrepared = prepareCompanyForUpdate(gjEditedInForm, dbCompanies);
  assert(
    gjPrepared.id === GJ_COMPANY_UUID,
    'prepareCompanyForUpdate: strictly preserves Golden June database UUID',
    gjPrepared.id,
    GJ_COMPANY_UUID
  );
  assert(gjPrepared.email === 'newemail@goldenjunefilms.com', 'prepareCompanyForUpdate: applies updated email');

  // =========================================================================
  // Suite 4: Dynamic PDF Company Details & Safe Fallbacks
  // =========================================================================
  console.log('\n[Suite 4] Dynamic PDF Details & Safe Fallbacks');

  // 1. Fully populated company with custom settings
  const customCompany: Company = {
    id: TWB_COMPANY_UUID,
    code: 'twb',
    name: 'The Wedding Booth Co.',
    tagline: 'Artisanal Wedding Cinematography',
    email: 'contact@theweddingbooth.in',
    phone: '+91 9876543210',
    website: 'https://theweddingbooth.in',
    address: 'Kochi Studio, Kerala',
    primary_color: '#0f172a',
    accent_color: '#2563eb',
    bank_details: { account_name: '', account_number: '', bank_name: '', routing_code: '' },
    terms_conditions: '',
  };

  const dynamicInfo = getOfficialCompanyInfo(customCompany);
  assert(dynamicInfo.name === 'The Wedding Booth Co.', 'Dynamic PDF info: uses custom name', dynamicInfo.name, 'The Wedding Booth Co.');
  assert(dynamicInfo.brandDisplayName === 'THE WEDDING BOOTH CO.', 'Dynamic PDF info: uppercased display name', dynamicInfo.brandDisplayName, 'THE WEDDING BOOTH CO.');
  assert(dynamicInfo.tagline === 'Artisanal Wedding Cinematography', 'Dynamic PDF info: uses custom tagline', dynamicInfo.tagline, 'Artisanal Wedding Cinematography');
  assert(dynamicInfo.email === 'contact@theweddingbooth.in', 'Dynamic PDF info: uses custom email', dynamicInfo.email, 'contact@theweddingbooth.in');
  assert(dynamicInfo.mobile === '+91 9876543210', 'Dynamic PDF info: uses custom phone', dynamicInfo.mobile, '+91 9876543210');
  assert(dynamicInfo.website === 'https://theweddingbooth.in', 'Dynamic PDF info: uses custom website', dynamicInfo.website, 'https://theweddingbooth.in');
  assert(dynamicInfo.address === 'Kochi Studio, Kerala', 'Dynamic PDF info: uses custom address', dynamicInfo.address, 'Kochi Studio, Kerala');

  // 2. Fallbacks when optional fields are blank
  const blankCompany: Partial<Company> = {
    code: 'twb',
    name: '',
    email: '',
    phone: '',
    website: '',
    tagline: '',
    address: '',
  };
  const fallbackInfo = getOfficialCompanyInfo(blankCompany);
  assert(fallbackInfo.name === 'The Wedding Booth', 'Fallback PDF info: falls back to "The Wedding Booth" when blank');
  assert(fallbackInfo.email === 'dweddingbooth@gmail.com', 'Fallback PDF info: falls back to verified Indian email');
  assert(fallbackInfo.mobile === '+91 9074448850', 'Fallback PDF info: falls back to verified Indian phone');
  assert(fallbackInfo.website === 'www.theweddingbooth.in', 'Fallback PDF info: falls back to verified Indian website');
  assert(fallbackInfo.tagline === 'Wedding Photography & Films', 'Fallback PDF info: falls back to verified tagline');

  // 3. Sanitizing legacy fake US placeholder strings
  const legacyCompany: Partial<Company> = {
    code: 'twb',
    name: 'TWB (The Wedding Book)',
    email: 'hello@twbfilms.com',
    phone: '+1 (415) 890-2341',
    website: 'https://twbfilms.com',
    address: 'Studio 402, 180 Townsend St, San Francisco, CA 94107',
  };
  const sanitizedInfo = getOfficialCompanyInfo(legacyCompany);
  assert(sanitizedInfo.name === 'The Wedding Booth', 'Sanitize: filters out "The Wedding Book" and uses "The Wedding Booth"');
  assert(sanitizedInfo.email === 'dweddingbooth@gmail.com', 'Sanitize: filters out "hello@twbfilms.com"');
  assert(sanitizedInfo.mobile === '+91 9074448850', 'Sanitize: filters out "+1 (415) 890-2341"');
  assert(sanitizedInfo.website === 'www.theweddingbooth.in', 'Sanitize: filters out "twbfilms.com"');
  assert(sanitizedInfo.address === '', 'Sanitize: filters out San Francisco address');

  // 4. Golden June fallbacks
  const blankGJ: Partial<Company> = {
    code: 'golden_june',
  };
  const fallbackGJ = getOfficialCompanyInfo(blankGJ);
  assert(fallbackGJ.name === 'Golden June Films', 'Golden June PDF info: falls back to "Golden June Films"');
  assert(fallbackGJ.email === 'goldenjunefilms@gmail.com', 'Golden June PDF info: falls back to verified Indian email');
  assert(fallbackGJ.mobile === '+91 9074963370', 'Golden June PDF info: falls back to verified Indian phone');
  assert(fallbackGJ.website === 'www.goldenjunefilms.com', 'Golden June PDF info: falls back to verified Indian website');

  // =========================================================================
  // Suite 5: Filename & Quotation PDF Integration with UUID & Codes
  // =========================================================================
  console.log('\n[Suite 5] Filename & Quotation PDF Integration');

  const mockProject: Project = {
    id: 'proj-1',
    company_id: 'golden_june',
    client_id: 'c1',
    name: 'Sharma Wedding',
    wedding_date_start: '2026-11-15',
    wedding_date_end: '2026-11-16',
    venue: 'Grand Palace',
    city: 'Jaipur',
    client_contact: { phone: '9876543210', email: 'rohit@example.com' },
    status: 'Booked',
    package_name: 'Royal Cinema',
    package_details: '',
    booking_amount: 50000,
    total_amount: 250000,
    created_at: '2026-01-01',
  };

  const mockClient: Client = {
    id: 'c1',
    company_id: 'golden_june',
    name: 'Rohit Sharma',
    partner_name: 'Pooja Verma',
    email: 'rohit@example.com',
    phone: '9876543210',
    created_at: '2026-01-01',
  };

  const mockPayment: Payment = {
    id: 'pay-1',
    project_id: 'proj-1',
    company_id: 'golden_june',
    amount: 50000,
    payment_date: '2026-10-15',
    payment_mode: 'Bank Transfer',
    receipt_number: 'RCP-001',
    description: 'Booking Advance',
    created_at: '2026-10-15',
  };

  // Order Form Filename with UUID company
  const orderFilename = getOrderFormFilename(mockProject, mockClient, dbCompanies[1]);
  assert(orderFilename.startsWith('GJ-Order_'), 'Order Form filename: prefix is GJ for Golden June UUID', orderFilename.slice(0, 9), 'GJ-Order_');

  const orderFilenameTWB = getOrderFormFilename(mockProject, mockClient, dbCompanies[0]);
  assert(orderFilenameTWB.startsWith('TWB-Order_'), 'Order Form filename: prefix is TWB for TWB UUID', orderFilenameTWB.slice(0, 10), 'TWB-Order_');

  // Payment Receipt Filename with UUID company
  const receiptFilenameGJ = getPaymentReceiptFilename(mockPayment, mockProject, mockClient, dbCompanies[1]);
  assert(receiptFilenameGJ.startsWith('GJ-Receipt_'), 'Payment Receipt filename: prefix is GJ for Golden June', receiptFilenameGJ.slice(0, 11), 'GJ-Receipt_');

  // Quotation PDF Generator execution with officialCompany
  const mockEnquiry: Enquiry = {
    id: 'enq-1001',
    company_id: 'twb',
    client_name: 'Anita',
    partner_name: 'Sunil',
    email: 'anita@example.com',
    phone: '9876543210',
    event_date: '2026-12-20',
    venue: 'Taj Exotica',
    lead_source: 'Instagram',
    requirements: 'Full wedding coverage',
    estimated_budget: 200000,
    status: 'New',
    quotation_status: 'Draft',
    created_at: '2026-10-01',
  };

  const quotationDoc = generateQuotationPDF(mockEnquiry, dbCompanies[0]);
  assert(Boolean(quotationDoc), 'generateQuotationPDF: successfully generates document with shared officialCompany');

  // =========================================================================
  // Suite 6: Two-Brand Settings Legacy Data Sanitization & Migration
  // =========================================================================
  console.log('\n[Suite 6] Settings Legacy Data Sanitization & Migration');

  const staleTwbCache: Company = {
    id: TWB_COMPANY_UUID,
    code: 'twb',
    name: 'TWB (The Wedding Book)',
    tagline: 'Luxury Wedding Cinema',
    email: 'hello@twbfilms.com',
    phone: '+1 (415) 890-2341',
    website: 'twbfilms.com',
    address: 'Studio 402, 180 Townsend St, San Francisco, CA 94107',
    primary_color: '#0f172a',
    accent_color: '#2563eb',
    bank_details: {
      account_name: 'The Wedding Book Media LLC',
      account_number: '9840-2391-4402',
      bank_name: 'Silicon Valley Bank / First Republic',
      routing_code: '121000358',
    },
    terms_conditions: 'Retainer terms test',
  };

  const staleGjCache: Company = {
    id: GJ_COMPANY_UUID,
    code: 'golden_june',
    name: 'Golden June Studios',
    tagline: 'Luxury Wedding Cinema',
    email: 'contact@goldenjunestudios.com',
    phone: '+1 (212) 674-8890',
    website: 'goldenjunestudios.com',
    address: 'Suite 8B, 45 Crosby Street, SoHo, New York, NY 10012',
    primary_color: '#3b2207',
    accent_color: '#d97706',
    bank_details: {
      account_name: 'Golden June Creative Inc.',
      account_number: '4410-8829-1093',
      bank_name: 'Chase Manhattan Commercial',
      routing_code: '021000021',
    },
    terms_conditions: 'GJ terms test',
  };

  const sanitizedTwb = sanitizeCompany(staleTwbCache);
  assert(sanitizedTwb.name === 'The Wedding Booth', 'sanitizeCompany: TWB name sanitized', sanitizedTwb.name, 'The Wedding Booth');
  assert(sanitizedTwb.tagline === 'Wedding Photography & Films', 'sanitizeCompany: TWB tagline sanitized', sanitizedTwb.tagline, 'Wedding Photography & Films');
  assert(sanitizedTwb.email === 'dweddingbooth@gmail.com', 'sanitizeCompany: TWB email sanitized', sanitizedTwb.email, 'dweddingbooth@gmail.com');
  assert(sanitizedTwb.phone === '+91 9074448850', 'sanitizeCompany: TWB phone sanitized', sanitizedTwb.phone, '+91 9074448850');
  assert(sanitizedTwb.website === 'www.theweddingbooth.in', 'sanitizeCompany: TWB website sanitized', sanitizedTwb.website, 'www.theweddingbooth.in');
  assert(sanitizedTwb.address === '', 'sanitizeCompany: TWB address blanked', sanitizedTwb.address, '');
  assert(sanitizedTwb.id === TWB_COMPANY_UUID, 'sanitizeCompany: preserves TWB UUID', sanitizedTwb.id, TWB_COMPANY_UUID);
  assert(sanitizedTwb.bank_details.account_name === 'The Wedding Book Media LLC', 'sanitizeCompany: preserves bank details');
  assert(sanitizedTwb.terms_conditions === 'Retainer terms test', 'sanitizeCompany: preserves terms');

  const sanitizedGj = sanitizeCompany(staleGjCache);
  assert(sanitizedGj.name === 'Golden June Films', 'sanitizeCompany: Golden June name sanitized', sanitizedGj.name, 'Golden June Films');
  assert(sanitizedGj.tagline === 'Wedding Photography & Films', 'sanitizeCompany: Golden June tagline sanitized', sanitizedGj.tagline, 'Wedding Photography & Films');
  assert(sanitizedGj.email === 'goldenjunefilms@gmail.com', 'sanitizeCompany: Golden June email sanitized', sanitizedGj.email, 'goldenjunefilms@gmail.com');
  assert(sanitizedGj.phone === '+91 9074963370', 'sanitizeCompany: Golden June phone sanitized', sanitizedGj.phone, '+91 9074963370');
  assert(sanitizedGj.website === 'www.goldenjunefilms.com', 'sanitizeCompany: Golden June website sanitized', sanitizedGj.website, 'www.goldenjunefilms.com');
  assert(sanitizedGj.address === '', 'sanitizeCompany: Golden June address blanked', sanitizedGj.address, '');
  assert(sanitizedGj.id === GJ_COMPANY_UUID, 'sanitizeCompany: preserves Golden June UUID', sanitizedGj.id, GJ_COMPANY_UUID);

  // resolveCompany cleans stale list
  const staleList = [staleTwbCache, staleGjCache];
  const resolvedFromStaleTwb = resolveCompany(staleList, 'twb');
  assert(resolvedFromStaleTwb?.name === 'The Wedding Booth', 'resolveCompany: cleans stale TWB', resolvedFromStaleTwb?.name, 'The Wedding Booth');
  assert(resolvedFromStaleTwb?.email === 'dweddingbooth@gmail.com', 'resolveCompany: cleans stale TWB email', resolvedFromStaleTwb?.email, 'dweddingbooth@gmail.com');

  const resolvedFromStaleGj = resolveCompany(staleList, 'golden_june');
  assert(resolvedFromStaleGj?.name === 'Golden June Films', 'resolveCompany: cleans stale Golden June', resolvedFromStaleGj?.name, 'Golden June Films');
  assert(resolvedFromStaleGj?.email === 'goldenjunefilms@gmail.com', 'resolveCompany: cleans stale Golden June email', resolvedFromStaleGj?.email, 'goldenjunefilms@gmail.com');

  // =========================================================================
  // Suite 7: Supabase Schema Alignment & Column Preservation
  // =========================================================================
  console.log('\n[Suite 7] Supabase Schema Alignment & Column Preservation');

  const fullTwbCompany: Company = {
    id: TWB_COMPANY_UUID,
    code: 'twb',
    name: 'The Wedding Booth',
    tagline: 'Wedding Photography & Films',
    email: 'dweddingbooth@gmail.com',
    phone: '+91 9074448850',
    website: 'www.theweddingbooth.in',
    address: 'Kerala Studio',
    primary_color: '#0f172a',
    accent_color: '#2563eb',
    bank_details: {
      account_name: 'The Wedding Booth Media',
      account_number: '123456789',
      bank_name: 'HDFC Bank',
      routing_code: 'HDFC0001234',
    },
    terms_conditions: '50% advance upon booking.',
  };

  const payload = extractSupabaseCompanyPayload(fullTwbCompany);

  assert(payload.id === TWB_COMPANY_UUID, 'extractSupabaseCompanyPayload: preserves UUID primary key', payload.id, TWB_COMPANY_UUID);
  assert(payload.code === 'twb', 'extractSupabaseCompanyPayload: contains code', payload.code, 'twb');
  assert(payload.name === 'The Wedding Booth', 'extractSupabaseCompanyPayload: contains name', payload.name, 'The Wedding Booth');

  // Verify non-existent database columns are NOT in the payload
  const payloadKeys = Object.keys(payload);
  assert(!payloadKeys.includes('accent_color'), 'extractSupabaseCompanyPayload: strictly omits "accent_color" column');
  assert(!payloadKeys.includes('primary_color'), 'extractSupabaseCompanyPayload: strictly omits "primary_color" column');
  assert(!payloadKeys.includes('tagline'), 'extractSupabaseCompanyPayload: strictly omits "tagline" column');
  assert(!payloadKeys.includes('email'), 'extractSupabaseCompanyPayload: strictly omits "email" column');
  assert(!payloadKeys.includes('phone'), 'extractSupabaseCompanyPayload: strictly omits "phone" column');
  assert(!payloadKeys.includes('website'), 'extractSupabaseCompanyPayload: strictly omits "website" column');
  assert(!payloadKeys.includes('address'), 'extractSupabaseCompanyPayload: strictly omits "address" column');
  assert(!payloadKeys.includes('bank_details'), 'extractSupabaseCompanyPayload: strictly omits "bank_details" column');
  assert(!payloadKeys.includes('terms_conditions'), 'extractSupabaseCompanyPayload: strictly omits "terms_conditions" column');
  assert(payloadKeys.length === 3, 'extractSupabaseCompanyPayload: contains only the 3 valid table columns', payloadKeys.length, 3);

  // Test merging a minimal database row into a rich frontend model
  const dbRow = {
    id: TWB_COMPANY_UUID,
    code: 'twb',
    name: 'The Wedding Booth Updated',
  };

  const merged = mergeSupabaseCompanyRow(dbRow, fullTwbCompany);
  assert(merged.id === TWB_COMPANY_UUID, 'mergeSupabaseCompanyRow: preserves UUID', merged.id, TWB_COMPANY_UUID);
  assert(merged.name === 'The Wedding Booth Updated', 'mergeSupabaseCompanyRow: updates name from DB', merged.name, 'The Wedding Booth Updated');
  assert(merged.bank_details.account_name === 'The Wedding Booth Media', 'mergeSupabaseCompanyRow: preserves bank details');
  assert(merged.terms_conditions === '50% advance upon booking.', 'mergeSupabaseCompanyRow: preserves terms');
  assert(merged.email === 'dweddingbooth@gmail.com', 'mergeSupabaseCompanyRow: preserves contact email');
  assert(merged.phone === '+91 9074448850', 'mergeSupabaseCompanyRow: preserves studio phone');
  assert(merged.website === 'www.theweddingbooth.in', 'mergeSupabaseCompanyRow: preserves website');

  console.log('\n--- All Two-Brand Settings & PDF Integration Tests Completed ---');
  if (failures > 0) {
    console.error(`Total failures: ${failures}`);
    process.exit(1);
  } else {
    console.log('All tests passed successfully (0 failures).');
    process.exit(0);
  }
}

runTests();
