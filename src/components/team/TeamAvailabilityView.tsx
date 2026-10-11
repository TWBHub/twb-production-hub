import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CalendarDays,
  X,
  Users,
  BriefcaseBusiness,
  MapPin,
  AlertTriangle,
  Calendar,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TeamMember } from '../../types';
import { sortProjectEvents } from '../../utils/eventUtils';

const formatDateKey = (date: Date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatMonthTitle = (date: Date) => {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    return new Date(year, month, index + 1);
  });
};

const isTodayDate = (date: Date) => {
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const dateIsBetween = (
  dateKey: string,
  startDate?: string,
  endDate?: string
) => {
  if (!startDate) return false;

  const start = startDate.slice(0, 10);
  const end = (endDate || startDate).slice(0, 10);

  return dateKey >= start && dateKey <= end;
};

export const TeamAvailabilityView: React.FC = () => {
  const {
  projects,
  projectTeam,
  teamMembers,
  createTeamMember,
  assignTeamMember,
  updateTeamAssignment,
    removeTeamAssignment,
    checkTeamConflict,
    canManageTeam,
    currentUser,
  } = useApp();

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState<{
    projectId: string;
    date: string;
  } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

const [showAssignModal, setShowAssignModal] = useState(false);
const [assignMemberId, setAssignMemberId] = useState('');
const [assignRole, setAssignRole] = useState('');
const [assignNotes, setAssignNotes] = useState('');
const [assignConflictWarning, setAssignConflictWarning] = useState<string | null>(null);
const [assignIsDuplicate, setAssignIsDuplicate] = useState(false);
const [savingAssignment, setSavingAssignment] = useState(false);

  // Edit Assignment Modal state
  const [editingAssignment, setEditingAssignment] = useState<{
    assignmentId: string;
    projectId: string;
    memberId: string;
    role: string;
    assignmentDate: string;
    notes: string;
  } | null>(null);
  const [editCustomDate, setEditCustomDate] = useState(false);
  const [editConflictWarning, setEditConflictWarning] = useState<string | null>(null);
  const [savingEditAssignment, setSavingEditAssignment] = useState(false);

  // Add Team Member form
 const [name, setName] = useState('');
const [roleTitle, setRoleTitle] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
const [dayRate, setDayRate] = useState(0);
const [gear, setGear] = useState('');
const [notes, setNotes] = useState('');
const [savingMember, setSavingMember] = useState(false);

  const monthDays = useMemo(
    () => getDaysInMonth(currentMonth),
    [currentMonth]
  );

  /*
   * Only show projects that are relevant to this month.
   *
   * A project is included if:
   * 1. Its wedding/project date range overlaps the month, OR
   * 2. It has a team assignment during the month.
   */
  const monthProjects = useMemo(() => {
    const monthStart = formatDateKey(monthDays[0]);
    const monthEnd = formatDateKey(monthDays[monthDays.length - 1]);

    const relevant = projects.filter(project => {
      const hasEventThisMonth =
        project.events && project.events.length > 0
          ? project.events.some(e => {
              const ed = (e.event_date || '').slice(0, 10);
              return ed >= monthStart && ed <= monthEnd;
            })
          : (() => {
              const projectStart = project.wedding_date_start?.slice(0, 10);
              const projectEnd = (
                project.wedding_date_end ||
                project.wedding_date_start
              )?.slice(0, 10);
              return (
                !!projectStart &&
                !!projectEnd &&
                projectStart <= monthEnd &&
                projectEnd >= monthStart
              );
            })();

      const hasAssignmentThisMonth = projectTeam.some(assignment => {
        if (assignment.project_id !== project.id) return false;

        const assignmentDate = assignment.assignment_date?.slice(0, 10);

        return (
          !!assignmentDate &&
          assignmentDate >= monthStart &&
          assignmentDate <= monthEnd
        );
      });

      return hasEventThisMonth || hasAssignmentThisMonth;
    });

    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return relevant;
    }

    return relevant.filter(project => {
      const nameMatch = project.name?.toLowerCase().includes(query);
      const venueMatch = project.venue?.toLowerCase().includes(query);
      const cityMatch = project.city?.toLowerCase().includes(query);

      const assignmentMatch = projectTeam.some(assignment => {
        if (assignment.project_id !== project.id) return false;

        const member = teamMembers.find(
          m => m.id === assignment.team_member_id
        );

        return (
          member?.name?.toLowerCase().includes(query) ||
          assignment.role?.toLowerCase().includes(query)
        );
      });

      return nameMatch || venueMatch || cityMatch || assignmentMatch;
    });
  }, [
    projects,
    projectTeam,
    teamMembers,
    monthDays,
    searchQuery,
  ]);

  const getAssignmentsForProjectDate = (
    projectId: string,
    date: string
  ) => {
    return projectTeam
      .filter(
        assignment =>
          assignment.project_id === projectId &&
          assignment.assignment_date?.slice(0, 10) === date
      )
      .map(assignment => {
        const member = teamMembers.find(
          m => m.id === assignment.team_member_id
        );

        return {
          assignmentId: assignment.id,
          memberId: assignment.team_member_id,
          memberName: member?.name || 'Unknown Team Member',
          role: assignment.role || 'Team Member',
          note: assignment.notes || '',
        };
      });
  };

  const getProjectAssignmentDates = (projectId: string) => {
    return projectTeam
      .filter(assignment => assignment.project_id === projectId)
      .map(assignment => assignment.assignment_date?.slice(0, 10))
      .filter(Boolean);
  };

  const goPreviousMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    );
    setSelectedCell(null);
  };

  const goNextMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      )
    );
    setSelectedCell(null);
  };

  const goToday = () => {
    setCurrentMonth(new Date());
    setSelectedCell(null);
  };

const handleAddMember = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!name.trim()) {
    return;
  }

  try {
    setSavingMember(true);

    await createTeamMember({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });

    setName('');
    setEmail('');
    setPhone('');
    setShowAddModal(false);
  } finally {
    setSavingMember(false);
  }
};

 const handleOpenAssignModal = () => {
   if (!selectedCell) return;
 
   setAssignMemberId('');
   setAssignRole('');
   setAssignNotes('');
   setAssignConflictWarning(null);
   setAssignIsDuplicate(false);
   setShowAssignModal(true);
 };

const handleSaveNewAssignment = async (override: boolean = false) => {
  if (!selectedCell || !assignMemberId || !assignRole.trim()) return;

  const { projectId, date } = selectedCell;

try {
  setSavingAssignment(true);

  const existingAssignment = projectTeam.find(
    assignment =>
      assignment.project_id === projectId &&
      assignment.team_member_id === assignMemberId &&
      assignment.assignment_date === date
  );

  if (existingAssignment) {
  const member = teamMembers.find(m => m.id === assignMemberId);

  setAssignIsDuplicate(true);
  setAssignConflictWarning(
    `${member?.name || 'This team member'} is already assigned to this wedding on ${date}.`
  );
  return;
}

  const conflict = await checkTeamConflict(
    assignMemberId,
    date,
    projectId
  );

    if (conflict.hasConflict && !override) {
      setAssignConflictWarning(
        `CONFLICT WARNING: ${conflict.memberName || 'This team member'} is already assigned to project "${conflict.conflictingProject?.name || 'Another Project'}" on ${date}. This would create an overlapping assignment. If this is intentional, use Admin Override & Assign.`
      );
      return;
    }

    const result = await assignTeamMember(
      {
        project_id: projectId,
        team_member_id: assignMemberId,
        role: assignRole.trim(),
        assignment_date: date,
        notes: assignNotes.trim() || undefined,
      },
      override
    );

    if (!result.success) {
      setAssignConflictWarning(
        result.conflictError || 'Could not save this team assignment.'
      );
      return;
    }

    setShowAssignModal(false);
    setAssignMemberId('');
    setAssignRole('');
    setAssignNotes('');
    setAssignConflictWarning(null);
    setAssignIsDuplicate(false);
  } catch (error) {
    console.error('Failed to assign team member:', error);
    setAssignConflictWarning('Could not save this team assignment.');
  } finally {
    setSavingAssignment(false);
  }
};

  const handleStartEditAssignment = (
    assignment: {
      assignmentId: string;
      memberId: string;
      role: string;
      note: string;
    },
    projectId: string,
    date: string
  ) => {
    setEditingAssignment({
      assignmentId: assignment.assignmentId,
      projectId,
      memberId: assignment.memberId,
      role: assignment.role,
      assignmentDate: date,
      notes: assignment.note,
    });
    setEditCustomDate(false);
    setEditConflictWarning(null);
  };

  const handleSaveEditAssignment = async (override: boolean = false) => {
    if (
      !editingAssignment ||
      !editingAssignment.memberId ||
      !editingAssignment.assignmentDate ||
      !editingAssignment.role.trim()
    ) {
      return;
    }

    try {
      setSavingEditAssignment(true);

      if (!override) {
        const conflict = await checkTeamConflict(
          editingAssignment.memberId,
          editingAssignment.assignmentDate,
          editingAssignment.projectId,
          editingAssignment.assignmentId
        );

        if (conflict.hasConflict) {
          const conflictingName =
            conflict.conflictingProject?.name || 'Another Project';
          setEditConflictWarning(
            `CONFLICT WARNING: ${conflict.memberName} is already booked on ${editingAssignment.assignmentDate} for project "${conflictingName}". Updating this assignment will cause a double-booking!`
          );
          setSavingEditAssignment(false);
          return;
        }
      }

      const res = await updateTeamAssignment(editingAssignment.assignmentId, {
        project_id: editingAssignment.projectId,
        team_member_id: editingAssignment.memberId,
        role: editingAssignment.role.trim(),
        assignment_date: editingAssignment.assignmentDate,
        notes: editingAssignment.notes.trim() || undefined,
      });

      if (!res.success) {
        setEditConflictWarning(res.error || 'Could not update the team assignment.');
        setSavingEditAssignment(false);
        return;
      }

      setSelectedCell({
        projectId: editingAssignment.projectId,
        date: editingAssignment.assignmentDate,
      });

      setEditingAssignment(null);
      setEditConflictWarning(null);
    } catch (err: any) {
      setEditConflictWarning(err.message || 'Failed to update assignment');
    } finally {
      setSavingEditAssignment(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeTeamAssignment(assignmentId);
    } catch (err) {
      console.error('Failed to remove team assignment:', err);
    }
  };

  const editingProject = useMemo(() => {
    if (!editingAssignment) return null;
    return projects.find(p => p.id === editingAssignment.projectId) || null;
  }, [editingAssignment?.projectId, projects]);

  const editingProjectEvents = useMemo(() => {
    if (!editingProject?.events || editingProject.events.length === 0) return [];
    const sorted = sortProjectEvents(editingProject.events);
    const map = new Map<string, string[]>();
    sorted.forEach(e => {
      const d = (e.event_date || '').slice(0, 10);
      if (!d) return;
      const names = map.get(d) || [];
      if (e.event_name && !names.includes(e.event_name)) names.push(e.event_name);
      map.set(d, names);
    });
    return Array.from(map.entries()).map(([date, names]) => ({
      date,
      label: `${new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — ${names.join(', ')}`,
    }));
  }, [editingProject]);

  const totalAssignmentsThisMonth = useMemo(() => {
    const monthStart = formatDateKey(monthDays[0]);
    const monthEnd = formatDateKey(monthDays[monthDays.length - 1]);

    return projectTeam.filter(assignment => {
      const date = assignment.assignment_date?.slice(0, 10);

      return (
        date &&
        date >= monthStart &&
        date <= monthEnd
      );
    }).length;
  }, [projectTeam, monthDays]);

  const totalPeopleScheduled = useMemo(() => {
    const monthStart = formatDateKey(monthDays[0]);
    const monthEnd = formatDateKey(monthDays[monthDays.length - 1]);

    const ids = new Set(
      projectTeam
        .filter(assignment => {
          const date = assignment.assignment_date?.slice(0, 10);

          return (
            date &&
            date >= monthStart &&
            date <= monthEnd
          );
        })
        .map(assignment => assignment.team_member_id)
    );

    return ids.size;
  }, [projectTeam, monthDays]);

  return (
    <div className="space-y-5 pb-12">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-slate-700" />

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Wedding Team Schedule
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            See every wedding and the complete crew assigned to each date.
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Team Member
          </button>
        )}

      </div>

      {/* MONTH CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          <div className="flex items-center gap-2">

            <button
              onClick={goPreviousMonth}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="min-w-[180px] text-center">
              <div className="text-base font-bold text-slate-900">
                {formatMonthTitle(currentMonth)}
              </div>
            </div>

            <button
              onClick={goNextMonth}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={goToday}
              className="ml-1 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Today
            </button>

          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search wedding, city or team member..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs focus:outline-none focus:bg-white"
            />
          </div>

        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <BriefcaseBusiness className="w-4 h-4 text-slate-600" />
            Weddings
          </div>

          <div className="text-2xl font-bold text-slate-900 mt-2">
            {monthProjects.length}
          </div>

          <div className="text-[10px] text-slate-400 mt-1">
            Showing this month
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <Users className="w-4 h-4 text-slate-600" />
            People Scheduled
          </div>

          <div className="text-2xl font-bold text-slate-900 mt-2">
            {totalPeopleScheduled}
          </div>

          <div className="text-[10px] text-slate-400 mt-1">
            Unique crew members
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <CalendarDays className="w-4 h-4 text-slate-600" />
            Crew Assignments
          </div>

          <div className="text-2xl font-bold text-slate-900 mt-2">
            {totalAssignmentsThisMonth}
          </div>

          <div className="text-[10px] text-slate-400 mt-1">
            Assignments this month
          </div>
        </div>

      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">

        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Crew assigned
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300" />
          Wedding date
        </div>

        <div className="text-[11px] text-slate-400">
          Click any date cell to see the complete crew.
        </div>

      </div>

      {/* WEDDING SCHEDULE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">

        <div className="overflow-x-auto">

          <div
            className="min-w-max"
            style={{
              display: 'grid',
              gridTemplateColumns: `280px repeat(${monthDays.length}, 150px)`,
            }}
          >

            {/* CORNER */}
            <div className="sticky left-0 z-30 bg-slate-900 text-white border-r border-slate-700 border-b border-slate-700 px-4 py-3">

              <div className="text-xs font-bold">
                Wedding / Project
              </div>

              <div className="text-[10px] text-slate-300 mt-0.5">
                {monthProjects.length} wedding
                {monthProjects.length !== 1 ? 's' : ''}
              </div>

            </div>

            {/* DATE HEADERS */}
            {monthDays.map(day => {

              const weekend =
                day.getDay() === 0 || day.getDay() === 6;

              return (
                <div
                  key={formatDateKey(day)}
                  className={`text-center border-b border-r border-slate-200 py-2 ${
                    weekend
                      ? 'bg-slate-50'
                      : 'bg-white'
                  } ${
                    isTodayDate(day)
                      ? 'bg-blue-50'
                      : ''
                  }`}
                >

                  <div className="text-[9px] uppercase font-semibold text-slate-400">
                    {day.toLocaleDateString('en-IN', {
                      weekday: 'short',
                    })}
                  </div>

                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      isTodayDate(day)
                        ? 'text-blue-700'
                        : 'text-slate-800'
                    }`}
                  >
                    {day.getDate()}
                  </div>

                </div>
              );
            })}

            {/* PROJECT ROWS */}
            {monthProjects.map(project => {

              const assignmentDates =
                getProjectAssignmentDates(project.id);

              return (
                <React.Fragment key={project.id}>

                  {/* PROJECT NAME */}
                  <div className="sticky left-0 z-20 bg-white border-r border-b border-slate-200 px-4 py-3">

                    <div className="font-bold text-xs text-slate-900">
                      {project.name}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">
                        {project.city || project.venue || 'Location not set'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1">
                      {project.wedding_date_start
                        ? new Date(
                            `${project.wedding_date_start.slice(0, 10)}T12:00:00`
                          ).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'Date not set'}
                      {project.wedding_date_end &&
                        project.wedding_date_end !== project.wedding_date_start
                        ? ` – ${new Date(
                            `${project.wedding_date_end.slice(0, 10)}T12:00:00`
                          ).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : ''}
                    </div>

                  </div>

                  {/* DATE CELLS */}
                  {monthDays.map(day => {

                    const dateKey = formatDateKey(day);

                    const assignments =
                      getAssignmentsForProjectDate(
                        project.id,
                        dateKey
                      );

                    const isWeddingDate =
                      project.events && project.events.length > 0
                        ? project.events.some(
                            evt => (evt.event_date || '').slice(0, 10) === dateKey
                          )
                        : (
                            project.wedding_date_start?.slice(0, 10) === dateKey ||
                            project.wedding_date_end?.slice(0, 10) === dateKey
                          );

                    const hasAssignments =
                      assignments.length > 0;

                    const selected =
                      selectedCell?.projectId === project.id &&
                      selectedCell?.date === dateKey;

                    return (
                      <button
                        key={`${project.id}-${dateKey}`}
                        onClick={() => {
                          if (hasAssignments || isWeddingDate) {
                            setSelectedCell({
                              projectId: project.id,
                              date: dateKey,
                            });
                          }
                        }}
                        className={`min-h-[118px] border-r border-b border-slate-200 p-2 text-left transition-colors ${
                          hasAssignments
                            ? 'bg-blue-50/70 hover:bg-blue-100'
                            : isWeddingDate
                            ? 'bg-slate-50 hover:bg-slate-100'
                            : 'bg-white hover:bg-slate-50'
                        } ${
                          isTodayDate(day)
                            ? 'ring-2 ring-inset ring-blue-200'
                            : ''
                        } ${
                          selected
                            ? 'ring-2 ring-inset ring-blue-500'
                            : ''
                        }`}
                      >

     {hasAssignments ? (
  <div className="space-y-1">
    {assignments.map(assignment => (
      <div
        key={assignment.assignmentId}
        className="text-[11px] font-semibold text-slate-800 leading-tight"
      >
        {assignment.memberName}
      </div>
    ))}
  </div>
) : isWeddingDate ? (
                          <div className="h-full flex items-start">
                            <div className="text-[10px] text-slate-400 font-medium">
                              Wedding date
                            </div>
                          </div>
                        ) : null}

                      </button>
                    );
                  })}

                </React.Fragment>
              );
            })}

          </div>

          {monthProjects.length === 0 && (
            <div className="py-16 text-center">

              <BriefcaseBusiness className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <div className="font-semibold text-slate-700 text-sm">
                No weddings found
              </div>

              <div className="text-xs text-slate-400 mt-1">
                No projects or crew assignments are scheduled for this month.
              </div>

            </div>
          )}

        </div>
      </div>

      {/* SELECTED CELL DETAILS */}
      {selectedCell && (
        (() => {
          const project = projects.find(
            p => p.id === selectedCell.projectId
          );

          if (!project) return null;

          const assignments = getAssignmentsForProjectDate(
            project.id,
            selectedCell.date
          );

          const selectedDate = new Date(
            `${selectedCell.date}T12:00:00`
          );

          const matchingEvents = (project.events || []).filter(
            evt => (evt.event_date || '').slice(0, 10) === selectedCell.date
          );

          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                    Crew Schedule
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {project.name}
                  </h3>

                  <div className="text-xs text-slate-500 mt-1">
                    {selectedDate.toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* PROJECT EVENT(S) & EVENT NOTES */}
              {matchingEvents.length > 0 && (
                <div className="mt-3 space-y-2">
                  {matchingEvents.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {evt.event_name}
                        </span>
                        {evt.event_time && (
                          <span className="text-[11px] font-medium text-slate-500">
                            {evt.event_time}
                          </span>
                        )}
                      </div>
                      {evt.event_address && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{evt.event_address}</span>
                        </div>
                      )}
                      {evt.event_notes && evt.event_notes.trim() ? (
                        <div className="mt-2 text-xs bg-amber-50/90 border border-amber-200/90 rounded-md p-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-0.5">
                            Event note:
                          </div>
                          <p className="text-xs text-amber-950 whitespace-pre-line leading-relaxed">
                            {evt.event_notes.trim()}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* CREW ASSIGNMENTS */}
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                  Crew
                </div>

                <div className="flex items-center justify-end mb-3">
  {canManageTeam && (
    <button
      type="button"
      onClick={handleOpenAssignModal}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      Assign Team Member
    </button>
  )}
</div>

{assignments.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No crew has been assigned to this wedding on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assignments.map(assignment => (
                      <div
                        key={assignment.assignmentId}
                        className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {assignment.memberName}
                          </div>

                          <div className="text-[11px] font-semibold text-blue-700 mt-0.5">
                            {assignment.role}
                          </div>

                          {assignment.note && assignment.note.trim() ? (
                            <div className="mt-2 text-xs bg-white/80 border border-blue-200/70 rounded-md p-2 text-slate-700">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                Assignment note:
                              </span>
                              <p className="whitespace-pre-line text-xs">
                                {assignment.note.trim()}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        {canManageTeam && (
                          <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-blue-200/60">
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEditAssignment(
                                  assignment,
                                  project.id,
                                  selectedCell.date
                                )
                              }
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 rounded-md transition-colors"
                            >
                              Edit Assignment
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAssignment(assignment.assignmentId)
                              }
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            >
                              Remove Assignment
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* ASSIGN TEAM MEMBER MODAL */}
{showAssignModal && selectedCell && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Assign Team Member
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign crew to this wedding on{' '}
            {new Date(selectedCell.date + 'T00:00:00').toLocaleDateString(
              'en-IN',
              {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAssignModal(false)}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Team Member
          </label>
          <select
            value={assignMemberId}
            onChange={e => {
              setAssignMemberId(e.target.value);
              setAssignConflictWarning(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Select team member...</option>
            {teamMembers
              .filter(member => member.status !== 'Inactive')
              .map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Role
          </label>
          <input
            type="text"
            value={assignRole}
            onChange={e => setAssignRole(e.target.value)}
            placeholder="e.g. 2nd Cine, Lead Photographer"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Assignment Note
          </label>
          <textarea
            value={assignNotes}
            onChange={e => setAssignNotes(e.target.value)}
            placeholder="Optional note..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
          />
        </div>

{assignConflictWarning && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
    <div className="flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 whitespace-pre-line">
        {assignConflictWarning}
      </p>
    </div>

    {!assignIsDuplicate && (
      <button
        type="button"
        onClick={() => handleSaveNewAssignment(true)}
        disabled={savingAssignment}
        className="mt-3 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
      >
        {savingAssignment ? 'Assigning...' : 'Admin Override & Assign'}
      </button>
    )}
  </div>
)}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowAssignModal(false)}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSaveNewAssignment(false)}
            disabled={
              savingAssignment ||
              !assignMemberId ||
              !assignRole.trim()
            }
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingAssignment ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* EDIT TEAM ASSIGNMENT MODAL */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Crew Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modify crew member, role, date, or notes
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAssignment(null);
                  setEditConflictWarning(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editConflictWarning && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  Double Booking Conflict Detected!
                </div>
                <p className="whitespace-pre-line leading-relaxed">
                  {editConflictWarning}
                </p>
                {canManageTeam && (
                  <button
                    type="button"
                    onClick={() => handleSaveEditAssignment(true)}
                    disabled={savingEditAssignment}
                    className="w-full mt-2 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md text-xs shadow-xs"
                  >
                    Admin Override & Save
                  </button>
                )}
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveEditAssignment(false);
              }}
              className="space-y-4 text-xs"
            >
              {/* Project Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project / Wedding
                </label>
                <select
                  value={editingAssignment.projectId}
                  onChange={e => {
                    const newProjId = e.target.value;
                    const newProj = projects.find(p => p.id === newProjId);
                    const newProjEvents = newProj?.events || [];
                    const newDate =
                      newProjEvents.length > 0 && newProjEvents[0].event_date
                        ? newProjEvents[0].event_date.slice(0, 10)
                        : newProj?.wedding_date_start?.slice(0, 10) ||
                          editingAssignment.assignmentDate;

                    setEditingAssignment(prev =>
                      prev
                        ? {
                            ...prev,
                            projectId: newProjId,
                            assignmentDate: newDate,
                          }
                        : null
                    );
                    setEditConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.company_id === 'golden_june' ? 'Golden June' : 'TWB'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Member Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Team Member
                </label>
                <select
                  required
                  value={editingAssignment.memberId}
                  onChange={e => {
                    const memberId = e.target.value;
                    setEditingAssignment(prev =>
                      prev ? { ...prev, memberId } : null
                    );
                    setEditConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select Team Member</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.primary_role ? `(${m.primary_role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role on Project */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role On Project
                </label>
                <input
                  required
                  type="text"
                  value={editingAssignment.role}
                  onChange={e =>
                    setEditingAssignment(prev =>
                      prev ? { ...prev, role: e.target.value } : null
                    )
                  }
                  placeholder="e.g. Cinematographer, Lead Photographer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'Lead Cinematographer',
                    'Cinematographer',
                    'Lead Photographer',
                    'Photographer',
                    'Drone Pilot',
                    'Sound Specialist',
                    'Assistant',
                  ].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setEditingAssignment(prev =>
                          prev ? { ...prev, role: r } : null
                        )
                      }
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        editingAssignment.role === r
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Date
                </label>
                {editingProjectEvents.length > 0 && !editCustomDate ? (
                  <div className="space-y-1.5">
                    <select
                      value={editingAssignment.assignmentDate}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setEditCustomDate(true);
                        } else {
                          setEditingAssignment(prev =>
                            prev
                              ? { ...prev, assignmentDate: e.target.value }
                              : null
                          );
                          setEditConflictWarning(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      {editingProjectEvents.map(evt => (
                        <option key={evt.date} value={evt.date}>
                          {evt.label}
                        </option>
                      ))}
                      <option value="__custom__">Custom / Other Date...</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      required
                      type="date"
                      value={editingAssignment.assignmentDate}
                      onChange={e => {
                        setEditingAssignment(prev =>
                          prev
                            ? { ...prev, assignmentDate: e.target.value }
                            : null
                        );
                        setEditConflictWarning(null);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    {editingProjectEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditCustomDate(false)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        ← Choose from project event schedule
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Assignment Note */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={editingAssignment.notes}
                  onChange={e =>
                    setEditingAssignment(prev =>
                      prev ? { ...prev, notes: e.target.value } : null
                    )
                  }
                  rows={2}
                  placeholder="e.g. Bring FX3 + 24–70mm, call time 5:30 AM"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>

              {/* Modal actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    if (editingAssignment) {
                      handleRemoveAssignment(editingAssignment.assignmentId);
                      setEditingAssignment(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Remove Assignment
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssignment(null);
                      setEditConflictWarning(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      savingEditAssignment ||
                      !editingAssignment.memberId ||
                      !editingAssignment.role.trim() ||
                      !editingAssignment.assignmentDate
                    }
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs"
                  >
                    {savingEditAssignment ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEAM MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">

          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">

            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">

              <div>

                <h2 className="text-base font-bold text-slate-900">
                  Add Team Member
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Add a permanent crew member to the studio roster.
                </p>

              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>

            </div>

<form
  onSubmit={handleAddMember}
  className="space-y-4"
>
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1">
      Full Name
    </label>

    <input
      required
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="e.g. Swapnil Namdev"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </div>

  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1">
      Email
    </label>

    <input
      type="email"
      value={email}
      onChange={e => setEmail(e.target.value)}
      placeholder="name@example.com"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </div>

  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1">
      Mobile
    </label>

    <input
      value={phone}
      onChange={e => setPhone(e.target.value)}
      placeholder="e.g. 9876543210"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </div>

  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">

    <button
      type="button"
      onClick={() => setShowAddModal(false)}
      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
    >
      Cancel
    </button>

    <button
      type="submit"
      disabled={savingMember}
      className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg"
    >
      {savingMember ? 'Saving...' : 'Save Team Member'}
    </button>

  </div>
</form>

          </div>
        </div>
      )}

    </div>
  );
};