import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Building2,
  ShieldCheck,
  User,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Sparkles,
  Lock,
  Layers,
  FileCode,
  AlertCircle,
  Globe,
  Tag,
  Plus,
  Trash2,
  Briefcase,
  Check,
  AlertTriangle,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INITIAL_COMPANIES } from '../../services/seedData';
import { Company, ServiceCatalogueItem } from '../../types';
import { resolveCompany, prepareCompanyForUpdate, sanitizeCompany } from '../../utils/companyUtils';

export const SettingsView: React.FC = () => {
  const {
    companies,
    updateCompany,
    currentUser,
    switchUserRole,
    projects,
    payments,
    expenses,
    deliverables,
    teamMembers,
    editors,
    enquiries,
    projectData,
    calendarEvents,
    notifications,
    services,
    createService,
    updateService,
    deleteService,
  } = useApp();

  const [twbBrand, setTwbBrand] = useState<Company>(
    () => resolveCompany(companies, 'twb', INITIAL_COMPANIES[0]) || sanitizeCompany(INITIAL_COMPANIES[0], 'twb')
  );
  const [gjBrand, setGjBrand] = useState<Company>(
    () => resolveCompany(companies, 'golden_june', INITIAL_COMPANIES[1]) || sanitizeCompany(INITIAL_COMPANIES[1], 'golden_june')
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Service Catalogue state
  const [serviceBrandFilter, setServiceBrandFilter] = useState<'all' | 'twb' | 'golden_june'>('all');
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<'Cinematography' | 'Photography' | 'Specialty' | 'Add-on'>('Cinematography');
  const [newServiceBrand, setNewServiceBrand] = useState<'all' | 'twb' | 'golden_june'>('all');
  const [serviceActionSuccess, setServiceActionSuccess] = useState('');
  const [serviceToDelete, setServiceToDelete] = useState<ServiceCatalogueItem | null>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);

  // Helper to identify leads that reference a specific catalogue service name
  const getReferencingLeadsForService = (serviceName?: string) => {
    if (!serviceName) return [];
    const target = serviceName.trim().toLowerCase();
    return enquiries.filter(
      e => e.services && Array.isArray(e.services) && e.services.some(s => (s || '').trim().toLowerCase() === target)
    );
  };

  // Synchronize when companies finish loading from backend or cache
  useEffect(() => {
    if (companies && companies.length > 0) {
      const foundTwb = resolveCompany(companies, 'twb', INITIAL_COMPANIES[0]);
      if (foundTwb) setTwbBrand(foundTwb);
      const foundGj = resolveCompany(companies, 'golden_june', INITIAL_COMPANIES[1]);
      if (foundGj) setGjBrand(foundGj);
    }
  }, [companies]);

  const handleSaveBrands = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      if (twbBrand) {
        const payload = prepareCompanyForUpdate(twbBrand, companies);
        await updateCompany(payload);
      }
      if (gjBrand) {
        const payload = prepareCompanyForUpdate(gjBrand, companies);
        await updateCompany(payload);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving brand settings:', err);
      setSaveError(err.message || 'Failed to update brand settings in database.');
    } finally {
      setIsSaving(false);
    }
  };

  const tables = [
    { name: 'companies', records: companies.length, desc: 'Two luxury brand identities' },
    { name: 'clients', records: 5, desc: 'Couples and client records' },
    { name: 'enquiries', records: enquiries.length, desc: 'Wedding lead pipeline' },
    { name: 'profiles', records: 4, desc: 'System users and access levels' },
    { name: 'team_members', records: teamMembers.length, desc: 'Cinematographers, photographers, DIT' },
    { name: 'projects', records: projects.length, desc: 'Active wedding productions' },
    { name: 'project_team', records: 6, desc: 'Crew assignments and role dates' },
    { name: 'project_data', records: projectData.length, desc: 'Footage, SSD & cloud link metadata' },
    { name: 'deliverables', records: deliverables.length, desc: 'Films, galleries, albums & statuses' },
    { name: 'payments', records: payments.length, desc: 'Client receipts and cleared funds' },
    { name: 'expenses', records: expenses.length, desc: 'Crew fees, travel, gear rentals' },
    { name: 'calendar_events', records: calendarEvents.length, desc: 'Master operational schedule' },
    { name: 'notifications', records: notifications.length, desc: 'Conflict and milestone alerts' },
    { name: 'service_catalogue', records: services.length, desc: 'Shared studio service offerings' },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          System Settings & Database Architecture
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Supabase PostgreSQL integration, brand profiles, and role management.
        </p>
      </div>

      {/* Supabase Schema Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Supabase PostgreSQL Backend Schema (13 Tables)
              </h2>
              <span className="text-xs text-slate-500">
                Connected via Supabase JS Client with intelligent fallback storage
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200 self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span>Ready & Synchronized</span>
          </div>
        </div>

        {/* 13 Tables Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {tables.map(tbl => (
            <div
              key={tbl.name}
              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-mono font-bold text-slate-900">{tbl.name}</div>
                <div className="text-[10px] text-slate-400">{tbl.desc}</div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-slate-700 text-[11px]">
                {tbl.records} rows
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Profiles Editor */}
      <form onSubmit={handleSaveBrands} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Two-Brand Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Custom invoice details, legal names, and contact credentials for The Wedding Booth and Golden June Films
              </p>
            </div>
          </div>

          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Saved Successfully!
            </span>
          )}
        </div>

        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <span className="font-semibold">Update Failed: </span>
              <span>{saveError}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand 1: TWB */}
          {twbBrand && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-sm">{twbBrand.name}</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase text-[10px]">
                  {twbBrand.code}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Brand / Display Name</label>
                <input
                  type="text"
                  value={twbBrand.name}
                  onChange={e => setTwbBrand({ ...twbBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="The Wedding Booth"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={twbBrand.tagline || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, tagline: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Wedding Photography & Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={twbBrand.email}
                  onChange={e => setTwbBrand({ ...twbBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="dweddingbooth@gmail.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={twbBrand.phone}
                  onChange={e => setTwbBrand({ ...twbBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="+91 9074448850"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={twbBrand.website || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, website: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="www.theweddingbooth.in"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={twbBrand.address || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Leave blank until supplied"
                />
              </div>
            </div>
          )}

          {/* Brand 2: Golden June */}
          {gjBrand && (
            <div className="p-4 rounded-xl border border-[#F1D099]/60 bg-[#F1D099]/10 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{gjBrand.name}</span>
                <span className="px-2 py-0.5 rounded bg-[#F1D099]/30 text-[#5e430c] border border-[#F1D099]/50 font-bold uppercase text-[10px]">
                  {gjBrand.code}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Brand / Display Name</label>
                <input
                  type="text"
                  value={gjBrand.name}
                  onChange={e => setGjBrand({ ...gjBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Golden June Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={gjBrand.tagline || ''}
                  onChange={e => setGjBrand({ ...gjBrand, tagline: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Wedding Photography & Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={gjBrand.email}
                  onChange={e => setGjBrand({ ...gjBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="goldenjunefilms@gmail.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={gjBrand.phone}
                  onChange={e => setGjBrand({ ...gjBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="+91 9074963370"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={gjBrand.website || ''}
                  onChange={e => setGjBrand({ ...gjBrand, website: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="www.goldenjunefilms.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={gjBrand.address || ''}
                  onChange={e => setGjBrand({ ...gjBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Leave blank until supplied"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSaving ? 'Updating...' : 'Update Brand Settings'}</span>
          </button>
        </div>
      </form>

      {/* Shared Service Catalogue Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Shared Service Catalogue
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  {services.length} Services
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard services offered across The Wedding Booth & Golden June Films for Lead Enquiries and Proposals
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingService(!isAddingService)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingService ? 'Cancel' : 'Add Service'}</span>
          </button>
        </div>

        {/* Domain Distinction Callout */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong className="text-slate-800">Architectural Distinction: </strong>
            <strong>Services</strong> represent what the studio sells and quotes to clients in leads and proposals.
            They remain completely separate from <strong>Deliverables</strong> (what clients receive) and <strong>Crew Roles</strong> (what team members do). Selecting a service does not automatically generate deliverables or assign crew.
          </div>
        </div>

        {serviceActionSuccess && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{serviceActionSuccess}</span>
          </div>
        )}

        {/* Add Service Inline Form */}
        {isAddingService && (
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (!newServiceName.trim()) return;
              try {
                await createService({
                  name: newServiceName.trim(),
                  description: newServiceDesc.trim() || undefined,
                  category: newServiceCategory,
                  applicable_brand: newServiceBrand,
                  is_active: true,
                });
                setNewServiceName('');
                setNewServiceDesc('');
                setIsAddingService(false);
                setServiceActionSuccess('Service added to catalogue successfully.');
                setTimeout(() => setServiceActionSuccess(''), 3000);
              } catch (err: any) {
                console.error('Failed to create service:', err);
              }
            }}
            className="p-4 bg-purple-50/30 rounded-xl border border-purple-200 space-y-3 text-xs"
          >
            <h3 className="font-bold text-slate-900 text-xs">Add New Catalogue Service</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  value={newServiceName}
                  onChange={e => setNewServiceName(e.target.value)}
                  placeholder="e.g. Sangeet Special Edit, Analog 35mm Stills..."
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newServiceCategory}
                  onChange={e => setNewServiceCategory(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Cinematography">Cinematography</option>
                  <option value="Photography">Photography</option>
                  <option value="Specialty">Specialty</option>
                  <option value="Add-on">Add-on</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Description / Scope Details</label>
                <input
                  type="text"
                  value={newServiceDesc}
                  onChange={e => setNewServiceDesc(e.target.value)}
                  placeholder="Brief description for proposals and lead planning..."
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Applicable Brand</label>
                <select
                  value={newServiceBrand}
                  onChange={e => setNewServiceBrand(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="all">All Brands (TWB & Golden June)</option>
                  <option value="twb">The Wedding Booth Only</option>
                  <option value="golden_june">Golden June Films Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingService(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-xs"
              >
                Save to Catalogue
              </button>
            </div>
          </form>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs font-medium pt-1">
          <span className="text-slate-400 text-[11px] mr-1">Brand filter:</span>
          {(['all', 'twb', 'golden_june'] as const).map(b => (
            <button
              key={b}
              type="button"
              onClick={() => setServiceBrandFilter(b)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                serviceBrandFilter === b
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b === 'all' ? 'All Brands' : b === 'twb' ? 'The Wedding Booth' : 'Golden June Films'}
            </button>
          ))}
        </div>

        {/* Services List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {services
            .filter(s => serviceBrandFilter === 'all' || s.applicable_brand === 'all' || s.applicable_brand === serviceBrandFilter)
            .map(service => {
              const brandBadge =
                service.applicable_brand === 'twb'
                  ? 'TWB Only'
                  : service.applicable_brand === 'golden_june'
                  ? 'Golden June Only'
                  : 'All Brands';

              return (
                <div
                  key={service.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 ${
                    service.is_active
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs">{service.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {service.category || 'Service'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            service.applicable_brand === 'twb'
                              ? 'bg-blue-100 text-blue-800'
                              : service.applicable_brand === 'golden_june'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {brandBadge}
                        </span>
                      </div>
                    </div>
                    {service.description && (
                      <p className="text-[11px] text-slate-500 leading-normal">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateService({ ...service, is_active: !service.is_active });
                        setServiceActionSuccess(`Service "${service.name}" marked as ${!service.is_active ? 'Active' : 'Deactivated'}.`);
                        setTimeout(() => setServiceActionSuccess(''), 3000);
                      }}
                      className={`font-semibold cursor-pointer ${
                        service.is_active ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {service.is_active ? '● Active in leads' : '○ Deactivated'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiceToDelete(service)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Service Deletion & In-Use Safeguard Modal */}
      {serviceToDelete && (() => {
        const referencingLeads = getReferencingLeadsForService(serviceToDelete.name);
        const isInUse = referencingLeads.length > 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150">
              {isInUse ? (
                /* Case A: Service is referenced by existing leads (Destructive deletion prevented) */
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          Cannot Delete Service in Use
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Referenced by existing lead records
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setServiceToDelete(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Service Badge Summary */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-900">{serviceToDelete.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">{serviceToDelete.category || 'Service'}</span>
                      <span>•</span>
                      <span>
                        {serviceToDelete.applicable_brand === 'twb'
                          ? 'The Wedding Booth'
                          : serviceToDelete.applicable_brand === 'golden_june'
                          ? 'Golden June Films'
                          : 'All Brands'}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                    <p>
                      <strong className="text-slate-900">&ldquo;{serviceToDelete.name}&rdquo;</strong> is currently referenced by{' '}
                      <strong className="text-amber-800">{referencingLeads.length} existing lead{referencingLeads.length > 1 ? 's' : ''}</strong>:
                    </p>

                    {/* Referencing Leads List */}
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                      {referencingLeads.slice(0, 5).map(lead => (
                        <div key={lead.id} className="py-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800 truncate">
                            {lead.title || lead.client_name || 'Untitled Lead'}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 shrink-0">
                            {lead.status}
                          </span>
                        </div>
                      ))}
                      {referencingLeads.length > 5 && (
                        <div className="pt-1 text-center text-[10px] text-slate-400 italic">
                          + {referencingLeads.length - 5} more lead(s)
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        To safeguard customer proposals, commercial audits, and historical client records, services associated with existing leads cannot be permanently deleted.
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      You can <strong>deactivate</strong> this service instead. Deactivated services will no longer appear when creating or editing future leads, while all existing leads safely retain their original service names.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setServiceToDelete(null)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Close / Keep As Is
                    </button>
                    {serviceToDelete.is_active ? (
                      <button
                        type="button"
                        disabled={isDeletingService}
                        onClick={async () => {
                          try {
                            setIsDeletingService(true);
                            await updateService({ ...serviceToDelete, is_active: false });
                            setServiceActionSuccess(`Service "${serviceToDelete.name}" deactivated. Historical lead references remain preserved.`);
                            setServiceToDelete(null);
                            setTimeout(() => setServiceActionSuccess(''), 4000);
                          } catch (err: any) {
                            console.error('Failed to deactivate service:', err);
                          } finally {
                            setIsDeletingService(false);
                          }
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingService ? 'Deactivating...' : 'Deactivate Service Instead'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Already Deactivated</span>
                    )}
                  </div>
                </div>
              ) : (
                /* Case B: Unused Service (Permanently Deletable) */
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          Permanently Delete Service?
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Remove from Shared Service Catalogue
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setServiceToDelete(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-900">{serviceToDelete.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">{serviceToDelete.category || 'Service'}</span>
                      <span>•</span>
                      <span>
                        {serviceToDelete.applicable_brand === 'twb'
                          ? 'The Wedding Booth'
                          : serviceToDelete.applicable_brand === 'golden_june'
                          ? 'Golden June Films'
                          : 'All Brands'}
                      </span>
                    </div>
                    {serviceToDelete.description && (
                      <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 mt-1">
                        {serviceToDelete.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                    <p>
                      This service is <strong>not referenced by any leads</strong>. It will be permanently removed from the studio catalogue.
                    </p>
                    <p className="text-[11px] text-red-600 font-medium">
                      This action is permanent and cannot be undone.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isDeletingService}
                      onClick={() => setServiceToDelete(null)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingService}
                      onClick={async () => {
                        try {
                          setIsDeletingService(true);
                          const name = serviceToDelete.name;
                          await deleteService(serviceToDelete.id);
                          setServiceActionSuccess(`Service "${name}" was permanently removed from the catalogue.`);
                          setServiceToDelete(null);
                          setTimeout(() => setServiceActionSuccess(''), 4000);
                        } catch (err: any) {
                          console.error('Failed to delete service:', err);
                        } finally {
                          setIsDeletingService(false);
                        }
                      }}
                      className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingService ? 'Deleting...' : 'Delete Permanently'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
