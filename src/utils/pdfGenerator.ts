import jsPDF from 'jspdf';
import { Company, Enquiry, Payment, Project, Client } from '../types';

export interface QuotationConfig {
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  discount: number;
  taxRate: number;
  customNotes?: string;
  validUntilDate?: string;
}

export const generateQuotationPDF = (
  enquiry: Enquiry,
  company: Company,
  config?: QuotationConfig
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isTWB = company.code === 'twb';
  const primaryColor = isTWB ? [15, 23, 42] : [59, 34, 7]; // Slate vs Warm Espresso
  const accentColor = isTWB ? [37, 99, 235] : [217, 119, 6]; // Royal Blue vs Amber Gold

  // Top Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  // Accent line
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 36, 210, 2, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(company.name.toUpperCase(), 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(company.tagline, 15, 25);
  doc.text(`${company.email}  |  ${company.phone}  |  ${company.website}`, 15, 30);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OFFICIAL QUOTATION', 15, 52);

  // Metadata block right
  const quoteNumber = `QT-${company.code.toUpperCase()}-${enquiry.id.replace('enq-', '').slice(-4).toUpperCase()}`;
  const quoteDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const validUntil = config?.validUntilDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('QUOTATION NO:', 135, 48);
  doc.text('DATE ISSUED:', 135, 54);
  doc.text('VALID UNTIL:', 135, 60);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(quoteNumber, 170, 48);
  doc.text(quoteDate, 170, 54);
  doc.text(validUntil, 170, 60);

  // Client Details Box
  doc.setDrawColor(220, 225, 230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 68, 180, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PREPARED EXCLUSIVELY FOR:', 20, 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const clientTitle = enquiry.partner_name ? `${enquiry.client_name} & ${enquiry.partner_name}` : enquiry.client_name;
  doc.setFont('helvetica', 'bold');
  doc.text(clientTitle, 20, 81);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${enquiry.email}  |  Phone: ${enquiry.phone}`, 20, 87);
  doc.text(`Event Date: ${enquiry.event_date}  |  Venue: ${enquiry.venue}`, 20, 93);

  // Table Header
  let y = 110;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ITEM DESCRIPTION / SERVICE SCOPE', 20, y + 5.5);
  doc.text('QTY', 130, y + 5.5);
  doc.text('RATE ($)', 150, y + 5.5);
  doc.text('AMOUNT ($)', 175, y + 5.5);

  y += 10;
  doc.setTextColor(40, 40, 40);

  // Default items if none specified
  const items = config?.items && config.items.length > 0 ? config.items : [
    {
      description: `Principal Wedding Cinematography Coverage (${company.name})`,
      quantity: 1,
      rate: Math.round(enquiry.estimated_budget * 0.6),
      amount: Math.round(enquiry.estimated_budget * 0.6),
    },
    {
      description: 'Secondary Shooter & Aerial Drone 4K Coverage',
      quantity: 1,
      rate: Math.round(enquiry.estimated_budget * 0.25),
      amount: Math.round(enquiry.estimated_budget * 0.25),
    },
    {
      description: 'Editorial Teaser (60s) + Highlight Feature Film Master + Cloud Delivery',
      quantity: 1,
      rate: Math.round(enquiry.estimated_budget * 0.15),
      amount: Math.round(enquiry.estimated_budget * 0.15),
    },
  ];

  let subtotal = 0;
  items.forEach((item, index) => {
    subtotal += item.amount;
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(250, 250, 250);
      doc.rect(15, y - 4, 180, 8, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(item.description.slice(0, 58), 20, y + 1);
    doc.text(item.quantity.toString(), 133, y + 1);
    doc.text(item.rate.toLocaleString(), 152, y + 1);
    doc.text(item.amount.toLocaleString(), 177, y + 1);

    y += 8;
  });

  // Totals
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(125, y, 195, y);
  y += 6;

  const discount = config?.discount || 0;
  const taxable = subtotal - discount;
  const tax = taxable * (config?.taxRate || 0);
  const total = taxable + tax;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal:', 135, y);
  doc.text(`$${subtotal.toLocaleString()}`, 175, y);
  y += 5;

  if (discount > 0) {
    doc.text('Discount:', 135, y);
    doc.text(`-$${discount.toLocaleString()}`, 175, y);
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Estimated Total:', 135, y + 2);
  doc.text(`$${total.toLocaleString()}`, 175, y + 2);

  // Bank & Remittance
  y = 205;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('WIRE / BANK TRANSFER INFORMATION', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Account Name: ${company.bank_details.account_name}`, 20, y + 12);
  doc.text(`Bank: ${company.bank_details.bank_name}`, 20, y + 17);
  doc.text(`Account Number: ${company.bank_details.account_number}  |  Routing: ${company.bank_details.routing_code}`, 20, y + 22);

  // Terms & Conditions
  y = 242;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('TERMS & CONDITIONS:', 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  const terms = doc.splitTextToSize(company.terms_conditions, 180);
  doc.text(terms, 15, y + 5);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated by TWBHub System  •  ${company.name}  •  ${quoteNumber}`, 15, 285);

  return doc;
};

export const generateReceiptPDF = (
  payment: Payment,
  project: Project,
  client: Client | undefined,
  company: Company
) => generatePaymentReceiptPDF(payment, project, client, company);

export const generatePaymentReceiptPDF = (
  payment: Payment,
  project: Project,
  client: Client | undefined,
  company: Company
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isTWB = company.code === 'twb';
  const primaryColor = isTWB ? [15, 23, 42] : [59, 34, 7];
  const accentColor = isTWB ? [37, 99, 235] : [217, 119, 6];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 34, 210, 2, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company.name.toUpperCase(), 15, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(company.tagline, 15, 24);
  doc.text(`${company.email}  |  ${company.phone}`, 15, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OFFICIAL PAYMENT RECEIPT', 15, 50);

  // Status Badge
  doc.setFillColor(34, 197, 94); // Green
  doc.roundedRect(155, 42, 40, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID IN FULL', 162, 48.5);

  // Receipt Meta
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RECEIPT NO:', 15, 62);
  doc.text('PAYMENT DATE:', 15, 68);
  doc.text('PAYMENT METHOD:', 15, 74);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(payment.receipt_number, 50, 62);
  doc.text(payment.payment_date, 50, 68);
  doc.text(payment.payment_mode, 50, 74);

  // Client & Project Box
  doc.setDrawColor(220, 225, 230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 84, 180, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BILLED TO / CLIENT DETAILS:', 20, 91);
  doc.text('PROJECT / WEDDING DETAILS:', 110, 91);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  const clientName = client ? (client.partner_name ? `${client.name} & ${client.partner_name}` : client.name) : project.name;
  doc.setFont('helvetica', 'bold');
  doc.text(clientName, 20, 97);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${client?.email || project.client_contact.email}`, 20, 103);
  doc.text(`Phone: ${client?.phone || project.client_contact.phone}`, 20, 109);

  doc.setFont('helvetica', 'bold');
  doc.text(project.name, 110, 97);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dates: ${project.wedding_date_start}`, 110, 103);
  doc.text(`Location: ${project.venue}, ${project.city}`, 110, 109);

  // Amount Paid Big Block
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(15, 128, 180, 24, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('AMOUNT RECEIVED:', 22, 137);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`$${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 22, 146);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Transaction Reference: ${payment.description}`, 105, 142);

  // Project Balance Summary Table
  let y = 162;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ACCOUNT CONTRACT SUMMARY', 15, y);

  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, 195, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  doc.text('Package Contract Value:', 15, y);
  doc.text(`$${project.total_amount.toLocaleString()}`, 160, y);
  y += 6;

  doc.text('Amount Recorded This Receipt:', 15, y);
  doc.text(`$${payment.amount.toLocaleString()}`, 160, y);
  y += 6;

  doc.text('Package Name:', 15, y);
  doc.text(project.package_name, 110, y);
  y += 10;

  // Signatory & Stamp
  y = 215;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('AUTHORIZED SIGNATURE & STAMP:', 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Accounts & Operations Department', 15, y + 6);
  doc.text(`${company.name}`, 15, y + 11);
  doc.text(`Generated on ${new Date().toISOString().split('T')[0]}`, 15, y + 16);

  // Official Seal outline
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.8);
  doc.rect(145, y - 5, 45, 24);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OFFICIALLY VERIFIED', 150, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('TWBHub Finance Dept', 150, y + 11);
  doc.text('Payment Recorded Clean', 150, y + 15);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`This is a computer generated receipt from TWBHub  •  ${company.name}  •  ${payment.receipt_number}`, 15, 285);

  return doc;
};

export const generateOrderFormPDF = (
  project: Project,
  client: Client | undefined,
  company: Company
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isTWB = company.code === 'twb';
  const primaryColor = isTWB ? [15, 23, 42] : [59, 34, 7];
  const accentColor = isTWB ? [37, 99, 235] : [217, 119, 6];

  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 34, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company.name.toUpperCase(), 15, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('MASTER PRODUCTION ORDER FORM & CONTRACT AGREEMENT', 15, 24);
  doc.text(`${company.email}  |  ${company.phone}`, 15, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PRODUCTION ORDER FORM', 15, 48);

  const orderNum = `ORD-${company.code.toUpperCase()}-${project.id.replace('prj-', '').slice(-4).toUpperCase()}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ORDER REF:', 140, 46);
  doc.text('DATE FILED:', 140, 52);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(orderNum, 168, 46);
  doc.text(new Date().toLocaleDateString(), 168, 52);

  // Section 1: Client & Wedding Profile
  let y = 62;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, 180, 36, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('1. CLIENT & EVENT PROFILE', 20, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(`Client Names: ${project.name}`, 20, y + 14);
  doc.text(`Wedding Dates: ${project.wedding_date_start} to ${project.wedding_date_end}`, 20, y + 20);
  doc.text(`Primary Venue: ${project.venue}, ${project.city}`, 20, y + 26);
  doc.text(`Contact: ${project.client_contact.phone}  |  ${project.client_contact.email}`, 20, y + 32);

  // Section 2: Package & Deliverable Scope
  y += 42;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, 180, 48, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('2. COMMISSIONED PACKAGE & SCOPE', 20, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`Package Tier: ${project.package_name}`, 20, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const details = doc.splitTextToSize(project.package_details, 170);
  doc.text(details, 20, y + 20);

  // Section 3: Commercial & Payment Terms
  y += 54;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, 180, 34, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('3. COMMERCIAL TERMS & FEES', 20, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Total Agreed Contract Fee: $${project.total_amount.toLocaleString()}`, 20, y + 15);
  doc.text(`Initial Booking Retainer: $${project.booking_amount.toLocaleString()}`, 20, y + 21);
  doc.text(`Remaining Balance: $${(project.total_amount - project.booking_amount).toLocaleString()}`, 20, y + 27);

  // Signatures
  y = 220;
  doc.setDrawColor(180, 180, 180);
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text('Client Signature & Date', 20, y + 5);
  doc.text('Authorized Studio Representative', 120, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text('I confirm acceptance of the scope and booking policies above.', 20, y + 10);
  doc.text(`${company.name}`, 120, y + 10);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`TWBHub Business Operations  •  ${company.name}  •  ${orderNum}`, 15, 285);

  return doc;
};
