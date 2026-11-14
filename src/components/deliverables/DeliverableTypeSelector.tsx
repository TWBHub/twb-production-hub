import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import {
  DeliverableBrandScope,
  DeliverableCatalogueCategory,
  DeliverableCatalogueItem,
} from '../../types';
import {
  DELIVERABLE_CATALOGUE_CATEGORIES,
  findEffectiveBrandDuplicate,
  getDeliverableTypeOptions,
  resolveCatalogueBrandLabel,
} from '../../utils/deliverableCatalogueUtils';

export const CUSTOM_DELIVERABLE_OPTION_VALUE = '__custom__';

interface DeliverableTypeSelectorProps {
  mode: 'create' | 'edit';
  label?: string;
  projectBrand: 'twb' | 'golden_june';
  catalogueItems: DeliverableCatalogueItem[];
  catalogueError?: string | null;
  canAddToCatalogue: boolean;
  value: string;
  historicalValue?: string;
  isCustom: boolean;
  onIsCustomChange: (custom: boolean) => void;
  onValueChange: (val: string) => void;
  customName: string;
  onCustomNameChange: (val: string) => void;
  saveToCatalogue: boolean;
  onSaveToCatalogueChange: (save: boolean) => void;
  catalogueCategory: DeliverableCatalogueCategory;
  onCatalogueCategoryChange: (cat: DeliverableCatalogueCategory) => void;
  catalogueBrandScope: DeliverableBrandScope;
  onCatalogueBrandScopeChange: (brand: DeliverableBrandScope) => void;
  catalogueDescription: string;
  onCatalogueDescriptionChange: (desc: string) => void;
  idPrefix?: string;
}

export const DeliverableTypeSelector: React.FC<DeliverableTypeSelectorProps> = ({
  mode,
  label = 'Deliverable Type *',
  projectBrand,
  catalogueItems,
  catalogueError,
  canAddToCatalogue,
  value,
  historicalValue,
  isCustom,
  onIsCustomChange,
  onValueChange,
  customName,
  onCustomNameChange,
  saveToCatalogue,
  onSaveToCatalogueChange,
  catalogueCategory,
  onCatalogueCategoryChange,
  catalogueBrandScope,
  onCatalogueBrandScopeChange,
  catalogueDescription,
  onCatalogueDescriptionChange,
  idPrefix = 'deliverable-type',
}) => {
  const options = getDeliverableTypeOptions({
    items: catalogueItems,
    projectBrand,
    historicalValue,
    catalogueError,
  });

  const hasCatalogueChoices =
    options.brandItems.length > 0 ||
    (mode === 'edit' && options.isHistoricalPreserved && Boolean(options.historicalValue));

  const effectiveCustomMode = isCustom || (mode === 'create' && !hasCatalogueChoices);

  const duplicateConflict =
    effectiveCustomMode && saveToCatalogue && customName.trim()
      ? findEffectiveBrandDuplicate(catalogueItems, customName, catalogueBrandScope)
      : undefined;

  const selectValue = effectiveCustomMode
    ? CUSTOM_DELIVERABLE_OPTION_VALUE
    : value;

  return (
    <div className="space-y-2.5">
      <div>
        <label
          htmlFor={`${idPrefix}-select`}
          className="block font-semibold text-slate-700 mb-1"
        >
          {label}
        </label>

        {catalogueError && (
          <div className="mb-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Shared Deliverables Catalogue unavailable: </span>
              <span>
                You can still enter a project-only custom deliverable below.
              </span>
            </div>
          </div>
        )}

        {!catalogueError && options.brandItems.length === 0 && (
          <div className="mb-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              No active catalogue deliverables configured for{' '}
              <strong>{resolveCatalogueBrandLabel(projectBrand)}</strong>. Enter a
              custom deliverable name below{canAddToCatalogue ? ' or save one to the Shared Catalogue' : ''}.
            </div>
          </div>
        )}

        {hasCatalogueChoices && (
          <select
            id={`${idPrefix}-select`}
            value={selectValue}
            onChange={e => {
              const selected = e.target.value;
              if (selected === CUSTOM_DELIVERABLE_OPTION_VALUE) {
                onIsCustomChange(true);
                onCatalogueBrandScopeChange(projectBrand);
              } else {
                onIsCustomChange(false);
                onSaveToCatalogueChange(false);
                onValueChange(selected);
              }
            }}
            className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs"
          >
            {mode === 'edit' &&
              options.isHistoricalPreserved &&
              options.historicalValue && (
                <option value={options.historicalValue}>
                  {options.historicalValue} ({options.historicalSuffix || 'Historical'})
                </option>
              )}
            {options.brandItems.map(item => (
              <option key={item.id} value={item.name}>
                {item.name}
                {item.applicable_brand !== 'all'
                  ? ` — ${resolveCatalogueBrandLabel(item.applicable_brand)}`
                  : ''}
              </option>
            ))}
            <option value={CUSTOM_DELIVERABLE_OPTION_VALUE}>
              + Custom Deliverable...
            </option>
          </select>
        )}
      </div>

      {effectiveCustomMode && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div>
            <label
              htmlFor={`${idPrefix}-custom-name`}
              className="block font-semibold text-slate-700 mb-1"
            >
              Custom Deliverable Name *
            </label>
            <input
              id={`${idPrefix}-custom-name`}
              type="text"
              required
              value={customName}
              onChange={e => onCustomNameChange(e.target.value)}
              placeholder="e.g. Same Day Edit (3 mins), Raw Footage Archive..."
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs"
            />
          </div>

          <div className="space-y-1.5 pt-0.5">
            <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={`${idPrefix}-custom-scope`}
                checked={!saveToCatalogue}
                onChange={() => onSaveToCatalogueChange(false)}
                className="text-slate-900"
              />
              <span>Use for this project only</span>
            </label>

            {canAddToCatalogue ? (
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name={`${idPrefix}-custom-scope`}
                  checked={saveToCatalogue}
                  onChange={() => {
                    onSaveToCatalogueChange(true);
                    onCatalogueBrandScopeChange(projectBrand);
                  }}
                  className="text-slate-900"
                />
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Add to Shared Deliverables Catalogue</span>
                </span>
              </label>
            ) : (
              <p className="text-[11px] text-slate-500 pl-5">
                Only Admins and Managers can add new entries to the Shared Deliverables Catalogue.
              </p>
            )}
          </div>

          {saveToCatalogue && canAddToCatalogue && (
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor={`${idPrefix}-catalogue-category`}
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id={`${idPrefix}-catalogue-category`}
                    value={catalogueCategory}
                    onChange={e =>
                      onCatalogueCategoryChange(
                        e.target.value as DeliverableCatalogueCategory
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs"
                  >
                    {DELIVERABLE_CATALOGUE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`${idPrefix}-catalogue-brand`}
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Catalogue Brand Scope
                  </label>
                  <select
                    id={`${idPrefix}-catalogue-brand`}
                    value={catalogueBrandScope}
                    onChange={e =>
                      onCatalogueBrandScopeChange(
                        e.target.value as DeliverableBrandScope
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs"
                  >
                    <option value={projectBrand}>
                      {resolveCatalogueBrandLabel(projectBrand)} Only (This Brand)
                    </option>
                    <option value="all">
                      All Brands (TWB & Golden June)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${idPrefix}-catalogue-desc`}
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id={`${idPrefix}-catalogue-desc`}
                  type="text"
                  value={catalogueDescription}
                  onChange={e => onCatalogueDescriptionChange(e.target.value)}
                  placeholder="Optional scope notes for editors & producers..."
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs"
                />
              </div>

              {duplicateConflict && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    {duplicateConflict.is_active ? (
                      <>
                        An active entry named <strong>&ldquo;{duplicateConflict.name}&rdquo;</strong> already exists for{' '}
                        <strong>{resolveCatalogueBrandLabel(duplicateConflict.applicable_brand)}</strong>.
                      </>
                    ) : (
                      <>
                        A deactivated entry named <strong>&ldquo;{duplicateConflict.name}&rdquo;</strong> already exists for{' '}
                        <strong>{resolveCatalogueBrandLabel(duplicateConflict.applicable_brand)}</strong>. Ask an Admin to reactivate it in Settings, or choose a distinct name.
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
