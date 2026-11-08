import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TeacherDashboardProps = {
  schoolId: string;
  schoolName: string;
  onLogout: () => void;
};

type ClassInfo = {
  class_name: string;
  class_level: number | null;
  curriculum: string | null;
};

type SubjectInfo = {
  subject_name: string;
  subject_code: string | null;
};

type StudentInfo = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  admission_number: string;
};

type Assignment = {
  id: string;
  class_id: string;
  stream_id: string | null;
  subject_id: string | null;
  assigned_at: string;
  stream_name?: string | null;
  classes: ClassInfo | null;
  subjects: SubjectInfo | null;
};

type Enrolment = {
  student_id: string;
  class_id: string;
  stream_id: string | null;
  exit_date: string | null;
};

type StudentRow = {
  student: StudentInfo;
  streamName: string;
};

type StudentGroup = {
  key: string;
  className: string;
  students: StudentRow[];
};

function getStudentName(student: StudentInfo) {
  const name = [student.first_name, student.middle_name, student.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  return name || `Student ${student.id.slice(0, 8)}`;
}

/**
 * EduCoreAI assignment matching rule:
 * - A class-teacher assignment (subject_id NULL) with stream_id NULL covers
 *   every stream in that class.
 * - Any assignment with a specific stream_id covers only that stream.
 * - A subject-teacher assignment with stream_id NULL does not expand to the
 *   whole class.
 */
function matchesAssignment(assignment: Assignment, enrolment: Enrolment) {
  if (assignment.class_id !== enrolment.class_id) return false;

  if (assignment.subject_id === null && assignment.stream_id === null) {
    return true;
  }

  return (
    assignment.stream_id !== null &&
    assignment.stream_id === enrolment.stream_id
  );
}

export default function TeacherDashboard({
  schoolId,
  schoolName,
  onLogout,
}: TeacherDashboardProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [academicYearName, setAcademicYearName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        // 1. Identify the authenticated teacher.
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData.user;
        if (!user) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        // 2. Load the teacher's profile.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        // 3. Resolve this school's active academic year. maybeSingle() also
        // surfaces an error if multiple active rows exist, which should be
        // corrected in the database rather than silently choosing one.
        const { data: academicYear, error: academicYearError } = await supabase
          .from("academic_years")
          .select("id, year_name, start_date, end_date")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .maybeSingle();

        if (academicYearError) throw academicYearError;
        if (!academicYear) {
          throw new Error(
            "No active academic year is configured for this school. Please contact the school administrator."
          );
        }

        // 4. Load assignments, including the actual subject_id column.
        const { data: assignmentData, error: assignmentError } =
          await supabase
            .from("teacher_class_assignments")
            .select(
              `
                id,
                class_id,
                stream_id,
                subject_id,
                assigned_at,
                classes (
                  class_name,
                  class_level,
                  curriculum
                ),
                subjects (
                  subject_name,
                  subject_code
                )
              `
            )
            .eq("school_id", schoolId)
            .eq("teacher_user_id", user.id)
            .order("assigned_at", { ascending: false });

        if (assignmentError) throw assignmentError;

        const loadedAssignments = (assignmentData ?? []) as unknown as Assignment[];

        if (loadedAssignments.length === 0) {
          if (active) {
            setTeacherName(profile?.full_name || "Teacher");
            setAcademicYearName(academicYear.year_name);
            setAssignments([]);
            setStudentGroups([]);
            setLastUpdated(new Date());
          }
          return;
        }

        // 5. Restrict enrolments to assigned classes AND the active academic year.
        const classIds = [
          ...new Set(loadedAssignments.map((assignment) => assignment.class_id)),
        ];

        const { data: enrolmentData, error: enrolmentError } = await supabase
          .from("student_enrollments")
          .select("student_id, class_id, stream_id, exit_date")
          .eq("school_id", schoolId)
          .eq("academic_year_id", academicYear.id)
          .is("exit_date", null)
          .in("class_id", classIds);

        if (enrolmentError) throw enrolmentError;

        const enrolments = (enrolmentData ?? []) as Enrolment[];

        // 6. Apply the class-teacher / subject-teacher stream rules.
        const matchingEnrolments = enrolments.filter((enrolment) =>
          loadedAssignments.some((assignment) =>
            matchesAssignment(assignment, enrolment)
          )
        );

        const studentIds = [
          ...new Set(matchingEnrolments.map((enrolment) => enrolment.student_id)),
        ];

        // 7. Fetch only the student columns used by this dashboard.
        let students: StudentInfo[] = [];
        if (studentIds.length > 0) {
          const { data: studentData, error: studentError } = await supabase
            .from("students")
            .select(
              "id, first_name, middle_name, last_name, admission_number"
            )
            .eq("school_id", schoolId)
            .in("id", studentIds);

          if (studentError) throw studentError;
          students = (studentData ?? []) as StudentInfo[];
        }

        const studentsById = new Map(
          students.map((student) => [student.id, student])
        );

        // 8. Fetch stream names used by matching enrolments and assignments.
        const streamIds = [
          ...new Set(
            [
              ...loadedAssignments.map((assignment) => assignment.stream_id),
              ...matchingEnrolments.map((enrolment) => enrolment.stream_id),
            ].filter((id): id is string => Boolean(id))
          ),
        ];

        let streamNames = new Map<string, string>();
        if (streamIds.length > 0) {
          const { data: streamData, error: streamError } = await supabase
            .from("streams")
            .select("id, stream_name")
            .in("id", streamIds);

          if (streamError) throw streamError;
          streamNames = new Map(
            (streamData ?? []).map((stream) => [stream.id, stream.stream_name])
          );
        }

        const completedAssignments = loadedAssignments.map((assignment) => ({
          ...assignment,
          stream_name: assignment.stream_id
            ? streamNames.get(assignment.stream_id) ?? "Unknown stream"
            : null,
        }));

        // 9. Group by class, not by assignment. This prevents a student from
        // appearing more than once in the same class when roles overlap.
        const groupsByClass = new Map<string, StudentGroup>();

        for (const enrolment of matchingEnrolments) {
          const student = studentsById.get(enrolment.student_id);
          if (!student) continue;

          const assignmentForClass = loadedAssignments.find(
            (assignment) => assignment.class_id === enrolment.class_id
          );
          const className =
            assignmentForClass?.classes?.class_name ?? "Unknown class";

          if (!groupsByClass.has(enrolment.class_id)) {
            groupsByClass.set(enrolment.class_id, {
              key: enrolment.class_id,
              className,
              students: [],
            });
          }

          const group = groupsByClass.get(enrolment.class_id)!;
          const alreadyAdded = group.students.some(
            (row) => row.student.id === student.id
          );

          if (!alreadyAdded) {
            group.students.push({
              student,
              streamName: enrolment.stream_id
                ? streamNames.get(enrolment.stream_id) ?? "Unknown stream"
                : "No stream assigned",
            });
          }
        }

        const completedGroups = Array.from(groupsByClass.values()).sort((a, b) =>
          a.className.localeCompare(b.className)
        );

        completedGroups.forEach((group) => {
          group.students.sort((a, b) =>
            getStudentName(a.student).localeCompare(getStudentName(b.student))
          );
        });

        if (active) {
          setTeacherName(profile?.full_name || "Teacher");
          setAcademicYearName(academicYear.year_name);
          setAssignments(completedAssignments);
          setStudentGroups(completedGroups);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error("Teacher dashboard error:", err);
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your dashboard. Please try again."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [schoolId, refreshKey]);

  const classTeacherAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.subject_id === null),
    [assignments]
  );

  const subjectTeacherAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.subject_id !== null),
    [assignments]
  );

  const assignedSubjects = useMemo(
    () =>
      new Set(
        subjectTeacherAssignments
          .map((assignment) => assignment.subject_id)
          .filter((id): id is string => Boolean(id))
      ).size,
    [subjectTeacherAssignments]
  );

  const totalStudents = useMemo(
    () =>
      new Set(
        studentGroups.flatMap((group) =>
          group.students.map((row) => row.student.id)
        )
      ).size,
    [studentGroups]
  );

  function refreshDashboard() {
    if (!loading) setRefreshKey((current) => current + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">EduCoreAI</h1>
            <p className="text-sm text-slate-500">{schoolName}</p>
            {academicYearName && (
              <p className="mt-1 text-xs font-medium text-slate-500">
                Academic year: {academicYearName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className={loading ? "animate-spin" : ""}>
                ↻
              </span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Teacher Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Welcome, {teacherName}
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Manage your teaching responsibilities and assigned students.
            </p>
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={loading}
              className="font-semibold underline underline-offset-2 disabled:opacity-60"
            >
              Try again
            </button>
          </div>
        )}

        <section
          aria-label="Dashboard statistics"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {[
            { label: "Teaching assignments", value: assignments.length },
            { label: "Assigned subjects", value: assignedSubjects },
            { label: "My students", value: totalStudents },
            { label: "Class teacher roles", value: classTeacherAssignments.length },
            { label: "Subject teacher roles", value: subjectTeacherAssignments.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              My Teaching Assignments
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Your assigned classes, streams and responsibilities.
            </p>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading assignments...</p>
          ) : assignments.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              No teaching assignments found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Class</th>
                    <th className="px-5 py-3 font-medium">Stream</th>
                    <th className="px-5 py-3 font-medium">Responsibility</th>
                    <th className="px-5 py-3 font-medium">Subject</th>
                    <th className="px-5 py-3 font-medium">Curriculum</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const isClassTeacher = assignment.subject_id === null;
                    return (
                      <tr key={assignment.id} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-medium text-slate-800">
                          {assignment.classes?.class_name ?? "Unknown class"}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {assignment.stream_id
                            ? assignment.stream_name ?? "Unknown stream"
                            : isClassTeacher
                              ? "All streams"
                              : "Not assigned"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                              isClassTeacher
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {isClassTeacher ? "Class Teacher" : "Subject Teacher"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {assignment.subjects?.subject_name ??
                            (isClassTeacher ? "Class management" : "Subject unavailable")}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {assignment.classes?.curriculum ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                My Class Responsibilities
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Classes and streams where you are the class teacher.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {loading ? (
                <p className="text-sm text-slate-500">Loading class responsibilities...</p>
              ) : classTeacherAssignments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  You do not currently have any class teacher responsibilities.
                </p>
              ) : (
                classTeacherAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        {assignment.classes?.class_name ?? "Unknown class"}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {assignment.stream_id
                          ? `${assignment.stream_name ?? "Unknown stream"} responsibility`
                          : "Responsible for all streams"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      Class Teacher
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                My Subject Teaching Responsibilities
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Subjects you are responsible for teaching.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {loading ? (
                <p className="text-sm text-slate-500">Loading subject responsibilities...</p>
              ) : subjectTeacherAssignments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  You do not currently have any subject teaching responsibilities.
                </p>
              ) : (
                subjectTeacherAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        {assignment.subjects?.subject_name ?? "Subject unavailable"}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {assignment.classes?.class_name ?? "Unknown class"} —{" "}
                        {assignment.stream_id
                          ? assignment.stream_name ?? "Unknown stream"
                          : "Stream not assigned"}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      Subject Teacher
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-900">My Students</h3>
            <p className="mt-1 text-sm text-slate-500">
              Students in your assigned classes and streams. Students are listed once per class.
            </p>
          </div>
          <div className="space-y-8 p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading students...</p>
            ) : studentGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active students found in your assigned classes.
              </p>
            ) : (
              studentGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-800">{group.className}</h4>
                      <p className="text-sm text-slate-500">
                        All streams covered by your teaching assignments
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {group.students.length} students
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium">Admission number</th>
                          <th className="px-4 py-3 font-medium">Stream</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map(({ student, streamName }) => (
                          <tr key={student.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {getStudentName(student)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {student.admission_number || "Not provided"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{streamName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
