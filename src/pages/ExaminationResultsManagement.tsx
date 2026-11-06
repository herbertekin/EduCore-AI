
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Save,
  AlertCircle,
  Users,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type Props = {
  schoolId: string
  schoolName: string
  role: 'admin' | 'teacher'
  onBack: () => void
}

type ExamSession = {
  id: string
  exam_name: string
  status: string
  academic_year_id: string
  class_id: string
  stream_id: string | null
}

type Assessment = {
  id: string
  school_id: string
  exam_session_id: string | null
  assessment_name: string
  maximum_marks: number
  academic_year_id: string
  class_id: string
  stream_id: string | null
  subject_id: string
  paper_number: number | null
  paper_name: string | null
  assessment_date: string | null
}

type Subject = {
  id: string
  subject_name: string
  subject_code: string
}

type TeacherAssignment = {
  class_id: string
  subject_id: string | null
  stream_id: string | null
}

type Student = {
  id: string
  admission_number: string
  first_name: string
  middle_name: string | null
  last_name: string | null
}

type Enrollment = {
  student_id: string
  enrollment_date: string
  exit_date: string | null
  stream_id: string | null
}

type AssessmentResult = {
  id: string
  assessment_id: string
  student_id: string
  marks_obtained: number | null
  result_status: 'present' | 'absent' | 'exempt'
  teacher_comment: string | null
}

type ResultEntry = {
  marks: string
  status: 'present' | 'absent' | 'exempt'
  comment: string
}

function getErrorMessage(error: unknown) {
  const dbError = error as {
    message?: string
    details?: string
    hint?: string
    code?: string
  }

  return [
    dbError?.message || 'An unexpected error occurred.',
    dbError?.details,
    dbError?.hint,
    dbError?.code ? `Error code: ${dbError.code}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
}

function getStudentName(student: Student) {
  return [
    student.first_name,
    student.middle_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(' ')
}

function emptyResult(): ResultEntry {
  return {
    marks: '',
    status: 'present',
    comment: '',
  }
}

export default function ExaminationResultsManagement({
  schoolId,
  schoolName,
  role,
  onBack,
}: Props) {
  const isAdmin = role === 'admin'

  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])

  const [students, setStudents] = useState<Student[]>([])
  const [results, setResults] = useState<Record<string, ResultEntry>>({})

  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // --------------------------------------------------
  // SELECTED RECORDS
  // --------------------------------------------------

  const selectedSession = sessions.find(
    (item) => item.id === selectedSessionId,
  )

  const selectedAssessment = assessments.find(
    (item) => item.id === selectedAssessmentId,
  )

  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  )

  const selectedSubject = selectedAssessment
    ? subjectMap.get(selectedAssessment.subject_id)
    : undefined

  // --------------------------------------------------
  // TEACHER ASSIGNMENT VALIDATION
  // --------------------------------------------------

  const teacherCanAccessAssessment = useCallback(
    (assessment: Assessment) => {
      if (isAdmin) return true

      return assignments.some((assignment) => {
        const classMatches =
          assignment.class_id === assessment.class_id

        const subjectMatches =
          assignment.subject_id === null ||
          assignment.subject_id === assessment.subject_id

        const streamMatches =
          assignment.stream_id === null ||
          assignment.stream_id === assessment.stream_id

        return classMatches && subjectMatches && streamMatches
      })
    },
    [assignments, isAdmin],
  )

  const visibleSessions = useMemo(() => {
    if (isAdmin) return sessions

    return sessions.filter((session) =>
      assessments.some(
        (assessment) =>
          assessment.exam_session_id === session.id &&
          teacherCanAccessAssessment(assessment),
      ),
    )
  }, [sessions, assessments, isAdmin, teacherCanAccessAssessment])

  const sessionAssessments = useMemo(() => {
    if (!selectedSessionId) return []

    return assessments.filter(
      (assessment) =>
        assessment.exam_session_id === selectedSessionId &&
        teacherCanAccessAssessment(assessment),
    )
  }, [assessments, selectedSessionId, teacherCanAccessAssessment])

  // --------------------------------------------------
  // EDIT PERMISSIONS
  // --------------------------------------------------

  const canEdit = Boolean(
    selectedAssessment &&
    selectedSession &&
    teacherCanAccessAssessment(selectedAssessment) &&
    (
      isAdmin ||
      ['draft', 'published'].includes(
        selectedSession.status.toLowerCase(),
      )
    ),
  )

  // --------------------------------------------------
  // LOAD EXAMINATIONS AND PAPERS
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const [
        sessionsResult,
        assessmentsResult,
        subjectsResult,
        userResult,
      ] = await Promise.all([
        supabase
          .from('exam_sessions')
          .select(
            'id, exam_name, status, academic_year_id, class_id, stream_id',
          )
          .eq('school_id', schoolId)
          .order('exam_name'),

        supabase
          .from('assessments')
          .select(
            'id, school_id, exam_session_id, assessment_name, maximum_marks, academic_year_id, class_id, stream_id, subject_id, paper_number, paper_name, assessment_date',
          )
          .eq('school_id', schoolId)
          .not('exam_session_id', 'is', null)
          .order('assessment_name'),

        supabase
          .from('subjects')
          .select('id, subject_name, subject_code')
          .eq('school_id', schoolId)
          .order('subject_name'),

        supabase.auth.getUser(),
      ])

      if (sessionsResult.error) throw sessionsResult.error
      if (assessmentsResult.error) throw assessmentsResult.error
      if (subjectsResult.error) throw subjectsResult.error
      if (userResult.error) throw userResult.error

      setSessions((sessionsResult.data ?? []) as ExamSession[])
      setAssessments((assessmentsResult.data ?? []) as Assessment[])
      setSubjects((subjectsResult.data ?? []) as Subject[])

      if (!isAdmin && userResult.data.user) {
        const assignmentResult = await supabase
          .from('teacher_class_assignments')
          .select('class_id, subject_id, stream_id')
          .eq('school_id', schoolId)
          .eq('teacher_user_id', userResult.data.user.id)

        if (assignmentResult.error) {
          throw assignmentResult.error
        }

        setAssignments(
          (assignmentResult.data ?? []) as TeacherAssignment[],
        )
      } else {
        setAssignments([])
      }

      setSelectedSessionId('')
      setSelectedAssessmentId('')
      setStudents([])
      setResults({})
    } catch (err) {
      console.error('Examination results loading error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [schoolId, isAdmin])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // --------------------------------------------------
  // LOAD STUDENTS AND EXISTING RESULTS
  // --------------------------------------------------

  const loadStudentsAndResults = useCallback(async () => {
    if (!selectedAssessment) {
      setStudents([])
      setResults({})
      return
    }

    setLoadingStudents(true)
    setError('')
    setSuccess('')

    try {
      const [
        studentsResult,
        enrollmentResult,
        resultsResult,
      ] = await Promise.all([
        supabase
          .from('students')
          .select(
            'id, admission_number, first_name, middle_name, last_name',
          )
          .eq('school_id', schoolId)
          .order('admission_number'),

        supabase
          .from('student_enrollments')
          .select(
            'student_id, enrollment_date, exit_date, stream_id',
          )
          .eq('school_id', schoolId)
          .eq('class_id', selectedAssessment.class_id)
          .eq('academic_year_id', selectedAssessment.academic_year_id),

        supabase
          .from('assessment_results')
          .select(
            'id, assessment_id, student_id, marks_obtained, result_status, teacher_comment',
          )
          .eq('assessment_id', selectedAssessment.id),
      ])

      if (studentsResult.error) throw studentsResult.error
      if (enrollmentResult.error) throw enrollmentResult.error
      if (resultsResult.error) throw resultsResult.error

      const studentRows = (studentsResult.data ?? []) as Student[]
      const enrollmentRows = (enrollmentResult.data ?? []) as Enrollment[]
      const resultRows = (resultsResult.data ?? []) as AssessmentResult[]

      const studentMap = new Map(
        studentRows.map((student) => [student.id, student]),
      )

      const assessmentDate = selectedAssessment.assessment_date

      const eligibleEnrollments = enrollmentRows.filter((enrollment) => {
        const streamMatches =
          selectedAssessment.stream_id === null ||
          enrollment.stream_id === selectedAssessment.stream_id

        if (!streamMatches) return false

        if (!assessmentDate) {
          return enrollment.exit_date === null
        }

        return (
          enrollment.enrollment_date <= assessmentDate &&
          (
            enrollment.exit_date === null ||
            enrollment.exit_date >= assessmentDate
          )
        )
      })

      const roster = eligibleEnrollments
        .map((enrollment) => studentMap.get(enrollment.student_id))
        .filter((student): student is Student => Boolean(student))
        .sort((a, b) =>
          a.admission_number.localeCompare(b.admission_number),
        )

      setStudents(roster)

      const resultMap: Record<string, ResultEntry> = {}

      for (const result of resultRows) {
        resultMap[result.student_id] = {
          marks:
            result.marks_obtained === null
              ? ''
              : String(result.marks_obtained),
          status: result.result_status ?? 'present',
          comment: result.teacher_comment ?? '',
        }
      }

      setResults(resultMap)
    } catch (err) {
      console.error('Student results loading error:', err)
      setError(getErrorMessage(err))
      setStudents([])
      setResults({})
    } finally {
      setLoadingStudents(false)
    }
  }, [selectedAssessment, schoolId])

  useEffect(() => {
    void loadStudentsAndResults()
  }, [loadStudentsAndResults])

  // --------------------------------------------------
  // UPDATE RESULT ENTRY
  // --------------------------------------------------

  const updateResult = (
    studentId: string,
    patch: Partial<ResultEntry>,
  ) => {
    setResults((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? emptyResult()),
        ...patch,
      },
    }))
  }

  const getResult = (studentId: string): ResultEntry =>
    results[studentId] ?? emptyResult()

  const enteredCount = students.filter((student) => {
    const result = results[student.id]

    return Boolean(
      result &&
      (
        result.status === 'absent' ||
        result.status === 'exempt' ||
        result.marks.trim() !== ''
      ),
    )
  }).length

  const presentCount = students.filter((student) => {
    const result = results[student.id]
    return result?.status === 'present' && result.marks.trim() !== ''
  }).length

  const absentCount = students.filter(
    (student) => results[student.id]?.status === 'absent',
  ).length

  const exemptCount = students.filter(
    (student) => results[student.id]?.status === 'exempt',
  ).length

  // --------------------------------------------------
  // SAVE RESULTS
  // --------------------------------------------------

  
const handleSaveResults = async () => {
  if (!selectedAssessment || !canEdit) {
    setError('You do not have permission to save these results.')
    return
  }

  setError('')
  setSuccess('')

  const entries = students
    .map((student) => ({
      student,
      result: getResult(student.id),
    }))
    .filter(({ result }) =>
      result.status === 'absent' ||
      result.status === 'exempt' ||
      result.marks.trim() !== '',
    )

  if (entries.length === 0) {
    setError(
      'Enter at least one mark or select an absence/exemption status.',
    )
    return
  }

  for (const { student, result } of entries) {
    if (result.status === 'present') {
      if (result.marks.trim() === '') {
        setError(
          `Enter marks or select another status for ${getStudentName(student)}.`,
        )
        return
      }

      const marks = Number(result.marks)

      if (
        !Number.isFinite(marks) ||
        marks < 0 ||
        marks > Number(selectedAssessment.maximum_marks)
      ) {
        setError(
          `${getStudentName(student)} must have marks between 0 and ${selectedAssessment.maximum_marks}.`,
        )
        return
      }
    }
  }

  setSaving(true)
  setSuccess('Saving examination results...')

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError

    if (!user) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    const payload = entries.map(({ student, result }) => ({
      school_id: schoolId,
      assessment_id: selectedAssessment.id,
      student_id: student.id,
      marks_obtained:
        result.status === 'present'
          ? Number(result.marks)
          : null,
      result_status: result.status,
      teacher_comment: result.comment.trim() || null,
      recorded_by: user.id,
    }))

    const { error: saveError } = await supabase
      .from('assessment_results')
      .upsert(payload, {
        onConflict: 'assessment_id,student_id',
      })

    if (saveError) throw saveError

    // Reload the saved records before displaying success.
    await loadStudentsAndResults()

    setSuccess(
      `Success! ${entries.length} student result${entries.length === 1 ? '' : 's'} saved successfully.`,
    )
  } catch (err) {
    console.error('Saving examination results error:', err)
    setSuccess('')
    setError(getErrorMessage(err))
  } finally {
    setSaving(false)
  }
}


  // --------------------------------------------------
  // USER INTERFACE
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <ClipboardList
                  size={25}
                  className="text-emerald-700"
                />

                <h1 className="text-2xl font-bold text-gray-900">
                  Examination Results & Marks Entry
                </h1>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {schoolName} · {isAdmin ? 'Administrator' : 'Teacher'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {/* ERROR AND SUCCESS MESSAGES */}

       {saving && (
  <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
    <RefreshCw size={19} className="animate-spin" />
    <p>Saving examination results to the database. Please wait...</p>
  </div>
)}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* EXAMINATION AND PAPER SELECTION */}

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen size={19} className="text-emerald-700" />

            <h2 className="font-bold text-gray-900">
              Select examination and paper
            </h2>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">
              Loading examinations and papers...
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Examination
                </label>

                <select
                  value={selectedSessionId}
                  onChange={(event) => {
                    setSelectedSessionId(event.target.value)
                    setSelectedAssessmentId('')
                    setStudents([])
                    setResults({})
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Select examination</option>

                  {visibleSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.exam_name} — {session.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Examination paper
                </label>

                <select
                  value={selectedAssessmentId}
                  onChange={(event) =>
                    setSelectedAssessmentId(event.target.value)
                  }
                  disabled={!selectedSessionId}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:bg-gray-100"
                >
                  <option value="">Select paper</option>

                  {sessionAssessments.map((assessment) => {
                    const subject = subjectMap.get(assessment.subject_id)

                    return (
                      <option key={assessment.id} value={assessment.id}>
                        {subject?.subject_name ?? 'Subject'} —{' '}
                        {assessment.paper_name || assessment.assessment_name}
                        {' '}({assessment.maximum_marks} marks)
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
          )}

          {selectedSession && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                {selectedSession.status.toUpperCase()}
              </span>

              <span className="text-gray-500">
                {selectedAssessment
                  ? `${selectedSubject?.subject_name ?? 'Subject'} · Maximum ${selectedAssessment.maximum_marks} marks`
                  : 'Choose a paper to continue'}
              </span>
            </div>
          )}
        </section>

        {/* RESULTS REGISTER */}

        {selectedAssessment && (
          <>
            {!canEdit && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                {selectedSession?.status.toLowerCase() === 'completed'
                  ? 'This examination is completed. Only administrators can edit its results.'
                  : 'You are not assigned to this examination paper. Contact your administrator if you need access.'}
              </div>
            )}

            {/* SUMMARY CARDS */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Enrolled students</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {students.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Marks entered</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {presentCount}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Absent</p>
                <p className="mt-2 text-2xl font-bold text-red-600">
                  {absentCount}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-500">Exempt</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                  {exemptCount}
                </p>
              </div>
            </div>

            {/* STUDENT REGISTER */}

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-bold text-gray-900">
                    Student marks register
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {selectedAssessment.assessment_name} ·{' '}
                    {selectedSubject?.subject_name ?? 'Subject'} ·{' '}
                    {selectedAssessment.maximum_marks} maximum marks
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users size={17} />
                  {enteredCount} of {students.length} entered
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
                  <RefreshCw size={20} className="animate-spin" />
                  Loading student register...
                </div>
              ) : students.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={32} className="mx-auto text-gray-400" />

                  <h3 className="mt-3 font-semibold text-gray-800">
                    No enrolled students found
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Check student enrolments for this class, stream and academic year.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-4">#</th>
                        <th className="px-4 py-4">Admission No.</th>
                        <th className="px-4 py-4">Student</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">
                          Marks / {selectedAssessment.maximum_marks}
                        </th>
                        <th className="px-4 py-4">Teacher comment</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {students.map((student, index) => {
                        const result = getResult(student.id)

                        return (
                          <tr
                            key={student.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-gray-500">
                              {index + 1}
                            </td>

                            <td className="px-4 py-3 font-medium text-gray-700">
                              {student.admission_number}
                            </td>

                            <td className="px-4 py-3 font-medium text-gray-900">
                              {getStudentName(student)}
                            </td>

                            <td className="px-4 py-3">
                              <select
                                value={result.status}
                                disabled={!canEdit || saving}
                                onChange={(event) => {
                                  const status =
                                    event.target.value as ResultEntry['status']

                                  updateResult(student.id, {
                                    status,
                                    ...(status !== 'present'
                                      ? { marks: '' }
                                      : {}),
                                  })
                                }}
                                className="w-full min-w-[125px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm disabled:bg-gray-100"
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="exempt">Exempt</option>
                              </select>
                            </td>

                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max={selectedAssessment.maximum_marks}
                                step="0.01"
                                value={result.marks}
                                disabled={
                                  !canEdit ||
                                  saving ||
                                  result.status !== 'present'
                                }
                                onChange={(event) =>
                                  updateResult(student.id, {
                                    marks: event.target.value,
                                  })
                                }
                                placeholder={
                                  result.status === 'present'
                                    ? 'Enter marks'
                                    : 'Not applicable'
                                }
                                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                              />
                            </td>

                            <td className="px-4 py-3">
                              <input
                                type="text"
                                maxLength={500}
                                value={result.comment}
                                disabled={!canEdit || saving}
                                onChange={(event) =>
                                  updateResult(student.id, {
                                    comment: event.target.value,
                                  })
                                }
                                placeholder="Optional comment"
                                className="w-full min-w-[170px] rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SAVE FOOTER */}

              <div className="flex flex-col justify-between gap-3 border-t border-gray-100 bg-gray-50 p-5 sm:flex-row sm:items-center">
                <p className="text-xs text-gray-500">
                  Only entered marks and explicitly selected absence or
                  exemption statuses will be saved. Blank rows remain untouched.
                </p>

                <button
                  type="button"
                  onClick={() => void handleSaveResults()}
                  disabled={
                    !canEdit ||
                    saving ||
                    loadingStudents ||
                    students.length === 0 ||
                    enteredCount === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}

                  {saving ? 'Saving results...' : 'Save entered results'}
                </button>
              </div>
            </section>
          </>
        )}

        {!selectedAssessment && !loading && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <ClipboardList
              size={35}
              className="mx-auto text-gray-400"
            />

            <h3 className="mt-4 font-semibold text-gray-800">
              Select an examination paper
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Choose an examination and paper above to open its student marks register.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
