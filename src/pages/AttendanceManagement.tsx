
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  schoolId: string;
  schoolName: string;
  onBack?: () => void;
};

type ClassInfo = {
  class_name: string;
};

type Assignment = {
  id: string;
  class_id: string;
  stream_id: string;
  classes: ClassInfo | null;
  stream_name: string;
};

type StudentInfo = {
  id: string;
  [key: string]: unknown;
};

type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused";

type AttendanceStudent = {
  student: StudentInfo;
  status: AttendanceStatus | "";
  remarks: string;
};

const statusOptions: {
  value: AttendanceStatus;
  label: string;
}[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

  return (
    [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ") || `Student ${student.id.slice(0, 8)}`
  );
}

function getAdmissionNumber(student: StudentInfo) {
  const fields = [
    student.admission_number,
    student.admission_no,
    student.admission_id,
    student.admission,
  ];

  for (const value of fields) {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "Not provided";
}

export default function AttendanceManagement({
  schoolId,
  schoolName,
  onBack,
}: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] =
    useState("");

  const [attendanceDate, setAttendanceDate] =
    useState(getTodayDate());

  const [students, setStudents] = useState<AttendanceStudent[]>([]);

  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId
  );

  // Load Class Teacher assignments.
  useEffect(() => {
    let active = true;

    async function loadAssignments() {
      setLoadingAssignments(true);
      setError("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          throw new Error("Please sign in again.");
        }

        const { data, error: assignmentError } =
          await supabase
            .from("teacher_class_assignments")
            .select(`
              id,
              class_id,
              stream_id,
              classes (
                class_name
              )
            `)
            .eq("school_id", schoolId)
            .eq("teacher_user_id", user.id)
            .is("subject_id", null)
            .not("stream_id", "is", null);

        if (assignmentError) throw assignmentError;

        const rawAssignments = (data ?? []) as unknown as {
          id: string;
          class_id: string;
          stream_id: string;
          classes: ClassInfo | null;
        }[];

        const streamIds = [
          ...new Set(rawAssignments.map((item) => item.stream_id)),
        ];

        let streamMap = new Map<string, string>();

        if (streamIds.length > 0) {
          const { data: streamData, error: streamError } =
            await supabase
              .from("streams")
              .select("id, stream_name")
              .in("id", streamIds);

          if (streamError) throw streamError;

          streamMap = new Map(
            (streamData ?? []).map((stream) => [
              stream.id,
              stream.stream_name,
            ])
          );
        }

        const preparedAssignments: Assignment[] =
          rawAssignments.map((assignment) => ({
            ...assignment,
            stream_name:
              streamMap.get(assignment.stream_id) ??
              "Unknown stream",
          }));

        if (active) {
          setAssignments(preparedAssignments);

          if (preparedAssignments.length > 0) {
            setSelectedAssignmentId(preparedAssignments[0].id);
          }
        }
      } catch (err) {
        console.error(err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your class assignments."
          );
        }
      } finally {
        if (active) {
          setLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      active = false;
    };
  }, [schoolId]);

  // Load students and any previously saved attendance.
  useEffect(() => {
    let active = true;

    async function loadStudents() {
      if (!selectedAssignment) {
        setStudents([]);
        return;
      }

      setLoadingStudents(true);
      setError("");
      setSuccess("");

      try {
        const { data: enrolments, error: enrolmentError } =
          await supabase
            .from("student_enrollments")
            .select("student_id")
            .eq("school_id", schoolId)
            .eq("class_id", selectedAssignment.class_id)
            .eq("stream_id", selectedAssignment.stream_id)
            .is("exit_date", null);

        if (enrolmentError) throw enrolmentError;

        const studentIds = [
          ...new Set(
            (enrolments ?? []).map((item) => item.student_id)
          ),
        ];

        if (studentIds.length === 0) {
          if (active) setStudents([]);
          return;
        }

        const { data: studentData, error: studentError } =
          await supabase
            .from("students")
            .select("*")
            .in("id", studentIds);

        if (studentError) throw studentError;

        const { data: attendanceData, error: attendanceError } =
          await supabase
            .from("attendance_records")
            .select("student_id, status, remarks")
            .eq("school_id", schoolId)
            .eq("class_id", selectedAssignment.class_id)
            .eq("stream_id", selectedAssignment.stream_id)
            .eq("attendance_date", attendanceDate);

        if (attendanceError) throw attendanceError;

        const attendanceMap = new Map(
          (attendanceData ?? []).map((record) => [
            record.student_id,
            record,
          ])
        );

        const preparedStudents: AttendanceStudent[] = (
          (studentData ?? []) as unknown as StudentInfo[]
        ).map((student) => {
          const saved = attendanceMap.get(student.id);

          return {
            student,
            status: saved
              ? (saved.status as AttendanceStatus)
              : "",
            remarks: saved?.remarks ?? "",
          };
        });

        preparedStudents.sort((a, b) =>
          getStudentName(a.student).localeCompare(
            getStudentName(b.student)
          )
        );

        if (active) {
          setStudents(preparedStudents);
        }
      } catch (err) {
        console.error(err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load students."
          );
        }
      } finally {
        if (active) {
          setLoadingStudents(false);
        }
      }
    }

    loadStudents();

    return () => {
      active = false;
    };
  }, [
    schoolId,
    selectedAssignmentId,
    attendanceDate,
    assignments,
  ]);

  function updateStudentStatus(
    studentId: string,
    status: AttendanceStatus | ""
  ) {
    setStudents((current) =>
      current.map((item) =>
        item.student.id === studentId
          ? { ...item, status }
          : item
      )
    );
  }

  function updateStudentRemarks(
    studentId: string,
    remarks: string
  ) {
    setStudents((current) =>
      current.map((item) =>
        item.student.id === studentId
          ? { ...item, remarks }
          : item
      )
    );
  }

  function markAllPresent() {
    setStudents((current) =>
      current.map((item) => ({
        ...item,
        status: "present",
      }))
    );
  }

  async function saveAttendance() {
    if (!selectedAssignment) {
      setError("Please select a class and stream.");
      return;
    }

    if (students.length === 0) {
      setError("There are no students to record.");
      return;
    }

    const unmarkedStudents = students.filter(
      (item) => !item.status
    );

    if (unmarkedStudents.length > 0) {
      setError(
        `Please mark attendance for all students. ${unmarkedStudents.length} student(s) are still unmarked.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const records = students.map((item) => ({
        school_id: schoolId,
        student_id: item.student.id,
        class_id: selectedAssignment.class_id,
        stream_id: selectedAssignment.stream_id,
        attendance_date: attendanceDate,
        status: item.status,
        remarks: item.remarks.trim() || null,
        marked_by: user.id,
      }));

      const { error: saveError } = await supabase
        .from("attendance_records")
        .upsert(records, {
          onConflict: "school_id,student_id,attendance_date",
        });

      if (saveError) throw saveError;

      setSuccess("Attendance saved successfully.");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  const presentCount = students.filter(
    (item) => item.status === "present"
  ).length;

  const absentCount = students.filter(
    (item) => item.status === "absent"
  ).length;

  const lateCount = students.filter(
    (item) => item.status === "late"
  ).length;

  const excusedCount = students.filter(
    (item) => item.status === "excused"
  ).length;

  const unmarkedCount = students.filter(
    (item) => !item.status
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              EduCoreAI
            </h1>
            <p className="text-sm text-slate-500">
              {schoolName}
            </p>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Page heading */}
        <div className="mb-8">
          <p className="text-sm text-blue-600 font-medium">
            Class Teacher Portal
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Attendance Management
          </h2>

          <p className="text-slate-600 mt-2">
            Record and manage daily student attendance.
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Selection controls */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 mb-6">

          <h3 className="font-semibold text-slate-900 mb-4">
            Attendance Register
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Class and Stream
              </label>

              <select
                value={selectedAssignmentId}
                onChange={(event) =>
                  setSelectedAssignmentId(event.target.value)
                }
                disabled={loadingAssignments}
                className="w-full rounded-lg border border-slate-300 p-3 bg-white"
              >
                <option value="">
                  Select your assigned class
                </option>

                {assignments.map((assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.id}
                  >
                    {assignment.classes?.class_name ?? "Unknown class"}
                    {" — "}
                    {assignment.stream_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Attendance Date
              </label>

              <input
                type="date"
                value={attendanceDate}
                max={getTodayDate()}
                onChange={(event) =>
                  setAttendanceDate(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

          </div>

          {loadingAssignments && (
            <p className="text-sm text-slate-500 mt-4">
              Loading your assigned classes...
            </p>
          )}

          {!loadingAssignments && assignments.length === 0 && (
            <p className="text-sm text-amber-700 mt-4">
              No Class Teacher assignments with streams were found.
              Ask your administrator to check your assignments.
            </p>
          )}

        </section>

        {/* Attendance statistics */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">

          {[
            { label: "Present", count: presentCount },
            { label: "Absent", count: absentCount },
            { label: "Late", count: lateCount },
            { label: "Excused", count: excusedCount },
            { label: "Unmarked", count: unmarkedCount },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <p className="text-sm text-slate-500">
                {item.label}
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-1">
                {item.count}
              </p>
            </div>
          ))}

        </section>

        {/* Student register */}
        <section className="bg-white rounded-xl border border-slate-200">

          <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">

            <div>
              <h3 className="font-semibold text-lg text-slate-900">
                Student Register
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                {selectedAssignment?.classes?.class_name ?? "No class selected"}
                {" — "}
                {selectedAssignment?.stream_name ?? ""}
              </p>
            </div>

            <button
              onClick={markAllPresent}
              disabled={loadingStudents || students.length === 0}
              className="rounded-lg bg-blue-50 text-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
            >
              Mark All Present
            </button>

          </div>

          <div className="p-5">

            {loadingStudents ? (
              <p className="text-slate-500 py-6">
                Loading student register...
              </p>
            ) : students.length === 0 ? (
              <p className="text-slate-500 py-6">
                No active students found in this class and stream.
              </p>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-left">

                  <thead>
                    <tr className="border-b border-slate-200 text-sm text-slate-500">
                      <th className="py-3 pr-4">Student</th>
                      <th className="py-3 pr-4">Admission No.</th>
                      <th className="py-3 pr-4">Attendance</th>
                      <th className="py-3">Remarks</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((item) => (
                      <tr
                        key={item.student.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium text-slate-800 whitespace-nowrap">
                          {getStudentName(item.student)}
                        </td>

                        <td className="py-4 pr-4 text-slate-600 whitespace-nowrap">
                          {getAdmissionNumber(item.student)}
                        </td>

                        <td className="py-4 pr-4 min-w-40">
                          <select
                            value={item.status}
                            onChange={(event) =>
                              updateStudentStatus(
                                item.student.id,
                                event.target.value as AttendanceStatus | ""
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 p-2 bg-white text-sm"
                          >
                            <option value="">
                              Select status
                            </option>

                            {statusOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-4 min-w-48">
                          <input
                            type="text"
                            value={item.remarks}
                            onChange={(event) =>
                              updateStudentRemarks(
                                item.student.id,
                                event.target.value
                              )
                            }
                            placeholder="Optional remarks"
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>
            )}

            {/* Save */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">

              <p className="text-sm text-slate-500">
                {students.length} students
                {" · "}
                {students.length - unmarkedCount} marked
                {" · "}
                {unmarkedCount} unmarked
              </p>

              <button
                onClick={saveAttendance}
                disabled={
                  saving ||
                  loadingStudents ||
                  students.length === 0
                }
                className="rounded-lg bg-emerald-600 text-white px-6 py-3 font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Attendance"}
              </button>

            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
