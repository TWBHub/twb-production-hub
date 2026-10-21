import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  MapPin,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent, CalendarEventType } from '../../types';
import { apiService } from '../../services/api';
import { formatDisplayDate } from '../../utils/dateUtils';

type DisplayCalendarEvent = CalendarEvent & {
  source?: 'calendar' | 'project';
  project_name?: string;
  project_event_id?: string;
};

export const CalendarView: React.FC = () => {
  const {
    filteredCalendarEvents,
    createCalendarEvent,
    deleteCalendarEvent,
    teamMembers,
    projects,
    brandFilter,
  } = useApp();

  // Current calendar month view navigation
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // September 2026

  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [selectedDayEvents, setSelectedDayEvents] = useState<DisplayCalendarEvent[] | null>(null);
  const [selectedDayString, setSelectedDayString] = useState<string>('');

  // Actual project events from project_events table
  const [projectEvents, setProjectEvents] = useState<DisplayCalendarEvent[]>([]);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<'twb' | 'golden_june'>(
    brandFilter === 'golden_june' ? 'golden_june' : 'twb'
  );
  const [eventType, setEventType] = useState<CalendarEventType>('Wedding');
  const [startDate, setStartDate] = useState('2026-09-20T10:00');
  const [endDate, setEndDate] = useState('2026-09-20T22:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedMemberId, setAssignedMemberId] = useState('');
  const [projectId, setProjectId] = useState('');

  // Keep Company / Brand field in sync with the global brand filter
  useEffect(() => {
    setCompanyId(
      brandFilter === 'golden_june' ? 'golden_june' : 'twb'
    );
  }, [brandFilter]);

  // Load the actual event schedule for every project
  useEffect(() => {
    const loadProjectEvents = async () => {
      const events: DisplayCalendarEvent[] = [];

      for (const project of projects) {
        try {
          const projectEventList = await apiService.getProjectEvents(project.id);

          projectEventList.forEach((event: any) => {
            // Respect the current company / brand filter
            if (
              brandFilter !== 'all' &&
              project.company_id !== brandFilter
            ) {
              return;
            }

            const timePart = event.event_time
              ? `T${event.event_time}`
              : 'T00:00:00';

            events.push({
              id: `project-event-${event.id}`,
              project_event_id: event.id,
              source: 'project',
              project_name: project.name,

              // Convert project event into the same display structure
              // used by the existing calendar.
              title: event.event_name
                ? `${event.event_name} — ${project.name}`
                : project.name,

              event_type: 'Wedding',

              start_time: `${event.event_date}${timePart}`,

              end_time: event.event_time
                ? `${event.event_date}T${event.event_time}`
                : `${event.event_date}T23:59:59`,

              location: event.event_address || '',
              notes: event.event_notes || '',

              // Project events currently don't have a crew assignment
              // directly attached to the event record.
              assigned_member_id: undefined,
            } as DisplayCalendarEvent);
          });
        } catch (error) {
          console.error(
            `Failed to load project events for ${project.name}:`,
            error
          );
        }
      }

      setProjectEvents(events);
    };

    if (projects.length > 0) {
      loadProjectEvents();
    } else {
      setProjectEvents([]);
    }
  }, [projects, brandFilter]);

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

  // Combine the existing calendar events with actual project events
  // Note: Deliverable due dates are NOT shown on the Calendar
  const allCalendarEvents: DisplayCalendarEvent[] = [
    ...filteredCalendarEvents
      .filter(event => event.event_type !== 'Deliverable Deadline')
      .map(event => ({
        ...event,
        source: 'calendar' as const,
      })),
    ...projectEvents,
  ];

  // Filter events
  const filteredEvents = allCalendarEvents.filter(e => {
    if (selectedEventType === 'all') return true;
    return e.event_type === selectedEventType;
  });

  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`;

    return filteredEvents.filter(e =>
      e.start_time.startsWith(dayStr)
    );
  };

  const getEventTypeColor = (type: CalendarEventType) => {
    switch (type) {
      case 'Wedding':
        return 'bg-purple-600 text-white';

      case 'Shoot':
        return 'bg-blue-600 text-white';

      case 'Meeting':
        return 'bg-emerald-600 text-white';

      case 'Deadline':
      case 'Deliverable Deadline':
        return 'bg-rose-600 text-white';

      case 'Payment Reminder':
        return 'bg-[#F1D099] text-[#2b2011] font-semibold';

      case 'Team Assignment':
        return 'bg-indigo-600 text-white';

      default:
        return 'bg-slate-700 text-white';
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !startDate) return;

    await createCalendarEvent({
      company_id: companyId,
      project_id: projectId || undefined,
      title,
      event_type: eventType,
      start_time: new Date(startDate).toISOString(),
      end_time: new Date(endDate || startDate).toISOString(),
      location,
      notes,
      assigned_member_id: assignedMemberId || undefined,
    });

    setShowCreateModal(false);

    // Reset form
    setTitle('');
    setLocation('');
    setNotes('');
    setAssignedMemberId('');
    setProjectId('');
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
            Wedding dates, shoots, consultations, editing deadlines, and payment reminders.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Calendar Event</span>
        </button>
      </div>

      {/* Navigation & Event Filter Bar */}
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
            onClick={() => setCurrentDate(new Date(2026, 8, 1))}
            className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium border border-slate-200"
          >
            Today
          </button>
        </div>

        {/* Filter Type */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />

          <select
            value={selectedEventType}
            onChange={e => setSelectedEventType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 w-full md:w-auto"
          >
            <option value="all">All Event Types</option>
            <option value="Wedding">Wedding Dates</option>
            <option value="Shoot">Shoots</option>
            <option value="Meeting">Meetings / Consultations</option>
            <option value="Payment Reminder">
              Payment Reminders
            </option>
            <option value="Team Assignment">
              Team Assignments
            </option>
          </select>
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
            <div
              key={`empty-${idx}`}
              className="h-28 sm:h-32 bg-slate-50/50 p-1.5"
            />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayEvents = getEventsForDay(dayNum);

            const isToday =
              dayNum === 16 &&
              month === 8 &&
              year === 2026;

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
                  dayEvents.length > 0
                    ? 'cursor-pointer hover:bg-slate-50'
                    : ''
                } ${isToday ? 'bg-blue-50/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
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

                {/* Event pills preview */}
                <div className="space-y-1 overflow-y-auto max-h-20 py-0.5">
                  {dayEvents.slice(0, 2).map(evt => (
                    <div
                      key={evt.id}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate shadow-2xs ${getEventTypeColor(
                        evt.event_type
                      )}`}
                      title={`${evt.title} (${evt.event_type})`}
                    >
                      {evt.title}
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div className="text-[9px] font-bold text-blue-600 pl-1">
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
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Events for {selectedDayString}
                </h3>

                <span className="text-xs text-slate-500">
                  {selectedDayEvents.length} items scheduled
                </span>
              </div>

              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {selectedDayEvents.map(evt => {
                const member = teamMembers.find(
                  t => t.id === evt.assigned_member_id
                );

                const isProjectEvent = evt.source === 'project';

                return (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {evt.title}
                      </span>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${getEventTypeColor(
                          evt.event_type
                        )}`}
                      >
                        {isProjectEvent
                          ? 'Project Event'
                          : evt.event_type}
                      </span>
                    </div>

                    <div className="text-slate-500 text-[11px]">
                      Time:{' '}
                      {evt.start_time.includes('T00:00:00')
                        ? 'Not specified'
                        : evt.start_time
                            .replace('T', ' ')
                            .slice(0, 16)}
                    </div>

                    {evt.location && (
                      <div className="text-slate-600 flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {evt.location}
                      </div>
                    )}

                    {member && (
                      <div className="text-slate-600 text-[11px]">
                        Assigned crew:{' '}
                        <strong>{member.name}</strong>
                      </div>
                    )}

                    {isProjectEvent && evt.project_name && (
                      <div className="text-slate-600 text-[11px]">
                        Project:{' '}
                        <strong>{evt.project_name}</strong>
                      </div>
                    )}

                    {evt.notes && (
                      <p className="text-slate-500 text-[11px] italic bg-white p-2 rounded border border-slate-100">
                        {evt.notes}
                      </p>
                    )}

                    {/* Only manually-created calendar events can be
                        deleted from this screen. Project events are
                        managed from the project workspace. */}
                    {!isProjectEvent && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={async () => {
                            await deleteCalendarEvent(evt.id);

                            setSelectedDayEvents(prev =>
                              prev
                                ? prev.filter(
                                    e => e.id !== evt.id
                                  )
                                : null
                            );
                          }}
                          className="text-[10px] text-red-600 hover:underline"
                        >
                          Delete Event
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Calendar Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Add Business Calendar Event
              </h2>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company / Brand
                  </label>

                  <select
                    value={companyId}
                    onChange={e =>
                      setCompanyId(
                        e.target.value as 'twb' | 'golden_june'
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="twb">
                      The Wedding Booth
                    </option>

                    <option value="golden_june">
                      Golden June Films
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Event Category
                  </label>

                  <select
                    value={eventType}
                    onChange={e =>
                      setEventType(
                        e.target.value as CalendarEventType
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Wedding">
                      Wedding Day
                    </option>

                    <option value="Shoot">
                      Shoot (Engagement / Pre-wedding)
                    </option>

                    <option value="Meeting">
                      Meeting / Couple Consultation
                    </option>

                    <option value="Payment Reminder">
                      Payment Reminder
                    </option>

                    <option value="Team Assignment">
                      Team Assignment
                    </option>

                    <option value="Other">
                      Other Business Event
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Event Title
                </label>

                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Wedding Shoot: Olivia & Marcus"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>

                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={e =>
                      setStartDate(e.target.value)
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Time
                  </label>

                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={e =>
                      setEndDate(e.target.value)
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Location / Venue
                  </label>

                  <input
                    type="text"
                    value={location}
                    onChange={e =>
                      setLocation(e.target.value)
                    }
                    placeholder="Venue, Studio, or Zoom Link"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Crew Member
                  </label>

                  <select
                    value={assignedMemberId}
                    onChange={e =>
                      setAssignedMemberId(e.target.value)
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">
                      -- None / General Studio --
                    </option>

                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role_title})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link to Project (Optional)
                </label>

                <select
                  value={projectId}
                  onChange={e =>
                    setProjectId(e.target.value)
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="">
                    -- Not tied to project --
                  </option>

                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};