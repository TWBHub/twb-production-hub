import {
  TWB_COMPANY_UUID,
  GJ_COMPANY_UUID,
  resolveCompanyUuid,
  resolveBrandCode,
  isGoldenJune,
  isTWB,
} from './companyUtils';
import { Enquiry, Client, Project } from '../types';

function runLeadConversionTests() {
  console.log('--- Starting Lead-to-Project Conversion Tests ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (!condition) {
      console.error(`FAIL: ${testName} | Expected:`, expected, '| Got:', actual);
      failures++;
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  // 1. UUID Resolution for Brand Codes
  assert(
    resolveCompanyUuid('twb') === TWB_COMPANY_UUID,
    'UUID resolution maps "twb" to TWB PostgreSQL UUID',
    resolveCompanyUuid('twb'),
    TWB_COMPANY_UUID
  );

  assert(
    resolveCompanyUuid('golden_june') === GJ_COMPANY_UUID,
    'UUID resolution maps "golden_june" to Golden June PostgreSQL UUID',
    resolveCompanyUuid('golden_june'),
    GJ_COMPANY_UUID
  );

  assert(
    resolveCompanyUuid(TWB_COMPANY_UUID) === TWB_COMPANY_UUID,
    'UUID resolution preserves existing TWB UUID',
    resolveCompanyUuid(TWB_COMPANY_UUID),
    TWB_COMPANY_UUID
  );

  assert(
    resolveCompanyUuid(GJ_COMPANY_UUID) === GJ_COMPANY_UUID,
    'UUID resolution preserves existing Golden June UUID',
    resolveCompanyUuid(GJ_COMPANY_UUID),
    GJ_COMPANY_UUID
  );

  // 2. Simulated Enquiry conversion data mapping
  const mockTWBLead: Enquiry = {
    id: 'enq-101',
    company_id: 'twb',
    client_name: 'Rahul Sharma',
    partner_name: 'Pooja Verma',
    email: 'rahul.p@gmail.com',
    phone: '+91 9876543210',
    event_date: '2026-12-15',
    venue: 'Taj Lake Palace',
    city: 'Udaipur',
    lead_source: 'Instagram',
    requirements: 'Complete Cinematography & Drone coverage',
    estimated_budget: 350000,
    status: 'Proposal Sent',
    quotation_status: 'Approved',
    created_at: new Date().toISOString(),
  };

  const clientCompanyUuid = resolveCompanyUuid(mockTWBLead.company_id);
  assert(
    clientCompanyUuid === TWB_COMPANY_UUID,
    'Client creation receives UUID foreign key instead of "twb"',
    clientCompanyUuid,
    TWB_COMPANY_UUID
  );

  const mockGJLead: Enquiry = {
    ...mockTWBLead,
    id: 'enq-102',
    company_id: 'golden_june',
  };

  const gjClientCompanyUuid = resolveCompanyUuid(mockGJLead.company_id);
  assert(
    gjClientCompanyUuid === GJ_COMPANY_UUID,
    'Golden June Lead conversion receives GJ UUID foreign key instead of "golden_june"',
    gjClientCompanyUuid,
    GJ_COMPANY_UUID
  );

  // 3. Project payload company resolution
  const projectCompanyUuid = resolveCompanyUuid(mockGJLead.company_id);
  const brandCode = resolveBrandCode(mockGJLead.company_id);
  assert(projectCompanyUuid === GJ_COMPANY_UUID, 'Project company UUID is resolved to GJ UUID');
  assert(brandCode === 'golden_june', 'Brand code is resolved to "golden_june"');

  // 4. Phone normalization and existing client matching
  const normalizePhone = (p?: string | null) => (p || '').replace(/\D/g, '');
  const existingClients: Client[] = [
    {
      id: 'cli-001',
      company_id: TWB_COMPANY_UUID,
      name: 'Rahul Sharma',
      email: 'rahul.p@gmail.com',
      phone: '9876543210', // Without +91
      created_at: new Date().toISOString(),
    },
  ];

  const matched = existingClients.find(c => {
    const enqEmail = mockTWBLead.email?.trim().toLowerCase();
    const cEmail = c.email?.trim().toLowerCase();
    if (enqEmail && cEmail && cEmail === enqEmail) return true;

    const enqPhone = normalizePhone(mockTWBLead.phone);
    const cPhone = normalizePhone(c.phone);
    if (enqPhone && cPhone && enqPhone.length >= 10 && cPhone.slice(-10) === enqPhone.slice(-10)) return true;

    return false;
  });

  assert(Boolean(matched), 'Existing client successfully matched by email / normalized phone');
  assert(matched?.id === 'cli-001', 'Matched client ID preserved to prevent duplicate record');

  console.log(`\n--- Completed Lead Conversion Tests: ${failures} failure(s) ---`);
  if (failures > 0) process.exit(1);
}

runLeadConversionTests();
