import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCw,
  Lock,
  Layers,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  X,
  ShieldAlert,
  Film,
  ArrowUp,
  ArrowDown,
  Pencil,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INITIAL_COMPANIES } from '../../services/seedData';
import {
  Company,
  DeliverableBrandScope,
  DeliverableCatalogueCategory,
  DeliverableCatalogueItem,
} from '../../types';
import { resolveCompany, prepareCompanyForUpdate, sanitizeCompany } from '../../utils/companyUtils';
import { ModuleErrorBanner } from '../common/ModuleErrorBanner';
import {
  DELIVERABLE_CATALOGUE_CATEGORIES,
  canAddDeliverableCatalogueEntry,
  canEditDeliverableCatalogueEntry,
  computeSwappedDeliverableSortOrders,
  filterDeliverableCatalogueForSettings,
  findEffectiveBrandDuplicate,
  getCatalogueItemReferences,
  getNextDeliverableSortOrder,
  resolveCatalogueBrandLabel,
} from '../../utils/deliverableCatalogueUtils';

export const SettingsView: React.FC = () => {
  const { canAccessSection } = useApp();
  if (!canAccessSection('settings')) return null;
  return <SettingsViewContent />;
};

const SettingsViewContent: React.FC = () => {
  const {
    companies,
    updateCompany,
    currentUser,
    projects,
    deliverables,
    enquiries,
    deliverableCatalogue,
    createDeliverableCatalogueItem,
    updateDeliverableCatalogueItem,
    reorderDeliverableCatalogue,
    deleteDeliverableCatalogueItem,
    moduleErrors,
    refreshAllData,
    isRefreshingData,
  } = useApp();

  const [twbBrand, setTwbBrand] = useState<Company>(
    () => resolveCompany(companies, 'twb', INITIAL_COMPANIES[0]) || sanitizeCompany(INITIAL_COMPANIES[0], 'twb')
  );
  const [gjBrand, setGjBrand] = useState<Company>(
    () => resolveCompany(companies, 'golden_june', INITIAL_COMPANIES[1]) || sanitizeCompany(INITIAL_COMPANIES[1], 'golden_june')
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Unified Shared Catalogue state
  const canAddDeliverableCat = canAddDeliverableCatalogueEntry(currentUser?.role);
  const canEditDeliverableCat = canEditDeliverableCatalogueEntry(currentUser?.role);

  const [delCatBrandFilter, setDelCatBrandFilter] = useState<'all' | 'shared' | 'twb' | 'golden_june'>('all');
  const [delCatStatusFilter, setDelCatStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddingDelCat, setIsAddingDelCat] = useState(false);
  const [newDelCatName, setNewDelCatName] = useState('');
  const [newDelCatCategory, setNewDelCatCategory] = useState<DeliverableCatalogueCategory>('Film');
  const [newDelCatBrand, setNewDelCatBrand] = useState<DeliverableBrandScope>('all');
  const [newDelCatDesc, setNewDelCatDesc] = useState('');
  const [newDelCatSortOrder, setNewDelCatSortOrder] = useState<string>('');
  const [isSubmittingDelCat, setIsSubmittingDelCat] = useState(false);

  const [editingDelCat, setEditingDelCat] = useState<DeliverableCatalogueItem | null>(null);
  const [editDelCatName, setEditDelCatName] = useState('');
  const [editDelCatCategory, setEditDelCatCategory] = useState<DeliverableCatalogueCategory>('Film');
  const [editDelCatBrand, setEditDelCatBrand] = useState<DeliverableBrandScope>('all');
  const [editDelCatDesc, setEditDelCatDesc] = useState('');
  const [editDelCatSortOrder, setEditDelCatSortOrder] = useState<string>('10');
  const [editDelCatActive, setEditDelCatActive] = useState(true);
  const [editDelCatError, setEditDelCatError] = useState<string | null>(null);

  const [delCatToDelete, setDelCatToDelete] = useState<DeliverableCatalogueItem | null>(null);
  const [isDeletingDelCat, setIsDeletingDelCat] = useState(false);
  const [delCatActionError, setDelCatActionError] = useState<string | null>(null);
  const [delCatActionSuccess, setDelCatActionSuccess] = useState('');

  // Synchronize when companies finish loading from backend or cache
  useEffect(() => {
    if (companies && companies.length > 0) {
      const foundTwb = resolveCompany(companies, 'twb', INITIAL_COMPANIES[0]);
      if (foundTwb) setTwbBrand(foundTwb);
      const foundGj = resolveCompany(companies, 'golden_june', INITIAL_COMPANIES[1]);
      if (foundGj) setGjBrand(foundGj);
    }
  }, [companies]);

  const handleSaveBrands = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      if (twbBrand) {
        const payload = prepareCompanyForUpdate(twbBrand, companies);
        await updateCompany(payload);
      }
      if (gjBrand) {
        const payload = prepareCompanyForUpdate(gjBrand, companies);
        await updateCompany(payload);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving brand settings:', err);
      setSaveError(err.message || 'Failed to update brand settings in database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          System Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Brand configuration and shared studio catalogue management.
        </p>
      </div>

      {/* Brand Profiles Editor */}
      <form onSubmit={handleSaveBrands} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Two-Brand Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Custom invoice details, legal names, and contact credentials for The Wedding Booth and Golden June Films
              </p>
            </div>
          </div>

          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Saved Successfully!
            </span>
          )}
        </div>

        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <span className="font-semibold">Update Failed: </span>
              <span>{saveError}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand 1: TWB */}
          {twbBrand && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-sm">{twbBrand.name}</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase text-[10px]">
                  {twbBrand.code}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Brand / Display Name</label>
                <input
                  type="text"
                  value={twbBrand.name}
                  onChange={e => setTwbBrand({ ...twbBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="The Wedding Booth"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={twbBrand.tagline || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, tagline: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Wedding Photography & Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={twbBrand.email}
                  onChange={e => setTwbBrand({ ...twbBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="dweddingbooth@gmail.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={twbBrand.phone}
                  onChange={e => setTwbBrand({ ...twbBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="+91 9074448850"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={twbBrand.website || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, website: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="www.theweddingbooth.in"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={twbBrand.address || ''}
                  onChange={e => setTwbBrand({ ...twbBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Leave blank until supplied"
                />
              </div>
            </div>
          )}

          {/* Brand 2: Golden June */}
          {gjBrand && (
            <div className="p-4 rounded-xl border border-[#F1D099]/60 bg-[#F1D099]/10 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{gjBrand.name}</span>
                <span className="px-2 py-0.5 rounded bg-[#F1D099]/30 text-[#5e430c] border border-[#F1D099]/50 font-bold uppercase text-[10px]">
                  {gjBrand.code}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Brand / Display Name</label>
                <input
                  type="text"
                  value={gjBrand.name}
                  onChange={e => setGjBrand({ ...gjBrand, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Golden June Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={gjBrand.tagline || ''}
                  onChange={e => setGjBrand({ ...gjBrand, tagline: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Wedding Photography & Films"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  value={gjBrand.email}
                  onChange={e => setGjBrand({ ...gjBrand, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="goldenjunefilms@gmail.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Phone</label>
                <input
                  type="tel"
                  value={gjBrand.phone}
                  onChange={e => setGjBrand({ ...gjBrand, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="+91 9074963370"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={gjBrand.website || ''}
                  onChange={e => setGjBrand({ ...gjBrand, website: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="www.goldenjunefilms.com"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Studio Address</label>
                <input
                  type="text"
                  value={gjBrand.address || ''}
                  onChange={e => setGjBrand({ ...gjBrand, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  placeholder="Leave blank until supplied"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSaving ? 'Updating...' : 'Update Brand Settings'}</span>
          </button>
        </div>
      </form>

      {/* Unified Shared Catalogue Section */}
      {(() => {
        const filteredDelCatalogue = filterDeliverableCatalogueForSettings(
          deliverableCatalogue,
          {
            brandFilter: delCatBrandFilter,
            statusFilter: delCatStatusFilter,
          }
        );
        const activeCount = deliverableCatalogue.filter(i => i.is_active).length;
        const addDuplicateConflict = newDelCatName.trim()
          ? findEffectiveBrandDuplicate(
              deliverableCatalogue,
              newDelCatName,
              newDelCatBrand
            )
          : undefined;
        const editDuplicateConflict =
          editingDelCat && editDelCatName.trim()
            ? findEffectiveBrandDuplicate(
                deliverableCatalogue,
                editDelCatName,
                editDelCatBrand,
                editingDelCat.id
              )
            : undefined;

        const openEditDelCatModal = (item: DeliverableCatalogueItem) => {
          setEditingDelCat(item);
          setEditDelCatName(item.name);
          setEditDelCatCategory(item.category);
          setEditDelCatBrand(item.applicable_brand);
          setEditDelCatDesc(item.description || '');
          setEditDelCatSortOrder(String(item.sort_order ?? 0));
          setEditDelCatActive(item.is_active);
          setEditDelCatError(null);
        };

        return (
          <div
            id="shared-catalogue-section"
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Shared Catalogue
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {activeCount} Active / {deliverableCatalogue.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Single unified catalogue shared across Leads, Quotations, Global Deliverables, and Project Workspaces
                  </p>
                </div>
              </div>

              {canAddDeliverableCat && (
                <button
                  type="button"
                  id="btn-toggle-add-deliverable-catalogue"
                  onClick={() => {
                    const nextState = !isAddingDelCat;
                    setIsAddingDelCat(nextState);
                    setDelCatActionError(null);
                    if (nextState) {
                      setNewDelCatSortOrder(
                        String(getNextDeliverableSortOrder(deliverableCatalogue))
                      );
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingDelCat ? 'Cancel' : 'Add Catalogue Entry'}</span>
                </button>
              )}
            </div>

            {/* Domain Distinction & Role Governance Note */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed space-y-1">
                <div>
                  <strong className="text-slate-800">Unified Catalogue Behavior: </strong>
                  Entries here populate <strong>Leads</strong>, <strong>Quotations</strong>, and <strong>Deliverables</strong> from one Supabase source.
                  Selecting services on a Lead records client interest only and never auto-creates production deliverables; editing or deactivating entries preserves historical Leads, Quotations, and Deliverables.
                </div>
                {!canEditDeliverableCat && (
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {canAddDeliverableCat
                        ? 'Your role can view and add new catalogue entries. Editing, reordering, deactivating, and deleting require Admin permissions.'
                        : 'Read-only view. Only Admins and Managers can add entries; only Admins can modify or delete them.'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {moduleErrors.deliverableCatalogue && (
              <ModuleErrorBanner
                title="Failed to Load Shared Catalogue"
                message={moduleErrors.deliverableCatalogue}
                onRetry={refreshAllData}
                isRetrying={isRefreshingData}
              />
            )}

            {delCatActionError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{delCatActionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDelCatActionError(null)}
                  className="text-rose-500 hover:text-rose-800 p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {delCatActionSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{delCatActionSuccess}</span>
              </div>
            )}

            {/* Add Deliverable Catalogue Inline Form */}
            {isAddingDelCat && canAddDeliverableCat && (
              <form
                id="form-add-deliverable-catalogue"
                onSubmit={async e => {
                  e.preventDefault();
                  if (!newDelCatName.trim()) return;
                  try {
                    setIsSubmittingDelCat(true);
                    setDelCatActionError(null);
                    const parsedOrder = Number.parseInt(newDelCatSortOrder, 10);
                    const created = await createDeliverableCatalogueItem({
                      name: newDelCatName.trim(),
                      category: newDelCatCategory,
                      description: newDelCatDesc.trim() || undefined,
                      applicable_brand: newDelCatBrand,
                      is_active: true,
                      sort_order: Number.isFinite(parsedOrder)
                        ? parsedOrder
                        : getNextDeliverableSortOrder(deliverableCatalogue),
                    });
                    setNewDelCatName('');
                    setNewDelCatDesc('');
                    setNewDelCatBrand('all');
                    setNewDelCatCategory('Film');
                    setIsAddingDelCat(false);
                    setDelCatActionSuccess(
                      `Entry "${created.name}" (${resolveCatalogueBrandLabel(
                        created.applicable_brand
                      )}) added to Shared Catalogue.`
                    );
                    setTimeout(() => setDelCatActionSuccess(''), 4000);
                  } catch (err: any) {
                    setDelCatActionError(
                      err?.message || 'Could not add catalogue entry.'
                    );
                  } finally {
                    setIsSubmittingDelCat(false);
                  }
                }}
                className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 space-y-3 text-xs"
              >
                <h3 className="font-bold text-slate-900 text-xs">
                  Add New Shared Catalogue Entry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Entry Name *
                    </label>
                    <input
                      id="input-new-delcat-name"
                      type="text"
                      required
                      value={newDelCatName}
                      onChange={e => setNewDelCatName(e.target.value)}
                      placeholder="e.g. Same Day Edit (3 mins), Raw Footage Archive..."
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      id="select-new-delcat-category"
                      value={newDelCatCategory}
                      onChange={e =>
                        setNewDelCatCategory(
                          e.target.value as DeliverableCatalogueCategory
                        )
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    >
                      {DELIVERABLE_CATALOGUE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      id="input-new-delcat-sort"
                      type="number"
                      value={newDelCatSortOrder}
                      onChange={e => setNewDelCatSortOrder(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Description <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="input-new-delcat-desc"
                      type="text"
                      value={newDelCatDesc}
                      onChange={e => setNewDelCatDesc(e.target.value)}
                      placeholder="Optional format, length, or delivery standard notes..."
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Brand Scope
                    </label>
                    <select
                      id="select-new-delcat-brand"
                      value={newDelCatBrand}
                      onChange={e =>
                        setNewDelCatBrand(e.target.value as DeliverableBrandScope)
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    >
                      <option value="all">All Brands (TWB & Golden June)</option>
                      <option value="twb">The Wedding Booth Only</option>
                      <option value="golden_june">Golden June Films Only</option>
                    </select>
                  </div>
                </div>

                {addDuplicateConflict && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Duplicate Detected: </strong>
                      A {addDuplicateConflict.is_active ? 'active' : 'deactivated (inactive)'}{' '}
                      entry named &ldquo;{addDuplicateConflict.name}&rdquo; already exists in{' '}
                      <strong>{resolveCatalogueBrandLabel(addDuplicateConflict.applicable_brand)}</strong>.
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingDelCat(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-new-deliverable-catalogue"
                    disabled={isSubmittingDelCat || !newDelCatName.trim()}
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer"
                  >
                    {isSubmittingDelCat ? 'Saving...' : 'Save to Catalogue'}
                  </button>
                </div>
              </form>
            )}

            {/* Filter Bar: Brand Scope & Active/Inactive Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px] mr-1">Brand:</span>
                {(
                  [
                    { key: 'all', label: 'All Entries' },
                    { key: 'shared', label: 'All Brands (Shared)' },
                    { key: 'twb', label: 'The Wedding Booth' },
                    { key: 'golden_june', label: 'Golden June Films' },
                  ] as const
                ).map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setDelCatBrandFilter(b.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                      delCatBrandFilter === b.key
                        ? 'bg-slate-900 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px] mr-1">Status:</span>
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'active', label: 'Active' },
                    { key: 'inactive', label: 'Inactive' },
                  ] as const
                ).map(st => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setDelCatStatusFilter(st.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                      delCatStatusFilter === st.key
                        ? 'bg-slate-900 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deliverable Catalogue Entries Table/List */}
            {filteredDelCatalogue.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 text-xs text-slate-500">
                No deliverable catalogue entries match the active filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {filteredDelCatalogue.map((item, idx) => {
                  const brandBadge =
                    item.applicable_brand === 'twb'
                      ? 'TWB Only'
                      : item.applicable_brand === 'golden_june'
                      ? 'Golden June Only'
                      : 'All Brands';
                  const refs = getCatalogueItemReferences({
                    deliverables,
                    enquiries,
                    itemName: item.name,
                  });

                  return (
                    <div
                      key={item.id}
                      id={`delcat-row-${item.id}`}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                        item.is_active
                          ? 'bg-white hover:bg-slate-50/70'
                          : 'bg-slate-50/80 opacity-75'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            #{item.sort_order}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {item.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.applicable_brand === 'twb'
                                ? 'bg-blue-100 text-blue-800'
                                : item.applicable_brand === 'golden_june'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {brandBadge}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              item.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {refs.isInUse && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • Used in{' '}
                              {[
                                refs.leads.length > 0
                                  ? `${refs.leads.length} lead${refs.leads.length > 1 ? 's' : ''}`
                                  : null,
                                refs.deliverables.length > 0
                                  ? `${refs.deliverables.length} deliverable${
                                      refs.deliverables.length > 1 ? 's' : ''
                                    }`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' & ')}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 leading-normal pl-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {canEditDeliverableCat && (
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={idx === 0 || isSubmittingDelCat}
                            onClick={async () => {
                              const pair = computeSwappedDeliverableSortOrders(
                                filteredDelCatalogue,
                                item.id,
                                'up'
                              );
                              if (!pair) return;
                              try {
                                setIsSubmittingDelCat(true);
                                setDelCatActionError(null);
                                await reorderDeliverableCatalogue(pair);
                              } catch (err: any) {
                                setDelCatActionError(
                                  err?.message || 'Could not reorder deliverable entry.'
                                );
                              } finally {
                                setIsSubmittingDelCat(false);
                              }
                            }}
                            title="Move up"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={
                              idx === filteredDelCatalogue.length - 1 || isSubmittingDelCat
                            }
                            onClick={async () => {
                              const pair = computeSwappedDeliverableSortOrders(
                                filteredDelCatalogue,
                                item.id,
                                'down'
                              );
                              if (!pair) return;
                              try {
                                setIsSubmittingDelCat(true);
                                setDelCatActionError(null);
                                await reorderDeliverableCatalogue(pair);
                              } catch (err: any) {
                                setDelCatActionError(
                                  err?.message || 'Could not reorder deliverable entry.'
                                );
                              } finally {
                                setIsSubmittingDelCat(false);
                              }
                            }}
                            title="Move down"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isSubmittingDelCat}
                            onClick={async () => {
                              try {
                                setIsSubmittingDelCat(true);
                                setDelCatActionError(null);
                                const updated = await updateDeliverableCatalogueItem({
                                  ...item,
                                  is_active: !item.is_active,
                                });
                                setDelCatActionSuccess(
                                  `Deliverable "${updated.name}" ${
                                    updated.is_active ? 'reactivated' : 'deactivated'
                                  }.`
                                );
                                setTimeout(() => setDelCatActionSuccess(''), 3500);
                              } catch (err: any) {
                                setDelCatActionError(
                                  err?.message || 'Could not update deliverable status.'
                                );
                              } finally {
                                setIsSubmittingDelCat(false);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                              item.is_active
                                ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {item.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditDelCatModal(item)}
                            title="Edit catalogue entry"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDelCatActionError(null);
                              setDelCatToDelete(item);
                            }}
                            title="Delete catalogue entry"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Edit Deliverable Catalogue Entry Modal (Admin Only) */}
            {editingDelCat && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 my-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Edit Shared Catalogue Entry
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Updates apply to future Leads, Quotations, and Deliverables; existing records keep their saved names.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDelCat(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      if (!editDelCatName.trim()) {
                        setEditDelCatError('Deliverable name is required.');
                        return;
                      }
                      try {
                        setIsSubmittingDelCat(true);
                        setEditDelCatError(null);
                        const parsedOrder = Number.parseInt(editDelCatSortOrder, 10);
                        const updated = await updateDeliverableCatalogueItem({
                          ...editingDelCat,
                          name: editDelCatName.trim(),
                          category: editDelCatCategory,
                          applicable_brand: editDelCatBrand,
                          description: editDelCatDesc.trim() || undefined,
                          sort_order: Number.isFinite(parsedOrder)
                            ? parsedOrder
                            : editingDelCat.sort_order,
                          is_active: editDelCatActive,
                        });
                        setEditingDelCat(null);
                        setDelCatActionSuccess(
                          `Catalogue entry "${updated.name}" updated.`
                        );
                        setTimeout(() => setDelCatActionSuccess(''), 3500);
                      } catch (err: any) {
                        setEditDelCatError(
                          err?.message || 'Failed to update catalogue entry.'
                        );
                      } finally {
                        setIsSubmittingDelCat(false);
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    {editDelCatError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                        {editDelCatError}
                      </div>
                    )}

                    {editDuplicateConflict && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                        Conflicts with existing {editDuplicateConflict.is_active ? 'active' : 'inactive'} entry{' '}
                        <strong>&ldquo;{editDuplicateConflict.name}&rdquo;</strong> ({resolveCatalogueBrandLabel(editDuplicateConflict.applicable_brand)}).
                      </div>
                    )}

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deliverable Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editDelCatName}
                        onChange={e => setEditDelCatName(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Category
                        </label>
                        <select
                          value={editDelCatCategory}
                          onChange={e =>
                            setEditDelCatCategory(
                              e.target.value as DeliverableCatalogueCategory
                            )
                          }
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                        >
                          {DELIVERABLE_CATALOGUE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Brand Scope
                        </label>
                        <select
                          value={editDelCatBrand}
                          onChange={e =>
                            setEditDelCatBrand(e.target.value as DeliverableBrandScope)
                          }
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                        >
                          <option value="all">All Brands</option>
                          <option value="twb">The Wedding Booth Only</option>
                          <option value="golden_june">Golden June Films Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Sort Order
                        </label>
                        <input
                          type="number"
                          value={editDelCatSortOrder}
                          onChange={e => setEditDelCatSortOrder(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDelCatDesc}
                        onChange={e => setEditDelCatDesc(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>

                    <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={editDelCatActive}
                        onChange={e => setEditDelCatActive(e.target.checked)}
                      />
                      <span>Active (visible in Leads, Quotations & Deliverables)</span>
                    </label>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingDelCat(null)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingDelCat}
                        className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg cursor-pointer"
                      >
                        {isSubmittingDelCat ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Shared Catalogue Deletion & Combined In-Use Safeguard Modal */}
            {delCatToDelete && (() => {
              const refs = getCatalogueItemReferences({
                deliverables,
                enquiries,
                itemName: delCatToDelete.name,
              });
              const referencingDeliverables = refs.deliverables;
              const referencingLeads = refs.leads;
              const isInUse = refs.isInUse;

              return (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 my-6">
                    {isInUse ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                                Cannot Permanently Delete Entry in Use
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Referenced by existing{' '}
                                {[
                                  referencingLeads.length > 0 ? 'Leads' : null,
                                  referencingDeliverables.length > 0 ? 'Deliverables' : null,
                                ]
                                  .filter(Boolean)
                                  .join(' & ')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDelCatToDelete(null)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="font-bold text-slate-900">{delCatToDelete.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {delCatToDelete.category} •{' '}
                            {resolveCatalogueBrandLabel(delCatToDelete.applicable_brand)}
                          </div>
                        </div>

                        <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900">&ldquo;{delCatToDelete.name}&rdquo;</strong>{' '}
                            is currently referenced by{' '}
                            <strong className="text-amber-800">
                              {[
                                referencingLeads.length > 0
                                  ? `${referencingLeads.length} existing lead${
                                      referencingLeads.length > 1 ? 's' : ''
                                    }`
                                  : null,
                                referencingDeliverables.length > 0
                                  ? `${referencingDeliverables.length} existing deliverable${
                                      referencingDeliverables.length > 1 ? 's' : ''
                                    }`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' and ')}
                            </strong>
                            :
                          </p>

                          {referencingLeads.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Referencing Leads ({referencingLeads.length})
                              </div>
                              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                                {referencingLeads.slice(0, 5).map(lead => (
                                  <div
                                    key={lead.id}
                                    className="py-1 flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium text-slate-800 truncate">
                                      {lead.title || lead.client_name || 'Untitled Lead'}
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                      {lead.status}
                                    </span>
                                  </div>
                                ))}
                                {referencingLeads.length > 5 && (
                                  <div className="pt-1 text-center text-[10px] text-slate-400 italic">
                                    + {referencingLeads.length - 5} more lead(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {referencingDeliverables.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Referencing Deliverables ({referencingDeliverables.length})
                              </div>
                              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                                {referencingDeliverables.slice(0, 5).map(d => {
                                  const proj = projects.find(p => p.id === d.project_id);
                                  return (
                                    <div
                                      key={d.id}
                                      className="py-1 flex items-center justify-between gap-2"
                                    >
                                      <span className="font-medium text-slate-800 truncate">
                                        {proj?.name || 'Project'}
                                      </span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                        {d.status || 'No Status'}
                                      </span>
                                    </div>
                                  );
                                })}
                                {referencingDeliverables.length > 5 && (
                                  <div className="pt-1 text-center text-[10px] text-slate-400 italic">
                                    + {referencingDeliverables.length - 5} more deliverable(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              Permanent deletion is blocked when any existing Lead or Deliverable references this name. Deactivate it instead to hide it from future selections while preserving all historical Leads, Quotations, and Deliverables.
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setDelCatToDelete(null)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Close
                          </button>
                          {delCatToDelete.is_active ? (
                            <button
                              type="button"
                              disabled={isDeletingDelCat}
                              onClick={async () => {
                                try {
                                  setIsDeletingDelCat(true);
                                  setDelCatActionError(null);
                                  await updateDeliverableCatalogueItem({
                                    ...delCatToDelete,
                                    is_active: false,
                                  });
                                  setDelCatActionSuccess(
                                    `Entry "${delCatToDelete.name}" deactivated. Historical Leads, Quotations, and Deliverables remain intact.`
                                  );
                                  setDelCatToDelete(null);
                                  setTimeout(() => setDelCatActionSuccess(''), 4000);
                                } catch (err: any) {
                                  setDelCatActionError(
                                    err?.message || 'Failed to deactivate catalogue entry.'
                                  );
                                  setDelCatToDelete(null);
                                } finally {
                                  setIsDeletingDelCat(false);
                                }
                              }}
                              className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {isDeletingDelCat
                                ? 'Deactivating...'
                                : 'Deactivate Entry Instead'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Already Deactivated
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                              <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                                Permanently Delete Catalogue Entry?
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Remove from Shared Catalogue
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDelCatToDelete(null)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="font-bold text-slate-900">{delCatToDelete.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {delCatToDelete.category} •{' '}
                            {resolveCatalogueBrandLabel(delCatToDelete.applicable_brand)}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          This entry is <strong>not referenced by any existing Leads or Deliverables</strong>. Deleting it will permanently remove it from Supabase.
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={isDeletingDelCat}
                            onClick={() => setDelCatToDelete(null)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingDelCat}
                            onClick={async () => {
                              try {
                                setIsDeletingDelCat(true);
                                setDelCatActionError(null);
                                const deletedName = delCatToDelete.name;
                                await deleteDeliverableCatalogueItem(
                                  delCatToDelete.id,
                                  deletedName
                                );
                                setDelCatToDelete(null);
                                setDelCatActionSuccess(
                                  `Entry "${deletedName}" was permanently removed from the Shared Catalogue.`
                                );
                                setTimeout(() => setDelCatActionSuccess(''), 4000);
                              } catch (err: any) {
                                setDelCatActionError(
                                  err?.message || 'Failed to delete catalogue entry.'
                                );
                                setDelCatToDelete(null);
                              } finally {
                                setIsDeletingDelCat(false);
                              }
                            }}
                            className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              {isDeletingDelCat ? 'Deleting...' : 'Delete Permanently'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
};
