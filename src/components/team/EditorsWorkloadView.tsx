import React, { useState, useMemo } from 'react';
import {
  Film,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  FolderKanban,
  UserCheck,
  Users,
  ArrowUpRight,
  Mail,
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Deliverable,
  DeliverableStatus,
  Project,
} from '../../types';
import { formatDisplayDate, formatTurnaroundDays } from '../../utils/dateUtils';

const getStatusBadge = (status?: DeliverableStatus | '') => {
  switch (status) {
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Approved':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'Submitted':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'In Progress':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Changes Requested':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'Assigned':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'Not Started':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-400 border-slate-200 italic';
  }
};

const getPriorityBadge = (priority?: string) => {
  switch (priority) {
    case 'Urgent':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'High':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Medium':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Low':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

interface UnifiedEditorInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  is_active: boolean;
  effectiveCapacity: number;
  notes?: string;
}

type OrderingOption =
  | 'name_asc'
  | 'name_desc'
  | 'workload_desc'
  | 'workload_asc'
  | 'assignment_oldest'
  | 'assignment_newest';

export const EditorsWorkloadView: React.FC = () => {
  const {
    editors,
    teamMembers,
    deliverables,
    projects,
    brandFilter,
    setSelectedProjectId,
    setActiveTab,
    refreshAllData,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState<'all' | 'available' | 'near_capacity' | 'at_capacity' | 'overloaded'>('all');
  const [ordering, setOrdering] = useState<OrderingOption>('name_asc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDeliveredEditorIds, setExpandedDeliveredEditorIds] = useState<Record<string, boolean>>({});

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAllData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleDeliveredSection = (editorId: string) => {
    setExpandedDeliveredEditorIds(prev => ({
      ...prev,
      [editorId]: !prev[editorId],
    }));
  };

  // Compile real editors from teamMembers and clean editors list.
  // Suppress dummy/fictional records in live mode.
  const unifiedEditors: UnifiedEditorInfo[] = useMemo(() => {
    const map = new Map<string, UnifiedEditorInfo>();

    // 1. From teamMembers with category 'Editor' or role/title containing 'Editor'
    if (Array.isArray(teamMembers)) {
      teamMembers.forEach(tm => {
        const isEditorCategory =
          Array.isArray(tm.categories) && tm.categories.includes('Editor');
        const isEditorTitle =
          (tm.role_title && tm.role_title.toLowerCase().includes('editor')) ||
          tm.role === 'Editor';

        if (isEditorCategory || isEditorTitle) {
          const matchingEd = editors.find(e => e.id === tm.id || e.email === tm.email);
          const effectiveCap =
            matchingEd?.max_active_deliverables ||
            matchingEd?.max_concurrent_projects ||
            4;

          map.set(tm.id, {
            id: tm.id,
            name: tm.name,
            email: tm.email || '',
            phone: tm.phone || '',
            specialization: tm.role_title || matchingEd?.specialization || 'Post-Production Editor',
            is_active: tm.status !== 'Inactive' && tm.is_active !== false,
            effectiveCapacity: effectiveCap,
            notes: tm.notes || matchingEd?.notes || '',
          });
        }
      });
    }

    // 2. From editors in AppContext (only include if matched to a real team member or non-placeholder)
    if (Array.isArray(editors)) {
      editors.forEach(ed => {
        const isFictional = ed.email?.endsWith('.internal') || ed.phone?.includes('555-01');
        const matchingTm = teamMembers.find(m => m.id === ed.id || m.email === ed.email);

        // In connected studio, do not inject fictional demo editors
        if (!isFictional || matchingTm) {
          if (!map.has(ed.id)) {
            const effectiveCap = ed.max_active_deliverables || ed.max_concurrent_projects || 4;
            map.set(ed.id, {
              id: ed.id,
              name: ed.name,
              email: ed.email || matchingTm?.email || '',
              phone: ed.phone || matchingTm?.phone || '',
              specialization: ed.specialization || matchingTm?.role_title || 'Post-Production Editor',
              is_active: ed.is_active !== false,
              effectiveCapacity: effectiveCap,
              notes: ed.notes || '',
            });
          }
        }
      });
    }

    return Array.from(map.values());
  }, [teamMembers, editors]);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    if (Array.isArray(projects)) {
      projects.forEach(p => map.set(p.id, p));
    }
    return map;
  }, [projects]);

  // Canonical Brand-filtered deliverables
  const scopedDeliverables = useMemo(() => {
    if (!Array.isArray(deliverables)) return [];
    return deliverables.filter(del => {
      if (brandFilter === 'all') return true;
      const proj = projectMap.get(del.project_id);
      const projCompany = proj?.company_id;
      const delCompany = del.company_id;
      return projCompany === brandFilter || delCompany === brandFilter;
    });
  }, [deliverables, brandFilter, projectMap]);

  // Workload calculations per editor
  const editorWorkloadMap = useMemo(() => {
    const result = new Map<
      string,
      {
        activeDeliverables: Deliverable[];
        completedDeliverables: Deliverable[];
        totalActiveCount: number;
        utilizationPercent: number;
        earliestActiveAssignmentDate: string | null;
        latestActiveAssignmentDate: string | null;
      }
    >();

    unifiedEditors.forEach(ed => {
      const assigned = scopedDeliverables.filter(d => d.assigned_editor_id === ed.id);
      const active = assigned.filter(d => d.status !== 'Delivered');
      const completed = assigned.filter(d => d.status === 'Delivered');
      const cap = Math.max(1, ed.effectiveCapacity);
      const percent = Math.round((active.length / cap) * 100);

      // Find earliest and latest assignment dates among active deliverables
      let earliest: string | null = null;
      let latest: string | null = null;
      active.forEach(d => {
        const dateVal = d.assigned_at || d.last_updated;
        if (dateVal) {
          if (!earliest || dateVal < earliest) earliest = dateVal;
          if (!latest || dateVal > latest) latest = dateVal;
        }
      });

      result.set(ed.id, {
        activeDeliverables: active,
        completedDeliverables: completed,
        totalActiveCount: active.length,
        utilizationPercent: percent,
        earliestActiveAssignmentDate: earliest,
        latestActiveAssignmentDate: latest,
      });
    });

    return result;
  }, [unifiedEditors, scopedDeliverables]);

  // Unassigned deliverables count
  const unassignedDeliverables = useMemo(() => {
    return scopedDeliverables.filter(
      d => (!d.assigned_editor_id || d.assigned_editor_id.trim() === '') && d.status !== 'Delivered'
    );
  }, [scopedDeliverables]);

  // 4 Core Summary Metrics
  const metrics = useMemo(() => {
    const activeEditors = unifiedEditors.filter(e => e.is_active);
    const totalActiveDels = scopedDeliverables.filter(d => d.status !== 'Delivered');
    const totalCompletedDels = scopedDeliverables.filter(d => d.status === 'Delivered');

    // Count editors at or exceeding 100% capacity
    const atOrOverCapacityCount = unifiedEditors.filter(ed => {
      const stats = editorWorkloadMap.get(ed.id);
      const activeCnt = stats?.totalActiveCount || 0;
      return activeCnt >= ed.effectiveCapacity;
    }).length;

    return {
      activeEditorsCount: activeEditors.length,
      totalEditorsCount: unifiedEditors.length,
      totalActiveDeliverables: totalActiveDels.length,
      totalCompletedDeliverables: totalCompletedDels.length,
      atOrOverCapacityCount,
      unassignedCount: unassignedDeliverables.length,
    };
  }, [unifiedEditors, scopedDeliverables, editorWorkloadMap, unassignedDeliverables]);

  // Filtered and Sorted Editors
  const filteredEditors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = unifiedEditors.filter(ed => {
      const stats = editorWorkloadMap.get(ed.id);
      const activeCount = stats?.totalActiveCount || 0;
      const percent = stats?.utilizationPercent || 0;

      // 1. Workload filter
      if (workloadFilter === 'available' && percent >= 75) return false;
      if (workloadFilter === 'near_capacity' && (percent < 75 || percent >= 100)) return false;
      if (workloadFilter === 'at_capacity' && percent !== 100) return false;
      if (workloadFilter === 'overloaded' && percent <= 100) return false;

      // 2. Search query match:
      // Searches editor name, specialization, genuine email, client/project name, and deliverable name
      if (!query) return true;

      const matchesEditor =
        ed.name.toLowerCase().includes(query) ||
        (!ed.email.endsWith('.internal') && ed.email.toLowerCase().includes(query)) ||
        ed.specialization.toLowerCase().includes(query);

      if (matchesEditor) return true;

      // Match in deliverables assigned to this editor
      const allAssignedDels = [
        ...(stats?.activeDeliverables || []),
        ...(stats?.completedDeliverables || []),
      ];

      const hasMatchingDel = allAssignedDels.some(del => {
        const proj = projectMap.get(del.project_id);
        return (
          del.deliverable_type.toLowerCase().includes(query) ||
          del.priority.toLowerCase().includes(query) ||
          del.status.toLowerCase().includes(query) ||
          (proj?.name && proj.name.toLowerCase().includes(query))
        );
      });

      return hasMatchingDel;
    });

    // 3. Ordering
    return filtered.sort((a, b) => {
      const statsA = editorWorkloadMap.get(a.id);
      const statsB = editorWorkloadMap.get(b.id);
      const activeA = statsA?.totalActiveCount || 0;
      const activeB = statsB?.totalActiveCount || 0;
      const pctA = statsA?.utilizationPercent || 0;
      const pctB = statsB?.utilizationPercent || 0;

      switch (ordering) {
        case 'name_asc':
          return a.name.localeCompare(b.name);

        case 'name_desc':
          return b.name.localeCompare(a.name);

        case 'workload_desc':
          if (pctB !== pctA) return pctB - pctA;
          if (activeB !== activeA) return activeB - activeA;
          return a.name.localeCompare(b.name);

        case 'workload_asc':
          if (pctA !== pctB) return pctA - pctB;
          if (activeA !== activeB) return activeA - activeB;
          return a.name.localeCompare(b.name);

        case 'assignment_oldest': {
          // Editors without active assignments go to the bottom
          const dateA = statsA?.earliestActiveAssignmentDate;
          const dateB = statsB?.earliestActiveAssignmentDate;
          if (!dateA && !dateB) return a.name.localeCompare(b.name);
          if (!dateA) return 1;
          if (!dateB) return -1;
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return a.name.localeCompare(b.name);
        }

        case 'assignment_newest': {
          // Editors without active assignments go to the bottom
          const dateA = statsA?.latestActiveAssignmentDate;
          const dateB = statsB?.latestActiveAssignmentDate;
          if (!dateA && !dateB) return a.name.localeCompare(b.name);
          if (!dateA) return 1;
          if (!dateB) return -1;
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return a.name.localeCompare(b.name);
        }

        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [unifiedEditors, searchQuery, workloadFilter, ordering, editorWorkloadMap, projectMap]);

  const navigateToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('projects');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#F1D099] flex items-center justify-center font-bold shadow-xs">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Editors & Workload
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                Post-production bandwidth, editor capacity, and active deliverable assignments across brands.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Refresh workload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deliverables')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            <span>Deliverables Pipeline</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Four Core Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Editors */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Editors
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {metrics.activeEditorsCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                / {metrics.totalEditorsCount} in roster
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active post-production editors</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Active Deliverables */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Deliverables
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {metrics.totalActiveDeliverables}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                items in progress
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Post-production queue</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: At / Over Capacity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              At / Over Capacity
            </div>
            <div className={`text-2xl font-extrabold mt-1 ${metrics.atOrOverCapacityCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {metrics.atOrOverCapacityCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                of {metrics.totalEditorsCount} editors
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {metrics.atOrOverCapacityCount > 0 ? 'Rebalance workload recommended' : 'Capacity within limits'}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${metrics.atOrOverCapacityCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Delivered Deliverables */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Delivered Deliverables
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {metrics.totalCompletedDeliverables}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Completed & archived</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Unassigned Work Notification (Read-Only Informational Alert) */}
      {metrics.unassignedCount > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-amber-900">
              <strong className="font-semibold">{metrics.unassignedCount} active deliverable(s)</strong> across projects currently have no editor assigned.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('deliverables')}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline self-start sm:self-auto cursor-pointer"
          >
            Assign Editors in Deliverables Pipeline →
          </button>
        </div>
      )}

      {/* 3. Toolbar Controls (Search, Workload Filter, Ordering) */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search editor, specialization, project, or deliverable..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter and Ordering Selectors */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Workload Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 font-medium shrink-0">Capacity:</span>
            <select
              value={workloadFilter}
              onChange={e => setWorkloadFilter(e.target.value as any)}
              className="text-xs font-semibold rounded-lg px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Editors ({unifiedEditors.length})</option>
              <option value="available">Available (&lt; 75%)</option>
              <option value="near_capacity">Near Capacity (75%–99%)</option>
              <option value="at_capacity">At Capacity (100%)</option>
              <option value="overloaded">Overloaded (&gt; 100%)</option>
            </select>
          </div>

          {/* Ordering Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 font-medium shrink-0">Order:</span>
            <select
              value={ordering}
              onChange={e => setOrdering(e.target.value as OrderingOption)}
              className="text-xs font-semibold rounded-lg px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="name_asc">Editor Name A–Z</option>
              <option value="name_desc">Editor Name Z–A</option>
              <option value="workload_desc">Highest Workload First</option>
              <option value="workload_asc">Lowest Workload First</option>
              <option value="assignment_oldest">Oldest Active Assignment First</option>
              <option value="assignment_newest">Newest Active Assignment First</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Editors Workload Grid */}
      {filteredEditors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Film className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Editors Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery || workloadFilter !== 'all'
              ? 'No editors match the active search or filter criteria. Try clearing filters.'
              : 'No editors are currently designated in your team roster. To designate editors, visit Team Members and assign the "Editor" category to relevant team members.'}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('team-members')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Team Members</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEditors.map(ed => {
            const stats = editorWorkloadMap.get(ed.id);
            const activeDeliverables = stats?.activeDeliverables || [];
            const completedDeliverables = stats?.completedDeliverables || [];
            const activeCount = activeDeliverables.length;
            const cap = Math.max(1, ed.effectiveCapacity);
            const percent = stats?.utilizationPercent || 0;
            const isDeliveredExpanded = Boolean(expandedDeliveredEditorIds[ed.id]);

            // Capacity indicator styling
            let statusPill = {
              label: 'Available',
              bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              barColor: 'bg-emerald-500',
            };

            if (percent > 100) {
              statusPill = {
                label: 'Overloaded',
                bgColor: 'bg-rose-50 text-rose-800 border-rose-200',
                barColor: 'bg-rose-500',
              };
            } else if (percent === 100) {
              statusPill = {
                label: 'At Capacity',
                bgColor: 'bg-rose-50 text-rose-800 border-rose-200',
                barColor: 'bg-rose-500',
              };
            } else if (percent >= 75) {
              statusPill = {
                label: 'Near Capacity',
                bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
                barColor: 'bg-amber-500',
              };
            } else if (percent > 0) {
              statusPill = {
                label: 'Optimal Load',
                bgColor: 'bg-blue-50 text-blue-800 border-blue-200',
                barColor: 'bg-blue-500',
              };
            }

            // Suppress fake placeholder contacts (e.g. .internal emails, 555-01 phones)
            const showEmail = ed.email && !ed.email.endsWith('.internal');
            const showPhone = ed.phone && !ed.phone.includes('555-01');

            return (
              <div
                key={ed.id}
                id={`editor-card-${ed.id}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Editor Header Info */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-[#F1D099] flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {ed.name
                          .split(' ')
                          .map(part => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">
                            {ed.name}
                          </h3>
                          {!ed.is_active && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {ed.specialization}
                        </div>
                        {(showEmail || showPhone) && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                            {showEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <a href={`mailto:${ed.email}`} className="hover:text-slate-800">
                                  {ed.email}
                                </a>
                              </span>
                            )}
                            {showPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{ed.phone}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusPill.bgColor}`}
                    >
                      {statusPill.label}
                    </span>
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Active Deliverables:
                      </span>
                      <span className="font-bold text-slate-900">
                        {activeCount} / {cap}{' '}
                        <span className="text-slate-500 font-normal">({percent}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${statusPill.barColor}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>{activeCount} active in queue</span>
                      <span>{completedDeliverables.length} delivered</span>
                    </div>
                  </div>
                </div>

                {/* Assigned Deliverables List */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Active Deliverables ({activeCount})
                      </h4>
                    </div>

                    {activeDeliverables.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-slate-700">
                          No active deliverables in progress
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          This editor has open bandwidth for new assignments.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeDeliverables.map(del => {
                          const proj = projectMap.get(del.project_id);

                          return (
                            <div
                              key={del.id}
                              className="p-3.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-2.5"
                            >
                              {/* Title, Priority, Project */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">
                                      {del.deliverable_type}
                                    </span>
                                    <span
                                      className={`text-[9px] font-semibold px-2 py-0.2 rounded-full border ${getPriorityBadge(
                                        del.priority
                                      )}`}
                                    >
                                      {del.priority}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                                    <span>Project:</span>
                                    <button
                                      type="button"
                                      onClick={() => proj && navigateToProject(proj.id)}
                                      className="font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <span>{proj?.name || 'Unknown Project'}</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                    {proj?.company_id && (
                                      <span
                                        className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                                          proj.company_id === 'golden_june'
                                            ? 'bg-[#F1D099]/20 text-[#8C6B28]'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        {proj.company_id === 'golden_june' ? 'Golden June' : 'TWB'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Read-Only Status Badge */}
                                  <span
                                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border ${getStatusBadge(
                                      del.status
                                    )}`}
                                  >
                                    {del.status || 'Not Started'}
                                  </span>

                                  {del.external_link && (
                                    <a
                                      href={del.external_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                                      title="Open Review URL"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Milestone Timeline Grid */}
                              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50/80 rounded-lg border border-slate-100 text-[11px]">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-medium">
                                    Assigned
                                  </span>
                                  <span className="font-semibold text-slate-700">
                                    {formatDisplayDate(del.assigned_at, '—')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-medium">
                                    1st Submitted
                                  </span>
                                  <span className={`font-semibold ${del.first_submitted_at ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                    {formatDisplayDate(del.first_submitted_at, 'Pending')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-medium">
                                    Delivered
                                  </span>
                                  <span className={`font-semibold ${del.delivered_at ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                    {formatDisplayDate(del.delivered_at, 'Pending')}
                                  </span>
                                </div>
                              </div>

                              {/* Turnaround Metrics */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                                <div>
                                  <span className="font-medium">Editing Turnaround:</span>{' '}
                                  <span className="font-semibold text-slate-700">
                                    {formatTurnaroundDays(
                                      del.assigned_at,
                                      del.first_submitted_at,
                                      del.status === 'Submitted' || del.status === 'Changes Requested' || del.status === 'Approved' || del.status === 'Delivered'
                                        ? 'In review'
                                        : 'In progress'
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">Total Turnaround:</span>{' '}
                                  <span className="font-semibold text-slate-700">
                                    {formatTurnaroundDays(del.assigned_at, del.delivered_at, 'Pending delivery')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Collapsible Delivered Deliverables Section */}
                    {completedDeliverables.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleDeliveredSection(ed.id)}
                          className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 py-1 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Delivered Deliverables ({completedDeliverables.length})</span>
                          </span>
                          {isDeliveredExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isDeliveredExpanded && (
                          <div className="mt-2.5 space-y-2">
                            {completedDeliverables.map(del => {
                              const proj = projectMap.get(del.project_id);

                              return (
                                <div
                                  key={del.id}
                                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="font-semibold text-slate-800 truncate">
                                        {del.deliverable_type}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                        Delivered
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => proj && navigateToProject(proj.id)}
                                      className="text-[11px] text-blue-600 hover:underline shrink-0"
                                    >
                                      {proj?.name}
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                                    <div>
                                      <span>Assigned: </span>
                                      <strong className="text-slate-700">{formatDisplayDate(del.assigned_at, '—')}</strong>
                                    </div>
                                    <div>
                                      <span>Delivered: </span>
                                      <strong className="text-slate-700">{formatDisplayDate(del.delivered_at, '—')}</strong>
                                    </div>
                                  </div>

                                  <div className="text-[10px] text-slate-500">
                                    <span>Total Turnaround: </span>
                                    <strong className="text-emerald-700">
                                      {formatTurnaroundDays(del.assigned_at, del.delivered_at, '—')}
                                    </strong>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Notes if available */}
                  {ed.notes && (
                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
                      "{ed.notes}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
