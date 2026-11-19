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
  getAuthoritativeAuthUser,
  refreshAuthSession,
  getUserProfile,
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
import { completeInvitePasswordSetup } from '../services/editorAccounts';
import {
  createAuthOnboardingCoordinator,
  isRecoveryUrlPresent,
  parseSupabaseAuthUrlError,
} from '../utils/inviteOnboarding';
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
import { validateDeliverableEditorAssignment } from '../utils/teamMemberFilters';

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
  isInvitePasswordSetupRequired: boolean;
  isInviteSyncPending: boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasswordRecoveryOtp: (
    email: string,
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  completePasswordRecovery: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  completeEditorInvitePasswordSetup: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  retryEditorInviteSessionSync: () => Promise<{ success: boolean; error?: string }>;
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
  teamMembers?: TeamMember[];
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
    if (deps.teamMembers && deliverable.assigned_editor_id?.trim()) {
      const assignmentCheck = validateDeliverableEditorAssignment({
        targetEditorId: deliverable.assigned_editor_id,
        previousEditorId: null,
        teamMembers: deps.teamMembers,
      });
      if (!assignmentCheck.valid) {
        throw new Error(
          assignmentCheck.reason ||
            'Inactive or non-Editor team members cannot be assigned to new deliverables.'
        );
      }
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
      if (deps.teamMembers && deliverable.assigned_editor_id?.trim()) {
        const existing = deps.deliverables.find(d => d.id === deliverable.id) || null;
        const assignmentCheck = validateDeliverableEditorAssignment({
          targetEditorId: deliverable.assigned_editor_id,
          previousEditorId: existing?.assigned_editor_id ?? null,
          teamMembers: deps.teamMembers,
        });
        if (!assignmentCheck.valid) {
          throw new Error(
            assignmentCheck.reason ||
              'Inactive or non-Editor team members cannot be assigned to deliverables.'
          );
        }
      }
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
    const urlError = parseSupabaseAuthUrlError(window.location);
    if (urlError.hasError) return false;
    return isRecoveryUrlPresent(window.location);
  });
  const [isInvitePasswordSetupRequired, setIsInvitePasswordSetupRequired] =
    useState<boolean>(false);
  const [isInviteSyncPending, setIsInviteSyncPending] = useState<boolean>(false);
  const currentUserRef = React.useRef<Profile | null>(null);
  const activeTabRef = React.useRef<string>(activeTab);
  const [availableProfiles] = useState<Profile[]>([]);

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


  const clearDomainData = useCallback(() => {
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

  const authCoordinatorRef = React.useRef<ReturnType<
    typeof createAuthOnboardingCoordinator
  > | null>(null);

  if (!authCoordinatorRef.current) {
    authCoordinatorRef.current = createAuthOnboardingCoordinator({
      initialIsPasswordRecovery: isPasswordRecovery,
      getSession: () => getSession(),
      getAuthoritativeAuthUser: () => getAuthoritativeAuthUser(),
      refreshAuthSession: () => refreshAuthSession(),
      getUserProfile: (userId: string) => getUserProfile(userId),
      signInWithEmail: (email: string, password: string) =>
        signInWithEmail(email, password),
      signOut: () => signOut(),
      resetPasswordForEmail: (email: string) => resetPasswordForEmail(email),
      verifyRecoveryOtp: (email: string, token: string) =>
        verifyRecoveryOtp(email, token),
      updateUserPassword: (newPassword: string) => updateUserPassword(newPassword),
      completeInvitePasswordSetup: (newPassword: string) =>
        completeInvitePasswordSetup(newPassword),
      canAccessTab: (tab: string, role: UserRole) => canAccessTab(tab, role),
      getDefaultLandingTab: (role?: UserRole | string | null) =>
        getDefaultLandingTab(role),
      getActiveTab: () => activeTabRef.current,
      setActiveTab: (nextTab: string) => {
        activeTabRef.current = nextTab;
        setActiveTabState(nextTab);
      },
      getLocation: () =>
        typeof window !== 'undefined'
          ? {
              pathname: window.location.pathname,
              search: window.location.search,
              hash: window.location.hash,
            }
          : undefined,
      replaceUrl: (cleanedPath: string) => {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, cleanedPath);
        }
      },
      onSessionChange: nextSession => setSession(nextSession),
      onCurrentUserChange: nextUser => {
        currentUserRef.current = nextUser;
        setCurrentUser(nextUser);
      },
      onAuthLoadingChange: nextLoading => setAuthLoading(nextLoading),
      onAuthErrorChange: nextError => setAuthError(nextError),
      onProfileVerificationStateChange: nextState =>
        setProfileVerificationState(nextState),
      onPasswordRecoveryChange: nextRecovery => setIsPasswordRecovery(nextRecovery),
      onInvitePasswordSetupRequiredChange: nextRequired =>
        setIsInvitePasswordSetupRequired(nextRequired),
      onInviteSyncPendingChange: nextPending => setIsInviteSyncPending(nextPending),
      onClearDomainData: clearDomainData,
    });
  }

  const clearAuthError = useCallback(() => {
    authCoordinatorRef.current?.clearAuthError();
  }, []);

  const refreshUserProfile = useCallback(async (): Promise<Profile | null> => {
    if (!authCoordinatorRef.current) return null;
    return authCoordinatorRef.current.refreshUserProfile();
  }, []);

  const retryProfileVerification = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authCoordinatorRef.current) return { success: false };
    return authCoordinatorRef.current.retryProfileVerification();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.login(email, password);
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.requestPasswordReset(email);
  };

  const verifyPasswordRecoveryOtp = async (
    email: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.verifyPasswordRecoveryOtp(email, token);
  };

  const completePasswordRecovery = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.completePasswordRecovery(newPassword);
  };

  const completeEditorInvitePasswordSetup = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.completeEditorInvitePasswordSetup(newPassword);
  };

  const retryEditorInviteSessionSync = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!authCoordinatorRef.current) {
      return { success: false, error: 'Authentication service is unavailable.' };
    }
    return authCoordinatorRef.current.retryEditorInviteSessionSync();
  };

  const logout = async (): Promise<void> => {
    if (!authCoordinatorRef.current) return;
    await authCoordinatorRef.current.logout();
  };

  // Persistent session listener and initial check
  useEffect(() => {
    const coordinator = authCoordinatorRef.current;
    if (!coordinator) return;

    coordinator.activate();
    coordinator.restoreSession();

    const { unsubscribe } = onAuthStateChange((event, changedSession) => {
      coordinator.handleAuthStateChange(event, changedSession);
    });

    return () => {
      coordinator.dispose();
      unsubscribe();
    };
  }, []);

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
  // Fails closed (null) if unverified, non-Editor, unlinked, inactive profile, or ambiguous.
  // Team Member directory activity is independent of portal login activity.
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
    teamMembers,
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
        isInvitePasswordSetupRequired,
        isInviteSyncPending,
        requestPasswordReset,
        verifyPasswordRecoveryOtp,
        completePasswordRecovery,
        completeEditorInvitePasswordSetup,
        retryEditorInviteSessionSync,
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
