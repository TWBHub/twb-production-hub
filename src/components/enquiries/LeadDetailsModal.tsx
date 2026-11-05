import React, { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Clock,
  User,
  Tag,
  DollarSign,
  FileText,
  Download,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Lock,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { Enquiry, Company, Quotation, EnquiryStatus, TeamMember } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';
import { generateQuotationPDF, downloadPdfDoc } from '../../utils/pdfGenerator';

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  company: Company;
  quotations: Quotation[];
  teamMembers: TeamMember[];
  onEditLead: (enquiry: Enquiry) => void;
  onDeleteLead: (enquiry: Enquiry) => void;
  onToggleArchive: (enquiry: Enquiry) => Promise<void>;
  onUpdateStatus: (enquiry: Enquiry, newStatus: EnquiryStatus) => Promise<void>;
  onUpdateFollowUp: (enquiry: Enquiry, newDate?: string) => Promise<void>;
  onSaveNotes: (enquiry: Enquiry, notes: string) => Promise<void>;
  onOpenQuotationBuilder: (enquiry: Enquiry, quoteToEdit?: Quotation | null) => void;
  onOpenConvertModal: (enquiry: Enquiry) => void;
}

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  isOpen,
  onClose,
  enquiry,
  company,
  quotations,
  teamMembers,
  onEditLead,
  onDeleteLead,
  onToggleArchive,
  onUpdateStatus,
  onUpdateFollowUp,
  onSaveNotes,
  onOpenQuotationBuilder,
  onOpenConvertModal,
}) => {
  const [internalNotes, setInternalNotes] = useState(enquiry.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotations' | 'notes'>('overview');

  if (!isOpen) return null;

  const isTWB = enquiry.company_id === 'twb';
  const coupleName = enquiry.partner_name
    ? `${enquiry.client_name} & ${enquiry.partner_name}`
    : enquiry.client_name;

  // Filter quotations for this lead
  const leadQuotes = quotations.filter(q => q.enquiry_id === enquiry.id);

  // Check follow-up status
  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = enquiry.follow_up_date && enquiry.follow_up_date < todayStr && enquiry.status !== 'Won' && enquiry.status !== 'Lost';
  const isDueToday = enquiry.follow_up_date === todayStr && enquiry.status !== 'Won' && enquiry.status !== 'Lost';

  // Days until wedding
  let daysUntilWedding: number | null = null;
  if (enquiry.event_date) {
    const eventTime = new Date(enquiry.event_date).getTime();
    const nowTime = new Date().getTime();
    daysUntilWedding = Math.round((eventTime - nowTime) / (1000 * 60 * 60 * 24));
  }

  // Clean phone for WhatsApp (strip spaces, dashes, brackets, leading +)
  const waPhone = (enquiry.phone || '').replace(/[^0-9]/g, '');

  const handleSaveNotesClick = async () => {
    try {
      setIsSavingNotes(true);
      await onSaveNotes(enquiry, internalNotes);
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDownloadQuote = (quote: Quotation) => {
    const doc = generateQuotationPDF(enquiry, company, quote);
    const filename = `${company.code.toUpperCase()}-Quotation-${quote.quotation_number.replace(/[^a-zA-Z0-9-]/g, '_')}_v${quote.version}.pdf`;
    downloadPdfDoc(doc, filename);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 my-6 max-h-[92vh] flex flex-col">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                isTWB
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              {isTWB ? 'The Wedding Booth' : 'Golden June Films'}
            </span>

            {/* Quick Stage Transition Dropdown */}
            <select
              value={enquiry.status}
              onChange={e => onUpdateStatus(enquiry, e.target.value as EnquiryStatus)}
              className="text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 transition-colors focus:outline-hidden"
            >
              <option value="New">1. New</option>
              <option value="Contacted">2. Contacted</option>
              <option value="Meeting Scheduled">3. Meeting Scheduled</option>
              <option value="Proposal Sent">4. Proposal Sent</option>
              <option value="Won">5. Won</option>
              <option value="Lost">6. Lost</option>
            </select>

            {enquiry.is_archived && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                Archived
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {enquiry.status !== 'Won' && (
              enquiry.is_archived ? (
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'This lead is currently archived. Please restore (unarchive) the lead before converting it to an active project.'
                    )
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 rounded-lg cursor-not-allowed flex items-center gap-1.5"
                  title="Lead is archived - restore to convert"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Convert to Project</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenConvertModal(enquiry)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  title="Convert this lead into an active Project"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Convert to Project</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onEditLead(enquiry)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit Lead Details"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onToggleArchive(enquiry)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title={enquiry.is_archived ? 'Unarchive Lead' : 'Archive Lead'}
            >
              {enquiry.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onDeleteLead(enquiry)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Lead Record"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead Hero Title */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h2 className="text-xl font-bold text-slate-900">{coupleName}</h2>
            <div className="text-sm font-bold text-slate-900 font-mono">
              Est. Budget: <span className="text-red-600">₹{enquiry.estimated_budget?.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDisplayDate(enquiry.event_date)}
              {daysUntilWedding !== null && (
                <span className="text-slate-400 font-medium">
                  ({daysUntilWedding > 0 ? `in ${daysUntilWedding} days` : `${Math.abs(daysUntilWedding)} days ago`})
                </span>
              )}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {enquiry.venue} {enquiry.city ? `(${enquiry.city})` : ''}
            </span>
            <span>•</span>
            <span className="text-slate-400">Source: {enquiry.lead_source}</span>
          </div>
        </div>

        {/* Follow-up Banner if Due or Overdue */}
        {(isOverdue || isDueToday) && (
          <div
            className={`mt-2 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0 ${
              isOverdue
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                <strong>{isOverdue ? 'Overdue Follow-up:' : 'Follow-up Due Today:'}</strong>{' '}
                Scheduled for {formatDisplayDate(enquiry.follow_up_date)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  onUpdateFollowUp(enquiry, d.toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border rounded-md font-semibold text-[11px] shadow-2xs transition-colors"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  onUpdateFollowUp(enquiry, d.toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border rounded-md font-semibold text-[11px] shadow-2xs transition-colors"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => onUpdateFollowUp(enquiry, undefined)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-[11px]"
              >
                Done / Clear
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 border-b border-slate-200 mt-3 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lead Overview & Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quotations')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'quotations'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Quotations</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {leadQuotes.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3 h-3 text-amber-600" />
            <span>Private Notes</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Contact Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Email:</span>
                    <a
                      href={`mailto:${enquiry.email}`}
                      className="text-blue-600 hover:underline font-medium truncate"
                    >
                      {enquiry.email}
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Phone:</span>
                    <a href={`tel:${enquiry.phone}`} className="hover:text-blue-600 font-medium">
                      {enquiry.phone}
                    </a>
                    {waPhone && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center gap-1"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-700" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Partner:</span>
                    <span className="font-medium text-slate-800">
                      {enquiry.partner_name || 'Not provided'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">City Base:</span>
                    <span className="font-medium text-slate-800">
                      {enquiry.city || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scope & Services */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Services Requested & Scope
                </h4>
                {enquiry.services && enquiry.services.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {enquiry.services.map(srv => (
                      <span
                        key={srv}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-300 text-slate-800 shadow-2xs"
                      >
                        ✓ {srv}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No specific service tags selected.</p>
                )}

                {enquiry.requirements && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="font-semibold text-slate-700">Client Vision:</span>
                    <p className="text-slate-600 mt-1 italic whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200">
                      "{enquiry.requirements}"
                    </p>
                  </div>
                )}
              </div>

              {/* Assignment & Tracking */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Sales Assignment & Tracking Dates
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assigned Producer</span>
                    <span className="font-semibold text-slate-900">
                      {enquiry.assigned_to || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Consultation Call</span>
                    <span className="font-semibold text-slate-900">
                      {enquiry.consultation_date ? formatDisplayDate(enquiry.consultation_date) : 'Not scheduled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Next Follow-up</span>
                    <span className="font-semibold text-slate-900">
                      {enquiry.follow_up_date ? formatDisplayDate(enquiry.follow_up_date) : 'None set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quotations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Quotation History</h4>
                  <p className="text-xs text-slate-500">
                    Custom itemized proposals created for this lead.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenQuotationBuilder(enquiry, null)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Quotation</span>
                </button>
              </div>

              {leadQuotes.length > 0 ? (
                <div className="space-y-3">
                  {leadQuotes.map(quote => (
                    <div
                      key={quote.id}
                      className="bg-slate-50 hover:bg-slate-100/70 p-4 rounded-xl border border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {quote.quotation_number}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                            v{quote.version}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              quote.status === 'Sent'
                                ? 'bg-blue-100 text-blue-800'
                                : quote.status === 'Accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : quote.status === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Issued: {formatDisplayDate(quote.issue_date)} • Valid until: {formatDisplayDate(quote.valid_until)}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {quote.items?.length || 0} scope items • Total Investment:{' '}
                          <strong className="text-slate-900 font-mono">
                            ₹{quote.total?.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleDownloadQuote(quote)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenQuotationBuilder(enquiry, quote)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-300 text-xs font-semibold transition-colors"
                        >
                          Edit Scope
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <h5 className="font-bold text-slate-800">No Quotations Drafted Yet</h5>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Generate an official itemized wedding quotation with custom packages, GST, and wire payment details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenQuotationBuilder(enquiry, null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Generate First Quotation</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Confidential Internal Notes</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  These private notes are for internal team eyes only. They will never appear on client proposals, PDF orders, or client-facing emails.
                </p>
              </div>

              <div>
                <textarea
                  rows={6}
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Record call summaries, client preferences, budget headroom, special requests, vendor recommendations..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {notesSavedSuccess && (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Notes saved successfully!
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleSaveNotesClick}
                  disabled={isSavingNotes}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSavingNotes ? 'Saving Note...' : 'Save Private Notes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <div className="text-[11px] text-slate-400">
            Lead ID: <span className="font-mono">{enquiry.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onOpenQuotationBuilder(enquiry, null)}
              className="px-4 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Quote PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
