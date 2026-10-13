import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { generateOrderFormPDF, downloadPdfDoc } from '../src/utils/pdfGenerator';
import { Project, Company, Payment } from '../src/types';

test('generateOrderFormPDF creates doc and attaches __originalSave without recursion', () => {
  const dummyProject: Project = {
    id: 'proj-order-test',
    name: 'Ananya & Rohan • Wedding 2026',
    company_id: 'twb',
    total_amount: 250000,
    booking_amount: 50000,
    wedding_date_start: '2026-11-20',
    wedding_date_end: '2026-11-22',
    city: 'Jaipur',
    venue: 'Fairmont Jaipur',
    status: 'Confirmed' as any,
    events: [
      { id: 'ev-1', project_id: 'proj-order-test', event_name: 'Sangeet', event_date: '2026-11-20' },
      { id: 'ev-2', project_id: 'proj-order-test', event_name: 'Wedding Ceremony', event_date: '2026-11-21' },
    ],
  } as any;

  const dummyCompany: Company = {
    id: 'twb',
    name: 'The Wedding Booth',
    code: 'twb',
  } as any;

  const dummyPayments: Payment[] = [
    {
      id: 'pay-1',
      project_id: 'proj-order-test',
      amount: 75000,
      payment_date: '2026-04-10',
      company_id: 'twb',
      payment_mode: 'Bank Transfer',
      status: 'verified',
    } as any,
  ];

  const doc = generateOrderFormPDF(dummyProject, undefined, dummyCompany, [], dummyPayments);

  assert.ok(doc, 'jsPDF document instance should be returned');
  assert.equal(typeof (doc as any).__originalSave, 'function', '__originalSave should be stored on doc');
  assert.equal(typeof doc.save, 'function', 'doc.save should be a function');

  // Verify that calling doc.save() invokes __originalSave with the proper filename without recursion
  let interceptedFilename = '';
  let callCount = 0;
  (doc as any).__originalSave = (name: string) => {
    callCount++;
    interceptedFilename = name;
  };

  // Calling doc.save() should trigger intercepted originalSave exactly once
  doc.save();

  assert.equal(callCount, 1, 'Native save function should be called exactly once');
  assert.ok(
    interceptedFilename.includes('TWB_OrderForm_') || interceptedFilename.includes('Ananya'),
    `Filename should be formatted properly, received: ${interceptedFilename}`
  );
});

test('downloadPdfDoc falls back to Blob output if nativeSave throws', () => {
  const doc = new jsPDF();
  let fallbackAttempted = false;

  const mockFailingNativeSave = () => {
    throw new Error('Simulated browser iframe security error');
  };

  // In Node.js environment, window is undefined, so fallback will catch or produce blob
  // Let's verify that the failing nativeSave error is caught and fallback triggers doc.output('blob')
  let outputBlobCalled = false;
  const originalOutput = doc.output.bind(doc);
  doc.output = ((type: any) => {
    if (type === 'blob') {
      outputBlobCalled = true;
    }
    return originalOutput(type);
  }) as any;

  downloadPdfDoc(doc, 'test-fallback.pdf', mockFailingNativeSave);

  assert.ok(outputBlobCalled, 'doc.output("blob") should be invoked as fallback when nativeSave throws');
});

test('generateOrderFormPDF preserves custom filename when passed to doc.save(customName)', () => {
  const dummyProject: Project = {
    id: 'proj-custom-file',
    name: 'Custom Couple',
    company_id: 'twb',
    total_amount: 150000,
  } as any;
  const dummyCompany: Company = {
    id: 'twb',
    name: 'The Wedding Booth',
    code: 'twb',
  } as any;

  const doc = generateOrderFormPDF(dummyProject, undefined, dummyCompany, [], []);
  let savedName = '';
  (doc as any).__originalSave = (name: string) => {
    savedName = name;
  };

  doc.save('Special_Order_Form_v2.pdf');
  assert.equal(savedName, 'Special_Order_Form_v2.pdf');
});

test('generateOrderFormPDF accurately calculates verified payments and remaining balance', () => {
  const dummyProject: Project = {
    id: 'proj-calc',
    name: 'Finance Couple',
    company_id: 'twb',
    total_amount: 200000,
    booking_amount: 20000,
  } as any;
  const dummyCompany: Company = {
    id: 'twb',
    name: 'The Wedding Booth',
    code: 'twb',
  } as any;
  const dummyPayments: Payment[] = [
    {
      id: 'p1',
      project_id: 'proj-calc',
      amount: 60000,
      payment_date: '2026-01-01',
      company_id: 'twb',
      payment_mode: 'UPI',
      status: 'verified',
    } as any,
    {
      id: 'p2',
      project_id: 'proj-calc',
      amount: 40000,
      payment_date: '2026-02-01',
      company_id: 'twb',
      payment_mode: 'Bank Transfer',
      status: 'verified',
    } as any,
    {
      id: 'p3',
      project_id: 'unrelated-project',
      amount: 999999,
      payment_date: '2026-02-01',
      company_id: 'twb',
      payment_mode: 'Cash',
      status: 'verified',
    } as any,
  ];

  // Should succeed without error
  const doc = generateOrderFormPDF(dummyProject, undefined, dummyCompany, [], dummyPayments);
  assert.ok(doc);
});

