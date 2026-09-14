import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  UserPlus,
  Users,
  Calendar as CalendarIcon,
  UserCheck,
  Film,
  DollarSign,
  HardDrive,
  CheckSquare,
  Bell,
  Settings as SettingsIcon,
  Layers,
  ChevronRight,
  Database,
  ShieldAlert,
  Menu,
  X,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandId, UserRole } from '../../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  roleRestricted?: boolean;
}

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (open: boolean) => void }> = ({
  mobileOpen,
  setMobileOpen,
}) => {
  const {
    activeTab,
    setActiveTab,
    unreadNotificationCount,
    canAccessSection,
    currentUser,
    deliverables,
    isEditorOnly,
  } = useApp();

  // Close drawer on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  const editorActiveDeliverables = deliverables.filter(
    d => d.status === 'In Progress' || d.status === 'Submitted'
  ).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'enquiries', label: 'Enquiries / Leads', icon: UserPlus },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'team-availability', label: 'Team Availability', icon: UserCheck },
    { id: 'editors', label: 'Editors & Workload', icon: Film },
    { id: 'finance', label: 'Finance', icon: DollarSign },
    { id: 'data', label: 'Project Data', icon: HardDrive },
    {
      id: 'deliverables',
      label: 'Deliverables',
      icon: CheckSquare,
      badge: isEditorOnly ? editorActiveDeliverables : undefined,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
    },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:relative lg:top-0 lg:bottom-auto lg:left-auto lg:h-screen lg:sticky lg:shrink-0 lg:z-20 lg:shadow-none ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F1D099] text-slate-950 flex items-center justify-center font-extrabold shadow-sm tracking-wider text-sm">
              TW
            </div>
            <div>
              <div className="font-semibold text-white tracking-tight text-base leading-none">
                TWB<span className="text-[#F1D099] font-bold">Hub</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                Production Operating System
              </div>
            </div>
          </div>
          <button
            id="btn-sidebar-close"
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Brand Indicator */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/60 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-[11px]">Brands Managed:</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-medium border border-blue-800/50">TWB</span>
            <span className="px-1.5 py-0.5 rounded bg-[#F1D099]/15 text-[#F1D099] font-medium border border-[#F1D099]/40">Golden June</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map(item => {
            const allowed = canAccessSection(item.id);
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            if (!allowed) {
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md text-xs text-slate-600 cursor-not-allowed opacity-50"
                  title="Restricted for your current role"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span>{item.label}</span>
                  </div>
                  <ShieldAlert className="w-3 h-3 text-slate-600" />
                </div>
              );
            }

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-blue-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      item.id === 'notifications'
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Authenticated Profile & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-[#F1D099] shrink-0">
                {(currentUser?.full_name || 'U')
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {currentUser?.full_name || 'Studio Member'}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] text-[#F1D099] font-medium truncate">
                    {currentUser?.role || 'Team Member'}
                  </span>
                </div>
              </div>
            </div>

            <button
              id="btn-sidebar-logout"
              type="button"
              onClick={useApp().logout}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0 ml-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export const Header: React.FC<{ onOpenMobile?: () => void; onMobileMenuToggle?: () => void }> = ({
  onOpenMobile,
  onMobileMenuToggle,
}) => {
  const {
    brandFilter,
    setBrandFilter,
    currentUser,
    logout,
    supabaseStatus,
    activeTab,
    setActiveTab,
    unreadNotificationCount,
  } = useApp();

  const handleToggle = onOpenMobile || onMobileMenuToggle || (() => {});

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left section: mobile toggle + Brand filter */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          id="btn-mobile-menu-toggle"
          type="button"
          onClick={handleToggle}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand/Company Switcher Pill */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            id="brand-filter-all"
            onClick={() => setBrandFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              brandFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Brands
          </button>
          <button
            id="brand-filter-twb"
            onClick={() => setBrandFilter('twb')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              brandFilter === 'twb'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            TWB
          </button>
          <button
            id="brand-filter-golden-june"
            onClick={() => setBrandFilter('golden_june')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              brandFilter === 'golden_june'
                ? 'bg-[#2b2011] text-[#F1D099] border border-[#F1D099]/30 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#F1D099]"></span>
            Golden June
          </button>
        </div>
      </div>

      {/* Right section: Supabase status, Profile Chip, Notifications, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Supabase Status Pill */}
        <button
          id="btn-supabase-status"
          onClick={() => setActiveTab('settings')}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
            supabaseStatus.connected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-[#F1D099]/20 text-[#5e430c] border-[#F1D099]/50 hover:bg-[#F1D099]/30'
          }`}
          title={supabaseStatus.message}
        >
          <Database className="w-3.5 h-3.5" />
          <span>
            {supabaseStatus.connected ? 'Supabase Live' : 'Supabase Ready'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              supabaseStatus.connected ? 'bg-emerald-500' : 'bg-[#F1D099]'
            }`}
          />
        </button>

        {/* User Profile display with Verified Role */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px] sm:max-w-none">
              {currentUser?.full_name || 'Studio Member'}
            </span>
            <span className="text-[10px] text-[#8c672b] font-medium leading-tight">
              {currentUser?.role || 'Team Member'}
            </span>
          </div>
        </div>

        {/* Notification Bell */}
        <button
          id="btn-notifications-header"
          onClick={() => setActiveTab('notifications')}
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Sign Out Action Button */}
        <button
          id="btn-logout-header"
          type="button"
          onClick={logout}
          title="Sign out of TWBHub"
          className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export const Navigation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMobileMenuToggle={() => setMobileOpen(true)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

