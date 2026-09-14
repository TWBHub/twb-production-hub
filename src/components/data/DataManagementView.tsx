import React, { useState } from 'react';
import {
  HardDrive,
  Search,
  Filter,
  Plus,
  ExternalLink,
  ShieldCheck,
  FolderKanban,
  CheckCircle2,
  Clock,
  Archive,
  Database,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DataCategory, ProjectDataStatus } from '../../types';

export const DataManagementView: React.FC = () => {
  const {
    filteredProjectData,
    filteredProjects,
    createProjectData,
    currentUser,
    setSelectedProjectId,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Record Form
  const [projId, setProjId] = useState(filteredProjects[0]?.id || '');
  const [category, setCategory] = useState<DataCategory>('Raw Footage');
  const [location, setLocation] = useState('');
  const [folderLink, setFolderLink] = useState('');
  const [description, setDescription] = useState('');
  const [respPerson, setRespPerson] = useState(currentUser.full_name);
  const [status, setStatus] = useState<ProjectDataStatus>('Received');

  const filtered = filteredProjectData.filter(item => {
    const project = filteredProjects.find(p => p.id === item.project_id);
    const matchesSearch =
      item.storage_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project && project.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = filteredProjects.find(p => p.id === projId);
    if (!proj) return;

    await createProjectData({
      project_id: proj.id,
      company_id: proj.company_id,
      category,
      storage_location: location || 'External Storage',
      folder_link: folderLink,
      description,
      status,
      responsible_person: respPerson,
      date_recorded: new Date().toISOString().split('T')[0],
    });

    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Footage Ingestion & Media Data Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Physical SSD vaults, Synology NAS volumes, cloud drives, and backup integrity.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Log Media Storage Record</span>
        </button>
      </div>

      {/* Architectural Notice: Strict zero-blob metadata storage */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Zero-Blob Storage Architecture Policy:</span>
          <p className="text-blue-800/90 text-[11px] leading-relaxed">
            In compliance with TWBHub infrastructure standards, no multi-gigabyte video or RAW photo files are stored directly in PostgreSQL. Only hardware vault labels, folder links (Google Drive, Dropbox, Frame.io), and card checksum records are managed here.
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search drives, wedding name, vault serials..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Media Categories</option>
            <option value="Raw Footage">Raw Footage</option>
            <option value="Photos">Photos</option>
            <option value="Audio">Audio</option>
            <option value="Project Files">Project Files</option>
            <option value="Client References">Client References</option>
            <option value="Music">Music</option>
            <option value="Documents">Documents</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Backup Statuses</option>
            <option value="Received">Received</option>
            <option value="Ingested">Ingested</option>
            <option value="Backed Up">Backed Up</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Wedding Project</th>
                <th className="p-3.5">Physical / Cloud Location</th>
                <th className="p-3.5">Description & Checksums</th>
                <th className="p-3.5">Date & DIT Officer</th>
                <th className="p-3.5">Folder Link</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => {
                const project = filteredProjects.find(p => p.id === item.project_id);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    <td className="p-3.5">
                      {project ? (
                        <button
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setActiveTab('projects');
                          }}
                          className="font-semibold text-blue-600 hover:text-blue-800 text-left"
                        >
                          {project.name}
                        </button>
                      ) : (
                        <span className="text-slate-400">Project</span>
                      )}
                    </td>

                    <td className="p-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.storage_location}</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-600 max-w-xs truncate">
                      {item.description}
                    </td>

                    <td className="p-3.5 text-slate-500">
                      <div>{item.date_recorded}</div>
                      <div className="text-[10px] text-slate-400">By: {item.responsible_person}</div>
                    </td>

                    <td className="p-3.5">
                      {item.folder_link ? (
                        <a
                          href={item.folder_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          Open Folder
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No cloud link</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.status === 'Backed Up'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.status === 'Ingested'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-500">
            No media storage records found matching criteria.
          </div>
        )}
      </div>

      {/* Log Media Storage Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <h2 className="text-base font-bold text-slate-900 mb-4">Log Footage & Asset Ingestion</h2>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Wedding Project</label>
                <select
                  value={projId}
                  onChange={e => setProjId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as DataCategory)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Raw Footage">Raw Footage</option>
                    <option value="Photos">Photos</option>
                    <option value="Audio">Audio</option>
                    <option value="Project Files">Project Files</option>
                    <option value="Client References">Client References</option>
                    <option value="Music">Music</option>
                    <option value="Documents">Documents</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ingestion Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as ProjectDataStatus)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Received">Received</option>
                    <option value="Ingested">Ingested</option>
                    <option value="Backed Up">Backed Up</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical / Hardware Storage Identifier</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. SanDisk Extreme Pro 4TB #03 • Synology NAS Vol 01"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cloud / Direct Folder URL</label>
                <input
                  type="url"
                  value={folderLink}
                  onChange={e => setFolderLink(e.target.value)}
                  placeholder="https://drive.google.com/... or dropbox.com"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Checksum Verification</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. 5x 128GB Sony Tough V90 cards offloaded via Silverstack. Checksum verified MD5."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">DIT / Responsible Person</label>
                <input
                  type="text"
                  required
                  value={respPerson}
                  onChange={e => setRespPerson(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  Save Ingestion Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
