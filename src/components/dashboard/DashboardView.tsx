import React from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  FolderKanban,
  UserCheck,
  Film,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProjectStatus, DeliverablePriority } from '../../types';

export const DashboardView: React.FC = () => {
  const {
    brandFilter,
    filteredProjects,
    filteredEnquiries,
    filteredDeliverables,
    filteredCalendarEvents,
    filteredPayments,
    filteredExpenses,
    teamMembers,
    editors,
    projectTeam,
    notifications,
    setActiveTab,
    setSelectedProjectId,
    currentUser,
    canManageFinance,
  } = useApp();

  // Financial Metrics
  const totalContractValue = filteredProjects.reduce((acc, p) => acc + p.total_amount, 0);
  const totalReceived = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const pendingAmount = Math.max(0, totalContractValue - totalReceived);
  const netOperatingProfit = totalReceived - totalExpenses;

  // Operational metrics
  const upcomingProjects = filteredProjects
    .filter(p => p.status !== 'Delivered' && p.status !== 'Archived')
    .slice(0, 4);

  const pendingEnquiries = filteredEnquiries.filter(
    e => e.status === 'New' || e.status === 'Contacted' || e.status === 'Meeting Scheduled'
  );

  const upcomingDeliverables = filteredDeliverables
    .filter(d => d.status !== 'Delivered' && d.status !== 'Approved')
    .slice(0, 4);

  // Today's / Upcoming Events
  const upcomingEvents = filteredCalendarEvents.slice(0, 4);

  const getPriorityBadge = (priority: DeliverablePriority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'High':
        return 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/50';
      case 'Medium':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'Shooting':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Pre-Production':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Editing':
        return 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/50';
      case 'Booked':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Delivered':
        return 'bg-teal-100 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Production Operations Hub
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                brandFilter === 'twb'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : brandFilter === 'golden_june'
                  ? 'bg-[#F1D099]/20 text-[#5e430c] border border-[#F1D099]/40'
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              {brandFilter === 'all'
                ? 'TWB & Golden June'
                : brandFilter === 'twb'
                ? 'The Wedding Booth'
                : 'Golden June Films'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800">{currentUser.full_name}</strong> ({currentUser.role}). Real-time studio schedules, teams, and deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-quick-new-project"
            onClick={() => setActiveTab('projects')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FolderKanban className="w-4 h-4" />
            <span>Manage Projects</span>
          </button>
          <button
            id="btn-quick-calendar"
            onClick={() => setActiveTab('calendar')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Quick Financial Overview (Accessible to Admins/Managers) */}
      {canManageFinance ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Contract Pipeline</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
              ${totalContractValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {filteredProjects.length} active weddings
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Payments Received</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2">
              ${totalReceived.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {filteredPayments.length} recorded payments
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Pending Receivables</span>
              <Clock className="w-4 h-4 text-[#8c672b]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#8c672b] mt-2">
              ${pendingAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#8c672b] font-medium mt-1">
              Awaiting milestone payouts
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Production Expenses</span>
              <TrendingUp className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-rose-700 mt-2">
              ${totalExpenses.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Crew, travel & gear rentals
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-xs">
            <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Operating Profit</span>
              <Sparkles className="w-4 h-4 text-[#F1D099]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#F1D099] mt-2">
              ${netOperatingProfit.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-300 mt-1">
              Net collected margin
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span>Financial summary is restricted to Studio Management and Admins.</span>
        </div>
      )}

      {/* Main Grid: Upcoming Projects & Deliverables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Weddings / Projects */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-slate-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Upcoming Weddings & Production Schedule
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('projects')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all ({filteredProjects.length})
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {upcomingProjects.map(project => {
                const assignedCrew = projectTeam.filter(pt => pt.project_id === project.id);
                const isTWB = project.company_id === 'twb';

                return (
                  <div
                    key={project.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setActiveTab('projects');
                    }}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isTWB
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
                          }`}
                        >
                          {isTWB ? 'TWB' : 'Golden June'}
                        </span>
                        <h3 className="font-semibold text-slate-900 text-sm truncate">
                          {project.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusBadge(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {project.wedding_date_start}
                        </span>
                        <span>{project.venue}, {project.city}</span>
                        <span className="text-slate-400">•</span>
                        <span>{project.package_name}</span>
                      </div>

                      {/* Crew chips */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400">Assigned crew:</span>
                        {assignedCrew.length > 0 ? (
                          assignedCrew.map(ac => {
                            const member = teamMembers.find(t => t.id === ac.team_member_id);
                            return (
                              <span
                                key={ac.id}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                              >
                                {member?.name.split(' ')[0] || 'Crew'} ({ac.role.split(' ')[0]})
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-[#8c672b] italic">No crew assigned yet</span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="text-xs font-semibold text-slate-900">
                        ${project.total_amount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">Contract Total</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Enquiries & Leads */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Active Enquiries & Leads ({pendingEnquiries.length})
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('enquiries')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Manage Leads
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingEnquiries.slice(0, 4).map(enq => (
                <div
                  key={enq.id}
                  onClick={() => setActiveTab('enquiries')}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-900">
                        {enq.client_name} {enq.partner_name ? `& ${enq.partner_name}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {enq.venue} • {enq.event_date}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      ${enq.estimated_budget.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Status: <strong className="text-slate-700">{enq.status}</strong></span>
                    <span className="text-[#8c672b] font-medium">Quote: {enq.quotation_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Deliverables, Workload & Alerts */}
        <div className="space-y-6">
          {/* Upcoming Deliverables */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Post-Production Queue
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('deliverables')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all
              </button>
            </div>

            <div className="space-y-3">
              {upcomingDeliverables.map(del => {
                const editor = editors.find(e => e.id === del.assigned_editor_id);
                const project = filteredProjects.find(p => p.id === del.project_id);

                return (
                  <div
                    key={del.id}
                    className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-900">
                        {del.deliverable_type}
                      </div>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${getPriorityBadge(
                          del.priority
                        )}`}
                      >
                        {del.priority}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate">
                      Project: {project?.name || 'Project'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                      <span className="text-slate-600">
                        Editor: <strong>{editor?.name || 'Unassigned'}</strong>
                      </span>
                      <span className="text-[#8c672b] font-medium">Due: {del.due_date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editor Capacity Snapshot */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-slate-600" />
                <h2 className="font-bold text-slate-900 text-sm">Editor Workload</h2>
              </div>
              <button
                onClick={() => setActiveTab('editors')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2.5">
              {editors.slice(0, 3).map(ed => {
                const activeDels = filteredDeliverables.filter(
                  d => d.assigned_editor_id === ed.id && d.status !== 'Delivered'
                ).length;
                const percent = Math.min(100, Math.round((activeDels / ed.max_concurrent_projects) * 100));

                return (
                  <div key={ed.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{ed.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {activeDels} / {ed.max_concurrent_projects} projects
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= 100
                            ? 'bg-red-500'
                            : percent >= 75
                            ? 'bg-[#F1D099]'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent In-App Notifications */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 text-sm">Recent Operational Alerts</h2>
              <button
                onClick={() => setActiveTab('notifications')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                All alerts
              </button>
            </div>

            <div className="space-y-2.5">
              {notifications.slice(0, 3).map(n => (
                <div
                  key={n.id}
                  className={`p-2.5 rounded-lg text-xs space-y-1 ${
                    !n.read
                      ? 'bg-[#F1D099]/15 border border-[#F1D099]/40 text-slate-900'
                      : 'bg-slate-50 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center justify-between">
                    <span>{n.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
