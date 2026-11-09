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
  Instagram,
  Check,
  CheckCheck,
  History,
} from 'lucide-react';
import { Enquiry, Company, Quotation, EnquiryStatus, TeamMember } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';
import { generateQuotationPDF, downloadPdfDoc } from '../../utils/pdfGenerator';
import { groupQuotationsIntoProposals, getProposalFilename } from '../../utils/proposalRevisionUtils';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'services' | 'quotations' | 'followups' | 'notes'>('overview');

  if (!isOpen) return null;

  const isTWB = enquiry.company_id === 'twb';
  const displayTitle = enquiry.title || enquiry.client_name || 'Project Lead';

  // Filter quotations for this lead & group into distinct proposals with revision history
  const leadQuotes = quotations.filter(q => q.enquiry_id === enquiry.id);
  const proposalGroups = groupQuotationsIntoProposals(leadQuotes);

  // Check follow-up status
  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = Boolean(enquiry.follow_up_date && enquiry.follow_up_date < todayStr && enquiry.status !== 'Won' && enquiry.status !== 'Lost');
  const isDueToday = Boolean(enquiry.follow_up_date === todayStr && enquiry.status !== 'Won' && enquiry.status !== 'Lost');

  // Clean phone for WhatsApp
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
    const filename = getProposalFilename(company, enquiry, quote);
    downloadPdfDoc(doc, filename);
  };

  const eventCount = enquiry.events?.length || (enquiry.event_date ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-5 sm:p-6 border border-slate-200 my-6 max-h-[92vh] flex flex-col">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-100 gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
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
              className="text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 transition-colors focus:outline-hidden cursor-pointer"
            >
              <option value="New">1. New Lead</option>
              <option value="Contacted">2. Contacted</option>
              <option value="Meeting Scheduled">3. Meeting Scheduled</option>
              <option value="Proposal Sent">4. Proposal Sent</option>
              <option value="Won">5. Won (Ready for Project)</option>
              <option value="Lost">6. Lost</option>
            </select>

            {enquiry.is_archived && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                Archived
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {enquiry.status !== 'Won' && (
              enquiry.is_archived ? (
                <button
                  type="button"
                  onClick={() =>
                    alert('This lead is currently archived. Please restore (unarchive) the lead before converting it to an active project.')
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed flex items-center gap-1.5"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Convert to Project</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenConvertModal(enquiry)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Convert to Project</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onEditLead(enquiry)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit Lead"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onToggleArchive(enquiry)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title={enquiry.is_archived ? 'Restore (Unarchive)' : 'Archive Lead'}
            >
              {enquiry.is_archived ? <ArchiveRestore className="w-4 h-4 text-emerald-600" /> : <Archive className="w-4 h-4" />}
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
            <h2 className="text-xl font-bold text-slate-900">{displayTitle}</h2>
            {enquiry.estimated_budget != null && enquiry.estimated_budget > 0 && (
              <div className="text-sm font-bold text-slate-900 font-mono">
                Est. Budget: <span className="text-red-600">₹{enquiry.estimated_budget.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            {enquiry.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDisplayDate(enquiry.event_date)}
              </span>
            )}
            {enquiry.venue && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {enquiry.venue} {enquiry.city ? `(${enquiry.city})` : ''}
                </span>
              </>
            )}
            {enquiry.lead_source && (
              <>
                <span>•</span>
                <span className="text-slate-400">Source: {enquiry.lead_source}</span>
              </>
            )}
          </div>
        </div>

        {/* Follow-up Banner if Due or Overdue */}
        {(isOverdue || isDueToday) && (
          <div
            className={`mt-2 p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0 ${
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
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  onUpdateFollowUp(enquiry, `${y}-${m}-${day}`);
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-50 border rounded-md font-semibold text-[11px] shadow-2xs transition-colors"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  onUpdateFollowUp(enquiry, `${y}-${m}-${day}`);
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-50 border rounded-md font-semibold text-[11px] shadow-2xs transition-colors"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => onUpdateFollowUp(enquiry, undefined)}
                className="px-2 py-0.5 text-slate-500 hover:text-slate-700 text-[11px]"
              >
                Done / Clear
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation (6 Organized Sections) */}
        <div className="flex items-center gap-2 sm:gap-4 border-b border-slate-200 mt-3 shrink-0 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview & Contact
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1 ${
              activeTab === 'events'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Event Schedule</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {eventCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1 ${
              activeTab === 'services'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Services & Scope</span>
            {enquiry.services && enquiry.services.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {enquiry.services.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotations')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1 ${
              activeTab === 'quotations'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Quotations</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {proposalGroups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'followups'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Follow-ups
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1 ${
              activeTab === 'notes'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3 h-3 text-amber-600" />
            <span>Internal Notes</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {/* 1. Overview & Contact */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Client & Lead Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  {enquiry.client_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Primary Contact:</span>
                      <span className="font-semibold text-slate-900">{enquiry.client_name}</span>
                    </div>
                  )}

                  {enquiry.partner_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Partner / Spouse:</span>
                      <span className="font-medium text-slate-800">{enquiry.partner_name}</span>
                    </div>
                  )}

                  {enquiry.phone && (
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
                  )}

                  {enquiry.email && (
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
                  )}

                  {enquiry.instagram && (
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                      <span className="text-slate-400">Instagram:</span>
                      <a
                        href={enquiry.instagram.startsWith('http') ? enquiry.instagram : `https://instagram.com/${enquiry.instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pink-600 hover:underline font-medium flex items-center gap-1"
                      >
                        <span>@{enquiry.instagram.replace(/^@/, '')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {enquiry.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Base City:</span>
                      <span className="font-medium text-slate-800">{enquiry.city}</span>
                    </div>
                  )}

                  {enquiry.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Primary Venue:</span>
                      <span className="font-medium text-slate-800">{enquiry.venue}</span>
                    </div>
                  )}

                  {enquiry.lead_source && (
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Lead Source:</span>
                      <span className="font-medium text-slate-800">{enquiry.lead_source}</span>
                    </div>
                  )}

                  {enquiry.assigned_to && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Assigned Producer:</span>
                      <span className="font-semibold text-slate-900">{enquiry.assigned_to}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Event Schedule */}
          {activeTab === 'events' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Event Schedule & Ceremonies
                </h4>
                <button
                  type="button"
                  onClick={() => onEditLead(enquiry)}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Schedule</span>
                </button>
              </div>

              {enquiry.events && enquiry.events.length > 0 ? (
                <div className="space-y-2.5">
                  {enquiry.events.map((ev, index) => (
                    <div
                      key={ev.id || index}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <span>{ev.event_name || `Event ${index + 1}`}</span>
                        </span>

                        {ev.event_date && (
                          <span className="text-xs font-semibold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                            {formatDisplayDate(ev.event_date)} {ev.event_time ? `• ${ev.event_time}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 text-[11px] pt-1 border-t border-slate-200/60">
                        {ev.event_address && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ev.event_address}</span>
                          </div>
                        )}
                        {ev.team && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Team: <strong>{ev.team}</strong></span>
                          </div>
                        )}
                        {ev.event_notes && (
                          <div className="sm:col-span-2 text-slate-500 italic">
                            "{ev.event_notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : enquiry.event_date ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-semibold text-slate-800">Wedding Celebration</div>
                  <div className="text-slate-600">Date: {formatDisplayDate(enquiry.event_date)}</div>
                  {enquiry.venue && <div className="text-slate-600">Venue: {enquiry.venue}</div>}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No event schedule added yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click "Edit Schedule" to add ceremony dates, timings, venues, and crew requirements.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Requested Services & Scope */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Services Requested from Catalogue
                </h4>
                {enquiry.services && enquiry.services.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {enquiry.services.map(srv => (
                      <span
                        key={srv}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-300 text-slate-800 shadow-2xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{srv}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No services selected yet.</p>
                )}
              </div>

              {enquiry.package_interest && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Package / Collection Interest
                  </h4>
                  <p className="text-slate-800 font-semibold">{enquiry.package_interest}</p>
                </div>
              )}

              {enquiry.requirements && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Client Vision & Requirements
                  </h4>
                  <p className="text-slate-600 italic whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
                    "{enquiry.requirements}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. Quotations / Proposals */}
          {activeTab === 'quotations' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Proposals & Revision History
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Each proposal retains its unique Proposal Reference with all historical revisions saved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenQuotationBuilder(enquiry, null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Proposal</span>
                </button>
              </div>

              {proposalGroups.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-700">No proposals drafted yet</p>
                  <p className="text-[11px] text-slate-400">
                    Proposals use the services selected for this lead and show one total package amount.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenQuotationBuilder(enquiry, null)}
                    className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-colors inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Draft Initial Proposal</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposalGroups.map(group => {
                    const latest = group.latestQuotation;
                    const latestTotal = latest.total_amount || latest.total || 0;
                    return (
                      <div
                        key={group.proposalId}
                        className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden"
                      >
                        {/* Parent Proposal Header & Latest Revision Summary */}
                        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm font-mono tracking-tight">
                                {group.quotationNumber}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-2xs">
                                Revision v{group.highestVersion} (Latest)
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  latest.status === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : latest.status === 'Sent'
                                    ? 'bg-blue-100 text-blue-800'
                                    : latest.status === 'Declined'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {latest.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>Issued: <strong>{formatDisplayDate(latest.issue_date)}</strong></span>
                              <span>•</span>
                              <span>{latest.items?.length || 0} scope items</span>
                              <span>•</span>
                              <span>{group.revisions.length} revision{group.revisions.length > 1 ? 's' : ''} saved</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">
                                Package Amount
                              </span>
                              <span className="font-mono font-bold text-slate-900 text-base">
                                ₹{latestTotal.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDownloadQuote(latest)}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                title={`Download PDF (${getProposalFilename(company, enquiry, latest)})`}
                              >
                                <Download className="w-3.5 h-3.5 text-slate-600" />
                                <span>Download PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenQuotationBuilder(enquiry, latest)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                title="Create next revision under this proposal reference"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Revise Proposal</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* All Historical Revisions listed under one proposal entry */}
                        <div className="p-3 bg-white space-y-2">
                          <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-slate-400" />
                              <span>Revision History ({group.revisions.length})</span>
                            </span>
                            <span className="text-[10px] normal-case text-slate-400">
                              All versions preserved
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                            {group.revisions.map(rev => {
                              const revTotal = rev.total_amount || rev.total || 0;
                              const isLatest = rev.version === group.highestVersion;
                              return (
                                <div
                                  key={rev.id || `${rev.quotation_number}-v${rev.version}`}
                                  className={`p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition-colors ${
                                    isLatest ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isLatest
                                          ? 'bg-blue-100 text-blue-900 font-mono'
                                          : 'bg-slate-100 text-slate-700 font-mono'
                                      }`}
                                    >
                                      v{rev.version}
                                    </span>

                                    <div className="text-[11px] text-slate-600">
                                      <span className="font-medium text-slate-800">
                                        {formatDisplayDate(rev.issue_date || rev.created_at)}
                                      </span>
                                      <span className="mx-1.5 text-slate-300">•</span>
                                      <span>{rev.items?.length || 0} scope items</span>
                                      {rev.discount ? (
                                        <>
                                          <span className="mx-1.5 text-slate-300">•</span>
                                          <span className="text-emerald-700">₹{rev.discount.toLocaleString('en-IN')} disc.</span>
                                        </>
                                      ) : null}
                                    </div>

                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ml-1 ${
                                        rev.status === 'Approved'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : rev.status === 'Sent'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : rev.status === 'Declined'
                                          ? 'bg-red-50 text-red-700 border border-red-200'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {rev.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3">
                                    <span className="font-mono font-semibold text-slate-800 text-xs">
                                      ₹{revTotal.toLocaleString('en-IN')}
                                    </span>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadQuote(rev)}
                                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                        title={`Download PDF v${rev.version} (${getProposalFilename(company, enquiry, rev)})`}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onOpenQuotationBuilder(enquiry, rev)}
                                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                        title={`Create new revision based on v${rev.version}`}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. Follow-ups */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Follow-up Scheduling & Tracking
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Consultation Call</span>
                    <span className="font-semibold text-slate-900">
                      {enquiry.consultation_date ? formatDisplayDate(enquiry.consultation_date) : 'Not scheduled'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Next Follow-up Due Date</span>
                    <span className="font-semibold text-slate-900">
                      {enquiry.follow_up_date ? formatDisplayDate(enquiry.follow_up_date) : 'None scheduled'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">Quick Reschedule:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      onUpdateFollowUp(enquiry, `${y}-${m}-${day}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border rounded-md font-semibold text-[11px] shadow-2xs"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      onUpdateFollowUp(enquiry, `${y}-${m}-${day}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border rounded-md font-semibold text-[11px] shadow-2xs"
                  >
                    In 3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      onUpdateFollowUp(enquiry, `${y}-${m}-${day}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border rounded-md font-semibold text-[11px] shadow-2xs"
                  >
                    In 1 Week
                  </button>
                  {enquiry.follow_up_date && (
                    <button
                      type="button"
                      onClick={() => onUpdateFollowUp(enquiry, undefined)}
                      className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-md font-semibold text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. Internal Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Private Producer Notes (Confidential)</span>
                  </div>
                  {notesSavedSuccess && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Saved Successfully
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Record confidential producer discussions, budget flexibility, planner notes..."
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-amber-800/80 italic">
                    Strictly internal: Never displayed to clients or exported into proposals.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveNotesClick}
                    disabled={isSavingNotes}
                    className="px-3.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>

              {enquiry.client_preferences && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Client Preferences
                  </h4>
                  <p className="text-slate-700 whitespace-pre-line">{enquiry.client_preferences}</p>
                </div>
              )}

              {enquiry.logistics_notes && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Logistics / Special Considerations
                  </h4>
                  <p className="text-slate-700 whitespace-pre-line">{enquiry.logistics_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
