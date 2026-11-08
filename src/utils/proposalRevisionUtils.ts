import { Quotation, Company, Enquiry } from '../types';
import { isGoldenJune } from './companyUtils';

export interface ProposalGroup {
  proposalId: string;
  quotationNumber: string;
  enquiryId: string;
  companyId: 'twb' | 'golden_june';
  latestQuotation: Quotation;
  revisions: Quotation[]; // Sorted descending: newest/highest version first
  highestVersion: number;
}

/**
 * Returns the persistent proposal parent identity.
 * Falls back to quotation_number for legacy records created prior to explicit proposal_id.
 */
export const getProposalIdentity = (quote: Quotation): string => {
  return (quote.proposal_id && quote.proposal_id.trim()) || quote.quotation_number.trim();
};

/**
 * Generates a clean, unique Proposal Reference code.
 * Format: QT-{CODE}-{YEAR}-{0001...}
 */
export const generateProposalReference = (
  companyCode: string,
  existingQuotations: Quotation[] = []
): string => {
  const code = (companyCode || 'TWB').toUpperCase() === 'GOLDEN_JUNE' ? 'GJ' : (companyCode || 'TWB').toUpperCase();
  const year = new Date().getFullYear();
  const prefix = `QT-${code}-${year}-`;

  let maxSeq = 0;
  existingQuotations.forEach(q => {
    if (q.quotation_number && q.quotation_number.startsWith(prefix)) {
      const parts = q.quotation_number.split('-');
      const numStr = parts[parts.length - 1];
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
};

/**
 * Calculates the next revision number for an existing proposal.
 * Automatically increments based on the highest existing revision for that proposal reference.
 */
export const getNextProposalRevisionNumber = (
  proposalIdOrNumber: string,
  allQuotations: Quotation[] = []
): number => {
  const targetId = proposalIdOrNumber.trim();
  const matching = allQuotations.filter(
    q => (q.proposal_id && q.proposal_id.trim() === targetId) || q.quotation_number.trim() === targetId
  );

  if (matching.length === 0) return 1;

  const versions = matching.map(q => Number(q.version) || 1);
  const maxVersion = Math.max(...versions, 1);
  return maxVersion + 1;
};

/**
 * Groups an array of quotations (e.g. for a lead) by Proposal Reference / Identity.
 * All historical revisions are grouped under one proposal entry.
 * Gracefully resolves any legacy duplicate version numbers by sequencing them chronologically.
 */
export const groupQuotationsIntoProposals = (
  quotations: Quotation[] = []
): ProposalGroup[] => {
  const map = new Map<string, Quotation[]>();

  // Group by proposal identity (proposal_id || quotation_number)
  quotations.forEach(q => {
    const key = getProposalIdentity(q);
    const existing = map.get(key) || [];
    existing.push(q);
    map.set(key, existing);
  });

  const groups: ProposalGroup[] = [];

  map.forEach((revisionsRaw, key) => {
    if (revisionsRaw.length === 0) return;

    // 1. Sort chronologically (ascending by created_at or version)
    const sortedAsc = [...revisionsRaw].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.version || 1) - (b.version || 1);
    });

    // 2. Handle legacy duplicate versions: ensure strictly increasing versions for display
    let lastSeenVersion = 0;
    const normalizedRevisions = sortedAsc.map(rev => {
      let currentVersion = Number(rev.version) || 1;
      if (currentVersion <= lastSeenVersion) {
        currentVersion = lastSeenVersion + 1;
      }
      lastSeenVersion = currentVersion;
      return {
        ...rev,
        version: currentVersion,
      };
    });

    // 3. Sort descending for presentation (latest revision on top)
    const sortedDesc = [...normalizedRevisions].sort((a, b) => b.version - a.version);
    const latest = sortedDesc[0];

    groups.push({
      proposalId: key,
      quotationNumber: latest.quotation_number,
      enquiryId: latest.enquiry_id,
      companyId: latest.company_id,
      latestQuotation: latest,
      revisions: sortedDesc,
      highestVersion: latest.version,
    });
  });

  // Sort groups by newest proposal first
  return groups.sort((a, b) => {
    const timeA = new Date(a.latestQuotation.created_at || 0).getTime();
    const timeB = new Date(b.latestQuotation.created_at || 0).getTime();
    return timeB - timeA;
  });
};

/**
 * Sanitizes project/lead titles for clean filenames:
 * Replaces spaces with hyphens, collapses dashes, and removes filesystem-illegal characters.
 */
export const sanitizeProjectNameForFilename = (name?: string): string => {
  if (!name || !name.trim()) return 'Project';
  const clean = name
    .trim()
    .replace(/[/\\?%*:|"<>#]/g, '')  // Remove invalid filesystem chars
    .replace(/[\s_]+/g, '-')         // Convert spaces and underscores to hyphens
    .replace(/-+/g, '-')             // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');        // Remove leading or trailing hyphens
  return clean || 'Project';
};

/**
 * Generates the clean PDF proposal filename following the required convention:
 * `GoldenJune_Proposal_[ProjectName]_v1.pdf` or `TWB_Proposal_[ProjectName]_v1.pdf`
 * Filename revision number strictly matches the exact revision being downloaded.
 */
export const getProposalFilename = (
  company: Company,
  enquiry: Enquiry,
  quotationOrVersion?: Quotation | { version?: number } | number
): string => {
  const isGJ = isGoldenJune(company);
  const brandPrefix = isGJ ? 'GoldenJune' : 'TWB';

  const rawProjectName = (enquiry.title || enquiry.client_name || '').trim();
  const cleanProjectName = sanitizeProjectNameForFilename(rawProjectName);

  let version = 1;
  if (typeof quotationOrVersion === 'number') {
    version = quotationOrVersion;
  } else if (quotationOrVersion && typeof quotationOrVersion === 'object') {
    if ('version' in quotationOrVersion && typeof quotationOrVersion.version === 'number') {
      version = quotationOrVersion.version;
    }
  }

  return `${brandPrefix}_Proposal_${cleanProjectName}_v${version}.pdf`;
};
