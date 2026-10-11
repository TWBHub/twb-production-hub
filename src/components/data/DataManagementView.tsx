import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Search,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ProjectData,
  StorageDropdownOption,
  StorageTypeOption,
  StorageStatusOption,
  ClientHddStatus,
  CLIENT_HDD_STATUS_OPTIONS,
  STORAGE_DROPDOWN_OPTIONS,
  STORAGE_TYPE_OPTIONS,
  STORAGE_STATUS_OPTIONS,
} from '../../types';
import { normalizeStorageRecord, getStorageStatusBadge } from '../../utils/storageUtils';

export const DataManagementView: React.FC = () => {
  const {
    filteredProjectData,
    filteredProjects,
    createProjectData,
    updateProjectData,
    deleteProjectData,
    updateProject,
    setSelectedProjectId,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [ordering, setOrdering] = useState<'recently_added' | 'name_asc'>('recently_added');

  // Modal State (Add / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectData | null>(null);
  const [formProjectId, setFormProjectId] = useState(filteredProjects[0]?.id || '');
  const [formStorage, setFormStorage] = useState<StorageDropdownOption>("Client's");
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<StorageTypeOption>('SSD');
  const [formLocation, setFormLocation] = useState('Office');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<StorageStatusOption>('Active');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<ProjectData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter and Group records by Wedding Project
  const projectGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // 1. Filter matching records
    const matchingRecords = filteredProjectData.filter(item => {
      const project = filteredProjects.find(p => p.id === item.project_id);
      const norm = normalizeStorageRecord(item);

      if (!query) return true;

      return (
        norm.storage.toLowerCase().includes(query) ||
        norm.name.toLowerCase().includes(query) ||
        norm.type.toLowerCase().includes(query) ||
        norm.location.toLowerCase().includes(query) ||
        norm.notes.toLowerCase().includes(query) ||
        norm.status.toLowerCase().includes(query) ||
        (project && project.name.toLowerCase().includes(query))
      );
    });

    // 2. Group by project_id
    const groupsMap = new Map<string, ProjectData[]>();
    matchingRecords.forEach(item => {
      const pid = item.project_id || 'unassigned-project';
      if (!groupsMap.has(pid)) {
        groupsMap.set(pid, []);
      }
      groupsMap.get(pid)!.push(item);
    });

    // 3. Assemble groups (Projects with no storage records do not appear)
    const groups: Array<{
      projectId: string;
      project: (typeof filteredProjects)[0] | null;
      projectName: string;
      companyId: 'twb' | 'golden_june';
      records: ProjectData[];
    }> = [];

    groupsMap.forEach((recordsList, pid) => {
      if (recordsList.length === 0) return;

      const project = filteredProjects.find(p => p.id === pid) || null;
      const projectName = project ? project.name : 'Unassigned Project';
      const companyId = project ? project.company_id : (recordsList[0]?.company_id || 'twb');

      // Sort stably within project group
      const sortedRecords = [...recordsList].sort((a, b) => a.id.localeCompare(b.id));

      groups.push({
        projectId: pid,
        project,
        projectName,
        companyId,
        records: sortedRecords,
      });
    });

    // 4. Sort project groups by Ordering
    return groups.sort((a, b) => {
      if (ordering === 'recently_added') {
        const dateA = a.project?.created_at || '';
        const dateB = b.project?.created_at || '';
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateA && dateB) {
          const diff = dateB.localeCompare(dateA);
          if (diff !== 0) return diff;
        }
        return a.projectName.localeCompare(b.projectName);
      }

      // Name A-Z
      return a.projectName.localeCompare(b.projectName);
    });
  }, [filteredProjectData, filteredProjects, searchQuery, ordering]);

  // Open Add modal
  const handleOpenAddModal = (defaultProjectId?: string) => {
    setEditingItem(null);
    setFormProjectId(defaultProjectId || filteredProjects[0]?.id || '');
    setFormStorage("Client's");
    setFormName('');
    setFormType('SSD');
    setFormLocation('Office');
    setFormNotes('');
    setFormStatus('Active');
    setSaveError(null);
    setShowModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (item: ProjectData) => {
    const norm = normalizeStorageRecord(item);
    setEditingItem(item);
    setFormProjectId(item.project_id);
    setFormStorage(norm.storage);
    setFormName(norm.name);
    setFormType(norm.type);
    setFormLocation(norm.location);
    setFormNotes(norm.notes);
    setFormStatus(norm.status);
    setSaveError(null);
    setShowModal(true);
  };

  // Save Storage Record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = filteredProjects.find(p => p.id === formProjectId);
    if (!proj) {
      setSaveError('Please select a valid wedding project.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      if (editingItem) {
        await updateProjectData({
          ...editingItem,
          project_id: proj.id,
          company_id: proj.company_id,
          storage: formStorage,
          name: formName.trim() || 'Storage Drive',
          type: formType,
          location: formLocation.trim() || 'Office',
          notes: formNotes.trim(),
          status: formStatus,
          category: formType,
          storage_location: formLocation.trim() || 'Office',
          description: formName.trim() || 'Storage Drive',
          folder_link: '',
          responsible_person: formStorage,
        });
      } else {
        await createProjectData({
          project_id: proj.id,
          company_id: proj.company_id,
          storage: formStorage,
          name: formName.trim() || 'Storage Drive',
          type: formType,
          location: formLocation.trim() || 'Office',
          notes: formNotes.trim(),
          status: formStatus,
          category: formType,
          storage_location: formLocation.trim() || 'Office',
          description: formName.trim() || 'Storage Drive',
          folder_link: '',
          responsible_person: formStorage,
          date_recorded: new Date().toISOString().split('T')[0],
        });
      }

      setShowModal(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to save storage record:', err);
      setSaveError(`Could not save storage record: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Storage Record
  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteProjectData(deletingItem.id);
      setDeletingItem(null);
    } catch (err) {
      console.error('Failed to delete storage record:', err);
      setDeleteError(`Could not delete record: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Project Data & External Storage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Physical SSDs, HDDs, tower drives, and backup media registry grouped by wedding project.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-storage-global"
          onClick={() => handleOpenAddModal()}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Storage Location</span>
        </button>
      </div>

      {/* Search & Ordering Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search storage, drive name, location, project..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Ordering Dropdown (Recently Added | Name A–Z) */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <label htmlFor="select-storage-ordering" className="text-xs font-semibold text-slate-600">
              Order:
            </label>
          </div>
          <select
            id="select-storage-ordering"
            value={ordering}
            onChange={e => setOrdering(e.target.value as 'recently_added' | 'name_asc')}
            className="text-xs bg-transparent border-0 font-medium text-slate-900 focus:outline-hidden cursor-pointer pr-1"
          >
            <option value="recently_added">Recently Added</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Grouped Lists by Wedding Project */}
      <div className="space-y-6">
        {projectGroups.map(group => {
          const isTWB = group.companyId === 'twb';

          return (
            <div
              key={group.projectId}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs relative"
            >
              {/* Project Heading */}
              <div className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
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
                    <h3 className="font-bold text-sm text-slate-900">{group.projectName}</h3>
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

                  {/* Drive count */}
                  <span className="text-[11px] text-slate-400 font-medium ml-1">
                    ({group.records.length} {group.records.length === 1 ? 'drive' : 'drives'})
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  {/* Client HDD/SSD status control */}
                  {group.project && (
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-2xs">
                      <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        Client HDD/SSD:
                      </span>
                      <select
                        id={`select-group-client-hdd-${group.projectId}`}
                        value={group.project.client_hdd_status || 'Not Received'}
                        onChange={async e => {
                          const newStatus = e.target.value as ClientHddStatus;
                          try {
                            await updateProject({
                              ...group.project!,
                              client_hdd_status: newStatus,
                            });
                          } catch (err) {
                            console.error('Failed to update Client HDD/SSD status:', err);
                          }
                        }}
                        className="text-xs font-medium text-slate-800 bg-transparent border-0 focus:outline-hidden cursor-pointer"
                      >
                        {CLIENT_HDD_STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Add Storage button for this specific project */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(group.projectId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Storage</span>
                  </button>
                </div>
              </div>

              {/* Table with EXACTLY 7 Columns:
                  1. Storage
                  2. Name
                  3. Type
                  4. Location
                  5. Notes
                  6. Status
                  7. Actions */}
              <div className="overflow-x-auto rounded-b-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Storage</th>
                      <th className="py-3 px-4 font-semibold">Name</th>
                      <th className="py-3 px-4 font-semibold">Type</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      <th className="py-3 px-4 font-semibold">Notes</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.records.map(item => {
                      const norm = normalizeStorageRecord(item);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* 1. Storage */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 bg-slate-100 border border-slate-200/90 rounded px-2 py-0.5 text-[11px] inline-block whitespace-nowrap">
                              {norm.storage}
                            </span>
                          </td>

                          {/* 2. Name */}
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {norm.name}
                          </td>

                          {/* 3. Type */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] inline-block">
                              {norm.type}
                            </span>
                          </td>

                          {/* 4. Location */}
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {norm.location}
                          </td>

                          {/* 5. Notes */}
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {norm.notes || '—'}
                          </td>

                          {/* 6. Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block ${getStorageStatusBadge(
                                norm.status
                              )}`}
                            >
                              {norm.status}
                            </span>
                          </td>

                          {/* 7. Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="Edit storage record"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingItem(item);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Delete storage record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Empty state when no records match */}
        {projectGroups.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
            <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-800 text-sm">No storage records found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No storage records matched "${searchQuery}".`
                  : 'No external physical storage drives logged yet.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Storage Drive</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Storage Location Modal */}
      {showModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {editingItem ? 'Edit Storage Location' : 'Add Storage Location'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingItem
                    ? 'Update physical storage drive details'
                    : 'Track SSDs, HDDs, or tower drives for a wedding project'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingItem(null);
                  setSaveError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              {/* Project Selection */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Wedding Project</label>
                <select
                  value={formProjectId}
                  onChange={e => setFormProjectId(e.target.value)}
                  disabled={Boolean(editingItem)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 1. Storage Dropdown */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Storage</label>
                <select
                  value={formStorage}
                  onChange={e => setFormStorage(e.target.value as StorageDropdownOption)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {STORAGE_DROPDOWN_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Name Plain Text Input */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Sandisk, EVM, 6TB Tower, Editor's"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 3. Type Dropdown */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Type</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as StorageTypeOption)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {STORAGE_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Location Plain Text Input */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="e.g. Office, Editor's Desk, Client, Home"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 5. Notes Plain Text Input */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Notes <span className="font-normal text-slate-400">(capacity, details)</span>
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. 1TB, 2TB, 6TB, Vault Bay 02"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 6. Status Dropdown */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as StorageStatusOption)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {STORAGE_STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                    setSaveError(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formName.trim() || !formLocation.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Storage Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Delete Storage Record</h4>
                <p className="text-xs text-slate-500">Permanently delete storage entry</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the storage record for{' '}
              <strong className="text-slate-900 font-semibold">
                {normalizeStorageRecord(deletingItem).name}
              </strong>{' '}
              ({normalizeStorageRecord(deletingItem).storage})? This will permanently delete this record from Supabase.
            </p>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-storage"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingItem(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-storage"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Removing...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
