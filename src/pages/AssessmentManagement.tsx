
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  ClipboardList,
  CalendarDays,
  BookOpen,
  Users,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'

type AssessmentManagementProps = {
  schoolId: string
  schoolName: string
  onBack: () => void
}

type AcademicYear = {
  id: string
  year_name: string
  is_active: boolean
  start_date: string
  end_date: string
}

type Term = {
  id: string
  academic_year_id: string
  term_number: number
  start_date: string
  end_date: string
}

type SchoolClass = {
  id: string
  class_name: string
  class_level: number | null
}

type SchoolStream = {
  id: string
  class_id: string
  stream_name: string
}

type Subject = {
  id: string
  subject_name: string
  subject_code: string | null
}

type ClassSubject = {
  class_id: string
  subject_id: string
}

type Assessment = {
  id: string
  school_id: string
  class_id: string
  stream_id: string | null
  subject_id: string
  academic_year_id: string
  term_id: string
  assessment_name: string
  assessment_type: string
  assessment_date: string | null
  maximum_marks: number
  created_at: string
}

type AssessmentForm = {
  assessment_name: string
  assessment_type: string
  academic_year_id: string
  term_id: string
  class_id: string
  stream_id: string
  subject_id: string
  assessment_date: string
  maximum_marks: string
}

const INITIAL_FORM: AssessmentForm = {
  assessment_name: '',
  assessment_type: 'CAT',
  academic_year_id: '',
  term_id: '',
  class_id: '',
  stream_id: '',
  subject_id: '',
  assessment_date: '',
  maximum_marks: '100',
}

const ASSESSMENT_TYPES = [
  'CAT',
  'Mid-Term Exam',
  'End-Term Exam',
  'Assignment',
  'Project',
  'Practical',
  'Quiz',
  'Other',
]

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message)
  }

  return 'An unexpected error occurred.'
}

function formatDate(value: string | null): string {
  if (!value) return 'Not specified'

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    'en-KE',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  )
}

function AssessmentManagement({
  schoolId,
  schoolName,
  onBack,
}: AssessmentManagementProps) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [streams, setStreams] = useState<SchoolStream[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])

  const [form, setForm] = useState<AssessmentForm>(INITIAL_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterClass, setFilterClass] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<
    'success' | 'error' | 'info'
  >('info')

  const notify = useCallback(
    (
      text: string,
      type: 'success' | 'error' | 'info' = 'info'
    ) => {
      setMessage(text)
      setMessageType(type)
    },
    []
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage('')

    try {
      const [
        yearsResult,
        termsResult,
        classesResult,
        streamsResult,
        subjectsResult,
        classSubjectsResult,
        assessmentsResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, year_name, is_active, start_date, end_date')
          .eq('school_id', schoolId)
          .order('year_name', { ascending: false }),

        supabase
          .from('terms')
          .select('id, academic_year_id, term_number, start_date, end_date')
          .order('term_number'),

        supabase
          .from('classes')
          .select('id, class_name, class_level')
          .eq('school_id', schoolId)
          .order('class_level'),

        supabase
          .from('streams')
          .select('id, class_id, stream_name')
          .order('stream_name'),

        supabase
          .from('subjects')
          .select('id, subject_name, subject_code')
          .eq('school_id', schoolId)
          .order('subject_name'),

        supabase
          .from('class_subjects')
          .select('class_id, subject_id')
          .eq('school_id', schoolId),

        supabase
          .from('assessments')
          .select(`
            id,
            school_id,
            class_id,
            stream_id,
            subject_id,
            academic_year_id,
            term_id,
            assessment_name,
            assessment_type,
            assessment_date,
            maximum_marks,
            created_at
          `)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
      ])

      const firstError = [
        yearsResult.error,
        termsResult.error,
        classesResult.error,
        streamsResult.error,
        subjectsResult.error,
        classSubjectsResult.error,
        assessmentsResult.error,
      ].find(Boolean)

      if (firstError) {
        throw firstError
      }

      const years = (yearsResult.data ?? []) as AcademicYear[]

      setAcademicYears(years)
      setTerms((termsResult.data ?? []) as Term[])
      setClasses((classesResult.data ?? []) as SchoolClass[])
      setStreams((streamsResult.data ?? []) as SchoolStream[])
      setSubjects((subjectsResult.data ?? []) as Subject[])
      setClassSubjects(
        (classSubjectsResult.data ?? []) as ClassSubject[]
      )
      setAssessments((assessmentsResult.data ?? []) as Assessment[])

      setForm((current) => {
        if (current.academic_year_id || years.length === 0) {
          return current
        }

        const activeYear = years.find((year) => year.is_active)

        return {
          ...current,
          academic_year_id: (activeYear ?? years[0]).id,
        }
      })
    } catch (error) {
      notify(
        `Could not load assessment information: ${getErrorMessage(error)}`,
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [schoolId, notify])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const availableTerms = useMemo(
    () =>
      terms.filter(
        (term) => term.academic_year_id === form.academic_year_id
      ),
    [terms, form.academic_year_id]
  )

  const availableStreams = useMemo(
    () =>
      streams.filter((stream) => stream.class_id === form.class_id),
    [streams, form.class_id]
  )

  const availableSubjects = useMemo(() => {
    if (!form.class_id) return []

    const assignedSubjectIds = classSubjects
      .filter((item) => item.class_id === form.class_id)
      .map((item) => item.subject_id)

    // If a class has configured subject links, use those subjects.
    // If it has none, show the school's available subjects.
    if (assignedSubjectIds.length === 0) {
      return subjects
    }

    return subjects.filter((subject) =>
      assignedSubjectIds.includes(subject.id)
    )
  }, [subjects, classSubjects, form.class_id])

  const yearMap = useMemo(
    () => new Map(academicYears.map((year) => [year.id, year.year_name])),
    [academicYears]
  )

  const termMap = useMemo(
    () =>
      new Map(
        terms.map((term) => [
          term.id,
          `Term ${term.term_number}`,
        ])
      ),
    [terms]
  )

  const classMap = useMemo(
    () =>
      new Map(
        classes.map((schoolClass) => [
          schoolClass.id,
          schoolClass.class_name,
        ])
      ),
    [classes]
  )

  const streamMap = useMemo(
    () =>
      new Map(
        streams.map((stream) => [stream.id, stream.stream_name])
      ),
    [streams]
  )

  const subjectMap = useMemo(
    () =>
      new Map(
        subjects.map((subject) => [
          subject.id,
          subject.subject_name,
        ])
      ),
    [subjects]
  )

  const filteredAssessments = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return assessments.filter((assessment) => {
      const matchesSearch =
        !searchTerm ||
        assessment.assessment_name.toLowerCase().includes(searchTerm) ||
        (subjectMap.get(assessment.subject_id) ?? '')
          .toLowerCase()
          .includes(searchTerm) ||
        (classMap.get(assessment.class_id) ?? '')
          .toLowerCase()
          .includes(searchTerm)

      const matchesYear =
        filterYear === 'all' ||
        assessment.academic_year_id === filterYear

      const matchesClass =
        filterClass === 'all' ||
        assessment.class_id === filterClass

      const matchesType =
        filterType === 'all' ||
        assessment.assessment_type === filterType

      return (
        matchesSearch &&
        matchesYear &&
        matchesClass &&
        matchesType
      )
    })
  }, [
    assessments,
    search,
    filterYear,
    filterClass,
    filterType,
    subjectMap,
    classMap,
  ])

  const resetForm = () => {
    const activeYear = academicYears.find((year) => year.is_active)

    setForm({
      ...INITIAL_FORM,
      academic_year_id: activeYear?.id ?? academicYears[0]?.id ?? '',
    })

    setEditingId(null)
    setShowForm(false)
  }

  const updateForm = <K extends keyof AssessmentForm>(
    field: K,
    value: AssessmentForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  useEffect(() => {
    if (!form.academic_year_id) return

    const termStillValid = availableTerms.some(
      (term) => term.id === form.term_id
    )

    if (!termStillValid) {
      setForm((current) => ({
        ...current,
        term_id: '',
      }))
    }
  }, [form.academic_year_id, availableTerms, form.term_id])

  useEffect(() => {
    if (!form.class_id) return

    if (
      form.stream_id &&
      !availableStreams.some((stream) => stream.id === form.stream_id)
    ) {
      setForm((current) => ({
        ...current,
        stream_id: '',
      }))
    }

    if (
      form.subject_id &&
      !availableSubjects.some(
        (subject) => subject.id === form.subject_id
      )
    ) {
      setForm((current) => ({
        ...current,
        subject_id: '',
      }))
    }
  }, [
    form.class_id,
    form.stream_id,
    form.subject_id,
    availableStreams,
    availableSubjects,
  ])

  const handleCreate = () => {
    resetForm()
    setShowForm(true)
    setMessage('')
  }

  const handleEdit = (assessment: Assessment) => {
    setEditingId(assessment.id)

    setForm({
      assessment_name: assessment.assessment_name,
      assessment_type: assessment.assessment_type,
      academic_year_id: assessment.academic_year_id,
      term_id: assessment.term_id,
      class_id: assessment.class_id,
      stream_id: assessment.stream_id ?? '',
      subject_id: assessment.subject_id,
      assessment_date: assessment.assessment_date ?? '',
      maximum_marks: String(assessment.maximum_marks),
    })

    setShowForm(true)
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

   const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    const maximumMarks = Number(form.maximum_marks)

    if (!form.assessment_name.trim()) {
      notify('Enter an assessment name.', 'error')
      return
    }

    if (
      !form.academic_year_id ||
      !form.term_id ||
      !form.class_id ||
      !form.subject_id
    ) {
      notify(
        'Select the academic year, term, class and subject.',
        'error'
      )
      return
    }

    if (!Number.isFinite(maximumMarks) || maximumMarks <= 0) {
      notify('Maximum marks must be greater than zero.', 'error')
      return
    }

    if (
      form.stream_id &&
      !availableStreams.some((stream) => stream.id === form.stream_id)
    ) {
      notify('Select a valid stream for the chosen class.', 'error')
      return
    }

    if (
      !availableSubjects.some(
        (subject) => subject.id === form.subject_id
      )
    ) {
      notify('Select a valid subject for the chosen class.', 'error')
      return
    }

    setSaving(true)

    try {
      const payload = {
        school_id: schoolId,
        academic_year_id: form.academic_year_id,
        term_id: form.term_id,
        class_id: form.class_id,
        stream_id: form.stream_id || null,
        subject_id: form.subject_id,
        assessment_name: form.assessment_name.trim(),
        assessment_type: form.assessment_type,
        assessment_date: form.assessment_date || null,
        maximum_marks: maximumMarks,
      }

      if (editingId) {
        const { error } = await supabase
          .from('assessments')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)

        if (error) throw error

        notify('Assessment updated successfully.', 'success')
      } else {
        const { data: userData, error: userError } =
          await supabase.auth.getUser()

        if (userError) throw userError

        const { error } = await supabase
          .from('assessments')
          .insert({
            ...payload,
            created_by: userData.user?.id ?? null,
          })

        if (error) throw error

        notify('Assessment created successfully.', 'success')
      }

      resetForm()
      await loadData()
    } catch (error) {
      notify(
        `Could not save assessment: ${getErrorMessage(error)}`,
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (assessment: Assessment) => {
    const confirmed = window.confirm(
      `Delete "${assessment.assessment_name}"?\n\nAny results recorded for this assessment will also be deleted by the database cascade. This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingId(assessment.id)
    setMessage('')

    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', assessment.id)
        .eq('school_id', schoolId)

      if (error) throw error

      setAssessments((current) =>
        current.filter((item) => item.id !== assessment.id)
      )

      notify('Assessment deleted successfully.', 'success')

      if (editingId === assessment.id) {
        resetForm()
      }
    } catch (error) {
      notify(
        `Could not delete assessment: ${getErrorMessage(error)}`,
        'error'
      )
    } finally {
      setDeletingId(null)
    }
  }

  const stats = useMemo(() => {
    const total = assessments.length
    const exams = assessments.filter((item) =>
      item.assessment_type.toLowerCase().includes('exam')
    ).length
    const cats = assessments.filter((item) =>
      item.assessment_type.toLowerCase().includes('cat')
    ).length

    return { total, exams, cats }
  }, [assessments])

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-emerald-700 hover:text-emerald-800 font-semibold mb-3"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Exam & Assessment Management
            </h1>

            <p className="text-slate-500 mt-1">
              {schoolName} · Manage school assessments
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={17} />
              New Assessment
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
              messageType === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : messageType === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {messageType === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
            )}

            <p className="text-sm font-medium">{message}</p>

            <button
              type="button"
              onClick={() => setMessage('')}
              className="ml-auto"
              aria-label="Dismiss message"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Assessments</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <ClipboardList size={25} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Examinations</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stats.exams}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <BookOpen size={25} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">CAT Assessments</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stats.cats}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <Users size={25} />
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <section className="mb-8 rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Assessment' : 'Create New Assessment'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter the assessment details below.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close assessment form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Assessment Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={form.assessment_name}
                    onChange={(event) =>
                      updateForm('assessment_name', event.target.value)
                    }
                    placeholder="e.g. Mathematics CAT 1"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Assessment Type *
                  </label>
                  <select
                    required
                    value={form.assessment_type}
                    onChange={(event) =>
                      updateForm('assessment_type', event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                  >
                    {ASSESSMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Academic Year *
                  </label>
                  <select
                    required
                    value={form.academic_year_id}
                    onChange={(event) =>
                      updateForm('academic_year_id', event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.year_name}
                        {year.is_active ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Term *
                  </label>
                  <select
                    required
                    value={form.term_id}
                    onChange={(event) =>
                      updateForm('term_id', event.target.value)
                    }
                    disabled={!form.academic_year_id}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 disabled:bg-slate-100"
                  >
                    <option value="">Select term</option>
                    {availableTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        Term {term.term_number}
                      </option>
                    ))}
                  </select>
                  {form.academic_year_id && availableTerms.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No terms are configured for this academic year.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Class *
                  </label>
                  <select
                    required
                    value={form.class_id}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        class_id: event.target.value,
                        stream_id: '',
                        subject_id: '',
                      }))
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                  >
                    <option value="">Select class</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Stream
                  </label>
                  <select
                    value={form.stream_id}
                    onChange={(event) =>
                      updateForm('stream_id', event.target.value)
                    }
                    disabled={!form.class_id || availableStreams.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 disabled:bg-slate-100"
                  >
                    <option value="">
                      {availableStreams.length === 0
                        ? 'All streams / No streams'
                        : 'All streams'}
                    </option>
                    {availableStreams.map((stream) => (
                      <option key={stream.id} value={stream.id}>
                        {stream.stream_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Leave empty to include all streams in the class.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Subject *
                  </label>
                  <select
                    required
                    value={form.subject_id}
                    onChange={(event) =>
                      updateForm('subject_id', event.target.value)
                    }
                    disabled={!form.class_id}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 disabled:bg-slate-100"
                  >
                    <option value="">Select subject</option>
                    {availableSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_name}
                        {subject.subject_code
                          ? ` (${subject.subject_code})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form.maximum_marks}
                    onChange={(event) =>
                      updateForm('maximum_marks', event.target.value)
                    }
                    placeholder="e.g. 100"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Assessment Date
                  </label>
                  <input
                    type="date"
                    value={form.assessment_date}
                    onChange={(event) =>
                      updateForm('assessment_date', event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

              </div>

              <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save size={17} />
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Assessment'
                      : 'Create Assessment'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Assessment Records
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  View and manage assessments created for your school.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                {filteredAssessments.length} records
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assessments..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={filterYear}
                onChange={(event) => setFilterYear(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="all">All academic years</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year_name}
                  </option>
                ))}
              </select>

              <select
                value={filterClass}
                onChange={(event) => setFilterClass(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="all">All classes</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.class_name}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="all">All assessment types</option>
                {ASSESSMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-slate-500">
              <RefreshCw size={20} className="animate-spin" />
              Loading assessments...
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ClipboardList size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                No assessments found
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Create your first assessment or change the filters to see
                existing records.
              </p>
              <button
                type="button"
                onClick={handleCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={17} />
                Create Assessment
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Assessment</th>
                    <th className="px-5 py-4 font-semibold">Class / Stream</th>
                    <th className="px-5 py-4 font-semibold">Subject</th>
                    <th className="px-5 py-4 font-semibold">Year / Term</th>
                    <th className="px-5 py-4 font-semibold">Date</th>
                    <th className="px-5 py-4 font-semibold">Maximum</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAssessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {assessment.assessment_name}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {assessment.assessment_type}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        <p className="font-medium">
                          {classMap.get(assessment.class_id) ?? 'Unknown class'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {assessment.stream_id
                            ? streamMap.get(assessment.stream_id) ?? 'Unknown stream'
                            : 'All streams'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {subjectMap.get(assessment.subject_id) ?? 'Unknown subject'}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        <p>{yearMap.get(assessment.academic_year_id) ?? 'Unknown year'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {termMap.get(assessment.term_id) ?? 'Unknown term'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays size={15} className="text-slate-400" />
                          {formatDate(assessment.assessment_date)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {Number(assessment.maximum_marks).toLocaleString()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(assessment)}
                            title="Edit assessment"
                            className="rounded-lg border border-slate-200 p-2 text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(assessment)}
                            disabled={deletingId === assessment.id}
                            title="Delete assessment and its results"
                            className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === assessment.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-5 text-xs text-slate-400">
          Assessment records are stored securely in your school's Supabase database.
          Student marks entry and academic performance reports will be added in the next stage.
        </p>
      </div>
    </main>
  )
}

export default AssessmentManagement
