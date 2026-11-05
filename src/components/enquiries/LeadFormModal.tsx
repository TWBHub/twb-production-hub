import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  Lock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Enquiry, EnquiryStatus, QuotationStatus, TeamMember } from '../../types';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Enquiry, 'id' | 'created_at'> | Enquiry) => Promise<void>;
  editingEnquiry: Enquiry | null;
  defaultBrand: 'twb' | 'golden_june';
  teamMembers: TeamMember[];
}

const COMMON_SERVICES = [
  'Wedding Cinematography',
  'Candid Photography',
  'Drone / Aerial 4K',
  'Pre-Wedding Film',
  'Editorial Teaser & Reels',
  'Traditional Video',
  'Luxury Photobook Album',
  'Same-Day Edit',
];

const LEAD_SOURCES = [
  'Instagram',
  'Word of Mouth / Referral',
  'WedMeGood',
  'WeddingWire',
  'Wedding Planner',
  'Website Direct',
  'Vogue / Media',
  'Other',
];

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingEnquiry,
  defaultBrand,
  teamMembers,
}) => {
  const [clientName, setClientName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [companyId, setCompanyId] = useState<'twb' | 'golden_june'>(defaultBrand);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [leadSource, setLeadSource] = useState('Instagram');
  const [requirements, setRequirements] = useState('');
  const [budget, setBudget] = useState<number>(200000);
  const [status, setStatus] = useState<EnquiryStatus>('New');
  const [followUpDate, setFollowUpDate] = useState('');
  const [consultationDate, setConsultationDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [quotationStatus, setQuotationStatus] = useState<QuotationStatus>('Draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingEnquiry) {
      setClientName(editingEnquiry.client_name || '');
      setPartnerName(editingEnquiry.partner_name || '');
      setCompanyId(editingEnquiry.company_id || defaultBrand);
      setEmail(editingEnquiry.email || '');
      setPhone(editingEnquiry.phone || '');
      setCity(editingEnquiry.city || '');
      setEventDate(editingEnquiry.event_date || '');
      setVenue(editingEnquiry.venue || '');
      setLeadSource(editingEnquiry.lead_source || 'Instagram');
      setRequirements(editingEnquiry.requirements || '');
      setBudget(editingEnquiry.estimated_budget || 200000);
      setStatus(editingEnquiry.status || 'New');
      setFollowUpDate(editingEnquiry.follow_up_date || '');
      setConsultationDate(editingEnquiry.consultation_date || '');
      setAssignedTo(editingEnquiry.assigned_to || '');
      setSelectedServices(editingEnquiry.services || ['Wedding Cinematography', 'Editorial Teaser & Reels']);
      setNotes(editingEnquiry.notes || '');
      setQuotationStatus(editingEnquiry.quotation_status || 'Draft');
    } else {
      setClientName('');
      setPartnerName('');
      setCompanyId(defaultBrand);
      setEmail('');
      setPhone('');
      setCity('');
      setEventDate('');
      setVenue('');
      setLeadSource('Instagram');
      setRequirements('');
      setBudget(200000);
      setStatus('New');
      setFollowUpDate('');
      setConsultationDate('');
      setAssignedTo('');
      setSelectedServices(['Wedding Cinematography', 'Editorial Teaser & Reels']);
      setNotes('');
      setQuotationStatus('Draft');
    }
    setErrorMsg('');
  }, [editingEnquiry, defaultBrand, isOpen]);

  if (!isOpen) return null;

  const toggleService = (srv: string) => {
    setSelectedServices(prev =>
      prev.includes(srv) ? prev.filter(s => s !== srv) : [...prev, srv]
    );
  };

  const handleQuickFollowUp = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setFollowUpDate(target.toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg('Client Name is required.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setErrorMsg('Either an Email address or Phone number is required to contact the client.');
      return;
    }
    if (!eventDate) {
      setErrorMsg('Target Wedding Date is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const payload = {
        client_name: clientName.trim(),
        partner_name: partnerName.trim() || undefined,
        company_id: companyId,
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || undefined,
        event_date: eventDate,
        venue: venue.trim() || 'TBD',
        lead_source: leadSource,
        requirements: requirements.trim(),
        estimated_budget: Number(budget) || 0,
        currency: 'INR' as const,
        status,
        follow_up_date: followUpDate || undefined,
        consultation_date: consultationDate || undefined,
        assigned_to: assignedTo || undefined,
        services: selectedServices,
        notes: notes.trim() || undefined,
        quotation_status: quotationStatus,
      };

      if (editingEnquiry) {
        await onSubmit({
          ...editingEnquiry,
          ...payload,
        });
      } else {
        await onSubmit(payload);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save lead record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-7 border border-slate-200 my-8 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              <span>{editingEnquiry ? 'Edit Lead Details' : 'New Wedding Lead'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter inquiry details, wedding scope, tracking dates, and internal notes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-6 text-xs pr-1">
          {/* SECTION 1: Brand & Contact Info */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                1. Brand & Contact Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  Brand Division <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCompanyId('twb')}
                    className={`py-2 px-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                      companyId === 'twb'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs">The Wedding Booth</div>
                      <div className="text-[10px] text-slate-500 font-normal">Luxury Cinematic Films</div>
                    </div>
                    {companyId === 'twb' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompanyId('golden_june')}
                    className={`py-2 px-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                      companyId === 'golden_june'
                        ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20 text-amber-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs">Golden June Films</div>
                      <div className="text-[10px] text-slate-500 font-normal">Artisanal Wedding Cinema</div>
                    </div>
                    {companyId === 'golden_june' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="e.g. Radhika Merchant"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Partner / Spouse Name
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder="e.g. Anant Ambani"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Client City / Home Base
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Mumbai, Delhi, London"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="radhika@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number (with Country Code)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98200 12345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lead Source
                </label>
                <select
                  value={leadSource}
                  onChange={e => setLeadSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {LEAD_SOURCES.map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Wedding Details */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                2. Wedding Dates & Venue
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Wedding Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Venue / Hotel / Resort
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={e => setVenue(e.target.value)}
                  placeholder="e.g. Taj Lake Palace, Udaipur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Lead Pipeline & Assignment */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                3. Pipeline Stage & Follow-Up Tracking
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as EnquiryStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="New">1. New Lead</option>
                  <option value="Contacted">2. Contacted</option>
                  <option value="Meeting Scheduled">3. Meeting Scheduled</option>
                  <option value="Proposal Sent">4. Proposal Sent</option>
                  <option value="Won">5. Won (Ready for Project)</option>
                  <option value="Lost">6. Lost</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Producer / Lead
                </label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(tm => (
                    <option key={tm.id} value={tm.name}>
                      {tm.name} ({tm.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Consultation Call Date
                </label>
                <input
                  type="date"
                  value={consultationDate}
                  onChange={e => setConsultationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Next Follow-up Due Date
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">Quick set:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickFollowUp(1)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFollowUp(3)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      In 3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFollowUp(7)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      In 1 Week
                    </button>
                    {followUpDate && (
                      <button
                        type="button"
                        onClick={() => setFollowUpDate('')}
                        className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Requirements, Services & Budget */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <Tag className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                4. Scope, Services & Investment
              </h3>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimated Budget (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="1000"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Displayed formatted as ₹{budget.toLocaleString('en-IN')}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Requested Services & Coverage
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SERVICES.map(service => {
                    const isSelected = selectedServices.includes(service);
                    return (
                      <button
                        type="button"
                        key={service}
                        onClick={() => toggleService(service)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Client Vision & Requirements
                </label>
                <textarea
                  rows={2}
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                  placeholder="e.g. 3-day royal palace wedding, cinematic teaser within 7 days, 15-minute highlight film, drone aerials for baraat."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Internal Producer Notes (Private)</span>
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal comments: Couple's demeanor, budget flexibility, planner relationship, competitor quotes..."
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-slate-800"
                />
                <p className="text-[10px] text-amber-700/90 italic">
                  Confidential: These internal notes are strictly visible to your production team and are never included on generated quotations or client PDFs.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Saving Lead...' : editingEnquiry ? 'Save Changes' : 'Create Wedding Lead'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
