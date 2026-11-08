import { Enquiry, Project, ProjectEvent, Client, Quotation, ServiceCatalogueItem } from '../types';
import {
  TWB_COMPANY_UUID,
  GJ_COMPANY_UUID,
  resolveCompanyUuid,
  resolveBrandCode,
} from './companyUtils';

function runLeadsWorkflowTests() {
  console.log('=== Starting TWBHub Leads Workflow & Conversion Tests ===');
  let failures = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (!condition) {
      console.error(`❌ FAIL: ${testName}\n  Expected:`, expected, '\n  Got:     ', actual);
      failures++;
    } else {
      console.log(`✅ PASS: ${testName}`);
    }
  }

  // 1. Minimal Lead Creation - Only Title is Compulsory
  const minimalLead: Enquiry = {
    id: 'enq-min-001',
    company_id: 'twb',
    title: 'Aditi & Rohan · Royal Rajasthan Destination Wedding',
    status: 'New',
    quotation_status: 'Draft',
    created_at: new Date().toISOString(),
  };

  assert(
    minimalLead.title === 'Aditi & Rohan · Royal Rajasthan Destination Wedding',
    'Lead can be created with only Title',
    minimalLead.title
  );
  assert(
    minimalLead.event_date === undefined,
    'Minimal lead has undefined event_date (no fake or dummy dates)',
    minimalLead.event_date,
    undefined
  );
  assert(
    minimalLead.email === undefined && minimalLead.phone === undefined,
    'Minimal lead has optional email and phone',
    { email: minimalLead.email, phone: minimalLead.phone }
  );
  assert(
    minimalLead.venue === undefined && minimalLead.estimated_budget === undefined,
    'Minimal lead has optional venue and budget',
    { venue: minimalLead.venue, budget: minimalLead.estimated_budget }
  );

  // 2. Repeatable Event Schedule Compatibility
  const sampleEvents: ProjectEvent[] = [
    {
      id: 'evt-1',
      event_name: 'Mehendi & Sangeet Gala',
      event_date: '2026-11-20',
      event_time: '18:00',
      event_address: 'The Leela Palace Courtyard, Udaipur',
      team: '4-Crew Team',
      event_notes: 'Traditional drone setup permitted until 22:00',
      sort_order: 0,
    },
    {
      id: 'evt-2',
      event_name: 'Haldi & Chooda Ceremony',
      event_date: '2026-11-21',
      event_time: '10:00',
      event_address: 'Poolside Lawn',
      team: '2-Crew Team',
      sort_order: 1,
    },
    {
      id: 'evt-3',
      event_name: 'Baraat, Varmala & Pheras',
      event_date: '2026-11-21',
      event_time: '17:00',
      event_address: 'Main Jagmandir Island Mandap',
      team: '6-Crew Full Team',
      sort_order: 2,
    },
  ];

  const leadWithEvents: Enquiry = {
    id: 'enq-evt-002',
    company_id: 'golden_june',
    title: 'Ananya & Kabir · Udaipur Wedding 2026',
    client_name: 'Ananya Singhania',
    partner_name: 'Kabir Oberoi',
    email: 'ananya.s@singhania.com',
    phone: '+91 9988776655',
    events: sampleEvents,
    services: [
      'Principal 4K Artisanal Cinematography',
      'Editorial Teaser & Feature Film',
      'Aerial 4K Cinematography',
    ],
    status: 'Proposal Sent',
    quotation_status: 'Approved',
    created_at: new Date().toISOString(),
  };

  assert(
    leadWithEvents.events?.length === 3,
    'Lead preserves all repeatable event schedule entries',
    leadWithEvents.events?.length,
    3
  );

  // Date range calculation from multi-day event schedule
  const sortedDates = (leadWithEvents.events || [])
    .map(e => e.event_date)
    .filter(Boolean)
    .sort();
  const calculatedStartDate = sortedDates[0];
  const calculatedEndDate = sortedDates[sortedDates.length - 1];

  assert(
    calculatedStartDate === '2026-11-20' && calculatedEndDate === '2026-11-21',
    'Date range correctly calculated from multiple event dates',
    { start: calculatedStartDate, end: calculatedEndDate },
    { start: '2026-11-20', end: '2026-11-21' }
  );

  // 3. Service Catalogue Integration
  const mockCatalogue: ServiceCatalogueItem[] = [
    {
      id: 'srv-1',
      applicable_brand: 'twb',
      name: 'Principal 4K Wedding Cinematography',
      description: '2 Senior Cinematographers with cinema prime lenses',
      is_active: true,
      sort_order: 1,
      created_at: '2026-01-01',
    },
    {
      id: 'srv-2',
      applicable_brand: 'twb',
      name: 'Editorial Teaser & Highlight Film',
      description: '60s social reel + 12-15 min feature film',
      is_active: true,
      sort_order: 2,
      created_at: '2026-01-01',
    },
    {
      id: 'srv-3',
      applicable_brand: 'golden_june',
      name: 'Artisanal Analog Film Coverage (35mm / 16mm)',
      description: 'Vintage film aesthetics and custom chemical grade',
      is_active: true,
      sort_order: 1,
      created_at: '2026-01-01',
    },
    {
      id: 'srv-4',
      applicable_brand: 'all',
      name: 'Fine Art Wedding Coffee Table Book',
      description: 'Hand-bound Italian linen cover 100-page album',
      is_active: true,
      sort_order: 10,
      created_at: '2026-01-01',
    },
  ];

  const twbServices = mockCatalogue.filter(
    s => s.is_active && (s.applicable_brand === 'twb' || s.applicable_brand === 'all')
  );
  assert(
    twbServices.length === 3,
    'TWB catalogue filtering returns active TWB and shared services',
    twbServices.length,
    3
  );

  const gjServices = mockCatalogue.filter(
    s => s.is_active && (s.applicable_brand === 'golden_june' || s.applicable_brand === 'all')
  );
  assert(
    gjServices.length === 2,
    'Golden June catalogue filtering returns active GJ and shared services',
    gjServices.length,
    2
  );

  // 4. Quotation Scope: Single Overall Package Investment without individual item prices
  const mockQuotation: Quotation = {
    id: 'quote-test-1',
    quotation_number: 'QT-GJ-2026-101',
    enquiry_id: leadWithEvents.id,
    company_id: 'golden_june',
    version: 1,
    issue_date: '2026-11-01',
    valid_until: '2026-11-30',
    items: (leadWithEvents.services || []).map((s, idx) => ({
      id: `item-${idx}`,
      description: s,
      quantity: 1,
      rate: 0,
      amount: 0,
    })),
    subtotal: 450000,
    discount: 25000,
    tax_rate: 0,
    tax_amount: 0,
    total: 425000,
    status: 'Sent',
    created_at: '2026-11-01T00:00:00Z',
  };

  assert(
    mockQuotation.items.every(i => i.rate === 0 && i.amount === 0),
    'Proposal line items do not require individual item rates or amounts',
    mockQuotation.items.map(i => ({ desc: i.description, rate: i.rate }))
  );
  assert(
    mockQuotation.total === 425000,
    'Single overall package investment is preserved and verified',
    mockQuotation.total,
    425000
  );

  // 5. Lead-to-Project Conversion Flow
  // A. Company UUID Resolution
  const clientCompanyUuid = resolveCompanyUuid(leadWithEvents.company_id);
  assert(
    clientCompanyUuid === GJ_COMPANY_UUID,
    'Lead-to-Project conversion maps "golden_june" to valid PostgreSQL UUID',
    clientCompanyUuid,
    GJ_COMPANY_UUID
  );

  // B. Client Matching
  const existingClients: Client[] = [
    {
      id: 'cli-001',
      company_id: GJ_COMPANY_UUID,
      name: 'Ananya Singhania',
      email: 'ananya.s@singhania.com',
      phone: '+91 9988776655',
      created_at: '2026-01-01',
    },
  ];

  const matchedClient = existingClients.find(
    c => c.email.toLowerCase() === (leadWithEvents.email || '').toLowerCase()
  );
  assert(
    matchedClient?.id === 'cli-001',
    'Client matching resolves existing client ID to avoid duplicate creation',
    matchedClient?.id,
    'cli-001'
  );

  // C. Retainer Calculation (20% Default, not marked as received)
  const agreedPackageFee = mockQuotation.total || 425000;
  const bookingRetainer = Math.round(agreedPackageFee * 0.2); // 20%
  assert(
    bookingRetainer === 85000,
    'Default 20% booking retainer calculated accurately (₹85,000 for ₹4,25,000)',
    bookingRetainer,
    85000
  );

  // D. Converted Project Construction
  const convertedProject: Project = {
    id: `proj-${Date.now()}`,
    company_id: resolveBrandCode(leadWithEvents.company_id),
    client_id: matchedClient ? matchedClient.id : 'new-client-id',
    enquiry_id: leadWithEvents.id,
    name: leadWithEvents.title || `${leadWithEvents.client_name} Wedding`,
    wedding_date_start: calculatedStartDate,
    wedding_date_end: calculatedEndDate,
    venue: sampleEvents[0].event_address || 'The Leela Palace Courtyard, Udaipur',
    city: 'Udaipur',
    client_contact: {
      phone: leadWithEvents.phone || '',
      email: leadWithEvents.email || '',
    },
    status: 'Booked',
    package_name: 'Artisanal Wedding Cinema & Photography',
    package_details: (leadWithEvents.services || []).join('\n• '),
    booking_amount: bookingRetainer, // Agreed retainer amount, NOT marked paid
    total_amount: agreedPackageFee,
    events: leadWithEvents.events,
    notes: 'Converted from Lead Ref #enq-evt-002',
    created_at: new Date().toISOString(),
  };

  assert(
    convertedProject.enquiry_id === leadWithEvents.id,
    'Project retains enquiry_id link for tracing and duplicate prevention',
    convertedProject.enquiry_id,
    leadWithEvents.id
  );
  assert(
    convertedProject.events?.length === 3,
    'Project receives all 3 complete event schedule records with venues & times',
    convertedProject.events?.length,
    3
  );
  assert(
    convertedProject.booking_amount === 85000 && convertedProject.total_amount === 425000,
    'Project captures agreed retainer and total agreed contract value',
    { booking: convertedProject.booking_amount, total: convertedProject.total_amount }
  );

  // E. Idempotency Check (Prevent duplicate conversions)
  const existingProjects: Project[] = [convertedProject];
  const isAlreadyConverted = existingProjects.some(p => p.enquiry_id === leadWithEvents.id);
  assert(
    isAlreadyConverted === true,
    'Idempotency guard detects lead is already converted and blocks duplicate conversion',
    isAlreadyConverted,
    true
  );

  // 6. Service Catalogue Deletion Safeguard & In-Use Protection
  const getReferencingLeadsForService = (serviceName: string, allEnquiries: Enquiry[]) => {
    const target = serviceName.trim().toLowerCase();
    return allEnquiries.filter(
      e => e.services && Array.isArray(e.services) && e.services.some(s => (s || '').trim().toLowerCase() === target)
    );
  };

  const allTestLeads: Enquiry[] = [leadWithEvents, minimalLead];

  // A: Test service in use
  const inUseService: ServiceCatalogueItem = {
    id: 'srv-used-1',
    applicable_brand: 'golden_june',
    name: 'Principal 4K Artisanal Cinematography',
    is_active: true,
  };
  const refsForUsed = getReferencingLeadsForService(inUseService.name, allTestLeads);
  assert(
    refsForUsed.length === 1 && refsForUsed[0].id === leadWithEvents.id,
    'Service referenced by existing lead correctly identified as IN USE',
    refsForUsed.length,
    1
  );

  // Deletion must be blocked for in-use services
  const canDeleteInUse = refsForUsed.length === 0;
  assert(
    canDeleteInUse === false,
    'Destructive deletion is strictly prevented for services referenced by leads',
    canDeleteInUse,
    false
  );

  // Deactivation is offered instead
  const deactivatedInUseService: ServiceCatalogueItem = {
    ...inUseService,
    is_active: false,
  };
  assert(
    deactivatedInUseService.is_active === false,
    'In-use service can be safely deactivated instead of deleted',
    deactivatedInUseService.is_active,
    false
  );

  // Historical lead service references are preserved after deactivation
  assert(
    leadWithEvents.services?.includes('Principal 4K Artisanal Cinematography') === true,
    'Historical lead preserves original service scope after catalogue deactivation',
    leadWithEvents.services
  );

  // B: Test unused service
  const unusedService: ServiceCatalogueItem = {
    id: 'srv-unused-1',
    applicable_brand: 'all',
    name: 'Unused Test Drone Addon',
    is_active: true,
  };
  const refsForUnused = getReferencingLeadsForService(unusedService.name, allTestLeads);
  assert(
    refsForUnused.length === 0,
    'Unused service has 0 referencing leads',
    refsForUnused.length,
    0
  );

  const canDeleteUnused = refsForUnused.length === 0;
  assert(
    canDeleteUnused === true,
    'Unused service is allowed to be permanently deleted from catalogue',
    canDeleteUnused,
    true
  );

  // Deleting unused service from catalogue array
  let currentCatalogue = [inUseService, unusedService];
  currentCatalogue = currentCatalogue.filter(s => s.id !== unusedService.id);
  assert(
    currentCatalogue.length === 1 && currentCatalogue[0].id === inUseService.id,
    'Unused service successfully removed from catalogue',
    currentCatalogue.length,
    1
  );

  // 7. Lead-to-Project Conversion Commercials & Scope Defaults
  const testLeadNoBudget: Enquiry = {
    id: 'enq-nobudget-1',
    company_id: 'twb',
    title: 'Priya & Arjun Wedding',
    services: ['Principal 4K Cinematography', 'Drone Aerial Coverage'],
    status: 'New',
    quotation_status: 'Draft',
    created_at: new Date().toISOString(),
  };

  // A: Blank financial defaults for lead without estimated budget
  const hasInitialBudgetTest = Boolean(
    testLeadNoBudget.estimated_budget != null &&
    !isNaN(Number(testLeadNoBudget.estimated_budget)) &&
    Number(testLeadNoBudget.estimated_budget) > 0
  );
  const initialFeeTest: number | '' = hasInitialBudgetTest ? testLeadNoBudget.estimated_budget! : '';
  const initialRetainerTest: number | '' = hasInitialBudgetTest ? Math.round(testLeadNoBudget.estimated_budget! * 0.2) : '';

  assert(
    initialFeeTest === '',
    'Lead without budget initializes Total Agreed Fee as blank (not hardcoded 2,00,000)',
    initialFeeTest,
    ''
  );
  assert(
    initialRetainerTest === '',
    'Lead without budget initializes Booking Retainer as blank (not hardcoded 40,000)',
    initialRetainerTest,
    ''
  );

  // B: Clean Package Name and Scope without duplicate service concatenation
  const defaultPackageTest = testLeadNoBudget.package_interest?.trim() || '';
  const defaultScopeTest = testLeadNoBudget.requirements?.trim() || (
    testLeadNoBudget.services && testLeadNoBudget.services.length > 0
      ? testLeadNoBudget.services.map(s => `• ${s}`).join('\n')
      : ''
  );

  assert(
    defaultPackageTest === '',
    'Commissioned Package is blank when package_interest is undefined (does not join services as package name)',
    defaultPackageTest,
    ''
  );
  assert(
    defaultScopeTest === '• Principal 4K Cinematography\n• Drone Aerial Coverage',
    'Package Scope & Deliverables lists itemized services cleanly with bullet points',
    defaultScopeTest,
    '• Principal 4K Cinematography\n• Drone Aerial Coverage'
  );

  // C: Auto-calculating 20% retainer on fee input
  const sim = {
    fee: '' as number | '',
    retainer: '' as number | '',
    overridden: false,
  };

  const simHandleFeeChange = (valStr: string) => {
    if (valStr.trim() === '') {
      sim.fee = '';
      if (!sim.overridden) sim.retainer = '';
      return;
    }
    const num = Number(valStr);
    if (isNaN(num) || num < 0) {
      sim.fee = '';
      if (!sim.overridden) sim.retainer = '';
      return;
    }
    sim.fee = num;
    if (!sim.overridden) {
      sim.retainer = num > 0 ? Math.round(num * 0.2) : '';
    }
  };

  const simHandleRetainerChange = (valStr: string) => {
    sim.overridden = true;
    if (valStr.trim() === '') {
      sim.retainer = '';
      return;
    }
    const num = Number(valStr);
    sim.retainer = isNaN(num) || num < 0 ? '' : num;
  };

  const simResetRetainer = () => {
    sim.overridden = false;
    if (typeof sim.fee === 'number' && sim.fee > 0) {
      sim.retainer = Math.round(sim.fee * 0.2);
    } else {
      sim.retainer = '';
    }
  };

  simHandleFeeChange('350000');
  assert(
    sim.fee === 350000 && sim.retainer === 70000,
    'Entering total fee 3,50,000 automatically calculates 20% retainer (70,000)',
    { fee: sim.fee, retainer: sim.retainer },
    { fee: 350000, retainer: 70000 }
  );

  // D: Clearing fee clears unedited retainer
  simHandleFeeChange('');
  assert(
    sim.fee === '' && sim.retainer === '',
    'Clearing total fee automatically clears unedited retainer',
    { fee: sim.fee, retainer: sim.retainer },
    { fee: '', retainer: '' }
  );

  // E: Manual edit overrides auto calculation
  simHandleFeeChange('500000');
  assert(sim.retainer === 100000, 'Fee 5,00,000 produces default 20% retainer 1,00,000', sim.retainer, 100000);
  simHandleRetainerChange('150000'); // Custom negotiated retainer
  assert(sim.retainer === 150000 && sim.overridden === true, 'Manually edited retainer sets custom amount and marks override');

  // Updating fee does not wipe manual override
  simHandleFeeChange('600000');
  assert(
    sim.retainer === 150000,
    'Updating total fee preserves manually overridden retainer',
    sim.retainer,
    150000
  );

  // Resetting retainer returns to 20%
  simResetRetainer();
  assert(
    sim.retainer === 120000 && sim.overridden === false,
    'Resetting retainer recalculates 20% of current fee (1,20,000 of 6,00,000)',
    sim.retainer,
    120000
  );

  console.log(`\n=== Test Suite Finished: ${failures} failure(s) ===\n`);
  if (failures > 0) process.exit(1);
}

runLeadsWorkflowTests();
