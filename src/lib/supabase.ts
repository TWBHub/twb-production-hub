import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase environment configuration
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Runtime local storage override support for user custom connections
const getStoredConfig = () => {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('twbhub_supabase_url') : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('twbhub_supabase_anon_key') : null;

  return {
    url: storedUrl || envUrl,
    key: storedKey || envKey,
  };
};

export const getSupabaseConfig = getStoredConfig;

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('twbhub_supabase_url', url);
    else localStorage.removeItem('twbhub_supabase_url');

    if (key) localStorage.setItem('twbhub_supabase_anon_key', key);
    else localStorage.removeItem('twbhub_supabase_anon_key');
  }
};

/**
 * Indicates whether valid Supabase environment credentials are provided.
 */
export const isSupabaseConfigured = Boolean(
  envUrl &&
  envKey &&
  !envUrl.includes('your-project') &&
  !envKey.includes('your-anon-key')
);

/**
 * Shared Supabase client instance initialized from environment variables.
 * Ready to be imported and used across the entire application.
 */
export const supabase: SupabaseClient = createClient(
  envUrl || 'https://placeholder-project.supabase.co',
  envKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

let cachedDynamicClient: SupabaseClient | null = null;
let lastClientConfig = { url: '', key: '' };

/**
 * Helper to retrieve an active client instance.
 * Returns the shared client if configured via environment or local settings, or null if unconfigured.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, key } = getStoredConfig();
  if (!url || !key || url.includes('your-project') || key.includes('your-anon-key')) {
    return null;
  }

  // If using default environment variables, return the shared singleton
  if (url === envUrl && key === envKey) {
    return supabase;
  }

  if (cachedDynamicClient && lastClientConfig.url === url && lastClientConfig.key === key) {
    return cachedDynamicClient;
  }

  try {
    cachedDynamicClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastClientConfig = { url, key };
    return cachedDynamicClient;
  } catch (err) {
    console.warn('Could not initialize Supabase client:', err);
    return null;
  }
};

export default supabase;

// SQL Schema for the 13 required Supabase PostgreSQL tables
export const SUPABASE_SQL_SCHEMA = `-- TWBHub Supabase PostgreSQL Schema
-- Tables: companies, clients, enquiries, profiles, team_members, projects, 
-- project_team, project_data, deliverables, payments, expenses, calendar_events, notifications

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. COMPANIES
create table if not exists companies (
  id text primary key,
  code text unique not null,
  name text not null,
  tagline text,
  email text,
  phone text,
  website text,
  address text,
  primary_color text default '#0f172a',
  accent_color text default '#d97706',
  bank_details jsonb default '{}'::jsonb,
  terms_conditions text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. CLIENTS
create table if not exists clients (
  id uuid default uuid_generate_v4() primary key,
  company_id text references companies(id) on delete cascade,
  name text not null,
  partner_name text,
  email text not null,
  phone text not null,
  address text,
  instagram text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. PROFILES
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  full_name text not null,
  role text check (role in ('Admin', 'Manager', 'Team Member', 'Editor')) not null default 'Team Member',
  avatar_url text,
  phone text,
  company_id text default 'both',
  status text check (status in ('Active', 'Inactive')) default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TEAM MEMBERS
create table if not exists team_members (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  role_title text not null,
  skills text[] default array[]::text[],
  is_active boolean default true,
  daily_rate numeric default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ENQUIRIES
create table if not exists enquiries (
  id uuid default uuid_generate_v4() primary key,
  company_id text references companies(id) on delete cascade,
  client_name text not null,
  partner_name text,
  email text not null,
  phone text not null,
  event_date date not null,
  venue text not null,
  lead_source text,
  requirements text,
  estimated_budget numeric default 0,
  status text check (status in ('New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost')) default 'New',
  follow_up_date date,
  notes text,
  quotation_status text check (quotation_status in ('Draft', 'Sent', 'Approved', 'Declined', 'Expired')) default 'Draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. PROJECTS
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  company_id text references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  wedding_date_start date not null,
  wedding_date_end date not null,
  venue text not null,
  city text,
  client_contact jsonb default '{}'::jsonb,
  status text check (status in ('Lead', 'Booked', 'Pre-Production', 'Shooting', 'Editing', 'Review', 'Delivered', 'Archived')) default 'Booked',
  package_name text not null,
  package_details text,
  booking_amount numeric default 0,
  total_amount numeric default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. PROJECT TEAM (ASSIGNMENTS)
create table if not exists project_team (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete cascade,
  role text not null,
  assignment_date date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. PROJECT DATA (METADATA & EXTERNAL STORAGE LINKS)
create table if not exists project_data (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  category text check (category in ('Raw Footage', 'Photos', 'Audio', 'Project Files', 'Client References', 'Music', 'Documents')) not null,
  storage_location text not null,
  folder_link text not null,
  description text,
  status text check (status in ('Pending', 'Received', 'Backed Up', 'Archived')) default 'Pending',
  responsible_person text,
  date_recorded date default current_date,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. DELIVERABLES
create table if not exists deliverables (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  deliverable_type text not null,
  assigned_editor_id uuid references team_members(id) on delete set null,
  due_date date not null,
  status text check (status in ('Not Started', 'Assigned', 'In Progress', 'Submitted', 'Changes Requested', 'Approved', 'Delivered')) default 'Not Started',
  priority text check (priority in ('Low', 'Medium', 'High', 'Urgent')) default 'Medium',
  external_link text,
  notes text,
  review_status text,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. PAYMENTS
create table if not exists payments (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  payment_date date not null,
  amount numeric not null,
  payment_mode text check (payment_mode in ('Bank Transfer', 'Credit Card', 'UPI', 'Cash', 'Cheque')) not null,
  description text,
  receipt_number text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. EXPENSES
create table if not exists expenses (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  expense_date date not null,
  amount numeric not null,
  category text check (category in ('Crew Travel', 'Equipment Rental', 'Editor Fee', 'Accommodations', 'Studio Gear', 'Music Licensing', 'Other')) not null,
  description text,
  paid_to text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 12. CALENDAR EVENTS
create table if not exists calendar_events (
  id uuid default uuid_generate_v4() primary key,
  company_id text references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  event_type text check (event_type in ('Wedding', 'Shoot', 'Meeting', 'Deadline', 'Deliverable Deadline', 'Team Assignment', 'Payment Reminder', 'Other')) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  location text,
  notes text,
  assigned_member_id uuid references team_members(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 13. NOTIFICATIONS
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text check (type in ('deliverable_status', 'booking_conflict', 'new_enquiry', 'payment_received', 'payment_overdue', 'deadline_approaching', 'project_assignment')) not null,
  read boolean default false,
  link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies can be applied here to enforce role permissions on Supabase
`;
