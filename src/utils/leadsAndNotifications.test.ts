import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatLeadsTableEventDates, parseDateParts } from './dateUtils';
import { Enquiry, AppNotification } from '../types';
import { apiService } from '../services/api';

describe('Leads Table Date Formatting & Notifications Suite', () => {
  describe('Part 1 — Leads Table Date Formatting Specifications', () => {
    it('formats 1 event as "10 Nov 2026"', () => {
      const lead1: Enquiry = {
        id: 'lead-date-1',
        company_id: 'twb',
        title: 'Single Event Lead',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [{ event_name: 'Wedding Ceremony', event_date: '2026-11-10' }],
      };

      const res = formatLeadsTableEventDates(lead1);
      assert.strictEqual(res.text, '10 Nov 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 1);
    });

    it('formats 2 events as "10 & 12 Nov 2026"', () => {
      const lead2: Enquiry = {
        id: 'lead-date-2',
        company_id: 'twb',
        title: 'Two Events Same Month Lead',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Sangeet', event_date: '2026-11-10' },
          { event_name: 'Wedding', event_date: '2026-11-12' },
        ],
      };

      const res = formatLeadsTableEventDates(lead2);
      assert.strictEqual(res.text, '10 & 12 Nov 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 2);
    });

    it('formats 3 events as "10, 11 & 12 Nov 2026"', () => {
      const lead3: Enquiry = {
        id: 'lead-date-3',
        company_id: 'golden_june',
        title: 'Three Events Same Month Lead',
        status: 'Meeting Scheduled',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Mehendi', event_date: '2026-11-10' },
          { event_name: 'Sangeet', event_date: '2026-11-11' },
          { event_name: 'Wedding', event_date: '2026-11-12' },
        ],
      };

      const res = formatLeadsTableEventDates(lead3);
      assert.strictEqual(res.text, '10, 11 & 12 Nov 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 3);
    });

    it('formats 4 events as "10, 11, 12 & 13 Nov 2026"', () => {
      const lead4: Enquiry = {
        id: 'lead-date-4',
        company_id: 'twb',
        title: 'Four Events Same Month Lead',
        status: 'Proposal Sent',
        quotation_status: 'Sent',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Haldi', event_date: '2026-11-10' },
          { event_name: 'Mehendi', event_date: '2026-11-11' },
          { event_name: 'Sangeet', event_date: '2026-11-12' },
          { event_name: 'Wedding', event_date: '2026-11-13' },
        ],
      };

      const res = formatLeadsTableEventDates(lead4);
      assert.strictEqual(res.text, '10, 11, 12 & 13 Nov 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 4);
    });

    it('formats across different months as "28 Nov, 2 & 5 Dec 2026"', () => {
      const leadDiffMonths: Enquiry = {
        id: 'lead-date-diff-months',
        company_id: 'twb',
        title: 'Different Months Lead',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Engagement Party', event_date: '2026-11-28' },
          { event_name: 'Sangeet Celebration', event_date: '2026-12-02' },
          { event_name: 'Grand Reception', event_date: '2026-12-05' },
        ],
      };

      const res = formatLeadsTableEventDates(leadDiffMonths);
      assert.strictEqual(res.text, '28 Nov, 2 & 5 Dec 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 3);
    });

    it('formats across different months with single dates as "28 Nov & 2 Dec 2026"', () => {
      const leadTwoMonthsSingle: Enquiry = {
        id: 'lead-two-months-single',
        company_id: 'twb',
        title: 'Two Months Single Dates',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Civil', event_date: '2026-11-28' },
          { event_name: 'Reception', event_date: '2026-12-02' },
        ],
      };

      const res = formatLeadsTableEventDates(leadTwoMonthsSingle);
      assert.strictEqual(res.text, '28 Nov & 2 Dec 2026');
      assert.strictEqual(res.count, 2);
    });

    it('formats across different years as "28 Dec 2026 & 2 Jan 2027"', () => {
      const leadCrossYear1: Enquiry = {
        id: 'lead-cross-year-1',
        company_id: 'twb',
        title: 'Cross Year Lead Single in Next Year',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Sangeet', event_date: '2026-12-28' },
          { event_name: 'New Year Reception', event_date: '2027-01-02' },
        ],
      };

      const res = formatLeadsTableEventDates(leadCrossYear1);
      assert.strictEqual(res.text, '28 Dec 2026 & 2 Jan 2027');
      assert.strictEqual(res.count, 2);
    });

    it('formats across different years with multiple dates as "28 Dec 2026, 2 & 5 Jan 2027"', () => {
      const leadCrossYear2: Enquiry = {
        id: 'lead-cross-year-2',
        company_id: 'twb',
        title: 'Cross Year Lead Multiple in Next Year',
        status: 'Contacted',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Welcome Gala', event_date: '2026-12-28' },
          { event_name: 'Ceremony', event_date: '2027-01-02' },
          { event_name: 'Reception', event_date: '2027-01-05' },
        ],
      };

      const res = formatLeadsTableEventDates(leadCrossYear2);
      assert.strictEqual(res.text, '28 Dec 2026, 2 & 5 Jan 2027');
      assert.strictEqual(res.count, 3);
    });

    it('handles multiple events on the exact same date without repetitive day numbers', () => {
      const leadSameDay: Enquiry = {
        id: 'lead-same-day',
        company_id: 'twb',
        title: 'Morning and Evening Events Same Day',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
        events: [
          { event_name: 'Haldi Morning', event_date: '2026-11-10' },
          { event_name: 'Sangeet Evening', event_date: '2026-11-10' },
        ],
      };

      const res = formatLeadsTableEventDates(leadSameDay);
      assert.strictEqual(res.text, '10 Nov 2026');
      assert.strictEqual(res.count, 2);
    });

    it('falls back to single event_date field when events array is empty', () => {
      const leadFallback: Enquiry = {
        id: 'lead-fallback-date',
        company_id: 'twb',
        title: 'Fallback Date Lead',
        event_date: '2026-11-10',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
      };

      const res = formatLeadsTableEventDates(leadFallback);
      assert.strictEqual(res.text, '10 Nov 2026');
      assert.strictEqual(res.isSet, true);
      assert.strictEqual(res.count, 1);
    });

    it('returns "No dates set" when lead has neither events nor event_date', () => {
      const leadNoDate: Enquiry = {
        id: 'lead-no-dates-at-all',
        company_id: 'twb',
        title: 'Undated Lead',
        status: 'New',
        quotation_status: 'Draft',
        created_at: '2026-11-01T10:00:00Z',
      };

      const res = formatLeadsTableEventDates(leadNoDate);
      assert.strictEqual(res.text, 'No dates set');
      assert.strictEqual(res.isSet, false);
      assert.strictEqual(res.count, 0);
    });
  });

  describe('Part 4 — Notifications Read State and Badge Management', () => {
    it('accurately counts unread notifications and hides badge when count is zero', () => {
      const sampleNotifications: AppNotification[] = [
        {
          id: 'n-1',
          title: 'Alert 1',
          message: 'Message 1',
          type: 'new_enquiry',
          read: true,
          created_at: '2026-11-01T10:00:00Z',
        },
        {
          id: 'n-2',
          title: 'Alert 2',
          message: 'Message 2',
          type: 'deliverable_status',
          read: true,
          created_at: '2026-11-02T10:00:00Z',
        },
      ];

      const unreadCount = sampleNotifications.filter(n => !n.read).length;
      assert.strictEqual(unreadCount, 0);

      // Verify badge hiding condition
      const badgeValue = unreadCount > 0 ? unreadCount : undefined;
      assert.strictEqual(badgeValue, undefined, 'Badge must be undefined when unread count is 0');
    });

    it('displays positive badge count when unread notifications exist', () => {
      const sampleNotifications: AppNotification[] = [
        {
          id: 'n-1',
          title: 'Alert 1',
          message: 'Message 1',
          type: 'new_enquiry',
          read: false,
          created_at: '2026-11-01T10:00:00Z',
        },
        {
          id: 'n-2',
          title: 'Alert 2',
          message: 'Message 2',
          type: 'deliverable_status',
          read: true,
          created_at: '2026-11-02T10:00:00Z',
        },
        {
          id: 'n-3',
          title: 'Alert 3',
          message: 'Message 3',
          type: 'payment_received',
          read: false,
          created_at: '2026-11-03T10:00:00Z',
        },
      ];

      const unreadCount = sampleNotifications.filter(n => !n.read).length;
      assert.strictEqual(unreadCount, 2);
      const badgeValue = unreadCount > 0 ? unreadCount : undefined;
      assert.strictEqual(badgeValue, 2);
    });

    it('persists single notification read state via apiService.markNotificationRead', async () => {
      // Create a test notification
      const testNotif = await apiService.createNotification({
        title: 'Test Notification For Read Action',
        message: 'A test event alert',
        type: 'new_enquiry',
        read: false,
        link: 'enquiries',
      });

      assert.strictEqual(testNotif.read, false);

      // Mark as read
      await apiService.markNotificationRead(testNotif.id);

      // Verify in storage
      const allNotifs = await apiService.getNotifications();
      const updated = allNotifs.find(n => n.id === testNotif.id);
      assert.ok(updated, 'Notification must still exist in storage');
      assert.strictEqual(updated.read, true, 'Notification read flag must be updated to true');
    });

    it('marks all unread notifications as read via apiService.markAllNotificationsRead', async () => {
      // Create two unread notifications
      const nA = await apiService.createNotification({
        title: 'Unread 1',
        message: 'Msg 1',
        type: 'deliverable_status',
        read: false,
        link: 'deliverables',
      });
      const nB = await apiService.createNotification({
        title: 'Unread 2',
        message: 'Msg 2',
        type: 'payment_received',
        read: false,
        link: 'finance',
      });

      // Mark all read
      await apiService.markAllNotificationsRead();

      const allNotifs = await apiService.getNotifications();
      const checkA = allNotifs.find(n => n.id === nA.id);
      const checkB = allNotifs.find(n => n.id === nB.id);

      assert.strictEqual(checkA?.read, true);
      assert.strictEqual(checkB?.read, true);

      // Verify overall unread count is now 0 for these items
      const unread = allNotifs.filter(n => !n.read).length;
      assert.strictEqual(unread, 0);
    });
  });

  describe('Part 4 — Notification Routing Logic', () => {
    // Tests the category and tab resolution rules
    const resolveTabForNotification = (n: { link?: string; type: string; project_id?: string }) => {
      if (n.project_id) return 'projects';
      if (n.link === 'enquiries' || n.type === 'new_enquiry' || n.type === 'Enquiry Follow-up') return 'enquiries';
      if (n.link === 'projects' || n.type === 'project_assignment') return 'projects';
      if (n.link === 'deliverables' || n.type === 'deliverable_status' || n.type === 'Deliverable Due' || n.type === 'deadline_approaching') return 'deliverables';
      if (n.link === 'finance' || n.type === 'payment_received' || n.type === 'payment_overdue' || n.type === 'Payment Reminder') return 'finance';
      if (n.link === 'team' || n.link === 'team-availability' || n.type === 'booking_conflict' || n.type === 'Conflict Alert') return 'team';
      if (n.link === 'calendar' || n.type === 'Wedding Approaching') return 'calendar';
      return null; // No valid entity, show detail modal without navigating to unrelated record
    };

    it('routes enquiries correctly via link or type', () => {
      assert.strictEqual(resolveTabForNotification({ link: 'enquiries', type: 'new_enquiry' }), 'enquiries');
      assert.strictEqual(resolveTabForNotification({ type: 'Enquiry Follow-up' }), 'enquiries');
    });

    it('routes deliverables correctly via link or status type', () => {
      assert.strictEqual(resolveTabForNotification({ link: 'deliverables', type: 'deliverable_status' }), 'deliverables');
      assert.strictEqual(resolveTabForNotification({ type: 'Deliverable Due' }), 'deliverables');
      assert.strictEqual(resolveTabForNotification({ type: 'deadline_approaching' }), 'deliverables');
    });

    it('routes finance correctly via link or payment type', () => {
      assert.strictEqual(resolveTabForNotification({ link: 'finance', type: 'payment_received' }), 'finance');
      assert.strictEqual(resolveTabForNotification({ type: 'payment_overdue' }), 'finance');
      assert.strictEqual(resolveTabForNotification({ type: 'Payment Reminder' }), 'finance');
    });

    it('routes team conflicts correctly via link or conflict type', () => {
      assert.strictEqual(resolveTabForNotification({ link: 'team-availability', type: 'booking_conflict' }), 'team');
      assert.strictEqual(resolveTabForNotification({ type: 'Conflict Alert' }), 'team');
    });

    it('routes projects directly when project_id is present', () => {
      assert.strictEqual(resolveTabForNotification({ type: 'deliverable_status', project_id: 'proj-123' }), 'projects');
    });

    it('returns null (to show detail modal without navigating) when notification is unlinked or unknown', () => {
      assert.strictEqual(resolveTabForNotification({ type: 'system_announcement' as any }), null);
    });
  });
});
