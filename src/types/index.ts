export type BrandId = 'all' | 'twb' | 'golden_june';

export type UserRole = 'Admin' | 'Manager' | 'Team Member' | 'Editor';

export interface Company {
  id: string;
  code: 'twb' | 'golden_june';
  name: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  primary_color: string;
  accent_color: string;
  bank_details: {
    account_name: string;
    account_number: string;
    bank_name: string;
    routing_code: string;
  };
  terms_conditions: string;
}

export interface Client {
  id: string;
  company_id: 'twb' | 'golden_june';
  name: string;
  partner_name?: string;
  email: string;
  phone: string;
  address?: string;
  instagram?: string;
  notes?: string;
  created_at: string;
}

export type EnquiryStatus = 'New' | 'Contacted' | 'Meeting Scheduled' | 'Proposal Sent' | 'Won' | 'Lost';
export type QuotationStatus = 'Draft' | 'Sent' | 'Approved' | 'Declined' | 'Expired';

export interface Enquiry {
  id: string;
  company_id: 'twb' | 'golden_june';
  client_name: string;
  partner_name?: string;
  email: string;
  phone: string;
  event_date: string;
  venue: string;
  lead_source: string;
  requirements: string;
  estimated_budget: number;
  status: EnquiryStatus;
  follow_up_date?: string;
  notes?: string;
  quotation_status: QuotationStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  company_id?: 'twb' | 'golden_june' | 'both';
  status: 'Active' | 'Inactive';
}

export type TeamRole = UserRole;

export interface TeamMember {
  id: string;
  profile_id?: string;
  name: string;
  email: string;
  phone: string;
  role?: UserRole;
  role_title: string; // e.g. Lead Photographer, Drone Operator, Cinematographer
  skills?: string[];
  is_active?: boolean;
  daily_rate?: number;
  day_rate?: number;
  gear_inventory?: string[];
  status?: string;
  blocked_dates?: string[];
  notes?: string;
}

export interface Editor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  is_active?: boolean;
  max_concurrent_projects: number;
  rate_per_project?: number;
  status?: string;
  notes?: string;
}

export type ProjectStatus = 
  | 'Lead' 
  | 'Booked' 
  | 'Pre-Production' 
  | 'Shooting' 
  | 'Editing' 
  | 'Review' 
  | 'Delivered' 
  | 'Archived';

export interface Project {
  id: string;
  company_id: 'twb' | 'golden_june';
  client_id: string;
  name: string;
  wedding_date_start: string;
  wedding_date_end: string;
  venue: string;
  city: string;
  client_contact: {
    phone: string;
    email: string;
  };
  status: ProjectStatus;
  package_name: string;
  package_details: string;
  booking_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
}

export interface ProjectTeamAssignment {
  id: string;
  project_id: string;
  team_member_id: string;
  role: string;
  assignment_date: string; // YYYY-MM-DD
  notes?: string;
}

export type DataCategory = 
  | 'Raw Footage' 
  | 'Photos' 
  | 'Audio' 
  | 'Project Files' 
  | 'Client References' 
  | 'Music' 
  | 'Documents';

export type DataStatus = 'Pending' | 'Received' | 'Ingested' | 'Backed Up' | 'Archived';
export type ProjectDataStatus = DataStatus;

export interface ProjectData {
  id: string;
  project_id: string;
  company_id: 'twb' | 'golden_june';
  category: DataCategory;
  storage_location: string; // e.g., 'Drive 04 / Box B', 'Synology NAS / 2026 / Weddings'
  folder_link: string; // e.g. Google Drive / Dropbox / Frame.io
  description: string;
  status: DataStatus;
  responsible_person: string;
  date_recorded: string;
  notes?: string;
}

export type DeliverableType = 
  | 'Highlight Film (4-5 mins)' 
  | 'Teaser / Reel (60s)' 
  | 'Feature Film (20-30 mins)' 
  | 'Full Ceremony Edit' 
  | 'Speeches & Toasts' 
  | 'Full Photo Gallery (800+)' 
  | 'Fine Art Wedding Album' 
  | 'Parent Albums' 
  | 'Drone Compilation';

export type DeliverableStatus = 
  | 'Not Started' 
  | 'Assigned' 
  | 'In Progress' 
  | 'Submitted' 
  | 'Changes Requested' 
  | 'Approved' 
  | 'Delivered';

export type DeliverablePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Deliverable {
  id: string;
  project_id: string;
  company_id: 'twb' | 'golden_june';
  deliverable_type: DeliverableType;
  assigned_editor_id: string;
  due_date: string;
  status: DeliverableStatus;
  priority: DeliverablePriority;
  external_link?: string;
  notes?: string;
  review_status?: string;
  last_updated: string;
}

export type PaymentMode = 'Bank Transfer' | 'Credit Card' | 'UPI' | 'Cash' | 'Cheque';

export interface Payment {
  id: string;
  project_id: string;
  company_id: 'twb' | 'golden_june';
  payment_date: string;
  amount: number;
  payment_mode: PaymentMode;
  description: string;
  receipt_number: string;
  created_at: string;
}

export type ExpenseCategory = 
  | 'Crew Travel' 
  | 'Equipment Rental' 
  | 'Editor Fee' 
  | 'Accommodations' 
  | 'Studio Gear' 
  | 'Music Licensing' 
  | 'Other';

export interface Expense {
  id: string;
  project_id: string;
  company_id: 'twb' | 'golden_june';
  expense_date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  paid_to: string;
  created_at: string;
}

export type CalendarEventType = 
  | 'Wedding' 
  | 'Shoot' 
  | 'Meeting' 
  | 'Deadline' 
  | 'Deliverable Deadline' 
  | 'Team Assignment' 
  | 'Payment Reminder' 
  | 'Other';

export interface CalendarEvent {
  id: string;
  company_id: 'twb' | 'golden_june';
  project_id?: string;
  title: string;
  event_type: CalendarEventType;
  start_time: string; // ISO string
  end_time: string; // ISO string
  location?: string;
  notes?: string;
  assigned_member_id?: string;
}

export type NotificationType = 
  | 'deliverable_status' 
  | 'booking_conflict' 
  | 'new_enquiry' 
  | 'payment_received' 
  | 'payment_overdue' 
  | 'deadline_approaching' 
  | 'project_assignment'
  | 'Conflict Alert'
  | 'Deliverable Due'
  | 'Payment Reminder'
  | 'Wedding Approaching'
  | 'Enquiry Follow-up';

export interface AppNotification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  created_at: string;
}

export interface QuotationItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}
