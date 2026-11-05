import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  Calendar,
  Sparkles,
  Percent,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Enquiry, Company, Quotation, QuotationLineItem, QuotationState } from '../../types';
import { generateQuotationPDF, downloadPdfDoc } from '../../utils/pdfGenerator';
import { formatDisplayDate } from '../../utils/dateUtils';

interface QuotationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  company: Company;
  existingQuotation?: Quotation | null;
  onSaveQuotation: (quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at'> | Quotation) => Promise<void>;
}

const TEMPLATE_ITEMS = [
  {
    description: 'Principal 4K Wedding Cinematography (2 Senior Cinematographers, Full Day Coverage)',
    quantity: 1,
    rate: 150000,
  },
  {
    description: 'Secondary Shooter & Aerial Drone 4K Baraat & Venue Coverage',
    quantity: 1,
    rate: 50000,
  },
  {
    description: 'Editorial Teaser (60s Reel) + Highlight Feature Film (12-15 mins) Master in 4K',
    quantity: 1,
    rate: 45000,
  },
  {
    description: 'Pre-Wedding Conceptual Couple Film (1-Day Shoot on Location + Color Grade)',
    quantity: 1,
    rate: 60000,
  },
  {
    description: 'Same-Day Edit (SDE) Reception Teaser Screened at Gala Dinner',
    quantity: 1,
    rate: 35000,
  },
  {
    description: 'Archival Master Hard Drive containing All Raw Footage and Multi-Cam Cuts',
    quantity: 1,
    rate: 20000,
  },
];

export const QuotationBuilderModal: React.FC<QuotationBuilderModalProps> = ({
  isOpen,
  onClose,
  enquiry,
  company,
  existingQuotation,
  onSaveQuotation,
}) => {
  const [items, setItems] = useState<QuotationLineItem[]>([]);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<QuotationState>('Draft');
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // Default: No additional tax unless explicitly selected
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(
    'Dates and crew allocation are reserved upon receipt of advance booking deposit.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (existingQuotation) {
      setQuotationNumber(existingQuotation.quotation_number);
      setVersion(existingQuotation.version || 1);
      setStatus(existingQuotation.status || 'Draft');
      setIssueDate(existingQuotation.issue_date || new Date().toISOString().slice(0, 10));
      setValidUntil(
        existingQuotation.valid_until ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
      setItems(existingQuotation.items || []);
      setDiscount(existingQuotation.discount || 0);
      setTaxRate(existingQuotation.tax_rate ?? 0);
      setNotes(existingQuotation.notes || '');
      setPaymentTerms(existingQuotation.payment_terms || 'Dates and crew allocation are reserved upon receipt of advance booking deposit.');
    } else {
      const code = (company?.code || 'TWB').toUpperCase();
      const randomSeq = enquiry.id.replace('enq-', '').slice(-4).toUpperCase() || '101';
      setQuotationNumber(`QT-${code}-2026-${randomSeq}`);
      setVersion(1);
      setStatus('Draft');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setDiscount(0);
      setTaxRate(0); // Default: No additional tax
      setNotes('All deliverables delivered via high-speed private cloud gallery. Travel & accommodation outside base city covered by client.');
      setPaymentTerms('Dates and crew allocation are reserved upon receipt of advance booking deposit.');

      // Seed items based on estimated budget
      const budget = enquiry.estimated_budget || 200000;
      setItems([
        {
          id: 'item-1',
          description: `Principal 4K Wedding Cinematography Coverage (${company?.name || 'The Wedding Booth'})`,
          quantity: 1,
          rate: Math.round(budget * 0.6),
          amount: Math.round(budget * 0.6),
        },
        {
          id: 'item-2',
          description: 'Secondary Shooter & Aerial Drone 4K Coverage',
          quantity: 1,
          rate: Math.round(budget * 0.25),
          amount: Math.round(budget * 0.25),
        },
        {
          id: 'item-3',
          description: 'Editorial Teaser (60s) + Highlight Feature Film Master + Cloud Delivery',
          quantity: 1,
          rate: Math.round(budget * 0.15),
          amount: Math.round(budget * 0.15),
        },
      ]);
    }
  }, [existingQuotation, enquiry, company, isOpen]);

  if (!isOpen) return null;

  // Calculation helpers
  const subtotal = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * taxRate);
  const grandTotal = taxable + taxAmount;

  const handleUpdateItem = (id: string, field: keyof QuotationLineItem, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
        }
        return updated;
      })
    );
  };

  const handleAddItem = (preset?: typeof TEMPLATE_ITEMS[0]) => {
    const newItem: QuotationLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: preset?.description || 'Custom Wedding Coverage Service',
      quantity: preset?.quantity || 1,
      rate: preset?.rate || 25000,
      amount: (preset?.quantity || 1) * (preset?.rate || 25000),
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleCreateRevision = () => {
    setVersion(prev => prev + 1);
    setStatus('Draft');
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        enquiry_id: enquiry.id,
        company_id: company.id,
        quotation_number: quotationNumber,
        version,
        status,
        issue_date: issueDate,
        valid_until: validUntil,
        items,
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: grandTotal,
        notes: notes.trim() || undefined,
        payment_terms: paymentTerms.trim() || undefined,
      };

      if (existingQuotation) {
        if (version > (existingQuotation.version || 1)) {
          // Creating a new revision preserves previous revisions!
          await onSaveQuotation({
            ...payload,
            version,
          });
        } else {
          await onSaveQuotation({
            ...existingQuotation,
            ...payload,
          });
        }
      } else {
        await onSaveQuotation(payload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save quotation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    const currentQuoteObject: Quotation = {
      id: existingQuotation?.id || 'temp-quote',
      enquiry_id: enquiry.id,
      company_id: company.id,
      quotation_number: quotationNumber,
      version,
      status,
      issue_date: issueDate,
      valid_until: validUntil,
      items,
      subtotal,
      discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: grandTotal,
      notes,
      payment_terms: paymentTerms,
      created_at: new Date().toISOString(),
    };

    const doc = generateQuotationPDF(enquiry, company, currentQuoteObject);
    const filename = `${company.code.toUpperCase()}-Quotation-${quotationNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_v${version}.pdf`;
    downloadPdfDoc(doc, filename);
  };

  const isTWB = company.code === 'twb';
  const coupleName = enquiry.partner_name
    ? `${enquiry.client_name} & ${enquiry.partner_name}`
    : enquiry.client_name;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 my-6 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                isTWB ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {isTWB ? 'TWB' : 'GJ'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Official Wedding Quotation Builder
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  Rev v{version}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    status === 'Sent'
                      ? 'bg-blue-100 text-blue-800'
                      : status === 'Accepted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : status === 'Rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Prepared for <strong className="text-slate-800">{coupleName}</strong> • {enquiry.venue}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'editor'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Line Items
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>A4 Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs pr-1">
          {activeTab === 'editor' ? (
            <>
              {/* Quotation Metadata Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quotation Ref #
                  </label>
                  <input
                    type="text"
                    value={quotationNumber}
                    onChange={e => setQuotationNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Valid Until (Expiry)
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quotation State
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as QuotationState)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-800"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent to Client</option>
                    <option value="Accepted">Accepted / Confirmed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Template Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">
                  Quick Add:
                </span>
                {TEMPLATE_ITEMS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddItem(preset)}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>{preset.description.split('(')[0].trim().slice(0, 32)}</span>
                  </button>
                ))}
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-900 text-white grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider">
                  <div className="col-span-6 sm:col-span-7">Description / Scope</div>
                  <div className="col-span-2 sm:col-span-1 text-center">Qty</div>
                  <div className="col-span-2 sm:col-span-2 text-right">Rate (₹)</div>
                  <div className="col-span-2 sm:col-span-2 text-right">Amount (₹)</div>
                </div>

                <div className="divide-y divide-slate-100 bg-white">
                  {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-50/50">
                      <div className="col-span-6 sm:col-span-7 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono w-4">{index + 1}.</span>
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                          placeholder="Scope description..."
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-full px-1.5 py-1 text-center text-xs border border-slate-200 rounded-md"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <input
                          type="number"
                          step="1000"
                          value={item.rate}
                          onChange={e => handleUpdateItem(item.id, 'rate', Number(e.target.value))}
                          className="w-full px-2 py-1 text-right text-xs font-mono border border-slate-200 rounded-md"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1.5">
                        <span className="font-bold text-slate-900 font-mono text-xs">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="p-6 text-center text-slate-400">
                      No scope line items added yet. Click "+ Add Line Item" or choose a quick template above.
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Custom Line Item</span>
                  </button>

                  <div className="text-right">
                    <span className="text-slate-500 mr-2">Items Subtotal:</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Totals & Discounts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Deliverables & Scope Notes (Included on Quotation)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Special stipulations: Raw footage delivery on SSD, cloud backup for 1 year, teaser turn-around..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Milestone Payment Terms
                    </label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">Special Discount (₹)</span>
                    <div className="w-32">
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={discount}
                        onChange={e => setDiscount(Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-right text-xs bg-white border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span>GST / Tax</span>
                      <select
                        value={taxRate}
                        onChange={e => setTaxRate(Number(e.target.value))}
                        className="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5"
                      >
                        <option value="0">0% (Nil)</option>
                        <option value="0.18">18% (Standard GST)</option>
                        <option value="0.05">5%</option>
                        <option value="0.12">12%</option>
                      </select>
                    </div>
                    <span className="font-mono text-slate-700">₹{taxAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900 font-bold text-sm">
                    <span>Total Investment (₹)</span>
                    <span className="text-base text-red-600 font-mono">
                      ₹{grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Interactive Live A4 Preview */
            <div className="bg-slate-100 p-4 sm:p-6 rounded-xl border border-slate-200 flex justify-center">
              <div className="bg-white shadow-lg rounded-lg border border-slate-200 w-full max-w-[620px] p-6 text-slate-800 space-y-4">
                {/* Official Brand Header Preview */}
                <div
                  className={`p-4 rounded-lg text-white ${
                    isTWB ? 'bg-slate-900 border-b-4 border-blue-600' : 'bg-[#3b2207] border-b-4 border-amber-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg tracking-wide uppercase">
                        {isTWB ? 'The Wedding Booth' : 'Golden June Films'}
                      </h3>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {isTWB ? 'Wedding Photography & Films' : 'Artisanal Wedding Cinema'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {isTWB ? 'dweddingbooth@gmail.com | +91 9074448850' : 'goldenjunefilms@gmail.com | +91 9074963370'}
                      </p>
                    </div>
                    <div className="text-right text-[10px] space-y-0.5 font-mono">
                      <div className="text-slate-300">QUOTATION</div>
                      <div className="font-bold text-white text-xs">{quotationNumber}</div>
                      <div className="text-slate-400">Date: {formatDisplayDate(issueDate)}</div>
                    </div>
                  </div>
                </div>

                {/* Prepared For Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Prepared Exclusively For:
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{coupleName}</div>
                  <div className="text-slate-600 text-[11px]">
                    Event Date: {formatDisplayDate(enquiry.event_date)} • Venue: {enquiry.venue}
                  </div>
                </div>

                {/* Items Preview */}
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-left font-bold text-slate-600">
                      <th className="py-1">Description</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="py-2 pr-2">{item.description}</td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right font-mono">₹{item.rate.toLocaleString('en-IN')}</td>
                        <td className="py-2 text-right font-mono font-semibold">₹{item.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Preview */}
                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <div className="w-48 text-right space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span className="font-mono">-₹{discount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>GST ({Math.round(taxRate * 100)}%):</span>
                        <span className="font-mono">₹{taxAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t text-sm">
                      <span>Total:</span>
                      <span className="font-mono text-red-600">₹{grandTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Bank details info */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 space-y-0.5">
                  <span className="font-bold text-slate-800">Bank Transfer Remittance: </span>
                  <span>{company.bank_details?.bank_name} • Account: {company.bank_details?.account_number} • IFSC: {company.bank_details?.routing_code}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            {existingQuotation && (
              <button
                type="button"
                onClick={handleCreateRevision}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="Create a new revision number for this quotation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New Revision (v{version + 1})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Official PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Quotation Record'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
