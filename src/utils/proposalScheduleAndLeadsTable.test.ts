import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateQuotationPDF } from './pdfGenerator';
import {
  formatProposalEventDate,
  getCommissionedEventSchedule,
  formatLeadsTableEventDates,
  parseDateParts,
} from './dateUtils';
import { INITIAL_COMPANIES } from '../services/seedData';
import { Enquiry, Company, Quotation } from '../types';

describe('Proposal Terminology, Event Schedule & Leads Table Suite', () => {
  const mockTWBCompany: Company = INITIAL_COMPANIES[0];
  const mockGJCompany: Company = INITIAL_COMPANIES[1];

  const mockQuotation: Quotation = {
    id: 'quote-test-sch-1',
    proposal_id: 'prop-sch-1',
    enquiry_id: 'enq-sch-100',
    company_id: 'twb',
    quotation_number: 'QT-TWB-2026-0099',
    version: 1,
    status: 'Sent',
    issue_date: '2026-11-05',
    valid_until: '2026-12-05',
    items: [
      {
        id: 'item-1',
        description: 'Principal 4K Wedding Cinematography Coverage',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ],
    subtotal: 250000,
    discount: 10000,
    tax_rate: 0.18,
    tax_amount: 43200,
    total: 283200,
    total_amount: 283200,
    created_at: '2026-11-05T10:00:00Z',
  };

  describe('Part A — Proposal Terminology Replacements', () => {
    const testEnquiry: Enquiry = {
      id: 'enq-term-1',
      company_id: 'twb',
      title: 'Dev & Natasha Wedding',
      client_name: 'Dev Kapoor',
      partner_name: 'Natasha Mehra',
      status: 'Proposal Sent',
      quotation_status: 'Sent',
      created_at: '2026-11-01T10:00:00Z',
    };

    it('uses PROPOSAL instead of PROPOSAL / QUOTATION in PDF', () => {
      const doc = generateQuotationPDF(testEnquiry, mockTWBCompany, mockQuotation);
      const pdfText = doc.output();

      assert.ok(pdfText.includes('PROPOSAL'), 'PDF must include PROPOSAL heading');
      assert.ok(
        !pdfText.includes('PROPOSAL / QUOTATION'),
        'PDF must not include deprecated PROPOSAL / QUOTATION'
      );
    });

    it('uses PACKAGE DETAILS instead of COMMERCIAL INVESTMENT in PDF', () => {
      const doc = generateQuotationPDF(testEnquiry, mockTWBCompany, mockQuotation);
      const pdfText = doc.output();

      assert.ok(pdfText.includes('PACKAGE DETAILS'), 'PDF must include PACKAGE DETAILS');
      assert.ok(
        !pdfText.includes('COMMERCIAL INVESTMENT'),
        'PDF must not include deprecated COMMERCIAL INVESTMENT'
      );
    });

    it('uses TOTAL PACKAGE AMOUNT instead of TOTAL PACKAGE INVESTMENT in PDF', () => {
      const doc = generateQuotationPDF(testEnquiry, mockTWBCompany, mockQuotation);
      const pdfText = doc.output();

      assert.ok(pdfText.includes('TOTAL PACKAGE AMOUNT'), 'PDF must include TOTAL PACKAGE AMOUNT');
      assert.ok(
        !pdfText.includes('TOTAL PACKAGE INVESTMENT'),
        'PDF must not include deprecated TOTAL PACKAGE INVESTMENT'
      );
    });

    it('works identically for Golden June Films brand', () => {
      const docGJ = generateQuotationPDF(
        { ...testEnquiry, company_id: 'golden_june' },
        mockGJCompany,
        mockQuotation
      );
      const pdfGJ = docGJ.output();

      assert.ok(pdfGJ.includes('GOLDEN JUNE FILMS'));
      assert.ok(pdfGJ.includes('PROPOSAL'));
      assert.ok(!pdfGJ.includes('PROPOSAL / QUOTATION'));
      assert.ok(pdfGJ.includes('PACKAGE DETAILS'));
      assert.ok(pdfGJ.includes('TOTAL PACKAGE AMOUNT'));
    });
  });

  describe('Part B — Commissioned Event Schedule in Proposal PDF', () => {
    it('correctly reads all event records, preserving order with non-consecutive dates', () => {
      const enquiryMultiEvent: Enquiry = {
        id: 'enq-multi-1',
        company_id: 'twb',
        title: 'Vikram & Ananya Luxury Wedding',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          {
            id: 'ev-1',
            event_name: 'Engagement',
            event_date: '2026-12-20',
          },
          {
            id: 'ev-2',
            event_name: 'Wedding',
            event_date: '2026-12-22',
          },
        ],
      };

      const schedule = getCommissionedEventSchedule(enquiryMultiEvent);
      assert.strictEqual(schedule.length, 2, 'Must contain exactly 2 events');
      assert.strictEqual(schedule[0].formattedLine, '20 December 2026 — Engagement');
      assert.strictEqual(schedule[1].formattedLine, '22 December 2026 — Wedding');

      // Check PDF output
      const doc = generateQuotationPDF(enquiryMultiEvent, mockTWBCompany, mockQuotation);
      const pdfText = doc.output();

      assert.ok(pdfText.includes('COMMISSIONED EVENT SCHEDULE'), 'Must contain COMMISSIONED EVENT SCHEDULE');
      assert.ok(pdfText.includes('20 December 2026') && pdfText.includes('Engagement'), 'Must contain engagement event');
      assert.ok(pdfText.includes('22 December 2026') && pdfText.includes('Wedding'), 'Must contain wedding event');
    });

    it('supports non-consecutive dates without collapsing into a date range', () => {
      const enquiryNonConsecutive: Enquiry = {
        id: 'enq-nonconsec-1',
        company_id: 'golden_june',
        title: 'Non-Consecutive Celebration',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          {
            id: 'ev-1',
            event_name: 'Civil Ceremony in London',
            event_date: '2026-10-15',
          },
          {
            id: 'ev-2',
            event_name: 'Sangeet & Mehendi Gala',
            event_date: '2026-12-10',
          },
          {
            id: 'ev-3',
            event_name: 'Traditional Wedding Ceremony',
            event_date: '2026-12-12',
          },
        ],
      };

      const schedule = getCommissionedEventSchedule(enquiryNonConsecutive);
      assert.strictEqual(schedule.length, 3);
      assert.strictEqual(schedule[0].formattedLine, '15 October 2026 — Civil Ceremony in London');
      assert.strictEqual(schedule[1].formattedLine, '10 December 2026 — Sangeet & Mehendi Gala');
      assert.strictEqual(schedule[2].formattedLine, '12 December 2026 — Traditional Wedding Ceremony');

      const doc = generateQuotationPDF(enquiryNonConsecutive, mockGJCompany, mockQuotation);
      const pdfText = doc.output();

      assert.ok(pdfText.includes('15 October 2026') && pdfText.includes('Civil Ceremony in London'));
      assert.ok(pdfText.includes('10 December 2026') && pdfText.includes('Sangeet & Mehendi Gala'));
      assert.ok(pdfText.includes('12 December 2026') && pdfText.includes('Traditional Wedding Ceremony'));
    });

    it('displays date without inventing a name when event name is unavailable', () => {
      const enquiryNoEventName: Enquiry = {
        id: 'enq-noname-1',
        company_id: 'twb',
        title: 'Unnamed Event Schedule Lead',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          {
            id: 'ev-1',
            event_name: '', // Empty name
            event_date: '2026-12-20',
          },
          {
            id: 'ev-2',
            event_name: '   ', // Whitespace name
            event_date: '2026-12-22',
          },
        ],
      };

      const schedule = getCommissionedEventSchedule(enquiryNoEventName);
      assert.strictEqual(schedule.length, 2);
      assert.strictEqual(schedule[0].formattedLine, '20 December 2026');
      assert.strictEqual(schedule[1].formattedLine, '22 December 2026');
      assert.ok(!schedule[0].formattedLine.includes('—'), 'Must not include dash if no name');

      const doc = generateQuotationPDF(enquiryNoEventName, mockTWBCompany, mockQuotation);
      const pdfText = doc.output();
      assert.ok(pdfText.includes('20 December 2026'));
      assert.ok(pdfText.includes('22 December 2026'));
    });

    it('falls back to single event_date if events array is not present', () => {
      const enquirySingleDate: Enquiry = {
        id: 'enq-single-1',
        company_id: 'twb',
        title: 'Single Date Lead',
        event_date: '2026-11-28',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
      };

      const schedule = getCommissionedEventSchedule(enquirySingleDate);
      assert.strictEqual(schedule.length, 1);
      assert.strictEqual(schedule[0].formattedLine, '28 November 2026');
    });

    it('handles lead with neither events nor event_date gracefully with Date TBD', () => {
      const enquiryNoDates: Enquiry = {
        id: 'enq-nodate-1',
        company_id: 'twb',
        title: 'Tentative Dates Lead',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
      };

      const schedule = getCommissionedEventSchedule(enquiryNoDates);
      assert.strictEqual(schedule.length, 1);
      assert.strictEqual(schedule[0].formattedLine, 'Date TBD');
    });
  });

  describe('Part C — Leads Table Date Display', () => {
    it('formats two events in the same month as "20 & 22 Dec 2026"', () => {
      const leadTwoEvents: Enquiry = {
        id: 'lead-2ev',
        company_id: 'twb',
        title: 'Two Events Lead',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Cocktail', event_date: '2026-12-20' },
          { event_name: 'Reception', event_date: '2026-12-22' },
        ],
      };

      const result = formatLeadsTableEventDates(leadTwoEvents);
      assert.strictEqual(result.text, '20 & 22 Dec 2026');
      assert.strictEqual(result.isSet, true);
      assert.strictEqual(result.count, 2);
    });

    it('formats three events in the same month as "20, 21 & 22 Dec 2026"', () => {
      const leadThreeEvents: Enquiry = {
        id: 'lead-3ev',
        company_id: 'golden_june',
        title: 'Three Events Lead',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Mehendi', event_date: '2026-12-20' },
          { event_name: 'Sangeet', event_date: '2026-12-21' },
          { event_name: 'Wedding', event_date: '2026-12-22' },
        ],
      };

      const result = formatLeadsTableEventDates(leadThreeEvents);
      assert.strictEqual(result.text, '20, 21 & 22 Dec 2026');
      assert.strictEqual(result.isSet, true);
      assert.strictEqual(result.count, 3);
    });

    it('formats four events correctly with "10, 11, 12 & 13 Nov 2026"', () => {
      const leadFourEvents: Enquiry = {
        id: 'lead-4ev',
        company_id: 'twb',
        title: 'Four Events Lead',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Haldi', event_date: '2026-11-10' },
          { event_name: 'Mehendi', event_date: '2026-11-11' },
          { event_name: 'Sangeet', event_date: '2026-11-12' },
          { event_name: 'Wedding', event_date: '2026-11-13' },
        ],
      };

      const result = formatLeadsTableEventDates(leadFourEvents);
      assert.strictEqual(result.text, '10, 11, 12 & 13 Nov 2026');
      assert.strictEqual(result.count, 4);
    });

    it('formats single event lead as a simple date display', () => {
      const leadSingleEventArray: Enquiry = {
        id: 'lead-1ev-arr',
        company_id: 'twb',
        title: 'Single Event Lead in Events Array',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [{ event_name: 'Wedding', event_date: '2026-12-20' }],
      };

      const result1 = formatLeadsTableEventDates(leadSingleEventArray);
      assert.strictEqual(result1.text, '20 Dec 2026');
      assert.strictEqual(result1.isSet, true);
      assert.strictEqual(result1.count, 1);

      const leadSingleEventField: Enquiry = {
        id: 'lead-1ev-field',
        company_id: 'twb',
        title: 'Single Event Lead via event_date',
        event_date: '2026-12-25',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
      };

      const result2 = formatLeadsTableEventDates(leadSingleEventField);
      assert.strictEqual(result2.text, '25 Dec 2026');
      assert.strictEqual(result2.isSet, true);
      assert.strictEqual(result2.count, 1);
    });

    it('formats two events across different years without error', () => {
      const leadCrossYear: Enquiry = {
        id: 'lead-cross-year',
        company_id: 'twb',
        title: 'Cross Year Wedding Lead',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'New Year Eve Sangeet', event_date: '2026-12-31' },
          { event_name: 'New Year Reception', event_date: '2027-01-02' },
        ],
      };

      const result = formatLeadsTableEventDates(leadCrossYear);
      assert.strictEqual(result.text, '31 Dec 2026 & 2 Jan 2027');
      assert.strictEqual(result.count, 2);
    });

    it('returns "No dates set" when lead has neither events nor event_date', () => {
      const leadNoDates: Enquiry = {
        id: 'lead-nodate',
        company_id: 'twb',
        title: 'No Dates Lead',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
      };

      const result = formatLeadsTableEventDates(leadNoDates);
      assert.strictEqual(result.text, 'No dates set');
      assert.strictEqual(result.isSet, false);
      assert.strictEqual(result.count, 0);
    });
  });

  describe('Part D — Leads Table Column Mapping Audit', () => {
    it('verifies parseDateParts handles various input formats accurately', () => {
      const pIso = parseDateParts('2026-12-20');
      assert.deepStrictEqual(pIso, {
        day: 20,
        monthIdx: 11,
        monthShort: 'Dec',
        monthFull: 'December',
        year: 2026,
      });

      const pDmy = parseDateParts('20-12-2026');
      assert.deepStrictEqual(pDmy, {
        day: 20,
        monthIdx: 11,
        monthShort: 'Dec',
        monthFull: 'December',
        year: 2026,
      });

      const pNull = parseDateParts(null);
      assert.strictEqual(pNull, null);
    });
  });
});
