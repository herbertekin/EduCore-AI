
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TimetableManagementProps = {
  schoolId: string;
  schoolName: string;
  onBack?: () => void;
};

type AcademicYear = {
  id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

type Term = {
  id: string;
  academic_year_id: string;
  term_number: number;
  start_date: string;
  end_date: string;
};

type SchoolClass = {
  id: string;
  class_name: string;
  curriculum: string | null;
};

type SchoolStream = {
  id: string;
  class_id: string;
  stream_name: string;
};

type Subject = {
  id: string;
  subject_name: string;
  subject_code: string | null;
};

type Teacher = {
  id: string;
  full_name: string;
  staff_number: string | null;
  auth_user_id: string | null;
  status: string;
};

type TeacherAssignment = {
  id: string;
  class_id: string;
  stream_id: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  teacher_user_id: string | null;
};

type TimetableEntry = {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string;
  teacher_assignment_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  notes: string | null;
};

type AssignmentOption = {
  id: string;
  classId: string;
  className: string;
  streamId: string | null;
  streamName: string;
  subjectId: string | null;
  subjectName: string;
  teacherName: string;
  teacherId: string | null;
};

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const WEEKDAYS = DAYS.filter((day) => day.value <= 5);

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

function formatTime(value: string) {
  return value?.slice(0, 5) || "";
}


function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "Something went wrong. Please try again.";
}

function getFriendlyError(error: unknown) {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("class") && lower.includes("conflict")) {
    return "This class or stream already has a lesson during that time.";
  }

  if (lower.includes("teacher") && lower.includes("conflict")) {
    return "This teacher is already assigned to another lesson during that time.";
  }

  if (lower.includes("room") && lower.includes("conflict")) {
    return "This room is already occupied during that time.";
  }

  if (lower.includes("overlap")) {
    return message;
  }

  if (lower.includes("timetable")) {
    return message;
  }

  return message;
}

export default function TimetableManagement({
  schoolId,
  schoolName,
  onBack,
}: TimetableManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<SchoolStream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [showSaturday, setShowSaturday] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedDay, setSelectedDay] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:40");
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        yearsResult,
        classesResult,
        subjectsResult,
        teachersResult,
        assignmentsResult,
        streamsResult,
      ] = await Promise.all([
        supabase
          .from("academic_years")
          .select("id,year_name,start_date,end_date,is_active")
          .eq("school_id", schoolId)
          .order("start_date", { ascending: false }),

        supabase
          .from("classes")
          .select("id,class_name,curriculum")
          .eq("school_id", schoolId)
          .order("class_name"),

        supabase
          .from("subjects")
          .select("id,subject_name,subject_code")
          .eq("school_id", schoolId)
          .order("subject_name"),

        supabase
          .from("teachers")
          .select("id,full_name,staff_number,auth_user_id,status")
          .eq("school_id", schoolId)
          .eq("status", "active")
          .order("full_name"),

        supabase
          .from("teacher_class_assignments")
          .select(
            "id,class_id,stream_id,subject_id,teacher_id,teacher_user_id"
          )
          .eq("school_id", schoolId),

        supabase
          .from("streams")
          .select("id,class_id,stream_name")
          .order("stream_name"),
      ]);

      if (yearsResult.error) throw yearsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      if (teachersResult.error) throw teachersResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (streamsResult.error) throw streamsResult.error;

      const years = (yearsResult.data ?? []) as AcademicYear[];
      const loadedClasses = (classesResult.data ?? []) as SchoolClass[];
      const loadedSubjects = (subjectsResult.data ?? []) as Subject[];
      const loadedTeachers = (teachersResult.data ?? []) as Teacher[];
      const loadedAssignments =
        (assignmentsResult.data ?? []) as TeacherAssignment[];

      const classIds = loadedClasses.map((item) => item.id);

      const loadedStreams = (
        (streamsResult.data ?? []) as SchoolStream[]
      ).filter((stream) => classIds.includes(stream.class_id));

      setAcademicYears(years);
      setClasses(loadedClasses);
      setSubjects(loadedSubjects);
      setTeachers(loadedTeachers);
      setAssignments(loadedAssignments);
      setStreams(loadedStreams);

      const preferredYear =
        years.find((year) => year.is_active) ?? years[0];

      if (preferredYear) {
        setSelectedYearId((current) => current || preferredYear.id);
      } else {
        setSelectedYearId("");
      }
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const loadTermsAndEntries = useCallback(async () => {
    if (!selectedYearId || !schoolId) {
      setTerms([]);
      setEntries([]);
      setSelectedTermId("");
      return;
    }

    try {
      const termsResult = await supabase
        .from("terms")
        .select("id,academic_year_id,term_number,start_date,end_date")
        .eq("academic_year_id", selectedYearId)
        .order("term_number");

      if (termsResult.error) throw termsResult.error;

      const loadedTerms = (termsResult.data ?? []) as Term[];
      setTerms(loadedTerms);

      const preferredTerm = loadedTerms[0];

      setSelectedTermId((current) =>
        loadedTerms.some((term) => term.id === current)
          ? current
          : preferredTerm?.id ?? ""
      );

      if (!preferredTerm && loadedTerms.length === 0) {
        setEntries([]);
      }
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }, [schoolId, selectedYearId]);

  const loadEntries = useCallback(async () => {
    if (!schoolId || !selectedYearId || !selectedTermId) {
      setEntries([]);
      return;
    }

    const result = await supabase
      .from("timetable_entries")
      .select(
        "id,school_id,academic_year_id,term_id,teacher_assignment_id,day_of_week,start_time,end_time,room,notes"
      )
      .eq("school_id", schoolId)
      .eq("academic_year_id", selectedYearId)
      .eq("term_id", selectedTermId)
      .order("day_of_week")
      .order("start_time");

    if (result.error) {
      setErrorMessage(getFriendlyError(result.error));
      return;
    }

    setEntries((result.data ?? []) as TimetableEntry[]);
  }, [schoolId, selectedYearId, selectedTermId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadTermsAndEntries();
  }, [loadTermsAndEntries]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const assignmentOptions = useMemo<AssignmentOption[]>(() => {
    return assignments.map((assignment) => {
      const schoolClass = classes.find(
        (item) => item.id === assignment.class_id
      );

      const stream = streams.find(
        (item) => item.id === assignment.stream_id
      );

      const subject = subjects.find(
        (item) => item.id === assignment.subject_id
      );

      const teacher =
        teachers.find((item) => item.id === assignment.teacher_id) ??
        teachers.find(
          (item) =>
            item.auth_user_id &&
            item.auth_user_id === assignment.teacher_user_id
        );

      return {
        id: assignment.id,
        classId: assignment.class_id,
        className: schoolClass?.class_name ?? "Unknown class",
        streamId: assignment.stream_id,
        streamName: stream?.stream_name ?? "All streams",
        subjectId: assignment.subject_id,
        subjectName: subject?.subject_name ?? "Class Teacher",
        teacherName: teacher?.full_name ?? "Assigned teacher",
        teacherId: assignment.teacher_id,
      };
    });
  }, [assignments, classes, streams, subjects, teachers]);

  const visibleDays = showSaturday
    ? DAYS.filter((day) => day.value <= 6)
    : WEEKDAYS;

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const assignment = assignmentOptions.find(
        (item) => item.id === entry.teacher_assignment_id
      );

      if (!assignment) return false;

      if (
        selectedClassId &&
        assignment.classId !== selectedClassId
      ) {
        return false;
      }

      if (
        selectedStreamId &&
        assignment.streamId !== selectedStreamId
      ) {
        return false;
      }

      return true;
    });
  }, [
    entries,
    assignmentOptions,
    selectedClassId,
    selectedStreamId,
  ]);

  const selectedAssignment = assignmentOptions.find(
    (item) => item.id === selectedAssignmentId
  );

  const availableStreams = streams.filter(
    (stream) => stream.class_id === selectedClassId
  );

  const selectedYear = academicYears.find(
    (year) => year.id === selectedYearId
  );

  const selectedTerm = terms.find(
    (term) => term.id === selectedTermId
  );

  function resetForm() {
    setEditingId(null);
    setSelectedAssignmentId("");
    setSelectedDay("1");
    setStartTime("08:00");
    setEndTime("08:40");
    setRoom("");
    setNotes("");
    setMessage("");
    setErrorMessage("");
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(entry: TimetableEntry) {
    setEditingId(entry.id);
    setSelectedAssignmentId(entry.teacher_assignment_id);
    setSelectedDay(String(entry.day_of_week));
    setStartTime(formatTime(entry.start_time));
    setEndTime(formatTime(entry.end_time));
    setRoom(entry.room ?? "");
    setNotes(entry.notes ?? "");
    setMessage("");
    setErrorMessage("");
    setShowForm(true);
  }

  function setDuration(minutes: number) {
    const [hours, mins] = startTime.split(":").map(Number);
    const total = hours * 60 + mins + minutes;

    if (total >= 24 * 60) {
      setErrorMessage("The lesson must finish before midnight.");
      return;
    }

    const endHours = Math.floor(total / 60);
    const endMinutes = total % 60;

    setEndTime(
      `${String(endHours).padStart(2, "0")}:${String(
        endMinutes
      ).padStart(2, "0")}`
    );

    setErrorMessage("");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!selectedYearId || !selectedTermId) {
      setErrorMessage("Select an academic year and term first.");
      return;
    }

    if (!selectedAssignmentId) {
      setErrorMessage("Select a teacher assignment.");
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage("End time must be later than start time.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const payload = {
        school_id: schoolId,
        academic_year_id: selectedYearId,
        term_id: selectedTermId,
        teacher_assignment_id: selectedAssignmentId,
        day_of_week: Number(selectedDay),
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        room: room.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const result = await supabase
          .from("timetable_entries")
          .update(payload)
          .eq("id", editingId)
          .eq("school_id", schoolId)
          .select()
          .single();

        if (result.error) throw result.error;

        setMessage("Timetable lesson updated successfully.");
      } else {
        const result = await supabase
          .from("timetable_entries")
          .insert(payload)
          .select()
          .single();

        if (result.error) throw result.error;

        setMessage("Lesson added to the timetable successfully.");
      }

      setShowForm(false);
      resetForm();
      await loadEntries();
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this timetable lesson?"
    );

    if (!confirmed) return;

    setDeletingId(id);
    setErrorMessage("");
    setMessage("");

    try {
      const result = await supabase
        .from("timetable_entries")
        .delete()
        .eq("id", id)
        .eq("school_id", schoolId);

      if (result.error) throw result.error;

      setEntries((current) =>
        current.filter((entry) => entry.id !== id)
      );

      setMessage("Timetable lesson deleted successfully.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setDeletingId(null);
    }
  }

  function getAssignment(id: string) {
    return assignmentOptions.find((item) => item.id === id);
  }

  const sortedAssignments = [...assignmentOptions].sort((a, b) =>
    `${a.className} ${a.streamName} ${a.subjectName}`.localeCompare(
      `${b.className} ${b.streamName} ${b.subjectName}`
    )
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Dashboard
                </button>
              )}
              {onBack && <span>/</span>}
              <span>Academic Management</span>
              <span>/</span>
              <span className="text-slate-700">Timetable</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Timetable Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {schoolName} · Organise lessons, teachers and classrooms.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewForm}
            disabled={!selectedTermId || assignmentOptions.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add lesson
          </button>
        </header>

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <section className={`${cardClass} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              Timetable filters
            </h2>
            <span className="text-xs text-slate-400">
              Academic calendar
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Academic year
              </span>
              <select
                className={inputClass}
                value={selectedYearId}
                onChange={(event) => {
                  setSelectedYearId(event.target.value);
                  setSelectedTermId("");
                  setEntries([]);
                }}
              >
                <option value="">Select academic year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year_name}
                    {year.is_active ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Term
              </span>
              <select
                className={inputClass}
                value={selectedTermId}
                onChange={(event) => setSelectedTermId(event.target.value)}
                disabled={!terms.length}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    Term {term.term_number}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Class
              </span>
              <select
                className={inputClass}
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setSelectedStreamId("");
                }}
              >
                <option value="">All classes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.class_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Stream
              </span>
              <select
                className={inputClass}
                value={selectedStreamId}
                onChange={(event) =>
                  setSelectedStreamId(event.target.value)
                }
                disabled={!selectedClassId}
              >
                <option value="">All streams</option>
                {availableStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.stream_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showSaturday}
                onChange={(event) =>
                  setShowSaturday(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              Include Saturday
            </label>

            <button
              type="button"
              onClick={() => {
                setSelectedClassId("");
                setSelectedStreamId("");
                setShowSaturday(false);
              }}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              Reset class and stream filters
            </button>
          </div>
        </section>

        {showForm && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingId ? "Edit timetable lesson" : "Create timetable lesson"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select an existing teacher assignment.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Teacher assignment
                  </span>
                  <select
                    className={inputClass}
                    value={selectedAssignmentId}
                    onChange={(event) =>
                      setSelectedAssignmentId(event.target.value)
                    }
                    required
                  >
                    <option value="">Choose class, subject and teacher</option>
                    {sortedAssignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.className} · {assignment.streamName} ·{" "}
                        {assignment.subjectName} · {assignment.teacherName}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedAssignment && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Selected assignment
                    </p>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-slate-500">Class:</span>{" "}
                        <strong>{selectedAssignment.className}</strong>
                      </p>
                      <p>
                        <span className="text-slate-500">Stream:</span>{" "}
                        <strong>{selectedAssignment.streamName}</strong>
                      </p>
                      <p>
                        <span className="text-slate-500">Subject:</span>{" "}
                        <strong>{selectedAssignment.subjectName}</strong>
                      </p>
                      <p>
                        <span className="text-slate-500">Teacher:</span>{" "}
                        <strong>{selectedAssignment.teacherName}</strong>
                      </p>
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Day
                  </span>
                  <select
                    className={inputClass}
                    value={selectedDay}
                    onChange={(event) => setSelectedDay(event.target.value)}
                  >
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Classroom / Venue
                  </span>
                  <input
                    className={inputClass}
                    value={room}
                    onChange={(event) => setRoom(event.target.value)}
                    placeholder="e.g. Room 4, Science Lab"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Start time
                  </span>
                  <input
                    type="time"
                    className={inputClass}
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    End time
                  </span>
                  <input
                    type="time"
                    className={inputClass}
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    required
                  />
                </label>

                <div className="md:col-span-2">
                  <span className="mb-2 block text-xs font-semibold text-slate-600">
                    Lesson duration presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "30 minutes · Early years", value: 30 },
                      { label: "40 minutes · Standard", value: 40 },
                      { label: "80 minutes · Double lesson", value: 80 },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setDuration(preset.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    You can also enter a custom start and end time.
                  </p>
                </div>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Notes (optional)
                  </span>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Additional lesson information..."
                  />
                </label>
              </div>

              {errorMessage && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Add to timetable"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Weekly timetable
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {selectedYear?.year_name ?? "No academic year selected"}
                {selectedTerm
                  ? ` · Term ${selectedTerm.term_number}`
                  : ""}
              </p>
            </div>

            <div className="text-sm text-slate-500">
              {filteredEntries.length} scheduled lesson
              {filteredEntries.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading timetable data...
            </div>
          ) : !selectedYearId ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">
                No academic year found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Create an academic year before setting up a timetable.
              </p>
            </div>
          ) : !terms.length ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">
                No terms available
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add terms to the selected academic year first.
              </p>
            </div>
          ) : !assignmentOptions.length ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">
                No teacher assignments found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Assign teachers to classes and subjects before scheduling lessons.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[850px]"
                style={{
                  gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))`,
                }}
              >
                {visibleDays.map((day) => {
                  const dayEntries = filteredEntries
                    .filter((entry) => entry.day_of_week === day.value)
                    .sort((a, b) =>
                      a.start_time.localeCompare(b.start_time)
                    );

                  return (
                    <div
                      key={day.value}
                      className="min-h-[320px] border-r border-slate-100 last:border-r-0"
                    >
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {day.label}
                      </div>

                      <div className="space-y-3 p-2">
                        {dayEntries.length === 0 ? (
                          <p className="py-8 text-center text-xs text-slate-400">
                            No lessons
                          </p>
                        ) : (
                          dayEntries.map((entry) => {
                            const assignment = getAssignment(
                              entry.teacher_assignment_id
                            );

                            return (
                              <article
                                key={entry.id}
                                className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3"
                              >
                                <div className="text-xs font-bold text-emerald-800">
                                  {formatTime(entry.start_time)} –{" "}
                                  {formatTime(entry.end_time)}
                                </div>

                                <h3 className="mt-2 text-sm font-bold text-slate-800">
                                  {assignment?.subjectName ?? "Lesson"}
                                </h3>

                                <p className="mt-1 text-xs text-slate-600">
                                  {assignment?.className ?? "Class"}
                                  {assignment?.streamName
                                    ? ` · ${assignment.streamName}`
                                    : ""}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {assignment?.teacherName ?? "Teacher"}
                                </p>

                                {entry.room && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Room: {entry.room}
                                  </p>
                                )}

                                {entry.notes && (
                                  <p className="mt-2 border-t border-emerald-100 pt-2 text-xs text-slate-500">
                                    {entry.notes}
                                  </p>
                                )}

                                <div className="mt-3 flex gap-2 border-t border-emerald-100 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(entry)}
                                    className="text-xs font-semibold text-emerald-800 hover:underline"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(entry.id)}
                                    disabled={deletingId === entry.id}
                                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                                  >
                                    {deletingId === entry.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </article>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium text-slate-500">
              Scheduled lessons
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {filteredEntries.length}
            </p>
          </div>

          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium text-slate-500">
              Teacher assignments
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {assignmentOptions.length}
            </p>
          </div>

          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium text-slate-500">
              Timetabled days
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {
                new Set(
                  filteredEntries.map((entry) => entry.day_of_week)
                ).size
              }
            </p>
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          Timetable changes are saved to your school's database. Break and
          lunch periods can be planned separately.
        </p>
      </div>
    </div>
  );
}
