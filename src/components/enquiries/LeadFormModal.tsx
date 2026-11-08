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
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Instagram,
  Search,
  Check,
} from 'lucide-react';
import { Enquiry, EnquiryStatus, QuotationStatus, TeamMember, ProjectEvent } from '../../types';
import { useApp } from '../../context/AppContext';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Enquiry, 'id' | 'created_at'> | Enquiry) => Promise<void>;
  editingEnquiry: Enquiry | null;
  defaultBrand: 'twb' | 'golden_june';
  teamMembers: TeamMember[];
}

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

interface FormEventCard {
  id?: string;
  event_name: string;
  event_date: string;
  event_time: string;
  event_address: string;
  team: string;
  event_notes: string;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingEnquiry,
  defaultBrand,
  teamMembers,
}) => {
  const { services, createService } = useApp();

  // Section A: Lead & Client Information
  const [companyId, setCompanyId] = useState<'twb' | 'golden_june'>(defaultBrand);
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [leadSource, setLeadSource] = useState('Instagram');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState<EnquiryStatus>('New');

  // Section B: Project Details & Event Schedule
  // CRITICAL: Only leadTitle is compulsory!
  const [leadTitle, setLeadTitle] = useState('');
  const [primaryVenue, setPrimaryVenue] = useState('');
  const [events, setEvents] = useState<FormEventCard[]>([]);

  // Section C: Requested Services & Scope
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [saveCustomToCatalogue, setSaveCustomToCatalogue] = useState(false);
  const [packageInterest, setPackageInterest] = useState('');
  const [requirements, setRequirements] = useState('');

  // Section D: Investment & Follow-up
  const [budget, setBudget] = useState<number | string>('');
  const [consultationDate, setConsultationDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Section E: Internal Notes
  const [privateProducerNotes, setPrivateProducerNotes] = useState('');
  const [clientPreferences, setClientPreferences] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');

  const [quotationStatus, setQuotationStatus] = useState<QuotationStatus>('Draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Populate form on open or change
  useEffect(() => {
    if (editingEnquiry) {
      setCompanyId(editingEnquiry.company_id || defaultBrand);
      setPrimaryContactName(editingEnquiry.client_name || '');
      setPartnerName(editingEnquiry.partner_name || '');
      setPhone(editingEnquiry.phone || '');
      setEmail(editingEnquiry.email || '');
      setInstagram(editingEnquiry.instagram || '');
      setCity(editingEnquiry.city || '');
      setLeadSource(editingEnquiry.lead_source || 'Instagram');
      setAssignedTo(editingEnquiry.assigned_to || '');
      setStatus(editingEnquiry.status || 'New');

      setLeadTitle(editingEnquiry.title || editingEnquiry.client_name || '');
      setPrimaryVenue(editingEnquiry.venue || '');

      // Load events if available, otherwise check legacy single event_date
      if (editingEnquiry.events && editingEnquiry.events.length > 0) {
        setEvents(
          editingEnquiry.events.map(ev => ({
            id: ev.id,
            event_name: ev.event_name || '',
            event_date: ev.event_date || '',
            event_time: ev.event_time || '',
            event_address: ev.event_address || '',
            team: ev.team || '',
            event_notes: ev.event_notes || '',
          }))
        );
      } else if (editingEnquiry.event_date) {
        setEvents([
          {
            event_name: 'Wedding Celebration',
            event_date: editingEnquiry.event_date,
            event_time: '',
            event_address: editingEnquiry.venue || '',
            team: '',
            event_notes: '',
          },
        ]);
      } else {
        setEvents([]);
      }

      setSelectedServices(editingEnquiry.services || []);
      setPackageInterest(editingEnquiry.package_interest || '');
      setRequirements(editingEnquiry.requirements || '');

      setBudget(editingEnquiry.estimated_budget != null ? editingEnquiry.estimated_budget : '');
      setConsultationDate(editingEnquiry.consultation_date || '');
      setFollowUpDate(editingEnquiry.follow_up_date || '');

      setPrivateProducerNotes(editingEnquiry.notes || '');
      setClientPreferences(editingEnquiry.client_preferences || '');
      setLogisticsNotes(editingEnquiry.logistics_notes || '');

      setQuotationStatus(editingEnquiry.quotation_status || 'Draft');
    } else {
      setCompanyId(defaultBrand);
      setPrimaryContactName('');
      setPartnerName('');
      setPhone('');
      setEmail('');
      setInstagram('');
      setCity('');
      setLeadSource('Instagram');
      setAssignedTo('');
      setStatus('New');

      setLeadTitle('');
      setPrimaryVenue('');
      setEvents([]);

      setSelectedServices([]);
      setPackageInterest('');
      setRequirements('');

      setBudget('');
      setConsultationDate('');
      setFollowUpDate('');

      setPrivateProducerNotes('');
      setClientPreferences('');
      setLogisticsNotes('');

      setQuotationStatus('Draft');
    }
    setErrorMsg('');
    setCustomServiceName('');
    setSaveCustomToCatalogue(false);
  }, [editingEnquiry, defaultBrand, isOpen]);

  if (!isOpen) return null;

  // Event handlers
  const handleAddEvent = () => {
    setEvents(prev => [
      ...prev,
      {
        event_name: '',
        event_date: '',
        event_time: '',
        event_address: '',
        team: '',
        event_notes: '',
      },
    ]);
  };

  const handleUpdateEvent = (index: number, field: keyof FormEventCard, value: string) => {
    setEvents(prev =>
      prev.map((ev, i) => (i === index ? { ...ev, [field]: value } : ev))
    );
  };

  const handleRemoveEvent = (index: number) => {
    setEvents(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveEvent = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === events.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...events];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setEvents(reordered);
  };

  const toggleService = (srvName: string) => {
    setSelectedServices(prev =>
      prev.includes(srvName) ? prev.filter(s => s !== srvName) : [...prev, srvName]
    );
  };

  const handleAddCustomService = async () => {
    const trimmed = customServiceName.trim();
    if (!trimmed) return;

    if (!selectedServices.includes(trimmed)) {
      setSelectedServices(prev => [...prev, trimmed]);
    }

    if (saveCustomToCatalogue) {
      try {
        await createService({
          name: trimmed,
          applicable_brand: companyId,
          category: 'Specialty',
          is_active: true,
        });
      } catch (err) {
        console.error('Failed to save service to catalogue:', err);
      }
    }

    setCustomServiceName('');
    setSaveCustomToCatalogue(false);
  };

  const handleQuickFollowUp = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    setFollowUpDate(`${y}-${m}-${d}`);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Only Project / Lead Title is required!
    if (!leadTitle.trim()) {
      setErrorMsg('Project / Lead Title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Find earliest event date if events exist
      const eventDates = events
        .map(ev => ev.event_date)
        .filter(d => Boolean(d && /^\d{4}-\d{2}-\d{2}/.test(d)))
        .sort();
      const earliestEventDate = eventDates[0] || undefined;

      // Clean event cards
      const cleanedEvents: ProjectEvent[] = events.map((ev, idx) => ({
        id: ev.id || `evt-${Date.now()}-${idx}`,
        event_name: ev.event_name.trim() || `Event ${idx + 1}`,
        event_date: ev.event_date || '',
        event_time: ev.event_time?.trim() || undefined,
        event_address: ev.event_address?.trim() || undefined,
        team: ev.team?.trim() || undefined,
        event_notes: ev.event_notes?.trim() || undefined,
        sort_order: idx,
      }));

      const primaryContact = primaryContactName.trim() || leadTitle.trim();

      const payload = {
        title: leadTitle.trim(),
        client_name: primaryContact,
        partner_name: partnerName.trim() || undefined,
        company_id: companyId,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        instagram: instagram.trim() || undefined,
        city: city.trim() || undefined,
        venue: primaryVenue.trim() || undefined,
        event_date: earliestEventDate,
        events: cleanedEvents,
        lead_source: leadSource || undefined,
        assigned_to: assignedTo || undefined,
        status,
        services: selectedServices,
        package_interest: packageInterest.trim() || undefined,
        requirements: requirements.trim() || undefined,
        estimated_budget: budget !== '' ? Number(budget) : undefined,
        consultation_date: consultationDate || undefined,
        follow_up_date: followUpDate || undefined,
        notes: privateProducerNotes.trim() || undefined,
        client_preferences: clientPreferences.trim() || undefined,
        logistics_notes: logisticsNotes.trim() || undefined,
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
      console.error('Failed to submit lead:', err);
      setErrorMsg(err.message || 'Failed to save lead record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter catalogue services for current brand
  const brandCatalogueServices = services.filter(
    s => s.is_active && (s.applicable_brand === 'all' || s.applicable_brand === companyId)
  );

  // Filter by search query if any
  const displayedCatalogueServices = brandCatalogueServices.filter(s =>
    serviceSearch ? s.name.toLowerCase().includes(serviceSearch.toLowerCase()) : true
  );

  // Historical services that may be selected on this lead but not in active catalogue
  const historicalSelected = selectedServices.filter(
    srvName => !brandCatalogueServices.some(s => s.name === srvName)
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-5 sm:p-7 border border-slate-200 my-6 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              <span>{editingEnquiry ? 'Edit Wedding Lead' : 'New Wedding Lead'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Flexible enquiry record. Only Project / Lead Title is required — all other details can be added anytime.
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-7 text-xs pr-1">
          {/* SECTION A: Lead & Client Information */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Section A — Lead & Client Information
              </h3>
              <span className="text-[10px] text-slate-400 font-normal ml-auto">Optional</span>
            </div>

            {/* Brand Selector — Display Name Only (No taglines or descriptive text) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Company / Brand
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
                  <span className="text-xs font-semibold">The Wedding Booth</span>
                  {companyId === 'twb' && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
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
                  <span className="text-xs font-semibold">Golden June Films</span>
                  {companyId === 'golden_june' && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                </button>
              </div>
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary Contact Name
                </label>
                <input
                  type="text"
                  value={primaryContactName}
                  onChange={e => setPrimaryContactName(e.target.value)}
                  placeholder="e.g. Radhika Merchant"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Partner / Secondary Contact
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
                  Phone Number
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
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Instagram Handle or URL
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                  <input
                    type="text"
                    value={instagram.replace(/^@/, '')}
                    onChange={e => setInstagram(e.target.value)}
                    placeholder="couple.instagram"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  City / Region (Base)
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Producer
                </label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(tm => (
                    <option key={tm.id} value={tm.name}>
                      {tm.name} ({tm.role_title || tm.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as EnquiryStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
                >
                  <option value="New">1. New Lead</option>
                  <option value="Contacted">2. Contacted</option>
                  <option value="Meeting Scheduled">3. Meeting Scheduled</option>
                  <option value="Proposal Sent">4. Proposal Sent</option>
                  <option value="Won">5. Won (Ready for Conversion)</option>
                  <option value="Lost">6. Lost</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION B: Project Details & Event Schedule */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Section B — Project Details & Event Schedule
              </h3>
            </div>

            {/* Project / Lead Title — COMPULSORY */}
            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Project / Lead Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={leadTitle}
                onChange={e => setLeadTitle(e.target.value)}
                placeholder="e.g. Radhika & Anant • Wedding 2026, or Ambani Gala"
                className="w-full px-3.5 py-2 border-2 border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                This is the sole compulsory field in the entire form.
              </p>
            </div>

            {/* Overall Project Location (Distinct from individual event addresses) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary Venue / Resort <span className="text-slate-400 font-normal">(Overall Project)</span>
                </label>
                <input
                  type="text"
                  value={primaryVenue}
                  onChange={e => setPrimaryVenue(e.target.value)}
                  placeholder="e.g. Taj Lake Palace, Udaipur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Event Destination City / Region <span className="text-slate-400 font-normal">(Overall Project)</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Udaipur, Rajasthan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Repeatable Event Schedule Cards */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs">
                    Event Schedule ({events.length} {events.length === 1 ? 'event' : 'events'})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Add multiple ceremonies or shoot sessions. Non-consecutive dates and partial details are supported.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Event</span>
                </button>
              </div>

              {events.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                  <p>No events added yet. If event dates are still tentative, you can leave this blank and add them later.</p>
                  <button
                    type="button"
                    onClick={handleAddEvent}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    + Add first event card
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((ev, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/80 space-y-3 relative transition-all"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                        <span className="font-bold text-slate-800 text-xs">
                          Event {index + 1} {ev.event_name ? `— ${ev.event_name}` : ''}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Reordering */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveEvent(index, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === events.length - 1}
                            onClick={() => handleMoveEvent(index, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(index)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded ml-1"
                            title="Remove Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Event Name
                          </label>
                          <input
                            type="text"
                            value={ev.event_name}
                            onChange={e => handleUpdateEvent(index, 'event_name', e.target.value)}
                            placeholder="e.g. Mehndi, Sangeet, Wedding"
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Event Date
                          </label>
                          <input
                            type="date"
                            value={ev.event_date}
                            onChange={e => handleUpdateEvent(index, 'event_date', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Event Time
                          </label>
                          <input
                            type="time"
                            value={ev.event_time}
                            onChange={e => handleUpdateEvent(index, 'event_time', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 font-semibold mb-1">
                            Event Address <span className="text-slate-400 font-normal">(Specific to this ceremony)</span>
                          </label>
                          <input
                            type="text"
                            value={ev.event_address}
                            onChange={e => handleUpdateEvent(index, 'event_address', e.target.value)}
                            placeholder="Full lawn / ballroom address"
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Team Requirement
                          </label>
                          <input
                            type="text"
                            value={ev.team}
                            onChange={e => handleUpdateEvent(index, 'team', e.target.value)}
                            placeholder="e.g. 2 Cinematographers + 1 Drone"
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-slate-600 font-semibold mb-1">
                            Event Notes
                          </label>
                          <input
                            type="text"
                            value={ev.event_notes}
                            onChange={e => handleUpdateEvent(index, 'event_notes', e.target.value)}
                            placeholder="Timings, lighting instructions, baraat staging..."
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION C: Requested Services & Scope */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Tag className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Section C — Requested Services & Scope
              </h3>
            </div>

            {/* Shared Service Catalogue Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">
                  Select Requested Services from Catalogue
                </label>
                <span className="text-[10px] text-slate-400">
                  {selectedServices.length} selected
                </span>
              </div>

              {/* Search filter for chips */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={e => setServiceSearch(e.target.value)}
                  placeholder="Filter services..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white"
                />
              </div>

              {/* Service Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {displayedCatalogueServices.map(service => {
                  const isSelected = selectedServices.includes(service.name);
                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => toggleService(service.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      <span>{service.name}</span>
                    </button>
                  );
                })}

                {/* Display historical services selected on lead not in current catalogue view */}
                {historicalSelected.map(srvName => (
                  <button
                    type="button"
                    key={`hist-${srvName}`}
                    onClick={() => toggleService(srvName)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-slate-800 text-white border-slate-800 shadow-2xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{srvName}</span>
                    <span className="text-[9px] text-slate-300">(custom)</span>
                  </button>
                ))}
              </div>

              {/* Add Custom Service Inline Input */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                <span className="font-semibold text-slate-700 block text-[11px]">
                  Add a Custom Service for this lead:
                </span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={customServiceName}
                    onChange={e => setCustomServiceName(e.target.value)}
                    placeholder="e.g. Underwater Honeymoon Shoot, Analog 35mm Album"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    disabled={!customServiceName.trim()}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg font-semibold text-xs"
                  >
                    Add Service
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={saveCustomToCatalogue}
                    onChange={e => setSaveCustomToCatalogue(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-0"
                  />
                  <span>Optionally save to shared Service Catalogue for future leads</span>
                </label>
              </div>
            </div>

            {/* Package / Collection Interest */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Package / Collection Interest
              </label>
              <input
                type="text"
                value={packageInterest}
                onChange={e => setPackageInterest(e.target.value)}
                placeholder="e.g. Signature 3-Day Wedding Cinema Package"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Client Vision & Requirements */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Client Vision & Requirements
              </label>
              <textarea
                rows={2}
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder="Client style preferences, specific music requests, color palette, fast turnaround teaser expectations..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* SECTION D: Investment & Follow-up */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Section D — Investment & Follow-up
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
                    onChange={e => setBudget(e.target.value)}
                    placeholder="e.g. 250000"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Preliminary internal estimate only. Not treated as confirmed contract fee.
                </p>
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Next Follow-up Date
                  </label>
                </div>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <div className="flex items-center gap-1 text-[10px] mt-1 text-slate-500">
                  <span>Quick set:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUp(1)}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded"
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUp(3)}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded"
                  >
                    +3d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFollowUp(7)}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded"
                  >
                    +1w
                  </button>
                  {followUpDate && (
                    <button
                      type="button"
                      onClick={() => setFollowUpDate('')}
                      className="px-1 text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION E: Internal Notes (Strictly Private) */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 pb-1 text-amber-950 font-bold text-xs border-b border-amber-200/60">
              <Lock className="w-4 h-4 text-amber-700" />
              <span className="uppercase tracking-wider text-[11px]">Section E — Internal Notes (Confidential)</span>
            </div>

            <p className="text-[11px] text-amber-800 leading-normal">
              Strictly confidential: These internal notes are for your production team only. They will <strong>never</strong> appear on client proposals, quotations, PDFs, or exported client documents.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-amber-900 mb-1">
                  Private Producer Notes
                </label>
                <textarea
                  rows={2}
                  value={privateProducerNotes}
                  onChange={e => setPrivateProducerNotes(e.target.value)}
                  placeholder="Couple's demeanor, budget flexibility, planner relationship, competitor quotes..."
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">
                    Client Preferences
                  </label>
                  <textarea
                    rows={2}
                    value={clientPreferences}
                    onChange={e => setClientPreferences(e.target.value)}
                    placeholder="Specific cinematic preferences, music tastes, VIP guests..."
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1">
                    Logistics / Special Considerations
                  </label>
                  <textarea
                    rows={2}
                    value={logisticsNotes}
                    onChange={e => setLogisticsNotes(e.target.value)}
                    placeholder="Drone permits, remote venue access, generator requirements..."
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
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
            className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isSubmitting ? 'Saving Lead...' : editingEnquiry ? 'Save Changes' : 'Create Wedding Lead'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
