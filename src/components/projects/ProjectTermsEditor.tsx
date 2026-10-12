import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Circle,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  RotateCcw,
  Edit2,
  Check,
  X,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Project, ProjectTCClause, Company, Client, Deliverable, Payment } from '../../types';
import {
  getProjectClauses,
  getDefaultProjectClauses,
  saveProjectClausesToStorage,
} from '../../utils/termsLibrary';
import { generateOrderFormPDF } from '../../utils/pdfGenerator';

interface ProjectTermsEditorProps {
  project: Project;
  company: Company;
  client?: Client;
  deliverables?: Deliverable[];
  payments?: Payment[];
  onUpdateProject: (updatedProject: Project) => Promise<any>;
}

export const ProjectTermsEditor: React.FC<ProjectTermsEditorProps> = ({
  project,
  company,
  client,
  deliverables,
  payments,
  onUpdateProject,
}) => {
  const clauses: ProjectTCClause[] = getProjectClauses(project.id, project.terms_clauses);

  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const saveClauses = async (newClauses: ProjectTCClause[]) => {
    saveProjectClausesToStorage(project.id, newClauses);
    await onUpdateProject({
      ...project,
      terms_clauses: newClauses,
    });
  };

  const handleToggle = async (id: string) => {
    const updated = clauses.map(c => (c.id === id ? { ...c, enabled: !c.enabled } : c));
    await saveClauses(updated);
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const updated = [...clauses];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    await saveClauses(updated);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= clauses.length - 1) return;
    const updated = [...clauses];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    await saveClauses(updated);
  };

  const handleDelete = async (id: string) => {
    const updated = clauses.filter(c => c.id !== id);
    await saveClauses(updated);
  };

  const startEditing = (clause: ProjectTCClause) => {
    setEditingClauseId(clause.id);
    setEditTitle(clause.title);
    setEditBody(clause.body);
  };

  const handleSaveEdit = async () => {
    if (!editingClauseId || !editTitle.trim()) return;
    const updated = clauses.map(c =>
      c.id === editingClauseId ? { ...c, title: editTitle.trim(), body: editBody.trim() } : c
    );
    await saveClauses(updated);
    setEditingClauseId(null);
  };

  const handleAddClause = async () => {
    if (!newTitle.trim()) return;
    const newClause: ProjectTCClause = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      body: newBody.trim(),
      enabled: true,
    };
    const updated = [...clauses, newClause];
    await saveClauses(updated);
    setNewTitle('');
    setNewBody('');
    setShowAddForm(false);
  };

  const handleResetDefaults = async () => {
    const defaultClauses = getDefaultProjectClauses();
    await saveClauses(defaultClauses);
  };

  const handleDownloadPDF = () => {
    setPdfError(null);
    setIsDownloadingPdf(true);
    try {
      const doc = generateOrderFormPDF(project, client, company, deliverables, payments);
      doc.save();
    } catch (err) {
      console.error('Failed to generate or download Order Form PDF from Terms Editor:', err);
      setPdfError(
        `Failed to generate Order Form PDF: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const activeCount = clauses.filter(c => c.enabled).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Order Form Terms & Conditions</h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {activeCount} of {clauses.length} active
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Selected clauses are rendered on Page 2 of the Production Order Form PDF. You can toggle, reorder, or customize them specifically for this wedding.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1 border border-slate-200 transition-colors"
            title="Reset to default standard clauses"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Clause</span>
          </button>

          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={handleDownloadPDF}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs ${
              isDownloadingPdf
                ? 'bg-slate-700 text-white cursor-wait'
                : 'text-white bg-slate-900 hover:bg-black'
            }`}
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Preview Order PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{pdfError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfError(null)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Custom Clause Form */}
      {showAddForm && (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Add Custom Policy / Clause</span>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Clause Title (e.g., Drone Night Clearance, Specific Venue Rules)"
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            rows={3}
            placeholder="Full text of the term or policy as it should appear on the PDF..."
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddClause}
              disabled={!newTitle.trim()}
              className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
            >
              Save Clause
            </button>
          </div>
        </div>
      )}

      {/* List of Clauses */}
      <div className="space-y-2">
        {clauses.map((clause, idx) => {
          const isEditing = editingClauseId === clause.id;

          return (
            <div
              key={clause.id}
              className={`p-3 rounded-xl border transition-all ${
                clause.enabled
                  ? 'bg-white border-slate-200 shadow-2xs'
                  : 'bg-slate-50/70 border-slate-200/60 opacity-60'
              }`}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full p-2 border border-blue-400 rounded-lg text-xs font-bold text-slate-900"
                  />
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-blue-400 rounded-lg text-xs text-slate-800 leading-relaxed"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingClauseId(null)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(clause.id)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors"
                      title={clause.enabled ? 'Click to exclude from PDF' : 'Click to include in PDF'}
                    >
                      {clause.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          {clause.title}
                        </span>
                        {clause.id.startsWith('custom-') && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Custom
                          </span>
                        )}
                        {!clause.enabled && (
                          <span className="text-[10px] font-medium text-slate-400 italic">
                            (Excluded from PDF)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {clause.body}
                      </p>
                    </div>
                  </div>

                  {/* Controls: Up, Down, Edit, Delete */}
                  <div className="flex items-center gap-1 text-slate-400 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === clauses.length - 1}
                      className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(clause)}
                      className="p-1 hover:text-blue-600 hover:bg-slate-100 rounded"
                      title="Edit clause text"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(clause.id)}
                      className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded"
                      title="Delete clause"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {clauses.length === 0 && (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
            <p>No clauses defined for this project.</p>
            <button
              onClick={handleResetDefaults}
              className="text-blue-600 font-semibold hover:underline"
            >
              Load Studio Default Clauses
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
