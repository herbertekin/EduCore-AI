
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabase";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

type AcademicYear = {
  id: string;
  school_id: string;
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

type AttendanceRecord = {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  stream_id: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: string | null;
};

type Student = {
  id: string;
  [key: string]: unknown;
};

type ClassInfo = {
  id: string;
  class_name?: string;
  name?: string;
};

type StreamInfo = {
  id: string;
  class_id: string;
  stream_name?: string;
  name?: string;
};

type ReportRow = AttendanceRecord & {
  studentName: string;
  admissionNumber: string;
  className: string;
  streamName: string;
};

type StudentReport = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
};

type ClassReport = {
  key: string;
  className: string;
  streamName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
};

type MonthlyReport = {
  month: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
};

type AttendanceReportsProps = {
  schoolId: string;
  schoolName: string;
  onBack?: () => void;
};

const getStudentName = (student: Student | undefined) => {
  if (!student) return "Unknown student";

  const directName =
    student.full_name ||
    student.student_name ||
    student.name;

  if (directName) return String(directName);

  const parts = [
    student.first_name,
    student.middle_name,
    student.last_name,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "Unknown student";
};

const getAdmissionNumber = (student: Student | undefined) => {
  if (!student) return "—";

  return String(
    student.admission_number ||
    student.admission_no ||
    student.admission_id ||
    student.admission ||
    "—"
  );
};

const getStatusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const formatPercentage = (value: number) =>
  `${value.toFixed(1)}%`;

const getMonthKey = (date: string) => date.slice(0, 7);

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-KE", {
    month: "short",
    year: "2-digit",
  });

const getDateRange = (
  academicYear: AcademicYear,
  term?: Term
) => ({
  start:
    term && term.start_date > academicYear.start_date
      ? term.start_date
      : academicYear.start_date,
  end:
    term && term.end_date < academicYear.end_date
      ? term.end_date
      : academicYear.end_date,
});

export default function AttendanceReports({
  schoolId,
  schoolName,
  onBack,
}: AttendanceReportsProps) {
  const [academicYear, setAcademicYear] =
    useState<AcademicYear | null>(null);

  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("all");

  const [records, setRecords] = useState<ReportRow[]>([]);

  // Classes and streams are loaded independently of attendance.
  const [schoolClasses, setSchoolClasses] = useState<ClassInfo[]>([]);
  const [schoolStreams, setSchoolStreams] = useState<StreamInfo[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [loadingYear, setLoadingYear] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Analytics filters
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedStream, setSelectedStream] = useState("all");

  const [activeTab, setActiveTab] = useState<
    "overview" | "classes" | "students"
  >("overview");

  // --------------------------------------------------
  // 1. LOAD ACTIVE ACADEMIC YEAR AND TERMS
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadAcademicYear = async () => {
      setLoadingYear(true);
      setError("");
      setAcademicYear(null);
      setTerms([]);
      setRecords([]);

      setSelectedTermId("all");
      setSelectedClass("all");
      setSelectedStream("all");
      setSearch("");

      try {
        const {
          data: yearData,
          error: yearError,
        } = await supabase
          .from("academic_years")
          .select(
            "id, school_id, year_name, start_date, end_date, is_active"
          )
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (yearError) throw yearError;
        if (cancelled) return;

        if (!yearData) {
          setError(
            "No active academic year was found. Please activate an academic year in Academic Year Management."
          );
          return;
        }

        const year = yearData as AcademicYear;
        setAcademicYear(year);

        const {
          data: termData,
          error: termError,
        } = await supabase
          .from("terms")
          .select(
            "id, academic_year_id, term_number, start_date, end_date"
          )
          .eq("academic_year_id", year.id)
          .order("term_number", { ascending: true });

        if (termError) throw termError;
        if (cancelled) return;

        setTerms((termData || []) as Term[]);
      } catch (err) {
        console.error("Academic year loading error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load the active academic year."
          );
        }
      } finally {
        if (!cancelled) setLoadingYear(false);
      }
    };

    if (!schoolId) {
      setError("School information is missing.");
      setLoadingYear(false);
      return;
    }

    void loadAcademicYear();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  // --------------------------------------------------
  // 2. LOAD ALL SCHOOL CLASSES AND STREAMS
  // Independent of attendance records
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadClassAndStreamOptions = async () => {
      setLoadingOptions(true);

      try {
        const {
          data: classesData,
          error: classesError,
        } = await supabase
          .from("classes")
          .select("*")
          .eq("school_id", schoolId);

        if (classesError) throw classesError;

        const loadedClasses = (classesData || []) as ClassInfo[];

        if (cancelled) return;

        setSchoolClasses(loadedClasses);

        const classIds = loadedClasses.map((item) => item.id);

        if (classIds.length === 0) {
          setSchoolStreams([]);
          return;
        }

        const {
          data: streamsData,
          error: streamsError,
        } = await supabase
          .from("streams")
          .select("*")
          .in("class_id", classIds);

        if (streamsError) throw streamsError;

        if (cancelled) return;

        setSchoolStreams((streamsData || []) as StreamInfo[]);
      } catch (err) {
        console.error("Class and stream options error:", err);

        if (!cancelled) {
          setSchoolClasses([]);
          setSchoolStreams([]);

          setError(
            err instanceof Error
              ? `Failed to load classes and streams: ${err.message}`
              : "Failed to load classes and streams."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    if (schoolId) {
      void loadClassAndStreamOptions();
    }

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  // --------------------------------------------------
  // 3. LOAD ATTENDANCE FOR THE SELECTED YEAR / TERM
  // --------------------------------------------------

  const loadReports = useCallback(async () => {
    if (!academicYear) return;

    const selectedTerm = terms.find(
      (term) => term.id === selectedTermId
    );

    const range = getDateRange(academicYear, selectedTerm);

    if (range.start > range.end) {
      setRecords([]);
      setError("The selected reporting period is invalid.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("school_id", schoolId)
        .gte("attendance_date", range.start)
        .lte("attendance_date", range.end)
        .order("attendance_date", { ascending: false });

      if (attendanceError) throw attendanceError;

      const attendance =
        (attendanceData || []) as AttendanceRecord[];

      if (attendance.length === 0) {
        setRecords([]);
        return;
      }

      const studentIds = [
        ...new Set(attendance.map((record) => record.student_id)),
      ];

      const classIds = [
        ...new Set(attendance.map((record) => record.class_id)),
      ];

      const streamIds = [
        ...new Set(
          attendance
            .map((record) => record.stream_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const [
        { data: studentsData, error: studentsError },
        { data: classesData, error: classesError },
      ] = await Promise.all([
        supabase
          .from("students")
          .select("*")
          .in("id", studentIds),

        supabase
          .from("classes")
          .select("*")
          .in("id", classIds),
      ]);

      if (studentsError) throw studentsError;
      if (classesError) throw classesError;

      let streamsData: StreamInfo[] = [];

      if (streamIds.length > 0) {
        const {
          data,
          error: streamsError,
        } = await supabase
          .from("streams")
          .select("*")
          .in("id", streamIds);

        if (streamsError) throw streamsError;

        streamsData = (data || []) as StreamInfo[];
      }

      const studentMap = new Map(
        ((studentsData || []) as Student[]).map(
          (student) => [student.id, student]
        )
      );

      const classMap = new Map(
        ((classesData || []) as ClassInfo[]).map(
          (item) => [item.id, item]
        )
      );

      const streamMap = new Map(
        streamsData.map((item) => [item.id, item])
      );

      const reportRows: ReportRow[] = attendance.map((record) => {
        const student = studentMap.get(record.student_id);
        const classInfo = classMap.get(record.class_id);

        const streamInfo = record.stream_id
          ? streamMap.get(record.stream_id)
          : undefined;

        return {
          ...record,
          studentName: getStudentName(student),
          admissionNumber: getAdmissionNumber(student),
          className:
            classInfo?.class_name ||
            classInfo?.name ||
            "Unknown class",
          streamName:
            streamInfo?.stream_name ||
            streamInfo?.name ||
            "No stream",
        };
      });

      setRecords(reportRows);
    } catch (err) {
      console.error("Attendance analytics error:", err);

      setRecords([]);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance records."
      );
    } finally {
      setLoading(false);
    }
  }, [academicYear, terms, selectedTermId, schoolId]);

  useEffect(() => {
    if (academicYear) void loadReports();
  }, [academicYear, loadReports]);

  // --------------------------------------------------
  // 4. FILTER OPTIONS
  // Classes and streams come from their own tables.
  // --------------------------------------------------

  const classOptions = useMemo(() => {
    return schoolClasses
      .map((item) => ({
        id: item.id,
        name: item.class_name || item.name || "Unnamed class",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schoolClasses]);

  const streamOptions = useMemo(() => {
    return schoolStreams
      .filter((stream) => {
        return (
          selectedClass === "all" ||
          stream.class_id === selectedClass
        );
      })
      .map((stream) => ({
        id: stream.id,
        name:
          stream.stream_name ||
          stream.name ||
          "Unnamed stream",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schoolStreams, selectedClass]);

  // --------------------------------------------------
  // 5. FILTER RECORDS
  // --------------------------------------------------

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesClass =
        selectedClass === "all" ||
        record.class_id === selectedClass;

      const matchesStream =
        selectedStream === "all" ||
        record.stream_id === selectedStream;

      const matchesSearch =
        !query ||
        record.studentName.toLowerCase().includes(query) ||
        record.admissionNumber.toLowerCase().includes(query) ||
        record.className.toLowerCase().includes(query);

      return (
        matchesClass &&
        matchesStream &&
        matchesSearch
      );
    });
  }, [records, search, selectedClass, selectedStream]);

  // --------------------------------------------------
  // 6. RESET FILTERS
  // --------------------------------------------------

  const resetFilters = () => {
    setSelectedClass("all");
    setSelectedStream("all");
    setSearch("");
  };

  // --------------------------------------------------
  // 7. OVERALL STATISTICS
  // --------------------------------------------------

  const stats = useMemo(() => {
    const total = filteredRecords.length;

    const present = filteredRecords.filter(
      (record) => record.status === "present"
    ).length;

    const absent = filteredRecords.filter(
      (record) => record.status === "absent"
    ).length;

    const late = filteredRecords.filter(
      (record) => record.status === "late"
    ).length;

    const excused = filteredRecords.filter(
      (record) => record.status === "excused"
    ).length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total
        ? ((present + late) / total) * 100
        : 0,
    };
  }, [filteredRecords]);

  // --------------------------------------------------
  // 8. MONTH-BY-MONTH ATTENDANCE ANALYTICS
  // --------------------------------------------------

  const monthlyReports = useMemo(() => {
    if (!academicYear) return [];

    const selectedTerm = terms.find(
      (term) => term.id === selectedTermId
    );

    const range = getDateRange(academicYear, selectedTerm);

    const months: MonthlyReport[] = [];

    const start = new Date(`${range.start}T12:00:00`);
    const end = new Date(`${range.end}T12:00:00`);

    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      1,
      12
    );

    while (cursor <= end) {
      const monthKey = getMonthKey(
        `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, "0")}-01`
      );

      const monthRecords = filteredRecords.filter(
        (record) =>
          getMonthKey(record.attendance_date) === monthKey
      );

      const present = monthRecords.filter(
        (record) => record.status === "present"
      ).length;

      const absent = monthRecords.filter(
        (record) => record.status === "absent"
      ).length;

      const late = monthRecords.filter(
        (record) => record.status === "late"
      ).length;

      const excused = monthRecords.filter(
        (record) => record.status === "excused"
      ).length;

      const total = monthRecords.length;

      months.push({
        month: getMonthLabel(cursor),
        present,
        absent,
        late,
        excused,
        total,
        rate: total
          ? ((present + late) / total) * 100
          : 0,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  }, [
    academicYear,
    terms,
    selectedTermId,
    filteredRecords,
  ]);

  // --------------------------------------------------
  // 9. CLASS AND STREAM COMPARISON
  // --------------------------------------------------

  const classReports = useMemo(() => {
    const groups = new Map<string, ClassReport>();

    filteredRecords.forEach((record) => {
      const key =
        `${record.class_id}-${record.stream_id || "none"}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          className: record.className,
          streamName: record.streamName,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          rate: 0,
        });
      }

      const group = groups.get(key)!;

      group.total += 1;
      group[record.status] += 1;
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rate: group.total
          ? ((group.present + group.late) / group.total) * 100
          : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [filteredRecords]);

  // --------------------------------------------------
  // 10. STUDENT ATTENDANCE HISTORY
  // --------------------------------------------------

  const studentReports = useMemo(() => {
    const groups = new Map<string, StudentReport>();

    filteredRecords.forEach((record) => {
      if (!groups.has(record.student_id)) {
        groups.set(record.student_id, {
          studentId: record.student_id,
          studentName: record.studentName,
          admissionNumber: record.admissionNumber,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          rate: 0,
        });
      }

      const group = groups.get(record.student_id)!;

      group.total += 1;
      group[record.status] += 1;
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rate: group.total
          ? ((group.present + group.late) / group.total) * 100
          : 0,
      }))
      .sort((a, b) => b.absent - a.absent);
  }, [filteredRecords]);

  // --------------------------------------------------
  // 11. FREQUENT ABSENCE MONITORING
  // --------------------------------------------------

  const frequentAbsences = useMemo(
    () => studentReports.filter((student) => student.absent >= 3),
    [studentReports]
  );

  // --------------------------------------------------
  // 12. CSV EXPORT
  // --------------------------------------------------

  const exportCsv = () => {
    if (!filteredRecords.length) {
      alert("There are no attendance records to export.");
      return;
    }

    const headers = [
      "Academic Year",
      "Date",
      "Student Name",
      "Admission Number",
      "Class",
      "Stream",
      "Status",
      "Remarks",
    ];

    const rows = filteredRecords.map((record) => [
      academicYear?.year_name || "",
      record.attendance_date,
      record.studentName,
      record.admissionNumber,
      record.className,
      record.streamName,
      getStatusLabel(record.status),
      record.remarks || "",
    ]);

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `educore-attendance-${academicYear?.year_name || "report"}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // --------------------------------------------------
  // 13. PDF / PRINT EXPORT
  // --------------------------------------------------

  const exportPdf = () => {
    if (!filteredRecords.length) {
      alert("There are no attendance records to export.");
      return;
    }

    window.print();
  };

  // --------------------------------------------------
  // 14. STATUS STYLING
  // --------------------------------------------------

  const statusClass = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-700";
      case "absent":
        return "bg-red-100 text-red-700";
      case "late":
        return "bg-amber-100 text-amber-700";
      case "excused":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // --------------------------------------------------
  // 15. STATISTICS CARD
  // --------------------------------------------------

  const StatCard = ({
    title,
    value,
    color,
    subtitle,
  }: {
    title: string;
    value: string | number;
    color: string;
    subtitle?: string;
  }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
      )}
    </div>
  );

  // --------------------------------------------------
  // 16. MAIN PAGE
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <style>
        {`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .print-area {
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
            }
            .print-card {
              box-shadow: none !important;
              break-inside: avoid;
            }
            .recharts-responsive-container { min-height: 240px; }
            table { width: 100% !important; font-size: 10px !important; }
            th, td { padding: 6px !important; }
          }
        `}
      </style>

      <div className="print-area mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="no-print mb-3 text-sm font-medium text-emerald-700 hover:text-emerald-900"
              >
                ← Back
              </button>
            )}

            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Attendance Analytics
            </h1>

            <p className="mt-1 text-sm text-gray-500">{schoolName}</p>

            {academicYear && (
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Academic Year: {academicYear.year_name}
              </p>
            )}
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              disabled={!filteredRecords.length || loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ↓ Export CSV
            </button>

            <button
              onClick={exportPdf}
              disabled={!filteredRecords.length || loading}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              ↓ Print / Save PDF
            </button>
          </div>
        </div>

        {/* ACADEMIC YEAR AND TERM */}

        <section className="no-print rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-800">
              Academic reporting period
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Reports automatically use your school's active academic year.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Active academic year
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800">
                {loadingYear
                  ? "Loading academic year..."
                  : academicYear?.year_name || "No active academic year"}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Term
              </label>
              <select
                value={selectedTermId}
                onChange={(event) =>
                  setSelectedTermId(event.target.value)
                }
                disabled={!academicYear || loadingYear}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                <option value="all">Entire academic year</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    Term {term.term_number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* LOADING */}

        {(loadingYear || loading) && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">
              Loading academic-year attendance analytics...
            </p>
          </div>
        )}

        {/* ANALYTICS */}

        {!loadingYear && !loading && academicYear && (
          <>
            {/* REFINED FILTERS */}

            <section className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    Refine analytics
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Filter attendance reports by class, stream, or student.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={
                    selectedClass === "all" &&
                    selectedStream === "all" &&
                    search === ""
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↻ Reset filters
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {/* CLASS */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Class
                  </label>

                  <select
                    value={selectedClass}
                    onChange={(event) => {
                      setSelectedClass(event.target.value);
                      setSelectedStream("all");
                    }}
                    disabled={loadingOptions}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-gray-100"
                  >
                    <option value="all">
                      {loadingOptions ? "Loading classes..." : "All classes"}
                    </option>

                    {classOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* STREAM */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Stream
                  </label>

                  <select
                    value={selectedStream}
                    onChange={(event) =>
                      setSelectedStream(event.target.value)
                    }
                    disabled={loadingOptions || streamOptions.length === 0}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="all">
                      {loadingOptions ? "Loading streams..." : "All streams"}
                    </option>

                    {streamOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  {selectedClass !== "all" && (
                    <p className="mt-1 text-xs text-gray-400">
                      Showing streams in the selected class.
                    </p>
                  )}
                </div>

                {/* STUDENT SEARCH */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Search student
                  </label>

                  <div className="relative">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Name or admission number..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />

                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear student search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">
                  Showing{" "}
                  <span className="font-semibold text-gray-800">
                    {filteredRecords.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-800">
                    {records.length}
                  </span>{" "}
                  attendance records
                </p>

                {(selectedClass !== "all" ||
                  selectedStream !== "all" ||
                  search !== "") && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Filters applied
                  </span>
                )}
              </div>
            </section>

            {/* PRINT HEADER */}

            <div className="hidden print:block">
              <h2 className="text-xl font-bold">
                {schoolName} — Attendance Report
              </h2>
              <p>Academic Year: {academicYear.year_name}</p>
              <p>
                Reporting period:{" "}
                {selectedTermId === "all"
                  ? "Entire academic year"
                  : `Term ${
                      terms.find(
                        (term) => term.id === selectedTermId
                      )?.term_number || ""
                    }`}
              </p>
              <p>
                Class:{" "}
                {selectedClass === "all"
                  ? "All classes"
                  : classOptions.find(
                      (item) => item.id === selectedClass
                    )?.name || "Selected class"}
              </p>
              <p>
                Stream:{" "}
                {selectedStream === "all"
                  ? "All streams"
                  : streamOptions.find(
                      (item) => item.id === selectedStream
                    )?.name || "Selected stream"}
              </p>
            </div>

            {/* SUMMARY CARDS */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Attendance records"
                value={stats.total}
                color="text-gray-900"
                subtitle="Recorded entries"
              />
              <StatCard
                title="Present"
                value={stats.present}
                color="text-green-600"
              />
              <StatCard
                title="Absent"
                value={stats.absent}
                color="text-red-600"
              />
              <StatCard
                title="Late / Excused"
                value={`${stats.late} / ${stats.excused}`}
                color="text-amber-600"
              />
              <StatCard
                title="Attendance rate"
                value={formatPercentage(stats.attendanceRate)}
                color="text-emerald-700"
                subtitle="Present + late / recorded entries"
              />
            </section>

            {/* MONTHLY ATTENDANCE CHART */}

            <section className="print-card rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Monthly Attendance Trends
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Month-by-month attendance throughout the selected academic period.
                </p>
              </div>

              {monthlyReports.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyReports}
                      margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="present"
                        name="Present"
                        stackId="attendance"
                        fill="#16a34a"
                      />
                      <Bar
                        dataKey="absent"
                        name="Absent"
                        stackId="attendance"
                        fill="#dc2626"
                      />
                      <Bar
                        dataKey="late"
                        name="Late"
                        stackId="attendance"
                        fill="#f59e0b"
                      />
                      <Bar
                        dataKey="excused"
                        name="Excused"
                        stackId="attendance"
                        fill="#3b82f6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-gray-500">
                  No months available for this reporting period.
                </p>
              )}
            </section>

            {/* MONTHLY ATTENDANCE RATE */}

            <section className="print-card rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Monthly Attendance Rate
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Percentage of recorded entries marked present or late.
                </p>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyReports}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis dataKey="month" />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value).toFixed(1)}%`,
                        "Attendance rate",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Attendance rate"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* CLASS COMPARISON */}

            <section className="print-card rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Class Attendance Comparison
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Attendance rates by class and stream.
                </p>
              </div>

              {classReports.length > 0 ? (
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={classReports}
                      layout="vertical"
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="className"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toFixed(1)}%`,
                          "Attendance rate",
                        ]}
                      />
                      <Bar
                        dataKey="rate"
                        name="Attendance rate"
                        fill="#059669"
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-gray-500">
                  No class comparison data available.
                </p>
              )}
            </section>

            {/* FREQUENT ABSENCES */}

            <section className="print-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Frequent Absence Monitoring
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Students with at least three recorded absences in this reporting period.
                </p>
              </div>

              {frequentAbsences.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-medium text-green-700">
                    No frequent absence records found.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    This is based on the attendance records currently available.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Admission No.</th>
                        <th className="px-4 py-3">Records</th>
                        <th className="px-4 py-3">Absences</th>
                        <th className="px-4 py-3">Attendance rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {frequentAbsences.map((student) => (
                        <tr key={student.studentId}>
                          <td className="px-4 py-3 font-medium">
                            {student.studentName}
                          </td>
                          <td className="px-4 py-3">
                            {student.admissionNumber}
                          </td>
                          <td className="px-4 py-3">{student.total}</td>
                          <td className="px-4 py-3 font-semibold text-red-600">
                            {student.absent}
                          </td>
                          <td className="px-4 py-3">
                            {formatPercentage(student.rate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* TABS */}

            <div className="no-print flex flex-wrap gap-2 border-b border-gray-200">
              {(
                [
                  ["overview", "Daily Records"],
                  ["classes", "Class Summaries"],
                  ["students", "Student History"],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                    activeTab === tab
                      ? "border-emerald-700 text-emerald-700"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* DAILY RECORDS */}

            {activeTab === "overview" && (
              <section className="print-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-4">
                  <h2 className="font-semibold text-gray-800">
                    Attendance Records
                  </h2>
                </div>

                {filteredRecords.length === 0 ? (
                  <p className="p-10 text-center text-sm text-gray-500">
                    No attendance records found for this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Admission No.</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Stream</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredRecords.map((record) => (
                          <tr key={record.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {record.attendance_date}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {record.studentName}
                            </td>
                            <td className="px-4 py-3">
                              {record.admissionNumber}
                            </td>
                            <td className="px-4 py-3">
                              {record.className}
                            </td>
                            <td className="px-4 py-3">
                              {record.streamName}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(record.status)}`}
                              >
                                {getStatusLabel(record.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {record.remarks || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* CLASS SUMMARIES */}

            {activeTab === "classes" && (
              <section className="print-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-4">
                  <h2 className="font-semibold text-gray-800">
                    Class and Stream Summaries
                  </h2>
                </div>

                {classReports.length === 0 ? (
                  <p className="p-10 text-center text-sm text-gray-500">
                    No class attendance data available.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Stream</th>
                          <th className="px-4 py-3">Records</th>
                          <th className="px-4 py-3">Present</th>
                          <th className="px-4 py-3">Absent</th>
                          <th className="px-4 py-3">Late</th>
                          <th className="px-4 py-3">Excused</th>
                          <th className="px-4 py-3">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {classReports.map((item) => (
                          <tr key={item.key}>
                            <td className="px-4 py-3 font-medium">
                              {item.className}
                            </td>
                            <td className="px-4 py-3">
                              {item.streamName}
                            </td>
                            <td className="px-4 py-3">{item.total}</td>
                            <td className="px-4 py-3 text-green-700">
                              {item.present}
                            </td>
                            <td className="px-4 py-3 text-red-700">
                              {item.absent}
                            </td>
                            <td className="px-4 py-3">{item.late}</td>
                            <td className="px-4 py-3">{item.excused}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatPercentage(item.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* STUDENT HISTORY */}

            {activeTab === "students" && (
              <section className="print-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-4">
                  <h2 className="font-semibold text-gray-800">
                    Individual Student Attendance History
                  </h2>
                </div>

                {studentReports.length === 0 ? (
                  <p className="p-10 text-center text-sm text-gray-500">
                    No student attendance data available.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Admission No.</th>
                          <th className="px-4 py-3">Records</th>
                          <th className="px-4 py-3">Present</th>
                          <th className="px-4 py-3">Absent</th>
                          <th className="px-4 py-3">Late</th>
                          <th className="px-4 py-3">Excused</th>
                          <th className="px-4 py-3">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentReports.map((student) => (
                          <tr key={student.studentId}>
                            <td className="px-4 py-3 font-medium">
                              {student.studentName}
                            </td>
                            <td className="px-4 py-3">
                              {student.admissionNumber}
                            </td>
                            <td className="px-4 py-3">{student.total}</td>
                            <td className="px-4 py-3 text-green-700">
                              {student.present}
                            </td>
                            <td className="px-4 py-3 text-red-700">
                              {student.absent}
                            </td>
                            <td className="px-4 py-3">{student.late}</td>
                            <td className="px-4 py-3">{student.excused}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatPercentage(student.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* FOOTNOTE */}

            <p className="text-xs text-gray-500">
              Analytics are based on recorded attendance entries.
              Missing attendance entries are not automatically counted
              as absences. Attendance rate is calculated as
              (Present + Late) divided by all recorded entries.
              Frequent absence monitoring identifies three or more
              recorded absences.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
