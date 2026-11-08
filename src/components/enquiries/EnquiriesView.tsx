import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  Plus,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Download,
  Mail,
  Phone,
  FileText,
  Tag,
  CheckCircle,
  ExternalLink,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Sparkles,
  AlertTriangle,
  FolderKanban,
  CheckCircle2,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Enquiry, EnquiryStatus, Company, Quotation } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';
import { generateQuotationPDF, downloadPdfDoc } from '../../utils/pdfGenerator';
import { LeadFormModal } from './LeadFormModal';
import { LeadDetailsModal } from './LeadDetailsModal';
import { QuotationBuilderModal } from './QuotationBuilderModal';
import { ConvertLeadModal } from './ConvertLeadModal';
import { DeleteLeadModal } from './DeleteLeadModal';

const PIPELINE_STAGES: Array<{ id: EnquiryStatus; label: string; color: string; bg: string }> = [
  { id: 'New', label: '1. New', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { id: 'Contacted', label: '2. Contacted', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'Meeting Scheduled', label: '3. Meeting Scheduled', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { id: 'Proposal Sent', label: '4. Proposal Sent', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { id: 'Won', label: '5. Won', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'Lost', label: '6. Lost', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
];

export const EnquiriesView: React.FC = () => {
  const {
    filteredEnquiries,
    createEnquiry,
    updateEnquiry,
    deleteEnquiry,
    quotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    companies,
    brandFilter,
    teamMembers,
    clients,
    projects,
    createClient,
    createProject,
    setActiveTab,
  } = useApp();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'none'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'event_date_asc' | 'event_date_desc' | 'budget_desc' | 'budget_asc' | 'created_desc'>('created_desc');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);

  const [detailsEnquiry, setDetailsEnquiry] = useState<Enquiry | null>(null);

  const [quoteModalEnquiry, setQuoteModalEnquiry] = useState<Enquiry | null>(null);
  const [quoteToEdit, setQuoteToEdit] = useState<Quotation | null>(null);

  const [convertModalEnquiry, setConvertModalEnquiry] = useState<Enquiry | null>(null);

  const [deleteModalEnquiry, setDeleteModalEnquiry] = useState<Enquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter & Sort Logic
  const processedLeads = useMemo(() => {
    return filteredEnquiries
      .filter(e => {
        // Archive filter
        const isArchived = Boolean(e.is_archived);
        if (showArchived && !isArchived) return false;
        if (!showArchived && isArchived) return false;

        // Stage filter
        if (stageFilter !== 'all' && e.status !== stageFilter) return false;

        // Follow-up filter
        if (followUpFilter === 'overdue') {
          if (!e.follow_up_date || e.follow_up_date >= todayStr || e.status === 'Won' || e.status === 'Lost') {
            return false;
          }
        } else if (followUpFilter === 'today') {
          if (e.follow_up_date !== todayStr) return false;
        } else if (followUpFilter === 'upcoming') {
          if (!e.follow_up_date || e.follow_up_date <= todayStr) return false;
        } else if (followUpFilter === 'none') {
          if (e.follow_up_date) return false;
        }

        // Multi-attribute search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = e.title?.toLowerCase().includes(q);
          const matchClient = e.client_name?.toLowerCase().includes(q);
          const matchPartner = e.partner_name?.toLowerCase().includes(q);
          const matchEmail = e.email?.toLowerCase().includes(q);
          const matchPhone = e.phone?.toLowerCase().includes(q);
          const matchVenue = e.venue?.toLowerCase().includes(q);
          const matchCity = e.city?.toLowerCase().includes(q);
          const matchSource = e.lead_source?.toLowerCase().includes(q);
          const matchRequirements = e.requirements?.toLowerCase().includes(q);
          const matchNotes = e.notes?.toLowerCase().includes(q);

          if (
            !matchTitle &&
            !matchClient &&
            !matchPartner &&
            !matchEmail &&
            !matchPhone &&
            !matchVenue &&
            !matchCity &&
            !matchSource &&
            !matchRequirements &&
            !matchNotes
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'event_date_asc') {
          return (a.event_date || '').localeCompare(b.event_date || '');
        }
        if (sortBy === 'event_date_desc') {
          return (b.event_date || '').localeCompare(a.event_date || '');
        }
        if (sortBy === 'budget_desc') {
          return (b.estimated_budget || 0) - (a.estimated_budget || 0);
        }
        if (sortBy === 'budget_asc') {
          return (a.estimated_budget || 0) - (b.estimated_budget || 0);
        }
        // created_desc default
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [filteredEnquiries, showArchived, stageFilter, followUpFilter, searchQuery, sortBy, todayStr]);

  // High-level Metrics (Respecting brand filter and active non-archived leads)
  const metrics = useMemo(() => {
    const activeLeads = filteredEnquiries.filter(e => !e.is_archived && e.status !== 'Won' && e.status !== 'Lost');
    const totalActiveBudget = activeLeads.reduce((acc, curr) => acc + (curr.estimated_budget || 0), 0);

    const followUpsDue = filteredEnquiries.filter(
      e => !e.is_archived && e.follow_up_date && e.follow_up_date <= todayStr && e.status !== 'Won' && e.status !== 'Lost'
    ).length;

    const proposalsAwaiting = filteredEnquiries.filter(
      e => !e.is_archived && (e.status === 'Proposal Sent' || e.quotation_status === 'Sent' || e.quotation_status === 'Draft')
    ).length;

    const currentYear = new Date().getFullYear().toString();
    const wonThisYear = filteredEnquiries.filter(
      e => !e.is_archived && e.status === 'Won' && (e.event_date?.startsWith(currentYear) || e.created_at?.startsWith(currentYear))
    );
    const wonTotalValue = wonThisYear.reduce((acc, curr) => acc + (curr.estimated_budget || 0), 0);

    return {
      activeCount: activeLeads.length,
      activeBudget: totalActiveBudget,
      followUpsDue,
      proposalsAwaiting,
      wonCount: wonThisYear.length,
      wonTotalValue,
    };
  }, [filteredEnquiries, todayStr]);

  // Handlers for modal actions
  const handleOpenCreate = () => {
    setEditingEnquiry(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (enquiry: Enquiry) => {
    setEditingEnquiry(enquiry);
    setIsFormModalOpen(true);
  };

  const handleOpenDetails = (enquiry: Enquiry) => {
    setDetailsEnquiry(enquiry);
  };

  const handleFormSubmit = async (data: Omit<Enquiry, 'id' | 'created_at'> | Enquiry) => {
    if ('id' in data) {
      await updateEnquiry(data as Enquiry);
      if (detailsEnquiry && detailsEnquiry.id === data.id) {
        setDetailsEnquiry(data as Enquiry);
      }
    } else {
      await createEnquiry(data);
    }
  };

  const handleQuickStatusChange = async (enquiry: Enquiry, newStatus: EnquiryStatus) => {
    const updated = { ...enquiry, status: newStatus };
    await updateEnquiry(updated);
    if (detailsEnquiry && detailsEnquiry.id === enquiry.id) {
      setDetailsEnquiry(updated);
    }
  };

  const handleQuickFollowUpChange = async (enquiry: Enquiry, newDate?: string) => {
    const updated = { ...enquiry, follow_up_date: newDate };
    await updateEnquiry(updated);
    if (detailsEnquiry && detailsEnquiry.id === enquiry.id) {
      setDetailsEnquiry(updated);
    }
  };

  const handleSaveNotes = async (enquiry: Enquiry, newNotes: string) => {
    const updated = { ...enquiry, notes: newNotes };
    await updateEnquiry(updated);
    if (detailsEnquiry && detailsEnquiry.id === enquiry.id) {
      setDetailsEnquiry(updated);
    }
  };

  const handleToggleArchive = async (enquiry: Enquiry) => {
    const updated = { ...enquiry, is_archived: !enquiry.is_archived };
    await updateEnquiry(updated);
    if (detailsEnquiry && detailsEnquiry.id === enquiry.id) {
      setDetailsEnquiry(updated);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalEnquiry) return;
    try {
      setIsDeleting(true);
      await deleteEnquiry(deleteModalEnquiry.id);
      if (detailsEnquiry && detailsEnquiry.id === deleteModalEnquiry.id) {
        setDetailsEnquiry(null);
      }
      setDeleteModalEnquiry(null);
    } catch (err) {
      console.error('Failed to delete enquiry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenQuotationBuilder = (enquiry: Enquiry, quote?: Quotation | null) => {
    setQuoteModalEnquiry(enquiry);
    setQuoteToEdit(quote || null);
  };

  const handleSaveQuotation = async (
    quote: Omit<Quotation, 'id' | 'created_at' | 'updated_at'> | Quotation
  ) => {
    if ('id' in quote) {
      await updateQuotation(quote as Quotation);
    } else {
      await createQuotation(quote);
    }
    // Also update lead quotation_status to match quote status
    if (quoteModalEnquiry) {
      const updatedStatus = (quote.status === 'Sent' ? 'Sent' : 'Draft') as any;
      await updateEnquiry({
        ...quoteModalEnquiry,
        quotation_status: updatedStatus,
      });
    }
  };

  const handleOpenConvert = (enquiry: Enquiry) => {
    if (enquiry.is_archived) {
      alert("This lead is currently archived. Please restore (unarchive) the lead before converting it to an active project.");
      return;
    }
    setConvertModalEnquiry(enquiry);
  };

  // Helper to resolve company
  const resolveCompanyForEnquiry = (companyId: string): Company => {
    const found = companies.find(c => c.id === companyId || c.code === companyId);
    if (found) return found;
    return companies[0] || ({ id: 'twb', code: 'twb', name: 'The Wedding Booth' } as Company);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Leads
            </h1>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                brandFilter === 'golden_june'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : brandFilter === 'twb'
                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {brandFilter === 'golden_june' ? 'Golden June Films' : brandFilter === 'twb' ? 'The Wedding Booth' : 'All Brands'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Wedding enquiries and sales pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Active Pipeline</span>
            <Sparkles className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.activeCount}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            Pipeline: ₹{metrics.activeBudget.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Follow-ups Due */}
        <div
          className={`p-4 rounded-xl border shadow-xs space-y-1 ${
            metrics.followUpsDue > 0
              ? 'bg-red-50/70 border-red-200 text-red-900'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={metrics.followUpsDue > 0 ? 'text-red-700 font-semibold' : 'text-slate-500'}>
              Follow-ups Due
            </span>
            <Clock className={`w-4 h-4 ${metrics.followUpsDue > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold">{metrics.followUpsDue}</div>
          <div className="text-[11px] text-slate-400">
            {metrics.followUpsDue > 0 ? 'Action required today' : 'All caught up'}
          </div>
        </div>

        {/* Proposals Awaiting */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Proposals Awaiting</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.proposalsAwaiting}</div>
          <div className="text-[11px] text-slate-400">Drafted or Sent quotes</div>
        </div>

        {/* Won This Year */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Won Deals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.wonCount}</div>
          <div className="text-[11px] text-emerald-700 font-mono">
            ₹{metrics.wonTotalValue.toLocaleString('en-IN')} booked
          </div>
        </div>
      </div>

      {/* 3. Search, Filter & Controls Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search leads by client, partner, venue, city, or phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Stage Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Stage:</span>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs focus:outline-hidden"
            >
              <option value="all">All Stages</option>
              <option value="New">1. New</option>
              <option value="Contacted">2. Contacted</option>
              <option value="Meeting Scheduled">3. Meeting Scheduled</option>
              <option value="Proposal Sent">4. Proposal Sent</option>
              <option value="Won">5. Won</option>
              <option value="Lost">6. Lost</option>
            </select>
          </div>

          {/* Follow-up Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Follow-up:</span>
            <select
              value={followUpFilter}
              onChange={e => setFollowUpFilter(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs focus:outline-hidden"
            >
              <option value="all">All Follow-ups</option>
              <option value="overdue">Overdue Only</option>
              <option value="today">Due Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="none">No Follow-up Scheduled</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs focus:outline-hidden"
            >
              <option value="created_desc">Newest Leads First</option>
              <option value="event_date_asc">Wedding Date (Earliest)</option>
              <option value="event_date_desc">Wedding Date (Latest)</option>
              <option value="budget_desc">Budget (High to Low)</option>
              <option value="budget_asc">Budget (Low to High)</option>
            </select>
          </div>

          {/* Archive Toggle */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowArchived(prev => !prev)}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                showArchived
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'Showing Archived' : 'Show Archived'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Active Content: Table View (Sole View) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Lead / Couple</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Wedding Date & Venue</th>
                <th className="py-3 px-3 text-right">Est. Budget (₹)</th>
                <th className="py-3 px-3">Pipeline Stage</th>
                <th className="py-3 px-3">Follow-up</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedLeads.map(lead => {
                const isTWB = lead.company_id === 'twb';
                const isLeadOverdue =
                  lead.follow_up_date &&
                  lead.follow_up_date < todayStr &&
                  lead.status !== 'Won' &&
                  lead.status !== 'Lost';
                const isLeadDueToday =
                  lead.follow_up_date === todayStr &&
                  lead.status !== 'Won' &&
                  lead.status !== 'Lost';
                const couple = lead.partner_name
                  ? `${lead.client_name || 'Client'} & ${lead.partner_name}`
                  : lead.client_name || '';
                const leadDisplayName = lead.title || couple || 'Untitled Lead';
                const hasSeparateCouple = Boolean(lead.title && couple && lead.title !== couple);
                const contactParts = [lead.email, lead.phone].filter(Boolean);

                return (
                  <tr
                    key={lead.id}
                    onClick={() => handleOpenDetails(lead)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    {/* Couple / Title & Contact */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 hover:text-red-600 transition-colors flex items-center gap-1.5">
                        <span>{leadDisplayName}</span>
                        {lead.is_archived && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      {hasSeparateCouple && (
                        <div className="text-[11px] font-medium text-slate-700 truncate">{couple}</div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        {contactParts.length > 0 ? (
                          <span>{contactParts.join(' • ')}</span>
                        ) : (
                          <span className="text-slate-400 italic">No contact details yet</span>
                        )}
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-3">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isTWB
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {isTWB ? 'TWB' : 'GJ'}
                      </span>
                    </td>

                    {/* Wedding Date & Venue */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        {lead.event_date ? (
                          formatDisplayDate(lead.event_date)
                        ) : lead.events && lead.events.length > 0 ? (
                          `${lead.events.length} event${lead.events.length > 1 ? 's' : ''} scheduled`
                        ) : (
                          <span className="text-slate-400 italic font-normal">No dates set</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                        {lead.venue || lead.city ? (
                          [lead.venue, lead.city].filter(Boolean).join(', ')
                        ) : (
                          <span className="text-slate-400 italic">Location unconfirmed</span>
                        )}
                      </div>
                    </td>

                    {/* Budget in INR */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {lead.estimated_budget && lead.estimated_budget > 0 ? (
                        `₹${lead.estimated_budget.toLocaleString('en-IN')}`
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">—</span>
                      )}
                    </td>

                    {/* Stage Dropdown */}
                    <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={e => handleQuickStatusChange(lead, e.target.value as EnquiryStatus)}
                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-hidden"
                      >
                        <option value="New">1. New</option>
                        <option value="Contacted">2. Contacted</option>
                        <option value="Meeting Scheduled">3. Meeting Scheduled</option>
                        <option value="Proposal Sent">4. Proposal Sent</option>
                        <option value="Won">5. Won</option>
                        <option value="Lost">6. Lost</option>
                      </select>
                    </td>

                    {/* Follow-up Indicator */}
                    <td className="py-3 px-3">
                      {isLeadOverdue ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                          Overdue ({formatDisplayDate(lead.follow_up_date)})
                        </span>
                      ) : isLeadDueToday ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                          Due Today
                        </span>
                      ) : lead.follow_up_date ? (
                        <span className="text-[11px] text-slate-600">
                          {formatDisplayDate(lead.follow_up_date)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenQuotationBuilder(lead, null)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Generate Quotation PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(lead)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Lead"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {lead.status === 'Won' && (
                          lead.is_archived ? (
                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  'This lead is currently archived. Please restore (unarchive) the lead before converting it to an active project.'
                                )
                              }
                              className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                              title="Lead is archived - unarchive to convert"
                            >
                              <FolderKanban className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenConvert(lead)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Convert to Project"
                            >
                              <FolderKanban className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title={lead.is_archived ? 'Restore (Unarchive) Lead' : 'Archive Lead'}
                        >
                          {lead.is_archived ? (
                            <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalEnquiry(lead)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {processedLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No leads match the current filters or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modals */}
      {/* Create / Edit Modal */}
      <LeadFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingEnquiry={editingEnquiry}
        defaultBrand={brandFilter === 'golden_june' ? 'golden_june' : 'twb'}
        teamMembers={teamMembers}
      />

      {/* Lead Details Modal */}
      {detailsEnquiry && (
        <LeadDetailsModal
          isOpen={Boolean(detailsEnquiry)}
          onClose={() => setDetailsEnquiry(null)}
          enquiry={detailsEnquiry}
          company={resolveCompanyForEnquiry(detailsEnquiry.company_id)}
          quotations={quotations}
          teamMembers={teamMembers}
          onEditLead={lead => {
            setDetailsEnquiry(null);
            handleOpenEdit(lead);
          }}
          onDeleteLead={lead => {
            setDetailsEnquiry(null);
            setDeleteModalEnquiry(lead);
          }}
          onToggleArchive={handleToggleArchive}
          onUpdateStatus={handleQuickStatusChange}
          onUpdateFollowUp={handleQuickFollowUpChange}
          onSaveNotes={handleSaveNotes}
          onOpenQuotationBuilder={(lead, quote) => {
            handleOpenQuotationBuilder(lead, quote);
          }}
          onOpenConvertModal={lead => {
            setDetailsEnquiry(null);
            handleOpenConvert(lead);
          }}
        />
      )}

      {/* Quotation Builder Modal */}
      {quoteModalEnquiry && (
        <QuotationBuilderModal
          isOpen={Boolean(quoteModalEnquiry)}
          onClose={() => {
            setQuoteModalEnquiry(null);
            setQuoteToEdit(null);
          }}
          enquiry={quoteModalEnquiry}
          company={resolveCompanyForEnquiry(quoteModalEnquiry.company_id)}
          existingQuotation={quoteToEdit}
          onSaveQuotation={handleSaveQuotation}
        />
      )}

      {/* Convert to Project Modal */}
      {convertModalEnquiry && (
        <ConvertLeadModal
          isOpen={Boolean(convertModalEnquiry)}
          onClose={() => setConvertModalEnquiry(null)}
          enquiry={convertModalEnquiry}
          clients={clients}
          projects={projects}
          company={resolveCompanyForEnquiry(convertModalEnquiry.company_id)}
          onCreateClient={createClient}
          onCreateProject={createProject}
          onUpdateEnquiry={updateEnquiry}
          onNavigateToProjects={() => setActiveTab('projects')}
        />
      )}

      {/* Safe Delete Modal */}
      {deleteModalEnquiry && (
        <DeleteLeadModal
          isOpen={Boolean(deleteModalEnquiry)}
          onClose={() => setDeleteModalEnquiry(null)}
          enquiry={deleteModalEnquiry}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
