import { getSupabaseClient } from '../lib/supabase';
import {
  Company,
  Client,
  Enquiry,
  TeamMember,
  Editor,
  Project,
  ProjectEvent,
  ProjectStatus,
  ClientHddStatus,
  ProjectTeamAssignment,
  ProjectData,
  StorageDropdownOption,
  StorageTypeOption,
  StorageStatusOption,
  STORAGE_DROPDOWN_OPTIONS,
  STORAGE_TYPE_OPTIONS,
  STORAGE_STATUS_OPTIONS,
  Deliverable,
  DeliverableType,
  DeliverablePriority,
  Payment,
  PaymentMode,
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
import { sortProjectEvents } from '../utils/eventUtils';
import { normalizeStorageRecord } from '../utils/storageUtils';
import {
  parseDeliverableNotes,
  serializeDeliverableNotes,
  prepareDeliverableForCreate,
} from '../utils/deliverableMilestones';

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

// Helper functions for mapping between frontend Project model and public.projects database schema
export const mapSupabaseProjectToModel = (row: any): Project => {
  let meta: any = {};
  let userNotes = row.notes || '';

  if (
    typeof userNotes === 'string' &&
    (userNotes.startsWith('{') || userNotes.startsWith('__METADATA__:'))
  ) {
    try {
      const jsonStr = userNotes.startsWith('__METADATA__:')
        ? userNotes.replace('__METADATA__:', '')
        : userNotes;

      meta = JSON.parse(jsonStr);
      userNotes =
        meta.user_notes !== undefined ? meta.user_notes : '';
    } catch {
      // Keep original notes if they are not valid JSON
    }
  }

  const companyId =
    row.company_id === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
      ? 'golden_june'
      : row.company_id === '5736bf57-b1db-4896-a4df-4963ded1c4c6'
        ? 'twb'
        : 'twb';

  return {
    id: row.id,
    company_id: companyId,
    client_id: row.client_id || '',
    name: row.project_name || row.name || 'Wedding Project',
    wedding_date_start:
      row.start_date || row.wedding_date_start || '',
    wedding_date_end:
      row.end_date ||
      row.wedding_date_end ||
      row.start_date ||
      '',
    venue: row.venue || 'Principal Venue',
    city: row.city || '',
    client_contact:
      meta.client_contact ||
      row.client_contact || {
        phone: '',
        email: '',
      },
    status:
  row.status === 'enquiry'
    ? 'Enquiry'
    : row.status === 'confirmed'
      ? 'Booked'
      : row.status === 'shoot_completed'
        ? 'Shoot Completed'
        : row.status === 'editing'
          ? 'Editing'
          : row.status === 'review'
            ? 'Review'
            : row.status === 'delivery'
              ? 'Delivered'
              : row.status === 'completed'
                ? 'Archived'
                : 'Enquiry',
    package_name:
      meta.package_name ||
      row.package_name ||
      'Signature Wedding Cinema & Photography',
    package_details:
      meta.package_details ||
      row.package_details ||
      '',
    booking_amount: Number(row.booking_amount) || 0,
    total_amount:
      Number(meta.total_amount ?? row.total_amount) ||
      Number(row.booking_amount) ||
      0,
    notes: userNotes,
    client_hdd_status:
      (meta.client_hdd_status as ClientHddStatus) ||
      (row.client_hdd_status as ClientHddStatus) ||
      'Not Received',
    booking_payment_error: meta.booking_payment_error || undefined,
    created_at:
      row.created_at || new Date().toISOString(),
  };
};

export const mapModelToSupabaseProject = (prj: Project | Omit<Project, 'created_at'>) => {
  return {
    id: prj.id,
    company_id: prj.company_id,
    client_id: prj.client_id || null,
    project_name: prj.name,
    start_date: prj.wedding_date_start,
    end_date: prj.wedding_date_end,
    venue: prj.venue,
    city: prj.city,
    status: prj.status,
    booking_amount: prj.booking_amount,
    notes: JSON.stringify({
      user_notes: prj.notes || '',
      package_name: prj.package_name,
      package_details: prj.package_details,
      total_amount: prj.total_amount,
      client_contact: prj.client_contact,
      client_hdd_status: prj.client_hdd_status || 'Not Received',
      booking_payment_error: prj.booking_payment_error || undefined,
    }),
  };
};

export const toCompanyUuid = (cid: 'twb' | 'golden_june' | string) => {
  if (cid === 'golden_june' || cid === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec') {
    return '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec';
  }
  return '5736bf57-b1db-4896-a4df-4963ded1c4c6';
};

export const mapSupabaseDeliverableToModel = (row: any): Deliverable => {
  const companyId =
    row.company_id === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec' || row.company_id === 'golden_june'
      ? 'golden_june'
      : 'twb';

  const { userNotes, metadata } = parseDeliverableNotes(row.notes);

  return {
    id: row.id,
    project_id: row.project_id || '',
    company_id: companyId,
    deliverable_type: row.deliverable_type || row.name || 'Highlight Film (4-5 mins)',
    assigned_editor_id: row.assigned_editor_id || '',
    due_date: row.due_date || '',
    status: (row.status || '') as DeliverableStatus,
    priority: (row.priority || 'Medium') as DeliverablePriority,
    external_link: row.external_link || undefined,
    notes: userNotes || undefined,
    client_feedback: row.client_feedback || undefined,
    review_status: row.review_status || undefined,
    last_updated: row.last_updated || row.updated_at || row.created_at || new Date().toISOString(),
    assigned_at: row.assigned_at || metadata?.assigned_at || undefined,
    first_submitted_at: row.first_submitted_at || metadata?.first_submitted_at || undefined,
    delivered_at: row.delivered_at || metadata?.delivered_at || undefined,
  };
};

export const mapSupabaseProjectDataToModel = (row: any): ProjectData => {
  let meta: any = {};
  let userNotes = row.notes || '';

  if (
    typeof userNotes === 'string' &&
    (userNotes.trim().startsWith('{') || userNotes.startsWith('__METADATA__:'))
  ) {
    try {
      const jsonStr = userNotes.startsWith('__METADATA__:')
        ? userNotes.replace('__METADATA__:', '')
        : userNotes;
      meta = JSON.parse(jsonStr);
      userNotes = meta.user_notes !== undefined ? meta.user_notes : '';
    } catch {
      // Keep original notes if not JSON
    }
  }

  // Determine storage ownership (Client's | TWB's | GJ's | Other's | The Backup Drive)
  let storage: StorageDropdownOption = "TWB's";
  if (meta.storage && STORAGE_DROPDOWN_OPTIONS.includes(meta.storage)) {
    storage = meta.storage;
  } else if (row.storage && STORAGE_DROPDOWN_OPTIONS.includes(row.storage)) {
    storage = row.storage;
  } else if (
    row.responsible_person &&
    STORAGE_DROPDOWN_OPTIONS.includes(row.responsible_person as StorageDropdownOption)
  ) {
    storage = row.responsible_person as StorageDropdownOption;
  } else if (meta.company_id === 'golden_june' || row.company_id === 'golden_june') {
    storage = "GJ's";
  }

  const companyId: 'twb' | 'golden_june' =
    meta.company_id === 'golden_june' ||
    row.company_id === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec' ||
    row.company_id === 'golden_june' ||
    storage === "GJ's"
      ? 'golden_june'
      : 'twb';

  // Determine storage drive name (e.g. Sandisk, EVM, 6TB Tower, Editor's)
  let name = meta.name || row.name || '';
  if (!name) {
    if (row.description && row.description.trim()) {
      name = row.description.trim();
    } else if (
      row.storage_location &&
      !['Office', "Editor's Desk", 'Client', 'Home'].includes(row.storage_location)
    ) {
      name = row.storage_location;
    } else {
      name = 'Storage Drive';
    }
  }

  // Determine type (SSD | HDD | Drive)
  let type: StorageTypeOption = 'SSD';
  const rawType = meta.type || row.data_type || row.type || row.category;
  if (rawType && STORAGE_TYPE_OPTIONS.includes(rawType)) {
    type = rawType;
  } else if (rawType === 'HDD') {
    type = 'HDD';
  } else if (rawType === 'Tower Drive' || rawType === 'Drive') {
    type = 'Drive';
  } else if (rawType === 'SSD') {
    type = 'SSD';
  } else if (typeof row.storage_location === 'string' && /hdd/i.test(row.storage_location)) {
    type = 'HDD';
  } else if (
    typeof row.storage_location === 'string' &&
    /tower|nas|vault|archive/i.test(row.storage_location)
  ) {
    type = 'Drive';
  }

  // Determine location (Office | Editor's Desk | Client | Home | etc.)
  let location = meta.location || row.location || '';
  if (!location) {
    location = row.storage_location || 'Office';
  }

  // Determine status (Active | Archived | Delivered | Deleted)
  let status: StorageStatusOption = 'Active';
  const rawStatus = meta.status || row.status;
  if (rawStatus && STORAGE_STATUS_OPTIONS.includes(rawStatus as StorageStatusOption)) {
    status = rawStatus as StorageStatusOption;
  } else if (rawStatus === 'Archived') {
    status = 'Archived';
  } else if (rawStatus === 'Delivered') {
    status = 'Delivered';
  } else if (rawStatus === 'Deleted') {
    status = 'Deleted';
  }

  const finalNotes =
    meta.user_notes !== undefined
      ? meta.user_notes
      : (typeof userNotes === 'string' && !userNotes.trim().startsWith('{') ? userNotes : (row.description || ''));

  return {
    id: row.id,
    project_id: row.project_id || '',
    company_id: companyId,
    storage,
    name,
    type,
    location,
    notes: finalNotes,
    status,
    category: type,
    storage_location: location,
    description: name,
    folder_link: meta.folder_link || row.folder_link || '',
    responsible_person: storage,
    date_recorded:
      meta.date_recorded ||
      row.date_recorded ||
      (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
  };
};

export const buildProjectDataSupabasePayload = (
  item: ProjectData | Omit<ProjectData, 'id'>,
  idOverride?: string
) => {
  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const norm = normalizeStorageRecord(item as ProjectData);
  const recordId = idOverride || ('id' in item && isUuid(item.id) ? item.id : crypto.randomUUID());

  // Package all storage metadata safely inside notes JSON string
  const metadata = {
    user_notes: norm.notes || '',
    storage: norm.storage,
    name: norm.name,
    type: norm.type,
    location: norm.location,
    status: norm.status,
    company_id: item.company_id || (norm.storage === "GJ's" ? 'golden_june' : 'twb'),
    folder_link: item.folder_link || '',
    date_recorded: item.date_recorded || new Date().toISOString().split('T')[0],
  };

  const notesJson = JSON.stringify(metadata);

  // Return strictly only columns that exist in the actual public.project_data table schema:
  // id, project_id, name, data_type, status, notes
  return {
    id: recordId,
    project_id: item.project_id,
    name: norm.name || 'Storage Drive',
    data_type: norm.type || 'SSD',
    status: norm.status || 'Active',
    notes: notesJson,
  };
};

// Verified PostgreSQL check constraint values:
// CHECK ((payment_mode = ANY (ARRAY['cash'::text, 'upi'::text, 'bank_transfer'::text, 'card'::text, 'cheque'::text, 'other'::text])))
export type DbPaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export const mapPaymentModeToDb = (mode?: string | null): DbPaymentMode => {
  if (!mode) return 'bank_transfer';
  const clean = mode.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapping: Record<string, DbPaymentMode> = {
    cash: 'cash',
    upi: 'upi',
    bank_transfer: 'bank_transfer',
    card: 'card',
    credit_card: 'card',
    creditcard: 'card',
    cheque: 'cheque',
    check: 'cheque',
    other: 'other',
  };
  return mapping[clean] || 'bank_transfer';
};

export const mapDbToPaymentMode = (mode?: string | null): PaymentMode => {
  if (!mode) return 'Bank Transfer';
  const clean = mode.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapping: Record<string, PaymentMode> = {
    cash: 'Cash',
    upi: 'UPI',
    bank_transfer: 'Bank Transfer',
    card: 'Credit Card',
    credit_card: 'Credit Card',
    creditcard: 'Credit Card',
    cheque: 'Cheque',
    check: 'Cheque',
  };
  return mapping[clean] || 'Bank Transfer';
};

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
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      saveToStorage('clients', data);
      return data as Client[];
    }

    console.error('Failed to load clients from Supabase:', error);
  }

  return getStoredOrInitial('clients', INITIAL_CLIENTS);
},

  async createClient(client: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();

    if (error) {
      console.error('Failed to create client in Supabase:', error);
      throw new Error(`Could not create client: ${error.message}`);
    }

    const newClient = data as Client;

    const current = await this.getClients();
    const updated = [newClient, ...current.filter(c => c.id !== newClient.id)];
    saveToStorage('clients', updated);

    return newClient;
  }

  // Local fallback only when Supabase isn't configured
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };

  const current = await this.getClients();
  const updated = [newClient, ...current.filter(c => c.id !== newClient.id)];
  saveToStorage('clients', updated);

  return newClient;
},

  async updateClient(client: Client): Promise<Client> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('clients')
        .update({
          company_id: client.company_id,
          name: client.name,
          partner_name: client.partner_name,
          email: client.email,
          phone: client.phone,
          alternate_phone: client.alternate_phone,
          address: client.address,
          city: client.city,
          notes: client.notes,
          instagram: client.instagram,
          instagram_2: client.instagram_2,
        })
        .eq('id', client.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update client in Supabase:', error);
        throw new Error(`Could not update client: ${error.message}`);
      }

      const updatedClient = data as Client;

      const current = await this.getClients();
      const updated = current.map(c =>
        c.id === updatedClient.id ? updatedClient : c
      );
      saveToStorage('clients', updated);

      return updatedClient;
    }

    // Local fallback only when Supabase isn't configured
    const current = await this.getClients();
    const updatedClient = {
      ...current.find(c => c.id === client.id),
      ...client,
    } as Client;

    const updated = current.map(c =>
      c.id === updatedClient.id ? updatedClient : c
    );

    saveToStorage('clients', updated);

    return updatedClient;
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
    const attachClauses = (list: Project[]): Project[] => {
      if (typeof window === 'undefined') return list;
      return list.map(p => {
        if (p.terms_clauses && p.terms_clauses.length > 0) return p;
        try {
          const stored = localStorage.getItem(`project_terms_${p.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return { ...p, terms_clauses: parsed };
            }
          }
        } catch {
          // ignore
        }
        return p;
      });
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching projects from Supabase:', error);
        throw new Error(`Failed to fetch projects from Supabase: ${error.message}`);
      }

      // If Supabase returns zero rows, return empty list (do not fallback to localStorage)
      if (!data || data.length === 0) {
        saveToStorage('projects', []);
        return [];
      }

      // Query project_events for all projects from Supabase
      let allEvents: any[] = [];
      const { data: eventsData, error: eventsErr } = await supabase
        .from('project_events')
        .select('*')
        .order('event_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (eventsErr) {
        console.warn('Could not fetch project_events from Supabase:', eventsErr);
      } else if (eventsData) {
        allEvents = eventsData;
      }

      const cachedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
      const projectsWithEvents = data.map((row: any) => {
        const matchedEvents = allEvents.filter((e: any) => e.project_id === row.id);
        const cachedMatch = cachedProjects.find((p: Project) => p.id === row.id);
        const mapped = {
          ...mapSupabaseProjectToModel(row),
          company_id:
            row.company_id === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
              ? 'golden_june'
              : 'twb',
        };
        if (!mapped.booking_payment_error && cachedMatch?.booking_payment_error) {
          mapped.booking_payment_error = cachedMatch.booking_payment_error;
        }
        return {
          ...mapped,
          events: sortProjectEvents(matchedEvents),
        };
      });

      saveToStorage('projects', projectsWithEvents);
      return attachClauses(projectsWithEvents as Project[]);
    }
    const stored = getStoredOrInitial('projects', INITIAL_PROJECTS);
    const storedWithEvents = stored.map((p: Project) => {
      let events = p.events;
      if (!events || events.length === 0) {
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(`project_events_${p.id}`);
            if (cached) {
              events = JSON.parse(cached);
            }
          } catch {}
        }
      }
      return {
        ...p,
        client_hdd_status: p.client_hdd_status || 'Not Received',
        events: events && events.length > 0 ? sortProjectEvents(events) : events,
      };
    });
    return attachClauses(storedWithEvents);
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching project ${projectId} from Supabase:`, error);
        throw new Error(`Failed to fetch project from Supabase: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const events = await this.getProjectEvents(projectId);
      const mapped = mapSupabaseProjectToModel(data);
      const project: Project = {
        ...mapped,
        company_id:
          data.company_id === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
            ? 'golden_june'
            : 'twb',
        events: sortProjectEvents(events),
      };

      if (typeof window !== 'undefined' && (!project.terms_clauses || project.terms_clauses.length === 0)) {
        try {
          const stored = localStorage.getItem(`project_terms_${project.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              project.terms_clauses = parsed;
            }
          }
        } catch {}
      }

      return project;
    }

    // Fallback ONLY when Supabase is not configured
    const all = await this.getProjects();
    const found = all.find(p => p.id === projectId);
    return found || null;
  },

  async getProjectEvents(projectId: string): Promise<ProjectEvent[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('project_events')
        .select('*')
        .eq('project_id', projectId)
        .order('event_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        console.error(`Error querying project_events for ${projectId} from Supabase:`, error);
        throw new Error(`Failed to fetch project events from Supabase: ${error.message}`);
      }

      // Supabase is authoritative. Return actual result even if zero rows.
      const sorted = sortProjectEvents((data || []) as ProjectEvent[]);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`project_events_${projectId}`, JSON.stringify(sorted));
        } catch {}
      }
      return sorted;
    }

    // Fallback ONLY when Supabase is not configured
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`project_events_${projectId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? sortProjectEvents(parsed) : [];
        }
      } catch {}
    }

    // Check cached project object
    const storedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
    const matched = storedProjects.find((p: Project) => p.id === projectId);
    if (matched && matched.events && matched.events.length > 0) {
      return sortProjectEvents(matched.events);
    }

    return [];
  },

  async createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
    const supabase = getSupabaseClient();

    const projectId = crypto.randomUUID();

    const companyUuid =
      project.company_id === 'golden_june'
        ? '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
        : '5736bf57-b1db-4896-a4df-4963ded1c4c6';

    const newProject: Project = {
      ...project,
      id: projectId,
      company_id: project.company_id,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      const projectPayload = {
        id: projectId,
        company_id: companyUuid,
        client_id: project.client_id || null,
        project_name: project.name,
        start_date: project.wedding_date_start,
        end_date: project.wedding_date_end,
        venue: project.venue,
        city: project.city,
        status:
  project.status === 'Booked'
    ? 'confirmed'
    : project.status,
        booking_amount: project.booking_amount,
        notes: JSON.stringify({
          user_notes: project.notes || '',
          package_name: project.package_name,
          package_details: project.package_details,
          total_amount: project.total_amount,
          client_contact: project.client_contact,
          client_hdd_status: project.client_hdd_status || 'Not Received',
        }),
      };

      const { error: projectError } = await supabase
        .from('projects')
        .insert(projectPayload);

      if (projectError) {
        console.error('Failed to create project in Supabase:', projectError);
        throw new Error(`Could not create project: ${projectError.message}`);
      }

      // 1. Sync project events with Supabase
      const events = project.events || [];
      if (events.length > 0) {
        const eventPayload = events.map((event, index) => ({
          id: crypto.randomUUID(),
          project_id: projectId,
          event_name: event.event_name.trim(),
          event_date: event.event_date,
          event_time: event.event_time?.trim() || null,
          event_address: event.event_address?.trim() || null,
          team: event.team?.trim() || null,
          event_notes: event.event_notes?.trim() || null,
          sort_order:
            typeof event.sort_order === 'number'
              ? event.sort_order
              : index,
        }));

        const { data: syncedEvents, error: eventsError } = await supabase
          .from('project_events')
          .insert(eventPayload)
          .select();

        if (eventsError) {
          console.error(
            'Failed to create project events in Supabase:',
            eventsError
          );
          // Attempt to roll back the created project record so no orphaned/partial project remains
          try {
            await supabase.from('projects').delete().eq('id', projectId);
          } catch (rollbackErr) {
            console.warn(
              'Could not roll back partial project record after event creation failure:',
              rollbackErr
            );
          }
          throw new Error(
            `Could not save project events schedule: ${eventsError.message}`
          );
        } else if (syncedEvents) {
          newProject.events = sortProjectEvents((syncedEvents || []) as ProjectEvent[]);
        }
      }

      // 2. Save newProject to local cache immediately so subsequent operations like getPayments()
      // can resolve project details and company_id right away
      if (typeof window !== 'undefined') {
        try {
          const currentProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
          saveToStorage('projects', [newProject, ...currentProjects.filter(p => p.id !== projectId)]);
        } catch {
          // ignore
        }
      }

      // 3. Automatically record the booking amount as the initial retainer payment
      if (Number(project.booking_amount) > 0) {
        try {
          console.log('[createProject] recording booking retainer with payment_mode: "Bank Transfer"');
          await this.createPayment({
            project_id: projectId,
            company_id: project.company_id,
            amount: Number(project.booking_amount),
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'Bank Transfer',
            description: 'Booking Retainer',
            receipt_number: `REC-${project.company_id === 'golden_june' ? 'GJ' : 'TWB'}-${Date.now().toString().slice(-4)}`,
          });
        } catch (payErr: any) {
          console.error('[createProject] Failed to record booking retainer payment in Supabase:', payErr);
          // Attach payment notice to project so the created project is not discarded and retry doesn't duplicate
          (newProject as any).booking_payment_error = payErr?.message || String(payErr);
        }
      }
    } else {
      if (typeof window !== 'undefined') {
        try {
          const currentProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
          saveToStorage('projects', [newProject, ...currentProjects.filter(p => p.id !== projectId)]);
        } catch {
          // ignore
        }
      }

      if (Number(project.booking_amount) > 0) {
        try {
          await this.createPayment({
            project_id: projectId,
            company_id: project.company_id,
            amount: Number(project.booking_amount),
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'Bank Transfer',
            description: 'Booking Retainer',
            receipt_number: `REC-${project.company_id === 'golden_june' ? 'GJ' : 'TWB'}-${Date.now().toString().slice(-4)}`,
          });
        } catch (payErr: any) {
          console.error('[createProject local] Failed to record booking retainer payment:', payErr);
        }
      }
    }

    if (newProject.events && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `project_events_${projectId}`,
          JSON.stringify(newProject.events)
        );
      } catch {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + 'projects');
        if (raw) {
          const cached = JSON.parse(raw) as Project[];
          saveToStorage('projects', [newProject, ...cached.filter(p => p.id !== projectId)]);
        }
      } catch {
        // ignore
      }
    }

    return newProject;
  },

  async updateProject(project: Project): Promise<Project> {
  if (project.terms_clauses && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        `project_terms_${project.id}`,
        JSON.stringify(project.terms_clauses)
      );
    } catch {
      // ignore
    }
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    const companyUuid =
      project.company_id === 'golden_june'
        ? '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec'
        : '5736bf57-b1db-4896-a4df-4963ded1c4c6';

    const updatePayload = {
      company_id: companyUuid,
      client_id: project.client_id || null,
      project_name: project.name,
      start_date: project.wedding_date_start,
      end_date: project.wedding_date_end,
      venue: project.venue,
      city: project.city,
      status:
        project.status === 'Enquiry'
          ? 'enquiry'
          : project.status === 'Booked'
            ? 'confirmed'
            : project.status === 'Shoot Completed'
              ? 'shoot_completed'
              : project.status === 'Editing'
                ? 'editing'
                : project.status === 'Review'
                  ? 'review'
                  : project.status === 'Delivered'
                    ? 'delivery'
                    : project.status === 'Archived'
                      ? 'completed'
                      : 'enquiry',
      booking_amount: project.booking_amount,
      notes: JSON.stringify({
        user_notes: project.notes || '',
        package_name: project.package_name,
        package_details: project.package_details,
        total_amount: project.total_amount,
        client_contact: project.client_contact,
        client_hdd_status: project.client_hdd_status || 'Not Received',
        booking_payment_error: project.booking_payment_error || undefined,
      }),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', project.id);

    if (updateError) {
      console.error('Failed to update project in Supabase:', updateError);
      throw new Error(`Could not update project: ${updateError.message}`);
    }

    // Sync project events with Supabase
    const events = project.events || [];

    const { data: existingEvents, error: existingEventsError } =
      await supabase
        .from('project_events')
        .select('*')
        .eq('project_id', project.id);

    if (existingEventsError) {
      console.error(
        'Could not read existing project events from Supabase:',
        existingEventsError
      );
      throw new Error(
        `Could not sync project events: ${existingEventsError.message}`
      );
    }

    const existingEventIds = new Set(
      (existingEvents || []).map(event => event.id)
    );

    const incomingEventIds = new Set(
      events
        .filter(event => event.id)
        .map(event => event.id as string)
    );

    // Delete events that were removed from the project
    const eventsToDelete = (existingEvents || [])
      .filter(event => !incomingEventIds.has(event.id))
      .map(event => event.id);

    if (eventsToDelete.length > 0) {
      const { error: deleteEventsError } = await supabase
        .from('project_events')
        .delete()
        .in('id', eventsToDelete);

      if (deleteEventsError) {
        console.error(
          'Could not delete removed project events from Supabase:',
          deleteEventsError
        );
        throw new Error(
          `Could not delete removed project events: ${deleteEventsError.message}`
        );
      }
    }

    // Update existing events
    const eventsToUpdate = events
      .filter(event => event.id && existingEventIds.has(event.id))
      .map((event, index) => ({
        id: event.id,
        project_id: project.id,
        event_name: event.event_name.trim(),
        event_date: event.event_date,
        event_time: event.event_time?.trim() || null,
        event_address: event.event_address?.trim() || null,
        team: event.team?.trim() || null,
        event_notes: event.event_notes?.trim() || null,
        sort_order:
          typeof event.sort_order === 'number'
            ? event.sort_order
            : index,
      }));

    // Insert new events
    const eventsToInsert = events
      .filter(
        event => !event.id || !existingEventIds.has(event.id)
      )
      .map((event, index) => ({
        id: crypto.randomUUID(),
        project_id: project.id,
        event_name: event.event_name.trim(),
        event_date: event.event_date,
        event_time: event.event_time?.trim() || null,
        event_address: event.event_address?.trim() || null,
        team: event.team?.trim() || null,
        event_notes: event.event_notes?.trim() || null,
        sort_order:
          typeof event.sort_order === 'number'
            ? event.sort_order
            : index,
      }));

    if (eventsToUpdate.length > 0) {
      const { error: updateEventsError } = await supabase
        .from('project_events')
        .upsert(eventsToUpdate, {
          onConflict: 'id',
        });

      if (updateEventsError) {
        console.error(
          'Could not update project events in Supabase:',
          updateEventsError
        );
        throw new Error(
          `Could not update project events: ${updateEventsError.message}`
        );
      }
    }

    if (eventsToInsert.length > 0) {
      const { error: insertEventsError } = await supabase
        .from('project_events')
        .insert(eventsToInsert);

      if (insertEventsError) {
        console.error(
          'Could not insert new project events in Supabase:',
          insertEventsError
        );
        throw new Error(
          `Could not insert project events: ${insertEventsError.message}`
        );
      }
    }

    // Read the final project events back from Supabase
    const { data: syncedEvents, error: syncedEventsError } =
      await supabase
        .from('project_events')
        .select('*')
        .eq('project_id', project.id)
        .order('event_date', { ascending: true })
        .order('sort_order', { ascending: true });

    if (syncedEventsError) {
      console.error(
        'Could not reload project events from Supabase:',
        syncedEventsError
      );
      throw new Error(
        `Could not reload project events: ${syncedEventsError.message}`
      );
    }

    project.events = sortProjectEvents((syncedEvents || []) as ProjectEvent[]);

    // Cache only after Supabase has successfully saved everything
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `project_events_${project.id}`,
          JSON.stringify(project.events)
        );
        const raw = localStorage.getItem(STORAGE_PREFIX + 'projects');
        if (raw) {
          const cached = JSON.parse(raw) as Project[];
          saveToStorage(
            'projects',
            cached.map(p => (p.id === project.id ? project : p))
          );
        }
      } catch {
        // ignore
      }
    }

    return project;
  }

  // Local fallback only when Supabase isn't configured
  const current = await this.getProjects();
  const updated = current.map(p =>
    p.id === project.id ? project : p
  );

  saveToStorage('projects', updated);

  return project;
},

  async deleteProject(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      // 1. Delete associated project_events from Supabase
      const { error: eventsError } = await supabase
        .from('project_events')
        .delete()
        .eq('project_id', id);

      if (eventsError) {
        console.error('Failed to delete project events in Supabase:', eventsError);
        throw new Error(`Could not delete project events: ${eventsError.message}`);
      }

      // 2. Delete project record from Supabase
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (projectError) {
        console.error('Failed to delete project in Supabase:', projectError);
        throw new Error(`Could not delete project: ${projectError.message}`);
      }
    }

    // Clean up local cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`project_events_${id}`);
        localStorage.removeItem(`project_terms_${id}`);
        const raw = localStorage.getItem(STORAGE_PREFIX + 'projects');
        if (raw) {
          const list = JSON.parse(raw) as Project[];
          saveToStorage('projects', list.filter(p => p.id !== id));
        }
        const rawPayments = localStorage.getItem(STORAGE_PREFIX + 'payments');
        if (rawPayments) {
          const pList = JSON.parse(rawPayments) as Payment[];
          saveToStorage('payments', pList.filter(p => p.project_id !== id));
        }
      } catch {
        // ignore
      }
    }
  },
  
  // TEAM & CONFLICT DETECTION
  
  async getTeamMembers(): Promise<TeamMember[]> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to load team members from Supabase:', error);
        throw new Error(`Could not load team members: ${error.message}`);
      }

      const members = (data || []) as TeamMember[];

      // Supabase is the source of truth.
      // Cache only after a successful read.
      saveToStorage('team_members', members);

      return members;
    }

    // Local fallback only when Supabase is not configured.
    return getStoredOrInitial('team_members', INITIAL_TEAM_MEMBERS);
  },

  async createTeamMember(
    member: Omit<TeamMember, 'id'>
  ): Promise<TeamMember> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          profile_id: member.profile_id || null,
          name: member.name,
          email: member.email || null,
          phone: member.phone || null,
          role: member.role || 'other',
          active: member.is_active ?? true,
          notes: member.notes || null,
          role_title: member.role_title || null,
          day_rate: member.day_rate ?? member.daily_rate ?? null,
          gear_inventory: member.gear_inventory || [],
         status: member.status || 'Active',
blocked_dates: member.blocked_dates || [],
categories: member.categories || [],
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create team member in Supabase:', error);
        throw new Error(`Could not create team member: ${error.message}`);
      }

      const newMember = data as TeamMember;

      // Update cache only after Supabase succeeds.
      const current = await this.getTeamMembers();
      saveToStorage(
        'team_members',
        [newMember, ...current.filter(m => m.id !== newMember.id)]
      );

      return newMember;
    }

    // Local fallback only when Supabase is not configured.
    const newMember: TeamMember = {
      ...member,
      id: 'team-' + Date.now(),
    };

    const current = await this.getTeamMembers();
    saveToStorage('team_members', [...current, newMember]);

    return newMember;
  },

  async updateTeamMember(member: TeamMember): Promise<TeamMember> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .update({
          profile_id: member.profile_id || null,
          name: member.name,
          email: member.email || null,
          phone: member.phone || null,
          role: member.role || 'other',
          active: member.is_active ?? true,
          notes: member.notes || null,
          role_title: member.role_title || null,
          day_rate: member.day_rate ?? member.daily_rate ?? null,
          gear_inventory: member.gear_inventory || [],
          status: member.status || 'Active',
blocked_dates: member.blocked_dates || [],
categories: member.categories || [],
updated_at: new Date().toISOString(),
        })
        .eq('id', member.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update team member in Supabase:', error);
        throw new Error(`Could not update team member: ${error.message}`);
      }

      const updatedMember = data as TeamMember;

      // Refresh cache from Supabase after successful update.
      const current = await this.getTeamMembers();
      saveToStorage(
        'team_members',
        current.map(m =>
          m.id === updatedMember.id ? updatedMember : m
        )
      );

      return updatedMember;
    }

    // Local fallback only when Supabase is not configured.
    const current = await this.getTeamMembers();
    const updatedMember = {
      ...current.find(m => m.id === member.id),
      ...member,
    } as TeamMember;

    saveToStorage(
      'team_members',
      current.map(m =>
        m.id === updatedMember.id ? updatedMember : m
      )
    );

    return updatedMember;
  },

  async deleteTeamMember(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase) {
      // Never delete a team member who has historical project assignments.
      const { count, error: assignmentError } = await supabase
        .from('project_team')
        .select('id', { count: 'exact', head: true })
        .eq('team_member_id', id);

      if (assignmentError) {
        console.error(
          'Failed to check team member assignments:',
          assignmentError
        );
        throw new Error(
          `Could not verify team member assignments: ${assignmentError.message}`
        );
      }

      if ((count || 0) > 0) {
        throw new Error(
          'This team member has project assignments and cannot be deleted. Deactivate the member instead.'
        );
      }

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete team member in Supabase:', error);
        throw new Error(`Could not delete team member: ${error.message}`);
      }

      const current = await this.getTeamMembers();
      saveToStorage(
        'team_members',
        current.filter(m => m.id !== id)
      );

      return;
    }

    // Local fallback only when Supabase is not configured.
    const current = await this.getTeamMembers();
    saveToStorage(
      'team_members',
      current.filter(m => m.id !== id)
    );
  },

  async getEditors(): Promise<Editor[]> {
    const supabase = getSupabaseClient();
    const teamMembers = await this.getTeamMembers();

    const teamEditors = teamMembers
      .filter(member =>
        member.categories?.includes('Editor') ||
        member.role_title?.toLowerCase().includes('editor')
      )
      .map(member => ({
        id: member.id,
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        specialization: member.role_title || 'Editor',
        is_active: member.status !== 'Inactive' && member.is_active !== false,
        max_concurrent_projects: 4,
        max_active_deliverables: 4,
        notes: member.notes || '',
      }));

    // In connected Supabase mode: return genuine editors (empty array if none exist).
    // Never inject fictional demo editors into a connected live environment.
    if (supabase) {
      return teamEditors;
    }

    if (teamEditors.length > 0) {
      return teamEditors;
    }

    return getStoredOrInitial('editors', INITIAL_EDITORS);
  },

  async getProjectTeam(): Promise<ProjectTeamAssignment[]> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from('project_team')
      .select('*');

    if (!error && data && data.length > 0) {
      const normalizedAssignments = data.map((assignment: any) => ({
        ...assignment,
        role: assignment.role || assignment.assignment_role || '',
      }));

      saveToStorage('project_team', normalizedAssignments);
      return normalizedAssignments as ProjectTeamAssignment[];
    }
  }

  return getStoredOrInitial('project_team', INITIAL_PROJECT_TEAM);
},

  // Check double-booking conflict
  async checkTeamConflict(
    teamMemberId: string,
    assignmentDate: string,
    excludeProjectId?: string,
    excludeAssignmentId?: string
  ): Promise<{ hasConflict: boolean; conflictingProject?: Project; memberName?: string }> {
    const assignments = await this.getProjectTeam();
    const teamMembers = await this.getTeamMembers();
    const projects = await this.getProjects();

    const member = teamMembers.find(m => m.id === teamMemberId);
    const existingAssignment = assignments.find(
      a =>
        a.team_member_id === teamMemberId &&
        a.assignment_date === assignmentDate &&
        (excludeAssignmentId ? a.id !== excludeAssignmentId : true) &&
        (excludeProjectId ? a.project_id !== excludeProjectId : true)
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
  const conflict = await this.checkTeamConflict(
    assignment.team_member_id,
    assignment.assignment_date,
    assignment.project_id
  );

  if (conflict.hasConflict && !adminOverride) {
    return {
      success: false,
      conflictError: `DOUBLE BOOKING CONFLICT: ${conflict.memberName} is already assigned on ${assignment.assignment_date} to project "${conflict.conflictingProject?.name || 'Another Project'}". Admin override is required to proceed.`,
    };
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    const isMissingColumnError = (err: any, col: string) =>
      Boolean(
        err &&
        err.message &&
        err.message.toLowerCase().includes(col.toLowerCase()) &&
        (err.message.includes('schema cache') ||
          err.message.includes('does not exist') ||
          err.message.includes('Could not find') ||
          err.message.includes('column'))
      );

    const basePayload: Record<string, any> = {
      project_id: assignment.project_id,
      team_member_id: assignment.team_member_id,
      role: assignment.role,
      assignment_date: assignment.assignment_date,
      notes: assignment.notes || null,
    };

    let insertRes = await supabase
      .from('project_team')
      .insert(basePayload)
      .select()
      .single();

    // Fallback: retry with assignment_role ONLY if error clearly indicates 'role' column does not exist
    if (insertRes.error && isMissingColumnError(insertRes.error, 'role')) {
      console.warn(
        'Supabase project_team table missing "role" column, retrying with "assignment_role":',
        insertRes.error.message
      );
      const fallbackPayload = {
        project_id: assignment.project_id,
        team_member_id: assignment.team_member_id,
        assignment_role: assignment.role,
        assignment_date: assignment.assignment_date,
        notes: assignment.notes || null,
      };
      insertRes = await supabase
        .from('project_team')
        .insert(fallbackPayload)
        .select()
        .single();
    }

    if (insertRes.error) {
      console.error('Failed to create team assignment in Supabase:', insertRes.error);

      return {
        success: false,
        conflictError: `Could not save team assignment: ${insertRes.error.message}`,
      };
    }

    const rawData: any = insertRes.data;
    const createdAssignment: ProjectTeamAssignment = {
      ...rawData,
      role: rawData.role || rawData.assignment_role || assignment.role,
    };

    const current = await this.getProjectTeam();
    saveToStorage('project_team', [...current, createdAssignment]);

    if (conflict.hasConflict && adminOverride) {
      await this.createNotification({
        title: 'Admin Override: Team Double Booking',
        message: `${conflict.memberName} was double-booked on ${assignment.assignment_date} via Admin override.`,
        type: 'booking_conflict',
        read: false,
        link: 'team-availability',
      });
    }

    return {
      success: true,
      assignment: createdAssignment,
    };
  }

  const newAssignment: ProjectTeamAssignment = {
    ...assignment,
    id: 'pt-' + Date.now(),
  };

  const current = await this.getProjectTeam();
  saveToStorage('project_team', [...current, newAssignment]);

  return {
    success: true,
    assignment: newAssignment,
  };
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

  async updateTeamAssignment(
  assignmentId: string,
  assignment: {
    project_id?: string;
    team_member_id: string;
    role: string;
    assignment_date: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string; assignment?: ProjectTeamAssignment }> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const isMissingColumnError = (err: any, col: string) =>
      Boolean(
        err &&
        err.message &&
        err.message.toLowerCase().includes(col.toLowerCase()) &&
        (err.message.includes('schema cache') ||
          err.message.includes('does not exist') ||
          err.message.includes('Could not find') ||
          err.message.includes('column'))
      );

    const baseUpdate: Record<string, any> = {
      team_member_id: assignment.team_member_id,
      role: assignment.role,
      assignment_date: assignment.assignment_date,
      notes: assignment.notes || null,
    };

    if (assignment.project_id) {
      baseUpdate.project_id = assignment.project_id;
    }

    let updateRes = await supabase
      .from('project_team')
      .update(baseUpdate)
      .eq('id', assignmentId)
      .select()
      .single();

    // Fallback: retry with assignment_role ONLY if error clearly indicates 'role' column does not exist
    if (updateRes.error && isMissingColumnError(updateRes.error, 'role')) {
      console.warn(
        'Supabase project_team table missing "role" column, retrying update with "assignment_role":',
        updateRes.error.message
      );
      const fallbackUpdate: Record<string, any> = {
        team_member_id: assignment.team_member_id,
        assignment_role: assignment.role,
        assignment_date: assignment.assignment_date,
        notes: assignment.notes || null,
      };
      if (assignment.project_id) {
        fallbackUpdate.project_id = assignment.project_id;
      }

      updateRes = await supabase
        .from('project_team')
        .update(fallbackUpdate)
        .eq('id', assignmentId)
        .select()
        .single();
    }

    if (updateRes.error) {
      console.error('Failed to update team assignment in Supabase:', updateRes.error);

      return {
        success: false,
        error: `Could not update team assignment: ${updateRes.error.message}`,
      };
    }

    const rawData: any = updateRes.data;
    const updatedAssignment: ProjectTeamAssignment = {
      ...rawData,
      role: rawData.role || rawData.assignment_role || assignment.role,
    };

    const current = await this.getProjectTeam();

    const updatedList = current.map(a =>
      a.id === assignmentId ? updatedAssignment : a
    );

    saveToStorage('project_team', updatedList);

    return {
      success: true,
      assignment: updatedAssignment,
    };
  }

  // Local fallback when Supabase isn't configured
  const current = await this.getProjectTeam();
  const existing = current.find(a => a.id === assignmentId);

  const updatedAssignment: ProjectTeamAssignment = {
    ...(existing || {}),
    project_id: assignment.project_id || existing?.project_id || '',
    team_member_id: assignment.team_member_id,
    role: assignment.role,
    assignment_date: assignment.assignment_date,
    notes: assignment.notes,
    id: assignmentId,
  };

  const updatedList = current.map(a =>
    a.id === assignmentId ? updatedAssignment : a
  );

  saveToStorage('project_team', updatedList);

  return {
    success: true,
    assignment: updatedAssignment,
  };
},

  // PROJECT DATA (METADATA & EXTERNAL STORAGE RECORDS)
  // Authoritative flow: Supabase -> api.ts -> AppContext -> React components
  async getProjectData(): Promise<ProjectData[]> {
    const supabase = getSupabaseClient();

    if (supabase) {
      // Query public.project_data using only columns that exist in the database table
      let { data, error } = await supabase
        .from('project_data')
        .select('id, project_id, name, notes, status, data_type, created_at, updated_at')
        .order('created_at', { ascending: false });

      // Fallback order by id if created_at has any issue
      if (error && error.message?.toLowerCase().includes('created_at')) {
        const retry = await supabase
          .from('project_data')
          .select('id, project_id, name, notes, status, data_type, created_at, updated_at')
          .order('id', { ascending: true });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Failed to load project_data from Supabase:', error.message);
        return getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
      }

      // Supabase is authoritative. Map all returned rows into model format
      const records = (data || []).map(mapSupabaseProjectDataToModel);

      // Cache after successful read from Supabase
      saveToStorage('project_data', records);
      return records;
    }

    // Local fallback ONLY when Supabase is genuinely not configured
    return getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
  },

  async createProjectData(dataItem: Omit<ProjectData, 'id'>): Promise<ProjectData> {
    const supabase = getSupabaseClient();
    const newId = crypto.randomUUID();

    if (supabase) {
      const payload = buildProjectDataSupabasePayload(dataItem, newId);

      let { data, error } = await supabase
        .from('project_data')
        .insert(payload)
        .select()
        .maybeSingle();

      // If data_type column fails for any reason, retry without it
      if (
        error &&
        error.message?.toLowerCase().includes('data_type') &&
        (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find'))
      ) {
        const retryPayload = { ...payload };
        delete (retryPayload as any).data_type;
        const retry = await supabase
          .from('project_data')
          .insert(retryPayload)
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Failed to create storage record in Supabase:', error);
        throw new Error(`Could not create storage record in Supabase: ${error.message}`);
      }

      const created = data ? mapSupabaseProjectDataToModel(data) : ({
        ...dataItem,
        id: newId,
      } as ProjectData);

      // Update secondary local cache from authoritative Supabase state
      const current = await this.getProjectData();
      const merged = [created, ...current.filter(d => d.id !== created.id)];
      saveToStorage('project_data', merged);

      return created;
    }

    // Local fallback ONLY when Supabase is not configured
    const newItem: ProjectData = {
      ...dataItem,
      id: newId,
    };
    const current = getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
    const updated = [newItem, ...current];
    saveToStorage('project_data', updated);
    return newItem;
  },

  async updateProjectData(dataItem: ProjectData): Promise<ProjectData> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const targetId = isUuid(dataItem.id) ? dataItem.id : crypto.randomUUID();
      const payload = buildProjectDataSupabasePayload(dataItem, targetId);

      let data: any = null;
      let error: any = null;

      if (isUuid(dataItem.id)) {
        const { id, ...updateFields } = payload;
        const updateRes = await supabase
          .from('project_data')
          .update(updateFields)
          .eq('id', targetId)
          .select()
          .maybeSingle();
        data = updateRes.data;
        error = updateRes.error;
      }

      // If record had non-UUID id (e.g. legacy seed item) or wasn't found in Supabase yet, insert it
      if (!isUuid(dataItem.id) || (!error && !data)) {
        const insertRes = await supabase
          .from('project_data')
          .insert(payload)
          .select()
          .maybeSingle();
        data = insertRes.data;
        error = insertRes.error;
      }

      if (error) {
        console.error('Failed to update storage record in Supabase:', error);
        throw new Error(`Could not update storage record in Supabase: ${error.message}`);
      }

      const updated = data ? mapSupabaseProjectDataToModel(data) : ({ ...dataItem, id: targetId });

      // Update secondary local cache from authoritative Supabase state
      const current = await this.getProjectData();
      const merged = [updated, ...current.filter(d => d.id !== updated.id)];
      saveToStorage('project_data', merged);

      return updated;
    }

    // Local fallback ONLY when Supabase is not configured
    const current = getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
    const updated = current.map(d => (d.id === dataItem.id ? dataItem : d));
    saveToStorage('project_data', updated);
    return dataItem;
  },

  async deleteProjectData(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      if (isUuid(id)) {
        const { error } = await supabase
          .from('project_data')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Failed to delete storage record from Supabase:', error);
          throw new Error(`Could not delete storage record from Supabase: ${error.message}`);
        }
      }

      // Refresh secondary cache from Supabase after successful deletion
      const current = await this.getProjectData();
      saveToStorage('project_data', current.filter(d => d.id !== id));
      return;
    }

    // Local fallback ONLY when Supabase is not configured
    const current = getStoredOrInitial('project_data', INITIAL_PROJECT_DATA);
    saveToStorage('project_data', current.filter(d => d.id !== id));
  },

  // DELIVERABLES
  async getDeliverables(): Promise<Deliverable[]> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('deliverables')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('Warning loading deliverables from Supabase:', error.message);
        const stored = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
        return stored.map(d => {
          if (d.notes && typeof d.notes === 'string' && d.notes.startsWith('__METADATA__:')) {
            const parsed = parseDeliverableNotes(d.notes);
            return {
              ...d,
              notes: parsed.userNotes,
              assigned_at: d.assigned_at || parsed.metadata?.assigned_at,
              first_submitted_at: d.first_submitted_at || parsed.metadata?.first_submitted_at,
              delivered_at: d.delivered_at || parsed.metadata?.delivered_at,
            };
          }
          return d;
        });
      }

      const deliverables = (data || []).map(mapSupabaseDeliverableToModel);

      // Supabase is the source of truth.
      // Cache after successful read.
      saveToStorage('deliverables', deliverables);

      return deliverables;
    }

    // Local fallback only when Supabase is not configured.
    const stored = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    return stored.map(d => {
      if (d.notes && typeof d.notes === 'string' && d.notes.startsWith('__METADATA__:')) {
        const parsed = parseDeliverableNotes(d.notes);
        return {
          ...d,
          notes: parsed.userNotes,
          assigned_at: d.assigned_at || parsed.metadata?.assigned_at,
          first_submitted_at: d.first_submitted_at || parsed.metadata?.first_submitted_at,
          delivered_at: d.delivered_at || parsed.metadata?.delivered_at,
        };
      }
      return d;
    });
  },

  async createDeliverable(
    deliverable: Omit<Deliverable, 'id' | 'last_updated'>
  ): Promise<Deliverable> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const {
      userNotes,
      assigned_at: assignedAt,
      first_submitted_at: firstSubmittedAt,
      delivered_at: deliveredAt,
      serializedNotesForFallback,
    } = prepareDeliverableForCreate(deliverable, now);

    if (supabase) {
      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const newId = crypto.randomUUID();
      const companyUuid = toCompanyUuid(deliverable.company_id);
      const editorId = (deliverable.assigned_editor_id && deliverable.assigned_editor_id.trim())
        ? deliverable.assigned_editor_id.trim()
        : null;
      const dueDate = deliverable.due_date || new Date().toISOString().split('T')[0];
      const statusValue = (deliverable.status && deliverable.status.trim()) ? deliverable.status.trim() : null;

      // Note: Supabase deliverables table may have column 'name' (NOT NULL in some schemas)
      // and/or 'deliverable_type'. We provide both, and dynamically retry if columns differ.
      let insertPayload: any = {
        id: newId,
        project_id: deliverable.project_id,
        company_id: companyUuid,
        name: deliverable.deliverable_type,
        deliverable_type: deliverable.deliverable_type,
        assigned_editor_id: isUuid(editorId) ? editorId : null,
        due_date: dueDate,
        status: statusValue,
        priority: deliverable.priority || 'Medium',
        external_link: deliverable.external_link || null,
        client_feedback: deliverable.client_feedback || null,
        notes: userNotes || null,
        assigned_at: assignedAt || null,
        first_submitted_at: firstSubmittedAt || null,
        delivered_at: deliveredAt || null,
      };

      let { data, error } = await supabase
        .from('deliverables')
        .insert(insertPayload)
        .select();

      // Check 0: If milestone columns do not exist in Supabase schema, retry without them and embed in notes
      if (
        error &&
        (error.message?.includes('assigned_at') ||
          error.message?.includes('first_submitted_at') ||
          error.message?.includes('delivered_at') ||
          error.message?.includes('schema cache'))
      ) {
        delete insertPayload.assigned_at;
        delete insertPayload.first_submitted_at;
        delete insertPayload.delivered_at;
        insertPayload.notes = serializedNotesForFallback;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      // Check 1: If 'name' column does not exist or schema cache complaints
      if (
        error &&
        error.message?.toLowerCase().includes('name') &&
        (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find'))
      ) {
        delete insertPayload.name;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      // Check 2: If 'deliverable_type' column does not exist or schema cache complaints
      if (
        error &&
        error.message?.toLowerCase().includes('deliverable_type') &&
        (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find'))
      ) {
        delete insertPayload.deliverable_type;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      // Check 3: Foreign key on company_id (UUID vs text slug 'twb' / 'golden_june')
      if (
        error &&
        (error.message?.includes('company_id_fkey') || error.message?.toLowerCase().includes('company_id'))
      ) {
        // Toggle between UUID and string slug
        insertPayload.company_id =
          insertPayload.company_id === companyUuid
            ? (deliverable.company_id || 'twb')
            : companyUuid;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      // Check 4: Foreign key on assigned_editor_id
      if (
        error &&
        (error.message?.includes('assigned_editor_id_fkey') || error.message?.toLowerCase().includes('assigned_editor_id'))
      ) {
        insertPayload.assigned_editor_id = null;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      // Check 5: Check constraint on status
      if (
        error &&
        (error.message?.includes('status_check') || error.message?.toLowerCase().includes('status'))
      ) {
        insertPayload.status = null;
        const retry = await supabase.from('deliverables').insert(insertPayload).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Failed to create deliverable in Supabase:', error);
        throw new Error(`Could not create deliverable in Supabase: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Supabase did not return the created deliverable record.');
      }

      const mapped = mapSupabaseDeliverableToModel(data[0]);
      const newDeliverable: Deliverable = {
        ...mapped,
        notes: mapped.notes || userNotes,
        assigned_at: mapped.assigned_at || assignedAt,
        first_submitted_at: mapped.first_submitted_at || firstSubmittedAt,
        delivered_at: mapped.delivered_at || deliveredAt,
      };

      const current = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
      saveToStorage(
        'deliverables',
        [
          newDeliverable,
          ...current.filter(d => d.id !== newDeliverable.id),
        ]
      );

      return newDeliverable;
    }

    // Local fallback only when Supabase is not configured.
    const newDeliverable: Deliverable = {
      ...deliverable,
      id: crypto.randomUUID(),
      status: deliverable.status || ('' as DeliverableStatus),
      notes: userNotes,
      last_updated: now,
      assigned_at: assignedAt,
      first_submitted_at: firstSubmittedAt,
      delivered_at: deliveredAt,
    };

    const current = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    saveToStorage(
      'deliverables',
      [newDeliverable, ...current.filter(d => d.id !== newDeliverable.id)]
    );

    return newDeliverable;
  },

  async updateDeliverable(
    deliverable: Deliverable
  ): Promise<Deliverable> {
    const stored = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    let existing = stored.find(d => d.id === deliverable.id);
    if (existing && existing.notes && typeof existing.notes === 'string' && existing.notes.startsWith('__METADATA__:')) {
      const parsedExisting = parseDeliverableNotes(existing.notes);
      existing = {
        ...existing,
        notes: parsedExisting.userNotes,
        assigned_at: existing.assigned_at || parsedExisting.metadata?.assigned_at,
        first_submitted_at: existing.first_submitted_at || parsedExisting.metadata?.first_submitted_at,
        delivered_at: existing.delivered_at || parsedExisting.metadata?.delivered_at,
      };
    }

    const now = new Date().toISOString();

    // 1. Assignment timestamp logic:
    // - If assigned to a new, non-empty editor ID: record current timestamp
    // - If unassigned (empty editor ID): clear assigned_at
    // - If editor ID did not change: preserve existing assigned_at
    const existingEditorId = (existing?.assigned_editor_id || '').trim();
    const newEditorId = (deliverable.assigned_editor_id || '').trim();

    let assignedAt: string | undefined;
    if (newEditorId && newEditorId !== existingEditorId) {
      // Reassigned to a different editor (or assigned for the first time)
      assignedAt = now;
    } else if (newEditorId && newEditorId === existingEditorId) {
      // Same editor retained: preserve existing assignment date
      assignedAt = existing?.assigned_at || deliverable.assigned_at;
    } else {
      // Unassigned
      assignedAt = undefined;
    }

    // 2. First Submitted milestone logic:
    // Set first_submitted_at when transitioning to 'Submitted' only if not already set.
    // Never overwrite on later revisions or subsequent resubmissions.
    let firstSubmittedAt: string | undefined = existing?.first_submitted_at || deliverable.first_submitted_at;
    if (deliverable.status === 'Submitted' && !firstSubmittedAt) {
      firstSubmittedAt = now;
    }

    // 3. Delivered milestone logic:
    // Set delivered_at when transitioning to 'Delivered' only if not already set.
    // Never overwrite on later edits.
    let deliveredAt: string | undefined = existing?.delivered_at || deliverable.delivered_at;
    if (deliverable.status === 'Delivered' && !deliveredAt) {
      deliveredAt = now;
    }

    // Extract clean user notes in case incoming deliverable still had metadata string
    let userNotesToSave = deliverable.notes;
    if (userNotesToSave && typeof userNotesToSave === 'string' && userNotesToSave.startsWith('__METADATA__:')) {
      const parsedIncoming = parseDeliverableNotes(userNotesToSave);
      userNotesToSave = parsedIncoming.userNotes;
      if (!assignedAt && parsedIncoming.metadata?.assigned_at) assignedAt = parsedIncoming.metadata.assigned_at;
      if (!firstSubmittedAt && parsedIncoming.metadata?.first_submitted_at) firstSubmittedAt = parsedIncoming.metadata.first_submitted_at;
      if (!deliveredAt && parsedIncoming.metadata?.delivered_at) deliveredAt = parsedIncoming.metadata.delivered_at;
    }

    const updatedDeliverable: Deliverable = {
      ...deliverable,
      notes: userNotesToSave,
      assigned_at: assignedAt,
      first_submitted_at: firstSubmittedAt,
      delivered_at: deliveredAt,
      last_updated: now,
    };

    const supabase = getSupabaseClient();

    if (supabase) {
      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const editorId = (updatedDeliverable.assigned_editor_id && updatedDeliverable.assigned_editor_id.trim())
        ? updatedDeliverable.assigned_editor_id.trim()
        : null;

      let updatePayload: any = {
        project_id: updatedDeliverable.project_id,
        company_id: toCompanyUuid(updatedDeliverable.company_id),
        name: updatedDeliverable.deliverable_type,
        deliverable_type: updatedDeliverable.deliverable_type,
        assigned_editor_id: isUuid(editorId) ? editorId : null,
        due_date: updatedDeliverable.due_date || new Date().toISOString().split('T')[0],
        status: (updatedDeliverable.status && updatedDeliverable.status.trim()) ? updatedDeliverable.status.trim() : null,
        priority: updatedDeliverable.priority || 'Medium',
        external_link: updatedDeliverable.external_link || null,
        client_feedback: updatedDeliverable.client_feedback || null,
        notes: userNotesToSave || null,
        assigned_at: assignedAt || null,
        first_submitted_at: firstSubmittedAt || null,
        delivered_at: deliveredAt || null,
      };

      let { data, error } = await supabase
        .from('deliverables')
        .update(updatePayload)
        .eq('id', updatedDeliverable.id)
        .select();

      // Retry without milestone columns if missing from Supabase schema cache, storing in notes metadata
      if (
        error &&
        (error.message?.includes('assigned_at') ||
          error.message?.includes('first_submitted_at') ||
          error.message?.includes('delivered_at') ||
          error.message?.includes('schema cache'))
      ) {
        delete updatePayload.assigned_at;
        delete updatePayload.first_submitted_at;
        delete updatePayload.delivered_at;
        updatePayload.notes = serializeDeliverableNotes(userNotesToSave, {
          assigned_at: assignedAt,
          first_submitted_at: firstSubmittedAt,
          delivered_at: deliveredAt,
        });
        const retry = await supabase.from('deliverables').update(updatePayload).eq('id', updatedDeliverable.id).select();
        data = retry.data;
        error = retry.error;
      }

      if (
        error &&
        error.message?.toLowerCase().includes('name') &&
        (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find'))
      ) {
        delete updatePayload.name;
        const retry = await supabase.from('deliverables').update(updatePayload).eq('id', updatedDeliverable.id).select();
        data = retry.data;
        error = retry.error;
      } else if (
        error &&
        error.message?.toLowerCase().includes('deliverable_type') &&
        (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('Could not find'))
      ) {
        delete updatePayload.deliverable_type;
        const retry = await supabase.from('deliverables').update(updatePayload).eq('id', updatedDeliverable.id).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Failed to update deliverable in Supabase:', error);
        throw new Error(`Could not update deliverable in Supabase: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error(`Could not find deliverable ${updatedDeliverable.id} to update in Supabase.`);
      }

      const mapped = mapSupabaseDeliverableToModel(data[0]);
      const saved: Deliverable = {
        ...mapped,
        assigned_at: mapped.assigned_at || assignedAt,
        first_submitted_at: mapped.first_submitted_at || firstSubmittedAt,
        delivered_at: mapped.delivered_at || deliveredAt,
      };

      // Cache updated list in storage immediately
      const current = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
      const updatedList = current.map(d =>
        d.id === saved.id ? saved : d
      );
      saveToStorage('deliverables', updatedList);

      return saved;
    }

    const current = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    const updatedList = current.map(d =>
      d.id === updatedDeliverable.id ? updatedDeliverable : d
    );
    saveToStorage('deliverables', updatedList);

    return updatedDeliverable;
  },

  async updateDeliverableStatus(
    deliverableId: string,
    newStatus: DeliverableStatus,
    updaterRole: UserRole,
    updaterName: string
  ): Promise<Deliverable> {
    const supabase = getSupabaseClient();
    const stored = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    let target = stored.find(d => d.id === deliverableId);
    if (target && target.notes && typeof target.notes === 'string' && target.notes.startsWith('__METADATA__:')) {
      const parsed = parseDeliverableNotes(target.notes);
      target = {
        ...target,
        notes: parsed.userNotes,
        assigned_at: target.assigned_at || parsed.metadata?.assigned_at,
        first_submitted_at: target.first_submitted_at || parsed.metadata?.first_submitted_at,
        delivered_at: target.delivered_at || parsed.metadata?.delivered_at,
      };
    }

    const now = new Date().toISOString();

    // 1. Milestone rules:
    // First Submitted: set only if transition to Submitted and currently empty
    const firstSubmittedAt =
      newStatus === 'Submitted' && !target?.first_submitted_at
        ? now
        : (target?.first_submitted_at || undefined);

    // Delivered: set only if transition to Delivered and currently empty
    const deliveredAt =
      newStatus === 'Delivered' && !target?.delivered_at
        ? now
        : (target?.delivered_at || undefined);

    const assignedAt = target?.assigned_at || undefined;

    const statusValueForDb = (newStatus && newStatus.trim()) ? newStatus : null;

    let savedDeliverable: Deliverable = {
      ...(target || {
        id: deliverableId,
        project_id: '',
        company_id: 'twb' as const,
        deliverable_type: 'Highlight Film (4-5 mins)' as DeliverableType,
        assigned_editor_id: '',
        due_date: new Date().toISOString().split('T')[0],
        status: (newStatus || '') as DeliverableStatus,
        priority: 'High' as const,
        last_updated: now,
      }),
      status: (newStatus || '') as DeliverableStatus,
      notes: target?.notes || undefined,
      assigned_at: assignedAt,
      first_submitted_at: firstSubmittedAt,
      delivered_at: deliveredAt,
      last_updated: now,
    };

    if (supabase) {
      let updatePayload: any = {
        status: statusValueForDb,
        first_submitted_at: firstSubmittedAt || null,
        delivered_at: deliveredAt || null,
      };

      let { data, error } = await supabase
        .from('deliverables')
        .update(updatePayload)
        .eq('id', deliverableId)
        .select();

      // Retry without milestone columns if missing from Supabase schema cache
      if (
        error &&
        (error.message?.includes('first_submitted_at') ||
          error.message?.includes('delivered_at') ||
          error.message?.includes('schema cache'))
      ) {
        delete updatePayload.first_submitted_at;
        delete updatePayload.delivered_at;
        updatePayload.notes = serializeDeliverableNotes(target?.notes, {
          assigned_at: assignedAt,
          first_submitted_at: firstSubmittedAt,
          delivered_at: deliveredAt,
        });
        const retry = await supabase
          .from('deliverables')
          .update(updatePayload)
          .eq('id', deliverableId)
          .select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Failed to update deliverable status in Supabase:', error);
        throw new Error(`Could not update deliverable status in Supabase: ${error.message}`);
      }

      if (data && data.length > 0) {
        const mapped = mapSupabaseDeliverableToModel(data[0]);
        savedDeliverable = {
          ...savedDeliverable,
          ...mapped,
          assigned_at: mapped.assigned_at || assignedAt,
          first_submitted_at: mapped.first_submitted_at || firstSubmittedAt,
          delivered_at: mapped.delivered_at || deliveredAt,
        };
      }
    }

    // Always update local storage cache immediately with the persisted record
    const currentList = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    const updatedList = currentList.map(d =>
      d.id === deliverableId ? savedDeliverable : d
    );
    saveToStorage('deliverables', updatedList);

    // Safely send notification without crashing
    try {
      const projects = await this.getProjects();
      const project = projects.find(
        p => p.id === (target?.project_id || savedDeliverable.project_id)
      );

      await this.createNotification({
        title: `Deliverable Status: ${newStatus || 'Unassigned'}`,
        message: `${updaterName} (${updaterRole}) marked "${target?.deliverable_type || 'Deliverable'}" as "${newStatus || 'Unassigned'}" for ${project?.name || 'Project'}.`,
        type: 'deliverable_status',
        read: false,
        link: 'deliverables',
      });
    } catch (notifErr) {
      console.warn('Could not record status notification:', notifErr);
    }

    return savedDeliverable;
  },

  async deleteDeliverable(id: string): Promise<void> {
    const cleanId = id ? id.trim() : '';
    const supabase = getSupabaseClient();

    console.log('[deleteDeliverable] Initiating delete for deliverable ID:', cleanId);

    if (supabase) {
      // Execute Supabase DELETE with .select() to verify deleted row data and status
      const response = await supabase
        .from('deliverables')
        .delete()
        .eq('id', cleanId)
        .select();

      console.log('[deleteDeliverable] Supabase DELETE response:', {
        deliverableId: cleanId,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        error: response.error,
        count: response.count,
      });

      if (response.error) {
        // If Postgres reports invalid UUID syntax for a local non-UUID seed ID (e.g. 'del-1')
        if (response.error.message?.toLowerCase().includes('invalid input syntax for type uuid')) {
          console.warn(`[deleteDeliverable] Deliverable ID "${cleanId}" is not a valid Supabase UUID; deleting from local storage only.`);
        } else {
          console.error('[deleteDeliverable] Failed to delete deliverable in Supabase:', response.error);
          throw new Error(
            `Could not delete deliverable in Supabase: ${response.error.message} (code: ${response.error.code || 'UNKNOWN'}, status: ${response.status})`
          );
        }
      } else if (!response.data || response.data.length === 0) {
        // 0 rows were deleted. Check if the record actually exists in Supabase.
        const checkResponse = await supabase
          .from('deliverables')
          .select('id')
          .eq('id', cleanId);

        console.log('[deleteDeliverable] Existence check response for ID:', cleanId, checkResponse);

        if (checkResponse.data && checkResponse.data.length > 0) {
          // The record exists in Supabase, but DELETE operation deleted 0 rows.
          // In PostgreSQL, this occurs when Row Level Security (RLS) is enabled but no DELETE policy permits deletion for the role.
          const msg = `Supabase DELETE returned 0 deleted rows for deliverable "${cleanId}". The row exists in Supabase, but was not deleted. This indicates that Row Level Security (RLS) on public.deliverables is blocking DELETE for your current role. Please ensure an RLS policy granting DELETE on public.deliverables is enabled in Supabase.`;
          console.error('[deleteDeliverable] RLS restriction detected:', msg);
          throw new Error(msg);
        } else {
          console.log(`[deleteDeliverable] No row with ID "${cleanId}" was found in Supabase (likely local seed data or already deleted).`);
        }
      } else {
        console.log(`[deleteDeliverable] Successfully deleted deliverable "${cleanId}" from Supabase:`, response.data[0]);
      }
    }

    // Always update local cache immediately so stale data never revives the deleted record
    const current = getStoredOrInitial('deliverables', INITIAL_DELIVERABLES);
    const updated = current.filter(d => d.id !== cleanId && d.id !== id);
    saveToStorage('deliverables', updated);
  },

  // FINANCE: PAYMENTS & EXPENSES
  async getPayments(): Promise<Payment[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (!error && data) {
        // Resolve company_id using stored or cached projects because public.payments does not store company_id
        const cachedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
        const mapped = data.map((row: any) => {
          let rawCompany = row.company_id;
          if (!rawCompany) {
            const matchedProj = cachedProjects.find((p: Project) => p.id === row.project_id);
            rawCompany = matchedProj?.company_id || 'twb';
          }
          const isGJ = rawCompany === 'golden_june' || rawCompany === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec';

          return {
            ...row,
            company_id: isGJ ? 'golden_june' : 'twb',
            amount: Number(row.amount) || 0,
            payment_mode: mapDbToPaymentMode(row.payment_mode),
          } as Payment;
        });

        // Supabase is the authoritative source of truth
        saveToStorage('payments', mapped);
        return mapped;
      }
      if (error) {
        console.error('[getPayments] Error fetching payments from Supabase:', error);
      }
    }
    return getStoredOrInitial('payments', INITIAL_PAYMENTS);
  },

  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const isUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const newId = crypto.randomUUID();
    const displayPaymentMode = mapDbToPaymentMode(payment.payment_mode);
    const dbPaymentMode = mapPaymentModeToDb(payment.payment_mode);
    const resolvedCompanyId: 'twb' | 'golden_june' =
      payment.company_id === 'golden_june' ? 'golden_june' : 'twb';

    const newPayment: Payment = {
      ...payment,
      id: newId,
      company_id: resolvedCompanyId,
      payment_mode: displayPaymentMode,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const companyUuid = toCompanyUuid(resolvedCompanyId);
      // Verified PostgreSQL check constraint payments_payment_mode_check requires:
      // ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')
      const basePayload: Record<string, any> = {
        id: newId,
        project_id: isUuid(payment.project_id) ? payment.project_id : null,
        amount: Number(payment.amount) || 0,
        payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
        payment_mode: dbPaymentMode,
        description: payment.description || 'Payment',
        receipt_number: payment.receipt_number || `REC-${Date.now()}`,
      };

      let insertSuccess = false;
      let lastError: any = null;

      // Strategy 1: Insert without company_id (standard since public.payments schema resolves company_id via project_id)
      console.log('[createPayment Strategy 1] inserting payment with payment_mode:', basePayload.payment_mode);
      const res1 = await supabase.from('payments').insert(basePayload);
      if (!res1.error) {
        insertSuccess = true;
      } else {
        lastError = res1.error;
        console.error('[createPayment Strategy 1 error]:', res1.error);
        const errMsg = (lastError.message || '').toLowerCase();
        // If the database table enforces a company_id column
        if (errMsg.includes('company_id') || errMsg.includes('not-null') || errMsg.includes('null value')) {
          // Strategy 2: Insert with company UUID
          console.log('[createPayment Strategy 2] inserting payment with payment_mode:', basePayload.payment_mode);
          const res2 = await supabase.from('payments').insert({
            ...basePayload,
            company_id: companyUuid,
          });
          if (!res2.error) {
            insertSuccess = true;
          } else {
            lastError = res2.error;
            console.error('[createPayment Strategy 2 error]:', res2.error);
            // Strategy 3: Insert with company brand code ('twb' / 'golden_june')
            console.log('[createPayment Strategy 3] inserting payment with payment_mode:', basePayload.payment_mode);
            const res3 = await supabase.from('payments').insert({
              ...basePayload,
              company_id: resolvedCompanyId,
            });
            if (!res3.error) {
              insertSuccess = true;
            } else {
              lastError = res3.error;
              console.error('[createPayment Strategy 3 error]:', res3.error);
            }
          }
        }
      }

      if (!insertSuccess && lastError) {
        console.error('[createPayment] Supabase payment insert error:', {
          message: lastError.message || String(lastError),
          details: lastError.details,
          hint: lastError.hint,
          code: lastError.code,
        });
        throw new Error(lastError.message || 'Failed to insert payment into Supabase');
      }
    }

    // Update local cache with newly created payment
    const current = getStoredOrInitial('payments', INITIAL_PAYMENTS);
    const updated = [newPayment, ...current.filter(p => p.id !== newId)];
    saveToStorage('payments', updated);

    // Create notification
    await this.createNotification({
      title: `Payment Received (₹${newPayment.amount.toLocaleString()})`,
      message: `Received ₹${newPayment.amount.toLocaleString()} via ${newPayment.payment_mode} (Receipt #${newPayment.receipt_number}).`,
      type: 'payment_received',
      read: false,
      link: 'finance',
    });

    return newPayment;
  },

  async updatePayment(payment: Payment): Promise<Payment> {
    const supabase = getSupabaseClient();
    const displayPaymentMode = mapDbToPaymentMode(payment.payment_mode);
    const dbPaymentMode = mapPaymentModeToDb(payment.payment_mode);
    const normalizedPayment = {
      ...payment,
      payment_mode: displayPaymentMode,
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('payments')
        .update({
          project_id: normalizedPayment.project_id,
          amount: Number(normalizedPayment.amount) || 0,
          payment_mode: dbPaymentMode,
          description: normalizedPayment.description,
          payment_date: normalizedPayment.payment_date,
          receipt_number: normalizedPayment.receipt_number,
        })
        .eq('id', payment.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update payment in Supabase:', error);
        throw new Error(`Could not update payment: ${error.message}`);
      }

      const updatedPayment = {
        ...(data as Payment),
        payment_mode: displayPaymentMode,
      };

      const current = getStoredOrInitial('payments', INITIAL_PAYMENTS);
      const updated = current.map(p =>
        p.id === updatedPayment.id ? updatedPayment : p
      );
      saveToStorage('payments', updated);
      return updatedPayment;
    }

    const current = getStoredOrInitial('payments', INITIAL_PAYMENTS);
    const updatedPayment = {
      ...current.find(p => p.id === payment.id),
      ...normalizedPayment,
    } as Payment;

    saveToStorage(
      'payments',
      current.map(p =>
        p.id === updatedPayment.id ? updatedPayment : p
      )
    );

    return updatedPayment;
  },

  async deletePayment(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete payment in Supabase:', error);
        throw new Error(`Could not delete payment: ${error.message}`);
      }
    }

    const current = getStoredOrInitial('payments', INITIAL_PAYMENTS);
    saveToStorage(
      'payments',
      current.filter(p => p.id !== id)
    );
  },

  async getExpenses(): Promise<Expense[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      if (!error && data) {
        // Resolve company_id using stored or cached projects because public.expenses does not store company_id
        const cachedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
        const mapped = data.map((row: any) => {
          let rawCompany = row.company_id;
          if (!rawCompany) {
            const matchedProj = cachedProjects.find((p: Project) => p.id === row.project_id);
            rawCompany = matchedProj?.company_id || 'twb';
          }
          const isGJ = rawCompany === 'golden_june' || rawCompany === '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec';

          return {
            ...row,
            company_id: isGJ ? 'golden_june' : 'twb',
            amount: Number(row.amount) || 0,
          } as Expense;
        });

        saveToStorage('expenses', mapped);
        return mapped;
      }
    }
    return getStoredOrInitial('expenses', INITIAL_EXPENSES);
  },

  async createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          project_id: expense.project_id,
          amount: Number(expense.amount) || 0,
          category: expense.category,
          description: expense.description,
          paid_to: expense.paid_to,
          expense_date: expense.expense_date,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create expense in Supabase:', error);
        throw new Error(`Could not create expense: ${error.message}`);
      }

      const cachedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
      const matchedProj = cachedProjects.find((p: Project) => p.id === expense.project_id);
      const resolvedCompanyId: 'twb' | 'golden_june' =
        expense.company_id === 'golden_june' || matchedProj?.company_id === 'golden_june'
          ? 'golden_june'
          : 'twb';

      const newExpense: Expense = {
        ...(data as Expense),
        company_id: resolvedCompanyId,
      };

      const current = await this.getExpenses();
      const updated = [newExpense, ...current.filter(e => e.id !== newExpense.id)];
      saveToStorage('expenses', updated);

      return newExpense;
    }

    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    const current = await this.getExpenses();
    const updated = [newExpense, ...current];
    saveToStorage('expenses', updated);

    return newExpense;
  },

  async updateExpense(expense: Expense): Promise<Expense> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          project_id: expense.project_id,
          // company_id is not a column in the expenses table
          amount: Number(expense.amount) || 0,
          category: expense.category,
          description: expense.description,
          paid_to: expense.paid_to,
          expense_date: expense.expense_date,
        })
        .eq('id', expense.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update expense in Supabase:', error);
        throw new Error(`Could not update expense: ${error.message}`);
      }

      const cachedProjects = getStoredOrInitial('projects', INITIAL_PROJECTS);
      const matchedProj = cachedProjects.find((p: Project) => p.id === expense.project_id);
      const resolvedCompanyId: 'twb' | 'golden_june' =
        expense.company_id === 'golden_june' || matchedProj?.company_id === 'golden_june'
          ? 'golden_june'
          : 'twb';

      const updatedExpense: Expense = {
        ...(data as Expense),
        company_id: resolvedCompanyId,
      };

      const current = await this.getExpenses();
      const updated = current.map(e =>
        e.id === updatedExpense.id ? updatedExpense : e
      );

      saveToStorage('expenses', updated);
      return updatedExpense;
    }

    const current = await this.getExpenses();
    const updatedExpense = {
      ...current.find(e => e.id === expense.id),
      ...expense,
    } as Expense;

    saveToStorage(
      'expenses',
      current.map(e => e.id === updatedExpense.id ? updatedExpense : e)
    );

    return updatedExpense;
  },

  async deleteExpense(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase) {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete expense in Supabase:', error);
        throw new Error(`Could not delete expense: ${error.message}`);
      }
    }

    const current = await this.getExpenses();
    saveToStorage('expenses', current.filter(e => e.id !== id));
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
      try {
        await supabase.from('notifications').insert({
          title: notif.title,
          message: notif.message,
          type: notif.type,
          read: notif.read ?? false,
          link: notif.link || null,
        });
      } catch (err) {
        console.warn('Could not save notification to Supabase:', err);
      }
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
