import React, { useState } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Users,
  HardDrive,
  CheckSquare,
  FileText,
  Clock,
  MapPin,
  Phone,
  Mail,
  Download,
  Plus,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Tag,
  Share2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Project,
  ProjectStatus,
  DeliverableStatus,
  DeliverableType,
  DeliverablePriority,
  DataCategory,
  PaymentMode,
  ExpenseCategory,
} from '../../types';
import { generateOrderFormPDF } from '../../utils/pdfGenerator';

interface ProjectWorkspaceProps {
  projectId: string;
  onClose: () => void;
}

export const ProjectDetailWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projectId,
  onClose,
}) => {
  const {
    projects,
    updateProject,
    clients,
    companies,
    teamMembers,
    editors,
    projectTeam,
    assignTeamMember,
    removeTeamAssignment,
    checkTeamConflict,
    projectData,
    createProjectData,
    deliverables,
    createDeliverable,
    updateDeliverableStatus,
    payments,
    createPayment,
    expenses,
    createExpense,
    calendarEvents,
    currentUser,
    canManageFinance,
    canManageTeam,
  } = useApp();

  const project = projects.find(p => p.id === projectId);
  const client = clients.find(c => c.id === project?.client_id);
  const company = companies.find(c => c.id === project?.company_id) || companies[0];

  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'finance' | 'data' | 'deliverables' | 'calendar' | 'notes'>('overview');

  // Team assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('Lead Cinematographer');
  const [assignDate, setAssignDate] = useState(project?.wedding_date_start || '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // New Deliverable modal state
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [newDelType, setNewDelType] = useState<DeliverableType>('Highlight Film (4-5 mins)');
  const [newDelEditorId, setNewDelEditorId] = useState(editors[0]?.id || '');
  const [newDelDueDate, setNewDelDueDate] = useState('');
  const [newDelPriority, setNewDelPriority] = useState<DeliverablePriority>('High');
  const [newDelLink, setNewDelLink] = useState('');

  // New Data modal state
  const [showDataModal, setShowDataModal] = useState(false);
  const [newDataCategory, setNewDataCategory] = useState<DataCategory>('Raw Footage');
  const [newDataLoc, setNewDataLoc] = useState('');
  const [newDataLink, setNewDataLink] = useState('');
  const [newDataDesc, setNewDataDesc] = useState('');
  const [newDataResp, setNewDataResp] = useState(currentUser.full_name);

  // New Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState(1000);
  const [payMode, setPayMode] = useState<PaymentMode>('Bank Transfer');
  const [payDesc, setPayDesc] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // New Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expAmount, setExpAmount] = useState(250);
  const [expCat, setExpCat] = useState<ExpenseCategory>('Crew Travel');
  const [expDesc, setExpDesc] = useState('');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  if (!project) return null;

  // Project scoped items
  const projectCrew = projectTeam.filter(pt => pt.project_id === project.id);
  const projectDeliverablesList = deliverables.filter(d => d.project_id === project.id);
  const projectDataList = projectData.filter(d => d.project_id === project.id);
  const projectPayments = payments.filter(p => p.project_id === project.id);
  const projectExpenses = expenses.filter(e => e.project_id === project.id);
  const projectEvents = calendarEvents.filter(e => e.project_id === project.id);

  // Financial calculations
  const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExp = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingBalance = Math.max(0, project.total_amount - totalPaid);
  const netProfit = totalPaid - totalExp;

  // Handle Team Member Assignment with Conflict Detection
  const handleCheckAndAssign = async (override: boolean = false) => {
    if (!selectedMemberId || !assignDate) return;

    const conflict = await checkTeamConflict(selectedMemberId, assignDate, project.id);
    if (conflict.hasConflict && !override) {
      setConflictWarning(
        `CONFLICT WARNING: ${conflict.memberName} is already booked on ${assignDate} for project "${conflict.conflictingProject?.name}". Assigning will cause a double-booking!`
      );
      return;
    }

    const res = await assignTeamMember(
      {
        project_id: project.id,
        team_member_id: selectedMemberId,
        role: assignRole,
        assignment_date: assignDate,
      },
      override
    );

    if (res.success) {
      setShowAssignModal(false);
      setConflictWarning(null);
      setSelectedMemberId('');
    } else if (res.conflictError) {
      setConflictWarning(res.conflictError);
    }
  };

  // Generate Order Form PDF
  const handleDownloadOrderForm = () => {
    const doc = generateOrderFormPDF(project, client, company);
    doc.save(`OrderForm_${company.code.toUpperCase()}_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  // Status Change
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    await updateProject({ ...project, status: newStatus });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-6 bg-slate-950 text-white flex items-start justify-between border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  project.company_id === 'twb'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#F1D099] text-[#2b2011] font-bold'
                }`}
              >
                {project.company_id === 'twb' ? 'TWB' : 'Golden June'}
              </span>
              <h1 className="text-base sm:text-xl font-bold tracking-tight">
                {project.name}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {project.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {project.wedding_date_start} {project.wedding_date_start !== project.wedding_date_end ? `to ${project.wedding_date_end}` : ''}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {project.venue}, {project.city}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadOrderForm}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              title="Generate printable Order Form PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Order Form PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: FileText },
            { id: 'team', label: `Crew & Team (${projectCrew.length})`, icon: Users },
            { id: 'finance', label: 'Finance & Profit', icon: DollarSign },
            { id: 'data', label: `Project Data (${projectDataList.length})`, icon: HardDrive },
            { id: 'deliverables', label: `Deliverables (${projectDeliverablesList.length})`, icon: CheckSquare },
            { id: 'calendar', label: `Calendar (${projectEvents.length})`, icon: Calendar },
            { id: 'notes', label: 'Notes & Policy', icon: Tag },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status and Action bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Production Stage:</span>
                  <select
                    value={project.status}
                    onChange={e => handleStatusChange(e.target.value as ProjectStatus)}
                    className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 cursor-pointer"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Booked">Booked</option>
                    <option value="Pre-Production">Pre-Production</option>
                    <option value="Shooting">Shooting</option>
                    <option value="Editing">Editing</option>
                    <option value="Review">Review</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Contract: <strong>${project.total_amount.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Paid: <strong className="text-emerald-600">${totalPaid.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Pending: <strong className="text-[#8c672b]">${pendingBalance.toLocaleString()}</strong></span>
                </div>
              </div>

              {/* 2 Column Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Profile */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Client & Couple Profile
                  </h3>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Names:</span>
                      <span className="font-semibold">{client?.name || project.name} {client?.partner_name ? `& ${client.partner_name}` : ''}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Phone:</span>
                      <a href={`tel:${project.client_contact.phone}`} className="text-blue-600 font-medium">{project.client_contact.phone}</a>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Email:</span>
                      <a href={`mailto:${project.client_contact.email}`} className="text-blue-600 font-medium">{project.client_contact.email}</a>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Instagram:</span>
                      <span className="text-slate-600">{client?.instagram || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* Package & Scope */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    Booked Package & Production Scope
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-slate-900">{project.package_name}</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {project.package_details}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress summary boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] text-slate-500">Crew Assigned</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{projectCrew.length} Members</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] text-slate-500">Deliverables Done</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {projectDeliverablesList.filter(d => d.status === 'Delivered' || d.status === 'Approved').length} / {projectDeliverablesList.length}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] text-slate-500">Data Backups</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {projectDataList.filter(d => d.status === 'Backed Up').length} / {projectDataList.length}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] text-slate-500">Payment Cleared</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    {project.total_amount > 0 ? Math.round((totalPaid / project.total_amount) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEAM & CREW ASSIGNMENTS */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Assigned Production Team</h3>
                  <p className="text-xs text-slate-500">Cinematographers, drone operators, sound specialists, and DIT</p>
                </div>
                {canManageTeam && (
                  <button
                    onClick={() => {
                      setConflictWarning(null);
                      setShowAssignModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Team Member</span>
                  </button>
                )}
              </div>

              {/* Crew List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectCrew.map(assignment => {
                  const member = teamMembers.find(t => t.id === assignment.team_member_id);
                  return (
                    <div
                      key={assignment.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900">{member?.name || 'Team Member'}</div>
                        <div className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                          {assignment.role}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          Date: {assignment.assignment_date}
                        </div>
                        {assignment.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-1">{assignment.notes}</div>
                        )}
                      </div>

                      {canManageTeam && (
                        <button
                          onClick={() => removeTeamAssignment(assignment.id)}
                          className="text-slate-400 hover:text-red-600 p-1 text-xs"
                          title="Remove assignment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {projectCrew.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No team members assigned to this wedding yet.</p>
                </div>
              )}

              {/* Assignment Modal with Conflict Detector */}
              {showAssignModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <h4 className="text-sm font-bold text-slate-900">Assign Crew Member</h4>
                      <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {conflictWarning && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          Double Booking Conflict Detected!
                        </div>
                        <p className="leading-relaxed">{conflictWarning}</p>
                        {currentUser.role === 'Admin' ? (
                          <button
                            onClick={() => handleCheckAndAssign(true)}
                            className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs transition-colors"
                          >
                            Admin Override & Double-Book
                          </button>
                        ) : (
                          <p className="text-[11px] font-medium text-red-700">
                            Only an Admin can override this date conflict.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Select Member</label>
                        <select
                          value={selectedMemberId}
                          onChange={e => {
                            setSelectedMemberId(e.target.value);
                            setConflictWarning(null);
                          }}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">-- Choose crew member --</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role_title})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Role On Project</label>
                        <input
                          type="text"
                          value={assignRole}
                          onChange={e => setAssignRole(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                          placeholder="e.g. Lead Cinematographer, Drone Operator"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Assignment Date</label>
                        <input
                          type="date"
                          value={assignDate}
                          onChange={e => {
                            setAssignDate(e.target.value);
                            setConflictWarning(null);
                          }}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <button
                        onClick={() => setShowAssignModal(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleCheckAndAssign(false)}
                        disabled={!selectedMemberId}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs"
                      >
                        Confirm Assignment
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FINANCE & PROFIT */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Contract Total</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ${project.total_amount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Paid to Date</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ${totalPaid.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Pending Due</div>
                  <div className="text-lg font-bold text-[#8c672b] mt-1">
                    ${pendingBalance.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Project Net Margin</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    ${netProfit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Payments Section */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Client Payments ({projectPayments.length})
                  </h4>
                  {canManageFinance && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Add Payment
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {projectPayments.map(p => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{p.description}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.payment_date} • {p.payment_mode} • Receipt: {p.receipt_number}
                        </div>
                      </div>
                      <div className="font-bold text-emerald-700">
                        +${p.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {projectPayments.length === 0 && (
                    <div className="py-4 text-center text-slate-400 text-xs">No payments recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Expenses Section */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Production Expenses (${totalExp.toLocaleString()})
                  </h4>
                  {canManageFinance && (
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Add Expense
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {projectExpenses.map(exp => (
                    <div key={exp.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{exp.description}</div>
                        <div className="text-[11px] text-slate-400">
                          {exp.expense_date} • Category: {exp.category} • Paid to: {exp.paid_to}
                        </div>
                      </div>
                      <div className="font-bold text-rose-600">
                        -${exp.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {projectExpenses.length === 0 && (
                    <div className="py-4 text-center text-slate-400 text-xs">No expenses recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Add Payment Modal */}
              {showPaymentModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">Record Project Payment</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Amount ($)</label>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={e => setPayAmount(Number(e.target.value))}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Payment Method</label>
                        <select
                          value={payMode}
                          onChange={e => setPayMode(e.target.value as PaymentMode)}
                          className="w-full p-2 border rounded-lg"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="UPI">UPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Description / Memo</label>
                        <input
                          type="text"
                          value={payDesc}
                          onChange={e => setPayDesc(e.target.value)}
                          placeholder="e.g. Second Milestone Deposit"
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button onClick={() => setShowPaymentModal(false)} className="px-3 py-1.5 text-xs text-slate-600">
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await createPayment({
                            project_id: project.id,
                            company_id: project.company_id,
                            amount: payAmount,
                            payment_mode: payMode,
                            description: payDesc || `Payment for ${project.name}`,
                            payment_date: payDate,
                            receipt_number: `REC-${company.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
                          });
                          setShowPaymentModal(false);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg shadow-xs"
                      >
                        Save Payment
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Expense Modal */}
              {showExpenseModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">Record Production Expense</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Amount ($)</label>
                        <input
                          type="number"
                          value={expAmount}
                          onChange={e => setExpAmount(Number(e.target.value))}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Category</label>
                        <select
                          value={expCat}
                          onChange={e => setExpCat(e.target.value as ExpenseCategory)}
                          className="w-full p-2 border rounded-lg"
                        >
                          <option value="Crew Travel">Crew Travel</option>
                          <option value="Equipment Rental">Equipment Rental</option>
                          <option value="Editor Fee">Editor Fee</option>
                          <option value="Accommodations">Accommodations</option>
                          <option value="Studio Gear">Studio Gear</option>
                          <option value="Music Licensing">Music Licensing</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={expDesc}
                          onChange={e => setExpDesc(e.target.value)}
                          placeholder="e.g. Lens rental from BorrowLenses"
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Paid To / Vendor</label>
                        <input
                          type="text"
                          value={expPaidTo}
                          onChange={e => setExpPaidTo(e.target.value)}
                          placeholder="e.g. BorrowLenses, Airline, Fuel"
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button onClick={() => setShowExpenseModal(false)} className="px-3 py-1.5 text-xs text-slate-600">
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await createExpense({
                            project_id: project.id,
                            company_id: project.company_id,
                            amount: expAmount,
                            category: expCat,
                            description: expDesc || 'Production Expense',
                            paid_to: expPaidTo || 'Vendor',
                            expense_date: expDate,
                          });
                          setShowExpenseModal(false);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg shadow-xs"
                      >
                        Save Expense
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROJECT DATA (METADATA & STORAGE ONLY) */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">External Storage & Ingestion Links</h3>
                  <p className="text-xs text-slate-500">
                    Tracks locations on SanDisk SSDs, Synology NAS, Google Drive, and Dropbox.
                  </p>
                </div>
                <button
                  onClick={() => setShowDataModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Storage Location
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectDataList.map(item => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border">
                          {item.category}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.storage_location}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{item.description}</p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">
                        By: {item.responsible_person} ({item.date_recorded})
                      </span>
                      {item.folder_link && (
                        <a
                          href={item.folder_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          Open Folder
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {projectDataList.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <HardDrive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No media storage records tracked yet.</p>
                </div>
              )}

              {/* Add Data Modal */}
              {showDataModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">Track External Media Location</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Category</label>
                        <select
                          value={newDataCategory}
                          onChange={e => setNewDataCategory(e.target.value as DataCategory)}
                          className="w-full p-2 border rounded-lg"
                        >
                          <option value="Raw Footage">Raw Footage</option>
                          <option value="Photos">Photos</option>
                          <option value="Audio">Audio</option>
                          <option value="Project Files">Project Files</option>
                          <option value="Client References">Client References</option>
                          <option value="Music">Music</option>
                          <option value="Documents">Documents</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Physical / Hardware Location</label>
                        <input
                          type="text"
                          value={newDataLoc}
                          onChange={e => setNewDataLoc(e.target.value)}
                          placeholder="e.g. SanDisk Extreme Pro 4TB Vault 02"
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Cloud / Folder URL</label>
                        <input
                          type="url"
                          value={newDataLink}
                          onChange={e => setNewDataLink(e.target.value)}
                          placeholder="https://drive.google.com/... or dropbox.com"
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Description & Checksum Info</label>
                        <textarea
                          value={newDataDesc}
                          onChange={e => setNewDataDesc(e.target.value)}
                          placeholder="Card details, file formats, backup status..."
                          rows={2}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button onClick={() => setShowDataModal(false)} className="px-3 py-1.5 text-xs text-slate-600">
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await createProjectData({
                            project_id: project.id,
                            company_id: project.company_id,
                            category: newDataCategory,
                            storage_location: newDataLoc || 'Vault Storage',
                            folder_link: newDataLink,
                            description: newDataDesc,
                            status: 'Received',
                            responsible_person: newDataResp,
                            date_recorded: new Date().toISOString().split('T')[0],
                          });
                          setShowDataModal(false);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-xs"
                      >
                        Save Record
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DELIVERABLES */}
          {activeTab === 'deliverables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Post-Production Deliverables</h3>
                  <p className="text-xs text-slate-500">Films, teasers, photo galleries, albums & revision rounds</p>
                </div>
                <button
                  onClick={() => setShowDeliverableModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Deliverable
                </button>
              </div>

              <div className="space-y-3">
                {projectDeliverablesList.map(del => {
                  const editor = editors.find(e => e.id === del.assigned_editor_id);
                  return (
                    <div
                      key={del.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{del.deliverable_type}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/50">
                            {del.priority}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Editor: <strong className="text-slate-700">{editor?.name || 'Unassigned'}</strong> • Due: {del.due_date}
                        </div>
                        {del.external_link && (
                          <a
                            href={del.external_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-[11px] font-medium flex items-center gap-1 pt-0.5"
                          >
                            Frame.io / Review Link
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Status select for Editor or Admin */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Workflow:</span>
                        <select
                          value={del.status}
                          onChange={e => updateDeliverableStatus(del.id, e.target.value as DeliverableStatus)}
                          className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-800 cursor-pointer"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Submitted">Submitted</option>
                          <option value="Changes Requested">Changes Requested</option>
                          <option value="Approved">Approved</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {projectDeliverablesList.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No deliverables generated for this package yet.</p>
                </div>
              )}

              {/* Add Deliverable Modal */}
              {showDeliverableModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">Add Post-Production Deliverable</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Deliverable Type</label>
                        <select
                          value={newDelType}
                          onChange={e => setNewDelType(e.target.value as DeliverableType)}
                          className="w-full p-2 border rounded-lg"
                        >
                          <option value="Highlight Film (4-5 mins)">Highlight Film (4-5 mins)</option>
                          <option value="Teaser / Reel (60s)">Teaser / Reel (60s)</option>
                          <option value="Feature Film (20-30 mins)">Feature Film (20-30 mins)</option>
                          <option value="Full Ceremony Edit">Full Ceremony Edit</option>
                          <option value="Speeches & Toasts">Speeches & Toasts</option>
                          <option value="Full Photo Gallery (800+)">Full Photo Gallery (800+)</option>
                          <option value="Fine Art Wedding Album">Fine Art Wedding Album</option>
                          <option value="Parent Albums">Parent Albums</option>
                          <option value="Drone Compilation">Drone Compilation</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Assign Editor</label>
                        <select
                          value={newDelEditorId}
                          onChange={e => setNewDelEditorId(e.target.value)}
                          className="w-full p-2 border rounded-lg"
                        >
                          {editors.map(ed => (
                            <option key={ed.id} value={ed.id}>
                              {ed.name} ({ed.specialization})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Target Due Date</label>
                        <input
                          type="date"
                          value={newDelDueDate}
                          onChange={e => setNewDelDueDate(e.target.value)}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Priority</label>
                        <select
                          value={newDelPriority}
                          onChange={e => setNewDelPriority(e.target.value as DeliverablePriority)}
                          className="w-full p-2 border rounded-lg"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Frame.io / Cloud Review Link</label>
                        <input
                          type="url"
                          value={newDelLink}
                          onChange={e => setNewDelLink(e.target.value)}
                          placeholder="https://frame.io/..."
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button onClick={() => setShowDeliverableModal(false)} className="px-3 py-1.5 text-xs text-slate-600">
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          await createDeliverable({
                            project_id: project.id,
                            company_id: project.company_id,
                            deliverable_type: newDelType,
                            assigned_editor_id: newDelEditorId,
                            due_date: newDelDueDate || project.wedding_date_start,
                            status: 'Assigned',
                            priority: newDelPriority,
                            external_link: newDelLink,
                          });
                          setShowDeliverableModal(false);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-xs"
                      >
                        Create Deliverable
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Project Calendar Events</h3>
              <div className="space-y-2">
                {projectEvents.map(evt => (
                  <div key={evt.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{evt.title}</span>
                      <div className="text-[11px] text-slate-500">
                        {evt.start_time.slice(0, 10)} • {evt.location || 'Studio'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                      {evt.event_type}
                    </span>
                  </div>
                ))}
                {projectEvents.length === 0 && (
                  <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                    No calendar events specifically attached to this project.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Production Notes & Couple Agreements</h3>
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <textarea
                  value={project.notes || ''}
                  onChange={e => updateProject({ ...project, notes: e.target.value })}
                  rows={6}
                  placeholder="Record timeline details, special family requests, VIP guests, lighting preferences..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs leading-relaxed"
                />
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Autosaves on change to Supabase backend</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
