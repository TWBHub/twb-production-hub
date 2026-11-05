import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Enquiry } from '../../types';

interface DeleteLeadModalProps {
  enquiry: Enquiry;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteLeadModal: React.FC<DeleteLeadModalProps> = ({
  enquiry,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen) return null;

  const coupleName = enquiry.partner_name
    ? `${enquiry.client_name} & ${enquiry.partner_name}`
    : enquiry.client_name;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">
              Permanently Delete Lead?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete the enquiry record for{' '}
              <strong className="text-slate-800">{coupleName}</strong>?
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 p-3 bg-red-50/60 border border-red-200/80 rounded-xl text-xs text-red-700 space-y-1">
          <p className="font-semibold">Destructive Action Notice:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-600">
            <li>This action permanently removes the lead enquiry record.</li>
            <li>Any custom drafted quotations for this lead will also be purged.</li>
            <li>If this lead has already been converted to an active Project, the Project record will not be harmed.</li>
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Lead Permanently'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
