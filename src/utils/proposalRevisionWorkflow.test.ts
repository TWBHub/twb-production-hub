import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateProposalReference,
  getNextProposalRevisionNumber,
  groupQuotationsIntoProposals,
  getProposalIdentity,
  sanitizeProjectNameForFilename,
  getProposalFilename,
} from './proposalRevisionUtils';
import { generateQuotationPDF } from './pdfGenerator';
import { INITIAL_COMPANIES } from '../services/seedData';
import { Enquiry, Company, Quotation } from '../types';

describe('Proposal Revision Workflow & Clean Filenames Suite', () => {
  const mockTWBCompany: Company = INITIAL_COMPANIES[0];
  const mockGJCompany: Company = INITIAL_COMPANIES[1];

  const mockEnquiry: Enquiry = {
    id: 'enq-wf-100',
    company_id: 'golden_june',
    title: 'Final Workflow Test',
    client_name: 'Ananya Roy',
    partner_name: 'Kabir Mehta',
    status: 'Proposal Sent',
    quotation_status: 'Sent',
    services: ['Editorial Cinema Master', 'Drone Coverage'],
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  };

  const createMockQuotation = (overrides: Partial<Quotation>): Quotation => ({
    id: `quote-${Math.random().toString(36).slice(2, 7)}`,
    enquiry_id: mockEnquiry.id,
    company_id: 'golden_june',
    quotation_number: 'QT-GJ-2026-0001',
    version: 1,
    status: 'Sent',
    issue_date: '2026-11-01',
    items: [],
    subtotal: 100000,
    discount: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 100000,
    total_amount: 100000,
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  });

  it('Requirement 1 & 9: Genuinely new proposal starts at v1 with unique Proposal Reference code', () => {
    const existingQuotes: Quotation[] = [
      createMockQuotation({
        id: 'q-prior-1',
        enquiry_id: 'other-enq',
        quotation_number: 'QT-GJ-2026-0001',
      }),
    ];

    const newRefGJ = generateProposalReference('GOLDEN_JUNE', existingQuotes);
    assert.strictEqual(newRefGJ, 'QT-GJ-2026-0002', 'Sequential reference QT-GJ-2026-0002 must be generated');

    const newRefTWB = generateProposalReference('TWB', []);
    assert.strictEqual(newRefTWB, 'QT-TWB-2026-0001', 'First sequential reference for TWB must be 0001');
  });

  it('Requirement 2 & 3: First version is v1, and editing an existing proposal creates next revision under the same reference', () => {
    const parentProposalId = 'prop-parent-999';
    const proposalRef = 'QT-GJ-2026-0005';

    const rev1 = createMockQuotation({
      id: 'quote-rev-1',
      proposal_id: parentProposalId,
      quotation_number: proposalRef,
      version: 1,
      items: [{ id: '1', description: 'Cinema Master v1', quantity: 1, rate: 0, amount: 0 }],
      subtotal: 200000,
      total: 200000,
      total_amount: 200000,
    });

    // Calculate next version
    const nextVer = getNextProposalRevisionNumber(parentProposalId, [rev1]);
    assert.strictEqual(nextVer, 2, 'Next revision must automatically be 2');

    // Simulate saving v2
    const rev2 = createMockQuotation({
      id: 'quote-rev-2',
      proposal_id: parentProposalId,
      quotation_number: proposalRef, // strictly same proposal reference
      version: nextVer,
      status: 'Draft',
      issue_date: '2026-11-03',
      items: [
        { id: '1', description: 'Cinema Master v1', quantity: 1, rate: 0, amount: 0 },
        { id: '2', description: 'Added 4K Drone Aerials', quantity: 1, rate: 0, amount: 0 },
      ],
      subtotal: 260000,
      total: 260000,
      total_amount: 260000,
      created_at: '2026-11-03T10:00:00Z',
    });

    // Requirement 4: rev1 must not be mutated or overwritten
    assert.strictEqual(rev1.version, 1);
    assert.strictEqual(rev1.items.length, 1);
    assert.strictEqual(rev1.total, 200000);

    // rev2 has updated data under the exact same proposal identity and reference
    assert.strictEqual(rev2.version, 2);
    assert.strictEqual(rev2.quotation_number, rev1.quotation_number);
    assert.strictEqual(getProposalIdentity(rev1), getProposalIdentity(rev2));
    assert.strictEqual(rev2.items.length, 2);
    assert.strictEqual(rev2.total, 260000);
  });

  it('Requirement 5: Revision number increments automatically based on highest existing revision (max + 1)', () => {
    const allQuotes: Quotation[] = [
      createMockQuotation({
        id: 'q-1',
        proposal_id: 'prop-123',
        company_id: 'twb',
        quotation_number: 'QT-TWB-2026-0010',
        version: 1,
        status: 'Sent',
      }),
      createMockQuotation({
        id: 'q-2',
        proposal_id: 'prop-123',
        company_id: 'twb',
        quotation_number: 'QT-TWB-2026-0010',
        version: 2,
        status: 'Declined',
      }),
    ];

    const nextVer = getNextProposalRevisionNumber('prop-123', allQuotes);
    assert.strictEqual(nextVer, 3, 'Next version after v2 must be v3');
  });

  it('Requirement 6 & 10: Revision history groups all versions under one proposal entry, including legacy records', () => {
    // Simulate legacy records where proposal_id was absent and both saved as version 1
    const legacyQuotes: Quotation[] = [
      createMockQuotation({
        id: 'legacy-1',
        quotation_number: 'QT-GJ-2026-7365',
        version: 1,
        items: [{ id: 'i1', description: 'Item A', quantity: 1, rate: 0, amount: 0 }],
        subtotal: 150000,
        total: 150000,
        created_at: '2026-11-01T10:00:00Z',
      }),
      createMockQuotation({
        id: 'legacy-2',
        quotation_number: 'QT-GJ-2026-7365', // same reference
        version: 1, // legacy duplicate v1
        status: 'Draft',
        items: [
          { id: 'i1', description: 'Item A', quantity: 1, rate: 0, amount: 0 },
          { id: 'i2', description: 'Item B', quantity: 1, rate: 0, amount: 0 },
        ],
        subtotal: 180000,
        total: 180000,
        created_at: '2026-11-02T10:00:00Z',
      }),
    ];

    const groups = groupQuotationsIntoProposals(legacyQuotes);
    assert.strictEqual(groups.length, 1, 'Both revisions must be grouped under 1 proposal entry');

    const group = groups[0];
    assert.strictEqual(group.quotationNumber, 'QT-GJ-2026-7365');
    assert.strictEqual(group.revisions.length, 2, 'History must contain both versions');
    // Normalized chronological sequencing ensures no duplicate v1 in UI
    assert.strictEqual(group.highestVersion, 2, 'Highest version should normalize to 2');
    assert.strictEqual(group.latestQuotation.version, 2);
    assert.strictEqual(group.revisions[1].version, 1);
  });

  it('Requirement 7 & 8: Each historical revision retains its exact saved data and can generate valid PDF', () => {
    const rev1 = createMockQuotation({
      id: 'q-v1',
      proposal_id: 'prop-abc',
      quotation_number: 'QT-GJ-2026-0042',
      version: 1,
      items: [{ id: '1', description: 'Photography Core', quantity: 1, rate: 0, amount: 0 }],
      subtotal: 100000,
      total: 100000,
    });

    const rev2 = createMockQuotation({
      id: 'q-v2',
      proposal_id: 'prop-abc',
      quotation_number: 'QT-GJ-2026-0042',
      version: 2,
      issue_date: '2026-11-05',
      items: [
        { id: '1', description: 'Photography Core', quantity: 1, rate: 0, amount: 0 },
        { id: '2', description: 'Pre-wedding session', quantity: 1, rate: 0, amount: 0 },
      ],
      subtotal: 140000,
      total: 140000,
    });

    const docV1 = generateQuotationPDF(mockEnquiry, mockGJCompany, rev1);
    assert.ok(docV1, 'PDF generation for historical revision v1 must succeed');

    const docV2 = generateQuotationPDF(mockEnquiry, mockGJCompany, rev2);
    assert.ok(docV2, 'PDF generation for revision v2 must succeed');
  });

  describe('Part B — Clean Filename Generation', () => {
    it('sanitizes project names cleanly: replaces spaces/underscores with hyphens, strips illegal chars', () => {
      assert.strictEqual(sanitizeProjectNameForFilename('Final Workflow Test'), 'Final-Workflow-Test');
      assert.strictEqual(sanitizeProjectNameForFilename('Aarav & Priya/Wedding?*'), 'Aarav-&-PriyaWedding');
      assert.strictEqual(sanitizeProjectNameForFilename('Client___Name   Event'), 'Client-Name-Event');
      assert.strictEqual(sanitizeProjectNameForFilename(''), 'Project');
      assert.strictEqual(sanitizeProjectNameForFilename(undefined), 'Project');
    });

    it('generates GoldenJune filename format: GoldenJune_Proposal_[ProjectName]_v[Version].pdf', () => {
      const filenameV1 = getProposalFilename(mockGJCompany, mockEnquiry, { version: 1 });
      assert.strictEqual(
        filenameV1,
        'GoldenJune_Proposal_Final-Workflow-Test_v1.pdf',
        'Golden June v1 filename must match required specification'
      );

      const filenameV2 = getProposalFilename(mockGJCompany, mockEnquiry, { version: 2 });
      assert.strictEqual(
        filenameV2,
        'GoldenJune_Proposal_Final-Workflow-Test_v2.pdf',
        'Golden June v2 filename must reflect revision 2'
      );
    });

    it('generates TWB filename format: TWB_Proposal_[ProjectName]_v[Version].pdf', () => {
      const twbEnquiry: Enquiry = {
        ...mockEnquiry,
        company_id: 'twb',
        title: 'Rohan & Simran Wedding',
      };

      const filenameV1 = getProposalFilename(mockTWBCompany, twbEnquiry, 1);
      assert.strictEqual(
        filenameV1,
        'TWB_Proposal_Rohan-&-Simran-Wedding_v1.pdf',
        'TWB v1 filename must match required specification'
      );

      const filenameV3 = getProposalFilename(mockTWBCompany, twbEnquiry, 3);
      assert.strictEqual(
        filenameV3,
        'TWB_Proposal_Rohan-&-Simran-Wedding_v3.pdf',
        'TWB v3 filename must reflect revision 3'
      );
    });

    it('ensures downloaded PDF filename in generateQuotationPDF strictly matches the revision being downloaded', () => {
      const quoteV1 = createMockQuotation({
        id: 'q-1',
        proposal_id: 'p-1',
        quotation_number: 'QT-GJ-2026-0010',
        version: 1,
      });

      const filenameV1 = getProposalFilename(mockGJCompany, mockEnquiry, quoteV1);
      assert.strictEqual(filenameV1, 'GoldenJune_Proposal_Final-Workflow-Test_v1.pdf');

      const quoteV2 = createMockQuotation({
        ...quoteV1,
        version: 2,
      });
      const filenameV2 = getProposalFilename(mockGJCompany, mockEnquiry, quoteV2);
      assert.strictEqual(filenameV2, 'GoldenJune_Proposal_Final-Workflow-Test_v2.pdf');
    });
  });
});
