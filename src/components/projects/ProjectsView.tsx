import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Download,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project, ProjectStatus } from '../../types';
import { ProjectDetailWorkspace } from './ProjectDetailWorkspace';
import { generateOrderFormPDF } from '../../utils/pdfGenerator';

export const ProjectsView: React.FC = () => {
  const {
    filteredProjects,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    clients,
    companies,
    brandFilter,
    canCreateProject,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Project Form State
  const [newCompanyId, setNewCompanyId] = useState<'twb' | 'golden_june'>(
    brandFilter === 'golden_june' ? 'golden_june' : 'twb'
  );
  const [newClientId, setNewClientId] = useState(clients[0]?.id || '');
  const [newWeddingName, setNewWeddingName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPackage, setNewPackage] = useState('The Sovereign Cinema & Stills Collection');
  const [newPackageDetails, setNewPackageDetails] = useState('Full day coverage, 3x cinematographers, 2x photographers, drone coverage, 4K highlight film.');
  const [newBookingAmount, setNewBookingAmount] = useState(5000);
  const [newTotalAmount, setNewTotalAmount] = useState(14000);
  const [newNotes, setNewNotes] = useState('');

  const filtered = filteredProjects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeddingName || !newStartDate) return;

    const created = await createProject({
      company_id: newCompanyId,
      client_id: newClientId,
      name: newWeddingName,
      wedding_date_start: newStartDate,
      wedding_date_end: newEndDate || newStartDate,
      venue: newVenue || 'Private Estate',
      city: newCity || 'San Francisco, CA',
      client_contact: {
        phone: newPhone || '+1 (415) 555-0199',
        email: newEmail || 'client@wedding.com',
      },
      status: 'Booked',
      package_name: newPackage,
      package_details: newPackageDetails,
      booking_amount: newBookingAmount,
      total_amount: newTotalAmount,
      notes: newNotes,
    });

    setShowCreateModal(false);
    setSelectedProjectId(created.id);
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
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Wedding Project</span>
          </button>
        )}
      </div>

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
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 w-full md:w-auto"
          >
            <option value="all">All Production Stages</option>
            <option value="Booked">Booked</option>
            <option value="Pre-Production">Pre-Production</option>
            <option value="Shooting">Shooting</option>
            <option value="Editing">Editing</option>
            <option value="Review">Review</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Projects Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(project => {
          const isTWB = project.company_id === 'twb';
          const company = companies.find(c => c.id === project.company_id) || companies[0];
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
                  <span
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusBadge(
                      project.status
                    )}`}
                  >
                    {project.status}
                  </span>
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
                    ${project.total_amount.toLocaleString()}
                  </span>
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
                  onClick={() => {
                    const doc = generateOrderFormPDF(project, client, company);
                    doc.save(`Order_${company.code}_${project.id}.pdf`);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                  title="Download printable Order Form PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Order PDF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No projects found matching criteria.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing filters or search query.</p>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 my-8">
            <h2 className="text-base font-bold text-slate-900 mb-4">Book New Wedding Project</h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <select
                    value={newCompanyId}
                    onChange={e => setNewCompanyId(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="twb">TWB (The Wedding Book)</option>
                    <option value="golden_june">Golden June Studios</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Client Profile</label>
                  <select
                    value={newClientId}
                    onChange={e => {
                      setNewClientId(e.target.value);
                      const match = clients.find(c => c.id === e.target.value);
                      if (match) {
                        setNewWeddingName(`${match.name}${match.partner_name ? ` & ${match.partner_name}` : ''}`);
                        setNewPhone(match.phone);
                        setNewEmail(match.email);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.partner_name ? `& ${c.partner_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project / Wedding Title</label>
                <input
                  type="text"
                  required
                  value={newWeddingName}
                  onChange={e => setNewWeddingName(e.target.value)}
                  placeholder="e.g. Olivia & Marcus • Alderbrook Estate"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wedding Date Start</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wedding Date End</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Venue</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">City / Region</label>
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
                <label className="block font-semibold text-slate-700 mb-1">Commissioned Package</label>
                <input
                  type="text"
                  required
                  value={newPackage}
                  onChange={e => setNewPackage(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Package Scope & Deliverables</label>
                <textarea
                  value={newPackageDetails}
                  onChange={e => setNewPackageDetails(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Booking Retainer ($)</label>
                  <input
                    type="number"
                    value={newBookingAmount}
                    onChange={e => setNewBookingAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Agreed Fee ($)</label>
                  <input
                    type="number"
                    value={newTotalAmount}
                    onChange={e => setNewTotalAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  Create & Open Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
