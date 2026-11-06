
import { useEffect, useState } from "react";
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
  [key: string]: unknown;
};

type Assignment = {
  id: string;
  class_id: string;
  stream_id: string | null;
  stream_name: string;
  assigned_at: string;
  classes: ClassInfo | null;
  subjects: SubjectInfo | null;
  students: StudentInfo[];
};

type StudentGroup = {
  key: string;
  className: string;
  streamName: string;
  students: StudentInfo[];
};

function getStudentName(student: StudentInfo) {
  const possibleNames = [
    student.full_name,
    student.student_name,
    student.name,
  ];

  for (const name of possibleNames) {
    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }

  const firstName =
    typeof student.first_name === "string"
      ? student.first_name
      : "";

  const middleName =
    typeof student.middle_name === "string"
      ? student.middle_name
      : "";

  const lastName =
    typeof student.last_name === "string"
      ? student.last_name
      : "";

  const combinedName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(" ");

  return combinedName || `Student ${student.id.slice(0, 8)}`;
}

function getAdmissionNumber(student: StudentInfo) {
  const possibleFields = [
    student.admission_number,
    student.admission_no,
    student.admission_id,
    student.admission,
  ];

  for (const value of possibleFields) {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "Not provided";
}

export default function TeacherDashboard({
  schoolId,
  schoolName,
  onLogout,
}: TeacherDashboardProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        // 1. Get authenticated teacher.
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        // 2. Load teacher profile.
        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (active && profile?.full_name) {
          setTeacherName(profile.full_name);
        }

        // 3. Load teacher assignments.
        const { data: assignmentData, error: assignmentError } =
          await supabase
            .from("teacher_class_assignments")
            .select(`
              id,
              class_id,
              stream_id,
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
            `)
            .eq("school_id", schoolId)
            .eq("teacher_user_id", user.id)
            .order("assigned_at", { ascending: false });

        if (assignmentError) throw assignmentError;

        const rawAssignments = (assignmentData ?? []) as unknown as Omit<
          Assignment,
          "stream_name" | "students"
        >[];

        if (rawAssignments.length === 0) {
          if (active) {
            setAssignments([]);
          }
          return;
        }

        // 4. Load stream names.
        const streamIds = [
          ...new Set(
            rawAssignments
              .map((assignment) => assignment.stream_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];

        let streamNames = new Map<string, string>();

        if (streamIds.length > 0) {
          const { data: streams, error: streamError } =
            await supabase
              .from("streams")
              .select("id, stream_name")
              .in("id", streamIds);

          if (streamError) throw streamError;

          streamNames = new Map(
            (streams ?? []).map((stream) => [
              stream.id,
              stream.stream_name,
            ])
          );
        }

        // 5. Load active student enrolments.
        const { data: enrolments, error: enrolmentError } =
          await supabase
            .from("student_enrollments")
            .select("student_id, class_id, stream_id, exit_date")
            .eq("school_id", schoolId)
            .is("exit_date", null);

        if (enrolmentError) throw enrolmentError;

        // 6. Match enrolments to assigned classes and streams.
        const matchingEnrolments = (enrolments ?? []).filter(
          (enrolment) =>
            rawAssignments.some(
              (assignment) =>
                assignment.class_id === enrolment.class_id &&
                assignment.stream_id !== null &&
                assignment.stream_id === enrolment.stream_id
            )
        );

        const studentIds = [
          ...new Set(
            matchingEnrolments.map(
              (enrolment) => enrolment.student_id
            )
          ),
        ];

        // 7. Load student records.
        let students: StudentInfo[] = [];

        if (studentIds.length > 0) {
          const { data: studentData, error: studentError } =
            await supabase
              .from("students")
              .select("*")
              .in("id", studentIds);

          if (studentError) throw studentError;

          students = (studentData ?? []) as unknown as StudentInfo[];
        }

        const studentsById = new Map(
          students.map((student) => [student.id, student])
        );

        // 8. Attach students to each assignment.
        const completeAssignments: Assignment[] =
          rawAssignments.map((assignment) => {
            const assignmentStudents = matchingEnrolments
              .filter(
                (enrolment) =>
                  enrolment.class_id === assignment.class_id &&
                  assignment.stream_id !== null &&
                  enrolment.stream_id === assignment.stream_id
              )
              .map((enrolment) =>
                studentsById.get(enrolment.student_id)
              )
              .filter(
                (student): student is StudentInfo =>
                  Boolean(student)
              );

            return {
              ...assignment,
              stream_name: assignment.stream_id
                ? streamNames.get(assignment.stream_id) ??
                  "Unknown stream"
                : "No stream assigned",
              students: assignmentStudents,
            };
          });

        if (active) {
          setAssignments(completeAssignments);
        }
      } catch (err) {
        console.error("Teacher dashboard error:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your dashboard."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [schoolId]);

  // 9. Calculate dashboard statistics.
  const classTeacherAssignments = assignments.filter(
    (assignment) => !assignment.subjects
  );

  const subjectTeacherAssignments = assignments.filter(
    (assignment) => Boolean(assignment.subjects)
  );

  const assignedSubjects = new Set(
    assignments
      .map((assignment) => assignment.subjects?.subject_name)
      .filter(Boolean)
  ).size;

  // Count unique students across all assignments.
  const totalStudents = new Set(
    assignments.flatMap((assignment) =>
      assignment.students.map((student) => student.id)
    )
  ).size;

  // 10. Group student lists by class and stream.
  // This prevents duplicate lists when a teacher holds both roles.
  const studentGroupsMap = new Map<string, StudentGroup>();

  assignments.forEach((assignment) => {
    if (!assignment.stream_id) return;

    const key = `${assignment.class_id}-${assignment.stream_id}`;

    if (!studentGroupsMap.has(key)) {
      studentGroupsMap.set(key, {
        key,
        className:
          assignment.classes?.class_name ?? "Unknown class",
        streamName: assignment.stream_name,
        students: [],
      });
    }

    const group = studentGroupsMap.get(key)!;

    assignment.students.forEach((student) => {
      if (
        !group.students.some(
          (existingStudent) => existingStudent.id === student.id
        )
      ) {
        group.students.push(student);
      }
    });
  });

  const studentGroups = Array.from(studentGroupsMap.values());

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              EduCoreAI
            </h1>

            <p className="text-sm text-slate-500">
              {schoolName}
            </p>
          </div>

          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Welcome */}
        <section className="mb-8">
          <p className="text-sm text-slate-500">
            Teacher Portal
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {teacherName}
          </h2>

          <p className="text-slate-600 mt-2">
            Manage your teaching responsibilities and students.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Dashboard Statistics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">
              Teaching assignments
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading ? "—" : assignments.length}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">
              Assigned subjects
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading ? "—" : assignedSubjects}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">
              My students
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading ? "—" : totalStudents}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">
              Class Teacher Roles
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading ? "—" : classTeacherAssignments.length}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">
              Subject Teacher Roles
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading ? "—" : subjectTeacherAssignments.length}
            </p>
          </div>

        </section>

        {/* Teaching Assignments */}
        <section className="bg-white rounded-xl border border-slate-200 mb-8">

          <div className="p-5 border-b border-slate-200">
            <h3 className="font-semibold text-lg text-slate-900">
              My Teaching Assignments
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Your assigned classes, streams and responsibilities.
            </p>
          </div>

          <div className="p-5">

            {loading ? (
              <p className="text-slate-500">
                Loading assignments...
              </p>
            ) : assignments.length === 0 ? (
              <p className="text-slate-500 py-6">
                No teaching assignments found.
              </p>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-left">

                  <thead>
                    <tr className="border-b border-slate-200 text-sm text-slate-500">
                      <th className="py-3 pr-4">Class</th>
                      <th className="py-3 pr-4">Stream</th>
                      <th className="py-3 pr-4">Responsibility</th>
                      <th className="py-3 pr-4">Subject</th>
                      <th className="py-3">Curriculum</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignments.map((assignment) => (
                      <tr
                        key={assignment.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium text-slate-800">
                          {assignment.classes?.class_name ??
                            "Unknown class"}
                        </td>

                        <td className="py-4 pr-4 text-slate-700">
                          {assignment.stream_name}
                        </td>

                        <td className="py-4 pr-4">
                          {assignment.subjects ? (
                            <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm">
                              Subject Teacher
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-sm">
                              Class Teacher
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-4 text-slate-700">
                          {assignment.subjects?.subject_name ??
                            "Class management"}
                        </td>

                        <td className="py-4 text-slate-600">
                          {assignment.classes?.curriculum ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            )}
          </div>
        </section>

        {/* Class Teacher Responsibilities */}
        <section className="bg-white rounded-xl border border-slate-200 mb-8">

          <div className="p-5 border-b border-slate-200">
            <h3 className="font-semibold text-lg text-slate-900">
              My Class Responsibilities
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Classes and streams where you are the class teacher.
            </p>
          </div>

          <div className="p-5">

            {loading ? (
              <p className="text-slate-500">
                Loading class responsibilities...
              </p>
            ) : classTeacherAssignments.length === 0 ? (
              <p className="text-slate-500">
                You do not currently have any class teacher responsibilities.
              </p>
            ) : (
              <div className="space-y-3">

                {classTeacherAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        {assignment.classes?.class_name}
                      </h4>

                      <p className="text-sm text-slate-500 mt-1">
                        Stream: {assignment.stream_name}
                      </p>
                    </div>

                    <span className="text-sm bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">
                      Class Teacher
                    </span>
                  </div>
                ))}

              </div>
            )}
          </div>
        </section>

        {/* Subject Teacher Responsibilities */}
        <section className="bg-white rounded-xl border border-slate-200 mb-8">

          <div className="p-5 border-b border-slate-200">
            <h3 className="font-semibold text-lg text-slate-900">
              My Subject Teaching Responsibilities
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Subjects you are responsible for teaching.
            </p>
          </div>

          <div className="p-5">

            {loading ? (
              <p className="text-slate-500">
                Loading subject responsibilities...
              </p>
            ) : subjectTeacherAssignments.length === 0 ? (
              <p className="text-slate-500">
                You do not currently have any subject teaching responsibilities.
              </p>
            ) : (
              <div className="space-y-3">

                {subjectTeacherAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        {assignment.subjects?.subject_name}
                      </h4>

                      <p className="text-sm text-slate-500 mt-1">
                        {assignment.classes?.class_name} — {assignment.stream_name}
                      </p>
                    </div>

                    <span className="text-sm bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                      Subject Teacher
                    </span>
                  </div>
                ))}

              </div>
            )}
          </div>
        </section>

        {/* Students Grouped by Class and Stream */}
        <section className="bg-white rounded-xl border border-slate-200">

          <div className="p-5 border-b border-slate-200">
            <h3 className="font-semibold text-lg text-slate-900">
              My Students
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Students in your assigned classes and streams.
            </p>
          </div>

          <div className="p-5">

            {loading ? (
              <p className="text-slate-500">
                Loading students...
              </p>
            ) : error ? (
              <p className="text-red-600">
                Student information could not be loaded.
              </p>
            ) : studentGroups.length === 0 ? (
              <p className="text-slate-500">
                No students found in your assigned classes.
              </p>
            ) : (
              <div className="space-y-8">

                {studentGroups.map((group) => (
                  <div key={group.key}>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">

                      <div>
                        <h4 className="font-semibold text-slate-800">
                          {group.className} — {group.streamName}
                        </h4>

                        <p className="text-sm text-slate-500">
                          Assigned class and stream
                        </p>
                      </div>

                      <span className="text-sm bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                        {group.students.length} students
                      </span>

                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg">

                      <table className="w-full text-left">

                        <thead className="bg-slate-50">
                          <tr className="text-sm text-slate-500">
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">
                              Admission number
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {group.students.map((student) => (
                            <tr
                              key={student.id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3 font-medium text-slate-800">
                                {getStudentName(student)}
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {getAdmissionNumber(student)}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                      </table>
                    </div>

                  </div>
                ))}

              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
