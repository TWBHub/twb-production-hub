import { Company } from '../types';

export const TWB_COMPANY_UUID = '5736bf57-b1db-4896-a4df-4963ded1c4c6';
export const GJ_COMPANY_UUID = '3a19bbe1-a2bc-46db-bbbc-44ef7f5036ec';

export const isUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/**
 * Checks whether an identifier, code, or name corresponds to Golden June.
 */
export const isGoldenJune = (
  company?: Partial<Company> | { code?: string; id?: string; name?: string } | null
): boolean => {
  if (!company) return false;
  if (company.code === 'golden_june') return true;
  if (company.id === 'golden_june' || company.id === GJ_COMPANY_UUID) return true;
  const idLower = (company.id || '').toLowerCase();
  const nameLower = (company.name || '').toLowerCase();
  return idLower.includes('golden') || nameLower.includes('golden');
};

/**
 * Checks whether an identifier, code, or name corresponds to TWB (The Wedding Booth).
 */
export const isTWB = (
  company?: Partial<Company> | { code?: string; id?: string; name?: string } | null
): boolean => {
  if (!company) return false;
  if (company.code === 'twb') return true;
  if (company.id === 'twb' || company.id === TWB_COMPANY_UUID) return true;
  const idLower = (company.id || '').toLowerCase();
  const nameLower = (company.name || '').toLowerCase();
  if (isGoldenJune(company)) return false;
  return idLower.includes('twb') || nameLower.includes('booth') || nameLower.includes('wedding book');
};

export const VERIFIED_BRAND_DETAILS = {
  twb: {
    code: 'twb',
    id: TWB_COMPANY_UUID,
    name: 'The Wedding Booth',
    tagline: 'Wedding Photography & Films',
    email: 'dweddingbooth@gmail.com',
    phone: '+91 9074448850',
    website: 'www.theweddingbooth.in',
    address: '',
    primary_color: '#0f172a',
    accent_color: '#2563eb',
  },
  golden_june: {
    code: 'golden_june',
    id: GJ_COMPANY_UUID,
    name: 'Golden June Films',
    tagline: 'Wedding Photography & Films',
    email: 'goldenjunefilms@gmail.com',
    phone: '+91 9074963370',
    website: 'www.goldenjunefilms.com',
    address: '',
    primary_color: '#3b2207',
    accent_color: '#d97706',
  },
} as const;

export const LEGACY_PLACEHOLDERS = {
  name: ['the wedding book', 'golden june studios', 'wedding book media'],
  email: ['twbfilms.com', 'goldenjunestudios.com', 'hello@twbfilms.com', 'contact@goldenjunestudios.com'],
  phone: ['415) 890-2341', '212) 674-8890', '+1 (415)', '+1 (212)', '555-01'],
  website: ['twbfilms.com', 'goldenjunestudios.com'],
  address: ['townsend', 'crosby', 'san francisco', 'new york', 'soho', 'ca 94107', 'ny 10012'],
  tagline: ['luxury wedding cinema'],
};

/**
 * Normalizes and sanitizes a company record, purging legacy fake US placeholder strings
 * and substituting verified Indian business credentials while preserving genuine
 * user updates, database primary key UUIDs, bank details, and terms.
 */
export const sanitizeCompany = (
  company?: Partial<Company> | null,
  targetBrand?: 'twb' | 'golden_june'
): Company => {
  const isGJ = targetBrand === 'golden_june' || isGoldenJune(company);
  const brandCode: 'twb' | 'golden_june' = isGJ ? 'golden_june' : 'twb';
  const defaults = VERIFIED_BRAND_DETAILS[brandCode];
  const defaultUuid = brandCode === 'golden_june' ? GJ_COMPANY_UUID : TWB_COMPANY_UUID;

  const matchesPlaceholder = (val: string | undefined | null, placeholders: string[]): boolean => {
    if (!val) return true;
    const lower = val.trim().toLowerCase();
    if (!lower) return true;
    return placeholders.some(p => lower.includes(p.toLowerCase()));
  };

  const name =
    matchesPlaceholder(company?.name, LEGACY_PLACEHOLDERS.name) ||
    company?.name === 'twb' ||
    company?.name === 'golden_june'
      ? defaults.name
      : (company?.name || defaults.name);

  const tagline = matchesPlaceholder(company?.tagline, LEGACY_PLACEHOLDERS.tagline)
    ? defaults.tagline
    : (company?.tagline || defaults.tagline);

  const email = matchesPlaceholder(company?.email, LEGACY_PLACEHOLDERS.email)
    ? defaults.email
    : (company?.email || defaults.email);

  const phone = matchesPlaceholder(company?.phone, LEGACY_PLACEHOLDERS.phone)
    ? defaults.phone
    : (company?.phone || defaults.phone);

  const website = matchesPlaceholder(company?.website, LEGACY_PLACEHOLDERS.website)
    ? defaults.website
    : (company?.website || defaults.website);

  const address = matchesPlaceholder(company?.address, LEGACY_PLACEHOLDERS.address)
    ? ''
    : (company?.address || '');

  let preservedId = company?.id;
  if (!preservedId || (!isUuid(preservedId) && preservedId !== 'twb' && preservedId !== 'golden_june')) {
    preservedId = defaultUuid;
  }

  return {
    ...company,
    id: preservedId,
    code: brandCode,
    name,
    tagline,
    email,
    phone,
    website,
    address,
    primary_color: company?.primary_color || defaults.primary_color,
    accent_color: company?.accent_color || defaults.accent_color,
    bank_details: company?.bank_details || {
      account_name: '',
      account_number: '',
      bank_name: '',
      routing_code: '',
    },
    terms_conditions: company?.terms_conditions || '',
  } as Company;
};

/**
 * Resolves a company from a list using code, database UUID, or name,
 * returning a sanitized company record with verified details.
 */
export const resolveCompany = (
  companies: Company[],
  targetBrand: 'twb' | 'golden_june',
  fallbackDefault?: Company
): Company | undefined => {
  const match = Array.isArray(companies) && companies.length > 0
    ? companies.find(c => targetBrand === 'golden_june' ? isGoldenJune(c) : isTWB(c))
    : undefined;

  const found = match || fallbackDefault;
  if (!found) return undefined;
  return sanitizeCompany(found, targetBrand);
};

/**
 * Prepares a company record for save/upsert while strictly preserving
 * existing database UUID primary keys and critical configurations.
 */
export const prepareCompanyForUpdate = (
  companyToSave: Company,
  existingCompanies: Company[]
): Company => {
  const brandCode = companyToSave.code || (isGoldenJune(companyToSave) ? 'golden_june' : 'twb');

  // Look for existing company record to preserve database primary key (especially UUID)
  const existing = existingCompanies.find(c =>
    c.code === brandCode ||
    (brandCode === 'golden_june' ? isGoldenJune(c) : isTWB(c))
  );

  // If the existing company had a UUID, ensure we NEVER overwrite it with 'twb' or 'golden_june'
  let preservedId = companyToSave.id;
  if (existing?.id) {
    if (isUuid(existing.id) || !isUuid(companyToSave.id)) {
      preservedId = existing.id;
    }
  }

  // If still not a UUID, default to the official Supabase database UUID
  if (!isUuid(preservedId)) {
    preservedId = brandCode === 'golden_june' ? GJ_COMPANY_UUID : TWB_COMPANY_UUID;
  }

  const cleaned = sanitizeCompany({
    ...existing,
    ...companyToSave,
    id: preservedId,
    code: brandCode,
  }, brandCode);

  return {
    ...cleaned,
    id: preservedId,
    code: brandCode,
    bank_details: companyToSave.bank_details || existing?.bank_details || {
      account_name: '',
      account_number: '',
      bank_name: '',
      routing_code: '',
    },
    terms_conditions: companyToSave.terms_conditions || existing?.terms_conditions || '',
  };
};

/**
 * Extracts strictly the columns supported by the live Supabase public.companies table schema.
 * The live database table only contains: id, code, name (and created_at).
 * Excludes frontend-only attributes like accent_color, tagline, email, phone, etc.
 * to prevent PostgREST PGRST204 column errors.
 */
export const extractSupabaseCompanyPayload = (
  company: Company
): { id: string; code: string; name: string } => {
  return {
    id: company.id,
    code: company.code,
    name: company.name,
  };
};

/**
 * Safely merges a database row (which only has id, code, name, created_at)
 * into a full frontend Company record, preserving banking details, payment settings,
 * terms, and contact fields.
 */
export const mergeSupabaseCompanyRow = (
  dbRow: { id: string; code?: string; name?: string; created_at?: string },
  existingCompany?: Company
): Company => {
  const brandCode: 'twb' | 'golden_june' =
    dbRow.code === 'golden_june' || isGoldenJune(dbRow) ? 'golden_june' : 'twb';

  return sanitizeCompany({
    ...existingCompany,
    id: dbRow.id,
    code: brandCode,
    name: dbRow.name || existingCompany?.name,
    bank_details: existingCompany?.bank_details,
    terms_conditions: existingCompany?.terms_conditions,
  }, brandCode);
};
