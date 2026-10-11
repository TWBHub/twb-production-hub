import {
  ProjectData,
  StorageDropdownOption,
  StorageTypeOption,
  StorageStatusOption,
  STORAGE_DROPDOWN_OPTIONS,
  STORAGE_TYPE_OPTIONS,
  STORAGE_STATUS_OPTIONS,
} from '../types';

export interface NormalizedStorageRecord {
  storage: StorageDropdownOption;
  name: string;
  type: StorageTypeOption;
  location: string;
  notes: string;
  status: StorageStatusOption;
}

export const normalizeStorageRecord = (item: ProjectData): NormalizedStorageRecord => {
  // 1. Storage dropdown (Client's | TWB's | GJ's | Other's | The Backup Drive)
  let storage: StorageDropdownOption = "TWB's";
  if (item.storage && STORAGE_DROPDOWN_OPTIONS.includes(item.storage)) {
    storage = item.storage;
  } else if (
    item.responsible_person &&
    STORAGE_DROPDOWN_OPTIONS.includes(item.responsible_person as StorageDropdownOption)
  ) {
    storage = item.responsible_person as StorageDropdownOption;
  } else if (item.company_id === 'golden_june') {
    storage = "GJ's";
  }

  // 2. Name (Plain text input, e.g. Sandisk, EVM, 6TB Tower, Editor's)
  let name = item.name || '';
  if (!name) {
    if (
      item.storage_location &&
      !['Office', "Editor's Desk", 'Client', 'Home'].includes(item.storage_location)
    ) {
      name = item.storage_location;
    } else if (item.description) {
      name = item.description.split('.')[0].slice(0, 30);
    } else {
      name = 'Storage Drive';
    }
  }

  // 3. Type (SSD | HDD | Drive)
  let type: StorageTypeOption = 'SSD';
  if (item.type && STORAGE_TYPE_OPTIONS.includes(item.type)) {
    type = item.type;
  } else if (item.category === 'HDD') {
    type = 'HDD';
  } else if (item.category === 'Tower Drive' || item.category === 'Drive') {
    type = 'Drive';
  } else if (item.category === 'SSD') {
    type = 'SSD';
  } else if (typeof item.storage_location === 'string' && /hdd/i.test(item.storage_location)) {
    type = 'HDD';
  } else if (
    typeof item.storage_location === 'string' &&
    /tower|nas|vault|archive/i.test(item.storage_location)
  ) {
    type = 'Drive';
  }

  // 4. Location (Plain text input, e.g. Office, Editor's Desk, Client, Home)
  let location = item.location || '';
  if (!location) {
    if (
      item.storage_location &&
      ['Office', "Editor's Desk", 'Client', 'Home'].includes(item.storage_location)
    ) {
      location = item.storage_location;
    } else {
      location = 'Office';
    }
  }

  // 5. Notes (Plain text input, e.g. 1TB, 2TB, 6TB)
  const notes = item.notes || item.description || '';

  // 6. Status (Active | Archived | Delivered | Deleted)
  let status: StorageStatusOption = 'Active';
  if (item.status && STORAGE_STATUS_OPTIONS.includes(item.status as StorageStatusOption)) {
    status = item.status as StorageStatusOption;
  } else if (item.status === 'Archived') {
    status = 'Archived';
  }

  return {
    storage,
    name,
    type,
    location,
    notes,
    status,
  };
};

export const getStorageStatusBadge = (status: string) => {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'Archived':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'Delivered':
      return 'bg-purple-50 text-purple-800 border-purple-300';
    case 'Deleted':
      return 'bg-rose-50 text-rose-800 border-rose-300';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};
