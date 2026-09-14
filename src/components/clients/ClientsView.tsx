import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FolderKanban,
  FileText,
  Clock,
  ExternalLink,
  Edit2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';

export const ClientsView: React.FC = () => {
  const {
    filteredClients,
    createClient,
    updateClient,
    projects,
    payments,
    enquiries,
    setSelectedProjectId,
    setActiveTab,
    brandFilter,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [companyId, setCompanyId] = useState<'twb' | 'golden_june'>(
    brandFilter === 'golden_june' ? 'golden_june' : 'twb'
  );
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = filteredClients.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.partner_name && c.partner_name.toLowerCase().includes(query)) ||
      c.email.toLowerCase().includes(query)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    await createClient({
      company_id: companyId,
      name,
      partner_name: partnerName,
      email,
      phone,
      address,
      instagram,
      notes,
    });

    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Client Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Profiles, wedding histories, payment receipts, and communications.
          </p>
        </div>

        <button
          onClick={() => {
            setName('');
            setPartnerName('');
            setEmail('');
            setPhone('');
            setAddress('');
            setInstagram('');
            setNotes('');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search client by name, partner, or email..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(client => {
          const clientProjects = projects.filter(p => p.client_id === client.id);
          const clientPayments = payments.filter(p => clientProjects.some(cp => cp.id === p.project_id));
          const totalPaid = clientPayments.reduce((s, p) => s + p.amount, 0);

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      client.company_id === 'twb' ? 'bg-blue-100 text-blue-800' : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
                    }`}
                  >
                    {client.company_id === 'twb' ? 'TWB' : 'Golden June'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {clientProjects.length} Projects
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {client.name} {client.partner_name ? `& ${client.partner_name}` : ''}
                  </h3>
                  {client.instagram && (
                    <div className="text-xs text-blue-600 font-medium mt-0.5">{client.instagram}</div>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.phone}</span>
                  </div>
                </div>

                {client.notes && (
                  <p className="text-xs text-slate-500 italic line-clamp-2">"{client.notes}"</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-700">
                    ${totalPaid.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">Total Billed Paid</div>
                </div>

                <button
                  onClick={() => setSelectedClient(client)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
          No clients found matching criteria.
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 my-8 space-y-5">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedClient.name} {selectedClient.partner_name ? `& ${selectedClient.partner_name}` : ''}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedClient.email} • {selectedClient.phone}
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Projects for this client */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Associated Wedding Projects
              </h3>
              <div className="space-y-2">
                {projects
                  .filter(p => p.client_id === selectedClient.id)
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setActiveTab('projects');
                        setSelectedClient(null);
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.wedding_date_start} • {p.venue}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">${p.total_amount.toLocaleString()}</div>
                        <span className="text-[10px] text-blue-600 font-semibold">Open Project →</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Add New Couple / Client</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <select
                    value={companyId}
                    onChange={e => setCompanyId(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="twb">TWB (The Wedding Book)</option>
                    <option value="golden_june">Golden June Studios</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    placeholder="@sophia_and_liam"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sophia Sterling"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Partner Name</label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    placeholder="e.g. Liam Harrington"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (415) 555-0199"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address / City</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="San Francisco, CA"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes & Client Relationship</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Referred by planner, photography preferences..."
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
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
