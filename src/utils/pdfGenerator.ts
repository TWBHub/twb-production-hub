import jsPDF from 'jspdf';
import { Company, Enquiry, Payment, Project, ProjectEvent, Client, Deliverable } from '../types';
import { getProjectClauses } from './termsLibrary';
import { sortProjectEvents } from './eventUtils';

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
  doc.text('RATE (₹)', 150, y + 5.5);
  doc.text('AMOUNT (₹)', 175, y + 5.5);

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
  doc.text(`₹${subtotal.toLocaleString()}`, 175, y);
  y += 5;

  if (discount > 0) {
    doc.text('Discount:', 135, y);
    doc.text(`-₹${discount.toLocaleString()}`, 175, y);
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Estimated Total:', 135, y + 2);
  doc.text(`₹${total.toLocaleString()}`, 175, y + 2);

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
  doc.text(`₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 22, 146);

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
  doc.text(`₹${project.total_amount.toLocaleString('en-IN')}`, 160, y);
  y += 6;

  doc.text('Amount Recorded This Receipt:', 15, y);
  doc.text(`₹${payment.amount.toLocaleString('en-IN')}`, 160, y);
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

export const COMPANY_AUTHORIZED_PERSON: Record<'twb' | 'golden_june', string> = {
  twb: 'Authorized Signatory',
  golden_june: 'Authorized Signatory',
};

export const COMPANY_SIGNATURE_ASSETS: Record<'twb' | 'golden_june', string | null> = {
  twb: null,         // Real transparent PNG signature asset hook (e.g. data URL or asset path)
  golden_june: null, // Real transparent PNG signature asset hook (e.g. data URL or asset path)
};

export const getStudioSignatureAsset = (companyCode: 'twb' | 'golden_june'): string | null => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(`studio_signature_${companyCode}`);
    if (custom) return custom;
  }
  return COMPANY_SIGNATURE_ASSETS[companyCode] || null;
};

export interface OfficialCompanyInfo {
  name: string;
  tagline: string;
  mobile: string;
  email: string;
  website: string;
  code: 'twb' | 'golden_june';
  brandDisplayName: string;
}

export const getOfficialCompanyInfo = (company: Company): OfficialCompanyInfo => {
  const isTWB = company.code === 'twb';
  if (isTWB) {
    return {
      code: 'twb',
      brandDisplayName: 'THE WEDDING BOOTH',
      name: 'THE WEDDING BOOTH',
      tagline: 'Wedding Photography & Films',
      mobile: '+91 9074448850',
      email: 'dweddingbooth@gmail.com',
      website: 'www.theweddingbooth.in',
    };
  }
  return {
    code: 'golden_june',
    brandDisplayName: 'GOLDEN JUNE FILMS',
    name: 'GOLDEN JUNE FILMS',
    tagline: 'Wedding Photography & Films',
    mobile: '+91 9074963370',
    email: 'goldenjunefilms@gmail.com',
    website: 'www.goldenjunefilms.com',
  };
};

export const formatProjectEventsForFilename = (events?: ProjectEvent[]): string => {
  if (!events || events.length === 0) return 'Date-TBD';
  const sorted = sortProjectEvents(events);
  const validDates = sorted
    .map(e => e.event_date)
    .filter(Boolean)
    .map(dStr => new Date(dStr + 'T00:00:00'))
    .filter(d => !isNaN(d.getTime()));

  if (validDates.length === 0) return 'Date-TBD';
  if (validDates.length === 1) {
    const d = validDates[0];
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
  }

  const first = validDates[0];
  const allSameMonthAndYear = validDates.every(
    d => d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear()
  );

  if (allSameMonthAndYear) {
    const uniqueDays = Array.from(new Set(validDates.map(d => d.getDate()))).sort((a, b) => a - b);
    const month = first.toLocaleString('en-US', { month: 'short' });
    const year = first.getFullYear();
    return `${uniqueDays.join(',')} ${month} ${year}`;
  }

  const m1 = validDates[0].toLocaleString('en-US', { month: 'short' });
  const m2 = validDates[validDates.length - 1].toLocaleString('en-US', { month: 'short' });
  const y1 = validDates[0].getFullYear();
  const y2 = validDates[validDates.length - 1].getFullYear();
  if (y1 === y2) {
    return `${validDates[0].getDate()} ${m1} - ${validDates[validDates.length - 1].getDate()} ${m2} ${y1}`;
  }
  return `${validDates[0].getDate()} ${m1} ${y1} - ${validDates[validDates.length - 1].getDate()} ${m2} ${y2}`;
};

export const formatProjectEventsDateSummary = (events?: ProjectEvent[]): string => {
  if (!events || events.length === 0) return '—';
  const sorted = sortProjectEvents(events);
  const validDates = sorted
    .map(e => e.event_date)
    .filter(Boolean)
    .map(dStr => new Date(dStr + 'T00:00:00'))
    .filter(d => !isNaN(d.getTime()));

  if (validDates.length === 0) return '—';
  if (validDates.length === 1) {
    const d = validDates[0];
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  }

  const first = validDates[0];
  const allSameMonthAndYear = validDates.every(
    d => d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear()
  );

  if (allSameMonthAndYear) {
    const uniqueDays = Array.from(new Set(validDates.map(d => d.getDate()))).sort((a, b) => a - b);
    const month = first.toLocaleString('en-US', { month: 'long' });
    const year = first.getFullYear();
    if (uniqueDays.length === 2) {
      return `${uniqueDays[0]} & ${uniqueDays[1]} ${month} ${year}`;
    }
    const lastDay = uniqueDays[uniqueDays.length - 1];
    const initialDays = uniqueDays.slice(0, -1).join(', ');
    return `${initialDays} & ${lastDay} ${month} ${year}`;
  }

  return validDates
    .map(d => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`)
    .join(', ');
};

export const formatEventDatesForFilename = (
  startDateStr?: string,
  endDateStr?: string
): string => {
  if (!startDateStr) return 'Date-TBD';
  if (!endDateStr || startDateStr === endDateStr) {
    const d = new Date(startDateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return startDateStr;
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  const d1 = new Date(startDateStr + 'T00:00:00');
  const d2 = new Date(endDateStr + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return `${startDateStr} to ${endDateStr}`;
  }

  // Same month & year
  if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
    const month = d1.toLocaleString('en-US', { month: 'short' });
    const year = d1.getFullYear();
    const dayDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) {
      return `${d1.getDate()},${d2.getDate()} ${month} ${year}`;
    }
    return `${d1.getDate()}-${d2.getDate()} ${month} ${year}`;
  }

  const m1 = d1.toLocaleString('en-US', { month: 'short' });
  const m2 = d2.toLocaleString('en-US', { month: 'short' });
  const y1 = d1.getFullYear();
  const y2 = d2.getFullYear();
  if (y1 === y2) {
    return `${d1.getDate()} ${m1} - ${d2.getDate()} ${m2} ${y1}`;
  }
  return `${d1.getDate()} ${m1} ${y1} - ${d2.getDate()} ${m2} ${y2}`;
};

export const getOrderFormFilename = (
  project: Project,
  client: Client | undefined,
  company: Company
): string => {
  const isTWB = company.code === 'twb';
  const brandPrefix = isTWB ? 'TWB' : 'GJ';

  const datesStr = (project.events && project.events.length > 0)
    ? formatProjectEventsForFilename(project.events)
    : formatEventDatesForFilename(project.wedding_date_start, project.wedding_date_end);

  let clientNameStr = '';
  if (client?.name) {
    clientNameStr = client.partner_name
      ? `${client.name} & ${client.partner_name}`
      : client.name;
  } else {
    clientNameStr = project.name.split('•')[0].trim();
  }

  const cityStr = (project.city || 'India').split(',')[0].trim();
  const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '').trim();

  return `${brandPrefix}-Order_${datesStr} - ${sanitize(clientNameStr)} - ${sanitize(cityStr)}.pdf`;
};

export const formatEventDatesForDisplay = (
  startDateStr?: string,
  endDateStr?: string
): string => {
  if (!startDateStr) return 'Dates to be announced';
  if (!endDateStr || startDateStr === endDateStr) {
    const d = new Date(startDateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return startDateStr;
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  const d1 = new Date(startDateStr + 'T00:00:00');
  const d2 = new Date(endDateStr + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return `${startDateStr} to ${endDateStr}`;
  }

  const m1 = d1.toLocaleString('en-US', { month: 'short' });
  const m2 = d2.toLocaleString('en-US', { month: 'short' });
  const y1 = d1.getFullYear();
  const y2 = d2.getFullYear();

  if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
    const month = d1.toLocaleString('en-US', { month: 'long' });
    const year = d1.getFullYear();
    const dayDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) {
      return `${d1.getDate()} & ${d2.getDate()} ${month} ${year}`;
    }
    return `${d1.getDate()} to ${d2.getDate()} ${month} ${year}`;
  }

  if (y1 === y2) {
    return `${d1.getDate()} ${m1} to ${d2.getDate()} ${m2} ${y1}`;
  }
  return `${d1.getDate()} ${m1} ${y1} to ${d2.getDate()} ${m2} ${y2}`;
};

export const formatIndianNumber = (val: number): string => {
  const num = Math.round(Number(val) || 0);
  return num.toLocaleString('en-IN');
};

export const drawRupeeGlyph = (
  doc: jsPDF,
  x: number,
  baselineY: number,
  fontSize: number,
  color: number[]
): number => {
  const h = fontSize * 0.32;
  const w = h * 0.62;
  const stroke = Math.max(0.18, fontSize * 0.024);
  const topY = baselineY - h * 0.88;
  const bar2Y = baselineY - h * 0.62;
  const waistY = baselineY - h * 0.38;
  const stemX = x + stroke * 0.5;

  doc.saveGraphicsState();
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(stroke);
  doc.setLineCap('butt');

  // Top horizontal bar
  doc.line(x, topY, x + w, topY);
  // Second horizontal bar
  doc.line(x, bar2Y, x + w * 0.82, bar2Y);
  // Vertical stem
  doc.line(stemX, topY, stemX, waistY);
  // Upper arc (P-loop)
  const arcRight = x + w * 0.82;
  const arcMidY = (topY + waistY) / 2;
  doc.lines(
    [[arcRight - stemX, (arcMidY - topY) * 0.5, arcRight - stemX, (arcMidY - topY) * 1.5, 0, waistY - topY]],
    stemX,
    topY
  );
  // Diagonal leg
  doc.line(stemX, waistY, x + w * 0.95, baselineY);

  doc.restoreGraphicsState();
  return w + stroke;
};

export const renderRupeeAmount = (
  doc: jsPDF,
  val: number,
  x: number,
  y: number,
  options?: { fontSize?: number; bold?: boolean; color?: number[]; alignRight?: boolean }
): number => {
  const fontSize = options?.fontSize || 10;
  const isBold = options?.bold ?? true;
  const color = options?.color || [15, 23, 42];
  const numStr = formatIndianNumber(val);

  doc.setFont('helvetica', isBold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);

  const numWidth = doc.getTextWidth(numStr);
  const glyphW = fontSize * 0.32 * 0.62 + 0.3;
  const totalW = glyphW + 0.8 + numWidth;

  let startX = x;
  if (options?.alignRight) {
    startX = x - totalW;
  }

  drawRupeeGlyph(doc, startX, y, fontSize, color);
  doc.text(numStr, startX + glyphW + 0.8, y);
  return totalW;
};

export const renderTextLineWithRupee = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: number[]
): void => {
  if (!text.includes('₹')) {
    doc.text(text, x, y);
    return;
  }

  const parts = text.split('₹');
  let currentX = x;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) {
      doc.text(parts[i], currentX, y);
      currentX += doc.getTextWidth(parts[i]);
    }
    if (i < parts.length - 1) {
      const glyphWidth = drawRupeeGlyph(doc, currentX, y, fontSize, color);
      currentX += glyphWidth + 0.3;
    }
  }
};

export const renderParagraphWithRupee = (
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number,
  color: number[]
): number => {
  const rawLines = doc.splitTextToSize(text, maxWidth);
  let curY = startY;
  for (const line of rawLines) {
    renderTextLineWithRupee(doc, line, x, curY, fontSize, color);
    curY += lineHeight;
  }
  return curY;
};

export const renderHangingBulletItem = (
  doc: jsPDF,
  bulletText: string,
  bulletX: number,
  textX: number,
  curY: number,
  availableWidth: number,
  lineHeight: number
): number => {
  const lines = doc.splitTextToSize(bulletText, availableWidth);
  doc.text('•', bulletX, curY);
  lines.forEach((line: string, idx: number) => {
    doc.text(line, textX, curY + idx * lineHeight);
  });
  return curY + lines.length * lineHeight;
};

export interface DayScheduleItem {
  dayNum: number;
  dateStr: string;
  eventName?: string;
  eventTime?: string;
  eventAddress?: string;
  eventNotes?: string;
  team?: string;
  venue?: string;
  coveragePoints: string[];
}

export const extractDayWiseSchedule = (project: Project): DayScheduleItem[] => {
  const primaryVenue = project.venue
    ? `${project.venue}, ${project.city || ''}`
    : (project.city || 'Principal Venue');

  // FIRST PRIORITY: Pull directly from project_events / project.events if present
  if (project.events && project.events.length > 0) {
    const sorted = sortProjectEvents(project.events);

    return sorted.map((evt, idx) => {
      let dateDisplay = evt.event_date;
      const d = new Date(evt.event_date + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const month = d.toLocaleString('en-US', { month: 'long' });
        const year = d.getFullYear();
        dateDisplay = `${day} ${month} ${year}`;
      }

            return {
        dayNum: idx + 1,
        dateStr: dateDisplay,
        eventName: evt.event_name,
        eventTime: evt.event_time,
        eventAddress: evt.event_address,
        eventNotes: evt.event_notes,
        team: evt.team,
        venue: evt.event_address || primaryVenue,
        coveragePoints: [],
      };
    });
  }

  const startDateStr = project.wedding_date_start;
  const endDateStr = project.wedding_date_end;

  const d1 = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
  const d2 = endDateStr ? new Date(endDateStr + 'T00:00:00') : null;

  const datesList: { dateStr: string; fullDate: string }[] = [];
  if (d1 && !isNaN(d1.getTime())) {
    if (!d2 || isNaN(d2.getTime()) || d1.getTime() === d2.getTime()) {
      const month = d1.toLocaleString('en-US', { month: 'long' });
      datesList.push({
        dateStr: `${d1.getDate()} ${month} ${d1.getFullYear()}`,
        fullDate: d1.toISOString().split('T')[0],
      });
    } else {
      const dayDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff >= 0 && dayDiff <= 6) {
        for (let i = 0; i <= dayDiff; i++) {
          const cur = new Date(d1.getTime() + i * 24 * 60 * 60 * 1000);
          const month = cur.toLocaleString('en-US', { month: 'long' });
          datesList.push({
            dateStr: `${cur.getDate()} ${month} ${cur.getFullYear()}`,
            fullDate: cur.toISOString().split('T')[0],
          });
        }
      } else {
        const m1 = d1.toLocaleString('en-US', { month: 'long' });
        const m2 = d2.toLocaleString('en-US', { month: 'long' });
        datesList.push({ dateStr: `${d1.getDate()} ${m1} ${d1.getFullYear()}`, fullDate: startDateStr || '' });
        datesList.push({ dateStr: `${d2.getDate()} ${m2} ${d2.getFullYear()}`, fullDate: endDateStr || '' });
      }
    }
  }

  const rawDetails = (project.package_details || '').trim();

  // Check for explicit "DAY 1", "Day 1" structure in package_details
  const dayRegex = /(?:^|\n|\.\s+)(?:DAY\s*(\d+)|Day\s*(\d+))(?:\s*[:—–-]\s*|\s+)([\s\S]*?)(?=(?:\nDAY\s*\d+|\nDay\s*\d+|\.\s+DAY\s*\d+|\.\s+Day\s*\d+|$))/gi;
  const matchedDays: { dayNum: number; content: string }[] = [];
  let match;
  while ((match = dayRegex.exec(rawDetails)) !== null) {
    const num = parseInt(match[1] || match[2], 10);
    matchedDays.push({ dayNum: num, content: match[3].trim() });
  }

  if (matchedDays.length > 0) {
    return matchedDays.map((m, idx) => {
      const dateObj = datesList[idx] || (datesList[0] ? { dateStr: `${datesList[0].dateStr} (Day ${m.dayNum})`, fullDate: '' } : { dateStr: `Day ${m.dayNum}`, fullDate: '' });
      const lines = m.content.split('\n').map(l => l.trim()).filter(Boolean);
      let eventName = '';
      let venue = primaryVenue;
      const coveragePoints: string[] = [];

      for (const line of lines) {
        if (/^event\s*[:—–-]/i.test(line)) {
          eventName = line.replace(/^event\s*[:—–-]\s*/i, '').trim();
        } else if (/^venue\s*[:—–-]/i.test(line)) {
          venue = line.replace(/^venue\s*[:—–-]\s*/i, '').trim();
        } else if (/^coverage\s*[:—–-]/i.test(line)) {
          const rest = line.replace(/^coverage\s*[:—–-]\s*/i, '').trim();
          if (rest) coveragePoints.push(rest);
        } else {
          const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
          if (cleaned) coveragePoints.push(cleaned);
        }
      }

      if (coveragePoints.length === 0) {
        coveragePoints.push('Principal Cinematography & Editorial Stills Crew');
      }

      return {
        dayNum: m.dayNum,
        dateStr: dateObj.dateStr,
        eventName: eventName || undefined,
        venue: venue || undefined,
        coveragePoints,
      };
    });
  }

  // If no explicit DAY 1 / DAY 2, but multi-day project
  if (datesList.length > 1) {
    // Check if ceremonies are named e.g. "Mehendi / Sangeet / Baraat & Reception" or "Welcome Bonfire + Wedding Day"
    const slashMatches = rawDetails.match(/([^.,\n/]+)\s*[/+]\s*([^.,\n/]+)(?:\s*[/+]\s*([^.,\n/]+))?/);
    const parsedEvents: string[] = [];
    if (slashMatches) {
      if (slashMatches[1]) parsedEvents.push(slashMatches[1].trim());
      if (slashMatches[2]) parsedEvents.push(slashMatches[2].trim());
      if (slashMatches[3]) parsedEvents.push(slashMatches[3].trim());
    }

    const commaParts = rawDetails
      .split(/[,;\n]/)
      .map(s => s.replace(/^[•\-*]\s*/, '').trim())
      .filter(s => s.length > 4 && !/^\d+\s*days?/i.test(s));

    return datesList.map((dObj, idx) => {
      const dayNum = idx + 1;
      let eventName = parsedEvents[idx];
      if (!eventName) {
        if (dayNum === 1) eventName = 'Pre-Wedding Celebrations & Welcome Ceremonies';
        else if (dayNum === datesList.length) eventName = 'Wedding Ceremony & Reception';
        else eventName = 'Traditional Festivities & Celebrations';
      }

      const coveragePoints: string[] = [];
      if (idx === 0) {
        coveragePoints.push('Multi-camera Principal Cinematography & Editorial Stills Crew');
        if (commaParts.some(p => /drone/i.test(p))) {
          coveragePoints.push('Aerial Drone Cinematography (where airspace permits)');
        }
        if (commaParts.some(p => /sound|audio/i.test(p))) {
          coveragePoints.push('Multi-track 32-bit Float Audio & Ambient Sound Recording');
        }
      } else if (idx === datesList.length - 1) {
        coveragePoints.push('Full Wedding Ceremony & Evening Reception Master Coverage');
        coveragePoints.push('Lead Editorial Portraits, Candid Stills & Multicam Speeches');
      } else {
        coveragePoints.push('Complete Festivities, Sangeet / Evening Event & Stills Coverage');
      }

      return {
        dayNum,
        dateStr: dObj.dateStr,
        eventName,
        venue: primaryVenue,
        coveragePoints,
      };
    });
  }

  // 1-Day Project: Clean bullets from package_details
  const bulletItems = rawDetails
    .split(/[,;\n]/)
    .map(s => s.replace(/^[•\-*]\s*/, '').trim())
    .filter(s => s.length > 3);

  const coveragePoints: string[] = [];
  if (bulletItems.length > 0) {
    bulletItems.forEach(item => {
      coveragePoints.push(item);
    });
  } else {
    coveragePoints.push('Comprehensive Principal Cinematography & Editorial Photography');
    coveragePoints.push('4K Signature Master Highlight Film & Full Multicam Documentary Edit');
    coveragePoints.push('Color-Graded High-Resolution Digital Photo Archive');
  }

  return [
    {
      dayNum: 1,
      dateStr: datesList[0]?.dateStr || startDateStr || 'Commissioned Wedding Date',
      venue: primaryVenue,
      coveragePoints,
    },
  ];
};

export const extractProjectDeliverablesList = (
  project: Project,
  deliverablesList?: Deliverable[]
): string[] => {
  const items: string[] = [];

  const addUnique = (val: string) => {
    const clean = val.replace(/^[•\-*]\s*/, '').trim();
    if (!clean) return;
    if (!items.some(existing => existing.toLowerCase() === clean.toLowerCase())) {
      items.push(clean);
    }
  };

  // 1. Explicit deliverable records belonging to the current project
  if (deliverablesList && deliverablesList.length > 0) {
    deliverablesList.forEach(d => {
      if (d.deliverable_type) {
        addUnique(d.deliverable_type);
      }
    });
  }

  // 2. Deliverables and inclusions from package_details if present
  const rawDetails = (project.package_details || '').trim();
  if (rawDetails) {
    const match = rawDetails.match(
      /(?:DELIVERABLES|Deliverables)\s*[:—–-]\s*([\s\S]*?)(?=(?:\n[A-Z\s]{4,}:|$))/i
    );
    const targetText = match ? match[1] : rawDetails;

    // Split by newlines, bullet characters, or semicolons
    const lines = targetText
      .split(/[\n;•]+/)
      .map(s => s.replace(/^[•\-*]\s*/, '').trim())
      .filter(Boolean);

    lines.forEach(line => {
      const lower = line.toLowerCase();
      // Skip pure crew / hour coverage specs that are part of coverage scope
      if (/^\d+\s*hours?\s*\d*x?\s*(cinematographer|photographer)/i.test(lower)) {
        return;
      }
      if (/^\d+x\s*(cinematographer|photographer)/i.test(lower)) {
        return;
      }
      if (/^day\s*\d+\s*coverage/i.test(lower)) {
        return;
      }

      addUnique(line);
    });
  }

  if (items.length === 0) {
    items.push('Full Wedding Film & Color-Graded Digital Photo Archive');
  }

  return items;
};

export interface CategorizedDeliverable {
  category: string;
  items: string[];
}

export const extractCategorizedDeliverables = (
  project: Project,
  deliverablesList?: Deliverable[]
): CategorizedDeliverable[] => {
  const allItems = extractProjectDeliverablesList(project, deliverablesList);
  return [{ category: 'DELIVERABLES', items: allItems }];
};

export const generateOrderFormPDF = (
  project: Project,
  client: Client | undefined,
  company: Company,
  deliverables?: Deliverable[],
  payments: Payment[] = []
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const officialCompany = getOfficialCompanyInfo(company);

  // Strictly Black & White Palette — No color/grey boxes (CamTom reference style)
  const colorBlack = [0, 0, 0];
  const colorBody = [40, 40, 40];
  const colorMuted = [90, 90, 90];
  const colorLine = [210, 210, 210];

  const dateFiled = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const clientTitle = client
    ? client.partner_name
      ? `${client.name} & ${client.partner_name}`
      : client.name
    : project.name.split('•')[0].trim();

  const clientPhone = client?.phone || project.client_contact?.phone || '—';
  const clientEmail = client?.email || project.client_contact?.email || '—';
  const clientResidence = client?.address
    ? `${client.address}, ${project.city || ''}`.trim()
    : project.city || '—';

  const eventDatesFormatted = (project.events && project.events.length > 0)
    ? formatProjectEventsDateSummary(project.events)
    : formatEventDatesForDisplay(
        project.wedding_date_start,
        project.wedding_date_end
      );

  const venueCityStr = project.venue
    ? `${project.venue}, ${project.city || 'India'}`
    : project.city || 'Venue to be finalized';

  const totalContractFee = Number(project.total_amount) || 0;
  // Calculate verified payment receipts strictly from actual payment records
  const amountReceived = (payments || [])
    .filter(p => p.project_id === project.id)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingBalance = Math.max(0, totalContractFee - amountReceived);

  // Preserve existing automatic filename logic
  const properFilename = getOrderFormFilename(project, client, company);
  const originalSave = doc.save.bind(doc);
  (doc as any).save = (filename?: string, options?: any) => {
    return originalSave(properFilename, options);
  };
  (doc as any).filename = properFilename;

  // Helper for pagination & continuation headers
  const checkPageOverflow = (requiredHeight: number, currentY: number): number => {
    if (currentY + requiredHeight > 270) {
      doc.addPage();
      // Continuation mini header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
      doc.text(officialCompany.brandDisplayName, 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
      doc.text('ORDER FORM (CONTINUED)', 195, 18, { align: 'right' });

      doc.setDrawColor(colorBlack[0], colorBlack[1], colorBlack[2]);
      doc.setLineWidth(0.2);
      doc.line(15, 22, 195, 22);

      return 28;
    }
    return currentY;
  };

  // =========================================================================
  // PAGE 1: PRODUCTION ORDER OVERVIEW, SCOPE & COMMERCIAL TERMS
  // =========================================================================

  // Brand Header (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text(officialCompany.brandDisplayName, 15, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
  doc.text(officialCompany.tagline, 15, 24);

  doc.setFontSize(7.2);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(
    `${officialCompany.mobile}   |   ${officialCompany.email}   |   ${officialCompany.website}`,
    15,
    28.5
  );

  // Document Title & Date (Right) — Client-facing only, NO internal order reference
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('ORDER FORM', 195, 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
  doc.text(`Date: ${dateFiled}`, 195, 25, { align: 'right' });

  // Thin separator line below header
  doc.setDrawColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.setLineWidth(0.2);
  doc.line(15, 32, 195, 32);

  // Consistent vertical gap from Header → Client & Event Profile (~one normal line of whitespace)
  let curY = 41.5;

  // -------------------------------------------------------------------------
  // SECTION 1: CLIENT & EVENT PROFILE (Clean, minimal, NO grey box)
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('CLIENT & EVENT PROFILE', 15, curY);

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY + 2.5, 195, curY + 2.5);

  curY += 7;

  // Left Column (Client Contact)
  const leftX = 15;
  const leftColWidth = 88;
  let leftY = curY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('CLIENT / COUPLE', leftX, leftY);
  leftY += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  const clientTitleLines = doc.splitTextToSize(clientTitle, leftColWidth);
  doc.text(clientTitleLines, leftX, leftY);
  leftY += clientTitleLines.length * 3.6 + 1.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('CONTACT PHONE & EMAIL', leftX, leftY);
  leftY += 3.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
  const contactLines = doc.splitTextToSize(`${clientPhone}   |   ${clientEmail}`, leftColWidth);
  doc.text(contactLines, leftX, leftY);
  leftY += contactLines.length * 3.4;

  if (clientResidence && clientResidence !== '—') {
    leftY += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
    doc.text('ADDRESS / BILLING LOCATION', leftX, leftY);
    leftY += 3.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
    const addrLines = doc.splitTextToSize(clientResidence, leftColWidth);
    doc.text(addrLines, leftX, leftY);
    leftY += addrLines.length * 3.4;
  }

  // Right Column (Event & Dates)
  const rightX = 110;
  const rightColWidth = 85;
  let rightY = curY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('COMMISSIONED WEDDING / EVENT DATES', rightX, rightY);
  rightY += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  const dateLines = doc.splitTextToSize(eventDatesFormatted, rightColWidth);
  doc.text(dateLines, rightX, rightY);
  rightY += dateLines.length * 3.6 + 1.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('PRIMARY VENUE & CITY', rightX, rightY);
  rightY += 3.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
  const venueLines = doc.splitTextToSize(venueCityStr, rightColWidth);
  doc.text(venueLines, rightX, rightY);
  rightY += venueLines.length * 3.4;

  curY = Math.max(leftY, rightY) + 5;

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY, 195, curY);
  curY += 8;

  // -------------------------------------------------------------------------
  // SECTION 2: PACKAGE & PRODUCTION SCOPE (Day-Wise Presentation, NO grey box)
  // -------------------------------------------------------------------------
  curY = checkPageOverflow(30, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('PACKAGE & PRODUCTION SCOPE', 15, curY);

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY + 2.5, 195, curY + 2.5);

  curY += 6.5;

  // Package Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('COMMISSIONED PACKAGE', 15, curY);
  curY += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  const pkgLines = doc.splitTextToSize(
    project.package_name || 'Signature Wedding Photography & Cinema Collection',
    180
  );
  doc.text(pkgLines, 15, curY);
  curY += pkgLines.length * 3.6 + 3.5;

  // Day-wise Schedule
  const daySchedule = extractDayWiseSchedule(project);

  daySchedule.forEach((day, index) => {
    curY = checkPageOverflow(25, curY);

    if (index > 0) {
      doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
      doc.setLineWidth(0.15);
      doc.line(15, curY, 195, curY);
      curY += 4.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
    doc.text(`DAY ${day.dayNum} — ${day.dateStr.toUpperCase()}`, 15, curY);
    curY += 3.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);

       // Event details — only show fields that were actually entered.
    const eventDetails: string[] = [];

    if (day.eventName) {
      eventDetails.push(`Event / Function: ${day.eventName}`);
    }

    if (day.eventAddress || day.venue || project.venue) {
      eventDetails.push(
        `Venue / Location: ${day.eventAddress || day.venue || project.venue || 'Principal Venue'}`
      );
    }

    if (day.eventTime) {
      eventDetails.push(`Scheduled Time: ${day.eventTime}`);
    }

    if (day.team) {
      eventDetails.push(`Team: ${day.team}`);
    }

    if (day.eventNotes) {
      eventDetails.push(`Notes: ${day.eventNotes}`);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);

    eventDetails.forEach(detail => {
      curY = checkPageOverflow(8, curY);
      curY = renderHangingBulletItem(
        doc,
        detail,
        15,
        18.8,
        curY,
        195 - 18.8,
        3.3
      );
      curY += 0.8;
    });

    // Legacy package-based projects may still have coverage points.
    // Keep them as plain bullets without a "Coverage / Production" heading.
    if (eventDetails.length === 0 && day.coveragePoints.length > 0) {
      day.coveragePoints.forEach(pt => {
        curY = checkPageOverflow(8, curY);
        curY = renderHangingBulletItem(
          doc,
          pt,
          15,
          18.8,
          curY,
          195 - 18.8,
          3.3
        );
        curY += 0.8;
      });
    }

    curY += 1.5;
  });

  // -------------------------------------------------------------------------
  // SECTION 3: DELIVERABLES (Clean flat bullet list, NO category headings)
  // -------------------------------------------------------------------------
  const projectDeliverables = extractProjectDeliverablesList(project, deliverables);

  if (projectDeliverables.length > 0) {
    curY += 3.5;
    curY = checkPageOverflow(25, curY);

    doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
    doc.setLineWidth(0.2);
    doc.line(15, curY, 195, curY);
    curY += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
    doc.text('DELIVERABLES', 15, curY);

    doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
    doc.setLineWidth(0.2);
    doc.line(15, curY + 2.5, 195, curY + 2.5);
    curY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);

    projectDeliverables.forEach(item => {
      curY = checkPageOverflow(8, curY);
      curY = renderHangingBulletItem(doc, item, 15, 18.8, curY, 195 - 18.8, 3.3);
      curY += 0.8;
    });
  }

  // -------------------------------------------------------------------------
  // SECTION 4: COMMERCIAL TERMS & PRODUCTION FEES (NO grey cards)
  // -------------------------------------------------------------------------
  curY += 5;
  curY = checkPageOverflow(45, curY);

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY, 195, curY);
  curY += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('COMMERCIAL TERMS & PRODUCTION FEES', 15, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('All values quoted in Indian Rupees (INR)', 195, curY, { align: 'right' });

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY + 2.5, 195, curY + 2.5);

  curY += 7;

  // 3 Metric Columns side by side (clean black & white text only, no colored cards)
  const yCols = curY;

  // Col 1: Total Order Amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('TOTAL ORDER AMOUNT', 15, yCols);

  renderRupeeAmount(doc, totalContractFee, 15, yCols + 6.5, {
    fontSize: 10,
    bold: true,
    color: colorBlack,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('Agreed Production Value', 15, yCols + 10.5);

  // Col 2: Advance / Payment Received
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('ADVANCE / PAYMENT RECEIVED', 78, yCols);

  renderRupeeAmount(doc, amountReceived, 78, yCols + 6.5, {
    fontSize: 10,
    bold: true,
    color: colorBlack,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('Verified Payments Recorded', 78, yCols + 10.5);

  // Col 3: Balance Due
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('BALANCE DUE', 142, yCols);

  renderRupeeAmount(doc, remainingBalance, 142, yCols + 6.5, {
    fontSize: 10,
    bold: true,
    color: colorBlack,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('Payable per Milestones', 142, yCols + 10.5);

  curY = yCols + 14;

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.15);
  doc.line(15, curY, 195, curY);
  // =========================================================================
  // PAGE 2: PAYMENT SCHEDULE & TERMS & CONDITIONS
  // =========================================================================
  doc.addPage();

  // Page 2 Header (Clean black & white)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text(officialCompany.brandDisplayName, 15, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('Wedding Photography & Films', 15, 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('ORDER FORM', 195, 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(`Date: ${dateFiled}`, 195, 23.5, { align: 'right' });

  doc.setDrawColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.setLineWidth(0.2);
  doc.line(15, 26.5, 195, 26.5);

  // Consistent vertical gap from Header → Payment Schedule (~one normal line of whitespace)
  curY = 36;

  // -------------------------------------------------------------------------
  // PAYMENT SCHEDULE
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('PAYMENT SCHEDULE', 15, curY);

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY + 2.5, 195, curY + 2.5);
  curY += 6.5;

  // 1. Booking Fee:
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('1. Booking Fee:', 15, curY);
  curY += 3.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);

  const bookingFeeText =
    'A non-refundable booking fee of ₹20,000 will confirm your reservation and will be deducted from the total package cost.\nAcceptance of the Terms & Conditions shared via email/WhatsApp is required for booking confirmation.';

  curY = renderParagraphWithRupee(
    doc,
    bookingFeeText,
    15,
    curY,
    180,
    3.4,
    6.8,
    colorBody
  );
  curY += 3.0;

  // 2. Payment Schedule for Remaining Amount:
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('2. Payment Schedule for Remaining Amount:', 15, curY);
  curY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);

  const remainingBullets = [
    '50% of the total amount should be paid 15 days before the main event day.',
    '30% of the total amount should be paid on the wedding day.',
    '10% of the total amount should be paid at the time of photograph delivery.',
    'The remaining 10% of the total amount should be paid at the time of edited video delivery.',
  ];

  const payBulletX = 15;
  const payTextX = 18.8;
  const payAvailableWidth = 195 - payTextX;
  const payLineHeight = 3.3;
  const payBulletSpacing = 1.0;

  remainingBullets.forEach(bText => {
    const lines = doc.splitTextToSize(bText, payAvailableWidth);
    curY = checkPageOverflow(lines.length * payLineHeight + payBulletSpacing, curY);
    doc.text('•', payBulletX, curY);
    lines.forEach((line: string, idx: number) => {
      doc.text(line, payTextX, curY + idx * payLineHeight);
    });
    curY += lines.length * payLineHeight + payBulletSpacing;
  });
  // Consistent vertical gap from Payment Schedule → Terms & Conditions (~one normal line of whitespace)
  curY += 9;

  // -------------------------------------------------------------------------
  // TERMS & CONDITIONS (Immediately underneath Payment Schedule on the SAME PAGE)
  // -------------------------------------------------------------------------
  curY = checkPageOverflow(25, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
  doc.text('TERMS & CONDITIONS', 15, curY);

  doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
  doc.setLineWidth(0.2);
  doc.line(15, curY + 2.5, 195, curY + 2.5);

  curY += 6.5;

  // Retrieve project-specific active clauses
  const activeClauses = getProjectClauses(project.id, project.terms_clauses).filter(c => c.enabled);

  activeClauses.forEach((clause, idx) => {
    const bodyLines = doc.splitTextToSize(clause.body, 180);
    const clauseHeight = 3.5 + bodyLines.length * 3.1 + 2.8;

    curY = checkPageOverflow(clauseHeight, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(colorBlack[0], colorBlack[1], colorBlack[2]);
    doc.text(`${idx + 1}. ${clause.title}`, 15, curY);
    curY += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(colorBody[0], colorBody[1], colorBody[2]);
    doc.text(bodyLines, 15, curY);
    curY += bodyLines.length * 3.1 + 2.8;
  });

  // SIGNATURE SECTION IS COMPLETELY REMOVED (Per User Request)

  // =========================================================================
  // FOOTERS ON ALL PAGES (Clean, Professional, NO internal IDs)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setDrawColor(colorLine[0], colorLine[1], colorLine[2]);
    doc.setLineWidth(0.2);
    doc.line(15, 282, 195, 282);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
    doc.text(
      `${officialCompany.brandDisplayName}   •   ${officialCompany.tagline}`,
      15,
      286.5
    );
    doc.text(`Page ${p} of ${totalPages}`, 195, 286.5, { align: 'right' });
  }

  return doc;
};

