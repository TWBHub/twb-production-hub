import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  DollarSign,
  Clock,
  Filter,
  Check,
  FolderKanban,
  ArrowRight,
  Loader2,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationType, AppNotification } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markNotificationAsRead,
    markAllNotificationsRead,
    setSelectedProjectId,
    setSelectedEnquiryId,
    setActiveTab,
    enquiries,
    projects,
  } = useApp();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; isError?: boolean } | null>(null);
  const [inspectModalNotification, setInspectModalNotification] = useState<AppNotification | null>(null);

  // Safe wrapper for marking a single notification as read
  const doMarkAsRead = async (id: string) => {
    if (typeof markNotificationRead === 'function') {
      await markNotificationRead(id);
    } else if (typeof markNotificationAsRead === 'function') {
      await markNotificationAsRead(id);
    }
  };

  const getCategoryGroup = (type: string, link?: string): string => {
    if (link === 'enquiries' || type === 'new_enquiry' || type === 'Enquiry Follow-up') {
      return 'enquiries';
    }
    if (link === 'deliverables' || type === 'deliverable_status' || type === 'Deliverable Due' || type === 'deadline_approaching') {
      return 'deliverables';
    }
    if (link === 'finance' || type === 'payment_received' || type === 'payment_overdue' || type === 'Payment Reminder') {
      return 'finance';
    }
    if (link === 'team' || link === 'team-availability' || type === 'booking_conflict' || type === 'Conflict Alert') {
      return 'conflict';
    }
    if (link === 'projects' || type === 'project_assignment') {
      return 'projects';
    }
    if (link === 'calendar' || type === 'Wedding Approaching') {
      return 'calendar';
    }
    return 'other';
  };

  const filtered = notifications.filter(n => {
    const group = getCategoryGroup(n.type, n.link);
    const matchesType =
      filterType === 'all' ||
      n.type === filterType ||
      group === filterType;

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'unread' ? !n.read : n.read);

    return matchesType && matchesStatus;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'Conflict Alert':
      case 'booking_conflict':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'Deliverable Due':
      case 'deliverable_status':
      case 'deadline_approaching':
        return <Clock className="w-5 h-5 text-[#8c672b]" />;
      case 'Payment Reminder':
      case 'payment_received':
      case 'payment_overdue':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'Wedding Approaching':
        return <Calendar className="w-5 h-5 text-purple-500" />;
      case 'Enquiry Follow-up':
      case 'new_enquiry':
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  // Navigates to the appropriate entity or opens details modal if no valid entity exists
  const resolveAndNavigate = async (n: AppNotification) => {
    // Mark as read immediately when navigated/actioned
    if (!n.read) {
      try {
        await doMarkAsRead(n.id);
      } catch (err) {
        console.warn('Could not mark notification read:', err);
      }
    }

    const rawLink = n.link || '';
    const rawType = n.type;
    const projId = (n as any).project_id;

    // 1. If explicit project ID exists
    if (projId) {
      setSelectedProjectId(projId);
      setActiveTab('projects');
      return;
    }

    // 2. Link or Type matches Enquiries
    if (rawLink === 'enquiries' || rawType === 'new_enquiry' || rawType === 'Enquiry Follow-up') {
      const match = enquiries.find(
        e =>
          (e.title && n.message.includes(e.title)) ||
          (e.client_name && n.message.includes(e.client_name)) ||
          (e.partner_name && n.message.includes(e.partner_name))
      );
      if (match && typeof setSelectedEnquiryId === 'function') {
        setSelectedEnquiryId(match.id);
      }
      setActiveTab('enquiries');
      return;
    }

    // 3. Link or Type matches Projects
    if (rawLink === 'projects' || rawType === 'project_assignment') {
      const match = projects.find(
        p =>
          (p.title && n.message.includes(p.title)) ||
          (p.client_name && n.message.includes(p.client_name))
      );
      if (match) {
        setSelectedProjectId(match.id);
      }
      setActiveTab('projects');
      return;
    }

    // 4. Link or Type matches Deliverables
    if (
      rawLink === 'deliverables' ||
      rawType === 'deliverable_status' ||
      rawType === 'Deliverable Due' ||
      rawType === 'deadline_approaching'
    ) {
      setActiveTab('deliverables');
      return;
    }

    // 5. Link or Type matches Finance
    if (
      rawLink === 'finance' ||
      rawType === 'payment_received' ||
      rawType === 'payment_overdue' ||
      rawType === 'Payment Reminder'
    ) {
      setActiveTab('finance');
      return;
    }

    // 6. Link or Type matches Team Availability / Conflict Alert
    if (
      rawLink === 'team' ||
      rawLink === 'team-availability' ||
      rawType === 'booking_conflict' ||
      rawType === 'Conflict Alert'
    ) {
      setActiveTab('team');
      return;
    }

    // 7. Link or Type matches Calendar
    if (rawLink === 'calendar' || rawType === 'Wedding Approaching') {
      setActiveTab('calendar');
      return;
    }

    // 8. No valid linked entity — show details without navigating to an unrelated record
    setInspectModalNotification(n);
  };

  const handleCardClick = (n: AppNotification) => {
    resolveAndNavigate(n);
  };

  const handleActionClick = (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    resolveAndNavigate(n);
  };

  const handleToggleRead = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    if (processingIds.has(n.id)) return;

    setProcessingIds(prev => new Set(prev).add(n.id));
    setActionFeedback(null);
    try {
      await doMarkAsRead(n.id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      setActionFeedback({ message: 'Failed to update alert status. Please retry.', isError: true });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.read);
    if (unreadItems.length === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    setActionFeedback(null);
    try {
      if (typeof markAllNotificationsRead === 'function') {
        await markAllNotificationsRead();
      } else {
        // Fallback for safety
        await Promise.all(unreadItems.map(n => doMarkAsRead(n.id)));
      }
      setActionFeedback({ message: 'All alerts marked as read.' });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      setActionFeedback({ message: 'Failed to mark all as read. Please try again.', isError: true });
    } finally {
      setIsMarkingAll(false);
    }
  };

  const unreadTotal = unreadNotificationCount !== undefined
    ? unreadNotificationCount
    : notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Production & Business Alerts
            </h1>
            {unreadTotal > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-full border border-red-200">
                {unreadTotal} unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Event countdowns, deliverable milestones, pending payments, and conflict warnings.
          </p>
        </div>

        <button
          type="button"
          disabled={unreadTotal === 0 || isMarkingAll}
          onClick={handleMarkAllRead}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer ${
            unreadTotal === 0 || isMarkingAll
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
          }`}
        >
          {isMarkingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{isMarkingAll ? 'Marking...' : 'Mark All as Read'}</span>
        </button>
      </div>

      {/* Action feedback notification */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
            actionFeedback.isError
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Category:</span>
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-hidden"
        >
          <option value="all">All Alert Categories</option>
          <option value="enquiries">Leads & Enquiries</option>
          <option value="deliverables">Deliverable Milestones</option>
          <option value="finance">Payments & Invoices</option>
          <option value="conflict">Conflicts & Team Alerts</option>
          <option value="projects">Projects</option>
          <option value="calendar">Event & Date Countdowns</option>
        </select>

        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium ml-auto sm:ml-0">
          <span>Status:</span>
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-hidden"
        >
          <option value="all">All States</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
        </select>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map(n => {
          const isProcessing = processingIds.has(n.id);
          return (
            <div
              key={n.id}
              onClick={() => handleCardClick(n)}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-slate-400 ${
                !n.read
                  ? 'bg-amber-50/40 border-amber-200/80 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1">
                <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100 shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">{n.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {n.type}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unread alert" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 block pt-0.5">
                    Triggered on {formatDisplayDate(n.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={e => handleActionClick(e, n)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Open related module or view details"
                >
                  <span>Take Action</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {!n.read && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={e => handleToggleRead(e, n)}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                    title="Mark as read"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
            No alerts matching the selected filters.
          </div>
        )}
      </div>

      {/* Inspection Modal for Alerts Without Linked Records or Detailed Inspection */}
      {inspectModalNotification && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  {getIcon(inspectModalNotification.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {inspectModalNotification.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {inspectModalNotification.type}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDisplayDate(inspectModalNotification.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalNotification(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-700 leading-relaxed">
              {inspectModalNotification.message}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Status: {inspectModalNotification.read ? 'Read' : 'Unread'}
              </span>
              <button
                type="button"
                onClick={() => setInspectModalNotification(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
