import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Clock,
  Users,
  Search,
  Check,
  Building,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Project, TeamMember, CalendarEvent, CalendarEventType } from '../../types';
import {
  CalendarCategory,
  CALENDAR_CATEGORIES,
  UnifiedCalendarEntry,
  serializeCalendarNotes,
  calculateDeadlineStatus,
  getLocalTodayDateString,
} from '../../utils/calendarUtils';

export interface CalendarEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryToEdit?: UnifiedCalendarEntry | null;
  preselectedProject?: Project | null;
  projects?: Project[];
  teamMembers?: TeamMember[];
  brandFilter?: 'all' | 'twb' | 'golden_june';
  onSave: (eventData: Omit<CalendarEvent, 'id'>, existingId?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const CalendarEntryModal: React.FC<CalendarEntryModalProps> = ({
  isOpen,
  onClose,
  entryToEdit,
  preselectedProject,
  projects = [],
  teamMembers = [],
  brandFilter = 'all',
  onSave,
  onDelete,
}) => {
  // Selected category
  const [category, setCategory] = useState<CalendarCategory>(entryToEdit?.category || 'Events');

  // Selected project state
  const initialProjectId = entryToEdit?.project_id || preselectedProject?.id || '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [isChangingProject, setIsChangingProject] = useState(!initialProjectId && !preselectedProject);

  // Common fields
  const [title, setTitle] = useState(entryToEdit?.title || '');
  const [date, setDate] = useState(() => {
    if (entryToEdit?.start_time && typeof entryToEdit.start_time === 'string') {
      return entryToEdit.start_time.slice(0, 10);
    }
    return getLocalTodayDateString();
  });
  const [startTime, setStartTime] = useState(() => {
    if (entryToEdit?.start_time && typeof entryToEdit.start_time === 'string' && entryToEdit.start_time.includes('T')) {
      const timePart = entryToEdit.start_time.split('T')[1]?.slice(0, 5);
      return timePart && timePart !== '00:00' ? timePart : '10:00';
    }
    return '10:00';
  });
  const [endTime, setEndTime] = useState(() => {
    if (entryToEdit?.end_time && typeof entryToEdit.end_time === 'string' && entryToEdit.end_time.includes('T')) {
      const timePart = entryToEdit.end_time.split('T')[1]?.slice(0, 5);
      return timePart && timePart !== '00:00' ? timePart : '18:00';
    }
    return '18:00';
  });
  const [location, setLocation] = useState(entryToEdit?.location || '');
  const [notes, setNotes] = useState(entryToEdit?.notes || '');
  const [assignedMemberId, setAssignedMemberId] = useState(entryToEdit?.assigned_member_id || '');

  // Category specific fields
  const [amountDue, setAmountDue] = useState<number | string>(
    entryToEdit?.amount_due != null ? entryToEdit.amount_due : ''
  );
  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Paid' | 'Cancelled'>(
    entryToEdit?.payment_status || 'Pending'
  );
  const [deadlineStatus, setDeadlineStatus] = useState<'Pending' | 'In Progress' | 'Completed' | 'Overdue'>(
    entryToEdit?.deadline_status || 'Pending'
  );
  const [participants, setParticipants] = useState(entryToEdit?.participants || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset or initialize state when entryToEdit or isOpen changes
  useEffect(() => {
    if (entryToEdit) {
      setCategory(entryToEdit.category || 'Events');
      setSelectedProjectId(entryToEdit.project_id || '');
      setIsChangingProject(false);
      setTitle(entryToEdit.title || '');
      const validDate = entryToEdit.start_time && typeof entryToEdit.start_time === 'string'
        ? entryToEdit.start_time.slice(0, 10)
        : getLocalTodayDateString();
      setDate(validDate);

      if (entryToEdit.start_time && typeof entryToEdit.start_time === 'string' && entryToEdit.start_time.includes('T')) {
        const t = entryToEdit.start_time.split('T')[1]?.slice(0, 5);
        setStartTime(t && t !== '00:00' ? t : '10:00');
      } else {
        setStartTime('10:00');
      }

      if (entryToEdit.end_time && typeof entryToEdit.end_time === 'string' && entryToEdit.end_time.includes('T')) {
        const t = entryToEdit.end_time.split('T')[1]?.slice(0, 5);
        setEndTime(t && t !== '00:00' ? t : '18:00');
      } else {
        setEndTime('18:00');
      }

      setLocation(entryToEdit.location || '');
      setNotes(entryToEdit.notes || '');
      setAssignedMemberId(entryToEdit.assigned_member_id || '');
      setAmountDue(entryToEdit.amount_due != null ? entryToEdit.amount_due : '');
      setPaymentStatus(entryToEdit.payment_status || 'Pending');
      setDeadlineStatus(entryToEdit.deadline_status || 'Pending');
      setParticipants(entryToEdit.participants || '');
    } else {
      setCategory('Events');
      const projId = preselectedProject?.id || '';
      setSelectedProjectId(projId);
      setIsChangingProject(!projId);
      setTitle('');
      setDate(getLocalTodayDateString());
      setStartTime('10:00');
      setEndTime('18:00');
      setLocation(preselectedProject?.venue || '');
      setNotes('');
      setAssignedMemberId('');
      setAmountDue('');
      setPaymentStatus('Pending');
      setDeadlineStatus('Pending');
      setParticipants('');
    }
    setErrorMsg('');
    setShowDeleteConfirm(false);
  }, [entryToEdit, preselectedProject, isOpen]);

  // Filter projects for the searchable selector
  const filteredProjects = useMemo(() => {
    const list = projects || [];
    const q = projectSearchQuery.trim().toLowerCase();
    return list.filter(p => {
      if (!p) return false;
      if (brandFilter !== 'all' && p.company_id !== brandFilter) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.venue?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
      );
    });
  }, [projects, brandFilter, projectSearchQuery]);

  const activeProject = useMemo(() => {
    if (preselectedProject && (!selectedProjectId || selectedProjectId === preselectedProject.id)) {
      return preselectedProject;
    }
    if (!selectedProjectId) return null;
    return (projects || []).find(p => p && p.id === selectedProjectId) || null;
  }, [preselectedProject, projects, selectedProjectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a title for this calendar entry.');
      return;
    }
    if (!date) {
      setErrorMsg('Please select a valid date.');
      return;
    }
    if (category === 'Payments') {
      if (amountDue === '' || isNaN(Number(amountDue))) {
        setErrorMsg('Please enter an amount due.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Determine company_id
      let resolvedCompany: 'twb' | 'golden_june' = 'twb';
      if (activeProject) {
        resolvedCompany = activeProject.company_id === 'golden_june' ? 'golden_june' : 'twb';
      } else if (brandFilter === 'golden_june') {
        resolvedCompany = 'golden_june';
      }

      // Map to legacy event_type for compatibility
      let legacyEventType: CalendarEventType = 'Other';
      if (category === 'Events') legacyEventType = 'Wedding';
      else if (category === 'Payments') legacyEventType = 'Payment Reminder';
      else if (category === 'Deadlines') legacyEventType = 'Deadline';
      else if (category === 'Meetings') legacyEventType = 'Meeting';

      // Build serialized notes with category metadata
      const serializedNotes = serializeCalendarNotes(
        {
          category,
          amount_due: category === 'Payments' && amountDue !== '' ? Number(amountDue) : undefined,
          payment_status: category === 'Payments' ? paymentStatus : undefined,
          deadline_status:
            category === 'Deadlines'
              ? calculateDeadlineStatus(deadlineStatus, date)
              : undefined,
          participants: category === 'Meetings' ? participants.trim() || undefined : undefined,
        },
        notes
      );

      const startIso = startTime ? `${date}T${startTime}:00` : `${date}T10:00:00`;
      const endIso =
        category === 'Meetings'
          ? startIso
          : category === 'Events'
          ? `${date}T${endTime || startTime || '18:00'}:00`
          : startIso;

      const eventPayload: Omit<CalendarEvent, 'id'> = {
        company_id: resolvedCompany,
        project_id: selectedProjectId || undefined,
        title: title.trim(),
        event_type: legacyEventType,
        start_time: startIso,
        end_time: endIso,
        location: location.trim() || undefined,
        notes: serializedNotes,
        assigned_member_id: assignedMemberId || undefined,
      };

      await onSave(eventPayload, entryToEdit?.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to save calendar entry:', err);
      setErrorMsg(err.message || 'Failed to save calendar entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entryToEdit || !onDelete) return;
    try {
      setIsSubmitting(true);
      await onDelete(entryToEdit.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete calendar entry:', err);
      setErrorMsg(err.message || 'Failed to delete calendar entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProjectEventSource = entryToEdit?.source === 'project';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {entryToEdit ? 'Edit Calendar Entry' : 'Add Calendar Entry'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {preselectedProject
                ? `Associated with project: ${preselectedProject.name}`
                : 'Schedule events, payment milestones, production deadlines, or client meetings.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isProjectEventSource && (
          <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-purple-600 mt-0.5" />
            <div>
              <span className="font-semibold">Linked Project Wedding Schedule</span>
              <p className="text-[11px] text-purple-700 mt-0.5">
                This event originates from the project's core shoot & ceremony schedule.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* STEP 1: Project Association (Only if not fixed inside Project Overview) */}
          {!preselectedProject && (
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700">
                Associated Project
              </label>

              {!isChangingProject && activeProject ? (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      {activeProject.company_id === 'golden_june' ? 'GJ' : 'TWB'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {activeProject.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {activeProject.wedding_date_start}
                        {activeProject.city ? ` • ${activeProject.city}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangingProject(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                  >
                    Change
                  </button>
                </div>
              ) : !isChangingProject && !selectedProjectId ? (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Company-wide / No Project
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Internal business meeting, studio deadline, or team event
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangingProject(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Searchable Project Dropdown */
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type to filter projects by couple name..."
                      value={projectSearchQuery}
                      onChange={e => setProjectSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>

                  {/* Company-wide / No project option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectId('');
                      setIsChangingProject(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between ${
                      !selectedProjectId
                        ? 'border-slate-900 bg-white font-bold'
                        : 'border-slate-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-600" />
                      <div>
                        <span className="text-slate-900 font-semibold">
                          Company-wide / No Project
                        </span>
                        <p className="text-[10px] text-slate-400 font-normal">
                          Internal meetings, studio tasks, general events
                        </p>
                      </div>
                    </div>
                    {!selectedProjectId && <Check className="w-4 h-4 text-slate-900" />}
                  </button>

                  {/* Projects List */}
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setIsChangingProject(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between ${
                          selectedProjectId === p.id
                            ? 'border-slate-900 bg-white font-bold shadow-2xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-slate-900 font-semibold truncate max-w-sm">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {p.wedding_date_start}
                            {(() => {
                              const v = p.venue && p.venue !== 'Principal Venue' ? p.venue : '';
                              const loc = v || p.city || '';
                              return loc ? ` • ${loc}` : '';
                            })()}
                          </div>
                        </div>
                        {selectedProjectId === p.id && (
                          <Check className="w-4 h-4 text-slate-900 shrink-0" />
                        )}
                      </button>
                    ))}
                    {filteredProjects.length === 0 && (
                      <div className="text-center py-2 text-[11px] text-slate-400">
                        No matching projects found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Category Selector (4 Categories with Required Colors) */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">
              Entry Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(CALENDAR_CATEGORIES) as CalendarCategory[]).map(catKey => {
                const conf = CALENDAR_CATEGORIES[catKey];
                const isSelected = category === catKey;

                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: conf.colorHex }}
                      />
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </div>
                    <div className="font-bold text-slate-900 text-xs">
                      {conf.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {catKey === 'Events' && 'Shoot & Day'}
                      {catKey === 'Payments' && 'Milestone Due'}
                      {catKey === 'Deadlines' && 'Production'}
                      {catKey === 'Meetings' && 'Consultations'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Field (Contextual label) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {category === 'Events' && 'Event / Shoot Title'}
              {category === 'Payments' && 'Payment Milestone Title'}
              {category === 'Deadlines' && 'Deadline / Task Title'}
              {category === 'Meetings' && 'Meeting / Consultation Title'}
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                category === 'Events'
                  ? 'e.g. Wedding Ceremony & Reception'
                  : category === 'Payments'
                    ? 'e.g. Mid-Project Advance (50%)'
                    : category === 'Deadlines'
                      ? 'e.g. Rough Cut Video Review'
                      : 'e.g. Pre-wedding Moodboard Consultation'
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Date & Time Fields */}
          <div
            className={`grid grid-cols-1 ${
              category === 'Events'
                ? 'sm:grid-cols-3'
                : category === 'Meetings'
                ? 'sm:grid-cols-2'
                : 'sm:grid-cols-1'
            } gap-3`}
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {category === 'Deadlines' ? 'Due Date' : category === 'Payments' ? 'Due Date' : 'Date'}
                <span className="text-red-500"> *</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            {category === 'Events' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </>
            )}

            {category === 'Meetings' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Start Time <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* CATEGORY SPECIFIC FIELDS */}

          {/* B. Payments Specific Fields */}
          {category === 'Payments' && (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-emerald-950 mb-1">
                    Amount Due (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="Enter amount due in ₹"
                    value={amountDue}
                    onChange={e => {
                      const val = e.target.value;
                      setAmountDue(val === '' ? '' : Number(val));
                    }}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  {amountDue !== '' && !isNaN(Number(amountDue)) && (
                    <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                      ₹{Number(amountDue).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-emerald-950 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>
                  Reminder notice only. Does not log an accounting transaction in Finance.
                </span>
              </div>
            </div>
          )}

          {/* C. Deadlines Specific Fields */}
          {category === 'Deadlines' && (
            <div className="p-3 bg-orange-50/60 border border-orange-200/80 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-orange-950 mb-1">
                    Assigned Team Member
                  </label>
                  <select
                    value={assignedMemberId}
                    onChange={e => setAssignedMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg text-xs text-slate-900"
                  >
                    <option value="">-- Unassigned --</option>
                    {(teamMembers || []).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-orange-950 mb-1">
                    Deadline Status
                  </label>
                  <select
                    value={deadlineStatus}
                    onChange={e => setDeadlineStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              {date && date < getLocalTodayDateString() && deadlineStatus !== 'Completed' && (
                <div className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Due date has passed — marked automatically as Overdue.</span>
                </div>
              )}
            </div>
          )}

          {/* D. Meetings Specific Fields */}
          {category === 'Meetings' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-amber-950 mb-1">
                    Meeting Location / Physical Venue
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Studio, Client Office, or Cafe"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-amber-950 mb-1">
                    Participants
                  </label>
                  <input
                    type="text"
                    value={participants}
                    onChange={e => setParticipants(e.target.value)}
                    placeholder="e.g. Couple, Lead Editor, Studio Director"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* A. Events Specific Location & Crew Fields */}
          {category === 'Events' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Taj Lake Palace, Udaipur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Crew Member
                </label>
                <select
                  value={assignedMemberId}
                  onChange={e => setAssignedMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                >
                  <option value="">-- General Studio / Unassigned --</option>
                  {(teamMembers || []).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role_title})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes (Common) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Notes & Special Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                category === 'Events'
                  ? 'Add event details, schedule information, venue instructions, or special arrangements...'
                  : category === 'Payments'
                  ? 'Add payment context, agreed payment terms, or follow-up instructions...'
                  : category === 'Deadlines'
                  ? 'Add deliverable details, review requirements, or production instructions...'
                  : 'Add discussion topics, preparation notes, or important points to cover...'
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              {entryToEdit && onDelete && !isProjectEventSource && (
                !showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-600 font-bold">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white font-semibold rounded"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : entryToEdit ? 'Save Changes' : 'Create Entry'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
