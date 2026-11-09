import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateQuotationPDF } from './pdfGenerator';
import { INITIAL_COMPANIES } from '../services/seedData';
import { Enquiry, Company, Quotation } from '../types';

describe('Proposal PDF Correction and Redesign Suite', () => {
  const mockTWBCompany: Company = INITIAL_COMPANIES[0];
  const mockGJCompany: Company = INITIAL_COMPANIES[1];

  const mockEnquiryMinimal: Enquiry = {
    id: 'enq-proposal-101',
    company_id: 'twb',
    title: 'Aarav & Priya — Royal Wedding Celebration',
    client_name: 'Aarav Patel',
    partner_name: 'Priya Sharma',
    phone: '+91 98765 43210',
    email: 'aarav.priya@example.com',
    status: 'Proposal Sent',
    quotation_status: 'Sent',
    lead_source: 'Website',
    services: [
      'Principal 4K Wedding Cinematography (2 Senior Cinematographers)',
      'Editorial Teaser (60s Reel) + Highlight Feature Film',
      'Drone Aerial Cinematic Coverage',
    ],
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  };

  const mockQuotation: Quotation = {
    id: 'quote-test-1',
    enquiry_id: mockEnquiryMinimal.id,
    company_id: 'twb',
    quotation_number: 'QT-TWB-2026-1101',
    version: 1,
    status: 'Sent',
    issue_date: '2026-11-02',
    valid_until: '2026-12-02',
    items: [
      {
        id: 'item-1',
        description: 'Principal 4K Wedding Cinematography (2 Senior Cinematographers)',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
      {
        id: 'item-2',
        description: 'Editorial Teaser (60s Reel) + Highlight Feature Film Master',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ],
    subtotal: 350000,
    discount: 25000,
    tax_rate: 0.18,
    tax_amount: 58500,
    total: 383500,
    notes: 'Cloud master delivered in 4K ProRes. Travel to be arranged by host.',
    payment_terms: '20% booking retainer reserves crew allocation. 50% due 15 days before main event.',
    created_at: '2026-11-02T10:00:00Z',
    updated_at: '2026-11-02T10:00:00Z',
  };

  it('1. Seed company data has genuinely empty bank details (no fabricated accounts)', () => {
    INITIAL_COMPANIES.forEach(comp => {
      const bank = comp.bank_details;
      if (bank) {
        assert.ok(!bank.bank_name?.includes('Chase'), 'Must not contain Chase');
        assert.ok(!bank.bank_name?.includes('Silicon Valley'), 'Must not contain Silicon Valley Bank');
        assert.ok(!bank.account_number?.includes('4410-8829'), 'Must not contain fake account 4410-8829');
        assert.ok(!bank.account_number?.includes('9840-2391'), 'Must not contain fake account 9840-2391');
        assert.ok(!bank.routing_code?.includes('021000021'), 'Must not contain routing code 021000021');
        assert.ok(!bank.routing_code?.includes('121000358'), 'Must not contain routing code 121000358');
      }
    });
  });

  it('2. Proposal PDF contains no fabricated bank details or remittance block', () => {
    const doc = generateQuotationPDF(mockEnquiryMinimal, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    // Verify completely free of fabricated accounts
    assert.ok(!pdfOutput.includes('Chase Manhattan'), 'Must not contain Chase Manhattan');
    assert.ok(!pdfOutput.includes('4410-8829'), 'Must not contain fake account 4410-8829');
    assert.ok(!pdfOutput.includes('021000021'), 'Must not contain fake IFSC/routing code 021000021');
    assert.ok(!pdfOutput.includes('Silicon Valley Bank'), 'Must not contain Silicon Valley Bank');

    // Verify bank remittance section is completely omitted
    assert.ok(!pdfOutput.includes('WIRE / BANK TRANSFER INFORMATION'), 'Must omit wire/bank transfer heading');
    assert.ok(!pdfOutput.includes('PAYMENT & REMITTANCE INSTRUCTIONS'), 'Must omit payment remittance heading');
    assert.ok(!pdfOutput.includes('Bank Transfer Remittance'), 'Must omit Bank Transfer Remittance');
  });

  it('3. Proposal PDF matches Order Form visual identity and section hierarchy', () => {
    const doc = generateQuotationPDF(mockEnquiryMinimal, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    // Document header
    assert.ok(pdfOutput.includes('THE WEDDING BOOTH'), 'Header contains uppercase brand display name');
    assert.ok(pdfOutput.includes('PROPOSAL'), 'Document title PROPOSAL is present');
    assert.ok(pdfOutput.includes('QT-TWB-2026-1101'), 'Quotation reference number is present');

    // Section headings matching Order Form style
    assert.ok(pdfOutput.includes('CLIENT & EVENT PROFILE'), 'Section 1 CLIENT & EVENT PROFILE is present');
    assert.ok(pdfOutput.includes('COMMISSIONED SERVICES & PRODUCTION SCOPE'), 'Section 2 COMMISSIONED SERVICES & PRODUCTION SCOPE is present');
    assert.ok(pdfOutput.includes('PACKAGE DETAILS'), 'Section 3 PACKAGE DETAILS is present');
    assert.ok(pdfOutput.includes('TOTAL PACKAGE AMOUNT'), 'TOTAL PACKAGE AMOUNT heading is present');
    assert.ok(pdfOutput.includes('SCOPE & PRODUCTION NOTES'), 'Section 4 SCOPE & PRODUCTION NOTES is present');
    assert.ok(pdfOutput.includes('TERMS & CONDITIONS'), 'Section 5 TERMS & CONDITIONS is present');
  });

  it('4. Proposal PDF correctly handles missing location without inserting placeholders', () => {
    const enquiryNoLocation: Enquiry = {
      ...mockEnquiryMinimal,
      venue: undefined,
      city: undefined,
    };

    const doc = generateQuotationPDF(enquiryNoLocation, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    assert.ok(!pdfOutput.includes('Principal Venue'), 'Must never insert "Principal Venue" as location');
    assert.ok(!pdfOutput.includes('Principal Venue, India'), 'Must never insert "Principal Venue, India"');
    assert.ok(!pdfOutput.includes(', India'), 'Must not append ", India" without user input');
    assert.ok(pdfOutput.includes('Not specified'), 'Displays clean "Not specified" for missing venue/city');
  });

  it('5. Proposal PDF preserves valid location when entered', () => {
    const enquiryWithLocation: Enquiry = {
      ...mockEnquiryMinimal,
      venue: 'The Leela Palace',
      city: 'Udaipur',
    };

    const doc = generateQuotationPDF(enquiryWithLocation, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    assert.ok(pdfOutput.includes('The Leela Palace, Udaipur'), 'Renders entered venue and city');
    assert.ok(!pdfOutput.includes('Not specified'), 'Does not display "Not specified" when location exists');
  });

  it('6. Proposal PDF preserves financial breakdown and single package investment', () => {
    const doc = generateQuotationPDF(mockEnquiryMinimal, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    // Financial lines
    assert.ok(pdfOutput.includes('Package Subtotal:'), 'Contains subtotal line');
    assert.ok(pdfOutput.includes('Special Discount'), 'Contains discount line');
    assert.ok(pdfOutput.includes('GST / Tax'), 'Contains GST tax line');
    assert.ok(pdfOutput.includes('TOTAL PACKAGE AMOUNT'), 'Contains prominent TOTAL PACKAGE AMOUNT');
  });

  it('7. Proposal PDF works identically for Golden June brand', () => {
    const docGJ = generateQuotationPDF(
      {
        ...mockEnquiryMinimal,
        company_id: 'golden_june',
      },
      mockGJCompany,
      mockQuotation
    );
    const pdfGJOutput = docGJ.output();

    assert.ok(pdfGJOutput.includes('GOLDEN JUNE FILMS'), 'Contains Golden June brand header');
    assert.ok(pdfGJOutput.includes('PROPOSAL'), 'Contains proposal title');
    assert.ok(!pdfGJOutput.includes('Chase'), 'GJ proposal has no Chase details');
    assert.ok(!pdfGJOutput.includes('Silicon Valley'), 'GJ proposal has no Silicon Valley details');
  });

  it('8. Page numbering footer is accurate and clean', () => {
    const doc = generateQuotationPDF(mockEnquiryMinimal, mockTWBCompany, mockQuotation);
    const pdfOutput = doc.output();

    assert.ok(pdfOutput.includes('Page 1 of 1'), 'Single page proposal contains Page 1 of 1');
    assert.ok(pdfOutput.includes('Wedding Photography & Films'), 'Footer contains official tagline');
  });

  it('9. Safe download helper attaches originalSave and filename', () => {
    const doc = generateQuotationPDF(mockEnquiryMinimal, mockTWBCompany, mockQuotation);
    assert.strictEqual(typeof (doc as any).__originalSave, 'function', '__originalSave is attached');
    assert.strictEqual(typeof (doc as any).save, 'function', 'save is attached');
    assert.ok((doc as any).filename.endsWith('.pdf'), 'filename is properly set');
  });
});
