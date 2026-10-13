import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Calendar,
  MapPin,
  Download,
  Eye,
  AlertTriangle,
  X,
  UserPlus,
  ArrowUpDown,
  Loader2,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project, ProjectStatus, Client, ClientHddStatus, CLIENT_HDD_STATUS_OPTIONS } from '../../types';
import { ProjectDetailWorkspace, PROJECT_PRODUCTION_STAGES } from './ProjectDetailWorkspace';
import { generateOrderFormPDF } from '../../utils/pdfGenerator';
import { sortProjectEvents } from '../../utils/eventUtils';

export const ProjectsView: React.FC = () => {
  const {
    filteredProjects,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    updateProject,
    deleteProject,
    createClient,
    clients,
    companies,
    brandFilter,
    canCreateProject,
    deliverables,
    payments,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ordering, setOrdering] = useState<
    | 'recently_added'
    | 'name_asc'
    | 'wedding_date_asc'
    | 'wedding_date_desc'
    | 'upcoming_weddings'
  >('recently_added');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [downloadingProjectId, setDownloadingProjectId] = useState<string | null>(null);
  const [downloadSuccessProjectId, setDownloadSuccessProjectId] = useState<string | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  // New Project Form State
  const [newCompanyId, setNewCompanyId] = useState<'twb' | 'golden_june'>(
    brandFilter === 'golden_june' ? 'golden_june' : 'twb'
  );
  const [newClientId, setNewClientId] = useState(clients[0]?.id || '');
  const [newWeddingName, setNewWeddingName] = useState('');

  const [newEvents, setNewEvents] = useState<
    Array<{
      event_name: string;
      event_date: string;
      event_time?: string;
      event_address?: string;
      team?: string;
      event_notes?: string;
    }>
  >([
    {
      event_name: '',
      event_date: '',
      event_time: '',
      event_address: '',
      team: '',
      event_notes: '',
    },
  ]);

  const [newVenue, setNewVenue] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPackage, setNewPackage] = useState(
    'The Sovereign Cinema & Stills Collection'
  );
  const [newPackageDetails, setNewPackageDetails] = useState(
    'Full day coverage, 3x cinematographers, 2x photographers, drone coverage, 4K highlight film.'
  );
  const [newBookingAmount, setNewBookingAmount] = useState(5000);
  const [newTotalAmount, setNewTotalAmount] = useState(14000);
  const [newNotes, setNewNotes] = useState('');

  // Project creation status and error message
  const [createProjectError, setCreateProjectError] = useState<string | null>(
    null
  );
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

// Load an existing project into the New Wedding Project form when editing
useEffect(() => {
  if (!editingProjectId) return;

  const projectToEdit = filteredProjects.find(
    p => p.id === editingProjectId
  );

  if (!projectToEdit) return;

  setNewCompanyId(
  projectToEdit.company_id === 'golden_june'
    ? 'golden_june'
    : 'twb'
);
  setNewClientId(projectToEdit.client_id || '');
  setNewWeddingName(projectToEdit.name || '');

  setNewEvents(
  projectToEdit.events && projectToEdit.events.length > 0
    ? sortProjectEvents(projectToEdit.events).map(event => ({
        id: event.id,
        event_name: event.event_name || '',
        event_date: event.event_date || '',
        event_time: event.event_time || '',
        event_address: event.event_address || '',
        team: event.team || '',
        event_notes: event.event_notes || '',
      }))
      : [
          {
            event_name: '',
            event_date: '',
            event_time: '',
            event_address: '',
            team: '',
            event_notes: '',
          },
        ]
  );

  setNewVenue(projectToEdit.venue || '');
  setNewCity(projectToEdit.city || '');
  setNewPhone(projectToEdit.client_contact?.phone || '');
  setNewEmail(projectToEdit.client_contact?.email || '');
  setNewPackage(projectToEdit.package_name || '');
  setNewPackageDetails(projectToEdit.package_details || '');
  setNewBookingAmount(projectToEdit.booking_amount || 0);
  setNewTotalAmount(projectToEdit.total_amount || 0);
  setNewNotes(projectToEdit.notes || '');
}, [editingProjectId, filteredProjects]);

  const resetCreateForm = () => {
    setEditingProjectId(null);
    setNewWeddingName('');
    setNewEvents([
      {
        event_name: '',
        event_date: '',
        event_time: '',
        event_address: '',
        team: '',
        event_notes: '',
      },
    ]);
    setNewVenue('');
    setNewCity('');
    setNewPhone('');
    setNewEmail('');
    setNewPackage('The Sovereign Cinema & Stills Collection');
    setNewPackageDetails(
      'Full day coverage, 3x cinematographers, 2x photographers, drone coverage, 4K highlight film.'
    );
    setNewBookingAmount(5000);
    setNewTotalAmount(14000);
    setNewNotes('');
    setCreateProjectError(null);
  };

  // Sync newClientId when clients list loads or updates
  useEffect(() => {
    if (
      (!newClientId || newClientId === '__add_new_client__') &&
      clients.length > 0
    ) {
      setNewClientId(clients[0].id);
      applyClientToProject(clients[0]);
    }
  }, [clients, newClientId]);

  // Add New Client modal state & fields
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPartnerName, setNewClientPartnerName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientInstagram, setNewClientInstagram] = useState('');
  const [newClientInstagram2, setNewClientInstagram2] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Helper to select client and autofill project fields
  const applyClientToProject = (client: Client) => {
    setNewClientId(client.id);
    setNewWeddingName(
      `${client.name}${client.partner_name ? ` & ${client.partner_name}` : ''}`
    );
    setNewPhone(client.phone || '');
    setNewEmail(client.email || '');
  };

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !newClientName.trim() ||
      !newClientPhone.trim() ||
      isSubmittingClient
    ) {
      return;
    }

    try {
      setIsSubmittingClient(true);

      const created = await createClient({
        company_id:
  newCompanyId === 'golden_june'
    ? '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
    : '5736bf57-b1db-4896-a4df-4963ded1c4c6',
        name: newClientName.trim(),
        partner_name: newClientPartnerName.trim() || undefined,
        phone: newClientPhone.trim(),
        email: newClientEmail.trim(),
        instagram: newClientInstagram.trim() || undefined,
        instagram_2: newClientInstagram2.trim() || undefined,
        address: newClientAddress.trim() || undefined,
        notes: newClientNotes.trim() || undefined,
      });

      // Reset new-client fields
      setNewClientName('');
      setNewClientPartnerName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setNewClientInstagram('');
      setNewClientInstagram2('');
      setNewClientAddress('');
      setNewClientNotes('');
      setShowAddClientModal(false);

      // Automatically select and populate project fields
      applyClientToProject(created);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Helper to extract wedding and event dates for project ordering
  const getProjectDateInfo = (project: Project, today: string) => {
    const dates: string[] = [];

    if (project.wedding_date_start && /^\d{4}-\d{2}-\d{2}/.test(project.wedding_date_start)) {
      dates.push(project.wedding_date_start.slice(0, 10));
    }

    if (project.wedding_date_end && /^\d{4}-\d{2}-\d{2}/.test(project.wedding_date_end)) {
      dates.push(project.wedding_date_end.slice(0, 10));
    }

    if (project.events && Array.isArray(project.events)) {
      project.events.forEach(ev => {
        if (ev.event_date && /^\d{4}-\d{2}-\d{2}/.test(ev.event_date)) {
          dates.push(ev.event_date.slice(0, 10));
        }
      });
    }

    const uniqueDates = Array.from(new Set(dates)).sort();

    if (uniqueDates.length === 0) {
      return {
        hasDate: false,
        primaryDate: '',
        isUpcoming: false,
        nearestUpcomingDate: '',
        pastDate: '',
      };
    }

    const upcomingDates = uniqueDates.filter(d => d >= today);
    const isUpcoming = upcomingDates.length > 0;
    const nearestUpcomingDate = upcomingDates[0] || '';
    const pastDate = uniqueDates[uniqueDates.length - 1];

    return {
      hasDate: true,
      primaryDate: uniqueDates[0],
      isUpcoming,
      nearestUpcomingDate,
      pastDate,
    };
  };

  const filtered = useMemo(() => {
    const matches = filteredProjects.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    const originalIndexMap = new Map<string, number>();
    filteredProjects.forEach((p, idx) => originalIndexMap.set(p.id, idx));

    const today = (() => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();

    return [...matches].sort((a, b) => {
      if (ordering === 'recently_added') {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        if (dateA && dateB && dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        return (originalIndexMap.get(a.id) ?? 0) - (originalIndexMap.get(b.id) ?? 0);
      }

      if (ordering === 'name_asc') {
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }

      const infoA = getProjectDateInfo(a, today);
      const infoB = getProjectDateInfo(b, today);

      if (ordering === 'wedding_date_asc') {
        if (infoA.hasDate && !infoB.hasDate) return -1;
        if (!infoA.hasDate && infoB.hasDate) return 1;
        if (infoA.hasDate && infoB.hasDate) {
          const diff = infoA.primaryDate.localeCompare(infoB.primaryDate);
          if (diff !== 0) return diff;
        }
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }

      if (ordering === 'wedding_date_desc') {
        if (infoA.hasDate && !infoB.hasDate) return -1;
        if (!infoA.hasDate && infoB.hasDate) return 1;
        if (infoA.hasDate && infoB.hasDate) {
          const diff = infoB.primaryDate.localeCompare(infoA.primaryDate);
          if (diff !== 0) return diff;
        }
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }

      if (ordering === 'upcoming_weddings') {
        if (infoA.isUpcoming && !infoB.isUpcoming) return -1;
        if (!infoA.isUpcoming && infoB.isUpcoming) return 1;

        if (infoA.isUpcoming && infoB.isUpcoming) {
          const diff = infoA.nearestUpcomingDate.localeCompare(infoB.nearestUpcomingDate);
          if (diff !== 0) return diff;
          const nameDiff = a.name.localeCompare(b.name);
          if (nameDiff !== 0) return nameDiff;
          return a.id.localeCompare(b.id);
        }

        if (infoA.hasDate && !infoB.hasDate) return -1;
        if (!infoA.hasDate && infoB.hasDate) return 1;

        if (infoA.hasDate && infoB.hasDate) {
          const diff = infoB.pastDate.localeCompare(infoA.pastDate);
          if (diff !== 0) return diff;
          const nameDiff = a.name.localeCompare(b.name);
          if (nameDiff !== 0) return nameDiff;
          return a.id.localeCompare(b.id);
        }

        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }

      return 0;
    });
  }, [filteredProjects, searchQuery, statusFilter, ordering]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingProject) return;
    setCreateProjectError(null);

  // 1. Validate required client selection
  if (!newClientId || newClientId === '__add_new_client__') {
    setCreateProjectError(
      'Please select or add a client profile for this project.'
    );
    return;
  }

  // 2. Validate required project / wedding title
  if (!newWeddingName.trim()) {
    setCreateProjectError('Please enter a Project / Wedding Title.');
    return;
  }

  // 3. Validate required event schedule
  if (newEvents.length === 0) {
    setCreateProjectError(
      'Please add at least one event to the Event Schedule.'
    );
    return;
  }

  const invalidEvent = newEvents.find(
    event => !event.event_name.trim() || !event.event_date
  );

  if (invalidEvent) {
    setCreateProjectError(
      'Please ensure every event in the schedule has both an Event Name and an Event Date.'
    );
    return;
  }

  // Derive legacy dates for backward compatibility
  const sortedDates = [...newEvents]
    .map(ev => ev.event_date)
    .filter(Boolean)
    .sort();

  const weddingDateStart =
    sortedDates[0] || new Date().toISOString().split('T')[0];

  const weddingDateEnd =
    sortedDates[sortedDates.length - 1] || weddingDateStart;

  try {
    setIsSubmittingProject(true);

    const projectData = {
      company_id:
  newCompanyId === 'golden_june'
    ? 'golden_june'
    : 'twb',
      client_id: newClientId,

      events: newEvents.map((ev, index) => ({
        id: editingProjectId ? ev.id : undefined,
        event_name: ev.event_name.trim(),
        event_date: ev.event_date,
        event_time: ev.event_time?.trim() || undefined,
        event_address: ev.event_address?.trim() || undefined,
        team: ev.team?.trim() || undefined,
        event_notes: ev.event_notes?.trim() || undefined,
        sort_order: index,
      })),

      name: newWeddingName.trim(),
      wedding_date_start: weddingDateStart,
      wedding_date_end: weddingDateEnd,
      venue: newVenue || 'Private Estate',
      city: newCity || 'San Francisco, CA',

      client_contact: {
        phone: newPhone || '+1 (415) 555-0199',
        email: newEmail || 'client@wedding.com',
      },

      status: 'confirmed' as const,
      package_name: newPackage,
      package_details: newPackageDetails,
      booking_amount: newBookingAmount,
      total_amount: newTotalAmount,
      notes: newNotes,
      client_hdd_status: 'Not Received' as const,
    };

    if (editingProjectId) {
      // EDIT EXISTING PROJECT
      const existingProject = filteredProjects.find(
        p => p.id === editingProjectId
      );

      if (!existingProject) {
        throw new Error('The project you are trying to edit could not be found.');
      }

console.log('EDIT BRAND BEFORE UPDATE:', newCompanyId);

      const updatedProject = await updateProject({
        ...existingProject,
        ...projectData,
        id: editingProjectId,
        created_at: existingProject.created_at,
      });

      // Close edit mode
      setEditingProjectId(null);
      setShowCreateModal(false);
      setCreateProjectError(null);

      // Open the updated project workspace
      setSelectedProjectId(updatedProject.id);
    } else {
      // CREATE NEW PROJECT
      const created = await createProject(projectData);

      // Reset form to blank single event
      resetCreateForm();
      setShowCreateModal(false);
      setSelectedProjectId(created.id);
    }
  } catch (error: any) {
    console.error('Error saving project:', error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' &&
          error !== null &&
          'message' in error
        ? (error as any).message
        : JSON.stringify(error);

    setCreateProjectError(
      `Could not save the project: ${message}`
    );
  } finally {
    setIsSubmittingProject(false);
  }
};

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'Shooting':
        return 'bg-purple-100 text-purple-800 border-purple-200';

      case 'Pre-Production':
        return 'bg-blue-100 text-blue-800 border-blue-200';

      case 'Editing':
        return 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/50';

      case 'Review':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';

      case 'Booked':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';

      case 'Delivered':
        return 'bg-teal-100 text-teal-800 border-teal-200';

      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Wedding & Project Management
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Production workspaces, crew allocations, deliverables, and finances.
          </p>
        </div>

        {canCreateProject && (
          <button
            id="btn-create-new-project"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {pdfDownloadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{pdfDownloadError}</span>
          </div>
          <button
            onClick={() => setPdfDownloadError(null)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search wedding, couple name, venue, city..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 w-full md:w-auto"
          >
            <option value="all">All Production Stages</option>
            {PROJECT_PRODUCTION_STAGES.map(stage => (
              <option key={stage} value={stage}>
                {stage}
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
            id="projects-ordering-select"
            value={ordering}
            onChange={e =>
              setOrdering(
                e.target.value as
                  | 'recently_added'
                  | 'name_asc'
                  | 'wedding_date_asc'
                  | 'wedding_date_desc'
                  | 'upcoming_weddings'
              )
            }
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-hidden w-full sm:w-auto"
          >
            <option value="recently_added">Recently Added</option>
            <option value="name_asc">Project Name A–Z</option>
            <option value="wedding_date_asc">Wedding Date — Oldest First</option>
            <option value="wedding_date_desc">Wedding Date — Newest First</option>
            <option value="upcoming_weddings">Upcoming Weddings</option>
          </select>
        </div>
      </div>

      {/* Projects Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(project => {
          const isTWB = project.company_id === 'twb';
          const company =
            companies.find(c => c.id === project.company_id) || companies[0];
          const client = clients.find(c => c.id === project.client_id);

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4 sm:p-5 space-y-3">
               {/* Brand and Status row */}
<div className="flex items-center justify-between gap-2">
  <span
    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
      isTWB
        ? 'bg-blue-100 text-blue-800'
        : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
    }`}
  >
    {isTWB ? 'TWB' : 'Golden June'}
  </span>

  <div className="flex items-center gap-1.5">
    <span
      className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusBadge(
        project.status
      )}`}
    >
      {project.status}
    </span>

   <div className="relative">
  <button
    type="button"
    onClick={() =>
      setOpenProjectMenuId(
        openProjectMenuId === project.id ? null : project.id
      )
    }
    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    title="Project actions"
    aria-label={`Actions for ${project.name}`}
  >
    <MoreVertical className="w-4 h-4" />
  </button>

  {openProjectMenuId === project.id && (
    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
     <button
  type="button"
  onClick={() => {
  const projectToEdit = project;

  setOpenProjectMenuId(null);
  setEditingProjectId(projectToEdit.id);
  setShowCreateModal(true);
}}
  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
>
  ✏️
  <span>Edit Project</span>
</button>

      <button
        type="button"
        onClick={async () => {
          setOpenProjectMenuId(null);
          try {
            await deleteProject(project.id);
          } catch (err) {
            console.error('Failed to delete project:', err);
          }
        }}
        className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        🗑️
        <span>Delete Project</span>
      </button>
    </div>
  )}
</div>
  </div>
</div>

                {/* Project Title */}
                <div>
                  <h3
                    onClick={() => setSelectedProjectId(project.id)}
                    className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors cursor-pointer line-clamp-1"
                  >
                    {project.name}
                  </h3>

                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{project.wedding_date_start}</span>

                    <span className="text-slate-300">•</span>

                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{project.venue}</span>
                  </div>
                </div>

                {/* Package description snippet */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                  <div className="font-semibold text-slate-800 truncate">
                    {project.package_name}
                  </div>

                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {project.package_details}
                  </div>
                </div>

                {/* Financial overview */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Contract Total:</span>

                  <span className="font-bold text-slate-900">
                    ₹{project.total_amount.toLocaleString()}
                  </span>
                </div>

                {/* Client HDD/SSD Overview Field */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Client HDD/SSD:</span>
                  <select
                    id={`select-client-hdd-${project.id}`}
                    value={project.client_hdd_status || 'Not Received'}
                    onClick={e => e.stopPropagation()}
                    onChange={async e => {
                      const newStatus = e.target.value as ClientHddStatus;
                      try {
                        await updateProject({
                          ...project,
                          client_hdd_status: newStatus,
                        });
                      } catch (err) {
                        console.error('Failed to update Client HDD/SSD status:', err);
                      }
                    }}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 font-medium text-slate-800 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {CLIENT_HDD_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedProjectId(project.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Open Workspace
                </button>

                <button
                  disabled={downloadingProjectId === project.id}
                  onClick={async () => {
                    setPdfDownloadError(null);
                    setDownloadingProjectId(project.id);
                    // Yield so the browser and React render the spinner
                    await new Promise(resolve => setTimeout(resolve, 50));
                    try {
                      const projectDeliverables = deliverables.filter(
                        d => d.project_id === project.id
                      );
                      const projectPayments = payments.filter(
                        p => p.project_id === project.id
                      );

                      const doc = generateOrderFormPDF(
                        project,
                        client,
                        company,
                        projectDeliverables,
                        projectPayments
                      );

                      doc.save();
                      setDownloadSuccessProjectId(project.id);
                      setTimeout(() => {
                        setDownloadSuccessProjectId(null);
                      }, 2500);
                    } catch (err) {
                      console.error('Failed to generate or download Order Form PDF:', err);
                      setPdfDownloadError(
                        `Failed to download Order Form for "${project.name}": ${err instanceof Error ? err.message : String(err)}`
                      );
                    } finally {
                      setDownloadingProjectId(null);
                    }
                  }}
                  className={`text-xs flex items-center gap-1 font-medium transition-colors ${
                    downloadSuccessProjectId === project.id
                      ? 'text-emerald-600'
                      : downloadingProjectId === project.id
                      ? 'text-blue-600 cursor-wait'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Download printable Order Form PDF"
                >
                  {downloadSuccessProjectId === project.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Downloaded!</span>
                    </>
                  ) : downloadingProjectId === project.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Order PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />

          <p className="text-sm font-semibold text-slate-700">
            No projects found matching criteria.
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Try clearing filters or search query.
          </p>
        </div>
      )}

      {/* Active Project Workspace Modal */}
      {selectedProjectId && (
        <ProjectDetailWorkspace
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
        />
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingProjectId ? 'Edit Project' : 'Book New Project'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company / Brand
                  </label>

                  <select
                    value={newCompanyId}
                    onChange={e =>
                      setNewCompanyId(e.target.value as any)
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="twb">The Wedding Booth</option>
                    <option value="golden_june">
                      Golden June Films
                    </option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Client Profile
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAddClientModal(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Client</span>
                    </button>
                  </div>

                  <select
                    value={newClientId}
                    onChange={e => {
                      if (e.target.value === '__add_new_client__') {
                        setShowAddClientModal(true);
                        return;
                      }

                      setNewClientId(e.target.value);

                      const match = clients.find(
                        c => c.id === e.target.value
                      );

                      if (match) {
                        applyClientToProject(match);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{' '}
                        {c.partner_name ? `& ${c.partner_name}` : ''}
                      </option>
                    ))}

                    <option
                      value="__add_new_client__"
                      className="font-semibold text-blue-600"
                    >
                      + Add New Client
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project / Wedding Title
                </label>

                <input
                  type="text"
                  required
                  value={newWeddingName}
                  onChange={e => setNewWeddingName(e.target.value)}
                  placeholder="e.g. Olivia & Marcus • Alderbrook Estate"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Event Schedule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Event Schedule
                    </label>

                    <p className="text-xs text-slate-500 mt-1">
                      Add each actual wedding function separately. Events can
                      be on non-consecutive dates.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNewEvents([
                        ...newEvents,
                        {
                          event_name: '',
                          event_date: '',
                          event_time: '',
                          event_address: '',
                          team: '',
                          event_notes: '',
                        },
                      ])
                    }
                    className="px-3 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                  >
                    + Add Event
                  </button>
                </div>

                <div className="space-y-4">
                  {newEvents.map((event, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-700">
                          Event {index + 1}
                        </h3>

                        {newEvents.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setNewEvents(
                                newEvents.filter(
                                  (_, i) => i !== index
                                )
                              )
                            }
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Event Name */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Event Name
                          </label>

                          <input
                            type="text"
                            required
                            value={event.event_name}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        event_name: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="e.g. Engagement, Mehndi, Wedding"
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        {/* Event Date */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Event Date
                          </label>

                          <input
                            type="date"
                            required
                            value={event.event_date}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        event_date: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        {/* Event Time */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Event Time
                          </label>

                          <input
                            type="time"
                            value={event.event_time}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        event_time: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        {/* Event Address */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Event Address
                          </label>

                          <input
                            type="text"
                            value={event.event_address}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        event_address: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="Full venue / event address"
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        {/* Team */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Team{' '}
                            <span className="text-slate-400 font-normal">
                              (optional)
                            </span>
                          </label>

                          <input
                            type="text"
                            value={event.team}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        team: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="e.g. 1+1"
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>

                        {/* Event Notes */}
                        <div className="col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Event Notes
                          </label>

                          <textarea
                            value={event.event_notes}
                            onChange={e =>
                              setNewEvents(
                                newEvents.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        event_notes: e.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="Any notes, timings, special requirements, etc."
                            rows={2}
                            className="w-full p-2 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primary Venue
                  </label>

                  <input
                    type="text"
                    required
                    value={newVenue}
                    onChange={e => setNewVenue(e.target.value)}
                    placeholder="e.g. Filoli Gardens"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    City / Region
                  </label>

                  <input
                    type="text"
                    required
                    value={newCity}
                    onChange={e => setNewCity(e.target.value)}
                    placeholder="e.g. Woodside, CA"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Commissioned Package
                </label>

                <input
                  type="text"
                  required
                  value={newPackage}
                  onChange={e => setNewPackage(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Package Scope & Deliverables
                </label>

                <textarea
                  value={newPackageDetails}
                  onChange={e => setNewPackageDetails(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Booking Retainer (₹)
                  </label>

                  <input
                    type="number"
                    value={newBookingAmount}
                    onChange={e =>
                      setNewBookingAmount(Number(e.target.value))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Total Agreed Fee (₹)
                  </label>

                  <input
                    type="number"
                    value={newTotalAmount}
                    onChange={e =>
                      setNewTotalAmount(Number(e.target.value))
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Visible error message banner */}
              {createProjectError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />

                  <div className="flex-1">
                    <p className="font-semibold">
                      Unable to create project
                    </p>

                    <p className="text-[11px] mt-0.5 whitespace-pre-wrap">
                      {createProjectError}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSubmittingProject}
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateModal(false);
                  }}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="btn-create-and-open-workspace"
                  disabled={isSubmittingProject}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {isSubmittingProject && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}

                 <span>
  {isSubmittingProject
    ? editingProjectId
      ? 'Saving & Opening...'
      : 'Creating & Opening...'
    : editingProjectId
      ? 'Save & Open Workspace'
      : 'Create & Open Workspace'}
</span>
                </button>
              </div>
            </form>
          </div>

          {/* Add New Client Modal */}
          {showAddClientModal && (
            <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
                <div className="flex items-center justify-between mb-4 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-slate-700" />

                    <h3 className="text-sm font-bold text-slate-900">
                      Add New Client
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddClientModal(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleCreateNewClient}
                  className="space-y-3 text-xs"
                >
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">
                      Company / Brand:
                    </span>

                    <span className="font-medium text-slate-900">
                      {newCompanyId === 'twb'
                        ? 'The Wedding Booth'
                        : 'Golden June Films'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Client Name{' '}
                        <span className="text-red-500">*</span>
                      </label>

                      <input
                        type="text"
                        required
                        value={newClientName}
                        onChange={e =>
                          setNewClientName(e.target.value)
                        }
                        placeholder="e.g. Sophia Sterling"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Partner Name{' '}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>

                      <input
                        type="text"
                        value={newClientPartnerName}
                        onChange={e =>
                          setNewClientPartnerName(e.target.value)
                        }
                        placeholder="e.g. Liam Harrington"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Phone{' '}
                        <span className="text-red-500">*</span>
                      </label>

                      <input
                        type="tel"
                        required
                        value={newClientPhone}
                        onChange={e =>
                          setNewClientPhone(e.target.value)
                        }
                        placeholder="+1 (415) 555-0199"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Email{' '}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>

                      <input
                        type="email"
                        value={newClientEmail}
                        onChange={e =>
                          setNewClientEmail(e.target.value)
                        }
                        placeholder="client@wedding.com"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Instagram{' '}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>

                      <input
                        type="text"
                        value={newClientInstagram}
                        onChange={e =>
                          setNewClientInstagram(e.target.value)
                        }
                        placeholder="@sophia_and_liam"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Instagram 2{' '}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>

                      <input
                        type="text"
                        value={newClientInstagram2}
                        onChange={e =>
                          setNewClientInstagram2(e.target.value)
                        }
                        placeholder="@sophia_and_liam_2"
                        className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Address{' '}
                      <span className="text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>

                    <input
                      type="text"
                      value={newClientAddress}
                      onChange={e =>
                        setNewClientAddress(e.target.value)
                      }
                      placeholder="San Francisco, CA"
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Notes{' '}
                      <span className="text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>

                    <textarea
                      value={newClientNotes}
                      onChange={e =>
                        setNewClientNotes(e.target.value)
                      }
                      rows={2}
                      placeholder="Special preferences, client notes..."
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      disabled={isSubmittingClient}
                      onClick={() => setShowAddClientModal(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingClient}
                      className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isSubmittingClient
                        ? 'Saving...'
                        : 'Save & Select Client'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};