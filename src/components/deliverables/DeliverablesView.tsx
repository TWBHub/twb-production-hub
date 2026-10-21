import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Filter,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  FolderKanban,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  Project,
} from '../../types';
import { filterDeliverableEditors } from '../../utils/teamMemberFilters';

const DELIVERABLE_TYPES: DeliverableType[] = [
  'Highlight Film (4-5 mins)',
  'Teaser / Reel (60s)',
  'Feature Film (20-30 mins)',
  'Full Ceremony Edit',
  'Speeches & Toasts',
  'Full Photo Gallery (800+)',
  'Fine Art Wedding Album',
  'Parent Albums',
  'Drone Compilation',
];

const WORKFLOW_STATUSES: DeliverableStatus[] = [
  'Not Started',
  'Assigned',
  'In Progress',
  'Submitted',
  'Changes Requested',
  'Approved',
  'Delivered',
];

const getStatusBadge = (s?: DeliverableStatus | '') => {
  switch (s) {
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'Approved':
      return 'bg-teal-50 text-teal-800 border-teal-300';
    case 'Submitted':
      return 'bg-purple-50 text-purple-800 border-purple-300';
    case 'In Progress':
      return 'bg-blue-50 text-blue-800 border-blue-300';
    case 'Changes Requested':
      return 'bg-rose-50 text-rose-800 border-rose-300';
    case 'Assigned':
      return 'bg-indigo-50 text-indigo-800 border-indigo-300';
    case 'Not Started':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200 italic';
  }
};

// Row Component: Each deliverable row has its own isolated action menu state and unique DOM keys
interface DeliverableRowProps {
  del: Deliverable;
  editorName: string | null;
  canManage?: boolean;
  availableEditors?: { id: string; name: string }[];
  onEdit: (del: Deliverable) => void;
  onDelete: (del: Deliverable) => void;
  onStatusChange: (id: string, status: DeliverableStatus | '') => Promise<void>;
  onUpdateDeliverable?: (del: Deliverable) => Promise<Deliverable>;
}

const DeliverableRow: React.FC<DeliverableRowProps> = ({
  del,
  editorName,
  canManage = true,
  availableEditors = [],
  onEdit,
  onDelete,
  onStatusChange,
  onUpdateDeliverable,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingEditor, setIsUpdatingEditor] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Available editors list for this row: ensures currently assigned editor is included even if inactive
  const rowAvailableEditors = useMemo(() => {
    const list = Array.isArray(availableEditors) ? [...availableEditors] : [];
    if (del.assigned_editor_id && !list.some(e => e.id === del.assigned_editor_id)) {
      list.push({
        id: del.assigned_editor_id,
        name: editorName || 'Current Editor',
      });
    }
    return list;
  }, [availableEditors, del.assigned_editor_id, editorName]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      setMenuPosition(null);
    } else {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpwards = spaceBelow < 110;
        setMenuPosition({
          top: openUpwards ? Math.max(8, rect.top - 84) : rect.bottom + 4,
          left: Math.max(8, rect.right - 144), // 144px is w-36
        });
        setIsMenuOpen(true);
      }
    }
  };

  // Close menu on click outside, scroll, or resize
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isMenuOpen]);

  const handleStatusSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as DeliverableStatus | '';
    try {
      setIsUpdatingStatus(true);
      await onStatusChange(del.id, newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert(`Could not update status: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleInlineEditorChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEditorId = e.target.value;
    let newStatus = del.status;

    // Workflow rule 1: If changing from Unassigned to an Editor, set status to "Assigned" if status is blank
    if (newEditorId && (!del.status || del.status === '')) {
      newStatus = 'Assigned';
    }
    // Workflow rule 2: If changing from an Editor to Unassigned, clear "Assigned" status back to blank
    else if (!newEditorId && del.status === 'Assigned') {
      newStatus = '' as DeliverableStatus;
    }

    const updated: Deliverable = {
      ...del,
      assigned_editor_id: newEditorId || '',
      status: newStatus,
    };

    try {
      setIsUpdatingEditor(true);
      await onUpdateDeliverable(updated);
    } catch (err) {
      console.error('Failed to assign editor:', err);
      alert(`Could not assign editor: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdatingEditor(false);
    }
  };

  return (
    <tr
      key={del.id}
      id={`deliverable-row-${del.id}`}
      className="hover:bg-slate-50/70 transition-colors"
    >
      {/* 1. Deliverable */}
      <td className="py-3.5 px-4">
        <div className="font-bold text-slate-900 text-xs">
          {del.deliverable_type}
        </div>
        {del.client_feedback && (
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
            {del.client_feedback}
          </div>
        )}
      </td>

      {/* 2. Assigned Editor (Inline selector for Admin, text for Editor) */}
      <td className="py-3.5 px-4">
        {canManage ? (
          <select
            id={`deliverable-editor-${del.id}`}
            disabled={isUpdatingEditor}
            value={del.assigned_editor_id || ''}
            onChange={handleInlineEditorChange}
            className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-white border border-slate-200 text-slate-800 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-slate-400 cursor-pointer max-w-[160px] truncate transition-colors shadow-2xs"
          >
            <option value="">Unassigned</option>
            {rowAvailableEditors.map(ed => (
              <option key={ed.id} value={ed.id}>
                {ed.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="font-semibold text-slate-800 text-xs">
            {editorName ? (
              editorName
            ) : (
              <span className="text-slate-400 italic font-normal">Unassigned</span>
            )}
          </div>
        )}
      </td>

      {/* 3. Status (Dropdown with immediate update & Supabase sync) */}
      <td className="py-3.5 px-4">
        <select
          id={`deliverable-status-${del.id}`}
          disabled={isUpdatingStatus}
          value={del.status || ''}
          onChange={handleStatusSelect}
          className={`text-xs font-semibold rounded-lg px-2.5 py-1 border cursor-pointer focus:outline-hidden transition-colors ${getStatusBadge(
            del.status
          )}`}
        >
          <option value="">Unassigned</option>
          {WORKFLOW_STATUSES.map(st => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </td>

      {/* 4. URL */}
      <td className="py-3.5 px-4">
        {del.external_link ? (
          <a
            href={del.external_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            <span>Review URL</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <span className="text-slate-400 italic text-[11px]">
            No link yet
          </span>
        )}
      </td>

      {/* 5. Pencil action (Click opens Edit / Delete menu) */}
      <td className="py-3.5 px-4 text-right">
        <div className="inline-block text-left relative" data-deliverable-menu={del.id}>
          <button
            ref={buttonRef}
            type="button"
            id={`action-btn-${del.id}`}
            onClick={toggleMenu}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isMenuOpen
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Deliverable actions"
            aria-label="Deliverable actions"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Action menu via portal: fixed positioning so it is NEVER clipped by overflow or table boundary */}
          {isMenuOpen && menuPosition && typeof document !== 'undefined' && createPortal(
            <div
              ref={menuRef}
              id={`action-menu-${del.id}`}
              style={{
                position: 'fixed',
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                width: '144px',
                zIndex: 9999,
              }}
              className="bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-left animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                id={`edit-btn-${del.id}`}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onEdit(del);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left font-medium cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
              {canManage && (
                <button
                  type="button"
                  id={`delete-btn-${del.id}`}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onDelete(del);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete</span>
                </button>
              )}
            </div>,
            document.body
          )}
        </div>
      </td>
    </tr>
  );
};

export const DeliverablesView: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    isManager,
    deliverables,
    projects,
    teamMembers,
    brandFilter,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    updateDeliverableStatus,
    setSelectedProjectId,
    setActiveTab,
  } = useApp();

  const canManage = isAdmin || isManager || !currentUser || currentUser.role === 'Admin' || currentUser.role === 'Manager';

  // Filters & Ordering State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ordering, setOrdering] = useState<
    'recently_added' | 'name_asc' | 'wedding_date_asc' | 'wedding_date_desc'
  >('recently_added');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [deletingDeliverable, setDeletingDeliverable] = useState<Deliverable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Form State
  const [createProjectId, setCreateProjectId] = useState('');
  const [createType, setCreateType] = useState<DeliverableType>(DELIVERABLE_TYPES[0]);
  const [createEditorId, setCreateEditorId] = useState('');
  const [createStatus, setCreateStatus] = useState<DeliverableStatus | ''>('');
  const [createUrl, setCreateUrl] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');

  // Edit Form State
  const [editType, setEditType] = useState<DeliverableType>(DELIVERABLE_TYPES[0]);
  const [editEditorId, setEditEditorId] = useState('');
  const [editStatus, setEditStatus] = useState<DeliverableStatus | ''>('');
  const [editUrl, setEditUrl] = useState('');
  const [editFeedback, setEditFeedback] = useState('');

  // ASSIGNED EDITOR DROPDOWN:
  // Must ONLY show Team Members whose categories include "Editor"
  // Do NOT display "(editor)" in dropdown label
  const availableEditors = useMemo(() => {
    return filterDeliverableEditors(teamMembers).map(member => ({
      id: member.id,
      name: member.name,
    }));
  }, [teamMembers]);

  // For Edit modal: include current assigned editor even if legacy/inactive so assignment isn't lost
  const editAvailableEditors = useMemo(() => {
    return filterDeliverableEditors(teamMembers, {
      currentEditorId: editingDeliverable?.assigned_editor_id,
    }).map(member => ({
      id: member.id,
      name: member.name,
    }));
  }, [teamMembers, editingDeliverable?.assigned_editor_id]);

  // Lookup helper for editor display name
  const getEditorName = (editorId?: string) => {
    if (!editorId) return null;
    const member = teamMembers.find(m => m.id === editorId);
    return member ? member.name : null;
  };

  // Helper to extract primary wedding/event date for project ordering
  const getProjectWeddingDate = (project: Project | null) => {
    if (!project) {
      return { hasDate: false, date: '', projectName: '' };
    }

    const dates: string[] = [];

    if (project.wedding_date_start && /^\d{4}-\d{2}-\d{2}/.test(project.wedding_date_start)) {
      dates.push(project.wedding_date_start.slice(0, 10));
    }

    if (project.events && Array.isArray(project.events)) {
      project.events.forEach(ev => {
        if (ev.event_date && /^\d{4}-\d{2}-\d{2}/.test(ev.event_date)) {
          dates.push(ev.event_date.slice(0, 10));
        }
      });
    }

    if (dates.length === 0) {
      return { hasDate: false, date: '', projectName: project.name };
    }

    dates.sort();

    return {
      hasDate: true,
      date: dates[0],
      projectName: project.name,
    };
  };

  // PROJECT GROUP ORDERING & FILTERING
  const projectGroups = useMemo(() => {
    const groupsMap = new Map<string, Deliverable[]>();

    deliverables.forEach(del => {
      const project = projects.find(p => p.id === del.project_id);
      const editorName = getEditorName(del.assigned_editor_id);

      // 1. Global Brand Filter: Controlled by global header selector (no duplicate Deliverables filter)
      const matchesBrand = brandFilter === 'all' || del.company_id === brandFilter;

      // 2. Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        del.status === statusFilter ||
        (statusFilter === 'Unassigned' && !del.status);

      // 3. Search query (deliverable type, project name, editor, review link)
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        del.deliverable_type.toLowerCase().includes(query) ||
        (project && project.name.toLowerCase().includes(query)) ||
        (editorName && editorName.toLowerCase().includes(query)) ||
        (del.external_link && del.external_link.toLowerCase().includes(query));

      if (matchesBrand && matchesStatus && matchesSearch) {
        const pid = del.project_id || 'unassigned-project';
        if (!groupsMap.has(pid)) {
          groupsMap.set(pid, []);
        }
        groupsMap.get(pid)!.push(del);
      }
    });

    const groups: {
      project: Project | null;
      projectId: string;
      projectName: string;
      companyId: 'twb' | 'golden_june';
      deliverables: Deliverable[];
      allDelivered: boolean;
      deliveredCount: number;
      totalCount: number;
    }[] = [];

    // Hide project group if no deliverables match current filter
    groupsMap.forEach((delList, pid) => {
      if (delList.length === 0) return;

      const project = projects.find(p => p.id === pid) || null;
      const projectName = project ? project.name : 'Unassigned Project';
      const companyId = project ? project.company_id : (delList[0]?.company_id || 'twb');

      // Sort deliverables stably within the project so status changes NEVER move rows!
      const stableDeliverables = [...delList].sort((a, b) => a.id.localeCompare(b.id));

      // Completion Dot: green only when ALL deliverables belonging to that project are "Delivered"
      const allProjectDeliverables = deliverables.filter(d => d.project_id === pid);
      const allDelivered =
        allProjectDeliverables.length > 0 &&
        allProjectDeliverables.every(d => d.status === 'Delivered');

      const deliveredCount = allProjectDeliverables.filter(d => d.status === 'Delivered').length;
      const totalCount = allProjectDeliverables.length;

      groups.push({
        project,
        projectId: pid,
        projectName,
        companyId,
        deliverables: stableDeliverables,
        allDelivered,
        deliveredCount,
        totalCount,
      });
    });

    // 2. ORDERING: Recently Added | Project Name A–Z | Wedding Date — Oldest First | Wedding Date — Newest First
    return groups.sort((a, b) => {
      if (ordering === 'recently_added') {
        const dateA = a.project?.created_at || '';
        const dateB = b.project?.created_at || '';
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateA && dateB) {
          const diff = dateB.localeCompare(dateA); // newest project first
          if (diff !== 0) return diff;
        }
        const nameDiff = a.projectName.localeCompare(b.projectName);
        if (nameDiff !== 0) return nameDiff;
        return a.projectId.localeCompare(b.projectId);
      }

      if (ordering === 'name_asc') {
        const nameDiff = a.projectName.localeCompare(b.projectName);
        if (nameDiff !== 0) return nameDiff;
        return a.projectId.localeCompare(b.projectId);
      }

      // Wedding Date options: 'wedding_date_asc' (Oldest First) | 'wedding_date_desc' (Newest First)
      const keyA = getProjectWeddingDate(a.project);
      const keyB = getProjectWeddingDate(b.project);

      // Projects with dates always appear before projects without dates
      if (keyA.hasDate && !keyB.hasDate) return -1;
      if (!keyA.hasDate && keyB.hasDate) return 1;

      if (keyA.hasDate && keyB.hasDate) {
        const diff =
          ordering === 'wedding_date_asc'
            ? keyA.date.localeCompare(keyB.date) // Oldest first
            : keyB.date.localeCompare(keyA.date); // Newest first
        if (diff !== 0) return diff;
      }

      // Tie-break alphabetically by project name, then projectId
      const nameDiff = a.projectName.localeCompare(b.projectName);
      if (nameDiff !== 0) return nameDiff;
      return a.projectId.localeCompare(b.projectId);
    });
  }, [deliverables, projects, teamMembers, searchQuery, brandFilter, statusFilter, ordering]);

  // Open Edit Modal
  const openEditModal = (del: Deliverable) => {
    setEditingDeliverable(del);
    setEditType(del.deliverable_type);
    setEditEditorId(del.assigned_editor_id || '');
    setEditStatus(del.status || '');
    setEditUrl(del.external_link || '');
    setEditFeedback(del.client_feedback || '');
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeliverable) return;

    try {
      setIsSubmitting(true);
      await updateDeliverable({
        ...editingDeliverable,
        deliverable_type: editType,
        assigned_editor_id: editEditorId,
        status: editStatus as DeliverableStatus,
        external_link: editUrl.trim() || undefined,
        client_feedback: editFeedback.trim() || undefined,
      });
      setEditingDeliverable(null);
    } catch (err) {
      console.error('Failed to update deliverable:', err);
      alert(`Could not update deliverable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Create Modal
  const openCreateModal = (defaultProjectId?: string) => {
    const validProjects = projects && projects.length > 0 ? projects : [];
    const initialProjectId =
      (defaultProjectId && validProjects.some(p => p.id === defaultProjectId))
        ? defaultProjectId
        : (validProjects[0]?.id || '');
    setCreateProjectId(initialProjectId);
    setCreateType(DELIVERABLE_TYPES[0]);
    // Rule: Blank editor = blank status
    setCreateEditorId('');
    setCreateStatus('');
    setCreateUrl('');
    setCreateFeedback('');
    setShowCreateModal(true);
  };

  // Handle Create Deliverable
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = projects.find(p => p.id === createProjectId) || projects[0];
    if (!proj) {
      alert('Please select a valid wedding project.');
      return;
    }

    const assignedEditor = createEditorId.trim() || '';
    // Workflow rule: If an editor is assigned during creation, status becomes 'Assigned' (if currently blank)
    // If no editor is assigned, editor is null/empty and status is blank/null
    let finalStatus = createStatus;
    if (assignedEditor && (!finalStatus || finalStatus === '')) {
      finalStatus = 'Assigned';
    } else if (!assignedEditor && finalStatus === 'Assigned') {
      finalStatus = '';
    }

    try {
      setIsSubmitting(true);
      await createDeliverable({
        project_id: proj.id,
        company_id: proj.company_id,
        deliverable_type: createType,
        assigned_editor_id: assignedEditor || '',
        due_date: proj.wedding_date_start || new Date().toISOString().split('T')[0],
        status: finalStatus as DeliverableStatus,
        priority: 'Medium',
        external_link: createUrl.trim() || undefined,
        client_feedback: createFeedback.trim() || undefined,
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create deliverable:', err);
      alert(`Could not create deliverable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Deliverable
  const handleDelete = async () => {
    if (!deletingDeliverable) return;
    try {
      setIsDeleting(true);
      await deleteDeliverable(deletingDeliverable.id);
      setDeletingDeliverable(null);
    } catch (err) {
      console.error('Failed to delete deliverable:', err);
      alert(`Could not delete deliverable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Post-Production Deliverables
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Deliverables grouped by wedding project with editor assignment and workflow status.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            id="btn-new-deliverable"
            onClick={() => openCreateModal()}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Deliverable</span>
          </button>
        )}
      </div>

      {/* FILTER BAR: Search, Status Filter, Ordering Selector */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, wedding project, editor, or URL..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {/* Workflow Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-hidden w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="Unassigned">Unassigned / Blank</option>
            {WORKFLOW_STATUSES.map(st => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Ordering Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Ordering:</span>
          </div>
          <select
            value={ordering}
            onChange={e =>
              setOrdering(
                e.target.value as
                  | 'recently_added'
                  | 'name_asc'
                  | 'wedding_date_asc'
                  | 'wedding_date_desc'
              )
            }
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-hidden w-full sm:w-auto"
          >
            <option value="recently_added">Recently Added</option>
            <option value="name_asc">Project Name A–Z</option>
            <option value="wedding_date_asc">Wedding Date — Oldest First</option>
            <option value="wedding_date_desc">Wedding Date — Newest First</option>
          </select>
        </div>
      </div>

      {/* PROJECT GROUPS */}
      {projectGroups.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No deliverables found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No deliverables match the active filter criteria. Try clearing filters or search.'
              : 'Start by creating your first post-production deliverable above.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {projectGroups.map(group => {
            const isTWB = group.companyId === 'twb';

            return (
              <div
                key={group.projectId}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs relative"
              >
                {/* Project Header */}
                <div className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Completion Dot: Gray normally, Green only when ALL deliverables have status "Delivered" */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 inline-block transition-colors ${
                        group.allDelivered
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-slate-300'
                      }`}
                      title={
                        group.allDelivered
                          ? 'All deliverables delivered'
                          : 'Deliverables in progress'
                      }
                    />

                    {/* Wedding Project Name */}
                    {group.project ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(group.project!.id);
                          setActiveTab('projects');
                        }}
                        className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors text-left flex items-center gap-1.5 group/proj cursor-pointer"
                      >
                        <span>{group.projectName}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover/proj:text-blue-600 transition-colors" />
                      </button>
                    ) : (
                      <span className="font-bold text-sm text-slate-900">
                        {group.projectName}
                      </span>
                    )}

                    {/* Brand Tag */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isTWB
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-[#F1D099]/30 text-[#5e430c] border border-[#F1D099]/60'
                      }`}
                    >
                      {isTWB ? 'The Wedding Booth' : 'Golden June'}
                    </span>

                    {/* Completion Summary */}
                    <span className="text-[11px] text-slate-400 font-medium ml-1">
                      ({group.deliveredCount}/{group.totalCount} Delivered)
                    </span>
                  </div>

                  {/* Add Deliverable button for this project */}
                  {canManage && (
                    <button
                      type="button"
                      id={`btn-add-deliverable-${group.projectId}`}
                      onClick={() => openCreateModal(group.projectId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-600" />
                      <span>Add Deliverable</span>
                    </button>
                  )}
                </div>

                {/* Deliverables Table: ONLY 5 Columns:
                    1. Deliverable
                    2. Assigned Editor
                    3. Status
                    4. URL
                    5. Pencil action */}
                <div className="overflow-x-auto rounded-b-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Deliverable</th>
                        <th className="py-3 px-4 font-semibold">Assigned Editor</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">URL</th>
                        <th className="py-3 px-4 font-semibold text-right w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.deliverables.map(del => {
                        const editorName = getEditorName(del.assigned_editor_id);

                        return (
                          <DeliverableRow
                            key={del.id}
                            del={del}
                            editorName={editorName}
                            canManage={canManage}
                            availableEditors={availableEditors}
                            onEdit={openEditModal}
                            onDelete={setDeletingDeliverable}
                            onStatusChange={updateDeliverableStatus}
                            onUpdateDeliverable={updateDeliverable}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Deliverable Modal */}
      {editingDeliverable && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Edit Deliverable
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Update deliverable type, assigned editor, status, or review URL.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingDeliverable(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deliverable Type
                </label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value as DeliverableType)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  {DELIVERABLE_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* ASSIGNED EDITOR DROPDOWN: ONLY Editors, NO "(editor)" in label */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Editor
                </label>
                <select
                  value={editEditorId}
                  onChange={e => {
                    const newEditorId = e.target.value;
                    setEditEditorId(newEditorId);
                    // Automatic status workflow rule
                    if (newEditorId && (!editStatus || editStatus === '')) {
                      setEditStatus('Assigned');
                    } else if (!newEditorId && editStatus === 'Assigned') {
                      setEditStatus('');
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">Unassigned</option>
                  {editAvailableEditors.map(ed => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Workflow Status
                </label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as DeliverableStatus | '')}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">Unassigned / Blank</option>
                  {WORKFLOW_STATUSES.map(st => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Review / Delivery URL
                </label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  placeholder="https://frame.io/... or vimeo.com/..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Editing Notes / Feedback
                </label>
                <textarea
                  value={editFeedback}
                  onChange={e => setEditFeedback(e.target.value)}
                  rows={3}
                  placeholder="Notes, creative directions, or client review notes..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDeliverable(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Deliverable Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  New Deliverable
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Create a deliverable for a wedding project with editor assignment.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Wedding Project *
                </label>
                <select
                  value={createProjectId}
                  onChange={e => setCreateProjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
                  required
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.company_id === 'twb' ? 'TWB' : 'Golden June'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deliverable Asset Type *
                </label>
                <select
                  value={createType}
                  onChange={e => setCreateType(e.target.value as DeliverableType)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  {DELIVERABLE_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* ASSIGNED EDITOR DROPDOWN: ONLY Editors, NO "(editor)" in label */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assign Editor
                </label>
                <select
                  value={createEditorId}
                  onChange={e => {
                    const newEditorId = e.target.value;
                    setCreateEditorId(newEditorId);
                    // Workflow rule: if editor is selected and status is blank -> becomes Assigned
                    // If editor cleared and status was Assigned -> becomes blank
                    if (newEditorId && (!createStatus || createStatus === '')) {
                      setCreateStatus('Assigned');
                    } else if (!newEditorId && createStatus === 'Assigned') {
                      setCreateStatus('');
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">Unassigned</option>
                  {availableEditors.map(ed => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Workflow Status
                </label>
                <select
                  value={createStatus}
                  onChange={e => setCreateStatus(e.target.value as DeliverableStatus | '')}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="">Unassigned / Blank</option>
                  {WORKFLOW_STATUSES.map(st => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Review / Delivery URL
                </label>
                <input
                  type="url"
                  value={createUrl}
                  onChange={e => setCreateUrl(e.target.value)}
                  placeholder="https://frame.io/... or vimeo.com/..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Editing Notes / Feedback
                </label>
                <textarea
                  value={createFeedback}
                  onChange={e => setCreateFeedback(e.target.value)}
                  rows={3}
                  placeholder="Notes, creative directions, or client review notes..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Deliverable Confirmation Modal */}
      {deletingDeliverable && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Deliverable</h3>
                <p className="text-xs text-slate-500">This will remove it from both Global Deliverables and Project Card.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 font-semibold">
                "{deletingDeliverable.deliverable_type}"
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                id="cancel-delete-deliverable-btn"
                disabled={isDeleting}
                onClick={() => setDeletingDeliverable(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-deliverable-btn"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
