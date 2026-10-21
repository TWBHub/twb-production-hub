import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TeamMember, TeamMemberCategory } from '../../types';

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
  const {
    teamMembers,
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

              const isActive =
                member.is_active !== false && member.status !== 'Inactive';

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
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
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
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEditModal(member)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={15} />
                      Edit
                    </button>

                    <button
                      onClick={() => handleToggleStatus(member)}
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
    </div>
  );
};