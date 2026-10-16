import {
  formatAmountInIndianWords,
  formatReceiptDateForDisplay,
  formatReceiptDateForFilename,
  getPaymentReceiptFilename,
  generatePaymentReceiptPDF,
  generateReceiptPDF,
  generateOrderFormPDF,
  downloadPdfDoc,
  drawRupeeGlyph,
  renderRupeeAmount,
} from './pdfGenerator';
import { Payment, Project, Client, Company } from '../types';

function runTests() {
  console.log('--- Starting Payment Receipt Unit Tests ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (!condition) {
      console.error(`FAIL: ${testName} | Expected:`, expected, '| Got:', actual);
      failures++;
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  // 1. Amount in Words Tests
  assert(
    formatAmountInIndianWords(0) === 'Rupees Zero Only',
    'Amount in words: 0',
    formatAmountInIndianWords(0),
    'Rupees Zero Only'
  );
  assert(
    formatAmountInIndianWords(15000) === 'Rupees Fifteen Thousand Only',
    'Amount in words: 15,000',
    formatAmountInIndianWords(15000),
    'Rupees Fifteen Thousand Only'
  );
  assert(
    formatAmountInIndianWords(1000) === 'Rupees One Thousand Only',
    'Amount in words: 1,000',
    formatAmountInIndianWords(1000),
    'Rupees One Thousand Only'
  );
  assert(
    formatAmountInIndianWords(1000.5) === 'Rupees One Thousand and Fifty Paise Only',
    'Amount in words: 1,000.50',
    formatAmountInIndianWords(1000.5),
    'Rupees One Thousand and Fifty Paise Only'
  );
  assert(
    formatAmountInIndianWords(450) === 'Rupees Four Hundred Fifty Only',
    'Amount in words: 450',
    formatAmountInIndianWords(450),
    'Rupees Four Hundred Fifty Only'
  );
  assert(
    formatAmountInIndianWords(125450.75) ===
      'Rupees One Lakh Twenty-Five Thousand Four Hundred Fifty and Seventy-Five Paise Only',
    'Amount in words: 1,25,450.75',
    formatAmountInIndianWords(125450.75),
    'Rupees One Lakh Twenty-Five Thousand Four Hundred Fifty and Seventy-Five Paise Only'
  );
  assert(
    formatAmountInIndianWords(0.5) === 'Fifty Paise Only',
    'Amount in words: 0.50 paise only',
    formatAmountInIndianWords(0.5),
    'Fifty Paise Only'
  );
  assert(
    formatAmountInIndianWords(undefined as any) === '—',
    'Amount in words: undefined fallback',
    formatAmountInIndianWords(undefined as any),
    '—'
  );

  // 2. Date Formatting Tests
  assert(
    formatReceiptDateForDisplay('2026-10-13') === '13-10-2026',
    'Date display: 2026-10-13 -> 13-10-2026',
    formatReceiptDateForDisplay('2026-10-13'),
    '13-10-2026'
  );
  assert(
    formatReceiptDateForDisplay('') === '—',
    'Date display: empty string fallback',
    formatReceiptDateForDisplay(''),
    '—'
  );
  assert(
    formatReceiptDateForFilename('2026-10-13') === '13 Oct 2026',
    'Date filename: 2026-10-13 -> 13 Oct 2026',
    formatReceiptDateForFilename('2026-10-13'),
    '13 Oct 2026'
  );

  // 3. Filename Generation Tests
  const mockCompanyGJ: Company = {
    id: 'comp-gj',
    code: 'golden_june',
    name: 'Golden June Films',
    tagline: 'Wedding Photography & Films',
    email: 'goldenjunefilms@gmail.com',
    phone: '+91 9074963370',
    website: 'www.goldenjunefilms.com',
    address: 'Kochi, Kerala',
    primary_color: '#3B2207',
    accent_color: '#D97706',
    bank_details: { account_name: '', account_number: '', bank_name: '', routing_code: '' },
    terms_conditions: '',
  };

  const mockCompanyTWB: Company = {
    ...mockCompanyGJ,
    id: 'comp-twb',
    code: 'twb',
    name: 'The Wedding Booth',
  };

  const mockClient: Client = {
    id: 'c1',
    company_id: 'golden_june',
    name: 'Test Client A',
    partner_name: 'Test Client B',
    email: 'test@example.com',
    phone: '9876543210',
    created_at: '2026-01-01',
  };

  const mockProject: Project = {
    id: 'proj-1',
    company_id: 'golden_june',
    client_id: 'c1',
    name: 'Test Client A & Test Client B • Wedding',
    wedding_date_start: '2026-10-20',
    wedding_date_end: '2026-10-21',
    venue: 'Grand Hyatt',
    city: 'Kochi',
    client_contact: { phone: '9876543210', email: 'test@example.com' },
    status: 'Booked',
    package_name: 'Signature Cinema',
    package_details: '',
    booking_amount: 10000,
    total_amount: 50000,
    created_at: '2026-01-01',
  };

  const payment1: Payment = {
    id: 'pay-1',
    project_id: 'proj-1',
    company_id: 'golden_june',
    payment_date: '2026-10-13',
    amount: 15000,
    payment_mode: 'UPI',
    description: 'Advance Booking',
    receipt_number: 'REC-2026-001',
    created_at: '2026-10-13T10:00:00Z',
  };

  const singleFilename = getPaymentReceiptFilename(payment1, mockProject, mockClient, mockCompanyGJ);
  assert(
    singleFilename === 'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf',
    'Single payment filename pattern',
    singleFilename,
    'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf'
  );

  const twbFilename = getPaymentReceiptFilename(payment1, mockProject, mockClient, mockCompanyTWB);
  assert(
    twbFilename === 'TWB-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf',
    'TWB brand prefix in filename',
    twbFilename,
    'TWB-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf'
  );

  // Collision handling test: 2 payments on same date for same client
  const payment2: Payment = {
    ...payment1,
    id: 'pay-2',
    receipt_number: 'REC-2026-002',
    amount: 5000,
  };
  const collisionFilename1 = getPaymentReceiptFilename(payment1, mockProject, mockClient, mockCompanyGJ, [payment1, payment2]);
  const collisionFilename2 = getPaymentReceiptFilename(payment2, mockProject, mockClient, mockCompanyGJ, [payment1, payment2]);

  assert(
    collisionFilename1 === 'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B - REC-2026-001.pdf',
    'Collision filename appends distinct suffix for pay-1',
    collisionFilename1,
    'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B - REC-2026-001.pdf'
  );
  assert(
    collisionFilename2 === 'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B - REC-2026-002.pdf',
    'Collision filename appends distinct suffix for pay-2',
    collisionFilename2,
    'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B - REC-2026-002.pdf'
  );

  // 4. Receipt PDF Document Geometry & Content Tests
  const doc = generatePaymentReceiptPDF(payment1, mockProject, mockClient, mockCompanyGJ);
  const width = Math.round(doc.internal.pageSize.getWidth() * 100) / 100;
  const height = Math.round(doc.internal.pageSize.getHeight() * 100) / 100;

  assert(
    width === 215.9 && height === 107.95,
    'PDF dimensions match 8.5 x 4.25 in (215.9mm x 107.95mm)',
    `${width} x ${height}`,
    '215.9 x 107.95'
  );
  assert(
    doc.getNumberOfPages() === 1,
    'PDF is single page',
    doc.getNumberOfPages(),
    1
  );
  assert(
    (doc as any).filename === 'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf',
    'Document has proper target filename attached',
    (doc as any).filename,
    'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf'
  );

  // Verify receipt ID is NOT in document text
  const docOutput = doc.output('datauristring');
  // Raw PDF stream verification: ensure REC-2026-001 does not appear in text
  const rawPdf = doc.output();
  assert(
    !rawPdf.includes('REC-2026-001') && !rawPdf.includes('Receipt No') && !rawPdf.includes('RECEIPT NO'),
    'Receipt ID is excluded from rendered PDF output',
    'Does not contain REC-2026-001',
    'Does not contain REC-2026-001'
  );

  // Typography verification: numeric amount renders without null-byte wide character spacing
  assert(
    rawPdf.includes('(15,000) Tj') && !rawPdf.includes('\x001\x005\x00,\x000\x000\x000'),
    'Numeric INR amount renders cleanly without character spacing defect',
    'Contains (15,000) Tj without null-byte spacing',
    'Contains (15,000) Tj without null-byte spacing'
  );

  // Refined Rupee Glyph typography & proportion verification
  const glyphW10 = drawRupeeGlyph(doc, 10, 20, 10, [0, 0, 0], true);
  const glyphW15 = drawRupeeGlyph(doc, 10, 20, 15, [0, 0, 0], true);
  assert(
    glyphW10 > 1.4 && glyphW10 < 1.9,
    'Refined Rupee glyph: 10pt advance width matches typography proportions',
    glyphW10,
    'Between 1.4mm and 1.9mm'
  );
  assert(
    glyphW15 > 2.1 && glyphW15 < 2.8,
    'Refined Rupee glyph: 15pt advance width matches typography proportions',
    glyphW15,
    'Between 2.1mm and 2.8mm'
  );

  const totalW = renderRupeeAmount(doc, 150000, 10, 20, { fontSize: 10, bold: true });
  assert(
    totalW > 12 && totalW < 18,
    'renderRupeeAmount: total width for ₹1,50,000 is correctly computed',
    totalW,
    'Between 12mm and 18mm'
  );

  // Signatory Box removal verification: stamp and digital verification wording absent
  assert(
    !rawPdf.includes('AUTHORIZED SIGNATORY'),
    'Signatory section: AUTHORIZED SIGNATORY is absent from receipt',
    'Does not contain AUTHORIZED SIGNATORY',
    'Does not contain AUTHORIZED SIGNATORY'
  );
  assert(
    !rawPdf.includes('Accounts & Operations'),
    'Signatory section: Accounts & Operations is absent from receipt',
    'Does not contain Accounts & Operations',
    'Does not contain Accounts & Operations'
  );
  assert(
    !rawPdf.includes('Electronic Verification Stamp'),
    'Signatory section: Electronic Verification Stamp is absent from receipt',
    'Does not contain Electronic Verification Stamp',
    'Does not contain Electronic Verification Stamp'
  );
  assert(
    !rawPdf.includes('Valid without physical signature'),
    'Signatory section: Valid without physical signature disclaimer is absent',
    'Does not contain Valid without physical signature',
    'Does not contain Valid without physical signature'
  );

  // Order Form Email Verification
  const orderDocBlank = generateOrderFormPDF(
    { ...mockProject, client_contact: { phone: '9876543210', email: '' } },
    { ...mockClient, email: '' },
    mockCompanyGJ,
    [],
    []
  );
  const orderPdfBlank = orderDocBlank.output();
  assert(
    !orderPdfBlank.includes('client@wedding.com'),
    'Order Form: Blank client email never produces client@wedding.com',
    'Does not contain client@wedding.com',
    'Does not contain client@wedding.com'
  );
  assert(
    orderPdfBlank.includes('(9876543210) Tj') && !orderPdfBlank.includes('client@wedding.com'),
    'Order Form: Blank email cleanly omits email while preserving phone number',
    'Preserves phone without invented email',
    'Preserves phone without invented email'
  );

  const orderDocLegacy = generateOrderFormPDF(
    { ...mockProject, client_contact: { phone: '9876543210', email: 'client@wedding.com' } },
    undefined,
    mockCompanyGJ,
    [],
    []
  );
  const orderPdfLegacy = orderDocLegacy.output();
  assert(
    !orderPdfLegacy.includes('client@wedding.com'),
    'Order Form: Legacy placeholder client@wedding.com is stripped from PDF',
    'Does not contain client@wedding.com',
    'Does not contain client@wedding.com'
  );

  const orderDocGenuine = generateOrderFormPDF(
    mockProject,
    { ...mockClient, email: 'genuine.client@example.com' },
    mockCompanyGJ,
    [],
    []
  );
  const orderPdfGenuine = orderDocGenuine.output();
  assert(
    orderPdfGenuine.includes('genuine.client@example.com'),
    'Order Form: Genuine client email is preserved and displayed',
    'Contains genuine.client@example.com',
    'Contains genuine.client@example.com'
  );

  // 5. Download Mechanism Tests
  let clickTriggered = false;
  let clickedFilename = '';
  let appendedToBody = false;
  let objectUrlCreated = false;

  const mockLink: any = {
    href: '',
    download: '',
    style: {},
    rel: '',
    click: () => {
      clickTriggered = true;
      clickedFilename = mockLink.download;
    },
    parentNode: null,
  };

  const originalWindow = (global as any).window;
  const originalDocument = (global as any).document;
  const originalURL = (global as any).URL;

  // Mock browser environment
  const mockBody: any = {
    appendChild: (el: any) => {
      appendedToBody = true;
      el.parentNode = mockBody;
      return el;
    },
    removeChild: (el: any) => {
      el.parentNode = null;
      return el;
    },
  };

  (global as any).window = {};
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'a') return mockLink;
      return {};
    },
    body: mockBody,
  };
  (global as any).URL = {
    createObjectURL: (blob: any) => {
      objectUrlCreated = true;
      return 'blob:http://localhost/mock-uuid';
    },
    revokeObjectURL: (url: string) => {},
  };

  try {
    // Test doc.save() invokes the browser Blob download path synchronously
    doc.save();

    assert(
      objectUrlCreated,
      'Download mechanism: URL.createObjectURL invoked with PDF blob',
      objectUrlCreated,
      true
    );
    assert(
      appendedToBody,
      'Download mechanism: Anchor appended to document.body',
      appendedToBody,
      true
    );
    assert(
      clickTriggered,
      'Download mechanism: link.click() triggered synchronously',
      clickTriggered,
      true
    );
    assert(
      clickedFilename === 'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf',
      'Download mechanism: filename matches expected standardized pattern',
      clickedFilename,
      'GJ-Receipt_13 Oct 2026 - Test Client A & Test Client B.pdf'
    );
  } finally {
    // Restore environment
    (global as any).window = originalWindow;
    (global as any).document = originalDocument;
    (global as any).URL = originalURL;
  }

  // 6. Test native fallback without recursion when window/document is undefined
  let nativeSaveCalledWith = '';
  const dummyDoc: any = {
    output: () => new Uint8Array([]),
    __originalSave: (name: string) => {
      nativeSaveCalledWith = name;
    },
  };
  downloadPdfDoc(dummyDoc, 'Test-Fallback.pdf');
  assert(
    nativeSaveCalledWith === 'Test-Fallback.pdf',
    'Download mechanism: falls back to native save in non-browser environment without recursion',
    nativeSaveCalledWith,
    'Test-Fallback.pdf'
  );

  console.log('--- Payment Receipt Tests Completed ---');
  if (failures > 0) {
    console.error(`Total failures: ${failures}`);
    process.exit(1);
  } else {
    console.log('All tests passed successfully (0 failures).');
    process.exit(0);
  }
}

runTests();
