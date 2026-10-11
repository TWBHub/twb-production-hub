export interface ProjectTCClause {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
}

export const STANDARD_TC_LIBRARY: Omit<ProjectTCClause, 'enabled'>[] = [
  {
    id: 'booking-confirmation',
    title: 'Booking Fee & Date Exclusivity',
    body: 'The booking advance confirms the calendar reservation exclusively for the commissioned wedding dates and is non-refundable. Dates are officially locked upon receipt of initial payment.',
  },
  {
    id: 'payment-schedule',
    title: 'Payment Schedule & Release of Deliverables',
    body: 'Commercial fees are payable according to the agreed milestone schedule: booking advance to confirm dates, 50% pre-production milestone 14 days prior to wedding events, and the remaining balance due upon preview release prior to physical drive or high-resolution cloud master handover.',
  },
  {
    id: 'cancellation-rescheduling',
    title: 'Cancellation & Rescheduling Policy',
    body: 'In the event of a change of date or cancellation, retainers may be credited toward alternate open dates within 12 months, subject to studio availability. Cancellations requested within 30 days of the commissioned dates remain subject to full agreed fees.',
  },
  {
    id: 'travel-accommodation',
    title: 'Travel, Accommodation & Transfers',
    body: 'For outstation and destination weddings outside the studio base location, all round-trip crew travel, airfare, local transfers, and secure venue lodging are arranged or reimbursed in full by the Client. Wholesome hot crew meals are to be provided during shoot shifts exceeding 5 continuous hours.',
  },
  {
    id: 'drone-coverage',
    title: 'Aerial Drone Cinematography Clearance',
    body: 'Aerial drone coverage is subject to local weather conditions, civil aviation regulations, and venue airspace permissions. In restricted no-fly zones or adverse weather conditions, safety protocols dictate aerial equipment cannot be deployed.',
  },
  {
    id: 'raw-data-archive',
    title: 'Raw Data & Archival Storage Policy',
    body: 'All captured media is dual-backed up during production and archived in studio storage for 90 days following final master delivery. The Client is advised to create multiple independent physical backups upon receiving master hard drives.',
  },
  {
    id: 'delivery-timeline',
    title: 'Delivery Timeline & Post-Production Schedule',
    body: 'Social teaser previews and initial highlight edits are delivered within 3–4 weeks. Complete color-graded photograph collections and signature master films are delivered within 8–12 weeks after the final wedding session.',
  },
  {
    id: 'client-responsibilities',
    title: 'Client Responsibilities & Event Coordination',
    body: 'The Client agrees to provide finalized event flow itineraries and venue entry passes at least 7 days prior to the events, and designate a family coordinator to assist the photography crew with key family member portraits.',
  },
  {
    id: 'venue-access',
    title: 'Venue Permissions & Access Clearance',
    body: 'The Client is responsible for securing photography and filming permissions at all commissioned private, heritage, and religious venues, including any associated location fees or photography permits.',
  },
  {
    id: 'force-majeure',
    title: 'Force Majeure & Unforeseen Events',
    body: 'Neither party shall be held liable for delays or failure to perform resulting from natural catastrophes, extreme severe weather, strikes, government restrictions, or other unforeseen events beyond reasonable human control.',
  },
  {
    id: 'album-approval',
    title: 'Album Curation & Print Approval',
    body: 'Album layout design begins once the Client submits their shortlisted images. The Client receives up to two complimentary review rounds to request image swaps or layout adjustments before final printing.',
  },
  {
    id: 'revision-policy',
    title: 'Creative Discretion & Revision Rounds',
    body: 'Editorial framing, color grading palette, camera positioning, and music curation remain at the professional discretion of the lead studio artist. Minor editing adjustments to the highlight film are accommodated within 14 days of online preview release.',
  },
];

const DEFAULT_ENABLED_IDS = new Set([
  'booking-confirmation',
  'payment-schedule',
  'delivery-timeline',
  'raw-data-archive',
  'travel-accommodation',
  'cancellation-rescheduling',
]);

export const getDefaultProjectClauses = (): ProjectTCClause[] => {
  return STANDARD_TC_LIBRARY.map(item => ({
    ...item,
    enabled: DEFAULT_ENABLED_IDS.has(item.id),
  }));
};

export const getProjectClauses = (projectId: string, projectClauses?: ProjectTCClause[]): ProjectTCClause[] => {
  if (projectClauses && projectClauses.length > 0) {
    return projectClauses;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`project_terms_${projectId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
  }
  return getDefaultProjectClauses();
};

export const saveProjectClausesToStorage = (projectId: string, clauses: ProjectTCClause[]): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`project_terms_${projectId}`, JSON.stringify(clauses));
  }
};
