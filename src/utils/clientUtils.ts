import { Client } from '../types';

/**
 * Safely normalizes an optional or nullable value to a trimmed, lowercase string.
 * Prevents "TypeError: Cannot read properties of null (reading 'toLowerCase')" runtime crashes.
 */
export function safeNormalizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  return String(val).trim().toLowerCase();
}

/**
 * Checks if a client record matches the user search query in a null-safe manner.
 * Supports case-insensitive searching across:
 * - Client Name
 * - Partner Name
 * - Email address
 * - Phone & Alternate Phone (both formatted string and clean digit matching)
 * - Instagram handles
 * - City, Address, and Notes
 *
 * Guaranteed never to crash when client records contain null or undefined fields.
 */
export function matchesClientSearch(
  client: Client | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  if (!client) {
    return false;
  }

  const query = safeNormalizeString(searchQuery);
  if (!query) {
    // Empty search query matches all clients
    return true;
  }

  // Safe normalizations for all searchable client fields
  const name = safeNormalizeString(client.name);
  const partnerName = safeNormalizeString(client.partner_name);
  const email = safeNormalizeString(client.email);
  const phone = safeNormalizeString(client.phone);
  const alternatePhone = safeNormalizeString(client.alternate_phone);
  const instagram = safeNormalizeString(client.instagram);
  const instagram2 = safeNormalizeString(client.instagram_2);
  const city = safeNormalizeString(client.city);
  const address = safeNormalizeString(client.address);
  const notes = safeNormalizeString(client.notes);

  // Direct substring matches
  if (
    name.includes(query) ||
    partnerName.includes(query) ||
    email.includes(query) ||
    phone.includes(query) ||
    alternatePhone.includes(query) ||
    instagram.includes(query) ||
    instagram2.includes(query) ||
    city.includes(query) ||
    address.includes(query) ||
    notes.includes(query)
  ) {
    return true;
  }

  // Digits-only matching for phone numbers (e.g. searching "555019" against "(555) 019-2834")
  const queryDigits = query.replace(/\D/g, '');
  if (queryDigits.length >= 3) {
    const phoneDigits = phone.replace(/\D/g, '');
    const altPhoneDigits = alternatePhone.replace(/\D/g, '');
    if (phoneDigits.includes(queryDigits) || altPhoneDigits.includes(queryDigits)) {
      return true;
    }
  }

  return false;
}
