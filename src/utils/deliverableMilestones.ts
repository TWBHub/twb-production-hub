import { Deliverable, DeliverableStatus, Editor } from '../types';

export const DEFAULT_EDITOR_ACTIVE_DELIVERABLE_CAPACITY = 4;

/**
 * Computes milestone timestamps when updating a deliverable.
 * - Reassignment: when assigned_editor_id changes to a different non-empty editor ID, records a fresh assignment timestamp.
 * - Same editor: preserves the existing assignment timestamp.
 * - Unassigned: clears the assignment timestamp.
 * - First Submitted: recorded only on first transition to 'Submitted', never overwritten on revisions or later edits.
 * - Delivered: recorded only on first transition to 'Delivered', never overwritten on subsequent edits.
 */
export function computeMilestonesOnUpdate(
  existing: Deliverable | undefined,
  updated: Deliverable,
  nowIso: string = new Date().toISOString()
): {
  assigned_at?: string;
  first_submitted_at?: string;
  delivered_at?: string;
} {
  const existingEditorId = (existing?.assigned_editor_id || '').trim();
  const newEditorId = (updated.assigned_editor_id || '').trim();

  let assigned_at: string | undefined;
  if (newEditorId && newEditorId !== existingEditorId) {
    // Reassigned to a different editor (or newly assigned)
    assigned_at = nowIso;
  } else if (newEditorId && newEditorId === existingEditorId) {
    // Retained existing editor: preserve existing assignment date
    assigned_at = existing?.assigned_at || updated.assigned_at;
  } else {
    // Unassigned
    assigned_at = undefined;
  }

  // First Submitted milestone: set only if transitioning to 'Submitted' and not already recorded
  let first_submitted_at: string | undefined = existing?.first_submitted_at || updated.first_submitted_at;
  if (updated.status === 'Submitted' && !first_submitted_at) {
    first_submitted_at = nowIso;
  }

  // Delivered milestone: set only if transitioning to 'Delivered' and not already recorded
  let delivered_at: string | undefined = existing?.delivered_at || updated.delivered_at;
  if (updated.status === 'Delivered' && !delivered_at) {
    delivered_at = nowIso;
  }

  return { assigned_at, first_submitted_at, delivered_at };
}

/**
 * Computes milestone timestamps on a status transition (e.g. from a quick status change).
 * - First Submitted: recorded only on first transition to 'Submitted'.
 * - Delivered: recorded only on first transition to 'Delivered'.
 * - Never overwrites previously recorded milestones.
 */
export function computeMilestonesOnStatusChange(
  current: Deliverable | undefined,
  newStatus: DeliverableStatus,
  nowIso: string = new Date().toISOString()
): {
  assigned_at?: string;
  first_submitted_at?: string;
  delivered_at?: string;
} {
  const assigned_at = current?.assigned_at;

  let first_submitted_at = current?.first_submitted_at;
  if (newStatus === 'Submitted' && !first_submitted_at) {
    first_submitted_at = nowIso;
  }

  let delivered_at = current?.delivered_at;
  if (newStatus === 'Delivered' && !delivered_at) {
    delivered_at = nowIso;
  }

  return { assigned_at, first_submitted_at, delivered_at };
}

/**
 * Returns the effective deliverable capacity for an editor.
 * Uses max_active_deliverables if present, then max_concurrent_projects, defaulting to 4.
 */
export function getEffectiveDeliverableCapacity(
  editor?: Partial<Editor> | null,
  defaultCapacity: number = DEFAULT_EDITOR_ACTIVE_DELIVERABLE_CAPACITY
): number {
  if (!editor) return defaultCapacity;
  return (
    editor.max_active_deliverables ||
    editor.max_concurrent_projects ||
    defaultCapacity
  );
}

/**
 * Calculates workload metrics for an editor against a list of deliverables.
 * Active deliverables are items assigned to the editor that are not 'Delivered'.
 */
export function calculateEditorDeliverableWorkload(
  editorId: string,
  effectiveCapacity: number,
  deliverables: Deliverable[]
): {
  activeDeliverables: Deliverable[];
  completedDeliverables: Deliverable[];
  activeCount: number;
  completedCount: number;
  utilizationPercent: number;
  isAtOrOverCapacity: boolean;
  earliestActiveAssignmentDate: string | null;
  latestActiveAssignmentDate: string | null;
} {
  const assigned = deliverables.filter(d => d.assigned_editor_id === editorId);
  const activeDeliverables = assigned.filter(d => d.status !== 'Delivered');
  const completedDeliverables = assigned.filter(d => d.status === 'Delivered');
  const cap = Math.max(1, effectiveCapacity);
  const utilizationPercent = Math.round((activeDeliverables.length / cap) * 100);

  let earliest: string | null = null;
  let latest: string | null = null;
  activeDeliverables.forEach(d => {
    const dateVal = d.assigned_at || d.last_updated;
    if (dateVal) {
      if (!earliest || dateVal < earliest) earliest = dateVal;
      if (!latest || dateVal > latest) latest = dateVal;
    }
  });

  return {
    activeDeliverables,
    completedDeliverables,
    activeCount: activeDeliverables.length,
    completedCount: completedDeliverables.length,
    utilizationPercent,
    isAtOrOverCapacity: activeDeliverables.length >= cap,
    earliestActiveAssignmentDate: earliest,
    latestActiveAssignmentDate: latest,
  };
}

export interface ParsedDeliverableNotes {
  userNotes?: string;
  metadata?: {
    assigned_at?: string;
    first_submitted_at?: string;
    delivered_at?: string;
    [key: string]: any;
  };
}

/**
 * Extracts user-authored notes and milestone metadata from raw notes string.
 * Supports:
 * - null / undefined / empty notes
 * - Ordinary plain-text user notes
 * - Legacy metadata format: __METADATA__:{"assigned_at":"..."} (exposing undefined userNotes to UI)
 * - New composite format: __METADATA__:{"user_notes":"...","assigned_at":"..."}
 */
export function parseDeliverableNotes(rawNotes?: string | null): ParsedDeliverableNotes {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return { userNotes: undefined, metadata: undefined };
  }

  const trimmed = rawNotes.trim();
  if (!trimmed) {
    return { userNotes: undefined, metadata: undefined };
  }

  if (trimmed.startsWith('__METADATA__:')) {
    const jsonStr = trimmed.replace('__METADATA__:', '');
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        const rawUserNotes = parsed.user_notes;
        const userNotes =
          typeof rawUserNotes === 'string' && rawUserNotes.trim() !== ''
            ? rawUserNotes.trim()
            : undefined;

        const metadata: Record<string, any> = {};
        if (parsed.assigned_at) metadata.assigned_at = parsed.assigned_at;
        if (parsed.first_submitted_at) metadata.first_submitted_at = parsed.first_submitted_at;
        if (parsed.delivered_at) metadata.delivered_at = parsed.delivered_at;

        return {
          userNotes,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
      }
    } catch {
      // If parsing fails, do NOT expose corrupted metadata string to user
      return { userNotes: undefined, metadata: undefined };
    }
  }

  // Ordinary user note without metadata
  return { userNotes: rawNotes, metadata: undefined };
}

/**
 * Serializes user-authored notes and milestone metadata for database persistence.
 * When milestone timestamps are present, encodes them alongside user_notes under '__METADATA__:'.
 * When no milestone timestamps are present, returns clean user notes string or null.
 */
export function serializeDeliverableNotes(
  userNotes?: string | null,
  milestones?: {
    assigned_at?: string | null;
    first_submitted_at?: string | null;
    delivered_at?: string | null;
  }
): string | null {
  let cleanNotes: string | undefined = undefined;
  let embeddedMilestones: Record<string, any> | undefined = undefined;

  if (userNotes && typeof userNotes === 'string') {
    const trimmed = userNotes.trim();
    if (trimmed.startsWith('__METADATA__:')) {
      const parsed = parseDeliverableNotes(trimmed);
      cleanNotes = parsed.userNotes;
      embeddedMilestones = parsed.metadata;
    } else if (trimmed) {
      cleanNotes = trimmed;
    }
  }

  const assigned_at =
    milestones?.assigned_at !== undefined
      ? (milestones.assigned_at || undefined)
      : embeddedMilestones?.assigned_at;
  const first_submitted_at =
    milestones?.first_submitted_at !== undefined
      ? (milestones.first_submitted_at || undefined)
      : embeddedMilestones?.first_submitted_at;
  const delivered_at =
    milestones?.delivered_at !== undefined
      ? (milestones.delivered_at || undefined)
      : embeddedMilestones?.delivered_at;

  const hasMilestones = Boolean(assigned_at || first_submitted_at || delivered_at);

  if (!hasMilestones) {
    return cleanNotes ? cleanNotes : null;
  }

  const metaObj: Record<string, any> = {};
  if (cleanNotes) {
    metaObj.user_notes = cleanNotes;
  }
  if (assigned_at) metaObj.assigned_at = assigned_at;
  if (first_submitted_at) metaObj.first_submitted_at = first_submitted_at;
  if (delivered_at) metaObj.delivered_at = delivered_at;

  return `__METADATA__:${JSON.stringify(metaObj)}`;
}

/**
 * Prepares notes and milestone timestamps when creating a deliverable.
 * - Extracts clean user notes if incoming notes contains legacy or composite __METADATA__:
 * - Preserves existing milestone timestamps if present on the input object or in parsed metadata.
 * - For assigned deliverables without an existing assignment timestamp, assigns nowIso.
 * - For submitted deliverables without an existing first-submission timestamp, assigns nowIso.
 * - For delivered deliverables without an existing delivery timestamp, assigns nowIso.
 * - Returns clean userNotes, milestone timestamps, and serializedNotes for metadata fallback.
 */
export function prepareDeliverableForCreate(
  deliverable: {
    status?: DeliverableStatus | string | null;
    assigned_editor_id?: string | null;
    notes?: string | null;
    assigned_at?: string | null;
    first_submitted_at?: string | null;
    delivered_at?: string | null;
    [key: string]: any;
  },
  nowIso: string = new Date().toISOString()
): {
  userNotes?: string;
  assigned_at?: string;
  first_submitted_at?: string;
  delivered_at?: string;
  serializedNotesForFallback: string | null;
} {
  let userNotes: string | undefined = undefined;
  let embeddedMeta: Record<string, any> | undefined = undefined;

  if (deliverable.notes && typeof deliverable.notes === 'string') {
    const trimmed = deliverable.notes.trim();
    if (trimmed.startsWith('__METADATA__:')) {
      const parsed = parseDeliverableNotes(trimmed);
      userNotes = parsed.userNotes;
      embeddedMeta = parsed.metadata;
    } else if (trimmed) {
      userNotes = trimmed;
    }
  }

  const assignedEditorId = (deliverable.assigned_editor_id || '').trim();
  const existingAssignedAt = deliverable.assigned_at || embeddedMeta?.assigned_at;
  const assigned_at = assignedEditorId
    ? (existingAssignedAt || nowIso)
    : undefined;

  const existingFirstSubmittedAt = deliverable.first_submitted_at || embeddedMeta?.first_submitted_at;
  const first_submitted_at =
    deliverable.status === 'Submitted'
      ? (existingFirstSubmittedAt || nowIso)
      : (existingFirstSubmittedAt || undefined);

  const existingDeliveredAt = deliverable.delivered_at || embeddedMeta?.delivered_at;
  const delivered_at =
    deliverable.status === 'Delivered'
      ? (existingDeliveredAt || nowIso)
      : (existingDeliveredAt || undefined);

  const serializedNotesForFallback = serializeDeliverableNotes(userNotes, {
    assigned_at,
    first_submitted_at,
    delivered_at,
  });

  return {
    userNotes,
    assigned_at,
    first_submitted_at,
    delivered_at,
    serializedNotesForFallback,
  };
}

