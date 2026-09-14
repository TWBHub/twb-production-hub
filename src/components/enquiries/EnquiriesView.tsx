import React, { useState } from 'react';
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
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Enquiry, EnquiryStatus, QuotationStatus } from '../../types';
import { generateQuotationPDF } from '../../utils/pdfGenerator';

export const EnquiriesView: React.FC = () => {
  const {
    filteredEnquiries,
    createEnquiry,
    updateEnquiry,
    companies,
    brandFilter,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [companyId, setCompanyId] = useState<'twb' | 'golden_june'>(
    brandFilter === 'golden_june' ? 'golden_june' : 'twb'
  );
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [leadSource, setLeadSource] = useState('Instagram');
  const [requirements, setRequirements] = useState('');
  const [budget, setBudget] = useState(12000);
  const [status, setStatus] = useState<EnquiryStatus>('New');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [quotationStatus, setQuotationStatus] = useState<QuotationStatus>('Draft');

  const filtered = filteredEnquiries.filter(e => {
    const matchesSearch =
      e.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.partner_name && e.partner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      e.venue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setEditingEnquiry(null);
    setClientName('');
    setPartnerName('');
    setCompanyId(brandFilter === 'golden_june' ? 'golden_june' : 'twb');
    setEmail('');
    setPhone('');
    setEventDate('');
    setVenue('');
    setLeadSource('Instagram');
    setRequirements('');
    setBudget(12000);
    setStatus('New');
    setFollowUpDate('');
    setNotes('');
    setQuotationStatus('Draft');
    setShowCreateModal(true);
  };

  const handleOpenEdit = (enquiry: Enquiry) => {
    setEditingEnquiry(enquiry);
    setClientName(enquiry.client_name);
    setPartnerName(enquiry.partner_name || '');
    setCompanyId(enquiry.company_id);
    setEmail(enquiry.email);
    setPhone(enquiry.phone);
    setEventDate(enquiry.event_date);
    setVenue(enquiry.venue);
    setLeadSource(enquiry.lead_source);
    setRequirements(enquiry.requirements);
    setBudget(enquiry.estimated_budget);
    setStatus(enquiry.status);
    setFollowUpDate(enquiry.follow_up_date || '');
    setNotes(enquiry.notes || '');
    setQuotationStatus(enquiry.quotation_status);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !email || !eventDate) return;

    if (editingEnquiry) {
      await updateEnquiry({
        ...editingEnquiry,
        client_name: clientName,
        partner_name: partnerName,
        company_id: companyId,
        email,
        phone,
        event_date: eventDate,
        venue,
        lead_source: leadSource,
        requirements,
        estimated_budget: budget,
        status,
        follow_up_date: followUpDate,
        notes,
        quotation_status: quotationStatus,
      });
    } else {
      await createEnquiry({
        client_name: clientName,
        partner_name: partnerName,
        company_id: companyId,
        email,
        phone,
        event_date: eventDate,
        venue,
        lead_source: leadSource,
        requirements,
        estimated_budget: budget,
        status,
        follow_up_date: followUpDate,
        notes,
        quotation_status: quotationStatus,
      });
    }
    setShowCreateModal(false);
  };

  const handleGenerateQuotePDF = (enquiry: Enquiry) => {
    const company = companies.find(c => c.id === enquiry.company_id) || companies[0];
    const doc = generateQuotationPDF(enquiry, company);
    doc.save(`Quotation_${company.code.toUpperCase()}_${enquiry.client_name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Enquiries & Wedding Leads
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Intake pipeline, consultations, quotation drafting, and client conversion.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Lead Enquiry</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search leads by name, partner, venue..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 w-full md:w-auto"
        >
          <option value="all">All Pipeline Stages</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Meeting Scheduled">Meeting Scheduled</option>
          <option value="Proposal Sent">Proposal Sent</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      {/* Leads Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(enquiry => {
          const isTWB = enquiry.company_id === 'twb';

          return (
            <div
              key={enquiry.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="space-y-3">
                {/* Brand & Stage Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      isTWB ? 'bg-blue-100 text-blue-800' : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
                    }`}
                  >
                    {isTWB ? 'TWB' : 'Golden June'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                    {enquiry.status}
                  </span>
                </div>

                {/* Names & Date */}
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {enquiry.client_name} {enquiry.partner_name ? `& ${enquiry.partner_name}` : ''}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{enquiry.event_date}</span>
                    <span className="text-slate-300">•</span>
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{enquiry.venue}</span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <a href={`mailto:${enquiry.email}`} className="hover:text-blue-600 truncate">{enquiry.email}</a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <a href={`tel:${enquiry.phone}`} className="hover:text-blue-600">{enquiry.phone}</a>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-0.5">
                    Source: {enquiry.lead_source}
                  </div>
                </div>

                {/* Requirements excerpt */}
                {enquiry.requirements && (
                  <p className="text-xs text-slate-600 line-clamp-2 italic">
                    "{enquiry.requirements}"
                  </p>
                )}
              </div>

              {/* Bottom Actions & Quote PDF button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    ${enquiry.estimated_budget.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">Budget Estimate</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateQuotePDF(enquiry)}
                    className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-colors flex items-center gap-1"
                    title="Generate custom PDF Quotation"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Quote PDF</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(enquiry)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
          No enquiries found matching criteria.
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingEnquiry ? 'Edit Lead Enquiry' : 'Log New Lead Enquiry'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <select
                    value={companyId}
                    onChange={e => setCompanyId(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="twb">TWB (The Wedding Book)</option>
                    <option value="golden_june">Golden June Studios</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Pipeline Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Meeting Scheduled">Meeting Scheduled</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Client Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="e.g. Camilla Dupont"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Partner Name</label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    placeholder="e.g. Lucas Wright"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (415) 555-0100"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Wedding Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimated Budget ($)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Venue / Destination</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={e => setVenue(e.target.value)}
                    placeholder="e.g. Filoli Historic Gardens"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Source</label>
                  <input
                    type="text"
                    value={leadSource}
                    onChange={e => setLeadSource(e.target.value)}
                    placeholder="Instagram, Vogue, Referral"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requirements & Vision</label>
                <textarea
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                  rows={2}
                  placeholder="Requested Super 8, anamorphic cinema, drone aerials..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  {editingEnquiry ? 'Save Changes' : 'Create Lead & Trigger Alerts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
