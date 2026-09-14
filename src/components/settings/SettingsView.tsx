import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
  } = useApp();

  const [twbBrand, setTwbBrand] = useState(companies.find(c => c.id === 'twb') || companies[0]);
  const [gjBrand, setGjBrand] = useState(companies.find(c => c.id === 'golden_june') || companies[1]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveBrands = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twbBrand) await updateCompany(twbBrand);
    if (gjBrand) await updateCompany(gjBrand);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
                Custom invoice details, legal names, and contact credentials for TWB and Golden June
              </p>
            </div>
          </div>

          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Saved Successfully!
            </span>
          )}
        </div>

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
                <label className="block text-slate-600 font-semibold mb-1">Brand Name</label>
                <input
                  type="text"
                  value={twbBrand.name}
                  onChange={e => setTwbBrand({ ...twbBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={twbBrand.email}
                  onChange={e => setTwbBrand({ ...twbBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={twbBrand.phone}
                  onChange={e => setTwbBrand({ ...twbBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={twbBrand.address}
                  onChange={e => setTwbBrand({ ...twbBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
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
                <label className="block text-slate-600 font-semibold mb-1">Brand Name</label>
                <input
                  type="text"
                  value={gjBrand.name}
                  onChange={e => setGjBrand({ ...gjBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={gjBrand.email}
                  onChange={e => setGjBrand({ ...gjBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={gjBrand.phone}
                  onChange={e => setGjBrand({ ...gjBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={gjBrand.address}
                  onChange={e => setGjBrand({ ...gjBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors"
          >
            Update Brand Settings
          </button>
        </div>
      </form>
    </div>
  );
};
