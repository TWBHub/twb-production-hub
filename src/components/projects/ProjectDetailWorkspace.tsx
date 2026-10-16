import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2,
  Pencil,
  Loader2,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Project,
  ProjectEvent,
  ProjectStatus,
  PROJECT_PRODUCTION_STAGES,
  ProjectTeamAssignment,
  ProjectData,
  StorageDropdownOption,
  StorageTypeOption,
  StorageStatusOption,
  ClientHddStatus,
  CLIENT_HDD_STATUS_OPTIONS,
  STORAGE_DROPDOWN_OPTIONS,
  STORAGE_TYPE_OPTIONS,
  STORAGE_STATUS_OPTIONS,
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  DeliverablePriority,
  DataCategory,
  PaymentMode,
  ExpenseCategory,
  Payment,
  Expense,
} from '../../types';
import { normalizeStorageRecord, getStorageStatusBadge } from '../../utils/storageUtils';
import { apiService } from '../../services/api';
import { generateOrderFormPDF, generateReceiptPDF } from '../../utils/pdfGenerator';
import { ProjectTermsEditor } from './ProjectTermsEditor';
import { sortProjectEvents } from '../../utils/eventUtils';
import { formatDisplayDate } from '../../utils/dateUtils';

interface ProjectWorkspaceProps {
  projectId: string;
  onClose: () => void;
}

export { PROJECT_PRODUCTION_STAGES };

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
  updateTeamAssignment,
  removeTeamAssignment,
  checkTeamConflict,
  refreshAllData,
  projectData,
  createProjectData,
  updateProjectData,
  deleteProjectData,
  deliverables,
  createDeliverable,
  deleteDeliverable,
  updateDeliverableStatus,
  payments,
  createPayment,
  updatePayment,
  deletePayment,
  expenses,
  createExpense,
  updateExpense,
  deleteExpense,
  calendarEvents,
  currentUser,
  isAdmin,
  isManager,
  isEditorOnly,
  canManageFinance,
  canManageTeam,
} = useApp();

  const matchedProject = projects.find(p => p.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  const project = matchedProject || fetchedProject;
  const client = clients.find(c => c.id === project?.client_id);
  const company = companies.find(c => c.id === project?.company_id) || companies[0];

  useEffect(() => {
    if (!projectId) return;
    if (matchedProject) {
      setFetchedProject(matchedProject);
      return;
    }
    let isMounted = true;
    setIsLoadingProject(true);
    apiService
      .getProjectById(projectId)
      .then(p => {
        if (isMounted && p) {
          setFetchedProject(p);
        }
        if (isMounted) setIsLoadingProject(false);
      })
      .catch(err => {
        console.warn('Failed to load project by id:', err);
        if (isMounted) setIsLoadingProject(false);
      });
    return () => {
      isMounted = false;
    };
  }, [projectId, matchedProject]);

  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'finance' | 'data' | 'deliverables' | 'calendar' | 'notes'>('overview');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);
  const [pdfDownloadSuccess, setPdfDownloadSuccess] = useState(false);
  const [receiptDownloadSuccessId, setReceiptDownloadSuccessId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Project events state
  const [projectEventsList, setProjectEventsList] = useState<ProjectEvent[]>(
    sortProjectEvents(project?.events || [])
  );
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    if (project?.events && project.events.length > 0 && projectEventsList.length === 0) {
      setProjectEventsList(sortProjectEvents(project.events));
    }
  }, [project?.events]);

  useEffect(() => {
    if (!project?.id) return;
    let isMounted = true;
    setIsLoadingEvents(true);
    apiService
      .getProjectEvents(project.id)
      .then(evts => {
        if (isMounted) {
          const list = evts.length > 0 ? evts : (project.events || []);
          setProjectEventsList(sortProjectEvents(list));
          setIsLoadingEvents(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          if (project.events && project.events.length > 0) {
            setProjectEventsList(sortProjectEvents(project.events));
          }
          setIsLoadingEvents(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [project?.id]);

  // Team assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('Lead Cinematographer');
  const [assignNote, setAssignNote] = useState('');
  const [assignDate, setAssignDate] = useState(project?.wedding_date_start || '');
  const [selectedAssignDates, setSelectedAssignDates] = useState<string[]>([]);
  const [fallbackAssignDate, setFallbackAssignDate] = useState(project?.wedding_date_start || '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<ProjectTeamAssignment | null>(null);
  const [deleteAssignmentError, setDeleteAssignmentError] = useState<string | null>(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);

  // Helper to format date cleanly for options
  const formatEventDateOption = (dateStr: string) => {
    return formatDisplayDate(dateStr);
  };

  // Extract project's actual event dates as selectable options
  const eventDateOptions = useMemo(() => {
    const list = sortProjectEvents(projectEventsList);
    const map = new Map<string, string[]>();
    list.forEach(e => {
      const d = (e.event_date || '').slice(0, 10);
      if (!d) return;
      const names = map.get(d) || [];
      if (e.event_name && !names.includes(e.event_name)) {
        names.push(e.event_name);
      }
      map.set(d, names);
    });

    return Array.from(map.entries()).map(([date, names]) => ({
      date,
      label: `${formatEventDateOption(date)} — ${names.join(', ') || 'Wedding event'}`,
    }));
  }, [projectEventsList]);

  // Deliverables permissions & helpers
  const canManageDeliverables = isAdmin || isManager || !currentUser || currentUser.role === 'Admin' || currentUser.role === 'Manager';

  const availableEditors = useMemo(() => {
    if (!Array.isArray(teamMembers)) return [];
    return teamMembers
      .filter(
        member =>
          member &&
          Array.isArray(member.categories) &&
          member.categories.includes('Editor') &&
          member.status !== 'Inactive'
      )
      .map(member => ({
        id: member.id,
        name: member.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers]);

  // New Deliverable modal state
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [newDelType, setNewDelType] = useState<DeliverableType>('Highlight Film (4-5 mins)');
  const [newDelEditorId, setNewDelEditorId] = useState('');
  const [newDelDueDate, setNewDelDueDate] = useState('');
  const [newDelPriority, setNewDelPriority] = useState<DeliverablePriority>('High');
  const [newDelLink, setNewDelLink] = useState('');
  const [newDelNotes, setNewDelNotes] = useState('');
  const [isSubmittingDeliverable, setIsSubmittingDeliverable] = useState(false);
  const [deletingDeliverable, setDeletingDeliverable] = useState<Deliverable | null>(null);
  const [isDeletingDeliverable, setIsDeletingDeliverable] = useState(false);

  // Storage Data modal state
  const [showDataModal, setShowDataModal] = useState(false);
  const [editingDataId, setEditingDataId] = useState<string | null>(null);
  const [dataStorage, setDataStorage] = useState<StorageDropdownOption>("Client's");
  const [dataName, setDataName] = useState('');
  const [dataType, setDataType] = useState<StorageTypeOption>('SSD');
  const [dataLocation, setDataLocation] = useState('Office');
  const [dataNotes, setDataNotes] = useState('');
  const [dataStatus, setDataStatus] = useState<StorageStatusOption>('Active');
  const [isSavingData, setIsSavingData] = useState(false);
  const [saveDataError, setSaveDataError] = useState<string | null>(null);
  const [deletingData, setDeletingData] = useState<ProjectData | null>(null);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [deleteDataError, setDeleteDataError] = useState<string | null>(null);

  // Payment modal & action state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(1000);
  const [payMode, setPayMode] = useState<PaymentMode>('Bank Transfer');
  const [payDesc, setPayDesc] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Expense modal & action state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expAmount, setExpAmount] = useState(250);
  const [expCat, setExpCat] = useState<ExpenseCategory>('Crew Travel');
  const [expDesc, setExpDesc] = useState('');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenAddPayment = () => {
    setEditingPayment(null);
    setPayAmount(1000);
    setPayMode('Bank Transfer');
    setPayDesc(`Payment for ${project?.name || 'Project'}`);
    setPayDate(new Date().toISOString().split('T')[0]);
    setShowPaymentModal(true);
  };

  const handleOpenRetainerModal = () => {
    // Check if a payment for this project already exists to prevent duplicate payments
    const existingRetainer = projectPayments.find(
      p => p.amount === project.booking_amount || /retainer|booking/i.test(p.description)
    );
    if (existingRetainer) {
      alert(
        `A payment record matching this retainer already exists (Receipt #${existingRetainer.receipt_number} for ₹${existingRetainer.amount.toLocaleString()}). To prevent duplicate payments, please verify existing receipts before recording another payment.`
      );
      return;
    }

    setEditingPayment(null);
    setPayAmount(project.booking_amount);
    setPayMode('Bank Transfer');
    setPayDesc('Booking Retainer');
    setPayDate(project.created_at ? project.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
    setShowPaymentModal(true);
  };

  const handleDownloadReceipt = async (p: Payment) => {
    if (downloadingReceiptId) return;
    setPdfDownloadError(null);
    setReceiptDownloadSuccessId(null);
    setDownloadingReceiptId(p.id);

    // Yield to allow the browser and React to render the loading state, matching Order Form flow
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const doc = generateReceiptPDF(p, project, client, company, projectPayments);
      doc.save();
      setReceiptDownloadSuccessId(p.id);
      setTimeout(() => {
        setReceiptDownloadSuccessId(null);
      }, 2500);
    } catch (err: any) {
      console.error('Failed to download payment receipt:', err);
      setPdfDownloadError(
        `Failed to download receipt for payment ${p.receipt_number || p.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPayAmount(payment.amount);
    setPayMode(payment.payment_mode);
    setPayDesc(payment.description);
    setPayDate(payment.payment_date);
    setShowPaymentModal(true);
  };

  const confirmDeletePayment = async () => {
    if (!deletingPaymentId) return;
    try {
      await deletePayment(deletingPaymentId);
      setDeletingPaymentId(null);
    } catch (error) {
      console.error('Failed to delete payment:', error);
      alert(
        `Could not delete this payment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpAmount(250);
    setExpCat('Crew Travel');
    setExpDesc('');
    setExpPaidTo('');
    setExpDate(new Date().toISOString().split('T')[0]);
    setShowExpenseModal(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpAmount(expense.amount);
    setExpCat(expense.category);
    setExpDesc(expense.description);
    setExpPaidTo(expense.paid_to);
    setExpDate(expense.expense_date);
    setShowExpenseModal(true);
  };

  const confirmDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try {
      await deleteExpense(deletingExpenseId);
      setDeletingExpenseId(null);
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert(
        `Could not delete this expense: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  if (!project) {
    if (isLoadingProject) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-800">Opening Project Workspace...</p>
          </div>
        </div>
      );
    }
    return null;
  }

  // Project scoped items
  const projectCrew = projectTeam.filter(pt => pt.project_id === project.id);

  // Group assignments by unique team member
  const uniqueCrewCount = useMemo(() => {
    const memberIds = new Set(projectCrew.map(pt => pt.team_member_id).filter(Boolean));
    return memberIds.size;
  }, [projectCrew]);

  const groupedCrew = useMemo(() => {
    const map = new Map<string, typeof projectCrew>();
    projectCrew.forEach(pt => {
      if (!pt.team_member_id) return;
      const list = map.get(pt.team_member_id) || [];
      list.push(pt);
      map.set(pt.team_member_id, list);
    });

    return Array.from(map.entries()).map(([memberId, assignments]) => {
      const member = teamMembers.find(t => t.id === memberId);
      const sortedAssignments = [...assignments].sort((a, b) => {
        const da = a.assignment_date || '';
        const db = b.assignment_date || '';
        return da.localeCompare(db);
      });

      const roles = Array.from(
        new Set(sortedAssignments.map(a => a.role?.trim()).filter(Boolean))
      );
      const hasSingleRole = roles.length === 1;
      const commonRole = hasSingleRole ? roles[0] : null;

      return {
        memberId,
        member,
        assignments: sortedAssignments,
        hasSingleRole,
        commonRole,
        roles,
      };
    });
  }, [projectCrew, teamMembers]);
  const projectDeliverablesList = deliverables.filter(d => d.project_id === project.id);
  const projectDataList = projectData.filter(d => d.project_id === project.id);
  const projectPayments = payments.filter(p => p.project_id === project.id);
  const projectExpenses = expenses.filter(e => e.project_id === project.id);
  const projectEvents = calendarEvents.filter(e => e.project_id === project.id);

  // Financial calculations
  const paymentsSum = projectPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = paymentsSum;
  const totalExp = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingBalance = Math.max(0, project.total_amount - totalPaid);
  const netProfit = totalPaid - totalExp;

  // Open modal in Create mode
  const handleOpenAssignModal = () => {
    setEditingAssignmentId(null);
    setSelectedMemberId('');
    setAssignRole('Lead Cinematographer');
    setAssignNote('');
    setSelectedAssignDates(eventDateOptions.length > 0 ? [eventDateOptions[0].date] : []);
    setFallbackAssignDate(project?.wedding_date_start || '');
    setConflictWarning(null);
    setShowAssignModal(true);
  };

  // Open modal in Edit mode populated with current assignment data
  const handleOpenEditAssignment = (assignment: ProjectTeamAssignment) => {
    setEditingAssignmentId(assignment.id);
    setSelectedMemberId(assignment.team_member_id);
    setAssignRole(assignment.role || '');
    setAssignDate(assignment.assignment_date || '');
    setAssignNote(assignment.notes || '');
    setConflictWarning(null);
    setShowAssignModal(true);
  };

  // Handle Team Member Assignment with Conflict Detection across all selected dates
  const handleCheckAndAssign = async (override: boolean = false) => {
    const datesToAssign: string[] = Array.from(new Set(selectedAssignDates.filter(Boolean)));
    if (!selectedMemberId || datesToAssign.length === 0) return;

    try {
      setIsSavingAssignment(true);

      // Check conflict independently for EACH selected date
      const conflicts: Array<{
        date: string;
        memberName: string;
        conflictingProjectName?: string;
      }> = [];

      for (const date of datesToAssign) {
        const conflict = await checkTeamConflict(selectedMemberId, date, project.id);
        if (conflict.hasConflict) {
          conflicts.push({
            date,
            memberName: conflict.memberName || 'Crew member',
            conflictingProjectName: conflict.conflictingProject?.name,
          });
        }
      }

      if (conflicts.length > 0 && !override) {
        const conflictDetails = conflicts
          .map(
            c =>
              `• ${formatEventDateOption(c.date)}: already booked on project "${c.conflictingProjectName || 'Another Project'}"`
          )
          .join('\n');

        setConflictWarning(
          `CONFLICT WARNING: ${conflicts[0].memberName} has scheduling conflicts on ${conflicts.length} date${conflicts.length > 1 ? 's' : ''}:\n${conflictDetails}\n\nAssigning will cause a double-booking!`
        );
        return;
      }

      // Create one project_team assignment for EACH selected date
      let anyError: string | null = null;
      for (const date of datesToAssign) {
        const res = await assignTeamMember(
          {
            project_id: project.id,
            team_member_id: selectedMemberId,
            role: assignRole.trim(),
            assignment_date: date,
            notes: assignNote.trim() || undefined,
          },
          override
        );

        if (!res.success && res.conflictError) {
          anyError = res.conflictError;
        }
      }

      if (!anyError) {
        setShowAssignModal(false);
        setConflictWarning(null);
        setSelectedMemberId('');
        setSelectedAssignDates([]);
        setAssignNote('');
      } else {
        setConflictWarning(anyError);
      }
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleUpdateAssignment = async (override: boolean = false) => {
    if (
      !editingAssignmentId ||
      !selectedMemberId ||
      !assignRole.trim() ||
      !assignDate
    ) {
      return;
    }

    try {
      setIsSavingAssignment(true);
      const conflict = await checkTeamConflict(
        selectedMemberId,
        assignDate,
        project.id,
        editingAssignmentId || undefined
      );

      if (conflict.hasConflict && !override) {
        setConflictWarning(
          `CONFLICT WARNING: ${conflict.memberName} is already booked on ${assignDate} for project "${conflict.conflictingProject?.name}". Updating this assignment will cause a double-booking!`
        );
        return;
      }

      const result = await updateTeamAssignment(
        editingAssignmentId,
        {
          project_id: project.id,
          team_member_id: selectedMemberId,
          role: assignRole.trim(),
          assignment_date: assignDate,
          notes: assignNote.trim() || undefined,
        }
      );

      if (result.success) {
        setShowAssignModal(false);
        setEditingAssignmentId(null);
        setConflictWarning(null);
      } else {
        setConflictWarning(
          result.error || 'Could not update the team assignment.'
        );
      }
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Generate Order Form PDF
  const handleDownloadOrderForm = async () => {
    setPdfDownloadError(null);
    setPdfDownloadSuccess(false);
    setIsDownloadingPdf(true);
    // Yield to allow the browser and React to render the loading state
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const projectWithEvents: Project = {
        ...project,
        events: projectEventsList.length > 0 ? projectEventsList : project.events,
      };
      const doc = generateOrderFormPDF(
        projectWithEvents,
        client,
        company,
        projectDeliverablesList,
        projectPayments
      );
      doc.save();
      setPdfDownloadSuccess(true);
      setTimeout(() => {
        setPdfDownloadSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to generate or download Order Form PDF:', err);
      setPdfDownloadError(
        `Failed to download Order Form PDF: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Storage Location Modal helpers
  const handleOpenAddDataModal = () => {
    setEditingDataId(null);
    setDataStorage("Client's");
    setDataName('');
    setDataType('SSD');
    setDataLocation('Office');
    setDataNotes('');
    setDataStatus('Active');
    setSaveDataError(null);
    setShowDataModal(true);
  };

  const handleOpenEditDataModal = (item: ProjectData) => {
    const norm = normalizeStorageRecord(item);
    setEditingDataId(item.id);
    setDataStorage(norm.storage);
    setDataName(norm.name);
    setDataType(norm.type);
    setDataLocation(norm.location);
    setDataNotes(norm.notes);
    setDataStatus(norm.status);
    setSaveDataError(null);
    setShowDataModal(true);
  };

  const handleSaveData = async () => {
    try {
      setIsSavingData(true);
      setSaveDataError(null);
      if (editingDataId) {
        const existing = projectData.find(d => d.id === editingDataId);
        if (existing) {
          await updateProjectData({
            ...existing,
            project_id: project.id,
            company_id: project.company_id,
            storage: dataStorage,
            name: dataName.trim() || 'Storage Drive',
            type: dataType,
            location: dataLocation.trim() || 'Office',
            notes: dataNotes.trim(),
            status: dataStatus,
            category: dataType,
            storage_location: dataLocation.trim() || 'Office',
            description: dataName.trim() || 'Storage Drive',
            folder_link: '',
            responsible_person: dataStorage,
          });
        }
      } else {
        await createProjectData({
          project_id: project.id,
          company_id: project.company_id,
          storage: dataStorage,
          name: dataName.trim() || 'Storage Drive',
          type: dataType,
          location: dataLocation.trim() || 'Office',
          notes: dataNotes.trim(),
          status: dataStatus,
          category: dataType,
          storage_location: dataLocation.trim() || 'Office',
          description: dataName.trim() || 'Storage Drive',
          folder_link: '',
          responsible_person: dataStorage,
          date_recorded: new Date().toISOString().split('T')[0],
        });
      }
      setShowDataModal(false);
      setEditingDataId(null);
    } catch (err) {
      console.error('Failed to save storage record:', err);
      setSaveDataError(
        `Could not save storage record: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSavingData(false);
    }
  };

  const handleDeleteData = async () => {
    if (!deletingData) return;
    try {
      setIsDeletingData(true);
      setDeleteDataError(null);
      await deleteProjectData(deletingData.id);
      setDeletingData(null);
    } catch (err) {
      console.error('Failed to delete storage record:', err);
      setDeleteDataError(
        `Could not delete storage record: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDeletingData(false);
    }
  };

  // Status Change
const handleStatusChange = async (newStatus: ProjectStatus) => {
  // Update the UI immediately
  project.status = newStatus;

  // Save the change in the background
  updateProject({ ...project, status: newStatus });
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
                {projectEventsList.length > 0
                  ? `${projectEventsList.length} ${projectEventsList.length === 1 ? 'Event' : 'Events'} (${formatDisplayDate(projectEventsList[0].event_date)}${projectEventsList.length > 1 ? ` to ${formatDisplayDate(projectEventsList[projectEventsList.length - 1].event_date)}` : ''})`
                  : (project.wedding_date_start !== project.wedding_date_end
                      ? `${formatDisplayDate(project.wedding_date_start)} to ${formatDisplayDate(project.wedding_date_end)}`
                      : formatDisplayDate(project.wedding_date_start))}
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
              disabled={isDownloadingPdf}
              onClick={handleDownloadOrderForm}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${
                pdfDownloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : isDownloadingPdf
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Generate printable Order Form PDF"
            >
              {pdfDownloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Downloaded!</span>
                </>
              ) : isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download Order Form PDF</span>
                </>
              )}
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
            { id: 'team', label: `Crew & Team (${uniqueCrewCount})`, icon: Users },
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
          {/* PDF Download Error Alert */}
          {pdfDownloadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pdfDownloadError}</span>
              </div>
              <button
                onClick={() => setPdfDownloadError(null)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Confirmed Booking Retainer Insertion Error Alert */}
          {project.booking_payment_error && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900">
                    Booking Retainer Recording Failed During Project Creation
                  </h4>
                  <p className="text-xs text-amber-800">
                    The initial booking retainer payment of{' '}
                    <strong className="font-semibold">₹{project.booking_amount.toLocaleString()}</strong> was not
                    recorded in the payments ledger.
                  </p>
                  <div className="text-[11px] font-mono bg-amber-100/70 text-amber-900 px-2.5 py-1 rounded border border-amber-200 mt-1">
                    Captured error: {project.booking_payment_error}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenRetainerModal}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg whitespace-nowrap cursor-pointer transition-colors shadow-xs shrink-0"
              >
                Record Retainer Manually
              </button>
            </div>
          )}

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
                    {PROJECT_PRODUCTION_STAGES.map(stage => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Contract: <strong>₹{project.total_amount.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Paid: <strong className="text-emerald-600">₹{totalPaid.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Pending: <strong className="text-[#8c672b]">₹{pendingBalance.toLocaleString()}</strong></span>
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
                     <a href={`tel:${client?.phone || ''}`} className="text-blue-600 font-medium">{client?.phone || 'Not specified'}</a>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Email:</span>
                      <a href={`mailto:${client?.email || ''}`} className="text-blue-600 font-medium">{client?.email || 'Not specified'}</a>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Instagram:</span>
                      <span className="text-slate-600">
                        {client?.instagram || 'Not specified'}
                        {client?.instagram_2 ? ` • ${client.instagram_2}` : ''}
                      </span>
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

              {/* Commissioned Event Schedule */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Event Schedule
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {projectEventsList.length} {projectEventsList.length === 1 ? 'Event' : 'Events'}
                  </span>
                </div>

                {isLoadingEvents && projectEventsList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading event schedule...</div>
                ) : projectEventsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No event schedule recorded for this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projectEventsList.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded shrink-0">
                              D{idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{evt.event_name}</span>
                          </div>
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-700 shrink-0">
                            {formatDisplayDate(evt.event_date)}
                          </span>
                        </div>

                        {evt.event_time && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Time: {evt.event_time}</span>
                          </div>
                        )}

                        {evt.event_address && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{evt.event_address}</span>
                          </div>
                        )}

                        {evt.event_notes && (
                          <div className="flex items-start gap-1.5 text-slate-500 text-[11px] pt-1 border-t border-slate-200/60 mt-1">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{evt.event_notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress summary boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] text-slate-500">Crew Assigned</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{uniqueCrewCount} {uniqueCrewCount === 1 ? 'Member' : 'Members'}</div>
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
                    onClick={handleOpenAssignModal}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Team Member</span>
                  </button>
                )}
              </div>

              {/* Crew List Grouped by Team Member */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedCrew.map(group => {
                  const memberName = group.member?.name || 'Team Member';
                  return (
                    <div
                      key={group.memberId}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        {/* Member Name and Global Role (if same role across all dates) */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-xs text-slate-900">
                              {memberName}
                            </div>
                            {group.hasSingleRole && group.commonRole ? (
                              <div className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                {group.commonRole}
                              </div>
                            ) : null}
                          </div>

                          {group.member?.phone && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {group.member.phone}
                            </span>
                          )}
                        </div>

                        {/* List of Assignment Dates & Notes (sorted chronologically) */}
                        <div className="space-y-2 pt-0.5">
                          {group.assignments.map(assignment => (
                            <div
                              key={assignment.id}
                              className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-medium text-[11px]">
                                    Date: <strong className="text-slate-900">{formatDisplayDate(assignment.assignment_date)}</strong>
                                  </span>
                                  {/* If roles differ between dates, display role for this specific date */}
                                  {!group.hasSingleRole && assignment.role ? (
                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md ml-1">
                                      {assignment.role}
                                    </span>
                                  ) : null}
                                </div>

                                {canManageTeam && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditAssignment(assignment)}
                                      className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 text-[11px] font-semibold transition-colors rounded cursor-pointer"
                                      title={`Edit assignment for ${formatDisplayDate(assignment.assignment_date)}`}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteAssignmentError(null);
                                        setDeletingAssignment(assignment);
                                      }}
                                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 text-[11px] font-semibold transition-colors rounded cursor-pointer"
                                      title={`Delete assignment for ${formatDisplayDate(assignment.assignment_date)}`}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Assignment note (only displayed if non-empty) */}
                              {assignment.notes && assignment.notes.trim() ? (
                                <div className="text-[11px] text-slate-600 bg-white border border-slate-200/80 rounded px-2 py-1 mt-1">
                                  <span className="font-semibold text-slate-500">Note: </span>
                                  <span className="italic">{assignment.notes.trim()}</span>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {groupedCrew.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No team members assigned to this wedding yet.</p>
                </div>
              )}

              {/* Unified Assignment Modal (Create & Edit) */}
              {showAssignModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {editingAssignmentId ? 'Edit Crew Assignment' : 'Assign Crew Member'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {editingAssignmentId
                            ? 'Update this crew member assignment on project'
                            : 'Allocate crew roles for wedding events'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAssignModal(false);
                          setEditingAssignmentId(null);
                          setConflictWarning(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {conflictWarning && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          Double Booking Conflict Detected!
                        </div>
                        <p className="whitespace-pre-line leading-relaxed">{conflictWarning}</p>
                        {currentUser.role === 'Admin' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (editingAssignmentId) {
                                handleUpdateAssignment(true);
                              } else {
                                handleCheckAndAssign(true);
                              }
                            }}
                            className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs transition-colors cursor-pointer"
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
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="">-- Choose crew member --</option>
                          {[...teamMembers]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
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

                      {/* When Editing: edit specific assignment date */}
                      {editingAssignmentId ? (
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Assignment Date</label>
                          {eventDateOptions.length > 0 ? (
                            <div className="space-y-2">
                              <select
                                value={assignDate}
                                onChange={e => {
                                  setAssignDate(e.target.value);
                                  setConflictWarning(null);
                                }}
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                              >
                                <option value="">-- Select Event Date --</option>
                                {eventDateOptions.map(option => (
                                  <option key={option.date} value={option.date}>
                                    {option.label}
                                  </option>
                                ))}
                                {assignDate && !eventDateOptions.some(o => o.date === assignDate) && (
                                  <option value={assignDate}>
                                    {formatEventDateOption(assignDate)} (Current)
                                  </option>
                                )}
                              </select>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500 shrink-0">Or custom date:</span>
                                <input
                                  type="date"
                                  value={assignDate}
                                  onChange={e => {
                                    setAssignDate(e.target.value);
                                    setConflictWarning(null);
                                  }}
                                  className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <input
                              type="date"
                              value={assignDate}
                              onChange={e => {
                                setAssignDate(e.target.value);
                                setConflictWarning(null);
                              }}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            />
                          )}
                        </div>
                      ) : (
                        /* When Adding: multi-select event dates */
                        eventDateOptions.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-slate-700 font-semibold">
                                Assignment Dates{' '}
                                <span className="font-normal text-slate-400">
                                  ({selectedAssignDates.length} selected)
                                </span>
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAssignDates(eventDateOptions.map(o => o.date));
                                    setConflictWarning(null);
                                  }}
                                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                  Select All
                                </button>
                                <span className="text-slate-300">•</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAssignDates([]);
                                    setConflictWarning(null);
                                  }}
                                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {eventDateOptions.map(option => {
                                const isChecked = selectedAssignDates.includes(option.date);
                                return (
                                  <label
                                    key={option.date}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-blue-50 border-blue-300 text-slate-900 font-semibold'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setSelectedAssignDates(prev => [...prev, option.date]);
                                        } else {
                                          setSelectedAssignDates(prev => prev.filter(d => d !== option.date));
                                        }
                                        setConflictWarning(null);
                                      }}
                                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="text-xs">
                                      {option.label}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-slate-700 font-semibold mb-1">Assignment Date</label>
                            <input
                              type="date"
                              value={fallbackAssignDate}
                              onChange={e => {
                                setFallbackAssignDate(e.target.value);
                                setSelectedAssignDates(e.target.value ? [e.target.value] : []);
                                setConflictWarning(null);
                              }}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        )
                      )}

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Note <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                          value={assignNote}
                          onChange={e => setAssignNote(e.target.value)}
                          rows={2}
                          placeholder="e.g. Bring FX3 + 24–70mm, call time 5:30 AM"
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAssignModal(false);
                          setEditingAssignmentId(null);
                          setConflictWarning(null);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingAssignmentId) {
                            handleUpdateAssignment(false);
                          } else {
                            handleCheckAndAssign(false);
                          }
                        }}
                        disabled={
                          isSavingAssignment ||
                          !selectedMemberId ||
                          !assignRole.trim() ||
                          (editingAssignmentId ? !assignDate : selectedAssignDates.length === 0)
                        }
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSavingAssignment
                          ? 'Saving...'
                          : editingAssignmentId
                          ? 'Save Changes'
                          : 'Confirm Assignment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Assignment Confirmation Modal */}
              {deletingAssignment && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-3 text-rose-600">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Delete Assignment</h4>
                        <p className="text-xs text-slate-500">Remove crew assignment from project</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Are you sure you want to remove the assignment on{' '}
                      <strong className="text-slate-900 font-semibold">{formatDisplayDate(deletingAssignment.assignment_date)}</strong>
                      {deletingAssignment.role ? (
                        <>
                          {' '}as <strong className="text-slate-900 font-semibold">{deletingAssignment.role}</strong>
                        </>
                      ) : null}
                      ? This removes the project assignment only. The team member will not be deleted.
                    </p>

                    {deleteAssignmentError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                        {deleteAssignmentError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        id="btn-cancel-delete-assignment"
                        disabled={isDeletingAssignment}
                        onClick={() => {
                          setDeletingAssignment(null);
                          setDeleteAssignmentError(null);
                        }}
                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-delete-assignment"
                        disabled={isDeletingAssignment}
                        onClick={async () => {
                          try {
                            setIsDeletingAssignment(true);
                            setDeleteAssignmentError(null);
                            await removeTeamAssignment(deletingAssignment.id);
                            setDeletingAssignment(null);
                          } catch (err) {
                            console.error('Failed to remove team assignment:', err);
                            setDeleteAssignmentError(
                              `Could not remove assignment: ${err instanceof Error ? err.message : String(err)}`
                            );
                          } finally {
                            setIsDeletingAssignment(false);
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingAssignment ? 'Removing...' : 'Delete Assignment'}
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
                    ₹{project.total_amount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Paid to Date</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    ₹{totalPaid.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Pending Due</div>
                  <div className="text-lg font-bold text-[#8c672b] mt-1">
                    ₹{pendingBalance.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">Project Net Margin</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    ₹{netProfit.toLocaleString()}
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
                      onClick={handleOpenAddPayment}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Payment
                    </button>
                  )}
                </div>

                {pdfDownloadError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>{pdfDownloadError}</span>
                    </div>
                    <button
                      onClick={() => setPdfDownloadError(null)}
                      className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                      title="Dismiss error"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-100 text-xs">
                  {projectPayments.map(p => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">{p.description}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDisplayDate(p.payment_date)} • {p.payment_mode} • Receipt: {p.receipt_number}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-emerald-700">
                          +₹{p.amount.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={Boolean(downloadingReceiptId)}
                            onClick={() => handleDownloadReceipt(p)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors flex items-center gap-1 ${
                              receiptDownloadSuccessId === p.id
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : downloadingReceiptId === p.id
                                ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-wait'
                                : downloadingReceiptId
                                ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200 cursor-pointer'
                            }`}
                            title="Download Official Payment Receipt"
                          >
                            {receiptDownloadSuccessId === p.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Download Initiated</span>
                              </>
                            ) : downloadingReceiptId === p.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Receipt</span>
                              </>
                            )}
                          </button>
                          {canManageFinance && (
                            <>
                              <button
                                onClick={() => handleEditPayment(p)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingPaymentId(p.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
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
                    Production Expenses (₹{totalExp.toLocaleString()})
                  </h4>
                  {canManageFinance && (
                    <button
                      onClick={handleOpenAddExpense}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Expense
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {projectExpenses.map(exp => (
                    <div key={exp.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">{exp.description}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDisplayDate(exp.expense_date)} • Category: {exp.category} • Paid to: {exp.paid_to}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-rose-600">
                          -₹{exp.amount.toLocaleString()}
                        </div>
                        {canManageFinance && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditExpense(exp)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingExpenseId(exp.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {projectExpenses.length === 0 && (
                    <div className="py-4 text-center text-slate-400 text-xs">No expenses recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Payment Modal (Create & Edit) */}
              {showPaymentModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">
                      {editingPayment ? 'Edit Client Payment' : 'Record Project Payment'}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Amount (₹)</label>
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
                      <button
                        onClick={() => {
                          setEditingPayment(null);
                          setShowPaymentModal(false);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isSavingPayment}
                        onClick={async () => {
                          if (isSavingPayment) return;
                          try {
                            setIsSavingPayment(true);
                            if (editingPayment) {
                              await updatePayment({
                                ...editingPayment,
                                project_id: project.id,
                                company_id: project.company_id,
                                amount: payAmount,
                                payment_mode: payMode,
                                description: payDesc,
                                payment_date: payDate,
                              });
                            } else {
                              await createPayment({
                                project_id: project.id,
                                company_id: project.company_id,
                                amount: payAmount,
                                payment_mode: payMode,
                                description: payDesc || `Payment for ${project.name}`,
                                payment_date: payDate,
                                receipt_number: `REC-${company.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
                              });
                              if (project.booking_payment_error) {
                                await updateProject({
                                  ...project,
                                  booking_payment_error: undefined,
                                });
                              }
                            }
                            setEditingPayment(null);
                            setShowPaymentModal(false);
                          } catch (err: any) {
                            console.error('Failed to save payment:', err);
                            alert(`Failed to save payment: ${err?.message || String(err)}`);
                          } finally {
                            setIsSavingPayment(false);
                          }
                        }}
                        className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs cursor-pointer ${
                          isSavingPayment ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isSavingPayment ? 'Saving...' : editingPayment ? 'Save Changes' : 'Save Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Expense Modal (Create & Edit) */}
              {showExpenseModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900">
                      {editingExpense ? 'Edit Production Expense' : 'Record Production Expense'}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Amount (₹)</label>
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
                      <div>
                        <label className="block text-slate-600 mb-1">Date</label>
                        <input
                          type="date"
                          value={expDate}
                          onChange={e => setExpDate(e.target.value)}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button
                        onClick={() => {
                          setEditingExpense(null);
                          setShowExpenseModal(false);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (editingExpense) {
                            await updateExpense({
                              ...editingExpense,
                              project_id: project.id,
                              company_id: project.company_id,
                              amount: expAmount,
                              category: expCat,
                              description: expDesc || 'Production Expense',
                              paid_to: expPaidTo || 'Vendor',
                              expense_date: expDate,
                            });
                          } else {
                            await createExpense({
                              project_id: project.id,
                              company_id: project.company_id,
                              amount: expAmount,
                              category: expCat,
                              description: expDesc || 'Production Expense',
                              paid_to: expPaidTo || 'Vendor',
                              expense_date: expDate,
                            });
                          }
                          setEditingExpense(null);
                          setShowExpenseModal(false);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs cursor-pointer"
                      >
                        {editingExpense ? 'Save Changes' : 'Save Expense'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Payment Confirmation Modal */}
              {deletingPaymentId && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
                    <h2 className="text-base font-bold text-slate-900">
                      Delete Client Payment?
                    </h2>
                    <p className="text-xs text-slate-500 mt-2">
                      Are you sure you want to delete this payment receipt? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => setDeletingPaymentId(null)}
                        className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeletePayment}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                      >
                        Delete Payment
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Expense Confirmation Modal */}
              {deletingExpenseId && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
                    <h2 className="text-base font-bold text-slate-900">
                      Delete Production Expense?
                    </h2>
                    <p className="text-xs text-slate-500 mt-2">
                      Are you sure you want to delete this expense? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => setDeletingExpenseId(null)}
                        className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteExpense}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                      >
                        Delete Expense
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Client HDD/SSD control */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Client HDD/SSD:
                    </span>
                    <select
                      id={`select-workspace-client-hdd-${project.id}`}
                      value={project.client_hdd_status || 'Not Received'}
                      onChange={async e => {
                        const newStatus = e.target.value as ClientHddStatus;
                        try {
                          await updateProject({
                            ...project,
                            client_hdd_status: newStatus,
                          });
                        } catch (err) {
                          console.error('Failed to update Client HDD/SSD status:', err);
                        }
                      }}
                      className="text-xs font-medium text-slate-800 bg-transparent border-0 focus:outline-hidden cursor-pointer"
                    >
                      {CLIENT_HDD_STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleOpenAddDataModal}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Storage Location
                  </button>
                </div>
              </div>

              {projectDataList.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Storage</th>
                          <th className="py-3 px-4 font-semibold">Name</th>
                          <th className="py-3 px-4 font-semibold">Type</th>
                          <th className="py-3 px-4 font-semibold">Location</th>
                          <th className="py-3 px-4 font-semibold">Notes</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {projectDataList.map(item => {
                          const norm = normalizeStorageRecord(item);

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* 1. Storage */}
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-900 bg-slate-100 border border-slate-200/90 rounded px-2 py-0.5 text-[11px] inline-block whitespace-nowrap">
                                  {norm.storage}
                                </span>
                              </td>

                              {/* 2. Name */}
                              <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                {norm.name}
                              </td>

                              {/* 3. Type */}
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] inline-block">
                                  {norm.type}
                                </span>
                              </td>

                              {/* 4. Location */}
                              <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                {norm.location}
                              </td>

                              {/* 5. Notes */}
                              <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                                {norm.notes || '—'}
                              </td>

                              {/* 6. Status */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block ${getStorageStatusBadge(
                                    norm.status
                                  )}`}
                                >
                                  {norm.status}
                                </span>
                              </td>

                              {/* 7. Actions */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditDataModal(item)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                    title="Edit storage record"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteDataError(null);
                                      setDeletingData(item);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="Delete storage record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <HardDrive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No media storage records tracked yet.</p>
                </div>
              )}

              {/* Add / Edit Storage Location Modal */}
              {showDataModal && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {editingDataId ? 'Edit Storage Location' : 'Add Storage Location'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {editingDataId
                            ? 'Update physical storage drive details'
                            : 'Track SSDs, HDDs, or tower drives for this wedding'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataModal(false);
                          setEditingDataId(null);
                          setSaveDataError(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {saveDataError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                        {saveDataError}
                      </div>
                    )}

                    <div className="space-y-3 text-xs">
                      {/* 1. Storage Dropdown */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Storage</label>
                        <select
                          value={dataStorage}
                          onChange={e => setDataStorage(e.target.value as StorageDropdownOption)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          {STORAGE_DROPDOWN_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Name Plain Text Input */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Name</label>
                        <input
                          type="text"
                          required
                          value={dataName}
                          onChange={e => setDataName(e.target.value)}
                          placeholder="e.g. Sandisk, EVM, 6TB Tower, Editor's"
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      {/* 3. Type Dropdown */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Type</label>
                        <select
                          value={dataType}
                          onChange={e => setDataType(e.target.value as StorageTypeOption)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          {STORAGE_TYPE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 4. Location Plain Text Input */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Location</label>
                        <input
                          type="text"
                          required
                          value={dataLocation}
                          onChange={e => setDataLocation(e.target.value)}
                          placeholder="e.g. Office, Editor's Desk, Client, Home"
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      {/* 5. Notes Plain Text Input */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Notes <span className="font-normal text-slate-400">(capacity, details)</span>
                        </label>
                        <input
                          type="text"
                          value={dataNotes}
                          onChange={e => setDataNotes(e.target.value)}
                          placeholder="e.g. 1TB, 2TB, 6TB, Vault Bay 02"
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      {/* 6. Status Dropdown */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Status</label>
                        <select
                          value={dataStatus}
                          onChange={e => setDataStatus(e.target.value as StorageStatusOption)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          {STORAGE_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataModal(false);
                          setEditingDataId(null);
                          setSaveDataError(null);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingData || !dataName.trim() || !dataLocation.trim()}
                        onClick={handleSaveData}
                        className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors"
                      >
                        {isSavingData
                          ? 'Saving...'
                          : editingDataId
                          ? 'Save Changes'
                          : 'Save Record'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Storage Record Confirmation Modal */}
              {deletingData && (
                <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-3 text-rose-600">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Delete Storage Record</h4>
                        <p className="text-xs text-slate-500">Remove external media record</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Are you sure you want to remove the storage record for{' '}
                      <strong className="text-slate-900 font-semibold">
                        {normalizeStorageRecord(deletingData).name}
                      </strong>{' '}
                      ({normalizeStorageRecord(deletingData).storage})? This will permanently delete this record from Supabase.
                    </p>

                    {deleteDataError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                        {deleteDataError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        id="btn-cancel-delete-storage"
                        disabled={isDeletingData}
                        onClick={() => {
                          setDeletingData(null);
                          setDeleteDataError(null);
                        }}
                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-delete-storage"
                        disabled={isDeletingData}
                        onClick={handleDeleteData}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingData ? 'Removing...' : 'Delete Record'}
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
                  <p className="text-xs text-slate-500">Manage deliverables list for this project.</p>
                </div>
                {canManageDeliverables && (
                  <button
                    type="button"
                    id="btn-workspace-add-deliverable"
                    onClick={() => {
                      setNewDelType('Highlight Film (4-5 mins)');
                      setNewDelEditorId('');
                      setNewDelLink('');
                      setNewDelNotes('');
                      setShowDeliverableModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Deliverable</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {projectDeliverablesList.map(del => {
                  const editorName = teamMembers.find(m => m.id === del.assigned_editor_id)?.name;

                  return (
                    <div
                      key={del.id}
                      id={`project-deliverable-${del.id}`}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900">{del.deliverable_type}</span>
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {del.status || 'Unassigned'}
                        </span>
                        {editorName ? (
                          <span className="text-[11px] text-slate-500">
                            • Editor: <strong className="text-slate-700 font-medium">{editorName}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            • Unassigned Editor
                          </span>
                        )}
                        {del.external_link && (
                          <a
                            href={del.external_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                          >
                            <span>Review Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {canManageDeliverables && (
                        <button
                          type="button"
                          id={`workspace-delete-deliverable-${del.id}`}
                          onClick={() => setDeletingDeliverable(del)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete deliverable"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {projectDeliverablesList.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No deliverables added for this project yet.</p>
                </div>
              )}

              {/* Add Deliverable Modal */}
              {showDeliverableModal && (
                <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Add Deliverable</h4>
                        <p className="text-[11px] text-slate-500">Create deliverable for {project.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeliverableModal(false)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-700 mb-1 font-semibold">Deliverable Type *</label>
                        <select
                          value={newDelType}
                          onChange={e => setNewDelType(e.target.value as DeliverableType)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
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
                        <label className="block text-slate-700 mb-1 font-semibold">Assigned Editor</label>
                        <select
                          value={newDelEditorId}
                          onChange={e => setNewDelEditorId(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                        >
                          <option value="">Unassigned</option>
                          {availableEditors.map(ed => (
                            <option key={ed.id} value={ed.id}>
                              {ed.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1 font-semibold">Review / Delivery URL</label>
                        <input
                          type="url"
                          value={newDelLink}
                          onChange={e => setNewDelLink(e.target.value)}
                          placeholder="https://frame.io/... or vimeo.com/..."
                          className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1 font-semibold">Notes / Feedback</label>
                        <textarea
                          rows={2}
                          value={newDelNotes}
                          onChange={e => setNewDelNotes(e.target.value)}
                          placeholder="Special creative requirements or feedback..."
                          className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowDeliverableModal(false)}
                        className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="submit-workspace-deliverable-btn"
                        disabled={isSubmittingDeliverable}
                        onClick={async () => {
                          const editorId = newDelEditorId.trim();
                          // Workflow rules:
                          // If editor assigned: status = 'Assigned'
                          // If no editor assigned: editor = null, status = '' (blank)
                          const initialStatus: DeliverableStatus = editorId ? 'Assigned' : ('' as DeliverableStatus);

                          try {
                            setIsSubmittingDeliverable(true);
                            await createDeliverable({
                              project_id: project.id,
                              company_id: project.company_id,
                              deliverable_type: newDelType,
                              assigned_editor_id: editorId || '',
                              due_date: project.wedding_date_start || new Date().toISOString().split('T')[0],
                              status: initialStatus,
                              priority: 'Medium',
                              external_link: newDelLink.trim() || undefined,
                              client_feedback: newDelNotes.trim() || undefined,
                            });
                            setShowDeliverableModal(false);
                            setNewDelLink('');
                            setNewDelEditorId('');
                            setNewDelNotes('');
                          } catch (err) {
                            console.error('Failed to add deliverable:', err);
                            alert(`Could not add deliverable: ${err instanceof Error ? err.message : String(err)}`);
                          } finally {
                            setIsSubmittingDeliverable(false);
                          }
                        }}
                        className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmittingDeliverable ? 'Adding...' : 'Add Deliverable'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Workspace Delete Deliverable Confirmation Modal */}
              {deletingDeliverable && (
                <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
                    <div className="flex items-center gap-3 text-rose-600">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Delete Deliverable</h4>
                        <p className="text-xs text-slate-500">Remove from this project and Global Deliverables.</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Are you sure you want to permanently delete{' '}
                      <strong className="text-slate-900 font-semibold">
                        "{deletingDeliverable.deliverable_type}"
                      </strong>
                      ? This action cannot be undone.
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        id="cancel-workspace-delete-deliverable-btn"
                        disabled={isDeletingDeliverable}
                        onClick={() => setDeletingDeliverable(null)}
                        className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="confirm-workspace-delete-deliverable-btn"
                        disabled={isDeletingDeliverable}
                        onClick={async () => {
                          try {
                            setIsDeletingDeliverable(true);
                            await deleteDeliverable(deletingDeliverable.id);
                            setDeletingDeliverable(null);
                          } catch (err) {
                            console.error('Failed to delete deliverable:', err);
                            alert(`Could not delete deliverable: ${err instanceof Error ? err.message : String(err)}`);
                          } finally {
                            setIsDeletingDeliverable(false);
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isDeletingDeliverable ? 'Deleting...' : 'Delete Deliverable'}
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

          {/* TAB 7: NOTES & POLICY */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Production Notes & Couple Agreements</h3>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <textarea
                    value={project.notes || ''}
                    onChange={e => updateProject({ ...project, notes: e.target.value })}
                    rows={5}
                    placeholder="Record timeline details, special family requests, VIP guests, lighting preferences..."
                    className="w-full p-3 border border-slate-200 rounded-lg text-xs leading-relaxed"
                  />
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400">Autosaves on change</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions / Policy Clauses for Production Order Form */}
              <ProjectTermsEditor
                project={project}
                company={company}
                client={client}
                deliverables={projectDeliverablesList}
                payments={projectPayments}
                onUpdateProject={updateProject}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
