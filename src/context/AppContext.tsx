import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  BrandId,
  UserRole,
  Company,
  Client,
  Enquiry,
  Profile,
  TeamMember,
  Editor,
  Project,
  ProjectTeamAssignment,
  ProjectData,
  Deliverable,
  Payment,
  Expense,
  CalendarEvent,
  AppNotification,
  DeliverableStatus,
} from '../types';
import { apiService } from '../services/api';
import { INITIAL_PROFILES } from '../services/seedData';
import {
  getSession,
  getUserProfile,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthStateChange,
  canAccessTab,
} from '../lib/auth';

interface AppContextType {
  // Brand & User State
  brandFilter: BrandId;
  setBrandFilter: (brand: BrandId) => void;
  currentUser: Profile | null;
  session: Session | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    options?: {
      fullName?: string;
      role?: UserRole;
      companyId?: 'twb' | 'golden_june' | 'both';
      phone?: string;
    }
  ) => Promise<{ success: boolean; error?: string; sessionEstablished?: boolean }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<Profile | null>;
  availableProfiles: Profile[];

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;

  // Supabase Connection
  supabaseStatus: { connected: boolean; message: string; checking: boolean };
  checkSupabase: () => Promise<void>;

  // Data Collections
  companies: Company[];
  clients: Client[];
  enquiries: Enquiry[];
  projects: Project[];
  teamMembers: TeamMember[];
  editors: Editor[];
  projectTeam: ProjectTeamAssignment[];
  projectData: ProjectData[];
  deliverables: Deliverable[];
  payments: Payment[];
  expenses: Expense[];
  calendarEvents: CalendarEvent[];
  notifications: AppNotification[];
  unreadNotificationCount: number;

  // Filtered views based on current Brand and User Role
  filteredProjects: Project[];
  filteredEnquiries: Enquiry[];
  filteredClients: Client[];
  filteredDeliverables: Deliverable[];
  filteredProjectData: ProjectData[];
  filteredCalendarEvents: CalendarEvent[];
  filteredPayments: Payment[];
  filteredExpenses: Expense[];

  // Operations
  refreshAllData: () => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'created_at'>) => Promise<Project>;
  updateProject: (project: Project) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  createEnquiry: (enquiry: Omit<Enquiry, 'id' | 'created_at'>) => Promise<Enquiry>;
  updateEnquiry: (enquiry: Enquiry) => Promise<Enquiry>;
  createClient: (client: Omit<Client, 'id' | 'created_at'>) => Promise<Client>;
  updateClient: (client: Client) => Promise<Client>;
  createTeamMember: (member: Omit<TeamMember, 'id'>) => Promise<TeamMember>;
updateTeamMember: (member: TeamMember) => Promise<TeamMember>;
deleteTeamMember: (id: string) => Promise<void>;
assignTeamMember: (
    assignment: Omit<ProjectTeamAssignment, 'id'>,
    adminOverride?: boolean
  ) => Promise<{ success: boolean; conflictError?: string }>;
  updateTeamAssignment: (
    assignmentId: string,
    assignment: {
      project_id?: string;
      team_member_id: string;
      role: string;
      assignment_date: string;
      notes?: string;
    }
  ) => Promise<{ success: boolean; error?: string; assignment?: ProjectTeamAssignment }>;
  removeTeamAssignment: (assignmentId: string) => Promise<void>;
  checkTeamConflict: (
    teamMemberId: string,
    date: string,
    excludeProjectId?: string,
    excludeAssignmentId?: string
  ) => Promise<{ hasConflict: boolean; conflictingProject?: Project; memberName?: string }>;
  createProjectData: (data: Omit<ProjectData, 'id'>) => Promise<ProjectData>;
  updateProjectData: (data: ProjectData) => Promise<ProjectData>;
  deleteProjectData: (id: string) => Promise<void>;
  createDeliverable: (deliverable: Omit<Deliverable, 'id' | 'last_updated'>) => Promise<Deliverable>;
  updateDeliverable: (deliverable: Deliverable) => Promise<Deliverable>;
  deleteDeliverable: (id: string) => Promise<void>;
  updateDeliverableStatus: (deliverableId: string, status: DeliverableStatus) => Promise<void>;
  createPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<Payment>;
  createExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<Expense>;
  updateExpense: (expense: Expense) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<Payment>;
  deletePayment: (id: string) => Promise<void>;
  createCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateCompany: (company: Company) => Promise<void>;

  // Role permissions helpers
  canAccessSection: (section: string) => boolean;
  canManageFinance: boolean;
  canManageTeam: boolean;
  canCreateProject: boolean;
  isEditorOnly: boolean;
  isAdmin: boolean;
  isManager: boolean;
  userRole: UserRole;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clean up any residual theme state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('twbhub_theme');
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const [brandFilter, setBrandFilter] = useState<BrandId>(() => {
    return (localStorage.getItem('twbhub_brand_filter') as BrandId) || 'all';
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Supabase Auth states (no hardcoded current user)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [availableProfiles] = useState<Profile[]>(INITIAL_PROFILES);

  const [supabaseStatus, setSupabaseStatus] = useState<{ connected: boolean; message: string; checking: boolean }>({
    connected: false,
    message: 'Checking Supabase connection...',
    checking: true,
  });

  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [projectTeam, setProjectTeam] = useState<ProjectTeamAssignment[]>([]);
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Persist brand filter
  const handleSetBrandFilter = (brand: BrandId) => {
    setBrandFilter(brand);
    localStorage.setItem('twbhub_brand_filter', brand);
  };

  // Check Supabase connection
  const checkSupabase = useCallback(async () => {
    setSupabaseStatus(prev => ({ ...prev, checking: true }));
    const res = await apiService.testConnection();
    setSupabaseStatus({
      connected: res.connected,
      message: res.message,
      checking: false,
    });
  }, []);

 // Fetch all collections
const refreshAllData = useCallback(async () => {
  try {
    const results = await Promise.allSettled([
      apiService.getCompanies(),
      apiService.getClients(),
      apiService.getEnquiries(),
      apiService.getProjects(),
      apiService.getTeamMembers(),
      apiService.getEditors(),
      apiService.getProjectTeam(),
      apiService.getProjectData(),
      apiService.getDeliverables(),
      apiService.getPayments(),
      apiService.getExpenses(),
      apiService.getCalendarEvents(),
      apiService.getNotifications(),
    ]);

    const names = [
      'companies',
      'clients',
      'enquiries',
      'projects',
      'team members',
      'editors',
      'project team',
      'project data',
      'deliverables',
      'payments',
      'expenses',
      'calendar events',
      'notifications',
    ];

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `Failed to load ${names[index]}:`,
          result.reason
        );
      }
    });

    const [
      comps,
      clis,
      enqs,
      prjs,
      tms,
      eds,
      ptm,
      pdt,
      dels,
      pays,
      exps,
      evts,
      notifs,
    ] = results;

    if (comps.status === 'fulfilled') setCompanies(comps.value);
    if (clis.status === 'fulfilled') setClients(clis.value);
    if (enqs.status === 'fulfilled') setEnquiries(enqs.value);
    if (prjs.status === 'fulfilled') setProjects(prjs.value);
    if (tms.status === 'fulfilled') setTeamMembers(tms.value);
    if (eds.status === 'fulfilled') setEditors(eds.value);
    if (ptm.status === 'fulfilled') setProjectTeam(ptm.value);
    if (pdt.status === 'fulfilled') setProjectData(pdt.value);
    if (dels.status === 'fulfilled') setDeliverables(dels.value);
    if (pays.status === 'fulfilled') setPayments(pays.value);
    if (exps.status === 'fulfilled') setExpenses(exps.value);
    if (evts.status === 'fulfilled') setCalendarEvents(evts.value);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
  } catch (err) {
    console.error('Failed to load TWBHub data:', err);
  }
}, []);


  // Refresh profile from Supabase profiles table
  const refreshUserProfile = useCallback(async (): Promise<Profile | null> => {
    if (!session?.user) return null;
    try {
      const { profile } = await getUserProfile(session.user.id);
      if (profile) {
        setCurrentUser(profile);
        return profile;
      }
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
    return null;
  }, [session]);

  // Auth Operations: Login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithEmail(email, password);
      if (result.error) {
        return { success: false, error: result.error.message };
      }

      if (result.session && result.user) {
        setSession(result.session);
        // Retrieve user profile and role from the Supabase profiles table
        const { profile } = await getUserProfile(result.user.id);
        const resolvedProfile: Profile = profile || {
          id: result.user.id,
          email: result.user.email || email,
          full_name: result.user.user_metadata?.full_name || email.split('@')[0],
          role: (result.user.user_metadata?.role as UserRole) || 'Team Member',
          phone: result.user.user_metadata?.phone || '',
          company_id: result.user.user_metadata?.company_id || 'both',
          status: 'Active',
        };

        setCurrentUser(resolvedProfile);

        // Route to the appropriate dashboard depending on role
        if (resolvedProfile.role === 'Editor') {
          setActiveTab('deliverables');
        } else {
          setActiveTab('dashboard');
        }

        await refreshAllData();
        return { success: true };
      }

      return { success: false, error: 'No session established. Please verify credentials.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login attempt failed.' };
    }
  };

  // Auth Operations: SignUp
  const signUp = async (
    email: string,
    password: string,
    options?: {
      fullName?: string;
      role?: UserRole;
      companyId?: 'twb' | 'golden_june' | 'both';
      phone?: string;
    }
  ): Promise<{ success: boolean; error?: string; sessionEstablished?: boolean }> => {
    try {
      const result = await signUpWithEmail(email, password, options);
      if (result.error) {
        return { success: false, error: result.error.message };
      }

      if (result.session && result.user) {
        setSession(result.session);
        const { profile } = await getUserProfile(result.user.id);
        const resolvedProfile: Profile = profile || {
          id: result.user.id,
          email: result.user.email || email,
          full_name: options?.fullName || email.split('@')[0],
          role: options?.role || 'Team Member',
          phone: options?.phone || '',
          company_id: options?.companyId || 'both',
          status: 'Active',
        };

        setCurrentUser(resolvedProfile);

        if (resolvedProfile.role === 'Editor') {
          setActiveTab('deliverables');
        } else {
          setActiveTab('dashboard');
        }

        await refreshAllData();
        return { success: true, sessionEstablished: true };
      }

      return { success: true, sessionEstablished: false };
    } catch (err: any) {
      return { success: false, error: err.message || 'Account registration failed.' };
    }
  };

  // Auth Operations: Logout
  const logout = async (): Promise<void> => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      setSession(null);
      setCurrentUser(null);
      setSelectedProjectId(null);
      setActiveTab('dashboard');
    }
  };

  // Persistent session listener and initial check
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        setAuthLoading(true);
        const existingSession = await getSession();
        if (existingSession?.user && isMounted) {
          setSession(existingSession);
          // Query Supabase profiles table
          const { profile } = await getUserProfile(existingSession.user.id);
          if (profile && isMounted) {
            setCurrentUser(profile);
            // Verify permission on restored active view
            if (!canAccessTab(activeTab, profile.role)) {
              setActiveTab(profile.role === 'Editor' ? 'deliverables' : 'dashboard');
            }
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    restoreSession();

    // Listen for Auth state changes
    const { unsubscribe } = onAuthStateChange(async (event, changedSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (changedSession?.user) {
          setSession(changedSession);
          const { profile } = await getUserProfile(changedSession.user.id);
          if (profile && isMounted) {
            setCurrentUser(profile);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    checkSupabase();
    if (currentUser) {
      refreshAllData();
    }
  }, [checkSupabase, refreshAllData, currentUser]);

  // Role permissions helpers
  const userRole = currentUser?.role || 'Team Member';
  const isAdmin = currentUser?.role === 'Admin';
  const isManager = currentUser?.role === 'Manager';
  const isTeamMember = currentUser?.role === 'Team Member';
  const isEditorOnly = currentUser?.role === 'Editor';

  const canManageFinance = isAdmin || isManager;
  const canManageTeam = isAdmin || isManager;
  const canCreateProject = isAdmin || isManager;

  const canAccessSection = (section: string): boolean => {
    if (!currentUser) return false;
    if (isAdmin || isManager) return true;
    if (isEditorOnly) {
      return ['dashboard', 'data', 'deliverables', 'editors', 'notifications', 'calendar', 'settings'].includes(section);
    }
    if (isTeamMember) {
      return ['dashboard', 'projects', 'calendar', 'team-availability', 'data', 'deliverables', 'notifications', 'settings'].includes(section);
    }
    return false;
  };

  // Brand Filtering logic

const matchBrand = (companyId: string) => {
  if (brandFilter === 'all') return true;

  const companyUuid =
    brandFilter === 'golden_june'
      ? '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
      : '5736bf57-b1db-4896-a4df-4963ded1c4c6';

  return companyId === brandFilter || companyId === companyUuid;
};

  // Deliverables filter with Role enforcement
  const filteredDeliverables = deliverables.filter(d => {
    if (!matchBrand(d.company_id)) return false;
    if (isEditorOnly && currentUser) {
      // Editor only sees deliverables assigned to them or their active tasks
      const currentEditor = editors.find(
        e =>
          e.email?.toLowerCase() === currentUser.email.toLowerCase() ||
          e.name?.toLowerCase() === currentUser.full_name.toLowerCase()
      );
      if (currentEditor && d.assigned_editor_id !== currentEditor.id) {
        return false;
      }
    }
    return true;
  });

  const filteredProjects = projects.filter(p => {
    if (!matchBrand(p.company_id)) return false;
    if (isTeamMember && currentUser) {
      // Team members only see projects they are assigned to
      const myTeamMember = teamMembers.find(
        t =>
          t.email?.toLowerCase() === currentUser.email.toLowerCase() ||
          t.name?.toLowerCase() === currentUser.full_name.toLowerCase()
      );
      if (myTeamMember) {
        const isAssigned = projectTeam.some(pt => pt.project_id === p.id && pt.team_member_id === myTeamMember.id);
        if (!isAssigned && p.status !== 'Shooting') return false;
      }
    }
    return true;
  });

  const resolveItemCompanyId = (projectId?: string, fallbackCompanyId?: string): string => {
    if (projectId) {
      const matched = projects.find(p => p.id === projectId);
      if (matched?.company_id) {
        return matched.company_id;
      }
    }
    return fallbackCompanyId || '';
  };

  const filteredEnquiries = enquiries.filter(e => matchBrand(e.company_id));
  const filteredClients = clients.filter(c => matchBrand(c.company_id));
  const filteredProjectData = projectData.filter(d => matchBrand(d.company_id));
  const filteredCalendarEvents = calendarEvents.filter(e => matchBrand(e.company_id));
  const filteredPayments = payments.filter(p => matchBrand(resolveItemCompanyId(p.project_id, p.company_id)));
  const filteredExpenses = expenses.filter(e => {
  const companyId = resolveItemCompanyId(e.project_id, e.company_id);

  if (companyId === 'shared') {
    return true;
  }

  return matchBrand(companyId);
});

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // Crud actions
  const createProject = async (project: Omit<Project, 'id' | 'created_at'>) => {
    const created = await apiService.createProject(project);
    await refreshAllData();
    return created;
  };

  const updateProject = async (project: Project) => {
    setProjects(prev => prev.map(p => (p.id === project.id ? project : p)));
    const updated = await apiService.updateProject(project);
    await refreshAllData();
    return updated;
  };

  const deleteProject = async (id: string) => {
    await apiService.deleteProject(id);
    await refreshAllData();
  };

  const createEnquiry = async (enquiry: Omit<Enquiry, 'id' | 'created_at'>) => {
    const created = await apiService.createEnquiry(enquiry);
    await refreshAllData();
    return created;
  };

  const updateEnquiry = async (enquiry: Enquiry) => {
    const updated = await apiService.updateEnquiry(enquiry);
    await refreshAllData();
    return updated;
  };

  const createClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
    const created = await apiService.createClient(client);
    await refreshAllData();
    return created;
  };

const createTeamMember = async (member: Omit<TeamMember, 'id'>) => {
  const created = await apiService.createTeamMember(member);
  await refreshAllData();
  return created;
};

const updateTeamMember = async (member: TeamMember) => {
  const updated = await apiService.updateTeamMember(member);
  await refreshAllData();
  return updated;
};

const deleteTeamMember = async (id: string) => {
  await apiService.deleteTeamMember(id);
  await refreshAllData();
};

  const updateClient = async (client: Client) => {
    const updated = await apiService.updateClient(client);
    await refreshAllData();
    return updated;
  };

  const assignTeamMember = async (
    assignment: Omit<ProjectTeamAssignment, 'id'>,
    adminOverride?: boolean
  ) => {
    const res = await apiService.assignTeamMember(assignment, adminOverride);
    if (res.success) {
      await refreshAllData();
    }
    return res;
  };

  const updateTeamAssignment = async (
    assignmentId: string,
    assignment: {
      project_id?: string;
      team_member_id: string;
      role: string;
      assignment_date: string;
      notes?: string;
    }
  ) => {
    const res = await apiService.updateTeamAssignment(assignmentId, assignment);
    if (res.success) {
      if (res.assignment) {
        setProjectTeam(prev => prev.map(a => (a.id === assignmentId ? res.assignment! : a)));
      }
      await refreshAllData();
    }
    return res;
  };

  const removeTeamAssignment = async (assignmentId: string) => {
    setProjectTeam(prev => prev.filter(a => a.id !== assignmentId));
    await apiService.removeTeamAssignment(assignmentId);
    await refreshAllData();
  };

  const checkTeamConflict = async (
    teamMemberId: string,
    date: string,
    excludeProjectId?: string,
    excludeAssignmentId?: string
  ) => {
    return apiService.checkTeamConflict(teamMemberId, date, excludeProjectId, excludeAssignmentId);
  };

  const createProjectData = async (data: Omit<ProjectData, 'id'>) => {
    const created = await apiService.createProjectData(data);
    setProjectData(prev => [created, ...prev.filter(d => d.id !== created.id)]);
    await refreshAllData();
    return created;
  };

  const updateProjectData = async (data: ProjectData) => {
    setProjectData(prev => prev.map(d => (d.id === data.id ? data : d)));
    const updated = await apiService.updateProjectData(data);
    setProjectData(prev => prev.map(d => (d.id === data.id ? updated : d)));
    await refreshAllData();
    return updated;
  };

  const deleteProjectData = async (id: string) => {
    setProjectData(prev => prev.filter(d => d.id !== id));
    await apiService.deleteProjectData(id);
    await refreshAllData();
  };

  const createDeliverable = async (deliverable: Omit<Deliverable, 'id' | 'last_updated'>) => {
    const created = await apiService.createDeliverable(deliverable);
    setDeliverables(prev => [created, ...prev.filter(d => d.id !== created.id)]);
    await refreshAllData();
    return created;
  };

  const updateDeliverable = async (deliverable: Deliverable) => {
    setDeliverables(prev => prev.map(d => (d.id === deliverable.id ? deliverable : d)));
    const updated = await apiService.updateDeliverable(deliverable);
    setDeliverables(prev => prev.map(d => (d.id === deliverable.id ? updated : d)));
    await refreshAllData();
    return updated;
  };

  const deleteDeliverable = async (id: string) => {
    await apiService.deleteDeliverable(id);
    setDeliverables(prev => prev.filter(d => d.id !== id));
    await refreshAllData();
  };

  const updateDeliverableStatus = async (deliverableId: string, status: DeliverableStatus) => {
    // 1. Immediately update local state so UI and completion dot reflect change instantly
    const now = new Date().toISOString();
    setDeliverables(prev =>
      prev.map(d => {
        if (d.id !== deliverableId) return d;
        const firstSubmittedAt =
          status === 'Submitted' && !d.first_submitted_at
            ? now
            : d.first_submitted_at;
        const deliveredAt =
          status === 'Delivered' && !d.delivered_at
            ? now
            : d.delivered_at;
        return {
          ...d,
          status,
          first_submitted_at: firstSubmittedAt,
          delivered_at: deliveredAt,
          last_updated: now,
        };
      })
    );

    // 2. Persist to Supabase deliverables table and local storage
    const updated = await apiService.updateDeliverableStatus(
      deliverableId,
      status,
      currentUser?.role || 'Team Member',
      currentUser?.full_name || 'Studio Member'
    );

    if (updated) {
      setDeliverables(prev =>
        prev.map(d => (d.id === deliverableId ? updated : d))
      );
    }

    await refreshAllData();
  };

  const createPayment = async (payment: Omit<Payment, 'id' | 'created_at'>) => {
    const created = await apiService.createPayment(payment);
    await refreshAllData();
    return created;
  };

  const createExpense = async (expense: Omit<Expense, 'id' | 'created_at'>) => {
    const created = await apiService.createExpense(expense);
    await refreshAllData();
    return created;
  };

const updateExpense = async (expense: Expense) => {
  const updatedExpense = await apiService.updateExpense(expense);

  setExpenses(prev =>
    prev.map(e => e.id === updatedExpense.id ? updatedExpense : e)
  );

  return updatedExpense;
};

const deleteExpense = async (id: string) => {
  await apiService.deleteExpense(id);

  setExpenses(prev =>
    prev.filter(e => e.id !== id)
  );
};

  const updatePayment = async (payment: Payment) => {
    const updatedPayment = await apiService.updatePayment(payment);
    await refreshAllData();
    return updatedPayment;
  };

  const deletePayment = async (id: string) => {
    await apiService.deletePayment(id);
    await refreshAllData();
  };

  const createCalendarEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    const created = await apiService.createCalendarEvent(event);
    await refreshAllData();
    return created;
  };

  const deleteCalendarEvent = async (id: string) => {
    await apiService.deleteCalendarEvent(id);
    await refreshAllData();
  };

  const markNotificationRead = async (id: string) => {
    await apiService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = async () => {
    await apiService.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const updateCompany = async (company: Company) => {
    await apiService.updateCompany(company);
    await refreshAllData();
  };

  return (
    <AppContext.Provider
      value={{
        brandFilter,
        setBrandFilter: handleSetBrandFilter,
        currentUser,
        session,
        authLoading,
        login,
        signUp,
        logout,
        refreshUserProfile,
        availableProfiles,
        activeTab,
        setActiveTab,
        selectedProjectId,
        setSelectedProjectId,
        supabaseStatus,
        checkSupabase,
        companies,
        clients,
        enquiries,
        projects,
        teamMembers,
        editors,
        projectTeam,
        projectData,
        deliverables,
        payments,
        expenses,
        calendarEvents,
        notifications,
        unreadNotificationCount,
        filteredProjects,
        filteredEnquiries,
        filteredClients,
        filteredDeliverables,
        filteredProjectData,
        filteredCalendarEvents,
        filteredPayments,
        filteredExpenses,
        refreshAllData,
        createProject,
        updateProject,
        deleteProject,
        createEnquiry,
        updateEnquiry,
        createClient,
        updateClient,
        createTeamMember,
updateTeamMember,
deleteTeamMember,
assignTeamMember,
        updateTeamAssignment,
        removeTeamAssignment,
        checkTeamConflict,
        createProjectData,
        updateProjectData,
        deleteProjectData,
        createDeliverable,
        updateDeliverable,
        deleteDeliverable,
        updateDeliverableStatus,
        createPayment,
        createExpense,
        updateExpense,
        deleteExpense,
        updatePayment,
        deletePayment,
        createCalendarEvent,
        deleteCalendarEvent,
        markNotificationRead,
        markAllNotificationsRead,
        updateCompany,
        canAccessSection,
        canManageFinance,
        canManageTeam,
        canCreateProject,
        isEditorOnly,
        isAdmin,
        isManager,
        userRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
