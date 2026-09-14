import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navigation } from './components/layout/Navigation';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectsView } from './components/projects/ProjectsView';
import { EnquiriesView } from './components/enquiries/EnquiriesView';
import { ClientsView } from './components/clients/ClientsView';
import { CalendarView } from './components/calendar/CalendarView';
import { TeamAvailabilityView } from './components/team/TeamAvailabilityView';
import { FinanceView } from './components/finance/FinanceView';
import { DeliverablesView } from './components/deliverables/DeliverablesView';
import { DataManagementView } from './components/data/DataManagementView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { SettingsView } from './components/settings/SettingsView';

const AppContent: React.FC = () => {
  const { activeTab, currentUser, authLoading } = useApp();

  // 1. Loading Authentication state & persistent session
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white space-y-4 font-sans">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#F1D099]/20 border-t-[#F1D099] animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-white tracking-wide">TWBHub Studio Systems</h2>
          <p className="text-xs text-slate-400">Verifying Supabase authentication & session...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render dedicated Supabase Login View
  if (!currentUser) {
    return <LoginView />;
  }

  // 3. Authenticated: Render dashboard and navigation
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'projects':
        return <ProjectsView />;
      case 'enquiries':
        return <EnquiriesView />;
      case 'clients':
        return <ClientsView />;
      case 'calendar':
        return <CalendarView />;
      case 'team':
      case 'editors':
        return <TeamAvailabilityView />;
      case 'finance':
        return <FinanceView />;
      case 'deliverables':
        return <DeliverablesView />;
      case 'data':
        return <DataManagementView />;
      case 'notifications':
        return <NotificationsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <Navigation>
      {renderActiveView()}
    </Navigation>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
