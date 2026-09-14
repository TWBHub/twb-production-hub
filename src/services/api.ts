import { getSupabaseClient } from '../lib/supabase';
import {
  Company,
  Client,
  Enquiry,
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
  UserRole,
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_CLIENTS,
  INITIAL_ENQUIRIES,
  INITIAL_TEAM_MEMBERS,
  INITIAL_EDITORS,
  INITIAL_PROJECTS,
  INITIAL_PROJECT_TEAM,
  INITIAL_PROJECT_DATA,
  INITIAL_DELIVERABLES,
  INITIAL_PAYMENTS,
  INITIAL_EXPENSES,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_NOTIFICATIONS,
} from './seedData';

// Cache keys for resilient persistent storage when offline or before Supabase sync
const STORAGE_PREFIX = 'twbhub_';

function getStoredOrInitial<T>(key: string, initial: T): T {
  if (typeof window === 'undefined') return initial;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

function saveToStorage<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
}

export const apiService = {
  // Connection tester
  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        connected: false,
        message: 'No active Supabase configuration detected. Enter your Supabase URL and Anon Key in Settings or .env.',
      };
    }

    try {
      // Test querying companies or checking auth session
      const { data, error } = await supabase.from('companies').select('count', { count: 'exact', head: true });
      if (error) {
        return {
          connected: false,
          message: `Supabase returned an error: ${error.message} (Check your table schemas or RLS rules).`,
          details: error,
        };
      }
      return {
        connected: true,
        message: 'Successfully connected to Supabase PostgreSQL database!',
        details: { count: data },
      };
    } catch (err: any) {
      return {
        connected: false,
        message: `Connection attempt failed: ${err.message || 'Unknown network error'}`,
        details: err,
      };
    }
  },

  // COMPANIES
  async getCompanies(): Promise<Company[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('companies').select('*');
      if (!error && data && data.length > 0) {
        saveToStorage('companies', data);
        return data as Company[];
      }
    }
    return getStoredOrInitial('companies', INITIAL_COMPANIES);
  },

  async updateCompany(company: Company): Promise<Company> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('companies').upsert(company);
    }
    const current = await this.getCompanies();
    const updated = current.map(c => (c.id === company.id ? company : c));
    saveToStorage('companies', updated);
    return company;
  },

  // CLIENTS
  async getClients(): Promise<Client[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('clients', data);
        return data as Client[];
      }
    }
    return getStoredOrInitial('clients', INITIAL_CLIENTS);
  },

  async createClient(client: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    const newClient: Client = {
      ...client,
      id: 'c-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('clients').insert(newClient);
    }
    const current = await this.getClients();
    const updated = [newClient, ...current];
    saveToStorage('clients', updated);
    return newClient;
  },

  async updateClient(client: Client): Promise<Client> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('clients').update(client).eq('id', client.id);
    }
    const current = await this.getClients();
    const updated = current.map(c => (c.id === client.id ? client : c));
    saveToStorage('clients', updated);
    return client;
  },

  // ENQUIRIES
  async getEnquiries(): Promise<Enquiry[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('enquiries', data);
        return data as Enquiry[];
      }
    }
    return getStoredOrInitial('enquiries', INITIAL_ENQUIRIES);
  },

  async createEnquiry(enquiry: Omit<Enquiry, 'id' | 'created_at'>): Promise<Enquiry> {
    const newEnquiry: Enquiry = {
      ...enquiry,
      id: 'enq-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('enquiries').insert(newEnquiry);
    }
    const current = await this.getEnquiries();
    const updated = [newEnquiry, ...current];
    saveToStorage('enquiries', updated);

    // Auto generate notification
    await this.createNotification({
      title: 'New Wedding Lead Received',
      message: `${newEnquiry.client_name} enquired for ${newEnquiry.venue} ($${newEnquiry.estimated_budget.toLocaleString()})`,
      type: 'new_enquiry',
      read: false,
      link: 'enquiries',
    });

    return newEnquiry;
  },

  async updateEnquiry(enquiry: Enquiry): Promise<Enquiry> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('enquiries').update(enquiry).eq('id', enquiry.id);
    }
    const current = await this.getEnquiries();
    const updated = current.map(e => (e.id === enquiry.id ? enquiry : e));
    saveToStorage('enquiries', updated);
    return enquiry;
  },

  // PROJECTS
  async getProjects(): Promise<Project[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('projects').select('*').order('wedding_date_start', { ascending: true });
      if (!error && data && data.length > 0) {
        saveToStorage('projects', data);
        return data as Project[];
      }
    }
    return getStoredOrInitial('projects', INITIAL_PROJECTS);
  },

  async createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
    const newPrj: Project = {
      ...project,
      id: 'prj-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('projects').insert(newPrj);
    }
    const current = await this.getProjects();
    const updated = [newPrj, ...current];
    saveToStorage('projects', updated);

    // Auto-create calendar event for the wedding
    await this.createCalendarEvent({
      company_id: newPrj.company_id,
      project_id: newPrj.id,
      title: `Wedding: ${newPrj.name}`,
      event_type: 'Wedding',
      start_time: `${newPrj.wedding_date_start}T09:00:00Z`,
      end_time: `${newPrj.wedding_date_end}T23:00:00Z`,
      location: `${newPrj.venue}, ${newPrj.city}`,
      notes: `Package: ${newPrj.package_name}`,
    });

    return newPrj;
  },

  async updateProject(project: Project): Promise<Project> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('projects').update(project).eq('id', project.id);
    }
    const current = await this.getProjects();
    const updated = current.map(p => (p.id === project.id ? project : p));
    saveToStorage('projects', updated);
    return project;
  },

  // TEAM & CONFLICT DETECTION
  async getTeamMembers(): Promise<TeamMember[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('team_members').select('*');
      if (!error && data && data.length > 0) {
        saveToStorage('team_members', data);
        return data as TeamMember[];
      }
    }
    return getStoredOrInitial('team_members', INITIAL_TEAM_MEMBERS);
  },

  async getEditors(): Promise<Editor[]> {
    return getStoredOrInitial('editors', INITIAL_EDITORS);
  },

  async getProjectTeam(): Promise<ProjectTeamAssignment[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('project_team').select('*');
      if (!error && data && data.length > 0) {
        saveToStorage('project_team', data);
        return data as ProjectTeamAssignment[];
      }
    }
    return getStoredOrInitial('project_team', INITIAL_PROJECT_TEAM);
  },

  // Check double-booking conflict
  async checkTeamConflict(
    teamMemberId: string,
    assignmentDate: string,
    excludeProjectId?: string
  ): Promise<{ hasConflict: boolean; conflictingProject?: Project; memberName?: string }> {
    const assignments = await this.getProjectTeam();
    const teamMembers = await this.getTeamMembers();
    const projects = await this.getProjects();

    const member = teamMembers.find(m => m.id === teamMemberId);
    const existingAssignment = assignments.find(
      a => a.team_member_id === teamMemberId && a.assignment_date === assignmentDate && a.project_id !== excludeProjectId
    );

    if (existingAssignment) {
      const conflictingProject = projects.find(p => p.id === existingAssignment.project_id);
      return {
        hasConflict: true,
        conflictingProject,
        memberName: member?.name || 'Team Member',
      };
    }

    return { hasConflict: false };
  },

  async assignTeamMember(
    assignment: Omit<ProjectTeamAssignment, 'id'>,
    adminOverride: boolean = false
  ): Promise<{ success: boolean; conflictError?: string; assignment?: ProjectTeamAssignment }> {
    const conflict = await this.checkTeamConflict(assignment.team_member_id, assignment.assignment_date, assignment.project_id);

    if (conflict.hasConflict && !adminOverride) {
      return {
        success: false,
        conflictError: `DOUBLE BOOKING CONFLICT: ${conflict.memberName} is already assigned on ${assignment.assignment_date} to project "${conflict.conflictingProject?.name || 'Another Project'}". Admin override is required to proceed.`,
      };
    }

    const newAssignment: ProjectTeamAssignment = {
      ...assignment,
      id: 'pt-' + Date.now(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('project_team').insert(newAssignment);
    }
    const current = await this.getProjectTeam();
    const updated = [...current, newAssignment];
    saveToStorage('project_team', updated);

    if (conflict.hasConflict && adminOverride) {
      await this.createNotification({
        title: 'Admin Override: Team Double Booking',
        message: `${conflict.memberName} was double-booked on ${assignment.assignment_date} via Admin override.`,
        type: 'booking_conflict',
        read: false,
        link: 'team-availability',
      });
    }

    return { success: true, assignment: newAssignment };
  },

  async removeTeamAssignment(assignmentId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('project_team').delete().eq('id', assignmentId);
    }
    const current = await this.getProjectTeam();
    const updated = current.filter(a => a.id !== assignmentId);
    saveToStorage('project_team', updated);
  },

  // PROJECT DATA (METADATA ONLY - NO LARGE MEDIA IN DB)
  async getProjectData(): Promise<ProjectData[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('project_data').select('*').order('date_recorded', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('project_data', data);
        return data as ProjectData[];
      }
    }
    return getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
  },

  async createProjectData(dataItem: Omit<ProjectData, 'id'>): Promise<ProjectData> {
    const newItem: ProjectData = {
      ...dataItem,
      id: 'pdata-' + Date.now(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('project_data').insert(newItem);
    }
    const current = await this.getProjectData();
    const updated = [newItem, ...current];
    saveToStorage('project_data', updated);
    return newItem;
  },

  async updateProjectData(dataItem: ProjectData): Promise<ProjectData> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('project_data').update(dataItem).eq('id', dataItem.id);
    }
    const current = await this.getProjectData();
    const updated = current.map(d => (d.id === dataItem.id ? dataItem : d));
    saveToStorage('project_data', updated);
    return dataItem;
  },

  async deleteProjectData(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('project_data').delete().eq('id', id);
    }
    const current = await this.getProjectData();
    saveToStorage('project_data', current.filter(d => d.id !== id));
  },

  // DELIVERABLES
  async getDeliverables(): Promise<Deliverable[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('deliverables').select('*').order('due_date', { ascending: true });
      if (!error && data && data.length > 0) {
        saveToStorage('deliverables', data);
        return data as Deliverable[];
      }
    }
    return getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
  },

  async createDeliverable(deliverable: Omit<Deliverable, 'id' | 'last_updated'>): Promise<Deliverable> {
    const newDel: Deliverable = {
      ...deliverable,
      id: 'del-' + Date.now(),
      last_updated: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('deliverables').insert(newDel);
    }
    const current = await this.getDeliverables();
    const updated = [...current, newDel];
    saveToStorage('deliverables', updated);

    // Add calendar deadline
    await this.createCalendarEvent({
      company_id: newDel.company_id,
      project_id: newDel.project_id,
      title: `Deadline: ${newDel.deliverable_type}`,
      event_type: 'Deliverable Deadline',
      start_time: `${newDel.due_date}T17:00:00Z`,
      end_time: `${newDel.due_date}T18:00:00Z`,
      location: 'Review Portal',
      notes: `Priority: ${newDel.priority}`,
    });

    return newDel;
  },

  async updateDeliverableStatus(
    deliverableId: string,
    newStatus: DeliverableStatus,
    updaterRole: UserRole,
    updaterName: string
  ): Promise<Deliverable> {
    const deliverables = await this.getDeliverables();
    const target = deliverables.find(d => d.id === deliverableId);
    if (!target) throw new Error('Deliverable not found');

    const updated: Deliverable = {
      ...target,
      status: newStatus,
      last_updated: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('deliverables').update(updated).eq('id', deliverableId);
    }

    const updatedList = deliverables.map(d => (d.id === deliverableId ? updated : d));
    saveToStorage('deliverables', updatedList);

    // Requirement: When an editor changes a deliverable status, create a notification for the appropriate Admin/Manager
    const projects = await this.getProjects();
    const project = projects.find(p => p.id === target.project_id);

    await this.createNotification({
      title: `Deliverable Status: ${newStatus}`,
      message: `${updaterName} (${updaterRole}) marked "${target.deliverable_type}" as "${newStatus}" for ${project?.name || 'Project'}.`,
      type: 'deliverable_status',
      read: false,
      link: 'deliverables',
    });

    return updated;
  },

  // FINANCE: PAYMENTS & EXPENSES
  async getPayments(): Promise<Payment[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('payments').select('*').order('payment_date', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('payments', data);
        return data as Payment[];
      }
    }
    return getStoredOrInitial('payments', INITIAL_PAYMENTS);
  },

  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const newPayment: Payment = {
      ...payment,
      id: 'pay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('payments').insert(newPayment);
    }
    const current = await this.getPayments();
    const updated = [newPayment, ...current];
    saveToStorage('payments', updated);

    // Create notification
    await this.createNotification({
      title: `Payment Received ($${newPayment.amount.toLocaleString()})`,
      message: `Received $${newPayment.amount.toLocaleString()} via ${newPayment.payment_mode} (Receipt #${newPayment.receipt_number}).`,
      type: 'payment_received',
      read: false,
      link: 'finance',
    });

    return newPayment;
  },

  async getExpenses(): Promise<Expense[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('expenses', data);
        return data as Expense[];
      }
    }
    return getStoredOrInitial('expenses', INITIAL_EXPENSES);
  },

  async createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('expenses').insert(newExpense);
    }
    const current = await this.getExpenses();
    const updated = [newExpense, ...current];
    saveToStorage('expenses', updated);
    return newExpense;
  },

  // CALENDAR
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('calendar_events').select('*').order('start_time', { ascending: true });
      if (!error && data && data.length > 0) {
        saveToStorage('calendar_events', data);
        return data as CalendarEvent[];
      }
    }
    return getStoredOrInitial('calendar_events', INITIAL_CALENDAR_EVENTS);
  },

  async createCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      ...event,
      id: 'evt-' + Date.now(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('calendar_events').insert(newEvent);
    }
    const current = await this.getCalendarEvents();
    const updated = [...current, newEvent];
    saveToStorage('calendar_events', updated);
    return newEvent;
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('calendar_events').delete().eq('id', id);
    }
    const current = await this.getCalendarEvents();
    saveToStorage('calendar_events', current.filter(e => e.id !== id));
  },

  // NOTIFICATIONS
  async getNotifications(): Promise<AppNotification[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        saveToStorage('notifications', data);
        return data as AppNotification[];
      }
    }
    return getStoredOrInitial('notifications', INITIAL_NOTIFICATIONS);
  },

  async createNotification(notif: Omit<AppNotification, 'id' | 'created_at'>): Promise<AppNotification> {
    const newNotif: AppNotification = {
      ...notif,
      id: 'notif-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('notifications').insert(newNotif);
    }
    const current = await this.getNotifications();
    const updated = [newNotif, ...current];
    saveToStorage('notifications', updated);
    return newNotif;
  },

  async markNotificationRead(id: string): Promise<void> {
    const current = await this.getNotifications();
    const updated = current.map(n => (n.id === id ? { ...n, read: true } : n));
    saveToStorage('notifications', updated);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    const current = await this.getNotifications();
    const updated = current.map(n => ({ ...n, read: true }));
    saveToStorage('notifications', updated);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('notifications').update({ read: true });
    }
  },
};
