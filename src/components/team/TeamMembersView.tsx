import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  Mail,
  Phone,
  Users,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldOff,
  Clock,
  UserPlus,
  Send,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  EditorAccountStatusState,
  EditorAccountStatusSummary,
  TeamMember,
  TeamMemberCategory,
} from '../../types';
import { isDeliverableEditor } from '../../utils/teamMemberFilters';
import { getSupabaseClient } from '../../lib/supabase';
import {
  getEditorAccountStatus,
  getEditorAccountStatuses,
  inviteEditor,
  resendEditorInvite,
  setEditorAccountActive,
} from '../../services/editorAccounts';
import {
  buildLoginToggleRequest,
  canManageEditorAccounts,
  EditorAccountFeedback,
  formatEditorAccountActionError,
  getEditorPortalAction,
  getInvitePrerequisiteIssue,
  isDirectoryMemberActive,
} from '../../utils/editorAccountUi';

type MemberForm = {
  name: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  categories: TeamMemberCategory[];
};

const CATEGORY_OPTIONS: TeamMemberCategory[] = [
  'Photo',
  'Video',
  'Editor',
  'Drone',
  'Same Day',
  'Other',
];

const EMPTY_FORM: MemberForm = {
  name: '',
  phone: '',
  email: '',
  status: 'Active',
  categories: [],
};

export const TeamMembersView: React.FC = () => {
  const { canAccessSection } = useApp();
  if (!canAccessSection('team-members')) return null;
  return <TeamMembersViewContent />;
};

const PORTAL_STATUS_META: Record<
  EditorAccountStatusState,
  { label: string; className: string }
> = {
  'Not Invited': {
    label: 'Portal: Not Invited',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  'Invitation Pending': {
    label: 'Portal: Invitation Pending',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  'Login Active': {
    label: 'Portal: Login Active',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  'Login Disabled': {
    label: 'Portal: Login Disabled',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

function renderPortalStatusIcon(status: EditorAccountStatusState) {
  switch (status) {
    case 'Login Active':
      return <ShieldCheck size={12} />;
    case 'Login Disabled':
      return <ShieldOff size={12} />;
    case 'Invitation Pending':
      return <Clock size={12} />;
    case 'Not Invited':
    default:
      return <UserPlus size={12} />;
  }
}

const TeamMembersViewContent: React.FC = () => {
  const {
    teamMembers,
    currentUser,
    supabaseStatus,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState<TeamMemberCategory[]>(
    []
  );
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [accountStatusByMemberId, setAccountStatusByMemberId] = useState<
    Record<string, EditorAccountStatusSummary>
  >({});
  const [loadingAccountStatuses, setLoadingAccountStatuses] = useState(false);
  const [accountStatusError, setAccountStatusError] = useState<string | null>(
    null
  );
  const [pendingMemberActionId, setPendingMemberActionId] = useState<
    string | null
  >(null);
  const [accountFeedback, setAccountFeedback] =
    useState<EditorAccountFeedback | null>(null);
  const [resendUnsupportedByMemberId, setResendUnsupportedByMemberId] =
    useState<Record<string, boolean>>({});

  const [inviteTarget, setInviteTarget] = useState<TeamMember | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [loginToggleTarget, setLoginToggleTarget] = useState<{
    member: TeamMember;
    nextLoginActive: boolean;
  } | null>(null);
  const [loginToggleSubmitting, setLoginToggleSubmitting] = useState(false);
  const [loginToggleError, setLoginToggleError] = useState<string | null>(null);

  const canManageAccounts = canManageEditorAccounts(currentUser?.role);

  const editorMemberIds = useMemo(() => {
    return teamMembers
      .filter(member => isDeliverableEditor(member))
      .map(member => member.id)
      .sort();
  }, [teamMembers]);

  const editorMemberIdsKey = editorMemberIds.join(',');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !currentUser || editorMemberIds.length === 0) {
      setAccountStatusByMemberId({});
      setLoadingAccountStatuses(false);
      setAccountStatusError(null);
      return;
    }

    let cancelled = false;
    setLoadingAccountStatuses(true);
    setAccountStatusError(null);

    getEditorAccountStatuses(editorMemberIds)
      .then(accounts => {
        if (cancelled) return;
        const nextMap: Record<string, EditorAccountStatusSummary> = {};
        for (const item of accounts) {
          if (item?.team_member_id) {
            nextMap[item.team_member_id] = item;
          }
        }
        setAccountStatusByMemberId(nextMap);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Could not load Editor portal account statuses.';
        setAccountStatusError(msg);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAccountStatuses(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editorMemberIdsKey, currentUser?.id, supabaseStatus.connected]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...teamMembers]
      .filter(member => {
        if (statusFilter === 'active') {
          return member.is_active !== false && member.status !== 'Inactive';
        }

        if (statusFilter === 'inactive') {
          return member.is_active === false || member.status === 'Inactive';
        }

        return true;
      })
      .filter(member => {
        if (!query) return true;

        return (
          member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.phone?.toLowerCase().includes(query)
        );
      })
      .filter(member => {
        if (categoryFilter.length === 0) return true;

        const memberCategories = member.categories || [];

        return categoryFilter.some(category =>
          memberCategories.includes(category)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers, search, categoryFilter, statusFilter]);

  const openAddModal = () => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);

    setForm({
      name: member.name || '',
      phone: member.phone || '',
      email: member.email || '',
      status:
        member.is_active === false || member.status === 'Inactive'
          ? 'Inactive'
          : 'Active',
      categories: member.categories || [],
    });

    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const toggleFormCategory = (category: TeamMemberCategory) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(item => item !== category)
        : [...prev.categories, category],
    }));
  };

  const toggleCategoryFilter = (category: TeamMemberCategory) => {
    setCategoryFilter(prev =>
      prev.includes(category)
        ? prev.filter(item => item !== category)
        : [...prev, category]
    );
  };

  const handleSave = async () => {
    setError('');

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!form.phone.trim()) {
      setError('Mobile number is required.');
      return;
    }

    setSaving(true);

    try {
      if (editingMember) {
        await updateTeamMember({
          ...editingMember,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          is_active: form.status === 'Active',
          status: form.status,
          categories: form.categories,
        });
      } else {
        await createTeamMember({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),

          // Legacy database field.
          // Project roles are NOT taken from this field.
          role: 'other' as TeamMember['role'],

          role_title: '',
          is_active: form.status === 'Active',
          status: form.status,
          categories: form.categories,
        });
      }

      closeModal();
    } catch (err: any) {
      setError(err?.message || 'Could not save team member.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const nextActive =
      member.is_active === false || member.status === 'Inactive';

    try {
      await updateTeamMember({
        ...member,
        is_active: nextActive,
        status: nextActive ? 'Active' : 'Inactive',
      });
    } catch (err: any) {
      window.alert(err?.message || 'Could not update team member status.');
    }
  };

  const handleDelete = async (member: TeamMember) => {
    const confirmed = window.confirm(
      `Delete ${member.name}?\n\nThis can only be done if they have no project assignments. Historical crew records are protected.`
    );

    if (!confirmed) return;

    try {
      await deleteTeamMember(member.id);
    } catch (err: any) {
      window.alert(err?.message || 'Could not delete team member.');
    }
  };

  const refreshSingleAccountStatus = async (
    teamMemberId: string,
    fallbackSummary?: Partial<EditorAccountStatusSummary>
  ) => {
    try {
      const latest = await getEditorAccountStatus(teamMemberId);
      const { success: _success, action: _action, ...summary } = latest;
      setAccountStatusByMemberId(prev => ({
        ...prev,
        [teamMemberId]: summary,
      }));
      if (summary.account_status !== 'Invitation Pending') {
        setResendUnsupportedByMemberId(prev => {
          if (!prev[teamMemberId]) return prev;
          const next = { ...prev };
          delete next[teamMemberId];
          return next;
        });
      }
    } catch {
      if (fallbackSummary?.account_status) {
        setAccountStatusByMemberId(prev => ({
          ...prev,
          [teamMemberId]: {
            ...(prev[teamMemberId] ?? {
              team_member_id: teamMemberId,
              profile_id: null,
              account_status: fallbackSummary.account_status!,
              team_member_active: true,
              team_member_directory_active: true,
              team_member_status: 'Active',
              is_editor_category: true,
              profile_role: 'editor',
              profile_is_active: true,
              auth_banned: false,
              email_confirmed: false,
              password_setup_required: true,
              invited_at: null,
              last_sign_in_at: null,
              integrity_warning: null,
            }),
            ...fallbackSummary,
            team_member_id: teamMemberId,
          },
        }));
      }
    }
  };

  const openInviteModal = (member: TeamMember) => {
    if (!canManageAccounts) return;
    setInviteTarget(member);
    setInviteError(null);
  };

  const closeInviteModal = () => {
    if (inviteSubmitting) return;
    setInviteTarget(null);
    setInviteError(null);
  };

  const handleConfirmInvite = async () => {
    if (!canManageAccounts || !inviteTarget || inviteSubmitting) return;

    const prerequisiteIssue = getInvitePrerequisiteIssue(inviteTarget);
    if (prerequisiteIssue) {
      setInviteError(prerequisiteIssue);
      return;
    }

    const targetMember = inviteTarget;
    setInviteSubmitting(true);
    setPendingMemberActionId(targetMember.id);
    setInviteError(null);

    try {
      const response = await inviteEditor({
        teamMemberId: targetMember.id,
        email: targetMember.email.trim(),
      });

      await refreshSingleAccountStatus(targetMember.id, {
        profile_id: response.profile_id,
        account_status: response.account_status,
      });

      setAccountFeedback({
        tone: 'success',
        title: 'Editor invitation sent',
        message:
          response.message ||
          `Invitation sent to ${targetMember.name} (${targetMember.email.trim()}).`,
        memberId: targetMember.id,
      });
      setInviteTarget(null);
    } catch (err: unknown) {
      const formatted = formatEditorAccountActionError(
        err,
        'Could not send the Editor portal invitation.'
      );
      setInviteError(formatted.message);
    } finally {
      setInviteSubmitting(false);
      setPendingMemberActionId(prev =>
        prev === targetMember.id ? null : prev
      );
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    if (!canManageAccounts || pendingMemberActionId === member.id) return;

    setPendingMemberActionId(member.id);
    setAccountFeedback(null);

    try {
      const response = await resendEditorInvite(member.id);
      if (response.success) {
        await refreshSingleAccountStatus(member.id, {
          account_status: response.account_status ?? 'Invitation Pending',
          profile_id: response.profile_id ?? null,
        });
        setAccountFeedback({
          tone: 'success',
          title: 'Invitation re-sent',
          message: `Invitation email re-sent to ${member.name}.`,
          memberId: member.id,
        });
        return;
      }

      setAccountFeedback({
        tone: 'warning',
        title: 'Automatic resend is unavailable',
        message:
          response.error ||
          'Automatic invitation resend is currently unavailable without custom SMTP.',
        memberId: member.id,
        isResendUnsupported: response.code === 'INVITE_RESEND_UNSUPPORTED',
      });
    } catch (err: unknown) {
      const formatted = formatEditorAccountActionError(
        err,
        'Could not resend Editor invitation.'
      );
      if (formatted.isResendUnsupported) {
        setResendUnsupportedByMemberId(prev => ({
          ...prev,
          [member.id]: true,
        }));
      }
      setAccountFeedback({
        ...formatted,
        memberId: member.id,
      });
      await refreshSingleAccountStatus(member.id);
    } finally {
      setPendingMemberActionId(prev => (prev === member.id ? null : prev));
    }
  };

  const openLoginToggleModal = (
    member: TeamMember,
    nextLoginActive: boolean
  ) => {
    if (!canManageAccounts) return;
    setLoginToggleTarget({ member, nextLoginActive });
    setLoginToggleError(null);
  };

  const closeLoginToggleModal = () => {
    if (loginToggleSubmitting) return;
    setLoginToggleTarget(null);
    setLoginToggleError(null);
  };

  const handleConfirmLoginToggle = async () => {
    if (!canManageAccounts || !loginToggleTarget || loginToggleSubmitting) {
      return;
    }

    const { member, nextLoginActive } = loginToggleTarget;
    setLoginToggleSubmitting(true);
    setPendingMemberActionId(member.id);
    setLoginToggleError(null);

    try {
      const response = await setEditorAccountActive(
        buildLoginToggleRequest(member.id, nextLoginActive)
      );
      const { success: _success, action: _action, ...summary } = response;
      await refreshSingleAccountStatus(member.id, summary);

      setAccountFeedback({
        tone: 'success',
        title: nextLoginActive
          ? 'Portal login enabled'
          : 'Portal login disabled',
        message: nextLoginActive
          ? `${member.name} can now sign in to the Editor portal. Directory availability was not changed.`
          : `Portal login has been disabled for ${member.name}. Their Team Member directory availability was not changed.`,
        memberId: member.id,
      });
      setLoginToggleTarget(null);
    } catch (err: unknown) {
      const formatted = formatEditorAccountActionError(
        err,
        `Could not ${nextLoginActive ? 'enable' : 'disable'} portal login.`
      );
      setLoginToggleError(formatted.message);
    } finally {
      setLoginToggleSubmitting(false);
      setPendingMemberActionId(prev => (prev === member.id ? null : prev));
    }
  };

  const activeCount = teamMembers.filter(
    member => member.is_active !== false && member.status !== 'Inactive'
  ).length;

  const inactiveCount = teamMembers.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Team Members
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage the shared team directory used across both companies.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={18} />
          Add Team Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <Users size={18} className="text-slate-600" />
            </div>

            <div>
              <p className="text-xs text-slate-500">Total Members</p>

              <p className="text-xl font-semibold text-slate-900">
                {teamMembers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Active</p>

          <p className="mt-1 text-xl font-semibold text-slate-900">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Inactive</p>

          <p className="mt-1 text-xl font-semibold text-slate-900">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_160px]">
          {/* Search */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, mobile or email..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCategoryMenu(prev => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none hover:bg-slate-50"
            >
              <span>
                {categoryFilter.length === 0
                  ? 'All Categories'
                  : `${categoryFilter.length} Selected`}
              </span>

              <span className="text-slate-400">▾</span>
            </button>

            {showCategoryMenu && (
              <div className="absolute left-0 right-0 z-30 mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {CATEGORY_OPTIONS.map(category => {
                  const selected = categoryFilter.includes(category);

                  return (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategoryFilter(category)}
                        className="h-4 w-4 rounded border-slate-300"
                      />

                      {category}
                    </label>
                  );
                })}

                {categoryFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter([])}
                    className="mt-1 w-full border-t border-slate-100 px-2 pt-2 text-left text-xs text-slate-500 hover:text-slate-800"
                  >
                    Clear categories
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Status</option>
          </select>
        </div>
      </div>

      {/* Portal Account Status Notice (non-blocking) */}
      {accountStatusError && editorMemberIds.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">
              Editor portal login statuses could not be loaded right now.
            </p>
            <p className="mt-0.5 text-amber-800">{accountStatusError}</p>
          </div>
        </div>
      )}

      {/* Portal Account Action Feedback */}
      {accountFeedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            accountFeedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : accountFeedback.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {accountFeedback.tone === 'success' ? (
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <AlertTriangle
                size={16}
                className={`mt-0.5 shrink-0 ${
                  accountFeedback.tone === 'warning'
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              />
            )}
            <div>
              <p className="font-semibold">{accountFeedback.title}</p>
              <p className="mt-0.5">{accountFeedback.message}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAccountFeedback(null)}
            className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
            aria-label="Dismiss feedback"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Members */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredMembers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto text-slate-300" size={36} />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No team members found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMembers.map(member => {
              const categories = member.categories || [];
              const isEditorMember = isDeliverableEditor(member);
              const portalStatus = isEditorMember
                ? accountStatusByMemberId[member.id]
                : undefined;

              const isActive = isDirectoryMemberActive(member);
              const portalAction = isEditorMember
                ? getEditorPortalAction(
                    portalStatus?.account_status,
                    canManageAccounts
                  )
                : null;
              const isPortalActionBusy = pendingMemberActionId === member.id;
              const isResendUnsupported =
                resendUnsupportedByMemberId[member.id] === true;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {member.name}
                      </h3>

                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                        title="Team Member directory availability status (independent of portal login)"
                      >
                        Directory: {isActive ? 'Active' : 'Inactive'}
                      </span>

                      {isEditorMember && (
                        portalStatus ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                              PORTAL_STATUS_META[portalStatus.account_status]
                                .className
                            }`}
                            title="Editor portal login status (managed independently from directory activity)"
                          >
                            {renderPortalStatusIcon(portalStatus.account_status)}
                            {
                              PORTAL_STATUS_META[portalStatus.account_status]
                                .label
                            }
                          </span>
                        ) : loadingAccountStatuses ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                            Portal: Checking...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                            Portal: Status Unavailable
                          </span>
                        )
                      )}
                    </div>

                    <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-5">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} />
                        {member.phone || 'No mobile'}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={14} />
                        {member.email || 'No email'}
                      </span>
                    </div>

                    {/* Member Categories */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {categories.length > 0 ? (
                        categories.map(category => (
                          <span
                            key={category}
                            className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                          >
                            {category}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          No category assigned
                        </span>
                      )}
                    </div>

                    {isEditorMember &&
                      portalStatus?.account_status === 'Invitation Pending' &&
                      isResendUnsupported && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <AlertTriangle
                            size={14}
                            className="mt-0.5 shrink-0 text-amber-600"
                          />
                          <span>
                            Automatic invitation resend is unavailable without
                            custom SMTP. The pending invitation remains intact
                            (no account was deleted or recreated); ask the
                            Editor to check their original invite email or spam
                            folder.
                          </span>
                        </div>
                      )}

                    {isEditorMember && portalStatus?.integrity_warning && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <AlertTriangle
                          size={14}
                          className="mt-0.5 shrink-0 text-amber-600"
                        />
                        <span>{portalStatus.integrity_warning}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {isEditorMember && canManageAccounts && portalAction && (
                      <>
                        {portalAction === 'invite' && (
                          <button
                            type="button"
                            onClick={() => openInviteModal(member)}
                            disabled={isPortalActionBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send size={14} />
                            {isPortalActionBusy
                              ? 'Inviting...'
                              : 'Invite to TWB Hub'}
                          </button>
                        )}

                        {portalAction === 'resend' && (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(member)}
                            disabled={
                              isPortalActionBusy || isResendUnsupported
                            }
                            title={
                              isResendUnsupported
                                ? 'Automatic resend requires custom SMTP'
                                : 'Check or resend pending Editor portal invitation'
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCw
                              size={14}
                              className={
                                isPortalActionBusy ? 'animate-spin' : ''
                              }
                            />
                            {isPortalActionBusy
                              ? 'Checking...'
                              : isResendUnsupported
                                ? 'Resend Unavailable'
                                : 'Resend Invitation'}
                          </button>
                        )}

                        {portalAction === 'disable_login' && (
                          <button
                            type="button"
                            onClick={() => openLoginToggleModal(member, false)}
                            disabled={isPortalActionBusy}
                            title="Disable Editor portal sign-in without changing Team Member directory status"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ShieldOff size={14} />
                            {isPortalActionBusy
                              ? 'Updating...'
                              : 'Disable Portal Login'}
                          </button>
                        )}

                        {portalAction === 'enable_login' && (
                          <button
                            type="button"
                            onClick={() => openLoginToggleModal(member, true)}
                            disabled={isPortalActionBusy}
                            title="Enable Editor portal sign-in without changing Team Member directory status"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ShieldCheck size={14} />
                            {isPortalActionBusy
                              ? 'Updating...'
                              : 'Enable Portal Login'}
                          </button>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => openEditModal(member)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={15} />
                      Edit
                    </button>

                    <button
                      onClick={() => handleToggleStatus(member)}
                      title="Toggle Team Member directory availability (independent of portal login)"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {isActive ? (
                        <>
                          <UserX size={15} />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck size={15} />
                          Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(member)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingMember ? 'Edit Team Member' : 'Add Team Member'}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Master profile shared across both companies.
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Name *
                </label>

                <input
                  value={form.name}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mobile *
                </label>

                <input
                  value={form.phone}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="Mobile number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Email address"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* Categories */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Categories
                </label>

                <p className="mb-2 text-xs text-slate-500">
                  Select all that apply. These categories are only for this
                  team directory.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map(category => {
                    const selected = form.categories.includes(category);

                    return (
                      <label
                        key={category}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                          selected
                            ? 'border-slate-400 bg-slate-50 text-slate-900'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleFormCategory(category)}
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        {category}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      status: e.target.value as 'Active' | 'Inactive',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingMember
                    ? 'Save Changes'
                    : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invite Editor Confirmation Modal */}
      {inviteTarget && canManageAccounts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Invite to TWB Hub
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Send an Editor portal invitation linked to this Team Member.
                </p>
              </div>

              <button
                type="button"
                onClick={closeInviteModal}
                disabled={inviteSubmitting}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500">
                    Team Member
                  </span>
                  <span className="font-semibold text-slate-900">
                    {inviteTarget.name}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500">
                    Invitation Email
                  </span>
                  <span className="truncate font-medium text-slate-800">
                    {inviteTarget.email?.trim() || 'Not provided'}
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                This will email an invitation link so{' '}
                <span className="font-medium text-slate-800">
                  {inviteTarget.name}
                </span>{' '}
                can confirm their address, set a password, and access their
                assigned deliverables in TWB Hub.
              </p>

              {(() => {
                const prerequisiteIssue =
                  getInvitePrerequisiteIssue(inviteTarget);
                if (!prerequisiteIssue) return null;
                return (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                    <AlertTriangle
                      size={15}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />
                    <span>{prerequisiteIssue}</span>
                  </div>
                );
              })()}

              {inviteError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                  {inviteError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeInviteModal}
                disabled={inviteSubmitting}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmInvite}
                disabled={
                  inviteSubmitting ||
                  Boolean(getInvitePrerequisiteIssue(inviteTarget))
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} />
                {inviteSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enable / Disable Portal Login Confirmation Modal */}
      {loginToggleTarget && canManageAccounts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {loginToggleTarget.nextLoginActive
                    ? 'Enable Portal Login'
                    : 'Disable Portal Login'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Changes Editor portal sign-in access independently from
                  directory status.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLoginToggleModal}
                disabled={loginToggleSubmitting}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500">
                    Editor
                  </span>
                  <span className="font-semibold text-slate-900">
                    {loginToggleTarget.member.name}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500">
                    Email
                  </span>
                  <span className="truncate font-medium text-slate-800">
                    {loginToggleTarget.member.email || 'Not provided'}
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                {loginToggleTarget.nextLoginActive
                  ? `Re-enabling portal login allows ${loginToggleTarget.member.name} to sign in to TWB Hub again. Their Team Member directory Active/Inactive setting will remain unchanged.`
                  : `Disabling portal login immediately blocks ${loginToggleTarget.member.name} from signing in to TWB Hub without deleting their account or altering their Team Member directory status.`}
              </p>

              {loginToggleError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                  {loginToggleError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeLoginToggleModal}
                disabled={loginToggleSubmitting}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmLoginToggle}
                disabled={loginToggleSubmitting}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  loginToggleTarget.nextLoginActive
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {loginToggleTarget.nextLoginActive ? (
                  <>
                    <ShieldCheck size={14} />
                    {loginToggleSubmitting
                      ? 'Enabling...'
                      : 'Confirm Enable Login'}
                  </>
                ) : (
                  <>
                    <ShieldOff size={14} />
                    {loginToggleSubmitting
                      ? 'Disabling...'
                      : 'Confirm Disable Login'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};