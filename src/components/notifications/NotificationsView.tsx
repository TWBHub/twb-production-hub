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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationType } from '../../types';

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    setSelectedProjectId,
    setActiveTab,
  } = useApp();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = notifications.filter(n => {
    const matchesType = filterType === 'all' || n.type === filterType;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'unread' ? !n.read : n.read);
    return matchesType && matchesStatus;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'Conflict Alert':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'Deliverable Due':
        return <Clock className="w-5 h-5 text-[#8c672b]" />;
      case 'Payment Reminder':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'Wedding Approaching':
        return <Calendar className="w-5 h-5 text-purple-500" />;
      case 'Enquiry Follow-up':
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const handleAction = (n: any) => {
    markNotificationAsRead(n.id);
    if (n.project_id) {
      setSelectedProjectId(n.project_id);
      setActiveTab('projects');
    } else if (n.type === 'Enquiry Follow-up') {
      setActiveTab('enquiries');
    } else if (n.type === 'Conflict Alert') {
      setActiveTab('team');
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Production & Business Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Wedding date countdowns, deliverable milestones, pending payments, and conflict warnings.
          </p>
        </div>

        <button
          onClick={() => {
            notifications.forEach(n => markNotificationAsRead(n.id));
          }}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Check className="w-4 h-4" />
          <span>Mark All as Read</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
        >
          <option value="all">All Alert Categories</option>
          <option value="Conflict Alert">Conflict Alerts</option>
          <option value="Deliverable Due">Deliverable Milestones</option>
          <option value="Payment Reminder">Payment Reminders</option>
          <option value="Wedding Approaching">Wedding Approaching</option>
          <option value="Enquiry Follow-up">Enquiry Follow-ups</option>
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
        >
          <option value="all">All States</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map(n => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              !n.read
                ? 'bg-[#F1D099]/15 border-[#F1D099]/40 text-slate-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-start gap-3.5 flex-1">
              <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100 shrink-0">
                {getIcon(n.type)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900">{n.title}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">
                    {n.type}
                  </span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-[#F1D099]" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                <span className="text-[10px] text-slate-400 block pt-0.5">
                  Triggered on {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center shrink-0">
              <button
                onClick={() => handleAction(n)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>Take Action</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {!n.read && (
                <button
                  onClick={() => markNotificationAsRead(n.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
            No alerts matching the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};
