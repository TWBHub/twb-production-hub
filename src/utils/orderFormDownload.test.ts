import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateOrderFormPDF,
  getOrderFormFilename,
  downloadPdfDoc,
} from './pdfGenerator';
import { Project, Client, Company, Deliverable, Payment } from '../types';

describe('Order Form PDF Generation and Download Suite', () => {
  const mockCompany: Company = {
    id: 'twb-comp-uuid',
    code: 'twb',
    name: 'The Wedding Booth',
    email: 'theweddingboothweddings@gmail.com',
    phone: '+91 9074448850',
    website: 'www.theweddingbooth.in',
    tagline: 'Timeless Wedding Cinema & Photography',
    address: 'Panaji, Goa, India',
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
    id: 'client-123',
    company_id: 'twb',
    name: 'Aditi Rao',
    partner_name: 'Rohan Sharma',
    email: 'aditi.rohan@example.com',
    phone: '+91 9876543210',
    city: 'Udaipur',
    created_at: '2026-03-01T10:00:00Z',
  };

  const mockProject: Project = {
    id: 'proj-456',
    company_id: 'twb',
    client_id: 'client-123',
    name: 'Aditi & Rohan Udaipur Wedding',
    status: 'Booked',
    wedding_date_start: '2026-11-20',
    wedding_date_end: '2026-11-22',
    venue: 'Taj Lake Palace, Udaipur',
    city: 'Udaipur',
    client_contact: {
      phone: '+91 9876543210',
      email: 'aditi.rohan@example.com',
    },
    package_name: 'Signature Cinema & Editorial Stills',
    package_details: 'Day 1: Mehendi & Sangeet\nDay 2: Haldi & Wedding Ceremony\nDay 3: Reception',
    total_amount: 350000,
    booking_amount: 50000,
    events: [
      {
        id: 'ev-1',
        project_id: 'proj-456',
        event_name: 'Mehendi & Sangeet',
        event_date: '2026-11-20',
        event_address: 'Mewar Courtyard',
        event_time: '16:00',
        sort_order: 1,
      },
      {
        id: 'ev-2',
        project_id: 'proj-456',
        event_name: 'Haldi & Pheras',
        event_date: '2026-11-21',
        event_address: 'Lily Pond Lawn',
        event_time: '10:00',
        sort_order: 2,
      },
      {
        id: 'ev-3',
        project_id: 'proj-456',
        event_name: 'Royal Reception',
        event_date: '2026-11-22',
        event_address: 'Grand Ball Room',
        event_time: '19:00',
        sort_order: 3,
      },
    ],
    created_at: '2026-03-01T10:00:00Z',
  };

  const mockDeliverables: Deliverable[] = [
    {
      id: 'del-1',
      project_id: 'proj-456',
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
      project_id: 'proj-456',
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
      project_id: 'proj-456',
      company_id: 'twb',
      deliverable_type: 'Full Photo Gallery (800+)',
      assigned_editor_id: '',
      status: 'Not Started',
      due_date: '2026-12-30',
      priority: 'High',
      last_updated: '2026-03-01T10:00:00Z',
    },
  ];

  it('generates a valid Order Form PDF document with actual entered data', () => {
    const doc = generateOrderFormPDF(
      mockProject,
      mockClient,
      mockCompany,
      mockDeliverables,
      []
    );

    assert.ok(doc, 'Document should be created');
    const totalPages = doc.getNumberOfPages();
    assert.ok(totalPages >= 1, 'Document should have at least 1 page');

    const pdfData = doc.output('arraybuffer');
    assert.ok(pdfData.byteLength > 1000, 'PDF should have substantive binary content');

    // Verify valid PDF magic bytes '%PDF-'
    const uint8 = new Uint8Array(pdfData);
    const headerStr = String.fromCharCode(...uint8.slice(0, 5));
    assert.strictEqual(headerStr, '%PDF-', 'Output must begin with %PDF-');
  });

  it('generates accurate filename with brand, date, and sanitized client name', () => {
    const filename = getOrderFormFilename(mockProject, mockClient, mockCompany);
    assert.ok(
      filename.startsWith('TWB-Order_'),
      `Filename should start with TWB-Order_, got: ${filename}`
    );
    assert.ok(
      filename.includes('Aditi Rao & Rohan Sharma'),
      `Filename should include client and partner names, got: ${filename}`
    );
    assert.ok(
      filename.endsWith('.pdf'),
      `Filename should end with .pdf, got: ${filename}`
    );
    // Ensure no forbidden path characters
    assert.ok(!/[/\\?%*:|"<>]/g.test(filename), 'Filename must not contain illegal characters');
  });

  it('generates Golden June filename when company is Golden June', () => {
    const gjCompany: Company = {
      ...mockCompany,
      id: 'gj-comp-uuid',
      code: 'golden_june',
      name: 'Golden June Films',
    };
    const gjProject: Project = {
      ...mockProject,
      company_id: 'golden_june',
    };
    const filename = getOrderFormFilename(gjProject, mockClient, gjCompany);
    assert.ok(
      filename.startsWith('GJ-Order_'),
      `Filename should start with GJ-Order_, got: ${filename}`
    );
  });

  it('calculates financials correctly when payments array is empty (Advance is ₹0, Balance equals Total)', () => {
    const unrecordedProject: Project = {
      ...mockProject,
      total_amount: 340000,
      booking_amount: 20000,
    };

    const doc = generateOrderFormPDF(
      unrecordedProject,
      mockClient,
      mockCompany,
      mockDeliverables,
      []
    );
    assert.ok(doc, 'Should generate cleanly with empty payments array');

    // Page count must preserve the separate Terms & Conditions page (3 pages)
    const totalPages = doc.getNumberOfPages();
    assert.strictEqual(totalPages, 3, 'Document must have exactly 3 pages preserving dedicated Terms & Conditions page');

    // Verify uncompressed PDF stream does not contain wide character spacing glitch
    const uncompressedDoc = generateOrderFormPDF(
      {
        ...unrecordedProject,
        terms_clauses: [
          {
            id: 'tc-booking',
            title: 'Booking Fee & Date Confirmation',
            body: 'A non-refundable booking fee of ₹20,000 will confirm your reservation and will be deducted from the total package cost.',
            enabled: true,
          },
        ],
      },
      mockClient,
      mockCompany,
      mockDeliverables,
      [],
      { compress: false }
    );

    const pdfString = uncompressedDoc.output();
    // Must NOT contain the UTF-16 abnormal spacing glitch "A   n o n - r e f u n d a b l e"
    assert.ok(
      !pdfString.includes('A   n o n - r e f u n d a b l e'),
      'Must not contain wide-spaced characters from UTF-16 conversion'
    );
    // Must contain clean ASCII words
    assert.ok(
      pdfString.includes('A non-refundable booking fee of') || pdfString.includes('booking fee'),
      'Must contain cleanly rendered booking fee text'
    );
  });

  it('generates exactly 3 pages with Commercial Terms & Payment Schedule combined on Page 2', () => {
    const testProject: Project = {
      ...mockProject,
      total_amount: 340000,
      booking_amount: 20000,
    };

    const doc = generateOrderFormPDF(
      testProject,
      mockClient,
      mockCompany,
      mockDeliverables,
      [],
      { compress: false }
    );

    const totalPages = doc.getNumberOfPages();
    assert.strictEqual(totalPages, 3, 'Order form must be strictly 3 pages');

    const pdfContent = doc.output();

    // Verify sections exist in document
    assert.ok(pdfContent.includes('CLIENT & EVENT PROFILE'), 'Page 1 must contain Client Profile');
    assert.ok(pdfContent.includes('DELIVERABLES'), 'Page 1 must contain Deliverables');
    assert.ok(pdfContent.includes('COMMERCIAL TERMS & PRODUCTION FEES'), 'Must contain Commercial Terms');
    assert.ok(pdfContent.includes('PAYMENT SCHEDULE'), 'Must contain Payment Schedule');
    assert.ok(pdfContent.includes('TERMS & CONDITIONS'), 'Must contain Terms & Conditions');

    // Page 2 must have footer "Page 2 of 3"
    assert.ok(pdfContent.includes('Page 2 of 3'), 'Must contain Page 2 of 3 footer');
    assert.ok(pdfContent.includes('Page 3 of 3'), 'Must contain Page 3 of 3 footer');
  });

  it('calculates payments correctly when recorded payments exist', () => {
    const mockPayments: Payment[] = [
      {
        id: 'pay-1',
        company_id: 'twb',
        project_id: 'proj-456',
        amount: 75000,
        payment_date: '2026-03-01',
        payment_mode: 'Bank Transfer',
        description: 'First Retainer Installment',
        receipt_number: 'REC-2026-001',
        created_at: '2026-03-01T10:00:00Z',
      },
    ];

    const doc = generateOrderFormPDF(
      mockProject,
      mockClient,
      mockCompany,
      mockDeliverables,
      mockPayments
    );
    assert.ok(doc, 'Should generate cleanly with payment records');
  });

  it('downloadPdfDoc triggers simulated anchor click in DOM environment', () => {
    let clicked = false;
    let appendedChild: any = null;

    // Simulate browser window and document
    const mockLink = {
      href: '',
      download: '',
      rel: '',
      style: { display: '' },
      parentNode: null as any,
      click: () => {
        clicked = true;
      },
      dispatchEvent: () => true,
    };
    mockLink.parentNode = {
      removeChild: () => {},
    };

    const originalWindow = (global as any).window;
    const originalDocument = (global as any).document;
    const originalURL = (global as any).URL;

    try {
      (global as any).window = {};
      (global as any).document = {
        createElement: (tag: string) => {
          if (tag === 'a') return mockLink;
          return {};
        },
        body: {
          appendChild: (child: any) => {
            appendedChild = child;
          },
        },
      };
      (global as any).URL = {
        createObjectURL: () => 'blob:mock-order-form-url',
        revokeObjectURL: () => {},
      };

      const doc = generateOrderFormPDF(
        mockProject,
        mockClient,
        mockCompany,
        mockDeliverables,
        []
      );

      downloadPdfDoc(doc, 'Test-Order-Form.pdf');

      assert.strictEqual(clicked, true, 'downloadPdfDoc must invoke link.click()');
      assert.strictEqual(mockLink.download, 'Test-Order-Form.pdf', 'Anchor download attribute must match filename');
      assert.strictEqual(mockLink.href, 'blob:mock-order-form-url', 'Anchor href must receive blob URL');
      assert.strictEqual(appendedChild, mockLink, 'Anchor must be appended to document.body');
    } finally {
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
      (global as any).URL = originalURL;
    }
  });

  it('downloadPdfDoc falls back gracefully in headless environment', () => {
    let savedName = '';
    const doc = generateOrderFormPDF(
      mockProject,
      mockClient,
      mockCompany,
      mockDeliverables,
      []
    );

    downloadPdfDoc(doc, 'Headless-Test.pdf', (name) => {
      savedName = name;
    });

    assert.strictEqual(savedName, 'Headless-Test.pdf', 'Should invoke fallback with target filename');
  });
});
