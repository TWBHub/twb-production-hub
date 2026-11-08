import React, { useState } from 'react';
import {
  X,
  FolderKanban,
  UserCheck,
  CheckCircle2,
  DollarSign,
  Calendar,
  Building,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Enquiry, Client, Project, Company } from '../../types';
import { resolveCompanyUuid, resolveBrandCode } from '../../utils/companyUtils';

interface ConvertLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  clients: Client[];
  company: Company;
  projects?: Project[];
  onCreateClient: (client: Omit<Client, 'id' | 'created_at'>) => Promise<Client>;
  onCreateProject: (project: Omit<Project, 'id' | 'created_at'>) => Promise<Project>;
  onUpdateEnquiry: (enquiry: Enquiry) => Promise<Enquiry>;
  onNavigateToProjects?: () => void;
}

export const ConvertLeadModal: React.FC<ConvertLeadModalProps> = ({
  isOpen,
  onClose,
  enquiry,
  clients,
  company,
  projects = [],
  onCreateClient,
  onCreateProject,
  onUpdateEnquiry,
  onNavigateToProjects,
}) => {
  const normalizePhone = (p?: string | null) => (p || '').replace(/\D/g, '');

  // 1. Idempotency Check: Check if this lead was already converted into an active project
  const alreadyConvertedProject = projects.find(
    p => p.enquiry_id === enquiry.id || (enquiry.status === 'Won' && p.name.includes(enquiry.client_name))
  );

  // 2. Client matching
  const existingClient = clients.find(c => {
    const enqEmail = enquiry.email?.trim().toLowerCase();
    const cEmail = c.email?.trim().toLowerCase();
    if (enqEmail && cEmail && enqEmail !== 'client@example.com' && cEmail === enqEmail) return true;

    const enqPhone = normalizePhone(enquiry.phone);
    const cPhone = normalizePhone(c.phone);
    if (enqPhone && cPhone && enqPhone.length >= 10 && cPhone.slice(-10) === enqPhone.slice(-10)) return true;

    const enqName = enquiry.client_name?.trim().toLowerCase();
    const cName = c.name?.trim().toLowerCase();
    if (enqName && cName && enqName === cName) return true;

    return false;
  });

  const defaultYear = enquiry.event_date
    ? new Date(enquiry.event_date).getFullYear()
    : new Date().getFullYear();

  const defaultProjectName =
    enquiry.title ||
    (enquiry.partner_name
      ? `${enquiry.client_name} & ${enquiry.partner_name} • Wedding ${defaultYear}`
      : `${enquiry.client_name || 'Client'} • Wedding ${defaultYear}`);

  // Commissioned Package: Name of package/collection. Leave blank if not explicitly provided in lead.
  // Never join selected services into the package name.
  const defaultPackage = enquiry.package_interest?.trim() || '';

  // Package Scope & Deliverables: What the client receives. Initialized from requirements or service list.
  const defaultScope =
    enquiry.requirements?.trim() ||
    (enquiry.services && enquiry.services.length > 0
      ? enquiry.services.map(s => `• ${s}`).join('\n')
      : '');

  // Financial defaults: If lead has no estimated budget, initial values must be blank.
  const hasInitialBudget = Boolean(enquiry.estimated_budget && enquiry.estimated_budget > 0);
  const initialFee: number | '' = hasInitialBudget ? enquiry.estimated_budget! : '';
  const initialRetainer: number | '' = hasInitialBudget ? Math.round(enquiry.estimated_budget! * 0.2) : '';

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [packageName, setPackageName] = useState(defaultPackage);
  const [packageDetails, setPackageDetails] = useState(defaultScope);
  const [totalAmount, setTotalAmount] = useState<number | ''>(initialFee);
  const [bookingAmount, setBookingAmount] = useState<number | ''>(initialRetainer);
  const [isRetainerManuallyEdited, setIsRetainerManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    project: Project;
    client: Client;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Prevent conversion if lead is archived
  if (enquiry.is_archived) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Lead is Archived</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            This lead is currently archived. Please restore (unarchive) the lead before converting it to an active project.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idempotency: Already Converted Guard
  if (alreadyConvertedProject && !successResult) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Lead Already Converted</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            This lead has already been converted into active project <strong>{alreadyConvertedProject.name}</strong>.
            Duplicate project creation was prevented.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            {onNavigateToProjects && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToProjects();
                }}
                className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <span>View Projects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleFeeChange = (valStr: string) => {
    if (valStr.trim() === '') {
      setTotalAmount('');
      if (!isRetainerManuallyEdited) setBookingAmount('');
      return;
    }
    const num = Number(valStr);
    if (isNaN(num) || num < 0) {
      setTotalAmount('');
      if (!isRetainerManuallyEdited) setBookingAmount('');
      return;
    }
    setTotalAmount(num);
    if (!isRetainerManuallyEdited) {
      setBookingAmount(num > 0 ? Math.round(num * 0.2) : '');
    }
  };

  const handleRetainerChange = (valStr: string) => {
    setIsRetainerManuallyEdited(true);
    if (valStr.trim() === '') {
      setBookingAmount('');
      return;
    }
    const num = Number(valStr);
    setBookingAmount(isNaN(num) || num < 0 ? '' : num);
  };

  const handleResetRetainerTo20 = () => {
    setIsRetainerManuallyEdited(false);
    if (typeof totalAmount === 'number' && totalAmount > 0) {
      setBookingAmount(Math.round(totalAmount * 0.2));
    } else {
      setBookingAmount('');
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // Resolve database company UUID and brand code
      const targetCompanyUuid = resolveCompanyUuid(
        enquiry.company_id || company?.id || company?.code,
        company ? [company] : undefined
      );
      const brandCode = resolveBrandCode(enquiry.company_id || company?.id || company?.code);

      // 1. Resolve or create Client
      let targetClient: Client;
      if (existingClient) {
        targetClient = existingClient;
      } else {
        targetClient = await onCreateClient({
          company_id: targetCompanyUuid,
          name: enquiry.client_name?.trim() || enquiry.title?.trim() || 'Client',
          partner_name: enquiry.partner_name?.trim() || '',
          email: enquiry.email?.trim() || '',
          phone: enquiry.phone?.trim() || '',
          city: enquiry.city?.trim() || '',
          address: enquiry.venue ? `${enquiry.venue}, ${enquiry.city || ''}`.trim() : (enquiry.city || ''),
          instagram: enquiry.instagram || undefined,
          notes: `Converted from Lead Enquiry (${enquiry.id}). Source: ${enquiry.lead_source || 'Direct'}.`,
        });
      }

      // 2. Transfer Event Schedule
      let transferredEvents: any[] = [];
      if (enquiry.events && enquiry.events.length > 0) {
        transferredEvents = enquiry.events.map((ev, idx) => ({
          id: `evt-${Date.now()}-${idx}`,
          project_id: '',
          event_name: ev.event_name.trim() || `Event ${idx + 1}`,
          event_date: ev.event_date || '',
          event_time: ev.event_time?.trim() || undefined,
          event_address: ev.event_address?.trim() || undefined,
          team: ev.team?.trim() || undefined,
          event_notes: ev.event_notes?.trim() || undefined,
          sort_order: idx,
        }));
      } else if (enquiry.event_date) {
        transferredEvents = [
          {
            id: `evt-${Date.now()}-0`,
            project_id: '',
            event_name: 'Wedding Ceremony & Reception',
            event_date: enquiry.event_date,
            event_address: enquiry.venue || undefined,
            sort_order: 0,
          },
        ];
      }

      // Determine date range from actual events (or empty if no dates known)
      const validDates = transferredEvents
        .map(e => e.event_date)
        .filter(d => Boolean(d && /^\d{4}-\d{2}-\d{2}/.test(d)))
        .sort();

      const startDate = validDates[0] || (enquiry.event_date ? enquiry.event_date : '');
      const endDate = validDates[validDates.length - 1] || (enquiry.event_date ? enquiry.event_date : '');

      // 3. Create Project
      const newProject = await onCreateProject({
        company_id: brandCode,
        client_id: targetClient.id,
        enquiry_id: enquiry.id,
        name: projectName.trim(),
        wedding_date_start: startDate,
        wedding_date_end: endDate,
        venue: enquiry.venue || '',
        city: enquiry.city || '',
        client_contact: {
          phone: enquiry.phone || targetClient.phone || '',
          email: enquiry.email || targetClient.email || '',
        },
        status: 'Booked',
        package_name: packageName.trim() || 'Custom Package',
        package_details: packageDetails.trim(),
        booking_amount: typeof bookingAmount === 'number' ? bookingAmount : 0,
        total_amount: typeof totalAmount === 'number' ? totalAmount : 0,
        events: transferredEvents,
        notes: enquiry.notes || undefined, // Transfers internal notes to project notes
      });

      // 4. Update enquiry status to Won
      await onUpdateEnquiry({
        ...enquiry,
        status: 'Won',
      });

      setSuccessResult({
        project: newProject,
        client: targetClient,
      });
    } catch (err: any) {
      console.error('Failed to convert lead:', err);
      setErrorMsg(err.message || 'Failed to convert lead to project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 border border-slate-200 my-8">
        {!successResult ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Confirm Conversion & Create Project
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review and confirm commercial terms before launching production.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleConvert} className="mt-4 space-y-4 text-xs">
              {/* Client Status Badge */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800">
                    {existingClient ? 'Existing Client Matched' : 'New Client Record Will Be Created'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {existingClient
                      ? `Reusing existing client "${existingClient.name}" (${existingClient.email || existingClient.phone})`
                      : `Will create a new client record for "${enquiry.client_name || enquiry.title}" without duplicates.`}
                  </p>
                </div>
              </div>

              {/* Project Title */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirmed Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Commissioned Package & Deliverables Scope */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Commissioned Package
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={e => setPackageName(e.target.value)}
                    placeholder="e.g. The Sovereign Collection (leave blank if custom)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Collection / tier name agreed with client. Does not duplicate individual services.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Package Scope & Deliverables
                  </label>
                  <textarea
                    rows={3}
                    value={packageDetails}
                    onChange={e => setPackageDetails(e.target.value)}
                    placeholder="Itemized deliverables, coverage hours, cinematographers, albums..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono text-xs"
                  />
                </div>
              </div>

              {/* Commercials: Agreed Fee & Booking Retainer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Total Agreed Fee (INR ₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      placeholder="Enter agreed fee (e.g. 350000)"
                      value={totalAmount === '' ? '' : totalAmount}
                      onChange={e => handleFeeChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white"
                    />
                  </div>
                  {hasInitialBudget && (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Suggested from lead estimated budget (₹{enquiry.estimated_budget?.toLocaleString()})
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Booking Retainer Schedule (INR ₹)
                    </label>
                    {isRetainerManuallyEdited && (
                      <button
                        type="button"
                        onClick={handleResetRetainerTo20}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        Reset to 20%
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Auto 20% of fee (or custom)"
                      value={bookingAmount === '' ? '' : bookingAmount}
                      onChange={e => handleRetainerChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {typeof totalAmount === 'number' && totalAmount > 0 && typeof bookingAmount === 'number'
                      ? `${Math.round((bookingAmount / totalAmount) * 100)}% of total fee${isRetainerManuallyEdited ? ' (custom override)' : ' (standard 20% default)'}`
                      : 'Standard default is 20% of total fee once entered'}
                  </span>
                </div>
              </div>

              {/* Important Retainer Policy Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-900">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Retainer Policy: </strong>
                  Entering the agreed booking retainer establishes the contract schedule. It does <strong>not</strong> mark funds as received or create a paid finance entry. Payments are recorded strictly when cleared funds are confirmed via the Finance receipt workflow.
                </div>
              </div>

              {/* Transfer Summary */}
              <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>• Brand: <strong>{company?.name || 'The Wedding Booth'}</strong></div>
                <div>• Events to transfer: <strong>{enquiry.events?.length || (enquiry.event_date ? 1 : 0)} event(s)</strong> with all ceremony addresses & notes.</div>
                {enquiry.venue && <div>• Primary Venue: <strong>{enquiry.venue}</strong></div>}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Converting...</span>
                  ) : (
                    <>
                      <span>Confirm Conversion & Create Project</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Success Screen */
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lead Successfully Converted!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Project <strong>{successResult.project.name}</strong> and client{' '}
                <strong>{successResult.client.name}</strong> are now live in TWBHub.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
              >
                Done
              </button>
              {onNavigateToProjects && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToProjects();
                  }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <span>Open Projects View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
