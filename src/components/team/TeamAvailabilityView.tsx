import React, { useState } from 'react';
import {
  Users,
  Film,
  Calendar,
  AlertTriangle,
  Plus,
  Mail,
  Phone,
  DollarSign,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TeamMember, Editor, TeamRole } from '../../types';

export const TeamAvailabilityView: React.FC = () => {
  const {
    teamMembers,
    createTeamMember,
    editors,
    createEditor,
    projectTeam,
    projects,
    deliverables,
    checkTeamConflict,
    currentUser,
    canManageTeam,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'crew' | 'editors' | 'conflicts'>('crew');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCrewModal, setShowAddCrewModal] = useState(false);
  const [showAddEditorModal, setShowAddEditorModal] = useState(false);

  // Quick Conflict Checker tool
  const [testMemberId, setTestMemberId] = useState(teamMembers[0]?.id || '');
  const [testDate, setTestDate] = useState('2026-09-20');
  const [conflictResult, setConflictResult] = useState<{
    checked: boolean;
    hasConflict: boolean;
    memberName?: string;
    conflictingProject?: any;
  } | null>(null);

  // New Team Member Form
  const [crewName, setCrewName] = useState('');
  const [crewRoleTitle, setCrewRoleTitle] = useState('Cinematographer');
  const [crewRoleType, setCrewRoleType] = useState<TeamRole>('Team Member');
  const [crewEmail, setCrewEmail] = useState('');
  const [crewPhone, setCrewPhone] = useState('');
  const [crewRate, setCrewRate] = useState(750);
  const [crewGear, setCrewGear] = useState('');
  const [crewNotes, setCrewNotes] = useState('');

  // New Editor Form
  const [edName, setEdName] = useState('');
  const [edSpecialization, setEdSpecialization] = useState('Highlight Films & Color Grading');
  const [edEmail, setEdEmail] = useState('');
  const [edPhone, setEdPhone] = useState('');
  const [edMaxProjects, setEdMaxProjects] = useState(3);
  const [edRatePerProject, setEdRatePerProject] = useState(1200);

  const filteredCrew = teamMembers.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEditors = editors.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.specialization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTestConflict = async () => {
    if (!testMemberId || !testDate) return;
    const res = await checkTeamConflict(testMemberId, testDate);
    setConflictResult({
      checked: true,
      hasConflict: res.hasConflict,
      memberName: res.memberName,
      conflictingProject: res.conflictingProject,
    });
  };

  const handleAddCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewName || !crewEmail) return;

    await createTeamMember({
      name: crewName,
      role: crewRoleType,
      role_title: crewRoleTitle,
      email: crewEmail,
      phone: crewPhone,
      day_rate: crewRate,
      gear_inventory: crewGear.split(',').map(s => s.trim()).filter(Boolean),
      notes: crewNotes,
      status: 'Active',
      blocked_dates: [],
    });

    setShowAddCrewModal(false);
  };

  const handleAddEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edName || !edEmail) return;

    await createEditor({
      name: edName,
      specialization: edSpecialization,
      email: edEmail,
      phone: edPhone,
      max_concurrent_projects: edMaxProjects,
      rate_per_project: edRatePerProject,
      notes: '',
      status: 'Active',
    });

    setShowAddEditorModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Team & Editor Capacity Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Production crew rosters, editor queues, conflict checks, and day rates.
          </p>
        </div>

        {canManageTeam && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCrewModal(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Crew Member</span>
            </button>
            <button
              onClick={() => setShowAddEditorModal(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Film className="w-4 h-4" />
              <span>Add Editor</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('crew')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'crew'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Production Crew ({teamMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('editors')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'editors'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Post-Production Editors ({editors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'conflicts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Double-Booking Conflict Tool</span>
        </button>
      </div>

      {/* Search */}
      {activeTab !== 'conflicts' && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search team members by name, title, specialization..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      )}

      {/* TAB 1: CREW MEMBERS */}
      {activeTab === 'crew' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCrew.map(member => {
            const assignments = projectTeam.filter(pt => pt.team_member_id === member.id);

            return (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{member.name}</h3>
                      <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {member.role_title}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {member.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{member.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 pt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Day Rate: ${(member.day_rate || member.daily_rate || 750).toLocaleString()}/day</span>
                    </div>
                  </div>

                  {/* Gear inventory */}
                  {member.gear_inventory && member.gear_inventory.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Primary Gear:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {member.gear_inventory.map((g, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active assignments count */}
                  <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <span>Assigned to <strong>{assignments.length}</strong> wedding shoot(s)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: POST-PRODUCTION EDITORS */}
      {activeTab === 'editors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEditors.map(editor => {
            const activeDeliverables = deliverables.filter(
              d => d.assigned_editor_id === editor.id && d.status !== 'Delivered'
            );
            const loadPercent = Math.min(
              100,
              Math.round((activeDeliverables.length / editor.max_concurrent_projects) * 100)
            );

            return (
              <div
                key={editor.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{editor.name}</h3>
                      <div className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {editor.specialization}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {editor.status}
                    </span>
                  </div>

                  {/* Capacity Bar */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Editor Capacity</span>
                      <span className="font-bold text-slate-900">
                        {activeDeliverables.length} / {editor.max_concurrent_projects} Active
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          loadPercent >= 100
                            ? 'bg-rose-500'
                            : loadPercent >= 75
                            ? 'bg-[#F1D099]'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {loadPercent >= 100
                        ? 'At capacity limit. Do not assign without review.'
                        : `${editor.max_concurrent_projects - activeDeliverables.length} project slot(s) open`}
                    </div>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{editor.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Project Rate: ${editor.rate_per_project.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: DOUBLE-BOOKING CONFLICT TOOL */}
      {activeTab === 'conflicts' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Interactive Crew Availability & Conflict Checker
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify if a cinematographer or drone operator is already committed to another shoot on any wedding date across TWB and Golden June.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Crew Member</label>
              <select
                value={testMemberId}
                onChange={e => {
                  setTestMemberId(e.target.value);
                  setConflictResult(null);
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              >
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role_title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Proposed Wedding Date</label>
              <input
                type="date"
                value={testDate}
                onChange={e => {
                  setTestDate(e.target.value);
                  setConflictResult(null);
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleTestConflict}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Check Schedule Availability
          </button>

          {/* Results box */}
          {conflictResult && conflictResult.checked && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                conflictResult.hasConflict
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {conflictResult.hasConflict ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span>DOUBLE BOOKING CONFLICT DETECTED</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>CLEAR & AVAILABLE FOR BOOKING</span>
                  </>
                )}
              </div>

              {conflictResult.hasConflict ? (
                <p className="leading-relaxed">
                  <strong>{conflictResult.memberName}</strong> is already booked on <strong>{testDate}</strong> for wedding <em>"{conflictResult.conflictingProject?.name}"</em>. Assigning them here will result in a double-booking violation.
                </p>
              ) : (
                <p className="leading-relaxed">
                  <strong>{conflictResult.memberName}</strong> has no booked projects or blocked calendar slots on <strong>{testDate}</strong>.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Crew Modal */}
      {showAddCrewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Team / Crew Member</h2>
              <button onClick={() => setShowAddCrewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCrew} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={crewName}
                    onChange={e => setCrewName(e.target.value)}
                    placeholder="e.g. Mateo Rossi"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role Title</label>
                  <input
                    type="text"
                    required
                    value={crewRoleTitle}
                    onChange={e => setCrewRoleTitle(e.target.value)}
                    placeholder="e.g. Lead Cinematographer"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={crewEmail}
                    onChange={e => setCrewEmail(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={crewPhone}
                    onChange={e => setCrewPhone(e.target.value)}
                    placeholder="+1 (415) 555-0188"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Day Rate ($)</label>
                  <input
                    type="number"
                    value={crewRate}
                    onChange={e => setCrewRate(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                  <select
                    value={crewRoleType}
                    onChange={e => setCrewRoleType(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Team Member">Team Member (Crew)</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gear Inventory (Comma separated)</label>
                <input
                  type="text"
                  value={crewGear}
                  onChange={e => setCrewGear(e.target.value)}
                  placeholder="Sony FX3, 24-70mm GM II, Ronin RS3 Pro, DJI Mavic 3"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCrewModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  Save Crew Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Editor Modal */}
      {showAddEditorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Post-Production Editor</h2>
              <button onClick={() => setShowAddEditorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEditor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Editor Name</label>
                  <input
                    type="text"
                    required
                    value={edName}
                    onChange={e => setEdName(e.target.value)}
                    placeholder="e.g. Oliver Vance"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    required
                    value={edSpecialization}
                    onChange={e => setEdSpecialization(e.target.value)}
                    placeholder="Highlight Films & Sound Design"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={edEmail}
                    onChange={e => setEdEmail(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={edPhone}
                    onChange={e => setEdPhone(e.target.value)}
                    placeholder="+1 (415) 555-0133"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Concurrent Projects</label>
                  <input
                    type="number"
                    value={edMaxProjects}
                    onChange={e => setEdMaxProjects(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Rate / Film ($)</label>
                  <input
                    type="number"
                    value={edRatePerProject}
                    onChange={e => setEdRatePerProject(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddEditorModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  Save Editor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
