import React, { useState } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  Calendar,
  ExternalLink,
  Film,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  FolderKanban,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  DeliverablePriority,
} from '../../types';

export const DeliverablesView: React.FC = () => {
  const {
    filteredDeliverables,
    filteredProjects,
    editors,
    createDeliverable,
    updateDeliverableStatus,
    setSelectedProjectId,
    setActiveTab,
    brandFilter,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Deliverable Form State
  const [projectId, setProjectId] = useState(filteredProjects[0]?.id || '');
  const [delType, setDelType] = useState<DeliverableType>('Highlight Film (4-5 mins)');
  const [editorId, setEditorId] = useState(editors[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<DeliverablePriority>('High');
  const [link, setLink] = useState('');
  const [feedback, setFeedback] = useState('');

  const filtered = filteredDeliverables.filter(del => {
    const project = filteredProjects.find(p => p.id === del.project_id);
    const editor = editors.find(e => e.id === del.assigned_editor_id);

    const matchesSearch =
      del.deliverable_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project && project.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (editor && editor.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || del.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || del.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityBadge = (p: DeliverablePriority) => {
    switch (p) {
      case 'Urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'High':
        return 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/50';
      case 'Medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusBadge = (s: DeliverableStatus) => {
    switch (s) {
      case 'Delivered':
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Changes Requested':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Submitted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = filteredProjects.find(p => p.id === projectId);
    if (!proj) return;

    await createDeliverable({
      project_id: proj.id,
      company_id: proj.company_id,
      deliverable_type: delType,
      assigned_editor_id: editorId,
      due_date: dueDate || proj.wedding_date_start,
      status: 'Assigned',
      priority,
      external_link: link,
      client_feedback: feedback,
    });

    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Post-Production Deliverables Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Films, teasers, galleries, albums, review rounds, and delivery links.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Deliverable</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, wedding name, or editor..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Workflow Stages</option>
            <option value="Not Started">Not Started</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Submitted">Submitted</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Approved">Approved</option>
            <option value="Delivered">Delivered</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Deliverables List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Deliverable</th>
                <th className="p-3.5">Wedding Project</th>
                <th className="p-3.5">Assigned Editor</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5">Review / Delivery Link</th>
                <th className="p-3.5">Workflow Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(del => {
                const project = filteredProjects.find(p => p.id === del.project_id);
                const editor = editors.find(e => e.id === del.assigned_editor_id);
                const isTWB = del.company_id === 'twb';

                return (
                  <tr key={del.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{del.deliverable_type}</div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isTWB ? 'bg-blue-100 text-blue-800' : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
                        }`}
                      >
                        {isTWB ? 'TWB' : 'Golden June'}
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
                        <span className="text-slate-400">Wedding Project</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">
                        {editor?.name || 'Unassigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">{editor?.specialization}</div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(
                          del.priority
                        )}`}
                      >
                        {del.priority}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-medium text-slate-700">{del.due_date}</span>
                    </td>

                    <td className="p-3.5">
                      {del.external_link ? (
                        <a
                          href={del.external_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          Review URL
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No link yet</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <select
                        value={del.status}
                        onChange={e => updateDeliverableStatus(del.id, e.target.value as DeliverableStatus)}
                        className={`text-xs font-semibold rounded-lg px-2 py-1 border cursor-pointer ${getStatusBadge(
                          del.status
                        )}`}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Changes Requested">Changes Requested</option>
                        <option value="Approved">Approved</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-500">
            No deliverables found matching criteria.
          </div>
        )}
      </div>

      {/* Create Deliverable Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <h2 className="text-base font-bold text-slate-900 mb-4">Commission Post-Production Deliverable</h2>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Wedding Project</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.company_id.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deliverable Asset Type</label>
                <select
                  value={delType}
                  onChange={e => setDelType(e.target.value as DeliverableType)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="Highlight Film (4-5 mins)">Highlight Film (4-5 mins)</option>
                  <option value="Teaser / Reel (60s)">Teaser / Reel (60s)</option>
                  <option value="Feature Film (20-30 mins)">Feature Film (20-30 mins)</option>
                  <option value="Full Ceremony Edit">Full Ceremony Edit</option>
                  <option value="Speeches & Toasts">Speeches & Toasts</option>
                  <option value="Full Photo Gallery (800+)">Full Photo Gallery (800+)</option>
                  <option value="Fine Art Wedding Album">Fine Art Wedding Album</option>
                  <option value="Parent Albums">Parent Albums</option>
                  <option value="Drone Compilation">Drone Compilation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign Editor</label>
                  <select
                    value={editorId}
                    onChange={e => setEditorId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    {editors.map(ed => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name} ({ed.specialization})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as DeliverablePriority)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Frame.io / Cloud Review Link</label>
                <input
                  type="url"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://frame.io/... or vimeo.com/..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Editing Notes / Creative Direction</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="e.g. Color grade in 35mm film warm palette, include vows audio..."
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
                  Create Deliverable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
