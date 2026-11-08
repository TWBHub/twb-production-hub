import { CalendarEvent, CalendarEventType, Project, TeamMember, ProjectEvent } from '../types';
import { getLocalTodayDateString, isLocalToday } from './dateUtils';

export { getLocalTodayDateString, isLocalToday };

export type CalendarCategory = 'Events' | 'Payments' | 'Deadlines' | 'Meetings';

export interface CalendarCategoryConfig {
  id: CalendarCategory;
  label: string;
  color: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  dotColor: string;
  description: string;
}

export const CALENDAR_CATEGORIES: Record<CalendarCategory, CalendarCategoryConfig> = {
  Events: {
    id: 'Events',
    label: 'Events',
    color: '#9333EA',
    colorHex: '#9333EA',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    borderClass: 'border-purple-200 bg-purple-50/70 text-purple-900',
    dotColor: '#9333EA',
    description: 'Weddings, shoots, engagements, and production events',
  },
  Payments: {
    id: 'Payments',
    label: 'Payments',
    color: '#16A34A',
    colorHex: '#16A34A',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    borderClass: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    dotColor: '#16A34A',
    description: 'Payment reminders, milestone balances, and retainer notices',
  },
  Deadlines: {
    id: 'Deadlines',
    label: 'Deadlines',
    color: '#EA580C',
    colorHex: '#EA580C',
    badgeBg: 'bg-orange-600',
    badgeText: 'text-white',
    borderClass: 'border-orange-200 bg-orange-50/70 text-orange-900',
    dotColor: '#EA580C',
    description: 'Editing delivery dates, teaser cuts, and album approvals',
  },
  Meetings: {
    id: 'Meetings',
    label: 'Meetings',
    color: '#EAB308',
    colorHex: '#EAB308',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    borderClass: 'border-amber-200 bg-amber-50/70 text-amber-900',
    dotColor: '#EAB308',
    description: 'Couple consultations, recce syncs, and team planning calls',
  },
};

export interface CalendarNotesMetadata {
  category?: CalendarCategory;
  amount_due?: number;
  payment_status?: 'Pending' | 'Paid' | 'Cancelled';
  deadline_status?: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  participants?: string;
  meeting_link?: string;
  user_notes?: string;
}

/**
 * Safely parses JSON metadata stored inside calendar_events.notes while preserving
 * legacy human-written notes without breaking database schemas.
 */
export const parseCalendarNotes = (
  rawNotes?: string | null
): { userNotes: string; metadata: CalendarNotesMetadata } => {
  if (!rawNotes) return { userNotes: '', metadata: {} };
  const trimmed = rawNotes.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as CalendarNotesMetadata;
      return {
        userNotes: parsed.user_notes || '',
        metadata: parsed,
      };
    } catch {
      // Fall through to plain text
    }
  }
  return { userNotes: rawNotes, metadata: {} };
};

/**
 * Serializes calendar metadata and user notes into a clean JSON string for safe storage in notes.
 */
export const serializeCalendarNotes = (
  metadata: CalendarNotesMetadata,
  userNotes?: string
): string => {
  return JSON.stringify({
    ...metadata,
    user_notes: (userNotes || '').trim(),
  });
};

/**
 * Maps legacy or existing event_type strings to one of the 4 standard categories:
 * Events (#9333EA), Payments (#16A34A), Deadlines (#EA580C), Meetings (#EAB308).
 */
export const mapEventTypeToCategory = (
  eventType?: string | null,
  metadataCategory?: CalendarCategory
): CalendarCategory => {
  if (metadataCategory && CALENDAR_CATEGORIES[metadataCategory]) {
    return metadataCategory;
  }
  if (!eventType) return 'Events';

  const lower = eventType.trim().toLowerCase();
  if (lower === 'payment reminder' || lower.includes('payment') || lower.includes('retainer') || lower.includes('fee')) {
    return 'Payments';
  }
  if (lower === 'deadline' || lower === 'deliverable deadline' || lower.includes('deadline') || lower.includes('due') || lower.includes('delivery')) {
    return 'Deadlines';
  }
  if (lower === 'meeting' || lower.includes('consultation') || lower.includes('call') || lower.includes('sync')) {
    return 'Meetings';
  }
  return 'Events';
};

/**
 * Calculates effective deadline status based on completion and date.
 */
export const calculateDeadlineStatus = (
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Overdue',
  dueDateStr?: string
): 'Pending' | 'In Progress' | 'Completed' | 'Overdue' => {
  if (status === 'Completed') return 'Completed';
  if (!dueDateStr) return status || 'Pending';

  const dateOnly = dueDateStr.slice(0, 10);
  const todayOnly = getLocalTodayDateString();

  if (dateOnly < todayOnly) {
    return 'Overdue';
  }
  return status || 'Pending';
};

export interface UnifiedCalendarEntry {
  id: string;
  company_id: 'twb' | 'golden_june' | string;
  project_id?: string;
  project_name?: string;
  projectName?: string;
  project_event_id?: string;
  calendarEventId?: string;
  source: 'calendar' | 'project';
  title: string;
  category: CalendarCategory;
  color: string;
  colorHex: string;
  event_type: CalendarEventType;
  start_time: string; // ISO string
  end_time: string; // ISO string
  location?: string;
  notes?: string;
  assigned_member_id?: string;
  assigned_member_name?: string;

  // Category specific fields
  amount_due?: number;
  payment_status?: 'Pending' | 'Paid' | 'Cancelled';
  deadline_status?: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  participants?: string;
  meeting_link?: string;
  is_company_wide: boolean;
  isCompanyWide: boolean;
}

/**
 * Combines explicit calendar_events and project event dates into a single, unified,
 * deduplicated calendar feed. Works symmetrically for Master Calendar and Project Calendar.
 */
export const combineProjectAndCalendarEvents = (
  calendarEvents: CalendarEvent[],
  projects: Project[],
  teamMembers: TeamMember[] = [],
  brandFilter: 'all' | 'twb' | 'golden_june' = 'all'
): UnifiedCalendarEntry[] => {
  const result: UnifiedCalendarEntry[] = [];
  const seenKeys = new Set<string>();

  // 1. Process explicit calendar_events records
  calendarEvents.forEach(evt => {
    // Brand filtering check
    const matchedProject = evt.project_id ? projects.find(p => p.id === evt.project_id) : undefined;
    const resolvedCompany = matchedProject?.company_id || evt.company_id || 'twb';

    if (brandFilter !== 'all' && resolvedCompany !== brandFilter) {
      return;
    }

    const { userNotes, metadata } = parseCalendarNotes(evt.notes);
    const category = mapEventTypeToCategory(evt.event_type, metadata.category);

    const member = evt.assigned_member_id
      ? teamMembers.find(t => t.id === evt.assigned_member_id)
      : undefined;

    const rawDeadlineStatus = metadata.deadline_status || (category === 'Deadlines' ? 'Pending' : undefined);
    const deadlineStatus = rawDeadlineStatus ? calculateDeadlineStatus(rawDeadlineStatus, evt.start_time) : undefined;
    const isCompanyWide = !evt.project_id;
    const projName = matchedProject?.name || (isCompanyWide ? 'Company-wide / Studio' : undefined);

    const entry: UnifiedCalendarEntry = {
      id: evt.id,
      calendarEventId: evt.id,
      company_id: resolvedCompany,
      project_id: evt.project_id,
      project_name: projName,
      projectName: projName,
      source: 'calendar',
      title: evt.title,
      category,
      color: CALENDAR_CATEGORIES[category].colorHex,
      colorHex: CALENDAR_CATEGORIES[category].colorHex,
      event_type: evt.event_type,
      start_time: evt.start_time,
      end_time: evt.end_time || evt.start_time,
      location: evt.location || '',
      notes: userNotes,
      assigned_member_id: evt.assigned_member_id,
      assigned_member_name: member?.name,
      amount_due: metadata.amount_due,
      payment_status: metadata.payment_status || (category === 'Payments' ? 'Pending' : undefined),
      deadline_status: deadlineStatus,
      participants: metadata.participants,
      meeting_link: metadata.meeting_link,
      is_company_wide: isCompanyWide,
      isCompanyWide,
    };

    result.push(entry);

    // Track to prevent duplicating identical project events
    if (evt.project_id) {
      const dateKey = evt.start_time ? evt.start_time.slice(0, 10) : '';
      seenKeys.add(`${evt.project_id}:${dateKey}`);
      seenKeys.add(`${evt.project_id}:${evt.title.toLowerCase().trim()}`);
    }
  });

  // 2. Process project event schedules (e.g. Lead converted to Project, or manually added in project schedule)
  projects.forEach(project => {
    if (brandFilter !== 'all' && project.company_id !== brandFilter) {
      return;
    }

    const events = project.events || [];

    if (events.length > 0) {
      events.forEach((pe, index) => {
        const dateKey = pe.event_date ? pe.event_date.slice(0, 10) : '';
        const titleKey = pe.event_name ? pe.event_name.toLowerCase().trim() : '';

        // If an explicit calendar_events record already exists with this project and date, skip to avoid double count
        if (seenKeys.has(`${project.id}:${dateKey}`) || seenKeys.has(`${project.id}:${titleKey}`)) {
          return;
        }

        const rawDate = pe.event_date ? String(pe.event_date).trim() : '';
        const dateOnly = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
        const timePart = pe.event_time
          ? (String(pe.event_time).includes(':') ? pe.event_time : `${pe.event_time}:00`)
          : (rawDate.includes('T') ? rawDate.split('T')[1]?.slice(0, 5) || '10:00' : '10:00');
        const formattedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
        const startIso = dateOnly ? `${dateOnly}T${formattedTime || '10:00:00'}` : new Date().toISOString();
        const endIso = dateOnly ? `${dateOnly}T22:00:00` : startIso;

        // Look for assigned crew member if team string matches
        let assignedMemberId: string | undefined;
        let assignedMemberName: string | undefined;
        if (pe.team) {
          const matchedMember = teamMembers.find(t => pe.team?.toLowerCase().includes(t.name.toLowerCase()));
          if (matchedMember) {
            assignedMemberId = matchedMember.id;
            assignedMemberName = matchedMember.name;
          } else {
            assignedMemberName = pe.team;
          }
        }

        result.push({
          id: `project-event-${pe.id || `${project.id}-${index}`}`,
          calendarEventId: undefined,
          project_id: project.id,
          project_name: project.name,
          projectName: project.name,
          project_event_id: pe.id,
          company_id: project.company_id,
          source: 'project',
          title: pe.event_name ? `${pe.event_name} — ${project.name}` : `Wedding Event — ${project.name}`,
          category: 'Events',
          color: CALENDAR_CATEGORIES.Events.colorHex,
          colorHex: CALENDAR_CATEGORIES.Events.colorHex,
          event_type: 'Wedding',
          start_time: startIso,
          end_time: endIso,
          location: pe.event_address || project.venue || project.city || '',
          notes: pe.event_notes || '',
          assigned_member_id: assignedMemberId,
          assigned_member_name: assignedMemberName,
          is_company_wide: false,
          isCompanyWide: false,
        });

        seenKeys.add(`${project.id}:${dateKey}`);
      });
    } else if (project.wedding_date_start) {
      // If project has no sub-events in project.events, represent its main wedding date
      const rawStart = String(project.wedding_date_start).trim();
      const startOnly = rawStart.includes('T') ? rawStart.split('T')[0] : rawStart;
      const rawEnd = project.wedding_date_end ? String(project.wedding_date_end).trim() : startOnly;
      const endOnly = rawEnd.includes('T') ? rawEnd.split('T')[0] : rawEnd;
      const dateKey = startOnly.slice(0, 10);
      if (!seenKeys.has(`${project.id}:${dateKey}`)) {
        result.push({
          id: `project-wedding-${project.id}`,
          calendarEventId: undefined,
          project_id: project.id,
          project_name: project.name,
          projectName: project.name,
          company_id: project.company_id,
          source: 'project',
          title: `Wedding: ${project.name}`,
          category: 'Events',
          color: CALENDAR_CATEGORIES.Events.colorHex,
          colorHex: CALENDAR_CATEGORIES.Events.colorHex,
          event_type: 'Wedding',
          start_time: `${startOnly}T10:00:00`,
          end_time: `${endOnly}T22:00:00`,
          location: project.venue || project.city || '',
          notes: project.package_name || '',
          is_company_wide: false,
          isCompanyWide: false,
        });
        seenKeys.add(`${project.id}:${dateKey}`);
      }
    }
  });

  // Sort chronologically by start_time ascending
  result.sort((a, b) => {
    const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
    const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  return result;
};

/**
 * Returns all calendar entries associated with a specific project, including
 * project wedding events, payment reminders, production deadlines, and client meetings.
 * Never includes company-wide entries.
 */
export const getProjectCalendarEntries = (
  project: Project,
  calendarEvents: CalendarEvent[],
  teamMembers: TeamMember[] = []
): UnifiedCalendarEntry[] => {
  const allEntries = combineProjectAndCalendarEvents(calendarEvents, [project], teamMembers, 'all');
  return allEntries.filter(e => e.project_id === project.id && !e.is_company_wide);
};
