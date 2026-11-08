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
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { Enquiry, Company, Quotation, QuotationLineItem, QuotationState } from '../../types';
import { generateQuotationPDF, downloadPdfDoc, getOfficialCompanyInfo } from '../../utils/pdfGenerator';
import { formatDisplayDate } from '../../utils/dateUtils';
import { generateProposalReference, getProposalFilename } from '../../utils/proposalRevisionUtils';

interface QuotationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  company: Company;
  existingQuotation?: Quotation | null;
  allQuotations?: Quotation[];
  onSaveQuotation: (quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at'> | Quotation) => Promise<void>;
}

const TEMPLATE_PRESETS = [
  'Principal 4K Wedding Cinematography (2 Senior Cinematographers, Full Day Coverage)',
  'Secondary Shooter & Aerial Drone 4K Baraat & Venue Coverage',
  'Editorial Teaser (60s Reel) + Highlight Feature Film (12-15 mins) Master in 4K',
  'Pre-Wedding Conceptual Couple Film (1-Day Shoot on Location + Color Grade)',
  'Same-Day Edit (SDE) Reception Teaser Screened at Gala Dinner',
  'Archival Master Hard Drive containing All Raw Footage and Multi-Cam Cuts',
  'Fine Art Wedding Photo Book / Coffee Table Album (100 Pages)',
  'Traditional Stage Multi-Cam Coverage & Live Stream Relay',
];

export const QuotationBuilderModal: React.FC<QuotationBuilderModalProps> = ({
  isOpen,
  onClose,
  enquiry,
  company,
  existingQuotation,
  allQuotations = [],
  onSaveQuotation,
}) => {
  const [items, setItems] = useState<QuotationLineItem[]>([]);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [version, setVersion] = useState(1);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [status, setStatus] = useState<QuotationState>('Draft');
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [packageInvestment, setPackageInvestment] = useState<number>(0);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // Default: Nil unless selected
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(
    'Dates and crew allocation are reserved upon receipt of advance booking retainer.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (!isOpen) return;

    if (existingQuotation) {
      // Editing an existing proposal:
      // Preserve persistent parent identity and unique Proposal Reference
      const pId = existingQuotation.proposal_id || existingQuotation.quotation_number;
      setProposalId(pId);
      setQuotationNumber(existingQuotation.quotation_number);
      setBaseVersion(existingQuotation.version || 1);

      // Automatically calculate next revision: highest existing revision for that proposal + 1
      const matchingRevisions = (allQuotations || []).filter(
        q => (q.proposal_id && q.proposal_id === pId) || q.quotation_number === existingQuotation.quotation_number
      );
      const maxExistingVersion = Math.max(
        ...matchingRevisions.map(r => Number(r.version) || 1),
        Number(existingQuotation.version) || 1,
        1
      );
      setVersion(maxExistingVersion + 1);

      setStatus('Draft');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setValidUntil(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
      setItems((existingQuotation.items || []).map(i => ({ ...i })));
      const existingAmount = existingQuotation.subtotal || existingQuotation.total || existingQuotation.total_amount || 0;
      setPackageInvestment(existingAmount);
      setDiscount(existingQuotation.discount || 0);
      setTaxRate(existingQuotation.tax_rate ?? 0);
      setNotes(existingQuotation.notes || '');
      setPaymentTerms(
        existingQuotation.payment_terms ||
          'Dates and crew allocation are reserved upon receipt of advance booking retainer.'
      );
    } else {
      // Genuinely new proposal: generate a unique Proposal Reference and start at v1
      const newRef = generateProposalReference(company?.code || 'TWB', allQuotations);
      setQuotationNumber(newRef);
      setProposalId(`prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      setBaseVersion(null);
      setVersion(1);
      setStatus('Draft');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setDiscount(0);
      setTaxRate(0);
      setNotes('All deliverables delivered via high-speed private cloud gallery. Travel & accommodation outside base city covered by client.');
      setPaymentTerms('Dates and crew allocation are reserved upon receipt of advance booking retainer.');

      // Automatically pull requested services from the lead if present
      if (enquiry.services && enquiry.services.length > 0) {
        setItems(
          enquiry.services.map((serviceName, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            description: serviceName,
            quantity: 1,
            rate: 0,
            amount: 0,
          }))
        );
      } else {
        // Fallback scope if lead had no services specified
        setItems([
          {
            id: 'item-1',
            description: `Principal 4K Wedding Cinematography Coverage (${company?.name || 'The Wedding Booth'})`,
            quantity: 1,
            rate: 0,
            amount: 0,
          },
          {
            id: 'item-2',
            description: 'Secondary Shooter & Aerial Drone 4K Coverage',
            quantity: 1,
            rate: 0,
            amount: 0,
          },
          {
            id: 'item-3',
            description: 'Editorial Teaser (60s) + Highlight Feature Film Master + Cloud Delivery',
            quantity: 1,
            rate: 0,
            amount: 0,
          },
        ]);
      }

      setPackageInvestment(0);
    }
  }, [existingQuotation, enquiry, company, isOpen, allQuotations]);

  if (!isOpen) return null;

  // Financial calculations: single package amount, optional discount and tax
  const subtotal = Number(packageInvestment) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * taxRate);
  const grandTotal = taxable + taxAmount;

  const handleUpdateItemDescription = (id: string, description: string) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, description } : item))
    );
  };

  const handleAddItem = (desc?: string) => {
    const newItem: QuotationLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: desc || '',
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        proposal_id: proposalId,
        enquiry_id: enquiry.id,
        company_id: (company?.code === 'golden_june' ? 'golden_june' : 'twb') as 'twb' | 'golden_june',
        quotation_number: quotationNumber,
        version,
        status,
        issue_date: issueDate,
        valid_until: validUntil,
        valid_until_date: validUntil,
        items,
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: grandTotal,
        total_amount: grandTotal,
        notes: notes.trim() || undefined,
        payment_terms: paymentTerms.trim() || undefined,
      };

      // Always create a new revision record under the same proposal_id and quotation_number.
      // This strictly preserves all previously saved revisions in database and history without mutating them.
      await onSaveQuotation(payload);
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
      proposal_id: proposalId,
      enquiry_id: enquiry.id,
      company_id: (company?.code === 'golden_june' ? 'golden_june' : 'twb') as 'twb' | 'golden_june',
      quotation_number: quotationNumber,
      version,
      status,
      issue_date: issueDate,
      valid_until: validUntil,
      valid_until_date: validUntil,
      items,
      subtotal,
      discount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: grandTotal,
      total_amount: grandTotal,
      notes,
      payment_terms: paymentTerms,
      created_at: new Date().toISOString(),
    };

    const doc = generateQuotationPDF(enquiry, company, currentQuoteObject);
    const filename = getProposalFilename(company, enquiry, currentQuoteObject);
    downloadPdfDoc(doc, filename);
  };

  const isTWB = company.code === 'twb';
  const officialCompany = getOfficialCompanyInfo(company);
  const coupleName = enquiry.partner_name
    ? `${enquiry.client_name || 'Client'} & ${enquiry.partner_name}`
    : enquiry.client_name || 'Valued Client';
  const leadTitle = enquiry.title || coupleName;

  const cleanVenue = enquiry.venue && enquiry.venue !== 'Principal Venue' ? enquiry.venue.trim() : '';
  const cleanCity = enquiry.city ? enquiry.city.trim() : '';
  const venueCityStr = cleanVenue && cleanCity
    ? `${cleanVenue}, ${cleanCity}`
    : cleanVenue || cleanCity || 'Not specified';

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
                  Commissioned Production Proposal & Scope
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    baseVersion !== null
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  {baseVersion !== null ? `Revision v${version}` : 'Revision v1 (Initial)'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    status === 'Sent'
                      ? 'bg-blue-100 text-blue-800'
                      : status === 'Approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : status === 'Declined'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Prepared for <strong className="text-slate-800">{leadTitle}</strong> • Ref:{' '}
                <span className="font-mono font-semibold text-slate-700">{quotationNumber}</span>
                {baseVersion !== null && (
                  <span className="text-amber-700 ml-1.5 font-medium">(Base: v{baseVersion})</span>
                )}
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
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Proposal Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Client A4 Preview</span>
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
              {/* Proposal Metadata Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Proposal Ref #
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
                    Proposal State
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

              {/* Quick Template Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">
                  Add Scope Preset:
                </span>
                {TEMPLATE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddItem(preset)}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>{preset.split('(')[0].trim().slice(0, 32)}</span>
                  </button>
                ))}
              </div>

              {/* Production Scope (No individual prices, quantities or rates) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-900 text-white grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider">
                  <div className="col-span-1 text-center">No.</div>
                  <div className="col-span-10">Commissioned Services & Production Scope Description</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                <div className="divide-y divide-slate-100 bg-white">
                  {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-50/50">
                      <div className="col-span-1 text-center font-bold text-slate-400 text-xs font-mono">
                        {index + 1}.
                      </div>

                      <div className="col-span-10">
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={e => handleUpdateItemDescription(item.id, e.target.value)}
                          placeholder="Service description, crew allocation, and production deliverable scope..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove service from scope"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      No services in proposal scope yet. Click &quot;+ Add Service to Scope&quot; or choose a quick preset above.
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Service to Scope</span>
                  </button>

                  <div className="text-slate-500 text-xs">
                    <span className="font-semibold text-slate-700">{items.length}</span> scope items included (lump-sum proposal pricing)
                  </div>
                </div>
              </div>

              {/* Commercial Package Pricing & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Notes and Terms */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Deliverables & Scope Notes (Client-Facing)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Special stipulations: Cloud delivery timelines, archival backup period, travel allowances..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
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

                  {/* Private notice */}
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Privacy safeguard:</strong> Internal producer notes, lead qualification, and negotiation logs are completely omitted from client proposals and PDFs.
                    </div>
                  </div>
                </div>

                {/* Overall Package Investment Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <Coins className="w-4 h-4 text-blue-600" />
                        <span>Overall Package Investment (₹)</span>
                      </label>
                      {enquiry.estimated_budget && enquiry.estimated_budget > 0 && subtotal !== enquiry.estimated_budget && (
                        <button
                          type="button"
                          onClick={() => setPackageInvestment(enquiry.estimated_budget || 0)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                          title="Deliberately adopt the lead's internal estimated budget"
                        >
                          Use Lead Budget (₹{enquiry.estimated_budget.toLocaleString('en-IN')})
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={packageInvestment || ''}
                        onChange={e => setPackageInvestment(Number(e.target.value) || 0)}
                        placeholder="Enter agreed package investment (e.g. 350000)"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      One single package fee covering all commissioned services above without individual item pricing.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Special Discount (₹)</span>
                    <div className="w-32">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={discount || ''}
                        onChange={e => setDiscount(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-2 py-1 text-right text-xs bg-white border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
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

                  <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-slate-900 font-bold text-sm">
                    <span>Total Proposal Investment</span>
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
              <div className="bg-white shadow-lg rounded-lg border border-slate-200 w-full max-w-[640px] p-6 text-slate-800 space-y-5">
                {/* Clean Brand Header (Matching Order Form Visual Identity) */}
                <div className="flex justify-between items-start border-b border-black pb-3">
                  <div>
                    <h3 className="font-bold text-base tracking-wide uppercase text-black">
                      {officialCompany.brandDisplayName}
                    </h3>
                    <p className="text-xs text-slate-700 mt-0.5">
                      {officialCompany.tagline}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {officialCompany.mobile}   |   {officialCompany.email}   |   {officialCompany.website}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold text-black text-sm uppercase tracking-wide">
                      PROPOSAL / QUOTATION
                    </div>
                    <div className="text-slate-700 text-xs mt-0.5 font-medium">Ref: {quotationNumber}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">
                      Date: {formatDisplayDate(issueDate)}   |   Valid Until: {formatDisplayDate(validUntil)}
                    </div>
                  </div>
                </div>

                {/* Section 1: Client & Event Profile */}
                <div className="space-y-1.5">
                  <div className="border-b border-slate-200 pb-1">
                    <span className="font-bold text-xs tracking-wider uppercase text-black">
                      Client & Event Profile
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                    <div className="space-y-2">
                      <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Client / Couple
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5">{leadTitle}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Contact Phone & Email
                        </div>
                        <div className="text-slate-700 text-[11px] mt-0.5">
                          {[enquiry.phone, enquiry.email].filter(Boolean).join('   |   ') || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Commissioned Event Dates
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5">
                          {enquiry.event_date ? formatDisplayDate(enquiry.event_date) : 'Date TBD'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Primary Venue & City
                        </div>
                        <div className="text-slate-700 text-[11px] mt-0.5">
                          {venueCityStr}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Commissioned Services & Production Scope */}
                <div className="space-y-1.5">
                  <div className="border-b border-slate-200 pb-1">
                    <span className="font-bold text-xs tracking-wider uppercase text-black">
                      Commissioned Services & Production Scope
                    </span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] font-bold text-slate-600 uppercase">
                        <th className="py-1.5 w-8 text-left">No.</th>
                        <th className="py-1.5">Scope Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-slate-50/60' : ''}>
                          <td className="py-2 text-left font-bold text-slate-400 align-top font-mono text-[11px]">{idx + 1}.</td>
                          <td className="py-2 pr-2 text-slate-800 leading-relaxed text-[11px]">{item.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section 3: Commercial Investment */}
                <div className="space-y-2 pt-1">
                  <div className="border-b border-slate-200 pb-1">
                    <span className="font-bold text-xs tracking-wider uppercase text-black">
                      Commercial Investment
                    </span>
                  </div>

                  {/* Subtotal, discount, GST breakdown if present */}
                  {(discount > 0 || taxAmount > 0) && (
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Package Subtotal:</span>
                        <span className="font-mono text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between">
                          <span>Special Discount:</span>
                          <span className="font-mono text-emerald-700">-₹{discount.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span>GST ({Math.round(taxRate * 100)}%):</span>
                          <span className="font-mono text-slate-800">₹{taxAmount.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total Package Investment - FULL WIDTH, label on left, amount on right, never cramped */}
                  <div className="pt-2 border-t border-slate-300 flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm tracking-wide uppercase text-black">
                      Total Package Investment
                    </span>
                    <span className="font-mono font-bold text-base sm:text-lg text-black">
                      ₹{grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Section 4: Scope & Production Notes (if present) */}
                {notes && notes.trim() && (
                  <div className="space-y-1.5 pt-1">
                    <div className="border-b border-slate-200 pb-1">
                      <span className="font-bold text-xs tracking-wider uppercase text-black">
                        Scope & Production Notes
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line pt-0.5">
                      {notes.trim()}
                    </p>
                  </div>
                )}

                {/* Section 5: Terms & Conditions (if present) */}
                {paymentTerms && paymentTerms.trim() && (
                  <div className="space-y-1.5 pt-1">
                    <div className="border-b border-slate-200 pb-1">
                      <span className="font-bold text-xs tracking-wider uppercase text-black">
                        Terms & Conditions
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-line pt-0.5">
                      {paymentTerms.trim()}
                    </p>
                  </div>
                )}

                {/* Clean Order-Form Style Footer */}
                <div className="border-t border-slate-200 pt-3 mt-4 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{officialCompany.brandDisplayName}   •   {officialCompany.tagline}</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Official PDF (v{version})</span>
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
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : baseVersion !== null
                  ? `Save as Revision v${version}`
                  : 'Save Proposal (v1)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
