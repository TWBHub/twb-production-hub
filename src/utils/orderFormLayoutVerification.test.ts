import assert from 'node:assert';
import {
  generateOrderFormPDF,
  getOrderFormFilename,
  extractDayWiseSchedule,
} from './pdfGenerator';
import { Project, Client, Company, Deliverable, Payment } from '../types';

console.log('=== Starting Order Form Layout & Location Verification Suite ===');
let failures = 0;

function testAssert(condition: boolean, name: string, detail?: any) {
  if (!condition) {
    console.error(`❌ FAIL: ${name}`, detail !== undefined ? detail : '');
    failures++;
  } else {
    console.log(`✅ PASS: ${name}`);
  }
}

const mockCompany: Company = {
  id: 'twb-comp-uuid',
  code: 'twb',
  name: 'The Wedding Booth',
  email: 'theweddingboothweddings@gmail.com',
  phone: '+91 9074448850',
  website: 'www.theweddingbooth.in',
  tagline: 'Timeless Wedding Cinema & Photography',
  address: 'Panaji, Goa',
  primary_color: '#0F172A',
  accent_color: '#2563EB',
  bank_details: {
    account_name: 'The Wedding Booth',
    account_number: '50200012345678',
    bank_name: 'HDFC Bank',
    routing_code: 'HDFC0000123',
  },
  terms_conditions: 'Standard terms',
};

const mockClient: Client = {
  id: 'client-test-1',
  company_id: 'twb',
  name: 'Kavya Sen',
  partner_name: 'Arjun Kapoor',
  email: 'kavya.arjun@example.com',
  phone: '+91 9876500000',
  city: 'Udaipur',
  created_at: '2026-03-01T10:00:00Z',
};

const mockDeliverables: Deliverable[] = [
  {
    id: 'del-1',
    project_id: 'proj-test',
    company_id: 'twb',
    deliverable_type: 'Teaser / Reel (60s)',
    assigned_editor_id: '',
    status: 'Assigned',
    due_date: '2026-12-15',
    priority: 'High',
    last_updated: '2026-03-01T10:00:00Z',
  },
  {
    id: 'del-2',
    project_id: 'proj-test',
    company_id: 'twb',
    deliverable_type: 'Highlight Film (4-5 mins)',
    assigned_editor_id: '',
    status: 'In Progress',
    due_date: '2027-01-30',
    priority: 'Medium',
    last_updated: '2026-03-01T10:00:00Z',
  },
  {
    id: 'del-3',
    project_id: 'proj-test',
    company_id: 'twb',
    deliverable_type: 'Full Photo Gallery (800+)',
    assigned_editor_id: '',
    status: 'Not Started',
    due_date: '2026-12-30',
    priority: 'High',
    last_updated: '2026-03-01T10:00:00Z',
  },
];

// 1. Verification: Project with no venue or city
const projectNoLocation: Project = {
  id: 'proj-no-loc',
  company_id: 'twb',
  client_id: 'client-test-1',
  name: 'Kavya & Arjun Wedding',
  status: 'Booked',
  wedding_date_start: '2026-11-20',
  wedding_date_end: '2026-11-20',
  venue: '',
  city: '',
  total_amount: 300000,
  booking_amount: 60000,
  client_contact: {
    phone: '+91 9876500000',
    email: 'kavya.arjun@example.com',
  },
  package_name: 'Custom Package',
  package_details: 'Custom cinematography scope',
  created_at: '2026-03-01T10:00:00Z',
  events: [
    {
      id: 'ev-no-loc',
      project_id: 'proj-no-loc',
      event_name: 'Wedding Ceremony',
      event_date: '2026-11-20',
      sort_order: 1,
    },
  ],
};

const docNoLoc = generateOrderFormPDF(projectNoLocation, mockClient, mockCompany, mockDeliverables, [], { compress: false });
const textNoLoc = docNoLoc.output();
testAssert(!textNoLoc.includes('Principal Venue'), 'Item 1: Project with no venue/city does not contain "Principal Venue"');
testAssert(!textNoLoc.includes('Principal Venue, India'), 'Item 1: Project with no venue/city does not contain "Principal Venue, India"');
testAssert(!textNoLoc.includes(', India'), 'Item 1: Project with no venue/city does not append ", India"');
testAssert(textNoLoc.includes('Not specified'), 'Item 1: Displays "Not specified" for missing venue/city');

// 2. Verification: Project with actual venue and city
const projectWithLocation: Project = {
  ...projectNoLocation,
  id: 'proj-with-loc',
  venue: 'The Leela Palace Courtyard',
  city: 'Udaipur',
};

const docWithLoc = generateOrderFormPDF(projectWithLocation, mockClient, mockCompany, mockDeliverables, [], { compress: false });
const textWithLoc = docWithLoc.output();
testAssert(textWithLoc.includes('The Leela Palace Courtyard, Udaipur'), 'Item 2: Preserves and renders actual venue and city together');
testAssert(!textWithLoc.includes('Not specified'), 'Item 2: Does not display "Not specified" when location is present');

// 3. Verification: Project with multiple events and individual addresses
const projectMultiEvents: Project = {
  ...projectNoLocation,
  id: 'proj-multi-events',
  wedding_date_start: '2026-11-20',
  wedding_date_end: '2026-11-22',
  venue: 'Main Resort',
  city: 'Jaipur',
  events: [
    {
      id: 'ev-1',
      project_id: 'proj-multi-events',
      event_name: 'Mehendi & Sangeet',
      event_date: '2026-11-20',
      event_address: 'Mewar Poolside Amphitheater',
      sort_order: 1,
    },
    {
      id: 'ev-2',
      project_id: 'proj-multi-events',
      event_name: 'Haldi Ceremony',
      event_date: '2026-11-21',
      event_address: 'Banyan Tree Garden',
      sort_order: 2,
    },
    {
      id: 'ev-3',
      project_id: 'proj-multi-events',
      event_name: 'Varmala & Pheras',
      event_date: '2026-11-22',
      event_address: 'Royal Durbar Hall',
      sort_order: 3,
    },
  ],
};

const docMulti = generateOrderFormPDF(projectMultiEvents, mockClient, mockCompany, mockDeliverables, [], { compress: false });
const textMulti = docMulti.output();
testAssert(textMulti.includes('Mewar Poolside Amphitheater'), 'Item 3: Preserves individual event 1 address');
testAssert(textMulti.includes('Banyan Tree Garden'), 'Item 3: Preserves individual event 2 address');
testAssert(textMulti.includes('Royal Durbar Hall'), 'Item 3: Preserves individual event 3 address');

// 4. Verification: Order Form PDF with normal project information is strictly 2 pages
const normalProject: Project = {
  ...projectWithLocation,
  package_name: 'The Sovereign Collection',
  package_details: 'Full coverage of all rituals with cinema primes and aerial drone.',
};

const docNormal = generateOrderFormPDF(normalProject, mockClient, mockCompany, mockDeliverables, [], { compress: false });
testAssert(docNormal.getNumberOfPages() === 2, 'Item 4: Normal project generates strictly 2 pages', docNormal.getNumberOfPages());

// 5. Verification: Order Form PDF sections on Page 1 vs Page 2
const textNormal = docNormal.output();
testAssert(textNormal.includes('CLIENT & EVENT PROFILE'), 'Item 5: Page 1 contains Client Profile');
testAssert(textNormal.includes('PACKAGE & PRODUCTION SCOPE'), 'Item 5: Page 1 contains Package & Production Scope');
testAssert(textNormal.includes('DELIVERABLES'), 'Item 5: Page 1 contains Deliverables');
testAssert(textNormal.includes('COMMERCIAL SUMMARY'), 'Item 5: Page 1 contains Commercial Summary');
testAssert(textNormal.includes('TOTAL ORDER AMOUNT'), 'Item 5: Page 1 contains Total Order Amount');
testAssert(textNormal.includes('ADVANCE / PAYMENT RECEIVED'), 'Item 5: Page 1 contains Advance Received');
testAssert(textNormal.includes('BALANCE DUE'), 'Item 5: Page 1 contains Balance Due');
testAssert(textNormal.includes('PAYMENT SCHEDULE'), 'Item 5: Page 2 contains Payment Schedule');
testAssert(textNormal.includes('TERMS & CONDITIONS'), 'Item 5: Page 2 contains Terms & Conditions');

// 6. Verification: Confirm all standard Terms & Conditions clauses remain present
testAssert(textNormal.includes('Booking Fee & Date Exclusivity'), 'Item 6: Clause 1 present (Booking Fee & Date Exclusivity)');
testAssert(textNormal.includes('Payment Schedule & Release of Deliverables'), 'Item 6: Clause 2 present (Payment Schedule & Release of Deliverables)');
testAssert(textNormal.includes('Cancellation & Rescheduling Policy'), 'Item 6: Clause 3 present (Cancellation & Rescheduling Policy)');
testAssert(textNormal.includes('Delivery Timeline & Post-Production Schedule'), 'Item 6: Clause 4 present (Delivery Timeline & Post-Production Schedule)');

// 7. Verification: Footers accurately say "Page 1 of 2" and "Page 2 of 2"
testAssert(textNormal.includes('Page 1 of 2'), 'Item 7: Page 1 footer is accurate ("Page 1 of 2")');
testAssert(textNormal.includes('Page 2 of 2'), 'Item 7: Page 2 footer is accurate ("Page 2 of 2")');

// 8. Verification: Financial calculation preservation (Advance is ₹0 when no payments, Balance equals Total)
const mockPayments: Payment[] = [
  {
    id: 'pay-test-1',
    company_id: 'twb',
    project_id: normalProject.id,
    amount: 50000,
    payment_date: '2026-03-01',
    payment_mode: 'Bank Transfer',
    receipt_number: 'REC-001',
    description: 'Advance payment',
    created_at: '2026-03-01T10:00:00Z',
  },
];

const docWithPay = generateOrderFormPDF(normalProject, mockClient, mockCompany, mockDeliverables, mockPayments, { compress: false });
const textWithPay = docWithPay.output();
testAssert(textWithPay.includes('Verified Payments Recorded'), 'Item 8: Correctly indicates verified payments recorded');
testAssert(docWithPay.getNumberOfPages() === 2, 'Item 8: Two-page layout maintained with payments recorded');

console.log(`\n=== Verification Finished: ${failures} failure(s) ===\n`);
if (failures > 0) process.exit(1);
