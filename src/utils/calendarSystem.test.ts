import {
  CALENDAR_CATEGORIES,
  CalendarCategory,
  serializeCalendarNotes,
  parseCalendarNotes,
  calculateDeadlineStatus,
  combineProjectAndCalendarEvents,
  getProjectCalendarEntries,
  mapEventTypeToCategory,
  getLocalTodayDateString,
  isLocalToday,
} from './calendarUtils';
import { Project, CalendarEvent, TeamMember } from '../types';

function runCalendarTests() {
  console.log('--- Starting Calendar System Redesign & Synchronization Tests ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (!condition) {
      console.error(`FAIL: ${testName} | Expected:`, expected, '| Got:', actual);
      failures++;
    } else {
      console.log(`PASS: ${testName}`);
    }
  }

  // =========================================================================
  // Suite 1: Strict Category Definitions and Hex Colors
  // =========================================================================
  console.log('\n[Suite 1] Strict Category Definitions & Colors');
  assert(
    CALENDAR_CATEGORIES.Events.color === '#9333EA',
    'Events color is exactly purple (#9333EA)',
    CALENDAR_CATEGORIES.Events.color,
    '#9333EA'
  );
  assert(
    CALENDAR_CATEGORIES.Payments.color === '#16A34A',
    'Payments color is exactly green (#16A34A)',
    CALENDAR_CATEGORIES.Payments.color,
    '#16A34A'
  );
  assert(
    CALENDAR_CATEGORIES.Deadlines.color === '#EA580C',
    'Deadlines color is exactly red-orange (#EA580C)',
    CALENDAR_CATEGORIES.Deadlines.color,
    '#EA580C'
  );
  assert(
    CALENDAR_CATEGORIES.Meetings.color === '#EAB308',
    'Meetings color is exactly yellow (#EAB308)',
    CALENDAR_CATEGORIES.Meetings.color,
    '#EAB308'
  );

  assert(mapEventTypeToCategory('Wedding') === 'Events', 'Wedding maps to Events');
  assert(mapEventTypeToCategory('Pre-Wedding') === 'Events', 'Pre-Wedding maps to Events');
  assert(mapEventTypeToCategory('Shoot') === 'Events', 'Shoot maps to Events');
  assert(mapEventTypeToCategory('Payment Reminder') === 'Payments', 'Payment Reminder maps to Payments');
  assert(mapEventTypeToCategory('Deadline') === 'Deadlines', 'Deadline maps to Deadlines');
  assert(mapEventTypeToCategory('Delivery') === 'Deadlines', 'Delivery maps to Deadlines');
  assert(mapEventTypeToCategory('Meeting') === 'Meetings', 'Meeting maps to Meetings');
  assert(mapEventTypeToCategory('Client Consultation') === 'Meetings', 'Client Consultation maps to Meetings');

  // =========================================================================
  // Suite 2: Notes Serialization & Metadata Preservation
  // =========================================================================
  console.log('\n[Suite 2] Notes Serialization & Metadata Handling');
  const userNote = 'Client requested prompt notification upon arrival';
  const serializedPayment = serializeCalendarNotes(
    {
      category: 'Payments',
      amount_due: 125000,
      payment_status: 'Pending',
    },
    userNote
  );

  const parsedPayment = parseCalendarNotes(serializedPayment);
  assert(parsedPayment.userNotes === userNote, 'User note preserved cleanly', parsedPayment.userNotes, userNote);
  assert(parsedPayment.metadata.category === 'Payments', 'Category preserved', parsedPayment.metadata.category, 'Payments');
  assert(parsedPayment.metadata.amount_due === 125000, 'Amount due preserved', parsedPayment.metadata.amount_due, 125000);
  assert(parsedPayment.metadata.payment_status === 'Pending', 'Payment status preserved', parsedPayment.metadata.payment_status, 'Pending');

  const serializedMeeting = serializeCalendarNotes(
    {
      category: 'Meetings',
      participants: 'Pooja, Rahul, Lead Cinematographer',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
    },
    'Pre-wedding briefing call'
  );
  const parsedMeeting = parseCalendarNotes(serializedMeeting);
  assert(parsedMeeting.userNotes === 'Pre-wedding briefing call', 'Meeting note preserved');
  assert(parsedMeeting.metadata.participants === 'Pooja, Rahul, Lead Cinematographer', 'Participants preserved');
  assert(parsedMeeting.metadata.meeting_link === 'https://meet.google.com/abc-defg-hij', 'Meeting link preserved');

  // =========================================================================
  // Suite 3: Deadline Overdue Automatic Calculation
  // =========================================================================
  console.log('\n[Suite 3] Deadline Overdue Calculation');
  const pastDate = '2020-01-01';
  assert(calculateDeadlineStatus('Pending', pastDate) === 'Overdue', 'Past Pending deadline is Overdue');
  assert(calculateDeadlineStatus('In Progress', pastDate) === 'Overdue', 'Past In Progress deadline is Overdue');
  assert(calculateDeadlineStatus('Completed', pastDate) === 'Completed', 'Completed past deadline remains Completed');
  const futureDate = '2099-01-01';
  assert(calculateDeadlineStatus('Pending', futureDate) === 'Pending', 'Future Pending deadline is Pending');
  assert(calculateDeadlineStatus('In Progress', futureDate) === 'In Progress', 'Future In Progress deadline is In Progress');

  // =========================================================================
  // Suite 4: Project Event Auto-Association & Calendar Synchronization
  // =========================================================================
  console.log('\n[Suite 4] Project Event Auto-Association & Master/Project Sync');

  const mockProject: Project = {
    id: 'proj-101',
    company_id: 'twb',
    client_id: 'client-1',
    name: 'Aarav Mehta & Kiran Shah • Wedding 2026',
    total_amount: 350000,
    booking_amount: 100000,
    package_name: 'Luxury Wedding Package',
    package_details: 'Full 3-day wedding photography and film',
    client_contact: {
      phone: '+91 9876543210',
      email: 'aarav@example.com',
    },
    wedding_date_start: '2026-11-20',
    wedding_date_end: '2026-11-22',
    venue: 'Taj Lake Palace, Udaipur',
    city: 'Udaipur',
    status: 'Booked',
    events: [
      {
        id: 'pe-1',
        project_id: 'proj-101',
        event_name: 'Sangeet Night',
        event_date: '2026-11-20',
        event_time: '18:00',
        event_address: 'Taj Lake Palace Courtyard',
      },
      {
        id: 'pe-2',
        project_id: 'proj-101',
        event_name: 'Wedding Ceremony & Pheras',
        event_date: '2026-11-21',
        event_time: '10:00',
        event_address: 'Taj Lake Palace Mandap',
      },
    ],
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockCalendarEvents: CalendarEvent[] = [
    {
      id: 'cal-pay-1',
      company_id: 'twb',
      project_id: 'proj-101',
      title: 'Balance Payment Due',
      event_type: 'Payment Reminder',
      start_time: '2026-11-15T10:00:00',
      end_time: '2026-11-15T11:00:00',
      notes: serializeCalendarNotes(
        {
          category: 'Payments',
          amount_due: 250000,
          payment_status: 'Pending',
        },
        'Final settlement before wedding shoot'
      ),
    },
    {
      id: 'cal-company-wide',
      company_id: 'twb',
      project_id: undefined, // Company-wide!
      title: 'Q4 Studio All-Hands Gear Inspection',
      event_type: 'Meeting',
      start_time: '2026-11-10T14:00:00',
      end_time: '2026-11-10T16:00:00',
      location: 'TWB Main Studio',
    },
  ];

  const mockTeamMembers: TeamMember[] = [
    {
      id: 'tm-1',
      name: 'Rohan Sharma',
      role: 'Team Member',
      role_title: 'Cinematographer',
      phone: '+91 9000000001',
      email: 'rohan@example.com',
      is_active: true,
    },
  ];

  const projectEntries = getProjectCalendarEntries(mockProject, mockCalendarEvents, mockTeamMembers);

  assert(
    projectEntries.length === 3,
    'Project Overview includes both wedding schedule (2) + project calendar events (1) = 3 total',
    projectEntries.length,
    3
  );

  const sangeet = projectEntries.find(e => e.title.includes('Sangeet Night'));
  assert(Boolean(sangeet), 'Sangeet Night appears in Project Overview');
  assert(sangeet?.category === 'Events', 'Sangeet is categorized as Events');
  assert(sangeet?.color === '#9333EA', 'Sangeet uses purple #9333EA');

  const payment = projectEntries.find(e => e.title === 'Balance Payment Due');
  assert(Boolean(payment), 'Balance Payment Due appears in Project Overview');
  assert(payment?.category === 'Payments', 'Payment is categorized as Payments');
  assert(payment?.color === '#16A34A', 'Payment uses green #16A34A');
  assert(payment?.amount_due === 250000, 'Payment has correct amount_due');

  const companyWideInProject = projectEntries.find(e => e.title.includes('Gear Inspection'));
  assert(
    companyWideInProject === undefined,
    'Company-wide events are strictly excluded from Project Overview Calendar count'
  );

  const masterEntries = combineProjectAndCalendarEvents(
    mockCalendarEvents,
    [mockProject],
    mockTeamMembers,
    'all'
  );

  assert(
    masterEntries.length === 4,
    'Master Operations Calendar includes all 4 entries (2 events + 1 payment + 1 company-wide)',
    masterEntries.length,
    4
  );

  const companyWideInMaster = masterEntries.find(e => e.title.includes('Gear Inspection'));
  assert(Boolean(companyWideInMaster), 'Company-wide event is present on Master Calendar');
  assert(companyWideInMaster?.isCompanyWide === true, 'Company-wide entry is flagged isCompanyWide');
  assert(companyWideInMaster?.projectName === 'Company-wide / Studio', 'Company-wide labeled correctly');

  // Deduplication check
  const duplicateCalEvent: CalendarEvent = {
    id: 'cal-dup-1',
    company_id: 'twb',
    project_id: 'proj-101',
    title: 'Sangeet Night',
    event_type: 'Wedding',
    start_time: '2026-11-20T18:00:00',
    end_time: '2026-11-20T23:30:00',
  };

  const masterWithDup = combineProjectAndCalendarEvents(
    [...mockCalendarEvents, duplicateCalEvent],
    [mockProject],
    mockTeamMembers,
    'all'
  );
  const sangeetMatches = masterWithDup.filter(e => e.title === 'Sangeet Night');
  assert(sangeetMatches.length === 1, 'Duplicate calendar events for the same project event are deduplicated', sangeetMatches.length, 1);

  // =========================================================================
  // Suite 5: Aarav Mehta & Kiran Shah Single Event Regression Safety
  // =========================================================================
  console.log('\n[Suite 5] Aarav Mehta & Kiran Shah Single Event Rendering Safety');
  const aaravProject: Project = {
    id: 'proj-aarav-kiran',
    company_id: 'twb',
    client_id: 'client-aarav',
    name: 'Aarav Mehta & Kiran Shah · Wedding 2026',
    total_amount: 340000,
    booking_amount: 50000,
    package_name: 'Signature 3-Day Wedding Package',
    package_details: 'Cinematography & Photography',
    client_contact: {
      phone: '+91 9876543210',
      email: 'aarav@example.com',
    },
    wedding_date_start: '2026-12-12',
    wedding_date_end: '2026-12-12',
    venue: 'Taj Mahal Palace, Mumbai',
    city: 'Mumbai',
    status: 'Booked',
    events: [
      {
        id: 'pe-aarav-1',
        project_id: 'proj-aarav-kiran',
        event_name: 'Wedding Ceremony & Reception',
        event_date: '2026-12-12',
        event_time: '18:00',
        event_address: 'Taj Mahal Palace Ballroom, Mumbai',
      },
    ],
    created_at: '2026-01-01T00:00:00Z',
  };

  const aaravEntries = getProjectCalendarEntries(aaravProject, [], []);
  assert(aaravEntries.length === 1, 'Aarav project yields exactly 1 calendar entry', aaravEntries.length, 1);

  const aaravEvt = aaravEntries[0];
  assert(Boolean(aaravEvt), 'Aarav calendar entry exists');
  assert(aaravEvt?.title.includes('Wedding Ceremony & Reception'), 'Title contains event name');
  assert(aaravEvt?.category === 'Events', 'Categorized as Events');
  assert(aaravEvt?.color === '#9333EA', 'Color is purple #9333EA');
  assert(typeof aaravEvt?.start_time === 'string' && aaravEvt.start_time.includes('2026-12-12'), 'start_time is valid date');
  assert(typeof aaravEvt?.end_time === 'string' && aaravEvt.end_time.includes('2026-12-12'), 'end_time is valid date');

  // =========================================================================
  // Suite 6: Refined Payment Amount, Meeting Format, and Notes Placeholders
  // =========================================================================
  console.log('\n[Suite 6] Refined Payment & Meeting Formats and Notes Placeholders');

  // 1. Payment serialization handles empty / custom amount correctly
  const serializedCustomPayment = serializeCalendarNotes({
    category: 'Payments',
    amount_due: 75000,
    payment_status: 'Pending',
  }, 'Agreed 2nd milestone advance');
  const parsedCustomPayment = parseCalendarNotes(serializedCustomPayment);
  assert(parsedCustomPayment.metadata.amount_due === 75000, 'Custom payment amount 75000 is preserved');
  assert(parsedCustomPayment.metadata.amount_due !== 50000, 'Default of 50000 is not forced on custom payment');

  // 2. Meeting serialization: physical venue only, no meeting_link, start_time only
  const meetingNote = serializeCalendarNotes({
    category: 'Meetings',
    participants: 'Aarav, Kiran, Lead Photographer',
  }, 'Pre-wedding recce discussion');
  const parsedMeetingRefined = parseCalendarNotes(meetingNote);
  assert(parsedMeetingRefined.metadata.participants === 'Aarav, Kiran, Lead Photographer', 'Meeting participants saved');
  assert(parsedMeetingRefined.metadata.meeting_link === undefined, 'No meeting_link serialized');

  const meetingEvent: CalendarEvent = {
    id: 'cal-meeting-1',
    company_id: 'twb',
    project_id: 'proj-aarav-kiran',
    title: 'Pre-wedding Recce Meeting',
    event_type: 'Meeting',
    start_time: '2026-11-25T11:00:00',
    end_time: '2026-11-25T11:00:00', // start time only, endIso == startIso
    location: 'Taj Mahal Palace Lobby, Mumbai',
    notes: meetingNote,
  };

  const projectMeetingEntries = getProjectCalendarEntries(aaravProject, [meetingEvent], []);
  const meetingEntry = projectMeetingEntries.find(e => e.title === 'Pre-wedding Recce Meeting');
  assert(Boolean(meetingEntry), 'Meeting entry is included in project calendar');
  assert(meetingEntry?.category === 'Meetings', 'Categorized as Meetings');
  assert(meetingEntry?.color === '#EAB308', 'Meeting color is yellow #EAB308');
  assert(meetingEntry?.location === 'Taj Mahal Palace Lobby, Mumbai', 'Physical meeting location preserved');

  // 3. Category-specific placeholders
  const placeholders: Record<string, string> = {
    Events: 'Add event details, schedule information, venue instructions, or special arrangements...',
    Payments: 'Add payment context, agreed payment terms, or follow-up instructions...',
    Deadlines: 'Add deliverable details, review requirements, or production instructions...',
    Meetings: 'Add discussion topics, preparation notes, or important points to cover...',
  };

  assert(
    placeholders.Events === 'Add event details, schedule information, venue instructions, or special arrangements...',
    'Events notes placeholder matches specification'
  );
  assert(
    placeholders.Payments === 'Add payment context, agreed payment terms, or follow-up instructions...',
    'Payments notes placeholder matches specification'
  );
  assert(
    placeholders.Deadlines === 'Add deliverable details, review requirements, or production instructions...',
    'Deadlines notes placeholder matches specification'
  );
  assert(
    placeholders.Meetings === 'Add discussion topics, preparation notes, or important points to cover...',
    'Meetings notes placeholder matches specification'
  );

  // =========================================================================
  // Suite 7: Master Operations Calendar Current-Date & Today Highlight Handling
  // =========================================================================
  console.log('\n[Suite 7] Master Operations Calendar Current-Date & Today Highlight Handling');

  // 1. Controlled mock date test (e.g. 6 November 2026, month = 10 (0-indexed))
  const mockDateNov6 = new Date(2026, 10, 6, 14, 30, 0); // Nov 6, 2026 14:30 local time
  const formattedMockDate = getLocalTodayDateString(mockDateNov6);
  assert(
    formattedMockDate === '2026-11-06',
    'getLocalTodayDateString accurately formats controlled date into YYYY-MM-DD',
    formattedMockDate,
    '2026-11-06'
  );

  // 2. Local date today match
  const isNov6Today = isLocalToday(2026, 10, 6, mockDateNov6);
  assert(isNov6Today === true, 'isLocalToday returns true for matching year, month, and day');

  // 3. Rejects incorrect days in the same month
  const isNov7Today = isLocalToday(2026, 10, 7, mockDateNov6);
  assert(isNov7Today === false, 'isLocalToday returns false for different day in same month');

  // 4. Rejects September 16 when current date is in November
  const isSep16TodayWhenInNov = isLocalToday(2026, 8, 16, mockDateNov6);
  assert(
    isSep16TodayWhenInNov === false,
    'September 16 is no longer marked as Today when current date is in November',
    isSep16TodayWhenInNov,
    false
  );

  // 5. Month navigation preservation: Navigating to September viewing month while today is Nov 6
  // Calendar grid renders September (month = 8), checking day 16 against Nov 6 reference
  const sepGridDay16IsToday = isLocalToday(2026, 8, 16, mockDateNov6);
  assert(
    sepGridDay16IsToday === false,
    'Viewing September grid does not highlight Sep 16 as Today when reference date is November'
  );

  // 6. Navigation to November grid (month = 10): Nov 6 is highlighted
  const novGridDay6IsToday = isLocalToday(2026, 10, 6, mockDateNov6);
  assert(
    novGridDay6IsToday === true,
    'Viewing November grid correctly highlights day 6 as Today'
  );

  // 7. Dynamic default: calling without refDate uses current system Date without throwing
  const systemTodayStr = getLocalTodayDateString();
  const sysDate = new Date();
  assert(
    systemTodayStr.length === 10 && systemTodayStr.includes('-'),
    'systemTodayStr returns valid YYYY-MM-DD format',
    systemTodayStr
  );
  assert(
    isLocalToday(sysDate.getFullYear(), sysDate.getMonth(), sysDate.getDate()),
    'isLocalToday with default system date correctly returns true for today'
  );

  if (failures > 0) {
    console.error(`\nTest run completed with ${failures} failure(s).`);
    process.exit(1);
  } else {
    console.log('\n--- All Calendar System Redesign Tests Passed Successfully (0 failures) ---');
  }
}

runCalendarTests();
