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
} from 'lucide-react';
import { Enquiry, Client, Project, Company } from '../../types';

interface ConvertLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  clients: Client[];
  company: Company;
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
  onCreateClient,
  onCreateProject,
  onUpdateEnquiry,
  onNavigateToProjects,
}) => {
  // Check if client exists
  const existingClient = clients.find(
    c =>
      (enquiry.email && c.email.toLowerCase() === enquiry.email.toLowerCase()) ||
      (enquiry.phone && c.phone === enquiry.phone) ||
      c.name.toLowerCase() === enquiry.client_name.toLowerCase()
  );

  const defaultProjectName = enquiry.partner_name
    ? `${enquiry.client_name} & ${enquiry.partner_name} • Wedding ${new Date(enquiry.event_date || Date.now()).getFullYear()}`
    : `${enquiry.client_name} • Wedding ${new Date(enquiry.event_date || Date.now()).getFullYear()}`;

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [totalAmount, setTotalAmount] = useState<number>(enquiry.estimated_budget || 200000);
  const [bookingAmount, setBookingAmount] = useState<number>(
    Math.round((enquiry.estimated_budget || 200000) * 0.2)
  );
  const [packageName, setPackageName] = useState(
    enquiry.services && enquiry.services.length > 0
      ? enquiry.services.join(' + ')
      : 'Bespoke Wedding Cinema & Photography'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    project: Project;
    client: Client;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

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

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // 1. Resolve or create Client
      let targetClient: Client;
      if (existingClient) {
        targetClient = existingClient;
      } else {
        targetClient = await onCreateClient({
          company_id: enquiry.company_id,
          name: enquiry.client_name,
          partner_name: enquiry.partner_name || '',
          email: enquiry.email || 'client@example.com',
          phone: enquiry.phone || '',
          address: enquiry.city || '',
          notes: `Converted from Lead Enquiry (${enquiry.id}). Source: ${enquiry.lead_source}.`,
        });
      }

      // 2. Create Project
      const newProject = await onCreateProject({
        company_id: enquiry.company_id,
        client_id: targetClient.id,
        name: projectName.trim(),
        wedding_date_start: enquiry.event_date,
        wedding_date_end: enquiry.event_date,
        venue: enquiry.venue || 'TBD',
        city: enquiry.city || 'TBD',
        client_contact: {
          phone: enquiry.phone,
          email: enquiry.email,
        },
        status: 'Booked',
        package_name: packageName,
        package_details: enquiry.requirements || 'Principal coverage and deliverables.',
        booking_amount: bookingAmount,
        total_amount: totalAmount,
        events: [
          {
            id: `evt-${Date.now()}`,
            project_id: '',
            event_name: 'Wedding Ceremony & Reception',
            event_date: enquiry.event_date,
            start_time: '16:00',
            end_time: '23:00',
            venue: enquiry.venue || 'TBD',
            location: enquiry.city || 'TBD',
            coverage_scope: 'Full cinematography and photography coverage',
          },
        ],
      });

      // 3. Update enquiry status to Won
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 my-8">
        {!successResult ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Convert Lead to Active Project
                  </h2>
                  <p className="text-xs text-slate-500">
                    Safely transition this enquiry into a production project and client record.
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
                <div>
                  <div className="font-semibold text-slate-800">
                    {existingClient ? (
                      <span className="text-emerald-700">Existing Client Matched</span>
                    ) : (
                      <span className="text-blue-700">New Client Record Will Be Created</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {existingClient
                      ? `Matching record: "${existingClient.name}" (${existingClient.email}). This project will be linked to their existing client ID without creating duplicates.`
                      : `A new client record for "${enquiry.client_name}" (${enquiry.email}) will be generated in the Clients directory.`}
                  </p>
                </div>
              </div>

              {/* Project Form Fields */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Total Contract Value (₹)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={totalAmount}
                    onChange={e => setTotalAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Booking Advance Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={bookingAmount}
                    onChange={e => setBookingAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ₹{bookingAmount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Package / Scope Name
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={e => setPackageName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-blue-900 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-700" />
                  <span>Assigned Brand Division: {company.name} ({company.code.toUpperCase()})</span>
                </div>
                <p className="text-blue-700">
                  Wedding Date: {enquiry.event_date} • Location: {enquiry.venue || 'TBD'}, {enquiry.city || 'India'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Creating Project...' : 'Confirm Conversion & Create Project'}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Conversion Success View */
          <div className="text-center py-4 space-y-4 text-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lead Successfully Converted!
              </h3>
              <p className="text-slate-500 mt-1">
                The lead status has been set to <strong>Won</strong>. The new project is ready in your production schedule.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Project Name:</span>
                <span className="font-bold text-slate-900">{successResult.project.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client Profile:</span>
                <span className="font-semibold text-slate-800">{successResult.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contract Total:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{successResult.project.total_amount?.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Initial Status:</span>
                <span className="font-semibold text-slate-800">{successResult.project.status}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
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
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <span>Go to Projects</span>
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
