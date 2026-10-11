import { ProjectEvent } from '../types';

/**
 * Sorts project events chronologically by their event_date as the primary sort key.
 * If two events happen on the same date, uses sort_order as secondary ordering,
 * and preserves existing relative order if sort_orders match or are omitted.
 */
export const sortProjectEvents = (events?: ProjectEvent[]): ProjectEvent[] => {
  if (!events || events.length <= 1) return events ? [...events] : [];

  return events
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const dateA = a.item.event_date || '';
      const dateB = b.item.event_date || '';
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) return cmp;

      if (
        typeof a.item.sort_order === 'number' &&
        typeof b.item.sort_order === 'number' &&
        a.item.sort_order !== b.item.sort_order
      ) {
        return a.item.sort_order - b.item.sort_order;
      }

      return a.index - b.index;
    })
    .map(x => x.item);
};
