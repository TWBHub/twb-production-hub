import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  BrandId,
  UserRole,
  Company,
  Client,
  Enquiry,
  Quotation,
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
  DeliverableBrandScope,
  DeliverableCatalogueCategory,
  DeliverableCatalogueItem,
} from '../types';
import { apiService } from '../services/api';
import {
  getSession,
  getUserProfile,
  ProfileLookupResult,
  signInWithEmail,
  signOut,
  resetPasswordForEmail,
  verifyRecoveryOtp,
  updateUserPassword,
  onAuthStateChange,
  canAccessTab,
  getDefaultLandingTab,
  resolveVerifiedUserRole,
} from '../lib/auth';
import {
  canAddDeliverableCatalogueEntry,
  canEditDeliverableCatalogueEntry,
} from '../utils/deliverableCatalogueUtils';
import {
  EditorDeliverablePatch,
  canCreateDeliverable,
  canDeleteDeliverable,
  canManageAllDeliverables,
  canSetDeliverableStatus,
  extractEditorDeliverableChanges,
  isDeliverableOwnedByEditor,
  resolveLinkedEditorTeamMember,
  validateDeliverableUpdateFields,
} from '../utils/deliverablePermissions';

export type ModuleErrorKey =
  | 'clients'
  | 'deliverables'
  | 'deliverableCatalogue'
  | 'payments'
  | 'projectData'
  | 'projectTeam';

export type ModuleLoadErrors = Partial<Record<ModuleErrorKey, string>>;

interface AppContextType {
  // Brand & User State
  brandFilter: BrandId;
  setBrandFilter: (brand: BrandId) => void;
  currentUser: Profile | null;
  session: Session | null;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  profileVerificationState: 'idle' | 'verified' | 'temporary_error';
  retryProfileVerification: () => Promise<{ success: boolean; error?: string }>;
  isPasswordRecovery: boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasswordRecoveryOtp: (
    email: string,
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<Profile | null>;
  availableProfiles: Profile[];

  // Navigation
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedEnquiryId: string | null;
  setSelectedEnquiryId: (id: string | null) => void;

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
  deliverableCatalogue: DeliverableCatalogueItem[];

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
  enquiriesError: string | null;
  moduleErrors: ModuleLoadErrors;
  clearModuleError: (key: ModuleErrorKey) => void;
  isRefreshingData: boolean;
  resolveItemCompanyId: (projectId?: string, fallbackCompanyId?: string) => string;
  refreshAllData: () => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'created_at'>) => Promise<Project>;
  updateProject: (project: Project) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  createEnquiry: (enquiry: Omit<Enquiry, 'id' | 'created_at'>) => Promise<Enquiry>;
  updateEnquiry: (enquiry: Enquiry) => Promise<Enquiry>;
  deleteEnquiry: (id: string) => Promise<void>;
  createDeliverableCatalogueItem: (item: {
    name: string;
    category?: DeliverableCatalogueCategory | string;
    description?: string;
    applicable_brand: DeliverableBrandScope;
    is_active?: boolean;
    sort_order?: number;
  }) => Promise<DeliverableCatalogueItem>;
  updateDeliverableCatalogueItem: (
    item: DeliverableCatalogueItem
  ) => Promise<DeliverableCatalogueItem>;
  reorderDeliverableCatalogue: (
    updatedPair: [DeliverableCatalogueItem, DeliverableCatalogueItem]
  ) => Promise<DeliverableCatalogueItem[]>;
  deleteDeliverableCatalogueItem: (id: string, itemName: string) => Promise<void>;
  quotations: Quotation[];
  createQuotation: (quotation: Omit<Quotation, 'id' | 'created_at'>) => Promise<Quotation>;
  updateQuotation: (quotation: Quotation) => Promise<Quotation>;
  deleteQuotation: (id: string) => Promise<void>;
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
  updateDeliverableAsEditor: (
    deliverableId: string,
    changes:
      | EditorDeliverablePatch
      | {
          status?: DeliverableStatus;
          external_link?: string | null;
          [key: string]: unknown;
        }
  ) => Promise<Deliverable>;
  deleteDeliverable: (id: string) => Promise<void>;
  updateDeliverableStatus: (deliverableId: string, status: DeliverableStatus) => Promise<void>;
  createPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<Payment>;
  createExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<Expense>;
  updateExpense: (expense: Expense) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<Payment>;
  deletePayment: (id: string) => Promise<void>;
  createCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  updateCalendarEvent: (event: CalendarEvent) => Promise<CalendarEvent>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateCompany: (company: Company) => Promise<void>;

  // Role permissions & verified Editor identity helpers
  canAccessSection: (section: string) => boolean;
  canManageFinance: boolean;
  canManageTeam: boolean;
  canCreateProject: boolean;
  canManageDeliverables: boolean;
  canManageProjectData: boolean;
  canAccessSettings: boolean;
  canAccessNotifications: boolean;
  linkedEditorTeamMember: TeamMember | null;
  linkedEditorTeamMemberId: string | null;
  isEditorOnly: boolean;
  isAdmin: boolean;
  isManager: boolean;
  userRole: UserRole | null;
}

export interface AppDeliverableActionDeps {
  currentUser: Profile | null;
  userRole: UserRole | null;
  isUserActive: boolean;
  deliverables: Deliverable[];
  deliverableCatalogue: DeliverableCatalogueItem[];
  enquiries: Enquiry[];
  linkedEditorTeamMember: TeamMember | null;
  linkedEditorTeamMemberId: string | null;
  api: {
    createDeliverable: (d: Omit<Deliverable, 'id' | 'last_updated'>) => Promise<Deliverable>;
    updateDeliverable: (d: Deliverable) => Promise<Deliverable>;
    updateDeliverableStatus: (
      deliverableId: string,
      status: DeliverableStatus,
      updaterRole: UserRole,
      updaterName: string
    ) => Promise<Deliverable>;
    updateDeliverableAsEditor: (params: {
      deliverableId: string;
      changes: {
        status?: DeliverableStatus;
        external_link?: string | null;
      };
      actorRole: UserRole | string | null | undefined;
      updaterName?: string;
      linkedEditorTeamMemberId?: string | null;
      linkedEditorTeamMember?: TeamMember | null;
      isActorActive?: boolean;
    }) => Promise<Deliverable>;
    deleteDeliverable: (id: string) => Promise<void>;
    createDeliverableCatalogueItem: typeof apiService.createDeliverableCatalogueItem;
    updateDeliverableCatalogueItem: typeof apiService.updateDeliverableCatalogueItem;
    reorderDeliverableCatalogue: typeof apiService.reorderDeliverableCatalogue;
    deleteDeliverableCatalogueItem: typeof apiService.deleteDeliverableCatalogueItem;
  };
  setDeliverables: React.Dispatch<React.SetStateAction<Deliverable[]>>;
  setDeliverableCatalogue: React.Dispatch<React.SetStateAction<DeliverableCatalogueItem[]>>;
  refreshAllData: () => Promise<void>;
}

/**
 * Authoritative deliverable & catalogue mutation coordinator used by AppProvider.
 * Enforces role, linked Editor ownership, and field-level permissions before any API/DB write.
 */
export function createAppDeliverableActions(deps: AppDeliverableActionDeps) {
  const assertActiveRole = (): UserRole => {
    if (!deps.currentUser || !deps.isUserActive || !deps.userRole) {
      throw new Error(
        'Permission denied: An active verified account is required to modify deliverables.'
      );
    }
    return deps.userRole;
  };

  const createDeliverable = async (
    deliverable: Omit<Deliverable, 'id' | 'last_updated'>
  ): Promise<Deliverable> => {
    const role = assertActiveRole();
    if (!canCreateDeliverable(role, deps.isUserActive)) {
      throw new Error('Permission denied: Only Admins and Managers can create deliverables.');
    }
    const created = await deps.api.createDeliverable(deliverable);
    deps.setDeliverables(prev => [created, ...prev.filter(d => d.id !== created.id)]);
    await deps.refreshAllData();
    return created;
  };

  const deleteDeliverable = async (id: string): Promise<void> => {
    const role = assertActiveRole();
    if (!canDeleteDeliverable(role, deps.isUserActive)) {
      throw new Error('Permission denied: Only Admins and Managers can delete deliverables.');
    }
    await deps.api.deleteDeliverable(id);
    deps.setDeliverables(prev => prev.filter(d => d.id !== id));
    await deps.refreshAllData();
  };

  const updateDeliverableAsEditor = async (
    deliverableId: string,
    changes:
      | EditorDeliverablePatch
      | {
          status?: DeliverableStatus;
          external_link?: string | null;
          [key: string]: unknown;
        }
  ): Promise<Deliverable> => {
    const role = assertActiveRole();
    if (role !== 'Editor') {
      throw new Error(
        'Permission denied: Editor deliverable update route requires an active Editor account.'
      );
    }
    if (!deps.linkedEditorTeamMember || !deps.linkedEditorTeamMemberId) {
      throw new Error(
        'Permission denied: Your Editor account is not linked to an active Team Member profile.'
      );
    }

    const existing = deps.deliverables.find(d => d.id === deliverableId) || null;
    const validation = validateDeliverableUpdateFields({
      role,
      deliverable: existing,
      updatedFields: { ...changes } as Record<string, unknown>,
      linkedEditorTeamMemberId: deps.linkedEditorTeamMemberId,
      linkedEditorTeamMember: deps.linkedEditorTeamMember,
      isUserActive: deps.isUserActive,
    });

    if (!validation.allowed || !validation.sanitizedEditorPatch) {
      throw new Error(
        validation.reason ||
          'Permission denied: Editors may only update status or external link on their own assigned deliverables.'
      );
    }

    const updated = await deps.api.updateDeliverableAsEditor({
      deliverableId,
      changes: validation.sanitizedEditorPatch,
      actorRole: role,
      updaterName: deps.currentUser?.full_name || 'Editor',
      linkedEditorTeamMemberId: deps.linkedEditorTeamMemberId,
      linkedEditorTeamMember: deps.linkedEditorTeamMember,
      isActorActive: deps.isUserActive,
    });

    deps.setDeliverables(prev => prev.map(d => (d.id === deliverableId ? updated : d)));
    await deps.refreshAllData();
    return updated;
  };

  const updateDeliverable = async (deliverable: Deliverable): Promise<Deliverable> => {
    const role = assertActiveRole();

    if (canManageAllDeliverables(role, deps.isUserActive)) {
      const updated = await deps.api.updateDeliverable(deliverable);
      deps.setDeliverables(prev => prev.map(d => (d.id === deliverable.id ? updated : d)));
      await deps.refreshAllData();
      return updated;
    }

    if (role === 'Editor') {
      if (!deps.linkedEditorTeamMember || !deps.linkedEditorTeamMemberId) {
        throw new Error(
          'Permission denied: Your Editor account is not linked to an active Team Member profile.'
        );
      }
      const existing = deps.deliverables.find(d => d.id === deliverable.id) || null;
      if (!existing) {
        throw new Error('Permission denied: Target deliverable could not be verified.');
      }
      if (
        !isDeliverableOwnedByEditor({
          deliverable: existing,
          linkedEditorTeamMemberId: deps.linkedEditorTeamMemberId,
          linkedEditorTeamMember: deps.linkedEditorTeamMember,
        })
      ) {
        throw new Error(
          'Permission denied: Editors can only update deliverables assigned to their own linked team member record.'
        );
      }

      const { changes, disallowedFields } = extractEditorDeliverableChanges(existing, deliverable);
      if (disallowedFields.length > 0) {
        throw new Error(
          `Permission denied: Editors cannot modify protected deliverable fields (${disallowedFields.join(', ')}).`
        );
      }

      return await updateDeliverableAsEditor(deliverable.id, changes);
    }

    throw new Error('Permission denied: You are not authorized to update deliverables.');
  };

  const updateDeliverableStatus = async (
    deliverableId: string,
    status: DeliverableStatus
  ): Promise<void> => {
    const role = assertActiveRole();

    if (canManageAllDeliverables(role, deps.isUserActive)) {
      const updated = await deps.api.updateDeliverableStatus(
        deliverableId,
        status,
        role,
        deps.currentUser?.full_name || 'Studio Member'
      );

      if (updated) {
        deps.setDeliverables(prev =>
          prev.map(d => (d.id === deliverableId ? updated : d))
        );
      }

      await deps.refreshAllData();
      return;
    }

    if (role === 'Editor') {
      if (!deps.linkedEditorTeamMember || !deps.linkedEditorTeamMemberId) {
        throw new Error(
          'Permission denied: Your Editor account is not linked to an active Team Member profile.'
        );
      }
      const existing = deps.deliverables.find(d => d.id === deliverableId) || null;
      if (
        !canSetDeliverableStatus({
          role,
          deliverable: existing,
          status,
          linkedEditorTeamMemberId: deps.linkedEditorTeamMemberId,
          linkedEditorTeamMember: deps.linkedEditorTeamMember,
          isUserActive: deps.isUserActive,
        })
      ) {
        throw new Error(
          'Permission denied: Editors can only set valid workflow statuses on deliverables assigned to their own linked team member record.'
        );
      }

      await updateDeliverableAsEditor(deliverableId, { status });
      return;
    }

    throw new Error('Permission denied: You are not authorized to update deliverable statuses.');
  };

  const createDeliverableCatalogueItem = async (item: {
    name: string;
    category?: DeliverableCatalogueCategory | string;
    description?: string;
    applicable_brand: DeliverableBrandScope;
    is_active?: boolean;
    sort_order?: number;
  }): Promise<DeliverableCatalogueItem> => {
    const role = assertActiveRole();
    if (!canAddDeliverableCatalogueEntry(role)) {
      throw new Error(
        'Permission denied: Only Admins and Managers can add deliverable catalogue entries.'
      );
    }
    const created = await deps.api.createDeliverableCatalogueItem(
      item,
      deps.deliverableCatalogue
    );
    await deps.refreshAllData();
    return created;
  };

  const updateDeliverableCatalogueItem = async (
    item: DeliverableCatalogueItem
  ): Promise<DeliverableCatalogueItem> => {
    const role = assertActiveRole();
    if (!canEditDeliverableCatalogueEntry(role)) {
      throw new Error(
        'Permission denied: Only Admins can update deliverable catalogue entries.'
      );
    }
    const updated = await deps.api.updateDeliverableCatalogueItem(
      item,
      deps.deliverableCatalogue
    );
    await deps.refreshAllData();
    return updated;
  };

  const reorderDeliverableCatalogue = async (
    updatedPair: [DeliverableCatalogueItem, DeliverableCatalogueItem]
  ): Promise<DeliverableCatalogueItem[]> => {
    const role = assertActiveRole();
    if (!canEditDeliverableCatalogueEntry(role)) {
      throw new Error(
        'Permission denied: Only Admins can reorder deliverable catalogue entries.'
      );
    }
    const updated = await deps.api.reorderDeliverableCatalogue(
      updatedPair,
      deps.deliverableCatalogue
    );
    await deps.refreshAllData();
    return updated;
  };

  const deleteDeliverableCatalogueItem = async (
    id: string,
    itemName: string
  ): Promise<void> => {
    const role = assertActiveRole();
    if (!canEditDeliverableCatalogueEntry(role)) {
      throw new Error(
        'Permission denied: Only Admins can delete deliverable catalogue entries.'
      );
    }
    await deps.api.deleteDeliverableCatalogueItem(
      id,
      itemName,
      deps.deliverables,
      deps.enquiries
    );
    deps.setDeliverableCatalogue(prev => prev.filter(item => item.id !== id));
    await deps.refreshAllData();
  };

  return {
    createDeliverable,
    updateDeliverable,
    updateDeliverableAsEditor,
    deleteDeliverable,
    updateDeliverableStatus,
    createDeliverableCatalogueItem,
    updateDeliverableCatalogueItem,
    reorderDeliverableCatalogue,
    deleteDeliverableCatalogueItem,
  };
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

  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);

  // Supabase Auth states (strictly verified against public.profiles)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileVerificationState, setProfileVerificationState] = useState<
    'idle' | 'verified' | 'temporary_error'
  >('idle');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    const search = new URLSearchParams(window.location.search);
    return hash.includes('type=recovery') || search.get('type') === 'recovery';
  });
  const isPasswordRecoveryRef = React.useRef<boolean>(isPasswordRecovery);
  const currentUserRef = React.useRef<Profile | null>(null);
  const activeTabRef = React.useRef<string>(activeTab);
  const isMountedRef = React.useRef<boolean>(true);
  const authStateVersionRef = React.useRef<number>(0);
  const activeLoginVersionRef = React.useRef<number>(0);
  const scheduledAuthTimersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const loginInFlightRef = React.useRef<boolean>(false);
  const otpRecoveryInFlightRef = React.useRef<boolean>(false);
  const preserveAuthErrorRef = React.useRef<boolean>(false);
  const [availableProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    isPasswordRecoveryRef.current = isPasswordRecovery;
  }, [isPasswordRecovery]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Guarded navigation setter: validates against verified role and authoritative policy
  const setActiveTab: React.Dispatch<React.SetStateAction<string>> = useCallback(
    nextTabOrUpdater => {
      const activeProfile = currentUserRef.current;
      const verifiedRole = activeProfile
        ? resolveVerifiedUserRole(activeProfile.role)
        : null;

      if (!activeProfile || !verifiedRole) {
        activeTabRef.current = 'dashboard';
        setActiveTabState('dashboard');
        return;
      }

      setActiveTabState(prev => {
        const requestedTab =
          typeof nextTabOrUpdater === 'function'
            ? nextTabOrUpdater(prev)
            : nextTabOrUpdater;
        const nextTab = canAccessTab(requestedTab, verifiedRole)
          ? requestedTab
          : getDefaultLandingTab(verifiedRole);
        activeTabRef.current = nextTab;
        return nextTab;
      });
    },
    []
  );

  const [supabaseStatus, setSupabaseStatus] = useState<{ connected: boolean; message: string; checking: boolean }>({
    connected: false,
    message: 'Checking Supabase connection...',
    checking: true,
  });

  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [enquiriesError, setEnquiriesError] = useState<string | null>(null);
  const [moduleErrors, setModuleErrors] = useState<ModuleLoadErrors>({});
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);
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
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [deliverableCatalogue, setDeliverableCatalogue] = useState<DeliverableCatalogueItem[]>([]);

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

  const clearModuleError = useCallback((key: ModuleErrorKey) => {
    setModuleErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

 // Fetch all collections
const refreshAllData = useCallback(async () => {
  setIsRefreshingData(true);
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
      apiService.getQuotations(),
      apiService.getDeliverableCatalogue(),
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
      'quotations',
      'shared catalogue',
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
      quots,
      delCat,
    ] = results;

    if (comps.status === 'fulfilled') setCompanies(comps.value);

    const nextModuleErrors: ModuleLoadErrors = {};

    if (clis.status === 'fulfilled') {
      setClients(clis.value);
    } else {
      nextModuleErrors.clients =
        clis.reason?.message || 'Failed to load clients from Supabase.';
    }

    if (enqs.status === 'fulfilled') {
      setEnquiries(enqs.value);
      setEnquiriesError(null);
    } else if (enqs.status === 'rejected') {
      setEnquiriesError(enqs.reason?.message || 'Failed to load Leads from Supabase.');
    }

    const loadedProjects = prjs.status === 'fulfilled' ? prjs.value : null;
    if (loadedProjects) setProjects(loadedProjects);

    if (tms.status === 'fulfilled') setTeamMembers(tms.value);
    if (eds.status === 'fulfilled') setEditors(eds.value);

    if (ptm.status === 'fulfilled') {
      setProjectTeam(ptm.value);
    } else {
      nextModuleErrors.projectTeam =
        ptm.reason?.message || 'Failed to load project team assignments from Supabase.';
    }

    if (pdt.status === 'fulfilled') {
      setProjectData(pdt.value);
    } else {
      nextModuleErrors.projectData =
        pdt.reason?.message || 'Failed to load project storage data from Supabase.';
    }

    if (dels.status === 'fulfilled') {
      setDeliverables(dels.value);
    } else {
      nextModuleErrors.deliverables =
        dels.reason?.message || 'Failed to load deliverables from Supabase.';
    }

    if (delCat.status === 'fulfilled') {
      setDeliverableCatalogue(delCat.value);
    } else {
      nextModuleErrors.deliverableCatalogue =
        delCat.reason?.message || 'Failed to load Shared Deliverables Catalogue from Supabase.';
    }

    if (pays.status === 'fulfilled') {
      const normalizedPayments = loadedProjects
        ? pays.value.map(pay => {
            const matchedProj = loadedProjects.find(p => p.id === pay.project_id);
            return matchedProj?.company_id
              ? { ...pay, company_id: matchedProj.company_id }
              : pay;
          })
        : pays.value;
      setPayments(normalizedPayments);
    } else {
      nextModuleErrors.payments =
        pays.reason?.message || 'Failed to load finance payments from Supabase.';
    }

    setModuleErrors(nextModuleErrors);

    if (exps.status === 'fulfilled') setExpenses(exps.value);
    if (evts.status === 'fulfilled') setCalendarEvents(evts.value);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
    if (quots && quots.status === 'fulfilled') setQuotations(quots.value);
  } catch (err) {
    console.error('Failed to load TWBHub data:', err);
  } finally {
    setIsRefreshingData(false);
  }
}, []);


  const clearAuthError = useCallback(() => {
    preserveAuthErrorRef.current = false;
    setAuthError(null);
  }, []);

  const clearAuthenticatedAppState = useCallback(() => {
    currentUserRef.current = null;
    setSession(null);
    setCurrentUser(null);
    setProfileVerificationState('idle');
    setSelectedProjectId(null);
    setSelectedEnquiryId(null);
    activeTabRef.current = 'dashboard';
    setActiveTabState('dashboard');
    setCompanies([]);
    setClients([]);
    setEnquiries([]);
    setEnquiriesError(null);
    setModuleErrors({});
    setProjects([]);
    setTeamMembers([]);
    setEditors([]);
    setProjectTeam([]);
    setProjectData([]);
    setDeliverables([]);
    setPayments([]);
    setExpenses([]);
    setCalendarEvents([]);
    setNotifications([]);
    setQuotations([]);
    setDeliverableCatalogue([]);
  }, []);

  const scheduleDeferredAuthTask = useCallback((task: () => Promise<void> | void) => {
    const timerId = setTimeout(() => {
      scheduledAuthTimersRef.current.delete(timerId);
      if (!isMountedRef.current) return;
      void Promise.resolve(task()).catch(err => {
        console.warn('Deferred auth verification error:', err);
      });
    }, 0);
    scheduledAuthTimersRef.current.add(timerId);
  }, []);

  const verifyAndApplySessionProfile = useCallback(
    async (
      targetSession: Session,
      options?: {
        redirectOnSuccess?: boolean;
        bypassRecoveryCheck?: boolean;
        precomputedLookup?: ProfileLookupResult;
        expectedVersion?: number;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const opVersion =
        options?.expectedVersion !== undefined
          ? options.expectedVersion
          : ++authStateVersionRef.current;

      const isStale = () =>
        !isMountedRef.current || authStateVersionRef.current !== opVersion;

      if (isStale()) {
        return { success: false };
      }

      if (isPasswordRecoveryRef.current && !options?.bypassRecoveryCheck) {
        setSession(targetSession);
        currentUserRef.current = null;
        setCurrentUser(null);
        setProfileVerificationState('idle');
        setAuthError(null);
        return { success: true };
      }

      const lookup =
        options?.precomputedLookup ?? (await getUserProfile(targetSession.user.id));

      if (isStale()) {
        return { success: false };
      }

      if (lookup.status === 'ok' && lookup.profile) {
        preserveAuthErrorRef.current = false;
        setSession(targetSession);
        currentUserRef.current = lookup.profile;
        setCurrentUser(lookup.profile);
        setProfileVerificationState('verified');
        setAuthError(null);

        const defaultTab = getDefaultLandingTab(lookup.profile.role);
        if (options?.redirectOnSuccess) {
          setActiveTab(defaultTab);
        } else if (!canAccessTab(activeTabRef.current, lookup.profile.role)) {
          setActiveTab(defaultTab);
        }

        return { success: true };
      }

      if (lookup.status === 'temporary_error') {
        const msg =
          lookup.error?.message ||
          'Temporary database or network error while verifying your studio profile. Please retry.';
        preserveAuthErrorRef.current = false;
        setSession(targetSession);
        currentUserRef.current = null;
        setCurrentUser(null);
        setProfileVerificationState('temporary_error');
        setAuthError(msg);
        return { success: false, error: msg };
      }

      // Confirmed inactive account ('inactive'), missing profile ('not_found'),
      // or unsupported role ('unsupported_role', including legacy 'team')
      const denialMessage =
        lookup.status === 'inactive'
          ? 'Your account has been deactivated. Please contact an administrator.'
          : lookup.status === 'unsupported_role'
            ? 'Access denied: Your account role is not supported for TWBHub access. Please contact your administrator.'
            : 'Access denied: No studio profile was found for this account. Please contact your administrator.';

      preserveAuthErrorRef.current = true;
      isPasswordRecoveryRef.current = false;
      setIsPasswordRecovery(false);
      clearAuthenticatedAppState();
      setAuthError(denialMessage);

      try {
        await signOut();
      } catch (err) {
        console.warn('Sign out after failed profile verification:', err);
      }

      if (isStale()) {
        return { success: false, error: denialMessage };
      }

      setAuthError(denialMessage);
      return { success: false, error: denialMessage };
    },
    [clearAuthenticatedAppState, setActiveTab]
  );

  const verifyAndApplySessionProfileRef = React.useRef(verifyAndApplySessionProfile);
  useEffect(() => {
    verifyAndApplySessionProfileRef.current = verifyAndApplySessionProfile;
  }, [verifyAndApplySessionProfile]);

  // Refresh profile from Supabase profiles table
  const refreshUserProfile = useCallback(async (): Promise<Profile | null> => {
    const opVersion = ++authStateVersionRef.current;
    const activeSession = session || (await getSession());
    if (!isMountedRef.current || authStateVersionRef.current !== opVersion) {
      return null;
    }
    if (!activeSession?.user) return null;
    const result = await verifyAndApplySessionProfile(activeSession, {
      expectedVersion: opVersion,
    });
    if (
      result.success &&
      isMountedRef.current &&
      authStateVersionRef.current === opVersion
    ) {
      return currentUserRef.current;
    }
    return null;
  }, [session, verifyAndApplySessionProfile]);

  const retryProfileVerification = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const opVersion = ++authStateVersionRef.current;
    const activeSession = session || (await getSession());
    if (!isMountedRef.current || authStateVersionRef.current !== opVersion) {
      return { success: false };
    }
    if (!activeSession?.user) {
      const msg = 'Your session is no longer active. Please sign in again.';
      clearAuthenticatedAppState();
      setAuthError(msg);
      return { success: false, error: msg };
    }
    return verifyAndApplySessionProfile(activeSession, {
      redirectOnSuccess: true,
      expectedVersion: opVersion,
    });
  }, [session, clearAuthenticatedAppState, verifyAndApplySessionProfile]);

  // Auth Operations: Login
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const loginVersion = ++authStateVersionRef.current;
    activeLoginVersionRef.current = loginVersion;
    loginInFlightRef.current = true;
    preserveAuthErrorRef.current = false;
    setAuthError(null);
    setIsPasswordRecovery(false);
    isPasswordRecoveryRef.current = false;

    try {
      const result = await signInWithEmail(email, password);
      if (!isMountedRef.current || authStateVersionRef.current !== loginVersion) {
        return { success: false };
      }

      if (result.error) {
        setAuthError(result.error.message);
        return { success: false, error: result.error.message };
      }

      if (result.session && result.user) {
        const verified = await verifyAndApplySessionProfile(result.session, {
          redirectOnSuccess: true,
          expectedVersion: loginVersion,
        });
        return verified;
      }

      const fallbackMsg = 'No session established. Please verify your credentials.';
      setAuthError(fallbackMsg);
      return { success: false, error: fallbackMsg };
    } catch (err: any) {
      if (!isMountedRef.current || authStateVersionRef.current !== loginVersion) {
        return { success: false };
      }
      const msg = err?.message || 'Login attempt failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      if (activeLoginVersionRef.current === loginVersion) {
        loginInFlightRef.current = false;
      }
    }
  };

  // Auth Operations: Password Recovery Request (Email OTP)
  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await resetPasswordForEmail(email);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  // Auth Operations: Verify Recovery OTP and Establish Recovery Session (without changing password)
  const verifyPasswordRecoveryOtp = async (
    email: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (otpRecoveryInFlightRef.current) {
      return { success: false, error: 'Verification is already in progress. Please wait.' };
    }

    const otpVersion = ++authStateVersionRef.current;
    otpRecoveryInFlightRef.current = true;
    preserveAuthErrorRef.current = false;
    setAuthError(null);

    try {
      const result = await verifyRecoveryOtp(email, token);
      if (!isMountedRef.current || authStateVersionRef.current !== otpVersion) {
        return { success: false };
      }
      if (result.error || !result.session) {
        return {
          success: false,
          error: result.error?.message || 'Failed to verify recovery code. Please try again.',
        };
      }

      isPasswordRecoveryRef.current = true;
      currentUserRef.current = null;
      setIsPasswordRecovery(true);
      setSession(result.session);
      setCurrentUser(null);
      setProfileVerificationState('idle');
      setAuthError(null);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Recovery code verification failed.',
      };
    } finally {
      otpRecoveryInFlightRef.current = false;
    }
  };

  // Auth Operations: Complete Password Recovery (Set New Password)
  const completePasswordRecovery = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const recoveryVersion = ++authStateVersionRef.current;
    const { error } = await updateUserPassword(newPassword);
    if (!isMountedRef.current || authStateVersionRef.current !== recoveryVersion) {
      return { success: false };
    }
    if (error) {
      return { success: false, error: error.message };
    }

    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);

    if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const activeSession = (await getSession()) || session;
    if (!isMountedRef.current || authStateVersionRef.current !== recoveryVersion) {
      return { success: false };
    }
    if (!activeSession?.user) {
      const msg = 'Password updated. Please sign in with your new password.';
      clearAuthenticatedAppState();
      setAuthError(null);
      return { success: true, error: msg };
    }

    return verifyAndApplySessionProfile(activeSession, {
      redirectOnSuccess: true,
      bypassRecoveryCheck: true,
      expectedVersion: recoveryVersion,
    });
  };

  // Auth Operations: Logout (also safely clears any active recovery session without changing password)
  const logout = async (): Promise<void> => {
    // Synchronously invalidate all in-flight auth checks and clear authenticated state first
    authStateVersionRef.current += 1;
    preserveAuthErrorRef.current = false;
    otpRecoveryInFlightRef.current = false;
    loginInFlightRef.current = false;
    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    clearAuthenticatedAppState();
    setAuthError(null);
    setAuthLoading(false);

    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
  };

  // Persistent session listener and initial check
  useEffect(() => {
    isMountedRef.current = true;

    const restoreSession = async () => {
      const restoreVersion = ++authStateVersionRef.current;
      try {
        setAuthLoading(true);
        const existingSession = await getSession();
        if (!isMountedRef.current || authStateVersionRef.current !== restoreVersion) {
          return;
        }
        if (existingSession?.user) {
          await verifyAndApplySessionProfileRef.current(existingSession, {
            expectedVersion: restoreVersion,
          });
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        if (isMountedRef.current && authStateVersionRef.current === restoreVersion) {
          setAuthLoading(false);
        }
      }
    };

    restoreSession();

    // Synchronous Auth state listener — never directly awaits Supabase operations inside the callback
    const { unsubscribe } = onAuthStateChange((event, changedSession) => {
      if (!isMountedRef.current) return;

      if (event === 'PASSWORD_RECOVERY') {
        authStateVersionRef.current += 1;
        preserveAuthErrorRef.current = false;
        isPasswordRecoveryRef.current = true;
        currentUserRef.current = null;
        setIsPasswordRecovery(true);
        setSession(changedSession);
        setCurrentUser(null);
        setProfileVerificationState('idle');
        setAuthError(null);
        setAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        authStateVersionRef.current += 1;
        loginInFlightRef.current = false;
        otpRecoveryInFlightRef.current = false;
        isPasswordRecoveryRef.current = false;
        setIsPasswordRecovery(false);
        clearAuthenticatedAppState();
        setAuthLoading(false);
        if (!preserveAuthErrorRef.current) {
          setAuthError(null);
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!changedSession?.user) return;

        if (otpRecoveryInFlightRef.current || isPasswordRecoveryRef.current) {
          isPasswordRecoveryRef.current = true;
          currentUserRef.current = null;
          setIsPasswordRecovery(true);
          setSession(changedSession);
          setCurrentUser(null);
          setProfileVerificationState('idle');
          setAuthLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && loginInFlightRef.current) {
          return;
        }

        const isActiveUserTokenRefresh =
          event === 'TOKEN_REFRESHED' &&
          Boolean(
            currentUserRef.current &&
              currentUserRef.current.id === changedSession.user.id
          );

        if (isActiveUserTokenRefresh) {
          setSession(changedSession);
        }

        const eventVersion = ++authStateVersionRef.current;

        scheduleDeferredAuthTask(async () => {
          if (!isMountedRef.current || authStateVersionRef.current !== eventVersion) {
            return;
          }

          try {
            if (isActiveUserTokenRefresh) {
              const refreshLookup = await getUserProfile(changedSession.user.id);
              if (!isMountedRef.current || authStateVersionRef.current !== eventVersion) {
                return;
              }

              if (refreshLookup.status === 'ok' && refreshLookup.profile) {
                currentUserRef.current = refreshLookup.profile;
                setCurrentUser(refreshLookup.profile);
              } else if (
                refreshLookup.status === 'inactive' ||
                refreshLookup.status === 'not_found' ||
                refreshLookup.status === 'unsupported_role'
              ) {
                await verifyAndApplySessionProfileRef.current(changedSession, {
                  precomputedLookup: refreshLookup,
                  expectedVersion: eventVersion,
                });
              }
              return;
            }

            await verifyAndApplySessionProfileRef.current(changedSession, {
              expectedVersion: eventVersion,
            });
          } finally {
            if (isMountedRef.current && authStateVersionRef.current === eventVersion) {
              setAuthLoading(false);
            }
          }
        });
      }
    });

    return () => {
      isMountedRef.current = false;
      authStateVersionRef.current += 1;
      scheduledAuthTimersRef.current.forEach(timerId => clearTimeout(timerId));
      scheduledAuthTimersRef.current.clear();
      unsubscribe();
    };
  }, [clearAuthenticatedAppState, scheduleDeferredAuthTask]);

  useEffect(() => {
    checkSupabase();
    if (currentUser) {
      refreshAllData();
    }
  }, [checkSupabase, refreshAllData, currentUser]);

  // Role permissions helpers derived strictly from verified currentUser.role
  const userRole = currentUser ? resolveVerifiedUserRole(currentUser.role) : null;
  const isAdmin = userRole === 'Admin';
  const isManager = userRole === 'Manager';
  const isEditorOnly = userRole === 'Editor';

  const canManageFinance = isAdmin || isManager;
  const canManageTeam = isAdmin || isManager;
  const canCreateProject = isAdmin || isManager;
  const canManageDeliverables = isAdmin || isManager;
  const canManageProjectData = isAdmin || isManager;

  const canAccessSection = useCallback(
    (section: string): boolean => {
      if (!currentUser || !userRole) return false;
      return canAccessTab(section, userRole);
    },
    [currentUser, userRole]
  );

  const canAccessSettings = canAccessSection('settings');
  const canAccessNotifications = canAccessSection('notifications');

  const isUserActive = Boolean(
    currentUser &&
      currentUser.is_active !== false &&
      currentUser.status?.trim().toLowerCase() !== 'inactive'
  );

  // Authoritative Editor identity resolution:
  // auth.uid() -> profiles.id -> team_members.profile_id -> team_members.id
  // Fails closed (null) if unverified, non-Editor, unlinked, inactive, or ambiguous.
  const linkedEditorTeamMember = useMemo<TeamMember | null>(() => {
    return resolveLinkedEditorTeamMember({
      currentUser,
      profileVerificationState,
      teamMembers,
    });
  }, [currentUser, profileVerificationState, teamMembers]);

  const linkedEditorTeamMemberId = linkedEditorTeamMember?.id ?? null;

  // Brand Filtering logic

const matchBrand = (companyId: string) => {
  if (brandFilter === 'all') return true;

  const companyUuid =
    brandFilter === 'golden_june'
      ? '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
      : '5736bf57-b1db-4896-a4df-4963ded1c4c6';

  return companyId === brandFilter || companyId === companyUuid;
};

  // Deliverables list visibility: brand filter only (all deliverables remain visible to linked and unlinked Editors;
  // row-level edit ownership is tracked separately via linkedEditorTeamMemberId and canManageDeliverables)
  const filteredDeliverables = deliverables.filter(d => matchBrand(d.company_id));

  const filteredProjects = projects.filter(p => matchBrand(p.company_id));

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

  const deleteEnquiry = async (id: string) => {
    await apiService.deleteEnquiry(id);
    await refreshAllData();
  };

  const deliverableActions = createAppDeliverableActions({
    currentUser,
    userRole,
    isUserActive,
    deliverables,
    deliverableCatalogue,
    enquiries,
    linkedEditorTeamMember,
    linkedEditorTeamMemberId,
    api: apiService,
    setDeliverables,
    setDeliverableCatalogue,
    refreshAllData,
  });

  const {
    createDeliverableCatalogueItem,
    updateDeliverableCatalogueItem,
    reorderDeliverableCatalogue,
    deleteDeliverableCatalogueItem,
    createDeliverable,
    updateDeliverable,
    updateDeliverableAsEditor,
    deleteDeliverable,
    updateDeliverableStatus,
  } = deliverableActions;

  const createQuotation = async (quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await apiService.createQuotation(quotation);
    await refreshAllData();
    return created;
  };

  const updateQuotation = async (quotation: Quotation) => {
    const updated = await apiService.updateQuotation(quotation);
    await refreshAllData();
    return updated;
  };

  const deleteQuotation = async (id: string) => {
    await apiService.deleteQuotation(id);
    await refreshAllData();
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
    await apiService.removeTeamAssignment(assignmentId);
    setProjectTeam(prev => prev.filter(a => a.id !== assignmentId));
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
    const updated = await apiService.updateProjectData(data);
    setProjectData(prev => prev.map(d => (d.id === data.id ? updated : d)));
    await refreshAllData();
    return updated;
  };

  const deleteProjectData = async (id: string) => {
    await apiService.deleteProjectData(id);
    setProjectData(prev => prev.filter(d => d.id !== id));
    await refreshAllData();
  };

  // Deliverable mutations (createDeliverable, updateDeliverable, updateDeliverableAsEditor,
  // deleteDeliverable, updateDeliverableStatus) are provided by deliverableActions above.

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

  const updateCalendarEvent = async (event: CalendarEvent) => {
    const updated = await apiService.updateCalendarEvent(event);
    await refreshAllData();
    return updated;
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
        authError,
        clearAuthError,
        profileVerificationState,
        retryProfileVerification,
        isPasswordRecovery,
        requestPasswordReset,
        verifyPasswordRecoveryOtp,
        completePasswordRecovery,
        login,
        logout,
        refreshUserProfile,
        availableProfiles,
        activeTab,
        setActiveTab,
        selectedProjectId,
        setSelectedProjectId,
        selectedEnquiryId,
        setSelectedEnquiryId,
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
        enquiriesError,
        moduleErrors,
        clearModuleError,
        isRefreshingData,
        resolveItemCompanyId,
        refreshAllData,
        createProject,
        updateProject,
        deleteProject,
        createEnquiry,
        updateEnquiry,
        deleteEnquiry,
        deliverableCatalogue,
        createDeliverableCatalogueItem,
        updateDeliverableCatalogueItem,
        reorderDeliverableCatalogue,
        deleteDeliverableCatalogueItem,
        quotations,
        createQuotation,
        updateQuotation,
        deleteQuotation,
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
        updateDeliverableAsEditor,
        deleteDeliverable,
        updateDeliverableStatus,
        createPayment,
        createExpense,
        updateExpense,
        deleteExpense,
        updatePayment,
        deletePayment,
        createCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        markNotificationRead,
        markNotificationAsRead: markNotificationRead,
        markAllNotificationsRead,
        updateCompany,
        canAccessSection,
        canManageFinance,
        canManageTeam,
        canCreateProject,
        canManageDeliverables,
        canManageProjectData,
        canAccessSettings,
        canAccessNotifications,
        linkedEditorTeamMember,
        linkedEditorTeamMemberId,
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
