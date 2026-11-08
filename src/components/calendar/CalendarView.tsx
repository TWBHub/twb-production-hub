import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  MapPin,
  X,
  Building,
  DollarSign,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';
import { formatDisplayDate, isLocalToday } from '../../utils/dateUtils';
import {
  CalendarCategory,
  CALENDAR_CATEGORIES,
  UnifiedCalendarEntry,
  combineProjectAndCalendarEvents,
} from '../../utils/calendarUtils';
import { CalendarEntryModal } from './CalendarEntryModal';

export const CalendarView: React.FC = () => {
  const {
    calendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    teamMembers,
    projects,
    brandFilter,
    setSelectedProjectId,
    setActiveTab,
  } = useApp();

  // Current calendar month view navigation (defaults to actual current local month)
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Category filter: 'all' | 'Events' | 'Payments' | 'Deadlines' | 'Meetings'
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<UnifiedCalendarEntry | null>(null);

  // Day drawer
  const [selectedDayEvents, setSelectedDayEvents] = useState<UnifiedCalendarEntry[] | null>(null);
  const [selectedDayString, setSelectedDayString] = useState<string>('');

  // 1. Unified calendar entries combining calendar_events and project events without duplication
  const allEntries = useMemo(() => {
    return combineProjectAndCalendarEvents(calendarEvents, projects, teamMembers, brandFilter);
  }, [calendarEvents, projects, teamMembers, brandFilter]);

  // 2. Filter by category
  const filteredEntries = useMemo(() => {
    if (selectedCategory === 'all') return allEntries;
    return allEntries.filter(e => e.category === selectedCategory);
  }, [allEntries, selectedCategory]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEntries.filter(e => e.start_time.startsWith(dayStr));
  };

  const handleSaveEntry = async (
    eventData: Omit<CalendarEvent, 'id'>,
    existingId?: string
  ) => {
    if (existingId) {
      await updateCalendarEvent({
        ...eventData,
        id: existingId,
      });
    } else {
      await createCalendarEvent(eventData);
    }
    // Refresh day drawer if open
    if (selectedDayEvents) {
      const dayStr = selectedDayEvents[0]?.start_time?.slice(0, 10);
      if (dayStr) {
        setTimeout(() => {
          const updatedDay = allEntries.filter(e => e.start_time.startsWith(dayStr));
          setSelectedDayEvents(updatedDay.length > 0 ? updatedDay : null);
        }, 100);
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteCalendarEvent(id);
    if (selectedDayEvents) {
      setSelectedDayEvents(prev => (prev ? prev.filter(e => e.id !== id) : null));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Master Operations Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Wedding shoots, payment due dates, editing deadlines, and couple consultations.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingEntry(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Calendar Entry</span>
        </button>
      </div>

      {/* Navigation, Legend & Category Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-white text-slate-700 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs font-bold text-slate-900">
              {monthNames[month]} {year}
            </span>

            <button
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-white text-slate-700 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium border border-slate-200"
          >
            Today
          </button>
        </div>

        {/* Category Legend & Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Categories
            </button>

            {(Object.keys(CALENDAR_CATEGORIES) as CalendarCategory[]).map(catKey => {
              const conf = CALENDAR_CATEGORIES[catKey];
              const isSelected = selectedCategory === catKey;

              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: conf.colorHex }}
                  />
                  <span>{conf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Days of Week */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[11px] font-bold text-slate-600 py-2.5">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-28 sm:h-32 bg-slate-50/50 p-1.5" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayEvents = getEventsForDay(dayNum);

            // Blue highlight for actual current local date
            const isToday = isLocalToday(year, month, dayNum);

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => {
                  if (dayEvents.length > 0) {
                    setSelectedDayEvents(dayEvents);
                    setSelectedDayString(
                      formatDisplayDate(new Date(year, month, dayNum))
                    );
                  }
                }}
                className={`h-28 sm:h-32 p-1.5 overflow-hidden flex flex-col justify-between transition-colors ${
                  dayEvents.length > 0 ? 'cursor-pointer hover:bg-slate-50/80' : ''
                } ${isToday ? 'bg-blue-50/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event pills preview with agreed category colors */}
                <div className="space-y-1 overflow-y-auto max-h-20 py-0.5">
                  {dayEvents.slice(0, 2).map(evt => {
                    const conf = CALENDAR_CATEGORIES[evt.category];

                    return (
                      <div
                        key={evt.id}
                        style={{ backgroundColor: conf.colorHex }}
                        className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded truncate shadow-2xs"
                        title={`${evt.title} (${conf.label}${evt.project_name ? ` • ${evt.project_name}` : ' • Company-wide'})`}
                      >
                        {evt.title}
                      </div>
                    );
                  })}

                  {dayEvents.length > 2 && (
                    <div className="text-[9px] font-bold text-slate-500 pl-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events Drawer / Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Scheduled Entries for {selectedDayString}
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedDayEvents.length} item(s) on this date
                </span>
              </div>

              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {selectedDayEvents.map(evt => {
                const conf = CALENDAR_CATEGORIES[evt.category];

                return (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs hover:border-slate-300 transition-colors"
                  >
                    {/* Header: Title + Category Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          {evt.title}
                        </span>
                        {/* Project Name or Company-wide badge */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {evt.project_name ? (
                            <span className="text-[11px] font-semibold text-blue-700">
                              {evt.project_name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              Company-wide
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        style={{ backgroundColor: conf.colorHex }}
                        className="px-2 py-0.5 text-[10px] font-bold text-white rounded whitespace-nowrap shrink-0 shadow-2xs"
                      >
                        {conf.label}
                      </span>
                    </div>

                    {/* Metadata details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400">Time:</span>{' '}
                        {evt.start_time.includes('T') && !evt.start_time.includes('T00:00:00')
                          ? evt.start_time.split('T')[1].slice(0, 5)
                          : 'All Day'}
                      </div>

                      {evt.location && (
                        <div className="truncate" title={evt.location}>
                          <span className="text-slate-400">Venue:</span> {evt.location}
                        </div>
                      )}

                      {evt.assigned_member_name && (
                        <div>
                          <span className="text-slate-400">Assigned:</span>{' '}
                          <strong>{evt.assigned_member_name}</strong>
                        </div>
                      )}

                      {evt.amount_due !== undefined && (
                        <div>
                          <span className="text-slate-400">Amount:</span>{' '}
                          <strong className="font-mono text-emerald-700">
                            ₹{(Number(evt.amount_due) || 0).toLocaleString('en-IN')}
                          </strong>
                          {evt.payment_status && (
                            <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              evt.payment_status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {evt.payment_status}
                            </span>
                          )}
                        </div>
                      )}

                      {evt.deadline_status && (
                        <div>
                          <span className="text-slate-400">Status:</span>{' '}
                          <span className={`font-bold ${
                            evt.deadline_status === 'Completed'
                              ? 'text-emerald-700'
                              : evt.deadline_status === 'Overdue'
                                ? 'text-red-600'
                                : 'text-orange-700'
                          }`}>
                            {evt.deadline_status}
                          </span>
                        </div>
                      )}

                      {evt.participants && (
                        <div className="col-span-2 truncate">
                          <span className="text-slate-400">Participants:</span> {evt.participants}
                        </div>
                      )}
                    </div>

                    {evt.notes && (
                      <p className="text-slate-500 text-[11px] italic bg-white p-2 rounded-lg border border-slate-100">
                        {evt.notes}
                      </p>
                    )}

                    {/* Quick Action Buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <div>
                        {evt.project_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(evt.project_id!);
                              setActiveTab('projects');
                              setSelectedDayEvents(null);
                            }}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <span>Open Project Workspace</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {evt.source === 'calendar' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(evt);
                                setIsModalOpen(true);
                                setSelectedDayEvents(null);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 rounded flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleDeleteEntry(evt.id);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setIsModalOpen(true);
                  setSelectedDayEvents(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entry</span>
              </button>

              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Add / Edit Calendar Entry Modal */}
      <CalendarEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
        }}
        entryToEdit={editingEntry}
        projects={projects}
        teamMembers={teamMembers}
        brandFilter={brandFilter}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />
    </div>
  );
};